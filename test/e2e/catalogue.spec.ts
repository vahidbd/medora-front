import { expect, test, type Page } from "@playwright/test";

/**
 * The catalogue in preview mode (docs/decisions/catalogue.md CAT1 to CAT6):
 * products, a tenant's own blocks and Medora's block rules, against the
 * mock API's made-up Harbour Health tenant, where the preview person is
 * owner and platform staff. Tests run in parallel against one mock, so
 * each makes its own products and blocks its own made-up ARTG number.
 */

/** Errors on the page, and any answer that isn't a refusal; a refused step (4xx) is part of these tests. */
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
const artg = () => String(Math.floor(10_000_000 + Math.random() * 89_999_999));

async function addMedicine(page: Page, name: string, artgNumber: string) {
  await page.getByRole("button", { name: "New product" }).click();
  const sheet = page.getByRole("dialog", { name: "New product" });
  await sheet.getByLabel(/^Name/).fill(name);
  await sheet.getByLabel(/^ARTG number/).fill(artgNumber);
  await sheet.getByLabel(/^Price/).fill("45");
  await sheet.getByRole("button", { name: "Add product" }).click();
  await expect(sheet).toBeHidden();
}

test("Products shows Medora's blocks, and an owner adds, blocks, archives and restores a product", async ({ page }) => {
  const errors = collectErrors(page);
  const name = `Harbour test tablets ${unique()}`;
  await page.goto("/products");
  await expect(page.getByRole("note")).toContainText("Medora blocks these for every tenant: Compounded medicines, Schedule 8 medicines.");
  const table = page.getByRole("table", { name: "Products" });
  await expect(table.getByRole("row", { name: /Harbour compounded cream/ })).toContainText("Blocked by Medora");
  await expect(table.getByRole("row", { name: /Harbour sleep tablets/ })).toContainText("Supplier recall (made-up)");

  // A medicine says what it is (CAT1): the API's reason shows in the sheet.
  await page.getByRole("button", { name: "New product" }).click();
  const sheet = page.getByRole("dialog", { name: "New product" });
  await sheet.getByLabel(/^Name/).fill(name);
  await sheet.getByLabel(/^Price/).fill("45");
  await sheet.getByRole("button", { name: "Add product" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("A medicine needs its ARTG number, or to be marked compounded");
  await sheet.getByLabel(/^ARTG number/).fill("ARTG 123 456");
  await sheet.getByRole("button", { name: "Add product" }).click();
  await expect(sheet).toBeHidden();
  const row = table.getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("ARTG 123456");
  await expect(row).toContainText("$45.00");
  await expect(row).toContainText("Active");

  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Block product" }).click();
  const dialog = page.getByRole("dialog", { name: `Block ${name}?` });
  await dialog.getByLabel(/^Reason/).fill("Batch recall in testing");
  await dialog.getByRole("button", { name: "Block product" }).click();
  await expect(row).toContainText("Batch recall in testing");
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Lift block" }).click();
  await expect(row).not.toContainText("Batch recall in testing");
  await expect(row).toContainText("Active");
  await expect(page.getByRole("menu")).toBeHidden();

  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Archive" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("tab", { name: "Archived" }).click();
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await expect(table.getByRole("row", { name: new RegExp(name) })).toHaveCount(0);
  await page.getByRole("tab", { name: "Active" }).click();
  await expect(row).toContainText("Active");
  expect(errors).toEqual([]);
});

test("a block rule platform staff add stops an existing product at once", async ({ page }) => {
  const errors = collectErrors(page);
  const name = `Harbour recalled pen ${unique()}`;
  const number = artg();
  await page.goto("/products");
  await addMedicine(page, name, number);
  const row = page.getByRole("table", { name: "Products" }).getByRole("row", { name: new RegExp(name) });
  await expect(row).toContainText("Active");

  await page.goto("/platform/block-rules");
  await page.getByRole("button", { name: "New block rule" }).click();
  const sheet = page.getByRole("dialog", { name: "New block rule" });
  await sheet.getByRole("combobox", { name: "Block" }).click();
  await page.getByRole("option", { name: "ARTG number" }).click();
  await sheet.getByLabel(/^ARTG number/).fill(number);
  await sheet.getByLabel(/^Reason/).fill("Made-up recall for this test");
  await sheet.getByRole("button", { name: "Add block rule" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("table", { name: "Block rules" }).getByRole("row", { name: new RegExp(`ARTG ${number}`) })).toContainText(
    "In force",
  );

  await page.goto("/products");
  await expect(row).toContainText("Blocked by Medora");
  await expect(row).toContainText("Made-up recall for this test");
  // Lifting is the tenant's own block only; Medora's rule stays (CAT4).
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
  await expect(page.getByRole("menuitem", { name: "Lift block" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("a clinician sees the products but can't change them", async ({ page }) => {
  await page.goto("/products");
  await page.getByRole("button", { name: /Change tenant/ }).click();
  await page.getByRole("menuitemradio", { name: "Coastal Skin (demo)" }).click();
  await expect(page.getByRole("table", { name: "Products" }).getByRole("row", { name: /Coastal skin cream/ })).toContainText("$69.00");
  await expect(page.getByRole("button", { name: "New product" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Actions for/ })).toHaveCount(0);
});
