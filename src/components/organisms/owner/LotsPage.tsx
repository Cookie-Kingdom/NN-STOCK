"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { CountPill } from "@/components/atoms/CountPill";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Panel } from "@/components/atoms/Panel";
import { DocumentPrintButton } from "@/components/molecules/DocumentPrintButton";
import { EmptyState } from "@/components/molecules/EmptyState";
import { Notice } from "@/components/molecules/Notice";
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
import { baht, dateLabel, fmt, qty } from "@/lib/format";
import {
  dispatchLines,
  entries,
  invoiceOf,
  kindsForPage,
  lotInfo,
  missingKeys,
  missingText,
  poInfo,
  poTerms,
  purchaseLots,
  shipments,
  titles,
  visibleNotes,
  type Entry,
  type Lot,
  type NoteKind,
  type Round,
  type RoundKind,
} from "@/lib/store";
import { cn } from "@/lib/utils";

/** A figure the web cannot work out until more is jotted. */
const unknown = <MissingMark>ยังคิดไม่ได้</MissingMark>;

const Small = ({ children }: { children: ReactNode }) => (
  <small className="text-caption font-normal text-text-secondary">
    {children}
  </small>
);

const Fact = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-caption text-text-secondary">{label}</dt>
    <dd className="m-0 font-semibold [overflow-wrap:anywhere] tabular-nums">
      {children}
    </dd>
  </div>
);

/** A weight; a negative one is red. */
const Kg = ({ value }: { value: number }) => (
  <span className={cn(value < 0 && "text-danger")}>{qty(value)} กก.</span>
);

/** The page's props, plus what this page lets the account jot. */
type Props = { ws: Workspace; can: (kind: NoteKind) => boolean };

/** Every PO รมควัน and PO เนื้อ in a list at the left (a row under 1000px), the one picked at
 *  the right. Every form of the page is a button where it belongs: the two POs at the top, a
 *  round and the Chef House invoice on a PO รมควัน, each round's three steps in its card, the
 *  waste and the Foodiva invoice on a PO เนื้อ. A PO flagged `old` (carried over from the old
 *  workbook) is on no page. */
export function LotsPage({ ws }: { ws: Workspace }) {
  const { db, account } = ws;
  const [picked, setPicked] = useState(ws.focusLot);
  const kinds = kindsForPage(account, "lots");
  const can = (kind: NoteKind) => kinds.includes(kind);
  // Newest first.
  const mine = (lot: Lot) => !lot.old;
  const lots = shipments(db).filter(mine).toReversed();
  const pos = purchaseLots(db).filter(mine).toReversed();
  // Nothing picked, or the one picked was deleted: the newest PO รมควัน.
  const lot =
    [...lots, ...pos].find((item) => item.id === picked) ?? lots[0] ?? pos[0];

  const actions = (can("purchase") || can("smokeOrder")) && (
    <div className="flex flex-wrap gap-2 max-sm:[&>button]:flex-1">
      {can("purchase") && (
        <Button variant="primary" onClick={() => ws.jot({ kind: "purchase" })}>
          + สร้าง PO เนื้อ
        </Button>
      )}
      {can("smokeOrder") && (
        <Button
          variant="primary"
          onClick={() => ws.jot({ kind: "smokeOrder" })}
        >
          + สร้าง PO รมควัน
        </Button>
      )}
    </div>
  );
  if (!lot)
    return (
      <div className="flex flex-col gap-4">
        {actions}
        <EmptyState text="ยังไม่มี PO รมควันและ PO เนื้อ สร้างได้จากปุ่มด้านบน" />
      </div>
    );

  const item = (item: Lot, warning: boolean, status: ReactNode) => (
    <button
      key={item.id}
      type="button"
      data-lot={item.id}
      data-tone={warning ? "warning" : "ok"}
      aria-pressed={item.id === lot.id}
      onClick={() => setPicked(item.id)}
      className={cn(
        "group flex min-h-11 shrink-0 cursor-pointer flex-col rounded-md border-l-3 py-2 pr-3 pl-2.25 text-left -outline-offset-2 outline-transparent transition-[background-color,outline-color] duration-(--motion-fast) ease-(--ease-standard) aria-pressed:outline-2 aria-pressed:outline-accent",
        warning ? "border-l-warning bg-warning-subtle" : "border-l-success",
      )}
    >
      <strong className="font-semibold whitespace-nowrap transition-colors duration-(--motion-fast) ease-(--ease-standard) group-hover:text-accent">
        {item.poId}
      </strong>
      <span
        className={cn(
          "flex items-center gap-1.5 text-caption whitespace-nowrap tabular-nums",
          warning ? "text-warning" : "text-text-secondary",
        )}
      >
        {status}
      </span>
    </button>
  );
  const notes = visibleNotes(db, account).filter((e) => e.lotId === lot.id);
  const heading = (text: string) => (
    <h3 className="m-0 px-3 pt-2 pb-1 text-caption font-medium text-text-secondary max-[1000px]:hidden">
      {text}
    </h3>
  );

  return (
    <div className="flex flex-col gap-4">
      {actions}
      <div className="grid grid-cols-[240px_minmax(0,1fr)] items-start gap-6 max-[1000px]:grid-cols-1 max-md:gap-4">
        <Panel
          flush
          aria-label="รายการ PO รมควัน และ PO เนื้อ"
          className="flex flex-col gap-0.5 p-2 max-[1000px]:flex-row max-[1000px]:overflow-x-auto"
        >
          {heading("PO เนื้อ")}
          {pos.map((po) => {
            const empty = missingKeys(
              entries(db, "purchase", po.id).at(-1)?.values ?? {},
            ).length;
            const info = poInfo(db, po.id);
            return item(
              po,
              empty > 0 || info.wastePending,
              <>
                {empty
                  ? `${missingText} ${empty} ช่อง`
                  : `ฝากไว้ ${qty(info.heldKg)} กก.`}
                {info.wastePending && (
                  <span
                    className="size-2 rounded-full bg-warning"
                    role="img"
                    aria-label="รอรับ Waste"
                  />
                )}
              </>,
            );
          })}
          {heading("PO รมควัน")}
          {lots.map((lot) => {
            const { yellow, remainingKg } = lotInfo(db, lot.id);
            return item(
              lot,
              yellow > 0,
              <>
                {remainingKg < 0
                  ? `เกิน ${qty(-remainingKg)} กก.`
                  : `เหลือ ${qty(remainingKg)} กก.`}
                {yellow > 0 && (
                  <CountPill aria-label={`${missingText} ${yellow} อย่าง`}>
                    {yellow}
                  </CountPill>
                )}
              </>,
            );
          })}
        </Panel>
        {/* key: picking another PO re-mounts the panel, so its content fades in.
            A wide screen: the PO's notes sit beside its figures, not under them. */}
        <Panel
          key={lot.id}
          flush
          aria-label={lot.poId}
          className="animate-fade-in overflow-hidden min-[1700px]:grid min-[1700px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]"
        >
          <div className="flex flex-col gap-4 border-b border-border p-5 last:border-b-0 max-md:px-4 min-[1700px]:border-r min-[1700px]:border-b-0 min-[1700px]:last:col-span-full min-[1700px]:last:border-r-0">
            {lot.kind ? (
              <LotHead ws={ws} can={can} lot={lot} />
            ) : (
              <PoHead ws={ws} can={can} po={lot} />
            )}
          </div>
          {notes.length > 0 && (
            <div className="min-w-0">
              {notes.map((e) => (
                <NoteRow key={e.id} entry={e} ws={ws} dated />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

const title = "flex flex-wrap items-center gap-x-3 gap-y-2";
const facts =
  "m-0 grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-x-5 gap-y-3";
const section = "m-0 text-body font-semibold";
const buttons = "flex flex-wrap gap-2 max-sm:[&>button]:flex-1";

const Documents = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2">
    <span className="text-caption text-text-secondary">เอกสาร</span>
    {children}
  </div>
);

/** A jotted thing as a green button that opens its edit. */
function Jotted({
  label,
  onEdit,
  children,
}: {
  label: string;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      data-tone="ok"
      onClick={onEdit}
      className="flex min-h-11 min-w-0 cursor-pointer flex-col gap-0.5 rounded-md border border-success/30 bg-success-subtle px-3 py-2.5 text-left text-success transition-colors duration-(--motion-fast) ease-(--ease-standard) hover:border-success focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
    >
      <strong className="text-body-sm font-semibold">{label}</strong>
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-caption tabular-nums">
        {children}
      </span>
      <span className="text-caption text-text-secondary">กดเพื่อแก้ไข</span>
    </button>
  );
}

/** "ตรง" when the weight received is the weight sent, else how far off. */
const diffBadge = (diff: number) =>
  Math.abs(diff) < 0.005 ? (
    <Badge tone="success">ตรง</Badge>
  ) : (
    <Badge tone="warning">
      {diff < 0 ? "−" : "+"}
      {qty(Math.abs(diff))} กก.
    </Badge>
  );

const stepLabel: Record<RoundKind, string> = {
  cmReceive: "รับที่ Chef House",
  smoked: "หลังรมควัน",
  return: "ส่งกลับ",
};

/** One dispatch round: its number, date, weight and PO เนื้อ lines, then its three steps,
 *  each a button: "+ จด…" when missing, its figures (tap to edit) when jotted. */
function RoundCard({
  ws,
  can,
  lot,
  round,
  index,
}: Props & { lot: Lot; round: Round; index: number }) {
  const { db } = ws;
  const { dispatch } = round;
  const latest = (kind: RoundKind) =>
    entries(db, kind, lot.id)
      .filter((e) => e.values.dispatchId === dispatch.id)
      .at(-1);
  const step = (kind: RoundKind, figures: ReactNode) => {
    const entry = latest(kind);
    return entry ? (
      <Jotted
        key={kind}
        label={stepLabel[kind]}
        onEdit={() => ws.edit(entry.id)}
      >
        {figures}
      </Jotted>
    ) : (
      <StatusTile
        key={kind}
        label={stepLabel[kind]}
        onJot={
          can(kind)
            ? () =>
                ws.jot({
                  kind,
                  lotId: lot.id,
                  values: { dispatchId: dispatch.id },
                })
            : undefined
        }
        jotText={`+ จด${titles[kind]}`}
      />
    );
  };
  const lines = dispatchLines(dispatch.values);
  return (
    <li
      data-round={dispatch.id}
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <strong className="font-semibold">รอบ {index + 1}</strong>
          <span className="text-body-sm text-text-secondary">
            {round.number} · {dateLabel(dispatch.date)}
          </span>
        </div>
        <Button variant="text" onClick={() => ws.edit(dispatch.id)}>
          แก้ไขรอบส่ง
        </Button>
      </div>
      <p className="m-0 text-body-sm tabular-nums">
        ส่ง <strong>{qty(round.sentKg)} กก.</strong>
        {lines.length > 0 && (
          <span className="text-text-secondary">
            {" "}
            · จาก{" "}
            {lines
              .map(
                (line) => `${lotLabel(db, line.poLotId)} ${qty(line.kg)} กก.`,
              )
              .join(", ")}
          </span>
        )}
      </p>
      <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
        {step(
          "cmReceive",
          round.received ? (
            <>
              {qty(round.receivedKg)} กก. {diffBadge(round.receiveDiffKg ?? 0)}
            </>
          ) : (
            <MissingMark />
          ),
        )}
        {step(
          "smoked",
          round.wasteKg === null ? (
            <MissingMark />
          ) : (
            <>
              {qty(round.smokedKg)} กก.
              {round.boxes > 0 && ` · ${qty(round.boxes)} กล่อง`}
              <span>
                Waste {qty(round.wasteKg)} กก.
                {round.wastePct !== null && ` (${qty(round.wastePct)}%)`}
              </span>
            </>
          ),
        )}
        {step(
          "return",
          <>
            {qty(round.returnKg)} กก. · ค่าขนส่ง {baht(round.shippingFee)}
          </>,
        )}
      </div>
    </li>
  );
}

function LotHead({ ws, can, lot }: Props & { lot: Lot }) {
  const { db } = ws;
  const info = lotInfo(db, lot.id);
  const of = (kind: Parameters<typeof entries>[1]) => entries(db, kind, lot.id);
  const order = of("smokeOrder").at(-1);
  const invoice = invoiceOf(db, lot.id);
  const over = info.remainingKg < 0;
  const share = info.capacityKg ? info.sentKg / info.capacityKg : 0;
  // The waste % over the rounds weighed so far.
  const weighed = info.rounds.filter((round) => round.wasteKg !== null);
  const base = weighed.reduce((a, round) => a + round.wasteBaseKg, 0);
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
  const extras = (["packingList", "foodivaReturnReceive"] as const).filter(can);
  return (
    <>
      <div className={title}>
        <h2 className="m-0 text-h2">{lot.poId}</h2>
        <span className="text-body-sm text-text-secondary">
          PO รมควัน{order?.values.smoker ? ` · ${order.values.smoker}` : ""}
        </span>
        <Badge tone={info.complete ? "success" : "warning"}>
          {info.complete ? "จดครบแล้ว" : `${missingText} ${info.yellow} อย่าง`}
        </Badge>
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="m-0 text-body-sm tabular-nums">
          ส่งแล้ว <strong>{qty(info.sentKg)}</strong> / {qty(info.capacityKg)}{" "}
          กก. ·{" "}
          {over ? (
            <strong className="text-warning">
              เกิน {qty(-info.remainingKg)} กก.
            </strong>
          ) : (
            <>เหลือ {qty(info.remainingKg)} กก.</>
          )}
        </p>
        <div
          role="progressbar"
          aria-label="น้ำหนักที่ส่งไปรมแล้ว"
          aria-valuemin={0}
          aria-valuemax={info.capacityKg}
          aria-valuenow={info.sentKg}
          className="h-2 overflow-hidden rounded-full bg-surface-sunken"
        >
          <div
            className={cn(
              "h-full rounded-full",
              over ? "bg-warning" : "bg-accent",
            )}
            style={{ width: `${Math.min(100, share * 100)}%` }}
          />
        </div>
      </div>
      <div className={buttons}>
        {can("dispatch") && (
          <Button
            variant="primary"
            onClick={() => ws.jot({ kind: "dispatch", lotId: lot.id })}
          >
            + ส่งไปรมควัน (รอบใหม่)
          </Button>
        )}
        {invoice ? (
          <Button variant="secondary" onClick={() => ws.edit(invoice.id)}>
            แก้ไข Invoice
            <Small>
              {invoice.values.invoiceNumber || "Chef House"} · {baht(info.fee)}
            </Small>
          </Button>
        ) : (
          can("smokingInvoice") && (
            // Yellow: the invoice is among what the heading counts as not jotted.
            <Button
              variant="secondary"
              data-tone="warning"
              className="border-warning/40 bg-warning-subtle text-warning hover:border-warning hover:bg-warning-subtle"
              onClick={() => ws.jot({ kind: "smokingInvoice", lotId: lot.id })}
            >
              + บันทึก Invoice Chef House
            </Button>
          )
        )}
      </div>
      {info.unlinked && (
        <StatusTile
          label="PO เนื้อที่ใช้"
          onJot={() => ws.edit(info.unlinked!.id)}
          jotText="ยังไม่ได้เลือก PO เนื้อ"
        />
      )}
      <h3 className={section}>รอบส่ง ({info.rounds.length})</h3>
      {info.rounds.length ? (
        <ol className="m-0 flex list-none flex-col gap-3 p-0">
          {info.rounds.map((round, index) => (
            <RoundCard
              key={round.dispatch.id}
              ws={ws}
              can={can}
              lot={lot}
              round={round}
              index={index}
            />
          ))}
        </ol>
      ) : (
        <Small>
          {'ยังไม่มีรอบส่ง เพิ่มได้จากปุ่ม "+ ส่งไปรมควัน (รอบใหม่)"'}
        </Small>
      )}
      <h3 className={section}>สรุปทั้ง PO</h3>
      <dl className={facts}>
        <Fact label="น้ำหนักรับที่ Chef House">{qty(info.receivedKg)} กก.</Fact>
        <Fact label="น้ำหนักหลังรมควัน">
          {qty(info.backKg)} กก. <Small>{qty(info.boxes)} กล่องรมควัน</Small>
        </Fact>
        <Fact label="Waste">
          {base
            ? `${qty(info.wasteKg)} กก. (${qty((info.wasteKg / base) * 100)}%)`
            : unknown}
        </Fact>
        <Fact label="Yield">
          {info.yield === null ? unknown : `${qty(info.yield * 100)}%`}
        </Fact>
        <Fact label="ค่าเนื้อ">
          {info.linked ? baht(info.meatCost) : unknown}
        </Fact>
        <Fact label="ค่ารม">{info.fee ? baht(info.fee) : unknown}</Fact>
        <Fact label="ค่าขนส่งรวม">{baht(info.shippingFee)}</Fact>
        <Fact label="ต้นทุนต่อ กก.">
          {info.costPerKg === null ? unknown : `฿${fmt(info.costPerKg)}`}
        </Fact>
        <Fact label="ต้นทุนต่อกล่อง">
          {info.costPerBox === null ? (
            unknown
          ) : (
            <>
              ฿{fmt(info.costPerBox)} <Small>รวมแพ็กเกจ</Small>
            </>
          )}
        </Fact>
        <Fact label="คลังกลางคงเหลือ">
          <Kg value={info.centralKg} />
        </Fact>
      </dl>
      {extras.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-text-secondary">จดเพิ่มได้</span>
          {extras.map((kind) => (
            <Button
              key={kind}
              variant="table-secondary"
              onClick={() => ws.jot({ kind, lotId: lot.id })}
            >
              + {titles[kind]}
            </Button>
          ))}
        </div>
      )}
      <Documents>
        {documents.length ? (
          documents
        ) : (
          <Small>จะขึ้นเมื่อมี PO รมควัน, Packing List หรือรอบส่ง</Small>
        )}
      </Documents>
    </>
  );
}

function PoHead({ ws, can, po }: Props & { po: Lot }) {
  const { db } = ws;
  const purchase = entries(db, "purchase", po.id).at(-1);
  const v = purchase?.values ?? {};
  const info = poInfo(db, po.id);
  const terms = poTerms(db, po.id);
  const invoice = info.invoice;
  const received = entries(db, "ownerWasteReceive", po.id).at(-1);
  const empty = missingKeys(v);
  const none = <MissingMark />;
  // A figure the invoice gives wins over the PO's (poTerms).
  const byInvoice = (key: string) =>
    invoice?.values[key]?.trim() ? <Small>(ตาม Invoice)</Small> : null;
  const typed = (key: string) => !!(invoice?.values[key] || v[key])?.trim();
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
        <Fact label="เนื้อ">
          {typed("orderedKg") ? `${qty(terms.meatKg)} กก.` : none}{" "}
          {byInvoice("orderedKg")}
        </Fact>
        <Fact label="Waste">
          {qty(terms.wasteKg)} กก. {byInvoice("wasteKg")}
        </Fact>
        <Fact label="ราคา / กก.">
          {typed("price") ? baht(terms.price) : none} {byInvoice("price")}
        </Fact>
        <Fact label="มูลค่า">
          {terms.meatKg && terms.price
            ? baht(terms.meatKg * terms.price)
            : unknown}
        </Fact>
        <Fact label="น้ำหนักที่ส่งไปรมแล้ว">{qty(info.sentKg)} กก.</Fact>
        <Fact label="เนื้อที่ฝากไว้กับผู้ขาย">
          <Kg value={info.heldKg} />
        </Fact>
        <Fact label="PO รมควันที่ใช้เนื้อนี้">
          {info.lotIds.map((id) => lotLabel(db, id)).join(", ") || (
            <Small>ยังไม่มี</Small>
          )}
        </Fact>
      </dl>
      {info.wastePending ? (
        <Notice
          tone="warning"
          className="my-0 max-sm:flex-col max-sm:items-stretch"
          action={
            can("ownerWasteReceive") && (
              <Button
                variant="primary"
                onClick={() =>
                  ws.jot({
                    kind: "ownerWasteReceive",
                    lotId: po.id,
                    values: { receivedKg: String(info.wasteKg) },
                  })
                }
              >
                รับ Waste แล้ว
              </Button>
            )
          }
        >
          <strong className="tabular-nums">
            รอรับ Waste {qty(info.wasteKg)} กก.
          </strong>
        </Notice>
      ) : (
        received && (
          <Jotted label="Waste" onEdit={() => ws.edit(received.id)}>
            รับ Waste แล้ว {qty(info.wasteReceivedKg)} กก. ·{" "}
            {dateLabel(received.date)}
          </Jotted>
        )
      )}
      <h3 className={section}>Invoice Foodiva</h3>
      {invoice ? (
        <InvoiceSummary entry={invoice} onEdit={() => ws.edit(invoice.id)} />
      ) : can("meatInvoice") ? (
        <div className={buttons}>
          <Button
            variant="secondary"
            onClick={() => ws.jot({ kind: "meatInvoice", lotId: po.id })}
          >
            + บันทึก Invoice Foodiva
          </Button>
        </div>
      ) : (
        <Small>ยังไม่มี Invoice</Small>
      )}
      {purchase && (
        <Documents>
          <DocumentPrintButton
            label="PO เนื้อ"
            title="Purchase Order"
            number={po.poId}
            rows={purchaseOrderRows(db, purchase)}
          />
        </Documents>
      )}
    </>
  );
}

const InvoiceSummary = ({
  entry,
  onEdit,
}: {
  entry: Entry;
  onEdit: () => void;
}) => (
  <Jotted label={`Invoice ${entry.values.invoiceNumber || ""}`} onEdit={onEdit}>
    {entry.values.netPayable ? (
      baht(Number(entry.values.netPayable))
    ) : (
      <MissingMark />
    )}
    {entry.values.invoiceDate && ` · ${dateLabel(entry.values.invoiceDate)}`}
  </Jotted>
);
