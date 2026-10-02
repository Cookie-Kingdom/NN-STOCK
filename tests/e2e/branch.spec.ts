import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  NO_LOT,
  SCREENS,
  bangkokDate,
  branchReceive,
  branchReceiveChili,
  branchStockRow,
  changeRow,
  expectWarning,
  field,
  historyEntry,
  issueSmokePoOnNewBatch,
  logRow,
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
  toast,
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
test("MAT-01 MAT-05 branch records two materials in one save on รับวัสดุ, reached from จดบันทึก; a receipt changed under a count is warned about and the count is saved again", async ({
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

  /* MAT-05 for a receipt that is changed afterwards: moved to another day, deleted, put
   * back, or its move undone. Each is saved, and says which day's count no longer stands on
   * its opening. Here: 50 + 10 กล่องพิมพ์ลาย and 120 ถุงซีลเนื้อ received today, counted today. */
  const today = bangkokDate();
  const yesterday = bangkokDate(-1);
  const edited = "แก้ไขรายการแล้ว ระบบคำนวณยอดใหม่และเก็บค่าเดิมไว้ในประวัติ";
  const deleted =
    "ลบรายการแล้ว ระบบคำนวณยอดใหม่ · กู้คืนได้ที่ประวัติการแก้ไขและลบ";
  const recount = (date: string) =>
    `วันที่ ${date} ตรวจนับวัสดุไปแล้ว · บันทึกยอดตรวจนับของวันนั้นอีกครั้งให้ยอดตรงกัน`;
  const COUNT = "ตรวจนับสต๊อกวัสดุวันนี้";
  const shelf = (material: string) =>
    tableRow(page, `ตารางสต๊อกทั้งหมด · ${BRANCH}`, material)
      .getByRole("cell")
      .nth(2);
  const opening = (material: string) =>
    tableRow(page, COUNT, material).getByRole("cell").nth(1);
  /** Opens the count of `date`, lets `fill` type into it, and saves it. */
  const saveCount = async (date: string, fill = async () => {}) => {
    await openMenu(page, COUNT);
    await tableSection(page, COUNT).getByLabel("วันที่ทำรายการ").fill(date);
    await pointAndClick(
      page,
      main.getByRole("button", {
        name: /^(ตรวจนับวัสดุวันนี้|แก้ไขยอดนับ) \(/,
      }),
    );
    await fill();
    await pointAndClick(
      page,
      main.getByRole("button", { name: /^บันทึกและล็อก/ }),
    );
    await expect(
      main.getByRole("status").filter({
        hasText: "บันทึกการใช้วัสดุวันนี้แล้ว · กลับสู่โหมดดูข้อมูล",
      }),
    ).toBeVisible();
  };
  /** What the count screen says after a save about a later day's count (MAT-05). */
  const recountNotice = () => main.getByText(/ตรวจนับวัสดุไปแล้ว/);
  /** The history row of the receipt of `quantity` pieces, opened. */
  const openReceipt = async (quantity: string) => {
    await openMenu(page, "ประวัติ");
    const entry = main
      .locator("details")
      .filter({
        has: page.locator("summary", { hasText: /^รับวัสดุเข้าสาขา/ }),
      })
      .filter({ hasText: new RegExp(`ชิ้น\\s*${quantity}(?!\\d)`) });
    await pointAndClick(page, entry.locator("summary"));
    return entry;
  };
  /** Deletes the newest live count of `date` from its history row. */
  const deleteNewestCount = async (date: string) => {
    await openMenu(page, "ประวัติ");
    const count = main
      .locator("details")
      .filter({
        has: page.locator("summary", {
          hasText: new RegExp(`^เช็ควัสดุ 10 รายการ ${date}`),
        }),
      })
      .filter({ hasNot: page.locator("summary", { hasText: "ลบแล้ว" }) })
      .first();
    await pointAndClick(page, count.locator("summary"));
    await pointAndClick(
      page,
      count.getByRole("button", { name: "ลบรายการ", exact: true }),
    );
    await pointAndClick(
      page,
      count.getByRole("button", { name: "ยืนยันลบ", exact: true }),
    );
  };
  /** The one-press undo of a change, from the change log on the history tab. */
  const undo = async (change: string) => {
    await openMenu(page, "ประวัติ");
    const row = changeRow(page, change);
    await pointAndClick(
      page,
      row.getByRole("button", { name: "ย้อนกลับ", exact: true }),
    );
    await expect(row).toContainText("ย้อนกลับแล้ว");
  };

  await step(
    page,
    "สาขาศาลาแดง: นับเมื่อวานไว้แล้ว ย้ายวันรับ 50 ชิ้นไปเมื่อวาน ถูกเตือนให้นับเมื่อวานใหม่ แล้วนับใหม่",
    async () => {
      // Nothing received or found yesterday: today's count opens on what it did.
      await saveCount(yesterday);
      await expect(recountNotice()).toHaveCount(0);
      const entry = await openReceipt("50");
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "แก้ไข", exact: true }),
      );
      await entry.getByLabel("วันที่ทำรายการ").fill(yesterday);
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
      );
      await expect(toast(page, edited)).toHaveText(
        `${edited} · ${recount(yesterday)}`,
      );
      // What the warning asks for: yesterday's count again, now on the 50 received. 20 were
      // used, and 5 each of two materials nobody wrote down were found on the shelf.
      await saveCount(yesterday, async () => {
        await expect(opening("กล่องพิมพ์ลาย")).toHaveText("50");
        await main.getByLabel("จำนวนใช้ กล่องพิมพ์ลาย วันนี้").fill("20");
        await main.getByLabel("ยอดตรวจนับจริง กล่องพิมพ์ลาย").fill("30");
        for (const found of ["กระดาษรอง", "ถุงซีลข้าว"])
          await main.getByLabel(`ยอดตรวจนับจริง ${found}`).fill("5");
        await main.getByLabel("เหตุผลที่แก้ไขยอดวัสดุ").fill("ย้ายวันรับวัสดุ");
      });
      // Yesterday now leaves 30 and the 5s found: today's count opened on other figures, and
      // the count screen says so itself.
      await expect(recountNotice()).toHaveText(recount(today));
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ย้อนกลับการย้ายวัน ถูกเตือน · ลบรายการรับที่ใช้ไปแล้ว ชั้นวางติดลบ ถูกเตือนทั้งสองเรื่อง",
    async () => {
      await undo("แก้ไขรายการ · รับวัสดุเข้าสาขา");
      const undone = "ย้อนกลับแล้ว ระบบใช้ค่าเดิมและคำนวณยอดใหม่";
      await expect(toast(page, undone)).toHaveText(
        `${undone} · ${recount(yesterday)}`,
      );
      // Back on today: 60 received, 20 of them used yesterday. Without the 50 the shelf is
      // 10 short, and today's count opened on what is no longer there.
      const entry = await openReceipt("50");
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "ลบรายการ", exact: true }),
      );
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "ยืนยันลบ", exact: true }),
      );
      await expect(toast(page, deleted)).toHaveText(
        [
          deleted,
          `ลบแล้วกล่องพิมพ์ลาย สาขา${BRANCH}จะติดลบ (-10.00) · แก้รายการที่ตามมาก่อน`,
          recount(today),
        ].join(" · "),
      );
      await expect(entry.locator("summary")).toContainText("ลบแล้ว");
      await openMenu(page, "สต๊อก");
      await expect(shelf("กล่องพิมพ์ลาย")).toHaveText("-10.00");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ยอดตั้งต้นวันนี้ติดลบ บันทึกยอดนับอีกครั้งได้ สต๊อกเท่ากับที่นับ",
    async () => {
      await saveCount(today, async () => {
        await expect(opening("กล่องพิมพ์ลาย")).toHaveText("-10");
        // Nothing used of an opening below zero: no warning on the box.
        await expect(
          main.getByLabel("จำนวนใช้ กล่องพิมพ์ลาย วันนี้"),
        ).toHaveValue("0");
        await expect(main.getByText(/ใช้เกินยอดตั้งต้น/)).toHaveCount(0);
        await main.getByLabel("ยอดตรวจนับจริง กล่องพิมพ์ลาย").fill("8");
        await main
          .getByLabel("เหตุผลส่วนต่าง กล่องพิมพ์ลาย")
          .fill("ลบรายการรับที่จดซ้ำ");
        // The 5 found yesterday open today, and are used up.
        for (const found of ["กระดาษรอง", "ถุงซีลข้าว"]) {
          await expect(opening(found)).toHaveText("5");
          await main.getByLabel(`จำนวนใช้ ${found} วันนี้`).fill("5");
        }
        await main
          .getByLabel("เหตุผลที่แก้ไขยอดวัสดุ")
          .fill("ลบรายการรับที่จดซ้ำ");
      });
      // The newest counted day: no later count stands on it.
      await expect(recountNotice()).toHaveCount(0);
      await openMenu(page, "สต๊อก");
      await expect(shelf("กล่องพิมพ์ลาย")).toHaveText("8.00");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: กู้คืนรายการรับ ถูกเตือนให้นับวันนี้ใหม่ · แก้ชื่อผู้รับ ไม่ถูกเตือน",
    async () => {
      await undo("ลบรายการ · รับวัสดุเข้าสาขา");
      const restored = "กู้คืนรายการแล้ว ระบบคำนวณยอดใหม่";
      await expect(toast(page, restored)).toHaveText(
        `${restored} · ${recount(today)}`,
      );
      // An edit that leaves every count's opening as it is says nothing more.
      const entry = await openReceipt("50");
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "แก้ไข", exact: true }),
      );
      await typeValue(page, entry.getByLabel("ชื่อผู้รับจริง"), "ผู้ช่วยสาขา");
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
      );
      await expect(toast(page, edited)).toHaveText(edited);
    },
  );

  // Ten materials stand on one count, so its delete used to say a line for each: now one,
  // naming the materials that go short (here the two found yesterday and used today). Today's
  // count opened on what that count left, so it is to be saved again too.
  await step(
    page,
    "สาขาศาลาแดง: ลบยอดนับของเมื่อวานที่ยอดวันนี้ตั้งอยู่ เตือนบรรทัดเดียวรวมทุกวัสดุ และให้นับวันนี้ใหม่",
    async () => {
      await deleteNewestCount(yesterday);
      await expect(toast(page, deleted)).toHaveText(
        `${deleted} · ลบแล้ววัสดุ 2 รายการ สาขา${BRANCH}จะติดลบ (กระดาษรอง -5.00, ถุงซีลข้าว -5.00) · แก้รายการที่ตามมาก่อน · ${recount(today)}`,
      );
      await openMenu(page, "สต๊อก");
      await expect(shelf("กระดาษรอง")).toHaveText("-5.00");
    },
  );

  /* Today was counted twice: first on the 50 and 120 received, and again after the 10 more
   * and the delete of the 50. Deleting the second round leaves the first one standing, and
   * that one opened on 50 where the day now opens on the 60 received: it is the day's count
   * again, so the delete says to save today's count again. */
  await step(
    page,
    "สาขาศาลาแดง: ลบยอดนับรอบล่าสุดของวันนี้ รอบก่อนหน้ากลับมาเป็นยอดของวัน ถูกเตือนให้นับวันนี้ใหม่",
    async () => {
      await deleteNewestCount(today);
      await expect(toast(page, deleted)).toHaveText(
        `${deleted} · ${recount(today)}`,
      );
      // The first round stands: nothing used of the 60 received, none of the 5s found.
      await openMenu(page, "สต๊อก");
      await expect(shelf("กล่องพิมพ์ลาย")).toHaveText("60.00");
      await expect(shelf("กระดาษรอง")).toHaveText("0.00");
      await openMenu(page, COUNT);
      await expect(opening("กล่องพิมพ์ลาย")).toHaveText("60");
    },
  );
});

/* STK-43: chili is not allocated either. The branch writes down the tubes it received, and
 * its sales draw on that. */
test("STK-43 branch records the chili it received; the stock goes up and a sale draws on it; an edit of the sale judges its chili count again only when a chili figure changes, against the shelf it was counted on", async ({
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

  const edited = "แก้ไขรายการแล้ว ระบบคำนวณยอดใหม่และเก็บค่าเดิมไว้ในประวัติ";
  /** Corrects figures of the sale from its history row: one, or several in one edit. */
  const editSale = async (
    label: RegExp,
    value: string,
    ...more: [label: RegExp, value: string][]
  ) => {
    await openMenu(page, "ประวัติ");
    const entry = logRow(page, "บันทึกยอดขาย / Waste");
    await pointAndClick(page, entry.locator("summary"));
    // The shelf the count was made against is a named figure of the row, not a raw key.
    await expect(entry).toContainText("น้ำพริกที่ควรเหลือตอนนับ");
    await expect(entry).not.toContainText("chiliExpected");
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "แก้ไข", exact: true }),
    );
    for (const [name, typed] of [[label, value], ...more] as const)
      await typeValue(page, entry.getByLabel(name), typed);
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
    );
  };

  // An edit that leaves the chili figures alone does not judge the count again: the shelf
  // grew after it, and the sale's money is all that was corrected.
  await step(
    page,
    "สาขาศาลาแดง: แก้ยอดขาย LINE MAN ของรายการขาย ไม่ถูกเตือนเรื่องน้ำพริก ยอดนับยังตรงกัน",
    async () => {
      await editSale(/^ยอดขาย LINE MAN/, "900");
      await expect(toast(page, edited)).toHaveText(edited);
      await openMenu(page, SCREENS.branchDay.menu);
      await expect(chili("ตรวจนับจริงปลายวัน")).toHaveText("17.00");
      await expect(counted()).toContainText("ตรงกัน");
      await expect(counted()).toContainText("ตอนนับควรเหลือ 17.00 หลอด");
      await expect(counted()).not.toContainText("ยอดไม่ตรง");
    },
  );

  // A corrected count is judged against the shelf it was counted on (17), not today's (27),
  // which holds the 10 tubes received afterwards.
  await step(
    page,
    "สาขาศาลาแดง: แก้ยอดนับน้ำพริกเป็น 18 เทียบกับชั้นวางตอนนับ (17) ไม่ใช่ตอนนี้ (27) ถูกเตือน",
    async () => {
      await editSale(/^ตรวจนับน้ำพริกจริงปลายวัน/, "18");
      await expect(toast(page, edited)).toHaveText(
        `${edited} · ยอดนับน้ำพริกไม่ตรง · ควรระบุหมายเหตุ`,
      );
      await openMenu(page, SCREENS.branchDay.menu);
      await expect(chili("ควรเหลือหลังตัดสต๊อก")).toHaveText("27.00");
      await expect(chili("ตรวจนับจริงปลายวัน")).toHaveText("18.00");
      await expect(counted()).toContainText("ยอดไม่ตรง");
      await expect(counted()).toContainText("ตอนนับควรเหลือ 17.00 หลอด");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: แก้ยอดนับเป็น 27 เท่าชั้นวางตอนนี้ ยังถูกเตือน · แก้กลับเป็น 17 ตรงกัน ไม่เตือน",
    async () => {
      await editSale(/^ตรวจนับน้ำพริกจริงปลายวัน/, "27");
      await expect(toast(page, edited)).toHaveText(
        `${edited} · ยอดนับน้ำพริกไม่ตรง · ควรระบุหมายเหตุ`,
      );
      // The day table, so the history row is closed again for the next edit.
      await openMenu(page, SCREENS.branchDay.menu);
      await expect(chili("ตรวจนับจริงปลายวัน")).toHaveText("27.00");
      await expect(counted()).toContainText("ยอดไม่ตรง");
      await editSale(/^ตรวจนับน้ำพริกจริงปลายวัน/, "17");
      await expect(toast(page, edited)).toHaveText(edited);
      await openMenu(page, SCREENS.branchDay.menu);
      await expect(chili("ตรวจนับจริงปลายวัน")).toHaveText("17.00");
      await expect(counted()).toContainText("ตรงกัน");
      await expect(counted()).toContainText("ตอนนับควรเหลือ 17.00 หลอด");
      await expect(counted()).not.toContainText("ยอดไม่ตรง");
    },
  );

  // The remark is what answers a count that is off: taking only the remark away judges the
  // count again, against the shelf it was counted on.
  await step(
    page,
    "สาขาศาลาแดง: แก้ยอดนับเป็น 16 พร้อมหมายเหตุ ไม่เตือน · ลบเฉพาะหมายเหตุออก ยอดยังไม่ตรง ถูกเตือน",
    async () => {
      const remark = /^หมายเหตุเมื่อน้ำพริกไม่ตรง/;
      await editSale(/^ตรวจนับน้ำพริกจริงปลายวัน/, "16", [remark, "หลอดแตก 1"]);
      await expect(toast(page, edited)).toHaveText(edited);
      await openMenu(page, SCREENS.branchDay.menu);
      await expect(chili("ตรวจนับจริงปลายวัน")).toHaveText("16.00");
      await expect(counted()).toContainText("ยอดไม่ตรง");
      await expect(chili("หมายเหตุส่วนต่าง")).toHaveText("หลอดแตก 1");
      await editSale(remark, "");
      await expect(toast(page, edited)).toHaveText(
        `${edited} · ยอดนับน้ำพริกไม่ตรง · ควรระบุหมายเหตุ`,
      );
      await openMenu(page, SCREENS.branchDay.menu);
      await expect(chili("ตรวจนับจริงปลายวัน")).toHaveText("16.00");
      await expect(counted()).toContainText("ยอดไม่ตรง");
      await expect(counted()).toContainText("ตอนนับควรเหลือ 17.00 หลอด");
      await expect(chili("หมายเหตุส่วนต่าง")).toHaveText("—");
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
