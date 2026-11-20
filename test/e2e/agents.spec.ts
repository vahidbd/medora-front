import { expect, test, type Page } from "@playwright/test";

/**
 * Agents in preview mode (docs/decisions/agents.md): settings and the
 * tenant pause, the approvals inbox and agent runs, against the mock API's
 * made-up tenants. At Harbour the preview person is owner; at Northside,
 * medical director. Tests run in parallel against one mock, so each
 * changes only what the others don't read.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const row = (page: Page, table: string, name: string | RegExp) => page.getByRole("table", { name: table }).getByRole("row", { name });

async function switchTenant(page: Page, to: string) {
  await page.getByRole("button", { name: /Change tenant/ }).click();
  await page.getByRole("menuitemradio", { name: to }).click();
  await expect(page.getByRole("button", { name: `Working in ${to}. Change tenant` })).toBeVisible();
}

test("Agents shows each agent, its eval and its limits, and an agent without a passing eval can't be switched on", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/agents");
  await expect(row(page, "Agents", /Support agent/)).toContainText("Passed");
  await expect(row(page, "Agents", /Support agent/)).toContainText("Patients see the name Sam");
  await expect(row(page, "Agents", /Support agent/)).toContainText("of $150.00");
  await expect(row(page, "Agents", /Care coordinator/)).toContainText("Not evaluated");
  await expect(row(page, "Agents", /Clinical copilot/)).toContainText("Out of date");

  await page.getByRole("button", { name: "Change Care coordinator" }).click();
  const sheet = page.getByRole("dialog", { name: "Care coordinator" });
  await expect(sheet.getByRole("switch")).toBeDisabled();
  await expect(sheet.getByText("This version has no eval result yet, so it can't be switched on.")).toBeVisible();
  await expect(sheet.getByText("Arrives with support and CRM.")).toBeVisible();
  await sheet.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Change Support agent" }).click();
  await expect(page.getByRole("dialog", { name: "Support agent" }).getByText("Arrives with billing. Always waits for approval.")).toBeVisible();
  expect(errors).toEqual([]);
});

test("an owner switches the intake agent on, names it and lets it book consults without approval", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/agents");
  await page.getByRole("button", { name: "Change Intake agent" }).click();
  const sheet = page.getByRole("dialog", { name: "Intake agent" });
  await expect(sheet.getByRole("button", { name: "Save" })).toBeDisabled();
  await sheet.getByRole("switch").click();
  await sheet.getByLabel("Name patients see").fill("Ivy");
  await sheet.getByRole("checkbox", { name: /Book the patient's consult/ }).click();
  await expect(sheet.getByText("Runs without approval.")).toBeVisible();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(row(page, "Agents", /Intake agent/)).toContainText("Patients see the name Ivy");

  await page.getByRole("button", { name: "Change Intake agent" }).click();
  await expect(page.getByRole("dialog", { name: "Intake agent" }).getByRole("checkbox", { name: /Book the patient's consult/ })).toBeChecked();
  expect(errors).toEqual([]);
});

test("pausing all agents asks first, and resuming brings them back", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/agents");
  await page.getByRole("button", { name: "Pause all agents" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("their conversations go to your team");
  await confirm.getByRole("button", { name: "Pause all agents" }).click();
  await expect(page.getByText("All agents are paused", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Resume agents" }).click();
  await expect(page.getByText("Agents resumed")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause all agents" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("an owner approves a refund with a change and rejects a booking with a reason", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/approvals");
  const waiting = "Waiting proposals";
  await expect(row(page, waiting, /Refund an order/)).toContainText("Support agent");

  await row(page, waiting, /Refund an order/).getByRole("button", { name: /^Review/ }).click();
  const card = page.getByRole("dialog", { name: "Refund an order" });
  await expect(card.getByLabel("Order id")).toHaveValue("ORD-1042");
  await card.getByLabel("Amount").fill("45");
  await card.getByRole("button", { name: "Approve with changes" }).click();
  await expect(card).toBeHidden();
  await expect(page.getByText("Approved and done")).toBeVisible();
  await expect(row(page, waiting, /Refund an order/)).toHaveCount(0);

  await row(page, waiting, /Book the patient's consult/).getByRole("button", { name: /^Review/ }).click();
  await page.getByRole("dialog", { name: "Book the patient's consult" }).getByRole("button", { name: "Reject" }).click();
  const reject = page.getByRole("dialog", { name: "Reject this proposal?" });
  await reject.getByRole("radio", { name: "Wrong details" }).click();
  await reject.getByRole("button", { name: "Reject proposal" }).click();
  await expect(page.getByText("Nothing waiting for you")).toBeVisible();

  await page.getByRole("tab", { name: "Decided" }).click();
  const decided = "Decided proposals";
  await expect(row(page, decided, /Refund an order/).first()).toContainText("Done");
  await expect(row(page, decided, /Book the patient's consult/).first()).toContainText(/Rejected|Done/);
  await row(page, decided, /Refund an order/).first().getByRole("button", { name: /^See/ }).click();
  const seen = page.getByRole("dialog", { name: "Refund an order" });
  await expect(seen).toContainText("Edited before approving");
  await expect(seen).toContainText("$45.00");
  expect(errors).toEqual([]);
});

test("runs show cost and how they ended; transcripts only for a role that may read them", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/agent-runs");
  await expect(row(page, "Agent runs", /Intake agent/).first()).toContainText("Replied");
  await expect(page.getByRole("table", { name: "Agent runs" })).toContainText("Monthly spend cap reached");
  // The owner's transcripts permission is clinical: without break-glass there is no way in.
  await expect(page.getByRole("button", { name: /^See transcript/ })).toHaveCount(0);

  await switchTenant(page, "Northside Clinic (demo)");
  await expect(row(page, "Agent runs", /Support agent/)).toContainText("The agent handed off");
  await row(page, "Agent runs", /Support agent/).getByRole("button", { name: /^See transcript/ }).click();
  const transcript = page.getByRole("dialog", { name: "Transcript" });
  await expect(transcript.getByRole("list", { name: "Conversation" })).toContainText("Is it normal to feel dizzy");
  await expect(transcript).toContainText("Handed to a person");

  // A medical director sees the agents but can't change them.
  await page.goto("/agents");
  await expect(page.getByRole("button", { name: "See Support agent" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause all agents" })).toHaveCount(0);
  expect(errors).toEqual([]);
});
