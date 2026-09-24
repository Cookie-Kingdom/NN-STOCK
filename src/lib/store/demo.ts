/** Deterministic demo data built through `mutate`. */
import {
  branches,
  materials,
  seed,
  type Database,
  type EntryKind,
  type Role,
  type Values,
} from "./model";
import { branchMaterialStock, cookedRiceStock, riceSources } from "./derived";
import { mutate } from "./mutate";
/** Creates deterministic daily data for exercising the complete demo loop. */
function roleplay(endDate: string, dayCount: number): Database {
  let db = structuredClone(seed);
  const end = new Date(`${endDate}T00:00:00Z`);
  const dates = Array.from({ length: dayCount }, (_, index) => {
    const value = new Date(end);
    value.setUTCDate(value.getUTCDate() - (dayCount - 1 - index));
    return value.toISOString().slice(0, 10);
  });
  const rawKg = dayCount >= 30 ? 100 : 50;
  const packCount = rawKg * 10;
  const smokingAmount = rawKg * 220;
  const materialPerBranch = dayCount >= 30 ? 400 : 100;
  const materialPurchased = materialPerBranch * 2;
  for (let index = 0; index < materials.length; index++) {
    db.config[`material${index}`] = "100";
    db.config[`materialPrice${index}`] = "1";
  }
  let currentDate = dates[0];
  let currentBranch = branches[0];
  const run = (role: Role, kind: EntryKind, values: Values, lotId = "") => {
    db = mutate(db, role, kind, values, lotId, currentDate, currentBranch);
  };
  const packs = Array.from({ length: packCount }, () => "0.100").join("\n");
  run("owner", "generalPurchase", {
    purchaseDate: dates[0],
    purchaseCategory: "วัตถุดิบ",
    item: "น้ำพริกหลอด",
    quantity: String(dayCount * branches.length * 20),
    unit: "หลอด",
    unitPrice: "20",
    supplier: "ผู้ผลิตน้ำพริก",
    reference: "CHILI-DEMO-001",
  });
  run("owner", "purchase", {
    supplier: "Foodiva",
    customerName: "บริษัท เนิร์ดเนื้อ จำกัด",
    customerAddress: "กรุงเทพฯ",
    attention: "ฝ่ายจัดซื้อ",
    phone: "0800000000",
    taxId: "0100000000000",
    packSize: "6 ชิ้นต่อกล่อง",
    productName: "เนื้อวัว",
    orderedKg: String(rawKg),
    price: "250",
  });
  const poLotId = db.lots[0].id;
  run(
    "foodiva",
    "foodivaConfirm",
    {
      invoiceNo: "INV-DEMO-001",
      invoiceDate: dates[0],
      confirmedKg: String(rawKg),
      readyForChiangMaiKg: String(rawKg),
      reservedForOwnerKg: "0",
      invoiceAmount: String(rawKg * 250),
      attachment: "INV-DEMO-001.pdf",
      confirmedBy: "Foodiva Demo",
    },
    poLotId,
  );
  run(
    "owner",
    "meatPayment",
    {
      paymentDate: dates[0],
      paidAmount: String(rawKg * 250),
      paidBy: "Owner",
      paymentReference: "DEMO-MEAT-001",
    },
    poLotId,
  );
  run("owner", "shipmentRequest", {
    lines: JSON.stringify([{ lotId: poLotId, kg: String(rawKg) }]),
  });
  const lotId = db.lots.at(-1)!.id;
  // Packing List: 20 kg กล่องรับเข้า, the last one takes the remainder; Chef House weighs in the same.
  const boxes = Array.from({ length: Math.ceil(rawKg / 20) }, (_, i) =>
    String(Math.min(20, rawKg - i * 20)),
  ).join("\n");
  run(
    "foodiva",
    "dispatch",
    {
      pickupDate: dates[0],
      origin: "Foodiva · กรุงเทพฯ",
      destination: "Chef House · เชียงใหม่",
      trip: "ไปกลับ",
      pickupTime: "06:30",
      vehicleType: "รถห้องเย็น",
      plate: "DEMO-01",
      driverName: "คนขับทดสอบ",
      driverPhone: "0800000000",
    },
    lotId,
  );
  run(
    "foodiva",
    "packingList",
    {
      invoiceNo: "INV-DEMO-001",
      product: "เนื้อวัว",
      invWeightKg: String(rawKg),
      slicedLostKg: String(rawKg),
      boxes,
    },
    lotId,
  );
  run(
    "owner",
    "smokeOrder",
    {
      smoker: "Chef House",
      requestedSmokeDate: dates[0],
      expectedFinishedDate: dates[2],
    },
    lotId,
  );
  run("cm", "smokeOrderAccept", { acceptedBy: "Chef House Demo" }, lotId);
  run("cm", "cmReceive", { receivedBoxes: boxes, arrival: "08:00" }, lotId);
  run("cm", "prepare", { preSmokeKg: String(rawKg) }, lotId);
  run(
    "cm",
    "smoke",
    {
      smokeDate: dates[0],
      inputKg: String(rawKg),
      wasteKg: "0",
      packs,
    },
    lotId,
  );
  run("cm", "closeLot", { confirm: "Chef House" }, lotId);
  run(
    "cm",
    "smokingInvoice",
    {
      invoiceNumber: "CH-INV-DEMO-001",
      invoiceDate: dates[0],
      serviceProvider: "Chef House",
      serviceQuantity: String(rawKg),
      vat: String(smokingAmount * 0.07),
      withholdingTax: String(smokingAmount * 0.03),
      netPayable: String(smokingAmount * 1.04),
      attachment: "CH-INV-DEMO-001.pdf",
    },
    lotId,
  );
  const chefInvoice = db.entries.at(-1)?.id || "";
  run(
    "owner",
    "invoiceReview",
    { invoiceId: chefInvoice, decision: "รับยอด", reviewedBy: "Owner" },
    lotId,
  );
  run(
    "owner",
    "invoicePayment",
    {
      invoiceId: chefInvoice,
      paymentDate: dates[0],
      paidAmount: String(smokingAmount * 1.04),
      paidBy: "Owner",
      paymentReference: "DEMO-PAY-001",
    },
    lotId,
  );
  run(
    "owner",
    "return",
    {
      returnDate: dates[3],
      returnTime: "09:00",
      origin: "Chef House · เชียงใหม่",
      destination: "Foodiva · กรุงเทพฯ",
      vehicleType: "รถห้องเย็น",
      plate: "DEMO-02",
      driverName: "คนขับทดสอบ",
      driverPhone: "0800000000",
      returnKg: String(rawKg),
    },
    lotId,
  );
  run(
    "foodiva",
    "foodivaReturnReceive",
    {
      receivedDate: dates[4],
      receivedTime: "10:00",
      receivedKg: String(rawKg),
      receivedBags: String(packCount),
    },
    lotId,
  );
  run("owner", "central", { centralKg: String(rawKg) }, lotId);
  run(
    "owner",
    "allocate",
    { branch: "ศาลาแดง", deliveryDate: dates[0], kg: String(rawKg / 2) },
    lotId,
  );
  const salaAllocation = db.entries.at(-1)?.id || "";
  run(
    "owner",
    "allocate",
    { branch: "มีนบุรี", deliveryDate: dates[0], kg: String(rawKg / 2) },
    lotId,
  );
  const minburiAllocation = db.entries.at(-1)?.id || "";
  for (const material of materials) {
    run("owner", "materialReceive", {
      material,
      purchaseDate: dates[0],
      quantity: String(materialPurchased),
      unitPrice: "1",
      supplier: "ผู้ขายวัสดุทดสอบ",
      reference: `MATERIAL-DEMO-${materials.indexOf(material) + 1}`,
    });
    for (const branch of branches) {
      currentBranch = branch;
      run("owner", "materialTransfer", {
        material,
        branch,
        quantity: String(materialPerBranch),
        receiver: "ผู้ดูแลทดสอบ",
      });
      const transferId = db.entries.at(-1)?.id || "";
      run("branch", "materialConfirm", {
        transferId,
        receivedQuantity: String(materialPerBranch),
        receiver: "ผู้ดูแลทดสอบ",
      });
    }
  }
  for (const [dayIndex, workDate] of dates.entries()) {
    currentDate = workDate;
    for (const branch of branches) {
      currentBranch = branch;
      const materialValues = Object.fromEntries(
        materials.flatMap((_, index) => {
          const opening = branchMaterialStock(db, branch, index, workDate);
          const used = Math.min(10, opening);
          return [
            [`opening${index}`, String(opening)],
            [`used${index}`, String(used)],
            [`material${index}`, String(opening - used)],
          ];
        }),
      );
      if (dayIndex === 0) {
        run(
          "branch",
          "receive",
          {
            kg: String(rawKg / 2),
            allocation:
              branch === "ศาลาแดง" ? salaAllocation : minburiAllocation,
          },
          lotId,
        );
      }
      if (branch === "ศาลาแดง") {
        run("branch", "ricePurchase", {
          riceSource: riceSources[0],
          supplier: "ร้านข้าวทดสอบ",
          rawRiceKg: "5",
          rawRiceCost: "275",
        });
      } else {
        run("branch", "ricePurchase", {
          riceSource: riceSources[1],
          supplier: "ร้านข้าวทดสอบ",
          cookedRiceKg: "32",
          cookedRiceCost: "1440",
        });
      }
      run("owner", "chiliAllocate", {
        branch,
        chiliTubes: "20",
        receiver: `ผู้ดูแล${branch}`,
        reference: `CHILI-${workDate}`,
      });
      run("branch", "thaw", { kg: "1.521" }, lotId);
      run("branch", "materials", materialValues);
      if (branch === "ศาลาแดง") {
        run("branch", "riceIssue", {
          rawRiceIssuedKg: "3",
          receiver: "ผู้ดูแลทดสอบ",
        });
        run("branch", "rice", { rawUsedKg: "3", riceKg: "3" });
      }
      run(
        "branch",
        "sale",
        {
          boxes: "14",
          addons: "0",
          chiliAddons: "0",
          soldKg: "1.421",
          wasteKg: "0.100",
          riceWasteKg: "0",
          expense: "0",
          lineMan: "4900",
          reason: "ทดสอบปิดยอด",
        },
        lotId,
      );
      run("branch", "riceCarry", {
        leftoverKg: cookedRiceStock(db, branch).toFixed(3),
        reheat: "เก็บไว้อุ่นวันถัดไป",
      });
      run("branch", "closeDay", { confirm: "ผู้ดูแลทดสอบ" });
    }
  }
  return db;
}

export function sevenDayRoleplay(endDate: string): Database {
  return roleplay(endDate, 7);
}

export function thirtyDayRoleplay(endDate: string): Database {
  return roleplay(endDate, 30);
}
