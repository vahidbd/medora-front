import { expect, test } from "@playwright/test";
import { CODE, LARKSPUR, collectErrors, confirmDateOfBirth, fieldError, onBrandHosts, port, signIn } from "./patient-support";

/** The patient app's frame: brand hosts, sign-in, the date of birth check, Home and Account. */

test.use(onBrandHosts);

test("a brand's host is its patient app: its look, a nonce policy with no tracker, and nothing kept", async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto("/sign-in");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Sign in to Kestrel Health (demo)", level: 1 })).toBeVisible();
  await expect(page).toHaveTitle("Sign in · Kestrel Health (demo)");

  const headers = response!.headers();
  const policy = headers["content-security-policy"] ?? "";
  expect(policy).toMatch(/'nonce-[^']+'/);
  expect(policy).not.toContain("sentry");
  expect(headers["cache-control"]).toBe("no-store");

  // The brand's colour is the page's primary, with ink that reads on it.
  const primary = await page.getByRole("button", { name: "Send code" }).evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(primary).toBe("rgb(15, 118, 110)");
  expect(errors).toEqual([]);
});

test("the patient tree, console paths and hosts that aren't a brand's answer nothing", async ({ page, request }) => {
  expect((await page.goto("/patient/home"))?.status()).toBe(404);
  expect((await page.goto("/staff"))?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  // The console host never serves the patient tree either, and a host that isn't a brand's serves nothing.
  expect((await request.get(`http://127.0.0.1:${port}/patient/sign-in`)).status()).toBe(404);
  expect((await request.get(`http://127.0.0.1:${port}/sign-in`, { headers: { host: `nobody.localhost:${port}` } })).status()).toBe(404);
});

test("a patient signs in by code, confirms their date of birth, and signs out", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/home");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fhome$/);
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(fieldError(page)).toHaveText("Enter your email address, like name@example.com.");

  await page.getByLabel("Email").fill("jamie@example.test");
  await page.getByRole("button", { name: "Send code" }).click();
  await expect(page.getByText("If jamie@example.test can be used here, we've sent it a six-digit code.")).toBeVisible();
  await page.getByLabel("Code").fill("111111");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(fieldError(page)).toHaveText("That code didn't work. Check it, or send a new one.");
  await expect(page.getByLabel("Code")).toBeFocused();
  await page.getByLabel("Code").fill(CODE);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("heading", { name: "Confirm your date of birth" })).toBeVisible();
  await page.getByLabel("Date of birth").fill("15/05/1988");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(fieldError(page)).toHaveText("That date of birth doesn't match your account. Check it and try again.");
  await page.getByLabel("Date of birth").fill("14/05/1988");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening), Jamie$/);
  await expect(page.getByRole("link", { name: "help@kestrel.example.test" })).toBeVisible();

  // The relay on a patient host reaches the patient routes and nothing else.
  const statuses = await page.evaluate(async () => {
    const [mine, staff] = await Promise.all([fetch("/api/backend/patient/me"), fetch("/api/backend/staff")]);
    return { mine: mine.status, staff: staff.status, cache: mine.headers.get("cache-control") };
  });
  expect(statuses).toEqual({ mine: 200, staff: 404, cache: "no-store" });

  await page.getByRole("navigation", { name: "Your care" }).getByRole("link", { name: "Account" }).click();
  await expect(page.getByRole("heading", { name: "Your account", level: 1 })).toBeVisible();
  await expect(page.getByText("14 May 1988")).toBeVisible();
  await page.getByRole("main").getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  await page.goto("/account");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Faccount$/);
  // The API's refusals on the way (the date of birth asked for, then wrong; the console's route) are the browser's only complaints.
  expect(errors.filter((text) => !/^Failed to load resource: the server responded with a status of (403|404)/.test(text))).toEqual([]);
});

test("a new address is signed up, and asked to finish setting up rather than sent back to sign in", async ({ page }) => {
  await signIn(page, "someone.new@example.test");
  await expect(page.getByRole("heading", { name: "Finish setting up your account" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toHaveAttribute("href", "/start");
});

test("a paused brand takes no new patients, in its own colour", async ({ page }) => {
  await page.goto(`${LARKSPUR}/sign-in`);
  await expect(page.getByRole("heading", { name: "Sign in to Larkspur Clinic (demo)" })).toBeVisible();
  const ink = await page.getByRole("button", { name: "Send code" }).evaluate((node) => getComputedStyle(node).color);
  expect(ink).toBe("rgb(10, 10, 10)");

  await page.getByLabel("Email").fill("someone.new@example.test");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Code").fill(CODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Finish setting up your account" })).toBeVisible();
  await expect(page.getByText("Larkspur Clinic (demo) isn't taking new patients at the moment.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toHaveCount(0);
});

test("signing in on one brand is not signing in on another", async ({ page }) => {
  await signIn(page);
  await confirmDateOfBirth(page);
  await expect(page).toHaveURL(/\/home$/);
  await page.goto(`${LARKSPUR}/home`);
  await expect(page).toHaveURL(/larkspur\.localhost:\d+\/sign-in/);
});

test("an idle sign-out says why", async ({ page }) => {
  await page.goto("/sign-in?why=idle");
  await expect(page.getByText("You were signed out after 30 minutes without activity, to keep your details private.")).toBeVisible();
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the sections move to a bar at the bottom", async ({ page }) => {
    await signIn(page);
    await confirmDateOfBirth(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const bar = page.locator("nav.pt-bar");
    await expect(bar).toBeVisible();
    await expect(page.locator("nav.pt-nav-in")).toBeHidden();
    const scrolls = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(scrolls).toBe(false);
    await bar.getByRole("link", { name: "Account" }).click();
    await expect(page.getByRole("heading", { name: "Your account" })).toBeVisible();
  });
});
