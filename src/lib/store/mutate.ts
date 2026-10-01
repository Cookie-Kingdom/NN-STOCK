/** `mutate`: the only way to change the database. Every entry is validated here; a batch's
 *  `values` cache is filled here. It refuses (`assert`) only what would make the log wrong: the
 *  wrong role, a retired kind, a future or bad date or time, a typed value that is not a number,
 *  a missing reference (a PO, an allocation, an edit target) and paying the same document
 *  twice (PRIN-03). An empty field is saved and listed in `missing` (GEN-02); a
 *  quantity over stock, a closed day or a second once-per-batch entry is only a warning (`warn`). */
import { fmt } from "../format";
import { newId } from "../id";
import {
  batchKinds,
  branchMeatKinds,
  branches,
  canLink,
  dateField,
  editLockedKeys,
  lotMovableKinds,
  materials,
  missingKeys,
  pack,
  retiredKinds,
  titles,
  type Database,
  type Entry,
  type EntryKind,
  type ActingRole,
  type Lot,
  type Role,
  type Values,
} from "./model";
import {
  allocationOutstanding,
  balance,
  batchEntries,
  branchMaterialStock,
  centralStock,
  chiliStock,
  closeDayChecklist,
  cookedRiceStock,
  decimal,
  drawnKg,
  entries,
  isClosed,
  isPackWeight,
  isVoided,
  issuedRawRiceStock,
  latestPackingList,
  liveLots,
  n,
  ownerChiliStock,
  ownerMaterialStock,
  ownerWasteOutstanding,
  ownerWasteReceived,
  packWeights,
  pendingReceiveKg,
  poInUse,
  poRemainingKg,
  processed,
  produced,
  purchaseLots,
  rawRiceStock,
  reservedForOwnerContent,
  riceSources,
  smokeServiceRate,
  smokingInvoiceStatus,
  sum,
} from "./derived";
import { editBlock, omit, saleMoneyKeys, voidBlock } from "./visibility";
/** Stock figures an edit must not push below zero, keyed `label#id`. STK-44: the Owner's store
 *  only for the Owner; a branch's copy has none of the Owner's purchases, so there it is just
 *  minus what the branch received. */
function stockLevels(db: Database, role: ActingRole) {
  const levels = new Map<string, number>();
  for (const b of branches) {
    for (const lotId of [...db.lots.map((lot) => lot.id), ""]) {
      const x = balance(db, lotId, b);
      const name = lotId || "ไม่ระบุ Lot";
      levels.set(`เนื้อแช่แข็ง ${name} สาขา${b}#`, x.frozen);
      levels.set(`เนื้อละลายแล้ว ${name} สาขา${b}#`, x.ready);
    }
    levels.set(`ข้าวเหนียวดิบ สาขา${b}#`, rawRiceStock(db, b));
    levels.set(`ข้าวเหนียวดิบที่เบิก สาขา${b}#`, issuedRawRiceStock(db, b));
    levels.set(`น้ำพริก สาขา${b}#`, chiliStock(db, b));
    materials.forEach((m, i) =>
      levels.set(`${m} สาขา${b}#`, branchMaterialStock(db, b, i)),
    );
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
  if (role === "branch") return levels;
  // The label ends in a Latin word, so it carries its own space before "จะติดลบ".
  levels.set("น้ำพริกในคลัง Owner #", ownerChiliStock(db));
  for (const m of materials)
    levels.set(`${m} ในคลัง Owner #`, ownerMaterialStock(db, m));
  return levels;
}
/** `target` as `proposed` (and a new date or lot, EDT-24) would leave it: its values
 *  normalised and checked by the target kind's own rules as if it were saved again now without
 *  the original (so its own kg are back in stock), and where it moved. Then no stock may go
 *  below zero that was not already there. */
function correctedEntry(
  db: Database,
  role: ActingRole,
  target: Entry,
  proposed: Values,
  date: string,
  lotId: string,
) {
  for (const key of editLockedKeys)
    assert(
      proposed[key] === undefined ||
        proposed[key] === (target.values[key] ?? ""),
      "แก้สาขาปลายทางไม่ได้ · ลบรายการแล้วบันทึกใหม่",
    );
  assert(
    lotId === target.lotId ||
      (lotMovableKinds.includes(target.kind) &&
        liveLots(db).some((lot) => lot.id === lotId)),
    "ย้าย Lot ของรายการนี้ไม่ได้",
  );
  const held = lotId !== target.lotId && referring(db, target)[0];
  assert(
    !held,
    `${held ? titles[held.kind] : ""} อ้างถึงรายการนี้อยู่ · ย้ายหรือลบรายการนั้นก่อน`,
  );
  const as = (kind: EntryKind, values: Values): Database => ({
    ...db,
    entries: [
      ...db.entries,
      { ...target, id: newId(), kind, role: "owner", values },
    ],
  });
  /* The Account Manager's copy has no sale money (C4): a sale without its LINE MAN amount is
   * checked with a stand-in, and the edit is saved without money for save_app_state to fill in
   * from the server's copy. */
  const moneyHidden =
    target.kind === "sale" && target.values.lineMan === undefined;
  const input = { ...target.values, ...proposed };
  if (moneyHidden && input.lineMan === undefined) input.lineMan = "0";
  // The truck fee is the one in force when the manifest was made; a changed trip is priced again.
  if (
    target.kind === "dispatch" &&
    (input.trip ?? "") !== (target.values.trip ?? "")
  )
    delete input.outboundCost;
  if (target.kind === "smokingInvoice")
    warn(
      smokingInvoiceStatus(db, target) !== "ชำระแล้ว",
      "Invoice นี้ชำระแล้ว · ตรวจยอดชำระกับยอดใหม่",
    );
  const checked = record(
    as("void", { targetId: target.id }),
    // Partners' entries are recorded by the Owner for them; recordRole() re-stamps the kind.
    target.role === "branch" ? "branch" : "owner",
    target.kind,
    input,
    lotId,
    date,
    target.branch,
    true,
  ).entries.at(-1)!;
  const values = moneyHidden
    ? omit(checked.values, saleMoneyKeys)
    : checked.values;
  // The overlay merges, so a value the rules no longer write (the invoice of a payment moved
  // to a batch that has none) is cleared, not left as it was.
  for (const key of Object.keys(target.values))
    if (checked.values[key] === undefined && key !== "attachmentData")
      values[key] = "";
  // A date kept in the values (a purchase's, a waste pick-up's) moves the entry with it.
  const moved: Values = {
    ...(checked.date !== target.date && {
      fromDate: target.date,
      toDate: checked.date,
    }),
    // The lot asked for, not the scratch save's: a PO saved again there would open a new lot.
    ...(lotId !== target.lotId && { fromLotId: target.lotId, toLotId: lotId }),
  };
  const before = stockLevels(db, role);
  const after = as("entryEdit", {
    targetId: target.id,
    ...pack("to.", values),
    ...moved,
  });
  const touched = cachedOn(db, target, moved.toLotId);
  for (const [key, level] of stockLevels(
    {
      ...after,
      lots: after.lots.map((lot) =>
        touched.has(lot.id) ? recached(after, lot) : lot,
      ),
    },
    role,
  ))
    warn(
      level >= -0.001 || level >= (before.get(key) ?? 0) - 0.001,
      `แก้แล้ว${key.split("#")[0]}จะติดลบ (${fmt(level)}) · แก้รายการที่ตามมาก่อน`,
    );
  return { values, moved };
}
/** Kinds a lot's cache is rebuilt for: a batch's steps (the cached ones, and all of them for
 *  `deleted`) and the PO itself. No branch kind is among them, so a branch never writes a lot. */
const lotKinds: EntryKind[] = [...batchKinds, "purchase"];
/** The lots whose cache a change to `entry` reaches: the one it was recorded on, every lot an
 *  edit moved it from or to, and `more`. */
function cachedOn(db: Database, entry: Entry, ...more: (string | undefined)[]) {
  if (!lotKinds.includes(entry.kind)) return new Set<string>();
  const raw = db.entries.find((e) => e.id === entry.id) ?? entry;
  return new Set(
    [
      raw.lotId,
      entry.lotId,
      ...db.entries
        .filter((e) => e.kind === "entryEdit" && e.values.targetId === entry.id)
        .flatMap((e) => [e.values.fromLotId, e.values.toLotId]),
      ...more,
    ].filter((id): id is string => !!id),
  );
}
/** DM-09: `lot` with its values cache rebuilt from the live entries of `db`, the log after an
 *  edit, a delete or an undo. A purchase PO's lot is the PO itself. A batch holds the latest
 *  values recorded on it: its live cached entries laid over each other in log order, so an
 *  edit of an older round never overwrites what a later entry put there. The return leg's fee
 *  follows the trip: free on a round trip, else the fee the return was saved with (the one in
 *  the settings when it was saved free). With nothing live left the lot is `deleted` (liveLots). */
function recached(db: Database, lot: Lot): Lot {
  if (!lot.kind) {
    const po = entries(db, "purchase", lot.id).at(-1);
    return {
      ...lot,
      values: po ? omit(po.values, uncached) : { deleted: "1" },
    };
  }
  const live = batchEntries(db, lot.id);
  if (!live.length) return { ...lot, values: { deleted: "1" } };
  const values: Values = {};
  for (const entry of live)
    if (cachedKinds.includes(entry.kind))
      Object.assign(values, omit(entry.values, [...uncached, "returnCost"]));
  const back = live.findLast((entry) => entry.kind === "return");
  if (back)
    values.returnCost =
      values.trip === "ไปกลับ"
        ? "0"
        : n(back.values, "returnCost")
          ? back.values.returnCost
          : (db.config.returnFee ?? lot.config.returnFee);
  return { ...lot, values };
}
/** What an edit entry stores about its target: the before and after values, where it moved
 *  (`fromDate` → `toDate`, `fromLotId` → `toLotId`) and whose it is. */
function editValues(
  db: Database,
  role: ActingRole,
  target: Entry,
  proposed: Values,
  date: string,
  lotId: string,
) {
  const { values, moved } = correctedEntry(
    db,
    role,
    target,
    proposed,
    date,
    lotId,
  );
  /* Only what the edit changes is laid over the entry, so a link or a Chef House correction
   * under it still shows through, and undoing that still takes effect. A sale carries all of
   * it: restore_sale_money works the menu total out from the edit's own counts. */
  const changed =
    target.kind === "sale"
      ? values
      : Object.fromEntries(
          Object.entries(values).filter(
            ([key, value]) => value !== (target.values[key] ?? ""),
          ),
        );
  return {
    targetKind: target.kind,
    targetDate: target.date,
    targetRole: target.role,
    targetBranch: target.branch,
    ...pack("from.", target.values),
    ...pack("to.", changed),
    ...moved,
  };
}
/** `targetId`'s entry with its current (edited) values, if `role` may edit it. */
function editTarget(
  db: Database,
  targetId: string,
  role: ActingRole,
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
  receive: "branch",
  thaw: "branch",
  supplyPurchase: "branch",
  supplyIssue: "branch",
  ricePurchase: "branch",
  chiliPurchase: "branch",
  chiliReceive: "branch",
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
  materialConfirm: "branch",
  closeDay: "branch",
  expense: "owner",
  config: "owner",
  unlock: "owner",
  void: "owner",
};
/** The role an entry of `kind` is stamped with when `role` records it: whose document it is.
 *  The Owner may record Foodiva's and Chef House's kinds for them ("แทน"); those keep the
 *  partner's role, and record() puts the typist in `actor`. Anything else stays `role`. */
export function recordRole(kind: EntryKind, role: ActingRole): Role {
  const owner = ownership[kind];
  return role === "owner" && (owner === "foodiva" || owner === "cm")
    ? owner
    : role;
}
function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message);
}
/** Where `warn` puts its messages while `check` runs; outside a check they are dropped. */
let collected: string[] | null = null;
/** A number that is off from what the system expects: real stock drifts, so this is said, not refused. */
function warn(ok: unknown, message: string) {
  if (!ok) collected?.push(message);
}
/** Runs `fn` (a dry run of a save) and returns what it would warn about and the error it
 *  would refuse with, if any. A form shows the warnings but still lets the user save. */
export function check<T>(fn: () => T): { warnings: string[]; error: string } {
  const previous = collected;
  const mine: string[] = [];
  collected = mine;
  let error = "";
  try {
    fn();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  } finally {
    collected = previous;
  }
  return { warnings: [...new Set(mine)], error };
}
/** Warns when `amount` is over `max` and says what the system expected, so the user can
 *  check the count before saving. The save still goes through. */
function withinStock(
  amount: number,
  max: number,
  message: string,
  unit = "กก.",
  prefix = "กรอกได้สูงสุด",
) {
  if (amount <= max + 0.001) return;
  const most = Math.max(0, max);
  warn(
    false,
    `${message} · ${prefix} ${unit === "กก." ? fmt(most) : String(Math.floor(most + 0.001))}${unit ? ` ${unit}` : ""}`,
  );
}
/** Thai runs together without spaces, but a label starting or ending in Latin/digits needs a
 *  space on that side ("กรอก Sliced Weight Lost เป็นตัวเลข…"). */
function spaced(label: string) {
  const latin = /[A-Za-z0-9)]/;
  return `${latin.test(label[0] ?? "") ? " " : ""}${label}${latin.test(label.at(-1) ?? "") ? " " : ""}`;
}
/** Left empty it is saved and marked missing; zero where more is expected is said. Only a
 *  typed value that is not a number, or is negative, is refused. */
function positive(v: Values, k: string, label: string, allowZero = false) {
  if (!v[k]?.trim()) return required(v, k);
  const value = decimal(v[k]);
  assert(
    Number.isFinite(value) && value >= 0,
    `กรอก${spaced(label)}เป็นตัวเลข${allowZero ? "ตั้งแต่ศูนย์" : "มากกว่าศูนย์"}`,
  );
  warn(allowZero || value > 0, `${label}เป็นศูนย์`);
}
/** GEN-02: an empty field is saved as "" and listed in `missing`, never refused. */
function markMissing(v: Values, ...keys: string[]) {
  if (keys.length)
    v.missing = [...new Set([...missingKeys(v), ...keys])].join(",");
}
function required(v: Values, k: string, label?: string) {
  void label; // call sites keep naming the field
  if (v[k]?.trim()) return;
  v[k] = "";
  markMissing(v, k);
}
function variance(actual: number, expected: number, v: Values, always = true) {
  if (
    Math.abs(actual - expected) > 0.001 &&
    (always || expected === 0 || Math.abs(actual - expected) / expected > 0.2)
  )
    // Real counts drift, so a missing reason is flagged, never refused.
    warn(v.reason?.trim(), "ยอดไม่ตรง · ควรระบุเหตุผลส่วนต่าง");
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
/** SMK-02/03: a smoke PO's optional purchase-PO `lines`, written back normalised with their
 *  total as `requestedKg`. A PO that does not exist or is listed twice is refused; one without
 *  Foodiva's invoice, or drawn past what it has left, is a warning. */
function smokeOrderLines(db: Database, v: Values) {
  let lines: Values[] = [];
  try {
    lines = JSON.parse(v.lines || "[]");
  } catch {}
  assert(Array.isArray(lines), "รายการ PO ซื้อไม่ถูกต้อง");
  const seen = new Set<string>();
  for (const line of lines) {
    const po = purchaseLots(db).find((l) => l.id === line?.lotId);
    assert(po, "ไม่พบ PO ซื้อที่เลือก");
    assert(!seen.has(po.id), "เลือก PO ซื้อซ้ำในใบเดียวกัน");
    seen.add(po.id);
    // GEN-02: a PO picked with its kg left empty is kept and listed in `missing`.
    const typed = String(line.kg ?? "").trim();
    if (!typed) markMissing(v, "lines");
    const kg = typed ? decimal(typed) : 0;
    assert(
      Number.isFinite(kg) && kg >= 0,
      `กรอกน้ำหนักที่จะส่งของ ${po.poId} เป็นตัวเลขมากกว่าศูนย์`,
    );
    warn(!typed || kg > 0, `น้ำหนักที่จะส่งของ ${po.poId} เป็นศูนย์`);
    warn(
      entries(db, "foodivaConfirm", po.id).length,
      `${po.poId} ยังไม่มี Invoice เนื้อจาก Foodiva`,
    );
    const remaining = poRemainingKg(db, po.id);
    warn(
      kg <= remaining + 0.001,
      `น้ำหนักที่ขอส่งเกินยอดคงเหลือของ ${po.poId} (เหลือ ${remaining.toFixed(2)} กก.)`,
    );
  }
  v.lines = JSON.stringify(
    lines.map((line) => ({
      lotId: line.lotId,
      kg: String(line.kg ?? "").trim() ? String(decimal(String(line.kg))) : "",
    })),
  );
  v.requestedKg = String(
    lines.reduce(
      (total, line) =>
        total + (String(line.kg ?? "").trim() ? decimal(String(line.kg)) : 0),
      0,
    ),
  );
}
/** The config snapshot a new PO or shipment keeps. Without a legacy inline logo: documents
 * fall back to the current config for it, and the data URL was a copy per lot. */
function lotConfig(db: Database): Values {
  return Object.fromEntries(
    Object.entries(db.config).filter(([key]) => key !== "logoData"),
  );
}
/** GEN-09: a new shipment batch, `S<yymmdd>-NNN-xxxx` with the next `SH-YYYY-NNNN` number.
 *  NNN and the SH number count the batches this client has; only the Owner and the Account
 *  Manager open batches (a branch cannot add lots, migration 0034) and both load every batch,
 *  but two devices saving at once may still repeat a number. The 4 random hex chars keep the id itself
 *  unique, so one device's new batch never lands on another's under the same id. The SH number
 *  is display only. */
function newBatch(db: Database, next: Database, date: string): Lot {
  const count = next.lots.filter((l) => l.kind === "shipment").length + 1;
  const lot: Lot = {
    id: `S${date.slice(2).replaceAll("-", "")}-${String(count).padStart(3, "0")}-${newId().slice(0, 4)}`,
    poId: `SH-${date.slice(0, 4)}-${String(count).padStart(4, "0")}`,
    kind: "shipment",
    values: {},
    config: lotConfig(db),
  };
  next.lots.push(lot);
  return lot;
}
/** The next running number of a kind's document. Deleted ones count too (EDT-23): a number
 *  is never given to a second document. */
const nextNumber = (db: Database, kind: EntryKind) =>
  String(db.entries.filter((e) => e.kind === kind).length + 1).padStart(4, "0");
/** The value that names another entry by id, per kind (EDT-23). */
const referenceKey: Partial<Record<EntryKind, string>> = {
  smokeOrderAccept: "orderId",
  invoiceReview: "invoiceId",
  invoicePayment: "invoiceId",
  receive: "allocation",
};
/** The ids of the entries `e` names: its document, or what a Chef House correction corrects. */
const named = (e: Entry): string[] =>
  (e.kind === "chefEdit"
    ? [
        e.values.receiveId,
        e.values.prepareId,
        ...(JSON.parse(e.values.batches || "[]") as Values[]).map((b) => b.id),
      ]
    : [e.values[referenceKey[e.kind] ?? ""]]
  ).filter(Boolean);
/** Live entries that name `target`: deleting or moving it would leave them pointing at
 *  nothing, so they go first. */
const referring = (db: Database, target: Entry) =>
  ([...Object.keys(referenceKey), "chefEdit"] as EntryKind[])
    .flatMap((kind) => entries(db, kind))
    .filter((e) => named(e).includes(target.id));
/** DM-09: the batch kinds whose values are cached on the lot (`lot.values`), the ones the
 *  derived figures read (lines, trip, receivedKg, preSmokeKg, packs, centralKg…). The rest
 *  reuse those keys for other things (foodivaReturnReceive.receivedKg, every `status`), and
 *  allocate is about a branch, chefEdit writes its own corrections. */
const cachedKinds: EntryKind[] = [
  "smokeOrder",
  "dispatch",
  "packingList",
  "cmReceive",
  "prepare",
  "smoke",
  "closeLot",
  "return",
  "central",
];
/** GEN-06: batch kinds recorded once per batch, with what a second save is warned with (the newest counts). */
const oncePerBatch: Partial<Record<EntryKind, string>> = {
  dispatch: "ทำใบขนส่งขาไปของชุดนี้แล้ว",
  cmReceive: "ยืนยันรับเนื้อของชุดนี้แล้ว",
  prepare: "บันทึกน้ำหนักก่อนสโมคของชุดนี้แล้ว",
  closeLot: "ปิด Lot นี้แล้ว",
  return: "เรียกรถขากลับของชุดนี้แล้ว",
  central: "รับเข้าสต๊อกกลางของชุดนี้แล้ว · แก้น้ำหนักที่ประวัติ",
};
/** Batch values never cached on the lot: bulky, or an entry's own bookkeeping. */
const uncached = ["attachmentData", "slips", "batches", "missing"];
export function mutate(
  db: Database,
  role: ActingRole,
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
  role: ActingRole,
  kind: EntryKind,
  input: Values,
  lotId: string,
  date: string,
  actorBranch = "",
  correcting = false,
): Database {
  const forbidden = "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้";
  assert(
    // An edit, a delete and a link are checked against their target below (canChange).
    ["entryEdit", "void", "link"].includes(kind) ||
      retiredKinds.includes(kind) ||
      ownership[kind] === recordRole(kind, role),
    forbidden,
  );
  // An edit of an old entry re-checks it; a new one of a kind with no screen is refused.
  assert(
    correcting || !retiredKinds.includes(kind),
    "รายการชนิดนี้เลิกใช้แล้ว",
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
  // Lots whose cache is rebuilt once the entry is in (an edit, a delete, an undo).
  const touched = new Set<string>();
  // Recomputed on every save, so an edit that fills a field clears it (the overlay merges).
  delete v.missing;
  let lot = next.lots.find((l) => l.id === lotId);
  const branch = role === "branch" ? actorBranch : v.branch || db.config.branch;
  for (const key of ["arrival", "time", "pickupTime", "dispatchTime"]) {
    if (v[key])
      assert(
        /^([01]\d|2[0-3]):[0-5]\d$/.test(v[key]),
        "กรอกเวลาเป็น HH:mm เช่น 08:00",
      );
  }
  if (role === "branch") {
    assert(branches.includes(branch), "ไม่พบสาขาของบัญชีนี้");
    /* An edit, a delete and a link are dated today whatever day their target is on (STK-37),
     * so a closed today is not what they change. */
    if (!correcting && !["entryEdit", "void", "link"].includes(kind))
      warn(!isClosed(db, branch, date), "วันนี้ปิดยอดแล้ว");
  }
  // GEN-10: purchase-PO kinds on Lot F only; batch kinds on Lot S only, and with no lot they
  // open a new batch (GEN-09, D2: whether stamped owner, foodiva or cm).
  const poStep = [
    "foodivaConfirm",
    "ownerWasteReceive",
    "meatPayment",
  ].includes(kind);
  if (poStep) assert(lot && !lot.kind, "รายการนี้ต้องทำกับ PO ซื้อ");
  if (batchKinds.includes(kind)) {
    if (!lotId) lot = newBatch(db, next, date);
    assert(lot?.kind === "shipment", "รายการนี้ต้องทำกับการส่ง ไม่ใช่ PO ซื้อ");
    lotId = lot.id;
  }
  if (branchMeatKinds.includes(kind) && lotId)
    assert(lot?.kind === "shipment", "รายการนี้ต้องทำกับการส่ง ไม่ใช่ PO ซื้อ");
  /* EDT-23: a deleted PO or batch takes no new step, and no branch receives from it (it
   * still thaws and sells what it holds of one). Putting a batch step back, or the PO itself,
   * re-checks it here as a correction and revives the lot; an invoice or a payment waits for
   * its PO. A kind with no lot of its own is not held up by one. */
  if (
    lot?.values.deleted &&
    (lotKinds.includes(kind) || poStep || kind === "receive")
  )
    assert(
      correcting &&
        (kind === "receive" ||
          (lot.kind ? batchKinds.includes(kind) : kind === "purchase")),
      lot.kind
        ? "ชุดนี้ถูกลบแล้ว · กู้คืนรายการของชุดก่อน"
        : "PO นี้ถูกลบแล้ว · กู้คืน PO ก่อน",
    );
  // GEN-04: a batch entry dated before the batch's latest one, GEN-05: a purchase-PO entry
  // dated before the PO was opened (its earliest). Said, not refused.
  // An edit keeps the entry's own date, so it is not told off for it again.
  if (
    !correcting &&
    lot &&
    !branchMeatKinds.includes(kind) &&
    kind !== "allocate"
  ) {
    const lotRef = lot.id;
    const dates = db.entries
      .filter((e) => e.lotId === lotRef)
      .map((e) => e.date)
      .sort();
    const bound = lot.kind ? dates.at(-1) : dates[0];
    warn(
      !bound || date >= bound,
      lot.kind
        ? `วันที่ก่อนรายการอื่นของชุดนี้ (${bound})`
        : `วันที่ก่อนวันเปิด PO ของ Lot นี้ (${bound})`,
    );
  }
  // GEN-06: once per batch; a wrong value is corrected with an edit (or chefEdit), not a second save.
  const once = oncePerBatch[kind];
  if (once && lot) warn(!entries(db, kind, lot.id).length, once);
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
      values: omit(v, ["missing"]),
      config: lotConfig(db),
    };
    next.lots.push(lot);
  } else if (kind === "smokeOrder" && lot) {
    // One smoke PO per batch (GEN-06, a second is said; the newest counts). It may cite purchase
    // POs (`lines`, SMK-02) and needs no Packing List: the kg starts at the Packing List total (SMK-04).
    warn(
      !entries(db, "smokeOrder", lotId).length,
      "ออก PO รมควันของการส่งนี้แล้ว",
    );
    smokeOrderLines(db, v);
    required(v, "requestedSmokeDate", "วันที่ขอรม");
    required(v, "smoker", "โรงรม / ผู้ให้บริการ");
    const list = latestPackingList(db, lotId);
    if (!v.rawKg?.trim() && list) v.rawKg = list.values.slicedNetKg;
    positive(v, "rawKg", "น้ำหนัก PO รมควัน");
    if (v.rawKg) v.rawKg = String(Number(v.rawKg));
    v.serviceRate = String(smokeServiceRate(n(v, "rawKg")));
    // Kept on an edit (correctedValues re-runs this with the old values): the number does not move.
    v.orderNumber ||= `SO-${date.slice(0, 4)}-${nextNumber(db, "smokeOrder")}`;
    v.estimatedCost = String(n(v, "rawKg") * n(v, "serviceRate"));
    v.status = "Sent";
  } else if (kind === "smokeOrderAccept" && lot) {
    const order = entries(db, "smokeOrder", lotId).at(-1);
    assert(order, "ยังไม่มี PO รมควันจาก Owner");
    warn(
      !entries(db, "smokeOrderAccept", lotId).length,
      "รับ PO รมควันนี้แล้ว",
    );
    required(v, "acceptedBy", "ชื่อผู้รับ PO");
    v.orderId = order.id;
    v.orderNumber = order.values.orderNumber;
    v.status = "Accepted";
  } else if (kind === "smokingInvoice" && lot) {
    // SVC-01: billed whenever Chef House is ready. Without a smoke PO it types the kg itself.
    const smokeOrder = entries(db, "smokeOrder", lotId).at(-1);
    warn(smokeOrder, "ยังไม่มี PO รมควันของชุดนี้");
    required(v, "invoiceNumber", "เลข Invoice ค่ารม");
    required(v, "invoiceDate", "วันที่ Invoice");
    v.serviceProvider = smokeOrder?.values.smoker || "Chef House";
    if (smokeOrder) v.serviceQuantity = String(n(smokeOrder.values, "rawKg"));
    else positive(v, "serviceQuantity", "น้ำหนักที่คิดค่ารม");
    if (v.serviceQuantity) v.serviceQuantity = String(n(v, "serviceQuantity"));
    v.serviceRate = String(
      smokeOrder || !v.serviceRate?.trim()
        ? smokeServiceRate(n(v, "serviceQuantity"))
        : n(v, "serviceRate"),
    );
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
    // A review recorded before the payment can still be corrected after it.
    assert(
      correcting || smokingInvoiceStatus(db, invoice) !== "ชำระแล้ว",
      "Invoice นี้ชำระแล้ว",
    );
    assert(
      ["รับยอด", "ส่งกลับแก้ไข"].includes(v.decision),
      "เลือกผลการตรวจยอด",
    );
    required(v, "reviewedBy", "ชื่อผู้ตรวจ");
    if (!correcting || !v.reviewedAt) v.reviewedAt = new Date().toISOString();
  } else if (kind === "invoicePayment" && lot) {
    // SVC-03: paid with or without an invoice; the same invoice is never paid twice (GEN-06).
    const invoice =
      entries(db, "smokingInvoice", lotId).find(
        (entry) => entry.id === v.invoiceId,
      ) || entries(db, "smokingInvoice", lotId).at(-1);
    warn(invoice, "ยังไม่มี Invoice ค่ารมควันของชุดนี้");
    if (invoice) {
      v.invoiceId = invoice.id;
      const status = smokingInvoiceStatus(db, invoice);
      assert(status !== "ชำระแล้ว", "ชำระ Invoice ใบนี้แล้ว");
      warn(status === "รอชำระ", "ยังไม่ได้รับยอด Invoice นี้");
    } else {
      delete v.invoiceId;
      assert(
        !entries(db, "invoicePayment", lotId).length,
        "ชำระค่ารมควันของชุดนี้แล้ว",
      );
    }
    required(v, "paymentDate", "วันที่ชำระ");
    required(v, "paidBy", "ผู้ดำเนินการชำระ");
    positive(v, "paidAmount", "ยอดชำระ");
    if (invoice)
      warn(
        Math.abs(n(v, "paidAmount") - n(invoice.values, "netPayable")) < 0.01,
        "ยอดชำระต้องเท่ากับยอดสุทธิใน Invoice",
      );
    checkSlips(v);
  } else if (kind === "meatPayment" && lot) {
    // PO-03: paid before Foodiva invoices if need be; once per PO (GEN-06).
    const invoice = entries(db, "foodivaConfirm", lotId).at(-1);
    warn(invoice, "ยังไม่มี Invoice เนื้อจาก Foodiva");
    assert(
      !entries(db, "meatPayment", lotId).length,
      "ชำระ Invoice เนื้อใบนี้แล้ว",
    );
    required(v, "paymentDate", "วันที่ชำระ");
    required(v, "paidBy", "ผู้ดำเนินการชำระ");
    positive(v, "paidAmount", "ยอดชำระ");
    if (invoice && n(invoice.values, "invoiceAmount") > 0)
      warn(
        Math.abs(n(v, "paidAmount") - n(invoice.values, "invoiceAmount")) <
          0.01,
        "ยอดชำระต้องเท่ากับยอดรวม Invoice เนื้อ",
      );
    v.invoiceNo = invoice?.values.invoiceNo ?? v.invoiceNo ?? "";
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
    // No cap at the PO's kg: Foodiva does deliver over the order, and the Invoice is
    // what stock and cost run on from here (rawAtFoodiva reads confirmedKg).
    warn(
      Math.abs(
        n(v, "readyForChiangMaiKg") +
          n(v, "reservedForOwnerKg") -
          n(v, "confirmedKg"),
      ) < 0.001,
      "น้ำหนักพร้อมส่งเชียงใหม่และเนื้อส่วนที่เหลือรอ Owner รับต้องรวมเท่ากับน้ำหนักตาม Invoice",
    );
    // A later confirm replaces the earlier one (PO-02), so it should still cover what hangs on it.
    warn(
      !entries(db, "meatPayment", lotId).length,
      "Owner ชำระ Invoice เนื้อของ PO นี้แล้ว",
    );
    const drawn = drawnKg(db, lot.id);
    warn(
      n(v, "readyForChiangMaiKg") >= drawn - 0.001,
      `น้ำหนักพร้อมส่งเชียงใหม่ต่ำกว่าที่ PO รมควันดึงไปแล้ว · กรอกได้ต่ำสุด ${fmt(drawn)} กก.`,
    );
    const picked = ownerWasteReceived(db, lot.id);
    warn(
      n(v, "reservedForOwnerKg") >= picked - 0.001,
      `เนื้อส่วนที่เหลือรอ Owner รับต่ำกว่าที่ Owner รับไปแล้ว · กรอกได้ต่ำสุด ${fmt(picked)} กก.`,
    );
  } else if (kind === "packingList" && lot) {
    // SHP-02: any time, the latest list counts; after the smoke PO it is only said.
    warn(
      !entries(db, "smokeOrder", lotId).length,
      "Owner ออก PO รมควันของชุดนี้แล้ว",
    );
    required(v, "invoiceNo", "เลข Invoice");
    required(v, "product", "รายการสินค้า");
    // The file is the evidence Chef House looks at; only the totals are typed (no box rows).
    required(v, "attachment", "Packing List ที่แนบ");
    positive(v, "slicedNetKg", "Sliced Weight Net");
    if (v.boxCount?.trim()) {
      positive(v, "boxCount", "จำนวนกล่องรับเข้า");
      warn(
        Number.isInteger(n(v, "boxCount")),
        "จำนวนกล่องรับเข้าต้องเป็นจำนวนเต็ม",
      );
    }
    /* Sliced Weight Lost is what cutting took away — Inv. Weight less Sliced Weight Net,
     * never Chef House's yellow cells. Zero is a normal list: nothing was lost. The form
     * works it out; an edit of the total sent works it out again. */
    if (correcting && v.invWeightKg?.trim() && v.slicedNetKg?.trim())
      v.slicedLostKg = String(
        Math.round(Math.abs(n(v, "invWeightKg") - n(v, "slicedNetKg")) * 100) /
          100,
      );
    positive(v, "slicedLostKg", "Sliced Weight Lost", true);
    if (v.invWeightKg?.trim()) {
      positive(v, "invWeightKg", "Inv. Weight");
      withinStock(
        n(v, "slicedNetKg"),
        n(v, "invWeightKg"),
        "Sliced Weight Net เกิน Inv. Weight",
        "กก.",
        "รวมได้สูงสุด",
      );
    }
  } else if (kind === "ownerWasteReceive" && lot) {
    required(v, "receivedDate", "วันที่ Owner รับเนื้อ");
    if (v.receivedDate) checkDate(v.receivedDate, "วันที่ Owner รับเนื้อ");
    positive(v, "receivedKg", "น้ำหนักรับจริง");
    required(v, "receiver", "ผู้รับเนื้อ");
    // PO-04: picked up before Foodiva names the kg it keeps is said, not refused.
    if (reservedForOwnerContent(db, lotId) > 0)
      withinStock(
        n(v, "receivedKg"),
        ownerWasteOutstanding(db, lotId),
        "น้ำหนักรับเกินยอดเนื้อส่วนที่เหลือที่ Foodiva รอให้ Owner รับ",
      );
    else warn(false, "Foodiva ยังไม่ได้ระบุเนื้อส่วนที่เหลือรอ Owner รับ");
  } else if (kind === "foodivaReturnReceive" && lot) {
    // RET-02: once per batch (a second is said); with no return truck yet it is simply recorded.
    warn(
      !entries(db, "foodivaReturnReceive", lotId).length,
      "ยืนยันรับเข้าตู้ของชุดนี้แล้ว",
    );
    required(v, "receivedDate", "วันที่รับ");
    required(v, "receivedTime", "เวลารับ");
    positive(v, "receivedKg", "น้ำหนักรับ");
    positive(v, "receivedBags", "จำนวนกล่องรมควัน", true);
    warn(
      Number.isInteger(n(v, "receivedBags")),
      "จำนวนกล่องรมควันต้องเป็นจำนวนเต็ม",
    );
    // Foodiva weighs against what the return truck carried, not the full smoke output.
    const returned = entries(db, "return", lotId).at(-1);
    if (returned)
      variance(n(v, "receivedKg"), n(returned.values, "returnKg"), v, false);
  } else if (kind === "dispatch" && lot) {
    // SHP-01: the kg is what Foodiva types; it starts at the smoke PO's total when there is one.
    if (v.dispatchKg?.trim()) {
      positive(v, "dispatchKg", "น้ำหนักที่ส่ง");
      v.dispatchKg = String(Number(v.dispatchKg));
    } else v.dispatchKg = lot.values.requestedKg ?? "";
    required(v, "pickupDate", "วันรับ");
    required(v, "pickupTime", "เวลารถรับ");
    required(v, "origin", "ต้นทาง");
    required(v, "destination", "ปลายทาง");
    // Fees come from the settings in force when the manifest is made, not the lot's purchase-time
    // snapshot. An edit keeps the fee and the number it was saved with (correctedValues).
    if (!correcting || v.outboundCost === undefined)
      v.outboundCost =
        v.trip === "ไปกลับ"
          ? (db.config.roundFee ?? lot.config.roundFee)
          : (db.config.outboundFee ?? lot.config.outboundFee);
    warn(
      !v.origin?.trim() || v.origin !== v.destination,
      "ต้นทางและปลายทางต้องต่างกัน",
    );
    if (!correcting || !v.transferNumber)
      v.transferNumber = `TR-${date.slice(0, 4)}-${nextNumber(db, "dispatch")}`;
  } else if (kind === "cmReceive" && lot) {
    // CHF-01: the truck is at the door; Chef House weighs in with or without a Packing List or PO.
    required(v, "arrival", "เวลาถึง");
    positive(v, "receivedKg", "น้ำหนักรับรวม");
    // CHF-02: a total off the Packing List is said, not refused; stock and cost run on it.
    const list = latestPackingList(db, lotId);
    if (list && v.receivedKg && list.values.slicedNetKg?.trim())
      warn(
        Math.abs(n(v, "receivedKg") - n(list.values, "slicedNetKg")) < 0.005,
        "น้ำหนักรับรวมไม่ตรงกับ Packing List",
      );
  } else if (kind === "prepare" && lot) {
    // CHF-03: no PO or receive needed; a received kg on file caps it, as a warning.
    positive(v, "preSmokeKg", "น้ำหนักก่อนสโมค");
    if (entries(db, "cmReceive", lotId).length)
      withinStock(
        n(v, "preSmokeKg"),
        n(lot.values, "receivedKg"),
        "น้ำหนักก่อนสโมคเกินน้ำหนักรับ",
      );
  } else if (kind === "smoke" && lot) {
    positive(v, "inputKg", "น้ำหนักเข้าเตา");
    if (entries(db, "prepare", lotId).length)
      withinStock(
        n(v, "inputKg"),
        n(lot.values, "preSmokeKg") - processed(db, lotId),
        "น้ำหนักเข้าเตาเกินน้ำหนักรอผลิต",
      );
    // CHF-05: smoking after ปิด Lot is recorded and said.
    warn(!entries(db, "closeLot", lotId).length, "ปิด Lot แล้ว");
    positive(v, "wasteKg", "น้ำหนัก Waste", true);
    required(v, "smokeDate", "วันที่สโมค");
    const weights = packWeights(v.packs);
    if (!weights.length) required(v, "packs");
    // A typed negative or non-number is refused; a 0 kg box is said, not refused (PRIN-03).
    assert(
      weights.every((weight) => Number.isFinite(weight) && weight >= 0),
      "น้ำหนักกล่องรมควันต้องเป็นตัวเลขไม่ติดลบ",
    );
    warn(weights.every(isPackWeight), "มีกล่องรมควันน้ำหนักเป็นศูนย์");
    const output = weights.reduce((a, b) => a + b, 0);
    warn(
      Math.abs(output + n(v, "wasteKg") - n(v, "inputKg")) <= 0.001,
      "น้ำหนักกล่องรมควันรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา",
    );
    v.wasteKg = String(n(v, "wasteKg"));
    v.postSmokeKg = output.toFixed(2);
    v.packCount = String(weights.length);
    if (!correcting || !v.subLot)
      v.subLot = `SB-${date.slice(0, 4)}-${nextNumber(db, "smoke")}`;
  } else if (kind === "chefEdit" && lot) {
    // Corrects the receive/prepare/smoke values without touching those entries (see entries()).
    warn(!entries(db, "closeLot", lotId).length, "ปิด Lot แล้ว");
    const receiveEntry = entries(next, "cmReceive", lotId).at(-1);
    const prepareEntry = entries(next, "prepare", lotId).at(-1);
    let drafts: Values[] = [];
    try {
      drafts = JSON.parse(v.batches || "[]");
    } catch {}
    // Put back after a delete, it still corrects the rounds it named: not the ones smoked since.
    const smokeEntries = entries(next, "smoke", lotId).filter(
      (entry) =>
        !correcting ||
        (Array.isArray(drafts) &&
          drafts.some((draft) => draft?.id === entry.id)),
    );
    assert(
      receiveEntry &&
        prepareEntry &&
        Array.isArray(drafts) &&
        drafts.length === smokeEntries.length &&
        smokeEntries.every((entry, index) => drafts[index]?.id === entry.id),
      "ไม่พบข้อมูล Lot ล่าสุด",
    );
    // Chef House may correct its received total; left out, the saved one stands.
    const receivedKg = v.receivedKg?.trim()
      ? decimal(v.receivedKg)
      : n(lot.values, "receivedKg");
    assert(
      Number.isFinite(receivedKg) && receivedKg >= 0,
      "กรอกน้ำหนักรับรวมเป็นตัวเลขมากกว่าศูนย์",
    );
    warn(receivedKg > 0, "น้ำหนักรับรวมเป็นศูนย์");
    // GEN-02: an empty weight or date is saved and listed in `missing`; a typed bad number is refused.
    positive(v, "preSmokeKg", "น้ำหนักก่อนสโมค");
    const preSmokeKg = n(v, "preSmokeKg");
    withinStock(preSmokeKg, receivedKg, "น้ำหนักก่อนสโมคมากกว่าน้ำหนักรับจริง");
    const batches = drafts.map((draft) => {
      const round: Values = { ...draft };
      delete round.missing;
      required(round, "smokeDate", "วันที่สโมค");
      positive(round, "inputKg", "น้ำหนักเข้าเตา");
      positive(round, "wasteKg", "น้ำหนัก Waste", true);
      const weights = packWeights(round.packs);
      if (!weights.length) required(round, "packs");
      // A typed negative or non-number is refused; a 0 kg box is said, not refused (PRIN-03).
      assert(
        weights.every((weight) => Number.isFinite(weight) && weight >= 0),
        "น้ำหนักกล่องรมควันต้องเป็นตัวเลขไม่ติดลบ",
      );
      warn(weights.every(isPackWeight), "มีกล่องรมควันน้ำหนักเป็นศูนย์");
      markMissing(v, ...missingKeys(round));
      const inputKg = n(round, "inputKg");
      const wasteKg = n(round, "wasteKg");
      const postSmokeKg = weights.reduce((total, weight) => total + weight, 0);
      warn(
        Math.abs(postSmokeKg + wasteKg - inputKg) <= 0.001,
        "น้ำหนักกล่องรมควันรวมและ Waste ต้องเท่ากับน้ำหนักเข้าเตา",
      );
      return {
        smokeDate: round.smokeDate,
        inputKg: round.inputKg && String(inputKg),
        wasteKg: round.wasteKg && String(wasteKg),
        packs: weights.join("\n"),
        postSmokeKg: postSmokeKg.toFixed(2),
        packCount: String(weights.length),
      };
    });
    warn(
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
    if (v.preSmokeKg) v.preSmokeKg = String(preSmokeKg);
    // DM-09: the cache follows from the corrected entries (recached).
    touched.add(lot.id);
    v.batches = JSON.stringify(
      batches.map((batch, index) => ({ id: smokeEntries[index].id, ...batch })),
    );
  } else if (kind === "closeLot" && lot) {
    // CHF-03: closing with a gap, or with nothing smoked yet, is said, not refused.
    warn(
      Math.abs(n(lot.values, "preSmokeKg") - processed(db, lotId)) < 0.005,
      "น้ำหนักเข้าเตารวมไม่เท่ากับน้ำหนักก่อนสโมค",
    );
    warn(produced(db, lotId) > 0, "ยังไม่มีผลผลิต");
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
    warn(
      !v.origin?.trim() || v.origin !== v.destination,
      "ต้นทางและปลายทางต้องต่างกัน",
    );
    positive(v, "returnKg", "น้ำหนักส่งกลับ");
    if (!correcting || !v.transferNumber)
      v.transferNumber = `TR-${date.slice(0, 4)}-R${nextNumber(db, "return")}`;
    withinStock(
      n(v, "returnKg"),
      produced(db, lotId),
      "น้ำหนักส่งกลับเกินผลผลิต",
    );
    // An edit keeps what the batch charges for the leg now (recache prices it by the trip).
    v.returnCost =
      correcting && lot.values.returnCost !== undefined
        ? lot.values.returnCost
        : lot.values.trip === "ไปกลับ"
          ? "0"
          : (db.config.returnFee ?? lot.config.returnFee);
  } else if (kind === "central" && lot) {
    // RET-03: counted into central stock whenever it arrives; Foodiva's figure, if any, is compared.
    positive(v, "centralKg", "น้ำหนักรับกลาง");
    const received = entries(db, "foodivaReturnReceive", lotId).at(-1);
    if (received)
      variance(n(v, "centralKg"), n(received.values, "receivedKg"), v, false);
  } else if (kind === "allocate") {
    positive(v, "kg", "น้ำหนักจัดสรร");
    withinStock(n(v, "kg"), centralStock(db, lotId), "สต๊อกกลางไม่พอ");
    assert(branches.includes(v.branch), "เลือกสาขา");
  } else if (kind === "receive") {
    // BR-02: the branch records what it received, on any batch or none (`""`). Allocations
    // are retired; only an edit of an old receive still carries one.
    positive(v, "kg", "น้ำหนักรับ");
    if (correcting && v.allocation?.trim()) {
      const allocation = entries(db, "allocate", lotId).find(
        (e) => e.id === v.allocation,
      );
      assert(allocation, "ไม่พบใบจัดสรร");
      assert(allocation.branch === branch, "ใบจัดสรรไม่ใช่ของสาขาคุณ");
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
    } else {
      delete v.allocation;
      delete v.complete;
      if (lotId) {
        const pending = pendingReceiveKg(db, lotId, branch);
        // DM-08: the kg that fills this branch's allocations is already off centralStock;
        // only the straight remainder beyond them comes out of it.
        withinStock(
          n(v, "kg"),
          pending + Math.max(0, centralStock(db, lotId)),
          "สต๊อกกลางไม่พอ",
        );
      }
    }
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
    // The "ไม่ระบุ Lot" bucket has no smoke date to order by.
    if (lotId && oldest && oldest.id !== lotId)
      required(v, "reason", "เหตุผลข้าม FIFO");
  } else if (kind === "ricePurchase") {
    // Every purchase says which way this round goes (B2): self-cook buys raw rice,
    // bought-cooked buys cooked rice. The other side is zeroed.
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
  } else if (kind === "chiliReceive") {
    // STK-43: the branch writes down the chili it received, whatever the Owner's store says.
    positive(v, "chiliTubes", "จำนวนน้ำพริกที่รับ");
    warn(Number.isInteger(n(v, "chiliTubes")), "น้ำพริกต้องเป็นจำนวนหลอดเต็ม");
    required(v, "receiver", "ชื่อผู้รับจริง");
  } else if (kind === "chiliPurchase") {
    positive(v, "chiliTubes", "น้ำพริกซื้อเข้า");
    warn(Number.isInteger(n(v, "chiliTubes")), "น้ำพริกต้องเป็นจำนวนหลอดเต็ม");
    positive(v, "chiliCost", "ยอดซื้อน้ำพริก");
    required(v, "supplier", "ผู้จำหน่ายน้ำพริก");
    v.totalCost = v.chiliCost;
  } else if (kind === "riceIssue") {
    positive(v, "rawRiceIssuedKg", "ข้าวเหนียวดิบที่เบิก");
    withinStock(
      n(v, "rawRiceIssuedKg"),
      rawRiceStock(db, branch),
      "ข้าวเหนียวดิบในสต๊อกไม่พอ",
    );
    required(v, "receiver", "ผู้รับของ");
  } else if (kind === "chiliIssue") {
    positive(v, "chiliIssuedTubes", "น้ำพริกที่เบิก");
    warn(
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
  } else if (kind === "rice") {
    // Cooked rice may weigh more than the raw rice it came from (FB-10): no ratio check.
    positive(v, "rawUsedKg", "ข้าวเหนียวดิบที่นำมาหุง");
    positive(v, "riceKg", "ข้าวเหนียวสุกที่ได้");
    withinStock(
      n(v, "rawUsedKg"),
      issuedRawRiceStock(db, branch),
      "ข้าวเหนียวดิบที่เบิกไว้ไม่พอ กรุณาบันทึกเบิกก่อนหุง",
    );
  } else if (kind === "riceCarry") {
    // Cooked rice is never carried over: the day-end leftover is recorded as waste.
    positive(v, "leftoverKg", "ข้าวเหนียวสุกเหลือทิ้งปลายวัน", true);
  } else if (kind === "materials") {
    for (let i = 0; i < materials.length; i++) {
      positive(v, "material" + i, materials[i], true);
      warn(Number.isInteger(n(v, "material" + i)), "วัสดุต้องเป็นจำนวนเต็ม");
      if (v["opening" + i] !== undefined || v["used" + i] !== undefined) {
        const expectedOpening = branchMaterialStock(db, branch, i, date);
        positive(v, "opening" + i, `ยอดตั้งต้น ${materials[i]}`, true);
        positive(v, "used" + i, `จำนวนใช้ ${materials[i]}`, true);
        warn(
          Number.isInteger(n(v, "opening" + i)) &&
            Number.isInteger(n(v, "used" + i)),
          "ยอดวัสดุต้องเป็นจำนวนเต็ม",
        );
        warn(
          n(v, "opening" + i) === expectedOpening,
          `ยอดตั้งต้น ${materials[i]} มีการเปลี่ยนแปลง กรุณาโหลดหน้าใหม่`,
        );
        withinStock(
          n(v, "used" + i),
          expectedOpening,
          `จำนวนใช้ ${materials[i]} เกินยอดตั้งต้น`,
          "",
        );
        // Using more than the opening is only a warning; then nothing is expected left.
        const expectedRemaining = Math.max(
          0,
          expectedOpening - n(v, "used" + i),
        );
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
      // Deleted rounds count too: a round number is not used twice.
      v.revision = String(
        db.entries.filter(
          (e) => e.kind === kind && e.branch === branch && e.date === date,
        ).length + 1,
      );
      required(v, "correctionReason", "เหตุผลที่แก้ไขยอดวัสดุ");
    }
  } else if (kind === "materialReceive") {
    required(v, "purchaseDate", "วันที่ซื้อวัสดุ");
    if (v.purchaseDate) checkDate(v.purchaseDate, "วันที่ซื้อวัสดุ");
    required(v, "material", "วัสดุ");
    assert(!v.material || materials.includes(v.material), "เลือกวัสดุ");
    positive(v, "quantity", "จำนวนรับเข้าคลัง");
    warn(Number.isInteger(n(v, "quantity")), "จำนวนวัสดุต้องเป็นจำนวนเต็ม");
    positive(v, "unitPrice", "ราคาต่อหน่วย", true);
    required(v, "supplier", "ผู้จำหน่าย");
    v.totalCost = String(n(v, "quantity") * n(v, "unitPrice"));
  } else if (kind === "generalPurchase") {
    required(v, "purchaseDate", "วันที่ซื้อ");
    if (v.purchaseDate) checkDate(v.purchaseDate, "วันที่ซื้อ");
    required(v, "item", "รายการที่ซื้อ");
    required(v, "purchaseCategory", "หมวดบัญชี");
    required(v, "unit", "หน่วย");
    positive(v, "quantity", "จำนวนที่ซื้อ");
    positive(v, "unitPrice", "ราคาซื้อต่อหน่วย", true);
    required(v, "supplier", "ผู้จำหน่าย");
    v.totalCost = String(n(v, "quantity") * n(v, "unitPrice"));
  } else if (kind === "materialConfirm") {
    // MAT-01: the branch writes down the material it received, whatever the Owner's store says.
    required(v, "material", "วัสดุ");
    assert(!v.material || materials.includes(v.material), "เลือกวัสดุ");
    positive(v, "receivedQuantity", "จำนวนที่รับจริง");
    warn(
      Number.isInteger(n(v, "receivedQuantity")),
      "จำนวนรับจริงต้องเป็นจำนวนเต็ม",
    );
    required(v, "receiver", "ชื่อผู้รับจริง");
    /* MAT-05: a count of that day or a later one, saved without this receipt in its opening,
     * already holds the stock in its counted figure, so the shelf would read it twice. An edit
     * or a restore that leaves the opening as the count saw it is not told off. */
    const index = materials.indexOf(v.material);
    const counted = [
      ...new Map(
        entries(db, "materials", undefined, branch).map((e) => [e.date, e]),
      ).values(),
    ]
      .filter(
        (e) =>
          index >= 0 &&
          e.date >= date &&
          Math.abs(
            branchMaterialStock(db, branch, index, e.date) +
              n(v, "receivedQuantity") -
              n(e.values, "opening" + index),
          ) > 0.001,
      )
      .map((e) => e.date)
      .sort()[0];
    warn(
      !counted,
      `วันที่ ${counted} ตรวจนับวัสดุไปแล้ว · บันทึกยอดตรวจนับของวันนั้นอีกครั้งให้ยอดตรงกัน`,
    );
  } else if (kind === "sale") {
    for (const [k, label] of [
      ["boxes", "จำนวนกล่องมาตรฐาน"],
      ["chiliAddons", "จำนวนน้ำพริกหลอด"],
      ["soldKg", "น้ำหนักเนื้อที่ใช้ไป"],
      ["wasteKg", "น้ำหนักเนื้อที่เสียไป"],
      ["expense", "ค่าใช้จ่ายสาขา"],
      ["lineMan", "ยอดขาย LINE MAN"],
      ["riceWasteKg", "น้ำหนักข้าวที่เสียไป"],
    ])
      positive(v, k, label, true);
    for (const k of ["boxes", "chiliAddons"])
      warn(Number.isInteger(n(v, k)), "จำนวนขายต้องเป็นจำนวนเต็ม");
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
      cookedRiceStock(db, branch, date),
      "ข้าวเหนียวไม่พอ",
      "กก.",
      "มีข้าวเหนียวสุก",
    );
    withinStock(
      n(v, "chiliSold"),
      chiliStock(db, branch),
      "น้ำพริกในสต๊อกไม่พอ",
      "หลอด",
    );
    const hasChiliCount = v.chiliCount !== undefined && v.chiliCount !== "";
    const expectedChili = chiliStock(db, branch) - n(v, "chiliSold");
    v.chiliExpected = String(expectedChili);
    if (hasChiliCount) {
      positive(v, "chiliCount", "ยอดตรวจนับน้ำพริก", true);
      warn(
        Number.isInteger(n(v, "chiliCount")),
        "ยอดตรวจนับน้ำพริกต้องเป็นจำนวนหลอดเต็ม",
      );
      warn(
        n(v, "chiliCount") === expectedChili || v.chiliRemark?.trim(),
        "ยอดนับน้ำพริกไม่ตรง · ควรระบุหมายเหตุ",
      );
    }
    if (n(v, "wasteKg") > 0 || n(v, "riceWasteKg") > 0)
      required(v, "reason", "เหตุผล Waste");
    if (n(v, "expense") > 0) required(v, "payer", "ผู้จ่ายเงิน");
    v.revenue = v.lineMan;
    v.menuTotal = String(
      n(v, "boxes") * n(db.config, "boxPrice") +
        n(v, "chiliAddons") * n(db.config, "chiliPrice"),
    );
    // BR-05: meat and waste cost are read from `saleCost`, so a later `link` reprices them.
    delete v.meatCost;
    delete v.wasteCost;
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
      warn(Number.isInteger(n(v, k)), "จำนวนที่ส่งต้องเป็นจำนวนเต็ม");
    /* A giveaway sends whole standard boxes only, so the meat it costs follows the
     * box count (`packKg`, น้ำหนักเฉลี่ยต่อซีล) instead of being weighed and typed —
     * the same discipline as packingList's slicedNetKg. Whatever the form sent for
     * `soldKg` is overwritten, and every stock helper keeps reading `soldKg`. */
    v.soldKg = String(n(v, "boxes") * n(db.config, "packKg"));
    const sentPacks = n(v, "boxes");
    warn(
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
      cookedRiceStock(db, branch, date),
      "ข้าวเหนียวไม่พอ",
      "กก.",
      "มีข้าวเหนียวสุก",
    );
    withinStock(
      n(v, "chiliSold"),
      chiliStock(db, branch),
      "น้ำพริกในสต๊อกไม่พอ",
      "หลอด",
    );
    delete v.meatCost;
  } else if (kind === "closeDay") {
    // Any time of day (FB-14); an unfinished checklist is said and listed in `missing`.
    const open = closeDayChecklist(db, branch, date).filter(
      (item) => item.required && !item.done,
    );
    for (const item of open) warn(false, item.message);
    markMissing(v, ...open.map((item) => item.key));
    // Thawed meat left over is not an error: it carries into tomorrow as chill.
    required(v, "confirm", "ชื่อผู้ยืนยัน");
  } else if (kind === "expense") {
    positive(v, "amount", "ยอดเงิน");
    required(v, "category", "หมวดหมู่");
    required(v, "detail", "รายละเอียด");
  } else if (kind === "unlock") {
    // An edit of an older unlock: the day may have been closed and unlocked again since.
    assert(correcting || isClosed(db, branch, date), "วันนี้ยังไม่ได้ปิด");
    required(v, "reason", "เหตุผลปลดล็อก");
  } else if (kind === "void") {
    // EDT-23: a delete. Of an edit or a link it undoes that; of a delete it puts the entry back.
    const target = db.entries.find((entry) => entry.id === v.targetId);
    assert(target, "ไม่พบรายการ");
    const block = voidBlock(db, target, role, branch);
    assert(!block, block);
    /* A void takes the target out of every figure, like an edit does, so it gets the same
     * stock check. An allocation the branch already took in would otherwise go back to
     * central stock while the branch keeps it: void the branch's entry first. */
    if (target.kind === "allocate")
      assert(
        !entries(db, "receive").some((r) => r.values.allocation === target.id),
        "สาขารับเนื้อจากใบจัดสรรนี้แล้ว · ลบรายการรับเนื้อก่อน",
      );
    const held = referring(db, target)[0];
    assert(
      !held,
      `${held ? titles[held.kind] : ""} อ้างถึงรายการนี้อยู่ · ลบรายการนั้นก่อน`,
    );
    // A PO is its lot: what stands on it, or draws from it, would be left with no PO.
    assert(
      target.kind !== "purchase" || !poInUse(db, target.lotId),
      "PO นี้ยังมีรายการอื่นหรือ PO รมควันผูกอยู่ · ลบรายการเหล่านั้นก่อน",
    );
    const after: Database = {
      ...db,
      entries: [
        ...db.entries,
        {
          ...target,
          id: newId(),
          kind,
          role,
          branch,
          values: { targetId: target.id },
        },
      ],
    };
    // The entry this is about: the target itself, or the one its edit or delete names.
    const about =
      target.kind === "void" || target.kind === "entryEdit"
        ? db.entries.find((entry) => entry.id === target.values.targetId)
        : undefined;
    /* Putting an entry back, or back to what it was before an edit, saves it again: its
     * kind's rules run on the log as it is now, without the entry itself (an invoice paid
     * meanwhile, a PO deleted since). */
    const back =
      about && entries(after, about.kind).find((e) => e.id === about.id);
    assert(back || target.kind !== "void", "ไม่พบรายการ");
    // What it names must still be there: the rules above would settle for another document.
    const names = (back ? named(back) : []).map((id) =>
      db.entries.find((e) => e.id === id),
    );
    const gone = names.findIndex((e) => !e || isVoided(db, e.id));
    assert(
      gone < 0,
      `${names[gone] ? titles[names[gone].kind] : "รายการ"} ที่รายการนี้อ้างถึงถูกลบแล้ว · กู้คืนรายการนั้นก่อน`,
    );
    if (about && back)
      record(
        {
          ...after,
          entries: [
            ...after.entries,
            {
              ...about,
              id: newId(),
              kind,
              role: "owner",
              values: { targetId: about.id },
            },
          ],
        },
        back.role === "branch" ? "branch" : "owner",
        back.kind,
        back.values,
        back.lotId,
        back.date,
        back.branch,
        true,
      );
    const done =
      target.kind === "void"
        ? "กู้คืน"
        : target.kind === "entryEdit" || target.kind === "link"
          ? "ย้อนกลับ"
          : "ลบ";
    const before = stockLevels(db, role);
    for (const id of cachedOn(db, about ?? target)) touched.add(id);
    for (const [key, level] of stockLevels(
      {
        ...after,
        lots: after.lots.map((l) =>
          touched.has(l.id) ? recached(after, l) : l,
        ),
      },
      role,
    ))
      warn(
        level >= -0.001 || level >= (before.get(key) ?? 0) - 0.001,
        `${done}แล้ว${key.split("#")[0]}จะติดลบ (${fmt(level)}) · แก้รายการที่ตามมาก่อน`,
      );
    required(v, "reason", "เหตุผล");
    v.targetKind = target.kind;
    // The day it is filed under now, an edit's move included.
    v.targetDate = (
      entries(db, target.kind).find((e) => e.id === target.id) ?? target
    ).date;
    v.targetRole = target.role;
    v.targetBranch = target.branch;
  } else if (kind === "link") {
    // LNK-01..05: ties recorded branch meat to a batch; entries() overlays it.
    const target = db.entries.find((entry) => entry.id === v.targetId);
    assert(
      target && entries(db, target.kind).some((e) => e.id === target.id),
      "ไม่พบรายการ",
    );
    // LNK-03: only branch meat is tied to a batch after the fact.
    assert(branchMeatKinds.includes(target.kind), "รายการนี้ผูกย้อนหลังไม่ได้");
    assert(canLink({ role, branch }, target), forbidden);
    assert(v.lotId?.trim(), "เลือกชุดที่จะผูก");
    assert(
      liveLots(db).some((l) => l.id === v.lotId && l.kind === "shipment"),
      "ไม่พบชุดรมควันที่เลือก",
    );
    v.targetKind = target.kind;
    v.targetDate = target.date;
    v.targetRole = target.role;
    v.targetBranch = target.branch;
    lotId = v.lotId;
  } else if (kind === "entryEdit") {
    // Recorded, not applied: entries() overlays the `to.` values on the target (like chefEdit).
    const target = editTarget(db, v.targetId, role, branch);
    required(v, "reason", "เหตุผลที่แก้ไข");
    let proposed: Values = {};
    try {
      proposed = JSON.parse(v.values || "{}");
    } catch {}
    // EDT-24: `toDate` re-dates the entry, `toLotId` moves it to another lot.
    const { toDate, toLotId } = v;
    for (const key of ["values", "toDate", "toLotId"]) delete v[key];
    // A kind filed under one of its own fields moves by that field.
    const dated = dateField[target.kind];
    if (dated && toDate) proposed[dated] ??= toDate;
    Object.assign(
      v,
      editValues(
        db,
        role,
        target,
        proposed,
        toDate || target.date,
        toLotId || target.lotId,
      ),
    );
    lotId = v.toLotId || target.lotId;
    for (const id of cachedOn(db, target, v.toLotId)) touched.add(id);
  } else if (kind === "config") {
    // An unchanged legacy logo (a data URL, up to ~1.4 MB) would be copied into every
    // config entry of the append-only log. Left out, the merge below keeps it.
    if (v.logoData === db.config.logoData) delete v.logoData;
    // Labels match the Thai setting names in ConfigView.
    for (const [key, label] of Object.entries({
      boxPrice: "ราคากล่องมาตรฐาน",
      packKg: "น้ำหนักเฉลี่ยต่อซีล",
      chiliPrice: "ราคาขายน้ำพริกหลอด",
      rawRicePar: "จำนวนฐานข้าวเหนียวดิบ",
      rawRiceUnitPrice: "ราคาต่อหน่วยข้าวเหนียวดิบ",
      chiliUnitPrice: "ราคาต่อหน่วยน้ำพริก",
      cookedRicePar: "จำนวนฐานข้าวเหนียวสุก",
      cookedRiceUnitPrice: "ราคาต่อหน่วยข้าวเหนียวสุก",
      outboundFee: "ค่าขนส่งขาไป",
      returnFee: "ค่าขนส่งขากลับ",
      roundFee: "ค่าขนส่งไป-กลับ",
    }))
      positive(v, key, label, key !== "packKg");
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
    next.config = { ...db.config, ...omit(v, ["missing"]) };
  }
  // DM-09: a batch caches the latest values recorded on it (allocate is about a branch, chefEdit
  // writes its own corrections above).
  if (lot?.kind && cachedKinds.includes(kind))
    lot.values = { ...lot.values, ...omit(v, uncached) };
  const entryDate = v[dateField[kind] ?? ""] || date;
  // An edit overlays its target, so "nothing missing now" has to be said to clear the old list.
  if (correcting) v.missing ||= "";
  const stamped = recordRole(kind, role);
  next.entries.push({
    id: newId(),
    kind,
    role: stamped,
    // Recorded for a partner: the typist (persistence re-stamps the Account Manager's).
    ...(stamped !== role ? { actor: "owner" as const } : {}),
    lotId: lot?.id || lotId,
    branch,
    date: entryDate,
    at: new Date().toISOString(),
    values: v,
  });
  // DM-09: an edit, a delete or an undo rebuilds the caches it reaches from the live entries.
  if (touched.size)
    next.lots = next.lots.map((l) =>
      touched.has(l.id) ? recached(next, l) : l,
    );
  return next;
}

/** Foodiva's one outbound form (the Owner may type it for Foodiva): the transport document and its Packing List land in one save,
 *  all or nothing (SHP-03). With `lotId === ""` the document opens the batch the list joins.
 *  The Packing List is optional here: without one only the transport document is saved. */
export const dispatchWithPackingList = (
  db: Database,
  lotId: string,
  trip: Values,
  packing: Values | undefined,
  date: string,
  /** Who types it: the Owner / Manager recording it for Foodiva (stamped Foodiva's). */
  role: ActingRole,
) => {
  const sent = mutate(db, role, "dispatch", trip, lotId, date);
  if (!packing) return sent;
  return mutate(
    sent,
    role,
    "packingList",
    packing,
    lotId || sent.lots.at(-1)!.id,
    date,
  );
};
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
      let next = undefined as Database | undefined;
      const { warnings, error } = check(() => {
        next = mutate(
          current,
          "branch",
          "influencerBox",
          giveaway,
          lotId,
          date,
          branch,
        );
      });
      // Say which block it is about — several are saved at once, and the form
      // shows one message.
      const label = influencerLabel(index, giveaway);
      for (const message of warnings) warn(false, `${label} · ${message}`);
      if (!next) throw new Error(`${label} · ${error}`);
      return next;
    }, db),
    "branch",
    "sale",
    saleValues,
    lotId,
    date,
    branch,
  );
