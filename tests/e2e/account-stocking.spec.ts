import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  BATCH_ID,
  MISSING,
  NO_LOT,
  PACKING_LIST_FILE,
  SCREENS,
  SHIPMENT_NO,
  branchReceive,
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
  pointAndClick,
  recordDispatch,
  saveDispatchDialog,
  saveEntry,
  signInAs,
  startFresh,
  step,
  tableRow,
  tableSection,
  topDialog,
  typeValue,
  weighIn,
} from "./helpers";

/* Account & Stocking, round 2026-09-30: the app records what happened and no longer gates
 * it. An empty field is saved and marked, a closed day still takes entries, the Packing
 * List is a file plus one total, and cooked rice starts from zero every day. What each
 * test walks is the flow as it is now (vault: Features/Account Stocking/Checklist
 * 2026-09-30). */

/** A Bangkok business date, `offset` days from today (the app's `today()`). */
function bangkokDate(offset = 0) {
  const day = new Date(Date.now() + offset * 86_400_000);
  return day.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** The working date of the open dialog; it is the workspace's one date. */
async function setWorkingDate(page: Page, date: string) {
  await topDialog(page).getByLabel("วันที่ทำรายการ").fill(date);
}

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
    const rows = tableSection(page, /^PO เนื้อที่ต้องออก Invoice$/)
      .getByRole("row")
      .filter({ hasText: /PO-\d{4}-\d{4}/ });
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
    await expect(main).toContainText("ปิดวันแล้ว · ยังบันทึกเพิ่มได้");
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
    .getByRole("region", { name: "รายการที่ต้องทำต่อ" })
    .getByRole("button", { name: /ต้องทำใบขนส่ง · SH-/ });

  await step(page, "Owner: ออก PO รมควัน → ต้องทำใบขนส่ง 1", async () => {
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
        name: "กรอกข้อมูล",
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
