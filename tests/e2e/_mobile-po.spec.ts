/* Scratch spec for the iOS "sinking dialog" report (Open Bugs #8): runs in
 * WebKit at iPhone size and prints where the PO dialog and its submit button
 * land, at rest and with the visible area collapsed as a keyboard would.
 * Run: VISUAL=1 pnpm test:e2e:local tests/e2e/_mobile-po.spec.ts */
import { devices, expect, test } from "@playwright/test";
import { button, startFresh } from "./helpers";

test.use({ ...devices["iPhone 13"], browserName: "webkit", video: "off" });

test("scratch: the PO dialog fills the phone screen", async ({ page }) => {
  await startFresh(page);
  const email = page.getByLabel("อีเมล");
  await expect(email).toBeVisible({ timeout: 30_000 });
  // WebKit drops the first fill: hydration resets the controlled input.
  await expect
    .poll(async () => {
      await email.fill("owner@local.test");
      return email.inputValue();
    })
    .toBe("owner@local.test");
  await page.getByLabel("รหัสผ่าน").fill("local-test");
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click();
  await expect(page).toHaveURL(/\/owner/, { timeout: 30_000 });
  await button(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const measure = () =>
    dialog.evaluate((d: HTMLElement) => {
      const box = d.getBoundingClientRect();
      const submit = d
        .querySelector('button[type="submit"]')!
        .getBoundingClientRect();
      return {
        top: Math.round(box.top),
        bottom: Math.round(box.bottom),
        viewport: innerHeight,
        submitVisible: submit.bottom <= innerHeight + 1 && submit.top >= 0,
      };
    });

  console.log("at rest    ", JSON.stringify(await measure()));
  await page.screenshot({ path: "artifacts/po-iphone-rest.png" });
  await page.setViewportSize({ width: 390, height: 330 });
  console.log("keyboard up", JSON.stringify(await measure()));
  await page.screenshot({ path: "artifacts/po-iphone-keyboard.png" });
});
