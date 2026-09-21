import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  chefAcceptsSmokePo,
  chefClosesLot,
  chefFillsYellowCells,
  chefLotButton,
  chefReceivesMeat,
  chefRecordsPreSmoke,
  chefSmokes,
  chefSmokesShipment,
  chefSubmitsInvoice,
  closeNotifications,
  expectNoPurchaseData,
  field,
  foodivaFillsPackingList,
  foodivaFillsReturnReceive,
  foodivaIssuesInvoice,
  foodivaMakesManifest,
  foodivaOpensManifest,
  installVisibleCursor,
  menuItem,
  openMenu,
  openNotifications,
  ownerApprovesSmokingInvoice,
  ownerCallsReturnTruck,
  ownerCancelsLatestRequest,
  ownerCreatesMeatPo,
  ownerCreatesShipmentRequest,
  ownerFillsShipmentRequest,
  ownerIssuesSmokePo,
  ownerPaysMeatInvoice,
  ownerPaysSmokingInvoice,
  ownerReceivesCentral,
  pointAndClick,
  saveEntry,
  sendMeatToChefHouse,
  sidebar,
  signInAs,
  slipImage,
  slipPdf,
  startFresh,
  step,
  tableRow,
  tableSection,
  typeValue,
} from "./helpers";

/* Shipment Flow — vault: Features/Shipment Flow/Checklist.md, sections C and D.
 * Every test starts from the empty seed (startFresh), so PO / SH numbers restart. */

/** A price that shows up nowhere else, so its absence on Chef House pages means something. */
const MEAT_PRICE = "263.75";

test("Shipment Flow ครบวง: PO ซื้อ → Request → ใบขนส่ง + Packing List → PO รมควัน → Chef House → ขากลับ → ชำระเงิน", async ({
  page,
}) => {
  await startFresh(page);
  const pos: string[] = [];
  const invoices: string[] = [];
  let shipment = "";

  await step(page, "Owner: C0 สร้าง PO ซื้อ 300 / 700 / 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    for (const kg of ["300", "700", "500"])
      pos.push(await ownerCreatesMeatPo(page, kg, MEAT_PRICE));
    // คงเหลือส่ง Chef House ขึ้น "—" จนกว่า Foodiva จะออก Invoice
    for (const poId of pos)
      await expect(
        tableRow(page, "รายการใบสั่งซื้อ PO", poId).getByRole("cell").nth(7),
      ).toHaveText("—");
  });

  await step(page, "Foodiva: C0 ออก Invoice เนื้อให้ทั้ง 3 ใบ", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    for (const [index, poId] of pos.entries())
      invoices.push(
        await foodivaIssuesInvoice(page, ["300", "700", "500"][index], {
          poId,
        }),
      );
  });

  await step(
    page,
    "Owner: C1 สร้าง Request ดึงจาก 3 PO รวม 1,500 กก.",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      const bell = await openNotifications(page);
      await expect(bell).toContainText(`รอชำระ Invoice เนื้อ · ${pos[0]}`);
      await closeNotifications(page);

      shipment = await ownerCreatesShipmentRequest(page, [
        { poId: pos[0], kg: "300" },
        { poId: pos[1], kg: "700" },
        { poId: pos[2], kg: "500" },
      ]);
      const row = tableRow(page, "รายการส่ง", shipment);
      await expect(row).toContainText("รอ Foodiva ทำใบขนส่ง");
      // Owner ไม่ทำใบขนส่งขาไปเอง
      await expect(
        page.getByRole("button", { name: "ทำใบขนส่ง", exact: true }),
      ).toHaveCount(0);

      await openMenu(page, "ใบสั่งซื้อ PO");
      for (const poId of pos)
        await expect(
          tableRow(page, "รายการใบสั่งซื้อ PO", poId).getByRole("cell").nth(7),
        ).toHaveText("0.00 กก.");

      await openMenu(page, "ใบสั่ง PO โรงรมควัน");
      const smokeRow = tableRow(page, "รายการ PO โรงรมควัน", shipment);
      await expect(
        smokeRow.getByRole("button", { name: "ออก PO รมควันเนื้อ" }),
      ).toBeDisabled();
      await expect(smokeRow).toContainText("รอ Foodiva ทำ Packing List");
    },
  );

  await step(page, "Foodiva: C2–C3 ทำใบขนส่งพร้อม Packing List", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await expect(tableRow(page, "Request เข้า", shipment)).toContainText(
      "1,500.00 กก.",
    );
    await foodivaMakesManifest(page, shipment, ["480", "510", "500"]);
    await expect(tableRow(page, "Request เข้า", shipment)).toContainText(
      "ทำใบขนส่งแล้ว · รอ PO รมควัน",
    );
  });

  await step(page, "Owner: C4–C5 ได้แจ้งเตือนแล้วออก PO รมควัน", async () => {
    await signInAs(page, ACCOUNTS.owner);
    const bell = await openNotifications(page);
    await expect(bell).toContainText(`Packing List พร้อมแล้ว · ${shipment}`);
    await expect(bell).toContainText("3 กล่องรับเข้า · 1,490.00 กก.");
    await closeNotifications(page);

    await ownerIssuesSmokePo(page, "", shipment);
    const row = tableRow(page, "รายการ PO โรงรมควัน", shipment);
    // น้ำหนักสั่งรม = ยอดรวม Packing List ไม่ใช่ยอดที่ขอใน Request
    await expect(row).toContainText("1,490.00 กก.");
    for (const poId of pos) await expect(row).toContainText(poId);
    await expect(
      row.getByRole("button", { name: "ออก PO รมควันเนื้อ" }),
    ).toHaveCount(0);
    await expect(row).toContainText("รอยืนยัน");

    await pointAndClick(
      page,
      row.getByRole("button", { name: "ดู Packing List" }),
    );
    await expect(page.getByRole("dialog")).toContainText("รวม 3 กล่องรับเข้า");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  await step(page, "Chef House: C6 รับ PO แล้วกรอกช่องเหลือง", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await chefAcceptsSmokePo(page);
    await expectNoPurchaseData(page, [MEAT_PRICE, ...invoices]);
    await chefReceivesMeat(page, shipment, ["478.5", "512", "499"]);
    await openMenu(page, "งานผลิต");
    await expect(page.locator("main")).toContainText("1,489.50 กก.");
  });

  await step(
    page,
    "Chef House: C7–C8 ก่อนสโมค → สโมค → ปิด Lot → ใบวางบิล",
    async () => {
      await chefRecordsPreSmoke(page, "1480");
      await chefSmokes(page, {
        inputKg: "1480",
        wasteKg: "40",
        packs: ["480", "480", "480"],
      });
      await chefClosesLot(page);
      await chefSubmitsInvoice(page, "CH-INV-0001");
      await expect(page.locator("main")).toContainText("รอตรวจยอด");
      await expectNoPurchaseData(page, [MEAT_PRICE, ...invoices]);
    },
  );

  await step(page, "Owner: C9 เรียกรถขากลับ", async () => {
    await signInAs(page, ACCOUNTS.owner);
    const bell = await openNotifications(page);
    await expect(bell).toContainText("รอตรวจ Invoice ค่ารมควัน · CH-INV-0001");
    await closeNotifications(page);
    await openMenu(page, "ใบขนส่ง");
    await expect(tableRow(page, "รายการส่ง", shipment)).toContainText(
      "เรียกรถขากลับ · 1,440.00 กก.",
    );
    await ownerCallsReturnTruck(page, shipment);
    await expect(tableRow(page, "รายการส่ง", shipment)).toContainText(
      "รอ Foodiva รับเข้าตู้",
    );
  });

  await step(page, "Foodiva: C10 รับเนื้อรมควันเข้าตู้", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await expect(tableSection(page, /^Request เข้า$/)).not.toContainText(
      shipment,
    );
    const row = tableRow(
      page,
      "เนื้อรมควันขากลับ · รับเข้าตู้ Foodiva",
      shipment,
    );
    await expect(row).toContainText("3 กล่องรมควัน · 1,440.00 กก.");
    await foodivaFillsReturnReceive(page, shipment, { kg: "1440" });
    await expect(page.getByRole("dialog")).toContainText(
      "จำนวนกล่องรมควันที่รับ",
    );
    await saveEntry(page);
    await expect(row).toContainText("รับแล้ว · ส่วนต่าง 0.00 กก.");
  });

  await step(page, "Owner: C10 รับเข้าสต๊อกกลาง", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await ownerReceivesCentral(page, "1440");
    await expect(page.locator("main")).toContainText(
      "ไม่มี Lot รอรับเข้าสต๊อกกลางในขณะนี้",
    );
  });

  await step(
    page,
    "Owner: C11 ชำระ Invoice เนื้อและค่ารมควันพร้อมสลิป",
    async () => {
      await ownerPaysMeatInvoice(page, pos[0], [slipImage(), slipPdf()]);
      const paid = tableRow(page, "Invoice Foodiva", pos[0]);
      await expect(paid).toContainText("ชำระแล้ว");
      await expect(paid).toContainText("slip-photo.png");
      await expect(paid).toContainText("slip-transfer.pdf");

      await ownerPaysMeatInvoice(page, pos[1]);
      await expect(tableRow(page, "Invoice Foodiva", pos[1])).toContainText(
        "ไม่มีสลิป",
      );

      await ownerApprovesSmokingInvoice(page, shipment);
      await ownerPaysSmokingInvoice(page, shipment, [
        slipPdf("smoke-slip.pdf"),
      ]);
      const smoke = tableRow(page, "Invoice Chef House", shipment);
      await expect(smoke).toContainText("ชำระแล้ว");
      await expect(smoke).toContainText("smoke-slip.pdf");
    },
  );

  await step(page, "Owner: C12 ดูภาพรวมทั้งสายจากเลข PO ซื้อ", async () => {
    await openMenu(page, "เอกสารและ Traceability");
    await typeValue(page, page.getByLabel(/^ค้นหา/), pos[1]);
    const row = page.getByRole("row").filter({ hasText: shipment });
    await pointAndClick(
      page,
      row.getByRole("button", { name: "ดู", exact: true }),
    );
    const main = page.locator("main");
    await expect(main).toContainText(`สายการส่ง ${shipment}`);
    await expect(main).toContainText("Chef House รับจริง");
    await expect(main).toContainText("3 กล่องรมควัน · 1,440.00 กก.");
    await expect(main).toContainText("Foodiva รับจริง");
  });
});

test("ส่งบางส่วน: PO 1,000 → ส่ง 400 เหลือ 600 · ขอ 600.5 ถูกปฏิเสธ · ขอ 600 ได้", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const poId = await ownerCreatesMeatPo(page, "1000");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "1000", { poId });

  await signInAs(page, ACCOUNTS.owner);
  const first = await ownerCreatesShipmentRequest(page, [{ poId, kg: "400" }]);
  await openMenu(page, "ใบสั่งซื้อ PO");
  await expect(
    tableRow(page, "รายการใบสั่งซื้อ PO", poId).getByRole("cell").nth(7),
  ).toHaveText("600.00 กก.");

  // ฟอร์ม Request แสดงคงเหลือเท่ากัน และปฏิเสธยอดที่เกินโดยระบุเลข PO
  await ownerFillsShipmentRequest(page, [{ poId, kg: "600.5" }]);
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("row").filter({ hasText: poId })).toContainText(
    "600.00 กก.",
  );
  const overdraw = `น้ำหนักที่ขอส่งเกินยอดคงเหลือของ ${poId} (เหลือ 600.00 กก.)`;
  await expect(dialog.getByRole("alert").first()).toHaveText(overdraw);
  await pointAndClick(page, dialog.locator('button[type="submit"]'));
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(overdraw);

  await typeValue(page, dialog.getByLabel(`น้ำหนักที่จะส่งของ ${poId}`), "600");
  await saveEntry(page);
  await expect(
    page.getByText("สร้าง Request แล้ว · รอ Foodiva ทำใบขนส่ง"),
  ).toBeVisible();
  const rows = tableSection(page, /^รายการส่ง$/);
  await expect(rows).toContainText(first);
  await expect(rows.getByRole("row")).toHaveCount(3); // header + 2 shipments

  await openMenu(page, "ใบสั่งซื้อ PO");
  await expect(
    tableRow(page, "รายการใบสั่งซื้อ PO", poId).getByRole("cell").nth(7),
  ).toHaveText("0.00 กก.");
  await openMenu(page, "ใบขนส่ง");
  await button(page, "สร้าง Request ส่งเนื้อไป Chef House");
  await expect(page.getByRole("dialog")).toContainText(
    "ไม่มี PO ซื้อที่มีเนื้อคงเหลือให้ส่ง",
  );
  await page.keyboard.press("Escape");

  // Foodiva เห็นคงเหลือตรงกัน และ Request ทั้ง 2 ใบรอทำใบขนส่ง
  await signInAs(page, ACCOUNTS.foodiva);
  await expect(
    tableRow(page, "PO เนื้อที่ต้องออก Invoice", poId),
  ).toContainText("0.00 กก.");
  await expect(
    tableSection(page, /^Request เข้า$/).getByRole("button", {
      name: "ทำใบขนส่ง",
    }),
  ).toHaveCount(2);
});

test("ยกเลิก Request (A10): ก่อน Foodiva ทำใบขนส่งยกเลิกได้ · หลังจากนั้นระบบปฏิเสธ", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const poId = await ownerCreatesMeatPo(page, "500");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "500", { poId });

  await signInAs(page, ACCOUNTS.owner);
  const cancelled = await ownerCreatesShipmentRequest(page, [
    { poId, kg: "200" },
  ]);
  await ownerCancelsLatestRequest(page, "ใส่น้ำหนักผิด");
  await expect(page.getByText(/ยกเลิกรายการแล้ว/)).toBeVisible();

  await openMenu(page, "ใบขนส่ง");
  await expect(tableSection(page, /^รายการส่ง$/)).not.toContainText(cancelled);
  await openMenu(page, "ใบสั่ง PO โรงรมควัน");
  await expect(page.locator("main")).not.toContainText(cancelled);
  await openMenu(page, "ใบสั่งซื้อ PO");
  await expect(
    tableRow(page, "รายการใบสั่งซื้อ PO", poId).getByRole("cell").nth(7),
  ).toHaveText("500.00 กก.");

  await signInAs(page, ACCOUNTS.foodiva);
  await expect(tableSection(page, /^Request เข้า$/)).toContainText(
    "ไม่มี Request ที่รอทำใบขนส่ง",
  );

  // Request ใหม่ที่ Foodiva ทำใบขนส่งแล้ว ยกเลิกไม่ได้
  await signInAs(page, ACCOUNTS.owner);
  const shipped = await ownerCreatesShipmentRequest(page, [
    { poId, kg: "300" },
  ]);
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaMakesManifest(page, shipped, ["300"]);
  await signInAs(page, ACCOUNTS.owner);
  const entry = await ownerCancelsLatestRequest(page, "ลองยกเลิกหลังส่ง");
  await expect(entry).toContainText(
    "Foodiva ทำใบขนส่งแล้ว ยกเลิก Request ไม่ได้",
  );
  await openMenu(page, "ใบขนส่ง");
  await expect(tableSection(page, /^รายการส่ง$/)).toContainText(shipped);
});

test("Packing List: ไม่มี PL บันทึกไม่ได้ · ปิดฟอร์มแล้วไม่มีอะไรถูกบันทึก · Inv. Weight น้อยกว่ายอดกล่องถูกปฏิเสธ", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const poId = await ownerCreatesMeatPo(page, "500");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "500", { poId });
  await signInAs(page, ACCOUNTS.owner);
  const shipment = await ownerCreatesShipmentRequest(page, [
    { poId, kg: "250" },
  ]);

  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaOpensManifest(page, shipment);
  const dialog = page.getByRole("dialog");
  const save = page.getByRole("button", { name: "บันทึกใบขนส่ง", exact: true });
  await expect(save).toBeDisabled();
  await expect(dialog).toContainText(
    "ต้องทำ Packing List ของเที่ยวนี้ก่อนจึงจะบันทึกได้",
  );

  await foodivaFillsPackingList(page, ["125", "125"]);
  await expect(dialog).toContainText("2 กล่องรับเข้า · 250.00 กก.");
  await expect(dialog).toContainText("ทำแล้ว");
  await expect(save).toBeEnabled();

  // ยังไม่มีอะไรถูกบันทึก: ปิดแล้วเปิดใหม่ Packing List หายไป
  await pointAndClick(
    page,
    dialog.getByRole("button", { name: "ยกเลิก", exact: true }),
  );
  await expect(dialog).toHaveCount(0);
  await foodivaOpensManifest(page, shipment);
  await expect(
    page.getByRole("button", { name: "สร้าง Packing List", exact: true }),
  ).toBeVisible();

  // Inv. Weight น้อยกว่ายอดรวมกล่อง → ปฏิเสธทั้งใบขนส่งและ Packing List
  await foodivaFillsPackingList(page, ["125", "125"], { invWeightKg: "200" });
  await pointAndClick(page, save);
  await expect(dialog).toContainText("น้ำหนักรวมกล่องรับเข้าเกิน Inv. Weight");
  await pointAndClick(
    page,
    dialog.getByRole("button", { name: "ยกเลิก", exact: true }),
  );
  await expect(
    tableRow(page, "Request เข้า", shipment).getByRole("button", {
      name: "ทำใบขนส่ง",
    }),
  ).toBeVisible();
  await openMenu(page, "ประวัติ");
  await expect(page.locator("main")).not.toContainText("ทำใบขนส่งขาไป");
  await expect(page.locator("main")).not.toContainText("สร้าง Packing List");

  // แก้ Inv. Weight แล้วบันทึกได้
  await foodivaMakesManifest(page, shipment, ["125", "125"], {
    invWeightKg: "250",
  });
  await expect(tableRow(page, "Request เข้า", shipment)).toContainText(
    "ทำใบขนส่งแล้ว · รอ PO รมควัน",
  );
  await openMenu(page, "ประวัติ");
  await expect(page.locator("main")).toContainText("ทำใบขนส่งขาไป");
  await expect(page.locator("main")).toContainText("สร้าง Packing List");
});

test("ช่องเหลือง: เว้นว่างถูกปฏิเสธ · ยอดไม่ตรง Packing List ก็บันทึกได้", async ({
  page,
}) => {
  await startFresh(page);
  const { shipment } = await sendMeatToChefHouse(page, {
    orderedKg: "100",
    requestKg: "50",
    boxes: ["25", "25"],
  });

  await signInAs(page, ACCOUNTS.chef);
  await chefAcceptsSmokePo(page);
  await chefFillsYellowCells(page, shipment, ["24.5", ""]);
  const dialog = page.getByRole("dialog");
  await pointAndClick(page, dialog.locator('button[type="submit"]'));
  await expect(dialog).toContainText("กรอกน้ำหนักจริงทุกกล่องรับเข้า");

  await typeValue(
    page,
    dialog.getByLabel("น้ำหนักจริงกล่องรับเข้าที่ 2", { exact: true }),
    "27",
  );
  await saveEntry(page);
  await openMenu(page, "งานผลิต");
  await expect(page.locator("main")).toContainText("51.50 กก.");

  // Owner เห็นยอดช่องเหลืองและส่วนต่างจาก Foodiva
  await signInAs(page, ACCOUNTS.owner);
  await openMenu(page, "ใบขนส่ง");
  const row = tableRow(page, "รายการส่ง", shipment);
  await expect(row).toContainText("Chef House: 51.50 กก.");
  await expect(row).toContainText("ส่วนต่าง 1.50 กก.");
  await openMenu(page, "ใบสั่ง PO โรงรมควัน");
  await pointAndClick(
    page,
    tableRow(page, "รายการ PO โรงรมควัน", shipment).getByRole("button", {
      name: "ดู Packing List",
    }),
  );
  await expect(page.getByRole("dialog")).toContainText("51.50");
});

test("Foodiva รับเข้าตู้: ต่างจากยอดส่งกลับเกิน 20% ต้องใส่เหตุผล", async ({
  page,
}) => {
  await startFresh(page);
  const { shipment } = await sendMeatToChefHouse(page, {
    orderedKg: "100",
    requestKg: "50",
    boxes: ["25", "25"],
  });
  await chefSmokesShipment(page, shipment, {
    received: ["25", "25"],
    preSmokeKg: "50",
    packs: ["24", "24"],
    wasteKg: "2",
  });

  // ส่งกลับน้อยกว่าผลผลิตได้ (20 จาก 48)
  await signInAs(page, ACCOUNTS.owner);
  await ownerCallsReturnTruck(page, shipment, "20");

  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaFillsReturnReceive(page, shipment, { kg: "15" });
  const dialog = page.getByRole("dialog");
  await pointAndClick(page, dialog.locator('button[type="submit"]'));
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("กรอกเหตุผลส่วนต่าง");

  await field(page, /เหตุผลส่วนต่าง/, "ถุงรั่ว 1 กล่องรมควัน");
  await saveEntry(page);
  await expect(
    tableRow(page, "เนื้อรมควันขากลับ · รับเข้าตู้ Foodiva", shipment),
  ).toContainText("รับแล้ว · ส่วนต่าง 5.00 กก.");
});

test("ชำระ Invoice เนื้อ: ยอดไม่ตรงถูกปฏิเสธ · แนบสลิป 2 ไฟล์ · ไม่แนบสลิปก็ได้", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const withSlips = await ownerCreatesMeatPo(page, "400");
  const withoutSlips = await ownerCreatesMeatPo(page, "200");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "400", {
    poId: withSlips,
    amount: "100000",
  });
  await foodivaIssuesInvoice(page, "200", {
    poId: withoutSlips,
    amount: "50000",
  });

  await signInAs(page, ACCOUNTS.owner);
  await openMenu(page, "ใบ Invoice");
  await pointAndClick(
    page,
    tableRow(page, "Invoice Foodiva", withSlips).getByRole("button", {
      name: "ชำระเงิน",
    }),
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/ยอดชำระ/)).toHaveValue("100000");
  await field(page, /ยอดชำระ/, "99999");
  await field(page, /ผู้ดำเนินการชำระ/, "ฝ่ายบัญชี Owner");
  await pointAndClick(page, dialog.locator('button[type="submit"]'));
  await expect(dialog).toContainText("ยอดชำระต้องเท่ากับยอดรวม Invoice เนื้อ");
  await pointAndClick(
    page,
    dialog.getByRole("button", { name: "ยกเลิก", exact: true }),
  );
  await expect(
    tableRow(page, "Invoice Foodiva", withSlips).getByRole("button", {
      name: "ชำระเงิน",
    }),
  ).toBeVisible();

  await ownerPaysMeatInvoice(page, withSlips, [slipImage(), slipPdf()]);
  const paid = tableRow(page, "Invoice Foodiva", withSlips);
  await expect(paid).toContainText("ชำระแล้ว");
  await expect(
    paid.getByRole("button", { name: "slip-photo.png" }),
  ).toBeVisible();
  await expect(
    paid.getByRole("button", { name: "slip-transfer.pdf" }),
  ).toBeVisible();

  await ownerPaysMeatInvoice(page, withoutSlips);
  const noSlip = tableRow(page, "Invoice Foodiva", withoutSlips);
  await expect(noSlip).toContainText("ชำระแล้ว");
  await expect(noSlip).toContainText("ไม่มีสลิป");

  const bell = await openNotifications(page);
  await expect(bell).not.toContainText("รอชำระ Invoice เนื้อ");
  await closeNotifications(page);

  // ประวัติแสดงสลิปเป็นชื่อไฟล์ ไม่ใช่ JSON ดิบ
  await openMenu(page, "Log");
  const payment = page
    .locator("details")
    .filter({ hasText: "ชำระ Invoice เนื้อ Foodiva" })
    .filter({ hasText: `FD-INV-${withSlips.slice(-4)}` })
    .first();
  await pointAndClick(page, payment.locator("summary"));
  await expect(payment).toContainText("slip-photo.png");
  await expect(payment).not.toContainText("storageKey");
});

test("Owner ได้แจ้งเตือน Packing List โดยไม่ต้องรีเฟรช (poll ~15 วินาที)", async ({
  page,
  browser,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const poId = await ownerCreatesMeatPo(page, "500");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "500", { poId });
  await signInAs(page, ACCOUNTS.owner);
  const shipment = await ownerCreatesShipmentRequest(page, [
    { poId, kg: "500" },
  ]);
  const bell = await openNotifications(page);
  await expect(bell).toContainText(`รอ Foodiva ทำใบขนส่ง · ${shipment}`);

  // Foodiva works in a second browser; the Owner's page is never reloaded.
  const foodivaContext = await browser.newContext();
  try {
    const foodiva = await foodivaContext.newPage();
    await installVisibleCursor(foodiva);
    await foodiva.goto("/");
    await signInAs(foodiva, ACCOUNTS.foodiva);
    await foodivaMakesManifest(foodiva, shipment, ["250", "250"]);
  } finally {
    await foodivaContext.close();
  }

  await expect(bell).toContainText(`Packing List พร้อมแล้ว · ${shipment}`, {
    timeout: 40_000,
  });
  await expect(
    sidebar(page).getByRole("button", {
      name: /^ใบสั่ง PO โรงรมควัน\s*1$/,
    }),
  ).toBeVisible();
  await pointAndClick(
    page,
    bell.getByRole("button", { name: /Packing List พร้อมแล้ว/ }),
  );
  await expect(page).toHaveURL(/\/owner\/smoke-po/);
  await expect(
    tableRow(page, "รายการ PO โรงรมควัน", shipment).getByRole("button", {
      name: "ออก PO รมควันเนื้อ",
    }),
  ).toBeEnabled();
});

test("Chef House มองไม่เห็นเลข PO ซื้อ ราคาเนื้อ หรือเลข Invoice Foodiva ในทุกหน้าและทุก dialog", async ({
  page,
}) => {
  await startFresh(page);
  const { poId, shipment } = await sendMeatToChefHouse(page, {
    orderedKg: "100",
    requestKg: "60",
    boxes: ["30", "30"],
    price: MEAT_PRICE,
  });
  const secrets = [MEAT_PRICE, `FD-INV-${poId.slice(-4)}`];
  const dialog = page.getByRole("dialog");
  const cancel = () =>
    pointAndClick(
      page,
      dialog.getByRole("button", { name: "ยกเลิก", exact: true }).last(),
    );

  await signInAs(page, ACCOUNTS.chef);
  for (const menu of ["ยืนยันรับเนื้อ", "งานผลิต", "สต๊อก", "ประวัติ"]) {
    await openMenu(page, menu);
    await expect(menuItem(page, menu)).toBeVisible();
    await expectNoPurchaseData(page, secrets);
  }

  await openMenu(page, "งานผลิต");
  await pointAndClick(page, chefLotButton(page, "ดู PO รมควัน"));
  await expect(dialog).toContainText(shipment);
  await expectNoPurchaseData(page, secrets);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await pointAndClick(page, chefLotButton(page, "ยืนยันรับ PO รมควัน"));
  await expectNoPurchaseData(page, secrets);
  await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef House");
  await saveEntry(page);

  await chefFillsYellowCells(page, shipment, ["30", "29.5"]);
  await expect(dialog).toContainText("กล่องรับเข้า");
  await expectNoPurchaseData(page, secrets);
  await saveEntry(page);

  await openMenu(page, "งานผลิต");
  await pointAndClick(page, chefLotButton(page, "น้ำหนักก่อนสโมค"));
  await expectNoPurchaseData(page, secrets);
  await cancel();
  await chefRecordsPreSmoke(page, "59");

  await pointAndClick(page, chefLotButton(page, "บันทึก Lot สโมครายวัน"));
  await expectNoPurchaseData(page, secrets);
  await cancel();
  await chefSmokes(page, { inputKg: "59", wasteKg: "1", packs: ["29", "29"] });

  await pointAndClick(page, chefLotButton(page, "Edit ข้อมูลก่อนปิด Lot"));
  await expect(dialog).toBeVisible();
  await expectNoPurchaseData(page, secrets);
  await cancel();

  await pointAndClick(page, chefLotButton(page, "ยืนยันปิด Lot"));
  await expectNoPurchaseData(page, secrets);
  await cancel();
  await chefClosesLot(page);

  await pointAndClick(page, chefLotButton(page, "สร้าง / Submit ใบวางบิล"));
  await expectNoPurchaseData(page, secrets);
  await cancel();
  await chefSubmitsInvoice(page, "CH-INV-0002");

  for (const menu of ["ยืนยันรับเนื้อ", "งานผลิต", "สต๊อก", "ประวัติ"]) {
    await openMenu(page, menu);
    await expectNoPurchaseData(page, secrets);
  }
  // History entries opened one by one: their values are what could leak.
  for (const summary of await page.locator("main details summary").all())
    await summary.click();
  await expectNoPurchaseData(page, secrets);
});
