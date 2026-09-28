"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
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
  /* MAT-01/MAT-04: material that came in with no transfer document — a materialConfirm
   * with an empty transferId. Material, quantity and receiver are all the branch types;
   * a transfer can be linked to it later. `null` while the form is shut. */
  const [direct, setDirect] = useState<Values | null>(null);
  const buildDirect = (from: Database, v: Values) =>
    mutate(
      from,
      "branch",
      "materialConfirm",
      {
        transferId: "",
        material: v.material || "",
        receivedQuantity: v.receivedQuantity || "",
        receiver: v.receiver || "",
      },
      "",
      date,
      branch,
    );
  const setDirectValue = (key: string, value: string) =>
    setDirect((current) => ({ ...current, [key]: value }));
  const directComplete =
    !!direct &&
    ["material", "receivedQuantity", "receiver"].every((key) =>
      String(direct[key] ?? "").trim(),
    );
  const directLive =
    direct && directComplete
      ? check(() => buildDirect(db, direct))
      : { error: "", warnings: [] };
  const saveDirect = async () => {
    if (!direct) return;
    setConfirming("direct");
    const next = await run(() => buildDirect(latestDatabase(), direct));
    if (next) {
      setMessage(
        `รับ ${direct.material} ${direct.receivedQuantity} ชิ้นแล้ว (ไม่มีใบโอน)`,
      );
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
          <FilterBar>
            <Button
              variant="secondary"
              size="sm"
              disabled={closed || !!direct}
              onClick={() => {
                setMessage("");
                setDirect({ receiver: typedReceiver ? draft.receiver : "" });
              }}
            >
              รับวัสดุโดยไม่มีใบโอน
            </Button>
            <WorkingDateField
              variant="filter"
              className="text-caption text-text-secondary"
              date={date}
              onDate={onDate}
            />
            <div>
              <TableFilter label="ชื่อผู้รับจริง">
                <Input
                  variant="filter"
                  value={shownReceiver}
                  placeholder={`ผู้ดูแลสาขา ${branch}`}
                  prefilled={
                    !typedReceiver && shownReceiver ? "auto" : undefined
                  }
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      receiver: event.target.value,
                    }))
                  }
                />
              </TableFilter>
              {!typedReceiver && shownReceiver && (
                <PrefillCaption label="ตามใบส่งวัสดุของ Owner" />
              )}
            </div>
          </FilterBar>
        }
      />
      {direct && (
        <Panel>
          <strong>รับวัสดุโดยไม่มีใบโอน · {date}</strong>
          <FormGrid>
            <FormField label="วัสดุ">
              <Select
                autoFocus
                value={direct.material || ""}
                onChange={(event) =>
                  setDirectValue("material", event.target.value)
                }
              >
                <option value="">เลือกวัสดุ</option>
                {materials.map((material) => (
                  <option key={material}>{material}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="จำนวนที่รับจริง (ชิ้น)">
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={direct.receivedQuantity || ""}
                onChange={(event) =>
                  setDirectValue("receivedQuantity", event.target.value)
                }
              />
            </FormField>
            <FormField label="ชื่อผู้รับจริง">
              <Input
                value={direct.receiver || ""}
                placeholder={`ผู้ดูแลสาขา ${branch}`}
                onChange={(event) =>
                  setDirectValue("receiver", event.target.value)
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
                : "บันทึกรับวัสดุ"}
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
