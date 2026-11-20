import { expect, test } from "@playwright/test";
import { CODE, collectErrors, confirmDateOfBirth, onBrandHosts, signIn, unexpected } from "./patient-support";
import { answerBody, answerHealth, answerTheRest, heldCookie, SLEEP, startWeightCare, WEIGHT } from "./start-support";

/**
 * Becoming a patient and sending an intake (docs/decisions/patient-start.md
 * JOIN11 to JOIN14): the account after the questions, claiming what the
 * browser started, the care consents, checking the answers and sending them.
 * The people are made up.
 */

test.use(onBrandHosts);

test("a person answers first, makes an account, agrees to the terms, checks their answers and sends them", async ({ page }) => {
  const errors = collectErrors(page);
  await startWeightCare(page);
  await answerBody(page);
  await answerHealth(page);
  await answerTheRest(page);
  await page.getByRole("link", { name: "Create your account" }).click();

  // Signing in with a new address signs up, and comes back to the same program.
  await expect(page).toHaveURL(new RegExp(`/sign-in\\?next=${encodeURIComponent(`/start/${WEIGHT}`)}$`));
  await page.getByLabel("Email").fill("robin.sample@example.test");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Code").fill(CODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(new RegExp(`/start/${WEIGHT}$`));
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();

  // The legal names and date of birth are asked again, never filled in from the answers (JOIN11).
  await expect(page.getByLabel("Date of birth")).toHaveValue("");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Check the details marked above.")).toBeVisible();
  await expect(page.getByText("Enter your given name, as on your ID.")).toBeVisible();
  await expect(page.getByText("Choose an answer.")).toBeVisible();
  await expect(page.getByLabel("Given name")).toBeFocused();
  await page.getByLabel("Given name").fill("Robin");
  await page.getByLabel("Family name").fill("Sample");
  await page.getByLabel("Date of birth").fill("14/05/1990");
  await page.getByRole("radio", { name: "Prefer not to say" }).click();
  await page.getByLabel("Mobile (optional)").fill("0400 12");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter an Australian mobile number, like 0412 345 678.")).toBeVisible();
  await page.getByLabel("Mobile (optional)").fill("");
  await page.getByRole("button", { name: "Create account" }).click();

  // The claim brought the privacy notice the answers were started under; the telehealth terms are still to agree (JOIN13).
  await expect(page.getByRole("heading", { name: "Agree to Kestrel Health (demo)'s telehealth terms" })).toBeFocused();
  expect(await heldCookie(page)).toBeUndefined();
  await expect(page.getByRole("region", { name: "Telehealth terms", exact: true })).toContainText("Telehealth isn't for emergencies.");
  await page.getByRole("button", { name: "Agree and continue" }).click();
  await expect(page.getByText("Read each one and tick to agree, to go on.")).toBeVisible();
  await page.getByRole("checkbox", { name: "I've read the telehealth terms, and I agree to them." }).click();
  await page.getByRole("button", { name: "Agree and continue" }).click();

  // The answers given before the account are the patient's own now, ready to check (JOIN14).
  const review = page.getByRole("region", { name: "Check your answers" });
  await expect(review.getByRole("heading", { name: "Check your answers" })).toBeFocused();
  const health = review.getByRole("region", { name: "Your health" });
  await expect(review.getByRole("region", { name: "Your height and weight" })).toContainText("170 cm");
  await expect(review.getByRole("region", { name: "Your height and weight" })).toContainText("82.5 kg");
  await expect(health).toContainText("Sleep apnoea");
  await expect(review.getByRole("region", { name: "Medicines and check-ups" })).toContainText("Not answered");

  // Changing a step walks on through the ones after it, back to the check.
  await health.getByRole("button", { name: "Change Your health" }).click();
  await expect(page.getByText("Changing an answer here can change the questions that come after it.")).toBeVisible();
  await page.getByRole("checkbox", { name: "High blood pressure" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(review.getByRole("region", { name: "Your health" })).toContainText("High blood pressure, Sleep apnoea");

  await review.getByRole("button", { name: "Send to a clinician" }).click();
  await expect(page.getByRole("heading", { name: "Your answers are with Kestrel Health (demo)" })).toBeFocused();
  await expect(page.getByRole("link", { name: "000" })).toHaveAttribute("href", "tel:000");
  await page.getByRole("link", { name: "Go to Home" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Good (morning|afternoon|evening), Robin$/);
  // The API's refusals on the way (no account yet, the mobile, the new patient's empty claim) are the browser's only complaints.
  expect(unexpected(errors, 400, 403)).toEqual([]);
});

test("signing in claims what this browser started, and the patient carries on where they left off", async ({ page }) => {
  await startWeightCare(page, "14/05/1988");
  await answerBody(page);
  await expect(page.getByRole("heading", { name: "Your health", level: 2 })).toBeVisible();
  expect(await heldCookie(page)).toBeDefined();

  // Signing in anywhere claims it (JOIN12): here, straight to Home.
  await signIn(page, "jamie@example.test", "/home");
  await confirmDateOfBirth(page);
  await expect(page).toHaveURL(/\/home$/);
  await expect.poll(() => heldCookie(page)).toBeUndefined();

  await page.goto(`/start/${WEIGHT}`);
  await expect(page.getByText("Step 2 of 4")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your health", level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expect(page.getByLabel("How tall are you?")).toHaveValue("170");

  // Another program has nothing in progress: the patient chooses to start it.
  await page.goto(`/start/${SLEEP}`);
  await expect(page.getByRole("heading", { name: "A few questions about your health" })).toBeVisible();
  await page.getByRole("button", { name: "Start" }).click();
  await page.getByLabel("How many hours do you sleep on a usual night?").fill("7");
  await page.getByRole("radio", { name: "No", exact: true }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Check your answers" })).toBeVisible();
  await page.getByRole("button", { name: "Send to a clinician" }).click();
  await expect(page.getByRole("heading", { name: "Your answers are with Kestrel Health (demo)" })).toBeVisible();

  // Coming back after sending offers a fresh start, never the sent answers to change.
  await page.reload();
  await expect(page.getByText("You've already sent answers for this program.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Start again" })).toBeVisible();
});

test("a person under 18 can't make an account", async ({ page }) => {
  await page.goto(`/sign-in?next=${encodeURIComponent(`/start/${SLEEP}`)}`);
  await page.getByLabel("Email").fill("young.sample@example.test");
  await page.getByRole("button", { name: "Send code" }).click();
  await page.getByLabel("Code").fill(CODE);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "About you" })).toBeVisible();
  await page.getByLabel("Given name").fill("Kai");
  await page.getByLabel("Family name").fill("Sample");
  await page.getByLabel("Date of birth").fill(`01/01/${new Date().getFullYear() - 16}`);
  await page.getByRole("radio", { name: "Female" }).click();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "This service is for adults" })).toBeFocused();
});
