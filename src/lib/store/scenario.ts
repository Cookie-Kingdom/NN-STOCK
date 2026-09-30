/** Local UAT data: every case the Owner and the two branches meet in real work, left
 *  pending so a tester can click through each action (`PUT /api/local-db?state=uat`).
 *
 *  Built only through `mutate`, like demo.ts. Five days end at `endDate` (d0…d4, d4 =
 *  "today"). Each batch is parked at one step and says which in its smoke PO note and
 *  instruction; each purchase PO says it in `reference`/`note`.
 *  SH/PO numbers follow creation order, so they are the same whatever the date:
 *
 *  SH-0001 done end to end, feeds both branches' days · SH-0002 smoke PO, waits
 *  Foodiva's manifest · SH-0003 opened by Foodiva, Packing List ready, no smoke PO ·
 *  SH-0004 smoke PO and truck sent, Chef has not accepted · SH-0005 smoking half done at
 *  Chef · SH-0006 closed, no Chef invoice (and waits the return truck) · SH-0007 Chef
 *  invoice to review · SH-0008 invoice to pay · SH-0009 invoice sent back to Chef ·
 *  SH-0010 returned, Foodiva has not weighed it in · SH-0011 Foodiva received, waits
 *  รับเข้าสต๊อกกลาง · SH-0012 in stock, nothing allocated · SH-0013 partly allocated
 *  (มีนบุรี, part received) · SH-0014 all allocated to ศาลาแดง, not received.
 *
 *  PO-0001 feeds every batch (Owner waste pick-up partly done) · PO-0002 waits
 *  Foodiva's invoice · PO-0003 invoiced, unpaid, waste not picked up · PO-0004 paid, no
 *  smoke PO yet, waste picked up in full. */
import {
  branches,
  materials,
  seed,
  type Database,
  type EntryKind,
  type ActingRole,
  type Values,
} from "./model";
import {
  branchMaterialStock,
  cookedRiceStock,
  entries,
  riceSources,
} from "./derived";
import { mutate, saleWithInfluencers } from "./mutate";

const [SALA, MIN] = branches;
/** Material the scenario never buys (Owner store stays at zero) and the one มีนบุรี is
 *  short of (under 20% of its par, so it shows ใกล้หมด). */
const NEVER_BOUGHT = materials.length - 1;
const LOW_AT_MINBURI = materials.length - 2;

/** How far a shipment goes. Steps run in this order; `upTo` is the last one done. */
const steps = [
  "request",
  "dispatch",
  "accept",
  "cmReceive",
  "prepare",
  "smokeHalf",
  "smokeRest",
  "closeLot",
  "invoice",
  "review",
  "pay",
  "return",
  "foodivaReceive",
  "central",
] as const;
type Step = (typeof steps)[number];

export function ownerBranchScenario(endDate: string): Database {
  const end = new Date(`${endDate}T00:00:00Z`);
  const d = Array.from({ length: 5 }, (_, index) => {
    const value = new Date(end);
    value.setUTCDate(value.getUTCDate() - (4 - index));
    return value.toISOString().slice(0, 10);
  });
  let db = structuredClone(seed);
  const run = (
    role: ActingRole,
    kind: EntryKind,
    values: Values,
    lotId = "",
    date = d[0],
    branch = "",
  ) => {
    db = mutate(db, role, kind, values, lotId, date, branch);
    return db.entries.at(-1)!;
  };
  const owner = (kind: EntryKind, values: Values, lotId = "", date = d[0]) =>
    run("owner", kind, values, lotId, date);

  // ── Settings: every material has a par and a price, so no settings alert. ──
  owner("config", {
    ...db.config,
    companyAddress: "99 ถนนทดสอบ กรุงเทพฯ 10500",
    attention: "ฝ่ายจัดซื้อ",
    companyPhone: "020000000",
    taxId: "0105500000000",
    foodivaContact: "Foodiva ทดสอบ",
    foodivaAddress: "Foodiva · กรุงเทพฯ",
    chefHouseContact: "Chef House ทดสอบ",
    chefHouseAddress: "Chef House · เชียงใหม่",
    ...Object.fromEntries(
      materials.flatMap((_, i) => [
        [`material${i}`, "100"],
        [`materialPrice${i}`, "2"],
      ]),
    ),
  });

  // ── Owner store: packaging, chili and other purchases. ──
  materials.forEach((material, i) => {
    if (i === NEVER_BOUGHT) return;
    owner("materialReceive", {
      material,
      purchaseDate: d[0],
      // ถ้วยพริก: bought exactly what goes out, so the Owner store ends at zero.
      quantity: material === "ถ้วยพริก" ? "200" : "400",
      unitPrice: "2",
      supplier: "ร้านบรรจุภัณฑ์ UAT",
      reference: `UAT-MAT-${String(i + 1).padStart(2, "0")}`,
    });
  });
  const general = (
    date: string,
    item: string,
    purchaseCategory: string,
    quantity: string,
    unit: string,
    unitPrice: string,
    reference: string,
  ) =>
    owner("generalPurchase", {
      purchaseDate: date,
      purchaseCategory,
      item,
      quantity,
      unit,
      unitPrice,
      supplier: "ผู้ขาย UAT",
      reference,
    });
  general(d[0], "น้ำพริกหลอด", "วัตถุดิบ", "100", "หลอด", "20", "UAT-CHILI-1");
  general(d[1], "น้ำดอง", "วัตถุดิบ", "10", "ขวด", "45", "UAT-GEN-วัตถุดิบ");
  general(
    d[2],
    "ตู้แช่เนื้อ",
    "สินทรัพย์",
    "1",
    "ตู้",
    "18000",
    "UAT-GEN-สินทรัพย์",
  );
  general(
    d[3],
    "ค่าแก๊สหุงข้าว",
    "ค่าใช้จ่ายอื่น",
    "2",
    "ถัง",
    "420",
    "UAT-GEN-ค่าใช้จ่าย",
  );
  owner(
    "expense",
    {
      category: "ค่าเช่า",
      amount: "15000",
      payer: "Owner",
      detail: "UAT ค่าเช่าหน้าร้านเดือนนี้",
    },
    "",
    d[3],
  );

  // ── Purchase POs (Foodiva meat). ──
  const po = (
    date: string,
    orderedKg: string,
    reference: string,
    note: string,
  ) =>
    owner(
      "purchase",
      {
        supplier: "Foodiva",
        customerName: db.config.companyName,
        customerAddress: db.config.companyAddress,
        attention: "ฝ่ายจัดซื้อ",
        phone: "0800000000",
        taxId: "0105500000000",
        packSize: "6 ชิ้นต่อกล่อง",
        productName: "เนื้อวัว",
        orderedKg,
        price: "250",
        reference,
        note,
      },
      "",
      date,
    ).lotId;
  const invoice = (
    lotId: string,
    date: string,
    no: string,
    confirmedKg: number,
    reservedKg: number,
  ) =>
    run(
      "owner",
      "foodivaConfirm",
      {
        invoiceNo: no,
        invoiceDate: date,
        confirmedKg: String(confirmedKg),
        readyForChiangMaiKg: String(confirmedKg - reservedKg),
        reservedForOwnerKg: String(reservedKg),
        invoiceAmount: String(confirmedKg * 250),
        attachment: `${no}.pdf`,
        confirmedBy: "Foodiva UAT",
      },
      lotId,
      date,
    );
  const payMeat = (lotId: string, date: string, amount: number) =>
    owner(
      "meatPayment",
      {
        paymentDate: date,
        paidAmount: String(amount),
        paidBy: "Owner",
        paymentReference: `UAT-PAY-${lotId}`,
      },
      lotId,
      date,
    );
  const pickUpWaste = (lotId: string, date: string, kg: string) =>
    owner(
      "ownerWasteReceive",
      { receivedDate: date, receivedKg: kg, receiver: "Owner UAT" },
      lotId,
      date,
    );

  const feed = po(
    d[0],
    "1000",
    "UAT-PO-0001",
    "ป้อนทุกการส่ง · เนื้อส่วนที่เหลือ Owner รับไปบางส่วน",
  );
  invoice(feed, d[0], "INV-UAT-0001", 1000, 30);
  payMeat(feed, d[0], 250000);
  po(d[3], "150", "UAT-PO-0002", "รอ Foodiva ออก Invoice");
  const unpaid = po(
    d[2],
    "200",
    "UAT-PO-0003",
    "Invoice แล้ว รอ Owner ชำระ · เนื้อส่วนที่เหลือยังไม่รับ",
  );
  invoice(unpaid, d[2], "INV-UAT-0003", 200, 20);
  const paid = po(
    d[1],
    "120",
    "UAT-PO-0004",
    "ชำระแล้ว ยังไม่สร้าง Request ส่ง Chef House · รับเนื้อส่วนที่เหลือครบแล้ว",
  );
  invoice(paid, d[1], "INV-UAT-0004", 120, 15);
  payMeat(paid, d[1], 120 * 250);
  pickUpWaste(feed, d[2], "10");
  pickUpWaste(paid, d[3], "15");

  // ── Shipments from PO-0001, each parked at one step. ──
  const shipment = (
    note: string,
    upTo: Step,
    [from, mid, to]: [string, string, string],
    options: { kg?: number; reject?: boolean; noOrder?: boolean } = {},
  ) => {
    const kg = options.kg ?? 50;
    const done = (step: Step) => steps.indexOf(step) <= steps.indexOf(upTo);
    // The Owner's smoke PO opens the batch and names the purchase PO it draws on (SMK-01);
    // with `noOrder` Foodiva opens it with the transport document instead (D2).
    let lotId = options.noOrder
      ? ""
      : owner(
          "smokeOrder",
          {
            lines: JSON.stringify([{ lotId: feed, kg: String(kg) }]),
            rawKg: String(kg),
            smoker: "Chef House",
            requestedSmokeDate: from,
            expectedFinishedDate: to,
            instruction: note,
            note,
          },
          "",
          from,
        ).lotId;
    const boxes = Array.from({ length: Math.ceil(kg / 20) }, (_, i) =>
      String(Math.min(20, kg - i * 20)),
    ).join("\n");
    const waste = kg / 10;
    const packs = (outKg: number) =>
      Array.from({ length: Math.round(outKg * 10) }, () => "0.100").join("\n");
    const cm = (kind: EntryKind, values: Values, date: string) =>
      run("owner", kind, values, lotId, date);
    if (done("dispatch")) {
      run(
        "owner",
        "dispatch",
        {
          pickupDate: from,
          pickupTime: "06:30",
          origin: "Foodiva · กรุงเทพฯ",
          destination: "Chef House · เชียงใหม่",
          trip: "ไปกลับ",
          vehicleType: "รถห้องเย็น",
          plate: "UAT-01",
          driverName: "คนขับ UAT",
          driverPhone: "0800000000",
          dispatchKg: String(kg),
        },
        lotId,
        from,
      );
      lotId = db.lots.at(-1)!.id;
      run(
        "owner",
        "packingList",
        {
          invoiceNo: "INV-UAT-0001",
          product: "เนื้อวัว",
          invWeightKg: String(kg),
          slicedLostKg: "0",
          boxes,
        },
        lotId,
        from,
      );
    }
    if (done("accept"))
      cm("smokeOrderAccept", { acceptedBy: "Chef House UAT" }, from);
    if (done("cmReceive"))
      cm("cmReceive", { receivedBoxes: boxes, arrival: "08:00" }, mid);
    if (done("prepare")) cm("prepare", { preSmokeKg: String(kg) }, mid);
    const smokeRun = (inputKg: number) =>
      cm(
        "smoke",
        {
          smokeDate: mid,
          inputKg: String(inputKg),
          wasteKg: String(waste / 2),
          packs: packs(inputKg - waste / 2),
        },
        mid,
      );
    if (done("smokeHalf")) smokeRun(kg / 2);
    if (done("smokeRest")) smokeRun(kg / 2);
    if (done("closeLot")) cm("closeLot", { confirm: "Chef House UAT" }, mid);
    const net = (kg * 220 * 1.04).toFixed(2);
    const chefInvoice = done("invoice")
      ? cm(
          "smokingInvoice",
          {
            invoiceNumber: `CH-UAT-${lotId}`,
            invoiceDate: mid,
            vat: (kg * 220 * 0.07).toFixed(2),
            withholdingTax: (kg * 220 * 0.03).toFixed(2),
            attachment: `CH-UAT-${lotId}.pdf`,
          },
          mid,
        ).id
      : "";
    if (done("review"))
      owner(
        "invoiceReview",
        {
          invoiceId: chefInvoice,
          decision: options.reject ? "ส่งกลับแก้ไข" : "รับยอด",
          reviewedBy: "Owner UAT",
          ...(options.reject
            ? { comment: "UAT ยอด VAT ไม่ตรง กรุณาแก้แล้วส่งใหม่" }
            : {}),
        },
        lotId,
        to,
      );
    if (done("pay"))
      owner(
        "invoicePayment",
        {
          invoiceId: chefInvoice,
          paymentDate: to,
          paidAmount: net,
          paidBy: "Owner",
          paymentReference: `UAT-CH-PAY-${lotId}`,
        },
        lotId,
        to,
      );
    const outKg = kg - waste;
    if (done("return"))
      owner(
        "return",
        {
          returnDate: to,
          returnTime: "09:00",
          origin: "Chef House · เชียงใหม่",
          destination: "Foodiva · กรุงเทพฯ",
          vehicleType: "รถห้องเย็น",
          plate: "UAT-02",
          driverName: "คนขับ UAT",
          driverPhone: "0800000000",
          returnKg: String(outKg),
        },
        lotId,
        to,
      );
    if (done("foodivaReceive"))
      run(
        "owner",
        "foodivaReturnReceive",
        {
          receivedDate: to,
          receivedTime: "10:00",
          receivedKg: String(outKg),
          receivedBags: String(Math.round(outKg * 10)),
        },
        lotId,
        to,
      );
    if (done("central"))
      owner("central", { centralKg: String(outKg) }, lotId, to);
    return lotId;
  };

  const history = shipment(
    "UAT SH-0001 · ครบทั้งสาย ใช้ขายที่สองสาขาตั้งแต่วันแรก",
    "central",
    [d[0], d[0], d[0]],
    { kg: 60 },
  );
  const salaAllocation = owner(
    "allocate",
    { branch: SALA, deliveryDate: d[0], kg: "30" },
    history,
    d[0],
  ).id;
  const minAllocation = owner(
    "allocate",
    { branch: MIN, deliveryDate: d[0], kg: "24" },
    history,
    d[0],
  ).id;
  shipment("UAT SH-0002 · รอ Foodiva ทำใบขนส่ง", "request", [d[4], d[4], d[4]]);
  shipment(
    "UAT SH-0003 · Foodiva เปิดชุด Packing List พร้อม รอ Owner ออก PO รมควัน",
    "dispatch",
    [d[3], d[3], d[3]],
    { noOrder: true },
  );
  shipment(
    "UAT SH-0004 · ออก PO รมควันแล้ว ส่งแล้ว รอ Chef House ยืนยัน",
    "dispatch",
    [d[3], d[3], d[3]],
  );
  shipment(
    "UAT SH-0005 · Chef House กำลังรมควัน (รมไปครึ่งหนึ่ง)",
    "smokeHalf",
    [d[2], d[3], d[4]],
  );
  shipment(
    "UAT SH-0006 · ปิด Lot แล้ว รอ Chef ส่ง Invoice และรอเรียกรถขากลับ",
    "closeLot",
    [d[1], d[2], d[3]],
  );
  shipment("UAT SH-0007 · Invoice ค่ารมควันรอ Owner ตรวจยอด", "invoice", [
    d[1],
    d[2],
    d[3],
  ]);
  shipment("UAT SH-0008 · Invoice ค่ารมควันรับยอดแล้ว รอชำระ", "review", [
    d[1],
    d[2],
    d[3],
  ]);
  shipment(
    "UAT SH-0009 · Invoice ค่ารมควันส่งกลับให้ Chef แก้",
    "review",
    [d[1], d[2], d[3]],
    { reject: true },
  );
  shipment("UAT SH-0010 · รถขากลับออกแล้ว รอ Foodiva รับเข้าตู้", "return", [
    d[1],
    d[2],
    d[4],
  ]);
  shipment(
    "UAT SH-0011 · Foodiva รับแล้ว รอ Owner รับเข้าสต๊อกกลาง",
    "foodivaReceive",
    [d[1], d[2], d[4]],
  );
  shipment("UAT SH-0012 · อยู่ในสต๊อก ยังไม่จัดสรร", "central", [
    d[1],
    d[2],
    d[3],
  ]);
  const partial = shipment(
    "UAT SH-0013 · จัดสรรไปมีนบุรีบางส่วน สาขารับไปบางส่วน",
    "central",
    [d[1], d[2], d[3]],
  );
  const unreceived = shipment(
    "UAT SH-0014 · จัดสรรไปศาลาแดงหมดแล้ว สาขายังไม่รับ",
    "central",
    [d[1], d[2], d[3]],
  );
  const minPartial = owner(
    "allocate",
    { branch: MIN, deliveryDate: d[4], kg: "15" },
    partial,
    d[4],
  ).id;
  owner(
    "allocate",
    { branch: SALA, deliveryDate: d[4], kg: "45" },
    unreceived,
    d[4],
  );

  // ── Branch days. ──
  const transfer = (
    branch: string,
    material: string,
    quantity: number,
    date: string,
  ) =>
    owner(
      "materialTransfer",
      {
        material,
        branch,
        quantity: String(quantity),
        receiver: `ผู้ดูแล${branch}`,
      },
      "",
      date,
    ).id;
  const branchRun =
    (branch: string, date: string) =>
    (kind: EntryKind, values: Values, lotId = "") =>
      run("branch", kind, values, lotId, date, branch);
  // Opening stock from d0: every material bought goes to both branches and is confirmed.
  for (const branch of branches)
    materials.forEach((material, i) => {
      if (i === NEVER_BOUGHT) return;
      const quantity = branch === MIN && i === LOW_AT_MINBURI ? 15 : 100;
      const id = transfer(branch, material, quantity, d[0]);
      branchRun(branch, d[0])("materialConfirm", {
        transferId: id,
        receivedQuantity: String(quantity),
        receiver: `ผู้ดูแล${branch}`,
      });
    });
  owner("chiliAllocate", {
    branch: SALA,
    chiliTubes: "20",
    receiver: `ผู้ดูแล${SALA}`,
    reference: "UAT-CHILI-SALA-1",
  });
  owner("chiliAllocate", {
    branch: MIN,
    chiliTubes: "20",
    receiver: `ผู้ดูแล${MIN}`,
    reference: "UAT-CHILI-MIN-1",
  });

  const countMaterials = (branch: string, date: string) =>
    branchRun(branch, date)(
      "materials",
      Object.fromEntries(
        materials.flatMap((_, i) => {
          const opening = branchMaterialStock(db, branch, i, date);
          const used = Math.min(3, opening);
          return [
            [`opening${i}`, String(opening)],
            [`used${i}`, String(used)],
            [`material${i}`, String(opening - used)],
          ];
        }),
      ),
    );
  const carryRice = (branch: string, date: string) =>
    branchRun(branch, date)("riceCarry", {
      leftoverKg: cookedRiceStock(db, branch).toFixed(3),
      reheat: "เก็บไว้อุ่นวันถัดไป",
    });
  const sale = (
    branch: string,
    date: string,
    boxes: number,
    chiliAddons: number,
    wasteKg = 0,
    giveaways: Values[] = [],
  ) => {
    db = saleWithInfluencers(db, branch, date, history, giveaways, {
      boxes: String(boxes),
      chiliAddons: String(chiliAddons),
      soldKg: (boxes * 0.1015).toFixed(3),
      wasteKg: String(wasteKg),
      riceWasteKg: "0",
      expense: "0",
      lineMan: String(boxes * 350 + chiliAddons * 30),
      ...(wasteKg ? { reason: "UAT เนื้อตกพื้น" } : {}),
    });
    return db.entries.at(-1)!;
  };

  /** ศาลาแดง cooks its own rice: buy raw, issue, cook, sell, carry, close. */
  const salaDay = (
    date: string,
    close: boolean,
    extra: { waste?: number; influencer?: boolean } = {},
  ) => {
    const b = branchRun(SALA, date);
    b("thaw", { kg: "3" }, history);
    b("riceIssue", { rawRiceIssuedKg: "4", receiver: "ผู้ดูแลศาลาแดง" });
    b("rice", { rawUsedKg: "4", riceKg: "6" });
    const entry = sale(
      SALA,
      date,
      28,
      2,
      extra.waste,
      extra.influencer
        ? [
            {
              influencer: "UAT อินฟลูฯ ศาลาแดง",
              boxes: "1",
              chiliAddons: "0",
              shippingFee: "80",
            },
          ]
        : [],
    );
    if (!close) return entry;
    countMaterials(SALA, date);
    carryRice(SALA, date);
    b("closeDay", { confirm: "ผู้ดูแลศาลาแดง" });
    return entry;
  };
  /** มีนบุรี only buys cooked rice. */
  const minDay = (date: string, close: boolean) => {
    const b = branchRun(MIN, date);
    const purchase = b("ricePurchase", {
      riceSource: riceSources[1],
      supplier: "ร้านข้าวสุก UAT",
      cookedRiceKg: "6",
      cookedRiceCost: "270",
    });
    b("thaw", { kg: "3" }, history);
    sale(MIN, date, 25, 1);
    countMaterials(MIN, date);
    if (close) {
      carryRice(MIN, date);
      b("closeDay", { confirm: "ผู้ดูแลมีนบุรี" });
    }
    return purchase;
  };

  // d0: both branches take in SH-0001 and close.
  branchRun(SALA, d[0])("ricePurchase", {
    riceSource: riceSources[0],
    supplier: "ร้านข้าวสาร UAT",
    rawRiceKg: "20",
    rawRiceCost: "1100",
  });
  branchRun(SALA, d[0])(
    "receive",
    { kg: "30", allocation: salaAllocation, complete: "1" },
    history,
  );
  branchRun(MIN, d[0])(
    "receive",
    { kg: "24", allocation: minAllocation, complete: "1" },
    history,
  );
  salaDay(d[0], true);
  minDay(d[0], true);
  const minSaleD0 = entries(db, "sale", undefined, MIN, d[0]).at(-1)!;
  // d1
  salaDay(d[1], true, { influencer: true });
  const minRiceD1 = minDay(d[1], true);
  // d2: มีนบุรี closes, the Owner unlocks it, it closes again.
  const salaSaleD2 = salaDay(d[2], true, { waste: 0.05 });
  minDay(d[2], true);
  owner(
    "unlock",
    { branch: MIN, reason: "UAT สาขาขอเช็คยอดวัสดุอีกรอบ" },
    "",
    d[2],
  );
  branchRun(MIN, d[2])("closeDay", {
    confirm: "ผู้ดูแลมีนบุรี",
    note: "ปิดใหม่หลังปลดล็อก",
  });
  // d3: new chili and raw rice; ศาลาแดง sells but never counts materials, carries rice or closes.
  owner(
    "chiliAllocate",
    {
      branch: SALA,
      chiliTubes: "20",
      receiver: `ผู้ดูแล${SALA}`,
      reference: "UAT-CHILI-SALA-2",
    },
    "",
    d[3],
  );
  const confirmed = transfer(MIN, "ถุงหิ้วกระดาษ", 30, d[3]);
  branchRun(MIN, d[3])("materialConfirm", {
    transferId: confirmed,
    receivedQuantity: "30",
    receiver: "ผู้ดูแลมีนบุรี",
  });
  branchRun(SALA, d[3])("ricePurchase", {
    riceSource: riceSources[0],
    supplier: "ร้านข้าวสาร UAT",
    rawRiceKg: "20",
    rawRiceCost: "1100",
  });
  salaDay(d[3], false);
  minDay(d[3], true);

  // d4 (today). ศาลาแดง: issued raw rice, nothing else yet; two transfers to confirm.
  transfer(SALA, materials[0], 50, d[4]);
  transfer(SALA, "ถุงซีลเนื้อ", 50, d[4]);
  branchRun(SALA, d[4])("riceIssue", {
    rawRiceIssuedKg: "4",
    receiver: "ผู้ดูแลศาลาแดง",
  });
  // มีนบุรี: took in 5 of 15 kg, confirmed a short transfer, sold and counted; rice not carried yet.
  const short = transfer(MIN, "กระดาษรอง", 40, d[4]);
  const min = branchRun(MIN, d[4]);
  min("materialConfirm", {
    transferId: short,
    receivedQuantity: "38",
    receiver: "ผู้ดูแลมีนบุรี",
    reason: "UAT ของมาไม่ครบ ขาด 2 แผ่น",
  });
  min("receive", { kg: "5", allocation: minPartial }, partial);
  minDay(d[4], false);

  // ── Edit requests: one waiting, one approved, one rejected. ──
  run(
    "branch",
    "editRequest",
    {
      targetId: salaSaleD2.id,
      reason: "UAT กรอกยอด LINE MAN ผิด",
      values: JSON.stringify({ lineMan: "9500" }),
    },
    "",
    d[4],
    SALA,
  );
  const approved = run(
    "branch",
    "editRequest",
    {
      targetId: minRiceD1.id,
      reason: "UAT ราคาข้าวสุกจริง 300 บาท",
      values: JSON.stringify({ cookedRiceCost: "300" }),
    },
    "",
    d[3],
    MIN,
  );
  owner(
    "editDecision",
    { requestId: approved.id, decision: "อนุมัติ" },
    "",
    d[3],
  );
  const rejected = run(
    "branch",
    "editRequest",
    {
      targetId: minSaleD0.id,
      reason: "UAT ขอแก้จำนวนกล่อง",
      values: JSON.stringify({ boxes: "26" }),
    },
    "",
    d[4],
    MIN,
  );
  owner(
    "editDecision",
    {
      requestId: rejected.id,
      decision: "ไม่อนุมัติ",
      note: "UAT ยอดตรงกับใบเสร็จแล้ว",
    },
    "",
    d[4],
  );
  return db;
}
