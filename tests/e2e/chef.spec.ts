import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  BATCH_ID,
  SCREENS,
  SHIPMENT_NO,
  createPurchasePo,
  expectNoPurchaseData,
  idsOnScreen,
  openMenu,
  openSmokePo,
  pointAndClick,
  productionButton,
  saveEntry,
  signInAs,
  startFresh,
  tableRow,
  topDialog,
} from "./helpers";

/* PRIN-06 / VIS-02: Chef House works a batch whose smoke PO cites a purchase PO, and
 * never sees that PO's number or its meat price — not in the tables, the smoke PO
 * document nor the history. (Chef House work may move into the Owner workspace; this
 * check then goes with the account.) */
test("PRIN-06 Chef House never sees purchase PO numbers or meat prices", async ({
  page,
}) => {
  await startFresh(page);
  const price = "287";
  await signInAs(page, ACCOUNTS.owner);
  const poId = await createPurchasePo(page, "150", price);
  await openSmokePo(page, "", [{ poId, kg: "120" }]);
  await saveEntry(page);
  await openMenu(page, SCREENS.smokePo.menu);
  const batch = (await idsOnScreen(page, BATCH_ID))[0];
  const ownerRow = tableRow(page, SCREENS.smokePo.table, batch);
  await expect(ownerRow).toContainText(poId);
  const shipment = (await ownerRow.innerText()).match(SHIPMENT_NO)![0];

  await signInAs(page, ACCOUNTS.chef);
  await openMenu(page, SCREENS.weighIn.menu);
  // The weigh-in list names a batch by its shipment number.
  await expect(tableRow(page, SCREENS.weighIn.table, shipment)).toHaveCount(1);
  await expectNoPurchaseData(page, [price]);

  await openMenu(page, SCREENS.production.menu);
  await expect(tableRow(page, SCREENS.production.table, batch)).toHaveCount(1);
  await expectNoPurchaseData(page, [price]);
  await pointAndClick(page, productionButton(page, "ดู PO รมควัน", batch));
  await expect(topDialog(page)).toBeVisible();
  await expectNoPurchaseData(page, [price]);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  for (const menu of ["สต๊อก", "ประวัติ"]) {
    await openMenu(page, menu);
    await expectNoPurchaseData(page, [price]);
  }
});
