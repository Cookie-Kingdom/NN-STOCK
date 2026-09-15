import {
  entries,
  n,
  produced,
  producedBags,
  readyForChefHouse,
  type Database,
  type Lot,
  type Values,
} from "./store.ts";

const truckKeys = ["vehicleType", "plate", "driverName", "driverPhone"];

/**
 * Starting values for a lot form, taken from documents already on the lot.
 * The user can change every one of them and `mutate` still validates the result.
 * ponytail: scale weights at receiving (cmReceive, foodDivaReturnReceive, central, receive kg)
 * stay blank on purpose, so the variance against the sender is a real reading.
 */
export function prefillValues(db: Database, kind: string, lot?: Lot): Values {
  if (kind === "purchase")
    return {
      customerName: db.config.companyName || "",
      customerAddress: db.config.companyAddress || "",
      attention: db.config.attention || "",
      phone: db.config.companyPhone || "",
      taxId: db.config.taxId || "",
      productName: "เนื้อวัว",
    };
  if (!lot) return {};
  if (kind === "foodDivaConfirm") {
    const kg = n(lot.values, "orderedKg");
    return {
      confirmedKg: String(kg),
      readyForChiangMaiKg: String(kg),
      reservedForOwnerKg: "0",
      invoiceAmount: String(kg * n(lot.values, "price")),
    };
  }
  if (kind === "smokeOrder")
    return {
      smoker: "Chef_house",
      rawKg: String(readyForChefHouse(db, lot.id)),
    };
  if (kind === "invoicePayment")
    return {
      paidAmount:
        entries(db, "smokingInvoice", lot.id).at(-1)?.values.netPayable || "",
    };
  if (kind === "dispatch")
    return {
      dispatchKg: String(readyForChefHouse(db, lot.id)),
      origin: "Foodiva · กรุงเทพฯ",
      destination: "Chef_house · เชียงใหม่",
    };
  if (kind === "return") {
    const outbound = entries(db, "dispatch", lot.id).at(-1)?.values;
    const truck =
      lot.values.trip === "ไปกลับ" && outbound
        ? Object.fromEntries(truckKeys.map((key) => [key, outbound[key] || ""]))
        : {};
    return {
      ...truck,
      returnKg: String(produced(db, lot.id)),
      origin: "Chef_house · เชียงใหม่",
      destination: "Foodiva · กรุงเทพฯ",
    };
  }
  if (kind === "foodDivaReturnReceive")
    return { receivedBags: String(producedBags(db, lot.id)) };
  return {};
}
