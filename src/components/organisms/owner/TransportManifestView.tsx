"use client";

import { Badge } from "@/components/atoms/Badge";
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
  readyForChefHouse,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const columns = [
  "เลข PO",
  "Lot",
  "ขาไป · Foodiva → Chef House",
  "เทียบน้ำหนัก Owner",
  "ขากลับ · Chef House → Foodiva",
  "การทำงาน",
];

export function TransportManifestView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  return (
    <>
      <SectionHeading
        title="ใบขนส่งเนื้อ"
        description="Owner เรียกรถและบันทึกใบขนส่งทั้ง Foodiva → Chef House และ Chef House → Foodiva"
      />
      <DataTable
        title="รายการขนส่งตาม Lot"
        columns={columns}
        rowKeys={db.lots.map((lot) => lot.id)}
        rows={db.lots.map((lot) => {
          const back = entries(db, "return", lot.id).at(-1);
          const outbound = entries(db, "dispatch", lot.id).at(-1);
          const chefReceive = entries(db, "cmReceive", lot.id).at(-1);
          // Compare against what left Foodiva, not the invoice total: the waste share stays behind for Owner.
          const foodivaKg = outbound
            ? n(outbound.values, "dispatchKg")
            : readyForChefHouse(db, lot.id);
          const chefKg = n(chefReceive?.values || {}, "receivedKg");
          const difference = chefKg - foodivaKg;
          return [
            lot.poId,
            lot.id,
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
              `พร้อมส่งเชียงใหม่ ${fmt(readyForChefHouse(db, lot.id))} กก. · รอทำใบขนส่ง`
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
              context="transport"
              open={open}
            />,
          ];
        })}
      />
    </>
  );
}
