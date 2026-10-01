"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  batchKinds,
  entries,
  lotProgress,
  n,
  produced,
  producedBags,
  smokingInvoiceRejection,
  smokingInvoiceStatus,
  titles,
  validPackWeights,
  type Database,
  type Lot,
} from "@/lib/store";
import { fmt } from "@/lib/format";
import type { ModalKind } from "@/lib/nav";
import { again } from "@/components/organisms/owner/lotSteps";

type OpenForm = (kind: ModalKind, lotId?: string) => void;

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
  const latestInvoice = entries(db, "smokingInvoice", lot.id).at(-1);
  const invoiceStatus = latestInvoice
    ? smokingInvoiceStatus(db, latestInvoice)
    : "";
  const p = lotProgress(db, lot.id);
  const billable = !latestInvoice || invoiceStatus === "ส่งกลับแก้ไข";
  /* CHF-07 / D7: nothing waits on anything else, so every record is a button and all of
   * them look the same: none is "the next one". One already saved (PO accepted, weighed
   * in, pre-smoke weight, closed) stays a button too: saving it again is said, not
   * refused, and the newest counts (GEN-06). A button is left out only where mutate
   * refuses the save: accepting a smoke PO that does not exist, and "Edit ข้อมูลก่อนปิด
   * Lot" with no weigh-in or pre-smoke weight to correct (after ปิด Lot it still saves,
   * with a warning, CHF-04). */
  const jobs: { kind: ModalKind; label: string; show?: boolean }[] = [
    {
      kind: "smokeOrderAccept",
      label: again("ยืนยันรับ PO รมควัน", p.has("smokeOrderAccept")),
      show: !!smokeOrder,
    },
    { kind: "cmReceive", label: again(titles.cmReceive, p.has("cmReceive")) },
    { kind: "prepare", label: again(titles.prepare, p.has("prepare")) },
    // Smoking after ปิด Lot still saves, with a warning (CHF-05).
    { kind: "smoke", label: titles.smoke },
    {
      kind: "chefEdit",
      label: "Edit ข้อมูลก่อนปิด Lot",
      show: p.has("cmReceive") && p.has("prepare"),
    },
    { kind: "closeLot", label: again("ยืนยันปิด Lot", p.has("closeLot")) },
    {
      kind: "smokingInvoice",
      label: latestInvoice
        ? "แก้ไขและ Submit ใบวางบิล"
        : "สร้าง / Submit ใบวางบิล",
      show: billable,
    },
  ];
  const note =
    latestInvoice && invoiceStatus === "ส่งกลับแก้ไข"
      ? smokingInvoiceRejection(db, latestInvoice)?.values.comment?.trim()
      : "";
  return (
    <ButtonRow compact>
      {!smokeOrder && <Badge tone="neutral">ยังไม่มี PO รมควัน</Badge>}
      {latestInvoice && invoiceStatus === "ส่งกลับแก้ไข" && (
        <Badge tone="danger">ส่งกลับแก้ไข{note ? ` · ${note}` : ""}</Badge>
      )}
      {latestInvoice && !billable && (
        <Badge tone={invoiceStatus === "ชำระแล้ว" ? "success" : "neutral"}>
          {invoiceStatus}
        </Badge>
      )}
      {jobs
        .filter((job) => job.show !== false)
        .map((job) => (
          <Button
            key={job.kind}
            variant="table-secondary"
            onClick={() => open(job.kind, lot.id)}
          >
            {job.label}
          </Button>
        ))}
    </ButtonRow>
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
            .map(([weight, count]) => `${count} × ${weight}`)
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
        title="Lot งานผลิต Chef House"
        description="ดูที่จดไว้และจดเพิ่มได้จากตาราง ไม่ต้องเปิดทีละการ์ด"
      />
      <DataTable
        title="รายการ Lot ทั้งหมด"
        columns={[
          "Lot",
          "PO รมควัน",
          "เอกสาร PO",
          "รับจริง",
          "จดล่าสุด",
          "น้ำหนักหลังรมควัน",
          "กล่องรมควัน",
          "การทำงาน",
        ]}
        rowKeys={lots.map((lot) => lot.id)}
        rows={lots.map((lot) => [
          lot.id,
          entries(db, "smokeOrder", lot.id).at(-1)?.values.orderNumber ||
            "ยังไม่มี",
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
            : "ยังไม่ได้จดรับ",
          batchKinds
            .filter((k) => lotProgress(db, lot.id).has(k))
            .map((k) => titles[k])
            .at(-1) ?? "—",
          produced(db, lot.id) ? `${fmt(produced(db, lot.id))} กก.` : "-",
          producedBags(db, lot.id)
            ? `${producedBags(db, lot.id)} กล่องรมควัน`
            : "-",
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
        defaultSort={{ column: "วันที่สโมค", desc: true }}
        columns={[
          "วันที่สโมค",
          "Lot หลัก",
          "Lot สโมค",
          "น้ำหนักเข้าเตา",
          "กล่องรมควันที่ได้",
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
            weights.length
              ? `${weights.length} กล่องรมควัน · ${bagDetail} กก.`
              : "—",
            `${fmt(n(entry.values, "postSmokeKg"))} กก.`,
            `${fmt(n(entry.values, "wasteKg"))} กก.`,
            `${fmt(remainingKg)} กก.`,
          ],
        )}
      />
    </>
  );
}
