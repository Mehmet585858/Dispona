"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { withTenant } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  fahrerEinladenSchema,
  schichtMusterSchema,
  technischeFahrerEmail,
  type FahrerEinladenEingabe,
  type SchichtMusterEingabe,
} from "@/core/drivers/validation";
import { berlinerMitternacht, mitUhrzeit, wochenTage } from "@/core/shifts/week";

export async function fahrerLaden() {
  const { tenantId } = await requireSession();
  return withTenant(tenantId).driver.findMany({
    include: { user: true },
    orderBy: { user: { name: "asc" } },
  });
}

export async function fahrzeugeFuerAuswahl() {
  const { tenantId } = await requireSession();
  return withTenant(tenantId).vehicle.findMany({
    where: { active: true },
    orderBy: { plate: "asc" },
    select: { id: true, plate: true, wheelchairSpots: true, carryChair: true, stretcher: true },
  });
}

export async function schichtenFuerWoche(montagIso: string) {
  const { tenantId } = await requireSession();
  const montag = berlinerMitternacht(montagIso);
  const sonntagEnde = new Date(montag);
  sonntagEnde.setDate(sonntagEnde.getDate() + 7);
  return withTenant(tenantId).shift.findMany({
    where: { start: { gte: montag, lt: sonntagEnde } },
    include: { vehicle: { select: { plate: true } } },
    orderBy: { start: "asc" },
  });
}

export async function fahrerEinladen(
  eingabe: FahrerEinladenEingabe,
): Promise<{ email: string }> {
  const { tenantId } = await requireSession();
  const daten = fahrerEinladenSchema.parse(eingabe);
  const email = technischeFahrerEmail(daten.phone);
  const db = withTenant(tenantId);

  const user = await db.user.create({
    data: {
      id: randomUUID(),
      tenantId,
      email,
      name: daten.name,
      phone: daten.phone,
      role: "FAHRER",
      emailVerified: true,
    },
  });
  await db.driver.create({ data: { tenantId, userId: user.id } });
  revalidatePath("/dispo/fahrer");
  return { email };
}

export async function schichtMusterAnlegen(eingabe: SchichtMusterEingabe, montagIso: string) {
  const { tenantId } = await requireSession();
  const daten = schichtMusterSchema.parse(eingabe);
  const tage = wochenTage(berlinerMitternacht(montagIso));
  const db = withTenant(tenantId);

  for (const wochentagIndex of daten.wochentage) {
    const tag = tage[wochentagIndex];
    await db.shift.create({
      data: {
        tenantId,
        driverId: daten.driverId,
        vehicleId: daten.vehicleId,
        start: mitUhrzeit(tag, daten.start),
        end: mitUhrzeit(tag, daten.end),
      },
    });
  }
  revalidatePath("/dispo/fahrer");
}

export async function schichtLöschen(id: string) {
  const { tenantId } = await requireSession();
  await withTenant(tenantId).shift.delete({ where: { id } });
  revalidatePath("/dispo/fahrer");
}

export async function fahrerImportieren(
  zeilen: Record<string, string>[],
): Promise<{ ok: number; fehler: string[] }> {
  const { tenantId } = await requireSession();
  const db = withTenant(tenantId);
  const fehler: string[] = [];
  let ok = 0;
  for (const [index, zeile] of zeilen.entries()) {
    const ergebnis = fahrerEinladenSchema.safeParse(zeile);
    if (!ergebnis.success) {
      fehler.push(`Zeile ${index + 2}: ${ergebnis.error.issues[0]?.message ?? "ungültig"}`);
      continue;
    }
    const email = technischeFahrerEmail(ergebnis.data.phone);
    const vorhanden = await db.user.findFirst({ where: { email } });
    if (vorhanden) {
      fehler.push(`Zeile ${index + 2}: Handynummer schon vorhanden`);
      continue;
    }
    const user = await db.user.create({
      data: {
        id: randomUUID(),
        tenantId,
        email,
        name: ergebnis.data.name,
        phone: ergebnis.data.phone,
        role: "FAHRER",
        emailVerified: true,
      },
    });
    await db.driver.create({ data: { tenantId, userId: user.id } });
    ok += 1;
  }
  revalidatePath("/dispo/fahrer");
  return { ok, fehler };
}
