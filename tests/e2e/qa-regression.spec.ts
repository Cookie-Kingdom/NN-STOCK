import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  field,
  foodivaIssuesInvoice,
  INVOICE_FIXTURE,
  menuItem,
  ownerCreatesMeatPo,
  ownerIssuesSmokePo,
  pointAndClick,
  saveEntry,
  signInAs,
  skipUnlessCredentials,
  startFresh,
  tableSection,
} from "./helpers";

/* Form-level regressions from the QA report (vault: QA-REPORT.md). The 10-step
 * data walk itself lives in full-loop.spec.ts; these are the bugs that showed up
 * in a single dialog and can be reproduced without the whole loop. */

const MATERIALS = [
  "กล่องพิมพ์ลาย",
  "กระดาษรอง",
  "ถุงซีลเนื้อ",
  "ถุงซีลข้าว",
  "ถุงหิ้วกระดาษ",
  "สติกเกอร์โลโก้",
  "การ์ด / สติกเกอร์วิธีอุ่น",
];

const openDialog = (page: Page) => page.getByRole("dialog").last();

/** Submits the open dialog and expects it to stay open with a validation message. */
async function submitAndExpectError(page: Page, message: RegExp) {
  const dialog = openDialog(page);
  await pointAndClick(page, dialog.locator('button[type="submit"]').last());
  await expect(
    dialog.getByRole("alert").filter({ hasText: message }),
  ).toBeVisible();
}

async function cancelDialog(page: Page) {
  await pointAndClick(
    page,
    openDialog(page).getByRole("button", { name: "ยกเลิก" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Settings cards are edit-locked until "ขอแก้ไข" is pressed (see owner.spec.ts). */
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

test("BUG-2 / BUG-9: material purchase is saved, reaches the branch and unlocks the daily count", async ({
  page,
}) => {
  skipUnlessCredentials(ACCOUNTS.owner, ACCOUNTS.saladaeng);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  // A transfer needs a par level and unit price per material (QA set 500 / ฿1.00).
  await button(page, "ตั้งค่า");
  await editSection(
    page,
    "จำนวนฐานและราคาวัสดุทั้งร้าน (Material par levels & unit prices)",
    async () => {
      for (let index = 0; index < MATERIALS.length; index += 1) {
        await field(page, `material${index}`, "500");
        await field(page, `materialPrice${index}`, "1");
      }
    },
  );

  await button(page, "สต๊อกของทั้งหมด");
  await button(page, "+ ซื้อวัสดุเข้าคลัง");
  const purchase = openDialog(page);

  // Negative: a missing supplier is blocked by the native `required`, the dialog stays open.
  await purchase.getByLabel(`ซื้อ ${MATERIALS[0]}`).check();
  await field(page, `จำนวนซื้อ ${MATERIALS[0]}`, "500");
  await field(page, `ราคาซื้อ ${MATERIALS[0]}`, "1");
  await pointAndClick(page, purchase.locator('button[type="submit"]'));
  await expect(purchase).toBeVisible();
  await expect(purchase.getByLabel(`ผู้จำหน่าย ${MATERIALS[0]}`)).toHaveValue(
    "",
  );

  // BUG-2: all seven lines save in one request and land in Owner stock.
  await field(page, `ผู้จำหน่าย ${MATERIALS[0]}`, "ร้านวัสดุ QA");
  for (const material of MATERIALS.slice(1)) {
    await purchase.getByLabel(`ซื้อ ${material}`).check();
    await field(page, `จำนวนซื้อ ${material}`, "500");
    await field(page, `ราคาซื้อ ${material}`, "1");
    await field(page, `ผู้จำหน่าย ${material}`, "ร้านวัสดุ QA");
  }
  await button(page, "บันทึกการซื้อ 7 รายการ");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: MATERIALS[0] })
      .filter({ hasText: "คลัง Owner" })
      .first(),
  ).toContainText("500");

  // BUG-2 chain: with stock in the warehouse the transfer to a branch goes through.
  await button(page, "ส่งวัสดุไปสาขา");
  const transfer = openDialog(page);
  await transfer.getByLabel(`ส่ง ${MATERIALS[0]} ไปศาลาแดง`).check();
  await field(page, `จำนวน ${MATERIALS[0]} ไปศาลาแดง`, "100");
  await field(page, "ผู้รับของสาขาศาลาแดง", "ผู้ดูแลศาลาแดง");
  await button(page, "บันทึกส่งวัสดุ");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The branch confirms the receipt, and the daily count opens up to the 100 received.
  await signInAs(page, ACCOUNTS.saladaeng);
  await pointAndClick(page, menuItem(page, "กรอกรายวัน"));
  await field(page, `จำนวนที่รับจริง ${MATERIALS[0]}`, "100");
  await field(page, "ชื่อผู้รับจริง", "ผู้ดูแลศาลาแดง");
  await button(page, "ยืนยันรับ");
  await expect(page.getByText(`ยืนยันรับ ${MATERIALS[0]} แล้ว`)).toBeVisible();

  const daily = tableSection(page, "วัสดุ 7 รายการ · กรอกการใช้วันนี้");
  await expect(
    daily.getByLabel(`จำนวนใช้ ${MATERIALS[0]} วันนี้`),
  ).toHaveAttribute("max", "100");
  const boxRow = daily.getByRole("row").filter({ hasText: MATERIALS[0] });
  await expect(boxRow).not.toContainText("Owner ยังไม่ตั้งฐาน");
  await expect(boxRow).toContainText("รอบันทึก");
  // BUG-9: a par level is set, so a material still in the warehouse waits for Owner, it is not "unset".
  await expect(
    daily.getByRole("row").filter({ hasText: MATERIALS[1] }),
  ).toContainText("รอ Owner ส่งวัสดุมาสาขา");
});

test("BUG-10f: the report total names the ETC purchases as already included", async ({
  page,
}) => {
  skipUnlessCredentials(ACCOUNTS.owner);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "รายงาน");
  await expect(page.getByText("ต้นทุนรวมทั้งหมด")).toBeVisible();
  await expect(page.getByText("↳ ซื้อวัตถุดิบ / ETC")).toBeVisible();
});

test("BUG-10a / BUG-5 / BUG-3 / BUG-10b: dialogs reject bad input out loud along the loop", async ({
  page,
}) => {
  skipUnlessCredentials(
    ACCOUNTS.owner,
    ACCOUNTS.foodiva,
    ACCOUNTS.chef,
    ACCOUNTS.saladaeng,
  );
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await ownerCreatesMeatPo(page, "500");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "500");
  await signInAs(page, ACCOUNTS.owner);
  await ownerIssuesSmokePo(page, "500");

  await signInAs(page, ACCOUNTS.chef);
  await button(page, "งานผลิต");
  await button(page, "ยืนยันรับ PO รมควัน");
  await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef_house");
  await saveEntry(page);
  await button(page, "สร้าง / Submit ใบวางบิล");
  await field(page, /เลข Invoice ค่ารมควัน/, "CH-INV-001");
  await page
    .getByRole("dialog")
    .locator('input[type="file"]')
    .setInputFiles(INVOICE_FIXTURE);
  await field(page, /รายละเอียดเพิ่มเติม/, "ค่าบริการรมควันเนื้อ 500 กก.");
  await button(page, "Submit ใบวางบิล");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await signInAs(page, ACCOUNTS.owner);
  await button(page, /ใบ Invoice/);
  // BUG-5: the Foodiva invoice Foodiva uploaded comes back as a real download.
  const downloadPromise = page.waitForEvent("download");
  await pointAndClick(
    page,
    tableSection(page, "Invoice Foodiva").getByRole("button", {
      name: "ดาวน์โหลด",
    }),
  );
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);

  await button(page, "ตรวจยอด");
  await field(page, /ชื่อผู้ตรวจ/, "Owner Demo");
  await saveEntry(page);
  await button(page, "ชำระเงิน");
  await field(page, /ยอดชำระ/, "110000");
  await field(page, /ผู้ดำเนินการชำระ/, "Owner Demo");
  await field(page, /เลขอ้างอิงการชำระ/, "PAY-001");
  await saveEntry(page);

  // BUG-10a: origin = destination is rejected with a message instead of saving.
  await button(page, "ใบขนส่ง");
  await button(page, "ทำใบขนส่งขาไป");
  await page.getByLabel(/ต้นทาง/).selectOption({ label: "เชียงใหม่" });
  await page.getByLabel(/ปลายทาง/).selectOption({ label: "เชียงใหม่" });
  await field(page, /เวลารถรับ/, "06:30");
  await field(page, /ประเภทรถ/, "รถห้องเย็น");
  await field(page, /ทะเบียนรถ/, "กท 1001");
  await field(page, /ชื่อคนขับ/, "คนขับทดสอบ");
  await field(page, /เบอร์ติดต่อคนขับ/, "0811111111");
  await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, "500");
  await submitAndExpectError(page, /ต้นทางและปลายทางต้องต่างกัน/);
  await page.getByLabel(/ต้นทาง/).selectOption({ label: "กรุงเทพฯ" });
  await saveEntry(page);

  // Chef_house: 500 kg in, one 500 kg bag out, lot closed.
  await signInAs(page, ACCOUNTS.chef);
  await button(page, "ยืนยันรับเนื้อ");
  await page.getByLabel(/เวลาที่รถมาถึง/).selectOption({ label: "08:00" });
  await field(page, /น้ำหนักรับจริง/, "500");
  await saveEntry(page);
  await button(page, "งานผลิต");
  await button(page, "น้ำหนักก่อนสโมค");
  await field(page, /น้ำหนักหลังแกะซับ/, "500");
  await saveEntry(page);
  await button(page, "บันทึก Lot สโมครายวัน");
  await field(page, /น้ำหนักเข้าเตารอบนี้/, "500");
  await field(page, "น้ำหนักถุงที่ 1", "500");
  await saveEntry(page);
  await button(page, "ยืนยันปิด Lot");
  await field(page, /ชื่อผู้ยืนยันปิด Lot/, "หัวหน้าผลิต Chef_house");
  await saveEntry(page);

  // Return trip, Foodiva intake, central stock, one bag to Saladaeng.
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "ใบขนส่ง");
  await button(page, /เรียกรถขากลับ/);
  await field(page, /เวลารถรับจาก Chef_house|เวลารถรับ/, "09:00");
  await field(page, /ประเภทรถ/, "รถห้องเย็น");
  await field(page, /ทะเบียนรถ/, "กท 1002");
  await field(page, /ชื่อคนขับ/, "คนขับขากลับ");
  await field(page, /เบอร์ติดต่อคนขับ/, "0822222222");
  await field(page, /น้ำหนักส่งจาก Chef_house/, "500");
  await saveEntry(page);
  await signInAs(page, ACCOUNTS.foodiva);
  await button(page, "ยืนยันรับเข้าตู้");
  await field(page, /เวลารับ/, "10:00");
  await field(page, /น้ำหนักรับจริง/, "500");
  await field(page, /จำนวนถุงที่รับ/, "1");
  await saveEntry(page);
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "รับเนื้อเข้าสต๊อกกลาง");
  await button(page, "รับเข้าสต๊อกกลาง");
  await field(page, /น้ำหนักรับสต๊อกกลาง/, "500");
  await saveEntry(page);
  await button(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
  await button(page, "จัดสรร");
  await openDialog(page)
    .locator("tbody select")
    .nth(0)
    .selectOption({ label: "ศาลาแดง" });
  await button(page, "บันทึกการจัดสรร");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Saladaeng receives the bag and thaws 0.5 kg.
  await signInAs(page, ACCOUNTS.saladaeng);
  await button(page, "รับของ");
  await page.getByLabel("ใบจัดสรรที่รับ").selectOption({ index: 1 });
  await field(page, /น้ำหนักรับเข้าสาขา/, "500");
  await field(page, /จำนวนถุงที่รับ/, "1");
  await saveEntry(page);
  await button(page, "แบ่งละลาย");
  await field(page, /น้ำหนักละลาย/, "0.5");
  await field(page, /จำนวนถุงที่ละลาย/, "1");
  await saveEntry(page);

  // BUG-3: the sales form now says why it refuses to save.
  await button(page, "บันทึกยอดขาย");
  await field(page, /Waste เนื้อจาก Lot นี้/, "0.05");
  await submitAndExpectError(page, /เหตุผล Waste/);
  await field(page, /Waste เนื้อจาก Lot นี้/, "0");
  await field(page, /กล่องมาตรฐาน/, "6");
  await field(page, /น้ำหนักเนื้อซีลพร้อมขาย/, "0.6");
  await submitAndExpectError(page, /เกินเนื้อพร้อมขาย/);
  // A valid sale: nothing sold, the thawed 0.5 kg written off with a reason.
  await field(page, /กล่องมาตรฐาน/, "0");
  await field(page, /น้ำหนักเนื้อซีลพร้อมขาย/, "0");
  await field(page, /Waste เนื้อจาก Lot นี้/, "0.5");
  await field(page, /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/, "QA TEST waste");
  await saveEntry(page);

  // BUG-3: the influencer box form refuses over-stock out loud too.
  await pointAndClick(
    page,
    page
      .getByRole("row")
      .filter({ hasText: "บันทึกกล่องโปรโมทให้อินฟลูเอนเซอร์" })
      .getByRole("button", { name: "กรอกข้อมูล" }),
  );
  await field(page, /ชื่ออินฟลูเอนเซอร์/, "QA Influencer");
  await field(page, /กล่องมาตรฐานที่ส่ง/, "6");
  await field(page, /น้ำหนักเนื้อที่ส่งจาก Lot นี้/, "0.6");
  await submitAndExpectError(page, /เกิน|ไม่พอ/);
  await cancelDialog(page);

  // BUG-10b: the close-day hint no longer quotes 21:00 while the setting says 22:00.
  await button(page, "ปิดวัน");
  const closeDay = openDialog(page);
  await expect(
    closeDay.getByText(/ปิดวันได้ตั้งแต่เวลาเริ่มปิดวันในตั้งค่า/),
  ).toBeVisible();
  await expect(closeDay.getByText(/21:00/)).toHaveCount(0);
  await cancelDialog(page);
});
