"use client";

import { Plus } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import {
  shipmentPoLabels,
  transportDocumentRows,
  transportDocumentTitle,
} from "@/components/organisms/owner/documentRows";
import { LotWorkflowAction } from "@/components/organisms/owner/LotWorkflowAction";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import {
  entries,
  n,
  packingListKg,
  produced,
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
          // What went is the Packing List box total; the Request kg is only what was asked for.
          const requestedKg = n(lot.values, "requestedKg");
          const sentKg = packingListKg(db, lot.id);
          const requestedLine = `ขอใน Request: ${fmt(requestedKg)} กก.`;
          const chefKg = n(chefReceive?.values || {}, "receivedKg");
          const difference = chefKg - (sentKg ?? 0);
          const foodivaBack = entries(db, "foodivaReturnReceive", lot.id).at(
            -1,
          );
          const backGap = foodivaBack
            ? n(foodivaBack.values, "receivedKg") -
              n(back?.values || {}, "returnKg")
            : 0;
          return [
            <strong key="shipment">{lot.poId}</strong>,
            <span key="lines">
              {shipmentPoLabels(db, lot).map((label) => (
                <span key={label} className="block">
                  {label}
                </span>
              ))}
            </span>,
            outbound ? (
              <ButtonRow key={`${lot.id}-outbound`} className="my-0">
                <span>
                  {sentKg === undefined
                    ? `รอ Packing List · ${outbound.values.plate || "ยังไม่ระบุรถ"}`
                    : `Packing List ${fmt(sentKg)} กก. · ${outbound.values.plate || "ยังไม่ระบุรถ"}`}
                  <br />
                  <small className="text-text-secondary">{requestedLine}</small>
                </span>
                <DocumentPrintButton
                  title={transportDocumentTitle.outbound}
                  number={
                    outbound.values.transferNumber || outbound.id.slice(0, 8)
                  }
                  label="พรีวิว / PDF"
                  preview
                  rows={transportDocumentRows(db, lot, outbound, "outbound")}
                />
              </ButtonRow>
            ) : (
              `Request ${fmt(requestedKg)} กก. · รอ Foodiva ทำใบขนส่ง`
            ),
            chefReceive && sentKg !== undefined ? (
              <span key={`${lot.id}-owner-check`}>
                <strong>ส่งไป (Packing List):</strong> {fmt(sentKg)} กก.
                <br />
                <strong>Chef House:</strong> {fmt(chefKg)} กก.
                <br />
                <small className="text-text-secondary">{requestedLine}</small>
                <br />
                <Badge
                  tone={Math.abs(difference) > 0.001 ? "danger" : "success"}
                >
                  {`ส่วนต่าง ${difference < -0.001 ? "−" : difference > 0.001 ? "+" : ""}${fmt(Math.abs(difference))} กก.`}
                </Badge>
              </span>
            ) : (
              "รอ Chef House ชั่งรับ"
            ),
            back ? (
              <ButtonRow key={`${lot.id}-return`} className="my-0">
                <span>
                  {`${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.plate || "ยังไม่ระบุรถ"}`}
                  <br />
                  <strong>ส่งจาก Chef House:</strong>{" "}
                  {`${fmt(n(back.values, "returnKg"))} กก.`}
                  <br />
                  <strong>Foodiva รับจริง:</strong>{" "}
                  {foodivaBack ? (
                    <>
                      {`${fmt(n(foodivaBack.values, "receivedKg"))} กก. · ${foodivaBack.values.receivedBags} กล่องรมควัน `}
                      <Badge
                        tone={Math.abs(backGap) > 0.001 ? "danger" : "success"}
                      >
                        ส่วนต่าง {fmt(Math.abs(backGap))} กก.
                      </Badge>
                    </>
                  ) : (
                    "รอ Foodiva รับเข้าตู้"
                  )}
                </span>
                <DocumentPrintButton
                  title={transportDocumentTitle.return}
                  number={back.values.transferNumber || back.id.slice(0, 8)}
                  label="พรีวิว / PDF"
                  preview
                  rows={transportDocumentRows(db, lot, back, "return")}
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
