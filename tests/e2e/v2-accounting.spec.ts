import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bangkokDate,
  choices,
  confirmDelete,
  fill,
  form,
  jot,
  nav,
  openPage,
  pick,
  popupTitle,
  region,
  save,
  savePo,
  signInAs,
  start,
} from "./helpers";

/* Spec v2 section 4.6: the Accounting page, the shop's purchase ledger (V2-LED-01…08). */

const year = bangkokDate().slice(0, 4);
const PO1 = `PO-${year}-0001`;
const PO2 = `PO-${year}-0002`;
const SO = `SO-${year}-0001`;
const ledger = (page: Page) =>
  page.getByRole("table", { name: "บัญชีรายการซื้อ" });
/** The rows of the ledger, without its head and its totals. */
const ledgerRows = (page: Page) => ledger(page).locator("tbody tr");
/** The cells of the ledger row holding `text`. */
const cells = (page: Page, text: string) =>
  ledgerRows(page).filter({ hasText: text }).getByRole("cell");
/** A card above the ledger, by its label: its figure, then its note. */
const card = (page: Page, label: string) =>
  region(page, "สรุปรายการซื้อ")
    .locator("div")
    .filter({
      has: page.locator("small").filter({ hasText: new RegExp(`^${label}$`) }),
    });
const shown = (page: Page) => page.getByText(/^\d+ จาก \d+ รายการ$/);
const createPo = async (
  page: Page,
  kind: "PO เนื้อ" | "PO รมควัน",
  ...pairs: [RegExp, string][]
) => {
  await page.getByRole("button", { name: `+ สร้าง ${kind}` }).click();
  await expect(popupTitle(page)).toHaveText(kind);
  await fill(page, ...pairs);
  await savePo(page);
};
const payFoodiva = async (page: Page, amount: string) => {
  await openPage(page, "Finance");
  await jot(page, "จ่ายเงิน");
  await fill(
    page,
    [/^หมวด/, "เนื้อ"],
    [/^ยอด \(บาท\)/, amount],
    [/^ผู้ขาย/, "Foodiva"],
  );
  await save(page);
  await openPage(page, "Accounting");
};
/** Jots an expense from the Accounting page. */
const expense = async (page: Page, ...pairs: [RegExp, string][]) => {
  await jot(page, "บันทึกค่าใช้จ่าย");
  await fill(page, ...pairs);
  await save(page);
};
/** Presses 「แก้ไข」 or 「ลบ」 at the end of a ledger row; a 「ลบ」 is confirmed. */
const press = async (cellsOfRow: Locator, name: "แก้ไข" | "ลบ") => {
  await cellsOfRow.last().getByRole("button", { name, exact: true }).click();
  if (name === "ลบ") await confirmDelete(cellsOfRow.page());
};

test("V2-LED-01 V2-LED-02 V2-LED-07 a PO is a row by itself, and what its seller is paid fills the oldest PO first", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Accounting");
  await expect(page.getByText(/^ยังไม่มีรายการซื้อ/)).toBeVisible();

  await openPage(page, "Lots");
  await createPo(
    page,
    "PO เนื้อ",
    [/^น้ำหนักเนื้อ/, "100"],
    [/^ราคา \/ กก\./, "700"],
  );
  await createPo(
    page,
    "PO เนื้อ",
    [/^น้ำหนักเนื้อ/, "50"],
    [/^ราคา \/ กก\./, "700"],
  );
  await createPo(page, "PO รมควัน", [/^น้ำหนักที่สั่งรมควัน/, "100"]);

  await openPage(page, "Accounting");
  await expect(ledger(page).getByRole("columnheader")).toHaveText([
    "วันที่",
    "ที่มา / ประเภทบิล",
    "เลขที่อ้างอิง (PO / ใบเสร็จ)",
    "ประเภทสินค้า",
    "รายการ",
    "รายละเอียด / สเปก",
    "ผู้ขาย / ร้านค้า",
    "ค่าใช้จ่ายของ",
    "Project",
    "จำนวนซื้อ",
    "ยอดตาม PO (งบที่กันไว้)",
    "ยอดจ่ายจริง",
    "สถานะ",
    "เอกสารแนบ",
    "แก้ไข / ลบ",
  ]);
  // Nobody jotted these rows: each is worked out from its PO, and has nothing to edit.
  await expect(ledgerRows(page)).toHaveCount(3);
  const first = cells(page, PO1);
  await expect(first.nth(1)).toHaveText("PO เนื้อ");
  await expect(first.nth(2)).toHaveText(PO1);
  await expect(first.nth(3)).toHaveText("วัตถุดิบ");
  await expect(first.nth(6)).toHaveText("Foodiva");
  await expect(first.nth(7)).toHaveText("โปรเจกต์");
  await expect(first.nth(8)).toHaveText("Nerdnuea x LINE MAN");
  await expect(first.nth(9)).toHaveText("100 กก.");
  await expect(first.nth(10)).toHaveText("฿70,000");
  await expect(first.nth(11)).toHaveText("฿0");
  await expect(first.nth(12)).toHaveText("รอจ่าย");
  await expect(first.nth(13)).toHaveText("เปิด PO");
  await expect(first.nth(14).getByRole("button")).toHaveCount(0);
  const second = cells(page, PO2);
  await expect(second.nth(10)).toHaveText("฿35,000");
  // The PO รมควัน holds its estimate: 100 kg at the rate under 1,000 kg, ฿220.
  const smoke = cells(page, SO);
  await expect(smoke.nth(1)).toHaveText("PO รมควัน");
  await expect(smoke.nth(4)).toHaveText("ค่ารมควัน");
  await expect(smoke.nth(6)).toHaveText("Chef House");
  await expect(smoke.nth(9)).toHaveText("100 กก.");
  await expect(smoke.nth(10)).toHaveText("฿22,000");
  await expect(smoke.nth(12)).toHaveText("รอจ่าย");
  // The cards: every PO still to pay, at its whole amount; nothing paid this month.
  await expect(card(page, "งบที่กันไว้จาก PO")).toContainText("฿127,000");
  await expect(card(page, "งบที่กันไว้จาก PO")).toContainText(
    "3 รายการที่ยังรอจ่าย",
  );
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText("฿0");
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText(
    "เดือนก่อนไม่มียอดจ่าย",
  );
  await expect(
    page.getByRole("button", { name: "PO รอจ่าย (3)" }),
  ).toBeVisible();
  const totals = ledger(page).locator("tfoot").getByRole("cell");
  await expect(totals).toHaveText(["รวม 3 รายการ", "฿127,000", "฿0", ""]);

  // A payment names the seller, not a PO: ฿80,000 fills the older PO, the rest is on the next.
  await payFoodiva(page, "80000");
  await expect(first.nth(11)).toHaveText("฿70,000");
  await expect(first.nth(12)).toHaveText("จ่ายแล้ว");
  await expect(second.nth(11)).toHaveText("฿10,000");
  await expect(second.nth(12)).toHaveText("รอจ่าย");
  await expect(smoke.nth(11)).toHaveText("฿0");
  await expect(card(page, "งบที่กันไว้จาก PO")).toContainText("฿57,000");
  await expect(card(page, "งบที่กันไว้จาก PO")).toContainText(
    "2 รายการที่ยังรอจ่าย",
  );
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText("฿80,000");
  await expect(totals).toHaveText(["รวม 3 รายการ", "฿127,000", "฿80,000", ""]);
  // Paid in full: the second PO is จ่ายแล้ว too.
  await payFoodiva(page, "25000");
  await expect(second.nth(11)).toHaveText("฿35,000");
  await expect(second.nth(12)).toHaveText("จ่ายแล้ว");
  await expect(
    page.getByRole("button", { name: "PO รอจ่าย (1)" }),
  ).toBeVisible();

  // The PO's number leads to the PO in Lots.
  await first.nth(2).getByRole("button", { name: PO1 }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Lots");
  await expect(page.getByRole("main")).toContainText(PO1);
});

test("V2-LED-05 V2-LED-07 the Owner jots, edits and deletes an expense, and no branch receives one", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Accounting");
  await expense(
    page,
    [/^เลขที่อ้างอิง/, "RC-77"],
    [/^ประเภทสินค้า/, "สินทรัพย์"],
    [/^รายการ/, "หมึกพิมพ์"],
    [/^ผู้ขาย/, "ร้านกอไก่"],
    [/^จำนวนซื้อ/, "2"],
    [/^ยอดจ่ายจริง/, "500"],
  );
  const ink = cells(page, "หมึกพิมพ์");
  // With no status picked, a row with an amount is paid.
  await expect(ink.nth(1)).toHaveText("เงินโอน");
  await expect(ink.nth(2)).toHaveText("RC-77");
  await expect(ink.nth(3)).toHaveText("สินทรัพย์");
  await expect(ink.nth(4)).toHaveText("หมึกพิมพ์SKU-0011");
  await expect(ink.nth(6)).toHaveText("ร้านกอไก่");
  await expect(ink.nth(7)).toHaveText("บริษัทส่วนกลาง");
  await expect(ink.nth(8)).toHaveText("ส่วนกลาง");
  await expect(ink.nth(9)).toHaveText("2");
  await expect(ink.nth(10)).toHaveText("—");
  await expect(ink.nth(11)).toHaveText("฿500");
  await expect(ink.nth(12)).toHaveText("จ่ายแล้ว");
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText("฿500");
  // A hand-jotted row holds no PO budget.
  await expect(card(page, "งบที่กันไว้จาก PO")).toContainText("฿0");
  await expect(card(page, "งบที่กันไว้จาก PO")).toContainText(
    "0 รายการที่ยังรอจ่าย",
  );

  await press(ink, "แก้ไข");
  await expect(popupTitle(page)).toHaveText("แก้ไข: บันทึกค่าใช้จ่าย");
  await expect(form(page).getByLabel(/^รายการ/)).toHaveValue("หมึกพิมพ์");
  await fill(page, [/^ยอดจ่ายจริง/, "650"]);
  await save(page);
  await expect(ink.nth(11)).toHaveText("฿650");
  // The edit kept the item, so its SKU.
  await expect(ink.nth(4)).toHaveText("หมึกพิมพ์SKU-0011");
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText("฿650");
  // A deleted one: the row and its money are gone.
  await expense(
    page,
    [/^ประเภทสินค้า/, "อื่นๆ"],
    [/^รายการ/, "จดผิด"],
    [/^ยอดจ่ายจริง/, "40"],
  );
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText("฿690");
  await press(cells(page, "จดผิด"), "ลบ");
  await expect(ledgerRows(page)).toHaveCount(1);
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText("฿650");

  // One still to pay (no amount), one cancelled, which holds no money.
  await expense(
    page,
    [/^ประเภทสินค้า/, "อื่นๆ"],
    [/^รายการ/, "ค่าโดเมน"],
    [/^ค่าใช้จ่ายของ/, "โปรเจกต์"],
    [/^Project/, "งานอีเวนต์"],
  );
  await expense(
    page,
    [/^ประเภทสินค้า/, "อื่นๆ"],
    [/^รายการ/, "ป้ายไวนิล"],
    [/^ยอดจ่ายจริง/, "900"],
    [/^สถานะ/, "ยกเลิก"],
  );
  await expect(cells(page, "ค่าโดเมน").nth(8)).toHaveText("งานอีเวนต์");
  await expect(cells(page, "ค่าโดเมน").nth(11)).toHaveText("—");
  await expect(cells(page, "ค่าโดเมน").nth(12)).toHaveText("รอจ่าย");
  await expect(cells(page, "ป้ายไวนิล").nth(12)).toHaveText("ยกเลิก");
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText("฿650");
  await expect(ledger(page).locator("tfoot").getByRole("cell")).toHaveText([
    "รวม 2 รายการ (ไม่รวมที่ยกเลิก)",
    "฿0",
    "฿650",
    "",
  ]);
  // Only a PO waits for the PO shortcut.
  await expect(
    page.getByRole("button", { name: "PO รอจ่าย (0)" }),
  ).toBeVisible();

  // The first row, edited again and deleted.
  await press(ink, "แก้ไข");
  await fill(page, [/^สถานะ/, "รอจ่าย"]);
  await save(page);
  await expect(ink.nth(12)).toHaveText("รอจ่าย");
  await press(ink, "ลบ");
  await expect(ledgerRows(page)).toHaveCount(2);
  await expect(ledger(page)).not.toContainText("หมึกพิมพ์");
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText("฿0");
  await expect(shown(page)).toHaveText("2 จาก 2 รายการ");

  // A branch has no Accounting page, and its copy holds no expense.
  await signInAs(page, "saladaeng");
  await expect(
    nav(page).getByRole("button", { name: "Accounting" }),
  ).toHaveCount(0);
  const copy = (await (await page.request.get("/api/local-db")).json()).payload;
  expect(copy.entries).toEqual([]);
  expect(JSON.stringify(copy)).not.toMatch(
    /ค่าโดเมน|ป้ายไวนิล|หมึกพิมพ์|จดผิด/,
  );
});

test("V2-LED-08 the search and the filters by Project, status and source narrow the ledger, and PO รอจ่าย sets two of them", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Lots");
  await createPo(
    page,
    "PO เนื้อ",
    [/^น้ำหนักเนื้อ/, "100"],
    [/^ราคา \/ กก\./, "700"],
  );
  await openPage(page, "Accounting");
  await expense(
    page,
    [/^เลขที่อ้างอิง/, "RC-77"],
    [/^ประเภทสินค้า/, "สินทรัพย์"],
    [/^รายการ/, "หมึกพิมพ์"],
    [/^ผู้ขาย/, "ร้านกอไก่"],
    [/^ยอดจ่ายจริง/, "500"],
  );
  await expense(
    page,
    [/^ประเภทสินค้า/, "วัสดุบรรจุภัณฑ์"],
    [/^รายการ/, "ถุงซีลเนื้อ"],
    [/^รายละเอียด/, "ขนาด 8x12"],
    [/^ค่าใช้จ่ายของ/, "โปรเจกต์"],
    [/^Project/, "งานอีเวนต์"],
  );
  await expect(shown(page)).toHaveText("3 จาก 3 รายการ");
  const search = page.getByLabel("ค้นหา");
  const project = page.getByLabel("กรอง Project");
  const status = page.getByLabel("กรอง สถานะ");
  const source = page.getByLabel("กรอง ที่มา / ประเภทบิล");
  const itemType = page.getByLabel("กรอง ประเภทสินค้า");

  // The search: the item, the detail, the seller, the reference and the SKU, in any case.
  for (const [word, found] of [
    ["หมึก", "หมึกพิมพ์"],
    ["8X12", "ถุงซีลเนื้อ"],
    ["กอไก่", "หมึกพิมพ์"],
    ["foodiva", PO1],
    ["rc-77", "หมึกพิมพ์"],
    [PO1.toLowerCase(), PO1],
    ["sku-0011", "หมึกพิมพ์"],
    // A material's SKU, on the row that named the material.
    ["SKU-0003", "ถุงซีลเนื้อ"],
  ]) {
    await search.fill(word);
    await expect(ledgerRows(page), word).toHaveCount(1);
    await expect(ledgerRows(page), word).toContainText(found);
    await expect(shown(page)).toHaveText("1 จาก 3 รายการ");
  }
  await search.fill("ไม่มีคำนี้");
  await expect(ledgerRows(page)).toHaveText(["ไม่มีรายการตามตัวกรอง"]);
  await expect(shown(page)).toHaveText("0 จาก 3 รายการ");
  // The cards read every row, whatever is filtered.
  await expect(card(page, "งบที่กันไว้จาก PO")).toContainText("฿70,000");
  await expect(card(page, "ยอดจ่ายจริงเดือนนี้")).toContainText("฿500");
  await search.fill("");

  // Project: the names in the ledger, and ส่วนกลาง for a row with none.
  expect(await choices(project)).toEqual([
    "ทั้งหมด",
    "งานอีเวนต์",
    "ส่วนกลาง",
    "Nerdnuea x LINE MAN",
  ]);
  await pick(project, "งานอีเวนต์");
  await expect(ledgerRows(page)).toHaveCount(1);
  await expect(ledgerRows(page)).toContainText("ถุงซีลเนื้อ");
  await pick(project, "ส่วนกลาง");
  await expect(ledgerRows(page)).toContainText(["หมึกพิมพ์"]);
  await pick(project, "Nerdnuea x LINE MAN");
  await expect(ledgerRows(page)).toContainText([PO1]);
  await pick(project, "ทั้งหมด");

  await pick(status, "จ่ายแล้ว");
  await expect(ledgerRows(page)).toContainText(["หมึกพิมพ์"]);
  await pick(status, "รอจ่าย");
  await expect(ledgerRows(page)).toHaveCount(2);
  // Together: still to pay, and a packaging material.
  await pick(itemType, "วัสดุบรรจุภัณฑ์");
  await expect(ledgerRows(page)).toContainText(["ถุงซีลเนื้อ"]);
  await pick(status, "ทั้งหมด");
  await expect(ledgerRows(page)).toHaveCount(1);
  await pick(itemType, "ทั้งหมด");
  await pick(source, "PO เนื้อ / รมควัน");
  await expect(ledgerRows(page)).toContainText([PO1]);
  await pick(source, "ทั้งหมด");
  await expect(ledgerRows(page)).toHaveCount(3);

  // PO รอจ่าย: the count of the card, and both filters in one press; a second press clears them.
  const waiting = page.getByRole("button", { name: "PO รอจ่าย (1)" });
  await expect(card(page, "งบที่กันไว้จาก PO")).toContainText(
    "1 รายการที่ยังรอจ่าย",
  );
  await expect(waiting).toHaveAttribute("aria-pressed", "false");
  await waiting.click();
  await expect(waiting).toHaveAttribute("aria-pressed", "true");
  await expect(source).toHaveAttribute("data-value", "PO เนื้อ / รมควัน");
  await expect(status).toHaveAttribute("data-value", "รอจ่าย");
  await expect(ledgerRows(page)).toContainText([PO1]);
  await expect(shown(page)).toHaveText("1 จาก 3 รายการ");
  await waiting.click();
  await expect(waiting).toHaveAttribute("aria-pressed", "false");
  await expect(source).toHaveAttribute("data-value", "");
  await expect(status).toHaveAttribute("data-value", "");
  await expect(ledgerRows(page)).toHaveCount(3);
});
