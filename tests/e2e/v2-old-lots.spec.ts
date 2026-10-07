import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  bangkokDate,
  fill,
  nav,
  openPage,
  pageButtons,
  popupTitle,
  region,
  rows,
  savePo,
  signInAs,
  start,
} from "./helpers";

/* Old Lots: the POs flagged `old` (carried over from the old workbook) are on their own page,
 * off Lots and off the to-do list. */

const year = bangkokDate().slice(0, 4);
const [PO1, PO2] = [`PO-${year}-0001`, `PO-${year}-0002`];
const [SO1, SO2] = [`SO-${year}-0001`, `SO-${year}-0002`];
const listed = (page: Page, number: string) =>
  page.locator("[data-lot]").filter({ hasText: number });
const fact = (detail: Locator, label: string) =>
  detail
    .locator("dt")
    .filter({ hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd");
const create = async (
  page: Page,
  kind: "PO เนื้อ" | "PO รมควัน",
  ...pairs: [RegExp, string][]
) => {
  await page.getByRole("button", { name: `+ สร้าง ${kind}` }).click();
  await expect(popupTitle(page)).toHaveText(kind);
  await fill(page, ...pairs);
  await savePo(page);
};
/** Nothing in the app sets the flag: the signed-in Owner's copy goes back through the save
 *  the app itself uses (POST /api/local-db), with these POs flagged. */
const flag = async (page: Page, ...numbers: string[]) => {
  const { payload, revision } = await (
    await page.request.get("/api/local-db")
  ).json();
  for (const lot of payload.lots)
    if (numbers.includes(lot.poId)) lot.old = true;
  const saved = await page.request.post("/api/local-db", {
    data: { payload, expectedRevision: revision },
  });
  expect(saved.ok(), `POST /api/local-db → ${saved.status()}`).toBe(true);
  await page.reload();
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
};

test("Old Lots is empty while no PO is flagged", async ({ page }) => {
  await start(page, "sample");
  await signInAs(page, "owner");
  await openPage(page, "Old Lots");
  await expect(page.getByText("ยังไม่มี PO จากไฟล์เดิม")).toBeVisible();
  await expect(page.locator("[data-lot]")).toHaveCount(0);
});

test("a flagged PO is on Old Lots only, raises no to-do, and is filled in there", async ({
  page,
}) => {
  await start(page, "seed");
  await signInAs(page, "owner");
  await openPage(page, "Lots");
  // PO1 has no price yet; neither PO รมควัน has a round.
  await create(page, "PO เนื้อ", [/^น้ำหนักเนื้อ/, "100"]);
  await create(
    page,
    "PO เนื้อ",
    [/^น้ำหนักเนื้อ/, "50"],
    [/^ราคา \/ กก\./, "600"],
  );
  await create(page, "PO รมควัน", [/^น้ำหนักที่สั่งรมควัน/, "60"]);
  await create(page, "PO รมควัน", [/^น้ำหนักที่สั่งรมควัน/, "40"]);
  await flag(page, PO1, SO1);

  // The menu: right under Finance.
  const menu = await pageButtons(page).allInnerTexts();
  expect(menu[menu.indexOf("Finance") + 1]).toBe("Old Lots");

  await openPage(page, "Lots");
  await expect(page.locator("[data-lot]")).toHaveCount(2);
  for (const number of [PO2, SO2])
    await expect(listed(page, number)).toBeVisible();

  // The to-do list names the other PO รมควัน, and nothing of a flagged PO.
  await openPage(page, "Daily Log");
  const todo = region(page, "ยังไม่ได้จด");
  await expect(todo).toContainText(`${SO2}: ยังไม่ได้จด ส่งไปรมควัน`);
  await expect(todo).not.toContainText(SO1);
  await expect(todo).not.toContainText("PO เนื้อ");

  await openPage(page, "Old Lots");
  await expect(page).toHaveURL(/\/owner\/nn-x-lm\/old-lots$/);
  await expect(page.getByRole("button", { name: /^\+ สร้าง PO/ })).toHaveCount(
    0,
  );
  await expect(page.locator("[data-lot]")).toHaveCount(2);
  await expect(listed(page, SO1)).toBeVisible();

  // Its warnings are still on the page, and the Owner fills in what is missing.
  await expect(listed(page, PO1)).toContainText("ยังไม่ได้จด 1 ช่อง");
  await listed(page, PO1).click();
  const bought = rows(page, "purchase");
  await bought.getByRole("button").first().click();
  await bought.getByRole("button", { name: "แก้ไข", exact: true }).click();
  await expect(popupTitle(page)).toHaveText("PO เนื้อ");
  await fill(page, [/^ราคา \/ กก\./, "700"]);
  await savePo(page);
  const po = region(page, PO1);
  await expect(fact(po, "ราคา / กก.").first()).toContainText("฿700");
  await expect(fact(po, "มูลค่า").first()).toHaveText("฿70,000");
  await expect(listed(page, PO1)).toContainText("ฝากไว้ 100 กก.");
  await openPage(page, "Lots");
  await expect(listed(page, PO1)).toHaveCount(0);

  // The Account Manager has the page; a branch does not.
  await signInAs(page, "manager");
  await openPage(page, "Old Lots");
  await expect(page.locator("[data-lot]")).toHaveCount(2);
  await signInAs(page, "saladaeng");
  await expect(nav(page).getByRole("button", { name: "Old Lots" })).toHaveCount(
    0,
  );
});
