import { expect, test, type Page } from "@playwright/test";

/**
 * Clinical reads and sign-off for an owner, who holds those permissions
 * only through break-glass (docs/decisions/admin.md ADM3). These run after
 * every other browser test, one at a time (playwright.config.ts), because
 * break-glass is one state for the preview person across the mock. Each
 * test closes it again.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openBreakGlass(page: Page) {
  await page.getByRole("button", { name: "Break-glass" }).click();
  const dialog = page.getByRole("dialog", { name: "Open break-glass" });
  await dialog.getByLabel("Reason").fill("Covering for the medical director today");
  await dialog.getByRole("button", { name: "Open break-glass" }).click();
  await expect(page.getByText(/Break-glass until \d{2}:\d{2}/)).toBeVisible();
}

async function endBreakGlass(page: Page) {
  await page.getByRole("button", { name: "End break-glass" }).click();
  await expect(page.getByRole("button", { name: "Break-glass" })).toBeVisible();
}

const SUMMARY = "/patients/90000000-0000-4000-8000-000000000001/intakes/92000000-0000-4000-8000-000000000001";

test("an owner opens break-glass to read the prescriber's summary of an intake", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto(SUMMARY);
  await expect(page.getByText("Break-glass needed")).toBeVisible();

  await openBreakGlass(page);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Harbour weight care intake/ })).toContainText("Red flags");
  await expect(page.getByRole("region", { name: /Outcome/ })).toContainText("Gallbladder disease");
  await expect(page.getByRole("region", { name: /Worked out/ })).toContainText("33.9");
  const answers = page.getByRole("region", { name: /Answers/ });
  await expect(answers.getByRole("row", { name: /Do you have any of these/ })).toContainText("Red flag");
  await expect(answers.getByRole("row", { name: /How tall are you/ })).not.toContainText("Red flag");
  await expect(page.getByRole("region", { name: /Earlier hard stops/ })).toContainText("BMI under 27");

  // From the patient's record, a finished intake links to its summary while break-glass is open.
  await page.getByRole("link", { name: "Open patient" }).click();
  await page.getByRole("region", { name: /Intakes/ }).getByRole("row", { name: /Not eligible/ }).getByRole("link", { name: "Harbour weight care" }).click();
  await expect(page.getByRole("heading", { level: 1, name: /Harbour weight care intake/ })).toContainText("Not eligible");
  await expect(page.getByRole("region", { name: /Outcome/ })).toContainText("Stopped: BMI under 27");
  await endBreakGlass(page);
  expect(errors.filter((e) => !e.includes("403"))).toEqual([]);
});

test("an owner opens break-glass to sign off a new protocol's first version", async ({ page }) => {
  const errors = collectErrors(page);
  const name = `Signed weight care ${Math.random().toString(36).slice(2, 8)}`;
  await page.goto("/protocols");
  await page.getByRole("button", { name: "New protocol" }).click();
  const sheet = page.getByRole("dialog", { name: "New protocol" });
  await sheet.getByRole("combobox", { name: /Template/ }).click();
  await page.getByRole("option", { name: "Weight management" }).click();
  await sheet.getByLabel(/^Name/).fill(name);
  await sheet.getByRole("button", { name: "Start draft" }).click();
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(name) })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign off draft" })).toHaveCount(0);

  await openBreakGlass(page);
  await page.getByRole("button", { name: "Sign off draft" }).click();
  const drawer = page.getByRole("dialog", { name: "Sign off version 1" });
  await expect(drawer.getByRole("button", { name: "Sign off" })).toBeDisabled();
  await drawer.getByLabel(/Your Ahpra registration/).fill("med0001234567");
  await drawer.getByRole("checkbox").check();
  await expect(drawer).toContainText(`version 1 of the protocol "${name}"`);
  await drawer.getByRole("button", { name: "Sign off" }).click();
  await expect(drawer).toBeHidden();
  await expect(page.getByRole("table", { name: "Versions" }).getByRole("row", { name: /^1\b/ })).toContainText("Live");
  await endBreakGlass(page);
  expect(errors).toEqual([]);
});
