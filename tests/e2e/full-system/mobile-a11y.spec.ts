import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  type AccountKey,
  button,
  field,
  loadSampleData,
  menuItem,
  pointAndClick,
  saveEntry,
  sidebar,
  signInAs,
  startFresh,
  step,
  tableSection,
  typeValue,
} from "../helpers";
import {
  branches,
  mutate,
  seed,
  type Database,
  type Role,
} from "../../../src/lib/store";

/* Lane H — มือถือ 390 px, คีย์บอร์ด, a11y, motion, print, dark mode (Plan §5 H1–H8).
 * Local SQLite only: sign-in is <account>@local.test (src/lib/session.ts). */
test.skip(
  process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
  "local sign-in (<account>@local.test) only exists in pnpm test:e2e:local",
);

/* ---- oracle: nav labels / tab ids (src/lib/nav.ts, src/lib/accounts.ts) ----- */
type TabDef = [id: string, label: string];
const OWNER_TABS: TabDef[] = [
  ["owner-dashboard", "แดชบอร์ด"],
  ["po", "ใบสั่งซื้อ PO"],
  ["smoke-po", "ใบสั่ง PO โรงรมควัน"],
  ["invoices", "ใบ Invoice"],
  ["transport", "ใบขนส่ง"],
  ["central-receive", "รับเนื้อเข้าสต๊อกกลาง"],
  ["branch-status", "จัดสรรเนื้อ และสต๊อกไปสาขา"],
  ["stock", "สต๊อกของทั้งหมด"],
  ["meat-log", "Log เนื้อคงเหลือ"],
  ["documents", "เอกสารและ Traceability"],
  ["report", "รายงาน"],
  ["history", "Log"],
  ["config", "ตั้งค่า"],
];
const FOODIVA_TABS: TabDef[] = [
  ["foodiva", "PO และสต๊อก Foodiva"],
  ["history", "ประวัติ"],
];
const CHEF_TABS: TabDef[] = [
  ["cm-receive", "ยืนยันรับเนื้อ"],
  ["work", "งานผลิต"],
  ["stock", "สต๊อก"],
  ["history", "ประวัติ"],
];
const BRANCH_TABS: TabDef[] = [
  ["day", "กรอกรายวัน"],
  ["stock", "สต๊อก"],
  ["branch-summary", "สรุปสาขา"],
  ["history", "ประวัติ"],
];
type Profile = { actor: string; path: string; tabs: TabDef[] };
const PROFILES: Record<AccountKey, Profile> = {
  owner: { actor: "Owner", path: "/owner", tabs: OWNER_TABS },
  foodiva: { actor: "Foodiva", path: "/foodiva", tabs: FOODIVA_TABS },
  chef: { actor: "Chef House", path: "/chef", tabs: CHEF_TABS },
  saladaeng: { actor: "สาขาศาลาแดง", path: "/branch", tabs: BRANCH_TABS },
  minburi: { actor: "สาขามีนบุรี", path: "/branch", tabs: BRANCH_TABS },
};
const ALL_ACCOUNTS = Object.keys(PROFILES) as AccountKey[];

/** PO form labels in order (src/lib/forms.ts `purchase`). Tab order must follow it. */
const PO_LABELS = [
  "ผู้ขาย · Foodiva",
  "ชื่อบริษัท / ลูกค้า",
  "ที่อยู่บริษัท / ที่อยู่ออก PO",
  "ชื่อผู้ติดต่อ (Attention)",
  "เบอร์ติดต่อ",
  "เลขประจำตัวผู้เสียภาษี",
  "ขนาดบรรจุ เช่น 6 ชิ้นต่อถุง",
  "รายการสินค้า",
  "รหัสสินค้า (เก็บหลังบ้าน / ไม่บังคับ)",
  "น้ำหนักสั่งซื้อ (กก.)",
  "ราคาเนื้อ / กก. (บาท)",
  "เลขอ้างอิงผู้ขาย",
  "หมายเหตุ",
];

const PHONE = { width: 390, height: 844 };
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const withPill = (label: string) => new RegExp(`^${escapeRe(label)}\\s*\\d*$`);
/** Same clock as the app (src/lib/format.ts `today`). */
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

/* ---- state: two shipments built with the domain core ------------------------
 * Shipment A is all the way at both branches (sale enabled today), shipment B waits
 * at the smoker (pre-smoke done → "บันทึก Lot สโมครายวัน"). Each draws on its own
 * purchase PO (Shipment Flow: PO → Invoice → Request → ใบขนส่ง + Packing List →
 * PO รมควัน → Chef House). The owner cookie lets POST /api/local-db take any
 * append-only payload (local-db.server.ts saveState). */
function pipelineState(date: string): Database {
  let db = structuredClone(seed);
  const run = (
    role: Role,
    kind: string,
    values: Record<string, string>,
    lotId = "",
    branch = "",
  ) => {
    db = mutate(db, role, kind, values, lotId, date, branch);
  };
  /** 50 kg purchase PO → Foodiva invoice → Request → truck with 50 kg in 2 boxes →
   * smoke PO → Chef House weighs in and preps; returns the shipment lot. */
  const toSmoker = () => {
    run("owner", "purchase", {
      supplier: "Foodiva",
      customerName: "บริษัท เนิร์ดเนื้อ จำกัด",
      customerAddress: "กรุงเทพฯ",
      attention: "ฝ่ายจัดซื้อ",
      phone: "0800000000",
      taxId: "0100000000000",
      packSize: "6 ชิ้นต่อถุง",
      productName: "เนื้อวัว",
      orderedKg: "50",
      price: "250",
    });
    const po = db.lots.at(-1)!.id;
    run(
      "foodiva",
      "foodivaConfirm",
      {
        invoiceNo: `INV-${po}`,
        invoiceDate: date,
        confirmedKg: "50",
        readyForChiangMaiKg: "50",
        reservedForOwnerKg: "0",
        invoiceAmount: "12500",
        attachment: "inv.pdf",
        confirmedBy: "Foodiva",
      },
      po,
    );
    run("owner", "shipmentRequest", {
      lines: JSON.stringify([{ lotId: po, kg: "50" }]),
    });
    const lotId = db.lots.at(-1)!.id;
    const boxes = "25\n25";
    run(
      "foodiva",
      "dispatch",
      {
        pickupDate: date,
        origin: "Foodiva · กรุงเทพฯ",
        destination: "Chef House · เชียงใหม่",
        trip: "ไปกลับ",
        pickupTime: "06:30",
        vehicleType: "รถห้องเย็น",
        plate: "H-01",
        driverName: "คนขับ",
        driverPhone: "0800000000",
      },
      lotId,
    );
    run(
      "foodiva",
      "packingList",
      {
        invoiceNo: `INV-${po}`,
        product: "เนื้อวัว",
        invWeightKg: "50",
        slicedLostKg: "50",
        boxes,
      },
      lotId,
    );
    run(
      "owner",
      "smokeOrder",
      {
        smoker: "Chef House",
        requestedSmokeDate: date,
        expectedFinishedDate: date,
      },
      lotId,
    );
    run("cm", "smokeOrderAccept", { acceptedBy: "Chef House" }, lotId);
    run("cm", "cmReceive", { receivedBoxes: boxes, arrival: "08:00" }, lotId);
    run("cm", "prepare", { preSmokeKg: "50" }, lotId);
    return lotId;
  };
  const a = toSmoker();
  run(
    "cm",
    "smoke",
    {
      smokeDate: date,
      inputKg: "50",
      wasteKg: "0",
      packs: Array.from({ length: 500 }, () => "0.100").join("\n"),
    },
    a,
  );
  run("cm", "closeLot", { confirm: "Chef House" }, a);
  run(
    "cm",
    "smokingInvoice",
    {
      invoiceNumber: `CH-${a}`,
      invoiceDate: date,
      serviceProvider: "Chef House",
      serviceQuantity: "50",
      vat: "770",
      withholdingTax: "330",
      netPayable: "11440",
      attachment: "ch.pdf",
    },
    a,
  );
  const invoiceId = db.entries.at(-1)!.id;
  run(
    "owner",
    "invoiceReview",
    { invoiceId, decision: "รับยอด", reviewedBy: "Owner" },
    a,
  );
  run(
    "owner",
    "invoicePayment",
    {
      invoiceId,
      paymentDate: date,
      paidAmount: "11440",
      paidBy: "Owner",
      paymentReference: "PAY",
    },
    a,
  );
  run(
    "owner",
    "return",
    {
      returnDate: date,
      returnTime: "09:00",
      origin: "Chef House · เชียงใหม่",
      destination: "Foodiva · กรุงเทพฯ",
      vehicleType: "รถห้องเย็น",
      plate: "H-02",
      driverName: "คนขับ",
      driverPhone: "0800000000",
      returnKg: "50",
    },
    a,
  );
  run(
    "foodiva",
    "foodivaReturnReceive",
    {
      receivedDate: date,
      receivedTime: "10:00",
      receivedKg: "50",
      receivedBags: "500",
    },
    a,
  );
  run("owner", "central", { centralKg: "50" }, a);
  for (const branch of branches) {
    run("owner", "allocate", { branch, deliveryDate: date, kg: "25" }, a);
    const allocation = db.entries.at(-1)!.id;
    run("branch", "receive", { kg: "25", bags: "250", allocation }, a, branch);
  }
  toSmoker();
  return db;
}

/** Signed in as the owner: replace the state and reload so the workspace shows it. */
async function pushState(page: Page, db: Database) {
  const current = await (await page.request.get("/api/local-db")).json();
  const response = await page.request.post("/api/local-db", {
    data: { payload: db, expectedRevision: current.revision },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible({
    timeout: 30_000,
  });
}

/* ---- checks ----------------------------------------------------------------- */
function collectErrors(page: Page) {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  return { pageErrors, consoleErrors };
}

async function expectTab(page: Page, p: Profile, [id, label]: TabDef) {
  await expect(page).toHaveURL(new RegExp(`${p.path}/${id}$`), {
    timeout: 30_000,
  });
  await expect(
    sidebar(page).locator('nav button[aria-current="page"]'),
  ).toHaveText(withPill(label));
  await expect(
    page.locator("main").getByRole("heading", { level: 1 }),
  ).toHaveText(label);
}

/** regression 9d066b4 / 184bd58: the page never scrolls sideways at 390 px. */
async function expectNoSidewaysScroll(page: Page) {
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    m.scrollWidth,
    `document.scrollWidth ${m.scrollWidth} > innerWidth ${m.innerWidth}`,
  ).toBeLessThanOrEqual(m.innerWidth);
}

/** regression d5985aa: no date input wider than (or past the right edge of) its parent. */
async function expectDateInputsFit(root: Page | Locator, atLeast = 0) {
  const inputs = root.locator('input[type="date"]');
  expect(await inputs.count()).toBeGreaterThanOrEqual(atLeast);
  const spilling = await inputs.evaluateAll((elements) =>
    elements
      .filter((el) => {
        const box = el.getBoundingClientRect();
        const parent = el.parentElement!.getBoundingClientRect();
        return box.width > parent.width + 0.5 || box.right > parent.right + 0.5;
      })
      .map(
        (el) =>
          el.getAttribute("aria-label") ||
          el.closest("label")?.textContent?.trim() ||
          (el as HTMLInputElement).name,
      ),
  );
  expect(spilling, "date inputs wider than their parent").toEqual([]);
}

/** H5: every control has an accessible name (label wrap, aria-label/-labelledby or
 * title), every button has a name, the dialog is labelled by its heading. A read-only
 * section (a requester's edit-request list) may have no button: pass `hasButtons: false`. */
async function expectAccessible(root: Locator, hasButtons = true) {
  const nameless = await root
    .locator('input:not([type="hidden"]), select, textarea')
    .evaluateAll((elements) =>
      elements
        .filter((el) => {
          const control = el as HTMLInputElement;
          const byId = control.getAttribute("aria-labelledby");
          const name =
            control.getAttribute("aria-label") ||
            (byId && document.getElementById(byId)?.textContent) ||
            [...(control.labels ?? [])]
              .map((label) => label.textContent)
              .join(" ") ||
            control.getAttribute("title") ||
            "";
          return !name.trim();
        })
        .map((el) => {
          const control = el as HTMLInputElement;
          return `${control.tagName.toLowerCase()}[type=${control.type}][name=${control.name}]`;
        }),
    );
  expect(nameless, "controls without an accessible name").toEqual([]);
  for (const role of ["textbox", "combobox", "spinbutton"] as const) {
    const all = await root.getByRole(role).count();
    const named = await root.getByRole(role, { name: /\S/ }).count();
    expect(all - named, `${role} without a name`).toBe(0);
  }
  const buttons = await root.getByRole("button").count();
  if (hasButtons) expect(buttons).toBeGreaterThan(0);
  expect(await root.getByRole("button", { name: /\S/ }).count()).toBe(buttons);
}

/** H2: the open dialog is a full-screen sheet inside the 390×844 viewport (c17cd28),
 * its scrolling body never scrolls sideways (9d066b4), its controls are ≥ 16 px so
 * iOS does not zoom (184bd58), and the submit button is on screen and enabled. */
async function expectPhoneDialog(page: Page, title: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const heading = dialog.getByRole("heading", { level: 2, name: title });
  await expect(heading).toBeVisible();
  expect(await dialog.getAttribute("aria-labelledby")).toBe(
    await heading.getAttribute("id"),
  );
  // รอ enter transition (scale/translate) จบก่อนวัดขนาด
  await expect
    .poll(() => dialog.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  const box = (await dialog.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width + 0.5);
  expect(box.y + box.height).toBeLessThanOrEqual(PHONE.height + 0.5);
  const overflow = await dialog.evaluate((el) => {
    const body = el.querySelector(".overflow-auto") ?? el;
    return {
      dialog: el.scrollWidth - el.clientWidth,
      body: body.scrollWidth - body.clientWidth,
    };
  });
  expect(overflow.dialog, "dialog scrolls sideways").toBeLessThanOrEqual(1);
  expect(overflow.body, "dialog body scrolls sideways").toBeLessThanOrEqual(1);
  const small = await dialog
    .locator('input:not([type="file"]):not([type="hidden"]), select, textarea')
    .evaluateAll((elements) =>
      elements
        .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16)
        .map((el) => (el as HTMLInputElement).name || el.tagName),
    );
  expect(small, "controls under 16px (iOS zooms the form)").toEqual([]);
  const submit = dialog.locator('button[type="submit"]').last();
  await expect(submit).toBeVisible();
  await expect(submit).toBeEnabled();
  await expect(submit).toBeInViewport();
  await expectNoSidewaysScroll(page);
  await expectDateInputsFit(dialog);
  await expectAccessible(dialog);
  return dialog;
}

async function cancelDialog(page: Page) {
  await pointAndClick(
    page,
    page.getByRole("dialog").getByRole("button", { name: "ยกเลิก" }),
  );
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** Longest value of a comma-separated CSS time list ("0.32s, 0.2s") in seconds. */
const longest = (times: string) =>
  Math.max(
    ...times.split(",").map((time) => {
      const t = time.trim();
      return t.endsWith("ms") ? parseFloat(t) / 1000 : parseFloat(t);
    }),
  );
const transitionSeconds = (locator: Locator) =>
  locator
    .evaluate((el) => getComputedStyle(el).transitionDuration)
    .then(longest);

async function everyTab(
  page: Page,
  account: AccountKey,
  check: (p: Profile, tab: TabDef) => Promise<void>,
) {
  const p = PROFILES[account];
  await step(page, `${p.actor}: เข้าสู่ระบบ`, () => signInAs(page, account));
  for (const tab of p.tabs) {
    await step(
      page,
      `${p.actor}: เมนู "${tab[1]}" → ${p.path}/${tab[0]}`,
      async () => {
        await pointAndClick(page, menuItem(page, tab[1]));
        await expectTab(page, p, tab);
        await check(p, tab);
      },
    );
  }
}

/* ============================ มือถือ 390 × 844 ============================== */
test.describe("มือถือ 390 px", () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

  test("H1 H3 ทุก role ทุก tab บนมือถือ: เมนูครบและกดได้ หน้าไม่เลื่อนแนวนอน ช่องวันที่ไม่ล้น ไม่มี pageerror", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await startFresh(page);
    await step(page, "ระบบ: โหลดข้อมูลตัวอย่าง 7 วัน", () =>
      loadSampleData(page),
    );
    for (const account of ALL_ACCOUNTS) {
      await everyTab(page, account, async (p) => {
        // ponytail: below md the sidebar is a wrapped block above <main> (AppSidebar
        // max-md:block), there is no open/close toggle — "usable" means visible + clickable.
        await expect(sidebar(page)).toBeVisible();
        await expect(
          sidebar(page).locator("nav").getByRole("button"),
        ).toHaveCount(p.tabs.length);
        await expectNoSidewaysScroll(page);
        await expectDateInputsFit(page, 1);
      });
    }
    expect(errors.pageErrors).toEqual([]);
    expect(errors.consoleErrors).toEqual([]);
  });

  test("H2 H3 H5 dialog หลักบนมือถือ: เต็มจอ ไม่เลื่อนแนวนอน ปุ่มบันทึกอยู่ในจอ ทุกช่องมีชื่อ และบันทึกได้จริง (PO เนื้อ, Invoice, Log สโมค, ยอดขาย, เช็ควัสดุ, ตั้งค่า)", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await startFresh(page);
    await step(page, "Owner: เข้าสู่ระบบ", () =>
      signInAs(page, ACCOUNTS.owner),
    );
    await step(
      page,
      "ระบบ: เตรียม Lot A ถึงสาขาทั้งสอง และ Lot B รอสโมคที่ Chef House",
      () => pushState(page, pipelineState(today())),
    );

    await step(page, "Owner: เปิด สร้าง PO เนื้อ → dialog เต็มจอ", async () => {
      await button(page, "ใบสั่งซื้อ PO");
      await button(page, "สร้าง PO เนื้อ");
      await expectPhoneDialog(page, "สร้าง PO เนื้อ");
    });
    await step(
      page,
      "Owner: กรอก PO เนื้อ 500 กก. แล้วบันทึกบนมือถือ",
      async () => {
        await field(page, /ผู้ขาย · Foodiva/, "Foodiva");
        await field(page, /ชื่อบริษัท \/ ลูกค้า/, "บริษัท เนิร์ดเนื้อ จำกัด");
        await field(page, /ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร");
        await field(page, /ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ");
        await field(page, /เบอร์ติดต่อ/, "0800000000");
        await field(page, /เลขประจำตัวผู้เสียภาษี/, "0100000000000");
        await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อถุง");
        await field(page, /น้ำหนักสั่งซื้อ/, "500");
        await field(page, /ราคาเนื้อ/, "250");
        await expect(
          page
            .getByRole("dialog")
            .getByRole("button", { name: "บันทึก PO เนื้อ" }),
        ).toBeInViewport();
        await saveEntry(page);
        const row = tableSection(page, "รายการใบสั่งซื้อ PO")
          .getByRole("row")
          .filter({ hasText: "500.00 กก." });
        await expect(row).toHaveCount(1);
        await expect(row).toContainText(
          "บริษัท เนิร์ดเนื้อ จำกัด / ฝ่ายจัดซื้อ",
        );
        // Shipment Flow: a purchase PO has no stage; it waits for Foodiva's invoice
        // ("รอยืนยัน") and has nothing to send to Chef House until then ("—").
        await expect(row).toContainText("รอยืนยัน");
        await expect(row.getByRole("cell").nth(7)).toHaveText("—");
        await expectNoSidewaysScroll(page);
      },
    );

    await step(
      page,
      "Foodiva: เข้าสู่ระบบ → เปิด ออกและอัปโหลด Invoice เนื้อ ของ PO ใหม่",
      async () => {
        await signInAs(page, ACCOUNTS.foodiva);
        await button(page, "ออกและอัปโหลด Invoice");
        const dialog = await expectPhoneDialog(
          page,
          "ออกและอัปโหลด Invoice เนื้อ",
        );
        await expectDateInputsFit(dialog, 1);
        await field(page, /เลข Invoice เนื้อ/, "FD-INV-H2");
        await expect(
          dialog.locator('button[type="submit"]').last(),
        ).toBeInViewport();
      },
    );
    await step(page, "Foodiva: ยกเลิก → ไม่มี Invoice ถูกบันทึก", async () => {
      await cancelDialog(page);
      await expect(
        page.getByRole("button", { name: "ออกและอัปโหลด Invoice" }),
      ).toHaveCount(1);
    });

    await step(
      page,
      "Chef House: เข้าสู่ระบบ → งานผลิต → เปิด บันทึก Lot สโมครายวัน",
      async () => {
        await signInAs(page, ACCOUNTS.chef);
        await pointAndClick(page, menuItem(page, "งานผลิต"));
        await button(page, "บันทึก Lot สโมครายวัน");
        const dialog = await expectPhoneDialog(page, "บันทึก Lot สโมครายวัน");
        await expectDateInputsFit(dialog, 1);
        await field(page, /น้ำหนักเข้าเตารอบนี้/, "10");
        await expect(
          dialog.locator('button[type="submit"]').last(),
        ).toBeInViewport();
      },
    );
    await step(page, "Chef House: ยกเลิก → Lot ยังรอสโมค", async () => {
      await cancelDialog(page);
      await expect(
        page.getByRole("button", { name: "บันทึก Lot สโมครายวัน" }),
      ).toHaveCount(1);
    });

    await step(
      page,
      "สาขาศาลาแดง: เข้าสู่ระบบ → เปิด บันทึกยอดขาย / Waste",
      async () => {
        await signInAs(page, ACCOUNTS.saladaeng);
        const row = tableSection(page, "ยอดขายและกล่องโปรโมท")
          .getByRole("row")
          .filter({ hasText: "บันทึกยอดขาย / Waste" });
        await pointAndClick(
          page,
          row.getByRole("button", { name: "กรอกข้อมูล" }),
        );
        const dialog = await expectPhoneDialog(page, "บันทึกยอดขาย / Waste");
        await field(page, /กล่องมาตรฐาน/, "3");
        await expect(
          dialog.locator('button[type="submit"]').last(),
        ).toBeInViewport();
      },
    );
    await step(page, "สาขาศาลาแดง: ยกเลิก → ยังไม่มียอดขายวันนี้", async () => {
      await cancelDialog(page);
      await expect(
        tableSection(page, "ยอดขายและกล่องโปรโมท")
          .getByRole("row")
          .filter({ hasText: "บันทึกยอดขาย / Waste" }),
      ).toContainText("รอบันทึก");
    });
    await step(
      page,
      "สาขาศาลาแดง: เช็ควัสดุ 7 รายการ (ตารางในหน้า) ทุกช่องมีชื่อ ปุ่มบันทึกกดได้ และบันทึกสำเร็จ",
      async () => {
        // ponytail: "เช็ควัสดุ 7 รายการ" is an inline table (DailyMaterialsTable), not a dialog.
        const section = tableSection(page, "วัสดุ 7 รายการ · กรอกการใช้วันนี้");
        await expect(section).toBeVisible();
        await expectAccessible(section);
        const used = section.getByLabel(/^จำนวนใช้ .* วันนี้$/).first();
        await typeValue(page, used, "0");
        const save = section.getByRole("button", { name: "บันทึกการใช้วัสดุ" });
        await save.scrollIntoViewIfNeeded();
        await expect(save).toBeEnabled();
        await expect(save).toBeInViewport();
        await expectNoSidewaysScroll(page);
        await pointAndClick(page, save);
        // The success Notice renders after the DataTable section (DailyMaterialsTable), not inside it.
        await expect(
          page.getByText("บันทึกการใช้วัสดุวันนี้แล้ว"),
        ).toBeVisible();
        await expect(
          section.getByRole("row").filter({ hasText: "บันทึกแล้ว" }),
        ).toHaveCount(7);
        await expect(
          section.getByRole("button", { name: "บันทึกแก้ไข" }),
        ).toBeVisible();
      },
    );

    await step(
      page,
      "Owner: เข้าสู่ระบบ → ตั้งค่า → ขอแก้ไข ราคาและการขาย",
      async () => {
        // ponytail: settings edit inline (ConfigView), there is no dialog — same checks on the section.
        await signInAs(page, ACCOUNTS.owner);
        await pointAndClick(page, menuItem(page, "ตั้งค่า"));
        const section = tableSection(page, "ราคาและการขาย (Pricing & sales)");
        await pointAndClick(
          page,
          section.getByRole("button", { name: "ขอแก้ไข (Request edit)" }),
        );
        await expectAccessible(section);
        await field(page, "boxPrice", "360");
        const save = section.getByRole("button", {
          name: "บันทึกและล็อก (Save & lock)",
        });
        await expect(save).toBeEnabled();
        await expect(save).toBeInViewport();
        await expectNoSidewaysScroll(page);
      },
    );
    await step(page, "Owner: ยกเลิก → ราคากล่องยังเป็น 350", async () => {
      const section = tableSection(page, "ราคาและการขาย (Pricing & sales)");
      await pointAndClick(
        page,
        section.getByRole("button", { name: "ยกเลิก (Cancel)" }),
      );
      await expect(section.getByLabel("boxPrice")).toHaveCount(0);
      await expect(section).toContainText("350");
      await expect(section).not.toContainText("360");
    });
    expect(errors.pageErrors).toEqual([]);
  });

  test("H6 reduce-motion บนมือถือ: dialog PO ขึ้นทันที (≤ 1 ms) และกลับมาเคลื่อนไหวเมื่อปิด reduce-motion", async ({
    page,
  }) => {
    await startFresh(page);
    await step(page, "Owner: เข้าสู่ระบบ → ใบสั่งซื้อ PO", async () => {
      await signInAs(page, ACCOUNTS.owner);
      await button(page, "ใบสั่งซื้อ PO");
    });
    await step(
      page,
      "Owner: reduce-motion → เปิด dialog PO → transition ≤ 1 ms",
      async () => {
        await page.emulateMedia({ reducedMotion: "reduce" });
        await button(page, "สร้าง PO เนื้อ");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        expect(await transitionSeconds(dialog)).toBeLessThanOrEqual(0.001);
        expect(
          await dialog.evaluate((el) => getComputedStyle(el).opacity),
        ).toBe("1");
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      },
    );
    await step(
      page,
      "Owner: ปิด reduce-motion → dialog PO กลับมามี transition",
      async () => {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await button(page, "สร้าง PO เนื้อ");
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        expect(await transitionSeconds(dialog)).toBeGreaterThan(0.001);
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
      },
    );
  });
});

/** Branch Day state on top of pipelineState: ศาลาแดง thaws 5 kg today and asks to edit
 * it (Owner rejects with a note); Foodiva asks to edit its meat invoice (waiting). So
 * every bell has something in it and the new tables have rows. */
function bellState(date: string): Database {
  let db = pipelineState(date);
  const lotId = db.entries.find(
    (e) => e.kind === "receive" && e.branch === "ศาลาแดง",
  )!.lotId;
  db = mutate(
    db,
    "branch",
    "thaw",
    { kg: "5", bags: "50" },
    lotId,
    date,
    "ศาลาแดง",
  );
  const thaw = db.entries.at(-1)!;
  db = mutate(
    db,
    "branch",
    "editRequest",
    {
      targetId: thaw.id,
      values: JSON.stringify({ kg: "4", bags: "40" }),
      reason: "ละลายน้อยกว่าที่บันทึก",
    },
    lotId,
    date,
    "ศาลาแดง",
  );
  db = mutate(
    db,
    "owner",
    "editDecision",
    {
      requestId: db.entries.at(-1)!.id,
      decision: "ไม่อนุมัติ",
      note: "ตรวจแล้วละลาย 5 กก. จริง",
    },
    "",
    date,
  );
  const invoice = db.entries.find((e) => e.kind === "foodivaConfirm")!;
  db = mutate(
    db,
    "foodiva",
    "editRequest",
    {
      targetId: invoice.id,
      values: JSON.stringify({ confirmedBy: "Foodiva ฝ่ายขาย" }),
      reason: "ชื่อผู้ยืนยันผิด",
    },
    invoice.lotId,
    date,
  );
  return db;
}

/** The bell's list opens inside the phone screen, has names on every control and
 * does not push the page sideways; closes it again. */
async function expectPhoneBell(page: Page, text?: string) {
  const bell = page.getByRole("button", { name: /^การแจ้งเตือน/ });
  await expect(bell).toBeVisible();
  await pointAndClick(page, bell);
  const list = page.getByLabel("รายการที่ต้องทำต่อ");
  await expect(list).toBeVisible();
  await expect
    .poll(() => list.evaluate((el) => getComputedStyle(el).opacity))
    .toBe("1");
  if (text) await expect(list).toContainText(text);
  const box = (await list.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(PHONE.width + 0.5);
  await expectAccessible(list);
  await expectNoSidewaysScroll(page);
  await pointAndClick(
    page,
    list.getByRole("button", { name: "ปิด", exact: true }),
  );
  await expect(list).toHaveCount(0);
}

/** A new table section on a phone: visible, every control named, and the page itself
 * does not scroll sideways (wide tables scroll inside their frame). */
async function expectPhoneSection(
  page: Page,
  title: string | RegExp,
  text?: string,
) {
  const section = tableSection(page, title);
  await section.scrollIntoViewIfNeeded();
  await expect(section).toBeVisible();
  if (text) await expect(section).toContainText(text);
  await expectAccessible(section, false);
  await expectNoSidewaysScroll(page);
}

/** B4 "สรุปคงเหลือเนื้อ รายวัน / รายล็อต" is a heading, a filter bar and two tables
 * (no section of its own): the date filter is named, both tables pass the section checks. */
async function expectPhoneStockSummary(page: Page) {
  await expect(
    page.getByRole("heading", { name: "สรุปคงเหลือเนื้อ รายวัน / รายล็อต" }),
  ).toBeVisible();
  await expect(page.getByLabel("ยอด ณ สิ้นวันที่")).toBeVisible();
  await expectPhoneSection(page, /^คงเหลือแยก Lot · /, "รวม");
  await expectPhoneSection(page, /^ย้อนหลัง 14 วัน · /);
}

test.describe("มือถือ 390 px · กระดิ่งและตารางใหม่", () => {
  test.use({ viewport: PHONE, isMobile: true, hasTouch: true });

  test("H9 กระดิ่งทุก role · เนื้อละลายวันนี้ · สรุปคงเหลือเนื้อ · แผงคำขอแก้ไข บนมือถือ: อยู่ในจอ มีชื่อทุกช่อง ไม่เลื่อนแนวนอน", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    const date = today();
    await startFresh(page);
    await step(
      page,
      "Owner: เข้าสู่ระบบ → ใส่ข้อมูล Branch Day + คำขอแก้ไข",
      async () => {
        await signInAs(page, ACCOUNTS.owner);
        await pushState(page, bellState(date));
      },
    );
    await step(
      page,
      "Owner: กระดิ่งคำขอรอพิจารณา · แผงคำขอใน Log · สรุปคงเหลือเนื้อในสต๊อก",
      async () => {
        await expectPhoneBell(page, "คำขอแก้ไขรอพิจารณา 1 รายการ");
        await pointAndClick(page, menuItem(page, "Log"));
        await expectPhoneSection(page, "คำขอแก้ไขรายการ", "รอพิจารณา 1 รายการ");
        await pointAndClick(page, menuItem(page, "สต๊อกของทั้งหมด"));
        await expectPhoneStockSummary(page);
      },
    );
    await step(
      page,
      "Foodiva: กระดิ่งคำขอรอพิจารณา · แผงคำขอในประวัติ",
      async () => {
        await signInAs(page, ACCOUNTS.foodiva);
        await expectPhoneBell(page, "คำขอแก้ไขรอพิจารณา");
        await pointAndClick(page, menuItem(page, "ประวัติ"));
        await expectPhoneSection(page, "คำขอแก้ไขรายการ", "รอพิจารณา");
      },
    );
    await step(
      page,
      "Chef House: กระดิ่ง (ว่าง) · แผงคำขอในประวัติ",
      async () => {
        await signInAs(page, ACCOUNTS.chef);
        await expectPhoneBell(page);
        await pointAndClick(page, menuItem(page, "ประวัติ"));
        await expectPhoneSection(page, "คำขอแก้ไขรายการ", "ยังไม่มีคำขอแก้ไข");
      },
    );
    await step(
      page,
      "สาขาศาลาแดง: กระดิ่งไม่สำเร็จ · เนื้อละลายวันนี้ · สรุปคงเหลือเนื้อ · แผงคำขอ",
      async () => {
        await signInAs(page, ACCOUNTS.saladaeng);
        await expectPhoneBell(page, "คำขอแก้ไขไม่สำเร็จ");
        await expectPhoneSection(
          page,
          `เนื้อละลายวันนี้ · ${date} · ศาลาแดง`,
          "5.00 กก.",
        );
        await pointAndClick(page, menuItem(page, "สต๊อก"));
        await expectPhoneStockSummary(page);
        await pointAndClick(page, menuItem(page, "ประวัติ"));
        await expectPhoneSection(
          page,
          "คำขอแก้ไขรายการ",
          "ตรวจแล้วละลาย 5 กก. จริง",
        );
      },
    );
    expect(errors.pageErrors).toEqual([]);
  });
});

/* ============================ คีย์บอร์ด (desktop) ============================ */
test("H4 คีย์บอร์ด: Enter บนปุ่มเปิด PO เนื้อ · Tab ไล่ช่องตามลำดับ label · Esc ปิดและ focus คืนปุ่ม · Enter ในช่องสุดท้ายบันทึก PO", async ({
  page,
}) => {
  await startFresh(page);
  const opener = page.getByRole("button", { name: "สร้าง PO เนื้อ" }).last();
  const dialog = page.getByRole("dialog");
  const activeLabel = () =>
    page.evaluate(() => {
      const el = document.activeElement as HTMLInputElement | null;
      return (
        el?.getAttribute("aria-label") ||
        el?.labels?.[0]?.textContent?.trim() ||
        el?.textContent?.trim() ||
        ""
      );
    });

  await step(page, "Owner: เข้าสู่ระบบ → ใบสั่งซื้อ PO", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await pointAndClick(page, menuItem(page, "ใบสั่งซื้อ PO"));
    await expect(opener).toBeVisible();
  });
  /** Focus lands inside the dialog, on the first field (E2E-H2 fixed). */
  const focusFirstField = async () => {
    expect(
      await dialog.evaluate((el) => el.contains(document.activeElement)),
    ).toBe(true);
    expect(await activeLabel()).toMatch(
      new RegExp(`^${escapeRe(PO_LABELS[0])}`),
    );
  };

  await step(
    page,
    "Owner: focus ปุ่ม สร้าง PO เนื้อ → Enter → dialog เปิด focus อยู่ใน dialog แล้วถึงช่องแรก",
    async () => {
      await opener.focus();
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await focusFirstField();
    },
  );
  await step(
    page,
    "Owner: Tab ไล่ช่องครบ 13 ช่องตามลำดับ label แล้วถึง ยกเลิก / บันทึก PO เนื้อ",
    async () => {
      for (const label of PO_LABELS.slice(1)) {
        await page.keyboard.press("Tab");
        expect(await activeLabel()).toMatch(new RegExp(`^${escapeRe(label)}`));
      }
      // The live preview <aside> scrolls on desktop (lg:overflow-auto), so Chrome makes it a tab stop.
      await page.keyboard.press("Tab");
      expect(await activeLabel()).toBe("ตัวอย่างเอกสาร PO");
      await page.keyboard.press("Tab");
      expect(await activeLabel()).toBe("ยกเลิก");
      await page.keyboard.press("Tab");
      expect(await activeLabel()).toBe("บันทึก PO เนื้อ");
    },
  );
  await step(
    page,
    "Owner: Esc → dialog ปิด focus กลับปุ่ม สร้าง PO เนื้อ",
    async () => {
      await page.keyboard.press("Escape");
      await expect(dialog).toHaveCount(0);
      await expect(opener).toBeFocused();
    },
  );
  await step(
    page,
    "Owner: Enter เปิดใหม่ พิมพ์ด้วยคีย์บอร์ดล้วน แล้ว Enter ในช่องสุดท้าย (เลขอ้างอิงผู้ขาย) บันทึก PO",
    async () => {
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await focusFirstField();
      const values: Record<string, string> = {
        "ผู้ขาย · Foodiva": "Foodiva",
        "ชื่อบริษัท / ลูกค้า": "บริษัท คีย์บอร์ด จำกัด",
        "ที่อยู่บริษัท / ที่อยู่ออก PO": "กรุงเทพฯ",
        "ชื่อผู้ติดต่อ (Attention)": "ฝ่ายจัดซื้อ",
        เบอร์ติดต่อ: "0800000000",
        เลขประจำตัวผู้เสียภาษี: "0100000000000",
        "ขนาดบรรจุ เช่น 6 ชิ้นต่อถุง": "6 ชิ้นต่อถุง",
        รายการสินค้า: "เนื้อวัว",
        "น้ำหนักสั่งซื้อ (กก.)": "120",
        "ราคาเนื้อ / กก. (บาท)": "250",
      };
      for (const label of PO_LABELS.slice(0, 12)) {
        expect(await activeLabel()).toMatch(new RegExp(`^${escapeRe(label)}`));
        // The PO dialog re-renders its preview on every keystroke: type slowly.
        if (values[label])
          await page.keyboard.type(values[label], { delay: 20 });
        if (label !== "เลขอ้างอิงผู้ขาย") await page.keyboard.press("Tab");
      }
      await page.keyboard.press("Enter");
      await expect(dialog).toHaveCount(0);
      const row = tableSection(page, "รายการใบสั่งซื้อ PO")
        .getByRole("row")
        .filter({ hasText: "บริษัท คีย์บอร์ด จำกัด" });
      await expect(row).toHaveCount(1);
      await expect(row).toContainText("120.00 กก.");
      // Waits for Foodiva's invoice (Shipment Flow: purchase POs have no stage).
      await expect(row).toContainText("รอยืนยัน");
    },
  );
});

test("H4 เปิด dialog PO เนื้อ แล้ว focus ต้องอยู่ที่ช่องแรก (autoFocus) ไม่ใช่ปุ่มปิดฟอร์ม (E2E-H2)", async ({
  page,
}) => {
  await startFresh(page);
  await step(
    page,
    "Owner: เข้าสู่ระบบ → ใบสั่งซื้อ PO → Enter บนปุ่ม สร้าง PO เนื้อ",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      await pointAndClick(page, menuItem(page, "ใบสั่งซื้อ PO"));
      await page.getByRole("button", { name: "สร้าง PO เนื้อ" }).last().focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.getByLabel(PO_LABELS[0]).last()).toBeFocused();
    },
  );
});

/* ============================ print (desktop) ================================ */
test("H7 พิมพ์ PO: popup พิมพ์มีเฉพาะเอกสาร PO (ไม่มี sidebar/ปุ่ม) และยังแสดงเอกสารใน print media", async ({
  page,
  context,
}) => {
  await startFresh(page);
  await step(page, "ระบบ: โหลดข้อมูลตัวอย่าง 7 วัน", () =>
    loadSampleData(page),
  );
  await step(page, "Owner: เข้าสู่ระบบ → ใบสั่งซื้อ PO", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await pointAndClick(page, menuItem(page, "ใบสั่งซื้อ PO"));
  });
  // The popup calls window.print() once the web font settled: stub it so headless never
  // blocks on a print dialog, and fail the Google Fonts request fast.
  await context.addInitScript(() => {
    window.print = () => {};
  });
  await context.route("**/fonts.googleapis.com/**", (route) => route.abort());
  const poNumber = (
    await tableSection(page, "รายการใบสั่งซื้อ PO")
      .getByRole("row")
      .nth(1)
      .getByRole("cell")
      .first()
      .innerText()
  ).trim();
  await step(
    page,
    `Owner: กด พิมพ์ / PDF ของ ${poNumber} → popup มีเฉพาะเอกสาร`,
    async () => {
      const popupPromise = context.waitForEvent("page");
      await pointAndClick(
        page,
        tableSection(page, "รายการใบสั่งซื้อ PO")
          .getByRole("button", { name: "พิมพ์ / PDF" })
          .first(),
      );
      const popup = await popupPromise;
      const paper = popup.locator(".po-paper");
      await expect(paper).toBeVisible({ timeout: 30_000 });
      await expect(paper).toContainText("PURCHASE ORDER");
      await expect(paper).toContainText(poNumber);
      await expect(popup.locator("aside, nav, button")).toHaveCount(0);
      await expect(popup.getByRole("button")).toHaveCount(0);
      await expect(popup.locator("body > *")).toHaveCount(1);
      await popup.emulateMedia({ media: "print" });
      await expect(paper).toBeVisible();
      await expect(popup.locator("body")).toContainText(poNumber);
      await popup.close();
    },
  );
});

/* ============================ dark mode ====================================== */
test.describe("dark mode", () => {
  test.use({ colorScheme: "dark" });

  test("H8 dark mode ทุก role ทุก tab: เรนเดอร์ได้ ไม่มี pageerror (screenshot ทุก tab สำหรับตรวจด้วยตา)", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    // ponytail: the theme is `html.dark` (globals.css/tokens.css) with no user toggle,
    // so switch it on the way Storybook does; colorScheme: "dark" alone changes nothing.
    // Init scripts run before <html> exists, so wait for the DOM.
    await page.addInitScript(() =>
      document.addEventListener("DOMContentLoaded", () =>
        document.documentElement.classList.add("dark"),
      ),
    );
    await startFresh(page);
    await step(page, "ระบบ: โหลดข้อมูลตัวอย่าง 7 วัน", () =>
      loadSampleData(page),
    );
    for (const account of ALL_ACCOUNTS) {
      await everyTab(page, account, async () => {
        expect(
          await page.evaluate(
            () => getComputedStyle(document.documentElement).colorScheme,
          ),
        ).toBe("dark");
        expect(errors.pageErrors).toEqual([]);
      });
    }
    expect(errors.pageErrors).toEqual([]);
    // The injected html.dark class itself makes React report a hydration mismatch on <html>.
    expect(
      errors.consoleErrors.filter(
        (message) =>
          !(
            message.includes("hydration-mismatch") &&
            message.includes("antialiased dark")
          ),
      ),
    ).toEqual([]);
  });
});
