import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  field,
  loadSampleData,
  openMenu,
  ownerCreatesMeatPo,
  pointAndClick,
  saveEntry,
  signInAs,
  startFresh,
  step,
  tableSection,
  type AccountKey,
} from "./helpers";
import {
  lotCost,
  n,
  saleMoneyKeys,
  type Database,
  type Entry,
} from "../../src/lib/store";

/* Review 24-09-2026, phase 3 (checklist section 8 in the vault:
 * Report/review-24-09-2026/06-test-checklist.md), on the seven-day sample set:
 *  - load_app_state is role-scoped (migration 0028): a Branch, Foodiva or Chef House
 *    account downloads only its own data, the Owner the whole payload, the Account
 *    Manager the whole payload without sale money. Asserted on what GET /api/local-db
 *    (the local lane's load_app_state) actually sends, not on the screen.
 *  - A non-owner save goes to append_entries with just its new entries; the Owner's
 *    to save_app_state. The server-side guards of append_entries (forged meat cost,
 *    wrong branch, kind not allowed, stale revision, duplicate id, unknown lot, Owner).
 * The Foodiva payment column and the cost merge after real non-owner saves are in
 * phase3-foodiva-slip.spec.ts. */

const SALADAENG = "ศาลาแดง";
const MINBURI = "มีนบุรี";
const API = "/api/local-db";

type Row = { payload: Database; revision: number };

const isLoad = (url: string, method: string) =>
  new URL(url).pathname === API && method === "GET";
const isSave = (url: string, method: string) =>
  new URL(url).pathname === API && method === "POST";

/** Reloads the page and returns what the app itself downloaded (load_app_state). */
async function appLoad(page: Page): Promise<Row> {
  const response = page.waitForResponse((r) =>
    isLoad(r.url(), r.request().method()),
  );
  await page.reload();
  return (await response).json();
}

/** load_app_state for the signed-in account, called directly (the context's cookie). */
async function load(page: Page): Promise<Row> {
  const response = await page.request.get(API);
  expect(response.ok(), `GET ${API} → ${response.status()}`).toBe(true);
  return response.json();
}

/** append_entries for the signed-in account, like appendRow in persistence.ts. */
async function append(
  page: Page,
  entries: Partial<Entry>[],
  expectedRevision: number,
  lots: unknown[] = [],
) {
  const response = await page.request.post(API, {
    data: { delta: { entries, lots }, expectedRevision },
  });
  return {
    status: response.status(),
    body: (await response.json()) as { revision?: number; message?: string },
  };
}

/** Signs in as the Account Manager (local lane only), as account-manager.spec.ts does. */
async function signInAsManager(page: Page) {
  const signOut = page.getByRole("button", { name: "ออกจากระบบ" });
  if (await signOut.count()) await pointAndClick(page, signOut);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("อีเมล").fill("manager@local.test");
  await page.getByLabel("รหัสผ่าน").fill("local-test");
  await pointAndClick(
    page,
    page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }),
  );
  await expect(page).toHaveURL(/\/owner/, { timeout: 30_000 });
  await expect(signOut).toBeVisible({ timeout: 30_000 });
}

/** A value key anywhere in the payload (also an edit's `to.` / `from.` copy). */
const keyPattern = (keys: string[]) =>
  new RegExp(`"(?:to\\.|from\\.)?(?:${keys.join("|")})":`);
const kinds = (db: Database) => new Set(db.entries.map((e) => e.kind));
const FOLLOW = ["void", "entryEdit", "editRequest", "editDecision"];

const BRANCH_KINDS = [
  "receive",
  "thaw",
  "supplyPurchase",
  "supplyIssue",
  "ricePurchase",
  "chiliPurchase",
  "riceIssue",
  "chiliIssue",
  "rice",
  "riceCarry",
  "sale",
  "influencerBox",
  "materials",
  "materialConfirm",
  "closeDay",
  "allocate",
  "chiliAllocate",
  "materialTransfer",
  "unlock",
  ...FOLLOW,
];
const CHEF_KINDS = [
  "smokingInvoice",
  "smokeOrderAccept",
  "cmReceive",
  "prepare",
  "smoke",
  "closeLot",
  "chefEdit",
  "smokeOrder",
  "packingList",
  "invoiceReview",
  "invoicePayment",
  ...FOLLOW,
];

function bangkokDate(offset = 0) {
  const now = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Bangkok" }),
  );
  now.setDate(now.getDate() + offset);
  return now.toLocaleDateString("en-CA");
}
const RICE_MENU = "ข้าวเหนียววันนี้";
const RICE_TABLE = "ข้าวเหนียว · นึ่งเอง หรือซื้อข้าวสุกจากข้างนอก";

/** Branch: one "ซื้อข้าวเหนียวเข้าสต๊อก" (steamed in house) on the working date shown. */
async function buyRawRice(page: Page, supplier: string) {
  await pointAndClick(
    page,
    tableSection(page, RICE_TABLE)
      .getByRole("row")
      .filter({ hasText: "ซื้อข้าวเหนียวเข้าสต๊อก" })
      .getByRole("button", { name: "กรอกข้อมูล" }),
  );
  await page
    .getByRole("dialog")
    .getByLabel(/รอบนี้ข้าวเหนียวมาจาก/)
    .selectOption("นึ่งเอง (ซื้อข้าวดิบ)");
  await field(page, /ผู้จำหน่ายข้าว/, supplier);
  await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "6");
  await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "330");
}

async function setWorkingDate(page: Page, date: string) {
  const input = page.getByLabel("วันที่ทำรายการ").first();
  await input.scrollIntoViewIfNeeded();
  await input.fill(date);
  await expect(input).toHaveValue(date);
}

test.beforeEach(() => {
  test.skip(
    process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
    "reads and writes the local SQLite backend (pnpm test:e2e:local)",
  );
});

test("8.1–8.4: load_app_state ส่งเฉพาะข้อมูลของ role · Owner ได้ payload เต็ม · Manager ไม่มีเงินขาย", async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await loadSampleData(page);

  let full!: Database;
  await step(
    page,
    "Owner: load_app_state = payload เต็ม มีต้นทุนครบ",
    async () => {
      full = (await appLoad(page)).payload;
      const text = JSON.stringify(full);
      for (const key of ["meatCost", "wasteCost", "estimatedCost", "lines"])
        expect(text, `owner keeps ${key}`).toMatch(keyPattern([key]));
      expect(
        full.entries.some((e) => e.kind === "sale" && e.branch === MINBURI),
      ).toBe(true);
      expect(full.entries.some((e) => e.kind === "purchase")).toBe(true);
      expect(full.lots.length).toBeGreaterThanOrEqual(2);
      // Owner's screens still show the whole log: its copy equals a direct read.
      expect((await load(page)).payload).toEqual(full);
    },
  );

  for (const [account, own, other] of [
    [ACCOUNTS.saladaeng, SALADAENG, MINBURI],
    [ACCOUNTS.minburi, MINBURI, SALADAENG],
  ] as [AccountKey, string, string][])
    await step(
      page,
      `สาขา${own}: ดาวน์โหลดแค่ Lot ที่จัดสรรให้ · ไม่มีต้นทุน · ไม่เห็นยอดขาย${other}`,
      async () => {
        await signInAs(page, account);
        const scoped = (await appLoad(page)).payload;
        const text = JSON.stringify(scoped);
        expect(
          text,
          "no meat cost, PO price, freight or smoking cost",
        ).not.toMatch(
          keyPattern([
            "meatCost",
            "wasteCost",
            "estimatedCost",
            "serviceRate",
            "price",
            "lines",
            "outboundCost",
            "returnCost",
          ]),
        );
        expect(
          scoped.entries.filter(
            (e) =>
              ["sale", "influencerBox", "closeDay", "receive"].includes(
                e.kind,
              ) && e.branch !== own,
          ),
          `no ${other} sales`,
        ).toHaveLength(0);
        expect(scoped.entries.some((e) => e.kind === "sale")).toBe(true);
        for (const kind of kinds(scoped))
          expect(BRANCH_KINDS, `kind ${kind}`).toContain(kind);
        for (const kind of [
          "purchase",
          "foodivaConfirm",
          "meatPayment",
          "smokingInvoice",
          "invoicePayment",
        ])
          expect(kinds(scoped).has(kind as Entry["kind"]), kind).toBe(false);
        const allocated = new Set(
          full.entries
            .filter((e) => e.kind === "allocate" && e.branch === own)
            .map((e) => e.lotId),
        );
        expect(new Set(scoped.lots.map((lot) => lot.id))).toEqual(allocated);
        for (const key of Object.keys(scoped.config))
          expect(key).toMatch(
            /^(branch|boxPrice|addonPrice|chiliPrice|packKg|rawRicePar|rawRiceUnitPrice|cookedRicePar|cookedRiceUnitPrice|material.*)$/,
          );
        // What the app downloaded is what the server sends this account.
        expect((await load(page)).payload).toEqual(scoped);
      },
    );

  await step(
    page,
    "Foodiva: ไม่มีต้นทุน · ไม่มียอดขาย/ของสาขา · เห็น meatPayment และราคา PO ของตัวเอง",
    async () => {
      await signInAs(page, ACCOUNTS.foodiva);
      const scoped = (await appLoad(page)).payload;
      expect(JSON.stringify(scoped)).not.toMatch(
        keyPattern([
          "meatCost",
          "wasteCost",
          "estimatedCost",
          "serviceRate",
          "returnCost",
        ]),
      );
      for (const kind of [
        "sale",
        "influencerBox",
        "receive",
        "thaw",
        "closeDay",
        "smokingInvoice",
        "invoicePayment",
        "allocate",
      ])
        expect(kinds(scoped).has(kind as Entry["kind"]), kind).toBe(false);
      expect(kinds(scoped).has("meatPayment")).toBe(true);
      const purchase = scoped.entries.find((e) => e.kind === "purchase");
      expect(
        purchase?.values.price,
        "Foodiva's own selling price",
      ).toBeTruthy();
      for (const key of Object.keys(scoped.config))
        expect(key).toMatch(
          /^(branch|companyName|companyAddress|attention|companyPhone|taxId|logoData|logoStorageKey|logoName|foodivaContact|foodivaAddress|outboundFee|roundFee)$/,
        );
    },
  );

  await step(
    page,
    "Chef House: เห็นแค่ Lot ที่มี PO รมควัน · ไม่มี lines/ราคา/ค่าขนส่ง · ไม่มีรายการของสาขา",
    async () => {
      await signInAs(page, ACCOUNTS.chef);
      const scoped = (await appLoad(page)).payload;
      expect(JSON.stringify(scoped)).not.toMatch(
        keyPattern([
          "meatCost",
          "wasteCost",
          "lines",
          "price",
          "outboundCost",
          "returnCost",
        ]),
      );
      const voided = new Set(
        full.entries
          .filter((e) => e.kind === "void" && e.role === "owner")
          .map((e) => e.values.targetId),
      );
      const smoked = new Set(
        full.entries
          .filter((e) => e.kind === "smokeOrder" && !voided.has(e.id))
          .map((e) => e.lotId),
      );
      expect(scoped.lots.length).toBeGreaterThan(0);
      for (const lot of scoped.lots) {
        expect(lot.kind).toBe("shipment");
        expect(smoked.has(lot.id), `${lot.id} has a smoke PO`).toBe(true);
      }
      const lotIds = new Set(scoped.lots.map((lot) => lot.id));
      for (const entry of scoped.entries) {
        expect(CHEF_KINDS, `kind ${entry.kind}`).toContain(entry.kind);
        if (!FOLLOW.includes(entry.kind))
          expect(
            lotIds.has(entry.lotId),
            `${entry.kind} on ${entry.lotId}`,
          ).toBe(true);
      }
    },
  );

  await step(page, "Account Manager: payload ไม่มีเงินขาย (C4)", async () => {
    await signInAsManager(page);
    const copy = (await appLoad(page)).payload;
    expect(copy.entries).toHaveLength(full.entries.length);
    for (const entry of copy.entries)
      for (const key of saleMoneyKeys)
        expect(entry.values, `${entry.kind} ${key}`).not.toHaveProperty(key);
    // Costs are not sale money: the manager keeps them.
    expect(JSON.stringify(copy)).toMatch(keyPattern(["meatCost"]));
  });
});

test("8.1 · 8.4 · 8.5: สาขาบันทึกผ่าน append_entries (ส่งแค่รายการใหม่) · Owner ผ่าน save_app_state · conflict สองเครื่องไม่ซ้ำไม่หาย", async ({
  page,
}) => {
  test.setTimeout(6 * 60_000);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await loadSampleData(page);
  const openDay = bangkokDate(-7);

  await step(
    page,
    "สาขาศาลาแดง: ซื้อข้าว → request เป็น delta มีแค่รายการใหม่ 1 รายการ",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await openMenu(page, RICE_MENU);
      await setWorkingDate(page, openDay);
      await buyRawRice(page, "ร้านข้าว phase3 A");
      const request = page.waitForRequest((r) => isSave(r.url(), r.method()), {
        timeout: 60_000,
      });
      await saveEntry(page);
      const body = (await request).postDataJSON();
      expect(body.payload, "not the whole payload").toBeUndefined();
      expect(body.delta.entries).toHaveLength(1);
      expect(body.delta.entries[0]).toMatchObject({
        kind: "ricePurchase",
        role: "branch",
        branch: SALADAENG,
      });
      expect(body.delta.lots).toEqual([]);
      await expect(page.getByRole("status")).toContainText(
        "ซื้อข้าวเหนียวเข้าสต๊อกแล้ว",
      );
    },
  );

  await step(
    page,
    "สาขาศาลาแดง 2 เครื่อง: A บันทึก แล้ว B (ข้อมูลเก่า) บันทึก → ทั้งคู่อยู่ครั้งเดียว",
    async () => {
      const other = await page.context().newPage();
      await other.goto("/branch");
      await openMenu(other, RICE_MENU);
      await setWorkingDate(other, openDay);
      // A saves first; B still holds the log it loaded before.
      await buyRawRice(page, "ร้านข้าว phase3 B");
      await saveEntry(page);
      await buyRawRice(other, "ร้านข้าว phase3 C");
      await saveEntry(other);
      const conflict = other.getByText("มีการบันทึกจากเครื่องอื่นก่อน").first();
      if (await conflict.isVisible().catch(() => false)) {
        // The loud path: reload happened, save once more.
        await buyRawRice(other, "ร้านข้าว phase3 C");
        await saveEntry(other);
      }
      await expect
        .poll(async () => {
          const log = (await load(page)).payload.entries.filter(
            (e) => e.kind === "ricePurchase" && e.date === openDay,
          );
          return ["A", "B", "C"].map(
            (tag) =>
              log.filter((e) => e.values.supplier === `ร้านข้าว phase3 ${tag}`)
                .length,
          );
        })
        .toEqual([1, 1, 1]);
      await other.close();
    },
  );

  await step(
    page,
    "Owner: บันทึกผ่าน save_app_state (ส่ง payload เต็ม) · เห็นรายการที่สาขาเพิ่ง append",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      const before = (await load(page)).payload;
      expect(
        before.entries.filter((e) =>
          String(e.values.supplier ?? "").startsWith("ร้านข้าว phase3"),
        ),
      ).toHaveLength(3);
      // Any owner save: creating a meat PO is the shortest one.
      const request = page.waitForRequest((r) => isSave(r.url(), r.method()), {
        timeout: 60_000,
      });
      await ownerCreatesMeatPo(page, "10", "250");
      const body = (await request).postDataJSON();
      expect(body.delta, "owner never appends").toBeUndefined();
      expect(body.payload.entries.length).toBe(before.entries.length + 1);
    },
  );
});

test("8.1 · 8.4 · 8.5: append_entries ฝั่งเซิร์ฟเวอร์ — คำนวณต้นทุนเนื้อใหม่ · ปฏิเสธสาขาผิด/kind ผิด/revision เก่า/id ซ้ำ/Lot ไม่มี/Owner", async ({
  page,
}) => {
  test.setTimeout(4 * 60_000);
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await loadSampleData(page);
  const today = bangkokDate();
  const sale = (id: string, branch = SALADAENG): Partial<Entry> => ({
    id,
    kind: "sale",
    role: "branch",
    lotId: lot,
    branch,
    date: today,
    at: new Date().toISOString(),
    values: { soldKg: "1", meatCost: "1", wasteCost: "1" },
  });
  let lot = "";

  await step(
    page,
    "สาขาศาลาแดง: ส่ง sale ที่ปลอม meatCost = 1 → ผ่าน แต่เซิร์ฟเวอร์คำนวณจาก Lot",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      const row = await load(page);
      lot = row.payload.lots[0].id;
      const result = await append(page, [sale("qa-forged")], row.revision);
      expect(result, JSON.stringify(result.body)).toMatchObject({
        status: 200,
        body: { revision: row.revision + 1 },
      });
      // The branch's own copy still has no cost on it.
      const mine = (await load(page)).payload.entries.find(
        (e) => e.id === "qa-forged",
      );
      expect(mine?.values).not.toHaveProperty("meatCost");
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: ปฏิเสธ revision เก่า · id ซ้ำ · Lot ไม่มี · kind dispatch",
    async () => {
      const { revision } = await load(page);
      expect(await append(page, [sale("qa-stale")], revision - 1)).toEqual({
        status: 409,
        body: {
          message: "State changed on another device. Reload and try again.",
        },
      });
      expect(
        (await append(page, [sale("qa-forged")], revision)).body.message,
      ).toBe("Entry id must be unique");
      expect(
        (
          await append(
            page,
            [{ ...sale("qa-no-lot"), lotId: "no-such-lot" }],
            revision,
          )
        ).body.message,
      ).toBe("Entry lot does not exist");
      expect(
        (
          await append(
            page,
            [{ ...sale("qa-dispatch"), kind: "dispatch", values: {} }],
            revision,
          )
        ).body.message,
      ).toBe("Entry kind is not allowed for this account");
      // Nothing above landed.
      expect((await load(page)).revision).toBe(revision);
    },
  );

  await step(page, "สาขามีนบุรี: ส่ง entry ของศาลาแดง → ปฏิเสธ", async () => {
    await signInAs(page, ACCOUNTS.minburi);
    const { revision } = await load(page);
    const result = await append(page, [sale("qa-wrong-branch")], revision);
    expect(result.status).toBe(409);
    expect(result.body.message).toBe(
      "Entry branch does not match signed-in account",
    );
  });

  await step(
    page,
    "Owner: เรียก append_entries → ปฏิเสธ · รายการปลอมมี meatCost = ต้นทุน/กก. ของ Lot, wasteCost = 0",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      const { payload, revision } = await load(page);
      const result = await append(page, [sale("qa-owner")], revision);
      expect(result.body.message).toBe(
        "Only branch, Foodiva and Chef House accounts append entries",
      );
      const forged = payload.entries.find((e) => e.id === "qa-forged")!;
      const perKg =
        lotCost(
          payload,
          payload.lots.find((l) => l.id === lot)!,
        ).perKg ?? 0;
      expect(perKg).toBeGreaterThan(1);
      expect(n(forged.values, "meatCost")).toBeCloseTo(perKg, 6);
      expect(forged.values.wasteCost).toBe("0");
      expect(
        payload.entries.some(
          (e) => e.id.startsWith("qa-") && e.id !== "qa-forged",
        ),
      ).toBe(false);
    },
  );
});
