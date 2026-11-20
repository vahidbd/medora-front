import { expect, test, type Page } from "@playwright/test";
import { collectErrors, fieldError, onBrandHosts, signedIn, unexpected } from "./patient-support";

/**
 * Progress and check-ins (docs/decisions/patient-app.md APP10 to APP12),
 * on Jamie's made-up history at Kestrel (dev/mock-api/tracking.mjs): four
 * weekly weights, two waists and a check-in a week ago. Each sign-in starts
 * from that history.
 */

test.use(onBrandHosts);

const card = (page: Page, title: string) => page.locator("section.pt-card").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

test("Progress shows each measurement the program asks for over time, and a new reading joins it", async ({ page }) => {
  await signedIn(page);
  // From here on: the sign-in's own refusals (the date of birth asked for) are behind us.
  const errors = collectErrors(page);
  await page.getByRole("navigation", { name: "Your care" }).getByRole("link", { name: "Progress" }).click();
  await expect(page.getByRole("heading", { name: "Your progress", level: 1 })).toBeVisible();

  const weight = card(page, "Weight");
  await expect(weight.locator(".pt-stat strong")).toHaveText("91.8 kg");
  await expect(weight.getByText(/^Down 2\.2 kg since \d{1,2} [A-Z][a-z]{2}$/)).toBeVisible();
  await expect(card(page, "Waist").locator(".pt-stat strong")).toHaveText("102.5 cm");

  // The keyboard walks the readings; the readout says each one.
  const chart = weight.getByRole("group", { name: /^Weight over time: 4 readings from/ });
  await chart.focus();
  await expect(weight.locator(".pt-chart-tip strong")).toHaveText("91.8 kg");
  await page.keyboard.press("ArrowLeft");
  await expect(weight.locator(".pt-chart-tip strong")).toHaveText("92.6 kg");
  await page.keyboard.press("Home");
  await expect(weight.locator(".pt-chart-tip strong")).toHaveText("94.0 kg");

  // Every value is in the table too.
  await weight.getByText("See every reading").click();
  await expect(weight.getByRole("table").getByRole("row")).toHaveCount(5);

  const record = card(page, "Record a measurement");
  await record.getByRole("button", { name: "Save" }).click();
  await expect(fieldError(page)).toHaveText("Enter at least one reading.");
  await record.getByLabel("Weight (kg)").fill("920");
  await record.getByRole("button", { name: "Save" }).click();
  await expect(fieldError(page)).toHaveText("One of those readings doesn't look right. Check the number and its unit.");
  await record.getByLabel("Weight (kg)").fill("90.9");
  await record.getByRole("button", { name: "Save" }).click();
  await expect(record.getByRole("status")).toHaveText("Saved. Your care team can see it.");
  await expect(weight.locator(".pt-stat strong")).toHaveText("90.9 kg");
  await expect(weight.getByRole("group", { name: /^Weight over time: 5 readings from/ })).toBeVisible();
  await expect(record.getByLabel("Weight (kg)")).toHaveValue("");
  expect(unexpected(errors, 400)).toEqual([]);
});

test("a side effect is sent in the patient's words, and a severe one says to call 000", async ({ page }) => {
  await signedIn(page, "/progress");
  const errors = collectErrors(page);
  const effects = card(page, "Side effects");
  await expect(effects.getByText("You haven't reported any side effects.")).toBeVisible();
  await effects.getByRole("button", { name: "Report a side effect" }).click();
  await expect(effects.getByText(/^A report doesn't reach anyone straight away\./)).toBeVisible();

  await effects.getByRole("radio", { name: /^Severe/ }).click();
  await expect(effects.getByRole("note")).toContainText("If it can't wait, call 000 now");
  await effects.getByRole("button", { name: "Send report" }).click();
  await expect(fieldError(page)).toHaveText("Say what's happening, in your own words.");

  await effects.getByLabel("What's happening?").fill("Made-up words for a test");
  await effects.getByRole("button", { name: "Send report" }).click();
  await expect(effects.getByRole("status")).toContainText("Report sent. Your care team will look at it.");
  await expect(effects.getByRole("status").getByRole("note")).toContainText("call 000 now");
  const reported = effects.getByRole("list", { name: "Side effects you've reported" }).getByRole("listitem");
  await expect(reported).toHaveCount(1);
  await expect(reported.first()).toContainText("Made-up words for a test");
  await expect(reported.first()).toContainText(/^Made-up words for a testSevere, reported \d{1,2} [A-Z][a-z]{2} \d{4}$/);
  expect(unexpected(errors)).toEqual([]);
});

test("a check-in is written whole, and Home then says when the next is due", async ({ page }) => {
  await signedIn(page);
  const errors = collectErrors(page);
  const next = card(page, "What's next");
  await expect(next.getByText("Your check-in is due")).toBeVisible();
  await next.getByRole("link", { name: "Check in" }).click();
  await expect(page.getByRole("heading", { name: "Check in", level: 1 })).toBeVisible();
  await expect(card(page, "Your check-ins").getByRole("listitem")).toHaveCount(1);

  await page.getByRole("button", { name: "Send check-in" }).click();
  await expect(fieldError(page)).toHaveText("Say whether you've missed any doses.");
  await page.getByRole("radio", { name: "No, none" }).click();
  await page.getByRole("radio", { name: "Good", exact: true }).click();
  await page.getByLabel("Weight (kg)").fill("90.5");
  await page.getByRole("radio", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Send check-in" }).click();

  const thanks = page.getByRole("heading", { name: "Thanks, Jamie" });
  await expect(thanks).toBeFocused();
  await expect(page.getByText(/^Your check-in is with your care team\. Your next one is due [A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}\.$/)).toBeVisible();
  const listed = card(page, "Your check-ins").getByRole("listitem");
  await expect(listed).toHaveCount(2);
  await expect(listed.first()).toContainText("Feeling: Good, No missed doses, 1 measurement");

  await page.getByRole("link", { name: "Back to Home" }).click();
  await expect(card(page, "What's next").getByText("Your next check-in")).toBeVisible();
  await expect(card(page, "Your progress").getByText("90.5 kg")).toBeVisible();
  expect(unexpected(errors)).toEqual([]);
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("Progress and the check-in fit the screen", async ({ page }) => {
    await signedIn(page, "/progress");
    await expect(card(page, "Weight").locator(".pt-chart svg")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    await page.getByRole("link", { name: "Check in" }).first().click();
    await expect(page.getByRole("heading", { name: "Check in", level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });
});
