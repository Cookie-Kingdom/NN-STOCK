import { expect, type Locator, type Page } from "@playwright/test";
import path from "node:path";

export const ACCOUNTS = {
  owner: /Owner เจ้าของร้าน/,
  fooddiva: /Food Diva ผู้ขายเนื้อ/,
  chef: /Chef_house ฝ่ายผลิต/,
  saladaeng: /สาขาศาลาแดง ผู้ดูแลสาขา/,
  minburi: /สาขามีนบุรี ผู้ดูแลสาขา/,
} as const;

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
 * primary button is the stable handle, not the label. */
export async function saveEntry(page: Page) {
  await pointAndClick(page, page.getByRole("dialog").locator("button.primary").last());
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** A table card, addressed by its heading — settings and report screens stack
 * many of them and every one has its own action buttons. */
export function tableSection(page: Page, title: string | RegExp) {
  return page
    .locator("section.table-section")
    .filter({ has: page.getByRole("heading", { name: title }) });
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
  await page.goto("/");
}

/** Each account has its own route, so handing work over means signing out and
 * signing back in as the next account. */
export async function signInAs(page: Page, name: RegExp) {
  const signOut = page.getByRole("button", { name: "ออกจากระบบ" });
  if (await signOut.count()) {
    await pointAndClick(page, signOut);
  }
  await expect(
    page.getByRole("heading", { name: "เลือกบัญชีเพื่อเข้าใช้งาน" }),
  ).toBeVisible();
  await pointAndClick(page, page.getByRole("button", { name }).last());
  await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible();
}

/** Replaces the database with the seven-day sample set, from the owner's own
 * reset dialog. Requires the owner to be signed in. */
export async function loadSampleData(page: Page) {
  await button(page, "รีเซ็ตข้อมูล");
  await pointAndClick(
    page,
    page.getByRole("button", { name: "ข้อมูลตัวอย่าง 7 วัน" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("ข้อมูลตัวอย่าง");
}

/* ---- pipeline steps, so a role spec can build the state it needs ---------- */

export async function ownerCreatesMeatPo(page: Page, orderedKg = "500") {
  await button(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");
  await field(page, /ผู้ขาย · Food Diva/, "Food Diva");
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

export async function foodDivaIssuesInvoice(page: Page, kg = "500") {
  await button(page, /ออกและอัปโหลด Invoice|อัปโหลด Invoice เนื้อ/);
  await field(page, /เลข Invoice เนื้อ/, "FD-INV-001");
  await field(page, /น้ำหนักตาม Invoice/, kg);
  // BR: ส่งไปเชียงใหม่ + เนื้อที่เหลือรอ Owner ต้องรวมเท่ากับน้ำหนักตาม Invoice
  await field(page, /พร้อมส่งไป Chef_house/, kg);
  await field(page, /เนื้อส่วนที่เหลือรอ Owner รับ/, "0");
  await field(page, /ยอดรวม Invoice/, "125000");
  await page.locator('input[type="file"]').setInputFiles(INVOICE_FIXTURE);
  await field(page, /ชื่อผู้ยืนยันจาก Food Diva/, "เจ้าหน้าที่ Food Diva");
  await saveEntry(page);
}

export async function ownerIssuesSmokePo(page: Page, kg = "500") {
  await button(page, "ใบสั่ง PO โรงรมควัน");
  await button(page, "ออก PO รมควันเนื้อ");
  await field(page, /โรงรม \/ ผู้ให้บริการ/, "Chef_house");
  await field(page, /Raw Meat Quantity/, kg);
  await field(page, /คำสั่งพิเศษ/, "รมตามมาตรฐาน NerdNuea");
  await button(page, "บันทึก PO โรงรมควัน");
}
