import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  NO_LOT,
  SCREENS,
  allocate,
  allocationRow,
  branchReceive,
  branchStockRow,
  expectWarning,
  field,
  historyEntry,
  issueSmokePoOnNewBatch,
  lotSelect,
  openBranchTask,
  openMenu,
  pointAndClick,
  receiveCentral,
  saveEntry,
  signInAs,
  startFresh,
  step,
  topDialog,
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
    await expect(page.locator("main")).toContainText(
      "ไม่มีใบจัดสรรค้างรับ · รับเนื้อได้โดยไม่ต้องมีใบจัดสรร",
    );
    await openBranchTask(page, "รับของ");
    await expect(lotSelect(page)).toHaveValue("");
    await expect(
      lotSelect(page).locator(`option[value="${NO_LOT}"]`),
    ).toHaveText(/ไม่ระบุ Lot · รับเข้าก่อน ผูกชุดทีหลังได้/);
    await lotSelect(page).selectOption(NO_LOT);
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

  await step(page, "สาขาศาลาแดง: บันทึกยอดขายจากถังไม่ระบุ Lot", async () => {
    await openBranchTask(page, "บันทึกยอดขาย");
    await expect(lotSelect(page)).toHaveValue(NO_LOT);
    await field(page, /กล่องมาตรฐาน/, "20");
    await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "2");
    await saveEntry(page);
    const row = await branchStockRow(page, BRANCH, "");
    await expect(row).toContainText("แช่แข็ง 5.00 · ชิล/ละลายแล้ว 3.00");
  });
});

test("MAT-01 MAT-04 branch receives packaging with no transfer from the Owner", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.saladaeng);
  await openMenu(page, SCREENS.materialReceive.menu);
  await pointAndClick(
    page,
    page.getByRole("button", { name: "รับวัสดุโดยไม่มีใบโอน" }),
  );
  const main = page.locator("main");
  const material = main.getByRole("combobox", { name: "วัสดุ แถวที่ 1" });
  await material.selectOption({ index: 1 });
  const name = (await material.locator("option:checked").innerText()).trim();
  await main.getByLabel("จำนวนที่รับจริง แถวที่ 1").fill("50");
  await main
    .getByLabel("ชื่อผู้รับจริง", { exact: true })
    .last()
    .fill("ผู้ดูแลสาขาศาลาแดง");
  await pointAndClick(
    page,
    main.getByRole("button", { name: "บันทึกรับวัสดุ" }),
  );

  const entry = await historyEntry(page, "ประวัติ", "ยืนยันรับวัสดุที่สาขา");
  await expect(entry).toContainText("ไม่มีใบส่งวัสดุ");

  await openMenu(page, "สต๊อก");
  const row = page
    .locator("main")
    .getByRole("row")
    .filter({ hasText: name })
    .filter({ hasText: "วัสดุบรรจุภัณฑ์" });
  await expect(row).toContainText("50");
});

test("LNK-04 LNK-06 branch links a ไม่ระบุ Lot receive to a batch and the kg moves", async ({
  page,
}) => {
  let batch = "";
  await step(
    page,
    "Owner: ชุดใหม่ เข้าสต๊อกกลาง 80 กก. จัดสรรศาลาแดง 10 กก.",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      batch = await issueSmokePoOnNewBatch(page, "100");
      await receiveCentral(page, batch, "80");
      await allocate(page, batch, BRANCH, "10");
      await expect(await allocationRow(page, batch)).toContainText("70.00 กก.");
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

  await step(
    page,
    "Owner: รับที่ผูกแล้วเติมใบจัดสรร 10 กก. สต๊อกกลางไม่หักซ้ำ (DM-08)",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await expect(await allocationRow(page, batch)).toContainText("70.00 กก.");
    },
  );
});
