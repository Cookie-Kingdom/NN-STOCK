import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import {
  ACCOUNTS,
  button,
  field,
  pointAndClick,
  sidebar,
  signInAs,
  startFresh,
  tableSection,
} from "./helpers";

const SYSTEM_START_DATE = "2026-10-01";

const MATERIALS = [
  "กล่องพิมพ์ลาย",
  "กระดาษรอง",
  "ถุงซีลเนื้อ",
  "ถุงซีลข้าว",
  "ถุงหิ้วกระดาษ",
  "สติกเกอร์โลโก้",
  "การ์ด / สติกเกอร์วิธีอุ่น",
];

/** Every settings card is edit-locked until "ขอแก้ไข" is pressed, and locks
 * itself again on save. */
async function editSection(
  page: Page,
  title: string,
  fill: () => Promise<void>,
) {
  const section = tableSection(page, title);
  await pointAndClick(
    page,
    section.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
  );
  await fill();
  await pointAndClick(
    page,
    section.getByRole("button", { name: "บันทึกและล็อก (Save & lock)" }),
  );
  await expect(
    section.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
  ).toBeVisible();
}

test("Owner ตั้งค่าทุกอย่างก่อนเริ่มระบบ แล้วค่าที่ตั้งไว้ถูกใช้ต่อในใบ PO", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  // ---- 1. ตั้งค่าทุกช่องให้ครบก่อนเริ่มเดินระบบ -------------------------------
  await button(page, "ตั้งค่า");
  await expect(
    page.getByRole("heading", { name: "ตั้งค่าระบบ (Settings)" }),
  ).toBeVisible();

  await editSection(
    page,
    "ข้อมูลหลักก่อนเริ่มระบบ (System setup)",
    async () => {
      await field(page, "companyName", "บริษัท เนิร์ดเนื้อ (ทดสอบ) จำกัด");
      await field(page, "companyAddress", "99/9 ถนนทดสอบ กรุงเทพมหานคร");
      await field(page, "attention", "ฝ่ายจัดซื้อทดสอบ");
      await field(page, "companyPhone", "0891234567");
      await field(page, "taxId", "0105500000001");
      await fillControl(page, "systemStartDate", SYSTEM_START_DATE);
    },
  );
  const systemSetup = tableSection(
    page,
    "ข้อมูลหลักก่อนเริ่มระบบ (System setup)",
  );
  await expect(systemSetup).toContainText("บริษัท เนิร์ดเนื้อ (ทดสอบ) จำกัด");
  await expect(systemSetup).toContainText(SYSTEM_START_DATE);
  await expect(systemSetup).toContainText("ศาลาแดง, มีนบุรี");

  await editSection(page, "ข้อมูลบนใบ PO (PO document setup)", async () => {
    await page
      .getByLabel("อัปโหลดโลโก้ NerdNuea")
      .setInputFiles(path.join(process.cwd(), "tests/fixtures/logo-demo.png"));
    await expect(page.getByAltText("ตัวอย่างโลโก้ NerdNuea")).toBeVisible();
    await field(page, "foodivaContact", "คุณดีว่า ฝ่ายขาย");
    await field(page, "foodivaAddress", "12 ถนนผู้ขายเนื้อ กรุงเทพฯ");
    await field(page, "chefHouseContact", "หัวหน้าโรงรมควัน");
    await field(page, "chefHouseAddress", "88 ถนนเชียงใหม่-ลำพูน เชียงใหม่");
  });
  // โลโก้ที่อัปโหลดต้องถูกเก็บไว้ใช้กับเอกสารจริง
  await expect(
    tableSection(page, "ข้อมูลบนใบ PO (PO document setup)").getByAltText(
      "โลโก้ NerdNuea",
    ),
  ).toBeVisible();

  await editSection(page, "ราคาและการขาย (Pricing & sales)", async () => {
    await field(page, "boxPrice", "360");
    await field(page, "addonPrice", "330");
    await field(page, "packKg", "0.102");
    await field(page, "chiliPrice", "45");
  });
  const pricing = tableSection(page, "ราคาและการขาย (Pricing & sales)");
  await expect(pricing).toContainText("฿360.00");
  await expect(pricing).toContainText("฿330.00");
  await expect(pricing).toContainText("102.00 กรัม");

  await editSection(page, "วัตถุดิบสาขา (Branch supplies)", async () => {
    await field(page, "rawRicePar", "40");
    await field(page, "rawRiceUnitPrice", "58");
    await field(page, "chiliPar", "25");
    await field(page, "chiliUnitPrice", "21");
    await field(page, "cookedRicePar", "32");
    await field(page, "cookedRiceUnitPrice", "46");
  });
  await expect(
    tableSection(page, "วัตถุดิบสาขา (Branch supplies)"),
  ).toContainText("฿58.00");

  await editSection(
    page,
    "การผลิตและขนส่ง (Production & logistics)",
    async () => {
      await field(page, "outboundFee", "4800");
      await field(page, "returnFee", "4500");
      await field(page, "roundFee", "8800");
    },
  );
  await expect(
    tableSection(page, "การผลิตและขนส่ง (Production & logistics)"),
  ).toContainText("฿4,800.00");

  await editSection(page, "กติกาสาขา (Branch rules)", async () => {
    await tableSection(page, "กติกาสาขา (Branch rules)")
      .getByLabel("branch")
      .selectOption({ label: "ศาลาแดง" });
    await field(page, "tolerance", "15");
    await fillControl(page, "closeTime", "22:30");
  });
  const branchRules = tableSection(page, "กติกาสาขา (Branch rules)");
  await expect(branchRules).toContainText("ศาลาแดง");
  await expect(branchRules).toContainText("15.00");
  await expect(branchRules).toContainText("22:30");

  // วัสดุทุกตัวต้องมีจำนวนฐานและราคา ไม่งั้นระบบจะเตือนค้างไว้
  await editSection(
    page,
    "จำนวนฐานและราคาวัสดุทั้งร้าน (Material par levels & unit prices)",
    async () => {
      for (let index = 0; index < MATERIALS.length; index += 1) {
        await field(page, `material${index}`, String(100 + index));
        await field(page, `materialPrice${index}`, String(2 + index));
      }
    },
  );
  const materialTable = tableSection(
    page,
    "จำนวนฐานและราคาวัสดุทั้งร้าน (Material par levels & unit prices)",
  );
  await expect(materialTable).toContainText("100.00 ชิ้น");
  await expect(materialTable).toContainText("฿2.00 / ชิ้น");

  // ตั้งค่าครบแล้ว แบนเนอร์เตือนและตัวเลขบนเมนูต้องหายไป
  await button(page, "แดชบอร์ด");
  await expect(page.getByText("ตั้งค่าวัสดุยังไม่ครบ")).toHaveCount(0);

  // ---- 2. ค่าที่ตั้งไว้ต้องถูกเติมลงใบ PO ให้อัตโนมัติ ------------------------
  await button(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");
  await expect(page.getByLabel(/ชื่อบริษัท \/ ลูกค้า/)).toHaveValue(
    "บริษัท เนิร์ดเนื้อ (ทดสอบ) จำกัด",
  );
  await expect(page.getByLabel(/ชื่อผู้ติดต่อ/)).toHaveValue(
    "ฝ่ายจัดซื้อทดสอบ",
  );
  await expect(page.getByLabel(/เลขประจำตัวผู้เสียภาษี/)).toHaveValue(
    "0105500000001",
  );
  await expect(page.getByRole("dialog")).toContainText("คุณดีว่า ฝ่ายขาย");
  // โลโก้ที่ตั้งค่าไว้ต้องขึ้นหัวเอกสาร แทนกรอบ "พื้นที่โลโก้"
  await expect(
    page.getByRole("dialog").getByAltText("โลโก้ NerdNuea"),
  ).toBeVisible();

  await field(page, /ผู้ขาย · Foodiva/, "Foodiva");
  await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อถุง");
  await field(page, /น้ำหนักสั่งซื้อ/, "500");
  await field(page, /ราคาเนื้อ/, "250");
  await button(page, "บันทึก PO เนื้อ");

  const poTable = tableSection(page, "รายการใบสั่งซื้อ PO");
  await expect(poTable).toContainText("500.00 กก.");
  await expect(poTable).toContainText("รอ Foodiva ออก Invoice");
});

test("Owner เปิดได้ทุกหน้าจอในเมนูของตัวเอง", async ({ page }) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  const screens: [string, string | RegExp][] = [
    ["ใบสั่งซื้อ PO", "ใบสั่งซื้อเนื้อ (Purchase orders)"],
    ["ใบสั่ง PO โรงรมควัน", /PO โรงรมควัน|ใบสั่งผลิต/],
    ["ใบ Invoice", /Invoice/],
    ["ใบขนส่ง", /ใบขนส่ง/],
    ["รับเนื้อเข้าสต๊อกกลาง", /สต๊อกกลาง/],
    ["จัดสรรเนื้อ และสต๊อกไปสาขา", "จัดสรรเนื้อและสต๊อกไปสาขา"],
    ["สต๊อกของทั้งหมด", "สต๊อกกลางและสาขา"],
    ["เอกสารและ Traceability", /Traceability|เอกสาร/],
    ["Log เนื้อคงเหลือ", /เนื้อคงเหลือ|Log/],
    ["รายงาน", /รายงาน|สรุป/],
    ["ตั้งค่า", "ตั้งค่าระบบ (Settings)"],
  ];

  for (const [menu, heading] of screens) {
    await button(page, menu);
    await expect(
      page.getByRole("heading", { name: heading }).first(),
    ).toBeVisible();
  }

  // เมนูของบทบาทอื่นต้องไม่โผล่ในบัญชี Owner
  const nav = sidebar(page);
  await expect(nav.getByRole("button", { name: "กรอกรายวัน" })).toHaveCount(0);
  await expect(nav.getByRole("button", { name: "งานผลิต" })).toHaveCount(0);
  await expect(
    nav.getByRole("button", { name: "PO และสต๊อก Foodiva" }),
  ).toHaveCount(0);
});

/** Date and time inputs take a whole value at once — typing them key by key
 * leaves the control in a half-filled state. */
async function fillControl(page: Page, label: string, value: string) {
  const input = page.getByLabel(label).last();
  await input.scrollIntoViewIfNeeded();
  await input.fill(value);
  await expect(input).toHaveValue(value);
}
