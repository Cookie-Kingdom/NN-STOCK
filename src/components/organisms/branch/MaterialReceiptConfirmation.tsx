"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Spinner } from "@/components/atoms/Spinner";
import { Input } from "@/components/atoms/Input";
import { MissingMark } from "@/components/atoms/MissingMark";
import { FormField } from "@/components/molecules/FormField";
import { FormError } from "@/components/molecules/FormError";
import { Notice } from "@/components/molecules/Notice";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import {
  entries,
  check,
  materials,
  mutate,
  n,
  titles,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";

/** One row of the receipt form. */
type Row = { id: number; material: string; quantity: string };
let nextRowId = 0;
const newRow = (): Row => ({
  id: nextRowId++,
  material: "",
  quantity: "",
});

/** MAT-01/MAT-04: the branch writes down the material it received: one `materialConfirm`
 *  per form row, all saved together under one receiver and the working date. Under the
 *  form, what the branch received on that date. */
export function MaterialReceiptConfirmation({
  db,
  branch,
  date,
  onDate,
}: {
  db: Database;
  branch: string;
  date: string;
  onDate: (date: string) => void;
}) {
  const [rows, setRows] = useState(() => [newRow()]);
  const [receiver, setReceiver] = useState("");
  // Success and error messages share one Notice, so the hook's error slot doubles as it.
  const {
    error: message,
    setError: setMessage,
    run,
    saving,
  } = useSaveMutation("บันทึกรับวัสดุไม่สำเร็จ");
  // A row left blank is not a receipt; one with only a material or only a quantity still is.
  const filled = rows.filter((row) => row.material || row.quantity);
  const build = (from: Database) =>
    filled.reduce(
      (current, row) =>
        mutate(
          current,
          "branch",
          "materialConfirm",
          {
            material: row.material,
            receivedQuantity: row.quantity,
            receiver,
          },
          "",
          date,
          branch,
        ),
      from,
    );
  const setRow = (id: number, key: "material" | "quantity", value: string) =>
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  // Nothing typed yet: no live check and no save, so an untouched form is not told off.
  const touched = filled.length > 0;
  // An empty field is saved and marked missing (GEN-02), so only a bad number stops it.
  const live = touched ? check(() => build(db)) : { error: "", warnings: [] };
  const save = async () => {
    const count = filled.length;
    const next = await run(() => build(latestDatabase()));
    if (!next) return;
    setMessage(`รับวัสดุ ${count} รายการแล้ว`);
    // Cleared for the next note; the receiver stays, as the same person takes the next one in.
    setRows([newRow()]);
  };
  return (
    <>
      <Panel>
        <SectionHeading
          title={titles.materialConfirm}
          description="จดวัสดุที่สาขารับเข้า · ผู้รับหนึ่งคน รับได้หลายรายการ"
        />
        {/* Items on the left at a readable width, the date, receiver and save on a card
            to the right; stacked on narrow screens. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,42rem)_20rem] lg:justify-between">
          <div className="flex flex-col gap-3">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr className="text-left text-caption text-text-secondary">
                  <th className="w-8 border-b border-border py-2 font-semibold">
                    #
                  </th>
                  <th className="border-b border-border py-2 pr-3 font-semibold">
                    วัสดุ
                  </th>
                  <th className="w-36 border-b border-border py-2 pr-3 font-semibold max-md:w-24">
                    จำนวน (ชิ้น)
                  </th>
                  <th className="w-10 border-b border-border py-2">
                    <span className="sr-only">ลบแถว</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="py-2 text-caption text-text-secondary tabular-nums">
                      {index + 1}
                    </td>
                    <td className="py-2 pr-3">
                      <Select
                        variant="table"
                        className="w-full text-left"
                        // Only a row added by เพิ่มแถว: opening the tab must not grab focus.
                        autoFocus={index > 0 && index === rows.length - 1}
                        aria-label={`วัสดุ แถวที่ ${index + 1}`}
                        value={row.material}
                        onChange={(event) =>
                          setRow(row.id, "material", event.target.value)
                        }
                      >
                        <option value="">เลือกวัสดุ</option>
                        {materials.map((material) => (
                          <option key={material}>{material}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="py-2 pr-3">
                      <Input
                        variant="table"
                        type="number"
                        inputMode="numeric"
                        min="1"
                        step="1"
                        className="w-full"
                        aria-label={`จำนวนที่รับจริง แถวที่ ${index + 1}`}
                        value={row.quantity}
                        onChange={(event) =>
                          setRow(row.id, "quantity", event.target.value)
                        }
                      />
                    </td>
                    <td className="py-2 text-right">
                      <IconButton
                        size="sm"
                        label={`ลบแถวที่ ${index + 1}`}
                        disabled={rows.length <= 1}
                        icon={<Trash2 className="size-4" />}
                        onClick={() =>
                          setRows(rows.filter(({ id }) => id !== row.id))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Plus className="size-4" />}
                onClick={() => setRows([...rows, newRow()])}
              >
                เพิ่มแถว
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-4 self-start rounded-lg border border-border bg-surface-sunken p-4">
            <WorkingDateField date={date} onDate={onDate} />
            <FormField label="ชื่อผู้รับจริง">
              <Input
                value={receiver}
                placeholder={`ผู้ดูแลสาขา ${branch}`}
                onChange={(event) => setReceiver(event.target.value)}
              />
            </FormField>
            <p className="flex justify-between text-body-sm text-text-secondary">
              <span>รวม {filled.length} รายการ</span>
              <span className="tabular-nums">
                {filled.reduce(
                  (sum, row) => sum + (Number(row.quantity) || 0),
                  0,
                )}{" "}
                ชิ้น
              </span>
            </p>
            {live.error ? (
              <FormError error={live.error} />
            ) : (
              live.warnings.length > 0 && (
                <Notice tone="warning">{live.warnings.join(" · ")}</Notice>
              )
            )}
            <Button
              variant="primary"
              disabled={saving || !touched}
              icon={saving ? <Spinner /> : undefined}
              onClick={save}
            >
              {saving
                ? "กำลังบันทึก…"
                : `บันทึกรับวัสดุ ${filled.length} รายการ`}
            </Button>
          </div>
        </div>
      </Panel>
      {message && <Notice>{message}</Notice>}
      <DataTable
        title={`วัสดุที่รับเข้าวันที่ ${date} · ${branch}`}
        columns={["วันที่", "วัสดุ", "จำนวน", "ผู้รับ"]}
        emptyText="ยังไม่มีรายการรับวัสดุของวันนี้"
        // A field saved empty (GEN-02) reads "ยังไม่ได้กรอก", as in the Log.
        rows={entries(db, "materialConfirm", undefined, branch, date).map(
          (entry) => [
            entry.date,
            entry.values.material || <MissingMark key="material" />,
            entry.values.receivedQuantity ? (
              `${fmt(n(entry.values, "receivedQuantity"))} ชิ้น`
            ) : (
              <MissingMark key="quantity" />
            ),
            entry.values.receiver || <MissingMark key="receiver" />,
          ],
        )}
      />
    </>
  );
}
