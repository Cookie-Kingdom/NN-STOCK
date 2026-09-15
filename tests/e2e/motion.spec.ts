import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  pointAndClick,
  signInAs,
  startFresh,
} from "./helpers";

/* The automatable part of vault note Refactor/Motion Polish/Checklist.md. The
 * look of each motion (and light/dark, Storybook) stays a manual check. */

/** Longest value of a comma-separated CSS time list ("0.32s, 0.2s") in seconds. */
function longest(times: string) {
  return Math.max(
    ...times
      .split(",")
      .map((time) => time.trim())
      .map((time) =>
        time.endsWith("ms") ? parseFloat(time) / 1000 : parseFloat(time),
      ),
  );
}

const style = (
  locator: Locator,
  property:
    | "transitionDuration"
    | "animationDuration"
    | "animationName"
    | "scale"
    | "opacity",
) =>
  locator.evaluate(
    (element, key) => getComputedStyle(element)[key as "scale"],
    property,
  );

async function openPoDialog(page: Page) {
  await button(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  return dialog;
}

test("Motion: dialog, เปลี่ยน tab และ popover เคลื่อนไหว แต่ขึ้นทันทีเมื่อเปิด reduce motion", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  // ---- ปกติ: มี transition / animation ----------------------------------------
  let dialog = await openPoDialog(page);
  expect(longest(await style(dialog, "transitionDuration"))).toBeGreaterThan(
    0.001,
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await button(page, "ใบขนส่ง");
  const tabContent = page.locator("main > div.animate-fade-in");
  expect(await style(tabContent, "animationName")).toBe("fade-in");
  expect(longest(await style(tabContent, "animationDuration"))).toBeGreaterThan(
    0.001,
  );

  // The Next dev indicator sits over the bell in `next dev`, so click through the DOM.
  const bell = page.getByRole("button", { name: /^การแจ้งเตือน/ });
  await bell.evaluate((element: HTMLElement) => element.click());
  const popover = page.getByLabel("รายการที่ต้องทำต่อ");
  await expect(popover).toBeVisible();
  expect(await style(popover, "animationName")).toBe("scale-in");
  await bell.evaluate((element: HTMLElement) => element.click());
  await expect(popover).toHaveCount(0);

  // ---- reduce motion: ทุกอย่าง 1ms ------------------------------------------
  await page.emulateMedia({ reducedMotion: "reduce" });
  dialog = await openPoDialog(page);
  expect(
    longest(await style(dialog, "transitionDuration")),
  ).toBeLessThanOrEqual(0.001);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  await button(page, "รับเนื้อเข้าสต๊อกกลาง");
  expect(
    longest(await style(tabContent, "animationDuration")),
  ).toBeLessThanOrEqual(0.001);

  // ---- ปิด reduce motion แล้วกลับมาเล่นปกติ ----------------------------------
  await page.emulateMedia({ reducedMotion: "no-preference" });
  dialog = await openPoDialog(page);
  expect(longest(await style(dialog, "transitionDuration"))).toBeGreaterThan(
    0.001,
  );
});

test("Dialog: focus อยู่ใน dialog, Esc ปิดได้ และ focus คืนปุ่มที่เปิด", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await button(page, "ใบสั่งซื้อ PO");

  const opener = page.getByRole("button", { name: "สร้าง PO เนื้อ" }).last();
  await pointAndClick(page, opener);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("Dialog บนมือถือ 390px อยู่ในจอทั้งหมด ไม่ล้น", async ({ page }) => {
  const viewport = { width: 390, height: 844 };
  await page.setViewportSize(viewport);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  const dialog = await openPoDialog(page);
  // รอ enter transition (scale/translate) จบก่อนวัดขนาด
  await expect.poll(() => style(dialog, "opacity")).toBe("1");
  await expect
    .poll(async () => (await dialog.boundingBox())?.y ?? -1)
    .toBeGreaterThanOrEqual(0);
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
  // หน้าเว็บเองต้องไม่เลื่อนแนวนอน
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("Button: กดค้างแล้วย่อเหลือ 0.97 แต่ปุ่ม disabled ไม่ย่อ", async ({
  page,
}) => {
  await startFresh(page);
  const submit = page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true });
  const scale = async () => parseFloat(await style(submit, "scale")) || 1;

  const box = (await submit.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(scale).toBeCloseTo(0.97, 3);
  await page.mouse.up();
  await expect.poll(scale).toBe(1);

  await submit.evaluate((element) => element.setAttribute("disabled", ""));
  await page.mouse.down();
  await page.waitForTimeout(300);
  expect(await scale()).toBe(1);
  await page.mouse.up();
});
