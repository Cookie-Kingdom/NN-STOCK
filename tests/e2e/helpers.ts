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
export type AccountKey = keyof typeof ACCOUNTS;

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
export function skipUnlessCredentials(...accounts: AccountKey[]) {
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

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const INVOICE_FIXTURE = path.join(
  process.cwd(),
  "tests/fixtures/invoice-demo.pdf",
);

/** A red dot that follows the mouse, so the recorded videos show every click. */
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

export async function button(page: Page, name: string | RegExp) {
  await pointAndClick(page, page.getByRole("button", { name }).last());
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

/* ---- ids on screen ----------------------------------------------------------- */

export const PO_ID = /PO-\d{4}-\d{4}/;
export const SHIPMENT_NO = /SH-\d{4}-\d{4}/;
/** A smoke batch id: `S<yymmdd>-NNN-xxxx` (GEN-09). */
export const BATCH_ID = /S\d{6}-\d{3}-[0-9a-z]{4}/i;

/** Every match of `pattern` in the main area's text, in order, without repeats. */
export async function idsOnScreen(page: Page, pattern: RegExp) {
  const text = await page.locator("main").innerText();
  return [...new Set(text.match(new RegExp(pattern.source, "gi")) ?? [])];
}

/* ---- documents, by action (not by account) -------------------------------------
 * Each helper records one document from the /owner workspace (Owner or Account Manager)
 * and names the action rather than whose document it is: Foodiva and Chef House work
 * lives in the "งาน Foodiva" / "งาน Chef House" tabs. */

const FOODIVA_TAB = "Invoice เนื้อ · ใบขนส่ง · รับเข้าตู้";

/** The menus and tables each action is reached through. */
export const SCREENS = {
  purchasePo: { menu: "ใบสั่งซื้อ PO" },
  meatInvoice: {
    menu: FOODIVA_TAB,
    table: "PO เนื้อที่ต้องออก Invoice",
  },
  batches: { menu: FOODIVA_TAB, table: "ชุดรมควัน" },
  freezer: {
    menu: FOODIVA_TAB,
    table: "เนื้อรมควันขากลับ · รับเข้าตู้ Foodiva",
  },
  weighIn: { menu: "ชั่งรับเนื้อ", table: "การส่งที่รอยืนยันรับ" },
  production: {
    menu: "ผลิต · สโมค · Invoice ค่ารม",
    table: "รายการ Lot ทั้งหมด",
  },
  smokePo: { menu: "ใบสั่ง PO โรงรมควัน", table: "รายการ PO โรงรมควัน" },
  invoices: { menu: "ใบ Invoice" },
  centralReceive: { menu: "รับเนื้อเข้าสต๊อกกลาง" },
  allocate: { menu: "จัดสรรเนื้อ และสต๊อกไปสาขา" },
  ownerDashboard: { menu: "แดชบอร์ด" },
  traceability: { menu: "เอกสารและ Traceability" },
  branchDay: { menu: "กรอกรายวัน" },
  materialReceive: { menu: "ยืนยันรับวัสดุ" },
} as const;

/** Creates a purchase PO for `orderedKg` at `price` ฿/kg; returns its `PO-yyyy-NNNN`. */
export async function createPurchasePo(
  page: Page,
  orderedKg = "300",
  price = "250",
): Promise<string> {
  await openMenu(page, SCREENS.purchasePo.menu);
  const before = await idsOnScreen(page, PO_ID);
  await button(page, "สร้าง PO เนื้อ");
  const dialog = topDialog(page);
  // The header fields repeat the last PO's (prefill); the amounts are always typed.
  for (const [label, value] of [
    [/ชื่อบริษัท \/ ลูกค้า/, "บริษัท เนิร์ดเนื้อ จำกัด"],
    [/ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร"],
    [/ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ"],
    [/เบอร์ติดต่อ/, "0800000000"],
    [/เลขประจำตัวผู้เสียภาษี/, "0100000000000"],
    [/ขนาดบรรจุ/, "6 ชิ้นต่อถุง"],
    [/^รายการสินค้า/, "เนื้อวัวสำหรับรมควัน"],
  ] as const) {
    const input = dialog.getByLabel(label).last();
    if (!(await input.inputValue())) await typeValue(page, input, value);
  }
  await field(page, /น้ำหนักสั่งซื้อ/, orderedKg);
  await field(page, /ราคาเนื้อ/, price);
  await saveEntry(page);
  let poId = "";
  await expect(async () => {
    poId =
      (await idsOnScreen(page, PO_ID)).find((id) => !before.includes(id)) ?? "";
    expect(poId, "the new PO is listed").not.toBe("");
  }).toPass();
  return poId;
}

/** Issues the meat invoice for purchase PO `poId`, all of `kg` ready for Chef House. */
export async function issueMeatInvoice(
  page: Page,
  poId: string,
  kg: string,
  invoiceNo = `FD-INV-${poId.slice(-4)}`,
) {
  await openMenu(page, SCREENS.meatInvoice.menu);
  await pointAndClick(
    page,
    tableRow(page, SCREENS.meatInvoice.table, poId).getByRole("button", {
      name: /ออกและอัปโหลด Invoice|อัปโหลด Invoice เนื้อ/,
    }),
  );
  await field(page, /เลข Invoice เนื้อ/, invoiceNo);
  await field(page, /น้ำหนักตาม Invoice/, kg);
  await field(page, /พร้อมส่งไป Chef House/, kg);
  await topDialog(page)
    .locator('input[type="file"]')
    .setInputFiles(INVOICE_FIXTURE);
  await field(page, /ชื่อผู้ยืนยันจาก Foodiva/, "เจ้าหน้าที่ Foodiva");
  await saveEntry(page);
  return invoiceNo;
}

/** Weigh-in (`cmReceive`) at Chef House. `batch` = "" opens a new batch ("เปิดชุดใหม่",
 *  CHF-01/GEN-09); otherwise the row of that batch (id or SH-number). Without a Packing
 *  List the boxes are typed one by one. */
export async function weighIn(page: Page, batch: string, boxesKg: string[]) {
  await openMenu(page, SCREENS.weighIn.menu);
  if (batch)
    await pointAndClick(
      page,
      tableRow(page, SCREENS.weighIn.table, batch).getByRole("button", {
        name: "ยืนยันรับเนื้อ",
      }),
    );
  else await button(page, "เปิดชุดใหม่");
  const dialog = topDialog(page);
  await expect(dialog).toContainText("ยืนยันรับเนื้อที่ Chef House");
  const rows = dialog.getByLabel("จำนวนแถวของตาราง");
  if (await rows.count()) await rows.fill(String(boxesKg.length));
  for (const [index, kg] of boxesKg.entries())
    await typeValue(
      page,
      dialog.getByLabel(`น้ำหนักจริงกล่องรับเข้าที่ ${index + 1}`, {
        exact: true,
      }),
      kg,
    );
  await saveEntry(page);
}

/** The action button of one batch row on the production table (`match` = batch id). */
export function productionButton(page: Page, name: string, match: string) {
  return tableRow(page, SCREENS.production.table, match)
    .getByRole("button", { name, exact: true })
    .first();
}

async function openProductionJob(page: Page, name: string, batch: string) {
  await openMenu(page, SCREENS.production.menu);
  await pointAndClick(page, productionButton(page, name, batch));
}

/** "น้ำหนักก่อนสโมค" on a batch. */
export async function recordPreSmoke(page: Page, batch: string, kg: string) {
  await openProductionJob(page, "น้ำหนักก่อนสโมค", batch);
  await field(page, /น้ำหนักหลังแกะซับ ก่อนสโมค/, kg);
  await saveEntry(page);
}

/** One smoking round: `inputKg` into the smoker, `wasteKg`, one pack per `packs`. */
export async function recordSmoke(
  page: Page,
  batch: string,
  {
    inputKg,
    wasteKg = "0",
    packs,
  }: {
    inputKg: string;
    wasteKg?: string;
    packs: string[];
  },
) {
  await openProductionJob(page, "บันทึก Lot สโมครายวัน", batch);
  await field(page, /น้ำหนักเข้าเตารอบนี้/, inputKg);
  await field(page, /น้ำหนัก Waste/, wasteKg);
  const dialog = topDialog(page);
  for (const [index, kg] of packs.entries()) {
    if (index > 0)
      await pointAndClick(
        page,
        dialog.getByRole("button", { name: "เพิ่มกล่องรมควัน" }),
      );
    await typeValue(
      page,
      dialog.getByLabel(`กล่องรมควันที่ ${index + 1} กี่กิโล`),
      kg,
    );
  }
  await saveEntry(page);
}

/** "ยืนยันปิด Lot". */
export async function closeBatch(page: Page, batch: string) {
  await openProductionJob(page, "ยืนยันปิด Lot", batch);
  await field(page, /ชื่อผู้ยืนยันปิด Lot/, "หัวหน้าผลิต Chef House");
  await saveEntry(page);
}

/** The smoking invoice of a batch. `billedKg` is typed only while the batch has no smoke
 *  PO (SVC-01: the form then asks for the kg itself and warns). Leaves the dialog open
 *  when `keepOpen` so the caller can read its warnings first. */
export async function openSmokingInvoice(
  page: Page,
  batch: string,
  {
    invoiceNo,
    billedKg,
    amount,
  }: {
    invoiceNo: string;
    billedKg?: string;
    amount?: string;
  },
) {
  await openProductionJob(page, "สร้าง / Submit ใบวางบิล", batch);
  await field(page, /เลข Invoice ค่ารมควัน/, invoiceNo);
  if (billedKg) await field(page, /น้ำหนักที่คิดค่ารมควัน/, billedKg);
  if (amount) await field(page, /ยอดเรียกเก็บค่ารมควัน/, amount);
  await topDialog(page)
    .locator('input[type="file"]')
    .setInputFiles(INVOICE_FIXTURE);
}

/** "ยืนยันรับ PO รมควัน" on a batch that has one (SMK-06). */
export async function acceptSmokePo(page: Page, batch: string) {
  await openProductionJob(page, "ยืนยันรับ PO รมควัน", batch);
  await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef House");
  await saveEntry(page);
}

/** Fills the Packing List dialog opened over the transport document: one row per box. */
export async function fillPackingList(page: Page, boxesKg: string[]) {
  await pointAndClick(
    page,
    topDialog(page).getByRole("button", {
      name: /^(สร้าง|แก้ไข) Packing List$/,
    }),
  );
  const list = topDialog(page);
  await expect(list).toContainText("กรอกน้ำหนักรายกล่องรับเข้า");
  const invoice = list.getByLabel("เลข Invoice", { exact: true });
  if (!(await invoice.inputValue()))
    await typeValue(page, invoice, "FD-PL-001");
  const product = list.getByLabel("รายการสินค้า", { exact: true });
  if (!(await product.inputValue()))
    await typeValue(page, product, "เนื้อวัวสำหรับรมควัน");
  await list.getByLabel("จำนวนแถวของตาราง").fill(String(boxesKg.length));
  for (const [index, kg] of boxesKg.entries())
    await typeValue(
      page,
      list.getByLabel(`น้ำหนักตาม Packing List กล่องรับเข้าที่ ${index + 1}`, {
        exact: true,
      }),
      kg,
    );
  await pointAndClick(
    page,
    list.getByRole("button", { name: "ใส่ Packing List ในใบขนส่ง" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(1);
}

/** Transport document + Packing List on a batch (`batch` = id / SH-number of a row in
 *  "ชุดรมควัน", or "" for "เปิดชุดใหม่"), saved together (SHP-01/03). */
export async function recordDispatch(
  page: Page,
  batch: string,
  boxesKg: string[],
) {
  await openMenu(page, SCREENS.batches.menu);
  if (batch)
    await pointAndClick(
      page,
      tableRow(page, SCREENS.batches.table, batch).getByRole("button", {
        name: "ทำใบขนส่ง + Packing List",
      }),
    );
  else
    await pointAndClick(
      page,
      tableSection(page, /^ชุดรมควัน$/).getByRole("button", {
        name: "เปิดชุดใหม่",
      }),
    );
  await saveDispatchDialog(page, boxesKg);
}

/** The open transport-document dialog: truck (unless prefilled), Packing List, save. */
export async function saveDispatchDialog(page: Page, boxesKg: string[]) {
  const dialog = topDialog(page);
  for (const [label, value] of [
    ["ทะเบียนรถ", "70-1234 กทม."],
    ["ชื่อคนขับ", "สมชาย ขับดี"],
    ["เบอร์ติดต่อคนขับ", "0811111111"],
  ] as const) {
    const input = dialog.getByLabel(label, { exact: true });
    if (!(await input.inputValue())) await typeValue(page, input, value);
  }
  await fillPackingList(page, boxesKg);
  await pointAndClick(
    page,
    page.getByRole("button", { name: "บันทึกใบขนส่ง", exact: true }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Opens "ออก PO รมควันเนื้อ" (SMK-08) on `batch` (id; "" = ชุดใหม่) and types each line
 *  against its purchase PO. Leaves the dialog open so the caller can read warnings. */
export async function openSmokePo(
  page: Page,
  batch: string,
  lines: { poId: string; kg: string }[],
) {
  await openMenu(page, SCREENS.smokePo.menu);
  await button(page, /^\+ ออก PO รมควันเนื้อ$/);
  const dialog = topDialog(page);
  // The option values are batch ids.
  if (batch)
    await dialog
      .getByRole("combobox", { name: /^ชุดรมควัน/ })
      .selectOption(batch);
  for (const line of lines)
    await typeValue(
      page,
      dialog.getByLabel(`น้ำหนักที่ส่งจาก ${line.poId}`),
      line.kg,
    );
  await field(page, /คำสั่งพิเศษ/, "รมตามมาตรฐาน NerdNuea");
}

/** Owner: a smoke PO on a new batch with no purchase PO lines and `rawKg` typed
 *  (SMK-01/02); returns the new batch id. */
export async function issueSmokePoOnNewBatch(page: Page, rawKg: string) {
  await openMenu(page, SCREENS.smokePo.menu);
  const before = await idsOnScreen(page, BATCH_ID);
  await openSmokePo(page, "", []);
  await field(page, /น้ำหนัก PO รมควัน/, rawKg);
  await saveEntry(page);
  let batch = "";
  await expect(async () => {
    batch =
      (await idsOnScreen(page, BATCH_ID)).find((id) => !before.includes(id)) ??
      "";
    expect(batch, "the new batch is listed").not.toBe("");
  }).toPass();
  return batch;
}

/** Foodiva's freezer receipt of the smoked meat back from Chef House (RET-02: needs no
 *  return truck). */
export async function receiveIntoFreezer(
  page: Page,
  batch: string,
  kg: string,
  boxes: string,
) {
  await openMenu(page, SCREENS.freezer.menu);
  await pointAndClick(
    page,
    tableRow(page, SCREENS.freezer.table, batch).getByRole("button", {
      name: "ยืนยันรับเข้าตู้",
    }),
  );
  await field(page, /น้ำหนักรับจริง/, kg);
  await field(page, /จำนวนกล่องรมควันที่รับ/, boxes);
  await saveEntry(page);
}

/** The central-stock receive of a batch (RET-03: needs no return truck). */
export async function receiveCentral(page: Page, batch: string, kg: string) {
  await openMenu(page, SCREENS.centralReceive.menu);
  await pointAndClick(
    page,
    tableRow(page, "ชุดที่ยังไม่เข้าสต๊อกกลาง", batch).getByRole("button", {
      name: "รับเข้าสต๊อกกลาง",
    }),
  );
  await field(page, /น้ำหนักรับสต๊อกกลาง/, kg);
  await saveEntry(page);
}

/** The Owner's inventory row of a batch on the allocation screen. */
export async function allocationRow(page: Page, batch: string) {
  await openMenu(page, SCREENS.allocate.menu);
  return tableRow(page, "สต๊อกเนื้อทุกจุด (Meat inventory)", batch);
}

/** Allocates `kg` of a batch to one branch (the other branch left at 0). */
export async function allocate(
  page: Page,
  batch: string,
  branch: "ศาลาแดง" | "มีนบุรี",
  kg: string,
) {
  const row = await allocationRow(page, batch);
  await pointAndClick(page, row.getByRole("button", { name: "จัดสรร" }));
  const dialog = topDialog(page);
  const other = branch === "ศาลาแดง" ? "มีนบุรี" : "ศาลาแดง";
  await typeValue(page, dialog.getByLabel(`${other} (กก.)`), "0");
  await typeValue(page, dialog.getByLabel(`${branch} (กก.)`), kg);
  await saveEntry(page);
}

/* ---- branch meat -------------------------------------------------------------- */

/** The branch's "ไม่ระบุ Lot" bucket as the lot select stores it (NO_LOT in lib/nav). */
export const NO_LOT = "~no-lot";

/** The branch meat forms' "Lot ต้นทาง" select. */
export function lotSelect(page: Page) {
  return topDialog(page).getByRole("combobox", { name: /^Lot ต้นทาง/ });
}

/** One task on the branch day screen ("รับของ", "แบ่งละลาย", "บันทึกยอดขาย"). */
export async function openBranchTask(page: Page, name: string) {
  await openMenu(page, SCREENS.branchDay.menu);
  await pointAndClick(
    page,
    page.locator("main").getByRole("button", { name, exact: true }),
  );
}

/** Branch receive of `kg` on `lot` (a batch id, or NO_LOT), no allocation (BR-02). */
export async function branchReceive(page: Page, lot: string, kg: string) {
  await openBranchTask(page, "รับของ");
  await lotSelect(page).selectOption(lot);
  await field(page, /น้ำหนักรับเข้าสาขา/, kg);
  await saveEntry(page);
}

/** The branch stock row of a batch id, or of the "ไม่ระบุ Lot" bucket (`""`). */
export async function branchStockRow(page: Page, branch: string, lot: string) {
  await openMenu(page, "สต๊อก");
  return tableRow(
    page,
    `ตารางสต๊อกทั้งหมด · ${branch}`,
    `${lot || "ไม่ระบุ Lot"} · เนื้อรมควัน`,
  );
}

/** A history row (`<details>`) of the signed-in workspace that mentions `text`. */
export async function historyEntry(
  page: Page,
  menu: string,
  text: string | RegExp,
) {
  await openMenu(page, menu);
  return page.locator("main details").filter({ hasText: text }).first();
}

/* ---- bell & secrecy ------------------------------------------------------------ */

/** Opens the header bell and returns the list of things to do next. */
export async function openNotifications(page: Page) {
  await pointAndClick(
    page,
    page.getByRole("button", { name: /^การแจ้งเตือน/ }),
  );
  return page.getByLabel("รายการที่ต้องทำต่อ");
}

/** PRIN-06: no purchase PO number, no meat price label and none of `secrets`
 *  (distinctive prices) anywhere on the page or its open dialogs. */
export async function expectNoPurchaseData(page: Page, secrets: string[] = []) {
  const text = await page.locator("body").innerText();
  expect(text, "purchase PO number").not.toMatch(PO_ID);
  expect(text, "meat price label").not.toContain("ราคาเนื้อ");
  for (const secret of secrets) expect(text).not.toContain(secret);
}
