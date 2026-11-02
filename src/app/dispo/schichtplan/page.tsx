import { connection } from "next/server";
import { datumIso, montagVonIso } from "@/core/shifts/week";
import { schichtplanLaden } from "./actions";
import { ladeBereich } from "./anzeige";
import { SchichtplanClient } from "./SchichtplanClient";

/**
 * Schichtplan (Bauplan vom 02.11.2026, Aufbau wie die freigegebene Vorschau): Monatskalender mit
 * Füllgrad, „Heute“, Wochenansicht mit Fahrzeugen als Zeilen und Seitenfenster zum Bearbeiten.
 */
export default async function SchichtplanPage() {
  await connection(); // "heute" ist pro Aufruf anders
  const jetzt = new Date();
  const heuteIso = datumIso(jetzt);
  const montagIso = montagVonIso(heuteIso);
  const monat = heuteIso.slice(0, 7);
  const bereich = ladeBereich(montagIso, monat);
  const daten = await schichtplanLaden(bereich.vonIso, bereich.bisIso);
  return (
    <SchichtplanClient
      anfangsDaten={daten}
      heuteIso={heuteIso}
      jetztIso={jetzt.toISOString()}
      anfangsMontag={montagIso}
      anfangsMonat={monat}
    />
  );
}
