import { expect, test, type Page } from "@playwright/test";
import { collectErrors, LARKSPUR, onBrandHosts, port, unexpected } from "./patient-support";

/**
 * Starting care before an account (docs/decisions/patient-start.md): the
 * brand's programs, a program's first screen, its steps, and the screens
 * that end it. The mock API's programs are made up (dev/mock-api/intake.mjs):
 * Weight care has four steps with two hard stops; Sleep care has one step.
 */

test.use(onBrandHosts);

const WEIGHT = "50000000-0000-4000-8000-000000000001";

/** The first screen, agreed and with a made-up adult's date of birth, unless another is given. */
async function startWeightCare(page: Page, dateOfBirth = "14/05/1990") {
  await page.goto(`/start/${WEIGHT}`);
  await expect(page.getByRole("heading", { name: "Weight care (demo)", level: 1 })).toBeVisible();
  await page.getByRole("checkbox", { name: /I've read the privacy notice/ }).click();
  await page.getByRole("checkbox", { name: "I'm 18 or older." }).click();
  await page.getByLabel("Date of birth").fill(dateOfBirth);
  await page.getByRole("button", { name: "Start" }).click();
}

async function answerBody(page: Page) {
  await expect(page.getByRole("heading", { name: "Your height and weight", level: 2 })).toBeVisible();
  await page.getByLabel("How tall are you?").fill("170");
  await page.getByLabel("How much do you weigh?").fill("82.5");
  await page.getByRole("button", { name: "Continue" }).click();
}

async function answerHealth(page: Page) {
  await expect(page.getByRole("heading", { name: "Your health", level: 2 })).toBeVisible();
  await page.getByRole("radio", { name: "No", exact: true }).click();
  await page.getByRole("checkbox", { name: "Sleep apnoea" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
}

test("the brand's programs lead to one, and a paused brand or another tenant's program offers nothing", async ({ page, request }) => {
  const errors = collectErrors(page);
  await page.goto("/start");
  await expect(page).toHaveTitle("Get started · Kestrel Health (demo)");
  await expect(page.getByRole("heading", { name: "Get started with Kestrel Health (demo)", level: 1 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/sign-in?next=%2Fstart");
  const programs = page.getByRole("region", { name: "Programs" }).getByRole("link");
  await expect(programs).toHaveText([/Weight care \(demo\)/, /Sleep care \(demo\)/]);
  await programs.first().click();
  await expect(page).toHaveURL(new RegExp(`/start/${WEIGHT}$`));
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Privacy and your health information" })).toContainText("We keep your answers on this device for 14 days");
  expect(errors).toEqual([]);

  // A paused brand takes no one new, on its chooser and on a program's address, but its patients can still sign in (JOIN9).
  await page.goto(`${LARKSPUR}/start`);
  await expect(page.getByRole("heading", { name: "Larkspur Clinic (demo) isn't taking new patients at the moment" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Already a patient? Sign in" })).toHaveAttribute("href", "/sign-in?next=%2Fhome");
  // Kestrel's program isn't Larkspur's tenant's, and an address that isn't a program is no page.
  const on = (host: string) => ({ headers: { host: `${host}.localhost:${port}` } });
  expect((await request.get(`http://127.0.0.1:${port}/start/${WEIGHT}`, on("larkspur"))).status()).toBe(404);
  expect((await request.get(`http://127.0.0.1:${port}/start/not-a-program`, on("kestrel"))).status()).toBe(404);
});

test("a person agrees, answers each step, comes back to it, and is asked to create an account", async ({ page, context }) => {
  const errors = collectErrors(page);
  const tokenHeaders: string[] = [];
  page.on("response", (response) => {
    if (response.headers()["x-medora-intake-token"]) tokenHeaders.push(response.url());
  });

  await page.goto(`/start/${WEIGHT}`);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "privacy" })).toHaveText("Read the privacy notice and tick to agree, to go on.");
  await expect(page.getByRole("alert").filter({ hasText: "privacy" })).toBeFocused();
  await page.getByRole("checkbox", { name: /I've read the privacy notice/ }).click();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Tick to confirm you're 18 or older.")).toBeVisible();
  await page.getByRole("checkbox", { name: "I'm 18 or older." }).click();
  await page.getByLabel("Date of birth").fill("31/02/1990");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByText("Enter your date of birth as day, month and year, like 14/05/1990.")).toBeVisible();
  await page.getByLabel("Date of birth").fill("14/05/1990");
  await page.getByRole("button", { name: "Start" }).click();

  // Step 1: what's missing, then what the API refuses, each beside its question.
  await expect(page.getByText("Step 1 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Check the answers marked above.")).toBeVisible();
  await expect(page.getByText("Answer this question.")).toHaveCount(2);
  await expect(page.getByLabel("How tall are you?")).toBeFocused();
  await page.getByLabel("How tall are you?").fill("300");
  await page.getByLabel("How much do you weigh?").fill("82.5");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Enter a number from 120 to 230 cm.")).toBeVisible();
  await page.getByLabel("How tall are you?").fill("170");
  await page.getByRole("button", { name: "Continue" }).click();

  // The resume token stays on the server: an httpOnly host-only cookie the page can't read, never a header it sees.
  await expect(page.getByRole("heading", { name: "Your health", level: 2 })).toBeFocused();
  const held = (await context.cookies()).find((cookie) => cookie.name === "__Host-medora-intake");
  expect(held).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/", domain: "kestrel.localhost" });
  expect(await page.evaluate(() => document.cookie)).not.toContain("medora-intake");
  expect(tokenHeaders).toEqual([]);

  // Leaving and coming back picks up where it was left, with the earlier answers kept (JOIN7).
  await page.reload();
  await expect(page.getByText("We kept your earlier answers, so you can carry on.")).toBeVisible();
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("How tall are you?")).toHaveValue("170");
  await expect(page.getByText("Changing an answer here can change the questions that come after it.")).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).click();

  await answerHealth(page);
  await expect(page.getByRole("heading", { name: "Your wellbeing", level: 2 })).toBeVisible();
  await page.getByRole("radio", { name: "Yes, in the past" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Medicines and check-ups", level: 2 })).toBeVisible();
  await expect(page.getByText("Step 4 of 4")).toBeVisible();
  await page.getByLabel(/Which medicines do you take now\?/).fill("  None  ");
  await page.getByRole("button", { name: "Continue" }).click();

  // Every step answered: an account sends them, and signing in comes back here.
  await expect(page.getByRole("heading", { name: "Your answers are ready to send" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create your account" })).toHaveAttribute("href", `/sign-in?next=${encodeURIComponent(`/start/${WEIGHT}`)}`);
  expect(page.url()).toBe(new URL(`/start/${WEIGHT}`, page.url()).toString());

  // Changing an answer walks forward through the finished steps, back to here.
  await page.getByRole("button", { name: "Change your answers" }).click();
  await expect(page.getByLabel("How tall are you?")).toHaveValue("170");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("checkbox", { name: "Sleep apnoea" })).toBeChecked();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByLabel(/Which medicines do you take now\?/)).toHaveValue("None");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Your answers are ready to send" })).toBeVisible();
  // The API's refusals the test asked for (the height out of range) are the browser's only complaints.
  expect(unexpected(errors, 400)).toEqual([]);
});

test("a hard stop ends the intake with urgent help first, and stays ended", async ({ page }) => {
  await startWeightCare(page);
  await answerBody(page);
  await answerHealth(page);
  await page.getByRole("radio", { name: "Yes, recently" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  const stopped = page.getByRole("region", { name: "We can't continue online" });
  await expect(stopped.getByRole("heading", { name: "We can't continue online" })).toBeFocused();
  await expect(stopped.getByRole("note")).toContainText("If you're in danger or need urgent help, call 000.");
  await expect(stopped.getByRole("link", { name: "000", exact: true })).toHaveAttribute("href", "tel:000");
  await expect(stopped.getByRole("link", { name: "13 11 14" })).toHaveAttribute("href", "tel:131114");
  await expect(stopped).toContainText("Please talk to someone today about how you're feeling.");
  await expect(stopped.getByRole("link", { name: "help@kestrel.example.test" })).toBeVisible();
  // Nothing offers a way round it: no way back, no fresh start, and the reason is on the page only.
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(page).toHaveTitle("Get started · Kestrel Health (demo)");

  // It is still the answer on the way back (JOIN4).
  await page.reload();
  await expect(page.getByRole("heading", { name: "We can't continue online" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Start" })).toHaveCount(0);
});

test("a hard stop without urgent help, and a date of birth under 18, each end the intake", async ({ page, browser }) => {
  await startWeightCare(page);
  await answerBody(page);
  await page.getByRole("radio", { name: "Yes", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "We can't continue online" })).toBeVisible();
  await expect(page.getByText("The medicines in this program aren't safe during pregnancy or breastfeeding.")).toBeVisible();
  await expect(page.getByRole("note")).toHaveCount(0);

  // A fresh browser: an under-18 date of birth ends it before any health question.
  const young = await browser.newContext(onBrandHosts);
  const youngPage = await young.newPage();
  await startWeightCare(youngPage, `01/01/${new Date().getFullYear() - 16}`);
  await expect(youngPage.getByRole("heading", { name: "This service is for adults" })).toBeFocused();
  await expect(youngPage.getByText("Kestrel Health (demo) can only treat people aged 18 and over.")).toBeVisible();
  await expect(youngPage.getByText("Step 1 of 4")).toHaveCount(0);
  await young.close();
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the first screen and a step fit the screen", async ({ page }) => {
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    await page.goto(`/start/${WEIGHT}`);
    await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
    expect(await fits()).toBe(true);
    await startWeightCare(page);
    await expect(page.getByText("Step 1 of 4")).toBeVisible();
    expect(await fits()).toBe(true);
  });
});
