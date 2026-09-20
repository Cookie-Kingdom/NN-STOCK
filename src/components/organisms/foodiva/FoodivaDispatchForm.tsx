"use client";

import { useState } from "react";
import { Check, FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { PackingListForm } from "@/components/organisms/shared/PackingListForm";
import { timeOptions } from "@/lib/forms";
import { fmt } from "@/lib/format";
import { entries, n, type Database } from "@/lib/store";

/** One purchase PO in this trip, as the Owner/Manager's Request set it. */
export type DispatchRequestLine = { lotId: string; kg: number };

const cell = "border-b border-border px-4.5 py-3 align-middle max-md:px-2.5";
const headCell =
  "border-b border-border bg-bg px-4.5 py-3 text-left text-caption font-semibold text-text-secondary max-md:px-2.5";

/**
 * **ตัวอย่างการ์ด P2** ([[plan-20-09-2026]]) — ใบขนส่งขาไปในเวอร์ชันที่ย้ายมาเป็นของ
 * Foodiva: อ้าง Request ของ Owner/Manager, กรอกข้อมูลรถ, แล้ว **ทำ Packing List ในฟอร์ม
 * เดียวกันนี้** ก่อนบันทึก
 *
 * ยังไม่ได้ต่อกับ `mutate()` เพราะ `dispatch` ยังเป็นสิทธิ์ของ Owner และตัว Request ยังไม่มี
 * ในโดเมน — ดู P0/P1/P2 ในแผน `onSubmit` จึงเป็นจุดที่การบันทึกจริงจะไปเสียบทีหลัง
 */
export function FoodivaDispatchForm({
  db,
  request,
  date,
  onDate,
  minDate,
  onClose,
  onSubmit,
}: {
  db: Database;
  /** PO ซื้อ ที่อยู่ในเที่ยวนี้ พร้อมน้ำหนักที่ Owner/Manager สั่งให้ส่ง */
  request: DispatchRequestLine[];
  date: string;
  onDate: (date: string) => void;
  minDate?: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [values, setValues] = useState({
    pickupTime: "08:00",
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
  const [packingOpen, setPackingOpen] = useState(false);
  /** The Packing List is saved by its own form; this only tracks that it happened. */
  const [packed, setPacked] = useState(() =>
    request.some((line) => entries(db, "packingList", line.lotId).length > 0),
  );

  const lines = request.map((line) => ({
    ...line,
    lot: db.lots.find((lot) => lot.id === line.lotId),
  }));
  const total = lines.reduce((sum, line) => sum + line.kg, 0);

  return (
    <Dialog
      overline={`${date} · Foodiva`}
      title="ทำใบขนส่งไปเชียงใหม่ (Chef House)"
      size="wide"
      onClose={onClose}
    >
      <DialogForm
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
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
                    คงเหลือที่ Foodiva
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const ordered = n(line.lot?.values ?? {}, "orderedKg");
                  return (
                    <tr key={line.lotId} className="hover:bg-bg">
                      <td className={cell}>
                        <strong>{line.lot?.poId ?? "—"}</strong>
                      </td>
                      <td className={`${cell} text-body-sm`}>{line.lotId}</td>
                      <td className={`${cell} text-right text-body-sm`}>
                        {fmt(ordered)} กก.
                      </td>
                      <td
                        className={`${cell} text-right font-semibold text-accent`}
                      >
                        {fmt(line.kg)} กก.
                      </td>
                      <td
                        className={`${cell} text-right text-body-sm text-text-secondary`}
                      >
                        {fmt(Math.max(0, ordered - line.kg))} กก.
                      </td>
                    </tr>
                  );
                })}
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
            <FormField label="เวลารถรับ">
              {/* ข้อ 12 — เลือกจากช่วงครึ่งชั่วโมง ไม่ต้องพิมพ์ HH:mm เอง */}
              <Select
                value={values.pickupTime}
                onChange={(event) => set("pickupTime", event.target.value)}
              >
                {timeOptions(values.pickupTime).map((slot) => (
                  <option key={slot} value={slot}>
                    {slot} น.
                  </option>
                ))}
              </Select>
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
            dashed={!packed}
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <div className="min-w-0">
              <strong className="block text-body">
                Packing List ของเที่ยวนี้
              </strong>
              <span className="text-caption text-text-secondary">
                {packed
                  ? "ทำแล้ว — Chef House จะเห็นตารางนี้ตอนรับของ"
                  : `ยังไม่ได้ทำ · ระบุว่าส่งไปกี่กล่องรับเข้า แต่ละกล่องหนักเท่าไร (รวม ${fmt(total)} กก.)`}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              {packed && (
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
                {packed ? "แก้ไข Packing List" : "สร้าง Packing List"}
              </Button>
            </div>
          </Panel>
        </DialogBody>
        <DialogFooter
          onCancel={onClose}
          submitLabel="บันทึกใบขนส่ง"
          submitDisabled={!packed}
          error={
            packed ? "" : "ต้องทำ Packing List ของเที่ยวนี้ก่อนจึงจะบันทึกได้"
          }
          hint={`${lines.length} ใบ PO ซื้อ · รวม ${fmt(total)} กก.`}
        />
      </DialogForm>
      {packingOpen && (
        <PackingListForm
          db={db}
          lotId={request[0]?.lotId ?? ""}
          date={date}
          onDate={onDate}
          minDate={minDate}
          onClose={() => setPackingOpen(false)}
          onSaved={() => {
            setPacked(true);
            setPackingOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}
