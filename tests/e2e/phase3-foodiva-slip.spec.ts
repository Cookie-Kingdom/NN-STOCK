import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  button,
  chefSmokesShipment,
  field,
  foodivaIssuesInvoice,
  foodivaMakesManifest,
  foodivaReceivesReturn,
  openMenu,
  ownerCallsReturnTruck,
  ownerCreatesMeatPo,
  ownerCreatesShipmentRequest,
  ownerIssuesSmokePo,
  ownerPaysMeatInvoice,
  ownerReceivesCentral,
  pointAndClick,
  saveEntry,
  signInAs,
  slipPdf,
  startFresh,
  step,
  tableRow,
  tableSection,
  typeValue,
  type AccountKey,
} from "./helpers";
import { fmt } from "../../src/lib/format";
import { lotCost, n, type Database, type Lot } from "../../src/lib/store";

/* Review 24-09-2026, phase 3 (checklist section 8, vault:
 * Report/review-24-09-2026/06-test-checklist.md) on one real Shipment Flow run:
 *  - 8.2 Foodiva's "PO เนื้อที่ต้องออก Invoice" has a "การชำระเงิน" column (migration 0027):
 *    "—" before the invoice, "รอ Owner ชำระ" after it, "จ่ายแล้ว · <date> · ฿<amount>" with the
 *    slip once the Owner pays; Chef House and the branches never get the meat payment.
 *  - 8.1–8.3 every Foodiva, Chef House and branch save goes to append_entries with only its
 *    new entries, every Owner save to save_app_state (migration 0028).
 *  - 8.2 / 8.3 the cost values a non-owner's copy does not have (lines, estimatedCost,
 *    serviceRate, outboundCost, returnCost) survive its saves: the server merges values.
 *  - 8.1 a branch sale made in the app is costed on the server (meatCost / wasteCost =
 *    kg × the lot's cost per kg), and its preview has no cost row.
 *  - 8.8 the store split: the whole flow still runs. */

const API = "/api/local-db";
const SLIP = slipPdf("meat-slip-phase3.pdf");
const COST_KEYS = [
  "lines",
  "estimatedCost",
  "serviceRate",
  "outboundCost",
  "returnCost",
];

function bangkokDate(offset = 0) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  now.setDate(now.getDate() + offset);
  return now.toLocaleDateString("en-CA");
}
/** Future dates are blocked: the branch works yesterday. */
const DAY1 = bangkokDate(-1);
const LOT = /S\d{6}-\d{3}/;

async function load(page: Page): Promise<Database> {
  const response = await page.request.get(API);
  expect(response.ok(), `GET ${API} → ${response.status()}`).toBe(true);
  return (await response.json()).payload;
}

/** The "การชำระเงิน" cell of a PO row on Foodiva's invoice table. */
async function paymentCell(page: Page, poId: string): Promise<Locator> {
  const table = tableSection(page, /^PO เนื้อที่ต้องออก Invoice$/);
  const headers = await table.getByRole("columnheader").allInnerTexts();
  const index = headers.findIndex((h) => h.includes("การชำระเงิน"));
  expect(index, "the การชำระเงิน column").toBeGreaterThanOrEqual(0);
  return tableRow(page, "PO เนื้อที่ต้องออก Invoice", poId)
    .getByRole("cell")
    .nth(index);
}

async function setWorkingDate(page: Page, date: string) {
  const input = page.getByLabel("วันที่ทำรายการ").first();
  await input.scrollIntoViewIfNeeded();
  await input.fill(date);
  await expect(input).toHaveValue(date);
}

test("8.1–8.3 · 8.8: Foodiva เห็นการชำระเงิน + สลิปค่าเนื้อ · non-owner บันทึกผ่าน append_entries · ต้นทุนของ Lot ไม่หาย · ต้นทุนขายคำนวณที่เซิร์ฟเวอร์", async ({
  page,
}) => {
  test.skip(
    process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
    "reads the local SQLite backend (pnpm test:e2e:local)",
  );
  test.setTimeout(20 * 60_000);

  // Every save the app sends, with the account that was signed in.
  let account: AccountKey = ACCOUNTS.owner;
  const saves: { account: AccountKey; body: Record<string, unknown> }[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === API && request.method() === "POST")
      saves.push({ account, body: request.postDataJSON() });
  });
  const as = async (next: AccountKey) => {
    await signInAs(page, next);
    account = next;
  };

  await startFresh(page);
  let poId = "";
  await step(page, "Owner: สร้าง PO เนื้อ 100 กก. @ ฿250", async () => {
    await as(ACCOUNTS.owner);
    poId = await ownerCreatesMeatPo(page, "100", "250");
  });

  await step(
    page,
    "Foodiva: PO ยังไม่ออก Invoice → คอลัมน์การชำระเงิน '—'",
    async () => {
      await as(ACCOUNTS.foodiva);
      await expect(await paymentCell(page, poId)).toHaveText("—");
    },
  );

  await step(
    page,
    "Foodiva: ออก Invoice → 'รอ Owner ชำระ' · save ส่ง delta 1 รายการ",
    async () => {
      const before = saves.length;
      await foodivaIssuesInvoice(page, "100", { poId, amount: "25000" });
      await expect(await paymentCell(page, poId)).toHaveText("รอ Owner ชำระ");
      const sent = saves.slice(before);
      expect(sent).toHaveLength(1);
      expect(sent[0].body.payload).toBeUndefined();
      expect(sent[0].body.delta).toMatchObject({
        entries: [{ kind: "foodivaConfirm", role: "foodiva" }],
      });
    },
  );

  let paidText = "";
  await step(page, "Owner: ชำระค่าเนื้อ แนบสลิป PDF", async () => {
    await as(ACCOUNTS.owner);
    await ownerPaysMeatInvoice(page, poId, [SLIP]);
    const payment = (await load(page)).entries.find(
      (e) => e.kind === "meatPayment",
    );
    expect(payment).toBeTruthy();
    paidText = `จ่ายแล้ว · ${payment!.values.paymentDate || payment!.date} · ฿${fmt(n(payment!.values, "paidAmount"))}`;
    expect(n(payment!.values, "paidAmount")).toBe(25000);
  });

  await step(
    page,
    "Foodiva: 'จ่ายแล้ว · วันที่ · ฿ยอด' ตรงกับที่ Owner บันทึก · เปิดสลิปได้",
    async () => {
      await as(ACCOUNTS.foodiva);
      const cell = await paymentCell(page, poId);
      await expect(cell).toContainText(paidText);
      const popup = page.waitForEvent("popup");
      await pointAndClick(
        page,
        cell.getByRole("button", { name: SLIP.name, exact: true }).first(),
      );
      await (await popup).close();
    },
  );

  for (const who of [ACCOUNTS.chef, ACCOUNTS.saladaeng])
    await step(
      page,
      `${who === ACCOUNTS.chef ? "Chef House" : "สาขาศาลาแดง"}: ไม่ได้รับ meatPayment และไม่เห็นสลิปค่าเนื้อ`,
      async () => {
        await as(who);
        const scoped = await load(page);
        expect(scoped.entries.some((e) => e.kind === "meatPayment")).toBe(
          false,
        );
        expect(JSON.stringify(scoped)).not.toContain(SLIP.name);
        const main = page.locator("main");
        await expect(main).not.toContainText(SLIP.name);
        await expect(main).not.toContainText("รอ Owner ชำระ");
        await expect(main).not.toContainText("การชำระเงิน");
      },
    );

  let shipment = "";
  let costs: Record<string, string> = {};
  const shipmentLot = (db: Database) =>
    db.lots.find((lot) => lot.kind === "shipment" && lot.id !== poId)!;
  await step(
    page,
    "Owner → Foodiva → Owner: Request · ใบขนส่ง + Packing List · PO รมควัน",
    async () => {
      await as(ACCOUNTS.owner);
      shipment = await ownerCreatesShipmentRequest(page, [{ poId, kg: "100" }]);
      await as(ACCOUNTS.foodiva);
      await foodivaMakesManifest(page, shipment, ["100"]);
      await as(ACCOUNTS.owner);
      await ownerIssuesSmokePo(page, "100", shipment);
      const lot = shipmentLot(await load(page));
      // The smoke PO's cost stays on its own entry; the lot carries lines and freight.
      for (const key of ["lines", "outboundCost"])
        expect(lot.values, `owner has ${key}`).toHaveProperty(key);
      costs = Object.fromEntries(
        COST_KEYS.filter((key) => key in lot.values).map((key) => [
          key,
          lot.values[key],
        ]),
      );
    },
  );

  await step(
    page,
    "Chef House: รับ PO · รับเนื้อ · ก่อนสโมค · สโมค · ปิด Lot (ผ่าน append_entries)",
    async () => {
      account = ACCOUNTS.chef;
      await chefSmokesShipment(page, shipment, {
        received: ["100"],
        preSmokeKg: "100",
        packs: ["50", "50"],
      });
      const scoped = await load(page);
      expect(JSON.stringify(scoped)).not.toMatch(
        /"(?:lines|price|outboundCost|returnCost|meatCost|wasteCost)":/,
      );
    },
  );

  await step(
    page,
    "Owner: lines / ค่ารมควัน / ค่าขนส่ง ของ Lot ยังอยู่ครบหลัง Chef บันทึก · เรียกรถขากลับ",
    async () => {
      await as(ACCOUNTS.owner);
      const db = await load(page);
      const lot = shipmentLot(db);
      expect(lot.stage, "closed at Chef House").toBe(6);
      for (const [key, value] of Object.entries(costs))
        expect(lot.values[key], key).toEqual(value);
      const order = db.entries.find((e) => e.kind === "smokeOrder");
      expect(order?.values).toHaveProperty("estimatedCost");
      expect(order?.values).toHaveProperty("serviceRate");
      await ownerCallsReturnTruck(page, shipment, "100");
      const after = shipmentLot(await load(page));
      expect(after.values).toHaveProperty("returnCost");
      costs.returnCost = after.values.returnCost;
    },
  );

  await step(
    page,
    "Foodiva: รับเนื้อรมควันเข้าตู้ (ผ่าน append_entries)",
    async () => {
      await as(ACCOUNTS.foodiva);
      await foodivaReceivesReturn(page, shipment, { kg: "100" });
    },
  );

  let full!: Database;
  await step(
    page,
    "Owner: ต้นทุนเนื้อคืน (returnCost) และค่าอื่นของ Lot ไม่หาย · รับเข้าสต๊อกกลาง · จัดสรรศาลาแดง 100 กก.",
    async () => {
      await as(ACCOUNTS.owner);
      const lot = shipmentLot(await load(page));
      for (const [key, value] of Object.entries(costs))
        expect(lot.values[key], key).toEqual(value);
      await ownerReceivesCentral(page, "100");
      await openMenu(page, "จัดสรรเนื้อ และสต๊อกไปสาขา");
      await pointAndClick(
        page,
        page
          .locator("main")
          .getByRole("row")
          .filter({ hasText: LOT })
          .getByRole("button", { name: "จัดสรร", exact: true })
          .first(),
      );
      const dialog = page.getByRole("dialog").last();
      await typeValue(page, dialog.getByLabel("ศาลาแดง (กก.)"), "100");
      await dialog.getByLabel("วันที่ทำรายการ").fill(DAY1);
      await expect(dialog.getByLabel("วันที่ทำรายการ")).toHaveValue(DAY1);
      await saveEntry(page);
      full = await load(page);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: รับ 100 กก. · ละลาย 20 กก. · ขาย (preview ไม่มีแถวต้นทุน)",
    async () => {
      await as(ACCOUNTS.saladaeng);
      await setWorkingDate(page, DAY1);
      await button(page, "รับของ");
      await page
        .getByRole("dialog")
        .last()
        .getByLabel("ใบจัดสรรที่รับ")
        .selectOption({ index: 1 });
      await field(page, /น้ำหนักรับเข้าสาขา/, "100");
      await saveEntry(page);
      await button(page, "แบ่งละลาย");
      await field(page, /น้ำหนักละลาย/, "20");
      await saveEntry(page);
      // A sale needs cooked sticky rice in stock: buy it ready-cooked.
      await openMenu(page, "ข้าวเหนียววันนี้");
      await setWorkingDate(page, DAY1);
      await pointAndClick(
        page,
        tableSection(page, "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก")
          .getByRole("row")
          .filter({ hasText: "ซื้อข้าวเหนียวเข้าสต๊อก" })
          .getByRole("button", { name: "กรอกข้อมูล" }),
      );
      await page
        .getByRole("dialog")
        .last()
        .getByLabel(/รอบนี้ข้าวเหนียวมาจาก/)
        .selectOption("ซื้อข้าวสุกจากข้างนอก");
      await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าว phase3");
      await field(page, /ข้าวเหนียวสุกซื้อเข้า/, "30");
      await field(page, /ยอดซื้อข้าวเหนียวสุก/, "1350");
      await saveEntry(page);
      await openMenu(page, "กรอกรายวัน");
      await setWorkingDate(page, DAY1);
      await button(page, "บันทึกยอดขาย");
      const dialog = page.getByRole("dialog").last();
      await field(page, /กล่องมาตรฐาน/, "100");
      await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "15");
      await field(page, /น้ำหนักเนื้อที่เสียไป/, "1");
      await field(page, /ยอดขาย LINE MAN/, "35000");
      await field(
        page,
        /เหตุผลส่วนต่าง \/ Waste \/ ข้าม FIFO/,
        "เศษเนื้อตัดทิ้ง",
      );
      await expect(dialog).toContainText("น้ำพริกควรเหลือ");
      await expect(dialog).not.toContainText("ต้นทุนเนื้อที่ขาย");
      await expect(dialog).not.toContainText("รวมต้นทุนรายการนี้");
      await saveEntry(page);
    },
  );

  await step(
    page,
    "Owner: meatCost / wasteCost ของรายการขาย = กก. × ต้นทุน/กก. ของ Lot (คำนวณที่เซิร์ฟเวอร์)",
    async () => {
      await as(ACCOUNTS.owner);
      const db = await load(page);
      const sale = db.entries.find((e) => e.kind === "sale");
      expect(sale).toBeTruthy();
      const lot = db.lots.find((l: Lot) => l.id === sale!.lotId)!;
      const perKg = lotCost(full, lot).perKg ?? 0;
      expect(perKg).toBeGreaterThan(0);
      expect(n(sale!.values, "meatCost")).toBeCloseTo(15 * perKg, 4);
      expect(n(sale!.values, "wasteCost")).toBeCloseTo(1 * perKg, 4);
    },
  );

  await step(
    page,
    "ทุก save: Owner → save_app_state (payload) · Foodiva/Chef/สาขา → append_entries (delta)",
    async () => {
      const byAccount = (who: AccountKey) =>
        saves.filter((save) => save.account === who);
      for (const who of [ACCOUNTS.foodiva, ACCOUNTS.chef, ACCOUNTS.saladaeng]) {
        expect(byAccount(who).length, `${who} saved`).toBeGreaterThan(0);
        for (const save of byAccount(who)) {
          expect(save.body.payload, `${who} sends no payload`).toBeUndefined();
          expect(save.body.delta, `${who} appends`).toBeTruthy();
        }
      }
      expect(byAccount(ACCOUNTS.owner).length).toBeGreaterThan(0);
      for (const save of byAccount(ACCOUNTS.owner)) {
        expect(save.body.delta, "owner never appends").toBeUndefined();
        expect(save.body.payload).toBeTruthy();
      }
    },
  );
});
