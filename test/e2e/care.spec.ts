import { expect, test, type Page } from "@playwright/test";

/**
 * Consent documents, programs and protocols in preview mode
 * (docs/decisions/patients.md, docs/decisions/intake.md), against the mock
 * API's made-up Harbour Health tenant, where the preview person is owner.
 * Nothing here needs break-glass: signing off is in care.break-glass.spec.ts.
 * Tests run in parallel against one mock, so each makes its own records.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const unique = () => Math.random().toString(36).slice(2, 8);

test("an owner publishes the first version of a consent document", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/consent-documents");
  const table = page.getByRole("table", { name: "Consent documents" });
  await expect(table.getByRole("row", { name: /Privacy and collection notice 2 / })).toContainText("Current");
  await expect(table.getByRole("row", { name: /Privacy and collection notice 1 / })).toContainText("Earlier");

  await page.getByRole("button", { name: "Publish a version" }).click();
  const sheet = page.getByRole("dialog", { name: "Publish a version" });
  await sheet.getByRole("combobox", { name: /Document/ }).click();
  await page.getByRole("option", { name: "Sharing with the pharmacy" }).click();
  await expect(sheet.getByText("This will be version 1.")).toBeVisible();
  await sheet.getByLabel(/^Title/).fill("Sharing your script with the pharmacy");
  await sheet.getByLabel(/^Text/).fill("Made-up text for a browser test.");
  await sheet.getByRole("button", { name: "Publish" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Version published", { exact: true })).toBeVisible();
  await expect(table.getByRole("row", { name: /Sharing your script with the pharmacy/ })).toContainText("Current");
  expect(errors).toEqual([]);
});

test("an owner adds a program as a draft and takes it live", async ({ page }) => {
  const errors = collectErrors(page);
  const name = `Harbour check-in ${unique()}`;
  await page.goto("/programs");
  await expect(page.getByRole("table", { name: "Programs" }).getByRole("row", { name: /Harbour weight care/ })).toContainText("Live");

  await page.getByRole("button", { name: "New program" }).click();
  const sheet = page.getByRole("dialog", { name: "New program" });
  await sheet.getByRole("combobox", { name: /Brand/ }).click();
  await page.getByRole("option", { name: "Harbour Health" }).click();
  await sheet.getByRole("combobox", { name: /Protocol/ }).click();
  await page.getByRole("option", { name: "Weight management" }).click();
  await sheet.getByLabel(/^Name/).fill(name);
  await sheet.getByRole("checkbox", { name: "Weight" }).check();
  await sheet.getByRole("button", { name: "Add program" }).click();
  await expect(sheet).toBeHidden();
  const row = page.getByRole("table", { name: "Programs" }).getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("Draft");

  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Go live" }).click();
  await page.getByRole("alertdialog", { name: `Take ${name} live?` }).getByRole("button", { name: "Go live" }).click();
  await expect(row).toContainText("Live");
  expect(errors).toEqual([]);
});

test("a protocol shows its versions, and the draft's questions and rules", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/protocols");
  await page.getByRole("table", { name: "Protocols" }).getByRole("link", { name: "Weight management" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Weight management/ })).toBeVisible();
  const versions = page.getByRole("table", { name: "Versions" });
  await expect(versions.getByRole("row", { name: /^1\b/ })).toContainText("Live");
  await expect(versions.getByRole("row", { name: /^2\b/ })).toContainText("Draft");
  await expect(page.getByRole("table", { name: "Hard stops" })).toContainText("BMI under 27");
  await expect(page.getByRole("table", { name: "Red flags" })).toContainText("Gallbladder disease");
  expect(errors).toEqual([]);
});

test("an owner starts a protocol from a template, and a broken draft shows its problems", async ({ page }) => {
  const errors = collectErrors(page);
  const name = `Weight care ${unique()}`;
  await page.goto("/protocols");
  await page.getByRole("button", { name: "New protocol" }).click();
  const sheet = page.getByRole("dialog", { name: "New protocol" });
  await sheet.getByRole("combobox", { name: /Template/ }).click();
  await page.getByRole("option", { name: "Weight management" }).click();
  await sheet.getByLabel(/^Name/).fill(name);
  await sheet.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(name) })).toBeVisible();
  await expect(page.getByRole("table", { name: "Versions" }).getByRole("row", { name: /^1\b/ })).toContainText("Draft");

  await page.getByRole("button", { name: "Edit draft" }).click();
  const drawer = page.getByRole("dialog", { name: "Edit draft version 1" });
  await drawer.getByLabel("Definition").fill('{ "steps": [], "derived": [], "rules": [] }');
  await drawer.getByRole("button", { name: "Save draft" }).click();
  await expect(drawer.getByRole("list", { name: "Problems to fix" })).toContainText("Add at least one step");
  expect(errors.filter((e) => !e.includes("400"))).toEqual([]);
});
