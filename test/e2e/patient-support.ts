import { expect, type Page } from "@playwright/test";

/**
 * The patient app's browser tests run on the mock API's made-up brands
 * (dev/mock-api/patient.mjs): Kestrel Health (demo), live, at
 * kestrel.localhost, and Larkspur Clinic (demo), paused, at
 * larkspur.localhost. The mock Clerk signs in jamie@example.test, or signs
 * up any other address, with the code 424242.
 */

export const port = new URL(process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${process.env.E2E_PORT || 3100}`).port;
export const KESTREL = `http://kestrel.localhost:${port}`;
export const LARKSPUR = `http://larkspur.localhost:${port}`;
export const CODE = "424242";

/** Every *.localhost name is this machine; the browser is told so, whatever the system resolver says. */
export const onBrandHosts = { baseURL: KESTREL, launchOptions: { args: ["--host-resolver-rules=MAP *.localhost 127.0.0.1"] } };

export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

/** The browser's complaints, less the API's refusals a test asked for. */
export function unexpected(errors: string[], ...statuses: number[]): string[] {
  const refused = new RegExp(`^Failed to load resource: the server responded with a status of (${statuses.join("|")})`);
  return statuses.length ? errors.filter((text) => !refused.test(text)) : errors;
}

/** A field's error, announced as an alert (Next's route announcer is the page's other alert). */
export const fieldError = (page: Page) => page.locator("p[role=alert]");

export async function signIn(page: Page, email = "jamie@example.test", path = "/home") {
  await page.goto(path);
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(path)}$`));
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await page.getByLabel("Code").fill(CODE);
  await page.getByRole("button", { name: "Sign in" }).click();
}

export async function confirmDateOfBirth(page: Page) {
  await expect(page.getByRole("heading", { name: "Confirm your date of birth" })).toBeVisible();
  await page.getByLabel("Date of birth").fill("14/05/1988");
  await page.getByRole("button", { name: "Continue" }).click();
}

/** Signed in as Jamie and past the date of birth check, on a page of the patient app. */
export async function signedIn(page: Page, path = "/home") {
  await signIn(page, "jamie@example.test", path);
  await confirmDateOfBirth(page);
  await expect(page).toHaveURL(new RegExp(`${path.replace(/\//g, "\\/")}$`));
}
