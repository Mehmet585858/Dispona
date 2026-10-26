import { z } from "zod";

export const fahrgastSchema = z.object({
  firstName: z.string().trim().min(1, "Vorname fehlt"),
  lastName: z.string().trim().min(1, "Nachname fehlt"),
  birthDate: z.string().optional(),
  phones: z.string().optional(),
  insurer: z.string().optional(),
  notes: z.string().optional(),
});

export type FahrgastEingabe = z.infer<typeof fahrgastSchema>;

export const FAHRGAST_IMPORT_FELDER = [
  { schlüssel: "firstName", label: "Vorname", pflicht: true },
  { schlüssel: "lastName", label: "Nachname", pflicht: true },
  { schlüssel: "birthDate", label: "Geburtsdatum (JJJJ-MM-TT)", pflicht: false },
  { schlüssel: "phones", label: "Telefonnummer(n), durch Komma getrennt", pflicht: false },
  { schlüssel: "insurer", label: "Krankenkasse", pflicht: false },
];

export const genehmigungSchema = z.object({
  validFrom: z.string().min(1, "Gültig ab fehlt"),
  validUntil: z.string().min(1, "Gültig bis fehlt"),
  maxRides: z.string().optional(),
  reference: z.string().optional(),
});

export type GenehmigungEingabe = z.infer<typeof genehmigungSchema>;

export function telefonListeAusText(text: string | undefined): string[] {
  return (text ?? "")
    .split(",")
    .map((eintrag) => eintrag.trim())
    .filter(Boolean);
}
