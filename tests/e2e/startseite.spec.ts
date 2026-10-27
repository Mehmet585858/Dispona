import { expect, test } from "@playwright/test";

test("Startseite leitet nicht angemeldete Besucher zur Anmeldung", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/anmeldung/);
  await expect(page.getByRole("heading", { name: "Anmelden" })).toBeVisible();
});
