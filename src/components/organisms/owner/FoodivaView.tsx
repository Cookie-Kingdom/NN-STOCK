"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Stat } from "@/components/atoms/Stat";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { shipmentPoLabels } from "@/components/organisms/owner/documentRows";
import { again } from "@/components/organisms/owner/lotSteps";
import { LotProgressChips } from "@/components/molecules/LotProgressChips";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/molecules/DocumentPrintButton";
import { SlipList } from "@/components/molecules/AttachmentButton";
import {
  lotIssueDate,
  purchaseOrderRows,
} from "@/components/organisms/shared/documentRows";
import {
  entries,
  n,
  packingListKg,
  poRemainingKg,
  producedBags,
  purchaseLots,
  rawAtFoodiva,
  readyForChefHouse,
  ownerWasteOutstanding,
  shipments,
  lotProgress,
  type Database,
  type EntryKind,
  type Lot,
} from "@/lib/store";
import { fmt } from "@/lib/format";

export function FoodivaView({
  db,
  open,
}: {
  db: Database;
  open: (kind: EntryKind, lotId?: string) => void;
}) {
  const pos = purchaseLots(db);
  // Newest batch first: every shipment batch, whoever opened it (SHP-04).
  const batches = [...shipments(db)].reverse();
  // SMK-09: a smoke PO with no transport document yet is Foodiva's incoming work.
  const incoming = batches.filter((lot) => {
    const p = lotProgress(db, lot.id);
    return p.has("smokeOrder") && !p.has("dispatch");
  });
  const holding = db.lots.reduce((sum, lot) => sum + rawAtFoodiva(db, lot), 0);
  const reservedForContent = db.lots.reduce(
    (sum, lot) => sum + ownerWasteOutstanding(db, lot.id),
    0,
  );
  /** The purchase POs a batch's smoke PO cites; none until the Owner issues it. */
  const poLabels = (lot: Lot) => {
    const labels = shipmentPoLabels(db, lot);
    return labels.length ? (
      <span key="lines">
        {labels.map((label) => (
          <span key={label} className="block">
            {label}
          </span>
        ))}
      </span>
    ) : (
      "—"
    );
  };
  return (
    <div className="grid gap-6">
      <SectionHeading
        framed
        title="งาน Foodiva"
        description="รับ PO ออก Invoice แล้วระบุน้ำหนักพร้อมส่งเชียงใหม่ และเนื้อส่วนที่เหลือรอ Owner รับ (Waste)"
        actions={
          <>
            <Stat
              label="เนื้อดิบรอส่ง Chef House"
              value={`${fmt(holding)} กก.`}
            />
            <Stat
              label="เนื้อส่วนที่เหลือรอ Owner รับ (Waste)"
              value={`${fmt(reservedForContent)} กก.`}
            />
          </>
        }
      />
      <DataTable
        title="PO รมควันที่ยังไม่มีใบขนส่ง"
        columns={[
          "เลขที่การส่ง",
          "เลข PO รมควัน",
          "วันที่ออก PO",
          "PO ซื้อ (กก.)",
          "รวม",
          "การทำงาน",
        ]}
        emptyText="ไม่มี PO รมควันที่รอทำใบขนส่ง"
        rowKeys={incoming.map((lot) => lot.id)}
        rows={incoming.map((lot) => {
          const order = entries(db, "smokeOrder", lot.id).at(-1);
          return [
            <strong key="shipment">{lot.poId}</strong>,
            order?.values.orderNumber || "—",
            order?.date || "—",
            poLabels(lot),
            `${fmt(n(lot.values, "requestedKg"))} กก.`,
            <Button
              key="dispatch"
              variant="table"
              onClick={() => open("dispatch", lot.id)}
            >
              ทำใบขนส่ง
            </Button>,
          ];
        })}
      />
      <DataTable
        title="ชุดรมควัน"
        action={
          <Button
            variant="secondary"
            icon={<Plus className="size-4" />}
            onClick={() => open("dispatch", "")}
          >
            เปิดชุดใหม่
          </Button>
        }
        columns={[
          "เลขที่การส่ง",
          "PO รมควัน",
          "PO ซื้อ (กก.)",
          "ส่งไป",
          "ความคืบหน้า",
          "การทำงาน",
        ]}
        emptyText="ยังไม่มีชุดรมควัน · กด “เปิดชุดใหม่” เพื่อทำใบขนส่งและ Packing List"
        rowKeys={batches.map((lot) => lot.id)}
        rows={batches.map((lot) => {
          const p = lotProgress(db, lot.id);
          const order = entries(db, "smokeOrder", lot.id).at(-1);
          const sentKg = packingListKg(db, lot.id);
          return [
            <span key="shipment" className="grid">
              <strong>{lot.poId}</strong>
              <span className="text-caption text-text-secondary">{lot.id}</span>
            </span>,
            order ? (
              `${order.values.orderNumber || "PO รมควัน"} · ${order.date}`
            ) : (
              <Badge key="order" tone="warning">
                ยังไม่มี PO รมควัน
              </Badge>
            ),
            poLabels(lot),
            sentKg !== undefined
              ? `${fmt(sentKg)} กก.`
              : p.has("dispatch")
                ? `${fmt(n(lot.values, "dispatchKg"))} กก.`
                : "—",
            <LotProgressChips key="progress" db={db} lotId={lot.id} />,
            // SHP-04: the transport document on any batch without one; the Packing List
            // stays editable after the smoke PO too (the form says so, SHP-02).
            !p.has("dispatch") ? (
              <Button
                key="dispatch"
                variant="table"
                onClick={() => open("dispatch", lot.id)}
              >
                ทำใบขนส่ง + Packing List
              </Button>
            ) : (
              // GEN-06: a second transport document is said, not refused; the newest counts.
              <ButtonRow key="actions" compact>
                <Button
                  variant="table-secondary"
                  onClick={() => open("dispatch", lot.id)}
                >
                  {again("ใบขนส่ง", true)}
                </Button>
                <Button
                  variant="table"
                  onClick={() => open("packingList", lot.id)}
                >
                  {p.has("packingList")
                    ? "แก้ไข Packing List"
                    : "ทำ Packing List"}
                </Button>
              </ButtonRow>
            ),
          ];
        })}
      />
      <DataTable
        title="PO เนื้อที่ต้องออก Invoice"
        defaultSort={{ column: "วันที่ออก PO", desc: true }}
        columns={[
          "เลข PO",
          "Lot",
          "วันที่ออก PO",
          "ยอดสั่ง",
          "Invoice เนื้อ",
          "พร้อมส่งเชียงใหม่",
          "เก็บไว้ให้ Owner คงเหลือ",
          "เนื้อดิบรอส่ง Chef House",
          "คงเหลือส่ง Chef House",
          "การชำระเงิน",
          "การทำงาน",
        ]}
        rowKeys={pos.map((lot) => lot.id)}
        rows={pos.map((lot) => {
          const confirm = entries(db, "foodivaConfirm", lot.id).at(-1);
          // The Owner's payment of this invoice, with its slip as evidence for both sides.
          const payment = entries(db, "meatPayment", lot.id).at(-1);
          return [
            <strong key={lot.poId}>{lot.poId}</strong>,
            lot.id,
            lotIssueDate(db, lot),
            `${fmt(n(lot.values, "orderedKg"))} กก.`,
            confirm ? (
              `${confirm.values.invoiceNo} · ${fmt(n(confirm.values, "confirmedKg"))} กก.`
            ) : (
              <Badge tone="danger" key="pending">
                รอออก Invoice
              </Badge>
            ),
            confirm ? `${fmt(readyForChefHouse(db, lot.id))} กก.` : "—",
            confirm ? `${fmt(ownerWasteOutstanding(db, lot.id))} กก.` : "—",
            `${fmt(rawAtFoodiva(db, lot))} กก.`,
            confirm
              ? `${fmt(poRemainingKg(db, lot.id))} กก.`
              : "ต้องออก Invoice",
            payment ? (
              <span key="payment" className="grid justify-items-end gap-1.5">
                <Badge tone="success">
                  {`จ่ายแล้ว · ${payment.values.paymentDate || payment.date} · ฿${fmt(n(payment.values, "paidAmount"))}`}
                </Badge>
                <SlipList value={payment.values.slips} />
              </span>
            ) : confirm ? (
              <Badge key="payment" tone="warning">
                รอ Owner ชำระ
              </Badge>
            ) : (
              "—"
            ),
            !confirm ? (
              <ButtonRow key="confirm-actions">
                <DocumentPrintButton
                  title="Purchase Order"
                  number={lot.poId}
                  rows={purchaseOrderRows(lot, db)}
                  label="ดู PO / PDF"
                  preview
                />
                <Button
                  variant="table"
                  onClick={() => open("foodivaConfirm", lot.id)}
                >
                  ออกและอัปโหลด Invoice
                </Button>
              </ButtonRow>
            ) : (
              <ButtonRow key="confirmed-actions">
                <DocumentPrintButton
                  title="Purchase Order"
                  number={lot.poId}
                  rows={purchaseOrderRows(lot, db)}
                  label="ดู PO / PDF"
                  preview
                />
                <Badge tone="success">แนบ Invoice แล้ว</Badge>
                <Button
                  variant="table"
                  onClick={() => open("foodivaConfirm", lot.id)}
                >
                  แก้ไข / อัปโหลดใหม่
                </Button>
              </ButtonRow>
            ),
          ];
        })}
      />
      <DataTable
        title="เนื้อรมควันขากลับ · รับเข้าตู้ Foodiva"
        columns={[
          "เลขที่การส่ง",
          "ใบขนส่งขากลับ",
          "Chef House ส่ง",
          "Foodiva รับจริง",
          "สถานะ",
          "การทำงาน",
        ]}
        emptyText="ยังไม่มีชุดรมควัน"
        rowKeys={batches.map((lot) => lot.id)}
        rows={batches.map((lot) => {
          const trip = entries(db, "return", lot.id).at(-1);
          const got = entries(db, "foodivaReturnReceive", lot.id).at(-1);
          const sentKg = n(trip?.values || {}, "returnKg");
          // RET-02: Foodiva may weigh in before the return truck is on file; then there is
          // nothing to compare against yet.
          const gap = got && trip ? n(got.values, "receivedKg") - sentKg : 0;
          return [
            <strong key="shipment">{lot.poId}</strong>,
            trip
              ? `${trip.values.transferNumber || "-"} · ${trip.values.returnDate || "-"} · ${trip.values.plate || "-"}`
              : "ยังไม่มีใบขนส่งขากลับ",
            trip
              ? `${producedBags(db, lot.id)} กล่องรมควัน · ${fmt(sentKg)} กก.`
              : "—",
            got
              ? `${got.values.receivedBags} กล่องรมควัน · ${fmt(n(got.values, "receivedKg"))} กก.`
              : "ยังไม่ชั่งรับ",
            got ? (
              <Badge
                key="status"
                tone={Math.abs(gap) > 0.001 ? "danger" : "success"}
              >
                {trip
                  ? `รับแล้ว · ส่วนต่าง ${fmt(Math.abs(gap))} กก.`
                  : "รับแล้ว · ยังไม่มีใบขนส่งขากลับ"}
              </Badge>
            ) : trip ? (
              <Badge tone="danger" key="status">
                ต้องรับเข้า
              </Badge>
            ) : (
              <Badge tone="neutral" key="status">
                ยังไม่มีรถขากลับ
              </Badge>
            ),
            // GEN-06: after the weigh-in the row says who moves next, and a second weigh-in
            // is still one click away (said, not refused; the newest counts).
            <span key="receive" className="inline-grid justify-items-end gap-1">
              {got &&
                (lotProgress(db, lot.id).has("central")
                  ? "Owner รับเข้าสต๊อกกลางแล้ว"
                  : "รอ Owner รับเข้าสต๊อกกลาง")}
              <Button
                variant={got ? "table-secondary" : "table"}
                onClick={() => open("foodivaReturnReceive", lot.id)}
              >
                {again("ยืนยันรับเข้าตู้", !!got)}
              </Button>
            </span>,
          ];
        })}
      />
    </div>
  );
}
