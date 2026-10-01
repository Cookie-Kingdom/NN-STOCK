import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  BATCH_ID,
  SCREENS,
  SHIPMENT_NO,
  acceptSmokePo,
  branchReceive,
  branchStockRow,
  closeBatch,
  createPurchasePo,
  field,
  idsOnScreen,
  issueMeatInvoice,
  lotSelect,
  meatStockRow,
  openBranchTask,
  openMenu,
  openSmokePo,
  openSmokingInvoice,
  receiveCentral,
  receiveIntoFreezer,
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

const BRANCH = "ศาลาแดง";

/* Checklist Merge Roles 1 + 3: the Owner records every step of one batch from /owner —
 * Foodiva's and Chef House's included — without switching accounts; then the branch
 * receives and sells it. */
test("PRIN-01 full loop from purchase PO to branch sale, partner steps typed by the Owner", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  let poId = "";
  let batch = "";
  let shipment = "";

  await step(page, "Owner: PO ซื้อเนื้อ", async () => {
    poId = await createPurchasePo(page, "100", "250");
  });

  await step(page, "Owner (แทน Foodiva): Invoice เนื้อ", async () => {
    await issueMeatInvoice(page, poId, "100");
    await expect(
      tableRow(page, SCREENS.meatInvoice.table, poId).getByRole("button", {
        name: "ออกและอัปโหลด Invoice",
      }),
    ).toHaveCount(0);
  });

  await step(
    page,
    "Owner (แทน Foodiva): ใบขนส่ง + Packing List ชุดใหม่",
    async () => {
      await recordDispatch(page, "", "100");
      const row = tableRow(page, SCREENS.batches.table, BATCH_ID);
      await expect(row).toHaveCount(1);
      const text = await row.innerText();
      batch = text.match(BATCH_ID)![0];
      shipment = text.match(SHIPMENT_NO)![0];
      await expect(row).toContainText("100.00 กก.");
    },
  );

  await step(
    page,
    "Owner: PO รมควันบนชุดเดิม อ้าง PO ซื้อ แล้วยืนยันรับแทน Chef House",
    async () => {
      await openSmokePo(page, batch, [{ poId, kg: "100" }]);
      await saveEntry(page);
      await acceptSmokePo(page, batch);
    },
  );

  await step(page, "Owner (แทน Chef House): ชั่งรับเนื้อ", async () => {
    await weighIn(page, shipment, "98");
    await expect(tableRow(page, SCREENS.weighIn.table, shipment)).toHaveCount(
      0,
    );
  });

  await step(
    page,
    "Owner (แทน Chef House): ก่อนสโมค สโมค ปิด Lot Invoice ค่ารม",
    async () => {
      await recordPreSmoke(page, batch, "96");
      await recordSmoke(page, batch, {
        inputKg: "96",
        wasteKg: "4",
        packs: ["46", "46"],
      });
      await closeBatch(page, batch);
      await openSmokingInvoice(page, batch, {
        invoiceNo: "CH-INV-0100",
        amount: "4600",
      });
      await saveEntry(page);
    },
  );

  await step(page, "Owner (แทน Foodiva): รับเข้าตู้", async () => {
    await receiveIntoFreezer(page, shipment, "92", "2");
    await expect(tableRow(page, SCREENS.freezer.table, shipment)).toContainText(
      "รอ Owner รับเข้าสต๊อกกลาง",
    );
  });

  await step(page, "Owner: รับเข้าสต๊อกกลาง 92 กก.", async () => {
    await receiveCentral(page, batch, "92");
    await expect(await meatStockRow(page, batch)).toContainText("92.00 กก.");
  });

  await step(
    page,
    "Owner: ชุดเดียวตลอดสาย · Log บอกว่าบันทึกแทนใคร",
    async () => {
      await openMenu(page, SCREENS.production.menu);
      expect(await idsOnScreen(page, BATCH_ID)).toEqual([batch]);
      await openMenu(page, "Log");
      const main = page.locator("main details");
      await expect(
        main.filter({ hasText: "Owner · แทน Chef House" }).first(),
      ).toBeVisible();
      await expect(
        main.filter({ hasText: "Owner · แทน Foodiva" }).first(),
      ).toBeVisible();
    },
  );

  await step(page, "สาขาศาลาแดง: รับของ ละลาย ขาย", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await branchReceive(page, batch, "30");
    await openBranchTask(page, "แบ่งละลาย");
    await lotSelect(page).selectOption(batch);
    await field(page, /น้ำหนักละลาย/, "10");
    await saveEntry(page);
    await openBranchTask(page, "บันทึกยอดขาย");
    await lotSelect(page).selectOption(batch);
    await field(page, /กล่องมาตรฐาน/, "20");
    await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "4");
    await saveEntry(page);
    await expect(await branchStockRow(page, BRANCH, batch)).toContainText(
      "แช่แข็ง 20.00 · ชิล/ละลายแล้ว 6.00",
    );
  });

  await step(
    page,
    "Owner: สาขารับเองแล้วสต๊อกกลางของชุดลด 30 กก.",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      const row = await meatStockRow(page, batch);
      await expect(row).toContainText("62.00 กก.");
      await expect(row).toContainText("20.00 แช่แข็ง / 6.00 ชิล/ละลายแล้ว");
    },
  );
});
