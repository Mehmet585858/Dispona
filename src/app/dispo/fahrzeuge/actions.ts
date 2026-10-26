"use server";

import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import { fahrzeugSchema, textZuJaNein, type FahrzeugEingabe } from "@/core/vehicles/validation";

export async function fahrzeugeLaden() {
  const { tenantId } = await requireSession();
  return withTenant(tenantId).vehicle.findMany({ orderBy: { plate: "asc" } });
}

export async function fahrzeugSpeichern(id: string | null, eingabe: FahrzeugEingabe) {
  const { tenantId } = await requireSession();
  const daten = fahrzeugSchema.parse(eingabe);
  const db = withTenant(tenantId);
  if (id) {
    await db.vehicle.update({ where: { id }, data: daten });
  } else {
    // tenantId wird von withTenant() ohnehin gesetzt; hier nur für die Prisma-Typen nötig.
    await db.vehicle.create({ data: { ...daten, tenantId } });
  }
  revalidatePath("/dispo/fahrzeuge");
}

export async function fahrzeugLöschen(id: string) {
  const { tenantId } = await requireSession();
  await withTenant(tenantId).vehicle.update({ where: { id }, data: { active: false } });
  revalidatePath("/dispo/fahrzeuge");
}

export async function fahrzeugeImportieren(
  zeilen: Record<string, string>[],
): Promise<{ ok: number; fehler: string[] }> {
  const { tenantId } = await requireSession();
  const db = withTenant(tenantId);
  const fehler: string[] = [];
  let ok = 0;
  for (const [index, zeile] of zeilen.entries()) {
    const ergebnis = fahrzeugSchema.safeParse({
      plate: zeile.plate,
      seats: zeile.seats || "4",
      wheelchairSpots: zeile.wheelchairSpots || "0",
      carryChair: textZuJaNein(zeile.carryChair),
      stretcher: textZuJaNein(zeile.stretcher),
      active: true,
    });
    if (!ergebnis.success) {
      fehler.push(`Zeile ${index + 2}: ${ergebnis.error.issues[0]?.message ?? "ungültig"}`);
      continue;
    }
    await db.vehicle.create({ data: { ...ergebnis.data, tenantId } });
    ok += 1;
  }
  revalidatePath("/dispo/fahrzeuge");
  return { ok, fehler };
}
