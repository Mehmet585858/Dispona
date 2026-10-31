import { z } from "zod";

export const fahrerEinladenSchema = z.object({
  name: z.string().trim().min(2, "Name fehlt"),
  phone: z
    .string()
    .trim()
    .min(6, "Handynummer fehlt")
    .regex(/^\+?[0-9 ()/-]+$/, "Das sieht nicht nach einer Telefonnummer aus"),
});

export type FahrerEinladenEingabe = z.infer<typeof fahrerEinladenSchema>;

export const FAHRER_IMPORT_FELDER = [
  { schlüssel: "name", label: "Name", pflicht: true },
  { schlüssel: "phone", label: "Handynummer", pflicht: true },
];

/** Interne, technische Kennung für Better Auth – Fahrer melden sich nie per E-Mail an. */
export function technischeFahrerEmail(phone: string): string {
  const ziffern = phone.replace(/[^0-9]/g, "");
  return `fahrer-${ziffern}@fahrer.intern`;
}

export const schichtMusterSchema = z.object({
  driverId: z.string().min(1, "Fahrer fehlt"),
  vehicleId: z.string().min(1, "Fahrzeug fehlt"),
  wochentage: z.array(z.number().min(0).max(6)).min(1, "Mindestens ein Tag wählen"),
  start: z.string().min(1, "Startzeit fehlt"),
  end: z.string().min(1, "Endzeit fehlt"),
});

export type SchichtMusterEingabe = z.infer<typeof schichtMusterSchema>;

/** GPS-Position aus der Fahrer-App (Maßnahme M-05): gültige Breiten-/Längengrade, keine NaN/Infinity. */
export const gpsPositionSchema = z.object({
  lat: z.number().min(-90, "Breitengrad ungültig").max(90, "Breitengrad ungültig"),
  lng: z.number().min(-180, "Längengrad ungültig").max(180, "Längengrad ungültig"),
});
