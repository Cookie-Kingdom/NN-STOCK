"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { PackingListDialog } from "@/components/organisms/shared/PackingListDialog";
import { shipmentChain, type Database, type Lot } from "@/lib/store";
import { fmt } from "@/lib/format";

const kg = (value: number | undefined) =>
  value === undefined ? undefined : `${fmt(value)} กก.`;

/** Actual vs what the leg before it sent; a match is quiet, a gap is flagged. */
function Gap({ actual, sent }: { actual?: number; sent?: number }) {
  if (actual === undefined || sent === undefined) return null;
  const gap = actual - sent;
  return Math.abs(gap) > 0.001 ? (
    <Badge tone="danger">{`ส่วนต่าง ${gap > 0 ? "+" : "−"}${fmt(Math.abs(gap))} กก.`}</Badge>
  ) : (
    <Badge tone="success">ตรงกับที่ส่ง</Badge>
  );
}

/** One shipment end to end: purchase POs → truck → Chef House → กล่องรมควัน → back to Foodiva.
 *  Owner only: it names purchase POs. */
export function ShipmentChainCard({ db, lot }: { db: Database; lot: Lot }) {
  const [showList, setShowList] = useState(false);
  const chain = shipmentChain(db, lot);
  const steps: [string, ReactNode, ReactNode?][] = [
    [
      "PO ซื้อ (Request)",
      <span key="lines" className="grid">
        {chain.lines.map((line) => (
          <span
            key={line.lotId}
          >{`${line.poId} × ${fmt(line.requestedKg)} กก.`}</span>
        ))}
      </span>,
      `รวม ${fmt(chain.requestedKg)} กก.`,
    ],
    ["ส่งไป Chef House", kg(chain.sentKg)],
    [
      "Chef House รับจริง",
      kg(chain.chefReceivedKg),
      <Gap key="chef" actual={chain.chefReceivedKg} sent={chain.sentKg} />,
    ],
    [
      "รมควันเสร็จ",
      chain.smokedKg === undefined
        ? undefined
        : `${chain.smokedBoxes} กล่องรมควัน · ${fmt(chain.smokedKg)} กก.`,
    ],
    ["ส่งกลับ Foodiva", kg(chain.returnKg)],
    [
      "Foodiva รับจริง",
      chain.foodivaKg === undefined
        ? undefined
        : `${fmt(chain.foodivaKg)} กก. · ${chain.foodivaBoxes} กล่องรมควัน`,
      <Gap key="foodiva" actual={chain.foodivaKg} sent={chain.returnKg} />,
    ],
  ];
  return (
    <section className="grid gap-3 border-b border-border bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{`สายการส่ง ${lot.poId}`}</strong>
        <Button variant="table" onClick={() => setShowList(true)}>
          ดู Packing List
        </Button>
      </div>
      <ol className="m-0 grid list-none grid-cols-6 gap-2 p-0 max-lg:grid-cols-3 max-md:grid-cols-1">
        {steps.map(([label, value, extra], index) => (
          <li
            key={label}
            className="grid content-start justify-items-start gap-1 rounded-lg border border-border bg-bg p-3 text-body-sm"
          >
            <small className="text-caption text-text-secondary">{`${index + 1}. ${label}`}</small>
            <strong className="tabular-nums">{value ?? "รอดำเนินการ"}</strong>
            {value !== undefined && extra}
          </li>
        ))}
      </ol>
      {showList && (
        <PackingListDialog
          db={db}
          lotId={lot.id}
          onClose={() => setShowList(false)}
        />
      )}
    </section>
  );
}
