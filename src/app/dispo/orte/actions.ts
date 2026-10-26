"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { ortSchema, PLACE_TYPES, type OrtEingabe } from "@/core/places/validation";

export async function orteLaden() {
  const { tenantId } = await requireSession();
  return withTenant(tenantId).place.findMany({ orderBy: { label: "asc" } });
}

export async function ortSpeichern(id: string | null, eingabe: OrtEingabe) {
  const { tenantId } = await requireSession();
  const daten = ortSchema.parse(eingabe);
  const db = withTenant(tenantId);
  if (id) {
    await db.place.update({ where: { id }, data: daten });
  } else {
    await db.place.create({ data: { ...daten, tenantId, usageCount: 0 } });
  }
  revalidatePath("/dispo/orte");
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
