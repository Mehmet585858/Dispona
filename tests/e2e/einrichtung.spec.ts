import "dotenv/config";
import { expect, test } from "@playwright/test";
import { Client } from "pg";

// Direkter pg-Zugriff statt src/lib/prisma.ts: der generierte Prisma-Client ist reines ESM
// (import.meta), das Playwrights Test-Transform nicht verarbeiten kann (anders als Vitest).
async function dbClient() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

/**
 * Kompletter Durchlauf durch den Einrichtungsassistenten (docs/09-bauplan.md Phase 9,
 * "So prüfst du"): neue Firma registrieren, anmelden, alle 8 Schritte durchklicken (Telefon und
 * Testanruf sind nicht automatisiert prüfbar, deshalb "Später erledigen"), am Ende auf /dispo
 * landen. Liest den Einmal-Code direkt aus der Verification-Tabelle (better-auth speichert ihn
 * im Entwicklungsmodus unverschlüsselt dort), weil er sonst nur im Server-Terminal steht.
 */
test("Einrichtungsassistent: neue Firma registrieren und durchklicken", async ({ page }) => {
  const kennung = Date.now();
  const email = `playwright-${kennung}@test.de`;
  const firmenname = `Playwright-Testfirma ${kennung}`;

  await page.goto("/registrieren");
  await page.getByLabel("Name Ihres Fahrdienstes").fill(firmenname);
  await page.getByLabel("Vorname").fill("Test");
  await page.getByLabel("Nachname").fill("Admin");
  await page.getByLabel("Ihre E-Mail-Adresse").fill(email);
  await page.getByLabel("Ihre Handynummer").fill("+4917012345678");
  await page.getByRole("button", { name: "Fahrdienst anlegen" }).click();

  await expect(page).toHaveURL(/\/anmeldung\?email=/);

  const db = await dbClient();
  const { rows } = await db.query(
    `select value from verification where identifier = $1 order by "createdAt" desc limit 1`,
    [`sign-in-otp-${email}`],
  );
  expect(rows).toHaveLength(1);
  const code: string = rows[0].value.split(":")[0];

  await page.getByLabel("Code").fill(code);
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(page).toHaveURL(/\/einrichtung\/1/);
  await expect(page.getByRole("heading", { name: "Wie heißt Ihr Fahrdienst?" })).toBeVisible();

  // Schritt 1: Firma – Vorbelegung aus der Registrierung reicht, direkt weiter.
  await page.getByRole("button", { name: /^Weiter:/ }).click();
  await expect(page).toHaveURL(/\/einrichtung\/2/);

  // Schritt 2: Telefon – ohne echte Telefonanlage überspringen.
  await page.getByRole("button", { name: "Später erledigen" }).click();
  await expect(page).toHaveURL(/\/einrichtung\/3/);

  // Schritt 3: Fahrzeuge – ohne Fahrzeug weiter (die bestehende Seite prüft das nicht).
  await page.getByRole("button", { name: /^Weiter:/ }).click();
  await expect(page).toHaveURL(/\/einrichtung\/4/);

  // Schritt 4: Fahrer
  await page.getByRole("button", { name: /^Weiter:/ }).click();
  await expect(page).toHaveURL(/\/einrichtung\/5/);

  // Schritt 5: Disposition – Voreinstellungen übernehmen.
  await page.getByRole("button", { name: /^Weiter:/ }).click();
  await expect(page).toHaveURL(/\/einrichtung\/6/);

  // Schritt 6: KI anpassen – Voreinstellungen übernehmen.
  await page.getByRole("button", { name: /^Weiter:/ }).click();
  await expect(page).toHaveURL(/\/einrichtung\/7/);

  // Schritt 7: Testanruf – ohne echten Anruf überspringen.
  await page.getByRole("button", { name: "Später erledigen" }).click();
  await expect(page).toHaveURL(/\/einrichtung\/8/);

  // Schritt 8: Live schalten – "Noch nicht" ist vorausgewählt, Einrichtung abschließen.
  await page.getByRole("button", { name: "Übernehmen und Einrichtung abschließen" }).click();
  await expect(page).toHaveURL(/\/dispo/);
  await expect(page.getByText("Automodus")).toBeVisible();

  const { rows: userRows } = await db.query(`select "tenantId" from "user" where email = $1`, [email]);
  const tenantId: string = userRows[0].tenantId;
  await db.query(`delete from "AuditLog" where "tenantId" = $1`, [tenantId]);
  await db.query(`delete from "user" where "tenantId" = $1`, [tenantId]);
  await db.query(`delete from "TenantSettings" where "tenantId" = $1`, [tenantId]);
  await db.query(`delete from "Tenant" where id = $1`, [tenantId]);
  await db.end();
});
