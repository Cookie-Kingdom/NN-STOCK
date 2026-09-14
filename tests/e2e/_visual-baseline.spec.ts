/* Scratch visual baseline for the Tailwind / Atomic refactor. Read-only: signs in,
 * visits every tab route, screenshots. No clicks that write data, no dialogs.
 *
 *   SHOT_DIR=artifacts/visual/after pnpm test:e2e tests/e2e/_visual-baseline.spec.ts
 *
 * Credentials (Supabase email/password) come from env:
 *   E2E_OWNER_EMAIL / E2E_OWNER_PASSWORD
 *   E2E_FOODIVA_EMAIL / E2E_FOODIVA_PASSWORD
 *   E2E_CHEF_EMAIL / E2E_CHEF_PASSWORD
 *   E2E_SALADAENG_EMAIL / E2E_SALADAENG_PASSWORD
 * (loaded from .env.local by playwright.config.ts). A role without credentials is skipped.
 *
 * Excluded from the default suite (testIgnore on `_*.spec.ts`) unless SHOT_DIR or
 * VISUAL=1 is set. Before shots: VISUAL=1 pnpm test:e2e tests/e2e/_visual-baseline.spec.ts */
import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const SHOT_DIR = process.env.SHOT_DIR ?? "artifacts/visual/before";
fs.mkdirSync(SHOT_DIR, { recursive: true });

// Hardcoded (mirrors src/lib/nav.ts at baseline) so before/after cover the same routes.
const ROLES = [
  {
    role: "owner",
    env: "OWNER",
    path: "/owner",
    tabs: [
      "owner-dashboard", "po", "smoke-po", "invoices", "transport", "central-receive",
      "branch-status", "stock", "meat-log", "documents", "report", "history", "config",
    ],
  },
  { role: "foodiva", env: "FOODIVA", path: "/foodiva", tabs: ["foodiva", "history"] },
  { role: "chef", env: "CHEF", path: "/chef", tabs: ["cm-receive", "work", "stock", "history"] },
  { role: "saladaeng", env: "SALADAENG", path: "/branch", tabs: ["day", "stock", "branch-summary", "history"] },
] as const;

test.use({ video: "off", viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial" });

async function settle(page: Page) {
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function shot(page: Page, name: string, width: number) {
  const size = page.viewportSize()!;
  if (size.width !== width) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await settle(page);
  }
  await page.screenshot({
    path: path.join(SHOT_DIR, `${name}-${width}.png`),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    // Next dev overlay badge ("1 Issue") is not part of the UI under test.
    style: "nextjs-portal { display: none !important; }",
  });
}

test("sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
  await settle(page);
  await shot(page, "signin-index", 1440);
  await shot(page, "signin-index", 390);
});

for (const r of ROLES) {
  test(`${r.role} tabs`, async ({ page }) => {
    const email = process.env[`E2E_${r.env}_EMAIL`];
    const password = process.env[`E2E_${r.env}_PASSWORD`];
    test.skip(!email || !password, `missing E2E_${r.env}_EMAIL / E2E_${r.env}_PASSWORD`);

    await page.goto("/");
    await page.getByLabel("อีเมล").fill(email!);
    await page.getByLabel("รหัสผ่าน").fill(password!);
    await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible({ timeout: 30_000 });

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));

    for (const [i, tab] of r.tabs.entries()) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${r.path}/${tab}`);
      await expect(page).toHaveURL(new RegExp(`${r.path}/${tab}`));
      await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
      await settle(page);
      const text = (await page.locator("main").innerText()).trim();
      expect.soft(text.length, `${r.role}/${tab} main is blank`).toBeGreaterThan(0);
      await shot(page, `${r.role}-${tab}`, 1440);
      if (i === 0) await shot(page, `${r.role}-${tab}`, 390);
    }
    expect.soft(errors, `${r.role} page errors`).toEqual([]);
  });
}
