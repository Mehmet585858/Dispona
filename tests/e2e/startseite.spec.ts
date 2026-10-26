import { expect, test } from "@playwright/test";

test("Startseite zeigt Fahrdienst-KI", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Fahrdienst-KI" })).toBeVisible();
});
