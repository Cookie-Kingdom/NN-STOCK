import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import {
  ACCOUNTS,
  BRANCH_ACCOUNTS,
  button,
  field,
  menuItem,
  pointAndClick,
  saveEntry,
  signInAs,
  skipUnlessCredentials,
  startFresh,
  tableSection,
} from "./helpers";

/* The QA team's data walk (vault: QA-REPORT.md, PO-2026-0002 / Lot F260916-002):
 * 100 kg ordered, 90 kg shipped + 10 kg waste kept for Owner, 88 kg weighed in at
 * Chef_house, 85 kg to the smoker, 80 kg packed in two 40 kg bags, 79 kg received
 * back at Foodiva. Every loss in that walk exposed a bug (BUG-1, 4, 6, 7, 10),
 * so the numbers here are load-bearing. */

/** Submits the open dialog and expects it to stay open with a validation message. */
async function submitAndExpectError(page: Page, message: RegExp) {
  const dialog = page.getByRole("dialog").last();
  await pointAndClick(page, dialog.locator('button[type="submit"]').last());
  await expect(
    dialog.getByRole("alert").filter({ hasText: message }),
  ).toBeVisible();
}

test("full business loop across Owner, Foodiva, Chef_house and both branches", async ({
  page,
}) => {
  skipUnlessCredentials(
    ACCOUNTS.owner,
    ACCOUNTS.foodiva,
    ACCOUNTS.chef,
    ACCOUNTS.saladaeng,
    ACCOUNTS.minburi,
  );
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();
  await page.waitForTimeout(900);

  // Owner purchases chili centrally, then allocates opening stock to both branches.
  await button(page, "สต๊อกของทั้งหมด");
  await button(page, "+ บันทึกการซื้ออื่น ๆ");
  await page
    .getByLabel("เลือกวัตถุดิบ 1")
    .selectOption({ label: "น้ำพริกหลอด" });
  await field(page, "จำนวน 1", "20");
  await field(page, "ราคาต่อหน่วย 1", "20");
  await field(page, "ผู้จำหน่าย 1", "ครัวน้ำพริกทดสอบ");
  await field(page, "ใบเสร็จ 1", "CHILI-001");
  await button(page, "บันทึก 1 รายการ");

  for (const branch of ["ศาลาแดง", "มีนบุรี"]) {
    await button(page, "จัดสรรน้ำพริกไปสาขา");
    await page.getByLabel(/สาขาปลายทาง/).selectOption({ label: branch });
    await field(page, /จำนวนน้ำพริกที่จัดสรร/, "10");
    await field(page, /ผู้รับ \/ ผู้ดูแลสาขา/, `ผู้ดูแล${branch}`);
    await field(page, /เลขที่อ้างอิงใบส่งของ/, `CH-${branch}`);
    await saveEntry(page);
  }

  // Owner creates the meat PO (100 kg @ 250) with live document preview.
  await button(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");
  // BUG-10c: the supplier is prefilled, the form no longer blocks silently on it.
  await expect(page.getByLabel(/ผู้ขาย · Foodiva/).last()).toHaveValue(
    "Foodiva",
  );
  await field(page, /ชื่อบริษัท \/ ลูกค้า/, "บริษัท เนิร์ดเนื้อ จำกัด");
  await field(page, /ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร");
  await field(page, /ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ");
  await field(page, /เบอร์ติดต่อ/, "0800000000");
  await field(page, /เลขประจำตัวผู้เสียภาษี/, "0100000000000");
  await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อถุง");
  await field(page, /น้ำหนักสั่งซื้อ/, "100");
  await field(page, /ราคาเนื้อ/, "250");
  await field(page, /หมายเหตุ/, "QA TEST loop");
  await button(page, "บันทึก PO เนื้อ");

  // Foodiva uploads the supplier invoice: 90 kg to Chef_house, 10 kg waste for Owner.
  await signInAs(page, ACCOUNTS.foodiva);
  await button(page, /ออกและอัปโหลด Invoice|อัปโหลด Invoice เนื้อ/);
  await field(page, /เลข Invoice เนื้อ/, "FD-INV-001");
  await field(page, /น้ำหนักตาม Invoice/, "100");
  await field(page, /พร้อมส่งไป Chef_house/, "90");
  await field(page, /เนื้อส่วนที่เหลือรอ Owner รับ/, "10");
  await field(page, /ยอดรวม Invoice/, "25000");
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(process.cwd(), "tests/fixtures/invoice-demo.pdf"));
  await field(page, /ชื่อผู้ยืนยันจาก Foodiva/, "เจ้าหน้าที่ Foodiva");
  await saveEntry(page);

  // Owner issues the Chef_house service PO for the 90 kg that ship.
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "ใบสั่ง PO โรงรมควัน");
  await button(page, "ออก PO รมควันเนื้อ");
  await field(page, /โรงรม \/ ผู้ให้บริการ/, "Chef_house");
  await field(page, /Raw Meat Quantity/, "90");
  await field(page, /คำสั่งพิเศษ/, "รมตามมาตรฐาน NerdNuea");
  await button(page, "บันทึก PO รมควันเนื้อ");

  // Chef_house accepts the PO and submits its invoice.
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
    .setInputFiles(path.join(process.cwd(), "tests/fixtures/invoice-demo.pdf"));
  await field(page, /รายละเอียดเพิ่มเติม/, "ค่าบริการรมควันเนื้อ 90 กก.");
  await button(page, "Submit ใบวางบิล");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Owner reviews, pays 90 kg x 220, and creates the outbound transport document.
  await signInAs(page, ACCOUNTS.owner);
  await button(page, /ใบ Invoice/);
  await button(page, "ตรวจยอด");
  await field(page, /ชื่อผู้ตรวจ/, "Owner Demo");
  await saveEntry(page);
  await button(page, "ชำระเงิน");
  await field(page, /ยอดชำระ/, "19800");
  await field(page, /ผู้ดำเนินการชำระ/, "Owner Demo");
  await field(page, /เลขอ้างอิงการชำระ/, "PAY-001");
  await saveEntry(page);
  await button(page, "ใบขนส่ง");
  await button(page, "ทำใบขนส่งขาไป");
  // BUG-10a: the outbound trip defaults to Bangkok → Chiang Mai, not Chiang Mai → Chiang Mai.
  await expect(page.getByLabel(/ต้นทาง/)).toHaveValue("กรุงเทพฯ");
  await expect(page.getByLabel(/ปลายทาง/)).toHaveValue("เชียงใหม่");
  await field(page, /เวลารถรับ/, "06:30");
  await field(page, /ประเภทรถ/, "รถห้องเย็น");
  await field(page, /ทะเบียนรถ/, "กท 1001");
  await field(page, /ชื่อคนขับ/, "คนขับทดสอบ");
  await field(page, /เบอร์ติดต่อคนขับ/, "0811111111");
  await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, "90");
  await saveEntry(page);

  // Chef_house weighs in 88 kg, trims to 85 kg, smokes into two 40 kg bags, closes the lot.
  await signInAs(page, ACCOUNTS.chef);
  await pointAndClick(page, menuItem(page, "ยืนยันรับเนื้อ"));
  // BUG-10d: the waiting-lot table names the truck instead of "-".
  const waitingLots = tableSection(page, "Lot ที่รอยืนยันรับ");
  await expect(
    waitingLots.getByRole("row").filter({ hasText: "90.00 กก." }),
  ).toContainText("กท 1001");
  await pointAndClick(
    page,
    waitingLots.getByRole("button", { name: "ยืนยันรับเนื้อ" }),
  );
  await page.getByLabel(/เวลาที่รถมาถึง/).selectOption({ label: "08:00" });
  await field(page, /น้ำหนักรับจริง/, "88");
  await saveEntry(page);
  await button(page, "งานผลิต");
  await button(page, "น้ำหนักก่อนสโมค");
  await field(page, /น้ำหนักหลังแกะซับ/, "200");
  await submitAndExpectError(page, /เกิน/);
  await field(page, /น้ำหนักหลังแกะซับ/, "85");
  await saveEntry(page);
  await button(page, "บันทึก Lot สโมครายวัน");
  await field(page, /น้ำหนักเข้าเตารอบนี้/, "85");
  await field(page, /น้ำหนัก Waste/, "5");
  await field(page, "น้ำหนักถุงที่ 1", "40");
  await button(page, "เพิ่มถุง");
  await field(page, "น้ำหนักถุงที่ 2", "40");
  await saveEntry(page);
  await button(page, "ยืนยันปิด Lot");
  await field(page, /ชื่อผู้ยืนยันปิด Lot/, "หัวหน้าผลิต Chef_house");
  await saveEntry(page);

  // Owner books the return trip for 80 kg; Foodiva receives 79 kg (drip loss).
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "ใบขนส่ง");
  await button(page, /เรียกรถขากลับ/);
  await field(page, /เวลารถรับจาก Chef_house|เวลารถรับ/, "09:00");
  await page.getByLabel(/ต้นทาง/).selectOption({ label: "เชียงใหม่" });
  await page.getByLabel(/ปลายทาง/).selectOption({ label: "กรุงเทพฯ" });
  await field(page, /ประเภทรถ/, "รถห้องเย็น");
  await field(page, /ทะเบียนรถ/, "กท 1002");
  await field(page, /ชื่อคนขับ/, "คนขับขากลับ");
  await field(page, /เบอร์ติดต่อคนขับ/, "0822222222");
  await field(page, /น้ำหนักส่งจาก Chef_house/, "80");
  await saveEntry(page);
  await signInAs(page, ACCOUNTS.foodiva);
  await button(page, "ยืนยันรับเข้าตู้");
  await field(page, /เวลารับ/, "10:00");
  await field(page, /น้ำหนักรับจริง/, "79");
  await field(page, /จำนวนถุงที่รับ/, "2");
  await saveEntry(page);

  // Owner receives 79 kg into central stock and allocates one bag to each branch.
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "รับเนื้อเข้าสต๊อกกลาง");
  await button(page, "รับเข้าสต๊อกกลาง");
  await field(page, /น้ำหนักรับสต๊อกกลาง/, "79");
  await field(page, /หมายเหตุ/, "QA TEST central receive");
  await saveEntry(page);
  await button(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
  await button(page, "จัดสรร");
  // BUG-1: the two 40 kg bags are pro-rated to the 79 kg that reached central stock,
  // so the second bag no longer sits in the warehouse forever.
  const allocationDialog = page.getByRole("dialog").last();
  await expect(
    allocationDialog.getByRole("row").filter({ hasText: "ถุงที่ 1" }),
  ).toContainText("39.50 กก.");
  await expect(
    allocationDialog.getByRole("row").filter({ hasText: "ถุงที่ 2" }),
  ).toContainText("39.50 กก.");
  const destinations = allocationDialog.locator("tbody select");
  await expect(destinations).toHaveCount(2);
  await destinations.nth(0).selectOption({ label: "ศาลาแดง" });
  await destinations.nth(1).selectOption({ label: "มีนบุรี" });
  await button(page, "บันทึกการจัดสรร");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Step 23: Owner collects the 10 kg waste share Foodiva kept back.
  await button(page, "สต๊อกของทั้งหมด");
  await button(page, "บันทึกรับเนื้อ");
  await field(page, /น้ำหนักรับจริง/, "10");
  await field(page, /ผู้รับเนื้อ/, "Owner QA");
  await saveEntry(page);

  // BUG-6: the Owner weight check compares against what left Foodiva (90), not the invoice (100).
  await button(page, "ใบขนส่ง");
  await expect(page.getByText("ส่งจาก Foodiva: 90.00 กก.")).toBeVisible();
  await expect(page.getByText(/ส่วนต่าง 2\.00 กก\./)).toBeVisible();

  // BUG-7: the 3 kg trimmed before smoking is named as loss, nothing is left waiting at Chef_house.
  await button(page, "Log เนื้อคงเหลือ");
  await expect(
    page.getByRole("row").filter({ hasText: "Chef_house · Waste ก่อนสโมค" }),
  ).toContainText("3.00 กก.");
  await expect(
    page.getByRole("row").filter({ hasText: "Chef_house · รอเข้ารอบสโมค" }),
  ).toContainText("0.00 กก.");

  // BUG-4: the printed PO keeps its own note; the central-receive note must not overwrite it.
  await button(page, "ใบสั่งซื้อ PO");
  const popupPromise = page.waitForEvent("popup");
  await button(page, "พิมพ์ / PDF");
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.locator("body")).toContainText("QA TEST loop");
  await expect(popup.locator("body")).not.toContainText(
    "QA TEST central receive",
  );
  await popup.close();

  // Each branch receives its 39.5 kg bag, thaws, records rice/materials/sales, and closes the day.
  // Minburi completing this loop is the BUG-1 proof: QA could never allocate its bag.
  for (const branch of ["ศาลาแดง", "มีนบุรี"] as const) {
    await signInAs(page, BRANCH_ACCOUNTS[branch]);
    await button(page, "รับของ");
    await page.getByLabel("ใบจัดสรรที่รับ").selectOption({ index: 1 });
    await field(page, /น้ำหนักรับเข้าสาขา/, "39.5");
    await field(page, /จำนวนถุงที่รับ/, "1");
    await saveEntry(page);
    await button(page, "แบ่งละลาย");
    await field(page, /น้ำหนักละลาย/, "50");
    await field(page, /จำนวนถุงที่ละลาย/, "1");
    await submitAndExpectError(page, /ไม่พอ/);
    await field(page, /น้ำหนักละลาย/, "10");
    await saveEntry(page);
    await button(page, "บันทึกการใช้วัสดุ");

    const riceTableTitle =
      branch === "ศาลาแดง"
        ? "ข้าวเหนียวดิบ · ซื้อที่สาขาศาลาแดง"
        : "ข้าวเหนียวสุก · ซื้อที่สาขามีนบุรี";
    const riceTable = tableSection(page, riceTableTitle);
    await pointAndClick(
      page,
      riceTable.getByRole("button", { name: "กรอกข้อมูล" }).nth(0),
    );
    await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าวทดสอบ");
    if (branch === "ศาลาแดง") {
      await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "5");
      await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "275");
    } else {
      await field(page, /ข้าวเหนียวสุกซื้อเข้า/, "32");
      await field(page, /ยอดซื้อข้าวเหนียวสุก/, "1440");
    }
    await saveEntry(page);

    if (branch === "ศาลาแดง") {
      await pointAndClick(
        page,
        riceTable.getByRole("button", { name: "กรอกข้อมูล" }).nth(1),
      );
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "1");
      await field(page, /ผู้รับของ/, "ผู้ดูแลศาลาแดง");
      await saveEntry(page);
      await pointAndClick(
        page,
        riceTable.getByRole("button", { name: "กรอกข้อมูล" }).nth(2),
      );
      await field(page, /ข้าวเหนียวดิบที่นำมาหุง/, "1");
      await field(page, /ข้าวเหนียวสุกที่ได้/, "1");
      await saveEntry(page);
    }

    // Closing the day needs the thawed meat sold or wasted to zero, so the
    // 9.9 kg left after the 0.1 kg sale is written off with a reason (BUG-3 positive path).
    await button(page, "บันทึกยอดขาย");
    await field(page, /กล่องมาตรฐาน/, "1");
    await field(page, /น้ำพริกหลอด/, "1");
    await field(page, /ตรวจนับน้ำพริกจริง/, "9");
    await field(
      page,
      /หมายเหตุเมื่อน้ำพริกไม่ตรง/,
      "ตรวจนับจริงต่างจากยอดระบบเพื่อทดสอบการบันทึกเหตุผล",
    );
    await field(page, /น้ำหนักเนื้อซีลพร้อมขาย/, "0.1");
    await field(page, /Waste เนื้อจาก Lot นี้/, "9.9");
    await field(page, /ยอดขาย LINE MAN/, "380");
    await field(page, /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/, "QA TEST waste");
    await saveEntry(page);

    if (branch === "มีนบุรี") {
      await pointAndClick(
        page,
        riceTable.getByRole("button", { name: "กรอกข้อมูล" }).nth(1),
      );
      await field(page, /ข้าวเหนียวสุกเหลือปลายวัน/, "31.8");
      await field(
        page,
        /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/,
        "ใช้ข้าวเหนียวสุก 0.2 กก. กับกล่องมาตรฐานวันนี้",
      );
      await saveEntry(page);
    }
    await button(page, "ปิดวัน");
    await field(page, /เวลาจำลองสำหรับทดสอบปิดวัน/, "18:00");
    await field(page, /ชื่อผู้ยืนยันปิดวัน/, `ผู้ดูแล${branch}`);
    await submitAndExpectError(page, /ปิดวันได้ตั้งแต่ 22:00/);
    await field(page, /เวลาจำลองสำหรับทดสอบปิดวัน/, "22:00");
    await saveEntry(page);
  }

  // BUG-10e: traceability follows the lot past the return trip into central stock, branches and sales.
  await signInAs(page, ACCOUNTS.owner);
  await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();
  await button(page, "เอกสารและ Traceability");
  await pointAndClick(
    page,
    page.getByRole("button", { name: "ดู", exact: true }),
  );
  // The detail table sits inside an expanded row, so `.last()` picks the inner row.
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "รับเข้าสต๊อกกลาง" })
      .filter({ hasText: "79.00 กก." })
      .last(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "จัดสรรไปสาขา" })
      .filter({ hasText: "2 ใบ" })
      .last(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "ขายที่สาขา" })
      .filter({ hasText: "2 วัน" })
      .last(),
  ).toBeVisible();
  await page.waitForTimeout(1_500);
});
