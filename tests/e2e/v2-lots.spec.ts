import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bangkokDate,
  fill,
  form,
  jot,
  openPage,
  region,
  rows,
  save,
  signInAs,
  start,
  toast,
} from "./helpers";

/* Spec v2 section 11, items 5–7 and 9: PO เนื้อ, Lot รมควัน and what is still owed a seller. */

const year = bangkokDate().slice(0, 4);
const SH = `SH-${year}-0001`;
const PO = `PO-${year}-0001`;
/** A Lot or a PO in the list at the left of Lots. */
const listed = (page: Page, number: string) =>
  page.locator("[data-lot]").filter({ hasText: number });
/** A figure of the Lot or PO in view, by its label. */
const fact = (detail: Locator, label: string) =>
  detail
    .locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd");
/** A tile of the Lot in view: a button while it is yellow. */
const tile = (detail: Locator, label: RegExp) =>
  detail.getByRole("button", { name: label });
const purchase = async (page: Page, kg: string, price: string) => {
  await jot(page, "PO เนื้อ");
  await fill(page, [/^น้ำหนักที่สั่งซื้อ/, kg], [/^ราคา \/ กก\./, price]);
};

test("5 · V2-PO-02 V2-LOT-04 a PO รมควัน is jotted before any PO เนื้อ, and a PO เนื้อ with no Lot", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "manager");
  await openPage(page, "Lots");
  await expect(page.getByText(/ยังไม่มี Lot และ PO เนื้อ/)).toBeVisible();

  // No PO เนื้อ exists yet: the PO รมควัน opens its own Lot.
  await jot(page, "PO รมควัน");
  await expect(form(page).getByLabel(/^Lot/)).toHaveValue("");
  await fill(page, [/^น้ำหนักที่สั่งรม/, "100"]);
  await save(page);
  await expect(toast(page, "จดแล้ว: PO รมควัน")).toBeVisible();
  await expect(page.locator("[data-lot]")).toHaveCount(1);
  await expect(listed(page, SH)).toContainText("ยังไม่ได้จด 3 อย่าง");
  await expect(rows(page, "smokeOrder")).toContainText("100 กก.");

  // The PO เนื้อ asks for no Lot (and no payment): the web gives it its number (V2-PO-01).
  await purchase(page, "150", "700");
  await expect(form(page).getByLabel(/^ผู้ขาย/)).toHaveValue("Foodiva");
  await expect(form(page).getByLabel(/^Lot/)).toHaveCount(0);
  await save(page);
  await expect(toast(page, "จดแล้ว: PO เนื้อ")).toBeVisible();
  await expect(page.locator("[data-lot]")).toHaveCount(2);
  await expect(listed(page, PO)).toContainText("ฝากไว้ 150 กก.");
  await listed(page, PO).click();
  const po = region(page, PO);
  await expect(fact(po, "มูลค่า")).toHaveText("฿105,000");
  await expect(fact(po, "ส่งไปรมแล้ว")).toHaveText("0 กก.");
  await expect(fact(po, "Lot ที่ใช้เนื้อนี้")).toHaveText("ยังไม่มี");
  // The Lot is as it was: the PO เนื้อ did not join it by itself.
  await expect(listed(page, SH)).toContainText("ยังไม่ได้จด 3 อย่าง");
  await openPage(page, "Finance");
  await expect(region(page, "จ่ายเงินล่าสุด")).toContainText(
    "ยังไม่มีบันทึกจ่ายเงิน",
  );
});

test("6 · V2-LOT-03 a Lot not linked to a PO เนื้อ is yellow with no cost per box; linked, the yellow goes and the cost shows", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await purchase(page, "100", "500");
  await save(page);
  await jot(page, "PO รมควัน");
  await fill(page, [/^น้ำหนักที่สั่งรม/, "60"]);
  await save(page);
  await openPage(page, "Lots");
  const lot = region(page, SH);

  // The three other core notes from the Lot's own tiles; the truck names no PO เนื้อ.
  await tile(lot, /^ส่งไปรม/).click();
  await expect(form(page).getByLabel(/^เนื้อจาก PO ไหน/)).toHaveValue("");
  await fill(page, [/^น้ำหนักที่ส่ง/, "60"]);
  await save(page);
  await tile(lot, /^รับกลับเข้าสต๊อกกลาง/).click();
  await fill(page, [/^น้ำหนักที่รับ/, "30"], [/^จำนวนกล่องรมควัน/, "10"]);
  await save(page);
  await tile(lot, /^ค่ารม/).click();
  await fill(page, [/^ยอดค่ารม/, "6000"], [/^เลข Invoice/, "CH-001"]);
  await save(page);

  await expect(listed(page, SH)).toHaveAttribute("data-tone", "warning");
  await expect(listed(page, SH)).toContainText("ยังไม่ได้จด 1 อย่าง");
  await expect(lot).toContainText("ยังไม่ได้จดครบ");
  await expect(fact(lot, "Yield")).toHaveText("50%");
  for (const label of ["ค่าเนื้อ", "ต้นทุนเนื้อต่อกล่อง", "ต้นทุนต่อกล่อง"])
    await expect(fact(lot, label)).toHaveText("ยังคิดไม่ได้");
  await expect(rows(page, "dispatch")).toHaveAttribute("data-tone", "warning");
  await expect(rows(page, "dispatch")).toContainText("ยังไม่ผูก PO เนื้อ");

  // Linking is an edit of that truck.
  const link = tile(lot, /^เนื้อจาก PO ไหน/);
  await expect(link).toContainText("ยังไม่ผูก PO เนื้อ · กดเพื่อผูก");
  await link.click();
  await expect(form(page).getByRole("heading")).toHaveText("แก้ไข: ส่งไปรม");
  const from = form(page).getByLabel(/^เนื้อจาก PO ไหน/);
  await expect(from.locator("option")).toHaveText([
    "ยังไม่ระบุ",
    `${PO} · Foodiva · ฝากไว้ 100 กก.`,
  ]);
  await from.selectOption({ index: 1 });
  await save(page);
  await expect(toast(page, "แก้แล้ว: ส่งไปรม")).toBeVisible();

  await expect(listed(page, SH)).toHaveAttribute("data-tone", "ok");
  await expect(listed(page, SH)).toContainText("จดครบแล้ว");
  await expect(lot.locator('[data-tone="warning"]')).toHaveCount(0);
  await expect(fact(lot, "ค่าเนื้อ")).toHaveText("฿30,000");
  // (30,000 + 6,000) ÷ 30 กก. × 0.12 กก. per box, then + ฿25 of packaging.
  await expect(fact(lot, "ต้นทุนเนื้อต่อกล่อง")).toHaveText("฿144.00");
  await expect(fact(lot, "ต้นทุนต่อกล่อง")).toContainText("฿169.00");
  await expect(listed(page, PO)).toContainText("ฝากไว้ 40 กก.");
  await openPage(page, "Overview");
  await expect(region(page, "ตัวเลขของเดือน")).toContainText("฿169.00");
});

test("7 · V2-LOT-01 V2-LOT-02 a Lot with its four core notes has no yellow, with none of the extra notes jotted", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Lots");
  await purchase(page, "200", "700");
  await save(page);

  // Each core note takes one off the count; the yellow tiles name what is left.
  const lot = region(page, SH);
  const core = ["PO รมควัน", "ส่งไปรม", "รับกลับเข้าสต๊อกกลาง", "ค่ารม"];
  const left = async (count: number) => {
    await expect(listed(page, SH)).toHaveAttribute("data-tone", "warning");
    await expect(listed(page, SH)).toContainText(`ยังไม่ได้จด ${count} อย่าง`);
    await expect(lot.locator('button[data-tone="warning"] strong')).toHaveText(
      core.slice(-count),
    );
  };
  await jot(page, "PO รมควัน");
  await fill(page, [/^น้ำหนักที่สั่งรม/, "200"]);
  await save(page);
  await left(3);
  await jot(page, "ส่งไปรม");
  await expect(
    form(page).getByLabel(/^Lot/).locator("option:checked"),
  ).toHaveText(SH);
  await fill(page, [/^น้ำหนักที่ส่ง/, "200"]);
  await form(page)
    .getByLabel(/^เนื้อจาก PO ไหน/)
    .selectOption({ index: 1 });
  await save(page);
  await left(2);
  await jot(page, "รับกลับเข้าสต๊อกกลาง");
  await fill(page, [/^น้ำหนักที่รับ/, "104"], [/^จำนวนกล่องรมควัน/, "18"]);
  await save(page);
  await left(1);
  await jot(page, "ค่ารม");
  await fill(page, [/^ยอดค่ารม/, "24000"], [/^เลข Invoice/, "INV-CH-031"]);
  await save(page);

  await expect(listed(page, SH)).toHaveAttribute("data-tone", "ok");
  await expect(listed(page, SH)).toContainText("จดครบแล้ว");
  await expect(lot.getByText("จดครบแล้ว", { exact: true })).toBeVisible();
  await expect(lot.locator('[data-tone="warning"]')).toHaveCount(0);
  await expect(fact(lot, "Yield")).toHaveText("52%");
  // Only the four core notes are on the Lot.
  await expect(lot.locator("[data-entry]")).toHaveCount(4);
  for (const kind of ["smokeOrder", "dispatch", "central", "smokingInvoice"])
    await expect(lot.locator(`[data-kind="${kind}"]`)).toHaveCount(1);
  await openPage(page, "Daily Log");
  await expect(region(page, "ยังไม่ได้จด")).not.toContainText("SH-");

  // An extra note, even one left empty, never colours the Lot.
  await jot(page, "ชั่งรับที่ Chef House");
  await expect(form(page)).toContainText("จดเพิ่มได้ ไม่มีช่องที่ขึ้นสีเหลือง");
  await save(page);
  await expect(toast(page, "จดแล้ว: ชั่งรับที่ Chef House")).toHaveText(
    /^จดแล้ว: ชั่งรับที่ Chef House(?!.*ยังไม่ได้จด)/,
  );
  await expect(rows(page, "cmReceive")).not.toHaveAttribute("data-tone");
  await openPage(page, "Lots");
  await expect(listed(page, SH)).toHaveAttribute("data-tone", "ok");
  await expect(region(page, SH).locator("[data-entry]")).toHaveCount(5);
});

test("9 · V2-CAL-13 a part payment to the meat seller takes that much off what is owed", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Finance");
  const balances = region(page, "ยอดคงเหลือที่ยังไม่ได้จ่าย ต่อผู้ขาย");
  await expect(balances).toContainText("ยังไม่มีใบจากผู้ขาย");
  const foodiva = balances.getByRole("row", { name: /^Foodiva/ });

  await purchase(page, "100", "500");
  await form(page).locator("summary").click();
  await fill(page, [/^เลข Invoice/, "INV-F-0912"], [/^ยอด Invoice/, "50000"]);
  await save(page);
  await expect(foodiva.getByRole("cell")).toHaveText([
    "Foodiva",
    "฿50,000",
    "฿0",
    "฿50,000",
  ]);
  await expect(foodiva.getByRole("cell").last()).toHaveAttribute(
    "data-tone",
    "warning",
  );

  // V2-PAY-02: a payment names the seller and the amount, never an Invoice.
  const pay = async (amount: string) => {
    await jot(page, "จ่ายเงิน");
    await fill(
      page,
      [/^หมวด/, "เนื้อ"],
      [/^ยอด \(บาท\)/, amount],
      [/^ผู้ขาย/, "Foodiva"],
    );
    await expect(form(page).getByLabel(/Invoice/)).toHaveCount(0);
    await save(page);
  };
  await pay("20000");
  await expect(foodiva.getByRole("cell")).toHaveText([
    "Foodiva",
    "฿50,000",
    "฿20,000",
    "฿30,000",
  ]);
  await expect(foodiva.getByRole("cell").last()).toHaveAttribute(
    "data-tone",
    "warning",
  );
  await pay("30000");
  await expect(foodiva.getByRole("cell")).toHaveText([
    "Foodiva",
    "฿50,000",
    "฿50,000",
    "จ่ายครบแล้ว",
  ]);
  await expect(foodiva.getByRole("cell").last()).toHaveAttribute(
    "data-tone",
    "ok",
  );
  await expect(rows(page, "pay")).toHaveCount(2);
});
