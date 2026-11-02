/**
 * Schichtplan – Datenbank-Seite: laden, prüfen (Regeln in schichtplan.ts), schreiben und die Fahrten
 * freigeben, die durch eine Änderung ihre Schicht verlieren.
 *
 * Ablauf beim Speichern (Seitenfenster, "Gilt für", Woche kopieren):
 * 1. In EINER Transaktion mit Sperren (je Mandant für den Schichtplan, je Fahrzeug wie
 *    fahrzeugZuweisen): Bestand laden, Änderungen planen, betroffene Fahrten ermitteln.
 * 2. Liegen Fahrten in wegfallender Zeit, die noch nicht bestätigt sind, wird NICHTS geschrieben –
 *    die Oberfläche zeigt einen Hinweis mit den Uhrzeiten und fragt im Seitenfenster nach.
 * 3. Sonst Schichten löschen und neu anlegen; danach die betroffenen Fahrten wie bei "Ich falle aus"
 *    freigeben (zurück auf ERFASST, Hinweis "Schicht geändert – neues Fahrzeug nötig").
 * Logs enthalten nur IDs und Fehlerarten, keine Fahrgastdaten.
 */
import { FremdeReferenzError, referenzenPruefen, withTenant, type TenantTx } from "@/lib/db";
import { disponierteFahrtFreigeben } from "@/core/rides/fahrerAusfall";
import { fehlerArt } from "@/core/betrieb/cronLauf";
import { fahrtAnforderung } from "./besatzung";
import {
  betroffeneFahrten,
  ersetzungPlanen,
  schichtTag,
  tagLabel,
  type Aenderung,
  type Meldung,
  type PlanFahrt,
  type PlanKontext,
  type PlanSchicht,
} from "./schichtplan";
import { berlinerMitternacht, datumIso, tagVerschieben, uhrzeitBerlin } from "./week";
import { SCHICHTPLAN_TEXTE } from "./texte";

/** Eine Fahrt im Hinweis "N Fahrten liegen in dieser Schicht" – nur Zeit und Fahrzeug, kein Name. */
export type BetroffeneFahrtAnzeige = { id: string; tagIso: string; tag: string; uhrzeit: string; plate: string };

export type SchichtplanErgebnis =
  | {
      ok: true;
      angelegt: number;
      geloescht: number;
      uebersprungen: Meldung[];
      behalten: Meldung[];
      /** Fahrten, die freigegeben wurden (zurück auf ERFASST). */
      freigegeben: number;
      /** Fahrten, die sich zwischenzeitlich geändert hatten und deshalb nicht angefasst wurden. */
      nichtFreigegeben: number;
    }
  | { ok: false; fehler: string }
  | { ok: false; hinweis: BetroffeneFahrtAnzeige[] };

const SCHICHTPLAN_SPERRE = "schichtplan";

async function kontextLaden(tx: TenantTx, tenantId: string): Promise<PlanKontext> {
  // Nacheinander statt Promise.all: alle Abfragen laufen über dieselbe Transaktionsverbindung.
  const personen = await tx.driver.findMany({
    select: { id: true, active: true, scalamobilEinweisung: true, user: { select: { name: true } } },
  });
  const fahrzeuge = await tx.vehicle.findMany({
    select: { id: true, plate: true, wheelchairSpots: true, carryChair: true, stretcher: true },
  });
  const settings = await tx.tenantSettings.findUnique({ where: { tenantId }, select: { scalamobilAnzahl: true } });
  return {
    personen: new Map(personen.map((p) => [p.id, { id: p.id, name: p.user.name, active: p.active, scalamobilEinweisung: p.scalamobilEinweisung }])),
    fahrzeuge: new Map(fahrzeuge.map((f) => [f.id, f])),
    scalamobilAnzahl: settings?.scalamobilAnzahl ?? 0,
  };
}

const SCHICHT_FELDER = {
  id: true,
  vehicleId: true,
  driverId: true,
  beifahrerId: true,
  scalamobil: true,
  start: true,
  end: true,
  startedAt: true,
  unavailable: true,
} as const;

/** Schichten, die den Zeitraum [vonIso, bisIso] (Berliner Tage, einschließlich) berühren – mit einem Tag Rand für Nachtschichten. */
async function bestandLaden(tx: TenantTx, vonIso: string, bisIso: string): Promise<PlanSchicht[]> {
  const untere = berlinerMitternacht(tagVerschieben(vonIso, -1));
  const obere = berlinerMitternacht(tagVerschieben(bisIso, 2));
  return tx.shift.findMany({ where: { start: { lt: obere }, end: { gt: untere } }, select: SCHICHT_FELDER });
}

async function fahrtenFuerSchichtenLaden(tx: TenantTx, schichten: PlanSchicht[]): Promise<PlanFahrt[]> {
  if (schichten.length === 0) return [];
  const von = new Date(Math.min(...schichten.map((s) => s.start.getTime())));
  const bis = new Date(Math.max(...schichten.map((s) => s.end.getTime())));
  const fahrten = await tx.ride.findMany({
    where: { vehicleId: { in: [...new Set(schichten.map((s) => s.vehicleId))] }, status: "DISPONIERT", pickupAt: { gte: von, lte: bis } },
    select: {
      id: true,
      vehicleId: true,
      driverId: true,
      status: true,
      pickupAt: true,
      transportType: true,
      pickupPlace: { select: { treppe: true } },
      dropoffPlace: { select: { treppe: true } },
    },
  });
  return fahrten.map((f) => ({ ...f, anforderung: fahrtAnforderung(f) }));
}

function anzeige(fahrten: PlanFahrt[], kontext: PlanKontext): BetroffeneFahrtAnzeige[] {
  return fahrten.map((f) => {
    const tagIso = datumIso(f.pickupAt);
    return {
      id: f.id,
      tagIso,
      tag: tagLabel(tagIso),
      uhrzeit: uhrzeitBerlin(f.pickupAt),
      plate: (f.vehicleId && kontext.fahrzeuge.get(f.vehicleId)?.plate) || "",
    };
  });
}

async function sperren(tx: TenantTx, tenantId: string, vehicleIds: string[]) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${SCHICHTPLAN_SPERRE}))`;
  // Dieselbe Sperre wie fahrzeugZuweisen (je Fahrzeug): eine gleichzeitige Zuweisung in eine gerade
  // wegfallende Schicht wartet, bis der Schichtplan geschrieben ist, und sieht ihn dann.
  for (const vehicleId of [...new Set(vehicleIds)].sort()) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenantId}), hashtext(${vehicleId}))`;
  }
}

/**
 * Schichten ersetzen (Seitenfenster mit "Gilt für", Löschen, Woche kopieren). `bestaetigteFahrten`:
 * die Fahrt-IDs aus dem Hinweis, die der Disponent im Seitenfenster bestätigt hat. Kommt bei einem
 * zweiten Versuch eine weitere betroffene Fahrt hinzu, wird erneut nachgefragt.
 */
export async function schichtenErsetzen(
  tenantId: string,
  aenderungen: Aenderung[],
  optionen: { modus: "STRENG" | "UEBERSPRINGEN"; bestaetigteFahrten?: string[]; userId?: string },
): Promise<SchichtplanErgebnis> {
  if (aenderungen.length === 0) {
    return { ok: true, angelegt: 0, geloescht: 0, uebersprungen: [], behalten: [], freigegeben: 0, nichtFreigegeben: 0 };
  }
  const vehicleIds = [...new Set(aenderungen.map((a) => a.vehicleId))];
  const personIds = aenderungen.flatMap((a) => a.entwuerfe.flatMap((e) => [e.fahrerId, e.beifahrerId]));
  try {
    // Wie referenzenPruefen überall sonst: fremde oder unbekannte IDs werden abgewiesen, bevor
    // irgendetwas geplant wird. Der Mandanten-Trigger (M-11) sichert zusätzlich in der Datenbank.
    await referenzenPruefen(tenantId, { vehicle: vehicleIds, driver: personIds });
  } catch (fehler) {
    if (fehler instanceof FremdeReferenzError) return { ok: false, fehler: fehler.message };
    throw fehler;
  }

  const tage = aenderungen.map((a) => a.tagIso).sort();
  const bestaetigt = new Set(optionen.bestaetigteFahrten ?? []);
  const db = withTenant(tenantId);

  const ergebnis = await db.$transaction(
    async (tx) => {
      await sperren(tx, tenantId, vehicleIds);
      const kontext = await kontextLaden(tx, tenantId);
      const bestand = await bestandLaden(tx, tage[0], tage[tage.length - 1]);
      const plan = ersetzungPlanen({ aenderungen, bestand, heuteIso: datumIso(new Date()), kontext, modus: optionen.modus });
      if (!plan.ok) return { art: "fehler" as const, fehler: plan.fehler };

      const fahrten = await fahrtenFuerSchichtenLaden(tx, plan.loeschen);
      const betroffen = betroffeneFahrten({ fahrten, entfernt: plan.loeschen, stand: plan.stand, kontext });
      if (betroffen.some((f) => !bestaetigt.has(f.id))) {
        return { art: "hinweis" as const, hinweis: anzeige(betroffen, kontext) };
      }

      const loeschIds = plan.loeschen.map((s) => s.id).filter((id): id is string => !!id);
      if (loeschIds.length > 0) await tx.shift.deleteMany({ where: { id: { in: loeschIds } } });
      if (plan.anlegen.length > 0) {
        await tx.shift.createMany({
          data: plan.anlegen.map((s) => ({
            tenantId,
            vehicleId: s.vehicleId,
            driverId: s.driverId,
            beifahrerId: s.beifahrerId,
            scalamobil: s.scalamobil,
            start: s.start,
            end: s.end,
          })),
        });
      }
      if (loeschIds.length > 0 || plan.anlegen.length > 0) {
        await tx.auditLog.create({
          data: { tenantId, userId: optionen.userId, action: "schichtplan.geaendert", entity: "Vehicle", entityId: vehicleIds.join(",").slice(0, 190) },
        });
      }
      return { art: "ok" as const, plan, betroffen };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );

  if (ergebnis.art === "fehler") return { ok: false, fehler: ergebnis.fehler };
  if (ergebnis.art === "hinweis") return { ok: false, hinweis: ergebnis.hinweis };

  const { freigegeben, nichtFreigegeben } = await fahrtenFreigeben(
    tenantId,
    ergebnis.betroffen.map((f) => f.id),
    SCHICHTPLAN_TEXTE.hinweisSchichtGeaendert,
    optionen.userId,
  );
  return {
    ok: true,
    angelegt: ergebnis.plan.anlegen.length,
    geloescht: ergebnis.plan.loeschen.length,
    uebersprungen: ergebnis.plan.uebersprungen,
    behalten: ergebnis.plan.behalten,
    freigegeben,
    nichtFreigegeben,
  };
}

/** Fahrten freigeben – jede für sich, eine scheiternde hält die übrigen nicht auf. */
async function fahrtenFreigeben(tenantId: string, rideIds: string[], hinweis: string, userId?: string) {
  let freigegeben = 0;
  let nichtFreigegeben = 0;
  for (const rideId of rideIds) {
    try {
      if (await disponierteFahrtFreigeben(tenantId, rideId, hinweis, { userId, fahrerBenachrichtigen: true })) freigegeben += 1;
      else nichtFreigegeben += 1;
    } catch (fehler) {
      nichtFreigegeben += 1;
      console.error("Schichtplan: Fahrt konnte nicht freigegeben werden", { tenantId, rideId, fehler: fehlerArt(fehler) });
    }
  }
  return { freigegeben, nichtFreigegeben };
}

/**
 * Ein deaktivierter Mitarbeiter (M-12) fällt auch als Beifahrer weg: aus allen noch nicht beendeten
 * Schichten austragen. Fahrten, die dadurch nicht mehr zur Besatzung passen (z. B. Liegend), werden
 * wie bei "Ich falle aus" freigegeben.
 */
export async function beifahrerAusSchichtenNehmen(tenantId: string, driverId: string, ab: Date, userId?: string) {
  const db = withTenant(tenantId);
  const ergebnis = await db.$transaction(
    async (tx) => {
      const schichten = await tx.shift.findMany({ where: { beifahrerId: driverId, end: { gt: ab } }, select: SCHICHT_FELDER });
      if (schichten.length === 0) return { schichten: 0, betroffen: [] as PlanFahrt[] };
      await sperren(tx, tenantId, schichten.map((s) => s.vehicleId));
      const kontext = await kontextLaden(tx, tenantId);
      const ohneBeifahrer = schichten.map((s) => ({ ...s, beifahrerId: null }));
      const fahrten = await fahrtenFuerSchichtenLaden(tx, schichten);
      const betroffen = betroffeneFahrten({ fahrten, entfernt: schichten, stand: ohneBeifahrer, kontext });
      await tx.shift.updateMany({ where: { id: { in: schichten.map((s) => s.id!) } }, data: { beifahrerId: null } });
      return { schichten: schichten.length, betroffen };
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
  const freigabe = await fahrtenFreigeben(
    tenantId,
    ergebnis.betroffen.map((f) => f.id),
    SCHICHTPLAN_TEXTE.hinweisBeifahrerDeaktiviert,
    userId,
  );
  return { schichten: ergebnis.schichten, ...freigabe };
}

export type SchichtplanDaten = Awaited<ReturnType<typeof schichtplanDatenLaden>>;

/**
 * Alles für die Seite /dispo/schichtplan: aktive Fahrzeuge (Zeilen), Personal (auch deaktivierte,
 * damit alte Schichten Namen zeigen), Schichten im Zeitraum (Berliner Tage, einschließlich) und die
 * Anzahl der Scalamobile.
 */
export async function schichtplanDatenLaden(tenantId: string, vonIso: string, bisIso: string) {
  const db = withTenant(tenantId);
  const untere = berlinerMitternacht(vonIso);
  const obere = berlinerMitternacht(tagVerschieben(bisIso, 1));
  const [fahrzeuge, personal, schichten, settings] = await Promise.all([
    db.vehicle.findMany({
      where: { active: true },
      orderBy: { plate: "asc" },
      select: { id: true, plate: true, seats: true, wheelchairSpots: true, carryChair: true, stretcher: true },
    }),
    db.driver.findMany({
      orderBy: { user: { name: "asc" } },
      select: { id: true, active: true, istAushilfe: true, scalamobilEinweisung: true, user: { select: { name: true } } },
    }),
    db.shift.findMany({
      where: { start: { gte: untere, lt: obere } },
      orderBy: { start: "asc" },
      select: { ...SCHICHT_FELDER, onBreak: true, endedAt: true },
    }),
    db.tenantSettings.findUnique({ where: { tenantId }, select: { scalamobilAnzahl: true } }),
  ]);
  return {
    fahrzeuge,
    personal: personal.map((p) => ({
      id: p.id,
      name: p.user.name,
      active: p.active,
      istAushilfe: p.istAushilfe,
      scalamobilEinweisung: p.scalamobilEinweisung,
    })),
    schichten: schichten.map((s) => ({ ...s, tagIso: schichtTag(s) })),
    scalamobilAnzahl: settings?.scalamobilAnzahl ?? 0,
  };
}
