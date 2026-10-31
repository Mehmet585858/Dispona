"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { withTenant } from "@/lib/db";
import { requireBueroSession } from "@/lib/session";
import { fahrzeugSchema, textZuJaNein, type FahrzeugEingabe } from "@/core/vehicles/validation";

export async function fahrzeugeLaden() {
  const { tenantId } = await requireBueroSession();
  return withTenant(tenantId).vehicle.findMany({ orderBy: { plate: "asc" } });
}

/** Gibt ein strukturiertes Ergebnis statt zu werfen - ein Server-Action-Fehler kommt beim Client
 * nur als nichtssagende, redigierte Meldung an (Next.js verbirgt die echte Fehlermeldung in
 * Produktion), deshalb hier die beiden erwartbaren Fehlerfälle selbst abfangen und einen klaren
 * Text zurückgeben, statt dass die Oberfläche raten muss, was schiefging. */
export async function fahrzeugSpeichern(
  id: string | null,
  eingabe: FahrzeugEingabe,
): Promise<{ ok: true } | { ok: false; fehler: string }> {
  const { tenantId } = await requireBueroSession();
  const ergebnis = fahrzeugSchema.safeParse(eingabe);
  if (!ergebnis.success) {
    return { ok: false, fehler: ergebnis.error.issues[0]?.message ?? "Eingabe ungültig." };
  }
  const daten = ergebnis.data;
  const db = withTenant(tenantId);
  try {
    if (id) {
      await db.vehicle.update({ where: { id }, data: daten });
    } else {
      // tenantId wird von withTenant() ohnehin gesetzt; hier nur für die Prisma-Typen nötig.
      await db.vehicle.create({ data: { ...daten, tenantId } });
    }
  } catch (fehler) {
    if (fehler instanceof Prisma.PrismaClientKnownRequestError && fehler.code === "P2002") {
      return { ok: false, fehler: "Dieses Kennzeichen ist schon vergeben." };
    }
    throw fehler;
  }
  revalidatePath("/dispo/fahrzeuge");
  return { ok: true };
}

export async function fahrzeugLöschen(id: string) {
  const { tenantId } = await requireBueroSession();
  await withTenant(tenantId).vehicle.update({ where: { id }, data: { active: false } });
  revalidatePath("/dispo/fahrzeuge");
}

export async function fahrzeugeImportieren(
  zeilen: Record<string, string>[],
): Promise<{ ok: number; fehler: string[] }> {
  const { tenantId } = await requireBueroSession();
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
