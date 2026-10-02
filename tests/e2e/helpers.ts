import { expect, test, type Page } from "@playwright/test";

/* The v2 suite: each spec walks the checklist of Spec v2 section 11 (its item number and rule
 * id are in the test title) the way a user does: jot through the composer, read the page.
 *
 * Run it only with `pnpm test:e2e:local` (local SQLite, its own port): every test resets the
 * one app_state row, so it never runs against Supabase. */

type AccountKey = "owner" | "manager" | "saladaeng" | "minburi";

/** A Bangkok business date, `offset` days from today (the app's `today()`). */
export function bangkokDate(offset = 0) {
  const day = new Date(Date.now() + offset * 86_400_000);
  return day.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

/** Resets the local database to the empty `seed` or to the approved `sample` (35 days ending
 *  today, src/lib/store/demo.ts) and opens the sign-in page. */
export async function start(page: Page, state: "seed" | "sample") {
  test.skip(
    process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
    "runs on the local SQLite backend only (pnpm test:e2e:local)",
  );
  const response = await page.request.put(`/api/local-db?state=${state}`);
  expect(response.ok(), `PUT /api/local-db → ${response.status()}`).toBe(true);
  await page.goto("/");
}

/** Signs out (when signed in) and in as `account`: local mode takes `<account>@local.test`. */
export async function signInAs(page: Page, account: AccountKey) {
  const signOut = page.getByRole("button", { name: "ออกจากระบบ" });
  if (await signOut.count()) await signOut.click();
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("อีเมล").fill(`${account}@local.test`);
  await page.getByLabel("รหัสผ่าน").fill("local-test");
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await expect(signOut).toBeVisible({ timeout: 30_000 });
  // The page's button is enabled once the server's payload is in.
  await expect(jotButton(page)).toBeEnabled({ timeout: 30_000 });
}

/** The page list: the sidebar, or the bottom tabs on a phone. */
export const nav = (page: Page) =>
  page.getByRole("navigation", { name: "หน้า" });

/** Opens a page by its (English) name and waits for its heading. */
export async function openPage(page: Page, name: string) {
  await nav(page).getByRole("button", { name, exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(name);
}

/** A card or section of a page, by its accessible name. */
export const region = (page: Page, name: string | RegExp) =>
  page.getByRole("region", { name, exact: true });

const jotButton = (page: Page) =>
  page.getByRole("button", { name: "จดบันทึก", exact: true });

/** The composer's form, open on one kind. */
export const form = (page: Page) => page.locator('form[aria-label="จดบันทึก"]');

/** Presses 「จดบันทึก」 and picks a kind by its title in the picker. */
export async function jot(page: Page, kind: string) {
  await jotButton(page).click();
  await region(page, "จดอะไร")
    .getByRole("group")
    .getByRole("button", { name: kind, exact: true })
    .click();
  await expect(form(page).getByRole("heading")).toHaveText(kind);
}

/** Fills the open form: `[label, value]` pairs in order; a `<select>` takes the option's
 *  text. A label's text runs on into its unit, its hint or its options, so each is matched
 *  from its start (`/^ยอด \(บาท\)/`); a field folded under 「จดเพิ่มได้」 is not matched. */
export async function fill(page: Page, ...pairs: [RegExp, string][]) {
  for (const [label, value] of pairs) {
    const control = form(page).getByLabel(label).filter({ visible: true });
    if ((await control.evaluate((el) => el.tagName)) === "SELECT")
      await control.selectOption({ label: value });
    else await control.fill(value);
  }
}

/** 「บันทึก」: the form closes on a save and stays open, with the reason, on a refusal. */
export async function save(page: Page) {
  await form(page).getByRole("button", { name: "บันทึก", exact: true }).click();
  await expect(form(page)).toHaveCount(0);
}

/** The message at the bottom of the screen after a save, a delete or an undo. */
export const toast = (page: Page, message: string | RegExp) =>
  page.locator("main").getByRole("status").filter({ hasText: message });

/** The rows of one kind (`data-kind`) on the page: Daily Log, a Lot, Finance. */
export const rows = (page: Page, kind: string) =>
  page.locator(`[data-entry][data-kind="${kind}"]`);
