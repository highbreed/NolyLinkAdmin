import { test, expect } from "@playwright/test";

/**
 * The one critical end-to-end path from the build's acceptance criteria: login → dashboard →
 * create client → view secret-once panel → suspend client → see blocked banner → reactivate.
 * Runs against the production build served by `vite preview`, with MSW mocks enabled (the
 * default — see docs/frontend_README.md), so it never depends on a live backend.
 */
test("login, register a client, suspend it, see the blocked banner, then reactivate", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel(/^username$/i).fill("amina");
  await page.getByLabel(/^password$/i).fill("e2e-test-password");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "Clients" }).click();
  await expect(page).toHaveURL(/\/clients$/);
  await page.getByRole("button", { name: /register client/i }).click();

  await page.getByLabel(/client name/i).fill("Playwright E2E Client");
  await page.getByRole("button", { name: /^create client$/i }).click();

  await expect(page.getByText(/copy this client secret now/i)).toBeVisible();
  const secretText = await page.getByTestId("client-secret-value").textContent();
  expect(secretText).toMatch(/^secret_/);

  await page.getByRole("button", { name: /go to client/i }).click();
  await expect(page).toHaveURL(/\/clients\/.+/);
  await expect(page.getByText("Playwright E2E Client")).toBeVisible();

  // A brand-new client has no subscription yet, so the suspend flow below targets the fixed
  // fixture client instead, which already has an ACTIVE subscription to suspend. Navigated to
  // via in-app link click (not page.goto) since the session is held in memory only and would
  // be lost on a hard page load — by design, see docs/frontend_README.md.
  await page.getByRole("link", { name: "Clients" }).click();
  await page.getByText("Jitihada Traders Ltd").click();
  await expect(page.getByText("Jitihada Traders Ltd")).toBeVisible();

  await page.getByRole("button", { name: /^suspend$/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(/reason \(required\)/i).fill("Playwright e2e suspension");
  await dialog.getByRole("button", { name: "Suspend" }).click();

  await expect(page.getByRole("alert").filter({ hasText: /blocked from KRA fiscalization/i })).toBeVisible();
  await expect(page.getByText(/manually suspended/i)).toBeVisible();

  await page.getByRole("button", { name: /^reactivate$/i }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Reactivate" }).click();

  await expect(page.getByRole("alert").filter({ hasText: /blocked from KRA fiscalization/i })).toHaveCount(0);
});
