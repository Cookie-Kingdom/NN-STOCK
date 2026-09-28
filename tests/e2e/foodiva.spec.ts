import { expect, test } from "@playwright/test";
import {
  ACCOUNTS,
  SCREENS,
  SHIPMENT_NO,
  issueSmokePoOnNewBatch,
  openMenu,
  pointAndClick,
  signInAs,
  startFresh,
  saveDispatchDialog,
  tableRow,
  topDialog,
} from "./helpers";

/* SMK-09 / SHP-04: with no Request document, the smoke PO itself is the work that comes
 * in. A batch the Owner opened with a smoke PO waits in "PO รมควันที่ยังไม่มีใบขนส่ง"
 * until its transport document is saved on that same batch. */
test("SMK-09 SHP-01 SHP-04 a smoke PO waits for its transport document and leaves the list once it is saved", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const batch = await issueSmokePoOnNewBatch(page, "80");

  await signInAs(page, ACCOUNTS.foodiva);
  await openMenu(page, SCREENS.batches.menu);
  const incoming = tableRow(page, "PO รมควันที่ยังไม่มีใบขนส่ง", SHIPMENT_NO);
  await expect(incoming).toHaveCount(1);
  const shipment = (await incoming.innerText()).match(SHIPMENT_NO)![0];
  await expect(tableRow(page, SCREENS.batches.table, batch)).toContainText(
    shipment,
  );

  await pointAndClick(
    page,
    incoming.getByRole("button", { name: "ทำใบขนส่ง" }),
  );
  await expect(topDialog(page)).toContainText(shipment);
  await saveDispatchDialog(page, ["40", "40"]);

  await expect(incoming).toHaveCount(0);
  const row = tableRow(page, SCREENS.batches.table, batch);
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("80.00 กก.");
  await expect(
    row.getByRole("button", { name: "แก้ไข Packing List" }),
  ).toBeVisible();
});
