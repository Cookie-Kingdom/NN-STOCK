// The sample with everything the four documents print: the header from Settings, and on the
// first Lot a Packing List and a truck back. Built by the real `mutate`.
import { sampleDb } from "@/components/organisms/workspace/storyWorkspace";
import { today } from "@/lib/format";
import {
  mutate,
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
