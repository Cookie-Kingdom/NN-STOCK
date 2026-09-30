"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Panel } from "@/components/atoms/Panel";
import { Select } from "@/components/atoms/Select";
import { Spinner } from "@/components/atoms/Spinner";
import { Input } from "@/components/atoms/Input";
import { ActionWithError } from "@/components/molecules/ActionWithError";
import { FilterBar } from "@/components/molecules/FilterBar";
import { FormField, PrefillCaption } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { FormError } from "@/components/molecules/FormError";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { TableFilter } from "@/components/molecules/TableFilter";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import {
  entries,
  check,
  materials,
  mutate,
  type Database,
  type Entry,
  type Values,
} from "@/lib/store";

/** One row of the no-transfer receipt table. */
type DirectRow = { id: number; material: string; quantity: string };
let nextRowId = 0;
const newRow = (): DirectRow => ({
  id: nextRowId++,
  material: "",
  quantity: "",
});

export function MaterialReceiptConfirmation({
  db,
  branch,
  date,
  onDate,
  closed,
}: {
  db: Database;
  branch: string;
  date: string;
  onDate: (date: string) => void;
  closed: boolean;
}) {
  const pending = entries(db, "materialTransfer", undefined, branch).filter(
    (transfer) =>
      transfer.values.requiresConfirm &&
      !entries(db, "materialConfirm", undefined, branch).some(
        (entry) => entry.values.transferId === transfer.id,
      ),
  );
  const [draft, setDraft] = useState<Values>({});
  // Until the branch types a name, each row's receiver is the one the Owner wrote on
  // that transfer; the shared box shows the newest pending one's.
  const typedReceiver = draft.receiver !== undefined;
  const ownerReceiver = (transfer: Entry) =>
    transfer.values.receiver?.trim() || `ผู้ดูแลสาขา ${branch}`;
  const newest = pending.at(-1);
  const shownReceiver = typedReceiver
    ? draft.receiver
    : newest?.values.receiver?.trim() || "";
  // Success and error messages share one Notice, so the hook's error slot doubles as it.
  const {
    error: message,
    setError: setMessage,
    run,
    saving,
  } = useSaveMutation("ยืนยันรับไม่สำเร็จ");
  // Which row is waiting on the server, so only that button spins.
  const [confirming, setConfirming] = useState("");
  // The row's own change. Shared by the confirm and the live check so both refuse alike.
  const build = (from: Database, transfer: Entry) =>
    mutate(
      from,
      "branch",
      "materialConfirm",
      {
        transferId: transfer.id,
        receivedQuantity:
          draft[`quantity-${transfer.id}`] || transfer.values.quantity,
        receiver: typedReceiver
          ? draft.receiver || `ผู้ดูแลสาขา ${branch}`
          : ownerReceiver(transfer),
        reason: draft[`reason-${transfer.id}`] || "",
      },
      "",
      date,
      branch,
    );
  const confirm = async (transfer: Entry) => {
    setConfirming(transfer.id);
    const next = await run(() => build(latestDatabase(), transfer));
    if (next) setMessage(`ยืนยันรับ ${transfer.values.material} แล้ว`);
  };
  /* MAT-01/MAT-04: material that came in with no transfer document — one materialConfirm
   * with an empty transferId per table row, all saved together under one receiver.
   * A transfer can be linked to each later. `null` while the form is shut. */
  const [direct, setDirect] = useState<{
    rows: DirectRow[];
    receiver: string;
  } | null>(null);
  const buildDirect = (from: Database, rows: DirectRow[], receiver: string) =>
    rows.reduce(
      (current, row) =>
        mutate(
          current,
          "branch",
          "materialConfirm",
          {
            transferId: "",
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
    setDirect(
      (current) =>
        current && {
          ...current,
          rows: current.rows.map((row) =>
            row.id === id ? { ...row, [key]: value } : row,
          ),
        },
    );
  const directComplete =
    !!direct &&
    !!direct.receiver.trim() &&
    direct.rows.every((row) => row.material && row.quantity.trim());
  const directLive =
    direct && directComplete
      ? check(() => buildDirect(db, direct.rows, direct.receiver))
      : { error: "", warnings: [] };
  const saveDirect = async () => {
    if (!direct) return;
    setConfirming("direct");
    const next = await run(() =>
      buildDirect(latestDatabase(), direct.rows, direct.receiver),
    );
    if (next) {
      setMessage(`รับวัสดุ ${direct.rows.length} รายการแล้ว (ไม่มีใบโอน)`);
      setDirect(null);
    }
  };
  return (
    <>
      <DataTable
        title="รายการวัสดุรอยืนยันรับ (Pending material receipts)"
        defaultSort={{ column: "วันที่ส่ง", desc: true }}
        columns={[
          "วันที่ส่ง",
          "วัสดุ",
          "จำนวนที่ส่ง",
          "จำนวนที่รับจริง",
          "เหตุผลส่วนต่าง",
          "การทำงาน",
        ]}
        numericColumns={["จำนวนที่รับจริง"]}
        rowKeys={pending.map((transfer) => transfer.id)}
        rows={pending.map((transfer) => {
          const quantity =
            draft[`quantity-${transfer.id}`] ?? transfer.values.quantity;
          /* The confirm's own mutate, run on the row as it stands, so รับเกินจำนวนที่ส่ง
           * is said while the number is being typed instead of after ยืนยันรับ. mutate
           * clones the database, so a dry run changes nothing. Held back while the
           * quantity box is empty: a half-typed row must not be told off. Over the sent
           * amount is only a warning (yellow): ยืนยันรับ still saves it. */
          const quantityTouched =
            draft[`quantity-${transfer.id}`] !== undefined;
          const live = String(quantity).trim()
            ? check(() => build(db, transfer))
            : { error: "", warnings: [] };
          const rowError = live.error || live.warnings.join(" · ");
          return [
            transfer.date,
            transfer.values.material,
            transfer.values.quantity,
            <div key={`q-${transfer.id}`}>
              <Input
                variant="table"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                prefilled={quantityTouched ? undefined : "expected"}
                aria-label={`จำนวนที่รับจริง ${transfer.values.material}`}
                value={quantity}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [`quantity-${transfer.id}`]: event.target.value,
                  }))
                }
              />
              {!quantityTouched && (
                <PrefillCaption label="ตามยอดส่ง" expected />
              )}
            </div>,
            <Input
              key={`r-${transfer.id}`}
              variant="table"
              reason
              placeholder="กรอกเมื่อรับไม่ครบ"
              aria-label={`เหตุผลส่วนต่าง ${transfer.values.material}`}
              value={draft[`reason-${transfer.id}`] || ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [`reason-${transfer.id}`]: event.target.value,
                }))
              }
            />,
            <ActionWithError
              key={`b-${transfer.id}`}
              error={rowError}
              errorClassName={live.error ? undefined : "text-warning"}
            >
              <Button
                variant="table"
                disabled={closed || saving}
                icon={
                  saving && confirming === transfer.id ? <Spinner /> : undefined
                }
                onClick={() => confirm(transfer)}
              >
                {saving && confirming === transfer.id
                  ? "กำลังยืนยัน…"
                  : "ยืนยันรับ"}
              </Button>
            </ActionWithError>,
          ];
        })}
        action={
          <FilterBar className="items-center">
            <Button
              variant="secondary"
              size="sm"
              className="min-h-10"
              disabled={closed || !!direct}
              onClick={() => {
                setMessage("");
                setDirect({
                  rows: [newRow()],
                  receiver: typedReceiver ? draft.receiver : "",
                });
              }}
            >
              รับวัสดุโดยไม่มีใบโอน
            </Button>
            <WorkingDateField
              variant="filter"
              inline
              className="text-body-sm text-text-secondary"
              date={date}
              onDate={onDate}
            />
            {/* No caption under this one: it would push the box out of line with the
                rest of the bar. The tint marks it prefilled, the tooltip says from where. */}
            <TableFilter label="ชื่อผู้รับจริง">
              <Input
                variant="filter"
                value={shownReceiver}
                placeholder={`ผู้ดูแลสาขา ${branch}`}
                prefilled={!typedReceiver && shownReceiver ? "auto" : undefined}
                title={
                  !typedReceiver && shownReceiver
                    ? "กรอกอัตโนมัติ · ตามใบส่งวัสดุของ Owner"
                    : undefined
                }
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    receiver: event.target.value,
                  }))
                }
              />
            </TableFilter>
          </FilterBar>
        }
      />
      {direct && (
        <Panel>
          <strong>รับวัสดุโดยไม่มีใบโอน · {date}</strong>
          <table className="w-full max-w-2xl border-separate border-spacing-0">
            <thead>
              <tr className="text-left text-caption text-text-secondary">
                <th className="border-b border-border py-2 pr-3 font-semibold">
                  วัสดุ
                </th>
                <th className="w-44 border-b border-border py-2 pr-3 font-semibold max-md:w-28">
                  จำนวนที่รับจริง (ชิ้น)
                </th>
                <th className="w-12 border-b border-border py-2">
                  <span className="sr-only">ลบแถว</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {direct.rows.map((row, index) => (
                <tr key={row.id}>
                  <td className="py-2 pr-3">
                    <Select
                      variant="table"
                      className="w-full max-w-80 text-left"
                      autoFocus={index === direct.rows.length - 1}
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
                      className="w-full max-w-40"
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
                      disabled={direct.rows.length <= 1}
                      icon={<Trash2 className="size-4" />}
                      onClick={() =>
                        setDirect({
                          ...direct,
                          rows: direct.rows.filter(({ id }) => id !== row.id),
                        })
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
              onClick={() =>
                setDirect({ ...direct, rows: [...direct.rows, newRow()] })
              }
            >
              เพิ่มแถว
            </Button>
          </div>
          <FormGrid>
            <FormField label="ชื่อผู้รับจริง">
              <Input
                value={direct.receiver}
                placeholder={`ผู้ดูแลสาขา ${branch}`}
                onChange={(event) =>
                  setDirect({ ...direct, receiver: event.target.value })
                }
              />
            </FormField>
          </FormGrid>
          {directLive.error ? (
            <FormError error={directLive.error} />
          ) : (
            directLive.warnings.length > 0 && (
              <Notice tone="warning">{directLive.warnings.join(" · ")}</Notice>
            )
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              disabled={closed || saving || !directComplete}
              icon={saving && confirming === "direct" ? <Spinner /> : undefined}
              onClick={saveDirect}
            >
              {saving && confirming === "direct"
                ? "กำลังบันทึก…"
                : `บันทึกรับวัสดุ ${direct.rows.length} รายการ`}
            </Button>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setDirect(null)}
            >
              ยกเลิก
            </Button>
          </div>
        </Panel>
      )}
      {message && <Notice>{message}</Notice>}
    </>
  );
}
