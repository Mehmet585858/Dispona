import { z } from "zod";

export const PLACE_TYPES = ["WOHNUNG", "PRAXIS", "KLINIK", "DIALYSE", "PFLEGEHEIM", "SONSTIGES"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const PLACE_TYPE_LABEL: Record<PlaceType, string> = {
  WOHNUNG: "Wohnung",
  PRAXIS: "Praxis",
  KLINIK: "Klinik",
  DIALYSE: "Dialyse",
  PFLEGEHEIM: "Pflegeheim",
  SONSTIGES: "Sonstiges",
};

export const ortSchema = z.object({
  label: z.string().trim().min(2, "Name fehlt"),
  street: z.string().trim().min(2, "Straße fehlt"),
  zip: z.string().trim().min(4, "PLZ fehlt"),
  city: z.string().trim().min(2, "Ort fehlt"),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  type: z.enum(PLACE_TYPES),
});

export type OrtEingabe = z.infer<typeof ortSchema>;

export const ORT_IMPORT_FELDER = [
  { schlüssel: "label", label: "Name", pflicht: true },
  { schlüssel: "street", label: "Straße und Hausnummer", pflicht: true },
  { schlüssel: "zip", label: "PLZ", pflicht: true },
  { schlüssel: "city", label: "Ort", pflicht: true },
  { schlüssel: "lat", label: "Breitengrad (lat)", pflicht: true },
  { schlüssel: "lng", label: "Längengrad (lng)", pflicht: true },
  { schlüssel: "type", label: "Art (PRAXIS/KLINIK/DIALYSE/PFLEGEHEIM/WOHNUNG/SONSTIGES)", pflicht: false },
];
