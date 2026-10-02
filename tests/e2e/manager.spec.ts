import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  BATCH_ID,
  SCREENS,
  SHIPMENT_NO,
  changeRow,
  closeBatch,
  createPurchasePo,
  field,
  issueMeatInvoice,
  logRow,
  menuItem,
  openBranchTask,
  openMenu,
  openSmokingInvoice,
  pointAndClick,
  receiveIntoFreezer,
  recordDispatch,
  recordPreSmoke,
  recordSmoke,
  saveEntry,
  signInAs,
  startFresh,
  step,
  tableRow,
  tableSection,
  typeValue,
  weighIn,
} from "./helpers";

/* Checklist Merge Roles 2 + 3: the Account Manager records Foodiva's and Chef House's
 * steps from the same /owner tabs, the log names it "Account Manager · แทน …", and it
 * has no dashboard and no sales money. */
test("Account Manager records Foodiva and Chef House steps; no dashboard, no sales money", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.manager);
  let batch = "";
  let shipment = "";

  await step(page, "Account Manager: ไม่มีแดชบอร์ด", async () => {
    await expect(menuItem(page, SCREENS.ownerDashboard.menu)).toHaveCount(0);
    await expect(menuItem(page, SCREENS.batches.menu)).toBeVisible();
    await expect(menuItem(page, SCREENS.weighIn.menu)).toBeVisible();
    await expect(menuItem(page, SCREENS.production.menu)).toBeVisible();
    // /owner lands the Owner on the dashboard; the manager is sent to its PO tab.
    await page.goto("/owner");
    await expect(page).toHaveURL(/\/owner\/po(?:[/?#]|$)/);
  });

  await step(
    page,
    "Account Manager (แทน Foodiva): PO ซื้อ Invoice เนื้อ ใบขนส่ง + Packing List",
    async () => {
      const poId = await createPurchasePo(page, "100", "250");
      await issueMeatInvoice(page, poId, "100");
      await recordDispatch(page, "", "100");
      const text = await tableRow(
        page,
        SCREENS.batches.table,
        BATCH_ID,
      ).innerText();
      batch = text.match(BATCH_ID)![0];
      shipment = text.match(SHIPMENT_NO)![0];
    },
  );

  await step(
    page,
    "Account Manager (แทน Chef House): ชั่งรับ ก่อนสโมค สโมค ปิด Lot Invoice ค่ารม",
    async () => {
      await weighIn(page, shipment, "98");
      await recordPreSmoke(page, batch, "96");
      await recordSmoke(page, batch, {
        inputKg: "96",
        wasteKg: "4",
        packs: ["46", "46"],
      });
      await closeBatch(page, batch);
      await openSmokingInvoice(page, batch, {
        invoiceNo: "CH-INV-0200",
        billedKg: "92",
        amount: "4600",
      });
      await saveEntry(page);
    },
  );

  await step(page, "Account Manager (แทน Foodiva): รับเข้าตู้", async () => {
    await receiveIntoFreezer(page, shipment, "92", "2");
  });

  await step(page, "Account Manager: Log บอกว่าบันทึกแทนใคร", async () => {
    await openMenu(page, "Log");
    const rows = page.locator("main details");
    await expect(
      rows.filter({ hasText: "Account Manager · แทน Foodiva" }).first(),
    ).toBeVisible();
    await expect(
      rows.filter({ hasText: "Account Manager · แทน Chef House" }).first(),
    ).toBeVisible();
    await expect(rows.filter({ hasText: /Owner · แทน/ })).toHaveCount(0);
  });

  await step(page, "Account Manager: รายงานไม่มีเงินยอดขาย", async () => {
    await openMenu(page, "รายงาน");
    const summary = tableSection(page, /^สรุปผลรวม$/);
    await expect(summary).toBeVisible();
    await expect(summary).not.toContainText("ยอดขาย LINE MAN");
    await expect(summary).not.toContainText("ส่วนต่างหลังต้นทุนที่บันทึก");
  });
});

/* C4: the Account Manager's copy of a sale carries no money. It corrects the rest of the
 * sale all the same, and the money stays as the branch recorded it. */
test("ACC-20 EDT-22 EDT-25 the Account Manager edits a branch's sale without its money; the Owner reads the new weight, the same LINE MAN amount and who changed it", async ({
  page,
}) => {
  const sale = "บันทึกยอดขาย / Waste";
  /** The rows of a sale that are money: typed, recorded, and priced from the menu. */
  const MONEY = /LINE MAN|ยอดขายบันทึก|ยอดตามเมนู/;
  await startFresh(page);

  await step(page, "สาขาศาลาแดง: จดยอดขาย LINE MAN 3,000 บาท", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await openBranchTask(page, "จดยอดขาย");
    await field(page, /กล่องมาตรฐาน/, "20");
    await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "2");
    await field(page, /ยอดขาย LINE MAN/, "3000");
    await saveEntry(page);
  });

  await step(
    page,
    "Account Manager: Log ไม่มีเงินขาย แก้ไขน้ำหนักเนื้อที่ใช้ไปได้ ฟอร์มไม่มีช่อง LINE MAN",
    async () => {
      await signInAs(page, ACCOUNTS.manager);
      await openMenu(page, "Log");
      const entry = logRow(page, sale);
      await pointAndClick(page, entry.locator("summary"));
      await expect(entry).toContainText("น้ำหนักเนื้อที่ใช้ไปจริงวันนี้");
      await expect(entry).not.toContainText(MONEY);
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "แก้ไข", exact: true }),
      );
      for (const label of [
        /^กล่องมาตรฐาน/,
        /^น้ำพริกหลอด/,
        /^ตรวจนับน้ำพริกจริงปลายวัน/,
        /^น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/,
        /^น้ำหนักเนื้อที่เสียไป/,
        /^น้ำหนักข้าวที่เสียไป/,
        /^ค่าใช้จ่ายสาขา/,
        "เหตุผลที่แก้ไข",
      ])
        await expect(entry.getByLabel(label)).toHaveCount(1);
      await expect(entry.getByLabel(/LINE MAN|ยอดขาย/)).toHaveCount(0);
      await typeValue(
        page,
        entry.getByLabel(/^น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/),
        "2.5",
      );
      await typeValue(page, entry.getByLabel("เหตุผลที่แก้ไข"), "ชั่งใหม่");
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
      );
      await expect(entry.locator("summary")).toContainText("แก้ไขแล้ว");
      await expect(entry).toContainText("2 → 2.5");
      await expect(entry).not.toContainText(MONEY);
    },
  );

  await step(
    page,
    "Owner: น้ำหนักใหม่ เงินขายเท่าเดิม ประวัติการแก้ไขบอกว่า Account Manager แก้",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, "Log");
      const entry = logRow(page, sale);
      await pointAndClick(page, entry.locator("summary"));
      await expect(entry).toContainText(/ใช้ไปจริงวันนี้ \(กก\.\)\s*2\.5/);
      // The money the manager never held is as the branch recorded it.
      for (const money of [
        /ยอดขาย LINE MAN ที่บันทึก \(บาท\)\s*3000/,
        /ยอดขายบันทึก\s*3000/,
        /ยอดตามเมนู\s*7000/,
      ])
        await expect(entry).toContainText(money);
      const change = changeRow(page, `แก้ไขรายการ · ${sale}`);
      await expect(change).toContainText("Account Manager");
      await expect(change).toContainText("ชั่งใหม่");
      await expect(change).toContainText("2 → 2.5");
      await expect(change).not.toContainText(MONEY);
    },
  );
});
