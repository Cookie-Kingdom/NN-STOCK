import { expect, test, type Locator, type Page } from "@playwright/test";
import path from "node:path";

/* Accounts are real Supabase users. Credentials come from E2E_<ENV>_EMAIL /
 * E2E_<ENV>_PASSWORD, loaded from .env.local by playwright.config.ts. */
export const ACCOUNTS = {
  owner: "owner",
  foodiva: "foodiva",
  chef: "chef",
  saladaeng: "saladaeng",
  minburi: "minburi",
} as const;
export type AccountKey = keyof typeof ACCOUNTS;

const ACCOUNT_ENV: Record<AccountKey, string> = {
  owner: "OWNER",
  foodiva: "FOODIVA",
  chef: "CHEF",
  saladaeng: "SALADAENG",
  minburi: "MINBURI",
};

/** Mirrors `path` in src/lib/accounts.ts. */
const ACCOUNT_PATH: Record<AccountKey, string> = {
  owner: "/owner",
  foodiva: "/foodiva",
  chef: "/chef",
  saladaeng: "/branch",
  minburi: "/branch",
};

/** Branch name (as the UI shows it) → branch account. */
export const BRANCH_ACCOUNTS = {
  ศาลาแดง: "saladaeng",
  มีนบุรี: "minburi",
} as const satisfies Record<string, AccountKey>;

function credentialsFor(account: AccountKey) {
  // Local SQLite mode (pnpm test:e2e:local) signs in by account id, any password.
  if (process.env.NEXT_PUBLIC_LOCAL_DB === "1")
    return { email: `${account}@local.test`, password: "local-test" };
  const prefix = `E2E_${ACCOUNT_ENV[account]}`;
  const email = process.env[`${prefix}_EMAIL`];
  const password = process.env[`${prefix}_PASSWORD`];
  return email && password ? { email, password } : null;
}

/** Skips the current test when any of the accounts has no credentials in env.
 * Call it at the top of a test so a long flow does not stop half-way. */
export function skipUnlessCredentials(...accounts: AccountKey[]) {
  const missing = accounts.filter((account) => !credentialsFor(account));
  test.skip(
    missing.length > 0,
    `missing credentials: ${missing
      .map((a) => `E2E_${ACCOUNT_ENV[a]}_EMAIL / E2E_${ACCOUNT_ENV[a]}_PASSWORD`)
      .join(", ")}`,
  );
}

/** The workspace sidebar (the `<aside>` holding the nav and the sign-out button). */
export function sidebar(page: Page) {
  return page
    .getByRole("complementary")
    .filter({ has: page.getByRole("button", { name: "ออกจากระบบ" }) });
}

/** A sidebar menu item by its exact label. The accessible name also carries the
 * red count pill when the tab has pending work ("งานผลิต 2"), so allow a trailing number. */
export function menuItem(page: Page, label: string) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return sidebar(page).getByRole("button", {
    name: new RegExp(`^${escaped}\\s*\\d*$`),
  });
}

export const INVOICE_FIXTURE = path.join(
  process.cwd(),
  "tests/fixtures/invoice-demo.pdf",
);

export async function installVisibleCursor(page: Page) {
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
      steps: 12,
    });
  await page.waitForTimeout(180);
  await locator.click();
  await page.waitForTimeout(260);
}

export async function typeValue(page: Page, locator: Locator, value: string) {
  await locator.scrollIntoViewIfNeeded();
  await pointAndClick(page, locator);
  await locator.fill("");
  await locator.pressSequentially(value, { delay: 20 });
  await expect(locator).toHaveValue(value);
}

export async function button(page: Page, name: string | RegExp) {
  await pointAndClick(page, page.getByRole("button", { name }).last());
}

export async function field(page: Page, label: string | RegExp, value: string) {
  await typeValue(page, page.getByLabel(label).last(), value);
}

/** Submits whatever dialog is open. Every entry dialog labels its submit button
 * after the record it writes ("สร้างใบขนส่งขาไป", "ยืนยันปิดวัน", …), so the
 * submit button (DialogFooter; every other Button defaults to type="button")
 * is the stable handle, not the label. */
export async function saveEntry(page: Page) {
  await pointAndClick(
    page,
    page.getByRole("dialog").locator('button[type="submit"]').last(),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** A table card (TableSection), addressed by its heading — settings and report
 * screens stack many of them and every one has its own action buttons. The
 * nearest enclosing <section> is used so an outer section (e.g. ChartPanel)
 * never matches too. */
export function tableSection(page: Page, title: string | RegExp) {
  return page
    .getByRole("heading", { name: title })
    .locator("xpath=ancestor::section[1]");
}

/** Clears storage before the first paint so each test starts from the seed set.
 * Guarded by a sessionStorage flag: a later full page load inside the same test
 * must keep whatever the test has already recorded. */
export async function startFresh(page: Page) {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("e2e-storage-cleared")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("e2e-storage-cleared", "1");
    }
  });
  await installVisibleCursor(page);
  // Local SQLite: every test starts from the seed, so state one spec leaves
  // behind (loadSampleData closes today) cannot leak into the next spec.
  if (process.env.NEXT_PUBLIC_LOCAL_DB === "1") {
    const response = await page.request.put("/api/local-db?state=seed");
    expect(response.ok(), `PUT /api/local-db → ${response.status()}`).toBe(true);
  }
  await page.goto("/");
}

/** Each account has its own route, so handing work over means signing out and
 * signing back in as the next account, through the email/password form on "/".
 * Skips the test when the account has no credentials in env. */
export async function signInAs(page: Page, account: AccountKey) {
  skipUnlessCredentials(account);
  const { email, password } = credentialsFor(account)!;

  const signOut = page.getByRole("button", { name: "ออกจากระบบ" });
  if (await signOut.count()) {
    await pointAndClick(page, signOut);
  }
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
  await expect(
    page,
    `sign-in as ${account} should land on ${accountPath} (check E2E_${ACCOUNT_ENV[account]}_* and the profile role)`,
  ).toHaveURL(new RegExp(`${accountPath}(?:[/?#]|$)`), { timeout: 30_000 });
  await expect(signOut).toBeVisible({ timeout: 30_000 });
}

/** Replaces the database with the seven-day sample set. The owner's reset button
 * went away when data moved to Supabase (9bc718d), so this writes straight into the
 * local SQLite backend (pnpm test:e2e:local) and skips the test anywhere else.
 * The data shows up from the next sign-in. */
export async function loadSampleData(page: Page) {
  test.skip(
    process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
    "sample data loads only in local SQLite mode (pnpm test:e2e:local)",
  );
  const response = await page.request.put("/api/local-db?state=sample");
  expect(response.ok(), `PUT /api/local-db → ${response.status()}`).toBe(true);
}

/* ---- pipeline steps, so a role spec can build the state it needs ---------- */

export async function ownerCreatesMeatPo(page: Page, orderedKg = "500") {
  await button(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");
  await field(page, /ผู้ขาย · Foodiva/, "Foodiva");
  await field(page, /ชื่อบริษัท \/ ลูกค้า/, "บริษัท เนิร์ดเนื้อ จำกัด");
  await field(page, /ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร");
  await field(page, /ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ");
  await field(page, /เบอร์ติดต่อ/, "0800000000");
  await field(page, /เลขประจำตัวผู้เสียภาษี/, "0100000000000");
  await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อถุง");
  await field(page, /น้ำหนักสั่งซื้อ/, orderedKg);
  await field(page, /ราคาเนื้อ/, "250");
  await button(page, "บันทึก PO เนื้อ");
}

export async function foodivaIssuesInvoice(page: Page, kg = "500") {
  await button(page, /ออกและอัปโหลด Invoice|อัปโหลด Invoice เนื้อ/);
  await field(page, /เลข Invoice เนื้อ/, "FD-INV-001");
  await field(page, /น้ำหนักตาม Invoice/, kg);
  // BR: ส่งไปเชียงใหม่ + เนื้อที่เหลือรอ Owner ต้องรวมเท่ากับน้ำหนักตาม Invoice
  await field(page, /พร้อมส่งไป Chef_house/, kg);
  await field(page, /เนื้อส่วนที่เหลือรอ Owner รับ/, "0");
  await field(page, /ยอดรวม Invoice/, "125000");
  await page.locator('input[type="file"]').setInputFiles(INVOICE_FIXTURE);
  await field(page, /ชื่อผู้ยืนยันจาก Foodiva/, "เจ้าหน้าที่ Foodiva");
  await saveEntry(page);
}

export async function ownerIssuesSmokePo(page: Page, kg = "500") {
  await button(page, "ใบสั่ง PO โรงรมควัน");
  await button(page, "ออก PO รมควันเนื้อ");
  await field(page, /โรงรม \/ ผู้ให้บริการ/, "Chef_house");
  await field(page, /Raw Meat Quantity/, kg);
  await field(page, /คำสั่งพิเศษ/, "รมตามมาตรฐาน NerdNuea");
  await button(page, "บันทึก PO รมควันเนื้อ");
}
