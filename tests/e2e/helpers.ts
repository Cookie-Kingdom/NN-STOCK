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
      .map(
        (a) => `E2E_${ACCOUNT_ENV[a]}_EMAIL / E2E_${ACCOUNT_ENV[a]}_PASSWORD`,
      )
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
    expect(response.ok(), `PUT /api/local-db → ${response.status()}`).toBe(
      true,
    );
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

/* Shipment Flow (Features/Shipment Flow in the vault): purchase PO → Foodiva invoice →
 * Owner Request (SH-…) → Foodiva transport document + Packing List → Owner smoke PO →
 * Chef House yellow cells, smoking, close, invoice → Owner return truck → Foodiva
 * freezer → payments. Each helper is one role's step: it expects the page to be
 * signed in as that role already (see signInAs) unless its comment says otherwise,
 * and scopes its clicks to the row of the PO / shipment it is given. */

/** A file for `setInputFiles` built in memory, so slips need no fixture on disk. */
export type UploadFile = { name: string; mimeType: string; buffer: Buffer };

/** A 1×1 PNG, the photo half of a two-slip payment. */
export function slipImage(name = "slip-photo.png"): UploadFile {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  };
}

/** A tiny PDF slip. */
export function slipPdf(name = "slip-transfer.pdf"): UploadFile {
  return {
    name,
    mimeType: "application/pdf",
    buffer: Buffer.from(
      "%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n",
    ),
  };
}

/** Opens a sidebar tab by its label ("ใบขนส่ง", "งานผลิต", …). */
export async function openMenu(page: Page, label: string) {
  await pointAndClick(page, menuItem(page, label));
}

/** The table rows of one DataTable (addressed by its exact title) that mention `text`. */
export function tableRow(page: Page, table: string, text: string) {
  const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tableSection(page, new RegExp(`^${escaped}$`))
    .getByRole("row")
    .filter({ hasText: text });
}

/** The dialog on top (a Packing List opens over the transport document). */
export function topDialog(page: Page) {
  return page.getByRole("dialog").last();
}

/** Owner: creates a purchase PO for `orderedKg` at `price` ฿/kg and returns its number
 * (`PO-yyyy-NNNN`), read off the live document preview before saving. Ends on the PO tab. */
export async function ownerCreatesMeatPo(
  page: Page,
  orderedKg = "500",
  price = "250",
): Promise<string> {
  await openMenu(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");
  await field(page, /ผู้ขาย · Foodiva/, "Foodiva");
  await field(page, /ชื่อบริษัท \/ ลูกค้า/, "บริษัท เนิร์ดเนื้อ จำกัด");
  await field(page, /ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร");
  await field(page, /ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ");
  await field(page, /เบอร์ติดต่อ/, "0800000000");
  await field(page, /เลขประจำตัวผู้เสียภาษี/, "0100000000000");
  await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อถุง");
  await field(page, /น้ำหนักสั่งซื้อ/, orderedKg);
  await field(page, /ราคาเนื้อ/, price);
  const poId = (await page.getByRole("dialog").innerText()).match(
    /PO-\d{4}-\d{4}/,
  )?.[0];
  expect(poId, "the PO preview shows the number it will get").toBeTruthy();
  await button(page, "บันทึก PO เนื้อ");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  return poId!;
}

/** Foodiva: issues the meat invoice for a PO (`poId`, or the last row when omitted) with
 * all `kg` ready for Chef House, and returns the invoice number. Without `poId` the
 * number is "FD-INV-001" as before; with it, "FD-INV-<last 4 digits of the PO>". */
export async function foodivaIssuesInvoice(
  page: Page,
  kg = "500",
  {
    poId,
    invoiceNo = poId ? `FD-INV-${poId.slice(-4)}` : "FD-INV-001",
    amount = "125000",
    reservedKg = "0",
  }: {
    poId?: string;
    invoiceNo?: string;
    amount?: string;
    /** Kept by Foodiva for the Owner; the rest is ready for Chef House. */
    reservedKg?: string;
  } = {},
): Promise<string> {
  const name = /ออกและอัปโหลด Invoice|อัปโหลด Invoice เนื้อ/;
  if (poId)
    await pointAndClick(
      page,
      tableRow(page, "PO เนื้อที่ต้องออก Invoice", poId).getByRole("button", {
        name,
      }),
    );
  else await button(page, name);
  await field(page, /เลข Invoice เนื้อ/, invoiceNo);
  await field(page, /น้ำหนักตาม Invoice/, kg);
  // BR: ส่งไปเชียงใหม่ + เนื้อที่เหลือรอ Owner ต้องรวมเท่ากับน้ำหนักตาม Invoice
  await field(
    page,
    /พร้อมส่งไป Chef House/,
    String(Number(kg) - Number(reservedKg)),
  );
  await field(page, /เนื้อส่วนที่เหลือรอ Owner รับ/, reservedKg);
  await field(page, /ยอดรวม Invoice/, amount);
  await page
    .getByRole("dialog")
    .locator('input[type="file"]')
    .setInputFiles(INVOICE_FIXTURE);
  await field(page, /ชื่อผู้ยืนยันจาก Foodiva/, "เจ้าหน้าที่ Foodiva");
  await saveEntry(page);
  return invoiceNo;
}

/** Owner: opens "สร้าง Request ส่งเนื้อไป Chef House" and types each line's kg against
 * its PO (`poId` omitted = the first PO listed). Leaves the dialog open, so a test can
 * read the live error before saving. */
export async function ownerFillsShipmentRequest(
  page: Page,
  lines: { poId?: string; kg: string }[],
) {
  await openMenu(page, "ใบขนส่ง");
  await button(page, "สร้าง Request ส่งเนื้อไป Chef House");
  const dialog = page.getByRole("dialog");
  for (const line of lines)
    await typeValue(
      page,
      line.poId
        ? dialog.getByLabel(`น้ำหนักที่จะส่งของ ${line.poId}`)
        : dialog.getByLabel(/^น้ำหนักที่จะส่งของ /).first(),
      line.kg,
    );
}

/** The SH-… numbers in the Owner's transport table (ใบขนส่ง tab must be open). */
async function shipmentNumbers(page: Page) {
  const text = await tableSection(page, /^รายการส่ง$/).innerText();
  return new Set(text.match(/SH-\d{4}-\d{4}/g) ?? []);
}

/** Owner: creates a Request drawing `kg` from each PO and returns its `SH-…` number.
 * Checks the toast; ends on the ใบขนส่ง tab. */
export async function ownerCreatesShipmentRequest(
  page: Page,
  lines: { poId?: string; kg: string }[],
): Promise<string> {
  await openMenu(page, "ใบขนส่ง");
  const before = await shipmentNumbers(page);
  await ownerFillsShipmentRequest(page, lines);
  await saveEntry(page);
  await expect(
    page.getByText("สร้าง Request แล้ว · รอ Foodiva ทำใบขนส่ง"),
  ).toBeVisible();
  let shipment = "";
  await expect(async () => {
    const after = await shipmentNumbers(page);
    shipment = [...after].find((number) => !before.has(number)) ?? "";
    expect(shipment).not.toBe("");
  }).toPass();
  return shipment;
}

/** Owner, ใบประวัติ ("Log" tab): cancels the newest Request that is not cancelled yet,
 * with `reason`. Does not assert the outcome: the store refuses once Foodiva has made
 * the transport document, and the caller checks which one happened. */
export async function ownerCancelsLatestRequest(page: Page, reason: string) {
  await openMenu(page, "Log");
  const entry = page
    .locator("details")
    .filter({ hasText: "สร้าง Request ส่งเนื้อไป Chef House" })
    .filter({ hasNotText: "ยกเลิกแล้ว" })
    .first();
  await pointAndClick(page, entry.locator("summary"));
  await pointAndClick(
    page,
    entry.getByRole("button", { name: "แก้รายการผิดด้วยการยกเลิก" }),
  );
  await typeValue(page, entry.getByLabel("เหตุผลที่ยกเลิกรายการ"), reason);
  await pointAndClick(
    page,
    entry.getByRole("button", { name: "ยืนยันยกเลิก" }),
  );
  return entry;
}

/** Foodiva: opens "ทำใบขนส่ง" for one Request and fills the truck. The Packing List is
 * not made yet, so "บันทึกใบขนส่ง" is still disabled. */
export async function foodivaOpensManifest(
  page: Page,
  shipment: string,
  {
    trip = "เที่ยวเดียว",
    plate = "70-1234 กทม.",
    pickupTime,
  }: { trip?: string; plate?: string; pickupTime?: string } = {},
) {
  await openMenu(page, "PO และสต๊อก Foodiva");
  await pointAndClick(
    page,
    tableRow(page, "Request เข้า", shipment).getByRole("button", {
      name: "ทำใบขนส่ง",
    }),
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(shipment);
  await dialog.getByLabel("รูปแบบเที่ยวรถ").selectOption(trip);
  await typeValue(page, dialog.getByLabel("ทะเบียนรถ"), plate);
  await typeValue(page, dialog.getByLabel("ชื่อคนขับ"), "สมชาย ขับดี");
  await typeValue(page, dialog.getByLabel("เบอร์ติดต่อคนขับ"), "0811111111");
  if (pickupTime) {
    await dialog.getByLabel("เวลารถรับ").fill(pickupTime);
    await expect(dialog.getByLabel("เวลารถรับ")).toHaveValue(pickupTime);
  }
}

/** Foodiva, inside the transport document: "สร้าง Packing List" (or "แก้ไข Packing List"),
 * one row per box weight, optional Inv. Weight and evidence file, then "ใส่ Packing List
 * ในใบขนส่ง". Nothing is saved yet. */
export async function foodivaFillsPackingList(
  page: Page,
  boxes: string[],
  {
    invWeightKg,
    slicedLostKg,
    attachment,
  }: {
    invWeightKg?: string;
    slicedLostKg?: string;
    attachment?: string | UploadFile;
  } = {},
) {
  await pointAndClick(
    page,
    page.getByRole("button", { name: /^(สร้าง|แก้ไข) Packing List$/ }),
  );
  const list = topDialog(page);
  await expect(list).toContainText("กรอกน้ำหนักรายกล่องรับเข้า");
  // Exactly as many rows as boxes, so the "ยังกรอกไม่ครบ" confirmation never shows.
  await list.getByLabel("จำนวนแถวของตาราง").fill(String(boxes.length));
  for (const [index, kg] of boxes.entries())
    await typeValue(
      page,
      list.getByLabel(`น้ำหนักตาม Packing List กล่องรับเข้าที่ ${index + 1}`, {
        exact: true,
      }),
      kg,
    );
  if (invWeightKg !== undefined)
    await typeValue(page, list.getByLabel(/Inv\. Weight/), invWeightKg);
  // Foodiva's usable weight after cutting; by default it matches the box total.
  await typeValue(
    page,
    list.getByLabel(/Sliced Weight Lost/),
    slicedLostKg ??
      String(
        Math.round(boxes.reduce((sum, kg) => sum + Number(kg), 0) * 100) / 100,
      ),
  );
  if (attachment)
    await list.locator('input[type="file"]').setInputFiles(attachment);
  await pointAndClick(
    page,
    list.getByRole("button", { name: "ใส่ Packing List ในใบขนส่ง" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(page.getByRole("dialog")).toContainText(
    `${boxes.length} กล่องรับเข้า`,
  );
}

/** Foodiva: the whole outbound step for one Request — transport document plus a
 * Packing List of `boxes` (kg per กล่องรับเข้า) — saved together. Checks the toast. */
export async function foodivaMakesManifest(
  page: Page,
  shipment: string,
  boxes: string[],
  options: {
    trip?: string;
    plate?: string;
    pickupTime?: string;
    invWeightKg?: string;
    slicedLostKg?: string;
    attachment?: string | UploadFile;
  } = {},
) {
  await foodivaOpensManifest(page, shipment, options);
  await foodivaFillsPackingList(page, boxes, {
    invWeightKg: options.invWeightKg,
    slicedLostKg: options.slicedLostKg,
    attachment: options.attachment ?? INVOICE_FIXTURE,
  });
  await pointAndClick(
    page,
    page.getByRole("button", { name: "บันทึกใบขนส่ง", exact: true }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText(
      "บันทึกใบขนส่งและ Packing List แล้ว · แจ้ง Owner ออก PO รมควัน",
    ),
  ).toBeVisible();
}

/** Owner: issues the smoke PO for a shipment from its Packing List and returns the
 * shipment number. The weight comes from the Packing List, so there is no kg to type.
 *
 * Legacy call (`ownerIssuesSmokePo(page, "500")`, no `shipment`): the Owner can no
 * longer issue a smoke PO straight off a purchase PO, so this first runs the steps in
 * between — Request of `kg` from the first PO with meat left, Foodiva's transport
 * document with one box of `kg` — signing in as Foodiva and back as Owner. */
export async function ownerIssuesSmokePo(
  page: Page,
  kg = "500",
  shipment?: string,
): Promise<string> {
  if (!shipment) {
    shipment = await ownerCreatesShipmentRequest(page, [{ kg }]);
    await signInAs(page, ACCOUNTS.foodiva);
    await foodivaMakesManifest(page, shipment, [kg]);
    await signInAs(page, ACCOUNTS.owner);
  }
  await openMenu(page, "ใบสั่ง PO โรงรมควัน");
  await pointAndClick(
    page,
    tableRow(page, "รายการ PO โรงรมควัน", shipment).getByRole("button", {
      name: "ออก PO รมควันเนื้อ",
    }),
  );
  await field(page, /คำสั่งพิเศษ/, "รมตามมาตรฐาน NerdNuea");
  await button(page, "บันทึก PO รมควันเนื้อ");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  return shipment;
}

/** Signs in as Owner and takes one purchase PO all the way to an issued smoke PO:
 * PO of `orderedKg` → Foodiva invoice → Request of `requestKg` → transport document with
 * `boxes` → smoke PO. Ends signed in as Owner. */
export async function sendMeatToChefHouse(
  page: Page,
  {
    orderedKg = "500",
    requestKg = orderedKg,
    boxes = [requestKg],
    price = "250",
  }: {
    orderedKg?: string;
    requestKg?: string;
    boxes?: string[];
    price?: string;
  } = {},
): Promise<{ poId: string; shipment: string }> {
  await signInAs(page, ACCOUNTS.owner);
  const poId = await ownerCreatesMeatPo(page, orderedKg, price);
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, orderedKg, { poId });
  await signInAs(page, ACCOUNTS.owner);
  const shipment = await ownerCreatesShipmentRequest(page, [
    { poId, kg: requestKg },
  ]);
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaMakesManifest(page, shipment, boxes);
  await signInAs(page, ACCOUNTS.owner);
  await ownerIssuesSmokePo(page, requestKg, shipment);
  return { poId, shipment };
}

/** Chef House, งานผลิต: the action button of a lot row. `match` narrows to the row
 * holding that text (Lot or SO- number); without it the first such button is used. */
export function chefLotButton(page: Page, name: string, match?: string) {
  const rows = page.locator("main").getByRole("row");
  return (match ? rows.filter({ hasText: match }) : rows)
    .getByRole("button", { name, exact: true })
    .first();
}

/** Chef House: "ยืนยันรับ PO รมควัน" on the งานผลิต tab. */
export async function chefAcceptsSmokePo(page: Page, match?: string) {
  await openMenu(page, "งานผลิต");
  await pointAndClick(page, chefLotButton(page, "ยืนยันรับ PO รมควัน", match));
  await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef House");
  await saveEntry(page);
}

/** Chef House, ยืนยันรับเนื้อ: opens the weigh-in for a shipment and types the yellow
 * cells (`received[i]` for box i+1; "" leaves that cell blank) and the arrival time.
 * Leaves the dialog open. */
export async function chefFillsYellowCells(
  page: Page,
  shipment: string,
  received: string[],
  arrival = "08:00",
) {
  await openMenu(page, "ยืนยันรับเนื้อ");
  await pointAndClick(
    page,
    tableRow(page, "การส่งที่รอยืนยันรับ", shipment).getByRole("button", {
      name: "ยืนยันรับเนื้อ",
    }),
  );
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("เวลาที่รถมาถึง").selectOption(arrival);
  for (const [index, kg] of received.entries())
    if (kg)
      await typeValue(
        page,
        dialog.getByLabel(`น้ำหนักจริงกล่องรับเข้าที่ ${index + 1}`, {
          exact: true,
        }),
        kg,
      );
}

/** Chef House: weighs in a shipment with the yellow cells and saves. */
export async function chefReceivesMeat(
  page: Page,
  shipment: string,
  received: string[],
) {
  await chefFillsYellowCells(page, shipment, received);
  await saveEntry(page);
}

/** Chef House: "น้ำหนักก่อนสโมค" for a lot at stage 3. */
export async function chefRecordsPreSmoke(
  page: Page,
  kg: string,
  match?: string,
) {
  await openMenu(page, "งานผลิต");
  await pointAndClick(page, chefLotButton(page, "น้ำหนักก่อนสโมค", match));
  await field(page, /น้ำหนักหลังแกะซับ ก่อนสโมค/, kg);
  await saveEntry(page);
}

/** Chef House: one smoking run — `inputKg` into the smoker, `wasteKg`, and one
 * กล่องรมควัน per `packs` weight (packs + waste must equal input). */
export async function chefSmokes(
  page: Page,
  {
    inputKg,
    wasteKg = "0",
    packs,
  }: { inputKg: string; wasteKg?: string; packs: string[] },
  match?: string,
) {
  await openMenu(page, "งานผลิต");
  await pointAndClick(
    page,
    chefLotButton(page, "บันทึก Lot สโมครายวัน", match),
  );
  await field(page, /น้ำหนักเข้าเตารอบนี้/, inputKg);
  await field(page, /น้ำหนัก Waste/, wasteKg);
  const dialog = page.getByRole("dialog");
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

/** Chef House: "ยืนยันปิด Lot" (stage 5). */
export async function chefClosesLot(page: Page, match?: string) {
  await openMenu(page, "งานผลิต");
  await pointAndClick(page, chefLotButton(page, "ยืนยันปิด Lot", match));
  await field(page, /ชื่อผู้ยืนยันปิด Lot/, "หัวหน้าผลิต Chef House");
  await saveEntry(page);
}

/** Chef House: submits the smoking invoice of a closed lot. */
export async function chefSubmitsInvoice(
  page: Page,
  invoiceNo = "CH-INV-001",
  match?: string,
) {
  await openMenu(page, "งานผลิต");
  await pointAndClick(
    page,
    chefLotButton(page, "สร้าง / Submit ใบวางบิล", match),
  );
  await field(page, /เลข Invoice ค่ารมควัน/, invoiceNo);
  await page
    .getByRole("dialog")
    .locator('input[type="file"]')
    .setInputFiles(INVOICE_FIXTURE);
  await saveEntry(page);
}

/** Signs in as Chef House and runs a shipment from the smoke PO to a closed lot:
 * accept → yellow cells → pre-smoke → one smoking run → close. `packs` + `wasteKg`
 * must equal `preSmokeKg`. Ends signed in as Chef House. */
export async function chefSmokesShipment(
  page: Page,
  shipment: string,
  {
    received,
    preSmokeKg,
    packs,
    wasteKg = "0",
  }: {
    received: string[];
    preSmokeKg: string;
    packs: string[];
    wasteKg?: string;
  },
) {
  await signInAs(page, ACCOUNTS.chef);
  await chefAcceptsSmokePo(page);
  await chefReceivesMeat(page, shipment, received);
  await chefRecordsPreSmoke(page, preSmokeKg);
  await chefSmokes(page, { inputKg: preSmokeKg, wasteKg, packs });
  await chefClosesLot(page);
}

/** Owner, ใบขนส่ง: "เรียกรถขากลับ" for a closed shipment. `returnKg` omitted keeps the
 * prefilled weight (everything produced). Fills the truck unless the outbound trip was
 * "ไปกลับ" and already prefilled it. */
export async function ownerCallsReturnTruck(
  page: Page,
  shipment: string,
  returnKg?: string,
) {
  await openMenu(page, "ใบขนส่ง");
  await pointAndClick(
    page,
    tableRow(page, "รายการส่ง", shipment).getByRole("button", {
      name: /^เรียกรถขากลับ/,
    }),
  );
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("เวลารถรับ").selectOption("10:00");
  for (const [label, value] of [
    ["ประเภทรถ", "รถห้องเย็น 4 ล้อ"],
    ["ทะเบียนรถ", "80-5678 เชียงใหม่"],
    ["ชื่อคนขับ", "สมศักดิ์ ส่งกลับ"],
    ["เบอร์ติดต่อคนขับ", "0822222222"],
  ] as const) {
    const input = dialog.getByLabel(label, { exact: true });
    if (!(await input.inputValue())) await typeValue(page, input, value);
  }
  if (returnKg !== undefined)
    await field(page, /น้ำหนักส่งจาก Chef House/, returnKg);
  await saveEntry(page);
}

/** Foodiva: opens "ยืนยันรับเข้าตู้" for a shipment on the return truck and types the
 * weight (and `reason` when given). Leaves the dialog open. */
export async function foodivaFillsReturnReceive(
  page: Page,
  shipment: string,
  { kg, reason }: { kg: string; reason?: string },
) {
  await openMenu(page, "PO และสต๊อก Foodiva");
  await pointAndClick(
    page,
    tableRow(
      page,
      "เนื้อรมควันขากลับ · รับเข้าตู้ Foodiva",
      shipment,
    ).getByRole("button", { name: "ยืนยันรับเข้าตู้" }),
  );
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("เวลารับ").selectOption("16:00");
  await field(page, /น้ำหนักรับจริง/, kg);
  if (reason) await field(page, /เหตุผลส่วนต่าง/, reason);
}

/** Foodiva: receives the smoked meat of a shipment into the freezer. */
export async function foodivaReceivesReturn(
  page: Page,
  shipment: string,
  options: { kg: string; reason?: string },
) {
  await foodivaFillsReturnReceive(page, shipment, options);
  await saveEntry(page);
}

/** Owner: "รับเข้าสต๊อกกลาง" for the first lot waiting (or the row matching `match`). */
export async function ownerReceivesCentral(
  page: Page,
  kg: string,
  match?: string,
) {
  await openMenu(page, "รับเนื้อเข้าสต๊อกกลาง");
  const rows = page.locator("main").getByRole("row");
  await pointAndClick(
    page,
    (match ? rows.filter({ hasText: match }) : rows)
      .getByRole("button", { name: "รับเข้าสต๊อกกลาง" })
      .first(),
  );
  await field(page, /น้ำหนักรับสต๊อกกลาง/, kg);
  await saveEntry(page);
}

/** Owner, ใบ Invoice: opens "ชำระเงิน" on a Foodiva meat invoice (row of `poId`),
 * attaches `slips` if any, and saves. The amount is prefilled from the invoice. */
export async function ownerPaysMeatInvoice(
  page: Page,
  poId: string,
  slips: UploadFile[] = [],
) {
  await openMenu(page, "ใบ Invoice");
  await pointAndClick(
    page,
    tableRow(page, "Invoice Foodiva", poId).getByRole("button", {
      name: "ชำระเงิน",
    }),
  );
  await field(page, /ผู้ดำเนินการชำระ/, "ฝ่ายบัญชี Owner");
  if (slips.length)
    await page
      .getByRole("dialog")
      .locator('input[type="file"]')
      .setInputFiles(slips);
  await saveEntry(page);
}

/** Owner, ใบ Invoice: "ตรวจยอด" → "รับยอด" on the Chef House invoice of a shipment. */
export async function ownerApprovesSmokingInvoice(
  page: Page,
  shipment: string,
) {
  await openMenu(page, "ใบ Invoice");
  await pointAndClick(
    page,
    tableRow(page, "Invoice Chef House", shipment).getByRole("button", {
      name: "ตรวจยอด",
    }),
  );
  await page
    .getByRole("dialog")
    .getByLabel("ผลการตรวจยอด")
    .selectOption("รับยอด");
  await field(page, /ชื่อผู้ตรวจ/, "Owner");
  await saveEntry(page);
}

/** Owner, ใบ Invoice: pays an approved Chef House invoice, with optional slips. */
export async function ownerPaysSmokingInvoice(
  page: Page,
  shipment: string,
  slips: UploadFile[] = [],
) {
  await openMenu(page, "ใบ Invoice");
  await pointAndClick(
    page,
    tableRow(page, "Invoice Chef House", shipment).getByRole("button", {
      name: "ชำระเงิน",
    }),
  );
  await field(page, /ผู้ดำเนินการชำระ/, "ฝ่ายบัญชี Owner");
  if (slips.length)
    await page
      .getByRole("dialog")
      .locator('input[type="file"]')
      .setInputFiles(slips);
  await saveEntry(page);
}

/** Opens the header bell and returns the list of things to do next. */
export async function openNotifications(page: Page) {
  await pointAndClick(
    page,
    page.getByRole("button", { name: /^การแจ้งเตือน/ }),
  );
  return page.getByLabel("รายการที่ต้องทำต่อ");
}

/** Closes the bell's list (it has its own "ปิด"; Escape does not close it). */
export async function closeNotifications(page: Page) {
  await pointAndClick(
    page,
    page
      .getByLabel("รายการที่ต้องทำต่อ")
      .getByRole("button", { name: "ปิด", exact: true }),
  );
}

/** Chef House must never see purchase data (checklist D): no purchase PO number, no
 * meat price. (The Foodiva invoice number on the Packing List is allowed.) Checks the
 * page and every open dialog; `secrets` are extra strings (a distinctive price) to look for. */
export async function expectNoPurchaseData(page: Page, secrets: string[] = []) {
  const text = await page.locator("body").innerText();
  expect(text, "purchase PO number").not.toMatch(/PO-\d{4}-\d{4}/);
  expect(text, "meat price label").not.toContain("ราคาเนื้อ");
  for (const secret of secrets) expect(text).not.toContain(secret);
}

/* ---- flow steps --------------------------------------------------------- */

/** One named step of a flow spec. Start the title with the actor ("Owner: …",
 * "Foodiva: …", "Chef House: …", "สาขาศาลาแดง: …") so the flow report
 * (scripts/e2e-flow-report.mjs, fed by the JSON reporter) can lay the steps out
 * per role. A viewport screenshot is attached after the body, also when it fails. */
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

/* ---- group C: edit requests and bells (Branch Day B5) ------------------- */

/** A history row (<details>) whose own summary starts with `title`, not the
 * "ขอแก้ไขรายการ · <title>" row an edit request adds next to it. */
export function c_historyEntry(page: Page, title: string) {
  return page
    .locator("main details")
    .filter({
      has: page.locator("summary").filter({ hasText: new RegExp(`^${title}`) }),
    })
    .first();
}

/** Foodiva / Chef House / branch: ประวัติ → own entry → "ขอแก้ไข", types `fields`
 * ([label, value]) and a reason, sends. Asserts the request is waiting. */
export async function c_requestEdit(
  page: Page,
  title: string,
  fields: [label: string | RegExp, value: string][],
  reason: string,
) {
  await openMenu(page, "ประวัติ");
  const entry = c_historyEntry(page, title);
  await pointAndClick(page, entry.locator("summary"));
  await pointAndClick(
    page,
    entry.getByRole("button", { name: "ขอแก้ไข", exact: true }),
  );
  for (const [label, value] of fields)
    await typeValue(page, entry.getByLabel(label), value);
  await typeValue(page, entry.getByLabel("เหตุผลที่ขอแก้ไข"), reason);
  await pointAndClick(
    page,
    entry.getByRole("button", { name: "ส่งคำขอแก้ไข" }),
  );
  await expect(page.getByRole("status")).toContainText("ส่งคำขอแก้ไขแล้ว");
  await expect(entry).toContainText("มีคำขอแก้ไขรอพิจารณา");
  await expect(
    entry.getByRole("button", { name: "ขอแก้ไข", exact: true }),
  ).toHaveCount(0);
}

/** The header bell lists an item containing `text`; closes the list again. */
export async function c_expectBell(page: Page, text: string | RegExp) {
  const list = await openNotifications(page);
  await expect(list).toContainText(text);
  await closeNotifications(page);
}

/** Owner: bell "คำขอแก้ไขรอพิจารณา 1 รายการ" → Log tab → decides the one waiting
 * request (`note` is required to reject). */
export async function c_ownerDecidesEdit(
  page: Page,
  decision: "อนุมัติ" | "ไม่อนุมัติ",
  note = "",
) {
  const list = await openNotifications(page);
  await pointAndClick(
    page,
    list.getByRole("button", { name: /คำขอแก้ไขรอพิจารณา 1 รายการ/ }),
  );
  await expect(page).toHaveURL(/\/owner\/history$/);
  const panel = tableSection(page, "คำขอแก้ไขรายการ");
  await expect(panel).toContainText("รอพิจารณา 1 รายการ");
  if (note) await typeValue(page, panel.getByLabel("หมายเหตุการพิจารณา"), note);
  await pointAndClick(
    page,
    panel.getByRole("button", { name: decision, exact: true }),
  );
  await expect(page.getByRole("status")).toContainText(
    decision === "อนุมัติ" ? "อนุมัติคำขอแล้ว" : "ไม่อนุมัติคำขอแล้ว",
  );
  await expect(panel).toContainText("รอพิจารณา 0 รายการ");
}
