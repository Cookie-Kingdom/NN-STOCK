import { expect, test } from "@playwright/test";
import {
  bangkokDate,
  choices,
  fill,
  form,
  openPage,
  pick,
  popupTitle,
  region,
  save,
  sheetCell,
  signInAs,
  start,
  toast,
} from "./helpers";

/* รายการเนื้อ: each kind of meat (breed, cut) is bought, smoked and stocked apart. */
const year = bangkokDate().slice(0, 4);
const SO = `SO-${year}-0001`;

test("a kind of meat added in Settings is chosen on its PO เนื้อ and PO รมควัน, sent only with its own PO เนื้อ, and stocked apart at Foodiva and the branch", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");

  // One kind: no field to choose it.
  await openPage(page, "Lots");
  await page.getByRole("button", { name: "+ สร้าง PO เนื้อ" }).click();
  await expect(form(page).getByLabel(/^ชนิดเนื้อ/)).toHaveCount(0);
  await page.keyboard.press("Escape");

  await openPage(page, "Settings", true);
  const meats = region(page, "รายการเนื้อ");
  await meats.getByRole("button", { name: "เพิ่มชนิดเนื้อ" }).click();
  const inputs = meats.getByRole("textbox");
  await expect(inputs).toHaveCount(2);
  // The first kind (what every old note is of) is renamed, never removed.
  await expect(meats.getByRole("button", { name: "ลบ เนื้อ" })).toHaveCount(0);
  await inputs.nth(1).fill("วากิว");
  await meats.getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(toast(page, "บันทึกแล้ว: รายการเนื้อ")).toBeVisible();

  // A PO เนื้อ of each kind; the first kind is the default.
  await openPage(page, "Lots");
  const po = async (kind: string | null, kg: string) => {
    await page.getByRole("button", { name: "+ สร้าง PO เนื้อ" }).click();
    await expect(popupTitle(page)).toHaveText("PO เนื้อ");
    if (kind) await fill(page, [/^ชนิดเนื้อ/, kind]);
    await fill(
      page,
      [/^น้ำหนักเนื้อ(?!รอรับ|สไลด์)/, kg],
      [/^ราคา \/ กก\./, "700"],
    );
    await save(page);
  };
  await po("วากิว", "200");
  await po(null, "100");
  await page.getByRole("button", { name: "+ สร้าง PO รมควัน" }).click();
  await fill(page, [/^ชนิดเนื้อ/, "วากิว"], [/^น้ำหนักที่สั่งรมควัน/, "200"]);
  await save(page);
  const lot = region(page, SO);
  await expect(lot).toContainText("PO รมควัน · Chef House · วากิว");

  // The round offers only the PO เนื้อ of the Lot's kind.
  await lot.getByRole("button", { name: "+ ส่งไปรมควัน (รอบใหม่)" }).click();
  await form(page).getByRole("button", { name: "เพิ่ม PO เนื้อ" }).click();
  const line = form(page).getByLabel("PO เนื้อ บรรทัด 1");
  const offered = await choices(line);
  expect(offered).toEqual(["เลือก PO เนื้อ", `PO-${year}-0001 · 200 กก.`]);
  await pick(line, 1);
  await save(page);
  await lot.getByRole("button", { name: /^หลังรมควัน/ }).click();
  await fill(page, [/^น้ำหนักหลังรมควัน/, "120"]);
  await save(page);

  // Foodiva holds it by kind, ready to allocate.
  await openPage(page, "Stock", true);
  const meat = region(page, "เนื้อ (กก.)");
  const smoked = meat
    .getByRole("row")
    .filter({ hasText: "Foodiva (รมควันแล้ว)" });
  await expect(smoked).toContainText(`${SO} · วากิว`);
  await smoked.getByRole("button", { name: `จัดสรร ${SO}` }).click();
  await fill(page, [/^สาขาปลายทาง/, "สาขามีนบุรี"], [/^น้ำหนัก/, "20"]);
  await save(page);

  // The branch's sheet has a row per kind: the วากิว came in, the เนื้อ did not. Sent with
  // 「เข้าสต๊อกสาขาทันที」 (the default), it is in by itself: nothing to confirm.
  await signInAs(page, "minburi");
  await openPage(page, "Stock");
  await expect(region(page, "รอยืนยันรับสินค้า")).toHaveCount(0);
  await expect(sheetCell(page, "คงเหลือ", "วากิว")).toHaveText(/^20 /);
  await expect(page.getByRole("main")).toContainText("รับเข้าอัตโนมัติ 20");
});
