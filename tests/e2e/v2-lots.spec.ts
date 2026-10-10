import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bangkokDate,
  choices,
  confirmDelete,
  fill,
  form,
  jot,
  openBell,
  openPage,
  pick,
  popup,
  popupTitle,
  region,
  rows,
  save,
  savePo,
  signInAs,
  start,
  toast,
} from "./helpers";

/* Spec v2 section 11, items 5–7 and 9: PO เนื้อ, PO รมควัน and what is still owed a seller. */

const year = bangkokDate().slice(0, 4);
const SO = `SO-${year}-0001`;
const PO = `PO-${year}-0001`;
/** A PO รมควัน or a PO เนื้อ in the list at the left of Lots. */
const listed = (page: Page, number: string) =>
  page.locator("[data-lot]").filter({ hasText: number });
/** The count on a PO รมควัน in the list: what it still lacks. */
const lacks = (page: Page, number: string) =>
  listed(page, number).getByLabel(/^ยังไม่ได้จด \d+ อย่าง$/);
/** A figure of the PO in view, by its label. */
const fact = (detail: Locator, label: string) =>
  detail
    .locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd");
/** A tile of the PO รมควัน in view: a button while it is yellow. */
const tile = (detail: Locator, label: RegExp) =>
  detail.getByRole("button", { name: label });
/** Opens a PO's document from the top of Lots. */
const create = async (page: Page, kind: "PO เนื้อ" | "PO รมควัน") => {
  await page.getByRole("button", { name: `+ สร้าง ${kind}` }).click();
  await expect(popupTitle(page)).toHaveText(kind);
};
const purchase = async (page: Page, kg: string, price: string) => {
  await create(page, "PO เนื้อ");
  await fill(page, [/^น้ำหนักเนื้อ/, kg], [/^ราคา \/ กก\./, price]);
};
const smokeOrder = async (page: Page, kg: string) => {
  await create(page, "PO รมควัน");
  await fill(page, [/^น้ำหนักที่สั่งรมควัน/, kg]);
};
/** Opens a new round of the PO รมควัน in view. */
const dispatch = async (page: Page, lot: Locator) => {
  await lot.getByRole("button", { name: "+ ส่งไปรมควัน (รอบใหม่)" }).click();
  await expect(popupTitle(page)).toHaveText("ส่งไปรมควัน");
};
/** The first PO เนื้อ line of the dispatch form. */
const line = (page: Page) => form(page).getByLabel("PO เนื้อ บรรทัด 1");
/** The round's three steps and the Chef House invoice, from the PO รมควัน's own buttons. */
const finish = async (
  page: Page,
  lot: Locator,
  v: { received: string; smoked: string; boxes: string; fee: string },
) => {
  await tile(lot, /^รับที่ Chef House/).click();
  await fill(page, [/^น้ำหนักรับจริง/, v.received]);
  await save(page);
  await tile(lot, /^หลังรมควัน/).click();
  await fill(
    page,
    [/^น้ำหนักหลังรมควัน/, v.smoked],
    [/^จำนวนกล่องรมควัน/, v.boxes],
  );
  await save(page);
  await tile(lot, /^ส่งกลับ/).click();
  await fill(page, [/^น้ำหนักส่งกลับ/, v.smoked], [/^ค่าขนส่งไป-กลับ/, "3000"]);
  await save(page);
  await lot
    .getByRole("button", { name: "+ บันทึก Invoice Chef House" })
    .click();
  await fill(page, [/^ยอดค่ารม/, v.fee], [/^เลข Invoice/, "CH-001"]);
  await save(page);
};

test("5 · V2-PO-02 V2-LOT-04 a PO รมควัน is jotted before any PO เนื้อ, and a PO เนื้อ with no PO รมควัน", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Lots");
  await expect(page.getByText(/ยังไม่มี PO รมควันและ PO เนื้อ/)).toBeVisible();

  // No PO เนื้อ exists yet: the PO รมควัน is its own document, with the number it will get.
  await smokeOrder(page, "100");
  await expect(popup(page).locator("header")).toContainText(SO);
  await expect(popup(page).locator("header")).toContainText("ฉบับร่าง");
  await savePo(page);
  await expect(toast(page, "จดแล้ว: PO รมควัน")).toBeVisible();
  await expect(page.locator("[data-lot]")).toHaveCount(1);
  await expect(lacks(page, SO)).toHaveText("5");
  await expect(rows(page, "smokeOrder")).toContainText("100 กก.");

  // The PO เนื้อ asks for no PO รมควัน (and no payment): the web gives it its number (V2-PO-01).
  await purchase(page, "150", "700");
  await expect(form(page).getByLabel(/^ผู้ขาย/)).toHaveValue("Foodiva");
  await expect(form(page).getByLabel(/^PO รมควัน/)).toHaveCount(0);
  await savePo(page);
  await expect(toast(page, "จดแล้ว: PO เนื้อ")).toBeVisible();
  await expect(page.locator("[data-lot]")).toHaveCount(2);
  await expect(listed(page, PO)).toContainText("ฝากไว้ 150 กก.");
  await listed(page, PO).click();
  const po = region(page, PO);
  await expect(fact(po, "มูลค่า")).toHaveText("฿105,000");
  await expect(fact(po, "น้ำหนักที่ส่งไปรมแล้ว")).toHaveText("0 กก.");
  await expect(fact(po, "PO รมควันที่ใช้เนื้อนี้")).toHaveText("ยังไม่มี");
  // The PO รมควัน is as it was: the PO เนื้อ did not join it by itself.
  await expect(lacks(page, SO)).toHaveText("5");
  await openPage(page, "Finance");
  await expect(region(page, "รายการเงินเข้า–ออกล่าสุด")).toContainText(
    "ยังไม่มีรายการเงินเข้า–ออก",
  );
});

test("6 · V2-LOT-03 a round is not saved without its PO เนื้อ; a PO รมควัน whose PO เนื้อ is gone is yellow with no cost per box; linked, the yellow goes and the cost shows", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Lots");
  await purchase(page, "100", "500");
  await savePo(page);
  await smokeOrder(page, "60");
  await savePo(page);
  const lot = region(page, SO);

  // The round starts at what the PO รมควัน has left, and names no PO เนื้อ: it cannot be saved.
  await dispatch(page, lot);
  await expect(form(page).getByLabel(/^น้ำหนักที่ส่ง/)).toHaveValue("60");
  await expect(form(page).locator("footer")).toContainText(
    "บันทึกไม่ได้ เพราะยังไม่ได้เลือก PO เนื้อ",
  );
  const saveButton = form(page).getByRole("button", {
    name: "บันทึก",
    exact: true,
  });
  await expect(saveButton).toBeDisabled();
  await form(page).getByRole("button", { name: "เพิ่ม PO เนื้อ" }).click();
  expect(await choices(line(page))).toEqual([
    "เลือก PO เนื้อ",
    `${PO} · ฝากไว้ 100 กก.`,
  ]);
  await pick(line(page), 1);
  await expect(form(page).getByLabel("กก. บรรทัด 1")).toHaveValue("60");
  await expect(saveButton).toBeEnabled();
  await save(page);
  await finish(page, lot, {
    received: "60",
    smoked: "30",
    boxes: "10",
    fee: "6000",
  });

  await expect(listed(page, SO)).toHaveAttribute("data-tone", "ok");
  await expect(lot.getByText("จดครบแล้ว", { exact: true })).toBeVisible();
  await expect(fact(lot, "Yield")).toHaveText("50%");
  await expect(fact(lot, "ค่าเนื้อ")).toHaveText("฿30,000");
  // (30,000 + 6,000 + 3,000 of the round trip) ÷ 30 กก., × 0.12 กก. per box + ฿25 of packaging.
  await expect(fact(lot, "ต้นทุนต่อ กก.")).toHaveText("฿1,300.00");
  await expect(fact(lot, "ต้นทุนต่อกล่อง")).toContainText("฿181.00");
  await expect(listed(page, PO)).toContainText("ฝากไว้ 40 กก.");

  // Its PO เนื้อ deleted, the round is linked to nothing.
  await listed(page, PO).click();
  const bought = rows(page, "purchase");
  await bought.getByRole("button").first().click();
  await bought.getByRole("button", { name: "ลบ", exact: true }).click();
  await confirmDelete(page);
  await expect(listed(page, PO)).toHaveCount(0);
  await expect(listed(page, SO)).toHaveAttribute("data-tone", "warning");
  await expect(lacks(page, SO)).toHaveText("1");
  await expect(lot).toContainText("ยังไม่ได้จด 1 อย่าง");
  await expect(fact(lot, "Yield")).toHaveText("50%");
  for (const label of ["ค่าเนื้อ", "ต้นทุนต่อ กก.", "ต้นทุนต่อกล่อง"])
    await expect(fact(lot, label)).toHaveText("ยังคิดไม่ได้");
  await expect(rows(page, "dispatch")).toHaveAttribute("data-tone", "warning");
  await expect(rows(page, "dispatch")).toContainText("ยังไม่ได้เลือก PO เนื้อ");

  // Linking is an edit of that round.
  const PO2 = `PO-${year}-0002`;
  await purchase(page, "100", "400");
  await savePo(page);
  await listed(page, SO).click();
  const link = tile(lot, /^PO เนื้อที่ใช้/);
  await expect(link).toContainText("ยังไม่ได้เลือก PO เนื้อ");
  await link.click();
  await expect(popupTitle(page)).toHaveText("แก้ไข: ส่งไปรมควัน");
  await pick(line(page), `${PO2} · ฝากไว้ 100 กก.`);
  await save(page);
  await expect(toast(page, "แก้แล้ว: ส่งไปรมควัน")).toBeVisible();

  await expect(listed(page, SO)).toHaveAttribute("data-tone", "ok");
  await expect(lacks(page, SO)).toHaveCount(0);
  await expect(lot.getByText("จดครบแล้ว", { exact: true })).toBeVisible();
  await expect(lot.locator('[data-tone="warning"]')).toHaveCount(0);
  await expect(fact(lot, "ค่าเนื้อ")).toHaveText("฿24,000");
  // (24,000 + 6,000 + 3,000) ÷ 30 กก. × 0.12 กก. per box, then + ฿25 of packaging.
  await expect(fact(lot, "ต้นทุนต่อกล่อง")).toContainText("฿157.00");
  await expect(listed(page, PO2)).toContainText("ฝากไว้ 40 กก.");
});

test("7 · V2-LOT-01 V2-LOT-02 a PO รมควัน with its round's steps and its invoice has no yellow, with none of the extra notes jotted", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Lots");
  await purchase(page, "200", "700");
  await savePo(page);

  // Each step takes one off the count; the yellow tiles name what the round still lacks.
  const lot = region(page, SO);
  const left = async (count: number, ...tiles: string[]) => {
    await expect(listed(page, SO)).toHaveAttribute("data-tone", "warning");
    await expect(lacks(page, SO)).toHaveText(String(count));
    await expect(lot).toContainText(`ยังไม่ได้จด ${count} อย่าง`);
    await expect(lot.locator('button[data-tone="warning"] strong')).toHaveText(
      tiles,
    );
  };
  await smokeOrder(page, "200");
  await savePo(page);
  await left(5);
  await dispatch(page, lot);
  await expect(form(page).getByLabel(/^PO รมควัน/)).toHaveText(SO);
  await expect(form(page).getByLabel(/^น้ำหนักที่ส่ง/)).toHaveValue("200");
  await form(page).getByRole("button", { name: "เพิ่ม PO เนื้อ" }).click();
  await pick(line(page), 1);
  await save(page);
  await left(4, "รับที่ Chef House", "หลังรมควัน", "ส่งกลับ");
  await tile(lot, /^รับที่ Chef House/).click();
  await fill(page, [/^น้ำหนักรับจริง/, "200"]);
  await save(page);
  await left(3, "หลังรมควัน", "ส่งกลับ");
  await tile(lot, /^หลังรมควัน/).click();
  await fill(page, [/^น้ำหนักหลังรมควัน/, "104"], [/^จำนวนกล่องรมควัน/, "18"]);
  await save(page);
  await left(2, "ส่งกลับ");
  await tile(lot, /^ส่งกลับ/).click();
  await fill(page, [/^น้ำหนักส่งกลับ/, "104"]);
  await save(page);
  await left(1);
  await lot
    .getByRole("button", { name: "+ บันทึก Invoice Chef House" })
    .click();
  await fill(page, [/^ยอดค่ารม/, "24000"], [/^เลข Invoice/, "INV-CH-031"]);
  await save(page);

  await expect(listed(page, SO)).toHaveAttribute("data-tone", "ok");
  await expect(lacks(page, SO)).toHaveCount(0);
  await expect(lot.getByText("จดครบแล้ว", { exact: true })).toBeVisible();
  await expect(lot.locator('[data-tone="warning"]')).toHaveCount(0);
  await expect(fact(lot, "Yield")).toHaveText("52%");
  // Only the PO รมควัน, its round's four notes and its invoice are on it.
  const core = [
    "smokeOrder",
    "dispatch",
    "cmReceive",
    "smoked",
    "return",
    "smokingInvoice",
  ];
  await expect(lot.locator("[data-entry]")).toHaveCount(core.length);
  for (const kind of core)
    await expect(lot.locator(`[data-kind="${kind}"]`)).toHaveCount(1);
  await expect(await openBell(page)).not.toContainText("SO-");
  await page.keyboard.press("Escape");

  // An extra note, even one left empty, never colours the PO รมควัน.
  await openPage(page, "Lots");
  await lot.getByRole("button", { name: "+ รับเข้าตู้ที่ Foodiva" }).click();
  await expect(popupTitle(page)).toHaveText("รับเข้าตู้ที่ Foodiva");
  // No core field: the footer counts nothing as not jotted.
  await expect(form(page).locator("footer")).not.toContainText("ยังไม่ได้จด");
  await save(page);
  await expect(toast(page, "จดแล้ว: รับเข้าตู้ที่ Foodiva")).toHaveText(
    /^จดแล้ว: รับเข้าตู้ที่ Foodiva(?!.*ยังไม่ได้จด)/,
  );
  await expect(rows(page, "foodivaReturnReceive")).not.toHaveAttribute(
    "data-tone",
  );
  await expect(listed(page, SO)).toHaveAttribute("data-tone", "ok");
  await expect(lot.locator("[data-entry]")).toHaveCount(core.length + 1);
});

test("9 · V2-CAL-13 a part payment to the meat seller takes that much off what is owed", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Finance");
  const balances = region(page, "ยอดค้างจ่ายแยกผู้ขาย");
  await expect(balances).toContainText("ยังไม่มีใบจากผู้ขาย");
  const foodiva = balances.getByRole("row", { name: /^Foodiva/ });

  // The bill is the PO เนื้อ's Invoice Foodiva, a note of its own on the PO.
  await openPage(page, "Lots");
  await purchase(page, "100", "500");
  await savePo(page);
  await region(page, PO)
    .getByRole("button", { name: "+ บันทึก Invoice Foodiva" })
    .click();
  await fill(page, [/^เลข Invoice/, "INV-F-0912"], [/^ยอด Invoice/, "50000"]);
  await save(page);
  await openPage(page, "Finance");
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
