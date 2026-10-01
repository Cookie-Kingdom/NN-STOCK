import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  NO_LOT,
  SCREENS,
  branchReceive,
  branchReceiveChili,
  branchStockRow,
  expectWarning,
  field,
  historyEntry,
  issueSmokePoOnNewBatch,
  lotSelect,
  meatStockRow,
  openBranchTask,
  openMenu,
  pointAndClick,
  receiveCentral,
  saveEntry,
  saveMaterialReceipt,
  signInAs,
  startFresh,
  step,
  tableRow,
  tableSection,
  topDialog,
  typeValue,
} from "./helpers";

const BRANCH = "ศาลาแดง";

test.beforeEach(async ({ page }) => {
  await startFresh(page);
});

test("BR-02 BR-03 BR-04 BR-08 branch receives 10 kg ไม่ระบุ Lot with no allocation, thaws and sells from that bucket", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.saladaeng);

  await step(page, "สาขาศาลาแดง: รับของ 10 กก. ไม่ระบุ Lot", async () => {
    await openMenu(page, SCREENS.branchDay.menu);
    // BR-01: nothing is allocated to wait for; the receive is always open.
    await expect(page.locator("main")).toContainText(
      "จดเนื้อที่รับเข้าสาขา · เลือก Lot ต้นทาง",
    );
    await expect(page.locator("main")).not.toContainText("ใบจัดสรร");
    await openBranchTask(page, "รับของ");
    // The form starts on the bucket: a receive with no lot picked is still a receive.
    await expect(lotSelect(page)).toHaveValue(NO_LOT);
    await expect(
      lotSelect(page).locator(`option[value="${NO_LOT}"]`),
    ).toHaveText(/ไม่ระบุ Lot · รับเข้าก่อน ผูกชุดทีหลังได้/);
    await field(page, /น้ำหนักรับเข้าสาขา/, "10");
    await saveEntry(page);
    const row = await branchStockRow(page, BRANCH, "");
    await expect(row).toContainText("ยังไม่ผูก Lot");
    await expect(row).toContainText("10.00");
    await expect(row).toContainText("แช่แข็ง 10.00");
  });

  await step(
    page,
    "สาขาศาลาแดง: แบ่งละลายจากถังไม่ระบุ Lot (เกินยอดแค่เตือน)",
    async () => {
      await openBranchTask(page, "แบ่งละลาย");
      await expect(lotSelect(page)).toHaveValue(NO_LOT);
      await field(page, /น้ำหนักละลาย/, "12");
      await expectWarning(page, /กรอกได้สูงสุด 10\.00 กก\./);
      await field(page, /น้ำหนักละลาย/, "5");
      await saveEntry(page);
      const row = await branchStockRow(page, BRANCH, "");
      await expect(row).toContainText("แช่แข็ง 5.00 · ชิล/ละลายแล้ว 5.00");
    },
  );

  await step(page, "สาขาศาลาแดง: จดยอดขายจากถังไม่ระบุ Lot", async () => {
    await openBranchTask(page, "จดยอดขาย");
    await expect(lotSelect(page)).toHaveValue(NO_LOT);
    await field(page, /กล่องมาตรฐาน/, "20");
    await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "2");
    await saveEntry(page);
    const row = await branchStockRow(page, BRANCH, "");
    await expect(row).toContainText("แช่แข็ง 5.00 · ชิล/ละลายแล้ว 3.00");
  });
});

/* MAT-01: nobody sends material to a branch. The branch writes down what it received on
 * the "รับวัสดุ" tab, whose form is the screen itself; 「จดบันทึก」 leads there. */
test("MAT-01 branch records two materials in one save on รับวัสดุ, reached from จดบันทึก", async ({
  page,
}) => {
  const receiver = "ผู้ดูแลสาขาศาลาแดง";
  await signInAs(page, ACCOUNTS.saladaeng);
  const main = page.locator("main");
  const saveButton = main.getByRole("button", { name: /^บันทึกรับวัสดุ/ });

  await step(
    page,
    "สาขาศาลาแดง: จดบันทึก → รับเข้า → รับวัสดุเข้าสาขา เปิดแท็บรับวัสดุ",
    async () => {
      await pointAndClick(
        page,
        page.getByRole("button", { name: "จดบันทึก", exact: true }),
      );
      const received = topDialog(page)
        .locator("section")
        .filter({
          has: page.getByRole("heading", { name: "รับเข้า", exact: true }),
        });
      for (const note of [
        "รับของเข้าสาขา",
        "รับวัสดุเข้าสาขา",
        "รับน้ำพริกเข้าสาขา",
      ])
        await expect(
          received.getByRole("button", { name: note, exact: true }),
        ).toBeVisible();
      await pointAndClick(
        page,
        received.getByRole("button", { name: "รับวัสดุเข้าสาขา", exact: true }),
      );
      // The note has no dialog: the form is the tab, open from the start.
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        main.getByRole("heading", { name: "รับวัสดุเข้าสาขา", exact: true }),
      ).toBeVisible();
      await expect(saveButton).toBeDisabled();
      await expect(main).toContainText("ยังไม่มีรายการรับวัสดุของวันนี้");
      // Nothing to confirm and no transfer to wait for.
      await expect(main).not.toContainText(/ใบโอน|ยืนยัน/);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: รับ 2 วัสดุในการบันทึกครั้งเดียว ฟอร์มพร้อมจดต่อ",
    async () => {
      await saveMaterialReceipt(
        page,
        [
          ["กล่องพิมพ์ลาย", "50"],
          ["ถุงซีลเนื้อ", "120"],
        ],
        receiver,
        // A third row added and left blank: the button and the notice count 2, and 2 are saved.
        1,
      );
      const received = tableSection(
        page,
        /^วัสดุที่รับเข้าวันที่ .+ · ศาลาแดง$/,
      ).getByRole("row");
      await expect(received.filter({ hasText: "ชิ้น" })).toHaveCount(2);
      const box = received.filter({ hasText: "กล่องพิมพ์ลาย" });
      await expect(box).toContainText("50.00 ชิ้น");
      await expect(box).toContainText(receiver);
      await expect(received.filter({ hasText: "ถุงซีลเนื้อ" })).toContainText(
        "120.00 ชิ้น",
      );
      // One empty row again, the receiver kept for the next note.
      await expect(
        main.getByRole("combobox", { name: "วัสดุ แถวที่ 1" }),
      ).toHaveValue("");
      await expect(main.getByLabel("จำนวนที่รับจริง แถวที่ 1")).toHaveValue("");
      await expect(main.getByLabel(/^วัสดุ แถวที่ 2$/)).toHaveCount(0);
      await expect(
        main.getByLabel("ชื่อผู้รับจริง", { exact: true }),
      ).toHaveValue(receiver);
      await expect(saveButton).toBeDisabled();
    },
  );

  await step(page, "สาขาศาลาแดง: สต๊อกและยอดตั้งต้นตรวจนับ", async () => {
    await openMenu(page, "สต๊อก");
    for (const [material, quantity] of [
      ["กล่องพิมพ์ลาย", "50.00"],
      ["ถุงซีลเนื้อ", "120.00"],
    ])
      await expect(
        tableRow(page, `ตารางสต๊อกทั้งหมด · ${BRANCH}`, material)
          .getByRole("cell")
          .nth(2),
      ).toHaveText(quantity);
    await openMenu(page, "ตรวจนับสต๊อกวัสดุวันนี้");
    for (const [material, opening] of [
      ["กล่องพิมพ์ลาย", "50"],
      ["ถุงซีลเนื้อ", "120"],
    ])
      await expect(
        tableRow(page, "ตรวจนับสต๊อกวัสดุวันนี้", material)
          .getByRole("cell")
          .nth(1),
      ).toHaveText(opening);
  });

  await step(
    page,
    "สาขาศาลาแดง: ประวัติขึ้นรับวัสดุเข้าสาขา 2 รายการ",
    async () => {
      await openMenu(page, "ประวัติ");
      const entries = main.locator("details").filter({
        has: page.locator("summary", { hasText: /^รับวัสดุเข้าสาขา/ }),
      });
      await expect(entries).toHaveCount(2);
      await expect(entries.first()).not.toContainText(/ใบโอน|ใบส่งวัสดุ/);
    },
  );

  // MAT-05: today's count is saved, then more material is written down for today. The count
  // already holds it, so the branch is told to save that count again; the receipt is saved.
  await step(
    page,
    "สาขาศาลาแดง: ตรวจนับวัสดุแล้วจดรับเพิ่มวันเดียวกัน ถูกเตือนให้นับใหม่ บันทึกได้",
    async () => {
      await openMenu(page, "ตรวจนับสต๊อกวัสดุวันนี้");
      await pointAndClick(
        page,
        main.getByRole("button", { name: /^ตรวจนับวัสดุวันนี้/ }),
      );
      await pointAndClick(
        page,
        main.getByRole("button", { name: /^บันทึกและล็อก/ }),
      );
      await expect(main).toContainText("บันทึกการใช้วัสดุวันนี้แล้ว");
      await openMenu(page, SCREENS.materialReceive.menu);
      await main
        .getByRole("combobox", { name: "วัสดุ แถวที่ 1" })
        .selectOption("กล่องพิมพ์ลาย");
      await typeValue(page, main.getByLabel("จำนวนที่รับจริง แถวที่ 1"), "10");
      await expect(
        main.getByText(
          /วันที่ \d{4}-\d{2}-\d{2} ตรวจนับวัสดุไปแล้ว · บันทึกยอดตรวจนับของวันนั้นอีกครั้งให้ยอดตรงกัน/,
        ),
      ).toBeVisible();
      await pointAndClick(page, saveButton);
      await expect(main.getByText("รับวัสดุ 1 รายการแล้ว")).toBeVisible();
      await expect(
        tableSection(page, /^วัสดุที่รับเข้าวันที่ .+ · ศาลาแดง$/)
          .getByRole("row")
          .filter({ hasText: "ชิ้น" }),
      ).toHaveCount(3);
    },
  );
});

/* STK-43: chili is not allocated either. The branch writes down the tubes it received, and
 * its sales draw on that. */
test("STK-43 branch records the chili it received; the stock goes up and a sale draws on it", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.saladaeng);
  const chili = (label: string) =>
    tableRow(page, SCREENS.chili.table, label).getByRole("cell").nth(1);
  const counted = () =>
    tableRow(page, SCREENS.chili.table, "ตรวจนับจริงปลายวัน");
  const sellChili = async () => {
    await openBranchTask(page, "จดยอดขาย");
    await field(page, /น้ำพริกหลอด · จำหน่ายแยก/, "3");
  };
  const shortage = () =>
    topDialog(page)
      .getByRole("status")
      .filter({ hasText: "น้ำพริกในสต๊อกไม่พอ" });

  await step(
    page,
    "สาขาศาลาแดง: ยังไม่ได้รับน้ำพริก ขาย 3 หลอด ถูกเตือน",
    async () => {
      await sellChili();
      await expectWarning(page, "น้ำพริกในสต๊อกไม่พอ");
      await pointAndClick(
        page,
        topDialog(page).getByRole("button", { name: "ยกเลิก", exact: true }),
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
    },
  );

  await step(page, "สาขาศาลาแดง: รับน้ำพริกเข้าสาขา 20 หลอด", async () => {
    await branchReceiveChili(page, "20", "ผู้ดูแลสาขาศาลาแดง");
    await expect(page.getByText("รับน้ำพริกเข้าสาขาแล้ว")).toBeVisible();
    await expect(chili("ยอดตั้งต้น")).toHaveText("20.00");
    await openMenu(page, "สต๊อก");
    const row = tableRow(page, `ตารางสต๊อกทั้งหมด · ${BRANCH}`, "น้ำพริกหลอด");
    await expect(row.getByRole("cell").nth(2)).toHaveText("20.00");
    await expect(row).toContainText(
      "รับเข้า 20.00 หลอด · ตัดสต๊อกแล้ว 0.00 หลอด",
    );
    await openMenu(page, "สรุปสาขา");
    await expect(
      page
        .locator("main")
        .getByRole("row")
        .filter({ hasText: "น้ำพริกที่รับเข้า" })
        .first(),
    ).toContainText("20");
  });

  await step(
    page,
    "สาขาศาลาแดง: ขาย 3 หลอด ไม่เตือน ตัดจากที่รับเข้า",
    async () => {
      await sellChili();
      // The shelf counted at the end of the day: 20 received less the 3 sold.
      await field(page, /ตรวจนับน้ำพริกจริงปลายวัน/, "17");
      await expect(
        topDialog(page).locator('button[type="submit"]').last(),
      ).toBeEnabled();
      await expect(shortage()).toHaveCount(0);
      await saveEntry(page);
      await openMenu(page, SCREENS.branchDay.menu);
      await expect(chili("ตัดสต๊อกวันนี้")).toHaveText("3.00");
      await expect(chili("ควรเหลือหลังตัดสต๊อก")).toHaveText("17.00");
      await expect(chili("ตรวจนับจริงปลายวัน")).toHaveText("17.00");
      await expect(counted()).toContainText("ตรงกัน");
      await openMenu(page, "สต๊อก");
      const row = tableRow(
        page,
        `ตารางสต๊อกทั้งหมด · ${BRANCH}`,
        "น้ำพริกหลอด",
      );
      await expect(row.getByRole("cell").nth(2)).toHaveText("17.00");
      await expect(row).toContainText(
        "รับเข้า 20.00 หลอด · ตัดสต๊อกแล้ว 3.00 หลอด",
      );
    },
  );

  // The count is judged against the shelf it was made on, not one that grew afterwards.
  await step(
    page,
    "สาขาศาลาแดง: รับน้ำพริกอีก 10 หลอดหลังตรวจนับ สต๊อกเพิ่ม ยอดนับยังตรงกัน",
    async () => {
      await branchReceiveChili(page, "10", "ผู้ดูแลสาขาศาลาแดง");
      await expect(chili("ยอดตั้งต้น")).toHaveText("30.00");
      await expect(chili("ควรเหลือหลังตัดสต๊อก")).toHaveText("27.00");
      await expect(chili("ตรวจนับจริงปลายวัน")).toHaveText("17.00");
      await expect(counted()).toContainText("ตรงกัน");
      await expect(counted()).toContainText("ตอนนับควรเหลือ 17.00 หลอด");
      await expect(counted()).not.toContainText("ยอดไม่ตรง");
    },
  );
});

test("LNK-04 LNK-06 branch links a ไม่ระบุ Lot receive to a batch and the kg moves", async ({
  page,
}) => {
  let batch = "";
  await step(
    page,
    "Owner: ชุดใหม่ เข้าสต๊อกกลาง 80 กก. (ไม่มีการจัดสรร)",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      batch = await issueSmokePoOnNewBatch(page, "100");
      await receiveCentral(page, batch, "80");
      await expect(await meatStockRow(page, batch)).toContainText("80.00 กก.");
    },
  );

  await step(page, "สาขาศาลาแดง: รับ 10 กก. ไม่ระบุ Lot", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await branchReceive(page, NO_LOT, "10");
    await expect(await branchStockRow(page, BRANCH, "")).toContainText("10.00");
  });

  await step(page, "สาขาศาลาแดง: ประวัติ → ผูกกับ… ชุดรมควัน", async () => {
    const entry = await historyEntry(page, "ประวัติ", "ยังไม่ผูก Lot");
    await pointAndClick(page, entry.locator("summary"));
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "ผูกกับ…", exact: true }),
    );
    const dialog = topDialog(page);
    await expect(dialog).toContainText("ผูกกับชุดรมควัน");
    await dialog
      .getByRole("combobox", { name: /^ชุดรมควัน \(Lot S\)/ })
      .selectOption(batch);
    await saveEntry(page);
    const linked = page
      .locator("main details")
      .filter({ hasText: "รับของเข้าสาขา" })
      .filter({ hasText: "ผูกแล้ว" });
    await expect(linked.first()).toBeVisible();
  });

  await step(page, "สาขาศาลาแดง: ยอดย้ายจากถังไม่ระบุ Lot ไปชุด", async () => {
    await expect(await branchStockRow(page, BRANCH, "")).toHaveCount(0);
    const row = await branchStockRow(page, BRANCH, batch);
    await expect(row).toContainText("แช่แข็ง 10.00");
  });

  // STK-42: only frozen meat, all of it on the batch: the sale form starts on that batch
  // from the table's button and from 「จดบันทึก」 alike, and still offers "ไม่ระบุ Lot".
  await step(
    page,
    "สาขาศาลาแดง: มีแต่เนื้อแช่แข็งบนชุด ฟอร์มยอดขายเริ่มที่ชุดนั้นจากทั้งสองทาง",
    async () => {
      await openBranchTask(page, "จดยอดขาย");
      await expect(lotSelect(page)).toHaveValue(batch);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await pointAndClick(
        page,
        page
          .getByRole("banner")
          .getByRole("button", { name: "จดบันทึก", exact: true }),
      );
      await pointAndClick(
        page,
        topDialog(page).getByRole("button", {
          name: "บันทึกยอดขาย / Waste",
          exact: true,
        }),
      );
      await expect(lotSelect(page)).toHaveValue(batch);
      await expect(
        lotSelect(page).locator(`option[value="${NO_LOT}"]`),
      ).toHaveCount(1);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    },
  );

  await step(
    page,
    "Owner: รับที่ผูกแล้วหักสต๊อกกลางของชุด 10 กก. ครั้งเดียว",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      const row = await meatStockRow(page, batch);
      await expect(row).toContainText("70.00 กก.");
      await expect(row).toContainText("10.00 แช่แข็ง");
    },
  );
});
