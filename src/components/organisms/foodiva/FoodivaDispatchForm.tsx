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
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { nextTimeSlot } from "@/lib/forms";
import { fmt } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import {
  dispatchWithPackingList,
  entries,
  n,
  packingListBoxes,
  poRemainingKg,
  shipmentLines,
  type Database,
  type Values,
} from "@/lib/store";

const cell = "border-b border-border px-4.5 py-3 align-middle max-md:px-2.5";
const headCell =
  "border-b border-border bg-bg px-4.5 py-3 text-left text-caption font-semibold text-text-secondary max-md:px-2.5";

/**
 * Foodiva's outbound transport document for one Owner Request (a shipment at stage 1).
 * The Packing List is filled in a dialog on top but not saved there: "บันทึกใบขนส่ง"
 * saves both in one go, the transport document first (`dispatchWithPackingList`).
 */
export function FoodivaDispatchForm({
  db,
  lotId,
  date,
  onDate,
  minDate,
  onClose,
  onSaved,
}: {
  db: Database;
  /** The shipment lot the Owner's Request created. */
  lotId: string;
  date: string;
  onDate: (date: string) => void;
  minDate?: string;
  onClose: () => void;
  onSaved: (db: Database) => void;
}) {
  const lot = db.lots.find((l) => l.id === lotId);
  const [values, setValues] = useState({
    pickupDate: date,
    pickupTime: nextTimeSlot(),
    origin: "กรุงเทพฯ",
    destination: "เชียงใหม่",
    trip: "เที่ยวเดียว",
    vehicleType: "รถห้องเย็น 6 ล้อ",
    plate: "",
    driverName: "",
    driverPhone: "",
  });
  const set = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));
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
  const total = n(lot?.values ?? {}, "requestedKg");
  const boxes = packingListBoxes(draft?.boxes);
  const boxedKg = boxes.reduce((sum, kg) => sum + kg, 0);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!draft) return;
    const next = await run(() =>
      dispatchWithPackingList(latestDatabase(), lotId, values, draft, date),
    );
    if (next) onSaved(next);
  }

  return (
    <Dialog
      overline={`${date} · Foodiva · ${lot?.poId ?? ""}`}
      title="ทำใบขนส่งไปเชียงใหม่ (Chef House)"
      size="wide"
      onClose={onClose}
    >
      <DialogForm noValidate onSubmit={submit}>
        <DialogBody>
          <WorkingDateField
            asField
            date={date}
            onDate={onDate}
            minDate={minDate}
          />
          <Notice>
            เที่ยวนี้มาจาก Request ของ Owner / Manager — PO ซื้อ และน้ำหนักรายใบ
            ด้านล่างแก้ไม่ได้ ถ้าไม่ตรงให้แจ้ง Owner ให้แก้ Request
          </Notice>

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
                <tr className="font-semibold">
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

          <FormGrid>
            <FormField label="วันที่รถรับ">
              <Input
                type="date"
                value={values.pickupDate}
                min={minDate}
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
            <FormField label="รูปแบบเที่ยวรถ">
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
            <FormField label="ประเภทรถ">
              <Input
                type="text"
                value={values.vehicleType}
                onChange={(event) => set("vehicleType", event.target.value)}
              />
            </FormField>
            <FormField label="ทะเบียนรถ">
              <Input
                type="text"
                value={values.plate}
                onChange={(event) => set("plate", event.target.value)}
              />
            </FormField>
            <FormField label="ชื่อคนขับ">
              <Input
                type="text"
                value={values.driverName}
                onChange={(event) => set("driverName", event.target.value)}
              />
            </FormField>
            <FormField label="เบอร์ติดต่อคนขับ">
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
                  ? `${boxes.length} กล่องรับเข้า · ${fmt(boxedKg)} กก. · บันทึกพร้อมใบขนส่งเมื่อกด “บันทึกใบขนส่ง”`
                  : `ยังไม่ได้ทำ · ระบุว่าส่งไปกี่กล่องรับเข้า แต่ละกล่องหนักเท่าไร (รวม ${fmt(total)} กก.)`}
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
          hint={`${lines.length} ใบ PO ซื้อ · รวม ${fmt(total)} กก.`}
        />
      </DialogForm>
      {packingOpen && (
        <PackingListForm
          db={db}
          lotId={lotId}
          date={date}
          onDate={onDate}
          minDate={minDate}
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
