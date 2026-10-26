import { z } from "zod";

export const fahrzeugSchema = z.object({
  plate: z.string().trim().min(2, "Kennzeichen fehlt"),
  seats: z.coerce.number().int().min(0).max(20),
  wheelchairSpots: z.coerce.number().int().min(0).max(10),
  carryChair: z.boolean(),
  stretcher: z.boolean(),
  active: z.boolean(),
});

export type FahrzeugEingabe = z.infer<typeof fahrzeugSchema>;

export const FAHRZEUG_IMPORT_FELDER = [
  { schlüssel: "plate", label: "Kennzeichen", pflicht: true },
  { schlüssel: "seats", label: "Sitzplätze", pflicht: true },
  { schlüssel: "wheelchairSpots", label: "Rollstuhlplätze", pflicht: false },
  { schlüssel: "carryChair", label: "Tragestuhl (ja/nein)", pflicht: false },
  { schlüssel: "stretcher", label: "Liegend (ja/nein)", pflicht: false },
] as const;

export function textZuJaNein(wert: string | undefined): boolean {
  const normalisiert = (wert ?? "").trim().toLowerCase();
  return ["ja", "j", "yes", "y", "1", "true", "wahr"].includes(normalisiert);
}

/** Kurzbeschreibung der Ausstattung für Listen und Auswahlfelder, z. B. "Rollstuhl, Tragestuhl". */
export function fahrzeugArtLabel(fahrzeug: {
  wheelchairSpots: number;
  carryChair: boolean;
  stretcher: boolean;
}): string {
  const arten: string[] = [];
  if (fahrzeug.wheelchairSpots > 0) arten.push("Rollstuhl");
  if (fahrzeug.carryChair) arten.push("Tragestuhl");
  if (fahrzeug.stretcher) arten.push("Liegend");
  return arten.length > 0 ? arten.join(", ") : "Sitzend";
}
