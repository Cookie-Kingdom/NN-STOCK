/* Scratch spec for "the stock-purchase popup is squashed and nothing can be
 * tapped on iPad": WebKit at iPad sizes, taps (not clicks) through the Owner's
 * two purchase dialogs and prints where their parts land.
 * Run: VISUAL=1 pnpm test:e2e:local tests/e2e/_ipad-dialog.spec.ts */
import { devices, expect, test } from "@playwright/test";
import { button, startFresh } from "./helpers";

test.use({ browserName: "webkit", video: "off" });

for (const name of ["iPad (gen 7)", "iPad Pro 11 landscape", "iPad Mini"]) {
  test.describe(name, () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { defaultBrowserType, ...device } = devices[name];
    test.use(device);

    test(`scratch: purchase dialogs on ${name}`, async ({ page }) => {
      page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
      await startFresh(page);
      const email = page.getByLabel("อีเมล");
      await expect(email).toBeVisible({ timeout: 30_000 });
      await expect
        .poll(async () => {
          await email.fill("owner@local.test");
          return email.inputValue();
        })
        .toBe("owner@local.test");
      await page.getByLabel("รหัสผ่าน").fill("local-test");
      await page.getByRole("button", { name: "เข้าสู่ระบบ" }).tap();
      await expect(page).toHaveURL(/\/owner/, { timeout: 30_000 });
      await button(page, "สต๊อกของทั้งหมด");

      for (const opener of ["+ ซื้อวัสดุเข้าคลัง", "+ บันทึกการซื้ออื่น ๆ"]) {
        await page.getByRole("button", { name: opener }).tap();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        await page.waitForTimeout(600);
        const info = await dialog.evaluate((d: HTMLElement) => {
          const box = (el: Element | null) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            return `${Math.round(b.top)}→${Math.round(b.bottom)} (h${Math.round(b.height)})`;
          };
          const hit = (el: Element | null) => {
            if (!el) return null;
            const b = el.getBoundingClientRect();
            const top = document.elementFromPoint(
              b.left + b.width / 2,
              b.top + Math.min(b.height / 2, 10),
            );
            return top === el || el.contains(top)
              ? "ok"
              : `covered by ${top?.tagName}`;
          };
          const form = d.querySelector("form");
          const body = form?.firstElementChild ?? null;
          return {
            vh: innerHeight,
            dialog: box(d),
            header: box(d.querySelector("header")),
            form: box(form),
            body: box(body),
            bodyScroll: body ? `${body.scrollHeight}/${body.clientHeight}` : null,
            footer: box(d.querySelector("footer")),
            checkboxHit: hit(d.querySelector("input[type=checkbox]")),
            submitHit: hit(d.querySelector('button[type="submit"]')),
          };
        });
        console.log(name, opener, JSON.stringify(info));
        await page.screenshot({
          path: `artifacts/ipad-${name.replace(/\W+/g, "-")}-${opener.length}.png`,
        });
        await dialog.getByRole("button", { name: "ปิดฟอร์ม" }).tap();
        await expect(dialog).toBeHidden();
      }
    });
  });
}
