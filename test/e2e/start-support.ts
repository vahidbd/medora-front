import { expect, type Page } from "@playwright/test";

/**
 * Starting care on the mock API's made-up programs (dev/mock-api/intake.mjs):
 * Weight care has four steps, with a hard stop on "pregnant: yes" and on
 * "harm: recently"; Sleep care has one step. The people are made up.
 */

export const WEIGHT = "50000000-0000-4000-8000-000000000001";
export const SLEEP = "50000000-0000-4000-8000-000000000002";

/** The first screen before an account, agreed, with a made-up adult's date of birth unless another is given. */
export async function startWeightCare(page: Page, dateOfBirth = "14/05/1990") {
  await page.goto(`/start/${WEIGHT}`);
  await expect(page.getByRole("heading", { name: "Weight care (demo)", level: 1 })).toBeVisible();
  await page.getByRole("checkbox", { name: /I've read the privacy notice/ }).click();
  await page.getByRole("checkbox", { name: "I'm 18 or older." }).click();
  await page.getByLabel("Date of birth").fill(dateOfBirth);
  await page.getByRole("button", { name: "Start" }).click();
}

export async function answerBody(page: Page) {
  await expect(page.getByRole("heading", { name: "Your height and weight", level: 2 })).toBeVisible();
  await page.getByLabel("How tall are you?").fill("170");
  await page.getByLabel("How much do you weigh?").fill("82.5");
  await page.getByRole("button", { name: "Continue" }).click();
}

export async function answerHealth(page: Page) {
  await expect(page.getByRole("heading", { name: "Your health", level: 2 })).toBeVisible();
  await page.getByRole("radio", { name: "No", exact: true }).click();
  await page.getByRole("checkbox", { name: "Sleep apnoea" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Steps 3 and 4 of Weight care, with nothing that stops it. */
export async function answerTheRest(page: Page) {
  await expect(page.getByRole("heading", { name: "Your wellbeing", level: 2 })).toBeVisible();
  await page.getByRole("radio", { name: "Yes, in the past" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Medicines and check-ups", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
}

/** The resume cookie, if this browser holds one. */
export async function heldCookie(page: Page) {
  return (await page.context().cookies()).find((cookie) => cookie.name === "__Host-medora-intake");
}
