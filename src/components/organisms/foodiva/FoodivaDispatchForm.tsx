"use client";

import { useState } from "react";
import { Check, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { PackingListForm } from "@/components/organisms/shared/PackingListForm";
import { usePrefill } from "@/components/organisms/shared/usePrefill";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { nextTimeSlot } from "@/lib/forms";
import { fmt } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import { lastLabel, lastValues, type Prefill } from "@/lib/prefill";
import {
  dispatchWithPackingList,
  entries,
  n,
  packingListBoxes,
  poRemainingKg,
  shipmentLines,
  type Database,
  type Role,
  type Values,
} from "@/lib/store";

const cell = "border-b border-border px-4.5 py-3 align-middle max-md:px-2.5";
const headCell =
  "border-b border-border-strong bg-surface-sunken px-4.5 py-3 text-left text-caption font-semibold text-text-secondary max-md:px-2.5";

const truckKeys = ["trip", "vehicleType", "plate", "driverName", "driverPhone"];

/** The truck fields of the newest transport document, all from that one trip so the
 *  plate and driver stay a pair. */
function lastTruck(db: Database): Prefill {
  const last = lastValues(db, "dispatch");
  const out: Prefill = { values: {}, sources: {} };
  if (!last) return out;
  for (const key of truckKeys) {
    if (!last.values[key]?.trim()) continue;
    out.values[key] = last.values[key];
    out.sources[key] = { label: lastLabel(last.date) };
  }
  return out;
}

/**
 * Foodiva's outbound transport document for a shipment batch (SHP-01): one the Owner's
 * smoke PO opened, one without a smoke PO yet, or a new one (`lotId === ""`, the save
 * opens the batch). The Packing List is filled in a dialog on top but not saved there:
 * "บันทึกใบขนส่ง" saves both in one go, the transport document first
 * (`dispatchWithPackingList`).
 */
export function FoodivaDispatchForm({
  db,
  role,
  lotId,
  date,
  onDate,
  onClose,
  onSaved,
}: {
  db: Database;
  /** The signed-in account's role; the Owner's save is stamped Foodiva's (M0). */
  role: Role;
  /** The shipment batch, or `""` to open a new one with this transport document. */
  lotId: string;
  date: string;
  onDate: (date: string) => void;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const lot = lotId ? db.lots.find((l) => l.id === lotId) : undefined;
  const requestedKg = n(lot?.values ?? {}, "requestedKg");
  // The truck usually repeats: trip, vehicle and driver start from the last transport document.
  const { values, sources, set } = usePrefill(() => ({
    base: {
      // SHP-01: what Foodiva types; it starts at the smoke PO's total when there is one.
      dispatchKg: requestedKg ? String(requestedKg) : "",
      pickupDate: date,
      pickupTime: nextTimeSlot(),
      origin: "กรุงเทพฯ",
      destination: "เชียงใหม่",
      trip: "เที่ยวเดียว",
      vehicleType: "รถห้องเย็น 6 ล้อ",
      plate: "",
      driverName: "",
      driverPhone: "",
    },
    prefill: lastTruck(db),
  }));
  // ข้อ 12: the last pickup times used, one click each.
  const recentTimes = [
    ...new Set(
      entries(db, "dispatch")
        .map((entry) => entry.values.pickupTime)
        .filter(Boolean)
        .reverse(),
    ),
  ].slice(0, 3);
  const [packingOpen, setPackingOpen] = useState(false);
  const [draft, setDraft] = useState<Values>();
  const { error, setError, run, saving } = useSaveMutation(
    "บันทึกใบขนส่งไม่สำเร็จ",
  );

  const lines = (lot ? shipmentLines(lot) : []).map((line) => ({
    ...line,
    lot: db.lots.find((po) => po.id === line.lotId),
  }));
  const total = requestedKg;
  const boxes = packingListBoxes(draft?.boxes);
  // The list's own figure, not the box total: Foodiva types Sliced Weight Net.
  const slicedNetKg = n(draft ?? {}, "slicedNetKg");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    // Left blank, the kg sent is the Packing List's Sliced Weight Net.
    const trip = {
      ...values,
      dispatchKg: values.dispatchKg.trim() || draft.slicedNetKg || "",
    };
    const next = await run(() =>
      dispatchWithPackingList(latestDatabase(), lotId, trip, draft, date, role),
    );
    if (next) onSaved(next);
  }

  return (
    <Dialog
      overline={`${date} · Foodiva · ${lot?.poId ?? "ชุดใหม่"}`}
      title="ทำใบขนส่งไปเชียงใหม่ (Chef House)"
      size="wide"
      onClose={onClose}
    >
      <DialogForm noValidate onSubmit={submit}>
        <DialogBody>
          <WorkingDateField asField date={date} onDate={onDate} />
          <Notice>
            {lines.length
              ? "เที่ยวนี้มาจาก PO รมควันของ Owner — PO ซื้อ และน้ำหนักรายใบด้านล่างแก้ที่นี่ไม่ได้ ถ้าไม่ตรงให้แจ้ง Owner"
              : lot
                ? "ชุดนี้ยังไม่มี PO รมควัน — ทำใบขนส่งและ Packing List ได้เลย Owner ออก PO รมควันให้ชุดนี้ภายหลังได้"
                : "เปิดชุดรมควันใหม่ — ระบบออกเลขที่การส่งให้เมื่อบันทึก Owner ออก PO รมควันให้ชุดนี้ภายหลังได้"}
          </Notice>

          {lines.length > 0 && (
            <Panel
              as="div"
              flush
              className="my-5.5 max-w-full overflow-auto overscroll-x-contain"
            >
              <table className="w-full border-separate border-spacing-0 tabular-nums [&_tbody_tr:last-child_td]:border-b-0">
                <thead>
                  <tr>
                    <th className={headCell}>PO ซื้อ</th>
                    <th className={headCell}>Lot</th>
                    <th className={`${headCell} text-right`}>ยอดตาม PO</th>
                    <th className={`${headCell} text-right`}>ส่งเที่ยวนี้</th>
                    <th className={`${headCell} text-right`}>
                      คงเหลือส่ง Chef House
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.lotId} className="hover:bg-bg">
                      <td className={cell}>
                        <strong>{line.lot?.poId ?? "—"}</strong>
                      </td>
                      <td className={`${cell} text-body-sm`}>{line.lotId}</td>
                      <td className={`${cell} text-right text-body-sm`}>
                        {fmt(n(line.lot?.values ?? {}, "orderedKg"))} กก.
                      </td>
                      <td
                        className={`${cell} text-right font-semibold text-accent`}
                      >
                        {fmt(line.kg)} กก.
                      </td>
                      <td
                        className={`${cell} text-right text-body-sm text-text-secondary`}
                      >
                        {fmt(poRemainingKg(db, line.lotId))} กก.
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-surface-sunken font-semibold [&>td]:border-t [&>td]:border-border-strong">
                    <td
                      className="px-4.5 py-3 text-body-sm max-md:px-2.5"
                      colSpan={3}
                    >
                      รวมที่ส่งเที่ยวนี้
                    </td>
                    <td className="px-4.5 py-3 text-right text-num-md max-md:px-2.5">
                      {fmt(total)} กก.
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </Panel>
          )}

          <FormGrid>
            <FormField
              label="น้ำหนักที่ส่ง (กก.)"
              optional
              hint={
                lines.length
                  ? "เริ่มจากยอดรวม PO รมควัน แก้ได้ตามที่ส่งจริง"
                  : "เว้นว่างได้ ระบบใช้ Sliced Weight Net ของ Packing List"
              }
            >
              <Input
                type="text"
                inputMode="decimal"
                value={values.dispatchKg}
                onChange={(event) => set("dispatchKg", event.target.value)}
              />
            </FormField>
            <FormField label="วันที่รถรับ">
              <Input
                type="date"
                value={values.pickupDate}
                onChange={(event) => set("pickupDate", event.target.value)}
              />
            </FormField>
            <FormField
              label="เวลารถรับ"
              hint={
                recentTimes.length ? (
                  <span className="flex flex-wrap items-center gap-1.5">
                    ใช้ล่าสุด
                    {recentTimes.map((time) => (
                      <Button
                        key={time}
                        variant="table"
                        aria-pressed={values.pickupTime === time}
                        onClick={() => set("pickupTime", time)}
                      >
                        {time} น.
                      </Button>
                    ))}
                  </span>
                ) : undefined
              }
            >
              {/* A9 — any minute (e.g. 08:15); the default is still the next half-hour slot. */}
              <Input
                type="time"
                step={60}
                value={values.pickupTime}
                onChange={(event) => set("pickupTime", event.target.value)}
              />
            </FormField>
            <FormField label="รูปแบบเที่ยวรถ" prefilled={sources.trip}>
              <Select
                value={values.trip}
                onChange={(event) => set("trip", event.target.value)}
              >
                {["เที่ยวเดียว", "ไปกลับ"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="ต้นทาง">
              <Select
                value={values.origin}
                onChange={(event) => set("origin", event.target.value)}
              >
                {["กรุงเทพฯ", "เชียงใหม่", "อื่น ๆ"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="ปลายทาง">
              <Select
                value={values.destination}
                onChange={(event) => set("destination", event.target.value)}
              >
                {["เชียงใหม่", "กรุงเทพฯ", "อื่น ๆ"].map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="ประเภทรถ" prefilled={sources.vehicleType}>
              <Input
                type="text"
                value={values.vehicleType}
                onChange={(event) => set("vehicleType", event.target.value)}
              />
            </FormField>
            <FormField label="ทะเบียนรถ" prefilled={sources.plate}>
              <Input
                type="text"
                value={values.plate}
                onChange={(event) => set("plate", event.target.value)}
              />
            </FormField>
            <FormField label="ชื่อคนขับ" prefilled={sources.driverName}>
              <Input
                type="text"
                value={values.driverName}
                onChange={(event) => set("driverName", event.target.value)}
              />
            </FormField>
            <FormField label="เบอร์ติดต่อคนขับ" prefilled={sources.driverPhone}>
              <Input
                type="tel"
                value={values.driverPhone}
                onChange={(event) => set("driverPhone", event.target.value)}
              />
            </FormField>
          </FormGrid>

          {/* 1 การขนส่ง → 1 Packing List: ทำในฟอร์มนี้เลย ไม่มีหน้าแยก */}
          <Panel
            as="div"
            dashed={!draft}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <strong className="block text-body">
                Packing List ของเที่ยวนี้
              </strong>
              <span className="text-caption text-text-secondary">
                {draft
                  ? `${boxes.length} กล่องรับเข้า · Sliced Weight Net ${fmt(slicedNetKg)} กก. · บันทึกพร้อมใบขนส่งเมื่อกด “บันทึกใบขนส่ง”`
                  : `ยังไม่ได้ทำ · ระบุว่าส่งไปกี่กล่องรับเข้า แต่ละกล่องหนักเท่าไร${total ? ` (Inv. Weight ${fmt(total)} กก.)` : ""}`}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              {draft && (
                <Badge tone="success">
                  <Check className="me-1 size-3.5" />
                  ทำแล้ว
                </Badge>
              )}
              <Button
                variant="secondary"
                icon={<FileSpreadsheet className="size-4" />}
                onClick={() => setPackingOpen(true)}
              >
                {draft ? "แก้ไข Packing List" : "สร้าง Packing List"}
              </Button>
            </div>
          </Panel>
          <FormError error={error} />
        </DialogBody>
        <DialogFooter
          onCancel={onClose}
          submitLabel="บันทึกใบขนส่ง"
          submitting={saving}
          submitDisabled={!draft}
          error={
            draft ? "" : "ต้องทำ Packing List ของเที่ยวนี้ก่อนจึงจะบันทึกได้"
          }
          hint={
            lines.length
              ? `${lines.length} ใบ PO ซื้อ · รวม ${fmt(total)} กก.`
              : "ยังไม่มี PO รมควัน"
          }
        />
      </DialogForm>
      {packingOpen && (
        <PackingListForm
          db={db}
          lotId={lotId}
          date={date}
          onDate={onDate}
          draft={draft}
          onClose={() => setPackingOpen(false)}
          onDraft={(input) => {
            setDraft(input);
            // The last save error was about the old Packing List.
            setError("");
            setPackingOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}
