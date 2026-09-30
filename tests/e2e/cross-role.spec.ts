import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  BATCH_ID,
  NO_LOT,
  SCREENS,
  SHIPMENT_NO,
  acceptSmokePo,
  branchReceive,
  closeBatch,
  createPurchasePo,
  expectWarning,
  idsOnScreen,
  issueMeatInvoice,
  openMenu,
  openSmokePo,
  openSmokingInvoice,
  pointAndClick,
  recordDispatch,
  recordPreSmoke,
  recordSmoke,
  saveEntry,
  signInAs,
  startFresh,
  step,
  tableRow,
  weighIn,
} from "./helpers";

/* Checklist "ทดสอบก่อน" 1: one smoke batch recorded back to front across three roles.
 * Chef House opens it, Foodiva adds the transport document to it, the Owner issues the
 * smoke PO on it last and Chef House accepts that PO. No step waits on another, and the
 * batch never splits into two. */
test("PRIN-01 GEN-09 VIS-02 SMK-01 SMK-03 CHF-01 CHF-03 SVC-01 reverse-order batch across roles stays one batch", async ({
  page,
}) => {
  await startFresh(page);
  let batch = "";
  let shipment = "";

  await step(
    page,
    "Chef House: เปิดชุดใหม่ ชั่งรับโดยไม่มี Packing List / PO",
    async () => {
      await signInAs(page, ACCOUNTS.chef);
      await weighIn(page, "", ["50", "50"]);
      await openMenu(page, SCREENS.production.menu);
      const batches = await idsOnScreen(page, BATCH_ID);
      expect(batches, "one new batch").toHaveLength(1);
      batch = batches[0];
      await expect(
        tableRow(page, SCREENS.production.table, batch),
      ).toContainText("ยังไม่มี PO รมควัน");
    },
  );

  await step(
    page,
    "Chef House: ก่อนสโมค สโมค ปิด Lot ใบวางบิล ก่อนมี PO",
    async () => {
      await recordPreSmoke(page, batch, "95");
      await recordSmoke(page, batch, {
        inputKg: "95",
        wasteKg: "5",
        packs: ["45", "45"],
      });
      await closeBatch(page, batch);
      await openSmokingInvoice(page, batch, {
        invoiceNo: "CH-INV-0001",
        billedKg: "90",
        amount: "4500",
      });
      await expectWarning(page, "ยังไม่มี PO รมควันของชุดนี้");
      await saveEntry(page);
    },
  );

  let poWithInvoice = "";
  let poWithoutInvoice = "";
  await step(page, "Owner: PO ซื้อ 2 ใบ", async () => {
    await signInAs(page, ACCOUNTS.owner);
    poWithInvoice = await createPurchasePo(page, "300", "250");
    poWithoutInvoice = await createPurchasePo(page, "200", "310");
  });

  await step(
    page,
    "Foodiva: เห็นชุดของ Chef House แล้วทำใบขนส่ง + Packing List บนชุดนั้น",
    async () => {
      await signInAs(page, ACCOUNTS.foodiva);
      await openMenu(page, SCREENS.batches.menu);
      const row = tableRow(page, SCREENS.batches.table, batch);
      await expect(row).toHaveCount(1);
      shipment = (await row.innerText()).match(SHIPMENT_NO)![0];
      await recordDispatch(page, batch, ["50", "50"]);
      await expect(row).toContainText("100.00 กก.");
      await expect(
        row.getByRole("button", { name: "แก้ไข Packing List" }),
      ).toBeVisible();
      await issueMeatInvoice(page, poWithInvoice, "300");
    },
  );

  await step(
    page,
    "Owner: ออก PO รมควันบนชุดเดิม อ้าง PO ซื้อ 2 ใบ (ใบหนึ่งยังไม่มี Invoice)",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openSmokePo(page, batch, [
        { poId: poWithInvoice, kg: "60" },
        { poId: poWithoutInvoice, kg: "40" },
      ]);
      await expectWarning(
        page,
        `${poWithoutInvoice} ยังไม่มี Invoice เนื้อจาก Foodiva`,
      );
      await saveEntry(page);
      await openMenu(page, SCREENS.smokePo.menu);
      expect(await idsOnScreen(page, BATCH_ID)).toEqual([batch]);
      const row = tableRow(page, SCREENS.smokePo.table, batch);
      await expect(row).toContainText(poWithInvoice);
      await expect(row).toContainText(poWithoutInvoice);
      await expect(row).toContainText("รอยืนยัน");
      await expect(row).toContainText("CH-INV-0001");
    },
  );

  await step(
    page,
    "Chef House: เห็น PO รมควันบนชุดเดิมและยืนยันรับ",
    async () => {
      await signInAs(page, ACCOUNTS.chef);
      await acceptSmokePo(page, batch);
      await openMenu(page, SCREENS.production.menu);
      expect(await idsOnScreen(page, BATCH_ID)).toEqual([batch]);
      const row = tableRow(page, SCREENS.production.table, batch);
      await expect(row).not.toContainText("ยังไม่มี PO รมควัน");
      await expect(
        row.getByRole("button", { name: "ยืนยันรับ PO รมควัน" }),
      ).toHaveCount(0);
    },
  );

  await step(page, "Owner: ชุดเดียว เลขที่การส่งเดียว", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await openMenu(page, SCREENS.smokePo.menu);
    const row = tableRow(page, SCREENS.smokePo.table, batch);
    await expect(row).toContainText(shipment);
    await expect(row).toContainText("รับแล้ว");
    expect(await idsOnScreen(page, SHIPMENT_NO)).toEqual([shipment]);
  });
});

/* Checklist "ทดสอบก่อน" 2 (Owner side) and A6: what was recorded without its source
 * shows on the Owner dashboard, and a batch with only some documents still traces. */
test("DASH-01 DASH-05 dashboard counts what is not linked yet; a partial batch traces with —", async ({
  page,
}) => {
  await startFresh(page);
  let batch = "";
  let shipment = "";
  let poId = "";

  await step(
    page,
    "สาขา: รับเนื้อไม่ระบุ Lot ทั้งสองสาขา + รับวัสดุไม่มีใบโอน",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await branchReceive(page, NO_LOT, "10");
      await openMenu(page, SCREENS.materialReceive.menu);
      await pointAndClick(
        page,
        page.getByRole("button", { name: "รับวัสดุโดยไม่มีใบโอน" }),
      );
      const main = page.locator("main");
      await main
        .getByRole("combobox", { name: "วัสดุ แถวที่ 1" })
        .selectOption({ index: 1 });
      await main.getByLabel("จำนวนที่รับจริง แถวที่ 1").fill("20");
      await main
        .getByLabel("ชื่อผู้รับจริง", { exact: true })
        .last()
        .fill("ผู้ดูแลสาขาศาลาแดง");
      await pointAndClick(
        page,
        main.getByRole("button", { name: "บันทึกรับวัสดุ" }),
      );
      await expect(
        main.getByRole("button", { name: "บันทึกรับวัสดุ" }),
      ).toHaveCount(0);
      await signInAs(page, ACCOUNTS.minburi);
      await branchReceive(page, NO_LOT, "4");
    },
  );

  await step(page, "Chef House: ชุดที่มีแค่ชั่งรับกับสโมค", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await weighIn(page, "", ["40"]);
    await openMenu(page, SCREENS.production.menu);
    batch = (await idsOnScreen(page, BATCH_ID))[0];
    await recordSmoke(page, batch, { inputKg: "38", packs: ["19", "19"] });
  });

  await step(page, "Owner: แดชบอร์ด ยังไม่ผูก", async () => {
    await signInAs(page, ACCOUNTS.owner);
    poId = await createPurchasePo(page, "200", "250");
    await openMenu(page, SCREENS.smokePo.menu);
    shipment = (
      await tableRow(page, SCREENS.smokePo.table, batch).innerText()
    ).match(SHIPMENT_NO)![0];
    await openMenu(page, SCREENS.ownerDashboard.menu);
    const tile = page.getByRole("region", { name: "ยังไม่ผูก" });
    await expect(tile).toContainText("14.00 กก.");
    await expect(tile).toContainText("ศาลาแดง 10.00 กก. · มีนบุรี 4.00 กก.");
    await expect(tile).toContainText("1 รายการ");
    await expect(tile).toContainText("1 ชุด");
    await expect(tile).toContainText(shipment);
    await expect(tile).toContainText("1 ใบ");
    await expect(tile).toContainText(poId);
  });

  await step(page, "Owner: Traceability ของชุดที่มีเอกสารบางส่วน", async () => {
    await openMenu(page, SCREENS.traceability.menu);
    const row = page
      .locator("main")
      .getByRole("row")
      .filter({ hasText: batch });
    await expect(row.first()).toBeVisible();
    await expect(row.first()).toContainText("—");
    await pointAndClick(page, row.first());
    const main = page.locator("main");
    // The steps it has show their figures; every step it lacks is "—", none hidden.
    await expect(main).toContainText("3. Chef House รับจริง40.00 กก.");
    await expect(main).toContainText("4. รมควันเสร็จ2 กล่องรมควัน · 38.00 กก.");
    await expect(main).toContainText("2. ส่งไป Chef House—");
    await expect(main).toContainText("5. ส่งกลับ Foodiva—");
    await expect(main).toContainText("PO โรงรมควัน————");
    await expect(main).toContainText("รับเข้าสต๊อกกลาง————");
    await expect(page.getByText(/Application error|Unhandled/)).toHaveCount(0);
  });
});
