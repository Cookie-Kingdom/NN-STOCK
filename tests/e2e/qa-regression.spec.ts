import { expect, test, type Page } from "@playwright/test";
import {
  a_expectOverStock,
  a_expectRefused,
  ACCOUNTS,
  button,
  chefSmokesShipment,
  field,
  foodivaFillsPackingList,
  foodivaIssuesInvoice,
  foodivaOpensManifest,
  foodivaReceivesReturn,
  INVOICE_FIXTURE,
  menuItem,
  ownerCallsReturnTruck,
  ownerCreatesMeatPo,
  ownerCreatesShipmentRequest,
  ownerIssuesSmokePo,
  ownerReceivesCentral,
  pointAndClick,
  saveEntry,
  signInAs,
  skipUnlessCredentials,
  startFresh,
  tableSection,
} from "./helpers";

/* Form-level regressions from the QA report (vault: QA-REPORT.md). The 10-step
 * data walk itself lives in full-loop.spec.ts; these are the bugs that showed up
 * in a single dialog and can be reproduced without the whole loop. */

const MATERIALS = [
  "กล่องพิมพ์ลาย",
  "กระดาษรอง",
  "ถุงซีลเนื้อ",
  "ถุงซีลข้าว",
  "ถุงหิ้วกระดาษ",
  "สติกเกอร์โลโก้",
  "การ์ด / สติกเกอร์วิธีอุ่น",
];

const openDialog = (page: Page) => page.getByRole("dialog").last();

/** The open dialog refuses what was typed (live, save disabled, or on save). */
const submitAndExpectError = a_expectRefused;

async function cancelDialog(page: Page) {
  await pointAndClick(
    page,
    openDialog(page).getByRole("button", { name: "ยกเลิก" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Settings cards are edit-locked until "ขอแก้ไข" is pressed (see owner.spec.ts). */
async function editSection(
  page: Page,
  title: string,
  fill: () => Promise<void>,
) {
  const section = tableSection(page, title);
  await pointAndClick(
    page,
    section.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
  );
  await fill();
  await pointAndClick(
    page,
    section.getByRole("button", { name: "บันทึกและล็อก (Save & lock)" }),
  );
  await expect(
    section.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
  ).toBeVisible();
}

test("BUG-2 / BUG-9: material purchase is saved, reaches the branch and unlocks the daily count", async ({
  page,
}) => {
  skipUnlessCredentials(ACCOUNTS.owner, ACCOUNTS.saladaeng);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  // A transfer needs a par level and unit price per material (QA set 500 / ฿1.00).
  await button(page, "ตั้งค่า");
  await editSection(
    page,
    "จำนวนฐานและราคาวัสดุทั้งร้าน (Material par levels & unit prices)",
    async () => {
      for (let index = 0; index < MATERIALS.length; index += 1) {
        await field(page, `material${index}`, "500");
        await field(page, `materialPrice${index}`, "1");
      }
    },
  );

  await button(page, "สต๊อกของทั้งหมด");
  await button(page, "+ ซื้อวัสดุเข้าคลัง");
  const purchase = openDialog(page);

  // Negative: a missing supplier is refused with an inline message (forms are noValidate), the dialog stays open.
  await purchase.getByLabel(`ซื้อ ${MATERIALS[0]}`).check();
  await field(page, `จำนวนซื้อ ${MATERIALS[0]}`, "500");
  await field(page, `ราคาซื้อ ${MATERIALS[0]}`, "1");
  await submitAndExpectError(page, /กรอกผู้จำหน่าย/);
  await expect(purchase.getByLabel(`ผู้จำหน่าย ${MATERIALS[0]}`)).toHaveValue(
    "",
  );

  // BUG-2: all seven lines save in one request and land in Owner stock.
  await field(page, `ผู้จำหน่าย ${MATERIALS[0]}`, "ร้านวัสดุ QA");
  for (const material of MATERIALS.slice(1)) {
    await purchase.getByLabel(`ซื้อ ${material}`).check();
    await field(page, `จำนวนซื้อ ${material}`, "500");
    await field(page, `ราคาซื้อ ${material}`, "1");
    await field(page, `ผู้จำหน่าย ${material}`, "ร้านวัสดุ QA");
  }
  await button(page, "บันทึกการซื้อ 7 รายการ");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page
      .getByRole("row")
      .filter({ hasText: MATERIALS[0] })
      .filter({ hasText: "คลัง Owner" })
      .first(),
  ).toContainText("500");

  // BUG-2 chain: with stock in the warehouse the transfer to a branch goes through.
  await button(page, "ส่งวัสดุไปสาขา");
  const transfer = openDialog(page);
  await transfer.getByLabel(`ส่ง ${MATERIALS[0]} ไปศาลาแดง`).check();
  await field(page, `จำนวน ${MATERIALS[0]} ไปศาลาแดง`, "100");
  await field(page, "ผู้รับของสาขาศาลาแดง", "ผู้ดูแลศาลาแดง");
  await button(page, "บันทึกส่งวัสดุ");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // The branch confirms the receipt, and the daily count opens up to the 100 received.
  await signInAs(page, ACCOUNTS.saladaeng);
  await pointAndClick(page, menuItem(page, "กรอกรายวัน"));
  await field(page, `จำนวนที่รับจริง ${MATERIALS[0]}`, "100");
  await field(page, "ชื่อผู้รับจริง", "ผู้ดูแลศาลาแดง");
  await button(page, "ยืนยันรับ");
  await expect(page.getByText(`ยืนยันรับ ${MATERIALS[0]} แล้ว`)).toBeVisible();

  const daily = tableSection(page, "วัสดุ 7 รายการ · กรอกการใช้วันนี้");
  await expect(
    daily.getByLabel(`จำนวนใช้ ${MATERIALS[0]} วันนี้`),
  ).toHaveAttribute("max", "100");
  const boxRow = daily.getByRole("row").filter({ hasText: MATERIALS[0] });
  await expect(boxRow).not.toContainText("Owner ยังไม่ตั้งฐาน");
  await expect(boxRow).toContainText("รอบันทึก");
  // BUG-9: a par level is set, so a material still in the warehouse waits for Owner, it is not "unset".
  await expect(
    daily.getByRole("row").filter({ hasText: MATERIALS[1] }),
  ).toContainText("รอ Owner ส่งวัสดุมาสาขา");
});

test("BUG-10f: the report total names the ETC purchases as already included", async ({
  page,
}) => {
  skipUnlessCredentials(ACCOUNTS.owner);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "รายงาน");
  await expect(page.getByText("ต้นทุนรวมทั้งหมด")).toBeVisible();
  await expect(page.getByText("↳ ซื้อวัตถุดิบ / ETC")).toBeVisible();
});

test("BUG-10a / BUG-5 / BUG-3 / BUG-10b: dialogs reject bad input out loud along the loop", async ({
  page,
}) => {
  skipUnlessCredentials(
    ACCOUNTS.owner,
    ACCOUNTS.foodiva,
    ACCOUNTS.chef,
    ACCOUNTS.saladaeng,
  );
  test.setTimeout(20 * 60_000);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const poId = await ownerCreatesMeatPo(page, "500");
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaIssuesInvoice(page, "500", { poId });

  await signInAs(page, ACCOUNTS.owner);
  await button(page, /ใบ Invoice/);
  // BUG-5: the Foodiva invoice Foodiva uploaded comes back as a real download.
  const downloadPromise = page.waitForEvent("download");
  await pointAndClick(
    page,
    tableSection(page, "Invoice Foodiva").getByRole("button", {
      name: "ดาวน์โหลด",
    }),
  );
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const shipment = await ownerCreatesShipmentRequest(page, [
    { poId, kg: "500" },
  ]);

  // BUG-10a: origin = destination is rejected with a message instead of saving.
  // Foodiva makes the outbound transport document now, so the check moved to its form.
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaOpensManifest(page, shipment);
  await foodivaFillsPackingList(page, ["500"], { attachment: INVOICE_FIXTURE });
  const origin = openDialog(page).getByRole("combobox", {
    name: "ต้นทาง",
    exact: true,
  });
  await origin.selectOption({ label: "เชียงใหม่" });
  await expect(
    openDialog(page).getByRole("combobox", { name: "ปลายทาง", exact: true }),
  ).toHaveValue("เชียงใหม่");
  await submitAndExpectError(page, /ต้นทางและปลายทางต้องต่างกัน/);
  await origin.selectOption({ label: "กรุงเทพฯ" });
  await saveEntry(page);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Owner: smoke PO from the Packing List. Chef House: 500 kg in, one 500 kg
  // กล่องรมควัน out, lot closed.
  await signInAs(page, ACCOUNTS.owner);
  await ownerIssuesSmokePo(page, "", shipment);
  await chefSmokesShipment(page, shipment, {
    received: ["500"],
    preSmokeKg: "500",
    packs: ["500"],
  });

  // Return trip, Foodiva intake, central stock, then allocate by kg: all 500 kg to Saladaeng.
  await signInAs(page, ACCOUNTS.owner);
  await ownerCallsReturnTruck(page, shipment);
  await signInAs(page, ACCOUNTS.foodiva);
  await foodivaReceivesReturn(page, shipment, { kg: "500" });
  await signInAs(page, ACCOUNTS.owner);
  await ownerReceivesCentral(page, "500");
  await button(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
  await pointAndClick(
    page,
    page.getByRole("main").getByRole("button", { name: "จัดสรร", exact: true }),
  );
  // BUG-3 pattern: a form with nothing typed is refused out loud, not silently.
  await field(page, "ศาลาแดง (กก.)", "0");
  await submitAndExpectError(page, /กรอกน้ำหนักจัดสรรอย่างน้อย 1 สาขา/);
  await field(page, "ศาลาแดง (กก.)", "500.5");
  await a_expectOverStock(
    page,
    "น้ำหนักรวม 500.50 กก. เกินสต๊อกกลาง · กรอกได้สูงสุด 500.00 กก.",
  );
  await field(page, "ศาลาแดง (กก.)", "500");
  await button(page, "บันทึกการจัดสรร");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Saladaeng receives the 500 kg (kg only, no bag count) and thaws 0.5 kg.
  await signInAs(page, ACCOUNTS.saladaeng);
  await button(page, "รับของ");
  await expect(openDialog(page).getByLabel(/จำนวนถุงที่รับ/)).toHaveCount(0);
  await page.getByLabel("ใบจัดสรรที่รับ").selectOption({ index: 1 });
  await field(page, /น้ำหนักรับเข้าสาขา/, "500");
  await saveEntry(page);
  await button(page, "แบ่งละลาย");
  await field(page, /น้ำหนักละลาย/, "0.5");
  await field(page, /จำนวนกล่องรมควันที่ละลาย/, "1");
  await saveEntry(page);

  // BUG-3: the sales form now says why it refuses to save.
  await button(page, "บันทึกยอดขาย");
  await field(page, /น้ำหนักเวสต์/, "0.05");
  await submitAndExpectError(page, /เหตุผล Waste/);
  await field(page, /น้ำหนักเวสต์/, "0");
  await field(page, /กล่องมาตรฐาน/, "6");
  await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "0.6");
  await a_expectOverStock(
    page,
    "น้ำหนักที่ใช้และเวสต์เกินเนื้อที่ละลายแล้ว (รวมชิลยกมา) · ใช้จริงรวมเวสต์ได้สูงสุด 0.50 กก.",
  );
  // A valid sale: nothing sold, the thawed 0.5 kg written off with a reason.
  await field(page, /กล่องมาตรฐาน/, "0");
  await field(page, /น้ำหนักที่ใช้ไปจริงวันนี้/, "0");
  await field(page, /น้ำหนักเวสต์/, "0.5");
  await field(page, /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/, "QA TEST waste");
  await saveEntry(page);

  // BUG-3: a giveaway refuses over-stock out loud too. It is entered inside
  // ตรวจและปิดวัน now, and the message names the block that was refused.
  await button(page, "ตรวจและปิดวัน");
  await pointAndClick(
    page,
    openDialog(page).getByRole("button", { name: /เพิ่มอินฟลูเอนเซอร์/ }),
  );
  await field(page, /ชื่ออินฟลูเอนเซอร์/, "QA Influencer");
  await field(page, /กล่องมาตรฐานที่ส่ง/, "6");
  await a_expectOverStock(
    page,
    /อินฟลูเอนเซอร์ที่ 1 \(QA Influencer\) · น้ำหนักที่ส่งเกินเนื้อที่ละลายแล้ว/,
  );
  await cancelDialog(page);

  // BUG-10b (the close-day hint quoting the wrong close time) is gone with the time rule
  // itself (B3): the one "ตรวจและปิดวัน" dialog has no time picker and no time text, it
  // lists what is still missing and keeps the confirm button disabled until it is done.
  await button(page, "ตรวจและปิดวัน");
  const closeDay = openDialog(page);
  await expect(closeDay.getByLabel(/เวลาจำลองสำหรับทดสอบปิดวัน/)).toHaveCount(
    0,
  );
  await expect(closeDay).not.toContainText("ปิดวันได้ตั้งแต่");
  const checklist = tableSection(page, "ตรวจก่อนปิดวัน");
  await expect(
    checklist.getByRole("row").filter({ hasText: "ยอดขายวันนี้" }),
  ).toContainText("✓");
  await expect(
    checklist.getByRole("row").filter({ hasText: "เช็ควัสดุ" }),
  ).toContainText("ยังไม่ทำ");
  await expect(
    checklist
      .getByRole("row")
      .filter({ hasText: "ยืนยันข้าวเหนียวสุกคงเหลือ" }),
  ).toContainText("ยังไม่ทำ");
  await expect(closeDay).toContainText(
    "ยังปิดวันไม่ได้ · ขาด เช็ควัสดุ, ยืนยันข้าวเหนียวสุกคงเหลือ",
  );
  await expect(closeDay.locator('button[type="submit"]')).toBeDisabled();
  // Materials are filled on the day screen itself, so "ไปกรอกในหน้ารายวัน" just closes.
  await pointAndClick(
    page,
    checklist.getByRole("button", { name: "ไปกรอกในหน้ารายวัน" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
