import { expect, test } from "@playwright/test";
import path from "node:path";
import {
  a_expectOverStock,
  a_expectRefused,
  ACCOUNTS,
  BRANCH_ACCOUNTS,
  button,
  chefAcceptsSmokePo,
  chefClosesLot,
  chefReceivesMeat,
  chefSmokes,
  chefSubmitsInvoice,
  field,
  foodivaFillsPackingList,
  foodivaFillsReturnReceive,
  foodivaOpensManifest,
  INVOICE_FIXTURE,
  menuItem,
  openMaterialCount,
  openMenu,
  OUTBOUND_MENU,
  ownerApprovesSmokingInvoice,
  ownerCallsReturnTruck,
  ownerCreatesShipmentRequest,
  ownerIssuesSmokePo,
  ownerPaysSmokingInvoice,
  pointAndClick,
  saveEntry,
  saveMaterialCount,
  signInAs,
  skipUnlessCredentials,
  startFresh,
  tableRow,
  tableSection,
  typeValue,
} from "./helpers";
import { mutate, seed, type Database, type Role } from "../../src/lib/store";

/* The QA team's data walk (vault: QA-REPORT.md, PO-2026-0002 / Lot F260916-002),
 * on the Shipment Flow: 100 kg ordered, a 90 kg Request (two 45 kg กล่องรับเข้า) +
 * 10 kg waste kept for Owner, 88 kg weighed in at Chef House (yellow cells), 85 kg
 * to the smoker, 80 kg packed in two 40 kg กล่องรมควัน, 79 kg received back at Foodiva. Every loss in that walk exposed a bug (BUG-1, 4, 6, 7, 10),
 * so the numbers here are load-bearing. */

/** The open dialog refuses what was typed (live, save disabled, or on save). */
const submitAndExpectError = a_expectRefused;

test("full business loop across Owner, Foodiva, Chef House and both branches", async ({
  page,
}) => {
  skipUnlessCredentials(
    ACCOUNTS.owner,
    ACCOUNTS.foodiva,
    ACCOUNTS.chef,
    ACCOUNTS.saladaeng,
    ACCOUNTS.minburi,
  );
  test.setTimeout(25 * 60_000);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await expect(page.getByRole("heading", { name: "แดชบอร์ด" })).toBeVisible();

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
  await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อกล่อง");
  await field(page, /น้ำหนักสั่งซื้อ/, "100");
  await field(page, /ราคาเนื้อ/, "250");
  await field(page, /หมายเหตุ/, "QA TEST loop");
  const poId = (await page.getByRole("dialog").innerText()).match(
    /PO-\d{4}-\d{4}/,
  )?.[0];
  expect(poId, "the PO preview shows the number it will get").toBeTruthy();
  await button(page, "บันทึก PO เนื้อ");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Foodiva uploads the supplier invoice: 90 kg to Chef House, 10 kg waste for Owner.
  await signInAs(page, ACCOUNTS.foodiva);
  await button(page, /ออกและอัปโหลด Invoice|อัปโหลด Invoice เนื้อ/);
  await field(page, /เลข Invoice เนื้อ/, "FD-INV-001");
  await field(page, /น้ำหนักตาม Invoice/, "100");
  await field(page, /พร้อมส่งไป Chef House/, "90");
  await field(page, /เนื้อส่วนที่เหลือรอ Owner รับ/, "10");
  await field(page, /ยอดรวม Invoice/, "25000");
  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(process.cwd(), "tests/fixtures/invoice-demo.pdf"));
  await field(page, /ชื่อผู้ยืนยันจาก Foodiva/, "เจ้าหน้าที่ Foodiva");
  await saveEntry(page);

  // Owner requests the 90 kg that ship (the 10 kg waste share stays at Foodiva).
  await signInAs(page, ACCOUNTS.owner);
  const shipment = await ownerCreatesShipmentRequest(page, [
    { poId: poId!, kg: "90" },
  ]);

  // Foodiva makes the outbound transport document with a two-box Packing List.
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaOpensManifest(page, shipment, { plate: "กท 1001" });
  // BUG-10a: the outbound trip defaults to Bangkok → Chiang Mai, not Chiang Mai → Chiang Mai.
  const manifest = page.getByRole("dialog");
  await expect(
    manifest.getByRole("combobox", { name: "ต้นทาง", exact: true }),
  ).toHaveValue("กรุงเทพฯ");
  await expect(
    manifest.getByRole("combobox", { name: "ปลายทาง", exact: true }),
  ).toHaveValue("เชียงใหม่");
  await foodivaFillsPackingList(page, ["45", "45"], {
    attachment: INVOICE_FIXTURE,
  });
  await pointAndClick(
    page,
    page.getByRole("button", { name: "บันทึกใบขนส่ง", exact: true }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Owner issues the Chef House smoke PO from the Packing List (90 kg).
  await signInAs(page, ACCOUNTS.owner);
  await ownerIssuesSmokePo(page, "", shipment);

  // Chef House accepts the PO, weighs in 88 kg, trims to 85 kg, smokes into two
  // 40 kg กล่องรมควัน, closes the lot and submits its invoice.
  await signInAs(page, ACCOUNTS.chef);
  await chefAcceptsSmokePo(page);
  await pointAndClick(page, menuItem(page, "ยืนยันรับเนื้อ"));
  // BUG-10d: the waiting table names the truck instead of "-".
  await expect(tableRow(page, "การส่งที่รอยืนยันรับ", shipment)).toContainText(
    "กท 1001",
  );
  await chefReceivesMeat(page, shipment, ["44", "44"]);
  await button(page, "งานผลิต");
  await button(page, "น้ำหนักก่อนสโมค");
  await field(page, /น้ำหนักหลังแกะซับ/, "200");
  await a_expectOverStock(
    page,
    "น้ำหนักก่อนสโมคเกินน้ำหนักรับ · กรอกได้สูงสุด 88.00 กก.",
  );
  await field(page, /น้ำหนักหลังแกะซับ/, "85");
  await saveEntry(page);
  await chefSmokes(page, { inputKg: "85", wasteKg: "5", packs: ["40", "40"] });
  await chefClosesLot(page);
  await chefSubmitsInvoice(page, "CH-INV-001");

  // Owner reviews and pays the smoking invoice.
  await signInAs(page, ACCOUNTS.owner);
  await ownerApprovesSmokingInvoice(page, shipment);
  await ownerPaysSmokingInvoice(page, shipment);

  // Owner books the return trip for 80 kg; Foodiva receives 79 kg (drip loss).
  await ownerCallsReturnTruck(page, shipment, "80");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaFillsReturnReceive(page, shipment, { kg: "79" });
  await expect(
    page.getByRole("dialog").getByLabel(/จำนวนกล่องรมควันที่รับ/),
  ).toHaveValue("2");
  await saveEntry(page);

  // Owner receives 79 kg into central stock and allocates it to the branches by kg
  // (allocate by kg: no more per-กล่องรมควัน rows in the allocation form).
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "รับเนื้อเข้าสต๊อกกลาง");
  await button(page, "รับเข้าสต๊อกกลาง");
  await field(page, /น้ำหนักรับสต๊อกกลาง/, "79");
  await field(page, /หมายเหตุ/, "QA TEST central receive");
  await saveEntry(page);
  await button(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
  const allocateButton = page
    .getByRole("main")
    .getByRole("button", { name: "จัดสรร", exact: true });
  await pointAndClick(page, allocateButton);
  const allocationDialog = page.getByRole("dialog").last();
  await expect(allocationDialog).toContainText("จัดสรรเนื้อไปสาขา (กก.)");
  await expect(allocationDialog).toContainText("สต๊อกกลางของ Lot นี้");
  await expect(allocationDialog).toContainText("79.00 กก.");
  await typeValue(page, allocationDialog.getByLabel("ศาลาแดง (กก.)"), "50");
  await typeValue(page, allocationDialog.getByLabel("มีนบุรี (กก.)"), "40");
  // More than central stock is refused before saving.
  await expect(allocationDialog).toContainText(
    "น้ำหนักรวม 90.00 กก. เกินสต๊อกกลาง · กรอกได้สูงสุด 79.00 กก.",
  );
  // "ที่เหลือทั้งหมด" drains the lot to exactly 0 (BUG-1: nothing is left stuck in central).
  await pointAndClick(
    page,
    allocationDialog.getByRole("button", { name: "ที่เหลือทั้งหมด" }).nth(1),
  );
  await expect(allocationDialog.getByLabel("มีนบุรี (กก.)")).toHaveValue("29");
  await expect(allocationDialog).toContainText(
    /คงเหลือในคลังกลางหลังจัดสรร\s*0\.00 กก\./,
  );
  await button(page, "บันทึกการจัดสรร");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("จัดสรรไปสาขาแล้ว · ศาลาแดง 50.00 กก. · มีนบุรี 29.00 กก."),
  ).toBeVisible();
  await expect(allocateButton).toBeDisabled();

  // Step 23: Owner collects the 10 kg waste share Foodiva kept back.
  await button(page, "สต๊อกของทั้งหมด");
  await button(page, "บันทึกรับเนื้อ");
  await field(page, /น้ำหนักรับจริง/, "10");
  await field(page, /ผู้รับเนื้อ/, "Owner QA");
  await saveEntry(page);

  // BUG-6: the Owner weight check compares against the Packing List (90), not the invoice (100).
  await openMenu(page, OUTBOUND_MENU);
  await expect(page.getByText("ส่งไป (Packing List): 90.00 กก.")).toBeVisible();
  await expect(page.getByText(/ส่วนต่าง −2\.00 กก\./)).toBeVisible();

  // BUG-7: the 3 kg trimmed before smoking is named as loss, nothing is left waiting at Chef House.
  await button(page, "Log เนื้อคงเหลือ");
  await expect(
    page.getByRole("row").filter({ hasText: "Chef House · Waste ก่อนสโมค" }),
  ).toContainText("3.00 กก.");
  await expect(
    page.getByRole("row").filter({ hasText: "Chef House · รอเข้ารอบสโมค" }),
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

  // Saladaeng receives its 50 kg in two deliveries: 30 kg with "รับครบใบจัดสรรนี้แล้ว"
  // unticked keeps 20 kg pending, the next 20 kg closes the allocation.
  await signInAs(page, BRANCH_ACCOUNTS["ศาลาแดง"]);
  await button(page, "รับของ");
  let receive = page.getByRole("dialog").last();
  await expect(receive.getByLabel("จำนวนถุงที่รับ")).toHaveCount(0);
  await expect(receive.getByLabel("รับครบใบจัดสรรนี้แล้ว")).toBeChecked();
  await receive.getByLabel("ใบจัดสรรที่รับ").selectOption({ index: 1 });
  await field(page, /น้ำหนักรับเข้าสาขา/, "30");
  await receive.getByLabel("รับครบใบจัดสรรนี้แล้ว").uncheck();
  await saveEntry(page);
  await button(page, "รับของ");
  receive = page.getByRole("dialog").last();
  await expect(
    receive.getByLabel("ใบจัดสรรที่รับ").locator("option").nth(1),
  ).toContainText("ค้างรับ 20.00 กก.");
  await receive.getByLabel("ใบจัดสรรที่รับ").selectOption({ index: 1 });
  await field(page, /น้ำหนักรับเข้าสาขา/, "20.5");
  await a_expectOverStock(page, "รับเกินยอดค้างรับ · กรอกได้สูงสุด 20.00 กก.");
  await field(page, /น้ำหนักรับเข้าสาขา/, "20");
  await saveEntry(page);
  await expect(
    page.getByRole("row").filter({ hasText: "1. รับเนื้อเข้าสาขา" }),
  ).toContainText("ไม่มีรายการรอรับ");

  // Minburi receives 28.5 of 29 kg and closes the allocation: the shortfall needs a reason.
  await signInAs(page, BRANCH_ACCOUNTS["มีนบุรี"]);
  await button(page, "รับของ");
  receive = page.getByRole("dialog").last();
  await receive.getByLabel("ใบจัดสรรที่รับ").selectOption({ index: 1 });
  await field(page, /น้ำหนักรับเข้าสาขา/, "28.5");
  await submitAndExpectError(page, /เหตุผลส่วนต่าง/);
  await field(page, /เหตุผลส่วนต่าง/, "QA TEST drip loss");
  await saveEntry(page);
  await expect(
    page.getByRole("row").filter({ hasText: "1. รับเนื้อเข้าสาขา" }),
  ).toContainText("ไม่มีรายการรอรับ");

  // Each branch thaws 10 kg, records materials and rice (self-cooked at Saladaeng,
  // bought cooked at Minburi — either branch picks the source per purchase), sells,
  // and closes the day through the single "ตรวจและปิดวัน" checklist.
  for (const branch of ["ศาลาแดง", "มีนบุรี"] as const) {
    await signInAs(page, BRANCH_ACCOUNTS[branch]);
    await button(page, "แบ่งละลาย");
    await field(page, /น้ำหนักละลาย/, "60");
    await field(page, /จำนวนกล่องรมควันที่ละลาย/, "1");
    await a_expectOverStock(
      page,
      `สต๊อกแช่แข็งไม่พอ · กรอกได้สูงสุด ${branch === "ศาลาแดง" ? "50.00" : "28.50"} กก.`,
    );
    await field(page, /น้ำหนักละลาย/, "10");
    await saveEntry(page);
    await openMaterialCount(page);
    await saveMaterialCount(page);

    const riceTable = tableSection(
      page,
      "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก",
    );
    const riceRow = (index: number) =>
      riceTable.getByRole("button", { name: "กรอกข้อมูล" }).nth(index);
    await pointAndClick(page, riceRow(0));
    const ricePurchase = page.getByRole("dialog").last();
    // Nothing to fill until the round's source is picked.
    await submitAndExpectError(page, /เลือกที่มาของข้าวเหนียวรอบนี้/);
    await ricePurchase
      .getByLabel(/รอบนี้ข้าวเหนียวมาจาก/)
      .selectOption(
        branch === "ศาลาแดง"
          ? "นึ่งเอง (ซื้อข้าวดิบ)"
          : "ซื้อข้าวสุกจากข้างนอก",
      );
    await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าวทดสอบ");
    if (branch === "ศาลาแดง") {
      await expect(
        ricePurchase.getByLabel(/ข้าวเหนียวสุกซื้อเข้า/),
      ).toHaveCount(0);
      await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "5");
      await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "275");
    } else {
      await expect(
        ricePurchase.getByLabel(/ข้าวเหนียวดิบซื้อเข้า/),
      ).toHaveCount(0);
      // Below the cooked-rice par (30 kg) only warns now; 12 kg saves.
      await field(page, /ข้าวเหนียวสุกซื้อเข้า/, "12");
      await field(page, /ยอดซื้อข้าวเหนียวสุก/, "540");
    }
    await saveEntry(page);

    if (branch === "ศาลาแดง") {
      await pointAndClick(page, riceRow(1));
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "1");
      await field(page, /ผู้รับของ/, "ผู้ดูแลศาลาแดง");
      await saveEntry(page);
      // Issuing raw rice makes the cook ("ข้าวเหนียวช่วงเช้า") due today.
      await expect(
        riceTable.getByRole("row").filter({ hasText: "ข้าวเหนียวช่วงเช้า" }),
      ).toContainText("รอบันทึก");
      await pointAndClick(page, riceRow(2));
      await field(page, /ข้าวเหนียวดิบที่นำมาหุง/, "1");
      await field(page, /ข้าวเหนียวสุกที่ได้/, "1.4");
      await saveEntry(page);
    }

    // Close before the sale: the checklist names what is missing and the confirm
    // button stays disabled; "ไปกรอก" opens the sale form instead.
    await button(page, "ตรวจและปิดวัน");
    const closeDay = page.getByRole("dialog").last();
    await expect(closeDay.getByLabel(/เวลาจำลองสำหรับทดสอบปิดวัน/)).toHaveCount(
      0,
    );
    const checklist = tableSection(page, "ตรวจก่อนปิดวัน");
    await expect(
      checklist.getByRole("row").filter({ hasText: "ยอดขายวันนี้" }),
    ).toContainText("ยังไม่ทำ");
    await expect(
      checklist.getByRole("row").filter({ hasText: "เช็ควัสดุ" }),
    ).toContainText("✓");
    await expect(closeDay).toContainText("ยังปิดวันไม่ได้ · ขาด ยอดขายวันนี้");
    await expect(closeDay.locator('button[type="submit"]')).toBeDisabled();
    await pointAndClick(
      page,
      checklist
        .getByRole("row")
        .filter({ hasText: "ยอดขายวันนี้" })
        .getByRole("button", { name: "ไปกรอก" }),
    );

    // The sale form (B1): meat "used today" and "waste"; what is left of the thawed
    // 10 kg stays chilled for tomorrow instead of having to be written off.
    await expect(page.getByRole("dialog").last()).toContainText(
      "น้ำหนักที่ใช้ไปจริงวันนี้",
    );
    await field(page, /กล่องมาตรฐาน/, "1");
    await field(page, /น้ำพริกหลอด/, "1");
    await field(page, /ตรวจนับน้ำพริกจริง/, "9");
    await field(page, /หมายเหตุเมื่อน้ำพริกไม่ตรง/, "QA TEST chili count");
    await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "0.1");
    await field(page, /น้ำหนักเวสต์/, "0.5");
    await field(page, /ยอดขาย LINE MAN/, "380");
    // BUG-3: waste needs a reason, and the form says so.
    await submitAndExpectError(page, /เหตุผล/);
    await field(page, /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/, "QA TEST waste");
    await saveEntry(page);

    // Every day ends with the cooked-rice confirmation.
    await pointAndClick(page, riceRow(3));
    await field(
      page,
      /ข้าวเหนียวสุกเหลือปลายวัน/,
      branch === "ศาลาแดง" ? "1.2" : "11.8",
    );
    await page
      .getByRole("dialog")
      .last()
      .getByLabel(/การจัดการวันถัดไป/)
      .selectOption("เก็บไว้อุ่นวันถัดไป");
    await field(page, /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/, "QA TEST rice");
    await saveEntry(page);

    await expect(
      tableSection(page, new RegExp(`^เนื้อละลายวันนี้ · .* · ${branch}$`))
        .getByRole("row")
        .filter({ hasText: /^S\d{6}-\d{3}|F\d{6}/ })
        .first(),
    ).toContainText("9.40 กก.");

    // Everything is in: the checklist is all ✓, the 9.4 kg chill row is information
    // only, and the day closes at any hour (no close-time rule).
    await button(page, "ตรวจและปิดวัน");
    const ready = page.getByRole("dialog").last();
    await expect(ready).toContainText("ข้อมูลครบ ปิดวันได้ทุกเวลา");
    await expect(
      tableSection(page, "ตรวจก่อนปิดวัน")
        .getByRole("row")
        .filter({ hasText: "เนื้อชิลยกไปวันถัดไป 9.40 กก." }),
    ).toContainText("ข้อมูล · ไม่บังคับ");
    await field(page, /ชื่อผู้ยืนยันปิดวัน/, `ผู้ดูแล${branch}`);
    await saveEntry(page);
    await expect(
      page.getByText(/ปิดวันแล้ว · ข้อมูลวันที่ .* ถูกล็อก/),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "ตรวจและปิดวัน" }),
    ).toBeDisabled();
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
      .filter({ hasText: "ศาลาแดง 50.00 กก. · มีนบุรี 29.00 กก." })
      .last(),
  ).toBeVisible();
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: "ขายที่สาขา" })
      .filter({ hasText: "2 วัน" })
      .last(),
  ).toContainText("ขาย 0.20 กก. · Waste 1.00 กก.");
});

/* Chill carryover (Branch Day B1): thawed meat a branch does not use stays chilled
 * and is sold the next day without thawing again. The pipeline up to the branch
 * receive is built with the domain core, dated yesterday, so the branch can work
 * "yesterday" and then "today" (the working date can never be in the future). */
test("สาขาศาลาแดง: ละลาย 70 ใช้ 65.5 → ปิดวันได้ คงเหลือชิล 4.5 → วันถัดไปชิลยกมา 4.5 ขายได้โดยไม่ต้องละลายใหม่", async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
    "writes the state straight into the local SQLite backend (pnpm test:e2e:local)",
  );
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const yesterday = new Date(Date.now() - 86_400_000).toLocaleDateString(
    "en-CA",
    { timeZone: "Asia/Bangkok" },
  );
  const { revision } = await (await page.request.get("/api/local-db")).json();
  const saved = await page.request.post("/api/local-db", {
    data: {
      payload: receivedAtSaladaeng(yesterday),
      expectedRevision: revision,
    },
  });
  expect(saved.ok(), await saved.text()).toBe(true);

  await signInAs(page, ACCOUNTS.saladaeng);
  const workingDate = page.getByLabel("วันที่ทำรายการ").first();
  await workingDate.fill(yesterday);
  await expect(workingDate).toHaveValue(yesterday);

  // Yesterday: thaw 70, use 65.5, no waste. The 4.5 kg left does not block closing.
  await button(page, "แบ่งละลาย");
  await field(page, /น้ำหนักละลาย/, "70");
  await field(page, /จำนวนกล่องรมควันที่ละลาย/, "1");
  await saveEntry(page);
  await openMaterialCount(page);
  await saveMaterialCount(page);
  await button(page, "บันทึกยอดขาย");
  await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "65.5");
  await field(page, /น้ำหนักเวสต์/, "0");
  await saveEntry(page);
  const riceTable = tableSection(
    page,
    "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก",
  );
  await pointAndClick(
    page,
    riceTable.getByRole("button", { name: "กรอกข้อมูล" }).nth(3),
  );
  await field(page, /ข้าวเหนียวสุกเหลือปลายวัน/, "0");
  await page
    .getByRole("dialog")
    .last()
    .getByLabel(/การจัดการวันถัดไป/)
    .selectOption("ไม่นำกลับมาใช้");
  await field(
    page,
    /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/,
    "ข้าวสุกหมดตั้งแต่เช้า",
  );
  await saveEntry(page);
  const meatDay = (date: string) =>
    tableSection(page, `เนื้อละลายวันนี้ · ${date} · ศาลาแดง`)
      .locator("tbody tr")
      .first()
      .getByRole("cell");
  await expect(meatDay(yesterday).nth(2)).toHaveText("70.00 กก.");
  await expect(meatDay(yesterday).nth(3)).toHaveText("65.50 กก.");
  await expect(meatDay(yesterday).nth(5)).toHaveText("4.50 กก.");

  await button(page, "ตรวจและปิดวัน");
  await expect(page.getByRole("dialog").last()).toContainText(
    "ข้อมูลครบ ปิดวันได้ทุกเวลา",
  );
  await expect(
    tableSection(page, "ตรวจก่อนปิดวัน").getByRole("row").filter({
      hasText: "เนื้อชิลยกไปวันถัดไป 4.50 กก.",
    }),
  ).toContainText("ข้อมูล · ไม่บังคับ");
  await field(page, /ชื่อผู้ยืนยันปิดวัน/, "ผู้ดูแลศาลาแดง");
  await saveEntry(page);
  await expect(
    page.getByText(/ปิดวันแล้ว · ข้อมูลวันที่ .* ถูกล็อก/),
  ).toBeVisible();

  // Today: the 4.5 kg comes in as chill; the sale uses it with nothing thawed today.
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
  await workingDate.fill(today);
  await expect(workingDate).toHaveValue(today);
  await expect(meatDay(today).nth(1)).toHaveText("4.50 กก.");
  await expect(meatDay(today).nth(2)).toHaveText("0.00 กก.");
  await button(page, "บันทึกยอดขาย");
  await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "4.6");
  await field(page, /น้ำหนักเวสต์/, "0");
  await a_expectOverStock(
    page,
    "น้ำหนักที่ใช้และเวสต์เกินเนื้อที่ละลายแล้ว (รวมชิลยกมา) · ใช้จริงรวมเวสต์ได้สูงสุด 4.50 กก.",
  );
  await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "4.5");
  await saveEntry(page);
  await expect(meatDay(today).nth(3)).toHaveText("4.50 กก.");
  await expect(meatDay(today).nth(5)).toHaveText("0.00 กก.");
});

/** Seed → one 100 kg purchase PO shipped, smoked, returned and received centrally
 * (70 kg), all 70 kg allocated to and received at Saladaeng — every entry on `date`. */
function receivedAtSaladaeng(date: string): Database {
  let db = structuredClone(seed);
  const run = (
    role: Role,
    kind: string,
    values: Record<string, string>,
    lotId = "",
    branch = "",
  ) => {
    db = mutate(db, role, kind, values, lotId, date, branch);
  };
  run("owner", "purchase", {
    supplier: "Foodiva",
    customerName: "บริษัท เนิร์ดเนื้อ จำกัด",
    customerAddress: "กรุงเทพฯ",
    attention: "ฝ่ายจัดซื้อ",
    phone: "0800000000",
    taxId: "0100000000000",
    packSize: "6 ชิ้นต่อกล่อง",
    productName: "เนื้อวัว",
    orderedKg: "70",
    price: "250",
  });
  const poLotId = db.lots.at(-1)!.id;
  run(
    "foodiva",
    "foodivaConfirm",
    {
      invoiceNo: "INV-CHILL",
      invoiceDate: date,
      confirmedKg: "70",
      readyForChiangMaiKg: "70",
      reservedForOwnerKg: "0",
      invoiceAmount: "17500",
      attachment: "inv.pdf",
      confirmedBy: "Foodiva",
    },
    poLotId,
  );
  run("owner", "shipmentRequest", {
    lines: JSON.stringify([{ lotId: poLotId, kg: "70" }]),
  });
  const lotId = db.lots.at(-1)!.id;
  const trip = {
    vehicleType: "รถห้องเย็น",
    plate: "CH-01",
    driverName: "คนขับ",
    driverPhone: "0800000000",
  };
  run(
    "foodiva",
    "dispatch",
    {
      pickupDate: date,
      origin: "Foodiva · กรุงเทพฯ",
      destination: "Chef House · เชียงใหม่",
      trip: "ไปกลับ",
      pickupTime: "06:30",
      ...trip,
    },
    lotId,
  );
  run(
    "foodiva",
    "packingList",
    {
      invoiceNo: "INV-CHILL",
      product: "เนื้อวัว",
      slicedLostKg: "70",
      boxes: "35\n35",
    },
    lotId,
  );
  run(
    "owner",
    "smokeOrder",
    {
      smoker: "Chef House",
      requestedSmokeDate: date,
      expectedFinishedDate: date,
    },
    lotId,
  );
  run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" }, lotId);
  run("cm", "cmReceive", { receivedBoxes: "35\n35", arrival: "08:00" }, lotId);
  run("cm", "prepare", { preSmokeKg: "70" }, lotId);
  run(
    "cm",
    "smoke",
    { smokeDate: date, inputKg: "70", wasteKg: "0", packs: "35\n35" },
    lotId,
  );
  run("cm", "closeLot", { confirm: "Chef House" }, lotId);
  run(
    "owner",
    "return",
    {
      returnDate: date,
      returnTime: "09:00",
      origin: "Chef House · เชียงใหม่",
      destination: "Foodiva · กรุงเทพฯ",
      returnKg: "70",
      ...trip,
    },
    lotId,
  );
  run(
    "foodiva",
    "foodivaReturnReceive",
    {
      receivedDate: date,
      receivedTime: "10:00",
      receivedKg: "70",
      receivedBags: "2",
    },
    lotId,
  );
  run("owner", "central", { centralKg: "70" }, lotId);
  run(
    "owner",
    "allocate",
    { branch: "ศาลาแดง", kg: "70", deliveryDate: date },
    lotId,
  );
  const allocation = db.entries.at(-1)!.id;
  run(
    "branch",
    "receive",
    { allocation, kg: "70", complete: "1" },
    lotId,
    "ศาลาแดง",
  );
  return db;
}
