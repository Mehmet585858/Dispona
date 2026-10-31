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
});

export type FahrerEinladenEingabe = z.infer<typeof fahrerEinladenSchema>;

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

const UHRZEIT = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Schichtmuster. Endzeit vor Startzeit = Nachtschicht bis zum Folgetag (Maßnahme M-18, siehe
 * schichtZeitraum in src/core/shifts/dauer.ts); gleiche Zeiten ergäben eine leere Schicht.
 */
export const schichtMusterSchema = z
  .object({
    driverId: z.string().min(1, "Fahrer fehlt"),
    vehicleId: z.string().min(1, "Fahrzeug fehlt"),
    wochentage: z.array(z.number().min(0).max(6)).min(1, "Mindestens ein Tag wählen"),
    start: z.string().regex(UHRZEIT, "Startzeit fehlt oder ungültig (HH:MM)"),
    end: z.string().regex(UHRZEIT, "Endzeit fehlt oder ungültig (HH:MM)"),
  })
  .refine((muster) => muster.start !== muster.end, { message: "Start- und Endzeit sind gleich", path: ["end"] });

export type SchichtMusterEingabe = z.infer<typeof schichtMusterSchema>;

/** GPS-Position aus der Fahrer-App (Maßnahme M-05): gültige Breiten-/Längengrade, keine NaN/Infinity. */
export const gpsPositionSchema = z.object({
  lat: z.number().min(-90, "Breitengrad ungültig").max(90, "Breitengrad ungültig"),
  lng: z.number().min(-180, "Längengrad ungültig").max(180, "Längengrad ungültig"),
});
