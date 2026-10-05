/** The approved sample's data set (Design/Account Stocking/ตัวอย่างหน้าเว็บ v2.html), built
 *  through `mutate`: Storybook fixtures, `?state=sample` of the local database, the smoke tests. */
import { defaults } from "../forms";
import {
  branches,
  companyPayer as company,
  seed,
  type Actor,
  type Database,
  type NoteKind,
} from "./model";
import { mutate } from "./mutate";
const owner: Actor = { role: "owner" };
const manager: Actor = { role: "owner", hidesSales: true };
/** 35 days that end on `endDate` (today at most: `mutate` takes no future date). Three POs
 *  รมควัน: one complete (one round, its invoice), one with a first round received at Chef
 *  House only, one bought with nothing sent yet. PO เนื้อ 1 has its invoice and its waste
 *  received; PO เนื้อ 2 still waits for its waste and its invoice. A sale day left out and a
 *  sale with no money typed show the yellow. */
export function sampleData(endDate: string): Database {
  let db = structuredClone(seed);
  const add = (
    by: Actor | string,
    kind: NoteKind,
    daysAgo: number,
    time: string,
    values: Record<string, string | number>,
    lotId = "",
  ) => {
    const date = new Date(Date.parse(endDate) - daysAgo * 86400000)
      .toISOString()
      .slice(0, 10);
    db = mutate(
      db,
      typeof by === "string" ? { role: "branch", branch: by } : by,
      kind,
      {
        ...defaults(kind),
        ...Object.fromEntries(
          Object.entries(values).map(([key, value]) => [key, String(value)]),
        ),
      },
      lotId,
      date,
    );
    // When the sample says it was jotted, and by whom (persistence stamps the Account Manager).
    const entry = db.entries.at(-1)!;
    entry.at = new Date(`${date}T${time}:00+07:00`).toISOString();
    if (by === manager) entry.actor = "manager";
    return entry.lotId;
  };
  const [saladaeng, minburi] = branches;
  const po1 = add(manager, "purchase", 24, "10:05", {
    supplier: "Foodiva",
    orderedKg: 200,
    wasteKg: 20,
    price: 700,
  });
  const lines = (...rows: [string, number][]) =>
    JSON.stringify(rows.map(([poLotId, kg]) => ({ poLotId, kg: String(kg) })));
  const lot1 = add(manager, "smokeOrder", 23, "09:30", { rawKg: 200 });
  add(
    manager,
    "dispatch",
    22,
    "08:10",
    { dispatchKg: 200, poLines: lines([po1, 200]), plate: "2กข 4471" },
    lot1,
  );
  add(
    manager,
    "meatInvoice",
    21,
    "10:00",
    { invoiceNumber: "INV-F-0912", netPayable: 140000 },
    po1,
  );
  add(owner, "ownerWasteReceive", 21, "15:00", { receiver: "Owner" }, po1);
  add(manager, "pay", 22, "08:40", {
    category: "transport",
    amount: 3500,
    detail: "รถห้องเย็นไปเชียงใหม่",
    payer: company,
  });
  add(manager, "pay", 20, "14:00", {
    category: "meat",
    amount: 70000,
    detail: "มัดจำค่าเนื้อ",
    supplier: "Foodiva",
    payer: company,
  });
  add(manager, "pay", 18, "11:20", {
    category: "packaging",
    amount: 103750,
    detail: "มัดจำกล่องล็อตใหม่",
    item: "m1",
    qty: 6000,
    branch: saladaeng,
    supplier: "โรงพิมพ์กล่อง",
    payer: company,
    fullAmount: 149400,
  });
  add(manager, "cmReceive", 21, "13:15", { receivedKg: 199.2 }, lot1);
  add(owner, "pay", 16, "15:30", {
    category: "capex",
    amount: 12900,
    detail: "เตาอุ่นอาหาร 1 เครื่อง",
    payer: company,
  });
  add(manager, "smoked", 16, "18:00", { smokedKg: 104, boxes: 18 }, lot1);
  add(
    manager,
    "return",
    15,
    "16:45",
    { returnKg: 104, plate: "3ขค 1180" },
    lot1,
  );
  add(
    manager,
    "smokingInvoice",
    14,
    "10:00",
    { netPayable: 24000, invoiceNumber: "INV-CH-031" },
    lot1,
  );
  add(saladaeng, "receive", 14, "11:30", { kg: 40 }, lot1);
  add(minburi, "receive", 14, "12:10", { kg: 30 }, lot1);
  add(owner, "pay", 12, "09:00", {
    category: "marketing",
    amount: 5000,
    detail: "ยิงโฆษณา",
    payer: company,
  });
  add(manager, "pay", 10, "13:40", {
    category: "smoke",
    amount: 24000,
    detail: "ค่ารม PO รมควันแรก",
    supplier: "Chef House",
    payer: company,
  });
  add(manager, "purchase", 9, "10:20", {
    supplier: "Foodiva",
    orderedKg: 150,
    wasteKg: 15,
    price: 700,
  });
  const po2 = db.entries.at(-1)!.lotId;
  const lot2 = add(manager, "smokeOrder", 8, "09:10", { rawKg: 300 });
  add(
    manager,
    "dispatch",
    7,
    "08:00",
    { dispatchKg: 100, poLines: lines([po2, 100]) },
    lot2,
  );
  add(manager, "cmReceive", 6, "13:00", { receivedKg: 99.5 }, lot2);
  add(manager, "pay", 6, "10:30", {
    category: "ingredient",
    amount: 2400,
    detail: "น้ำพริกหลอด",
    item: "chili",
    qty: 200,
    branch: minburi,
    payer: company,
  });
  add(saladaeng, "receive", 5, "11:00", { kg: 20 }, lot1);
  add(saladaeng, "influencerBox", 3, "15:20", {
    influencer: "@kinkubnong",
    boxes: 6,
    chiliAddons: 6,
    shippingFee: 180,
  });
  const counts = (...qty: number[]) =>
    Object.fromEntries(qty.map((n, index) => [`count.m${index + 1}`, n]));
  add(
    saladaeng,
    "materials",
    2,
    "21:30",
    counts(5480, 60, 900, 1200, 240, 2100, 300),
  );
  add(
    minburi,
    "materials",
    9,
    "21:40",
    counts(380, 150, 420, 600, 90, 800, 110),
  );
  for (const [index, [employee, amount]] of [
    ["พี่เอ", 25000],
    ["น้องฝน", 18000],
    ["น้องบีม", 16500],
  ].entries())
    add(owner, "pay", 2, `17:0${index}`, {
      category: "payroll",
      amount,
      employee,
      payer: company,
    });
  add(manager, "pay", 30, "09:00", {
    category: "rent",
    amount: 20500,
    detail: "ค่าเช่าครัว",
    payer: company,
  });
  // Out of pocket and paid back; yesterday's is still owed (V2-PAY-07).
  add(manager, "pay", 8, "10:10", {
    category: "transport",
    amount: 300,
    detail: "ค่าส่งกล่อง",
    payer: "น้องฝน",
  });
  add(owner, "reimburse", 6, "18:00", { payer: "น้องฝน", amount: 300 });
  add(saladaeng, "pay", 1, "08:20", {
    category: "ingredient",
    amount: 1200,
    detail: "ข้าวเหนียว 20 กก.",
    item: "rice",
    qty: 20,
    payer: "น้องฝน",
  });
  // The purchase ledger's hand-jotted rows (Accounting): every status and source, an item
  // bought twice (one SKU), a project's and the office's.
  add(manager, "expense", 20, "16:00", {
    source: "advance",
    reference: "RC-6701",
    itemType: "อื่นๆ",
    item: "กระดาษ A4",
    detail: "80 แกรม 5 รีม",
    vendor: "ร้านเครื่องเขียนสีลม",
    qty: 5,
    amount: 650,
  });
  add(owner, "expense", 15, "11:00", {
    source: "transfer",
    reference: "INV-PK-2209",
    itemType: "วัสดุบรรจุภัณฑ์",
    item: "ถุงสูญญากาศ",
    detail: "20x30 ซม.",
    vendor: "แพ็คดี",
    purpose: "project",
    project: "Nerdnuea x LINE MAN",
    qty: 1000,
    amount: 3200,
    link: "https://example.com/inv-pk-2209",
  });
  add(manager, "expense", 6, "10:30", {
    source: "advance",
    itemType: "สินทรัพย์",
    item: "เครื่องชั่งดิจิทัล",
    detail: "30 กก. ละเอียด 1 กรัม",
    vendor: "ไทยสเกล",
    qty: 1,
    status: "pending",
  });
  add(manager, "expense", 4, "15:10", {
    source: "advance",
    itemType: "อื่นๆ",
    item: "กระดาษ a4 ",
    vendor: "ร้านเครื่องเขียนสีลม",
    qty: 2,
    amount: 260,
  });
  add(owner, "expense", 3, "09:45", {
    source: "transfer",
    reference: "QT-0315",
    itemType: "วัตถุดิบ",
    item: "พริกป่น",
    vendor: "ตลาดไท",
    purpose: "project",
    project: "Nerdnuea x LINE MAN",
    qty: 5,
    amount: 900,
    status: "cancelled",
  });
  add(manager, "smokeOrder", 1, "09:00", { rawKg: 50 });
  add(minburi, "meatCount", 1, "08:00", { kg: 22 });
  add(saladaeng, "meatCount", 0, "08:30", { kg: 17.9 });
  for (let d = 35; d >= 1; d--)
    for (const [bi, branch] of branches.entries()) {
      // A day one branch forgot: its day shows yellow.
      if (branch === minburi && d === 2) continue;
      const boxes = 20 + ((d * 37 + bi * 11) % 16);
      const chiliAddons = (d * 3 + bi) % 6;
      const values: Record<string, string | number> = {
        boxes,
        chiliAddons,
        lineMan: Math.round(boxes * 350 * 0.97 + chiliAddons * 30),
      };
      // A core field left empty.
      if (branch === saladaeng && d === 3) delete values.lineMan;
      if (branch === saladaeng && d === 1)
        Object.assign(values, {
          chiliCount: 42,
          wasteKg: 0.3,
          reason: "เนื้อตกพื้น",
          expense: 150,
          payer: "น้องฝน",
        });
      if (branch === minburi && d === 1) values.chiliCount = 185;
      add(branch, "sale", d, bi ? "21:25" : "21:10", values);
    }
  return db;
}
