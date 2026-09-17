import { statSync } from "node:fs";
import {
  expect,
  test,
  type Browser,
  type Locator,
  type Page,
} from "@playwright/test";
import {
  ACCOUNTS,
  button,
  field,
  foodivaIssuesInvoice,
  INVOICE_FIXTURE,
  menuItem,
  ownerCreatesMeatPo,
  ownerIssuesSmokePo,
  pointAndClick,
  saveEntry,
  signInAs,
  startFresh,
  step,
  tableSection,
} from "../helpers";
import {
  availableBags,
  mutate,
  seed,
  type Database,
  type Role,
} from "../../../src/lib/store";

/* Lane G (vault: Testing/E2E Full System/17-09-2026/Plan.md §5): what a save
 * leaves behind — reload and sign-in survival, the success/failure toast, two
 * owners racing on one revision, stage and bag guards, the local-db API guards
 * (a JS port of save_app_state), attachments and a save while offline. */

test.skip(
  process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
  "local sign-in (<account>@local.test) and /api/local-db only exist in pnpm test:e2e:local",
);

/** Same clock as the app (src/lib/format.ts `today`). */
const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });

const dialog = (page: Page) => page.getByRole("dialog").last();
const tab = (page: Page, label: string) =>
  pointAndClick(page, menuItem(page, label));
const rowIn = (page: Page, title: string, text: string | RegExp) =>
  tableSection(page, title).getByRole("row").filter({ hasText: text });
const rowButton = (page: Page, rowText: string, name = "กรอกข้อมูล") =>
  page.getByRole("row").filter({ hasText: rowText }).getByRole("button", { name });
const formAlert = (page: Page, text: string | RegExp) =>
  dialog(page).getByRole("alert").filter({ hasText: text });
const successToast = (page: Page, text: string | RegExp) =>
  page.getByRole("main").getByRole("status").filter({ hasText: text });

type Row = { payload: Database; revision: number };
async function serverState(page: Page): Promise<Row> {
  const response = await page.request.get("/api/local-db");
  expect(response.ok()).toBe(true);
  return response.json();
}
const kinds = (db: Database, kind: string) =>
  db.entries.filter((entry) => entry.kind === kind);

async function reloadWorkspace(page: Page) {
  await page.reload();
  await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toBeVisible({
    timeout: 30_000,
  });
}

/* ---- state built with the domain core, written as the owner ---------------- */
type Stop = "paid" | "central";
/** One 50 kg lot. "paid": smoke invoice paid, the next step is the outbound
 * dispatch (stage 1). "central": 5 × 10 kg bags in central stock (stage 8). */
function lotState(stop: Stop): Database {
  const date = today();
  let db = structuredClone(seed);
  const run = (role: Role, kind: string, values: Record<string, string>, lotId = "") => {
    db = mutate(db, role, kind, values, lotId, date, "");
  };
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
  const lotId = db.lots.at(-1)!.id;
  run("foodiva", "foodivaConfirm", {
    invoiceNo: "INV-G",
    invoiceDate: date,
    confirmedKg: "50",
    readyForChiangMaiKg: "50",
    reservedForOwnerKg: "0",
    invoiceAmount: "12500",
    attachment: "inv.pdf",
    confirmedBy: "Foodiva",
  }, lotId);
  run("owner", "smokeOrder", {
    smoker: "Chef_house",
    rawKg: "50",
    requestedSmokeDate: date,
    expectedFinishedDate: date,
  }, lotId);
  run("cm", "smokeOrderAccept", { acceptedBy: "Chef_house" }, lotId);
  run("cm", "smokingInvoice", {
    invoiceNumber: "CH-G",
    invoiceDate: date,
    serviceProvider: "Chef_house",
    serviceQuantity: "50",
    vat: "770",
    withholdingTax: "330",
    netPayable: "11440",
    attachment: "ch.pdf",
  }, lotId);
  const invoiceId = db.entries.at(-1)!.id;
  run("owner", "invoiceReview", { invoiceId, decision: "รับยอด", reviewedBy: "Owner" }, lotId);
  run("owner", "invoicePayment", {
    invoiceId,
    paymentDate: date,
    paidAmount: "11440",
    paidBy: "Owner",
    paymentReference: "PAY",
  }, lotId);
  if (stop === "paid") return db;
  run("owner", "dispatch", {
    dispatchKg: "50",
    pickupDate: date,
    origin: "Foodiva · กรุงเทพฯ",
    destination: "Chef_house · เชียงใหม่",
    trip: "ไปกลับ",
    pickupTime: "06:30",
    vehicleType: "รถห้องเย็น",
    plate: "G-01",
    driverName: "คนขับ",
    driverPhone: "0800000000",
  }, lotId);
  run("cm", "cmReceive", { receivedKg: "50", arrival: "08:00" }, lotId);
  run("cm", "prepare", { preSmokeKg: "50" }, lotId);
  run("cm", "smoke", {
    smokeDate: date,
    inputKg: "50",
    wasteKg: "0",
    packs: ["10", "10", "10", "10", "10"].join("\n"),
  }, lotId);
  run("cm", "closeLot", { confirm: "Chef_house" }, lotId);
  run("owner", "return", {
    returnDate: date,
    returnTime: "09:00",
    origin: "Chef_house · เชียงใหม่",
    destination: "Foodiva · กรุงเทพฯ",
    vehicleType: "รถห้องเย็น",
    plate: "G-02",
    driverName: "คนขับ",
    driverPhone: "0800000000",
    returnKg: "50",
  }, lotId);
  run("foodiva", "foodivaReturnReceive", {
    receivedDate: date,
    receivedTime: "10:00",
    receivedKg: "50",
    receivedBags: "5",
  }, lotId);
  run("owner", "central", { centralKg: "50" }, lotId);
  expect(availableBags(db, lotId)).toHaveLength(5);
  return db;
}

/** Signed in as the owner: replace the state and reload so the workspace shows it. */
async function pushState(page: Page, db: Database) {
  const { revision } = await serverState(page);
  const response = await page.request.post("/api/local-db", {
    data: { payload: db, expectedRevision: revision },
  });
  expect(response.ok(), await response.text()).toBe(true);
  await reloadWorkspace(page);
}

/** A second owner browser (own cookies, own module cache). */
async function secondOwner(browser: Browser, baseURL: string | undefined) {
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();
  await page.goto("/");
  await signInAs(page, ACCOUNTS.owner);
  return { context, page };
}

/** ownerCreatesMeatPo without its final click, so a test can cut the network first. */
async function fillMeatPo(page: Page, orderedKg: string) {
  await button(page, "ใบสั่งซื้อ PO");
  await button(page, "สร้าง PO เนื้อ");
  await field(page, /ผู้ขาย · Foodiva/, "Foodiva");
  await field(page, /ชื่อบริษัท \/ ลูกค้า/, "บริษัท เนิร์ดเนื้อ จำกัด");
  await field(page, /ที่อยู่บริษัท/, "295/87 แขวงมีนบุรี กรุงเทพมหานคร");
  await field(page, /ชื่อผู้ติดต่อ/, "ฝ่ายจัดซื้อ");
  await field(page, /เบอร์ติดต่อ/, "0800000000");
  await field(page, /เลขประจำตัวผู้เสียภาษี/, "0100000000000");
  await field(page, /ขนาดบรรจุ/, "6 ชิ้นต่อถุง");
  await field(page, /น้ำหนักสั่งซื้อ/, orderedKg);
  await field(page, /ราคาเนื้อ/, "250");
}

async function fillDispatch(page: Page, plate: string) {
  await page.getByLabel(/ต้นทาง/).last().selectOption({ label: "กรุงเทพฯ" });
  await page.getByLabel(/ปลายทาง/).last().selectOption({ label: "เชียงใหม่" });
  await field(page, /เวลารถรับ/, "06:30");
  await field(page, /ประเภทรถ/, "รถห้องเย็น");
  await field(page, /ทะเบียนรถ/, plate);
  await field(page, /ชื่อคนขับ/, "คนขับทดสอบ");
  await field(page, /เบอร์ติดต่อคนขับ/, "0811111111");
  await field(page, /น้ำหนักที่ส่งเที่ยวนี้/, "50");
}

async function submit(page: Page) {
  await pointAndClick(page, dialog(page).locator('button[type="submit"]').last());
}

async function expectDownload(page: Page, trigger: Locator) {
  const waiting = page.waitForEvent("download");
  await pointAndClick(page, trigger);
  const download = await waiting;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  const file = await download.path();
  expect(file && statSync(file).size).toBeGreaterThan(0);
}

/* ---- G1 + G2 (success) ------------------------------------------------------ */
test("G1 บันทึก 1 รายการต่อ role → reload / ออก-เข้าใหม่ ยังอยู่ · บัญชีปลายทางเห็นทันที · G2 toast สำเร็จ", async ({
  page,
}) => {
  await startFresh(page);

  await step(page, "Owner: G1 สร้าง PO เนื้อ 500 กก. → G2 toast สำเร็จ (role=status) · กดปิดแล้วหาย", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await ownerCreatesMeatPo(page, "500");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const toast = successToast(page, "สร้างใบ PO แล้ว");
    await expect(toast).toBeVisible();
    // พฤติกรรมจริง: Toast (src/components/organisms/workspace/Toast.tsx) ไม่มีตัวจับเวลา
    // ค้างจนกด "ปิดข้อความ" หรือบันทึกรายการถัดไป
    await page.waitForTimeout(5_000);
    await expect(toast).toBeVisible();
    await pointAndClick(page, toast.getByRole("button", { name: "ปิดข้อความ" }));
    await expect(toast).toHaveCount(0);
    await expect(
      page.getByRole("main").getByRole("alert").filter({ hasText: "บันทึกไม่สำเร็จ" }),
    ).toHaveCount(0);
  });

  let po = "";
  await step(page, "ระบบ: G1 server มี purchase 1 รายการ · reload แล้ว PO ยังอยู่ในตาราง", async () => {
    const { payload } = await serverState(page);
    expect(kinds(payload, "purchase")).toHaveLength(1);
    expect(payload.lots).toHaveLength(1);
    po = payload.lots[0].poId;
    await reloadWorkspace(page);
    await tab(page, "ใบสั่งซื้อ PO");
    await expect(rowIn(page, "รายการใบสั่งซื้อ PO", po)).toHaveCount(1);
    await expect(rowIn(page, "รายการใบสั่งซื้อ PO", po)).toContainText("500");
  });

  await step(page, "Foodiva: G1 เห็นงานค้างทันที (count pill 1) → ออก Invoice → pill หาย · reload ยังหาย", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await expect(menuItem(page, "PO และสต๊อก Foodiva")).toContainText("1");
    await foodivaIssuesInvoice(page, "500");
    await expect(successToast(page, "ออกและอัปโหลด Invoice เนื้อแล้ว")).toBeVisible();
    await expect(menuItem(page, "PO และสต๊อก Foodiva")).toHaveText("PO และสต๊อก Foodiva");
    await reloadWorkspace(page);
    await expect(menuItem(page, "PO และสต๊อก Foodiva")).toHaveText("PO และสต๊อก Foodiva");
    expect(kinds((await serverState(page)).payload, "foodivaConfirm")).toHaveLength(1);
  });

  await step(page, "Owner: G1 ออก-เข้าใหม่ → PO ยังอยู่ และเห็นเลข Invoice ของ Foodiva ทันที · ออก PO รมควัน", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "ใบสั่งซื้อ PO");
    await expect(rowIn(page, "รายการใบสั่งซื้อ PO", po)).toContainText("FD-INV-001");
    await ownerIssuesSmokePo(page, "500");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  await step(page, "Chef_house: G1 ยืนยันรับ PO รมควัน → reload และออก-เข้าใหม่ ปุ่มยืนยันยังหาย ปุ่มใบวางบิลยังอยู่", async () => {
    await signInAs(page, ACCOUNTS.chef);
    await tab(page, "งานผลิต");
    await button(page, "ยืนยันรับ PO รมควัน");
    await field(page, /ชื่อผู้รับ PO/, "หัวหน้าผลิต G1");
    await saveEntry(page);
    await expect(successToast(page, "ยืนยันรับ PO รมควันแล้ว")).toBeVisible();
    for (const again of [
      () => reloadWorkspace(page),
      async () => {
        await signInAs(page, ACCOUNTS.chef);
        await tab(page, "งานผลิต");
      },
    ]) {
      await again();
      await expect(page.getByRole("button", { name: "ยืนยันรับ PO รมควัน" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "สร้าง / Submit ใบวางบิล" })).toBeVisible();
    }
    const accepted = kinds((await serverState(page)).payload, "smokeOrderAccept");
    expect(accepted).toHaveLength(1);
    expect(accepted[0].values.acceptedBy).toBe("หัวหน้าผลิต G1");
  });

  await step(page, "สาขาศาลาแดง: G1 ซื้อข้าวเหนียวดิบ 20 กก. → reload และออก-เข้าใหม่ แถวยัง \"บันทึกแล้ว · 1\"", async () => {
    await signInAs(page, ACCOUNTS.saladaeng);
    await tab(page, "กรอกรายวัน");
    await pointAndClick(page, rowButton(page, "ซื้อข้าวเหนียวดิบเข้าสต๊อก"));
    await field(page, /ผู้จำหน่ายข้าว/, "ร้านข้าว G1");
    await field(page, /ข้าวเหนียวดิบซื้อเข้า/, "20");
    await field(page, /ยอดซื้อข้าวเหนียวดิบ/, "1100");
    await saveEntry(page);
    const row = page.getByRole("row").filter({ hasText: "ซื้อข้าวเหนียวดิบเข้าสต๊อก" });
    await expect(row).toContainText("บันทึกแล้ว");
    await reloadWorkspace(page);
    await expect(row).toContainText("บันทึกแล้ว");
    await signInAs(page, ACCOUNTS.saladaeng);
    await tab(page, "กรอกรายวัน");
    await expect(row).toContainText("บันทึกแล้ว");
    await expect(row.getByRole("cell").nth(2)).toHaveText("1");
    const rice = kinds((await serverState(page)).payload, "ricePurchase");
    expect(rice).toHaveLength(1);
    expect(rice[0]).toMatchObject({ role: "branch", branch: "ศาลาแดง" });
    expect(rice[0].values.rawRiceKg).toBe("20");
  });

  await step(page, "สาขามีนบุรี: G1 ไม่เห็นรายการซื้อข้าวของศาลาแดง (แถวยัง \"ไม่บังคับวันนี้\")", async () => {
    await signInAs(page, ACCOUNTS.minburi);
    await tab(page, "กรอกรายวัน");
    const row = page.getByRole("row").filter({ hasText: "ซื้อข้าวเหนียวเข้าสต๊อก" });
    await expect(row).toContainText("ไม่บังคับวันนี้");
  });
});

/* ---- G2 (failure) ----------------------------------------------------------- */
test("G2 บันทึกล้มเหลว (mock 409) → ไม่มี toast เขียว dialog ค้าง ข้อความแดง · reload แล้วเป็นข้อมูล server", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  await step(page, "Owner: G2 server ตอบ 409 → dialog ยังเปิด ข้อความแดงในฟอร์ม + toast แดงบนหน้า · ไม่มี toast เขียว", async () => {
    await page.route("**/api/local-db", (route) =>
      route.request().method() === "POST"
        ? route.fulfill({
            status: 409,
            json: { message: "State changed on another device. Reload and try again." },
          })
        : route.continue(),
    );
    await ownerCreatesMeatPo(page, "321");
    await expect(dialog(page)).toBeVisible();
    await expect(formAlert(page, "บันทึกไม่สำเร็จ")).toContainText("State changed on another device");
    await expect(
      page.getByRole("main").getByRole("alert").filter({ hasText: "โหลดข้อมูลล่าสุดแล้ว" }),
    ).toBeVisible();
    await expect(page.getByText("สร้างใบ PO แล้ว")).toHaveCount(0);
  });

  await step(page, "ระบบ: G2 reload → ตาราง PO ว่าง ตรงกับ server (0 lot, 0 entry)", async () => {
    await page.unroute("**/api/local-db");
    const { payload } = await serverState(page);
    expect(payload.lots).toHaveLength(0);
    expect(payload.entries).toHaveLength(0);
    await reloadWorkspace(page);
    await tab(page, "ใบสั่งซื้อ PO");
    await expect(page.getByRole("main")).not.toContainText("321.00");
    await expect(rowIn(page, "รายการใบสั่งซื้อ PO", /PO-/)).toHaveCount(0);
  });
});

/* ---- G3 --------------------------------------------------------------------- */
test("G3 Owner 2 browser บันทึก PO ชนกัน → B ได้ข้อความแดง ลองใหม่ผ่าน ไม่มี PO หาย", async ({
  page,
  browser,
  baseURL,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const b = await secondOwner(browser, baseURL);

  try {
    await step(page, "Owner: G3 browser A สร้าง PO 111 กก. → ผ่าน", async () => {
      await ownerCreatesMeatPo(page, "111");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(successToast(page, "สร้างใบ PO แล้ว")).toBeVisible();
    });

    await step(b.page, "Owner: G3 browser B (revision เก่า) สร้าง PO 222 กก. → 409 ข้อความแดงในฟอร์ม dialog ค้าง", async () => {
      await ownerCreatesMeatPo(b.page, "222");
      await expect(dialog(b.page)).toBeVisible();
      await expect(formAlert(b.page, "บันทึกไม่สำเร็จ")).toContainText(
        "State changed on another device",
      );
      await expect(b.page.getByText("สร้างใบ PO แล้ว")).toHaveCount(0);
    });

    await step(b.page, "Owner: G3 B กดบันทึกซ้ำ (โหลดข้อมูลล่าสุดแล้ว) → ผ่าน · ตารางมี PO ของ A และ B", async () => {
      await submit(b.page);
      await expect(b.page.getByRole("dialog")).toHaveCount(0);
      await expect(successToast(b.page, "สร้างใบ PO แล้ว")).toBeVisible();
      await expect(rowIn(b.page, "รายการใบสั่งซื้อ PO", /PO-/)).toHaveCount(2);
    });

    await step(page, "ระบบ: G3 server มี PO 2 ใบ (111 และ 222) · A reload แล้วเห็นครบ", async () => {
      const { payload } = await serverState(page);
      const ordered = kinds(payload, "purchase").map((entry) => entry.values.orderedKg);
      expect(ordered.sort()).toEqual(["111", "222"]);
      expect(payload.lots).toHaveLength(2);
      await reloadWorkspace(page);
      await tab(page, "ใบสั่งซื้อ PO");
      await expect(rowIn(page, "รายการใบสั่งซื้อ PO", /PO-/)).toHaveCount(2);
    });
  } finally {
    await b.context.close();
  }
});

/* ---- G4 --------------------------------------------------------------------- */
test("G4 A เปิดฟอร์มใบขนส่งขาไปค้าง · B ทำใบขนส่งก่อน → A ถูกปฏิเสธ ขั้นตอนเปลี่ยนไปแล้ว", async ({
  page,
  browser,
  baseURL,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await pushState(page, lotState("paid"));
  const b = await secondOwner(browser, baseURL);

  try {
    await step(page, "Owner: G4 browser A เปิด \"ทำใบขนส่งขาไป\" กรอกครบแต่ยังไม่กดบันทึก", async () => {
      await tab(page, "ใบขนส่ง");
      await button(page, "ทำใบขนส่งขาไป");
      await fillDispatch(page, "A-111");
    });

    await step(b.page, "Owner: G4 browser B ทำใบขนส่งขาไป 50 กก. → ผ่าน", async () => {
      await tab(b.page, "ใบขนส่ง");
      await button(b.page, "ทำใบขนส่งขาไป");
      await fillDispatch(b.page, "B-222");
      await saveEntry(b.page);
      await expect(successToast(b.page, "ทำใบขนส่งขาไปแล้ว")).toBeVisible();
    });

    await step(page, "Owner: G4 A กดบันทึก → ครั้งแรก server ปฏิเสธ revision เก่า (409) ข้อความแดง dialog ค้าง", async () => {
      await submit(page);
      await expect(formAlert(page, "บันทึกไม่สำเร็จ")).toContainText(
        "State changed on another device",
      );
      await expect(dialog(page)).toBeVisible();
    });

    await step(page, "Owner: G4 A กดบันทึกซ้ำ (ข้อมูลล่าสุดแล้ว) → ขั้นตอนเปลี่ยนไปแล้ว กรุณาเปิดฟอร์มใหม่", async () => {
      await submit(page);
      await expect(formAlert(page, "ขั้นตอนเปลี่ยนไปแล้ว กรุณาเปิดฟอร์มใหม่")).toBeVisible();
      await expect(dialog(page)).toBeVisible();
    });

    await step(page, "ระบบ: G4 server มีใบขนส่งขาไปใบเดียว (ของ B) · lot อยู่ stage 2", async () => {
      const { payload } = await serverState(page);
      const dispatches = kinds(payload, "dispatch");
      expect(dispatches).toHaveLength(1);
      expect(dispatches[0].values.plate).toBe("B-222");
      expect(payload.lots[0].stage).toBe(2);
    });
  } finally {
    await b.context.close();
  }
});

/* ---- G5 --------------------------------------------------------------------- */
test("G5 A เปิดจัดสรรถุงค้าง · B จัดสรรถุงเดียวกันก่อน → A ไม่จัดสรรถุงซ้ำ", async ({
  page,
  browser,
  baseURL,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  const state = lotState("central");
  const lotId = state.lots[0].id;
  const bagIds = availableBags(state, lotId).map((bag) => bag.id);
  await pushState(page, state);
  const b = await secondOwner(browser, baseURL);
  const meatTable = (p: Page) => tableSection(p, "สต๊อกเนื้อทุกจุด (Meat inventory)");
  const openAllocate = async (p: Page) => {
    await tab(p, "จัดสรรเนื้อ และสต๊อกไปสาขา");
    await pointAndClick(
      p,
      meatTable(p).getByRole("row").filter({ hasText: lotId }).getByRole("button", { name: "จัดสรร" }),
    );
    await expect(dialog(p).getByLabel("เลือกสาขาให้ถุงที่ 5")).toBeVisible();
  };

  try {
    await step(page, "Owner: G5 browser A เปิดจัดสรร เลือกถุงที่ 1 และ 2 → ศาลาแดง (ยังไม่บันทึก)", async () => {
      await openAllocate(page);
      await dialog(page).getByLabel("เลือกสาขาให้ถุงที่ 1").selectOption({ label: "ศาลาแดง" });
      await dialog(page).getByLabel("เลือกสาขาให้ถุงที่ 2").selectOption({ label: "ศาลาแดง" });
    });

    await step(b.page, "Owner: G5 browser B จัดสรรถุงที่ 1 → มีนบุรี → ผ่าน", async () => {
      await openAllocate(b.page);
      await dialog(b.page).getByLabel("เลือกสาขาให้ถุงที่ 1").selectOption({ label: "มีนบุรี" });
      await button(b.page, "บันทึกการจัดสรร");
      await expect(b.page.getByRole("dialog")).toHaveCount(0);
      await expect(successToast(b.page, "จัดสรรถุงเนื้อไปสาขาแล้ว")).toBeVisible();
    });

    await step(page, "Owner: G5 A กดบันทึก → server ปฏิเสธ revision เก่า (409) ข้อความแดง dialog ค้าง", async () => {
      await submit(page);
      await expect(formAlert(page, "บันทึกไม่สำเร็จ")).toContainText(
        "State changed on another device",
      );
      await expect(dialog(page)).toBeVisible();
    });

    await step(page, "Owner: G5 หลังโหลดใหม่ ตารางในฟอร์มเหลือ 4 ถุง ถุงที่ B จัดสรรหายไป", async () => {
      await expect(dialog(page).getByLabel("เลือกสาขาให้ถุงที่ 4")).toBeVisible();
      await expect(dialog(page).getByLabel("เลือกสาขาให้ถุงที่ 5")).toHaveCount(0);
    });

    await step(page, "Owner: G5 ฟอร์มยังจำถุงเดิมที่ 2 (ตอนนี้แสดงเป็นถุงที่ 1 → ศาลาแดง) · ถุงที่ B เอาไปไม่อยู่ในรายการ", async () => {
      await expect(dialog(page).getByLabel("เลือกสาขาให้ถุงที่ 1")).toHaveValue("ศาลาแดง");
      await expect(dialog(page).getByLabel("เลือกสาขาให้ถุงที่ 2")).toHaveValue("");
    });

    /* พฤติกรรมจริง: BagAllocationForm สร้างรายการถุงจาก db ที่โหลดใหม่ ถุงที่ถูกจัดสรรแล้ว
     * หลุดจากฟอร์มก่อนถึง mutate() ข้อความ "มีถุงที่ถูกจัดสรรไปแล้ว กรุณาเปิดฟอร์มใหม่"
     * (store.ts) จึงไม่ขึ้นจาก UI — กดซ้ำบันทึกเฉพาะถุงที่ยังเหลือและเห็นอยู่บนฟอร์ม */
    await step(page, "Owner: G5 A กดบันทึกซ้ำ → บันทึกเฉพาะถุงที่ยังว่าง (1 ถุง → ศาลาแดง) ไม่ได้ข้อความ มีถุงที่ถูกจัดสรรไปแล้ว", async () => {
      await submit(page);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(successToast(page, "จัดสรรถุงเนื้อไปสาขาแล้ว")).toBeVisible();
    });

    await step(page, "ระบบ: G5 server — ถุงที่ 1 → มีนบุรี, ถุงที่ 2 → ศาลาแดง ไม่มีถุงใดถูกจัดสรรซ้ำ · คงเหลือ 3 ถุง", async () => {
      const { payload } = await serverState(page);
      const allocations = kinds(payload, "allocate");
      const allocated = allocations.flatMap((entry) => entry.values.bagIds.split(","));
      expect(new Set(allocated).size).toBe(allocated.length);
      expect(allocations.map((entry) => [entry.values.branch, entry.values.bagIds])).toEqual([
        ["มีนบุรี", bagIds[0]],
        ["ศาลาแดง", bagIds[1]],
      ]);
      expect(availableBags(payload, lotId)).toHaveLength(3);
    });
  } finally {
    await b.context.close();
  }
});

/* ---- G6 --------------------------------------------------------------------- */
test("G6 API guard ของ local db: append-only, revision, role/สาขาของบัญชี, config, ไม่ล็อกอิน", async ({
  page,
  playwright,
  baseURL,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await pushState(page, lotState("paid"));

  const as = (account: string | null) =>
    playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: account ? { cookie: `local-account=${account}` } : {},
    });
  const post = async (account: string | null, payload: unknown, expectedRevision?: number) => {
    const api = await as(account);
    try {
      const current = (await (await api.get("/api/local-db")).json()) as Row;
      const response = await api.post("/api/local-db", {
        data: { payload, expectedRevision: expectedRevision ?? current.revision },
      });
      return { status: response.status(), body: await response.json() };
    } finally {
      await api.dispose();
    }
  };
  const refused = (result: { status: number; body: { message?: string } }, message: string) => {
    expect(result.status).toBe(409);
    expect(result.body.message).toBe(message);
  };
  const extra = (db: Database, entry: Partial<Database["entries"][number]>) => ({
    ...db,
    entries: [
      ...db.entries,
      { id: `g6-${Date.now()}`, kind: "expense", role: "owner", lotId: "", branch: "", date: today(), values: {}, ...entry },
    ],
  });

  let before: Row;
  await step(page, "ระบบ: G6 ลบ entry สุดท้ายออกแล้ว POST → Existing history cannot be removed", async () => {
    before = await serverState(page);
    refused(
      await post("owner", { ...before.payload, entries: before.payload.entries.slice(0, -1) }),
      "Existing history cannot be removed",
    );
  });

  await step(page, "ระบบ: G6 แก้ค่าใน entry เดิม → Existing history cannot be changed", async () => {
    const entries = structuredClone(before.payload.entries);
    entries[0].values.orderedKg = "9999";
    refused(await post("owner", { ...before.payload, entries }), "Existing history cannot be changed");
  });

  await step(page, "ระบบ: G6 revision เก่า → State changed on another device", async () => {
    refused(
      await post("owner", before.payload, before.revision - 1),
      "State changed on another device. Reload and try again.",
    );
  });

  await step(page, "ระบบ: G6 ไม่มีบัญชี → Authentication required · payload ไม่ใช่ Database → Invalid application state", async () => {
    refused(await post(null, before.payload), "Authentication required");
    refused(await post("owner", { entries: "nope" }), "Invalid application state");
  });

  await step(page, "ระบบ: G6 Foodiva ส่ง entry role owner → Entry role does not match · แก้ config → Only an owner can change configuration", async () => {
    refused(await post("foodiva", extra(before.payload, { role: "owner" })), "Entry role does not match signed-in account");
    refused(
      await post("foodiva", { ...before.payload, config: { ...before.payload.config, boxPrice: "1" } }),
      "Only an owner can change configuration",
    );
  });

  await step(page, "ระบบ: G6 สาขาศาลาแดง ส่ง entry ของมีนบุรี → Entry branch does not match · Chef เพิ่ม lot → Only an owner can add or remove lots", async () => {
    refused(
      await post("saladaeng", extra(before.payload, { role: "branch", kind: "ricePurchase", branch: "มีนบุรี" })),
      "Entry branch does not match signed-in account",
    );
    refused(
      await post("chef", { ...before.payload, lots: [...before.payload.lots, { ...before.payload.lots[0], id: "LOT-G6" }] }),
      "Only an owner can add or remove lots",
    );
  });

  await step(page, "ระบบ: G6 ทุกครั้งที่ถูกปฏิเสธ server ไม่เปลี่ยน (revision และ entry เท่าเดิม) · append ถูกต้องผ่าน", async () => {
    const after = await serverState(page);
    expect(after.revision).toBe(before.revision);
    expect(after.payload.entries).toHaveLength(before.payload.entries.length);
    const ok = await post("saladaeng", extra(before.payload, { role: "branch", kind: "ricePurchase", branch: "ศาลาแดง" }));
    expect(ok.status).toBe(200);
    expect(ok.body.revision).toBe(before.revision + 1);
  });
});

/* ---- G7 --------------------------------------------------------------------- */
test("G7 ไฟล์แนบ Invoice: เกิน 2 MB มีข้อความ · PDF บันทึกได้ Owner ดาวน์โหลดได้ไฟล์จริง", async ({
  page,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);
  await ownerCreatesMeatPo(page, "500");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await step(page, "Foodiva: G7 แนบไฟล์ 3 MB → ไฟล์ Invoice ต้องมีขนาดไม่เกิน 2 MB · ไม่มีไฟล์ถูกเลือก", async () => {
    await signInAs(page, ACCOUNTS.foodiva);
    await button(page, /ออกและอัปโหลด Invoice|อัปโหลด Invoice เนื้อ/);
    await dialog(page).locator('input[type="file"]').setInputFiles({
      name: "big.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(3 * 1024 * 1024, 1),
    });
    await expect(dialog(page).getByText("ไฟล์ Invoice ต้องมีขนาดไม่เกิน 2 MB").first()).toBeVisible();
    await expect(dialog(page).getByText("เลือกแล้ว: big.pdf")).toHaveCount(0);
  });

  await step(page, "Foodiva: G7 แนบ .txt (พฤติกรรมจริง: accept=\".pdf,image/*\" กันแค่หน้าต่างเลือกไฟล์ ไม่ตรวจชนิดซ้ำ) → ถูกรับไว้", async () => {
    await dialog(page).locator('input[type="file"]').setInputFiles({
      name: "note.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an invoice"),
    });
    await expect(dialog(page).getByText("เลือกแล้ว: note.txt")).toBeVisible();
  });

  await step(page, "Foodiva: G7 เปลี่ยนเป็น PDF จริง กรอกครบ → บันทึก", async () => {
    await pointAndClick(page, dialog(page).getByRole("button", { name: "ยกเลิก" }));
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await foodivaIssuesInvoice(page, "500");
    const confirm = kinds((await serverState(page)).payload, "foodivaConfirm");
    expect(confirm).toHaveLength(1);
    expect(confirm[0].values.attachment).toBe("invoice-demo.pdf");
    expect(confirm[0].values.attachmentStorageKey).toBeTruthy();
    expect(confirm[0].values.attachmentData).toBeUndefined();
    // Foodiva workspace has no download control for its own invoice (InvoiceDownloadButton is Owner-only).
    await expect(page.getByRole("button", { name: "ดาวน์โหลด" })).toHaveCount(0);
  });

  await step(page, "Owner: G7 ใบ Invoice → ดาวน์โหลดไฟล์แนบ Foodiva ได้ .pdf ขนาด > 0 (IndexedDB ของ browser นี้)", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await tab(page, "ใบ Invoice");
    const row = rowIn(page, "Invoice Foodiva", "FD-INV-001");
    await expectDownload(page, row.getByRole("button", { name: "ดาวน์โหลด" }));
    expect(statSync(INVOICE_FIXTURE).size).toBeGreaterThan(0);
  });
});

/* ---- G8 --------------------------------------------------------------------- */
test("G8 offline ระหว่างบันทึก PO → ข้อความแดง dialog ค้าง · online แล้วบันทึกซ้ำผ่าน", async ({
  page,
  context,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  await step(page, "Owner: G8 กรอก PO 480 กก. → ตัดเน็ต → บันทึก → ข้อความแดงในฟอร์ม dialog ค้าง ไม่มี toast เขียว", async () => {
    await fillMeatPo(page, "480");
    await context.setOffline(true);
    await button(page, "บันทึก PO เนื้อ");
    await expect(formAlert(page, "บันทึกไม่สำเร็จ")).toBeVisible();
    await expect(dialog(page)).toBeVisible();
    await expect(page.getByText("สร้างใบ PO แล้ว")).toHaveCount(0);
  });

  await step(page, "Owner: G8 เปิดเน็ต → บันทึกซ้ำ → ผ่าน", async () => {
    await context.setOffline(false);
    await button(page, "บันทึก PO เนื้อ");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(successToast(page, "สร้างใบ PO แล้ว")).toBeVisible();
  });

  await step(page, "ระบบ: G8 server มี PO 480 กก. แล้ว (จำนวนใบตรวจใน E2E-G1)", async () => {
    const { payload } = await serverState(page);
    expect(kinds(payload, "purchase").map((entry) => entry.values.orderedKg)).toContain("480");
  });
});

/* E2E-G1: saveDatabase() (src/lib/persistence.ts:124) puts the new entry in the
 * cache before the write; on failure it relies on loadDatabase() (:137) to put the
 * server state back, but offline that read fails too (:89 returns early), so the
 * unsaved PO stays in the cache. The retry runs mutate(latestDatabase()) on top of
 * it (EntryForm.tsx submit) and the server gets both. */
test("E2E-G1: บันทึก PO ตอน offline ล้มเหลว แล้วกดบันทึกซ้ำตอน online ต้องได้ PO ใบเดียว ไม่ซ้ำ", async ({
  page,
  context,
}) => {
  await startFresh(page);
  await signInAs(page, ACCOUNTS.owner);

  await step(page, "Owner: E2E-G1 PO 480 กก. offline → ล้มเหลว → online → บันทึกซ้ำ", async () => {
    await fillMeatPo(page, "480");
    await context.setOffline(true);
    await button(page, "บันทึก PO เนื้อ");
    await expect(formAlert(page, "บันทึกไม่สำเร็จ")).toBeVisible();
    await context.setOffline(false);
    await button(page, "บันทึก PO เนื้อ");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  await step(page, "ระบบ: E2E-G1 server ต้องมี PO 480 กก. ใบเดียว และตาราง PO แถวเดียว", async () => {
    const { payload } = await serverState(page);
    expect(kinds(payload, "purchase").map((entry) => entry.values.orderedKg)).toEqual(["480"]);
    expect(payload.lots).toHaveLength(1);
    await expect(rowIn(page, "รายการใบสั่งซื้อ PO", /PO-/)).toHaveCount(1);
  });
});
