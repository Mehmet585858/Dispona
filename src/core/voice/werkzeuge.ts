/**
 * Die Werkzeuge, die die KI am Telefon aufrufen kann (docs/04-voice-agent.md). Jede Funktion
 * bekommt bereits geparste Argumente, prüft sie selbst (Zod) und gibt einen kurzen, gesprochen
 * verständlichen Text zurück. werkzeugAusfuehren() ist der einzige Einstiegspunkt von außen.
 */
import { z } from "zod";
import { withTenant } from "@/lib/db";
import {
  fahrgaesteAehnlicheNamen,
  istAehnlicherName,
  telefonNormalisieren,
} from "@/core/passengers/suche";
import { berlinerMitternacht, datumIso } from "@/core/shifts/week";
import { DOC_STATUS, TRANSPORT_TYPES } from "@/core/rides/validation";
import { fahrtErfassen } from "@/core/rides/erfassen";
import { fahrtAendern } from "@/core/rides/aendern";
import { fahrtStornieren as fahrtStornierenKern } from "@/core/rides/stornieren";
import { serieAnlegen } from "@/core/rides/serie";
import { parseDeutscheAdresse } from "@/core/places/adresse";
import { routingProvider, GEOCODE_SICHER_SCHWELLE } from "@/providers/routing";
import { WOCHENTAGE } from "@/core/shifts/rrule";
import type { ToolCall, ToolResult } from "@/providers/voice/types";

const fahrgastFelderSchema = z.object({
  passengerId: z.string().optional(),
  fahrgastVorname: z.string().optional(),
  fahrgastNachname: z.string().optional(),
  fahrgastGeburtsdatum: z.string().optional(),
  fahrgastTelefon: z.string().optional(),
  fahrgastKrankenkasse: z.string().optional(),
});

/** Nutzt die übergebene passengerId oder legt einen neuen Fahrgast an (fahrt_anlegen und serie_anlegen teilen sich das). */
async function passagierSicherstellen(
  tenantId: string,
  daten: z.infer<typeof fahrgastFelderSchema>,
): Promise<{ passengerId: string } | { problem: string }> {
  const db = withTenant(tenantId);
  if (daten.passengerId) {
    // Prüfbericht S2-008: eine vom Sprachmodell genannte passengerId (halluziniert oder aus einem
    // früheren Gespräch) muss zu diesem Mandanten gehören – sonst neu suchen lassen.
    const bekannt = await db.passenger.findUnique({ where: { id: daten.passengerId }, select: { id: true } });
    if (!bekannt) return { problem: "Problem: Diese passengerId ist unbekannt. Bitte fahrgast_suchen erneut aufrufen." };
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
  return { passengerId: neu.id };
}

const fahrgastSuchenSchema = z.object({
  telefon: z.string().optional(),
  nachname: z.string().optional(),
  geburtsdatum: z.string().optional(),
});

async function fahrgastSuchen(tenantId: string, callId: string, args: unknown): Promise<string> {
  const { telefon, nachname, geburtsdatum } = fahrgastSuchenSchema.parse(args);
  const db = withTenant(tenantId);

  let treffer: { id: string; firstName: string; lastName: string; birthDate: Date | null }[] = [];
  if (telefon) {
    treffer = await db.passenger.findMany({ where: { phones: { has: telefonNormalisieren(telefon) } }, take: 3 });
  }
  if (treffer.length === 0 && nachname) {
    const alle = await db.passenger.findMany({ take: 300 });
    const gefunden = fahrgaesteAehnlicheNamen(alle, nachname);

    // Ohne Treffer über die genannte Telefonnummer darf der Nachname allein keine fremden
    // Personendaten herausgeben (Vapi prüft die Anrufer-ID nicht) - zuerst auf die tatsächliche
    // Rufnummer dieses Anrufs einschränken; findet sich darüber niemand, zusätzlich das
    // Geburtsdatum als zweites Merkmal verlangen statt den Nachnamen allein genügen zu lassen.
    const anruf = await db.call.findUnique({ where: { id: callId }, select: { fromNumber: true } });
    const eigeneNummer = anruf?.fromNumber ? telefonNormalisieren(anruf.fromNumber) : null;
    const perAnruferNummer = eigeneNummer ? gefunden.filter((f) => f.phones.includes(eigeneNummer)) : [];

    if (perAnruferNummer.length > 0) {
      treffer = perAnruferNummer.slice(0, 3);
    } else if (geburtsdatum) {
      treffer = gefunden.filter((f) => f.birthDate && datumIso(f.birthDate) === geburtsdatum).slice(0, 3);
    } else {
      return "Zur Sicherheit brauche ich noch das Geburtsdatum, um die richtige Person zu finden.";
    }
  }

  if (treffer.length === 0) return "Keine passenden Fahrgäste gefunden.";
  return treffer
    .map((f) => `${f.firstName} ${f.lastName}${f.birthDate ? `, geboren ${datumIso(f.birthDate)}` : ""} (passengerId ${f.id})`)
    .join("; ");
}

const ortSuchenSchema = z.object({ text: z.string().min(1) });

async function ortSuchen(tenantId: string, args: unknown): Promise<string> {
  const { text } = ortSuchenSchema.parse(args);
  const db = withTenant(tenantId);

  const bekannt = await db.place.findMany({ take: 300 });
  const niedrig = text.toLowerCase();
  const treffer = bekannt.find(
    (p) => istAehnlicherName(p.label, text) || p.street.toLowerCase().includes(niedrig) || p.city.toLowerCase().includes(niedrig),
  );
  if (treffer) {
    return `Bekannter Ort: ${treffer.label}, ${treffer.street}, ${treffer.zip} ${treffer.city} (placeId ${treffer.id}, sicher).`;
  }

  const ergebnisse = await routingProvider.geocode(text);
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
  datum: z.string(),
  abholzeit: z.string(),
  terminzeit: z.string().optional(),
  rueckfahrt: z.boolean().optional(),
  rueckfahrtzeit: z.string().optional(),
  transportType: z.enum(TRANSPORT_TYPES),
  companion: z.boolean().optional(),
  assistanceNotes: z.string().optional(),
  prescription: z.enum(DOC_STATUS),
  approval: z.enum(DOC_STATUS),
});

async function fahrtAnlegenWerkzeug(tenantId: string, callId: string, args: unknown): Promise<string> {
  const daten = fahrtAnlegenSchema.parse(args);
  const fahrgast = await passagierSicherstellen(tenantId, daten);
  if ("problem" in fahrgast) return fahrgast.problem;

  const { rideId, probleme } = await fahrtErfassen(
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

  if (probleme.length > 0) {
    return `Fahrt erfasst, aber mit Hinweis: ${probleme.join(", ")}. (rideId ${rideId})`;
  }
  return `Fahrt erfasst. Die genaue Abholzeit wird noch bestätigt. (rideId ${rideId})`;
}

const serieAnlegenSchema = fahrgastFelderSchema.extend({
  pickupPlaceId: z.string(),
  dropoffPlaceId: z.string(),
  wochentage: z.array(z.enum(WOCHENTAGE)).min(1),
  abholzeit: z.string(),
  terminzeit: z.string().optional(),
  rueckfahrt: z.boolean().optional(),
  rueckfahrtzeit: z.string().optional(),
  bis: z.string(),
  transportType: z.enum(TRANSPORT_TYPES),
  companion: z.boolean().optional(),
  assistanceNotes: z.string().optional(),
  prescription: z.enum(DOC_STATUS),
  approval: z.enum(DOC_STATUS),
});

async function serieAnlegenWerkzeug(tenantId: string, args: unknown): Promise<string> {
  const daten = serieAnlegenSchema.parse(args);
  const fahrgast = await passagierSicherstellen(tenantId, daten);
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
    { source: "ANRUF" },
  );

  const teile = [`Serie angelegt, ${ergebnis.erzeugteFahrten.length} Fahrten bis ${daten.bis} erzeugt.`];
  if (ergebnis.feiertagsHinweise.length > 0) {
    teile.push(`Hinweis: Fällt auf Feiertage (${ergebnis.feiertagsHinweise.map((f) => f.name).join(", ")}).`);
  }
  if (ergebnis.genehmigungsWarnung) {
    teile.push(ergebnis.genehmigungsWarnung);
  }
  return teile.join(" ");
}

const fahrtFindenSchema = z.object({ passengerId: z.string(), datum: z.string().optional() });

async function fahrtFinden(tenantId: string, args: unknown): Promise<string> {
  const { passengerId, datum } = fahrtFindenSchema.parse(args);
  const db = withTenant(tenantId);
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
  abholzeit: z.string().optional(),
  terminzeit: z.string().optional(),
  pickupPlaceId: z.string().optional(),
  dropoffPlaceId: z.string().optional(),
  transportType: z.enum(TRANSPORT_TYPES).optional(),
  companion: z.boolean().optional(),
  assistanceNotes: z.string().optional(),
});

async function fahrtAendernWerkzeug(tenantId: string, args: unknown): Promise<string> {
  const { rideId, ...aenderung } = fahrtAendernSchema.parse(args);
  const ergebnis = await fahrtAendern(tenantId, rideId, aenderung);
  if (!ergebnis.ok) {
    return ergebnis.grund === "NICHT_GEFUNDEN"
      ? "Problem: Fahrt nicht gefunden."
      : "Problem: Diese Fahrt lässt sich nicht mehr ändern, sie ist schon unterwegs oder abgeschlossen.";
  }
  return ergebnis.neuVorgeschlagen ? "Fahrt geändert, wird neu disponiert." : "Fahrt geändert.";
}

const fahrtStornierenSchema = z.object({ rideId: z.string(), grund: z.string().optional() });

async function fahrtStornierenWerkzeug(tenantId: string, args: unknown): Promise<string> {
  const { rideId } = fahrtStornierenSchema.parse(args);
  await fahrtStornierenKern(tenantId, rideId);
  return "Fahrt storniert.";
}

const abholzeitAuskunftSchema = z.object({ rideId: z.string() });

async function abholzeitAuskunft(tenantId: string, args: unknown): Promise<string> {
  const { rideId } = abholzeitAuskunftSchema.parse(args);
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
  await db.call.update({ where: { id: callId }, data: { summary: `Rückruf erbeten: ${telefon} – ${anliegen}` } });
  return "Rückruf-Wunsch gespeichert, das Team meldet sich.";
}

/**
 * Führt einen Werkzeugaufruf aus und fängt dabei jeden Fehler ab – Vapi erwartet immer HTTP 200
 * mit einem Ergebnis je Aufruf, Fehler stehen im `error`-Feld (docs/04a-vapi-notizen.md Punkt 3).
 * "an_mensch_weiterleiten" läuft normalerweise über Vapis eigenes transferCall-Werkzeug
 * (buildAssistantConfig in providers/voice/vapi.ts) und kommt hier gar nicht erst an; der Fall
 * bleibt als Rückfalllösung bestehen, falls Vapi es doch über die Werkzeuge schickt.
 */
export async function werkzeugAusfuehren(tenantId: string, callId: string, toolCall: ToolCall): Promise<ToolResult> {
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
        result = await serieAnlegenWerkzeug(tenantId, toolCall.arguments);
        break;
      case "fahrt_finden":
        result = await fahrtFinden(tenantId, toolCall.arguments);
        break;
      case "fahrt_aendern":
        result = await fahrtAendernWerkzeug(tenantId, toolCall.arguments);
        break;
      case "fahrt_stornieren":
        result = await fahrtStornierenWerkzeug(tenantId, toolCall.arguments);
        break;
      case "abholzeit_auskunft":
        result = await abholzeitAuskunft(tenantId, toolCall.arguments);
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
    return { id: toolCall.id, error: fehler instanceof Error ? fehler.message : "Unbekannter Fehler." };
  }
}
