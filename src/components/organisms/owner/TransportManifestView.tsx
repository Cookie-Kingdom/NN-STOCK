"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import {
  transportDocumentRows,
  transportDocumentTitle,
} from "@/components/organisms/owner/documentRows";
import { LotWorkflowAction } from "@/components/organisms/owner/LotWorkflowAction";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import {
  entries,
  n,
  produced,
  shipmentLines,
  shipments,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const columns = [
  "เลขที่การส่ง",
  "PO ซื้อ (กก.)",
  "ขาไป · Foodiva → Chef House",
  "เทียบน้ำหนัก Owner",
  "ขากลับ · Chef House → Foodiva",
  "การทำงาน",
];

export function TransportManifestView({
  db,
  open,
  onOpenSmokePo,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
  onOpenSmokePo: () => void;
}) {
  const rows = shipments(db);
  return (
    <>
      <SectionHeading
        title="ใบขนส่งเนื้อ"
        description="Owner สร้าง Request ส่งเนื้อ · Foodiva ทำใบขนส่งขาไป Foodiva → Chef House · Owner เรียกรถขากลับ Chef House → Foodiva"
        actions={
          <ButtonRow>
            <Button
              variant="primary"
              icon={<Plus />}
              onClick={() => open("shipmentRequest", "")}
            >
              สร้าง Request ส่งเนื้อไป Chef House
            </Button>
          </ButtonRow>
        }
      />
      <DataTable
        title="รายการส่ง"
        columns={columns}
        rowKeys={rows.map((lot) => lot.id)}
        rows={rows.map((lot) => {
          const back = entries(db, "return", lot.id).at(-1);
          const outbound = entries(db, "dispatch", lot.id).at(-1);
          const chefReceive = entries(db, "cmReceive", lot.id).at(-1);
          // Compare against what left Foodiva, not the invoice total: the waste share stays behind for Owner.
          const foodivaKg = outbound
            ? n(outbound.values, "dispatchKg")
            : n(lot.values, "requestedKg");
          const chefKg = n(chefReceive?.values || {}, "receivedKg");
          const difference = chefKg - foodivaKg;
          return [
            <strong key="shipment">{lot.poId}</strong>,
            <span key="lines">
              {shipmentLines(lot).map((line) => (
                <span key={line.lotId} className="block">
                  {`${db.lots.find((po) => po.id === line.lotId)?.poId || line.lotId} × ${fmt(line.kg)} กก.`}
                </span>
              ))}
            </span>,
            outbound ? (
              <ButtonRow key={`${lot.id}-outbound`}>
                <span>{`${fmt(n(outbound.values, "dispatchKg"))} กก. · ${outbound.values.plate || "ยังไม่ระบุรถ"}`}</span>
                <DocumentPrintButton
                  title={transportDocumentTitle.outbound}
                  number={
                    outbound.values.transferNumber || outbound.id.slice(0, 8)
                  }
                  label="พรีวิว / PDF"
                  preview
                  rows={transportDocumentRows(lot, outbound, "outbound")}
                />
              </ButtonRow>
            ) : (
              `Request ${fmt(foodivaKg)} กก. · รอ Foodiva ทำใบขนส่ง`
            ),
            chefReceive ? (
              <span key={`${lot.id}-owner-check`}>
                <strong>ส่งจาก Foodiva:</strong> {fmt(foodivaKg)} กก.
                <br />
                <strong>Chef House:</strong> {fmt(chefKg)} กก.
                <br />
                <Badge
                  tone={Math.abs(difference) > 0.001 ? "danger" : "success"}
                >
                  ส่วนต่าง {fmt(Math.abs(difference))} กก.
                </Badge>
              </span>
            ) : (
              "รอ Chef House ชั่งรับ"
            ),
            back ? (
              <ButtonRow key={`${lot.id}-return`}>
                <span>{`${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.plate || "ยังไม่ระบุรถ"}`}</span>
                <DocumentPrintButton
                  title={transportDocumentTitle.return}
                  number={back.values.transferNumber || back.id.slice(0, 8)}
                  label="พรีวิว / PDF"
                  preview
                  rows={transportDocumentRows(lot, back, "return")}
                />
              </ButtonRow>
            ) : lot.stage < 6 ? (
              "รอ Chef House ปิด Lot"
            ) : (
              `รอเรียกรถกลับ ${fmt(produced(db, lot.id))} กก.`
            ),
            <LotWorkflowAction
              key={`${lot.id}-action`}
              db={db}
              lot={lot}
              open={open}
              onOpenSmokePo={onOpenSmokePo}
            />,
          ];
        })}
      />
    </>
  );
}
