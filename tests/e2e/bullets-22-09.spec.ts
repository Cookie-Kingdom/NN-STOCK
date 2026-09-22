import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  chefSmokesShipment,
  field,
  foodivaReceivesReturn,
  openMenu,
  ownerCallsReturnTruck,
  ownerReceivesCentral,
  pointAndClick,
  saveEntry,
  sendMeatToChefHouse,
  signInAs,
  startFresh,
  step,
  typeValue,
} from "./helpers";

/* Bullets 22-09 — vault: Features/Bullets 22-09/Checklist.md, sections C1–C3.
 * C1 over-stock refuses as you type (red alert + save disabled), C2 wording on the
 * thaw/receive forms, C3 "ตรวจสอบก่อนบันทึก" on the rice issue form. */

/** The live error line in the dialog footer (DialogFooter's role="alert"). */
const alert = (page: Page) =>
  page.getByRole("dialog").locator("footer").getByRole("alert");
const submit = (page: Page) =>
  page.getByRole("dialog").locator('button[type="submit"]').last();

/** Branch day screen: "กรอกข้อมูล" on the task row titled `title`. */
async function openTask(page: Page, title: string) {
  await openMenu(page, "กรอกรายวัน");
  await pointAndClick(
    page,
    page
      .locator("main")
      .getByRole("row")
      .filter({ hasText: title })
      .getByRole("button", { name: "กรอกข้อมูล" }),
  );
}

test("C1 + C2: จัดสรรเกินคลังกลาง · รับของ (ส่งมา/รับแล้ว/ค้างรับ) · ละลายเกินแช่แข็ง", async ({
  page,
}) => {
  await startFresh(page);
  let shipment = "";
  let lotId = "";

  await step(
    page,
    "Owner: PO → Request → ใบขนส่ง → PO รมควัน 100 กก.",
    async () => {
      ({ shipment } = await sendMeatToChefHouse(page, { orderedKg: "100" }));
    },
  );

  await step(
    page,
    "Chef House: รับเนื้อ → สโมค 2 กล่อง → ปิด Lot",
    async () => {
      await chefSmokesShipment(page, shipment, {
        received: ["100"],
        preSmokeKg: "100",
        packs: ["50", "50"],
      });
    },
  );

  await step(
    page,
    "Owner + Foodiva: ขากลับ → เข้าตู้ → สต๊อกกลาง 100 กก.",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await ownerCallsReturnTruck(page, shipment);
      await signInAs(page, ACCOUNTS.foodiva);
      await foodivaReceivesReturn(page, shipment, { kg: "100" });
      await signInAs(page, ACCOUNTS.owner);
      await ownerReceivesCentral(page, "100");
    },
  );

  await step(
    page,
    "Owner: C1 จัดสรรเกินคลังกลาง → error ทันที + ปุ่มปิด",
    async () => {
      await openMenu(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
      // The lot has its own number (S…), not the shipment's SH-…; there is one here.
      const row = page
        .locator("main")
        .getByRole("row")
        .filter({
          has: page.getByRole("button", { name: "จัดสรร", exact: true }),
        })
        .first();
      lotId = (await row.getByRole("cell").first().innerText()).trim();
      await pointAndClick(
        page,
        row.getByRole("button", { name: "จัดสรร", exact: true }),
      );
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("จัดสรรเนื้อไปสาขา (กก.)");
      await expect(alert(page)).toHaveCount(0);
      await typeValue(page, dialog.getByLabel("ศาลาแดง (กก.)"), "101");
      await expect(alert(page)).toBeVisible();
      await expect(submit(page)).toBeDisabled();
      // Feedback 13: the live error states the maximum that may be typed.
      await expect(alert(page)).toContainText("กรอกได้สูงสุด 100.00 กก.");
      await typeValue(page, dialog.getByLabel("ศาลาแดง (กก.)"), "60");
      await expect(alert(page)).toHaveCount(0);
      await expect(submit(page)).toBeEnabled();
      await saveEntry(page);
      await expect(
        page.getByText("จัดสรรไปสาขาแล้ว · ศาลาแดง 60.00 กก."),
      ).toBeVisible();
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: C2 รับของ แสดง ส่งมา · รับแล้ว · ค้างรับ · C1 รับเกิน",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await openMenu(page, "กรอกรายวัน");
      await button(page, "รับของ");
      const dialog = page.getByRole("dialog");
      const lot = dialog.getByLabel("Lot ต้นทาง");
      await expect(lot.locator("option:checked")).toHaveText(
        `${lotId} · ส่งมา 60.00 กก. · รับแล้ว 0.00 กก. · ค้างรับ 60.00 กก.`,
      );
      await expect(lot).not.toContainText("แช่แข็ง");
      await dialog.getByLabel("ใบจัดสรรที่รับ").selectOption({ index: 1 });
      await expect(alert(page)).toHaveCount(0);

      await field(page, /น้ำหนักรับเข้าสาขา/, "61");
      await expect(alert(page)).toContainText(
        "รับเกินยอดค้างรับ · กรอกได้สูงสุด 60.00 กก.",
      );
      await expect(submit(page)).toBeDisabled();

      // Partial receive: 40 of 60, the allocation stays open.
      await field(page, /น้ำหนักรับเข้าสาขา/, "40");
      await dialog.getByLabel("รับครบใบจัดสรรนี้แล้ว").uncheck();
      await expect(alert(page)).toHaveCount(0);
      await expect(submit(page)).toBeEnabled();
      await saveEntry(page);

      await button(page, "รับของ");
      await expect(
        page
          .getByRole("dialog")
          .getByLabel("Lot ต้นทาง")
          .locator("option:checked"),
      ).toHaveText(
        `${lotId} · ส่งมา 60.00 กก. · รับแล้ว 40.00 กก. · ค้างรับ 20.00 กก.`,
      );
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: C1 + C2 ละลายเกินแช่แข็ง → error ทันที + ปุ่มปิด",
    async () => {
      await button(page, "แบ่งละลาย");
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByLabel("Lot ต้นทาง").locator("option:checked"),
      ).toHaveText(`${lotId} · แช่แข็ง 40.00 กก. / ละลายแล้ว 0.00 กก.`);
      const bags = dialog.getByLabel("จำนวนกล่องรมควันที่ละลาย");
      await expect(bags).toBeVisible();
      await expect(dialog).not.toContainText("ถุง");
      await expect(alert(page)).toHaveCount(0);

      // Over stock before the box count is typed: refused already.
      await field(page, /น้ำหนักละลาย/, "41");
      await expect(alert(page)).toContainText(
        "สต๊อกแช่แข็งไม่พอ · กรอกได้สูงสุด 40.00 กก.",
      );
      await expect(submit(page)).toBeDisabled();

      await field(page, /น้ำหนักละลาย/, "25");
      await expect(alert(page)).toHaveCount(0);
      await typeValue(page, bags, "1.5");
      await expect(alert(page)).toContainText(
        "จำนวนกล่องรมควันต้องเป็นจำนวนเต็ม",
      );
      await typeValue(page, bags, "1");
      await expect(alert(page)).toHaveCount(0);
      await expect(submit(page)).toBeEnabled();
      await saveEntry(page);

      await button(page, "แบ่งละลาย");
      await expect(
        page
          .getByRole("dialog")
          .getByLabel("Lot ต้นทาง")
          .locator("option:checked"),
      ).toHaveText(`${lotId} · แช่แข็ง 15.00 กก. / ละลายแล้ว 25.00 กก.`);
    },
  );
});

test("C1 + C3: เบิกข้าวเหนียวดิบ · ตรวจสอบก่อนบันทึก · เบิกเกินสต๊อกปุ่มปิด", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.saladaeng);

  await step(page, "สาขาศาลาแดง: ซื้อข้าวเหนียวดิบ 10 กก.", async () => {
    await openTask(page, "ซื้อข้าวเหนียวเข้าสต๊อก");
    await page
      .getByRole("dialog")
      .getByLabel(/รอบนี้ข้าวเหนียวมาจาก/)
      .selectOption("นึ่งเอง (ซื้อข้าวดิบ)");
    await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าวทดสอบ");
    await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "10");
    await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "300");
    await saveEntry(page);
  });

  await step(
    page,
    "สาขาศาลาแดง: C3 ตรวจสอบก่อนบันทึก + C1 เบิกเกิน",
    async () => {
      await openTask(page, "เบิกข้าวเหนียวดิบวันนี้");
      const review = page
        .getByRole("dialog")
        .getByRole("region", { name: "ตรวจสอบก่อนบันทึก" });
      await expect(alert(page)).toHaveCount(0);

      // Over stock before the receiver is typed: refused already, "after" goes red.
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "12");
      await expect(alert(page)).toContainText(
        "ข้าวเหนียวดิบในสต๊อกไม่พอ · กรอกได้สูงสุด 10.00 กก.",
      );
      await expect(submit(page)).toBeDisabled();
      await expect(review).toContainText(/คงเหลือตอนนี้\s*10\.00 กก\./);
      await expect(review.locator(".text-danger")).toHaveText(
        /^[-−]2\.00 กก\.$/,
      );

      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "3");
      await field(page, /ผู้รับของ/, "ผู้ดูแลศาลาแดง");
      await expect(alert(page)).toHaveCount(0);
      await expect(review).toContainText(/ข้าวเหนียวดิบที่เบิก\s*3\.00 กก\./);
      await expect(review).toContainText(/คงเหลือตอนนี้\s*10\.00 กก\./);
      await expect(review).toContainText(/คงเหลือหลังรายการนี้\s*7\.00 กก\./);
      await expect(review).toContainText(/ผู้รับของ\s*ผู้ดูแลศาลาแดง/);
      await expect(submit(page)).toBeEnabled();
      await saveEntry(page);

      // The saved stock is the "after" figure.
      await openTask(page, "เบิกข้าวเหนียวดิบวันนี้");
      await expect(
        page
          .getByRole("dialog")
          .getByRole("region", { name: "ตรวจสอบก่อนบันทึก" }),
      ).toContainText(/คงเหลือตอนนี้\s*7\.00 กก\./);
    },
  );
});
