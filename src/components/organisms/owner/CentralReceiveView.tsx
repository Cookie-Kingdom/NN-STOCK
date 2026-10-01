"use client";

import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { LotProgressChips } from "@/components/molecules/LotProgressChips";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  entries,
  n,
  poMatched,
  producedBags,
  shipments,
  shipmentShares,
  type Database,
  type Lot,
} from "@/lib/store";
import { fmt } from "@/lib/format";
import type { ModalKind } from "@/lib/nav";

type Open = (kind: ModalKind, lotId?: string) => void;

const columns = [
  "Lot",
  "Foodiva รับจริง",
  "จำนวนกล่องรมควัน",
  "ใบขนส่งกลับ",
  "PO ซื้อ",
  "ยังไม่ได้จด",
  "การทำงาน",
];

/** RET-07: the purchase POs a batch drew from (its smoke PO's lines), or the "ยังไม่จับคู่"
 *  marker with the button that matches them. Advice only: receiving never waits on it. */
function PurchasePoCell({
  db,
  lot,
  open,
}: {
  db: Database;
  lot: Lot;
  open: Open;
}) {
  if (poMatched(db, lot.id))
    return (
      <span className="grid gap-1">
        {shipmentShares(db, lot).map((share) => (
          <span key={share.lotId}>
            <strong>{share.poId}</strong> ×{" "}
            {share.requestedKg > 0 ? (
              `${fmt(share.requestedKg)} กก.`
            ) : (
              // Traced to the PO, but no kg: the cost still says "ยังไม่จับคู่" (lotCost).
              <MissingMark />
            )}
          </span>
        ))}
      </span>
    );
  const order = entries(db, "smokeOrder", lot.id).length > 0;
  return (
    <span className="grid justify-items-start gap-1">
      <Badge tone="neutral">
        {order ? "ยังไม่จับคู่ PO ซื้อ" : "ยังไม่มี PO รมควัน"}
      </Badge>
      {/* No smoke PO yet: its form (preselected on this batch) holds the same lines. */}
      <Button
        variant="table"
        onClick={() => open(order ? "matchPo" : "smokeOrder", lot.id)}
      >
        {order ? "จับคู่ PO ซื้อ" : "ออก PO รมควัน"}
      </Button>
    </span>
  );
}

export function CentralReceiveView({ db, open }: { db: Database; open: Open }) {
  // RET-06: every batch not yet in central stock; no truck home or Foodiva receipt needed.
  const readyToReceive = shipments(db).filter(
    (lot) => !entries(db, "central", lot.id).length,
  );
  // RET-07: already counted in, still not traced to a purchase PO.
  const unmatched = shipments(db).filter(
    (lot) =>
      entries(db, "central", lot.id).length > 0 && !poMatched(db, lot.id),
  );
  return (
    <>
      <SectionHeading
        title="Owner รับของจาก Foodiva เข้าสต๊อกกลาง"
        description="ทุกชุดที่ยังไม่เข้าสต๊อกกลาง · รับเข้าได้ทุกเมื่อ ถ้า Foodiva ยืนยันรับเข้าตู้แล้วระบบจะเทียบน้ำหนักให้ · จับคู่ชุดรมควันกับ PO ซื้อเพื่อย้อนดูที่มาของเนื้อที่ส่งสาขา"
      />
      <DataTable
        title="ชุดที่ยังไม่เข้าสต๊อกกลาง"
        columns={columns}
        rowKeys={readyToReceive.map((lot) => lot.id)}
        rows={readyToReceive.map((lot) => {
          const back = entries(db, "return", lot.id).at(-1);
          const received = entries(db, "foodivaReturnReceive", lot.id).at(-1);
          return [
            lot.id,
            received
              ? `${fmt(n(received.values, "receivedKg"))} กก.`
              : "ยังไม่ยืนยันรับ",
            `${received?.values.receivedBags || producedBags(db, lot.id)} กล่องรมควัน`,
            back
              ? `${back.values.returnDate || "ยังไม่ระบุวัน"} · ${back.values.plate || "ยังไม่ระบุรถ"}`
              : "ยังไม่มีใบขนส่งขากลับ",
            <PurchasePoCell key="po" db={db} lot={lot} open={open} />,
            <LotProgressChips
              key="progress"
              db={db}
              lotId={lot.id}
              steps={["smoke", "return", "foodivaReturnReceive", "matchPo"]}
            />,
            <Button
              variant="table"
              key={lot.id}
              onClick={() => open("central", lot.id)}
            >
              รับเข้าสต๊อกกลาง
            </Button>,
          ];
        })}
      />
      {!readyToReceive.length && (
        <Notice tone="success">ทุกชุดรับเข้าสต๊อกกลางแล้ว</Notice>
      )}
      {unmatched.length > 0 && (
        <DataTable
          title="เข้าสต๊อกกลางแล้ว · ยังไม่จับคู่ PO ซื้อ"
          columns={["Lot", "สต๊อกกลาง", "PO ซื้อ"]}
          rowKeys={unmatched.map((lot) => lot.id)}
          rows={unmatched.map((lot) => [
            `${lot.poId} · ${lot.id}`,
            `${fmt(n(entries(db, "central", lot.id).at(-1)!.values, "centralKg"))} กก.`,
            <PurchasePoCell key="po" db={db} lot={lot} open={open} />,
          ])}
        />
      )}
    </>
  );
}
