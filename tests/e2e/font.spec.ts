import { expect, test } from "@playwright/test";
import { signInAs, start } from "./helpers";

/* The app's typeface (`--font-sans` in tokens.css): Noto Sans Thai Looped, loaded and in use. */

test("the app is set in Noto Sans Thai Looped", async ({ page }) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toBeVisible();
  const family = await heading.evaluate(
    (el) => getComputedStyle(el).fontFamily,
  );
  expect(family).toMatch(/^"?Noto Sans Thai Looped/);
  // The face is loaded, not a fallback: the heading's Thai text is drawn with it.
  expect(
    await page.evaluate(async (first) => {
      await document.fonts.ready;
      return document.fonts.check(`16px ${first}`, "ก");
    }, family.split(",")[0]),
  ).toBe(true);
});
