import { z } from "zod";
import { telefonNormalisieren } from "@/core/passengers/suche";

/**
 * Maßnahme M-21 (S2-013/V-006) für Fahrer: Die Handynummer wird beim Schreiben normalisiert
 * (+49…, derselbe Schlüssel wie bei Fahrgästen) – vorher stand "0171 2345678" unverändert in
 * User.phone, der SMS-Versand und die Dublettenprüfung hingen an der Schreibweise.
 */
export const fahrerEinladenSchema = z.object({
  name: z.string().trim().min(2, "Name fehlt"),
  phone: z
    .string()
    .trim()
    .min(6, "Handynummer fehlt")
    .regex(/^\+?[0-9 ()/-]+$/, "Das sieht nicht nach einer Telefonnummer aus")
    .transform((roh) => telefonNormalisieren(roh))
    .refine((nummer) => nummer.length >= 8, "Handynummer unvollständig"),
  /** Schichtplan (02.11.2026): Aushilfe – kann Fahrer oder Beifahrer sein, Anmeldung wie Fahrer. */
  istAushilfe: z.boolean().optional().default(false),
});

export type FahrerEinladenEingabe = z.input<typeof fahrerEinladenSchema>;

export const FAHRER_IMPORT_FELDER = [
  { schlüssel: "name", label: "Name", pflicht: true },
  { schlüssel: "phone", label: "Handynummer", pflicht: true },
];

/**
 * Interne, technische Kennung für Better Auth – Fahrer melden sich nie per E-Mail an. Aus der
 * normalisierten Nummer gebildet, damit "0171 …" und "+49 171 …" dasselbe Konto ergeben
 * (Maßnahme M-21; Migration 20261031121000 schreibt Bestandskonten um).
 */
export function technischeFahrerEmail(phone: string): string {
  const ziffern = telefonNormalisieren(phone).replace(/[^0-9]/g, "");
  return `fahrer-${ziffern}@fahrer.intern`;
}

/** GPS-Position aus der Fahrer-App (Maßnahme M-05): gültige Breiten-/Längengrade, keine NaN/Infinity. */
export const gpsPositionSchema = z.object({
  lat: z.number().min(-90, "Breitengrad ungültig").max(90, "Breitengrad ungültig"),
  lng: z.number().min(-180, "Längengrad ungültig").max(180, "Längengrad ungültig"),
});
