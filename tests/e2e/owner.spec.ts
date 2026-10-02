import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  BATCH_ID,
  SCREENS,
  SHIPMENT_NO,
  createPurchasePo,
  expectWarning,
  field,
  idsOnScreen,
  issueSmokePoOnNewBatch,
  logRow,
  meatStockRow,
  menuItem,
  openMatchPo,
  openMenu,
  pointAndClick,
  receiveCentral,
  recordPreSmoke,
  saveDispatchDialog,
  saveEntry,
  sidebar,
  signInAs,
  startFresh,
  step,
  tableRow,
  topDialog,
  weighIn,
} from "./helpers";

test.beforeEach(async ({ page }) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
});

test("PO-03 PO-07 Owner pays a meat PO that has no Foodiva invoice, with a warning", async ({
  page,
}) => {
  const poId = await createPurchasePo(page, "300", "250");
  await openMenu(page, SCREENS.invoices.menu);
  const row = tableRow(page, "Invoice Foodiva", poId);
  await expect(row).toContainText("ยังไม่มี Invoice");
  await expect(row).toContainText("รอชำระ");
  await pointAndClick(page, row.getByRole("button", { name: "ชำระเงิน" }));
  await expectWarning(page, "ยังไม่มี Invoice เนื้อจาก Foodiva");
  await field(page, /ยอดชำระ/, "75000");
  await field(page, /ผู้ดำเนินการชำระ/, "ฝ่ายบัญชี Owner");
  await saveEntry(page);
  await expect(row).toContainText("ชำระแล้ว");
  await expect(row.getByRole("button", { name: "ชำระเงิน" })).toHaveCount(0);
});

/* RET-03 / RET-06 / RET-07: central receive waits for nothing — no return truck, no
 * Foodiva receipt, no purchase PO on the smoke PO. The match to the purchase PO is made on
 * this same screen, before or after the meat is counted in. BR-01: the Owner has nothing to
 * allocate afterwards; the branch records its own receive. */
test("RET-03 RET-06 RET-07 BR-01 central receive without a return truck, then the batch is matched to its purchase PO there", async ({
  page,
}) => {
  const poId = await createPurchasePo(page, "300", "250");
  const batch = await issueSmokePoOnNewBatch(page, "100");

  await openMenu(page, SCREENS.centralReceive.menu);
  const waiting = tableRow(page, SCREENS.centralReceive.table, batch);
  await expect(waiting).toContainText("ยังไม่มีใบขนส่งขากลับ");
  await expect(waiting).toContainText("ยังไม่ยืนยันรับ");
  await expect(waiting).toContainText("ยังไม่จับคู่ PO ซื้อ");
  // The unmatched batch counts on the tab's badge before and after it is received.
  await expect(menuItem(page, SCREENS.centralReceive.menu)).toContainText("1");
  await receiveCentral(page, batch, "80");
  await expect(waiting).toHaveCount(0);

  const unmatched = tableRow(page, SCREENS.centralReceive.unmatched, batch);
  await expect(unmatched).toContainText("80.00 กก.");
  await expect(unmatched).toContainText("ยังไม่จับคู่ PO ซื้อ");
  await expect(menuItem(page, SCREENS.centralReceive.menu)).toContainText("1");

  await openMatchPo(page, SCREENS.centralReceive.unmatched, batch, [
    { poId, kg: "100" },
  ]);
  await expect(topDialog(page).getByLabel("เหตุผลที่แก้ไข")).toHaveValue(
    "จับคู่ PO ซื้อที่หน้ารับเข้าสต๊อกกลาง",
  );
  await saveEntry(page);
  await expect(unmatched).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: SCREENS.centralReceive.unmatched }),
  ).toHaveCount(0);
  await expect(menuItem(page, SCREENS.centralReceive.menu)).not.toContainText(
    "1",
  );

  // Central stock holds the 80 kg; there is no allocation to make.
  await expect(
    sidebar(page).getByRole("button", { name: /จัดสรรเนื้อ/ }),
  ).toHaveCount(0);
  const stock = await meatStockRow(page, batch);
  await expect(stock).toContainText("80.00 กก.");
  await expect(stock.getByRole("button", { name: "จัดสรร" })).toHaveCount(0);
});

test("SMK-08 SMK-09 no Request document: the smoke PO opens at once from its own button", async ({
  page,
}) => {
  await expect(
    sidebar(page).getByRole("button", { name: /Request/ }),
  ).toHaveCount(0);
  for (const menu of ["ใบขนส่งขาไป", SCREENS.smokePo.menu]) {
    await openMenu(page, menu);
    await expect(
      page.locator("main").getByRole("button", { name: /Request/ }),
    ).toHaveCount(0);
  }
  // Nothing recorded yet: no Packing List, no purchase PO — the button is still open.
  const issue = page.getByRole("button", { name: /^\+ ออก PO รมควันเนื้อ$/ });
  await expect(issue).toBeEnabled();
  await pointAndClick(page, issue);
  await expect(
    topDialog(page).getByRole("combobox", { name: /^ชุดรมควัน/ }),
  ).toHaveValue("");
  await expect(topDialog(page)).toContainText(
    "ชุดใหม่ (ระบบออกเลขที่การส่งให้)",
  );
});

/* SMK-09 / SHP-04: with no Request document, the smoke PO itself is the work that comes
 * in. A batch the Owner opened with a smoke PO waits in "PO รมควันที่ยังไม่มีใบขนส่ง"
 * on the Foodiva tab until its transport document is saved on that same batch. */
test("SMK-09 SHP-01 SHP-04 a smoke PO waits for its transport document and leaves the list once it is saved", async ({
  page,
}) => {
  const batch = await issueSmokePoOnNewBatch(page, "80");

  await openMenu(page, SCREENS.batches.menu);
  const incoming = tableRow(page, "PO รมควันที่ยังไม่มีใบขนส่ง", SHIPMENT_NO);
  await expect(incoming).toHaveCount(1);
  const shipment = (await incoming.innerText()).match(SHIPMENT_NO)![0];
  await expect(tableRow(page, SCREENS.batches.table, batch)).toContainText(
    shipment,
  );

  await pointAndClick(
    page,
    incoming.getByRole("button", { name: "ทำใบขนส่ง" }),
  );
  await expect(topDialog(page)).toContainText(shipment);
  await saveDispatchDialog(page, "80");

  await expect(incoming).toHaveCount(0);
  const row = tableRow(page, SCREENS.batches.table, batch);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("80.00 กก.");
  await expect(
    row.getByRole("button", { name: "แก้ไข Packing List" }),
  ).toBeVisible();
});

/* DASH-02: the dashboard's box and the bell list the batches with an entry in the last 30
 * days, and count the entries as they stand now: one moved to another batch (EDT-24) counts
 * there, a deleted one (EDT-23) nowhere. Both batches here were opened 40 days ago (the
 * browser's clock is put back for that), so only the note made today can list them. */
test("DASH-02 EDT-23 EDT-24 the dashboard and the bell follow an entry that is moved to another batch or deleted", async ({
  page,
}) => {
  const main = page.locator("main");
  /** The page as it loads at `time`: the working date starts on that day. */
  const loadAt = async (time: Date) => {
    await page.clock.setFixedTime(time);
    await page.reload();
    await expect(menuItem(page, "Log")).toBeVisible();
  };
  /** A batch opened by a weigh-in, as its id and its shipment number. */
  const openBatch = async (kg: string, others: string[]) => {
    await weighIn(page, "", kg);
    await openMenu(page, SCREENS.smokePo.menu);
    const id = (await idsOnScreen(page, BATCH_ID)).find(
      (batch) => !others.includes(batch),
    )!;
    const shipment = (
      await tableRow(page, SCREENS.smokePo.table, id).innerText()
    ).match(SHIPMENT_NO)![0];
    return { id, shipment };
  };
  /** The box 「รายการที่ยังไม่ครบ」 and the bell name `listed` and none of `unlisted`. */
  const expectListed = async (listed: string[], unlisted: string[]) => {
    await openMenu(page, SCREENS.ownerDashboard.menu);
    const details = page.locator("#owner-alert-details");
    if (!(await details.count()))
      await pointAndClick(
        page,
        main.getByRole("button", { name: /^(ยังไม่ครบ \d+ จุด|จดครบแล้ว)/ }),
      );
    await expect(
      details.getByRole("heading", { name: "รายการที่ยังไม่ครบ" }),
    ).toBeVisible();
    await pointAndClick(
      page,
      page.getByRole("button", { name: /^การแจ้งเตือน/ }),
    );
    const bell = page.getByRole("region", { name: "การแจ้งเตือน" });
    await expect(bell).toBeVisible();
    for (const shipment of listed) {
      await expect(details).toContainText(`การส่ง ${shipment}`);
      await expect(bell).toContainText(
        new RegExp(`ชุด ${shipment} ยังไม่ได้จด \\d+ รายการ`),
      );
    }
    for (const shipment of unlisted) {
      await expect(details).not.toContainText(shipment);
      await expect(bell).not.toContainText(shipment);
    }
    await page.keyboard.press("Escape");
  };
  const note = "น้ำหนักก่อนสโมค";
  const openNote = async () => {
    await openMenu(page, "Log");
    const entry = logRow(page, note);
    await pointAndClick(page, entry.locator("summary"));
    return entry;
  };

  await loadAt(new Date(Date.now() - 40 * 86_400_000));
  const first = await openBatch("40", []);
  const second = await openBatch("30", [first.id]);
  await loadAt(new Date());

  await step(
    page,
    "Owner: ชุดที่จดไว้ 40 วันก่อน ไม่ขึ้นทั้งสองชุด",
    async () => {
      await expectListed([], [first.shipment, second.shipment]);
    },
  );

  await step(page, "Owner: จดน้ำหนักก่อนสโมควันนี้ ชุดแรกขึ้น", async () => {
    await recordPreSmoke(page, first.id, "38");
    await expectListed([first.shipment], [second.shipment]);
  });

  await step(
    page,
    "Owner: ย้ายรายการไปชุดที่สอง ชุดที่สองขึ้นแทน ชุดแรกหายไป",
    async () => {
      const entry = await openNote();
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "แก้ไข", exact: true }),
      );
      await entry.getByLabel("ชุดรมควัน").selectOption(second.id);
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "บันทึกการแก้ไข" }),
      );
      await expect(entry.locator("summary")).toContainText(second.id);
      await expectListed([second.shipment], [first.shipment]);
    },
  );

  await step(page, "Owner: ลบรายการ ไม่มีชุดไหนขึ้น", async () => {
    const entry = await openNote();
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "ลบรายการ", exact: true }),
    );
    await pointAndClick(
      page,
      entry.getByRole("button", { name: "ยืนยันลบ", exact: true }),
    );
    await expect(entry.locator("summary")).toContainText("ลบแล้ว");
    await expectListed([], [first.shipment, second.shipment]);
  });
});
