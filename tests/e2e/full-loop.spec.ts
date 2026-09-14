import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  button,
  field,
  pointAndClick,
  saveEntry,
  signInAs,
  startFresh,
} from "./helpers";

test("full business loop across Owner, Food Diva, Chef_house and both branches", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, /Owner เจ้าของร้าน/);
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

  // Owner creates the meat PO with live document preview.
  await button(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");
  await field(page, /ผู้ขาย · Food Diva/, "Food Diva");
  await field(page, /ชื่อบริษัท \/ ลูกค้า/, "บริษัท เนิร์ดเนื้อ จำกัด");
  await field(page, /ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร");
  await field(page, /ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ");
  await field(page, /เบอร์ติดต่อ/, "0800000000");
  await field(page, /เลขประจำตัวผู้เสียภาษี/, "0100000000000");
  await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อถุง");
  await field(page, /น้ำหนักสั่งซื้อ/, "500");
  await field(page, /ราคาเนื้อ/, "250");
  await button(page, "บันทึก PO เนื้อ");

  // Food Diva uploads the supplier invoice.
  await signInAs(page, /Food Diva ผู้ขายเนื้อ/);
  await button(page, /ออกและอัปโหลด Invoice|อัปโหลด Invoice เนื้อ/);
  await field(page, /เลข Invoice เนื้อ/, "FD-INV-001");
  await field(page, /น้ำหนักตาม Invoice/, "500");
  await field(page, /พร้อมส่งไป Chef_house/, "500");
  await field(page, /เนื้อส่วนที่เหลือรอ Owner รับ/, "0");
  await field(page, /ยอดรวม Invoice/, "125000");
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(process.cwd(), "tests/fixtures/invoice-demo.pdf"));
  await field(page, /ชื่อผู้ยืนยันจาก Food Diva/, "เจ้าหน้าที่ Food Diva");
  await saveEntry(page);

  // Owner issues the Chef_house service PO.
  await signInAs(page, /Owner เจ้าของร้าน/);
  await button(page, "ใบสั่ง PO โรงรมควัน");
  await button(page, "ออก PO รมควันเนื้อ");
  await field(page, /โรงรม \/ ผู้ให้บริการ/, "Chef_house");
  await field(page, /Raw Meat Quantity/, "500");
  await field(page, /คำสั่งพิเศษ/, "รมตามมาตรฐาน NerdNuea");
  await button(page, "บันทึก PO โรงรมควัน");

  // Chef_house accepts the PO and submits its invoice.
  await signInAs(page, /Chef_house ฝ่ายผลิต/);
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
  await field(page, /รายละเอียดเพิ่มเติม/, "ค่าบริการรมควันเนื้อ 500 กก.");
  await button(page, "Submit ใบวางบิล");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Owner reviews, pays, and creates the outbound transport document.
  await signInAs(page, /Owner เจ้าของร้าน/);
  await button(page, /ใบ Invoice/);
  await button(page, "ตรวจยอด");
  await field(page, /ชื่อผู้ตรวจ/, "Owner Demo");
  await saveEntry(page);
  await button(page, "ชำระเงิน");
  await field(page, /ยอดชำระ/, "110000");
  await field(page, /ผู้ดำเนินการชำระ/, "Owner Demo");
  await field(page, /เลขอ้างอิงการชำระ/, "PAY-001");
  await saveEntry(page);
  await button(page, "ใบขนส่ง");
  await button(page, "ทำใบขนส่งขาไป");
  await page.getByLabel(/ต้นทาง/).selectOption({ label: "กรุงเทพฯ" });
  await page.getByLabel(/ปลายทาง/).selectOption({ label: "เชียงใหม่" });
  await field(page, /เวลารถรับ/, "06:30");
  await field(page, /ประเภทรถ/, "รถห้องเย็น");
  await field(page, /ทะเบียนรถ/, "กท 1001");
  await field(page, /ชื่อคนขับ/, "คนขับทดสอบ");
  await field(page, /เบอร์ติดต่อคนขับ/, "0811111111");
  await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, "500");
  await saveEntry(page);

  // Chef_house receives, prepares, smokes five large bags, and closes the lot.
  await signInAs(page, /Chef_house ฝ่ายผลิต/);
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
  await field(page, "น้ำหนักถุงที่ 1", "100");
  for (let bag = 2; bag <= 5; bag += 1) {
    await button(page, "เพิ่มถุง");
    await field(page, `น้ำหนักถุงที่ ${bag}`, "100");
  }
  await saveEntry(page);
  await button(page, "ยืนยันปิด Lot");
  await field(page, /ชื่อผู้ยืนยันปิด Lot/, "หัวหน้าผลิต Chef_house");
  await saveEntry(page);

  // Owner books the return trip; Food Diva receives finished meat.
  await signInAs(page, /Owner เจ้าของร้าน/);
  await button(page, "ใบขนส่ง");
  await button(page, /เรียกรถขากลับ/);
  await field(page, /เวลารถรับจาก Chef_house|เวลารถรับ/, "09:00");
  await page.getByLabel(/ต้นทาง/).selectOption({ label: "เชียงใหม่" });
  await page.getByLabel(/ปลายทาง/).selectOption({ label: "กรุงเทพฯ" });
  await field(page, /ประเภทรถ/, "รถห้องเย็น");
  await field(page, /ทะเบียนรถ/, "กท 1002");
  await field(page, /ชื่อคนขับ/, "คนขับขากลับ");
  await field(page, /เบอร์ติดต่อคนขับ/, "0822222222");
  await field(page, /น้ำหนักส่งจาก Chef_house/, "500");
  await saveEntry(page);
  await signInAs(page, /Food Diva ผู้ขายเนื้อ/);
  await button(page, "ยืนยันรับเข้าตู้");
  await field(page, /เวลารับ/, "10:00");
  await field(page, /น้ำหนักรับจริง/, "500");
  await field(page, /จำนวนถุงที่รับ/, "5");
  await saveEntry(page);

  // Owner receives central stock and allocates two 100 kg bags to each branch.
  await signInAs(page, /Owner เจ้าของร้าน/);
  await button(page, "รับเนื้อเข้าสต๊อกกลาง");
  await button(page, "รับเข้าคลังกลาง");
  await field(page, /น้ำหนักรับสต๊อกกลาง/, "500");
  await saveEntry(page);
  await button(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
  await button(page, "จัดสรร");
  const destinations = page.getByRole("dialog").locator("tbody select");
  await destinations.nth(0).selectOption({ label: "ศาลาแดง" });
  await destinations.nth(1).selectOption({ label: "ศาลาแดง" });
  await destinations.nth(2).selectOption({ label: "มีนบุรี" });
  await destinations.nth(3).selectOption({ label: "มีนบุรี" });
  await button(page, "บันทึกการจัดสรร");

  // Each branch receives, thaws, records rice/materials/sales, and closes the day.
  for (const branch of ["ศาลาแดง", "มีนบุรี"]) {
    await signInAs(page, new RegExp(`สาขา${branch} ผู้ดูแลสาขา`));
    await button(page, "รับของ");
    await page.getByLabel("ใบจัดสรรที่รับ").selectOption({ index: 1 });
    await field(page, /น้ำหนักรับเข้าสาขา/, "200");
    await field(page, /จำนวนถุงที่รับ/, "2");
    await saveEntry(page);
    await button(page, "แบ่งละลาย");
    await field(page, /น้ำหนักละลาย/, "0.1");
    await field(page, /จำนวนถุงที่ละลาย/, "1");
    await saveEntry(page);
    await button(page, "บันทึกการใช้วัสดุ");

    const riceTableTitle =
      branch === "ศาลาแดง"
        ? "ข้าวเหนียวดิบ · ซื้อที่สาขาศาลาแดง"
        : "ข้าวเหนียวสุก · ซื้อที่สาขามีนบุรี";
    const riceTable = page.locator("section.table-section").filter({
      has: page.getByRole("heading", { name: riceTableTitle }),
    });
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
    await field(page, /ยอดขาย LINE MAN/, "380");
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
    await field(page, /ชื่อผู้ยืนยันปิดวัน/, `ผู้ดูแล${branch}`);
    await saveEntry(page);
  }

  await signInAs(page, /Owner เจ้าของร้าน/);
  await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();
  await page.waitForTimeout(1_500);
});
