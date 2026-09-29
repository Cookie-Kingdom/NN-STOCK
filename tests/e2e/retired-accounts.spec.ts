import { expect, test } from "@playwright/test";
import { startFresh } from "./helpers";

/* Checklist Merge Roles 6: Foodiva and Chef House are partners, not users. Their old
 * sign-ins are refused and their old routes land on sign-in. The only place the suite
 * signs in as either. */
for (const account of ["chef", "foodiva"]) {
  test(`${account}@local.test is refused with "บัญชีนี้ไม่ใช้งานแล้ว"`, async ({
    page,
  }) => {
    // @local.test accounts exist only in local DB mode (playwright.local.config.ts).
    test.skip(process.env.NEXT_PUBLIC_LOCAL_DB !== "1", "local DB mode only");
    await startFresh(page);
    await page.getByLabel("อีเมล").fill(`${account}@local.test`);
    await page.getByLabel("รหัสผ่าน").fill("local-test");
    await page
      .getByRole("button", { name: "เข้าสู่ระบบ", exact: true })
      .click();
    await expect(page.getByText("บัญชีนี้ไม่ใช้งานแล้ว")).toBeVisible();
    await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toHaveCount(
      0,
    );
  });
}

test("/chef and /foodiva redirect to /", async ({ page }) => {
  for (const path of ["/chef", "/chef/work", "/foodiva", "/foodiva/xyz"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/^http:\/\/[^/]+\/$/);
  }
});
