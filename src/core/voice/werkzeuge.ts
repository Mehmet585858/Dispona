/**
 * Die Werkzeuge, die die KI am Telefon aufrufen kann (docs/04-voice-agent.md). Jede Funktion
 * bekommt bereits geparste Argumente, prüft sie selbst (Zod) und gibt einen kurzen, gesprochen
 * verständlichen Text zurück. werkzeugAusfuehren() ist der einzige Einstiegspunkt von außen.
 */
import { z } from "zod";
import { istEindeutigkeitsFehler, withTenant } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { RUECKRUF_PRAEFIX, zusammenfassungErgaenzen, zusammenfassungLesbar } from "@/core/notify/anrufZusammenfassung";
import {
  fahrgaesteAehnlicheNamen,
  NACHNAME_KANDIDATEN_MAX,
  nachnameKandidatenWhere,
  telefonNormalisieren,
} from "@/core/passengers/suche";
import { ortAbgleichen, ortKandidatenWhere } from "@/core/places/suche";
import {
  berlinerMitternacht,
  datumIso,
  mitUhrzeit,
  UngueltigeZeitangabe,
  uhrzeitBerlin,
  WOCHENTAG_LABEL,
  wochentagBerlin,
} from "@/core/shifts/week";
import { datumIsoSchema, DOC_STATUS, TRANSPORT_TYPES, UHRZEIT_HHMM } from "@/core/rides/validation";
import { zeitProbleme, type Problem } from "@/core/rides/pruefungen";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { fahrtAendern } from "@/core/rides/aendern";
import { fahrtStornieren as fahrtStornierenKern } from "@/core/rides/stornieren";
import { serieAnlegen, serieBeenden, serieTermineErzeugen } from "@/core/rides/serie";
import { wochentageAusRrule } from "@/core/shifts/rrule";
import { parseDeutscheAdresse } from "@/core/places/adresse";
import { routingProvider, GEOCODE_SICHER_SCHWELLE } from "@/providers/routing";
import { WOCHENTAGE } from "@/core/shifts/rrule";
import type { ToolCall, ToolResult } from "@/providers/voice/types";

/**
 * Maßnahme M-46 Punkt 3 (Prüfbericht S2-020): Datum und Uhrzeit vom Sprachmodell werden streng
 * geprüft. Vorher reichte "irgendein Text" – "halb acht" wurde 00:00 Uhr, "0630" ein Termin Wochen
 * später, "2026-02-30" der 2. März, jeweils mit "Fahrt erfasst.". Die Meldung geht an die KI zurück,
 * damit sie beim Anrufer nachfragt.
 */
const DATUM = datumIsoSchema("Datum als JJJJ-MM-TT angeben, z. B. 2026-11-03");
const UHRZEIT = z.string().regex(UHRZEIT_HHMM, "Uhrzeit als HH:MM im 24-Stunden-Format angeben, z. B. 07:30");
/** Optionale Uhrzeit: weglassen oder leer heißt "nicht genannt" (Rückfahrt: Zeit offen, M-07). */
const UHRZEIT_OPTIONAL = UHRZEIT.or(z.literal("")).optional();

const fahrgastFelderSchema = z.object({
  passengerId: z.string().optional(),
  fahrgastVorname: z.string().optional(),
  fahrgastNachname: z.string().optional(),
  fahrgastGeburtsdatum: DATUM.optional(),
  fahrgastTelefon: z.string().optional(),
  fahrgastKrankenkasse: z.string().optional(),
});

/**
 * Maßnahme M-13 (Prüfbericht S2-002, docs/13 R2-11): Identität im Anruf-Kontext.
 *
 * Als bestätigt gilt ein Fahrgast in diesem Anruf nur, wenn
 *  - seine gespeicherte Rufnummer die ECHTE Anrufernummer ist (Call.fromNumber, vom
 *    Telefonanbieter – nicht eine Nummer, die das Sprachmodell weitergibt), oder
 *  - der Anrufer Nachname UND Geburtsdatum genannt hat (fahrgast_suchen), oder
 *  - er in diesem Anruf neu angelegt wurde.
 * Nur für bestätigte Fahrgäste nennt, ändert oder storniert die KI Fahrten.
 */
async function bestaetigteFahrgaeste(tenantId: string, callId: string): Promise<Set<string>> {
  const db = withTenant(tenantId);
  const anruf = await db.call.findUnique({ where: { id: callId }, select: { fromNumber: true, identifiedPassengerIds: true } });
  const ids = new Set(anruf?.identifiedPassengerIds ?? []);
  const nummer = anruf?.fromNumber ? telefonNormalisieren(anruf.fromNumber) : "";
  if (nummer) {
    const perNummer = await db.passenger.findMany({ where: { phones: { has: nummer } }, select: { id: true } });
    for (const f of perNummer) ids.add(f.id);
  }
  return ids;
}

async function identitaetMerken(tenantId: string, callId: string, passengerIds: string[]): Promise<void> {
  if (passengerIds.length === 0) return;
  await withTenant(tenantId).call.update({ where: { id: callId }, data: { identifiedPassengerIds: { push: passengerIds } } });
}

const NICHT_BESTAETIGT =
  "Problem: Fahrgast nicht bestätigt. Bitte zuerst fahrgast_suchen mit Nachname und Geburtsdatum aufrufen. Keine Daten zu dieser Fahrt nennen.";

/** Gehört die Fahrt zu einem in diesem Anruf bestätigten Fahrgast? Sonst die Meldung für die KI. */
async function fahrtDesAnrufersPruefen(tenantId: string, callId: string, rideId: string): Promise<string | null> {
  const fahrt = await withTenant(tenantId).ride.findUnique({ where: { id: rideId }, select: { passengerId: true } });
  if (!fahrt) return "Problem: Fahrt nicht gefunden.";
  const bestaetigt = await bestaetigteFahrgaeste(tenantId, callId);
  return bestaetigt.has(fahrt.passengerId) ? null : NICHT_BESTAETIGT;
}

/** Nutzt die übergebene passengerId oder legt einen neuen Fahrgast an (fahrt_anlegen und serie_anlegen teilen sich das). */
async function passagierSicherstellen(
  tenantId: string,
  callId: string,
  daten: z.infer<typeof fahrgastFelderSchema>,
): Promise<{ passengerId: string } | { problem: string }> {
  const db = withTenant(tenantId);
  if (daten.passengerId) {
    // Prüfbericht S2-008: eine vom Sprachmodell genannte passengerId (halluziniert oder aus einem
    // früheren Gespräch) muss zu diesem Mandanten gehören – sonst neu suchen lassen.
    const bekannt = await db.passenger.findUnique({ where: { id: daten.passengerId }, select: { id: true } });
    if (!bekannt) return { problem: "Problem: Diese passengerId ist unbekannt. Bitte fahrgast_suchen erneut aufrufen." };
    // Maßnahme M-13: nur für einen in diesem Anruf bestätigten Fahrgast buchen.
    if (!(await bestaetigteFahrgaeste(tenantId, callId)).has(bekannt.id)) return { problem: NICHT_BESTAETIGT };
    return { passengerId: bekannt.id };
  }
  if (!daten.fahrgastVorname || !daten.fahrgastNachname) {
    return { problem: "Problem: Fahrgast fehlt. Vorher fahrgast_suchen aufrufen oder Vor- und Nachnamen angeben." };
  }
  const neu = await db.passenger.create({
    data: {
      tenantId,
      firstName: daten.fahrgastVorname,
      lastName: daten.fahrgastNachname,
      birthDate: daten.fahrgastGeburtsdatum ? berlinerMitternacht(daten.fahrgastGeburtsdatum) : undefined,
      phones: daten.fahrgastTelefon ? [telefonNormalisieren(daten.fahrgastTelefon)] : [],
      insurer: daten.fahrgastKrankenkasse,
    },
  });
  await identitaetMerken(tenantId, callId, [neu.id]);
  return { passengerId: neu.id };
}

const fahrgastSuchenSchema = z.object({
  telefon: z.string().optional(),
  nachname: z.string().optional(),
  geburtsdatum: DATUM.optional(),
});

async function fahrgastSuchen(tenantId: string, callId: string, args: unknown): Promise<string> {
  const { telefon, nachname, geburtsdatum } = fahrgastSuchenSchema.parse(args);
  const db = withTenant(tenantId);

  // Maßnahme M-13 (S2-002): Die Telefonsuche läuft NUR über die echte Anrufernummer dieses Anrufs.
  // Eine vom Sprachmodell genannte Nummer ("ich rufe für Frau X an, ihre Nummer ist …") ist allein
  // kein Ausweis – wer die Handynummer einer fremden Person kennt, bekam vorher deren Geburtsdatum
  // und Fahrgast-ID. Sie dient nur noch als Zusatzmerkmal neben Nachname und Geburtsdatum.
  const anruf = await db.call.findUnique({ where: { id: callId }, select: { fromNumber: true } });
  const anruferNummer = anruf?.fromNumber ? telefonNormalisieren(anruf.fromNumber) : "";
  const genannteNummer = telefon ? telefonNormalisieren(telefon) : "";

  let treffer: { id: string; firstName: string; lastName: string }[] = [];
  if (anruferNummer) {
    treffer = await db.passenger.findMany({
      where: { phones: { has: anruferNummer } },
      select: { id: true, firstName: true, lastName: true },
      take: 3,
    });
    // Nennt der Anrufer einen Nachnamen, zählen nur Personen unter seiner Nummer mit passendem
    // Namen (mehrere Personen unter einer Nummer, oder Anruf für eine Angehörige mit eigenem
    // Eintrag). Passt keiner, geht es weiter mit Nachname + Geburtsdatum.
    if (treffer.length > 0 && nachname) {
      treffer = fahrgaesteAehnlicheNamen(
        await db.passenger.findMany({ where: { phones: { has: anruferNummer }, ...nachnameKandidatenWhere(nachname) } }),
        nachname,
      ).slice(0, 3);
    }
  }

  if (treffer.length === 0) {
    if (!nachname || !geburtsdatum) {
      return "Zur Sicherheit brauche ich Nachname und Geburtsdatum der Person, um sie zu finden.";
    }
    // Maßnahme M-06 (S2-006): Kandidaten per Datenbankabfrage statt der ersten 300 Zeilen.
    const kandidaten = await db.passenger.findMany({ where: nachnameKandidatenWhere(nachname), take: NACHNAME_KANDIDATEN_MAX });
    let gefunden = fahrgaesteAehnlicheNamen(kandidaten, nachname).filter(
      (f) => f.birthDate && datumIso(f.birthDate) === geburtsdatum,
    );
    // Genannte Nummer als Zusatzmerkmal: bei mehreren Treffern die mit dieser Nummer bevorzugen.
    if (gefunden.length > 1 && genannteNummer) {
      const mitNummer = gefunden.filter((f) => f.phones.includes(genannteNummer));
      if (mitNummer.length > 0) gefunden = mitNummer;
    }
    treffer = gefunden.slice(0, 3);
  }

  if (treffer.length === 0) return "Keine passenden Fahrgäste gefunden.";
  await identitaetMerken(
    tenantId,
    callId,
    treffer.map((f) => f.id),
  );
  // Kein Geburtsdatum in der Antwort: die KI soll es erfragen, nie vorlesen (M-13).
  const liste = treffer.map((f) => `${f.firstName} ${f.lastName} (passengerId ${f.id})`).join("; ");
  return treffer.length > 1 ? `${liste}. Mehrere Personen – bitte nach dem Vornamen fragen.` : liste;
}

const ortSuchenSchema = z.object({ text: z.string().min(1) });

function einsatzgebietMitte(wert: unknown): { lat: number; lng: number } | undefined {
  const mitte = wert as { lat?: unknown; lng?: unknown } | null;
  return mitte && typeof mitte.lat === "number" && typeof mitte.lng === "number" ? { lat: mitte.lat, lng: mitte.lng } : undefined;
}

async function ortSuchen(tenantId: string, args: unknown): Promise<string> {
  const { text } = ortSuchenSchema.parse(args);
  const db = withTenant(tenantId);

  // Maßnahme M-06 (S1-003, S2-006): Kandidaten aus der Datenbank, Abgleich nur dann "sicher", wenn
  // Straße, Hausnummer und PLZ/Ort stimmen (oder der Ortsname exakt). Teiltreffer werden vorgelesen.
  const kandidaten = await db.place.findMany({ where: ortKandidatenWhere(text), take: 50 });
  const abgleich = ortAbgleichen(kandidaten, text);
  if (abgleich.art === "sicher") {
    const t = abgleich.ort;
    return `Bekannter Ort: ${t.label}, ${t.street}, ${t.zip} ${t.city} (placeId ${t.id}, sicher).`;
  }
  if (abgleich.art === "unsicher") {
    return (
      "Möglicherweise gemeint (unsicher – bitte vorlesen und bestätigen lassen): " +
      abgleich.orte.map((o) => `${o.label}, ${o.street}, ${o.zip} ${o.city} (placeId ${o.id})`).join("; ")
    );
  }

  // Maßnahme M-06 (S2-007): Geocoding mit Bezug zum Einsatzgebiet, sonst landet "Kirchstraße 5"
  // in der Nachbarstadt.
  const settings = await db.tenantSettings.findUnique({ where: { tenantId }, select: { serviceAreaCenter: true } });
  const ergebnisse = await routingProvider.geocode(text, einsatzgebietMitte(settings?.serviceAreaCenter));
  if (ergebnisse.length === 0) return "Problem: Keine Adresse gefunden. Bitte Adresse genauer nennen.";

  const beste = ergebnisse[0];
  const sicher = beste.confidence >= GEOCODE_SICHER_SCHWELLE;
  const adresse = parseDeutscheAdresse(beste.label);
  const neu = await db.place.create({
    data: {
      tenantId,
      type: "SONSTIGES",
      usageCount: 0,
      label: beste.label,
      street: adresse.street,
      zip: adresse.zip,
      city: adresse.city,
      lat: beste.position.lat,
      lng: beste.position.lng,
    },
  });
  return `Adresse: ${beste.label} (placeId ${neu.id}, ${sicher ? "sicher" : "unsicher – bitte vorlesen und bestätigen lassen"}).`;
}

const fahrtAnlegenSchema = fahrgastFelderSchema.extend({
  pickupPlaceId: z.string(),
  dropoffPlaceId: z.string(),
  datum: DATUM,
  abholzeit: UHRZEIT,
  terminzeit: UHRZEIT_OPTIONAL,
  rueckfahrt: z.boolean().optional(),
  rueckfahrtzeit: UHRZEIT_OPTIONAL,
  transportType: z.enum(TRANSPORT_TYPES),
  companion: z.boolean().optional(),
  assistanceNotes: z.string().optional(),
  prescription: z.enum(DOC_STATUS),
  approval: z.enum(DOC_STATUS),
});

function datumMitWochentag(datum: Date): string {
  const [jahr, monat, tag] = datumIso(datum).split("-");
  return `${WOCHENTAG_LABEL[wochentagBerlin(datum)]}, ${tag}.${monat}.${jahr}`;
}

/**
 * Maßnahme M-46 Punkt 2 (S1-007): Am Telefon wird eine Fahrt in der Vergangenheit oder mit Termin
 * vor der Abholung gar nicht erst angelegt – der Anrufer ist noch am Apparat, das ist die beste
 * Gelegenheit zur Klärung. (Im Büro wird dieselbe Prüfung nur als Problem vermerkt, pruefungen.ts.)
 */
function zeitAbgelehnt(probleme: Problem[], jetzt: Date): string | null {
  const teile: string[] = [];
  if (probleme.includes("ABHOLZEIT_VERGANGEN")) {
    teile.push(`Die Abholzeit liegt in der Vergangenheit (jetzt ist ${datumMitWochentag(jetzt)}, ${datumIso(jetzt)}, ${uhrzeitBerlin(jetzt)} Uhr)`);
  }
  if (probleme.includes("TERMIN_VOR_ABHOLUNG")) {
    teile.push("Der Termin liegt nicht nach der Abholzeit");
  }
  if (teile.length === 0) return null;
  return `Problem: ${teile.join(". ")}. Nichts gespeichert. Bitte Datum und Uhrzeit mit dem Anrufer klären und dann erneut aufrufen.`;
}

async function fahrtAnlegenWerkzeug(tenantId: string, callId: string, args: unknown): Promise<string> {
  const daten = fahrtAnlegenSchema.parse(args);
  const tag = berlinerMitternacht(daten.datum);
  const jetzt = new Date();
  const abgelehnt = zeitAbgelehnt(
    zeitProbleme({
      pickupAt: mitUhrzeit(tag, daten.abholzeit),
      appointmentAt: daten.terminzeit ? mitUhrzeit(tag, daten.terminzeit) : undefined,
      jetzt,
    }),
    jetzt,
  );
  if (abgelehnt) return abgelehnt;
  const fahrgast = await passagierSicherstellen(tenantId, callId, daten);
  if ("problem" in fahrgast) return fahrgast.problem;

  const { rideId, probleme, rueckfahrtZeitOffen } = await fahrtErfassen(
    tenantId,
    {
      passengerId: fahrgast.passengerId,
      pickupPlaceId: daten.pickupPlaceId,
      dropoffPlaceId: daten.dropoffPlaceId,
      datum: daten.datum,
      abholzeit: daten.abholzeit,
      terminzeit: daten.terminzeit ?? "",
      rueckfahrt: daten.rueckfahrt ?? false,
      rueckfahrtzeit: daten.rueckfahrtzeit ?? "",
      transportType: daten.transportType,
      companion: daten.companion ?? false,
      assistanceNotes: daten.assistanceNotes ?? "",
      prescription: daten.prescription,
      approval: daten.approval,
    },
    { source: "ANRUF", callId },
  );

  const rueckfahrtHinweis = rueckfahrtZeitOffen
    ? " Die Rückfahrt ist ohne Uhrzeit vermerkt – das Team stimmt die Abholzeit noch ab."
    : "";
  // Maßnahme M-46: Wochentag und Datum in der Antwort, damit die KI sie dem Anrufer zum Gegenlesen
  // nennen kann (bewusst keine Uhrzeit – die ist bis zur Disposition nicht verbindlich).
  const fuer = `Fahrt erfasst für ${datumMitWochentag(tag)}`;
  if (probleme.length > 0) {
    return `${fuer}, aber mit Hinweis: ${probleme.join(", ")}.${rueckfahrtHinweis} (rideId ${rideId})`;
  }
  return `${fuer}. Die genaue Abholzeit wird noch bestätigt.${rueckfahrtHinweis} (rideId ${rideId})`;
}

const serieAnlegenSchema = fahrgastFelderSchema.extend({
  pickupPlaceId: z.string(),
  dropoffPlaceId: z.string(),
  wochentage: z.array(z.enum(WOCHENTAGE)).min(1),
  abholzeit: UHRZEIT,
  terminzeit: UHRZEIT_OPTIONAL,
  rueckfahrt: z.boolean().optional(),
  rueckfahrtzeit: UHRZEIT_OPTIONAL,
  bis: DATUM,
  transportType: z.enum(TRANSPORT_TYPES),
  companion: z.boolean().optional(),
  assistanceNotes: z.string().optional(),
  prescription: z.enum(DOC_STATUS),
  approval: z.enum(DOC_STATUS),
});

async function serieAnlegenWerkzeug(
  tenantId: string,
  callId: string,
  args: unknown,
  hintergrund: Hintergrund,
): Promise<string> {
  const daten = serieAnlegenSchema.parse(args);
  const fahrgast = await passagierSicherstellen(tenantId, callId, daten);
  if ("problem" in fahrgast) return fahrgast.problem;

  const ergebnis = await serieAnlegen(
    tenantId,
    {
      passengerId: fahrgast.passengerId,
      pickupPlaceId: daten.pickupPlaceId,
      dropoffPlaceId: daten.dropoffPlaceId,
      wochentage: daten.wochentage,
      abholzeit: daten.abholzeit,
      terminzeit: daten.terminzeit ?? "",
      rueckfahrt: daten.rueckfahrt ?? false,
      rueckfahrtzeit: daten.rueckfahrtzeit ?? "",
      bis: daten.bis,
      transportType: daten.transportType,
      companion: daten.companion ?? false,
      assistanceNotes: daten.assistanceNotes ?? "",
      prescription: daten.prescription,
      approval: daten.approval,
    },
    // Maßnahme M-14 Punkt 4 (V-005, S3-016): nur die Serie anlegen und sofort antworten. Die
    // Termine samt Vorschlagsrechnung (viele Routing-Aufrufe) entstehen danach im Hintergrund.
    { source: "ANRUF", termineSofort: false },
  );
  hintergrund(() => serieTermineErzeugen(tenantId, ergebnis.seriesId, { source: "ANRUF" }));

  const teile = [`Serie angelegt bis ${daten.bis}. Die einzelnen Termine werden jetzt eingetragen.`];
  if (ergebnis.feiertagsHinweise.length > 0) {
    teile.push(`Hinweis: Fällt auf Feiertage (${ergebnis.feiertagsHinweise.map((f) => f.name).join(", ")}).`);
  }
  if (ergebnis.genehmigungsWarnung) {
    teile.push(ergebnis.genehmigungsWarnung);
  }
  return teile.join(" ");
}

const fahrtFindenSchema = z.object({ passengerId: z.string(), datum: DATUM.optional() });

async function fahrtFinden(tenantId: string, callId: string, args: unknown): Promise<string> {
  const { passengerId, datum } = fahrtFindenSchema.parse(args);
  const db = withTenant(tenantId);
  // Maßnahme M-13: Fahrten nur für einen in diesem Anruf bestätigten Fahrgast nennen.
  if (!(await bestaetigteFahrgaeste(tenantId, callId)).has(passengerId)) return NICHT_BESTAETIGT;
  const von = datum ? berlinerMitternacht(datum) : new Date();

  const fahrten = await db.ride.findMany({
    where: { passengerId, pickupAt: { gte: von }, status: { notIn: ["STORNIERT", "ERLEDIGT"] } },
    include: { pickupPlace: { select: { label: true } }, dropoffPlace: { select: { label: true } } },
    orderBy: { pickupAt: "asc" },
    take: 5,
  });

  if (fahrten.length === 0) return "Keine kommenden Fahrten gefunden.";
  return fahrten
    .map((f) => {
      const zeit = f.pickupAt.toLocaleString("de-DE", {
        timeZone: "Europe/Berlin",
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `${zeit} ${f.pickupPlace.label} → ${f.dropoffPlace.label}, Status ${f.status} (rideId ${f.id})`;
    })
    .join("; ");
}

const fahrtAendernSchema = z.object({
  rideId: z.string(),
  abholzeit: UHRZEIT.optional(),
  terminzeit: UHRZEIT.optional(),
  pickupPlaceId: z.string().optional(),
  dropoffPlaceId: z.string().optional(),
  transportType: z.enum(TRANSPORT_TYPES).optional(),
  companion: z.boolean().optional(),
  assistanceNotes: z.string().optional(),
});

async function fahrtAendernWerkzeug(tenantId: string, callId: string, args: unknown): Promise<string> {
  const { rideId, ...aenderung } = fahrtAendernSchema.parse(args);
  const abgelehnt = await fahrtDesAnrufersPruefen(tenantId, callId, rideId);
  if (abgelehnt) return abgelehnt;
  // Maßnahme M-46 (S1-007): eine neue Uhrzeit darf nicht in der Vergangenheit liegen und den Termin
  // nicht überholen – sonst nachfragen statt ändern. Nur bei Zeitänderungen: eine verspätete Fahrt
  // darf weiterhin z. B. "Begleitperson dabei" bekommen.
  if (aenderung.abholzeit || aenderung.terminzeit) {
    const fahrt = await withTenant(tenantId).ride.findUnique({ where: { id: rideId }, select: { pickupAt: true, appointmentAt: true } });
    if (fahrt) {
      const tag = berlinerMitternacht(datumIso(fahrt.pickupAt));
      const jetzt = new Date();
      const zeitFehler = zeitAbgelehnt(
        zeitProbleme({
          pickupAt: aenderung.abholzeit ? mitUhrzeit(tag, aenderung.abholzeit) : fahrt.pickupAt,
          appointmentAt: aenderung.terminzeit ? mitUhrzeit(tag, aenderung.terminzeit) : fahrt.appointmentAt,
          jetzt,
        }),
        jetzt,
      );
      if (zeitFehler) return zeitFehler;
    }
  }
  const ergebnis = await fahrtAendern(tenantId, rideId, aenderung);
  if (!ergebnis.ok) {
    return ergebnis.grund === "NICHT_GEFUNDEN"
      ? "Problem: Fahrt nicht gefunden."
      : "Problem: Diese Fahrt lässt sich nicht mehr ändern, sie ist schon unterwegs oder abgeschlossen.";
  }
  return ergebnis.neuVorgeschlagen ? "Fahrt geändert, wird neu disponiert." : "Fahrt geändert.";
}

const fahrtStornierenSchema = z.object({ rideId: z.string(), grund: z.string().optional() });

/** Status, in denen die KI am Telefon stornieren darf (Maßnahme M-19). */
const KI_STORNIERBAR = new Set<string>(["ERFASST", "VORGESCHLAGEN", "DISPONIERT"]);

async function fahrtStornierenWerkzeug(tenantId: string, callId: string, args: unknown): Promise<string> {
  const { rideId } = fahrtStornierenSchema.parse(args);
  const abgelehnt = await fahrtDesAnrufersPruefen(tenantId, callId, rideId);
  if (abgelehnt) return abgelehnt;
  // Maßnahme M-19: Die KI storniert nur Fahrten, die noch nicht begonnen haben. Alles andere –
  // auch eine Fahrt mit Problem – klärt ein Mensch.
  const fahrt = await withTenant(tenantId).ride.findUnique({ where: { id: rideId }, select: { status: true } });
  if (!fahrt || !KI_STORNIERBAR.has(fahrt.status)) {
    return "Diese Fahrt kann ich nicht stornieren, sie läuft bereits oder ist abgeschlossen. Bitte an einen Mitarbeiter weiterleiten (an_mensch_weiterleiten) oder rueckruf_anlegen.";
  }
  await fahrtStornierenKern(tenantId, rideId);
  return "Fahrt storniert.";
}

const serieBeendenSchema = z.object({
  passengerId: z.string(),
  seriesId: z.string().optional(),
  ab: DATUM.optional(),
});

/**
 * Maßnahme M-22 Punkt 3: Serie am Telefon beenden – nur für den im Anruf bestätigten Fahrgast
 * (M-13). Hat er mehrere laufende Serien und nennt das Modell keine seriesId, kommt die Liste
 * zurück (ohne Orte/Namen), damit der Anrufer wählt.
 */
async function serieBeendenWerkzeug(tenantId: string, callId: string, args: unknown): Promise<string> {
  const { passengerId, seriesId, ab } = serieBeendenSchema.parse(args);
  if (!(await bestaetigteFahrgaeste(tenantId, callId)).has(passengerId)) return NICHT_BESTAETIGT;
  const heute = datumIso(new Date());
  const laufend = await withTenant(tenantId).rideSeries.findMany({
    where: { passengerId, until: { gte: berlinerMitternacht(heute) } },
    select: { id: true, rrule: true, pickupTime: true, until: true },
  });
  const serie = seriesId ? laufend.find((s) => s.id === seriesId) : laufend.length === 1 ? laufend[0] : undefined;
  if (!serie) {
    if (laufend.length === 0) return "Für diesen Fahrgast läuft keine Serie.";
    return (
      "Mehrere laufende Serien – bitte nachfragen, welche beendet werden soll: " +
      laufend.map((s) => `${wochentageAusRrule(s.rrule).join(", ")} ${s.pickupTime} Uhr bis ${datumIso(s.until)} (seriesId ${s.id})`).join("; ")
    );
  }
  const abTag = ab && ab > heute ? ab : heute;
  const { storniert } = await serieBeenden(tenantId, serie.id, abTag);
  return `Serie beendet ab ${abTag}. ${storniert} geplante Fahrten wurden storniert.`;
}

const abholzeitAuskunftSchema = z.object({ rideId: z.string() });

async function abholzeitAuskunft(tenantId: string, callId: string, args: unknown): Promise<string> {
  const { rideId } = abholzeitAuskunftSchema.parse(args);
  const abgelehnt = await fahrtDesAnrufersPruefen(tenantId, callId, rideId);
  if (abgelehnt) return abgelehnt;
  const db = withTenant(tenantId);
  const fahrt = await db.ride.findUnique({
    where: { id: rideId },
    select: { status: true, pickupAt: true, vehicleId: true, pickupPlace: { select: { lat: true, lng: true } } },
  });
  if (!fahrt) return "Problem: Fahrt nicht gefunden.";

  if (fahrt.status === "ERFASST" || fahrt.status === "VORGESCHLAGEN") {
    return "Die Fahrt ist erfasst, aber noch nicht fest eingeplant. Wir bestätigen die genaue Abholzeit.";
  }
  if (fahrt.status === "DISPONIERT") {
    const uhrzeit = fahrt.pickupAt.toLocaleTimeString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" });
    return `Die Fahrt ist für ${uhrzeit} Uhr eingeplant.`;
  }
  if (fahrt.status === "UNTERWEGS" && fahrt.vehicleId) {
    const position = await db.vehicleLocation.findFirst({ where: { vehicleId: fahrt.vehicleId }, orderBy: { at: "desc" } });
    if (position) {
      const minuten = await routingProvider.travelTimeMinutes(
        { lat: position.lat, lng: position.lng },
        { lat: fahrt.pickupPlace.lat, lng: fahrt.pickupPlace.lng },
        new Date(),
      );
      return `Der Fahrer ist unterwegs, geschätzte Ankunft in etwa ${Math.round(minuten)} Minuten.`;
    }
    return "Der Fahrer ist unterwegs.";
  }
  if (fahrt.status === "AN_BORD") return "Der Fahrgast ist bereits im Fahrzeug.";
  if (fahrt.status === "ERLEDIGT") return "Diese Fahrt ist bereits abgeschlossen.";
  return `Status der Fahrt: ${fahrt.status}.`;
}

const rueckrufAnlegenSchema = z.object({ telefon: z.string(), anliegen: z.string() });

async function rueckrufAnlegen(tenantId: string, callId: string, args: unknown): Promise<string> {
  const { telefon, anliegen } = rueckrufAnlegenSchema.parse(args);
  const db = withTenant(tenantId);
  // Maßnahme M-13 Punkt 4: ergänzen statt überschreiben – eine schon vorhandene Notiz (z. B. ein
  // früherer Rückrufwunsch im selben Gespräch) bleibt erhalten.
  // Maßnahme M-10 (S3-012): Rückrufnummer und Anliegen verschlüsselt speichern.
  const bisher = await db.call.findUnique({ where: { id: callId }, select: { summary: true } });
  await db.call.update({
    where: { id: callId },
    data: { summary: encrypt(zusammenfassungErgaenzen(zusammenfassungLesbar(bisher?.summary), `${RUECKRUF_PRAEFIX} ${telefon} – ${anliegen}`)) },
  });
  return "Rückruf-Wunsch gespeichert, das Team meldet sich.";
}

/**
 * Führt einen Werkzeugaufruf aus und fängt dabei jeden Fehler ab – Vapi erwartet immer HTTP 200
 * mit einem Ergebnis je Aufruf, Fehler stehen im `error`-Feld (docs/04a-vapi-notizen.md Punkt 3).
 * "an_mensch_weiterleiten" läuft normalerweise über Vapis eigenes transferCall-Werkzeug
 * (buildAssistantConfig in providers/voice/vapi.ts) und kommt hier gar nicht erst an; der Fall
 * bleibt als Rückfalllösung bestehen, falls Vapi es doch über die Werkzeuge schickt.
 */
/** Führt eine Aufgabe nach der Antwort an den Telefonanbieter aus (im Webhook: next/server after()). */
export type Hintergrund = (aufgabe: () => Promise<unknown>) => void;

export type WerkzeugOptionen = {
  /**
   * Maßnahme M-14 Punkt 4: Wie lange Arbeit (Serientermine) nach der Antwort laufen soll. Ohne
   * Angabe (Skripte, Tests) läuft sie sofort mit und wird abgewartet.
   */
  hintergrund?: Hintergrund;
};

export async function werkzeugAusfuehren(
  tenantId: string,
  callId: string,
  toolCall: ToolCall,
  optionen: WerkzeugOptionen = {},
): Promise<ToolResult> {
  // Prüfbericht S2-014: Jeder Werkzeugaufruf wirkt genau einmal. Vapi wiederholt Webhooks bei
  // Timeout; ohne Merker legte ein erneut gesendetes fahrt_anlegen/serie_anlegen die Fahrt bzw.
  // die ganze Serie doppelt an. Der Merker (VoiceToolCall, eindeutig je Anruf + toolCallId) wird
  // VOR der Ausführung angelegt – die Eindeutigkeit entscheidet die Datenbank, auch bei zwei
  // gleichzeitig eintreffenden Wiederholungen.
  const db = withTenant(tenantId);
  let merker: { id: string };
  try {
    merker = await db.voiceToolCall.create({
      data: { tenantId, callId, toolCallId: toolCall.id, name: toolCall.name },
      select: { id: true },
    });
  } catch (fehler) {
    if (!istEindeutigkeitsFehler(fehler)) {
      return { id: toolCall.id, error: fehler instanceof Error ? fehler.message : "Unbekannter Fehler." };
    }
    // Wiederholung: bis zu einigen Sekunden auf das Ergebnis des ersten Durchlaufs warten.
    for (let versuch = 0; versuch < 20; versuch += 1) {
      const vorhanden = await db.voiceToolCall.findFirst({ where: { callId, toolCallId: toolCall.id } });
      if (vorhanden?.finishedAt) {
        return vorhanden.error ? { id: toolCall.id, error: vorhanden.error } : { id: toolCall.id, result: vorhanden.result ?? "" };
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { id: toolCall.id, result: "Diese Anfrage wird gerade schon verarbeitet. Bitte nicht erneut anlegen." };
  }

  // Ohne Hintergrund-Ausführer: Aufgaben sammeln und vor der Rückgabe abwarten (gleiches Ergebnis
  // wie vorher, nur nicht vom Webhook-Zeitlimit getrennt).
  const sofort: (() => Promise<unknown>)[] = [];
  const hintergrund: Hintergrund = optionen.hintergrund ?? ((aufgabe) => sofort.push(aufgabe));
  let ergebnis = await werkzeugEinmalAusfuehren(tenantId, callId, toolCall, hintergrund);
  try {
    for (const aufgabe of sofort) await aufgabe();
  } catch (fehler) {
    ergebnis = { id: toolCall.id, error: fehler instanceof Error ? fehler.message : "Unbekannter Fehler." };
  }
  await db.voiceToolCall.update({
    where: { id: merker.id },
    data: { result: ergebnis.result ?? null, error: ergebnis.error ?? null, finishedAt: new Date() },
  });
  return ergebnis;
}

async function werkzeugEinmalAusfuehren(
  tenantId: string,
  callId: string,
  toolCall: ToolCall,
  hintergrund: Hintergrund,
): Promise<ToolResult> {
  try {
    let result: string;
    switch (toolCall.name) {
      case "fahrgast_suchen":
        result = await fahrgastSuchen(tenantId, callId, toolCall.arguments);
        break;
      case "ort_suchen":
        result = await ortSuchen(tenantId, toolCall.arguments);
        break;
      case "fahrt_anlegen":
        result = await fahrtAnlegenWerkzeug(tenantId, callId, toolCall.arguments);
        break;
      case "serie_anlegen":
        result = await serieAnlegenWerkzeug(tenantId, callId, toolCall.arguments, hintergrund);
        break;
      case "fahrt_finden":
        result = await fahrtFinden(tenantId, callId, toolCall.arguments);
        break;
      case "fahrt_aendern":
        result = await fahrtAendernWerkzeug(tenantId, callId, toolCall.arguments);
        break;
      case "fahrt_stornieren":
        result = await fahrtStornierenWerkzeug(tenantId, callId, toolCall.arguments);
        break;
      case "serie_beenden":
        result = await serieBeendenWerkzeug(tenantId, callId, toolCall.arguments);
        break;
      case "abholzeit_auskunft":
        result = await abholzeitAuskunft(tenantId, callId, toolCall.arguments);
        break;
      case "rueckruf_anlegen":
        result = await rueckrufAnlegen(tenantId, callId, toolCall.arguments);
        break;
      case "an_mensch_weiterleiten":
      case "transferCall":
        result = "Wird weitergeleitet.";
        break;
      default:
        return { id: toolCall.id, error: `Unbekanntes Werkzeug: ${toolCall.name}` };
    }
    return { id: toolCall.id, result };
  } catch (fehler) {
    return { id: toolCall.id, error: fehlerFuerKi(fehler) };
  }
}

/**
 * Maßnahme M-46 (S1-007, S2-020): Prüffehler als verständlicher Satz statt rohem Zod-JSON oder
 * "Invalid time value" – die KI soll erkennen, welche Angabe sie beim Anrufer nachfragen muss.
 * Die Meldungen enthalten nur Feldnamen und Formatvorgaben, keine Eingabewerte.
 */
function fehlerFuerKi(fehler: unknown): string {
  if (fehler instanceof z.ZodError) {
    const felder = fehler.issues.map((i) => `${i.path.join(".") || "Eingabe"}: ${i.message}`).join("; ");
    return `Ungültige Angaben – ${felder}. Bitte beim Anrufer nachfragen und erneut aufrufen.`;
  }
  if (fehler instanceof UngueltigeZeitangabe) return `${fehler.message} Bitte beim Anrufer nachfragen und erneut aufrufen.`;
  return fehler instanceof Error ? fehler.message : "Unbekannter Fehler.";
}
