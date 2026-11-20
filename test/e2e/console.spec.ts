import { expect, test, type Page } from "@playwright/test";

/**
 * The staff console in preview mode: signed in as the preview owner, with
 * made-up tenants from the mock API (dev/mock-api/server.mjs).
 */

/** Console errors, which include every content security policy refusal. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("Home shows the tenant and role, under a nonce policy, with no errors", async ({ page }) => {
  const errors = collectErrors(page);
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await expect(page.getByText("Working in Harbour Health (demo)")).toBeVisible();
  await expect(page.locator("dl.facts")).toContainText("Owner");
  await expect(page).toHaveTitle("Home · Medora");

  const headers = response!.headers();
  const policy = headers["content-security-policy"] ?? "";
  const nonce = /'nonce-([^']+)'/.exec(policy)?.[1];
  expect(nonce, "the policy carries a nonce").toBeTruthy();
  expect(policy).toContain("'strict-dynamic'");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(headers["x-frame-options"]).toBe("DENY");
  expect(headers["x-content-type-options"]).toBe("nosniff");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-powered-by"]).toBeUndefined();

  // Every script on the page carries this response's nonce, or the browser would have refused it.
  const scripts = await page.locator("script").evaluateAll((nodes) => nodes.map((node) => (node as HTMLScriptElement).nonce));
  expect(scripts.length).toBeGreaterThan(0);
  expect(scripts.every((value) => value === nonce)).toBe(true);
  expect(errors).toEqual([]);
});

test("each page load gets a new nonce", async ({ request }) => {
  const nonceOf = async () => /'nonce-([^']+)'/.exec((await request.get("/home")).headers()["content-security-policy"] ?? "")?.[1];
  const [first, second] = [await nonceOf(), await nonceOf()];
  expect(first).toBeTruthy();
  expect(first).not.toBe(second);
});

test("switching tenant changes what the console shows, and is remembered", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/home");
  await page.getByRole("button", { name: "Working in Harbour Health (demo). Change tenant" }).click();
  await page.getByRole("menuitemradio", { name: "Coastal Skin (demo)" }).click();
  await expect(page.getByText("Working in Coastal Skin (demo)")).toBeVisible();
  await expect(page.locator("dl.facts")).toContainText("Clinician");

  await page.reload();
  await expect(page.getByText("Working in Coastal Skin (demo)")).toBeVisible();
  expect(errors).toEqual([]);
});

test("Staff lists the tenant's people, roles and access", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/home");
  // A group opens its own column of screens, the way the kit's sidebar does.
  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Workspace" }).click();
  await page.getByRole("navigation", { name: "Workspace" }).getByRole("link", { name: "Staff" }).click();
  await expect(page).toHaveURL(/\/staff$/);
  const table = page.getByRole("table");
  await expect(table.getByRole("row", { name: /Sam Lee/ })).toContainText("Clinician");
  await expect(table.getByRole("row", { name: /Drew Walker/ })).toContainText("Paused");
  expect(errors).toEqual([]);
});

test("the command bar opens with Ctrl+K and goes to a screen", async ({ page }) => {
  await page.goto("/home");
  await expect(page.getByRole("heading", { name: "Home", level: 1 })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const bar = page.getByRole("dialog", { name: "Command bar" });
  await expect(bar).toBeVisible();
  await page.keyboard.type("staff");
  await page.keyboard.press("Enter");
  await expect(bar).toBeHidden();
  await expect(page).toHaveURL(/\/staff$/);
});

test("the relay refuses a tenant that isn't an id, before it reaches the API", async ({ request }) => {
  const response = await request.get("/api/backend/staff", { headers: { "x-medora-tenant": "not-a-tenant" } });
  expect(response.status()).toBe(400);
  expect((await response.json()).error.code).toBe("bad_request");
});

test("the health checks answer without a session", async ({ request }) => {
  const live = await request.get("/api/health/live");
  expect(live.status()).toBe(200);
  expect(await live.json()).toMatchObject({ status: "ok" });

  const health = await request.get("/api/health");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: "ok", app: "ok", api: "ok", database: "ok" });
});
