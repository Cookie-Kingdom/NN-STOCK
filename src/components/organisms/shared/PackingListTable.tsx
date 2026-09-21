"use client";

import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Input } from "@/components/atoms/Input";
import { Stat } from "@/components/atoms/Stat";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { TableSection } from "@/components/organisms/shared/TableSection";

/** Head of a Packing List — typed in by Foodiva, or read out of the file it uploads
 *  once the template is known. */
export type PackingListHeader = {
  /** Date of the list, e.g. "16/9/2026". */
  date: string;
  /** Foodiva's meat invoice numbers; Chef House sees them too. */
  invoiceNo: string;
  /** Product line, e.g. "NERD NUEA FZ .. SLICED 6mm.". */
  product: string;
  /** Supplier code line, e.g. "0037 Aust.Beef Icon XB Wagyu Chuck Roll 6/7". */
  code?: string;
  /** Weight on Foodiva's invoice, before cutting. */
  invWeight?: number;
  /** Box total of the list. */
  slicedNet?: number;
  /** Usable meat after cutting, as Foodiva typed it (A2) — never derived from the
   *  yellow cells or from Inv. Weight. */
  slicedLost?: number;
};

/** One กล่องรับเข้า. `weight` is what the Packing List says, `received` is the yellow
 *  cell Chef House fills with what it actually weighed — the two need not match. */
export type PackingListBox = {
  no: number;
  weight?: number;
  received?: number;
};

const kg = (value: number) => value.toFixed(2);
const cell = "border-b border-border px-4.5 py-2.5 max-md:px-2.5";

/** How long the list is. A desktop number field has its own spinner, so − and +
 *  are only rendered where there is none.
 *
 *  The text is local so the field can be empty mid-edit, and follows `rows` again
 *  whenever the count changes from outside — a row added or deleted in the table. */
function RowCount({
  rows,
  onRows,
}: {
  rows: number;
  onRows: (count: number) => void;
}) {
  const [text, setText] = useState(String(rows));
  const [seen, setSeen] = useState(rows);
  if (seen !== rows) {
    setSeen(rows);
    setText(String(rows));
  }
  const step = (delta: number) => onRows(Math.max(1, rows + delta));
  return (
    <div className="flex items-center gap-2 text-body-sm text-text-secondary">
      จำนวนแถว
      <IconButton
        size="sm"
        className="md:hidden"
        label="ลดหนึ่งแถว"
        disabled={rows <= 1}
        icon={<Minus className="size-4" />}
        onClick={() => step(-1)}
      />
      <Input
        variant="filter"
        type="number"
        spinner
        min="1"
        step="1"
        inputMode="numeric"
        aria-label="จำนวนแถวของตาราง"
        className="w-20 min-w-0 text-center"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          const next = Number(event.target.value);
          if (Number.isInteger(next) && next >= 1) onRows(next);
        }}
        onBlur={() => setText(String(rows))}
      />
      <IconButton
        size="sm"
        className="md:hidden"
        label="เพิ่มหนึ่งแถว"
        icon={<Plus className="size-4" />}
        onClick={() => step(1)}
      />
    </div>
  );
}

function WeightCell({
  value,
  onChange,
  label,
}: {
  value: number | undefined;
  onChange?: (value: number | undefined) => void;
  label: string;
}) {
  if (!onChange)
    return (
      <span className="text-num-md">
        {value === undefined ? "—" : kg(value)}
      </span>
    );
  return (
    <Input
      variant="table"
      type="number"
      spinner
      step="0.01"
      min="0"
      className="w-28"
      aria-label={label}
      value={value ?? ""}
      onChange={(event) =>
        onChange(
          event.target.value === "" ? undefined : Number(event.target.value),
        )
      }
    />
  );
}

/**
 * The Packing List as the system shows it: the header, then one row per กล่องรับเข้า
 * with the listed weight beside the yellow cell Chef House fills in. `onWeight` makes
 * the listed column editable (Foodiva), `onReceived` the yellow one (Chef House);
 * with neither, the same table is the read-only view Owner/Manager sees.
 *
 * `onRows` and `onRemoveRow` belong to whoever writes the list in the first place.
 * Reading it, or weighing what arrived, leaves the row count alone: it is still shown,
 * it just cannot be changed.
 */
export function PackingListTable({
  title = "Packing List",
  header,
  boxes,
  onRows,
  onRemoveRow,
  onWeight,
  onReceived,
}: {
  title?: string;
  header: PackingListHeader;
  boxes: readonly PackingListBox[];
  /** Adds the row-count control: the list is as long as the sender says it is. */
  onRows?: (count: number) => void;
  /** Adds a delete button per row, behind a confirmation. */
  onRemoveRow?: (no: number) => void;
  /** Foodiva typing the list; omit once the row is read-only. */
  onWeight?: (no: number, weight: number | undefined) => void;
  /** Chef House weighing what arrived; omit for the Foodiva and Owner views. */
  onReceived?: (no: number, received: number | undefined) => void;
}) {
  const [removing, setRemoving] = useState<number | null>(null);
  const listed = boxes.filter((box) => box.weight !== undefined);
  const listedTotal = listed.reduce((sum, box) => sum + (box.weight ?? 0), 0);
  const filled = boxes.filter((box) => box.received !== undefined);
  const receivedTotal = filled.reduce(
    (sum, box) => sum + (box.received ?? 0),
    0,
  );
  // While Foodiva is typing, "missing" means a blank Packing List weight; after that
  // it means a box Chef House has not weighed yet.
  const missing = onWeight
    ? boxes.length - listed.length
    : boxes.length - filled.length;
  const removingWeight = boxes.find((box) => box.no === removing)?.weight;
  return (
    <TableSection
      title={title}
      count={`${boxes.length} กล่องรับเข้า`}
      actions={
        <div className="flex flex-wrap items-center gap-3">
          {missing ? (
            <Badge tone="warning">
              {onWeight
                ? `ยังไม่ได้กรอก ${missing} แถว`
                : `รอ Chef House กรอก ${missing} กล่องรับเข้า`}
            </Badge>
          ) : (
            <Badge tone="success">กรอกครบแล้ว</Badge>
          )}
          {onRows ? (
            <RowCount rows={boxes.length} onRows={onRows} />
          ) : (
            <span className="text-body-sm text-text-secondary">
              จำนวนแถว {boxes.length}
            </span>
          )}
        </div>
      }
    >
      <div className="border-b border-border px-6 py-5 max-md:px-4">
        <p className="m-0 text-caption text-text-secondary">
          วันที่ {header.date} · INV {header.invoiceNo || "—"}
        </p>
        <p className="mt-1.5 mb-4 text-body font-semibold">
          {header.product || "—"}{" "}
          {header.code && (
            <span className="font-normal text-text-secondary">
              (CODE {header.code})
            </span>
          )}
        </p>
        <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
          <Stat
            label="Inv. Weight"
            value={header.invWeight ? `${kg(header.invWeight)} กก.` : "—"}
          />
          <Stat
            label="Sliced Weight Net"
            value={`${kg(header.slicedNet ?? listedTotal)} กก.`}
          />
          <Stat
            label="Sliced Weight Lost"
            value={
              header.slicedLost === undefined
                ? "—"
                : `${kg(header.slicedLost)} กก.`
            }
          />
          <Stat
            label="รับจริงที่ Chef House"
            value={filled.length ? `${kg(receivedTotal)} กก.` : "—"}
          />
        </div>
      </div>
      {/* ponytail: one column of rows and scroll. The paper sheet prints its boxes in
          three side-by-side blocks; split it only if someone complains about scrolling. */}
      <div className="max-h-150 overflow-auto overscroll-contain">
        <table className="w-full border-separate border-spacing-0 tabular-nums">
          <thead>
            <tr>
              {[
                "กล่องรับเข้าที่",
                "น้ำหนักตาม Packing List",
                "น้ำหนักจริงที่รับได้",
                "ส่วนต่าง",
              ].map((column, index) => (
                <th
                  key={column}
                  className={`sticky top-0 z-10 border-b border-border px-4.5 py-3.5 text-caption font-semibold tracking-[0.03em] whitespace-nowrap text-text-secondary max-md:px-2.5 ${
                    index === 0 ? "text-left" : "text-right"
                  } ${index === 2 ? "bg-warning-subtle" : "bg-bg"}`}
                >
                  {column}
                  {index === 2 && (
                    <span className="ms-1.5 font-normal">(Chef House)</span>
                  )}
                </th>
              ))}
              {onRemoveRow && (
                <th className="sticky top-0 z-10 w-14 border-b border-border bg-bg px-4.5 py-3.5 max-md:px-2.5">
                  <span className="sr-only">ลบแถว</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {boxes.map((box) => {
              const diff =
                box.received === undefined || box.weight === undefined
                  ? undefined
                  : box.received - box.weight;
              return (
                <tr key={box.no} className="hover:bg-bg">
                  <td className={`${cell} text-body-sm`}>{box.no}</td>
                  <td className={`${cell} text-right text-body-sm`}>
                    <WeightCell
                      value={box.weight}
                      onChange={
                        onWeight && ((value) => onWeight(box.no, value))
                      }
                      label={`น้ำหนักตาม Packing List กล่องรับเข้าที่ ${box.no}`}
                    />
                  </td>
                  <td className={`${cell} bg-warning-subtle text-right`}>
                    <WeightCell
                      value={box.received}
                      onChange={
                        onReceived && ((value) => onReceived(box.no, value))
                      }
                      label={`น้ำหนักจริงกล่องรับเข้าที่ ${box.no}`}
                    />
                  </td>
                  <td
                    className={`${cell} text-right text-body-sm ${
                      diff
                        ? "font-semibold text-warning"
                        : "text-text-secondary"
                    }`}
                  >
                    {diff === undefined
                      ? "—"
                      : `${diff > 0 ? "+" : ""}${kg(diff)}`}
                  </td>
                  {onRemoveRow && (
                    <td className={`${cell} text-right`}>
                      <IconButton
                        size="sm"
                        label={`ลบกล่องรับเข้าที่ ${box.no}`}
                        disabled={boxes.length <= 1}
                        icon={<Trash2 className="size-4" />}
                        onClick={() => setRemoving(box.no)}
                      />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="sticky bottom-0 bg-surface px-4.5 py-3.5 text-body-sm max-md:px-2.5">
                รวม {listed.length} กล่องรับเข้า
              </td>
              <td className="sticky bottom-0 bg-surface px-4.5 py-3.5 text-right text-num-md max-md:px-2.5">
                {listed.length ? kg(listedTotal) : "—"}
              </td>
              <td className="sticky bottom-0 bg-warning-subtle px-4.5 py-3.5 text-right text-num-md max-md:px-2.5">
                {filled.length ? kg(receivedTotal) : "—"}
              </td>
              <td
                className="sticky bottom-0 bg-surface px-4.5 py-3.5 text-right text-body-sm max-md:px-2.5"
                colSpan={onRemoveRow ? 2 : 1}
              >
                {filled.length && filled.length === listed.length
                  ? `${receivedTotal - listedTotal > 0 ? "+" : ""}${kg(receivedTotal - listedTotal)}`
                  : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {onRows && (
        <div className="border-t border-border px-6 py-4 max-md:px-4">
          <Button
            variant="secondary"
            onClick={() => onRows(boxes.length + 1)}
            icon={<Plus className="size-4" />}
          >
            เพิ่มแถว
          </Button>
        </div>
      )}
      <p className="m-0 border-t border-border px-6 py-4 text-caption text-text-secondary max-md:px-4">
        ยอดรวมช่องเหลืองคือยอดที่ใช้ตัดสต๊อกและคิดต้นทุนจริง —
        ไม่ต้องตรงกับน้ำหนักตาม Packing List
      </p>
      {removing !== null && onRemoveRow && (
        <Dialog
          title="ลบแถวนี้?"
          overline={`กล่องรับเข้าที่ ${removing}`}
          className="w-110"
          onClose={() => setRemoving(null)}
          footer={
            <DialogFooter
              onCancel={() => setRemoving(null)}
              submitLabel="ลบแถว"
              submitType="button"
              onSubmit={() => {
                onRemoveRow(removing);
                setRemoving(null);
              }}
            />
          }
        >
          <DialogBody>
            <p className="m-0 text-body">
              กล่องรับเข้าที่ {removing}
              {removingWeight !== undefined &&
                ` (${kg(removingWeight)} กก.)`}{" "}
              จะถูกลบออกจากตาราง และแถวถัดไปจะเลื่อนเลขขึ้นมาแทน
            </p>
          </DialogBody>
        </Dialog>
      )}
    </TableSection>
  );
}
