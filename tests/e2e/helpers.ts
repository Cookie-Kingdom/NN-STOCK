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

async function button(page: Page, name: string | RegExp) {
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

const PO_ID = /PO-\d{4}-\d{4}/;
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
    table: "PO เนื้อและ Invoice ของ Foodiva",
  },
  batches: { menu: FOODIVA_TAB, table: "ชุดรมควัน" },
  freezer: {
    menu: FOODIVA_TAB,
    table: "เนื้อรมควันขากลับ · รับเข้าตู้ Foodiva",
  },
  weighIn: { menu: "ชั่งรับเนื้อ", table: "การส่งที่ยังไม่ได้จดรับ" },
  production: {
    menu: "ผลิต · สโมค · Invoice ค่ารม",
    table: "รายการ Lot ทั้งหมด",
  },
  smokePo: { menu: "ใบสั่ง PO โรงรมควัน", table: "รายการ PO โรงรมควัน" },
  invoices: { menu: "ใบ Invoice" },
  centralReceive: {
    menu: "รับเนื้อเข้าสต๊อกกลาง",
    table: "ชุดที่ยังไม่เข้าสต๊อกกลาง",
    unmatched: "เข้าสต๊อกกลางแล้ว · ยังไม่จับคู่ PO ซื้อ",
  },
  branchMeat: {
    menu: "สต๊อกเนื้อสาขา",
    table: "สต๊อกเนื้อทุกจุด (Meat inventory)",
  },
  ownerDashboard: { menu: "แดชบอร์ด" },
  traceability: { menu: "เอกสารและ Traceability" },
  config: { menu: "ตั้งค่า" },
  branchDay: { menu: "จดรายวัน" },
  rice: {
    menu: "ข้าวเหนียววันนี้",
    table: "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก",
  },
  materialReceive: { menu: "รับวัสดุ" },
  chili: { table: "น้ำพริกหลอด · รับเข้า / สาขาตรวจสอบยอด" },
  ownerStock: {
    menu: "สต๊อกของทั้งหมด",
    table: "ตารางสต๊อกทั้งหมด (All inventory)",
  },
} as const;

/** The marker a field left empty is saved and shown with (GEN-02, `missingText`). */
export const MISSING = "ยังไม่ได้กรอก";

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

/** Opens the weigh-in (`cmReceive`) at Chef House. `batch` = "" opens a new batch
 *  ("เปิดชุดใหม่", CHF-01/GEN-09); otherwise the row of that batch (id or SH-number). */
export async function openWeighIn(page: Page, batch: string) {
  await openMenu(page, SCREENS.weighIn.menu);
  if (batch)
    await pointAndClick(
      page,
      tableRow(page, SCREENS.weighIn.table, batch).getByRole("button", {
        name: "ยืนยันรับเนื้อ",
      }),
    );
  else await button(page, "เปิดชุดใหม่");
  await expect(topDialog(page)).toContainText("ยืนยันรับเนื้อที่ Chef House");
}

/** Weigh-in: Chef House types one total, the kg it weighed (SHP-02). The boxes are in
 *  Foodiva's Packing List file, not typed. */
export async function weighIn(page: Page, batch: string, receivedKg: string) {
  await openWeighIn(page, batch);
  await field(page, /^น้ำหนักรับรวม/, receivedKg);
  await saveEntry(page);
}

/** The action button of one batch row on the production table (`match` = batch id). */
function productionButton(page: Page, name: string, match: string) {
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

/** The name the Packing List file is saved under (the invoice fixture stands in). */
export const PACKING_LIST_FILE = path.basename(INVOICE_FIXTURE);

/** Fills the Packing List dialog opened over the transport document (SHP-02): the file is
 *  the per-box evidence, and only the total sent (`netKg`) is typed. */
async function fillPackingList(page: Page, netKg: string) {
  await pointAndClick(
    page,
    topDialog(page).getByRole("button", {
      name: /^(สร้าง|แก้ไข) Packing List$/,
    }),
  );
  const list = topDialog(page);
  await expect(list).toContainText("กรอกเฉพาะน้ำหนักส่งรวม");
  await list.locator('input[type="file"]').setInputFiles(INVOICE_FIXTURE);
  const invoice = list.getByLabel("เลข Invoice", { exact: true });
  if (!(await invoice.inputValue()))
    await typeValue(page, invoice, "FD-PL-001");
  const product = list.getByLabel("รายการสินค้า", { exact: true });
  if (!(await product.inputValue()))
    await typeValue(page, product, "เนื้อวัวสำหรับรมควัน");
  await typeValue(page, list.getByLabel(/^น้ำหนักส่งรวม/), netKg);
  await pointAndClick(
    page,
    list.getByRole("button", { name: "ใส่ Packing List ในใบขนส่ง" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(1);
}

/** Transport document + Packing List on a batch (`batch` = id / SH-number of a row in
 *  "ชุดรมควัน", or "" for "เปิดชุดใหม่"), saved together (SHP-01/03). */
export async function recordDispatch(page: Page, batch: string, netKg: string) {
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
  await saveDispatchDialog(page, netKg);
}

/** The open transport-document dialog: truck (unless prefilled), Packing List, save. */
export async function saveDispatchDialog(page: Page, netKg: string) {
  const dialog = topDialog(page);
  for (const [label, value] of [
    ["ทะเบียนรถ", "70-1234 กทม."],
    ["ชื่อคนขับ", "สมชาย ขับดี"],
    ["เบอร์ติดต่อคนขับ", "0811111111"],
  ] as const) {
    const input = dialog.getByLabel(label, { exact: true });
    if (!(await input.inputValue())) await typeValue(page, input, value);
  }
  await fillPackingList(page, netKg);
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
    tableRow(page, SCREENS.centralReceive.table, batch).getByRole("button", {
      name: "รับเข้าสต๊อกกลาง",
    }),
  );
  await field(page, /น้ำหนักรับสต๊อกกลาง/, kg);
  await saveEntry(page);
}

/** RET-07: names the purchase POs a batch drew from, at central receive. `table` is the
 *  one the batch sits in: still waiting for central stock, or already counted in. Leaves
 *  the dialog open so the caller can read it before `saveEntry`. */
export async function openMatchPo(
  page: Page,
  table: string,
  batch: string,
  lines: { poId: string; kg: string }[],
) {
  await openMenu(page, SCREENS.centralReceive.menu);
  await pointAndClick(
    page,
    tableRow(page, table, batch).getByRole("button", {
      name: "จับคู่ PO ซื้อ",
    }),
  );
  const dialog = topDialog(page);
  await expect(dialog).toContainText("จับคู่ PO ซื้อ");
  for (const line of lines)
    await typeValue(
      page,
      dialog.getByLabel(`น้ำหนักที่ส่งจาก ${line.poId}`),
      line.kg,
    );
}

/** The Owner's row of a batch on "สต๊อกเนื้อสาขา": central stock and each branch's. Nobody
 *  allocates meat any more (BR-01); the branch's own receive is what moves it. */
export async function meatStockRow(page: Page, batch: string) {
  await openMenu(page, SCREENS.branchMeat.menu);
  return tableRow(page, SCREENS.branchMeat.table, batch);
}

/* ---- branch meat -------------------------------------------------------------- */

/** The branch's "ไม่ระบุ Lot" bucket as the lot select stores it (NO_LOT in lib/nav). */
export const NO_LOT = "~no-lot";

/** The branch meat forms' "Lot ต้นทาง" select. */
export function lotSelect(page: Page) {
  return topDialog(page).getByRole("combobox", { name: /^Lot ต้นทาง/ });
}

/** One task on the branch day screen ("รับของ", "แบ่งละลาย", "จดยอดขาย"). */
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

/* ---- material and chili -------------------------------------------------------
 * Nobody sends these to a branch: the Owner buys into its store and each branch writes
 * down what it received (MAT-01, STK-43). */

/** Branch, on the "รับวัสดุ" tab: one save of a row per `[material, quantity]`, under one
 *  receiver (MAT-01). `blankRows` more are added and left untouched: they are not saved. */
export async function saveMaterialReceipt(
  page: Page,
  rows: [material: string, quantity: string][],
  receiver = "ผู้ดูแลสาขา",
  blankRows = 0,
) {
  const main = page.locator("main");
  const addRow = () =>
    pointAndClick(page, main.getByRole("button", { name: "เพิ่มแถว" }));
  for (const [index, [material, quantity]] of rows.entries()) {
    if (index > 0) await addRow();
    await main
      .getByRole("combobox", { name: `วัสดุ แถวที่ ${index + 1}` })
      .selectOption(material);
    await typeValue(
      page,
      main.getByLabel(`จำนวนที่รับจริง แถวที่ ${index + 1}`),
      quantity,
    );
  }
  for (let blank = 0; blank < blankRows; blank++) await addRow();
  await typeValue(
    page,
    main.getByLabel("ชื่อผู้รับจริง", { exact: true }),
    receiver,
  );
  await pointAndClick(
    page,
    main.getByRole("button", { name: `บันทึกรับวัสดุ ${rows.length} รายการ` }),
  );
  await expect(
    main.getByText(`รับวัสดุ ${rows.length} รายการแล้ว`),
  ).toBeVisible();
}

/** Branch: "รับน้ำพริกเข้าสาขา" from the chili table on the day tab (STK-43). */
export async function branchReceiveChili(
  page: Page,
  tubes: string,
  receiver = "ผู้ดูแลสาขา",
) {
  await openMenu(page, SCREENS.branchDay.menu);
  await pointAndClick(
    page,
    tableSection(page, SCREENS.chili.table).getByRole("button", {
      name: "รับน้ำพริกเข้าสาขา",
    }),
  );
  await field(page, /จำนวนน้ำพริกที่รับ/, tubes);
  await field(page, /ชื่อผู้รับจริง/, receiver);
  await saveEntry(page);
}

/** Owner: "+ ซื้อเข้าคลัง" on the stock tab, `quantity` pieces of one packaging material. */
export async function ownerBuyMaterial(
  page: Page,
  material: string,
  quantity: string,
) {
  await openMenu(page, SCREENS.ownerStock.menu);
  await button(page, "+ ซื้อเข้าคลัง");
  const dialog = topDialog(page);
  await dialog.getByLabel(`ซื้อ ${material}`, { exact: true }).check();
  await typeValue(page, dialog.getByLabel(`จำนวนซื้อ ${material}`), quantity);
  await typeValue(page, dialog.getByLabel(`ราคาซื้อ ${material}`), "5");
  await typeValue(
    page,
    dialog.getByLabel(`ผู้จำหน่าย ${material}`),
    "ร้านบรรจุภัณฑ์",
  );
  await saveEntry(page);
}

/** Owner: the same button's other form, `tubes` of "น้ำพริกหลอด" into the store. */
export async function ownerBuyChili(page: Page, tubes: string) {
  await openMenu(page, SCREENS.ownerStock.menu);
  await button(page, "+ ซื้อเข้าคลัง");
  await pointAndClick(
    page,
    topDialog(page).getByRole("radio", { name: /^ซื้ออื่น ๆ/ }),
  );
  const dialog = topDialog(page);
  await dialog
    .getByRole("combobox", { name: "เลือกวัตถุดิบ 1" })
    .selectOption("น้ำพริกหลอด");
  await typeValue(page, dialog.getByLabel("จำนวน 1", { exact: true }), tubes);
  await typeValue(page, dialog.getByLabel("ราคาต่อหน่วย 1"), "12");
  await typeValue(page, dialog.getByLabel("ผู้จำหน่าย 1"), "ร้านน้ำพริก");
  await saveEntry(page);
}

/** The Owner's row of one material, or of "น้ำพริกหลอด", on "สต๊อกของทั้งหมด": the
 *  store ("คลัง Owner", STK-44) and each branch's shelf. */
export async function ownerStockRow(page: Page, item: string) {
  await openMenu(page, SCREENS.ownerStock.menu);
  return tableRow(page, SCREENS.ownerStock.table, item);
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

/** The history row whose summary starts with `title`: the entry itself ("รับของเข้าสาขา"),
 *  or a change to it ("ลบรายการ · รับของเข้าสาขา"), never a row that only names it. */
export function logRow(page: Page, title: string) {
  return page
    .locator("main details")
    .filter({
      has: page.locator("summary", {
        hasText: new RegExp(`^${escapeRegExp(title)}`),
      }),
    })
    .first();
}

/** A row of the change log at the top of the history tab (EDT-25), by how it starts:
 *  "แก้ไขรายการ · รับของเข้าสาขา". */
export function changeRow(page: Page, title: string) {
  return tableSection(page, "ประวัติการแก้ไขและลบ")
    .locator(":scope > div")
    .filter({ hasText: new RegExp(`^${escapeRegExp(title)}`) })
    .first();
}
