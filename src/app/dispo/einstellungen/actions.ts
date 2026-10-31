"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { withTenant } from "@/lib/db";
import { requireBueroSession } from "@/lib/session";
import type { AutoMode } from "@/generated/prisma/enums";
import { spaltenReihenfolgeBereinigen, type ExportSpalte } from "@/core/export/abrechnung";

export async function einstellungenLaden() {
  const { tenantId } = await requireBueroSession();
  const settings = await withTenant(tenantId).tenantSettings.findUnique({ where: { tenantId } });
  if (!settings) throw new Error("Einstellungen nicht gefunden.");
  return {
    autoMode: settings.autoMode,
    autoModeMinMargin: settings.autoModeMinMargin,
    autoModeMaxDaysAhead: settings.autoModeMaxDaysAhead,
    requireDocsForAuto: settings.requireDocsForAuto,
    alertPhone: settings.alertPhone ?? "",
    dataRetentionDays: settings.dataRetentionDays,
    audioRetentionDays: settings.audioRetentionDays,
  };
}

export async function exportVorlageLaden(): Promise<ExportSpalte[]> {
  const { tenantId } = await requireBueroSession();
  const settings = await withTenant(tenantId).tenantSettings.findUnique({
    where: { tenantId },
    select: { exportTemplate: true },
  });
  return spaltenReihenfolgeBereinigen(settings?.exportTemplate);
}

export async function exportVorlageSpeichern(spalten: ExportSpalte[]) {
  const { tenantId, userId } = await requireBueroSession();
  const bereinigt = spaltenReihenfolgeBereinigen(spalten);
  const db = withTenant(tenantId);
  await db.tenantSettings.update({ where: { tenantId }, data: { exportTemplate: bereinigt } });
  await db.auditLog.create({
    data: { tenantId, userId, action: "tenantSettings.exportvorlage_geaendert", entity: "TenantSettings", entityId: tenantId },
  });
  revalidatePath("/dispo/einstellungen");
}

const automodusSchema = z.object({
  autoMode: z.enum(["AUS", "NACHTS_WOCHENENDE", "IMMER"]),
  autoModeMinMargin: z.number().int().min(0).max(100),
  autoModeMaxDaysAhead: z.number().int().min(0).max(14),
  requireDocsForAuto: z.boolean(),
  alertPhone: z.string().optional(),
});

export type AutomodusEingabe = z.infer<typeof automodusSchema>;

/** Nur ADMIN darf den Automodus einstellen (docs/09-bauplan.md Phase 7). Änderung ins AuditLog. */
export async function automodusEinstellungenSpeichern(eingabe: AutomodusEingabe) {
  const { tenantId, userId, role } = await requireBueroSession();
  if (role !== "ADMIN") {
    throw new Error("Nur Admins dürfen den Automodus einstellen.");
  }
  const daten = automodusSchema.parse(eingabe);
  const db = withTenant(tenantId);

  await db.tenantSettings.update({
    where: { tenantId },
    data: {
      autoMode: daten.autoMode as AutoMode,
      autoModeMinMargin: daten.autoModeMinMargin,
      autoModeMaxDaysAhead: daten.autoModeMaxDaysAhead,
      requireDocsForAuto: daten.requireDocsForAuto,
      alertPhone: daten.alertPhone || null,
    },
  });

  await db.auditLog.create({
    data: { tenantId, userId, action: "tenantSettings.automodus_geaendert", entity: "TenantSettings", entityId: tenantId },
  });

  revalidatePath("/dispo/einstellungen");
  revalidatePath("/dispo");
}

const datenschutzSchema = z.object({
  // Untergrenze 30 Tage: dataRetentionDays löscht ganze Fahrten (inkl. Fahrgastbezug, siehe
  // src/core/datenschutz/loeschfristen.ts) - ein zu niedriger Wert würde laufend echte
  // Fahrthistorie löschen, nicht nur alte Testdaten.
  dataRetentionDays: z.number().int().min(30).max(7300),
  audioRetentionDays: z.number().int().min(1).max(3650),
});

export type DatenschutzEingabe = z.infer<typeof datenschutzSchema>;

/** Nur ADMIN darf die Aufbewahrungsfristen ändern (docs/08-datenschutz-sicherheit.md). Änderung ins AuditLog. */
export async function datenschutzEinstellungenSpeichern(eingabe: DatenschutzEingabe) {
  const { tenantId, userId, role } = await requireBueroSession();
  if (role !== "ADMIN") {
    throw new Error("Nur Admins dürfen die Aufbewahrungsfristen ändern.");
  }
  const daten = datenschutzSchema.parse(eingabe);
  const db = withTenant(tenantId);

  await db.tenantSettings.update({
    where: { tenantId },
    data: { dataRetentionDays: daten.dataRetentionDays, audioRetentionDays: daten.audioRetentionDays },
  });

  await db.auditLog.create({
    data: { tenantId, userId, action: "tenantSettings.aufbewahrung_geaendert", entity: "TenantSettings", entityId: tenantId },
  });

  revalidatePath("/dispo/einstellungen");
}
