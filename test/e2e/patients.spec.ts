import { expect, test, type Page } from "@playwright/test";

/**
 * Patients in preview mode (docs/decisions/patients.md), against the mock
 * API's made-up people at Harbour Health, where the preview person is owner.
 * Reading an intake summary needs break-glass: that is in
 * care.break-glass.spec.ts. Tests run in parallel against one mock, so
 * each changes a different patient.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const NOAH = "/patients/90000000-0000-4000-8000-000000000002";
const IVY = "/patients/90000000-0000-4000-8000-000000000003";

test("a search finds a patient, keeps the name out of the address, and opens their record", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/patients");
  const table = page.getByRole("table", { name: "Patients" });
  await expect(table.getByRole("row", { name: /Noah Sample/ })).toContainText("Not verified");

  await page.getByLabel("Search patients").fill("mia");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(table.getByRole("row")).toHaveCount(2);
  expect(page.url()).not.toContain("mia");
  await table.getByRole("link", { name: "Mimi Example" }).click();

  await expect(page.getByRole("heading", { level: 1, name: /Mimi Example/ })).toBeVisible();
  await expect(page).toHaveTitle(/^Patients? · Medora$/);
  const details = page.getByRole("region", { name: /Details/ });
  await expect(details).toContainText("Mia Example");
  await expect(details).toContainText("14 Mar 1988");
  await expect(details).toContainText("•••• ••••• 1");
  await expect(page.getByRole("region", { name: /Identity/ })).toContainText("Found, active");
  await expect(page.getByRole("table", { name: "Consents" }).getByRole("row", { name: /Telehealth terms/ })).toContainText("Given");
  const intakes = page.getByRole("region", { name: /Intakes/ });
  await expect(intakes.getByRole("row", { name: /Completed/ })).toContainText("Harbour weight care");
  await expect(intakes.getByRole("row", { name: /Not eligible/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("staff verify a patient's identity by sighting a document", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(NOAH);
  const identity = page.getByRole("region", { name: /Identity/ });
  await expect(identity).toContainText("Not verified");
  await identity.getByRole("button", { name: "Verify by sighting" }).click();
  const drawer = page.getByRole("dialog", { name: "Verify by sighting" });
  await drawer.getByRole("combobox", { name: /Document sighted/ }).click();
  await page.getByRole("option", { name: "Australian passport" }).click();
  await drawer.getByLabel(/How you sighted it/).fill("Held up to the camera on a video call");
  await drawer.getByRole("button", { name: "Verify identity" }).click();
  await expect(drawer).toBeHidden();
  await expect(identity.getByRole("button", { name: "Verify by sighting" })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1, name: /Noah Sample/ })).toContainText("Verified");
  expect(errors).toEqual([]);
});

test("staff let a patient whose checks didn't match try again", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(IVY);
  const identity = page.getByRole("region", { name: /Identity/ });
  await expect(identity).toContainText("Checks didn't match");
  await identity.getByRole("button", { name: "Let them try again" }).click();
  const drawer = page.getByRole("dialog", { name: "Let them try again" });
  await drawer.getByLabel(/Reason/).fill("Their licence was renewed after the last check");
  await drawer.getByRole("button", { name: "Unlock checks" }).click();
  await expect(drawer).toBeHidden();
  await expect(identity).toContainText("Not verified");
  expect(errors).toEqual([]);
});

test("staff record a consent the patient gave by phone", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(NOAH);
  const row = page.getByRole("table", { name: "Consents" }).getByRole("row", { name: /Identity check/ });
  await expect(row).toContainText("Not asked yet");
  await page.getByRole("button", { name: "Record a decision" }).click();
  const drawer = page.getByRole("dialog", { name: "Record a decision" });
  await drawer.getByRole("combobox", { name: /^Document/ }).click();
  await page.getByRole("option", { name: "Identity check, version 1" }).click();
  await drawer.getByRole("combobox", { name: /Decision/ }).click();
  await page.getByRole("option", { name: "Agreed" }).click();
  await drawer.getByRole("combobox", { name: /How they told you/ }).click();
  await page.getByRole("option", { name: "By phone" }).click();
  await drawer.getByLabel(/^Note/).fill("On the support call this morning");
  await drawer.getByRole("button", { name: "Record decision" }).click();
  await expect(drawer).toBeHidden();
  await expect(row).toContainText("Given");
  expect(errors).toEqual([]);
});

test("a patient who isn't in the tenant shows not found", async ({ page }) => {
  await page.goto("/patients/90000000-0000-4000-8000-000000000004");
  await expect(page.getByText("Patient not found")).toBeVisible();
});
