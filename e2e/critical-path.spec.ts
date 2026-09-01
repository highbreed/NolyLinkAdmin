import { test, expect } from "@playwright/test";

/**
 * The one critical end-to-end path from the build's acceptance criteria: login → dashboard →
 * register customer → create connector → view secret-once panel → suspend customer → see
 * blocked banner → reactivate. Runs against the production build served by `vite preview`,
 * with MSW mocks enabled (the default — see docs/frontend_README.md), so it never depends on
 * a live backend.
 */
test("login, register a customer, create a connector, suspend, see the blocked banner, then reactivate", async ({ page }) => {
  await page.goto("/login");

  await page.getByLabel(/^username$/i).fill("amina");
  await page.getByLabel(/^password$/i).fill("e2e-test-password");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

  await page.getByRole("link", { name: "Customers" }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await page.getByRole("button", { name: /register customer/i }).click();

  await page.getByLabel(/customer name/i).fill("Playwright E2E Customer");
  // No branches added — onboarding with zero branches is valid (branches can be added later),
  // and per-branch REGISTERED/FAILED display is covered by CustomerNewPage.test.tsx already.
  await page.getByRole("button", { name: /^onboard customer$/i }).click();

  await expect(page.getByText(/customer onboarded/i)).toBeVisible();
  await page.getByRole("button", { name: /continue to connectors/i }).click();

  // Customer creation itself returns no secret — that only happens when a connector is
  // created under it, on the Connectors tab this navigates to next.
  await expect(page).toHaveURL(/\/customers\/.+\?tab=connectors/);
  await expect(page.getByText("Playwright E2E Customer")).toBeVisible();

  await page.getByRole("button", { name: /new connector/i }).click();
  await page.getByLabel(/^name$/i).fill("Playwright connector");
  await page.getByRole("button", { name: /^create connector$/i }).click();

  await expect(page.getByText(/copy this connector secret now/i)).toBeVisible();
  const secretText = await page.getByTestId("client-secret-value").textContent();
  expect(secretText).toMatch(/^secret_/);

  // A brand-new customer has no subscription yet, so the suspend flow below targets the fixed
  // fixture customer instead, which already has an ACTIVE subscription to suspend. Navigated to
  // via in-app link click (not page.goto) since the session is held in memory only and would
  // be lost on a hard page load — by design, see docs/frontend_README.md.
  await page.getByRole("link", { name: "Customers" }).click();
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
