import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  BATCH_ID,
  MISSING,
  NO_LOT,
  PACKING_LIST_FILE,
  SCREENS,
  SHIPMENT_NO,
  bangkokDate,
  branchReceive,
  branchReceiveChili,
  branchStockRow,
  changeRow,
  createPurchasePo,
  expectWarning,
  field,
  issueSmokePoOnNewBatch,
  logRow,
  lotSelect,
  menuItem,
  openBranchTask,
  openMenu,
  openWeighIn,
  ownerBuyChili,
  ownerBuyMaterial,
  ownerStockRow,
  pointAndClick,
  recordDispatch,
  saveDispatchDialog,
  saveEntry,
  saveMaterialReceipt,
  setWorkingDate,
  signInAs,
  startFresh,
  step,
  tableRow,
  topDialog,
  typeValue,
  weighIn,
} from "./helpers";

/* Account & Stocking, round 2026-09-30: the app records what happened and no longer gates
 * it. An empty field is saved and marked, a closed day still takes entries, the Packing
 * List is a file plus one total, and cooked rice starts from zero every day. What each
 * test walks is the flow as it is now (vault: Features/Account Stocking/Checklist
 * 2026-09-30). */

test.beforeEach(async ({ page }) => {
  await startFresh(page);
});

test("GEN-02 PRIN-03 EDT-01 a purchase PO saves with empty fields marked ยังไม่ได้กรอก, refuses a negative weight, and is completed from the Log", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.owner);
  await openMenu(page, SCREENS.purchasePo.menu);
  await pointAndClick(
    page,
    page.getByRole("button", { name: "สร้าง PO เนื้อ" }),
  );
  const dialog = topDialog(page);
  for (const [label, value] of [
    [/ชื่อบริษัท \/ ลูกค้า/, "บริษัท เนิร์ดเนื้อ จำกัด"],
    [/ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร"],
    [/ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ"],
    [/เลขประจำตัวผู้เสียภาษี/, "0100000000000"],
    [/ขนาดบรรจุ/, "6 ชิ้นต่อถุง"],
    [/^รายการสินค้า/, "เนื้อวัวสำหรับรมควัน"],
    [/ราคาเนื้อ/, "250"],
  ] as const)
    await typeValue(page, dialog.getByLabel(label).last(), value);
  // Seller and phone stay empty: the form counts them and still offers the save.
  await dialog.getByLabel(/ผู้ขาย · Foodiva/).fill("");
  await dialog.getByLabel(/เบอร์ติดต่อ/).fill("");

  await step(page, "Owner: น้ำหนักติดลบ ยังปฏิเสธ", async () => {
    await field(page, /น้ำหนักสั่งซื้อ/, "-5");
    await pointAndClick(page, dialog.locator('button[type="submit"]').last());
    await expect(dialog).toContainText(/กรอก.*เป็นตัวเลขมากกว่าศูนย์/);
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  await step(page, "Owner: เว้นว่าง 2 ช่อง บันทึกได้", async () => {
    await field(page, /น้ำหนักสั่งซื้อ/, "300");
    await expect(dialog).toContainText(`${MISSING} 2 ช่อง · บันทึกได้`);
    await saveEntry(page);
  });

  // The PO's own row, not the edit entry that names it later.
  const entry = page
    .locator("main details")
    .filter({ has: page.locator("summary", { hasText: /^สร้าง PO เนื้อ/ }) })
    .first();

  await step(page, "Owner: Log ขึ้นยังไม่ได้กรอกแทนค่า", async () => {
    await openMenu(page, "Log");
    await expect(entry.locator("summary")).toContainText(`${MISSING} 2 ช่อง`);
    await pointAndClick(page, entry.locator("summary"));
    await expect(entry.getByText(MISSING, { exact: true })).toHaveCount(2);
  });

  /* EDT-01: the PO is edited from the Log like a cell in a sheet. Filling one of the two
   * empty fields leaves one marker (`missing` is recomputed on every save), and a new
   * weight reaches the PO itself. */
  await step(
    page,
    "Owner: แก้ไข PO จาก Log เติมผู้ขาย แก้น้ำหนัก",
    async () => {
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "แก้ไข", exact: true }),
      );
      await typeValue(page, entry.getByLabel(/ผู้ขาย · Foodiva/), "Foodiva");
      await typeValue(page, entry.getByLabel(/น้ำหนักสั่งซื้อ/), "320");
      await typeValue(
        page,
        entry.getByLabel("เหตุผลที่แก้ไข"),
        "เติมชื่อผู้ขาย แก้น้ำหนักตามใบสั่ง",
      );
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
      );
      await expect(entry.locator("summary")).toContainText("แก้ไขแล้ว");
      await expect(entry.locator("summary")).toContainText(`${MISSING} 1 ช่อง`);
    },
  );

  await step(page, "Owner: PO ใช้น้ำหนักใหม่ ไม่มี PO ใบที่สอง", async () => {
    await openMenu(page, SCREENS.meatInvoice.menu);
    const rows = tableRow(page, SCREENS.meatInvoice.table, /PO-\d{4}-\d{4}/);
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("320.00 กก.");
  });
});

/* EDT-01: a batch step is corrected from the Log too, here Chef House's weigh-in total,
 * which has no field in the generic form table. The batch reads the new figure at once. */
test("EDT-01 EDT-17 the weigh-in total is corrected from the Log and the batch follows", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.owner);
  await weighIn(page, "", "40");
  await openMenu(page, SCREENS.production.menu);
  const batch = tableRow(page, SCREENS.production.table, BATCH_ID);
  await expect(batch).toContainText("40.00 กก.");

  await openMenu(page, "Log");
  const entry = page
    .locator("main details")
    .filter({
      has: page.locator("summary", {
        hasText: /^ยืนยันรับเนื้อที่ Chef House/,
      }),
    })
    .first();
  await pointAndClick(page, entry.locator("summary"));
  await pointAndClick(
    page,
    entry.getByRole("button", { name: "แก้ไข", exact: true }),
  );
  await typeValue(page, entry.getByLabel(/^น้ำหนักรับรวม/), "42");
  await typeValue(page, entry.getByLabel("เหตุผลที่แก้ไข"), "ชั่งใหม่");
  await pointAndClick(
    page,
    entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
  );
  await expect(entry.locator("summary")).toContainText("แก้ไขแล้ว");

  await openMenu(page, SCREENS.production.menu);
  await expect(batch).toContainText("42.00 กก.");
});

/* EDT-22/22: a branch corrects its own entry without asking anyone; what the Owner gets is
 * the change log, with who changed what, and a one-press undo. */
test("EDT-22 EDT-25 a branch corrects its own entry at once and the Owner reads it in the change log", async ({
  page,
}) => {
  const edit = "แก้ไขรายการ · รับของเข้าสาขา";

  await step(page, "สาขาศาลาแดง: รับ 10 กก. แล้วแก้เป็น 12 เอง", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await branchReceive(page, NO_LOT, "10");
    await openMenu(page, "ประวัติ");
    const entry = logRow(page, "รับของเข้าสาขา");
    await pointAndClick(page, entry.locator("summary"));
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "แก้ไข", exact: true }),
    );
    await typeValue(page, entry.getByLabel(/น้ำหนักรับเข้าสาขา/), "12");
    await typeValue(page, entry.getByLabel("เหตุผลที่แก้ไข"), "ชั่งใหม่");
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
    );
    await expect(entry.locator("summary")).toContainText("แก้ไขแล้ว");
    await expect(await branchStockRow(page, "ศาลาแดง", "")).toContainText(
      "แช่แข็ง 12.00",
    );
  });

  await step(page, "Owner: อ่านการแก้ไขของสาขา แล้วย้อนกลับ", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await openMenu(page, "Log");
    const row = changeRow(page, edit);
    await expect(row).toContainText("ศาลาแดง");
    await expect(row).toContainText("ชั่งใหม่");
    await expect(row).toContainText("10 → 12");
    await pointAndClick(
      page,
      row.getByRole("button", { name: "ย้อนกลับ", exact: true }),
    );
    await expect(row).toContainText("ย้อนกลับแล้ว");
  });

  await step(page, "สาขาศาลาแดง: สต๊อกกลับเป็น 10 กก.", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await expect(await branchStockRow(page, "ศาลาแดง", "")).toContainText(
      "แช่แข็ง 10.00",
    );
    await openMenu(page, "ประวัติ");
    await expect(
      changeRow(page, "ย้อนกลับการแก้ไข · รับของเข้าสาขา"),
    ).toBeVisible();
    await expect(changeRow(page, edit)).toContainText("ย้อนกลับแล้ว");
  });
});

/* EDT-23: a delete is an entry in the log too, so the deleted one is put back from it. */
test("EDT-23 a deleted entry leaves the figures and comes back when restored", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.saladaeng);
  await branchReceive(page, NO_LOT, "10");
  await expect(await branchStockRow(page, "ศาลาแดง", "")).toContainText(
    "แช่แข็ง 10.00",
  );

  await step(page, "สาขาศาลาแดง: ลบรายการรับของ ยอดหาย", async () => {
    await openMenu(page, "ประวัติ");
    const entry = logRow(page, "รับของเข้าสาขา");
    await pointAndClick(page, entry.locator("summary"));
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "ลบรายการ", exact: true }),
    );
    await typeValue(page, entry.getByLabel("เหตุผล"), "บันทึกซ้ำ");
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "ยืนยันลบ", exact: true }),
    );
    await expect(page.getByText("ลบรายการแล้ว ระบบคำนวณยอดใหม่")).toBeVisible();
    await expect(entry.locator("summary")).toContainText("ลบแล้ว");
    await expect(await branchStockRow(page, "ศาลาแดง", "")).toHaveCount(0);
  });

  await step(page, "สาขาศาลาแดง: กู้คืนจากรายการลบ ยอดกลับมา", async () => {
    await openMenu(page, "ประวัติ");
    const deletion = logRow(page, "ลบรายการ · รับของเข้าสาขา");
    await pointAndClick(page, deletion.locator("summary"));
    await expect(deletion).toContainText("บันทึกซ้ำ");
    await pointAndClick(
      page,
      deletion.getByRole("button", { name: "กู้คืนรายการ", exact: true }),
    );
    await pointAndClick(
      page,
      deletion.getByRole("button", { name: "ยืนยันกู้คืน", exact: true }),
    );
    await expect(
      page.getByText("กู้คืนรายการแล้ว ระบบคำนวณยอดใหม่"),
    ).toBeVisible();
    await expect(deletion.locator("summary")).toContainText("ย้อนกลับแล้ว");
    await expect(
      logRow(page, "รับของเข้าสาขา").locator("summary"),
    ).not.toContainText("ลบแล้ว");
    await expect(await branchStockRow(page, "ศาลาแดง", "")).toContainText(
      "แช่แข็ง 10.00",
    );
  });
});

test("EDT-23 a purchase PO is deleted from the Log and restored", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.owner);
  const poId = await createPurchasePo(page, "300", "250");
  const main = page.locator("main");
  const toInvoice = tableRow(page, SCREENS.meatInvoice.table, poId);

  await step(page, "Owner: ลบ PO จาก Log · PO หายจากรายการ", async () => {
    await openMenu(page, "Log");
    const entry = logRow(page, "สร้าง PO เนื้อ");
    await pointAndClick(page, entry.locator("summary"));
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "ลบรายการ", exact: true }),
    );
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "ยืนยันลบ", exact: true }),
    );
    await expect(entry.locator("summary")).toContainText("ลบแล้ว");
    await openMenu(page, SCREENS.purchasePo.menu);
    await expect(main).not.toContainText(poId);
    await openMenu(page, SCREENS.meatInvoice.menu);
    await expect(toInvoice).toHaveCount(0);
  });

  await step(page, "Owner: ย้อนกลับจากประวัติการแก้ไขและลบ", async () => {
    await openMenu(page, "Log");
    const row = changeRow(page, "ลบรายการ · สร้าง PO เนื้อ");
    await expect(row).toContainText(poId);
    await pointAndClick(
      page,
      row.getByRole("button", { name: "ย้อนกลับ", exact: true }),
    );
    await expect(row).toContainText("ย้อนกลับแล้ว");
    await openMenu(page, SCREENS.purchasePo.menu);
    await expect(main).toContainText(poId);
    await openMenu(page, SCREENS.meatInvoice.menu);
    await expect(toInvoice).toContainText("300.00 กก.");
  });
});

/* EDT-24: the date is a field of the edit like any other; the entry moves to that day. */
test("EDT-24 the date of an entry is corrected from the Log", async ({
  page,
}) => {
  const moved = `${bangkokDate()} → ${bangkokDate(-1)}`;
  await signInAs(page, ACCOUNTS.owner);
  await weighIn(page, "", "40");
  await openMenu(page, "Log");
  const entry = logRow(page, "ยืนยันรับเนื้อที่ Chef House");
  await pointAndClick(page, entry.locator("summary"));
  await expect(entry.locator("summary")).toContainText(bangkokDate());
  await pointAndClick(
    page,
    entry.getByRole("button", { name: "แก้ไข", exact: true }),
  );
  await entry.getByLabel("วันที่ทำรายการ").fill(bangkokDate(-1));
  await pointAndClick(
    page,
    entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
  );
  await expect(entry.locator("summary")).toContainText(bangkokDate(-1));
  await expect(entry.locator("summary")).toContainText("บันทึกย้อนหลัง");
  await expect(entry).toContainText(moved);
  const row = changeRow(page, "แก้ไขรายการ · ยืนยันรับเนื้อที่ Chef House");
  await expect(row).toContainText("วันที่ทำรายการ");
  await expect(row).toContainText(moved);
});

/* Round 2026-10-01: nobody sends material or allocates chili to a branch. Each branch
 * writes down what it received (MAT-01, STK-43), and the Owner's store is what the Owner
 * bought less those receipts (STK-44). It reads below zero when a branch got stock the
 * Owner never recorded buying. */
const MATERIAL = "กล่องพิมพ์ลาย";
const CHILI = "น้ำพริกหลอด";

/** One row of the Owner's stock table: the store, each branch's shelf, and the caption. */
async function expectOwnerStock(
  page: Page,
  item: string,
  { store, saladaeng, minburi }: Record<string, string>,
  caption: string,
) {
  const row = await ownerStockRow(page, item);
  const cells = row.getByRole("cell");
  await expect(cells.nth(4)).toHaveText(store);
  await expect(cells.nth(5)).toHaveText(saladaeng);
  await expect(cells.nth(6)).toHaveText(minburi);
  await expect(row).toContainText(caption);
}

test("STK-44 MAT-01 STK-43 the Owner's store is what it bought less what the branches recorded, below zero included, and the report lists the receipts", async ({
  page,
}) => {
  const branchTakes = async (
    account: (typeof ACCOUNTS)[keyof typeof ACCOUNTS],
    material: string,
    chili: string,
  ) => {
    await signInAs(page, account);
    await branchReceiveChili(page, chili);
    await openMenu(page, SCREENS.materialReceive.menu);
    await saveMaterialReceipt(page, [[MATERIAL, material]]);
  };

  await step(
    page,
    "Owner: ซื้อวัสดุ 100 ชิ้น น้ำพริก 50 หลอด เข้าคลัง · ไม่มีการส่งไปสาขา",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await ownerBuyMaterial(page, MATERIAL, "100");
      await ownerBuyChili(page, "50");
      const main = page.locator("main");
      await expect(
        main.getByRole("button", { name: "+ ซื้อเข้าคลัง" }),
      ).toBeVisible();
      await expect(main.getByRole("button", { name: /ไปสาขา/ })).toHaveCount(0);
      // 「จดบันทึก」 offers the purchases, and nothing that sends or allocates.
      await pointAndClick(
        page,
        page.getByRole("button", { name: "จดบันทึก", exact: true }),
      );
      const picker = topDialog(page);
      await expect(
        picker.getByRole("button", { name: "บันทึกซื้อวัสดุเข้าคลัง Owner" }),
      ).toBeVisible();
      await expect(picker).not.toContainText(/ส่งวัสดุ|จัดสรร|ไปสาขา/);
      await pointAndClick(
        page,
        picker.getByRole("button", { name: "ปิด", exact: true }),
      );
      await expectOwnerStock(
        page,
        MATERIAL,
        { store: "100.00", saladaeng: "0.00", minburi: "0.00" },
        "สาขาจดรับแล้ว 0.00 ชิ้น",
      );
      await expectOwnerStock(
        page,
        CHILI,
        { store: "50.00", saladaeng: "0.00", minburi: "0.00" },
        "ซื้อเข้า 50.00 หลอด · สาขาจดรับแล้ว 0.00 หลอด",
      );
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: จดรับวัสดุ 30 ชิ้น น้ำพริก 20 หลอด",
    async () => {
      await branchTakes(ACCOUNTS.saladaeng, "30", "20");
    },
  );

  await step(page, "Owner: คลัง = ซื้อเข้า − ที่สาขาจดรับ", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await expectOwnerStock(
      page,
      MATERIAL,
      { store: "70.00", saladaeng: "30.00", minburi: "0.00" },
      "สาขาจดรับแล้ว 30.00 ชิ้น",
    );
    await expectOwnerStock(
      page,
      CHILI,
      { store: "30.00", saladaeng: "20.00", minburi: "0.00" },
      "ซื้อเข้า 50.00 หลอด · สาขาจดรับแล้ว 20.00 หลอด",
    );
  });

  await step(
    page,
    "สาขามีนบุรี: จดรับมากกว่าที่ Owner ซื้อ (วัสดุ 100 น้ำพริก 40)",
    async () => {
      await branchTakes(ACCOUNTS.minburi, "100", "40");
    },
  );

  await step(page, "Owner: คลังติดลบ แสดงตามจริง", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await expectOwnerStock(
      page,
      MATERIAL,
      { store: "-30.00", saladaeng: "30.00", minburi: "100.00" },
      "สาขาจดรับแล้ว 130.00 ชิ้น",
    );
    await expectOwnerStock(
      page,
      CHILI,
      { store: "-10.00", saladaeng: "20.00", minburi: "40.00" },
      "ซื้อเข้า 50.00 หลอด · สาขาจดรับแล้ว 60.00 หลอด",
    );
  });

  await step(page, "Owner: รายงานแสดงประวัติที่สาขาจดรับ", async () => {
    await openMenu(page, "รายงาน");
    const chili = "ประวัติสาขารับน้ำพริก";
    await expect(tableRow(page, chili, "ศาลาแดง")).toContainText("20.00 หลอด");
    await expect(tableRow(page, chili, "มีนบุรี")).toContainText("40.00 หลอด");
    const trail = "ประวัติซื้อและรับวัสดุ (Material audit trail)";
    const bought = tableRow(page, trail, "ซื้อเข้าคลัง Owner");
    await expect(bought).toContainText("100.00 ชิ้น");
    await expect(bought).toContainText("ร้านบรรจุภัณฑ์ → คลัง Owner");
    const received = tableRow(page, trail, "สาขารับเข้า");
    await expect(received).toHaveCount(2);
    await expect(received.filter({ hasText: "ศาลาแดง" })).toContainText(
      "30.00 ชิ้น",
    );
    await expect(received.filter({ hasText: "มีนบุรี" })).toContainText(
      "100.00 ชิ้น",
    );
  });
});

/* A chili or material receipt is a branch entry like any other: the branch edits and
 * deletes its own (EDT-22/23), the Owner reads that in the change log and undoes it
 * (EDT-25), and the other branch never sees it. */
test("EDT-22 EDT-23 EDT-25 a branch edits and deletes its own chili and material receipts; the Owner undoes it; the other branch does not see them", async ({
  page,
}) => {
  const chiliReceipt = "รับน้ำพริกเข้าสาขา";
  const materialReceipt = "รับวัสดุเข้าสาขา";
  const shelf = (item: string) =>
    tableRow(page, "ตารางสต๊อกทั้งหมด · ศาลาแดง", item)
      .getByRole("cell")
      .nth(2);
  /** Branch: corrects the one number of a receipt from its history row. */
  const edit = async (title: string, label: RegExp, value: string) => {
    await openMenu(page, "ประวัติ");
    const entry = logRow(page, title);
    await pointAndClick(page, entry.locator("summary"));
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "แก้ไข", exact: true }),
    );
    await typeValue(page, entry.getByLabel(label), value);
    await typeValue(page, entry.getByLabel("เหตุผลที่แก้ไข"), "นับใหม่");
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
    );
    await expect(entry.locator("summary")).toContainText("แก้ไขแล้ว");
  };
  /** Branch: deletes a receipt from its history row. */
  const remove = async (title: string) => {
    await openMenu(page, "ประวัติ");
    const entry = logRow(page, title);
    await pointAndClick(page, entry.locator("summary"));
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "ลบรายการ", exact: true }),
    );
    await typeValue(page, entry.getByLabel("เหตุผล"), "จดซ้ำ");
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "ยืนยันลบ", exact: true }),
    );
    await expect(entry.locator("summary")).toContainText("ลบแล้ว");
  };

  await step(
    page,
    "สาขาศาลาแดง: รับน้ำพริก 20 หลอด วัสดุ 50 ชิ้น",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await branchReceiveChili(page, "20");
      await openMenu(page, SCREENS.materialReceive.menu);
      await saveMaterialReceipt(page, [[MATERIAL, "50"]]);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: แก้น้ำพริกเป็น 25 วัสดุเป็น 40 สต๊อกตาม",
    async () => {
      await edit(chiliReceipt, /จำนวนน้ำพริกที่รับ/, "25");
      await edit(materialReceipt, /จำนวนที่รับจริง/, "40");
      await openMenu(page, "สต๊อก");
      await expect(shelf(CHILI)).toHaveText("25.00");
      await expect(shelf(MATERIAL)).toHaveText("40.00");
    },
  );

  await step(page, "สาขาศาลาแดง: ลบทั้งสองรายการ สต๊อกเป็น 0", async () => {
    await remove(chiliReceipt);
    await remove(materialReceipt);
    await openMenu(page, "สต๊อก");
    await expect(shelf(CHILI)).toHaveText("0.00");
    await expect(shelf(MATERIAL)).toHaveText("0.00");
  });

  await step(
    page,
    "สาขามีนบุรี: รับน้ำพริก 5 หลอด เห็นแต่รายการของตัวเอง",
    async () => {
      await signInAs(page, ACCOUNTS.minburi);
      // The same form, this time from 「จดบันทึก」.
      await pointAndClick(
        page,
        page.getByRole("button", { name: "จดบันทึก", exact: true }),
      );
      await pointAndClick(
        page,
        topDialog(page).getByRole("button", {
          name: chiliReceipt,
          exact: true,
        }),
      );
      await expect(topDialog(page)).toContainText(chiliReceipt);
      await field(page, /จำนวนน้ำพริกที่รับ/, "5");
      await field(page, /ชื่อผู้รับจริง/, "ผู้ดูแลสาขามีนบุรี");
      await saveEntry(page);
      await openMenu(page, "ประวัติ");
      const main = page.locator("main");
      // Its own receipt is the whole history: nothing of ศาลาแดง's, changes included.
      await expect(main.locator("details")).toHaveCount(1);
      await expect(logRow(page, chiliReceipt)).toBeVisible();
      await expect(main).toContainText("ยังไม่มีการแก้ไขหรือลบ");
      await expect(main).not.toContainText(materialReceipt);
    },
  );

  await step(
    page,
    "Owner: อ่านการแก้ไขและลบของสาขา ย้อนกลับการลบและการแก้ทั้งสองรายการ",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, "Log");
      const chiliEdit = changeRow(page, `แก้ไขรายการ · ${chiliReceipt}`);
      await expect(chiliEdit).toContainText("ศาลาแดง");
      await expect(chiliEdit).toContainText("นับใหม่");
      await expect(chiliEdit).toContainText("20 → 25");
      await expect(
        changeRow(page, `แก้ไขรายการ · ${materialReceipt}`),
      ).toContainText("50 → 40");
      for (const title of [
        `ลบรายการ · ${chiliReceipt}`,
        `ลบรายการ · ${materialReceipt}`,
        `แก้ไขรายการ · ${chiliReceipt}`,
        `แก้ไขรายการ · ${materialReceipt}`,
      ]) {
        const row = changeRow(page, title);
        await expect(row).toContainText("ศาลาแดง");
        await pointAndClick(
          page,
          row.getByRole("button", { name: "ย้อนกลับ", exact: true }),
        );
        await expect(row).toContainText("ย้อนกลับแล้ว");
      }
    },
  );

  await step(
    page,
    "Owner: ศาลาแดงกลับเป็นน้ำพริก 20 หลอด วัสดุ 50 ชิ้น คลัง Owner ติดลบเท่าที่สาขาจดรับ",
    async () => {
      await expectOwnerStock(
        page,
        CHILI,
        { store: "-25.00", saladaeng: "20.00", minburi: "5.00" },
        "สาขาจดรับแล้ว 25.00 หลอด",
      );
      await expectOwnerStock(
        page,
        MATERIAL,
        { store: "-50.00", saladaeng: "50.00", minburi: "0.00" },
        "สาขาจดรับแล้ว 50.00 ชิ้น",
      );
    },
  );
});

test("GEN-03 a branch still records on a day it has closed, with a warning; a future date is refused", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.saladaeng);
  const main = page.locator("main");

  await step(page, "สาขาศาลาแดง: ปิดวัน (รายการที่ขาดแค่เตือน)", async () => {
    await openBranchTask(page, "ตรวจและปิดวัน");
    await field(page, /ชื่อผู้ยืนยันปิดวัน/, "ผู้ดูแลสาขาศาลาแดง");
    await expectWarning(page, "ยังไม่ยืนยันข้าวเหนียวสุกคงเหลือ");
    await saveEntry(page);
    await expect(main).toContainText("ยังบันทึกเพิ่มหรือแก้ไขได้");
    await expect(main).toContainText("ปิดวันแล้ว · ยังจดเพิ่มได้");
    await expect(
      main.getByRole("button", { name: "ตรวจและปิดวัน", exact: true }),
    ).toBeDisabled();
  });

  await step(page, "สาขาศาลาแดง: วันที่อนาคต ยังปฏิเสธ", async () => {
    await openBranchTask(page, "รับของ");
    await lotSelect(page).selectOption(NO_LOT);
    await field(page, /น้ำหนักรับเข้าสาขา/, "10");
    await setWorkingDate(page, bangkokDate(1));
    const dialog = topDialog(page);
    await expect(
      dialog
        .getByRole("alert")
        .filter({ hasText: "วันที่ทำรายการต้องไม่เกินวันนี้" }),
    ).toBeVisible();
    await expect(dialog.locator('button[type="submit"]').last()).toBeDisabled();
    await setWorkingDate(page, bangkokDate());
  });

  await step(
    page,
    "สาขาศาลาแดง: รับของในวันที่ปิดแล้ว เตือนแล้วบันทึก",
    async () => {
      await expectWarning(page, "วันนี้ปิดยอดแล้ว");
      await saveEntry(page);
      const row = await branchStockRow(page, "ศาลาแดง", "");
      await expect(row).toContainText("แช่แข็ง 10.00");
    },
  );

  await step(page, "สาขาศาลาแดง: แบ่งละลายในวันที่ปิดแล้ว", async () => {
    await openBranchTask(page, "แบ่งละลาย");
    await field(page, /น้ำหนักละลาย/, "4");
    await expectWarning(page, "วันนี้ปิดยอดแล้ว");
    await saveEntry(page);
    const row = await branchStockRow(page, "ศาลาแดง", "");
    await expect(row).toContainText("แช่แข็ง 6.00 · ชิล/ละลายแล้ว 4.00");
  });
});

test("SHP-02 CHF-02 the Packing List is a file and one total; Chef House weighs in one total", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.owner);
  let batch = "";
  let shipment = "";

  await step(
    page,
    "Owner (แทน Foodiva): Packing List = ไฟล์ + น้ำหนักส่งรวม",
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
    "Owner (แทน Chef House): เห็นไฟล์กับยอดรวม กรอกน้ำหนักรับรวมช่องเดียว",
    async () => {
      await openWeighIn(page, shipment);
      const dialog = topDialog(page);
      const list = dialog.getByRole("region", {
        name: "Packing List ของ Foodiva",
      });
      await expect(list).toContainText(PACKING_LIST_FILE);
      await expect(list).toContainText("100.00 กก.");
      // No box rows to type, on either side.
      await expect(dialog.getByLabel(/กล่องรับเข้าที่/)).toHaveCount(0);
      await field(page, /^น้ำหนักรับรวม/, "98");
      await expectWarning(page, "น้ำหนักรับรวมไม่ตรงกับ Packing List");
      await saveEntry(page);
    },
  );

  await step(
    page,
    "Owner (แทน Chef House): ยอดรับรวมเป็นน้ำหนักรับจริงของชุด",
    async () => {
      await openMenu(page, SCREENS.production.menu);
      await expect(
        tableRow(page, SCREENS.production.table, batch),
      ).toContainText("98.00 กก.");
    },
  );
});

test("SHP-04 NTF a batch with work but no transport document counts on ใบขนส่งขาไป and rings the bell", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.owner);
  const transport = menuItem(page, "ใบขนส่งขาไป");
  const bell = page.getByRole("button", { name: /^การแจ้งเตือน \d+ รายการ$/ });
  const todo = page
    .getByRole("region", { name: "การแจ้งเตือน" })
    .getByRole("button", { name: /ยังไม่ได้จดใบขนส่ง · SH-/ });

  await step(page, "Owner: ออก PO รมควัน → ยังไม่ได้จดใบขนส่ง 1", async () => {
    await issueSmokePoOnNewBatch(page, "80");
    await expect(transport).toContainText("1");
    await pointAndClick(page, bell);
    await expect(todo).toHaveCount(1);
  });

  await step(
    page,
    "Owner: กดแจ้งเตือน ไปหน้างาน Foodiva ทำใบขนส่ง",
    async () => {
      await pointAndClick(page, todo);
      const incoming = tableRow(
        page,
        "PO รมควันที่ยังไม่มีใบขนส่ง",
        SHIPMENT_NO,
      );
      await expect(incoming).toHaveCount(1);
      await pointAndClick(
        page,
        incoming.getByRole("button", { name: "ทำใบขนส่ง" }),
      );
      await saveDispatchDialog(page, "80");
      await expect(transport).not.toContainText(/\d/);
      await pointAndClick(page, bell);
      await expect(todo).toHaveCount(0);
      await page.keyboard.press("Escape");
    },
  );

  await step(
    page,
    "Owner: ชุดที่เปิดจากชั่งรับ (ไม่มี PO รมควัน) ก็ขึ้นแจ้งเตือน",
    async () => {
      await weighIn(page, "", "40");
      await expect(transport).toContainText("1");
      await pointAndClick(page, bell);
      await expect(todo).toHaveCount(1);
      await page.keyboard.press("Escape");
    },
  );
});

test("RICE cooked rice starts from zero every day; Minburi cooks its own", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.minburi);
  const cooked = async () => {
    await openMenu(page, "สต๊อก");
    return tableRow(page, "ตารางสต๊อกทั้งหมด · มีนบุรี", /ข้าวเหนียวสุก/)
      .getByRole("cell")
      .nth(2);
  };
  const openRiceForm = async (title: string) => {
    await openMenu(page, SCREENS.rice.menu);
    await pointAndClick(
      page,
      tableRow(page, SCREENS.rice.table, title).getByRole("button", {
        name: "จด",
        exact: true,
      }),
    );
  };
  const source = () =>
    topDialog(page).getByRole("combobox", { name: /รอบนี้ข้าวเหนียวมาจาก/ });

  await step(page, "สาขามีนบุรี: เมื่อวานซื้อข้าวสุก 5 กก.", async () => {
    await openRiceForm("ซื้อข้าวเหนียวเข้าสต๊อก");
    await setWorkingDate(page, bangkokDate(-1));
    await source().selectOption("ซื้อข้าวสุกจากข้างนอก");
    await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าวเหนียวป้าแดง");
    await field(page, /ข้าวเหนียวสุกซื้อเข้า/, "5");
    await field(page, /ยอดซื้อข้าวเหนียวสุก/, "225");
    await saveEntry(page);
  });

  await step(
    page,
    "สาขามีนบุรี: วันนี้ข้าวสุกเริ่มที่ 0 ไม่ยกยอดมา",
    async () => {
      await expect(await cooked()).toHaveText("0.00");
    },
  );

  await step(
    page,
    "สาขามีนบุรี: วันนี้ซื้อข้าวดิบ เบิก แล้วหุงเอง",
    async () => {
      await openRiceForm("ซื้อข้าวเหนียวเข้าสต๊อก");
      await setWorkingDate(page, bangkokDate());
      await source().selectOption("นึ่งเอง (ซื้อข้าวดิบ)");
      await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าวสารลุงดำ");
      await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "10");
      await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "550");
      await saveEntry(page);

      await openRiceForm("เบิกข้าวเหนียวดิบวันนี้");
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "2");
      await field(page, /ผู้รับของ/, "ผู้ดูแลสาขามีนบุรี");
      await saveEntry(page);

      await openRiceForm("ข้าวเหนียวช่วงเช้า");
      await field(page, /ข้าวเหนียวดิบที่นำมาหุง/, "2");
      await field(page, /ข้าวเหนียวสุกที่ได้/, "4");
      await saveEntry(page);

      await expect(await cooked()).toHaveText("4.00");
    },
  );
});

/* The sealed-meat Add-on is no longer sold: no price for it in the settings. */
test("CFG the settings have no sealed-meat Add-on price", async ({ page }) => {
  await signInAs(page, ACCOUNTS.owner);
  await openMenu(page, SCREENS.config.menu);
  const main = page.locator("main");
  await expect(main).toContainText("ราคากล่องมาตรฐาน");
  await expect(main).not.toContainText(/Add-?on|ซีลเพิ่ม/i);
});
