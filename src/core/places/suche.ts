/**
 * Abgleich einer gesprochenen oder getippten Adresse mit den gespeicherten Orten eines Mandanten
 * (Maßnahme M-06, Prüfbericht S1-003). Vorher galt ein Ort schon als "sicher", wenn der Text
 * irgendwo in Straße oder Ort enthalten war – "Hauptstraße 1" traf "Hauptstraße 12", die KI las
 * die Adresse nicht einmal vor. Jetzt gilt:
 *  - sicher: Name des Orts stimmt (normalisiert) exakt überein, ODER Straße + Hausnummer stimmen
 *    überein UND der Text nennt PLZ oder Ort, die ebenfalls passen;
 *  - unsicher: Straße + Hausnummer passen, aber PLZ/Ort fehlen oder weichen ab; oder der Name
 *    ist nur ähnlich – die KI liest den Vorschlag vor und lässt bestätigen;
 *  - keiner: alles andere (auch ein bloßer Ortsname wie "Aachen").
 * Reine Funktionen; die Kandidaten lädt der Aufrufer per Datenbankabfrage (ortKandidatenWhere).
 */
import { istAehnlicherName } from "@/core/passengers/suche";

export type OrtFuerAbgleich = { id: string; label: string; street: string; zip: string; city: string };

export type AdressTeile = { strasse: string; hausnummer: string; plz: string; ort: string; frei: string };

export type OrtAbgleich<T extends OrtFuerAbgleich> =
  | { art: "sicher"; ort: T }
  | { art: "unsicher"; orte: T[] }
  | { art: "keiner" };

function normalisieren(text: string): string {
  return text
    .toLowerCase()
    .replace(/straße|strasse|str\./g, "str")
    .replace(/[^a-z0-9äöüß]/g, "");
}

const HAUSNUMMER = /^(.+?)\s+(\d+\s?[a-zA-Z]?)\s*$/;
const PLZ_ORT = /^(\d{5})?\s*(.*)$/;

/** Zerlegt "Hauptstraße 12, 52499 Baesweiler" / "Hauptstraße 12" / "Dialysezentrum Aachen". */
export function adresseZerlegen(text: string): AdressTeile {
  const teile = text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  const erster = teile[0] ?? "";
  const hausnummerTreffer = HAUSNUMMER.exec(erster);
  let plz = "";
  let ort = "";
  if (teile[1]) {
    const plzOrt = PLZ_ORT.exec(teile[1]);
    plz = plzOrt?.[1] ?? "";
    ort = (plzOrt?.[2] ?? "").replace(/^(deutschland|germany)$/i, "").trim();
  }
  if (hausnummerTreffer) {
    return { strasse: hausnummerTreffer[1].trim(), hausnummer: hausnummerTreffer[2].replace(/\s/g, "").toLowerCase(), plz, ort, frei: erster };
  }
  return { strasse: "", hausnummer: "", plz, ort, frei: erster };
}

function strasseUndNummer(ort: OrtFuerAbgleich): { strasse: string; hausnummer: string } {
  const treffer = HAUSNUMMER.exec(ort.street.trim());
  if (!treffer) return { strasse: normalisieren(ort.street), hausnummer: "" };
  return { strasse: normalisieren(treffer[1]), hausnummer: treffer[2].replace(/\s/g, "").toLowerCase() };
}

export function ortAbgleichen<T extends OrtFuerAbgleich>(kandidaten: T[], text: string): OrtAbgleich<T> {
  const eingabe = adresseZerlegen(text);
  const freiNorm = normalisieren(eingabe.frei);

  // 1. Exakter Name ("Dialysezentrum Aachen") → sicher.
  const exakterName = kandidaten.find((k) => normalisieren(k.label) === freiNorm && freiNorm.length > 0);
  if (exakterName) return { art: "sicher", ort: exakterName };

  const unsicher: T[] = [];
  if (eingabe.strasse && eingabe.hausnummer) {
    const strasseNorm = normalisieren(eingabe.strasse);
    for (const k of kandidaten) {
      const ks = strasseUndNummer(k);
      if (ks.strasse !== strasseNorm || ks.hausnummer !== eingabe.hausnummer) continue;
      const plzPasst = eingabe.plz !== "" && eingabe.plz === k.zip;
      const ortPasst = eingabe.ort !== "" && normalisieren(eingabe.ort) === normalisieren(k.city);
      if (plzPasst || ortPasst) return { art: "sicher", ort: k };
      // Straße + Hausnummer stimmen, aber PLZ/Ort fehlen oder weichen ab → nur Vorschlag.
      unsicher.push(k);
    }
  }

  // 2. Ähnlicher Name (Tippfehler) → unsicher.
  for (const k of kandidaten) {
    if (eingabe.frei.length >= 4 && istAehnlicherName(k.label, eingabe.frei) && !unsicher.includes(k)) unsicher.push(k);
  }

  if (unsicher.length > 0) return { art: "unsicher", orte: unsicher.slice(0, 3) };
  return { art: "keiner" };
}

/**
 * Prisma-where für die Kandidatensuche in der Datenbank (statt der ersten 300 Zeilen im Speicher,
 * Prüfbericht S2-006): Straßenname bzw. Ortsname müssen im Text vorkommen. Ein bloßer Ortsname
 * ("Aachen") sucht bewusst nicht nach city – das wäre nie eine Adresse.
 */
export function ortKandidatenWhere(text: string): { OR: { street?: { contains: string; mode: "insensitive" }; label?: { contains: string; mode: "insensitive" } }[] } {
  const teile = adresseZerlegen(text);
  const strassenKern = (teile.strasse || teile.frei).replace(/straße|strasse|str\.?$/i, "").trim();
  const suchwort = strassenKern.length >= 3 ? strassenKern : teile.frei;
  return {
    OR: [
      { street: { contains: suchwort, mode: "insensitive" } },
      { label: { contains: teile.frei.slice(0, Math.max(4, Math.floor(teile.frei.length / 2))), mode: "insensitive" } },
    ],
  };
}
