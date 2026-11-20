import { expect, test } from "@playwright/test";

/**
 * Clinicians in preview mode (dev/mock-api/clinicians.mjs): the preview
 * person owns Harbour Health and is a clinician at Coastal Skin.
 */

test("lists clinicians with their standing, and opens one as a record", async ({ page }) => {
  // The section rail shows when the page is wide enough for it (grid-record.css).
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/clinicians");
  await expect(page.getByRole("heading", { name: "Clinicians", level: 1 })).toBeVisible();
  const sam = page.getByRole("row", { name: /sam\.lee@example\.test/ });
  await expect(sam).toContainText("Medical practitioner");
  await expect(sam).toContainText("Can prescribe");

  await page.getByRole("link", { name: "sam.lee@example.test" }).click();
  await expect(page.getByRole("heading", { name: /sam\.lee@example\.test/, level: 1 })).toBeVisible();
  const rail = page.getByRole("navigation", { name: "On this page" });
  for (const section of ["Standing", "Credentials", "Working hours", "Time off"]) await expect(rail).toContainText(section);
  await expect(page.locator("#standing")).toContainText("Nothing stops them");
});

test("an owner checks a waiting credential, and the standing follows", async ({ page }) => {
  await page.goto("/clinicians");
  await page.getByRole("link", { name: "jordan.patel@example.test" }).click();
  await expect(page.locator("#standing")).toContainText("Indemnity waiting for a check");
  const waiting = page.locator("#credentials").getByRole("row", { name: /Indemnity/ });
  await expect(waiting).toContainText("Waiting for a check");
  await waiting.getByRole("button", { name: "Actions for indemnity" }).click();
  await page.getByRole("menuitem", { name: "Record it was checked today" }).click();
  await expect(waiting).toContainText("Counts");
  await expect(page.locator("#standing")).not.toContainText("Indemnity waiting for a check");
  await expect(page.locator("#standing")).toContainText("No nurse practitioner endorsement recorded");
});

test("an owner makes a staff member a clinician, who starts unable to consult", async ({ page }) => {
  await page.goto("/clinicians");
  await page.getByRole("button", { name: "Add clinician" }).click();
  const dialog = page.getByRole("dialog", { name: "Add clinician" });
  await dialog.getByLabel("Staff member").click();
  await page.getByRole("option", { name: "riley.chen@example.test" }).click();
  await dialog.getByLabel("Profession").click();
  await page.getByRole("option", { name: "Health coach" }).click();
  await dialog.getByRole("button", { name: "Add clinician" }).click();
  await expect(page.getByRole("heading", { name: /riley\.chen@example\.test/, level: 1 })).toBeVisible();
  await expect(page.locator("#standing")).toContainText("No indemnity recorded");
});

test("a clinician sees their own record but can't check their own credential", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("button", { name: "Working in Harbour Health (demo). Change tenant" }).click();
  await page.getByRole("menuitemradio", { name: "Coastal Skin (demo)" }).click();
  await page.goto("/clinicians");
  await page.getByRole("link", { name: "owner@example.test" }).click();
  await expect(page.locator("#credentials")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add credential" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Suspend" })).toHaveCount(0);
  // Their checked credentials offer nothing: only a manager withdraws a checked one, and nobody checks their own.
  await expect(page.locator("#credentials").getByRole("button", { name: /^Actions for/ })).toHaveCount(0);
});

test("adds working hours, and refuses blocks that overlap", async ({ page }) => {
  await page.goto("/clinicians");
  await page.getByRole("link", { name: "sam.lee@example.test" }).click();
  const hours = page.locator("#hours");
  await expect(hours).toContainText("09:00 to 17:00");
  await hours.getByRole("button", { name: "Edit" }).click();
  const drawer = page.getByRole("dialog", { name: "Edit working hours" });
  await drawer.getByRole("button", { name: "Add a block" }).click();
  await drawer.getByRole("button", { name: "Save changes" }).click();
  await expect(drawer.getByRole("alert")).toContainText("Two blocks of hours overlap on the same day");
  await drawer.getByRole("button", { name: "Remove block 6" }).click();
  await drawer.getByRole("button", { name: "Save changes" }).click();
  await expect(drawer).toHaveCount(0);
});
