import { statSync } from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  a_expectRefused,
  ACCOUNTS,
  c_historyEntry,
  chefAcceptsSmokePo,
  chefFillsYellowCells,
  chefLotButton,
  chefRecordsPreSmoke,
  chefSubmitsInvoice,
  expectNoPurchaseData,
  field,
  foodivaFillsPackingList,
  foodivaIssuesInvoice,
  foodivaMakesManifest,
  foodivaOpensManifest,
  foodivaReceivesReturn,
  INVOICE_FIXTURE,
  openMenu,
  OUTBOUND_MENU,
  ownerApprovesSmokingInvoice,
  ownerCallsReturnTruck,
  ownerCreatesMeatPo,
  ownerCreatesShipmentRequest,
  ownerIssuesSmokePo,
  ownerPaysMeatInvoice,
  ownerPaysSmokingInvoice,
  ownerReceivesCentral,
  pointAndClick,
  saveEntry,
  signInAs,
  slicedLostCard,
  slipImage,
  slipPdf,
  startFresh,
  step,
  tableRow,
  tableSection,
  topDialog,
  typeValue,
} from "./helpers";

/* Feedback 20-09-2026 (vault: Feedback/20-09-2026 รวมฉบับสมบูรณ์.md), items 1, 2, 3, 4 /
 * 4.1 and 12, as settled in plan-20-09-2026 and the customer answers A1–A10
 * (Features/Shipment Flow/Design.md §6). Only what no other spec asserts yet:
 * shipment-flow.spec.ts, full-system/procurement.spec.ts and production.spec.ts carry
 * the rest. Both tests start from the empty seed. */
test.skip(
  process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
  "starts from the empty seed, which only pnpm test:e2e:local can reset",
);

/** "ถุง" as the unit of smoked meat (ข้อ 4.1). Material names stay: ถุงซีล, ถุงหิ้ว. */
const BAG_UNIT = /ถุง(?!ซีล|หิ้ว)/;

/** FoodivaDispatchForm's default: the next half-hour slot after now, Bangkok time
 * (mirrors nextTimeSlot in src/lib/forms.ts). */
function nextHalfHour(now = new Date()) {
  const [hour, minute] = now
    .toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hourCycle: "h23" })
    .split(":")
    .map(Number);
  const slot = (hour * 2 + (minute < 30 ? 1 : 2)) % 48;
  return `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`;
}

/** ข้อ 2 acceptance: a paid row's slip opens (its name) and downloads (the button
 * beside it) under its own file name. */
async function expectSlipOpens(page: Page, row: Locator, name: string) {
  const popup = page.waitForEvent("popup");
  await pointAndClick(page, row.getByRole("button", { name, exact: true }));
  await (await popup).close();
}
async function expectSlipDownloads(page: Page, row: Locator, name: string) {
  const slip = row.getByRole("button", { name, exact: true });
  const waiting = page.waitForEvent("download");
  // SlipList: <span>[view button's wrapper][download button's wrapper]</span>
  await pointAndClick(
    page,
    slip.locator("xpath=../..").getByRole("button", { name: "ดาวน์โหลด" }),
  );
  const download = await waiting;
  expect(download.suggestedFilename()).toBe(name);
  const file = await download.path();
  expect(file && statSync(file).size).toBeGreaterThan(0);
}

test("ข้อ 3 + 12 + 1 + 2: หลาย PO ซื้อ (บางส่วน) → 1 PO รมควัน คงเหลือราย PO · เวลารถรับเริ่มที่เวลาถัดไป / นาทีใดก็ได้ / ปุ่มใช้ล่าสุด · Foodiva แก้ Packing List ได้จนออก PO รมควัน · สลิปค่าเนื้อเปิดและดาวน์โหลดได้", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  await startFresh(page);
  const pos: string[] = [];
  let first = "";

  await step(page, "Owner: สร้าง PO ซื้อ 300 / 700 / 500 กก.", async () => {
    await signInAs(page, ACCOUNTS.owner);
    for (const kg of ["300", "700", "500"])
      pos.push(await ownerCreatesMeatPo(page, kg));
  });

  await step(page, "Foodiva: ออก Invoice เนื้อทั้ง 3 ใบ", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    for (const [index, poId] of pos.entries())
      await foodivaIssuesInvoice(page, ["300", "700", "500"][index], { poId });
  });

  await step(
    page,
    "Owner: ข้อ 3 Request เดียวดึง PO A ทั้งหมด 300 · PO B บางส่วน 400 · PO C บางส่วน 200 → คงเหลือ 0 / 300 / 300",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      first = await ownerCreatesShipmentRequest(page, [
        { poId: pos[0], kg: "300" },
        { poId: pos[1], kg: "400" },
        { poId: pos[2], kg: "200" },
      ]);
      await openMenu(page, "ใบสั่งซื้อ PO");
      for (const [index, left] of ["0.00", "300.00", "300.00"].entries())
        await expect(
          tableRow(page, "รายการใบสั่งซื้อ PO", pos[index])
            .getByRole("cell")
            .nth(7),
        ).toHaveText(`${left} กก.`);
    },
  );

  await step(
    page,
    "Foodiva: ข้อ 12 เวลารถรับตั้งต้นเป็นครึ่งชั่วโมงถัดไป (ไม่ต้องพิมพ์) · เลือก 08:15 ได้ · ข้อ 1 Packing List อยู่ในฟอร์มใบขนส่ง",
    async () => {
      await signInAs(page, ACCOUNTS.foodiva);
      const before = nextHalfHour();
      await foodivaOpensManifest(page, first);
      const after = nextHalfHour();
      const dialog = page.getByRole("dialog");
      const time = dialog.getByLabel("เวลารถรับ");
      await expect(time).toHaveAttribute("type", "time");
      expect([before, after]).toContain(await time.inputValue());
      // No trip saved yet, so no "last used" shortcuts.
      await expect(dialog).not.toContainText("ใช้ล่าสุด");
      await time.fill("08:15");
      await expect(time).toHaveValue("08:15");

      await foodivaFillsPackingList(page, ["300", "400", "195"], {
        attachment: INVOICE_FIXTURE,
      });
      await pointAndClick(
        page,
        page.getByRole("button", { name: "บันทึกใบขนส่ง", exact: true }),
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(
        page.getByText(
          "บันทึกใบขนส่งและ Packing List แล้ว · แจ้ง Owner ออก PO รมควัน",
        ),
      ).toBeVisible();

      await openMenu(page, "ประวัติ");
      const dispatch = c_historyEntry(page, "ทำใบขนส่งขาไป");
      await pointAndClick(page, dispatch.locator("summary"));
      await expect(dispatch).toContainText(/เวลารถรับ\s*08:15/);
    },
  );

  await step(
    page,
    "Foodiva: ข้อ 1 แก้ Packing List หลังบันทึกใบขนส่ง (กล่องรับเข้าที่ 3: 195 → 198 · Sliced Weight Net 898) ก่อน Owner ออก PO รมควัน",
    async () => {
      await openMenu(page, "PO และสต๊อก Foodiva");
      const row = tableRow(page, "Request เข้า", first);
      await expect(row).toContainText("ทำใบขนส่งแล้ว · รอ PO รมควัน");
      await pointAndClick(
        page,
        row.getByRole("button", { name: "แก้ไข Packing List" }),
      );
      const list = topDialog(page);
      await expect(list).toContainText("แก้ไข Packing List");
      await typeValue(
        page,
        list.getByLabel("น้ำหนักตาม Packing List กล่องรับเข้าที่ 3", {
          exact: true,
        }),
        "198",
      );
      /* Sliced Weight Net is typed, so a box weight alone no longer moves it — the
       * form says so, and Foodiva retypes it. */
      await expect(list).toContainText(
        "ยอดรวมกล่องรับเข้า 898.00 กก. ไม่เท่ากับ Sliced Weight Net 895.00 กก.",
      );
      await typeValue(page, list.getByLabel(/Sliced Weight Net/), "898");
      await saveEntry(page);
      await expect(page.getByText("บันทึก Packing List แล้ว")).toBeVisible();
    },
  );

  await step(
    page,
    "Owner: ข้อ 3 PO รมควัน 1 ใบจาก 3 PO ซื้อ แสดงยอดที่ดึงและคงเหลือราย PO · ยอดตาม Packing List ที่แก้แล้ว 898",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, "ใบสั่ง PO โรงรมควัน");
      const row = tableRow(page, "รายการ PO โรงรมควัน", first);
      for (const [index, [drawn, left]] of [
        ["300.00", "0.00"],
        ["400.00", "300.00"],
        ["200.00", "300.00"],
      ].entries())
        await expect(row).toContainText(
          new RegExp(
            `${pos[index]} × ${drawn.replace(".", "\\.")} กก\\.\\s*คงเหลือ ${left.replace(".", "\\.")} กก\\.`,
          ),
        );
      await expect(row).toContainText("3 กล่องรับเข้า · 898.00 กก.");

      await pointAndClick(
        page,
        row.getByRole("button", { name: "ออก PO รมควันเนื้อ" }),
      );
      await expect(
        page.getByRole("dialog").getByLabel(/น้ำหนัก PO รมควัน/),
      ).toHaveValue("898");
      await field(page, /คำสั่งพิเศษ/, "รมตามมาตรฐาน NerdNuea");
      await saveEntry(page);
      await expect(row).toContainText("898.00 กก.");
    },
  );

  await step(
    page,
    "Foodiva: ข้อ 1 ออก PO รมควันแล้ว → Request นี้หายจาก Request เข้า แก้ Packing List ไม่ได้อีก",
    async () => {
      await signInAs(page, ACCOUNTS.foodiva);
      await expect(tableSection(page, /^Request เข้า$/)).not.toContainText(
        first,
      );
    },
  );

  await step(
    page,
    "Owner + Foodiva: ข้อ 12 Request ที่ 2 (PO B ที่เหลือ 300) → ปุ่มลัด 08:15 น. กดครั้งเดียวได้เวลา",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      const second = await ownerCreatesShipmentRequest(page, [
        { poId: pos[1], kg: "300" },
      ]);
      await signInAs(page, ACCOUNTS.foodiva);
      await foodivaOpensManifest(page, second);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText("ใช้ล่าสุด");
      const shortcut = dialog.getByRole("button", { name: "08:15 น." });
      await pointAndClick(page, shortcut);
      await expect(dialog.getByLabel("เวลารถรับ")).toHaveValue("08:15");
      await expect(shortcut).toHaveAttribute("aria-pressed", "true");
      await pointAndClick(
        page,
        dialog.getByRole("button", { name: "ยกเลิก", exact: true }),
      );
      await expect(dialog).toHaveCount(0);
    },
  );

  await step(
    page,
    "Owner: ข้อ 2 ชำระ Invoice เนื้อ PO A พร้อมสลิป 2 ไฟล์ → เปิดดูและดาวน์โหลดได้ · โหลดหน้าใหม่แล้วยังดาวน์โหลดได้",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await ownerPaysMeatInvoice(page, pos[0], [slipPdf(), slipImage()]);
      const paid = tableRow(page, "Invoice Foodiva", pos[0]);
      await expect(paid).toContainText("ชำระแล้ว");
      await expectSlipOpens(page, paid, "slip-photo.png");
      await expectSlipDownloads(page, paid, "slip-transfer.pdf");

      await page.reload();
      await openMenu(page, "ใบ Invoice");
      await expectSlipDownloads(
        page,
        tableRow(page, "Invoice Foodiva", pos[0]),
        "slip-photo.png",
      );
    },
  );
});

test("ข้อ 1 + 4.1 + 4 + 2: Owner/Chef House เห็นตาราง Packing List 3 ชั้น · Chef กรอกได้แค่ช่องเหลือง · กล่องรมควันต้องกรอกกิโล · ผลผลิตรวมเป็นยอดตั้งต้นจัดสรรเป็นกิโล · ไม่มีคำว่าถุง · สลิปค่ารมดาวน์โหลดได้", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  await startFresh(page);
  let poId = "";
  let shipment = "";

  await step(
    page,
    "Owner → Foodiva → Owner: PO 100 · Invoice · Request 60 · ใบขนส่ง + Packing List 30 + 30 (Inv. Weight 60 ตาม Request · Net 60 · Lost 0 คำนวณให้)",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      poId = await ownerCreatesMeatPo(page, "100");
      await signInAs(page, ACCOUNTS.foodiva);
      await foodivaIssuesInvoice(page, "100", { poId });
      await signInAs(page, ACCOUNTS.owner);
      shipment = await ownerCreatesShipmentRequest(page, [{ poId, kg: "60" }]);
      await signInAs(page, ACCOUNTS.foodiva);
      // Inv. Weight is the Request's 60 kg, read-only; Sliced Weight Net is typed and
      // defaults to the box total, so this list loses nothing.
      await foodivaMakesManifest(page, shipment, ["30", "30"]);
    },
  );

  await step(
    page,
    "Owner: ข้อ 1 เปิด Packing List ในระบบ: Inv. Weight → Sliced Net → Lost · รายกล่องรับเข้า · ไฟล์ที่ Foodiva แนบเปิดได้ → ออก PO รมควัน",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, "ใบสั่ง PO โรงรมควัน");
      await pointAndClick(
        page,
        tableRow(page, "รายการ PO โรงรมควัน", shipment).getByRole("button", {
          name: "ดู Packing List",
        }),
      );
      const list = page.getByRole("dialog");
      await expect(list).toContainText(/Inv\. Weight\s*60\.00 กก\./);
      await expect(list).toContainText(/Sliced Weight Net\s*60\.00 กก\./);
      // Computed, not typed: Inv. Weight 60 − Sliced Weight Net 60.
      await expect(list).toContainText(slicedLostCard("60", "60"));
      await expect(list).toContainText("รวม 2 กล่องรับเข้า");
      const popup = page.waitForEvent("popup");
      await pointAndClick(
        page,
        list.getByRole("button", {
          name: "ไฟล์ที่ Foodiva แนบ · invoice-demo.pdf",
        }),
      );
      await (await popup).close();
      await page.keyboard.press("Escape");
      await expect(list).toHaveCount(0);
      await ownerIssuesSmokePo(page, "", shipment);
    },
  );

  await step(
    page,
    "Chef House: ข้อ 1 ยืนยันรับเนื้อ — เห็น Packing List ทั้งใบ ช่องของ Foodiva แก้ไม่ได้ กรอกช่องเหลือง 30 + 29.5 ไม่ต้องตรง",
    async () => {
      await signInAs(page, ACCOUNTS.chef);
      await chefAcceptsSmokePo(page);
      await chefFillsYellowCells(page, shipment, []);
      const dialog = page.getByRole("dialog");
      await expect(dialog).toContainText(/Inv\. Weight\s*60\.00 กก\./);
      await expect(dialog).toContainText(slicedLostCard("60", "60"));
      await expect(
        dialog.getByLabel(/^น้ำหนักตาม Packing List กล่องรับเข้าที่/),
      ).toHaveCount(0);
      await expect(
        dialog.getByLabel(/^น้ำหนักจริงกล่องรับเข้าที่/),
      ).toHaveCount(2);
      await expectNoPurchaseData(page);
      for (const [index, kg] of ["30", "29.5"].entries())
        await typeValue(
          page,
          dialog.getByLabel(`น้ำหนักจริงกล่องรับเข้าที่ ${index + 1}`, {
            exact: true,
          }),
          kg,
        );
      await expect(dialog).toContainText(/รับจริงที่ Chef House\s*59\.50 กก\./);
      await saveEntry(page);
    },
  );

  await step(
    page,
    "Chef House: ข้อ 4.1 สโมค — ไม่กรอกกิโลกล่องรมควันถูกปฏิเสธ · กล่องรมควัน 29 + 29 · ปิด Lot สรุป 2 กล่องรมควัน · 58 กก. · ไม่มีคำว่าถุง",
    async () => {
      await chefRecordsPreSmoke(page, "59");
      await openMenu(page, "งานผลิต");
      await pointAndClick(page, chefLotButton(page, "บันทึก Lot สโมครายวัน"));
      const smoke = topDialog(page);
      await field(page, /น้ำหนักเข้าเตารอบนี้/, "59");
      await field(page, /น้ำหนัก Waste/, "1");
      await expect(smoke.getByLabel("กล่องรมควันที่ 1 กี่กิโล")).toHaveValue(
        "",
      );
      await a_expectRefused(
        page,
        "กรอกน้ำหนักกล่องรมควันทุกกล่องรมควัน ต้องมากกว่า 0 กก.",
      );
      await typeValue(page, smoke.getByLabel("กล่องรมควันที่ 1 กี่กิโล"), "29");
      await pointAndClick(
        page,
        smoke.getByRole("button", { name: "เพิ่มกล่องรมควัน" }),
      );
      await typeValue(page, smoke.getByLabel("กล่องรมควันที่ 2 กี่กิโล"), "29");
      await expect(smoke).toContainText(
        "ส่งกลับกรุงเทพฯ 2 กล่องรมควัน · น้ำหนักรวม 58.00 กก.",
      );
      await expect(smoke).not.toContainText(BAG_UNIT);
      await saveEntry(page);

      await pointAndClick(page, chefLotButton(page, "ยืนยันปิด Lot"));
      const close = topDialog(page);
      await expect(close).toContainText("รวม 2 กล่องรมควัน · 58.00 กก.");
      await expect(close).not.toContainText(BAG_UNIT);
      await field(page, /ชื่อผู้ยืนยันปิด Lot/, "หัวหน้าผลิต Chef House");
      await saveEntry(page);
      await expect(page.locator("main")).toContainText("2 กล่องรมควัน");
      await expect(page.locator("main")).not.toContainText(BAG_UNIT);
      await chefSubmitsInvoice(page, "CH-INV-2009");
    },
  );

  await step(
    page,
    "Owner → Foodiva: ข้อ 4.1 ขากลับ 2 กล่องรมควัน · 58 กก. → Foodiva รับเข้าตู้ 58",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, OUTBOUND_MENU);
      await expect(tableRow(page, "รายการส่ง", shipment)).toContainText(
        "เรียกรถขากลับ · 58.00 กก.",
      );
      await ownerCallsReturnTruck(page, shipment);

      await signInAs(page, ACCOUNTS.foodiva);
      const row = tableRow(
        page,
        "เนื้อรมควันขากลับ · รับเข้าตู้ Foodiva",
        shipment,
      );
      await expect(row).toContainText("2 กล่องรมควัน · 58.00 กก.");
      await expect(row).not.toContainText(BAG_UNIT);
      await foodivaReceivesReturn(page, shipment, { kg: "58" });
      await expect(row).toContainText("รับแล้ว · ส่วนต่าง 0.00 กก.");
    },
  );

  await step(
    page,
    "Owner: ข้อ 4 + 4.1 สต๊อกกลาง 58 กก. = ยอดตั้งต้นจัดสรร · จัดสรรเป็นกิโล ศาลาแดง 40 · มีนบุรี 18 ไม่ผูกจำนวนกล่อง → คลังกลาง 0",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, "รับเนื้อเข้าสต๊อกกลาง");
      const waiting = page.locator("main").getByRole("row").filter({
        hasText: "2 กล่องรมควัน",
      });
      await expect(waiting).toContainText("58.00 กก.");
      await expect(waiting).not.toContainText(BAG_UNIT);
      await ownerReceivesCentral(page, "58");

      await openMenu(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
      const lot = tableSection(page, "สต๊อกเนื้อทุกจุด (Meat inventory)")
        .getByRole("row")
        .filter({ hasText: /S\d{6}-\d{3}/ });
      await expect(lot.getByRole("cell").nth(2)).toHaveText("58.00 กก.");
      const allocate = page
        .getByRole("main")
        .getByRole("button", { name: "จัดสรร", exact: true });
      await pointAndClick(page, allocate);
      const allocation = topDialog(page);
      await expect(allocation).toContainText("จัดสรรเนื้อไปสาขา (กก.)");
      await expect(allocation).toContainText(
        /สต๊อกกลางของ Lot นี้\s*58\.00 กก\./,
      );
      // By weight only: no per-box branch picker, no box count to fill.
      await expect(allocation.getByRole("combobox")).toHaveCount(0);
      await expect(allocation).not.toContainText(BAG_UNIT);
      await field(page, "ศาลาแดง (กก.)", "40");
      await field(page, "มีนบุรี (กก.)", "18");
      await saveEntry(page);
      await expect(
        page.getByText(
          "จัดสรรไปสาขาแล้ว · ศาลาแดง 40.00 กก. · มีนบุรี 18.00 กก.",
        ),
      ).toBeVisible();
      await expect(lot.getByRole("cell").nth(2)).toHaveText("0.00 กก.");
    },
  );

  await step(
    page,
    "Owner: ข้อ 2 ตรวจยอดและชำระค่ารมควันพร้อมสลิป 2 ไฟล์ → เปิดดูและดาวน์โหลดได้ · โหลดหน้าใหม่แล้วยังอยู่",
    async () => {
      await ownerApprovesSmokingInvoice(page, shipment);
      await ownerPaysSmokingInvoice(page, shipment, [
        slipPdf("smoke-slip.pdf"),
        slipImage("smoke-slip.png"),
      ]);
      const paid = tableRow(page, "Invoice Chef House", shipment);
      await expect(paid).toContainText("ชำระแล้ว");
      await expectSlipOpens(page, paid, "smoke-slip.png");
      await expectSlipDownloads(page, paid, "smoke-slip.pdf");

      await page.reload();
      await openMenu(page, "ใบ Invoice");
      await expectSlipDownloads(
        page,
        tableRow(page, "Invoice Chef House", shipment),
        "smoke-slip.png",
      );
    },
  );
});
