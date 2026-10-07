// Samples for the Lots stories, built by the real `mutate`: the documents one (the header
// from Settings, a Packing List and a truck back on the first PO รมควัน), rounds, over
// capacity and a Foodiva invoice that overrides its PO.
import { sampleDb } from "@/components/organisms/workspace/storyWorkspace";
import { today } from "@/lib/format";
import {
  mutate,
  purchaseLots,
  roundsOf,
  shipments,
  type Database,
  type NoteKind,
  type Values,
} from "@/lib/store";

export const documentsDb: Database = (() => {
  const owner = { role: "owner" as const };
  const lotId = shipments(sampleDb)[0].id;
  let db = mutate(
    sampleDb,
    owner,
    "config",
    {
      companyAddress: "99 ถนนสีลม แขวงสีลม เขตบางรัก กรุงเทพฯ 10500",
      attention: "คุณนนท์",
      companyPhone: "02-000-0000",
      taxId: "0105500000000",
      foodivaContact: "คุณสมชาย",
      foodivaAddress: "88 ถนนพระราม 3 กรุงเทพฯ",
      chefHouseContact: "เชฟต้น",
      chefHouseAddress: "12 ถนนนิมมานเหมินท์ เชียงใหม่",
    },
    "",
    today(),
  );
  const add = (kind: NoteKind, values: Values) => {
    db = mutate(db, owner, kind, values, lotId, today());
  };
  add("packingList", {
    invoiceNo: "INV-F-0912",
    product: "เนื้อสไลซ์",
    code: "BF-SL-01",
    boxCount: "20",
    slicedNetKg: "200",
    invWeightKg: "200",
  });
  add("return", {
    returnKg: "104",
    returnTime: "09:00",
    origin: "เชียงใหม่",
    destination: "กรุงเทพฯ",
    vehicleType: "รถห้องเย็น 4 ล้อ",
    plate: "2กข 4471",
    driverName: "คุณวิทย์",
    driverPhone: "081-000-0000",
  });
  return db;
})();

const owner = { role: "owner" as const };
/** The sample's PO เนื้อ 2 (150 kg, 100 sent): what a new round draws its 50 kg from. */
const po2 = () => purchaseLots(sampleDb)[1].id;
/** `db` with a new round of `kg` on `lotId`, drawn from PO เนื้อ 2; and its id. */
function round(db: Database, lotId: string, kg: number) {
  db = mutate(
    db,
    owner,
    "dispatch",
    {
      dispatchKg: String(kg),
      poLines: JSON.stringify([{ poLotId: po2(), kg: String(kg) }]),
    },
    lotId,
    today(),
  );
  return { db, id: db.entries.at(-1)!.id };
}

/** PO รมควัน 2 (300 kg) with two rounds: the first received, smoked and sent back, the
 *  second only dispatched. */
export const twoRoundsDb: Database = (() => {
  const lotId = shipments(sampleDb)[1].id;
  const first = roundsOf(sampleDb, lotId)[0].dispatch.id;
  let db = mutate(
    sampleDb,
    owner,
    "smoked",
    { dispatchId: first, smokedKg: "52", boxes: "9" },
    lotId,
    today(),
  );
  db = mutate(
    db,
    owner,
    "return",
    { dispatchId: first, returnKg: "52", shippingFee: "6000" },
    lotId,
    today(),
  );
  return round(db, lotId, 50).db;
})();

/** PO รมควัน 1 (200 kg, all sent) with a second round of 50 kg: 50 kg past what it bought. */
export const overCapacityDb: Database = round(
  sampleDb,
  shipments(sampleDb)[0].id,
  50,
).db;

/** A third PO เนื้อ whose Foodiva invoice gives other meat kg and price than the PO. */
export const invoiceOverrideDb: Database = (() => {
  let db = mutate(
    sampleDb,
    owner,
    "purchase",
    { supplier: "Foodiva", orderedKg: "100", wasteKg: "10", price: "700" },
    "",
    today(),
  );
  const poId = db.lots.at(-1)!.id;
  db = mutate(
    db,
    owner,
    "meatInvoice",
    {
      invoiceNumber: "INV-F-1003",
      netPayable: "68400",
      orderedKg: "95",
      price: "720",
    },
    poId,
    today(),
  );
  return db;
})();

/** The sample with its first PO รมควัน and first PO เนื้อ carried over from the old workbook. */
export const oldLotsDb: Database = (() => {
  const old = [shipments(sampleDb)[0].id, purchaseLots(sampleDb)[0].id];
  return {
    ...sampleDb,
    lots: sampleDb.lots.map((lot) =>
      old.includes(lot.id) ? { ...lot, old: true as const } : lot,
    ),
  };
})();
