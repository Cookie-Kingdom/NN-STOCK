import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  field,
  loadSampleData,
  menuItem,
  pointAndClick,
  saveEntry,
  sidebar,
  signInAs,
  skipUnlessCredentials,
  startFresh,
  tableSection,
} from "./helpers";

function bangkokDate(offset = 0) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  now.setDate(now.getDate() + offset);
  return now.toLocaleDateString("en-CA");
}

/** The sample set closes its last seven days (through today) and future dates are blocked,
 * so the day before the sample range is the open working date. */
const openDayBeforeSample = () => bangkokDate(-7);

/** Same rice rows at every branch since B2: each round is self-cooked or bought cooked. */
const RICE_TABLE = "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก";

async function setWorkingDate(page: Page, date: string) {
  // The page-heading picker: the day tab's materials/receipt cards carry their own copy below it.
  const input = page.getByLabel("วันที่ทำรายการ").first();
  await input.scrollIntoViewIfNeeded();
  await input.fill(date);
  await expect(input).toHaveValue(date);
}

test("สาขาศาลาแดง: วันที่ปิดแล้วถูกล็อก และเปิดวันใหม่บันทึกซื้อข้าวได้", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await loadSampleData(page);

  await signInAs(page, ACCOUNTS.saladaeng);
  await expect(page.getByRole("heading", { name: "กรอกรายวัน" })).toBeVisible();
  await expect(page.locator("main")).toContainText("ศาลาแดง");

  // ข้อมูลตัวอย่างปิดวันไว้แล้ว: แถบเตือนล็อก และปุ่มปิดวันจุดเดียวกดไม่ได้ (B3)
  await expect(page.locator("main")).toContainText(
    `ปิดวันแล้ว · ข้อมูลวันที่ ${bangkokDate()} ถูกล็อก`,
  );
  await expect(
    page.getByRole("main").getByRole("button", { name: "ตรวจและปิดวัน" }),
  ).toBeDisabled();

  // เปิดวันก่อนช่วง sample (ยังไม่ปิด) ฟอร์มต้องปลดล็อก
  await setWorkingDate(page, openDayBeforeSample());
  await expect(page.locator("main")).not.toContainText("ถูกล็อก แก้ไขไม่ได้");

  // ซื้อข้าวรอบนี้แบบนึ่งเอง: เลือกที่มาก่อน ช่องข้าวดิบจึงขึ้น (B2)
  await pointAndClick(
    page,
    tableSection(page, RICE_TABLE)
      .getByRole("row")
      .filter({ hasText: "ซื้อข้าวเหนียวเข้าสต๊อก" })
      .getByRole("button", { name: "กรอกข้อมูล" }),
  );
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(/ข้าวเหนียวดิบซื้อเข้า/)).toHaveCount(0);
  await dialog
    .getByLabel(/รอบนี้ข้าวเหนียวมาจาก/)
    .selectOption("นึ่งเอง (ซื้อข้าวดิบ)");
  await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าวทดสอบสาขา");
  await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "6");
  await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "330");
  await saveEntry(page);
  await expect(page.getByRole("status")).toContainText(
    "ซื้อข้าวเหนียวเข้าสต๊อกแล้ว",
  );

  // ประวัติต้องเก็บรายการที่เพิ่งบันทึก
  await button(page, "ประวัติ");
  await expect(page.locator("main")).toContainText("ร้านข้าวทดสอบสาขา");
});

test("สาขามีนบุรี เห็นข้อมูลสาขาตัวเองและเมนูเฉพาะของสาขา", async ({
  page,
}) => {
  skipUnlessCredentials(ACCOUNTS.owner, ACCOUNTS.minburi);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await loadSampleData(page);

  await signInAs(page, ACCOUNTS.minburi);
  await expect(page.locator("main")).toContainText("มีนบุรี");
  await expect(page.locator("main")).not.toContainText("สาขา ศาลาแดง");

  // B2: ตารางข้าวเดียวกันทุกสาขา (นึ่งเอง หรือซื้อข้าวสุก) ไม่แยกตามชื่อสาขาแล้ว
  await expect(page.getByRole("heading", { name: RICE_TABLE })).toBeVisible();
  for (const row of [
    "ซื้อข้าวเหนียวเข้าสต๊อก",
    "เบิกข้าวเหนียวดิบวันนี้",
    "ข้าวเหนียวช่วงเช้า",
    "ยืนยันข้าวเหนียวสุกคงเหลือ",
  ])
    await expect(tableSection(page, RICE_TABLE)).toContainText(row);

  for (const menu of ["กรอกรายวัน", "สต๊อก", "สรุปสาขา", "ประวัติ"]) {
    await expect(menuItem(page, menu)).toBeVisible();
  }
  for (const forbidden of ["ตั้งค่า", "รายงาน", "ใบสั่งซื้อ PO", "งานผลิต"]) {
    await expect(
      sidebar(page).getByRole("button", { name: forbidden }),
    ).toHaveCount(0);
  }

  // หน้าจออื่นของสาขาต้องเปิดได้
  await button(page, "สต๊อก");
  await expect(
    page.getByRole("heading", { name: "สต๊อกแยก Lot" }),
  ).toBeVisible();
  // B4: สรุปคงเหลือรายวัน / รายล็อต ในแท็บสต๊อก ของสาขาตัวเอง ไม่มีตัวเลือกสาขา
  await expect(
    page.getByRole("heading", { name: "สรุปคงเหลือเนื้อ รายวัน / รายล็อต" }),
  ).toBeVisible();
  await expect(page.locator("main")).toContainText(
    `คงเหลือแยก Lot · ${bangkokDate()} · มีนบุรี`,
  );
  await button(page, "สรุปสาขา");
  await expect(page.locator("main")).toContainText("ภาพรวมประจำวันที่");
});
