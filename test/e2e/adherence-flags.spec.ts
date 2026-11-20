import { expect, test, type Page } from "@playwright/test";
import { collectErrors, unexpected } from "./patient-support";

/**
 * Adherence flags in the console (docs/decisions/adherence.md in
 * medora-backend), against the mock's made-up patients at Coastal Skin
 * (demo), where the preview person is a clinician. Tests run in parallel
 * against one mock, so each acts on its own patient.
 */
const COASTAL = "10000000-0000-4000-8000-000000000002";

async function flagsAtCoastal(page: Page) {
  await page.addInitScript((tenantId) => window.localStorage.setItem("medora:tenant", tenantId), COASTAL);
  await page.goto("/adherence-flags");
  await expect(page.getByRole("button", { name: "Working in Coastal Skin (demo). Change tenant" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Adherence flags", level: 1 })).toBeVisible();
}

const rowOf = (page: Page, patient: string) => page.getByRole("row", { name: new RegExp(patient) });

test("open adherence flags come urgent first, without the patient's words, which opening one shows", async ({ page }) => {
  const errors = collectErrors(page);
  await flagsAtCoastal(page);
  await expect(page).toHaveTitle("Adherence flags · Medora");
  await expect(rowOf(page, "Charlie Rivers")).toContainText("Urgent");
  await expect(rowOf(page, "Eli Stone")).toContainText("Soon");
  const names = await page.getByRole("row").allInnerTexts();
  const at = (patient: string) => names.findIndex((text) => text.includes(patient));
  expect(at("Charlie Rivers")).toBeLessThan(at("Eli Stone"));
  await expect(page.getByRole("table")).not.toContainText("Vomiting");

  await page.getByRole("button", { name: "Review the adherence flag for Charlie Rivers" }).click();
  const sheet = page.getByRole("dialog", { name: "Charlie Rivers" });
  await expect(sheet.getByText("Vomiting since last night and I can't keep water down.")).toBeVisible();
  await expect(sheet.getByText("Severe", { exact: true })).toBeVisible();
  await expect(sheet.getByText(/by the patient$/)).toBeVisible();
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await expect(sheet).toHaveCount(0);
  expect(unexpected(errors)).toEqual([]);
});

test("a clinician resolves an adherence flag with what was done, and it moves to Resolved", async ({ page }) => {
  const errors = collectErrors(page);
  await flagsAtCoastal(page);
  await page.getByRole("button", { name: "Review the adherence flag for Dana Fox" }).click();
  const sheet = page.getByRole("dialog", { name: "Dana Fox" });
  await expect(sheet.getByText("Sharp pain high in my stomach that goes through to my back.")).toBeVisible();
  await sheet.getByRole("button", { name: "Resolve" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Choose what was done.");
  await sheet.getByRole("radio", { name: /Referred to a prescriber/ }).click();
  await sheet.getByLabel("Note").fill("Passed to the prescriber on duty.");
  await sheet.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("Adherence flag resolved")).toBeVisible();
  await expect(rowOf(page, "Dana Fox")).toHaveCount(0);

  await page.getByRole("tab", { name: "Resolved" }).click();
  await expect(rowOf(page, "Dana Fox")).toContainText("Referred to a prescriber");
  await expect(rowOf(page, "Dana Fox")).toContainText("Alex Morgan");
  await page.getByRole("button", { name: "View the adherence flag for Dana Fox" }).click();
  await expect(page.getByRole("dialog", { name: "Dana Fox" }).getByText("Passed to the prescriber on duty.")).toBeVisible();
  expect(unexpected(errors)).toEqual([]);
});

test("a mistaken resolution is reopened once, after asking, as a new open adherence flag that keeps the old one", async ({ page }) => {
  const errors = collectErrors(page);
  await flagsAtCoastal(page);
  await page.getByRole("tab", { name: "Resolved" }).click();
  await page.getByRole("button", { name: "View the adherence flag for Gale Turner" }).click();
  const sheet = page.getByRole("dialog", { name: "Gale Turner" });
  await expect(sheet.getByText("Booked a review")).toBeVisible();
  await sheet.getByRole("button", { name: "Reopen" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Reopen this adherence flag?" });
  await confirm.getByRole("button", { name: "Reopen" }).click();
  await expect(page.getByText("Adherence flag reopened")).toBeVisible();

  // The sheet now shows the new, open adherence flag, with what was done before.
  await expect(sheet.getByRole("region", { name: "Resolved before, then reopened" })).toContainText("Booked a video review for Thursday.");
  await expect(sheet.getByRole("button", { name: "Resolve" })).toBeVisible();
  await sheet.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("tab", { name: "Open" }).click();
  await expect(rowOf(page, "Gale Turner")).toContainText("Reopened");

  // The old one stays resolved, and offers its reopening instead of a second one.
  await page.getByRole("tab", { name: "Resolved" }).click();
  await page.getByRole("button", { name: "View the adherence flag for Gale Turner" }).click();
  await expect(sheet.getByText("Reopened as a new adherence flag.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Reopen", exact: true })).toHaveCount(0);
  await sheet.getByRole("button", { name: "View the reopened adherence flag" }).click();
  await expect(sheet.getByRole("button", { name: "Resolve" })).toBeVisible();
  expect(unexpected(errors)).toEqual([]);
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the list and an adherence flag fit the screen", async ({ page }) => {
    await flagsAtCoastal(page);
    await expect(rowOf(page, "Eli Stone")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole("button", { name: "Review the adherence flag for Eli Stone" }).click();
    await expect(page.getByRole("dialog", { name: "Eli Stone" }).getByText("Feeling sick most mornings for the past week.")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
