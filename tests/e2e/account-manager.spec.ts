import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  chefSmokesShipment,
  field,
  foodivaReceivesReturn,
  menuItem,
  openMenu,
  ownerCallsReturnTruck,
  ownerCreatesMeatPo,
  ownerReceivesCentral,
  pointAndClick,
  saveEntry,
  sendMeatToChefHouse,
  signInAs,
  startFresh,
  step,
  typeValue,
} from "./helpers";

/* C4 Account Manager — vault: Features/Bullets 22-09/Checklist.md, section C4.
 * The manager works in /owner as store role "owner" (actor "manager"), with no dashboard
 * and no sales money on screen. */

/** helpers.signInAs only knows the five original accounts; the manager lands on /owner/po.
 * ponytail: local SQLite only (manager@local.test); Supabase needs an L1_MANAGER profile. */
async function signInAsManager(page: Page) {
  test.skip(
    process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
    "manager account exists only in local SQLite mode (pnpm test:e2e:local)",
  );
  const signOut = page.getByRole("button", { name: "ออกจากระบบ" });
  if (await signOut.count()) await pointAndClick(page, signOut);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("อีเมล").fill("manager@local.test");
  await page.getByLabel("รหัสผ่าน").fill("local-test");
  await pointAndClick(
    page,
    page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }),
  );
  await expect(page).toHaveURL(/\/owner\/po(?:[/?#]|$)/, { timeout: 30_000 });
  await expect(signOut).toBeVisible({ timeout: 30_000 });
}

/** One Log entry (a <details>) whose summary mentions `text`. */
const logEntry = (page: Page, text: string | RegExp) =>
  page
    .locator("main details")
    .filter({ has: page.locator("summary", { hasText: text }) });

const SALE = "บันทึกยอดขาย / Waste";
const LINE_MAN = "7391";
const LINE_MAN_NEW = "8264";
/** The amount as raw or formatted ("7391" / "7,391.00"), not inside a longer number. */
const money = (raw: string) =>
  new RegExp(`(?<![\\d,])${raw[0]},?${raw.slice(1)}(?![\\d,])`);

test("C4: manager ไม่มีแดชบอร์ด · สร้าง PO เห็นราคา · Log แยก Account Manager / Owner", async ({
  page,
}) => {
  await startFresh(page);

  await step(
    page,
    "Account Manager: เข้าสู่ระบบ → /owner/po · ไม่มีเมนูแดชบอร์ด · URL แดชบอร์ดเด้งไป PO",
    async () => {
      await signInAsManager(page);
      await expect(menuItem(page, "ใบสั่งซื้อ PO")).toBeVisible();
      await expect(menuItem(page, "แดชบอร์ด")).toHaveCount(0);
      await page.goto("/owner/owner-dashboard");
      await expect(page).toHaveURL(/\/owner\/po(?:[/?#]|$)/, {
        timeout: 30_000,
      });
      await expect(menuItem(page, "แดชบอร์ด")).toHaveCount(0);
    },
  );

  let managerPo = "";
  await step(
    page,
    "Account Manager: สร้าง PO เนื้อ 80 กก. ราคา 257 → Log แสดง Account Manager + ราคา",
    async () => {
      managerPo = await ownerCreatesMeatPo(page, "80", "257");
      await expect(page.locator("main")).toContainText(managerPo);
      await openMenu(page, "Log");
      const entry = page.locator("main details").filter({ hasText: "257" });
      await expect(entry.locator("summary")).toContainText("Account Manager");
      await pointAndClick(page, entry.locator("summary"));
      await expect(entry).toContainText("257");
    },
  );

  await step(
    page,
    "Owner: สร้าง PO → Log แสดง Owner สำหรับของ Owner, Account Manager สำหรับของ manager",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await expect(menuItem(page, "แดชบอร์ด")).toBeVisible();
      await ownerCreatesMeatPo(page, "90", "261");
      await openMenu(page, "Log");
      const byPrice = (price: string) =>
        page
          .locator("main details")
          .filter({ hasText: price })
          .locator("summary");
      await expect(byPrice("261")).toContainText("· Owner");
      await expect(byPrice("261")).not.toContainText("Account Manager");
      await expect(byPrice("257")).toContainText("Account Manager");
    },
  );
});

test("C4: รายงานไม่มียอดขาย · manager อนุมัติคำขอแก้ยอดขายโดยไม่เห็นเงิน", async ({
  page,
}) => {
  await startFresh(page);
  let shipment = "";

  await step(
    page,
    "Owner → Chef House → Foodiva: เนื้อ 100 กก. เข้าสต๊อกกลาง",
    async () => {
      ({ shipment } = await sendMeatToChefHouse(page, { orderedKg: "100" }));
      await chefSmokesShipment(page, shipment, {
        received: ["100"],
        preSmokeKg: "100",
        packs: ["50", "50"],
      });
      await signInAs(page, ACCOUNTS.owner);
      await ownerCallsReturnTruck(page, shipment);
      await signInAs(page, ACCOUNTS.foodiva);
      await foodivaReceivesReturn(page, shipment, { kg: "100" });
      await signInAs(page, ACCOUNTS.owner);
      await ownerReceivesCentral(page, "100");
    },
  );

  await step(page, "Owner: จัดสรรศาลาแดง 60 กก.", async () => {
    await openMenu(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
    await pointAndClick(
      page,
      page
        .locator("main")
        .getByRole("button", { name: "จัดสรร", exact: true })
        .first(),
    );
    await typeValue(
      page,
      page.getByRole("dialog").getByLabel("ศาลาแดง (กก.)"),
      "60",
    );
    await saveEntry(page);
  });

  await step(
    page,
    `สาขาศาลาแดง: รับ 60 → ละลาย 25 → ขาย Add-on 1 แพ็ก LINE MAN ${LINE_MAN}`,
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await openMenu(page, "กรอกรายวัน");
      await button(page, "รับของ");
      await page
        .getByRole("dialog")
        .getByLabel("ใบจัดสรรที่รับ")
        .selectOption({ index: 1 });
      await field(page, /น้ำหนักรับเข้าสาขา/, "60");
      await saveEntry(page);
      await button(page, "แบ่งละลาย");
      await field(page, /น้ำหนักละลาย/, "25");
      await field(page, /จำนวนกล่องรมควันที่ละลาย/, "1");
      await saveEntry(page);
      await button(page, "บันทึกยอดขาย");
      await field(page, /เนื้อซีล Add-on/, "1");
      await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "0.1");
      await field(page, /ยอดขาย LINE MAN ที่บันทึก/, LINE_MAN);
      await saveEntry(page);
    },
  );

  await step(page, "Owner: รายงานมียอดขาย LINE MAN และส่วนต่าง", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await openMenu(page, "รายงาน");
    const main = page.locator("main");
    await expect(main).toContainText("ยอดขาย LINE MAN");
    await expect(main).toContainText("ส่วนต่างหลังต้นทุนที่บันทึก");
    await expect(main).toContainText("LINE MAN (บาท)");
    await expect(main).toContainText("ยอดขาย (บาท)");
    await expect(main).toContainText(money(LINE_MAN));
  });

  await step(
    page,
    "Account Manager: รายงานไม่มีคอลัมน์/แถวยอดขาย · Log ขายไม่มีเงิน ไม่มีปุ่มแก้ไข",
    async () => {
      await signInAsManager(page);
      await openMenu(page, "รายงาน");
      const main = page.locator("main");
      await expect(main).toContainText("รายงานยอดขายรายวัน");
      await expect(main).toContainText("Waste (กก.)");
      for (const text of [
        "ยอดขาย LINE MAN",
        "ส่วนต่างหลังต้นทุนที่บันทึก",
        "LINE MAN (บาท)",
        "ยอดขาย (บาท)",
      ])
        await expect(main).not.toContainText(text);
      await expect(main).not.toContainText(money(LINE_MAN));

      await openMenu(page, "Log");
      const sale = logEntry(page, SALE).first();
      await pointAndClick(page, sale.locator("summary"));
      await expect(sale).toContainText("บันทึก ");
      for (const label of ["ยอดขายบันทึก", "ยอดตามเมนู", "ยอดขาย LINE MAN"])
        await expect(sale).not.toContainText(label);
      await expect(sale).not.toContainText(money(LINE_MAN));
      await expect(
        sale.getByRole("button", { name: "แก้ไข", exact: true }),
      ).toHaveCount(0);
    },
  );

  await step(
    page,
    `สาขาศาลาแดง: ขอแก้ไขยอดขาย LINE MAN ${LINE_MAN} → ${LINE_MAN_NEW}`,
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await openMenu(page, "ประวัติ");
      const sale = logEntry(page, SALE).first();
      await pointAndClick(page, sale.locator("summary"));
      await pointAndClick(
        page,
        sale.getByRole("button", { name: "ขอแก้ไข", exact: true }),
      );
      await typeValue(
        page,
        sale.getByLabel(/ยอดขาย LINE MAN ที่บันทึก/),
        LINE_MAN_NEW,
      );
      await sale.getByLabel("เหตุผลที่ขอแก้ไข").fill("พิมพ์ยอด LINE MAN ผิด");
      await pointAndClick(
        page,
        sale.getByRole("button", { name: "ส่งคำขอแก้ไข" }),
      );
      await expect(
        page.getByText("ส่งคำขอแก้ไขแล้ว รอ Owner พิจารณา"),
      ).toBeVisible();
    },
  );

  await step(
    page,
    "Account Manager: คำขอแก้ไขไม่แสดงจำนวนเงิน → อนุมัติ",
    async () => {
      await signInAsManager(page);
      await openMenu(page, "Log");
      // The request list and the history below it: neither may show the amounts.
      const requests = page.locator("main");
      await expect(
        page.getByRole("heading", { name: "คำขอแก้ไขรายการ" }),
      ).toBeVisible();
      await expect(requests).toContainText(SALE);
      await expect(requests).toContainText("พิมพ์ยอด LINE MAN ผิด");
      await expect(requests).not.toContainText(money(LINE_MAN));
      await expect(requests).not.toContainText(money(LINE_MAN_NEW));
      await pointAndClick(
        page,
        requests.getByRole("button", { name: "อนุมัติ", exact: true }),
      );
      await expect(page.getByText("อนุมัติคำขอแล้ว")).toBeVisible();
      await expect(page.locator("main")).not.toContainText(money(LINE_MAN_NEW));
    },
  );

  await step(
    page,
    "Owner: Log แสดงอนุมัติโดย Account Manager · รายงานเห็นยอดใหม่",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, "Log");
      await expect(page.locator("main")).toContainText(
        "อนุมัติ โดย Account Manager",
      );
      await openMenu(page, "รายงาน");
      await expect(page.locator("main")).toContainText(money(LINE_MAN_NEW));
    },
  );
});
