/** `mutate`: the only way to change the database. Every entry is validated here and stages
 *  advance here; the UI never sets them. */
import { fmt } from "../format";
import { newId } from "../id";
import {
  STAGE,
  branches,
  editApprovers,
  editDecisions,
  editLockedKeys,
  materials,
  pack,
  stageAction,
  type Database,
  type Entry,
  type EntryKind,
  type Lot,
  type Role,
  type Values,
  unpack,
} from "./model";
import {
  allocationOutstanding,
  balance,
  branchMaterialStock,
  centralStock,
  chiliStock,
  closeDayChecklist,
  cookedRiceStock,
  cooksRice,
  decimal,
  drawnKg,
  entries,
  isClosed,
  isPackWeight,
  issuedRawRiceStock,
  latestPackingList,
  lotCost,
  materialPar,
  materialUnitPrice,
  n,
  noCookMessage,
  ownerChiliStock,
  ownerMaterialStock,
  ownerWasteOutstanding,
  ownerWasteReceived,
  packWeights,
  poRemainingKg,
  processed,
  produced,
  purchaseLots,
  rawRiceStock,
  reservedForOwnerContent,
  riceSources,
  shipmentLines,
  shipments,
  smokeServiceRate,
  smokingInvoiceStatus,
  sum,
} from "./derived";
import {
  editBlock,
  editDecisionOf,
  omit,
  openEditRequest,
  saleMoneyKeys,
} from "./visibility";
/** Stock figures an edit must not push below zero, keyed `label#id`. */
function stockLevels(db: Database) {
  const levels = new Map<string, number>();
  for (const b of branches) {
    for (const lot of db.lots) {
      const x = balance(db, lot.id, b);
      levels.set(`เนื้อแช่แข็ง ${lot.id} สาขา${b}#`, x.frozen);
      levels.set(`เนื้อละลายแล้ว ${lot.id} สาขา${b}#`, x.ready);
    }
    levels.set(`ข้าวเหนียวดิบ สาขา${b}#`, rawRiceStock(db, b));
    levels.set(`ข้าวเหนียวดิบที่เบิก สาขา${b}#`, issuedRawRiceStock(db, b));
    levels.set(`ข้าวเหนียวสุก สาขา${b}#`, cookedRiceStock(db, b));
    levels.set(`น้ำพริก สาขา${b}#`, chiliStock(db, b));
  }
  for (const lot of db.lots) {
    levels.set(`สต๊อกกลาง ${lot.id}#`, centralStock(db, lot.id));
    if (!lot.kind)
      levels.set(`ยอดพร้อมส่ง ${lot.poId}#`, poRemainingKg(db, lot.id));
  }
  for (const a of entries(db, "allocate"))
    levels.set(
      `ยอดค้างรับใบจัดสรร ${a.lotId} สาขา${a.branch}#${a.id}`,
      n(a.values, "kg") -
        sum(
          entries(db, "receive", a.lotId, a.branch).filter(
            (r) => r.values.allocation === a.id,
          ),
          "kg",
        ),
    );
  levels.set("น้ำพริกในคลัง Owner#", ownerChiliStock(db));
  for (const m of materials)
    levels.set(`${m} ในคลัง Owner#`, ownerMaterialStock(db, m));
  return levels;
}
/** The target's values as `proposed` would leave them, normalised and checked by the target
 *  kind's own rules as if it were saved again now without the original (so its own kg are
 *  back in stock). Then no stock may go below zero that was not already there. */
function correctedValues(db: Database, target: Entry, proposed: Values) {
  for (const key of editLockedKeys)
    assert(
      proposed[key] === undefined ||
        proposed[key] === (target.values[key] ?? ""),
      "แก้สาขา วันที่ซื้อ หรือรายการอ้างอิงไม่ได้ · ให้ Owner ยกเลิกแล้วบันทึกใหม่",
    );
  const as = (kind: EntryKind, values: Values): Database => ({
    ...db,
    entries: [
      ...db.entries,
      { ...target, id: newId(), kind, role: editApprovers[0], values },
    ],
  });
  /* The Account Manager's copy has no sale money (C4): a sale without its LINE MAN amount is
   * checked with a stand-in, and the edit is saved without money for save_app_state to fill in
   * from the server's copy. */
  const moneyHidden =
    target.kind === "sale" && target.values.lineMan === undefined;
  const input = { ...target.values, ...proposed };
  if (moneyHidden && input.lineMan === undefined) input.lineMan = "0";
  const checked = record(
    as("void", { targetId: target.id }),
    target.role,
    target.kind,
    input,
    target.lotId,
    target.date,
    target.branch,
    true,
  ).entries.at(-1)!.values;
  const corrected = moneyHidden ? omit(checked, saleMoneyKeys) : checked;
  const before = stockLevels(db);
  for (const [key, level] of stockLevels(
    as("entryEdit", { targetId: target.id, ...pack("to.", corrected) }),
  ))
    assert(
      level >= -0.001 || level >= (before.get(key) ?? 0) - 0.001,
      `แก้แล้ว${key.split("#")[0]}จะติดลบ (${fmt(level)}) · แก้รายการที่ตามมาก่อน`,
    );
  return corrected;
}
/** What an edit entry stores about its target: the before and after values and whose it is. */
function editValues(db: Database, target: Entry, proposed: Values) {
  return {
    targetKind: target.kind,
    targetDate: target.date,
    targetRole: target.role,
    targetBranch: target.branch,
    ...pack("from.", target.values),
    ...pack("to.", correctedValues(db, target, proposed)),
  };
}
/** `targetId`'s entry with its current (edited) values, if `role` may edit it. */
function editTarget(
  db: Database,
  targetId: string,
  role: Role,
  branch: string,
) {
  const target = db.entries.find((e) => e.id === targetId);
  assert(target, "ไม่พบรายการที่จะแก้ไข");
  const block = editBlock(db, target, role, branch);
  assert(!block, block);
  return entries(db, target.kind).find((e) => e.id === targetId)!;
}
const ownership: Partial<Record<EntryKind, Role>> = {
  purchase: "owner",
  shipmentRequest: "owner",
  shipmentRequestEdit: "owner",
  meatPayment: "owner",
  smokeOrder: "owner",
  smokingInvoice: "cm",
  smokeOrderAccept: "cm",
  invoiceReview: "owner",
  invoicePayment: "owner",
  foodivaConfirm: "foodiva",
  packingList: "foodiva",
  foodivaReturnReceive: "foodiva",
  dispatch: "foodiva",
  cmReceive: "cm",
  prepare: "cm",
  smoke: "cm",
  closeLot: "cm",
  chefEdit: "cm",
  return: "owner",
  central: "owner",
  allocate: "owner",
  chiliAllocate: "owner",
  receive: "branch",
  thaw: "branch",
  supplyPurchase: "branch",
  supplyIssue: "branch",
  ricePurchase: "branch",
  chiliPurchase: "branch",
  riceIssue: "branch",
  chiliIssue: "branch",
  rice: "branch",
  riceCarry: "branch",
  sale: "branch",
  influencerBox: "branch",
  materials: "branch",
  materialReceive: "owner",
  ownerWasteReceive: "owner",
  generalPurchase: "owner",
  materialTransfer: "owner",
  materialConfirm: "branch",
  closeDay: "branch",
  expense: "owner",
  config: "owner",
  unlock: "owner",
  void: "owner",
};
/** Per-กล่องรับเข้า weights of a Packing List. They live in one entry value, one
 *  line each, the way `smoke` stores its pack weights. */
export function packingListBoxes(value = "") {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(decimal);
}
/** Chef House's weighed-in kg per กล่องรับเข้า, one line per Packing List box and in its order.
 *  Unlike packingListBoxes a blank line stays (as NaN), so a skipped box is caught, not shifted. */
export function receivedBoxWeights(value = "") {
  return value.split("\n").map((line) => (line.trim() ? decimal(line) : NaN));
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
/** Refused because an amount is over what is on hand. Its own class so a form can show it
 *  as soon as that amount is typed, before the rest of the form is filled in. */
export class OverStockError extends Error {
  name = "OverStockError";
}
/** Refuses `amount` over `max` and says what the most is, so the user knows what to type. */
function withinStock(
  amount: number,
  max: number,
  message: string,
  unit = "กก.",
  prefix = "กรอกได้สูงสุด",
) {
  if (amount <= max + 0.001) return;
  const most = Math.max(0, max);
  throw new OverStockError(
    `${message} · ${prefix} ${unit === "กก." ? fmt(most) : String(Math.floor(most + 0.001))}${unit ? ` ${unit}` : ""}`,
  );
}
/** Thai runs together without spaces, but a label starting or ending in Latin/digits needs a
 *  space on that side ("กรอก Sliced Weight Lost เป็นตัวเลข…"). */
function spaced(label: string) {
  const latin = /[A-Za-z0-9)]/;
  return `${latin.test(label[0] ?? "") ? " " : ""}${label}${latin.test(label.at(-1) ?? "") ? " " : ""}`;
}
function positive(v: Values, k: string, label: string, allowZero = false) {
  const value = decimal(v[k]);
  assert(
    Number.isFinite(value) && (allowZero ? value >= 0 : value > 0),
    `กรอก${spaced(label)}เป็นตัวเลข${allowZero ? "ตั้งแต่ศูนย์" : "มากกว่าศูนย์"}`,
  );
}
function required(v: Values, k: string, label: string) {
  assert(v[k]?.trim(), `กรอก${spaced(label).trimEnd()}`);
}
function variance(actual: number, expected: number, v: Values, always = true) {
  if (
    Math.abs(actual - expected) > 0.001 &&
    (always || expected === 0 || Math.abs(actual - expected) / expected > 0.2)
  )
    required(v, "reason", "เหตุผลส่วนต่าง");
}
/** Sum of Chef House's yellow cells: one weight per box of the shipment's latest Packing List.
 *  A total off the Packing List is not an error; it is what stock and cost run on. */
function receivedTotal(db: Database, lotId: string, value = "") {
  const listed = packingListBoxes(latestPackingList(db, lotId)?.values.boxes);
  const got = receivedBoxWeights(value);
  assert(
    got.length === listed.length,
    "จำนวนกล่องรับเข้าไม่ตรงกับ Packing List กรุณาเปิดฟอร์มใหม่",
  );
  assert(
    got.every((kg) => Number.isFinite(kg) && kg >= 0),
    "กรอกน้ำหนักจริงทุกกล่องรับเข้า (ใส่ 0 ถ้าไม่ได้รับกล่องนั้น)",
  );
  const total = got.reduce((a, b) => a + b, 0);
  assert(total > 0, "น้ำหนักรับจริงรวมต้องมากกว่าศูนย์");
  return { total, boxes: got.join("\n") };
}
/** Optional payment slips: JSON [{ name, storageKey }], the bytes already in attachment storage. */
function checkSlips(v: Values) {
  if (!v.slips) return;
  let slips: unknown;
  try {
    slips = JSON.parse(v.slips);
  } catch {}
  assert(
    Array.isArray(slips) &&
      slips.every(
        (slip: Values | null) =>
          slip?.name?.trim?.() && slip?.storageKey?.trim?.(),
      ),
    "ไฟล์สลิปไม่ถูกต้อง กรุณาแนบใหม่",
  );
}
/** Checks a Request's `lines` and writes them back normalised with `requestedKg`. When
 *  editing (`own`), that Request's current lines count as still available to their POs. */
function requestLines(db: Database, v: Values, own?: Lot) {
  let lines: Values[] = [];
  try {
    lines = JSON.parse(v.lines || "");
  } catch {}
  assert(Array.isArray(lines) && lines.length, "เลือก PO ซื้ออย่างน้อย 1 ใบ");
  const current = own ? shipmentLines(own) : [];
  const seen = new Set<string>();
  for (const line of lines) {
    const po = purchaseLots(db).find((l) => l.id === line?.lotId);
    assert(po, "ไม่พบ PO ซื้อที่เลือก");
    assert(!seen.has(po.id), "เลือก PO ซื้อซ้ำในใบเดียวกัน");
    seen.add(po.id);
    const kg = decimal(String(line.kg ?? ""));
    assert(
      Number.isFinite(kg) && kg > 0,
      `กรอกน้ำหนักที่จะส่งของ ${po.poId} เป็นตัวเลขมากกว่าศูนย์`,
    );
    assert(
      entries(db, "foodivaConfirm", po.id).length,
      `${po.poId} ยังไม่มี Invoice เนื้อจาก Foodiva`,
    );
    const remaining =
      poRemainingKg(db, po.id) +
      current
        .filter((mine) => mine.lotId === po.id)
        .reduce((total, mine) => total + mine.kg, 0);
    if (kg > remaining + 0.001)
      throw new OverStockError(
        `น้ำหนักที่ขอส่งเกินยอดคงเหลือของ ${po.poId} (เหลือ ${remaining.toFixed(2)} กก.)`,
      );
  }
  v.lines = JSON.stringify(
    lines.map((line) => ({ lotId: line.lotId, kg: String(Number(line.kg)) })),
  );
  v.requestedKg = String(
    lines.reduce((total, line) => total + Number(line.kg), 0),
  );
}
/** The config snapshot a new PO or shipment keeps. Without a legacy inline logo: documents
 * fall back to the current config for it, and the data URL was a copy per lot. */
function lotConfig(db: Database): Values {
  return Object.fromEntries(
    Object.entries(db.config).filter(([key]) => key !== "logoData"),
  );
}
export function mutate(
  db: Database,
  role: Role,
  kind: EntryKind,
  input: Values,
  lotId: string,
  date: string,
  /** The acting branch account's branch. Required for role "branch"; never taken from config. */
  actorBranch = "",
): Database {
  return record(db, role, kind, input, lotId, date, actorBranch);
}
/** `mutate`, plus `correcting`: re-checks an entry being edited, whose day may be closed. */
function record(
  db: Database,
  role: Role,
  kind: EntryKind,
  input: Values,
  lotId: string,
  date: string,
  actorBranch = "",
  correcting = false,
): Database {
  assert(
    kind === "editRequest"
      ? !editApprovers.includes(role)
      : kind === "entryEdit" || kind === "editDecision"
        ? editApprovers.includes(role)
        : ownership[kind] === role,
    "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
  );
  // Same clock as format.ts `today` (kept inline: this module has no imports).
  const todayDate = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Bangkok",
  });
  /* A real calendar day (2026-02-31 fails the round trip), not before the system existed
   * and not in the future: every range and closed-day check compares these as strings. */
  const checkDate = (value: string | undefined, label: string) => {
    assert(
      value &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        value >= "2020-01-01" &&
        new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
      `เลือก${label}`,
    );
    assert(value <= todayDate, `${label}ต้องไม่เกินวันนี้`);
  };
  checkDate(date, "วันที่ทำรายการ");
  const next: Database = structuredClone(db),
    v = { ...input };
  let lot = next.lots.find((l) => l.id === lotId);
  const branch = role === "branch" ? actorBranch : v.branch || db.config.branch;
  for (const key of [
    "arrival",
    "time",
    "closeTime",
    "pickupTime",
    "dispatchTime",
  ]) {
    if (key in v)
      assert(
        /^([01]\d|2[0-3]):[0-5]\d$/.test(v[key]),
        "กรอกเวลาเป็น HH:mm เช่น 08:00",
      );
  }
  if (role === "branch") {
    assert(branches.includes(branch), "ไม่พบสาขาของบัญชีนี้");
    // A request changes nothing until an approver decides, so a closed day still takes one.
    if (!correcting && kind !== "editRequest")
      assert(
        !isClosed(db, branch, date),
        "วันนี้ปิดยอดแล้ว ต้องให้ Owner ปลดล็อกก่อน",
      );
  } else if (
    !correcting &&
    ["allocate", "chiliAllocate", "materialTransfer"].includes(kind)
  )
    // Owner entries that land in a branch's day must not change a day that branch has closed.
    assert(
      !isClosed(db, branch, date),
      `สาขา${branch}ปิดยอดวันที่ ${date} แล้ว ต้องปลดล็อกก่อน`,
    );
  const expected = stageAction.indexOf(kind);
  if (expected > 0 && kind !== "allocate") {
    assert(lot?.kind === "shipment", "รายการนี้ต้องทำกับการส่ง ไม่ใช่ PO ซื้อ");
    assert(lot.stage === expected, "ขั้นตอนเปลี่ยนไปแล้ว กรุณาเปิดฟอร์มใหม่");
    // A backdated step must not land before the step it depends on.
    const latest = db.entries
      .filter((e) => e.lotId === lotId)
      .reduce((max, e) => (e.date > max ? e.date : max), "");
    assert(
      date >= latest,
      `วันที่ต้องไม่ก่อนขั้นตอนก่อนหน้าของ Lot นี้ (${latest})`,
    );
  }
  if (["foodivaConfirm", "ownerWasteReceive", "meatPayment"].includes(kind))
    assert(lot && !lot.kind, "รายการนี้ต้องทำกับ PO ซื้อ");
  // Non-stage lot-pipeline entries still can't predate the lot's PO. Branch kinds are
  // excluded: they carry the selected lot as context, not as the lot they belong to.
  const lotPipeline = [
    "foodivaConfirm",
    "packingList",
    "foodivaReturnReceive",
    "smokeOrder",
    "smokeOrderAccept",
    "smokingInvoice",
    "invoiceReview",
    "invoicePayment",
    "chefEdit",
    "meatPayment",
    "shipmentRequestEdit",
  ];
  if (lot && lotPipeline.includes(kind)) {
    const lotRef = lot.id;
    const first = db.entries
      .filter((e) => e.lotId === lotRef)
      .reduce((min, e) => (!min || e.date < min ? e.date : min), "");
    assert(
      !first || date >= first,
      `วันที่ต้องไม่ก่อนวันเปิด PO ของ Lot นี้ (${first})`,
    );
  }
  const lotRequired = ["allocate", "receive", "thaw", "sale", "influencerBox"];
  if (lotRequired.includes(kind))
    assert(lot && lot.stage >= STAGE.allocate, "Lot ต้องรับเข้าสต๊อกกลางก่อน");
  if (role === "branch" && lotRequired.includes(kind))
    assert(
      entries(db, "allocate", lotId, branch).length,
      "Lot นี้ไม่ได้จัดสรรมายังสาขาของคุณ",
    );
  if (kind === "purchase") {
    required(v, "supplier", "ผู้ขาย");
    required(v, "customerName", "ชื่อบริษัท / ลูกค้า");
    required(v, "customerAddress", "ที่อยู่");
    required(v, "attention", "ชื่อผู้ติดต่อ (Attention)");
    required(v, "phone", "เบอร์ติดต่อ");
    required(v, "taxId", "เลขประจำตัวผู้เสียภาษี");
    required(v, "packSize", "ขนาดบรรจุ");
    required(v, "productName", "รายการสินค้า");
    positive(v, "orderedKg", "น้ำหนักสั่งซื้อ");
    positive(v, "price", "ราคา / กก.");
    const year = date.slice(0, 4);
    const count = next.lots.filter((l) => !l.kind).length + 1;
    lotId = `F${date.slice(2).replaceAll("-", "")}-${String(count).padStart(3, "0")}`;
    lot = {
      id: lotId,
      poId: `PO-${year}-${String(count).padStart(4, "0")}`,
      stage: STAGE.dispatch,
      values: v,
      config: lotConfig(db),
    };
    next.lots.push(lot);
  } else if (kind === "shipmentRequest") {
    requestLines(db, v);
    const count = next.lots.filter((l) => l.kind === "shipment").length + 1;
    lotId = `S${date.slice(2).replaceAll("-", "")}-${String(count).padStart(3, "0")}`;
    lot = {
      id: lotId,
      poId: `SH-${date.slice(0, 4)}-${String(count).padStart(4, "0")}`,
      kind: "shipment",
      stage: STAGE.dispatch,
      values: v,
      config: lotConfig(db),
    };
    next.lots.push(lot);
  } else if (kind === "shipmentRequestEdit") {
    // Replaces the Request's lines in place (same SH number) until Foodiva makes the manifest.
    // The entry records the new lines; the lot carries the latest, which everything reads.
    assert(
      lot?.kind === "shipment" && shipments(db).some((s) => s.id === lotId),
      "Request นี้ถูกยกเลิกแล้ว",
    );
    assert(
      lot.stage === STAGE.dispatch && !entries(db, "dispatch", lotId).length,
      "Foodiva ทำใบขนส่งแล้ว แก้ไข Request ไม่ได้",
    );
    requestLines(db, v, lot);
    lot.values = {
      ...lot.values,
      lines: v.lines,
      requestedKg: v.requestedKg,
      note: v.note ?? lot.values.note ?? "",
    };
  } else if (kind === "smokeOrder" && lot) {
    const list = latestPackingList(db, lotId);
    assert(list, "รอ Foodiva ทำ Packing List ก่อนออก PO รมควัน");
    assert(
      !entries(db, "smokeOrder", lotId).length,
      "ออก PO รมควันของการส่งนี้แล้ว",
    );
    required(v, "requestedSmokeDate", "วันที่ขอรม");
    required(v, "smoker", "โรงรม / ผู้ให้บริการ");
    // One shipment, one Packing List, one smoke PO. The kg starts at the Packing List total
    // and the Owner may change it (A6); no upper cap.
    if (!v.rawKg?.trim()) v.rawKg = list.values.slicedNetKg;
    positive(v, "rawKg", "น้ำหนัก PO รมควัน");
    v.rawKg = String(Number(v.rawKg));
    v.serviceRate = String(smokeServiceRate(n(v, "rawKg")));
    v.orderNumber = `SO-${date.slice(0, 4)}-${String(entries(db, "smokeOrder").length + 1).padStart(4, "0")}`;
    v.estimatedCost = String(n(v, "rawKg") * n(v, "serviceRate"));
    v.status = "Sent";
  } else if (kind === "smokeOrderAccept" && lot) {
    const order = entries(db, "smokeOrder", lotId).at(-1);
    assert(order, "ยังไม่มี PO รมควันจาก Owner");
    assert(
      !entries(db, "smokeOrderAccept", lotId).length,
      "รับ PO รมควันนี้แล้ว",
    );
    required(v, "acceptedBy", "ชื่อผู้รับ PO");
    v.orderId = order.id;
    v.orderNumber = order.values.orderNumber;
    v.status = "Accepted";
  } else if (kind === "smokingInvoice" && lot) {
    assert(
      lot.stage >= STAGE.return,
      "ต้องยืนยันปิดรอบก่อนออกใบวางบิลค่ารมควัน",
    );
    assert(
      entries(db, "smokeOrderAccept", lotId).length,
      "ต้องยืนยันรับ PO รมควันก่อนออกใบวางบิล",
    );
    const smokeOrder = entries(db, "smokeOrder", lotId).at(-1);
    assert(smokeOrder, "ไม่พบ PO รมควันที่อ้างอิง");
    required(v, "invoiceNumber", "เลข Invoice ค่ารม");
    required(v, "invoiceDate", "วันที่ Invoice");
    v.serviceProvider = smokeOrder.values.smoker || "Chef House";
    v.serviceQuantity = String(n(smokeOrder.values, "rawKg"));
    v.serviceRate = String(smokeServiceRate(n(v, "serviceQuantity")));
    v.amountBeforeVat = String(n(v, "serviceQuantity") * n(v, "serviceRate"));
    v.vat = String(n(v, "vat"));
    v.withholdingTax = String(n(v, "withholdingTax"));
    // Chef House bills the amount itself (A7): it starts at kg × rate and Chef may change it.
    if (!v.netPayable?.trim())
      v.netPayable = String(
        n(v, "amountBeforeVat") + n(v, "vat") - n(v, "withholdingTax"),
      );
    positive(v, "netPayable", "ยอดเรียกเก็บค่ารมควัน");
    v.netPayable = String(Number(v.netPayable));
    required(v, "attachment", "Invoice ที่แนบ");
    v.status = "Submitted";
  } else if (kind === "invoiceReview" && lot) {
    const invoice =
      entries(db, "smokingInvoice", lotId).find(
        (entry) => entry.id === v.invoiceId,
      ) || entries(db, "smokingInvoice", lotId).at(-1);
    assert(invoice, "ไม่พบ Invoice ค่ารมควันที่ต้องตรวจ");
    v.invoiceId = invoice.id;
    assert(
      smokingInvoiceStatus(db, invoice) !== "ชำระแล้ว",
      "Invoice นี้ชำระแล้ว",
    );
    assert(
      ["รับยอด", "ส่งกลับแก้ไข"].includes(v.decision),
      "เลือกผลการตรวจยอด",
    );
    required(v, "reviewedBy", "ชื่อผู้ตรวจ");
    v.reviewedAt = new Date().toISOString();
  } else if (kind === "invoicePayment" && lot) {
    const invoice =
      entries(db, "smokingInvoice", lotId).find(
        (entry) => entry.id === v.invoiceId,
      ) || entries(db, "smokingInvoice", lotId).at(-1);
    assert(invoice, "ไม่พบ Invoice ค่ารมควันที่ต้องชำระ");
    v.invoiceId = invoice.id;
    assert(
      smokingInvoiceStatus(db, invoice) === "รอชำระ",
      "ต้องรับยอด Invoice ก่อนชำระเงิน",
    );
    required(v, "paymentDate", "วันที่ชำระ");
    required(v, "paidBy", "ผู้ดำเนินการชำระ");
    positive(v, "paidAmount", "ยอดชำระ");
    assert(
      Math.abs(n(v, "paidAmount") - n(invoice.values, "netPayable")) < 0.01,
      "ยอดชำระต้องเท่ากับยอดสุทธิใน Invoice",
    );
    checkSlips(v);
  } else if (kind === "meatPayment" && lot) {
    const invoice = entries(db, "foodivaConfirm", lotId).at(-1);
    assert(invoice, "ยังไม่มี Invoice เนื้อจาก Foodiva");
    assert(
      !entries(db, "meatPayment", lotId).length,
      "ชำระ Invoice เนื้อใบนี้แล้ว",
    );
    required(v, "paymentDate", "วันที่ชำระ");
    required(v, "paidBy", "ผู้ดำเนินการชำระ");
    positive(v, "paidAmount", "ยอดชำระ");
    if (n(invoice.values, "invoiceAmount") > 0)
      assert(
        Math.abs(n(v, "paidAmount") - n(invoice.values, "invoiceAmount")) <
          0.01,
        "ยอดชำระต้องเท่ากับยอดรวม Invoice เนื้อ",
      );
    v.invoiceNo = invoice.values.invoiceNo;
    checkSlips(v);
  } else if (kind === "foodivaConfirm" && lot) {
    required(v, "invoiceNo", "เลข Invoice");
    required(v, "invoiceDate", "วันที่ Invoice");
    required(v, "attachment", "Invoice ที่แนบ");
    required(v, "confirmedBy", "ชื่อผู้ยืนยัน");
    positive(v, "confirmedKg", "น้ำหนักที่ยืนยันได้");
    positive(v, "readyForChiangMaiKg", "น้ำหนักพร้อมส่งเชียงใหม่", true);
    positive(
      v,
      "reservedForOwnerKg",
      "น้ำหนักเนื้อส่วนที่เหลือรอ Owner รับ",
      true,
    );
    positive(v, "invoiceAmount", "ยอดรวม Invoice", true);
    withinStock(
      n(v, "confirmedKg"),
      n(lot.values, "orderedKg"),
      "น้ำหนักยืนยันเกินยอด PO",
    );
    assert(
      Math.abs(
        n(v, "readyForChiangMaiKg") +
          n(v, "reservedForOwnerKg") -
          n(v, "confirmedKg"),
      ) < 0.001,
      "น้ำหนักพร้อมส่งเชียงใหม่และเนื้อส่วนที่เหลือรอ Owner รับต้องรวมเท่ากับน้ำหนักตาม Invoice",
    );
    // A later confirm replaces the earlier one, so it must still cover what already hangs on it.
    assert(
      !entries(db, "meatPayment", lotId).length,
      "Owner ชำระ Invoice เนื้อของ PO นี้แล้ว ยืนยันใหม่ไม่ได้",
    );
    const drawn = drawnKg(db, lot.id);
    assert(
      n(v, "readyForChiangMaiKg") >= drawn - 0.001,
      `น้ำหนักพร้อมส่งเชียงใหม่ต่ำกว่าที่ Request ดึงไปแล้ว · กรอกได้ต่ำสุด ${fmt(drawn)} กก.`,
    );
    const picked = ownerWasteReceived(db, lot.id);
    assert(
      n(v, "reservedForOwnerKg") >= picked - 0.001,
      `เนื้อส่วนที่เหลือรอ Owner รับต่ำกว่าที่ Owner รับไปแล้ว · กรอกได้ต่ำสุด ${fmt(picked)} กก.`,
    );
  } else if (kind === "packingList" && lot) {
    assert(
      lot.kind === "shipment" && entries(db, "dispatch", lotId).length,
      "ต้องทำใบขนส่งขาไปก่อนทำ Packing List",
    );
    assert(
      !entries(db, "smokeOrder", lotId).length,
      "Owner ออก PO รมควันจาก Packing List นี้แล้ว แก้ไขไม่ได้",
    );
    required(v, "invoiceNo", "เลข Invoice");
    required(v, "product", "รายการสินค้า");
    const boxes = packingListBoxes(v.boxes);
    assert(boxes.length, "กรอกน้ำหนักอย่างน้อย 1 กล่องรับเข้า");
    assert(
      boxes.every((kg) => Number.isFinite(kg) && kg > 0),
      "น้ำหนักกล่องรับเข้าต้องเป็นตัวเลขมากกว่าศูนย์",
    );
    // Blank rows are dropped at save, so the stored list is contiguous: box no = line no.
    v.boxes = boxes.map((kg) => kg.toFixed(2)).join("\n");
    v.boxCount = String(boxes.length);
    /* A2: Sliced Weight Net is the rows added up, never typed — whatever the form sends
     * is recomputed here so the two can never drift apart. */
    v.slicedNetKg = String(boxes.reduce((sum, kg) => sum + kg, 0));
    /* Sliced Weight Lost is what cutting took away — Inv. Weight less Sliced Weight Net,
     * never Chef House's yellow cells. Zero is a normal list: nothing was lost. */
    positive(v, "slicedLostKg", "Sliced Weight Lost", true);
    if (v.invWeightKg?.trim()) {
      positive(v, "invWeightKg", "Inv. Weight");
      withinStock(
        n(v, "slicedNetKg"),
        n(v, "invWeightKg"),
        "น้ำหนักรวมกล่องรับเข้าเกิน Inv. Weight",
        "กก.",
        "รวมได้สูงสุด",
      );
    }
  } else if (kind === "ownerWasteReceive" && lot) {
    required(v, "receivedDate", "วันที่ Owner รับเนื้อ");
    checkDate(v.receivedDate, "วันที่ Owner รับเนื้อ");
    positive(v, "receivedKg", "น้ำหนักรับจริง");
    required(v, "receiver", "ผู้รับเนื้อ");
    assert(
      reservedForOwnerContent(db, lotId) > 0,
      "Foodiva ยังไม่ได้ระบุเนื้อส่วนที่เหลือรอ Owner รับ",
    );
    withinStock(
      n(v, "receivedKg"),
      ownerWasteOutstanding(db, lotId),
      "น้ำหนักรับเกินยอดเนื้อส่วนที่เหลือที่ Foodiva รอให้ Owner รับ",
    );
  } else if (kind === "foodivaReturnReceive" && lot) {
    assert(
      lot.stage === STAGE.central,
      "รอ Owner สร้างใบขนส่งกลับจาก Chef House ก่อน",
    );
    assert(
      entries(db, "return", lotId).length,
      "ยังไม่มีใบขนส่ง Chef House → Foodiva",
    );
    required(v, "receivedDate", "วันที่รับ");
    required(v, "receivedTime", "เวลารับ");
    positive(v, "receivedKg", "น้ำหนักรับ");
    positive(v, "receivedBags", "จำนวนกล่องรมควัน", true);
    assert(
      Number.isInteger(n(v, "receivedBags")),
      "จำนวนกล่องรมควันต้องเป็นจำนวนเต็ม",
    );
    // Foodiva weighs against what the return truck carried, not the full smoke output.
    variance(
      n(v, "receivedKg"),
      n(entries(db, "return", lotId).at(-1)!.values, "returnKg"),
      v,
      false,
    );
  } else if (kind === "dispatch" && lot) {
    assert(
      shipments(db).some((s) => s.id === lotId),
      "Request นี้ถูกยกเลิกแล้ว",
    );
    // The truck carries what the Owner requested; Foodiva does not type a weight.
    v.dispatchKg = lot.values.requestedKg;
    required(v, "pickupDate", "วันรับ");
    required(v, "pickupTime", "เวลารถรับ");
    required(v, "origin", "ต้นทาง");
    required(v, "destination", "ปลายทาง");
    // Fees come from the settings in force when the manifest is made, not the lot's purchase-time snapshot.
    v.outboundCost =
      v.trip === "ไปกลับ"
        ? (db.config.roundFee ?? lot.config.roundFee)
        : (db.config.outboundFee ?? lot.config.outboundFee);
    assert(v.origin !== v.destination, "ต้นทางและปลายทางต้องต่างกัน");
    v.transferNumber = `TR-${date.slice(0, 4)}-${String(entries(db, "dispatch").length + 1).padStart(4, "0")}`;
  } else if (kind === "cmReceive" && lot) {
    // The truck is at the door: Chef House weighs the meat in whether or not the smoke PO
    // has been accepted yet. The PO gates the smoking run instead (see `prepare`).
    required(v, "arrival", "เวลาถึง");
    const received = receivedTotal(db, lotId, v.receivedBoxes);
    v.receivedBoxes = received.boxes;
    v.receivedKg = String(received.total);
  } else if (kind === "prepare" && lot) {
    // The PO authorises the smoking work, so it is checked at the first production step only:
    // `smoke` cannot run without a `prepare` (it needs preSmokeKg), so one guard covers both.
    assert(
      entries(db, "smokeOrderAccept", lotId).length,
      "ต้องยืนยันรับ PO รมควันก่อนเริ่มงานรมควัน",
    );
    positive(v, "preSmokeKg", "น้ำหนักก่อนสโมค");
    withinStock(
      n(v, "preSmokeKg"),
      n(lot.values, "receivedKg"),
      "น้ำหนักก่อนสโมคเกินน้ำหนักรับ",
    );
  } else if (kind === "smoke" && lot) {
    positive(v, "inputKg", "น้ำหนักเข้าเตา");
    withinStock(
      n(v, "inputKg"),
      n(lot.values, "preSmokeKg") - processed(db, lotId),
      "น้ำหนักเข้าเตาเกินน้ำหนักรอผลิต",
    );
    positive(v, "wasteKg", "น้ำหนัก Waste", true);
    required(v, "smokeDate", "วันที่สโมค");
    const weights = packWeights(v.packs);
    assert(
      weights.length > 0 && weights.every(isPackWeight),
      "กรอกน้ำหนักกล่องรมควันทุกกล่องรมควัน ต้องมากกว่า 0 กก.",
    );
    const output = weights.reduce((a, b) => a + b, 0);
    assert(
      Math.abs(output + n(v, "wasteKg") - n(v, "inputKg")) <= 0.001,
      "น้ำหนักกล่องรมควันรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา",
    );
    v.wasteKg = String(n(v, "wasteKg"));
    v.postSmokeKg = output.toFixed(2);
    v.packCount = String(weights.length);
    v.subLot = `SB-${date.slice(0, 4)}-${String(entries(db, "smoke").length + 1).padStart(4, "0")}`;
  } else if (kind === "chefEdit" && lot) {
    // Corrects the receive/prepare/smoke values without touching those entries (see entries()).
    assert(lot.stage === STAGE.closeLot, "แก้ไขได้เฉพาะก่อนยืนยันปิด Lot");
    const receiveEntry = entries(next, "cmReceive", lotId).at(-1);
    const prepareEntry = entries(next, "prepare", lotId).at(-1);
    const smokeEntries = entries(next, "smoke", lotId);
    let drafts: Values[] = [];
    try {
      drafts = JSON.parse(v.batches || "[]");
    } catch {}
    assert(
      receiveEntry &&
        prepareEntry &&
        Array.isArray(drafts) &&
        drafts.length === smokeEntries.length &&
        smokeEntries.every((entry, index) => drafts[index]?.id === entry.id),
      "ไม่พบข้อมูล Lot ล่าสุด",
    );
    // The yellow cells are weighed once, at cmReceive, and never edited again (A5).
    assert(
      v.receivedBoxes === undefined && v.receivedKg === undefined,
      "น้ำหนักรับจริง (ช่องเหลือง) บันทึกครั้งเดียวตอนยืนยันรับเนื้อ แก้ไขไม่ได้",
    );
    const receivedKg = n(lot.values, "receivedKg");
    const preSmokeKg = Number(v.preSmokeKg);
    assert(
      Number.isFinite(receivedKg) &&
        Number.isFinite(preSmokeKg) &&
        receivedKg > 0 &&
        preSmokeKg > 0,
      "กรอกน้ำหนักให้ถูกต้อง",
    );
    withinStock(preSmokeKg, receivedKg, "น้ำหนักก่อนสโมคมากกว่าน้ำหนักรับจริง");
    const batches = drafts.map((draft) => {
      const inputKg = Number(draft.inputKg);
      const wasteKg = Number(draft.wasteKg);
      const weights = packWeights(draft.packs);
      assert(
        draft.smokeDate &&
          Number.isFinite(inputKg) &&
          Number.isFinite(wasteKg) &&
          inputKg > 0 &&
          wasteKg >= 0,
        "กรอกวันที่ น้ำหนักเข้าเตา และ Waste ให้ครบทุกรอบ",
      );
      assert(
        weights.length && weights.every(isPackWeight),
        "กรอกน้ำหนักกล่องรมควันให้ครบและมากกว่า 0 ทุกรอบ",
      );
      const postSmokeKg = weights.reduce((total, weight) => total + weight, 0);
      assert(
        Math.abs(postSmokeKg + wasteKg - inputKg) <= 0.001,
        "น้ำหนักกล่องรมควันรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา",
      );
      return {
        smokeDate: draft.smokeDate,
        inputKg: String(inputKg),
        wasteKg: String(wasteKg),
        packs: weights.join("\n"),
        postSmokeKg: postSmokeKg.toFixed(2),
        packCount: String(weights.length),
      };
    });
    assert(
      Math.abs(
        batches.reduce((total, batch) => total + Number(batch.inputKg), 0) -
          preSmokeKg,
      ) <= 0.001,
      "ก่อนปิด Lot น้ำหนักเข้าเตารวมจาก Log ต้องเท่ากับน้ำหนักก่อนสโมค",
    );
    // Recorded, not applied: save_app_state refuses changed history, so entries() overlays these.
    v.receiveId = receiveEntry.id;
    v.prepareId = prepareEntry.id;
    v.receivedKg = String(receivedKg);
    v.preSmokeKg = String(preSmokeKg);
    const latestBatch = batches.at(-1)!;
    lot.values = {
      ...lot.values,
      arrival: v.arrival,
      preSmokeKg: String(preSmokeKg),
      inputKg: latestBatch.inputKg,
      wasteKg: latestBatch.wasteKg,
      packs: latestBatch.packs,
      postSmokeKg: latestBatch.postSmokeKg,
      packCount: latestBatch.packCount,
    };
    v.batches = JSON.stringify(
      batches.map((batch, index) => ({ id: smokeEntries[index].id, ...batch })),
    );
  } else if (kind === "closeLot" && lot) {
    assert(
      Math.abs(n(lot.values, "preSmokeKg") - processed(db, lotId)) < 0.005,
      "ยังมีน้ำหนักรอผลิต ต้องบันทึกให้ครบก่อน",
    );
    assert(produced(db, lotId) > 0, "ยังไม่มีผลผลิต");
    required(v, "confirm", "ชื่อผู้ยืนยัน");
  } else if (kind === "return" && lot) {
    required(v, "returnDate", "วันที่รถรับ");
    required(v, "returnTime", "เวลารถรับ");
    required(v, "origin", "ต้นทาง");
    required(v, "destination", "ปลายทาง");
    required(v, "vehicleType", "ประเภทรถ");
    required(v, "plate", "ทะเบียนรถ");
    required(v, "driverName", "ชื่อคนขับ");
    required(v, "driverPhone", "เบอร์ติดต่อคนขับ");
    assert(v.origin !== v.destination, "ต้นทางและปลายทางต้องต่างกัน");
    positive(v, "returnKg", "น้ำหนักส่งกลับ");
    v.transferNumber = `TR-${date.slice(0, 4)}-R${String(entries(db, "return").length + 1).padStart(4, "0")}`;
    withinStock(
      n(v, "returnKg"),
      produced(db, lotId),
      "น้ำหนักส่งกลับเกินผลผลิต",
    );
    v.returnCost =
      lot.values.trip === "ไปกลับ"
        ? "0"
        : (db.config.returnFee ?? lot.config.returnFee);
  } else if (kind === "central" && lot) {
    assert(
      entries(db, "foodivaReturnReceive", lotId).length,
      "รอ Foodiva ยืนยันรับเนื้อรมควันก่อน",
    );
    positive(v, "centralKg", "น้ำหนักรับกลาง");
    variance(
      n(v, "centralKg"),
      n(
        entries(db, "foodivaReturnReceive", lotId).at(-1)?.values || {},
        "receivedKg",
      ),
      v,
      false,
    );
  } else if (kind === "allocate") {
    positive(v, "kg", "น้ำหนักจัดสรร");
    withinStock(n(v, "kg"), centralStock(db, lotId), "สต๊อกกลางไม่พอ");
    assert(branches.includes(v.branch), "เลือกสาขา");
  } else if (kind === "receive") {
    positive(v, "kg", "น้ำหนักรับ");
    const allocation = entries(db, "allocate", lotId, branch).find(
      (e) => e.id === v.allocation,
    );
    assert(allocation, "เลือกใบจัดสรร");
    const outstanding = allocationOutstanding(db, allocation);
    // Outstanding is rounded to 0.01, so compare the receive at that precision too:
    // receiving an allocation's exact 10.004 kg against its 10.00 shown must pass (COR-15).
    withinStock(
      Math.round(n(v, "kg") * 100) / 100,
      outstanding,
      "รับเกินยอดค้างรับ",
    );
    // Closing the allocation makes any shortfall final, so it needs a reason; a
    // partial receive leaves the rest pending.
    if (v.complete === "1") variance(n(v, "kg"), outstanding, v);
  } else if (kind === "thaw") {
    positive(v, "kg", "น้ำหนักละลาย");
    withinStock(
      n(v, "kg"),
      balance(db, lotId, branch).frozen,
      "สต๊อกแช่แข็งไม่พอ",
    );
    const oldest = db.lots
      .filter((l) => balance(db, l.id, branch).frozen > 0.001)
      .sort((a, b) =>
        (a.values.smokeDate || a.id).localeCompare(b.values.smokeDate || b.id),
      )[0];
    if (oldest && oldest.id !== lotId) required(v, "reason", "เหตุผลข้าม FIFO");
  } else if (kind === "ricePurchase") {
    // Every purchase says which way this round goes (B2): self-cook buys raw rice,
    // bought-cooked buys cooked rice. The other side is zeroed. Minburi only buys cooked.
    if (!cooksRice(branch)) v.riceSource = riceSources[1];
    assert(riceSources.includes(v.riceSource), "เลือกที่มาของข้าวเหนียวรอบนี้");
    const selfCook = v.riceSource === riceSources[0];
    for (const key of selfCook
      ? ["cookedRiceKg", "cookedRiceCost"]
      : ["rawRiceKg", "rawRiceCost"])
      v[key] = "0";
    required(v, "supplier", "ผู้จำหน่ายข้าว");
    if (selfCook) {
      positive(v, "rawRiceKg", "ข้าวเหนียวดิบซื้อเข้า");
      positive(v, "rawRiceCost", "ยอดซื้อข้าวเหนียวดิบ");
      v.totalCost = v.rawRiceCost;
    } else {
      // cookedRicePar is only a hint in the form now, never a block (FB-12).
      positive(v, "cookedRiceKg", "ข้าวเหนียวสุกซื้อเข้า");
      positive(v, "cookedRiceCost", "ยอดซื้อข้าวเหนียวสุก");
      v.totalCost = v.cookedRiceCost;
    }
  } else if (kind === "chiliAllocate") {
    assert(branches.includes(v.branch), "เลือกสาขาปลายทาง");
    positive(v, "chiliTubes", "จำนวนน้ำพริกที่จัดสรร");
    assert(
      Number.isInteger(n(v, "chiliTubes")),
      "น้ำพริกต้องเป็นจำนวนหลอดเต็ม",
    );
    withinStock(
      n(v, "chiliTubes"),
      ownerChiliStock(db),
      "น้ำพริกในคลัง Owner ไม่พอ กรุณาบันทึกซื้อเข้าบัญชีก่อน",
      "หลอด",
    );
  } else if (kind === "chiliPurchase") {
    positive(v, "chiliTubes", "น้ำพริกซื้อเข้า");
    assert(
      Number.isInteger(n(v, "chiliTubes")),
      "น้ำพริกต้องเป็นจำนวนหลอดเต็ม",
    );
    positive(v, "chiliCost", "ยอดซื้อน้ำพริก");
    required(v, "supplier", "ผู้จำหน่ายน้ำพริก");
    v.totalCost = v.chiliCost;
  } else if (kind === "riceIssue") {
    assert(cooksRice(branch), noCookMessage);
    positive(v, "rawRiceIssuedKg", "ข้าวเหนียวดิบที่เบิก");
    withinStock(
      n(v, "rawRiceIssuedKg"),
      rawRiceStock(db, branch),
      "ข้าวเหนียวดิบในสต๊อกไม่พอ",
    );
    required(v, "receiver", "ผู้รับของ");
  } else if (kind === "chiliIssue") {
    positive(v, "chiliIssuedTubes", "น้ำพริกที่เบิก");
    assert(
      Number.isInteger(n(v, "chiliIssuedTubes")),
      "น้ำพริกต้องเป็นจำนวนหลอดเต็ม",
    );
    withinStock(
      n(v, "chiliIssuedTubes"),
      chiliStock(db, branch),
      "น้ำพริกในสต๊อกไม่พอ",
      "หลอด",
    );
    required(v, "receiver", "ผู้รับของ");
  } else if (kind === "supplyPurchase") {
    for (const key of [
      "rawRiceKg",
      "rawRiceCost",
      "cookedRiceKg",
      "cookedRiceCost",
      "chiliTubes",
      "chiliCost",
    ])
      v[key] ??= "0";
    positive(v, "rawRiceKg", "ข้าวเหนียวดิบซื้อเข้า", true);
    positive(v, "rawRiceCost", "ยอดซื้อข้าวเหนียวดิบ", true);
    assert(cooksRice(branch) || n(v, "rawRiceKg") === 0, noCookMessage);
    positive(v, "cookedRiceKg", "ข้าวเหนียวสุกซื้อเข้า", true);
    positive(v, "cookedRiceCost", "ยอดซื้อข้าวเหนียวสุก", true);
    positive(v, "chiliTubes", "น้ำพริกซื้อเข้า", true);
    positive(v, "chiliCost", "ยอดซื้อน้ำพริก", true);
    assert(
      n(v, "rawRiceKg") > 0 ||
        n(v, "cookedRiceKg") > 0 ||
        n(v, "chiliTubes") > 0,
      "กรอกจำนวนข้าวเหนียวหรือน้ำพริกที่ซื้อเข้า",
    );
    assert(
      Number.isInteger(n(v, "chiliTubes")),
      "น้ำพริกต้องเป็นจำนวนหลอดเต็ม",
    );
    if (n(v, "rawRiceKg") > 0)
      positive(v, "rawRiceCost", "ยอดซื้อข้าวเหนียวดิบ");
    if (n(v, "cookedRiceKg") > 0)
      positive(v, "cookedRiceCost", "ยอดซื้อข้าวเหนียวสุก");
    if (n(v, "chiliTubes") > 0) positive(v, "chiliCost", "ยอดซื้อน้ำพริก");
    required(v, "supplier", "ผู้จำหน่าย");
    v.totalCost = String(
      n(v, "rawRiceCost") + n(v, "cookedRiceCost") + n(v, "chiliCost"),
    );
  } else if (kind === "supplyIssue") {
    positive(v, "rawRiceIssuedKg", "ข้าวเหนียวดิบที่เบิก", true);
    assert(cooksRice(branch) || n(v, "rawRiceIssuedKg") === 0, noCookMessage);
    positive(v, "chiliIssuedTubes", "น้ำพริกที่เบิก", true);
    assert(
      n(v, "rawRiceIssuedKg") > 0 || n(v, "chiliIssuedTubes") > 0,
      "กรอกจำนวนข้าวเหนียวดิบหรือน้ำพริกที่เบิก",
    );
    assert(
      Number.isInteger(n(v, "chiliIssuedTubes")),
      "น้ำพริกที่เบิกต้องเป็นจำนวนหลอดเต็ม",
    );
    withinStock(
      n(v, "rawRiceIssuedKg"),
      rawRiceStock(db, branch),
      "ข้าวเหนียวดิบในสต๊อกไม่พอ",
    );
    withinStock(
      n(v, "chiliIssuedTubes"),
      chiliStock(db, branch),
      "น้ำพริกในสต๊อกไม่พอ",
      "หลอด",
    );
    required(v, "receiver", "ผู้รับของ");
  } else if (kind === "rice") {
    assert(cooksRice(branch), noCookMessage);
    // Cooked rice may weigh more than the raw rice it came from (FB-10): no ratio check.
    positive(v, "rawUsedKg", "ข้าวเหนียวดิบที่นำมาหุง");
    positive(v, "riceKg", "ข้าวเหนียวสุกที่ได้");
    withinStock(
      n(v, "rawUsedKg"),
      issuedRawRiceStock(db, branch),
      "ข้าวเหนียวดิบที่เบิกไว้ไม่พอ กรุณาบันทึกเบิกก่อนหุง",
    );
  } else if (kind === "riceCarry") {
    positive(v, "leftoverKg", "ข้าวเหนียวสุกเหลือปลายวัน", true);
    variance(n(v, "leftoverKg"), cookedRiceStock(db, branch), v);
    required(v, "reheat", "การจัดการวันถัดไป");
  } else if (kind === "materials") {
    for (let i = 0; i < 7; i++) {
      positive(v, "material" + i, materials[i], true);
      assert(Number.isInteger(n(v, "material" + i)), "วัสดุต้องเป็นจำนวนเต็ม");
      if (v["opening" + i] !== undefined || v["used" + i] !== undefined) {
        const expectedOpening = branchMaterialStock(db, branch, i, date);
        positive(v, "opening" + i, `ยอดตั้งต้น ${materials[i]}`, true);
        positive(v, "used" + i, `จำนวนใช้ ${materials[i]}`, true);
        assert(
          Number.isInteger(n(v, "opening" + i)) &&
            Number.isInteger(n(v, "used" + i)),
          "ยอดวัสดุต้องเป็นจำนวนเต็ม",
        );
        assert(
          n(v, "opening" + i) === expectedOpening,
          `ยอดตั้งต้น ${materials[i]} มีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่`,
        );
        withinStock(
          n(v, "used" + i),
          expectedOpening,
          `จำนวนใช้ ${materials[i]} เกินยอดตั้งต้น`,
          "",
        );
        const expectedRemaining = expectedOpening - n(v, "used" + i);
        assert(
          n(v, "material" + i) >= 0,
          `ยอดตรวจนับ ${materials[i]} ติดลบไม่ได้`,
        );
        if (Math.abs(n(v, "material" + i) - expectedRemaining) > 0.001)
          required(v, "materialReason" + i, `เหตุผลส่วนต่าง ${materials[i]}`);
      }
    }
    /* Saving again is how a mistyped count gets fixed. Stamp the round and the
     * reason instead of locking the form, so the owner can tell an honest fix from
     * a quiet rewrite: every round stays in the log. */
    const recorded = entries(db, "materials", undefined, branch, date);
    if (recorded.length) {
      v.revision = String(recorded.length + 1);
      required(v, "correctionReason", "เหตุผลที่แก้ไขยอดวัสดุ");
    }
  } else if (kind === "materialReceive") {
    required(v, "purchaseDate", "วันที่ซื้อวัสดุ");
    checkDate(v.purchaseDate, "วันที่ซื้อวัสดุ");
    assert(materials.includes(v.material), "เลือกวัสดุ");
    positive(v, "quantity", "จำนวนรับเข้าคลัง");
    assert(Number.isInteger(n(v, "quantity")), "จำนวนวัสดุต้องเป็นจำนวนเต็ม");
    positive(v, "unitPrice", "ราคาต่อหน่วย", true);
    required(v, "supplier", "ผู้จำหน่าย");
    v.totalCost = String(n(v, "quantity") * n(v, "unitPrice"));
  } else if (kind === "generalPurchase") {
    required(v, "purchaseDate", "วันที่ซื้อ");
    checkDate(v.purchaseDate, "วันที่ซื้อ");
    required(v, "item", "รายการที่ซื้อ");
    required(v, "purchaseCategory", "หมวดบัญชี");
    positive(v, "quantity", "จำนวนที่ซื้อ");
    positive(v, "unitPrice", "ราคาซื้อต่อหน่วย", true);
    required(v, "supplier", "ผู้จำหน่าย");
    v.totalCost = String(n(v, "quantity") * n(v, "unitPrice"));
  } else if (kind === "materialTransfer") {
    assert(materials.includes(v.material), "เลือกวัสดุ");
    assert(branches.includes(v.branch), "เลือกสาขาปลายทาง");
    const materialIndex = materials.indexOf(v.material);
    assert(
      materialPar(db, v.branch, materialIndex) > 0 &&
        materialUnitPrice(db, v.branch, materialIndex) > 0,
      `ตั้งจำนวนฐานและราคาต่อหน่วยของ ${v.material} สำหรับสาขา${v.branch} ก่อนส่ง`,
    );
    positive(v, "quantity", "จำนวนที่ส่ง");
    assert(Number.isInteger(n(v, "quantity")), "จำนวนวัสดุต้องเป็นจำนวนเต็ม");
    withinStock(
      n(v, "quantity"),
      ownerMaterialStock(db, v.material),
      `${v.material} ในคลัง Owner ไม่พอ`,
      "",
    );
    required(v, "receiver", "ผู้รับของ");
    v.requiresConfirm = "1";
  } else if (kind === "materialConfirm") {
    const transfer = entries(db, "materialTransfer", undefined, branch).find(
      (entry) => entry.id === v.transferId,
    );
    assert(transfer, "ไม่พบรายการส่งวัสดุ");
    assert(
      !entries(db, "materialConfirm", undefined, branch).some(
        (entry) => entry.values.transferId === v.transferId,
      ),
      "ยืนยันรับรายการนี้แล้ว",
    );
    positive(v, "receivedQuantity", "จำนวนที่รับจริง");
    assert(
      Number.isInteger(n(v, "receivedQuantity")),
      "จำนวนรับจริงต้องเป็นจำนวนเต็ม",
    );
    withinStock(
      n(v, "receivedQuantity"),
      n(transfer.values, "quantity"),
      "จำนวนรับจริงเกินจำนวนที่ส่ง",
      "",
    );
    variance(n(v, "receivedQuantity"), n(transfer.values, "quantity"), v);
    required(v, "receiver", "ชื่อผู้รับจริง");
  } else if (kind === "sale") {
    for (const k of [
      "boxes",
      "addons",
      "chiliAddons",
      "soldKg",
      "wasteKg",
      "expense",
      "lineMan",
      "riceWasteKg",
    ])
      positive(v, k, k, true);
    for (const k of ["boxes", "addons", "chiliAddons"])
      assert(Number.isInteger(n(v, k)), "จำนวนขายต้องเป็นจำนวนเต็ม");
    v.riceServings = v.boxes;
    v.chiliComplimentary = "0";
    v.chiliSold = String(n(v, "chiliAddons"));
    // 100–103 g per pack is only a warning (packWeightWarning): the form shows it.
    withinStock(
      n(v, "soldKg") + n(v, "wasteKg"),
      balance(db, lotId, branch).ready,
      "น้ำหนักที่ใช้และเวสต์เกินเนื้อที่ละลายแล้ว (รวมชิลยกมา)",
      "กก.",
      "ใช้จริงรวมเวสต์ได้สูงสุด",
    );
    withinStock(
      n(v, "riceServings") * 0.2 + n(v, "riceWasteKg"),
      cookedRiceStock(db, branch),
      "ข้าวเหนียวไม่พอ",
      "กก.",
      "มีข้าวเหนียวสุก",
    );
    withinStock(
      n(v, "chiliSold"),
      chiliStock(db, branch),
      "น้ำพริกที่ Owner จัดสรรให้สาขาไม่พอ",
      "หลอด",
    );
    const hasChiliCount = v.chiliCount !== undefined && v.chiliCount !== "";
    const expectedChili = chiliStock(db, branch) - n(v, "chiliSold");
    v.chiliExpected = String(expectedChili);
    if (hasChiliCount) {
      positive(v, "chiliCount", "ยอดตรวจนับน้ำพริก", true);
      assert(
        Number.isInteger(n(v, "chiliCount")),
        "ยอดตรวจนับน้ำพริกต้องเป็นจำนวนหลอดเต็ม",
      );
      if (n(v, "chiliCount") !== expectedChili)
        required(v, "chiliRemark", "หมายเหตุเมื่อน้ำพริกไม่ตรง");
    }
    if (n(v, "wasteKg") > 0 || n(v, "riceWasteKg") > 0)
      required(v, "reason", "เหตุผล Waste");
    if (n(v, "expense") > 0) required(v, "payer", "ผู้จ่ายเงิน");
    v.revenue = v.lineMan;
    v.menuTotal = String(
      n(v, "boxes") * n(db.config, "boxPrice") +
        n(v, "addons") * n(db.config, "addonPrice") +
        n(v, "chiliAddons") * n(db.config, "chiliPrice"),
    );
    v.meatCost = String(n(v, "soldKg") * (lotCost(db, lot!).perKg || 0));
    v.wasteCost = String(n(v, "wasteKg") * (lotCost(db, lot!).perKg || 0));
  } else if (kind === "influencerBox") {
    /* A giveaway is a sale with no money in: the same goods leave the shelf, so it
     * carries the same value keys and every stock helper counts it for free.
     * The name is free text until the influencer table exists to link it to. */
    required(v, "influencer", "ชื่ออินฟลูเอนเซอร์");
    for (const [key, label] of [
      ["boxes", "จำนวนกล่องสินค้า"],
      ["chiliAddons", "จำนวนน้ำพริก"],
      ["shippingFee", "ค่าส่ง"],
    ])
      positive(v, key, label, true);
    for (const k of ["boxes", "chiliAddons"])
      assert(Number.isInteger(n(v, k)), "จำนวนที่ส่งต้องเป็นจำนวนเต็ม");
    /* A giveaway sends whole standard boxes only, so the meat it costs follows the
     * box count (`packKg`, น้ำหนักเฉลี่ยต่อซีล) instead of being weighed and typed —
     * the same discipline as packingList's slicedNetKg. Whatever the form sent for
     * these two keys is overwritten, and every stock helper keeps reading `soldKg`. */
    v.addons = "0";
    v.soldKg = String(n(v, "boxes") * n(db.config, "packKg"));
    const sentPacks = n(v, "boxes");
    assert(
      sentPacks + n(v, "chiliAddons") > 0,
      "กรอกของที่ส่งให้อินฟลูเอนเซอร์อย่างน้อย 1 รายการ",
    );
    withinStock(
      n(v, "soldKg"),
      balance(db, lotId, branch).ready,
      "น้ำหนักที่ส่งเกินเนื้อที่ละลายแล้ว (รวมชิลยกมา)",
    );
    v.riceServings = v.boxes;
    v.chiliSold = String(n(v, "chiliAddons"));
    withinStock(
      n(v, "riceServings") * 0.2,
      cookedRiceStock(db, branch),
      "ข้าวเหนียวไม่พอ",
      "กก.",
      "มีข้าวเหนียวสุก",
    );
    withinStock(
      n(v, "chiliSold"),
      chiliStock(db, branch),
      "น้ำพริกที่ Owner จัดสรรให้สาขาไม่พอ",
      "หลอด",
    );
    v.meatCost = String(n(v, "soldKg") * (lotCost(db, lot!).perKg || 0));
  } else if (kind === "closeDay") {
    // Any time of day (FB-14): what blocks a close is missing data, not the clock.
    const missing = closeDayChecklist(db, branch, date).find(
      (item) => item.required && !item.done,
    );
    assert(!missing, missing?.message ?? "");
    // Thawed meat left over is not an error: it carries into tomorrow as chill.
    required(v, "confirm", "ชื่อผู้ยืนยัน");
  } else if (kind === "expense") {
    positive(v, "amount", "ยอดเงิน");
    required(v, "category", "หมวดหมู่");
    required(v, "detail", "รายละเอียด");
  } else if (kind === "unlock") {
    assert(isClosed(db, branch, date), "วันนี้ยังไม่ได้ปิด");
    required(v, "reason", "เหตุผลปลดล็อก");
  } else if (kind === "void") {
    const target = db.entries.find((entry) => entry.id === v.targetId);
    const reversible = [
      "allocate",
      "chiliAllocate",
      "receive",
      "thaw",
      "ricePurchase",
      "chiliPurchase",
      "riceIssue",
      "chiliIssue",
      "rice",
      "riceCarry",
      "sale",
      "influencerBox",
      "materials",
      "materialReceive",
      "generalPurchase",
      "materialTransfer",
      "materialConfirm",
      "closeDay",
      "expense",
      "unlock",
      "shipmentRequest",
    ];
    assert(target && reversible.includes(target.kind), "รายการนี้ยกเลิกไม่ได้");
    if (target.kind === "shipmentRequest")
      assert(
        db.lots.find((l) => l.id === target.lotId)?.stage === STAGE.dispatch,
        "Foodiva ทำใบขนส่งแล้ว ยกเลิก Request ไม่ได้",
      );
    assert(
      !db.entries.some(
        (entry) =>
          entry.kind === "void" && entry.values.targetId === v.targetId,
      ),
      "รายการนี้ถูกยกเลิกแล้ว",
    );
    /* A void takes the target out of every figure, like an edit does, so it gets the same
     * stock check. An allocation or transfer the branch already took in would otherwise go
     * back to central stock while the branch keeps it: void the branch's entry first. */
    if (target.kind === "allocate")
      assert(
        !entries(db, "receive").some((r) => r.values.allocation === target.id),
        "สาขารับเนื้อจากใบจัดสรรนี้แล้ว · ยกเลิกรายการรับเนื้อก่อน",
      );
    if (target.kind === "materialTransfer")
      assert(
        !entries(db, "materialConfirm").some(
          (c) => c.values.transferId === target.id,
        ),
        "สาขายืนยันรับวัสดุจากใบโอนนี้แล้ว · ยกเลิกรายการยืนยันรับก่อน",
      );
    const before = stockLevels(db);
    for (const [key, level] of stockLevels({
      ...db,
      entries: [
        ...db.entries,
        { ...target, id: newId(), kind, role, values: { targetId: target.id } },
      ],
    }))
      assert(
        level >= -0.001 || level >= (before.get(key) ?? 0) - 0.001,
        `ยกเลิกแล้ว${key.split("#")[0]}จะติดลบ (${fmt(level)}) · ยกเลิกรายการที่ตามมาก่อน`,
      );
    required(v, "reason", "เหตุผลยกเลิกรายการ");
    v.targetKind = target.kind;
    v.targetDate = target.date;
    v.targetBranch = target.branch;
  } else if (kind === "entryEdit" || kind === "editRequest") {
    // Recorded, not applied: entries() overlays the `to.` values on the target (like chefEdit).
    const target = editTarget(db, v.targetId, role, branch);
    if (kind === "editRequest")
      assert(
        !openEditRequest(db, target.id),
        "รายการนี้มีคำขอแก้ไขรอพิจารณาอยู่แล้ว",
      );
    required(v, "reason", "เหตุผลที่แก้ไข");
    let proposed: Values = {};
    try {
      proposed = JSON.parse(v.values || "{}");
    } catch {}
    delete v.values;
    Object.assign(v, editValues(db, target, proposed));
    lotId = target.lotId;
  } else if (kind === "editDecision") {
    const request = entries(db, "editRequest").find(
      (e) => e.id === v.requestId,
    );
    assert(request, "ไม่พบคำขอแก้ไข");
    assert(!editDecisionOf(db, request.id), "คำขอนี้พิจารณาแล้ว");
    assert(
      Object.values(editDecisions).includes(v.decision),
      "เลือกอนุมัติหรือไม่อนุมัติ",
    );
    v.targetId = request.values.targetId;
    v.requesterRole = request.role;
    v.requesterBranch = request.branch;
    if (v.decision === editDecisions.approve) {
      // Checked again now: the log may have moved on since the request was filed.
      const target = editTarget(db, v.targetId, role, branch);
      Object.assign(v, editValues(db, target, unpack("to.", request.values)));
    } else {
      required(v, "note", "เหตุผลที่ไม่อนุมัติ");
      for (const key of [
        "targetKind",
        "targetDate",
        "targetRole",
        "targetBranch",
      ])
        v[key] = request.values[key];
    }
    lotId = request.lotId;
  } else if (kind === "config") {
    // An unchanged legacy logo (a data URL, up to ~1.4 MB) would be copied into every
    // config entry of the append-only log. Left out, the merge below keeps it.
    if (v.logoData === db.config.logoData) delete v.logoData;
    v.ricePrice = "0";
    // Labels match the Thai setting names in ConfigView.
    for (const [key, label] of Object.entries({
      boxPrice: "ราคากล่องมาตรฐาน",
      addonPrice: "ราคาเนื้อซีลเพิ่ม",
      packKg: "น้ำหนักเฉลี่ยต่อซีล",
      ricePrice: "ราคาข้าว",
      chiliPrice: "ราคาขายน้ำพริกหลอด",
      rawRicePar: "จำนวนฐานข้าวเหนียวดิบ",
      rawRiceUnitPrice: "ราคาต่อหน่วยข้าวเหนียวดิบ",
      chiliPar: "จำนวนฐานน้ำพริก",
      chiliUnitPrice: "ราคาต่อหน่วยน้ำพริก",
      cookedRicePar: "จำนวนฐานข้าวเหนียวสุก",
      cookedRiceUnitPrice: "ราคาต่อหน่วยข้าวเหนียวสุก",
      outboundFee: "ค่าขนส่งขาไป",
      returnFee: "ค่าขนส่งขากลับ",
      roundFee: "ค่าขนส่งไป-กลับ",
      tolerance: "ค่าคลาดเคลื่อนยอดขาย",
    }))
      positive(v, key, label, key !== "packKg");
    assert(n(v, "tolerance") <= 100, "ค่าคลาดเคลื่อนต้องไม่เกิน 100%");
    assert(branches.includes(v.branch), "เลือกสาขาสำหรับบัญชีทดลอง");
    required(v, "companyName", "ชื่อบริษัท");
    for (let i = 0; i < materials.length; i++) {
      positive(v, "material" + i, `จำนวนฐาน ${materials[i]}`, true);
      positive(v, "materialPrice" + i, `ราคาต่อหน่วย ${materials[i]}`, true);
      for (const suffix of ["saladaeng", "minburi"]) {
        if (v[`material${i}_${suffix}`] !== undefined)
          positive(
            v,
            `material${i}_${suffix}`,
            `จำนวนฐาน ${materials[i]}`,
            true,
          );
        if (v[`materialPrice${i}_${suffix}`] !== undefined)
          positive(
            v,
            `materialPrice${i}_${suffix}`,
            `ราคาต่อหน่วย ${materials[i]}`,
            true,
          );
      }
    }
    next.config = { ...db.config, ...v };
  }
  if (lot && expected > 0 && kind !== "allocate") {
    lot.values = { ...lot.values, ...v };
    if (kind !== "smoke") lot.stage++;
    else if (
      Math.abs(
        n(lot.values, "preSmokeKg") - processed(db, lotId) - n(v, "inputKg"),
      ) < 0.005
    )
      lot.stage = STAGE.closeLot;
  }
  const entryDate = ["materialReceive", "generalPurchase"].includes(kind)
    ? v.purchaseDate || date
    : kind === "ownerWasteReceive"
      ? v.receivedDate || date
      : date;
  next.entries.push({
    id: newId(),
    kind,
    role,
    lotId: lot?.id || lotId,
    branch,
    date: entryDate,
    at: new Date().toISOString(),
    values: v,
  });
  return next;
}

/** Foodiva's one outbound form: the transport document and its Packing List land in one save,
 *  the document first (packingList refuses a shipment with no dispatch). */
export const dispatchWithPackingList = (
  db: Database,
  lotId: string,
  trip: Values,
  packing: Values,
  date: string,
) =>
  mutate(
    mutate(db, "foodiva", "dispatch", trip, lotId, date),
    "foodiva",
    "packingList",
    packing,
    lotId,
    date,
  );
/** How one giveaway block is named in a message: its number, plus the name once typed. */
export const influencerLabel = (index: number, values: Values) =>
  `อินฟลูเอนเซอร์ที่ ${index + 1}${values.influencer?.trim() ? ` (${values.influencer.trim()})` : ""}`;
/** The branch's day-end record: every influencer giveaway on the sale's lot is its own
 *  entry, then the sale itself.
 *
 *  The giveaways go first because the sale is the closing tally. Its end-of-day chili
 *  count (`chiliCount` against `chiliExpected`) is measured on the shelf as it stands,
 *  which the giveaway tubes have already left; recording the sale first would compute
 *  an expected count that still holds them and turn a truthful count into a variance
 *  that demands a remark. It also means the sale's own over-stock messages say how much
 *  thawed meat, rice and chili is left for selling once the giveaways are out.
 *
 *  Folding over the cloned database makes the save all-or-nothing: an invalid block
 *  throws before anything reaches the caller, so nothing at all is written. */
export const saleWithInfluencers = (
  db: Database,
  branch: string,
  date: string,
  /** The lot the sale form is open on; every giveaway hangs on the same one. */
  lotId: string,
  giveaways: Values[],
  saleValues: Values,
) =>
  mutate(
    giveaways.reduce((current, giveaway, index) => {
      try {
        return mutate(
          current,
          "branch",
          "influencerBox",
          giveaway,
          lotId,
          date,
          branch,
        );
      } catch (caught) {
        // Say which block was refused — several are saved at once, and the form
        // shows one message. The error object itself is kept (OverStockError is
        // what tells the form to speak up before every field is filled).
        if (caught instanceof Error)
          caught.message = `${influencerLabel(index, giveaway)} · ${caught.message}`;
        throw caught;
      }
    }, db),
    "branch",
    "sale",
    saleValues,
    lotId,
    date,
    branch,
  );
