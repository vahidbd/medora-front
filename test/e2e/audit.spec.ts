import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

/**
 * The audit log in preview mode (docs/decisions/admin.md ADM25 to ADM27),
 * against the mock API's made-up Harbour Health entries, where the preview
 * person is owner. Tests run in parallel against one mock and exports add
 * entries, so no test counts more than the first page.
 */

/** Errors on the page, and any answer that isn't a refusal. */
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

test("the audit log lists who did what, newest first, a page at a time", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/home");
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Workspace" }).click();
  await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Audit log" }).click();
  await expect(page).toHaveURL(/\/audit$/);

  const table = page.getByRole("table", { name: "Audit log" });
  await expect(table.getByRole("row", { name: /product\.blocked/ })).toContainText("Alex Morgan");
  await expect(table.getByRole("row", { name: /membership\.status_changed/ })).toContainText("Medora");
  await expect(table.getByRole("row", { name: /Agent/ }).first()).toContainText("changed: name");
  await expect(page.getByText("Entries 1 to 50")).toBeVisible();

  await page.getByRole("button", { name: "Older entries" }).click();
  await expect(page.getByText(/^Entries 51 to/)).toBeVisible();
  await page.getByRole("button", { name: "Newer entries" }).click();
  await expect(page.getByText("Entries 1 to 50")).toBeVisible();
  await expect(page.getByRole("button", { name: "Newer entries" })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("filters narrow the log, show as pills, and come off one at a time", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/audit");
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet.getByLabel("Action").fill("product.");
  await sheet.getByRole("button", { name: "Apply filters" }).click();
  await expect(sheet).toBeHidden();

  const pills = page.getByRole("group", { name: "Filters set" });
  await expect(pills).toContainText("Action product.");
  const actions = page.getByRole("table", { name: "Audit log" }).locator("tbody tr td:nth-child(3) .cell-mono");
  await expect(actions.first()).toHaveText(/^product\./);
  for (const text of await actions.allTextContents()) expect(text).toMatch(/^product\./);

  // Dates: the end before the start is refused in the drawer.
  await page.getByRole("button", { name: /^Filters/ }).click();
  await sheet.getByLabel("From").fill("20/11/2026");
  await sheet.getByLabel("To").fill("01/11/2026");
  await sheet.getByRole("button", { name: "Apply filters" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("The end date is before the start date.");
  await sheet.getByLabel("Action").fill("nothing.");
  await sheet.getByLabel("To").fill("");
  await sheet.getByLabel("From").fill("");
  await sheet.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.getByText("No entries match these filters")).toBeVisible();

  await pills.getByRole("button", { name: "Remove the action filter" }).click();
  await expect(pills).toHaveCount(0);
  await expect(page.getByRole("table", { name: "Audit log" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("an export saves a CSV file of what the filters match, and is itself in the log", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/audit");
  await page.getByRole("button", { name: /^Filters/ }).click();
  const sheet = page.getByRole("dialog", { name: "Filters" });
  await sheet.getByLabel("Action").fill("tenant.");
  await sheet.getByRole("button", { name: "Apply filters" }).click();

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^audit-log-\d{4}-\d{2}-\d{2}\.csv$/);
  const text = await readFile((await file.path())!, "utf8");
  const lines = text.replace(/^﻿/, "").trimEnd().split("\r\n");
  expect(lines[0]).toBe("Time (UTC),Who,Actor type,Actor id,Action,Zone,Record table,Record id,Request id,Details");
  expect(lines.length).toBeGreaterThan(1);
  for (const line of lines.slice(1)) expect(line).toContain(",tenant.changed,");
  await expect(page.getByText("Audit log exported")).toBeVisible();

  await page.getByRole("group", { name: "Filters set" }).getByRole("button", { name: "Clear all" }).click();
  await expect(
    page
      .getByRole("table", { name: "Audit log" })
      .getByRole("row", { name: /audit\.exported/ })
      .first(),
  ).toContainText("Alex Morgan");
  expect(errors).toEqual([]);
});

test("a role without audit:read doesn't see the audit log", async ({ page }) => {
  await page.goto("/audit");
  await expect(page.getByRole("table", { name: "Audit log" })).toBeVisible();
  await page.getByRole("button", { name: /Change tenant/ }).click();
  await page.getByRole("menuitemradio", { name: "Coastal Skin (demo)" }).click();
  await expect(page.getByText("Your role can't read the audit log")).toBeVisible();
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Workspace" }).click();
  await expect(page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Audit log" })).toHaveCount(0);
});
