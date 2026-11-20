import { expect, test, type Page } from "@playwright/test";

/**
 * Staff access in preview mode (docs/decisions/admin.md): invitations,
 * role and access changes, custom roles and break-glass, against the mock
 * API's made-up Harbour Health tenant, where the preview person is owner.
 * Tests run in parallel against one mock, so each uses its own people.
 */

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

const staffRow = (page: Page, name: string | RegExp) => page.getByRole("table").getByRole("row", { name });

async function openRowMenu(page: Page, name: string) {
  await page.getByRole("button", { name: `Actions for ${name}` }).click();
}

test("Staff shows invitations, expired invitations and end dates", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/staff");
  await expect(staffRow(page, /Avery Kim/)).toContainText("Invited");
  await expect(staffRow(page, /quinn\.harper@example\.test/)).toContainText("Invitation expired");
  await expect(staffRow(page, /Robin Ellis/)).toContainText(/Ends \d{1,2} \w{3} \d{4}/);
  await expect(staffRow(page, /Blake Young/)).toContainText("Weekend support");
  // Your own row offers only your sign-in history: nobody changes their own role.
  await openRowMenu(page, "Alex Morgan");
  await expect(page.getByRole("menuitem")).toHaveText(["Sign-in history"]);
  await page.getByRole("menuitem", { name: "Sign-in history" }).click();
  const sheet = page.getByRole("dialog", { name: "Sign-in history" });
  await expect(sheet.getByRole("row", { name: /Safari on macOS/ }).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("an owner invites someone, resends and withdraws the invitation", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/staff");
  await page.getByRole("button", { name: "Invite staff" }).click();
  const sheet = page.getByRole("dialog", { name: "Invite staff" });
  await sheet.getByLabel("Email").fill("parker.lane@example.test");
  await sheet.getByLabel("Name").fill("Parker Lane");
  await sheet.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: "Operations" }).click();
  await expect(sheet.getByText("Orders, shipments and stock.")).toBeVisible();
  await sheet.getByRole("button", { name: "Send invitation" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByText("Invitation sent", { exact: true })).toBeVisible();
  await expect(staffRow(page, /Parker Lane/)).toContainText("Invited");

  await openRowMenu(page, "Parker Lane");
  await page.getByRole("menuitem", { name: "Resend invitation" }).click();
  await expect(page.getByText("Invitation sent again")).toBeVisible();

  await openRowMenu(page, "Parker Lane");
  await page.getByRole("menuitem", { name: "Withdraw invitation" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Withdraw invitation" }).click();
  await expect(staffRow(page, /Parker Lane/)).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("an owner changes a staff member's role and pauses them", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/staff");
  await openRowMenu(page, "Riley Chen");
  await page.getByRole("menuitem", { name: "Change role and access" }).click();
  const sheet = page.getByRole("dialog", { name: "Change role and access" });
  await sheet.getByRole("combobox", { name: "Role" }).click();
  await page.getByRole("option", { name: "Finance" }).click();
  await sheet.getByRole("radio", { name: /Paused/ }).click();
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expect(staffRow(page, /Riley Chen/)).toContainText("Finance");
  await expect(staffRow(page, /Riley Chen/)).toContainText("Paused");
  expect(errors).toEqual([]);
});

test("a refusal shows the API's reason in the sheet, which keeps what was typed", async ({ page }) => {
  await page.goto("/roles");
  await page.getByRole("button", { name: "New role" }).click();
  const sheet = page.getByRole("dialog", { name: "New role" });
  await sheet.getByLabel("Name").fill("Weekend support");
  await sheet.getByRole("button", { name: "Create role" }).click();
  await expect(sheet.getByRole("alert")).toHaveText("Another role already has that name");
  await expect(sheet.getByLabel("Name")).toHaveValue("Weekend support");
});

test("a clinician sees the staff but can't invite or change anyone", async ({ page }) => {
  await page.goto("/staff");
  await page.getByRole("button", { name: /Change tenant/ }).click();
  await page.getByRole("menuitemradio", { name: "Coastal Skin (demo)" }).click();
  await expect(staffRow(page, /Morgan Brooks/)).toContainText("Owner");
  await expect(page.getByRole("button", { name: "Invite staff" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Actions for Morgan Brooks" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Break-glass" })).toHaveCount(0);
});

test("an owner copies a starting role into a custom role, edits it and deletes it", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/roles");
  await expect(page.getByRole("table", { name: "Starting roles" }).getByRole("row", { name: /Prescriber/ })).toContainText("Clinical");

  await openRowMenu(page, "Finance");
  await page.getByRole("menuitem", { name: "Copy to a new role" }).click();
  const sheet = page.getByRole("dialog", { name: "New role" });
  await sheet.getByLabel("Name").fill("Billing lead");
  await sheet.getByLabel("Description").fill("Finance, plus inviting staff.");
  await sheet.getByRole("checkbox", { name: "Invite staff and change their roles" }).click();
  await sheet.getByRole("button", { name: "Create role" }).click();
  await expect(sheet).toBeHidden();
  const custom = page.getByRole("table", { name: "Custom roles" });
  await expect(custom.getByRole("row", { name: /Billing lead/ })).toContainText("Finance");

  await openRowMenu(page, "Billing lead");
  await page.getByRole("menuitem", { name: "Edit role" }).click();
  const edit = page.getByRole("dialog", { name: "Edit Billing lead" });
  await edit.getByLabel("Name").fill("Billing team lead");
  await edit.getByRole("button", { name: "Save role" }).click();
  await expect(custom.getByRole("row", { name: /Billing team lead/ })).toBeVisible();

  await openRowMenu(page, "Billing team lead");
  await page.getByRole("menuitem", { name: "Delete role" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete role" }).click();
  await expect(custom.getByRole("row", { name: /Billing team lead/ })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a role in use can't be deleted", async ({ page }) => {
  await page.goto("/roles");
  await openRowMenu(page, "Weekend support");
  await page.getByRole("menuitem", { name: "Delete role" }).click();
  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toContainText("1 staff member still has this role");
  await expect(confirm.getByRole("button", { name: "Delete role" })).toBeDisabled();
});

test("break-glass opens with a reason, shows until when, and ends", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/home");
  await page.getByRole("button", { name: "Break-glass" }).click();
  const dialog = page.getByRole("dialog", { name: "Open break-glass" });
  await expect(dialog.getByRole("button", { name: "Open break-glass" })).toBeDisabled();
  await dialog.getByLabel("Reason").fill("Looking into incident 4 for the medical director");
  await dialog.getByRole("button", { name: "Open break-glass" }).click();
  await expect(page.getByText(/Break-glass until \d{2}:\d{2}/)).toBeVisible();
  await page.getByRole("button", { name: "End break-glass" }).click();
  await expect(page.getByText("Break-glass ended")).toBeVisible();
  await expect(page.getByRole("button", { name: "Break-glass" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a reviewer marks someone else's break-glass reviewed", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/break-glass");
  const row = page.getByRole("row", { name: /jamie\.ross@example\.test/ });
  await expect(row).toContainText("Looking into complaint 2");
  await row.getByRole("button", { name: "Mark reviewed" }).click();
  const dialog = page.getByRole("dialog", { name: "Mark reviewed" });
  await dialog.getByLabel("Note").fill("Matches the complaint file");
  await dialog.getByRole("button", { name: "Mark reviewed" }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole("tab", { name: "All" }).click();
  await expect(page.getByRole("row", { name: /jamie\.ross@example\.test/ })).toContainText("Reviewed");
  expect(errors).toEqual([]);
});
