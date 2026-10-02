"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Panel } from "@/components/atoms/Panel";
import { DocumentPrintButton } from "@/components/molecules/DocumentPrintButton";
import { EmptyState } from "@/components/molecules/EmptyState";
import { StatusTile } from "@/components/molecules/StatusTile";
import { NoteRow } from "@/components/organisms/shared/NoteRow";
import {
  packingListRows,
  purchaseOrderRows,
  smokeOrderPrintRows,
  transportDocumentRows,
  transportDocumentTitle,
} from "@/components/organisms/shared/documentRows";
import { lotLabel } from "@/components/organisms/shared/noteText";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { baht, qty } from "@/lib/format";
import {
  coreLotKinds,
  entries,
  lotInfo,
  missingKeys,
  missingText,
  poInfo,
  purchaseLots,
  shipments,
  sum,
  titles,
  visibleNotes,
  type Lot,
} from "@/lib/store";
import { cn } from "@/lib/utils";

/** The yellow mark of a figure that is not there yet. */
const Missing = ({ children }: { children: ReactNode }) => (
  <Badge tone="warning" className="border border-warning/40 py-0 font-medium">
    {children}
  </Badge>
);

/** A figure the web cannot work out until more is jotted. */
const unknown = <Missing>ยังคิดไม่ได้</Missing>;

const Small = ({ children }: { children: ReactNode }) => (
  <small className="text-caption font-normal text-text-secondary">
    {children}
  </small>
);

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-caption text-text-secondary">{label}</dt>
    <dd className="m-0 font-semibold [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

/** A weight; a negative one is red. */
const Kg = ({ value }: { value: number }) => (
  <span className={cn(value < 0 && "text-danger")}>{qty(value)} กก.</span>
);

/** Every Lot รมควัน and PO เนื้อ in a list at the left (a row under 1000px), the one picked at
 *  the right. A Lot: its four core notes and its PO link as tiles (a yellow one opens the
 *  form on that Lot), the figures worked out from its notes, its documents and its notes. A
 *  PO: what was ordered, what went to the smoker and what the seller still holds. */
export function LotsPage({ ws }: { ws: Workspace }) {
  const { db, account } = ws;
  const [picked, setPicked] = useState("");
  // Newest first.
  const lots = shipments(db).toReversed();
  const pos = purchaseLots(db).toReversed();
  // Nothing picked, or the one picked was deleted: the newest Lot.
  const lot =
    [...lots, ...pos].find((item) => item.id === picked) ?? lots[0] ?? pos[0];
  if (!lot)
    return (
      <EmptyState text="ยังไม่มี Lot และ PO เนื้อ · กด 「จดบันทึก」 เพื่อจด PO เนื้อ หรือ PO รมควัน" />
    );

  const item = (item: Lot, warning: boolean, status: string) => (
    <button
      key={item.id}
      type="button"
      data-lot={item.id}
      data-tone={warning ? "warning" : "ok"}
      aria-pressed={item.id === lot.id}
      onClick={() => setPicked(item.id)}
      className={cn(
        "group flex min-h-11 shrink-0 cursor-pointer flex-col rounded-md border-l-3 py-2 pr-3 pl-2.25 text-left -outline-offset-2 aria-pressed:outline-2 aria-pressed:outline-accent",
        warning ? "border-l-warning bg-warning-subtle" : "border-l-success",
      )}
    >
      <strong className="font-semibold whitespace-nowrap group-hover:text-accent">
        {item.poId}
      </strong>
      <span
        className={cn(
          "text-caption whitespace-nowrap",
          warning ? "text-warning" : "text-text-secondary",
        )}
      >
        {status}
      </span>
    </button>
  );
  const heading = (text: string) => (
    <h3 className="m-0 px-3 pt-2 pb-1 text-caption font-medium text-text-secondary max-[1000px]:hidden">
      {text}
    </h3>
  );

  return (
    <div className="grid grid-cols-[240px_minmax(0,1fr)] items-start gap-6 max-[1000px]:grid-cols-1 max-md:gap-4">
      <Panel
        flush
        aria-label="รายการ Lot และ PO เนื้อ"
        className="flex flex-col gap-0.5 p-2 max-[1000px]:flex-row max-[1000px]:overflow-x-auto"
      >
        {heading("Lot รมควัน")}
        {lots.map((lot) => {
          const { yellow } = lotInfo(db, lot.id);
          return item(
            lot,
            yellow > 0,
            yellow ? `${missingText} ${yellow} อย่าง` : "จดครบแล้ว",
          );
        })}
        {heading("PO เนื้อ")}
        {pos.map((po) => {
          const empty = missingKeys(
            entries(db, "purchase", po.id).at(-1)?.values ?? {},
          ).length;
          return item(
            po,
            empty > 0,
            empty
              ? `${missingText} ${empty} ช่อง`
              : `ฝากไว้ ${qty(poInfo(db, po.id).heldKg)} กก.`,
          );
        })}
      </Panel>
      <Panel flush aria-label={lot.poId} className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-5 last:border-b-0 max-md:px-4">
          {lot.kind ? (
            <LotHead ws={ws} lot={lot} />
          ) : (
            <PoHead ws={ws} po={lot} />
          )}
        </div>
        {visibleNotes(db, account)
          .filter((e) => e.lotId === lot.id)
          .map((e) => (
            <NoteRow key={e.id} entry={e} ws={ws} />
          ))}
      </Panel>
    </div>
  );
}

const title = "flex flex-wrap items-center gap-x-3 gap-y-2";
const facts =
  "m-0 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-3";

const Documents = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-caption text-text-secondary">เอกสาร</span>
    {children}
  </div>
);

function LotHead({ ws, lot }: { ws: Workspace; lot: Lot }) {
  const { db } = ws;
  const info = lotInfo(db, lot.id);
  const of = (kind: Parameters<typeof entries>[1]) => entries(db, kind, lot.id);
  // What a green tile says: the total jotted, or only that it is jotted when the figure is empty.
  const figure = {
    smokeOrder: sum(of("smokeOrder"), "rawKg"),
    dispatch: info.sentKg,
    central: info.backKg,
    smokingInvoice: info.fee,
  };
  const documents = [
    ...of("smokeOrder").map((e) => (
      <DocumentPrintButton
        key={e.id}
        label={`PO รมควัน ${e.values.orderNumber ?? ""}`}
        title="Smoke Service Purchase Order"
        number={e.values.orderNumber || lot.poId}
        rows={smokeOrderPrintRows(db, lot, e)}
      />
    )),
    ...of("packingList").map((e) => (
      <DocumentPrintButton
        key={e.id}
        label="Packing List"
        title="Packing List"
        number={lot.poId}
        rows={packingListRows(db, lot, e)}
      />
    )),
    ...[...of("dispatch"), ...of("return")].map((e) => (
      <DocumentPrintButton
        key={e.id}
        label={`${e.kind === "dispatch" ? "ใบขนส่งขาไป" : "ใบขนส่งขากลับ"} ${e.values.transferNumber ?? ""}`}
        title={transportDocumentTitle[e.kind as "dispatch" | "return"]}
        number={e.values.transferNumber || lot.poId}
        rows={transportDocumentRows(db, lot, e)}
      />
    )),
  ];
  return (
    <>
      <div className={title}>
        <h2 className="m-0 text-h2">{lot.poId}</h2>
        <Badge tone={info.complete ? "success" : "warning"}>
          {info.complete ? "จดครบแล้ว" : "ยังไม่ได้จดครบ"}
        </Badge>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2">
        {coreLotKinds.map((kind) => (
          <StatusTile
            key={kind}
            label={titles[kind]}
            value={
              info.missing.includes(kind)
                ? undefined
                : !figure[kind]
                  ? "จดแล้ว"
                  : `จดแล้ว · ${kind === "smokingInvoice" ? baht(figure[kind]) : `${qty(figure[kind])} กก.`}`
            }
            onJot={() => ws.jot({ kind, lotId: lot.id })}
          />
        ))}
        {of("dispatch").length > 0 && (
          <StatusTile
            label="เนื้อจาก PO ไหน"
            value={
              info.unlinked
                ? undefined
                : [
                    ...new Set(
                      of("dispatch").map((e) => lotLabel(db, e.values.poLotId)),
                    ),
                  ].join(", ")
            }
            onJot={() => info.unlinked && ws.edit(info.unlinked.id)}
          />
        )}
      </div>
      <dl className={facts}>
        <Fact label="ส่งไปรม">{qty(info.sentKg)} กก.</Fact>
        <Fact label="รับกลับ">
          {qty(info.backKg)} กก. <Small>{qty(info.boxes)} กล่องรมควัน</Small>
        </Fact>
        <Fact label="Yield">
          {info.yield === null ? unknown : `${qty(info.yield * 100)}%`}
        </Fact>
        <Fact label="ค่าเนื้อ">
          {info.linked ? baht(info.meatCost) : unknown}
        </Fact>
        <Fact label="ค่ารม">{info.fee ? baht(info.fee) : unknown}</Fact>
        <Fact label="ต้นทุนเนื้อต่อกล่อง">
          {info.meatPerBox === null ? unknown : baht(info.meatPerBox)}
        </Fact>
        <Fact label="ต้นทุนต่อกล่อง">
          {info.costPerBox === null ? (
            unknown
          ) : (
            <>
              {baht(info.costPerBox)} <Small>รวมแพ็กเกจ</Small>
            </>
          )}
        </Fact>
        <Fact label="สต๊อกกลางคงเหลือ">
          <Kg value={info.centralKg} />
        </Fact>
      </dl>
      <Documents>
        {documents.length ? (
          documents
        ) : (
          <Small>มีเมื่อจด PO รมควัน, Packing List หรือ ส่งไปรม</Small>
        )}
      </Documents>
    </>
  );
}

function PoHead({ ws, po }: { ws: Workspace; po: Lot }) {
  const { db } = ws;
  const purchase = entries(db, "purchase", po.id).at(-1);
  const v = purchase?.values ?? {};
  const info = poInfo(db, po.id);
  const empty = missingKeys(v);
  const none = <Missing>{missingText}</Missing>;
  return (
    <>
      <div className={title}>
        <h2 className="m-0 text-h2">{po.poId}</h2>
        <span className="text-body-sm text-text-secondary">
          PO เนื้อ{v.supplier ? ` · ${v.supplier}` : ""}
        </span>
        {empty.length > 0 && (
          <Badge tone="warning">
            {missingText} {empty.length} ช่อง
          </Badge>
        )}
      </div>
      <dl className={facts}>
        <Fact label="สั่งซื้อ">
          {v.orderedKg ? `${qty(Number(v.orderedKg))} กก.` : none}
        </Fact>
        <Fact label="ราคา / กก.">{v.price ? baht(Number(v.price)) : none}</Fact>
        <Fact label="มูลค่า">
          {v.orderedKg && v.price
            ? baht(Number(v.orderedKg) * Number(v.price))
            : unknown}
        </Fact>
        <Fact label="Invoice">
          {v.invoiceNo || <Small>เติมทีหลังได้</Small>}
        </Fact>
        <Fact label="ส่งไปรมแล้ว">{qty(info.sentKg)} กก.</Fact>
        <Fact label="ฝากไว้ที่ร้านขายเนื้อ">
          <Kg value={info.heldKg} />
        </Fact>
        <Fact label="Lot ที่ใช้เนื้อนี้">
          {info.lotIds.map((id) => lotLabel(db, id)).join(", ") || (
            <Small>ยังไม่มี</Small>
          )}
        </Fact>
      </dl>
      {purchase && (
        <Documents>
          <DocumentPrintButton
            label="PO ซื้อเนื้อ"
            title="Purchase Order"
            number={po.poId}
            rows={purchaseOrderRows(db, purchase)}
          />
        </Documents>
      )}
    </>
  );
}
