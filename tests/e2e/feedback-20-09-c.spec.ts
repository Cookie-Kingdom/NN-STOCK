import { expect, test, type Page, type Response } from "@playwright/test";
import {
  ACCOUNTS,
  field,
  loadSampleData,
  menuItem,
  openMenu,
  pointAndClick,
  saveEntry,
  signInAs,
  startFresh,
  step,
  tableSection,
} from "./helpers";

/* Feedback 20-09-2026 (vault: Feedback/20-09-2026 รวมฉบับสมบูรณ์.md), items 11, 13, 16, 17:
 * the parts no other spec asserts. Items 13, 14 and 16 are mostly covered by
 * bullets-22-09.spec.ts and full-system/branch-day.spec.ts; 11 by account-manager.spec.ts.
 * 15 (no example case) and 18 (two opposite readings) are undecided and not specified here. */

/** The live error line in the dialog footer (DialogFooter's role="alert"). */
const alert = (page: Page) =>
  page.getByRole("dialog").locator("footer").getByRole("alert");
const submit = (page: Page) =>
  page.getByRole("dialog").locator('button[type="submit"]').last();

/** Same as account-manager.spec.ts: helpers.signInAs knows only the five original accounts.
 * The manager exists only in local SQLite mode (manager@local.test). */
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

/** Every Owner menu (label → tab id in the URL), src/lib/nav.ts ownerNav. */
const OWNER_MENUS: [label: string, tab: string][] = [
  ["แดชบอร์ด", "owner-dashboard"],
  ["ใบสั่งซื้อ PO", "po"],
  ["ใบสั่ง PO โรงรมควัน", "smoke-po"],
  ["ใบ Invoice", "invoices"],
  ["Request ใบขนส่งขาไป", "transport"],
  ["สร้างใบขนส่งขากลับ", "return-shipment"],
  ["รับเนื้อเข้าสต๊อกกลาง", "central-receive"],
  ["จัดสรรเนื้อ และสต๊อกไปสาขา", "branch-status"],
  ["สต๊อกของทั้งหมด", "stock"],
  ["Log เนื้อคงเหลือ", "meat-log"],
  ["เอกสารและ Traceability", "documents"],
  ["รายงาน", "report"],
  ["Log", "history"],
  ["ตั้งค่า", "config"],
];
/** The dashboard is the one Owner screen built around sales money (C4). */
const REVENUE_ONLY_MENUS = ["แดชบอร์ด"];

/** A sale's money in, as keys of the persisted payload (store.ts saleMoneyKeys). */
const SALE_MONEY_KEY = /"(revenue|lineMan|menuTotal)"\s*:/;

/** Collects the bodies of every app_state read/write the browser receives:
 * /api/local-db locally, the app_state table / save_app_state RPC on Supabase. */
function captureAppState(page: Page) {
  const bodies: Promise<string>[] = [];
  const onResponse = (response: Response) => {
    if (/\/api\/local-db|app_state/.test(response.url()))
      bodies.push(response.text().catch(() => ""));
  };
  page.on("response", onResponse);
  return {
    count: () => bodies.length,
    texts: () => Promise.all(bodies),
    stop: () => page.off("response", onResponse),
  };
}

test("ข้อ 11: Account Manager เข้าได้ทุกเมนูของ Owner ยกเว้นหน้าที่เป็นรายได้ (แดชบอร์ด)", async ({
  page,
}) => {
  await startFresh(page);

  await step(page, "Owner: เห็นเมนูครบทุกเมนู", async () => {
    await signInAs(page, ACCOUNTS.owner);
    for (const [label] of OWNER_MENUS)
      await expect(menuItem(page, label)).toBeVisible();
  });

  await step(
    page,
    "Account Manager: ทุกเมนูของ Owner (ยกเว้นแดชบอร์ด) มีและเปิดได้",
    async () => {
      await signInAsManager(page);
      for (const [label, tab] of OWNER_MENUS) {
        if (REVENUE_ONLY_MENUS.includes(label)) {
          await expect(menuItem(page, label)).toHaveCount(0);
          continue;
        }
        await openMenu(page, label);
        await expect(page).toHaveURL(new RegExp(`/owner/${tab}(?:[/?#]|$)`));
        await expect(menuItem(page, label)).toHaveAttribute(
          "aria-current",
          "page",
        );
        await expect(page.locator("main")).toBeVisible();
      }
    },
  );
});

test("ข้อ 11: ยอดขาย (revenue / LINE MAN / ยอดตามเมนู) ต้องไม่ถูกส่งมาถึง browser ของ Account Manager", async ({
  page,
}) => {
  await startFresh(page);
  // Seven days of sales with LINE MAN amounts (sevenDayRoleplay); local SQLite only.
  await loadSampleData(page);

  await step(
    page,
    "Owner: ข้อมูลที่โหลดมามียอดขาย (ยืนยันว่าชุดข้อมูลมียอดขายจริง)",
    async () => {
      const owner = captureAppState(page);
      await signInAs(page, ACCOUNTS.owner);
      await openMenu(page, "รายงาน");
      await expect.poll(owner.count, { timeout: 30_000 }).toBeGreaterThan(0);
      owner.stop();
      const texts = await owner.texts();
      expect(texts.some((text) => SALE_MONEY_KEY.test(text))).toBe(true);
    },
  );

  await step(
    page,
    "Account Manager: ทุก response ของ app_state ไม่มียอดขาย (ไม่ใช่แค่ซ่อนบนจอ)",
    async () => {
      const manager = captureAppState(page);
      await signInAsManager(page);
      await openMenu(page, "รายงาน");
      await openMenu(page, "Log");
      await expect.poll(manager.count, { timeout: 30_000 }).toBeGreaterThan(0);
      manager.stop();
      const leaks = (await manager.texts()).filter((text) =>
        SALE_MONEY_KEY.test(text),
      );
      expect(
        leaks.length,
        "app_state payload sent to the Account Manager still carries sale money",
      ).toBe(0);
    },
  );
});

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

test("ข้อ 13 + 16: เบิกข้าวเหนียวดิบ — เกินสต๊อกขึ้นข้อความแดงทันที · ตรวจสอบก่อนบันทึก · ยกเลิกแล้วไม่บันทึก กลับมาแก้ได้", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.saladaeng);

  await step(
    page,
    "สาขาศาลาแดง: ซื้อข้าวเหนียวดิบ 10 กก. (นึ่งเอง)",
    async () => {
      await openTask(page, "ซื้อข้าวเหนียวเข้าสต๊อก");
      await page
        .getByRole("dialog")
        .getByLabel(/รอบนี้ข้าวเหนียวมาจาก/)
        .selectOption("นึ่งเอง (ซื้อข้าวดิบ)");
      await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าวทดสอบ");
      await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "10");
      await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "300");
      await saveEntry(page);
    },
  );

  await step(
    page,
    "ข้อ 13: พิมพ์ 12 กก. (เกิน 10) → ข้อความแดงทันที บอกยอดสูงสุด · ปุ่มบันทึกปิด",
    async () => {
      await openTask(page, "เบิกข้าวเหนียวดิบวันนี้");
      await expect(alert(page)).toHaveCount(0);
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "12");
      // No save pressed: the refusal is there while typing.
      await expect(alert(page)).toBeVisible();
      await expect(alert(page)).toHaveClass(/text-danger/);
      await expect(alert(page)).toContainText("กรอกได้สูงสุด 10.00 กก.");
      await expect(submit(page)).toBeDisabled();
    },
  );

  await step(
    page,
    "ข้อ 16: เบิก 4 กก. → สรุป เบิกอะไร เท่าไร · คงเหลือตอนนี้ 10 · หลังเบิก 6 → กดยกเลิก",
    async () => {
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "4");
      await field(page, /ผู้รับของ/, "ผู้ดูแลศาลาแดง");
      await expect(alert(page)).toHaveCount(0);
      const review = page
        .getByRole("dialog")
        .getByRole("region", { name: "ตรวจสอบก่อนบันทึก" });
      await expect(review).toContainText(/ข้าวเหนียวดิบที่เบิก\s*4\.00 กก\./);
      await expect(review).toContainText(/คงเหลือตอนนี้\s*10\.00 กก\./);
      await expect(review).toContainText(/คงเหลือหลังรายการนี้\s*6\.00 กก\./);
      await pointAndClick(
        page,
        page.getByRole("dialog").getByRole("button", { name: "ยกเลิก" }),
      );
      await expect(page.getByRole("dialog")).toHaveCount(0);
    },
  );

  await step(
    page,
    "ข้อ 16: ยกเลิกแล้วไม่มีอะไรถูกบันทึก → เปิดใหม่ แก้เป็น 5 กก. → บันทึก → คงเหลือ 5",
    async () => {
      const issueRow = tableSection(page, /^ข้าวเหนียว · นึ่งเอง/)
        .getByRole("row")
        .filter({ hasText: "เบิกข้าวเหนียวดิบวันนี้" });
      await expect(issueRow).toContainText("ไม่บังคับวันนี้");
      await openTask(page, "เบิกข้าวเหนียวดิบวันนี้");
      const review = page
        .getByRole("dialog")
        .getByRole("region", { name: "ตรวจสอบก่อนบันทึก" });
      await expect(review).toContainText(/คงเหลือตอนนี้\s*10\.00 กก\./);
      await field(page, /ข้าวเหนียวดิบที่เบิกวันนี้/, "5");
      await field(page, /ผู้รับของ/, "ผู้ดูแลศาลาแดง");
      await expect(review).toContainText(/ข้าวเหนียวดิบที่เบิก\s*5\.00 กก\./);
      await expect(review).toContainText(/คงเหลือหลังรายการนี้\s*5\.00 กก\./);
      await saveEntry(page);
      await expect(issueRow).toContainText("บันทึกแล้ว");
      await openTask(page, "เบิกข้าวเหนียวดิบวันนี้");
      await expect(
        page
          .getByRole("dialog")
          .getByRole("region", { name: "ตรวจสอบก่อนบันทึก" }),
      ).toContainText(/คงเหลือตอนนี้\s*5\.00 กก\./);
    },
  );
});

test("ข้อ 17: ขั้นตอนปิดวันของสาขารวมการกรอกกล่องโปรโมทอินฟลูเอนเซอร์ไว้ในรอบเดียว", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.saladaeng);

  await step(
    page,
    "สาขาศาลาแดง: ตรวจและปิดวัน → รายการตรวจก่อนปิดวันมีแถวกล่องโปรโมทอินฟลูเอนเซอร์",
    async () => {
      await openMenu(page, "กรอกรายวัน");
      await pointAndClick(
        page,
        page
          .getByRole("main")
          .getByRole("row")
          .filter({ hasText: "4. ปิดวัน" })
          .getByRole("button", { name: "ตรวจและปิดวัน" }),
      );
      const checklist = tableSection(page, "ตรวจก่อนปิดวัน");
      await expect(checklist).toBeVisible();
      // The giveaway is part of the close itself now: the section starts collapsed,
      // and one press of เพิ่มอินฟลูเอนเซอร์ opens a block with its own fields.
      const dialog = page.getByRole("dialog").last();
      const add = dialog.getByRole("button", { name: /เพิ่มอินฟลูเอนเซอร์/ });
      await expect(add).toBeVisible();
      await expect(dialog.getByLabel(/ชื่ออินฟลูเอนเซอร์/)).toHaveCount(0);
      await pointAndClick(page, add);
      await expect(dialog.getByLabel(/ชื่ออินฟลูเอนเซอร์/)).toHaveCount(1);
      await expect(dialog.getByLabel(/กล่องมาตรฐานที่ส่ง/)).toHaveCount(1);
      // No weight field any more: the kg follows the box count.
      await expect(dialog.getByLabel(/น้ำหนักเนื้อที่ใช้ส่งจริง/)).toHaveCount(
        0,
      );
    },
  );
});
