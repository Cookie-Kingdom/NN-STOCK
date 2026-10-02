import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";

/* Account & Stocking (v9, the "free ledger"): every role records what happened in any
 * order and links documents later. Specs cite PRD ids in their titles
 * (vault: Spec/Account Stocking PRD.md), e.g. `test("LNK-06 …")`.
 *
 * Run against the local SQLite backend: `pnpm test:e2e:local`. */

/* Accounts. Foodiva and Chef House are partners, not users: the Owner / Account Manager
 * record their steps from the /owner tabs (SCREENS below). Local SQLite mode signs in `<account>@local.test` with any password;
 * against Supabase the credentials come from E2E_<ENV>_EMAIL / E2E_<ENV>_PASSWORD,
 * loaded from .env.local by playwright.config.ts. */
export const ACCOUNTS = {
  owner: "owner",
  manager: "manager",
  saladaeng: "saladaeng",
  minburi: "minburi",
} as const;
type AccountKey = keyof typeof ACCOUNTS;

const ACCOUNT_ENV: Record<AccountKey, string> = {
  owner: "OWNER",
  manager: "MANAGER",
  saladaeng: "SALADAENG",
  minburi: "MINBURI",
};

/** Mirrors `path` in src/lib/accounts.ts. */
const ACCOUNT_PATH: Record<AccountKey, string> = {
  owner: "/owner",
  manager: "/owner",
  saladaeng: "/branch",
  minburi: "/branch",
};

function credentialsFor(account: AccountKey) {
  if (process.env.NEXT_PUBLIC_LOCAL_DB === "1")
    return { email: `${account}@local.test`, password: "local-test" };
  const prefix = `E2E_${ACCOUNT_ENV[account]}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  return email && password ? { email, password } : null;
}

/** Skips the current test when any of the accounts has no credentials in env. */
function skipUnlessCredentials(...accounts: AccountKey[]) {
  const missing = accounts.filter((account) => !credentialsFor(account));
  test.skip(
    missing.length > 0,
    `missing credentials: ${missing
      .map(
        (a) => `E2E_${ACCOUNT_ENV[a]}_EMAIL / E2E_${ACCOUNT_ENV[a]}_PASSWORD`,
      )
      .join(", ")}`,
  );
}

/* ---- page primitives ------------------------------------------------------ */

/** The workspace sidebar (the `<aside>` holding the nav and the sign-out button). */
export function sidebar(page: Page) {
  return page
    .getByRole("complementary")
    .filter({ has: page.getByRole("button", { name: "ออกจากระบบ" }) });
}

/** A sidebar menu item by its exact label; the accessible name may carry a count pill. */
export function menuItem(page: Page, label: string) {
  return sidebar(page).getByRole("button", {
    name: new RegExp(`^${escapeRegExp(label)}\\s*\\d*$`),
  });
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const INVOICE_FIXTURE = path.join(
  process.cwd(),
  "tests/fixtures/invoice-demo.pdf",
);

/** A red dot that follows the mouse, so the recorded videos show every click. */
async function installVisibleCursor(page: Page) {
  await page.addInitScript(() => {
    document.addEventListener(
      "mousemove",
      (event) => {
        let cursor = document.getElementById("playwright-visible-cursor");
        if (!cursor) {
          cursor = document.createElement("div");
          cursor.id = "playwright-visible-cursor";
          Object.assign(cursor.style, {
            position: "fixed",
            zIndex: "2147483647",
            width: "20px",
            height: "20px",
            borderRadius: "50%",
            border: "3px solid #dc2626",
            background: "rgba(255,255,255,.85)",
            boxShadow: "0 2px 8px rgba(0,0,0,.35)",
            pointerEvents: "none",
            transform: "translate(-50%, -50%)",
          });
          document.documentElement.appendChild(cursor);
        }
        cursor.style.left = `${event.clientX}px`;
        cursor.style.top = `${event.clientY}px`;
      },
      true,
    );
  });
}

/* The PO and invoice dialogs re-render a live document preview on every
 * keystroke, so these waits are load-bearing: typing faster drops characters. */
export async function pointAndClick(page: Page, locator: Locator) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (box)
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
      steps: 8,
    });
  await page.waitForTimeout(120);
  await locator.click();
  await page.waitForTimeout(200);
}

export async function typeValue(page: Page, locator: Locator, value: string) {
  await locator.scrollIntoViewIfNeeded();
  await pointAndClick(page, locator);
  await locator.fill("");
  await locator.pressSequentially(value, { delay: 15 });
  await expect(locator).toHaveValue(value);
}

/** Types into the (last) field labelled `label` — in the top dialog when one is open. */
export async function field(page: Page, label: string | RegExp, value: string) {
  await typeValue(page, page.getByLabel(label).last(), value);
}

/** The dialog on top (a Packing List opens over the transport document). */
export function topDialog(page: Page) {
  return page.getByRole("dialog").last();
}

/** Submits the open dialog through its submit button (every other dialog button is
 *  type="button") and waits for it to close. */
export async function saveEntry(page: Page) {
  await pointAndClick(
    page,
    topDialog(page).locator('button[type="submit"]').last(),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** The open dialog warns (DialogFooter's yellow `role=status` line) but can still save. */
export async function expectWarning(page: Page, message: string | RegExp) {
  const dialog = topDialog(page);
  await expect(
    dialog.getByRole("status").filter({ hasText: message }).first(),
  ).toBeVisible();
  await expect(dialog.locator('button[type="submit"]').last()).toBeEnabled();
}

/** The notice of a save on the page (the toast), not one inside a dialog. Asked for by a
 *  part of its text; `toHaveText` then reads the whole of it, warnings included. */
export function toast(page: Page, message: string | RegExp) {
  return page.locator("main").getByRole("status").filter({ hasText: message });
}

/** A table card (TableSection), addressed by its heading. */
export function tableSection(page: Page, title: string | RegExp) {
  return page
    .getByRole("heading", { name: title })
    .locator("xpath=ancestor::section[1]");
}

/** The rows of one DataTable (addressed by its exact title) that mention `text`. */
export function tableRow(page: Page, table: string, text: string | RegExp) {
  return tableSection(page, new RegExp(`^${escapeRegExp(table)}$`))
    .getByRole("row")
    .filter({ hasText: text });
}

/** Opens a sidebar tab by its label. */
export async function openMenu(page: Page, label: string) {
  await pointAndClick(page, menuItem(page, label));
}

/** A Bangkok business date, `offset` days from today (the app's `today()`). */
export function bangkokDate(offset = 0) {
  const day = new Date(Date.now() + offset * 86_400_000);
  return day.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** The working date of the open dialog; it is the workspace's one date. */
export async function setWorkingDate(page: Page, date: string) {
  await topDialog(page).getByLabel("วันที่ทำรายการ").fill(date);
}

/* ---- session --------------------------------------------------------------- */

/** Resets the local SQLite database to the empty v9 seed and opens "/". Every test
 *  starts from nothing: the free ledger has no stages to seed around. */
export async function startFresh(page: Page) {
  test.skip(
    process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
    "the free-ledger suite runs on the local SQLite backend (pnpm test:e2e:local)",
  );
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("e2e-storage-cleared")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("e2e-storage-cleared", "1");
    }
  });
  await installVisibleCursor(page);
  const response = await page.request.put("/api/local-db?state=seed");
  expect(response.ok(), `PUT /api/local-db → ${response.status()}`).toBe(true);
  await page.goto("/");
}

/** Signs out (when signed in) and back in as `account` through the form on "/". */
export async function signInAs(page: Page, account: AccountKey) {
  skipUnlessCredentials(account);
  const { email, password } = credentialsFor(account)!;
  const signOut = page.getByRole("button", { name: "ออกจากระบบ" });
  if (await signOut.count()) await pointAndClick(page, signOut);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน").fill(password);
  await pointAndClick(
    page,
    page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }),
  );
  const accountPath = ACCOUNT_PATH[account];
  await expect(page).toHaveURL(new RegExp(`${accountPath}(?:[/?#]|$)`), {
    timeout: 30_000,
  });
  await expect(signOut).toBeVisible({ timeout: 30_000 });
}

/** One named step of a flow spec, with a screenshot attached after it (pass or fail).
 *  Start the title with the actor ("Owner: …") so the flow report can group by role. */
export async function step(
  page: Page,
  title: string,
  body: () => Promise<void>,
) {
  await test.step(title, async () => {
    try {
      await body();
    } finally {
      const shot = await page
        .screenshot({ type: "jpeg", quality: 55 })
        .catch(() => null);
      if (shot)
        await test.info().attach(`step:${title}`, {
          body: shot,
          contentType: "image/jpeg",
        });
    }
  });
}
