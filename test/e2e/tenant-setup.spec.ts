import { expect, test, type Page } from "@playwright/test";

/**
 * A tenant's set-up in preview mode (docs/decisions/admin.md ADM14 to
 * ADM20): settings and the onboarding checklist, companies, brands and
 * their domains, and platform staff's screens, against the mock API's
 * made-up Harbour Health tenant, where the preview person is owner and
 * platform staff. Tests run in parallel against one mock, so each makes
 * its own companies, brands and tenants.
 */

/**
 * Errors on the page, and any answer from the API that isn't a refusal.
 * A refused step (4xx) is part of these tests, and the browser notes each
 * one in the console, so that note alone is left out.
 */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (/^Failed to load resource: the server responded with a status of 4\d\d/.test(message.text())) return;
    errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 500) errors.push(`${response.status()} from ${new URL(response.url()).pathname}`);
  });
  return errors;
}

const unique = () => Math.random().toString(36).slice(2, 8);

test("Settings shows the onboarding checklist, and an owner changes the time zone", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/settings");
  const checklist = page.getByRole("definition").filter({ hasText: /Done|To do/ });
  await expect(page.getByText("Not taking new patients")).toBeVisible();
  await expect(page.getByText("Invite a medical director")).toBeVisible();
  await expect(checklist).toHaveText(["Done", "Done", "To do", "Done"]);

  await page.getByRole("combobox", { name: "Time zone" }).click();
  await page.getByRole("option", { name: "Perth" }).click();
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Time zone" })).toContainText("Perth");

  // Home shows the same checklist while it isn't done.
  await page.goto("/home");
  await expect(page.getByText("Before you take new patients")).toBeVisible();
  expect(errors).toEqual([]);
});

test("an owner adds a company, and a wrong ABN shows the API's reason", async ({ page }) => {
  const errors = collectErrors(page);
  const name = `Northside ${unique()} Pty Ltd`;
  await page.goto("/companies");
  await page.getByRole("button", { name: "New company" }).click();
  const sheet = page.getByRole("dialog", { name: "New company" });
  await sheet.getByLabel("Legal name").fill(name);
  await sheet.getByLabel("ABN").fill("11 001 686 748");
  await sheet.getByRole("button", { name: "Add company" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("That ABN isn't valid. Check the 11 digits.");
  await sheet.getByLabel("ABN").fill("11 001 686 747");
  await sheet.getByRole("combobox", { name: "State" }).click();
  await page.getByRole("option", { name: "Victoria" }).click();
  await sheet.getByRole("button", { name: "Add company" }).click();
  await expect(sheet).toBeHidden();
  const row = page.getByRole("table", { name: "Companies" }).getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("11 001 686 747");
  await expect(row).toContainText("VIC");

  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Delete company" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete company" }).click();
  await expect(row).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a brand goes live once platform staff verify its domain, then pauses and resumes", async ({ page }) => {
  const errors = collectErrors(page);
  const id = unique();
  const name = `Harbour Sleep ${id}`;
  const host = `sleep-${id}.harbour-health.example`;
  await page.goto("/brands");
  await page.getByRole("button", { name: "New brand" }).click();
  const sheet = page.getByRole("dialog", { name: "New brand" });
  await sheet.getByLabel(/^Name/).fill(name);
  await sheet.getByLabel("Address name").fill(`harbour-sleep-${id}`);
  await sheet.getByLabel("Support email").fill("sleep@example.test");
  await sheet.getByLabel("Colour").fill("#777777");
  await sheet.getByRole("button", { name: "Add brand" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Text can't be read on that colour. Choose a darker or lighter one.");
  await sheet.getByLabel("Colour").fill("#0f766e");
  await sheet.getByRole("button", { name: "Add brand" }).click();
  await expect(sheet).toBeHidden();
  const row = page.getByRole("table", { name: "Brands" }).getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("Draft");

  // Going live needs a verified domain: the API says so.
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Go live" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Go live" }).click();
  await expect(page.getByText("A brand goes live once Medora has verified one of its domains")).toBeVisible();

  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Domains" }).click();
  const domains = page.getByRole("dialog", { name: `Domains for ${name}` });
  await domains.getByLabel("Add a domain").fill(`https://${host.toUpperCase()}/`);
  await domains.getByRole("button", { name: "Add domain" }).click();
  await expect(domains.getByRole("listitem").filter({ hasText: host })).toContainText("Waiting");
  await page.keyboard.press("Escape");

  await page.goto("/platform/domains");
  await page.getByRole("button", { name: `Verify ${host}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Mark verified" }).click();
  await expect(page.getByText("Domain verified")).toBeVisible();
  await expect(page.getByRole("button", { name: `Verify ${host}` })).toHaveCount(0);

  await page.goto("/brands");
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Go live" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Go live" }).click();
  await expect(row).toContainText("Live");
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Pause new sign-ups" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Pause brand" }).click();
  await expect(row).toContainText("Paused");
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Resume" }).click();
  await expect(row).toContainText("Live");
  expect(errors).toEqual([]);
});

test("platform staff create a tenant whose first owner is invited", async ({ page }) => {
  const errors = collectErrors(page);
  const name = `Bayside Clinic ${unique()}`;
  await page.goto("/platform/tenants");
  await page.getByRole("button", { name: "New tenant" }).click();
  const sheet = page.getByRole("dialog", { name: "New tenant" });
  await sheet.getByLabel(/^Name/).fill(name);
  await sheet.getByLabel("Owner's email").fill(`owner.${unique()}@example.test`);
  await sheet.getByRole("button", { name: "Create tenant" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Tenant created")).toBeVisible();
  const row = page.getByRole("table", { name: "Tenants" }).getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("Invited");
  await expect(row).toContainText("None yet");
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Send owner invitation again" }).click();
  await expect(page.getByText("Owner invitation sent again")).toBeVisible();
  expect(errors).toEqual([]);
});

test("a clinician sees the brands and settings but can't change them", async ({ page }) => {
  await page.goto("/brands");
  await page.getByRole("button", { name: /Change tenant/ }).click();
  await page.getByRole("menuitemradio", { name: "Coastal Skin (demo)" }).click();
  await expect(page.getByRole("table", { name: "Brands" }).getByRole("row", { name: /Coastal Skin/ })).toContainText("Live");
  await expect(page.getByRole("button", { name: "New brand" })).toHaveCount(0);
  await page.getByRole("button", { name: "Actions for Coastal Skin" }).click();
  await expect(page.getByRole("menuitem")).toHaveText(["See domains"]);
  await page.keyboard.press("Escape");
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Save settings" })).toHaveCount(0);
  await expect(page.getByText("Brisbane")).toBeVisible();
});
