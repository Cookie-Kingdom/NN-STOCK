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

/** The sample set closes its last seven days (through today) and future dates are blocked,
 * so the day before the sample range is the open working date. */
function openDayBeforeSample() {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  now.setDate(now.getDate() - 7);
  return now.toLocaleDateString("en-CA");
}

async function setWorkingDate(page: Page, date: string) {
  const input = page.getByLabel("วันที่ทำรายการ");
  await input.scrollIntoViewIfNeeded();
  await input.fill(date);
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

  // ข้อมูลตัวอย่างปิดวันไว้แล้ว ฟอร์มของวันนี้ต้องถูกล็อก
  await expect(page.locator("main")).toContainText("ปิดแล้ว");

  // เปิดวันก่อนช่วง sample (ยังไม่ปิด) ฟอร์มต้องปลดล็อก
  await setWorkingDate(page, openDayBeforeSample());
  await expect(page.locator("main")).not.toContainText("ปิดแล้ว");

  const riceTable = tableSection(page, "ข้าวเหนียวดิบ · ซื้อที่สาขาศาลาแดง");
  await pointAndClick(
    page,
    riceTable.getByRole("button", { name: "กรอกข้อมูล" }).nth(0),
  );
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

  // มีนบุรีซื้อข้าวเหนียวสุก ไม่ใช่ข้าวดิบแบบศาลาแดง
  await expect(
    page.getByRole("heading", { name: "ข้าวเหนียวสุก · ซื้อที่สาขามีนบุรี" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "ข้าวเหนียวดิบ · ซื้อที่สาขาศาลาแดง" }),
  ).toHaveCount(0);

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
  await button(page, "สรุปสาขา");
  await expect(page.locator("main")).toContainText("ภาพรวมประจำวันที่");
});
