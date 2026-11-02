import { fahrerLaden } from "@/app/dispo/fahrer/actions";
import { FahrerClient } from "@/app/dispo/fahrer/FahrerClient";

/**
 * Einrichtung Schritt 4: Personal einladen. Schichten werden seit dem Schichtplan (02.11.2026) nicht
 * mehr hier, sondern unter /dispo/schichtplan geplant (Bauprotokoll 2026-11-02, offene Frage).
 */
export async function Schritt4Fahrer() {
  const fahrer = await fahrerLaden();
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">
        Fahrer und Aushilfen einladen (SMS mit Anmelde-Link). Die Schichten werden nach der Einrichtung im Schichtplan geplant.
      </p>
      <FahrerClient fahrer={fahrer} />
    </div>
  );
}
