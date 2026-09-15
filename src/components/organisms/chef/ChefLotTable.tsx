"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  entries,
  n,
  produced,
  producedBags,
  smokingInvoiceStatus,
  stages,
  titles,
  validPackWeights,
  type Database,
  type Lot,
} from "@/lib/store";
import { fmt } from "@/lib/format";

type OpenForm = (kind: string, lotId?: string) => void;

function ChefLotAction({
  db,
  lot,
  open,
}: {
  db: Database;
  lot: Lot;
  open: OpenForm;
}) {
  const smokeOrder = entries(db, "smokeOrder", lot.id).at(-1);
  const accepted = entries(db, "smokeOrderAccept", lot.id).at(-1);
  const latestInvoice = entries(db, "smokingInvoice", lot.id).at(-1);
  const invoiceStatus = latestInvoice
    ? smokingInvoiceStatus(db, latestInvoice)
    : "";
  if (!smokeOrder) return "รอ Owner ออก PO รมควัน";
  if (!accepted)
    return (
      <Button variant="table" onClick={() => open("smokeOrderAccept", lot.id)}>
        ยืนยันรับ PO รมควัน
      </Button>
    );
  if (!latestInvoice || invoiceStatus === "ส่งกลับแก้ไข")
    return (
      <Button variant="table" onClick={() => open("smokingInvoice", lot.id)}>
        {latestInvoice ? "แก้ไขและ Submit ใบวางบิล" : "สร้าง / Submit ใบวางบิล"}
      </Button>
    );
  if (lot.stage < 2) return <Badge>{invoiceStatus} · รอ Owner เรียกรถ</Badge>;
  const kind =
    lot.stage === 3
      ? "prepare"
      : lot.stage === 4
        ? "smoke"
        : lot.stage === 5
          ? "closeLot"
          : "";
  if (lot.stage === 5)
    return (
      <ButtonRow compact>
        <Button
          variant="table-secondary"
          onClick={() => open("chefEdit", lot.id)}
        >
          Edit ข้อมูลก่อนปิด Lot
        </Button>
        <Button variant="table" onClick={() => open("closeLot", lot.id)}>
          ยืนยันปิด Lot
        </Button>
      </ButtonRow>
    );
  if (lot.stage >= 6)
    return (
      <Badge tone={invoiceStatus === "ชำระแล้ว" ? "success" : "neutral"}>
        {invoiceStatus}
      </Badge>
    );
  return kind ? (
    <Button variant="table" onClick={() => open(kind, lot.id)}>
      {titles[kind]}
    </Button>
  ) : lot.stage === 2 ? (
    "ไปเมนูยืนยันรับเนื้อ"
  ) : (
    "ส่งต่องานแล้ว"
  );
}

export function ChefLotTable({
  db,
  lots,
  open,
}: {
  db: Database;
  lots: Lot[];
  open: OpenForm;
}) {
  const smokeLogs = lots.flatMap((lot) =>
    entries(db, "smoke", lot.id).map((entry) => {
      const batchesBeforeOrAtThisEntry = entries(db, "smoke", lot.id).slice(
        0,
        entries(db, "smoke", lot.id).findIndex(
          (batch) => batch.id === entry.id,
        ) + 1,
      );
      const weights = validPackWeights(entry.values.packs);
      const weightGroups = Array.from(
        weights.reduce((groups, weight) => {
          const key = fmt(weight);
          groups.set(key, (groups.get(key) || 0) + 1);
          return groups;
        }, new Map<string, number>()),
      );
      const bagDetail = weightGroups.length
        ? weightGroups
            .map(([weight, count]) => `${weight} × ${count}`)
            .join(" + ")
        : "—";
      return {
        lot,
        entry,
        weights,
        bagDetail,
        remainingKg: Math.max(
          0,
          n(lot.values, "preSmokeKg") -
            batchesBeforeOrAtThisEntry.reduce(
              (total, batch) => total + n(batch.values, "inputKg"),
              0,
            ),
        ),
      };
    }),
  );
  return (
    <>
      <SectionHeading
        title="Lot งานผลิต Chef_house"
        description="ดูสถานะและทำงานต่อจากตาราง โดยไม่ต้องเปิดทีละการ์ด"
      />
      <DataTable
        title="รายการ Lot ทั้งหมด"
        columns={[
          "Lot",
          "PO รมควัน",
          "เอกสาร PO",
          "รับจริง",
          "สถานะ",
          "น้ำหนักหลังรมควัน",
          "จำนวนถุง",
          "การทำงาน",
        ]}
        rowKeys={lots.map((lot) => lot.id)}
        rows={lots.map((lot) => [
          lot.id,
          entries(db, "smokeOrder", lot.id).at(-1)?.values.orderNumber ||
            "รอ Owner ออก PO",
          entries(db, "smokeOrder", lot.id).length ? (
            <Button
              key={`${lot.id}-po`}
              variant="table"
              onClick={() => open("smokeOrderPreview", lot.id)}
            >
              ดู PO รมควัน
            </Button>
          ) : (
            "—"
          ),
          n(lot.values, "receivedKg")
            ? `${fmt(n(lot.values, "receivedKg"))} กก.`
            : "รอยืนยันรับ",
          stages[lot.stage],
          produced(db, lot.id) ? `${fmt(produced(db, lot.id))} กก.` : "-",
          producedBags(db, lot.id) ? `${producedBags(db, lot.id)} ถุง` : "-",
          <ChefLotAction
            key={`${lot.id}-action`}
            db={db}
            lot={lot}
            open={open}
          />,
        ])}
      />
      <DataTable
        title={`Log Lot สโมครายวัน ${smokeLogs.length} รอบ`}
        columns={[
          "วันที่สโมค",
          "Lot หลัก",
          "Lot สโมค",
          "น้ำหนักเข้าเตา",
          "ถุงที่ได้",
          "น้ำหนักหลังรม",
          "น้ำหนัก Waste",
          "คงเหลือรอผลิต",
        ]}
        rowKeys={smokeLogs.map(({ entry }) => entry.id)}
        rows={smokeLogs.map(
          ({ lot, entry, weights, bagDetail, remainingKg }) => [
            entry.values.smokeDate || entry.date,
            lot.id,
            entry.values.subLot || "—",
            `${fmt(n(entry.values, "inputKg"))} กก.`,
            weights.length ? `${weights.length} ถุง · ${bagDetail} กก.` : "—",
            `${fmt(n(entry.values, "postSmokeKg"))} กก.`,
            `${fmt(n(entry.values, "wasteKg"))} กก.`,
            `${fmt(remainingKg)} กก.`,
          ],
        )}
      />
    </>
  );
}
