"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ortSchema, PLACE_TYPES, type OrtEingabe } from "@/core/places/validation";

export async function orteLaden() {
  const { tenantId } = await requireSession();
  return withTenant(tenantId).place.findMany({ orderBy: { label: "asc" } });
}

/** Gibt ein strukturiertes Ergebnis statt zu werfen - ein Server-Action-Fehler kommt beim Client
 * nur als nichtssagende, redigierte Meldung an (Next.js verbirgt die echte Fehlermeldung in
 * Produktion); so sieht die Oberfläche wenigstens den konkreten Validierungsgrund statt zu raten. */
export async function ortSpeichern(
  id: string | null,
  eingabe: OrtEingabe,
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { tenantId } = await requireSession();
  const ergebnis = ortSchema.safeParse(eingabe);
  if (!ergebnis.success) {
    return { ok: false, fehler: ergebnis.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  const daten = ergebnis.data;
  const db = withTenant(tenantId);
  if (id) {
    await db.place.update({ where: { id }, data: daten });
  } else {
    await db.place.create({ data: { ...daten, tenantId, usageCount: 0 } });
  }
  revalidatePath("/dispo/orte");
  return { ok: true };
}

export async function ortLöschen(id: string) {
  const { tenantId } = await requireSession();
  await withTenant(tenantId).place.delete({ where: { id } });
  revalidatePath("/dispo/orte");
}

export async function orteImportieren(
  zeilen: Record<string, string>[],
): Promise<{ ok: number; fehler: string[] }> {
  const { tenantId } = await requireSession();
  const db = withTenant(tenantId);
  const fehler: string[] = [];
  let ok = 0;
  for (const [index, zeile] of zeilen.entries()) {
    const typRoh = zeile.type?.trim().toUpperCase();
    const ergebnis = ortSchema.safeParse({
      label: zeile.label,
      street: zeile.street,
      zip: zeile.zip,
      city: zeile.city,
      lat: zeile.lat,
      lng: zeile.lng,
      type: PLACE_TYPES.includes(typRoh as (typeof PLACE_TYPES)[number]) ? typRoh : "SONSTIGES",
    });
    if (!ergebnis.success) {
      fehler.push(`Zeile ${index + 2}: ${ergebnis.error.issues[0]?.message ?? "ungültig"}`);
      continue;
    }
    await db.place.create({ data: { ...ergebnis.data, tenantId, usageCount: 0 } });
    ok += 1;
  }
  revalidatePath("/dispo/orte");
  return { ok, fehler };
}
