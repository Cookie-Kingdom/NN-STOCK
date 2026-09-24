import { currentTimeSlot, forms, nextTimeSlot } from "./forms.ts";
import {
  allocationOutstanding,
  balance,
  branches,
  chiliStock,
  cookedRiceStock,
  entries,
  issuedRawRiceStock,
  n,
  ownerChiliStock,
  ownerWasteOutstanding,
  packingListKg,
  pendingSmokeKg,
  produced,
  producedBags,
  purchaseLots,
  rawRiceStock,
  readyForChefHouse,
  riceSources,
  cooksRice,
  smokeServiceRate,
  type Database,
  type Entry,
  type Lot,
  type Values,
  type EntryKind,
} from "./store.ts";

const truckKeys = ["vehicleType", "plate", "driverName", "driverPhone"];

/** Where a prefilled value came from, shown as a caption under its field.
 *  `expected`: a scale or count reading the system can only predict — the field is
 *  highlighted so the user weighs or counts and corrects it. */
export type PrefillSource = { label: string; expected?: boolean };
export type Prefill = {
  values: Values;
  sources: Record<string, PrefillSource>;
};

/** What the form knows besides the lot. */
export type PrefillContext = {
  /** The acting branch (branch kinds): actorBranch, never config.branch. */
  branch?: string;
  /** The workspace date. */
  date?: string;
  /** The form's current values. Absent on first open; passed on a refill so a value
   *  derived from another field (sale kg from the pack count) follows it. */
  values?: Values;
  now?: Date;
};

export type LastOptions = {
  lotId?: string;
  branch?: string;
  where?: (entry: Entry) => boolean;
};

/** The values and date of the most recent entry of `kind` that matches the filters. */
export function lastValues(
  db: Database,
  kind: EntryKind,
  { lotId, branch, where }: LastOptions = {},
): { values: Values; date: string } | undefined {
  const entry = entries(db, kind, lotId, branch)
    .filter((e) => !where || where(e))
    .at(-1);
  return entry && { values: entry.values, date: entry.date };
}

/** The most recent non-blank `key` typed on a `kind` entry, and that entry's date. */
export function lastValue(
  db: Database,
  kind: EntryKind,
  key: string,
  { where, ...opts }: LastOptions = {},
): { value: string; date: string } | undefined {
  const last = lastValues(db, kind, {
    ...opts,
    where: (e) => Boolean(e.values[key]?.trim()) && (!where || where(e)),
  });
  return last && { value: last.values[key], date: last.date };
}

/** "ล่าสุด 18/09" for an entry date `2026-09-18`. */
export function lastLabel(date: string) {
  const [, month, day] = date.split("-");
  return `ล่าสุด ${day}/${month}`;
}

/** Each of `keys` from the last `kind` entry that had it, captioned with that date. */
export function carryLast(
  db: Database,
  kind: EntryKind,
  keys: string[],
  opts?: LastOptions,
): Prefill {
  const out: Prefill = { values: {}, sources: {} };
  for (const key of keys) {
    const last = lastValue(db, kind, key, opts);
    if (!last) continue;
    out.values[key] = last.value;
    out.sources[key] = { label: lastLabel(last.date) };
  }
  return out;
}

/** The document number after `prev`: its last run of digits plus one, zero padding and
 *  everything around it kept ("INV-0012" → "INV-0013", "A9" → "A10"). */
export function nextDocNumber(prev?: string) {
  const match = prev?.match(/^(.*?)(\d+)(\D*)$/);
  if (!match) return undefined;
  const [, head, digits, tail] = match;
  return `${head}${String(Number(digits) + 1).padStart(digits.length, "0")}${tail}`;
}

/** The branch lot thawing should take first: the oldest with frozen stock (FIFO), the
 *  same order `mutate` checks a skipped lot against. */
export function oldestFrozenLot(db: Database, branch: string) {
  return db.lots
    .filter((l) => balance(db, l.id, branch).frozen > 0.001)
    .sort((a, b) =>
      (a.values.smokeDate || a.id).localeCompare(b.values.smokeDate || b.id),
    )[0];
}

/** `values` with the same caption on every non-blank one. */
function from(values: Values, source: PrefillSource): Prefill {
  const sources: Prefill["sources"] = {};
  for (const [key, value] of Object.entries(values))
    if (value !== "") sources[key] = source;
  return { values, sources };
}

function merge(...parts: Prefill[]): Prefill {
  return {
    values: Object.assign({}, ...parts.map((part) => part.values)),
    sources: Object.assign({}, ...parts.map((part) => part.sources)),
  };
}

const none = (): Prefill => ({ values: {}, sources: {} });
const preset = { label: "ค่าเริ่มต้น" };
/** A weight as the form shows it: 0.01 kg, no float noise. */
const kg = (value: number) => String(Math.round(value * 100) / 100);
/** A positive `value` as one prefilled field, or nothing. */
const positive = (key: string, value: number, source: PrefillSource) =>
  value > 0.001 ? from({ [key]: kg(value) }, source) : none();

function addDays(date: string, days: number) {
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}
const dayCount = (fromDate: string, toDate: string) =>
  Math.round(
    (Date.parse(`${toDate}T00:00:00Z`) - Date.parse(`${fromDate}T00:00:00Z`)) /
      86_400_000,
  );

/** Sale kg from the sealed-pack count: an estimate the branch weighs. */
function packKg(db: Database, current?: Values) {
  const packs = n(current || {}, "boxes") + n(current || {}, "addons");
  return packs > 0
    ? from(
        {
          soldKg: kg(packs * n(db.config, "packKg")),
        },
        { label: "ตามจำนวนซีล", expected: true },
      )
    : none();
}

/** Forms that need no lot. */
function lotless(db: Database, kind: string, ctx: PrefillContext): Prefill {
  const branch = ctx.branch;
  const current = ctx.values;
  if (kind === "purchase") {
    const lastPo = purchaseLots(db).at(-1);
    return merge(
      from(
        {
          customerName: db.config.companyName || "",
          customerAddress: db.config.companyAddress || "",
          attention: db.config.attention || "",
          phone: db.config.companyPhone || "",
          taxId: db.config.taxId || "",
        },
        { label: "จากตั้งค่าบริษัท" },
      ),
      from({ productName: "เนื้อวัว" }, preset),
      lastPo
        ? from(
            Object.fromEntries(
              ["packSize", "productName", "productCode", "orderedKg", "price"]
                .map((key) => [key, lastPo.values[key] || ""])
                .filter(([, value]) => value),
            ),
            { label: `จาก ${lastPo.poId || lastPo.id}` },
          )
        : none(),
    );
  }
  if (kind === "chiliAllocate") {
    const to = current?.branch || branches[0];
    const tubes = Math.min(
      Math.max(0, n(db.config, "chiliPar") - chiliStock(db, to)),
      Math.max(0, ownerChiliStock(db)),
    );
    return merge(
      tubes >= 1
        ? from(
            { chiliTubes: String(Math.floor(tubes)) },
            { label: "เติมให้ถึงจำนวนฐาน" },
          )
        : none(),
      carryLast(db, "chiliAllocate", ["receiver"], { branch: to }),
    );
  }
  if (kind === "expense") {
    const carried = carryLast(db, "expense", ["category", "payer"]);
    // What the select shows: the typed pick, else the carried one, else its first option.
    const category =
      current?.category ||
      carried.values.category ||
      forms.expense.find((f) => f.key === "category")?.options?.[0];
    return merge(
      carried,
      category
        ? carryLast(db, "expense", ["amount"], {
            where: (e) => e.values.category === category,
          })
        : none(),
    );
  }
  if (!branch) return none();
  if (kind === "ricePurchase") {
    const carried = carryLast(db, "ricePurchase", ["riceSource"], { branch });
    const source = !cooksRice(branch)
      ? riceSources[1]
      : current?.riceSource || carried.values.riceSource || riceSources[0];
    const selfCook = source === riceSources[0];
    const side = selfCook ? "rawRice" : "cookedRice";
    const stock = selfCook
      ? rawRiceStock(db, branch)
      : cookedRiceStock(db, branch);
    const shortfall = Math.max(0, n(db.config, `${side}Par`) - stock);
    const typed = current?.[`${side}Kg`]?.trim();
    const amount = typed ? Number(typed) : shortfall;
    return merge(
      carried,
      source
        ? carryLast(db, "ricePurchase", ["supplier"], {
            branch,
            where: (e) => e.values.riceSource === source,
          })
        : none(),
      source && riceSources.includes(source)
        ? merge(
            positive(`${side}Kg`, shortfall, { label: "เติมให้ถึงจำนวนฐาน" }),
            Number.isFinite(amount)
              ? positive(
                  `${side}Cost`,
                  amount * n(db.config, `${side}UnitPrice`),
                  { label: "ตามราคาต่อหน่วย" },
                )
              : none(),
          )
        : none(),
    );
  }
  if (kind === "riceIssue") {
    const lastKg = lastValue(db, "riceIssue", "rawRiceIssuedKg", { branch });
    const issue = Math.min(
      Number(lastKg?.value || 0),
      rawRiceStock(db, branch),
    );
    return merge(
      lastKg
        ? positive("rawRiceIssuedKg", issue, { label: lastLabel(lastKg.date) })
        : none(),
      carryLast(db, "riceIssue", ["receiver"], { branch }),
    );
  }
  if (kind === "rice") {
    const issued = issuedRawRiceStock(db, branch);
    const typed = current?.rawUsedKg?.trim();
    const raw = typed ? Number(typed) : issued;
    const lastCook = lastValues(db, "rice", {
      branch,
      where: (e) => n(e.values, "rawUsedKg") > 0 && n(e.values, "riceKg") > 0,
    });
    const ratio = lastCook
      ? n(lastCook.values, "riceKg") / n(lastCook.values, "rawUsedKg")
      : 0;
    return merge(
      positive("rawUsedKg", issued, {
        label: "ตามยอดที่เบิกไว้",
        expected: true,
      }),
      lastCook && Number.isFinite(raw)
        ? positive("riceKg", raw * ratio, {
            label: `ตามอัตราหุง${lastLabel(lastCook.date)}`,
            expected: true,
          })
        : none(),
    );
  }
  if (kind === "riceCarry")
    return from(
      { leftoverKg: kg(Math.max(0, cookedRiceStock(db, branch))) },
      { label: "ตามสต๊อกคงเหลือ", expected: true },
    );
  if (kind === "closeDay")
    return carryLast(db, "closeDay", ["confirm"], { branch });
  return none();
}

/**
 * Starting values for a form, taken from documents already on the lot and from the
 * last entry of the same kind, and the caption each one shows. The user can change
 * every one of them and `mutate` still validates the result.
 */
export function prefillValues(
  db: Database,
  kind: EntryKind,
  lot?: Lot,
  ctx: PrefillContext = {},
): Prefill {
  const branch = ctx.branch;
  const current = ctx.values;
  if (!lot) return lotless(db, kind, ctx);
  const po = { label: `จาก ${lot.values.poId || lot.id}` };
  if (kind === "foodivaConfirm") {
    // Editing: start from the saved invoice, so re-saving unchanged keeps the split
    // and the attachment already on file (QA round 7, BUG-J).
    const saved = entries(db, "foodivaConfirm", lot.id).at(-1);
    if (saved) return from({ ...saved.values }, { label: "จากใบที่บันทึกไว้" });
    const orderedKg = n(lot.values, "orderedKg");
    const lastInvoice = lastValue(db, "foodivaConfirm", "invoiceNo");
    const invoiceNo = nextDocNumber(lastInvoice?.value);
    return merge(
      from(
        {
          confirmedKg: String(orderedKg),
          readyForChiangMaiKg: String(orderedKg),
        },
        { ...po, expected: true },
      ),
      from(
        {
          reservedForOwnerKg: "0",
          invoiceAmount: String(orderedKg * n(lot.values, "price")),
        },
        po,
      ),
      invoiceNo
        ? from({ invoiceNo }, { label: `ต่อจาก ${lastInvoice!.value}` })
        : none(),
      carryLast(db, "foodivaConfirm", ["confirmedBy"]),
    );
  }
  // The kg starts at the Packing List total; the Owner may change it (A6).
  if (kind === "smokeOrder") {
    const listKg = packingListKg(db, lot.id);
    const previous = lastValues(db, "smokeOrder", {
      where: (e) =>
        Boolean(e.values.requestedSmokeDate && e.values.expectedFinishedDate),
    });
    const start = current?.requestedSmokeDate || ctx.date;
    const lead = previous
      ? dayCount(
          previous.values.requestedSmokeDate,
          previous.values.expectedFinishedDate,
        )
      : NaN;
    return merge(
      from({ smoker: "Chef House" }, preset),
      listKg === undefined
        ? none()
        : from({ rawKg: String(listKg) }, { label: "ตาม Packing List" }),
      start && Number.isFinite(lead) && lead >= 0
        ? from(
            { expectedFinishedDate: addDays(start, lead) },
            { label: `ตามรอบก่อน (${lead} วัน)` },
          )
        : none(),
      carryLast(db, "smokeOrder", ["instruction"]),
    );
  }
  if (kind === "smokeOrderAccept")
    return carryLast(db, "smokeOrderAccept", ["acceptedBy"]);
  if (kind === "prepare")
    return positive("preSmokeKg", n(lot.values, "receivedKg"), {
      label: "ตามยอดรับจริง",
      expected: true,
    });
  if (kind === "smoke")
    return positive("inputKg", pendingSmokeKg(db, lot), {
      label: "ตามยอดรอผลิต",
      expected: true,
    });
  if (kind === "closeLot") return carryLast(db, "closeLot", ["confirm"]);
  if (kind === "smokingInvoice") {
    // serviceQuantity is display only: mutate takes the billed kg from the smoke PO.
    // The amount starts at kg × rate (or the sent-back invoice's) and Chef House may change it (A7).
    const quantity = n(
      entries(db, "smokeOrder", lot.id).at(-1)?.values || {},
      "rawKg",
    );
    const sentBack = entries(db, "smokingInvoice", lot.id).at(-1)?.values;
    const lastNumber = lastValue(db, "smokingInvoice", "invoiceNumber");
    const invoiceNumber = nextDocNumber(lastNumber?.value);
    const back = { label: "จากใบที่ส่งกลับ" };
    return merge(
      from({ serviceQuantity: String(quantity) }, { label: "ตาม PO รมควัน" }),
      from(
        {
          netPayable:
            sentBack?.netPayable ||
            String(quantity * smokeServiceRate(quantity)),
        },
        sentBack?.netPayable ? back : { label: "ตามอัตราค่ารมควัน" },
      ),
      sentBack?.invoiceNumber
        ? from({ invoiceNumber: sentBack.invoiceNumber }, back)
        : invoiceNumber
          ? from({ invoiceNumber }, { label: `ต่อจาก ${lastNumber!.value}` })
          : none(),
      sentBack?.invoiceDetail
        ? from({ invoiceDetail: sentBack.invoiceDetail }, back)
        : none(),
    );
  }
  if (kind === "invoiceReview")
    return carryLast(db, "invoiceReview", ["reviewedBy"]);
  if (kind === "invoicePayment")
    return merge(
      from(
        {
          paidAmount:
            entries(db, "smokingInvoice", lot.id).at(-1)?.values.netPayable ||
            "",
        },
        { label: "ตามใบวางบิล" },
      ),
      carryLast(db, "invoicePayment", ["paidBy"]),
    );
  if (kind === "meatPayment") {
    const paidBy = carryLast(db, "meatPayment", ["paidBy"]);
    return merge(
      from(
        {
          paidAmount:
            entries(db, "foodivaConfirm", lot.id).at(-1)?.values
              .invoiceAmount || "",
        },
        { label: "ตาม Invoice" },
      ),
      paidBy.values.paidBy
        ? paidBy
        : carryLast(db, "invoicePayment", ["paidBy"]),
    );
  }
  if (kind === "ownerWasteReceive")
    return merge(
      positive("receivedKg", ownerWasteOutstanding(db, lot.id), {
        label: "ตามยอดค้างรับ",
        expected: true,
      }),
      carryLast(db, "ownerWasteReceive", ["receiver"]),
    );
  if (kind === "dispatch")
    return merge(
      from(
        { dispatchKg: String(readyForChefHouse(db, lot.id)) },
        { label: "ตามยอดพร้อมส่ง", expected: true },
      ),
      from({ origin: "กรุงเทพฯ", destination: "เชียงใหม่" }, preset),
    );
  if (kind === "return") {
    const outbound = entries(db, "dispatch", lot.id).at(-1)?.values;
    const roundTrip = lot.values.trip === "ไปกลับ" && outbound;
    return merge(
      roundTrip
        ? from(
            Object.fromEntries(
              truckKeys.map((key) => [key, outbound[key] || ""]),
            ),
            { label: "ตามเที่ยวขาไป" },
          )
        : carryLast(db, "return", truckKeys),
      from({ returnTime: nextTimeSlot(ctx.now) }, { label: "ช่วงเวลาถัดไป" }),
      from(
        { returnKg: String(produced(db, lot.id)) },
        { label: "ตามยอดสโมค", expected: true },
      ),
      from({ origin: "เชียงใหม่", destination: "กรุงเทพฯ" }, preset),
    );
  }
  if (kind === "foodivaReturnReceive") {
    const returned = entries(db, "return", lot.id).at(-1)?.values;
    return merge(
      from(
        { receivedBags: String(producedBags(db, lot.id)) },
        { label: "ตามยอดส่ง", expected: true },
      ),
      returned?.returnKg
        ? from(
            { receivedKg: returned.returnKg },
            { label: "ตามใบขนส่งขากลับ", expected: true },
          )
        : none(),
      from(
        { receivedTime: currentTimeSlot(ctx.now) },
        { label: "เวลาปัจจุบัน" },
      ),
    );
  }
  if (kind === "central") {
    const received = entries(db, "foodivaReturnReceive", lot.id).at(-1)?.values;
    return received?.receivedKg
      ? from(
          { centralKg: received.receivedKg },
          { label: "ตามยอดรับ Foodiva", expected: true },
        )
      : none();
  }
  if (!branch) return none();
  if (kind === "receive") {
    const open = entries(db, "allocate", lot.id, branch).filter(
      (e) => allocationOutstanding(db, e) > 0,
    );
    const picked =
      open.find((e) => e.id === current?.allocation) ||
      (!current?.allocation && open.length === 1 ? open[0] : undefined);
    return merge(
      picked && !current?.allocation
        ? from({ allocation: picked.id }, { label: "ใบจัดสรรเดียวที่ค้างรับ" })
        : none(),
      picked
        ? positive("kg", allocationOutstanding(db, picked), {
            label: "ตามยอดค้างรับ",
            expected: true,
          })
        : none(),
    );
  }
  if (kind === "thaw") {
    const frozen = balance(db, lot.id, branch).frozen;
    const previous = lastValues(db, "thaw", {
      branch,
      where: (e) => n(e.values, "kg") > 0,
    });
    if (!previous || frozen <= 0.001) return none();
    const lastKg = n(previous.values, "kg");
    const take = Math.min(lastKg, frozen);
    const source = {
      label:
        take < lastKg
          ? `${lastLabel(previous.date)} · เท่าที่มีแช่แข็ง`
          : lastLabel(previous.date),
      expected: true,
    };
    return positive("kg", take, source);
  }
  if (kind === "sale")
    return merge(
      packKg(db, current),
      carryLast(db, "sale", ["payer"], { branch }),
    );
  // No soldKg prefill here any more: mutate derives a giveaway's kg from the box count.
  if (kind === "influencerBox")
    return carryLast(db, "influencerBox", ["shippingFee"], { branch });
  return lotless(db, kind, ctx);
}

/** Fields whose change re-derives other prefilled fields, per kind: EntryForm refills
 *  the untouched ones when one of these changes. */
export const prefillDrivers: Record<string, string[]> = {
  chiliAllocate: ["branch"],
  expense: ["category"],
  ricePurchase: ["riceSource", "rawRiceKg", "cookedRiceKg"],
  rice: ["rawUsedKg"],
  sale: ["boxes", "addons"],
  smokeOrder: ["requestedSmokeDate"],
};
