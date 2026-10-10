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
/** 35 days that end on `endDate` (today at most: `mutate` takes no future date). Three POs
 *  รมควัน: one complete (one round, its invoice), one with a first round received at Chef
 *  House only, one bought with nothing sent yet. PO เนื้อ 1 has its invoice and its waste
 *  received; PO เนื้อ 2 still waits for its waste and its invoice. ศาลาแดง has a note today
 *  and no sale yet, and a sale with no money typed: both show the yellow. Each branch set its
 *  opening stock ten days ago and saved its daily sheets since (some with waste, one waste
 *  with no reason); มีนบุรี was closed two days ago (no sheet, no sale: nothing is asked of
 *  that day); today's sheets are not saved yet. */
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
    // When the sample says it was jotted.
    const entry = db.entries.at(-1)!;
    entry.at = new Date(`${date}T${time}:00+07:00`).toISOString();
    return entry.lotId;
  };
  const [saladaeng, minburi] = branches;
  const po1 = add(owner, "purchase", 24, "10:05", {
    supplier: "Foodiva",
    // 20 of the 220 are waste: the 200 left all went to the smoker.
    orderedKg: 220,
    wasteKg: 20,
    price: 700,
  });
  const lines = (...rows: [string, number][]) =>
    JSON.stringify(rows.map(([poLotId, kg]) => ({ poLotId, kg: String(kg) })));
  const lot1 = add(owner, "smokeOrder", 23, "09:30", { rawKg: 200 });
  add(
    owner,
    "dispatch",
    22,
    "08:10",
    { dispatchKg: 200, poLines: lines([po1, 200]), plate: "2กข 4471" },
    lot1,
  );
  add(
    owner,
    "meatInvoice",
    21,
    "10:00",
    { invoiceNumber: "INV-F-0912", netPayable: 140000 },
    po1,
  );
  add(owner, "ownerWasteReceive", 21, "15:00", { receiver: "Owner" }, po1);
  add(owner, "pay", 22, "08:40", {
    category: "transport",
    amount: 3500,
    detail: "รถห้องเย็นไปเชียงใหม่",
    payer: company,
  });
  add(owner, "pay", 20, "14:00", {
    category: "meat",
    amount: 70000,
    detail: "มัดจำค่าเนื้อ",
    supplier: "Foodiva",
    payer: company,
  });
  add(owner, "pay", 18, "11:20", {
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
  add(owner, "cmReceive", 21, "13:15", { receivedKg: 199.2 }, lot1);
  add(owner, "pay", 16, "15:30", {
    category: "capex",
    amount: 12900,
    detail: "เตาอุ่นอาหาร 1 เครื่อง",
    payer: company,
  });
  add(owner, "smoked", 16, "18:00", { smokedKg: 104, boxes: 18 }, lot1);
  add(owner, "return", 15, "16:45", { returnKg: 104, plate: "3ขค 1180" }, lot1);
  add(
    owner,
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
    source: "credit",
  });
  add(owner, "pay", 10, "13:40", {
    category: "smoke",
    amount: 24000,
    detail: "ค่ารม PO รมควันแรก",
    supplier: "Chef House",
    payer: company,
  });
  add(owner, "purchase", 9, "10:20", {
    supplier: "Foodiva",
    orderedKg: 150,
    wasteKg: 15,
    price: 700,
  });
  const po2 = db.entries.at(-1)!.lotId;
  const lot2 = add(owner, "smokeOrder", 8, "09:10", { rawKg: 300 });
  add(
    owner,
    "dispatch",
    7,
    "08:00",
    { dispatchKg: 100, poLines: lines([po2, 100]) },
    lot2,
  );
  add(owner, "cmReceive", 6, "13:00", { receivedKg: 99.5 }, lot2);
  add(owner, "pay", 6, "10:30", {
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
    shippingFee: 180,
  });
  // Today ศาลาแดง is open (this note) with no sale yet: its sale is due, the day is yellow.
  add(saladaeng, "influencerBox", 0, "11:40", {
    influencer: "@bkkfoodie",
    boxes: 2,
  });
  /* The daily sheets (V2-CAL-10): the opening stock of both sheets ten days ago, then a sheet
   * a day. `figures` is a row per item: [id, used, waste?, reason?, received?]. */
  const opening = (qty: Record<string, number>) =>
    Object.fromEntries(Object.entries(qty).map(([id, n]) => [`qty.${id}`, n]));
  const sheet = (
    figures: [string, number, number?, string?, number?][],
  ): Record<string, string | number> =>
    Object.fromEntries(
      figures.flatMap(([id, used, waste, reason, received]) =>
        Object.entries({ used, waste, reason, received })
          .filter(([, value]) => value !== undefined)
          .map(([figure, value]) => [`${figure}.${id}`, value!]),
      ),
    );
  add(saladaeng, "opening", 10, "08:00", {
    sheet: "meat",
    ...opening({ meat: 24, rice: 30, chili: 120 }),
  });
  add(saladaeng, "opening", 10, "08:05", {
    sheet: "materials",
    ...opening({ m1: 5480, m2: 900, m3: 1200, m4: 240, m6: 300, m9: 12 }),
  });
  add(minburi, "opening", 10, "08:10", {
    sheet: "meat",
    ...opening({ meat: 40, chili: 60 }),
  });
  add(minburi, "opening", 10, "08:15", {
    sheet: "materials",
    ...opening({ m1: 380, m2: 420, m3: 600, m4: 90, m6: 110, m9: 8 }),
  });
  for (let d = 9; d >= 1; d--)
    for (const [bi, branch] of branches.entries()) {
      // The day มีนบุรี was closed.
      if (branch === minburi && d === 2) continue;
      const boxes = 20 + ((d * 37 + bi * 11) % 16);
      const reporter = bi ? "พี่เอ" : "น้องฝน";
      add(branch, "daily", d, bi ? "21:35" : "21:20", {
        sheet: "meat",
        reporter,
        ...sheet([
          // ศาลาแดง: a waste with its reason. มีนบุรี: one with none (yellow).
          branch === saladaeng && d === 1
            ? ["meat", (boxes * 12 + 30) / 100, 0.3, "เนื้อตกพื้น"]
            : ["meat", (boxes * 12) / 100],
          ...(branch === saladaeng ? [["rice", 2] as [string, number]] : []),
          branch === minburi && d === 1 ? ["chili", 6, 2] : ["chili", 4],
        ]),
      });
      add(branch, "daily", d, bi ? "21:40" : "21:25", {
        sheet: "materials",
        reporter,
        ...sheet([
          ["m1", boxes],
          ["m2", boxes],
          ["m3", boxes],
          branch === saladaeng && d === 4
            ? ["m4", 14, 4, "ถุงเปียกน้ำ"]
            : ["m4", 10],
          // Bought by hand that day, typed on the sheet.
          d === 5 ? ["m6", 12, undefined, undefined, 50] : ["m6", 12],
        ]),
      });
    }
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
  add(owner, "pay", 30, "09:00", {
    category: "rent",
    amount: 20500,
    detail: "ค่าเช่าครัว",
    payer: company,
  });
  // Out of pocket and paid back; yesterday's is still owed (V2-PAY-07).
  add(owner, "pay", 8, "10:10", {
    category: "transport",
    amount: 300,
    detail: "ค่าส่งกล่อง",
    payer: "น้องฝน",
    source: "advance",
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
  add(owner, "expense", 20, "16:00", {
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

  add(owner, "expense", 6, "10:30", {
    source: "advance",
    itemType: "สินทรัพย์",
    item: "เครื่องชั่งดิจิทัล",
    detail: "30 กก. ละเอียด 1 กรัม",
    vendor: "ไทยสเกล",
    qty: 1,
    status: "pending",
  });
  add(owner, "expense", 4, "15:10", {
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
  /* The project's stock (Inventory): a Settings material bought into the central warehouse, an
   * asset there and one bought straight into ศาลาแดง; then three transfers to ศาลาแดง: one in
   * at once (auto received on its sheet that day), one it confirmed, one it has yet to. */
  const project = { purpose: "project", project: "Nerdnuea x LINE MAN" };
  add(owner, "expense", 12, "14:20", {
    ...project,
    reference: "INV-PK-2231",
    itemType: "วัสดุบรรจุภัณฑ์",
    item: "ถุงกระดาษ",
    vendor: "แพ็คดี",
    qty: 2000,
    amount: 7000,
  });
  add(owner, "expense", 11, "13:00", {
    ...project,
    itemType: "สินทรัพย์",
    item: "ตู้เย็น",
    detail: "2 ประตู 14 คิว",
    vendor: "โฮมโปร",
    qty: 2,
    amount: 25800,
  });
  add(owner, "expense", 10, "15:40", {
    ...project,
    itemType: "สินทรัพย์",
    item: "เครื่องซีลสูญญากาศ",
    vendor: "ไทยสเกล",
    qty: 1,
    amount: 6900,
    warehouse: saladaeng,
  });
  add(owner, "transfer", 8, "09:20", {
    item: "ถุงกระดาษ",
    to: saladaeng,
    qty: 500,
  });
  add(owner, "transfer", 5, "10:00", {
    item: "ตู้เย็น",
    to: saladaeng,
    qty: 1,
    receive: "confirm",
  });
  add(saladaeng, "transferReceive", 4, "09:15", {
    transferId: db.entries.at(-1)!.id,
  });
  add(owner, "transfer", 1, "16:30", {
    item: "ถุงสูญญากาศ",
    to: saladaeng,
    qty: 300,
    receive: "confirm",
  });
  /* Money in (V2-PAY-09): other income of the project, one of the office and one still
   * awaited; and LINE MAN's weekly payouts, each a week's sales after GP. The last week is
   * not paid out yet: that is what the channel still owes. */
  add(owner, "income", 18, "11:30", {
    ...project,
    item: "ค่าสปอนเซอร์",
    detail: "โลโก้บนกล่อง รอบเดือนนี้",
    customer: "น้ำดื่มตราช้างเผือก",
    reference: "INV-SP-0091",
    amount: 30000,
  });
  add(owner, "income", 9, "17:15", {
    ...project,
    item: "ขายเศษเนื้อ / ของเหลือ",
    customer: "ร้านข้าวต้มเจ๊หมวย",
    amount: 1850,
  });
  add(owner, "income", 5, "09:05", {
    item: "ดอกเบี้ยรับ",
    customer: "ธนาคาร",
    amount: 412.35,
  });
  add(owner, "income", 2, "14:40", {
    ...project,
    item: "เงินคืนจากผู้ขาย",
    detail: "คืนค่าถุงที่ส่งผิดขนาด",
    customer: "แพ็คดี",
    amount: 2400,
    status: "pending",
  });
  for (const [daysAgo, amount] of [
    [27, 114810.3],
    [20, 121370.4],
    [13, 118476.9],
    [6, 115259.4],
  ])
    add(owner, "income", daysAgo, "10:00", {
      ...project,
      incomeType: "sales",
      channel: "lineMan",
      customer: "LINE MAN",
      reference: `LM-PAYOUT-${daysAgo}`,
      amount,
    });
  add(owner, "smokeOrder", 1, "09:00", { rawKg: 50 });
  for (let d = 35; d >= 1; d--)
    for (const [bi, branch] of branches.entries()) {
      // Closed that day: no note at all, so no sale is due.
      if (branch === minburi && d === 2) continue;
      const boxes = 20 + ((d * 37 + bi * 11) % 16);
      const values: Record<string, string | number> = {
        boxes,
        lineMan: Math.round(boxes * 350 * 0.97 + ((d * 3 + bi) % 6) * 30),
      };
      // A core field left empty.
      if (branch === saladaeng && d === 3) delete values.lineMan;
      if (branch === saladaeng && d === 1)
        Object.assign(values, { expense: 150, payer: "น้องฝน" });
      add(branch, "sale", d, bi ? "21:25" : "21:10", values);
    }
  return db;
}
