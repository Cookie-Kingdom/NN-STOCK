"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { Input } from "@/components/atoms/Input";
import { ActionWithError } from "@/components/molecules/ActionWithError";
import { FilterBar } from "@/components/molecules/FilterBar";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { TableFilter } from "@/components/molecules/TableFilter";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { latestDatabase } from "@/lib/persistence";
import {
  entries,
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
  minDate,
  closed,
}: {
  db: Database;
  branch: string;
  date: string;
  onDate: (date: string) => void;
  minDate?: string;
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
        receiver: draft.receiver || `ผู้ดูแลสาขา ${branch}`,
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
        rowKeys={pending.map((transfer) => transfer.id)}
        rows={pending.map((transfer) => {
          const quantity =
            draft[`quantity-${transfer.id}`] ?? transfer.values.quantity;
          /* The confirm's own mutate, run on the row as it stands, so รับเกินจำนวนที่ส่ง
           * is said while the number is being typed instead of after ยืนยันรับ. mutate
           * clones the database, so a dry run changes nothing. Held back while the
           * quantity box is empty: a half-typed row must not be told off. */
          let rowError = "";
          if (String(quantity).trim())
            try {
              build(db, transfer);
            } catch (caught) {
              rowError = caught instanceof Error ? caught.message : "";
            }
          return [
            transfer.date,
            transfer.values.material,
            transfer.values.quantity,
            <Input
              key={`q-${transfer.id}`}
              variant="table"
              type="number"
              inputMode="numeric"
              min="1"
              max={transfer.values.quantity}
              step="1"
              aria-label={`จำนวนที่รับจริง ${transfer.values.material}`}
              value={
                draft[`quantity-${transfer.id}`] ?? transfer.values.quantity
              }
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  [`quantity-${transfer.id}`]: event.target.value,
                }))
              }
            />,
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
            <ActionWithError key={`b-${transfer.id}`} error={rowError}>
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
            <WorkingDateField
              variant="filter"
              className="text-caption text-text-secondary"
              date={date}
              onDate={onDate}
              minDate={minDate}
            />
            <TableFilter label="ชื่อผู้รับจริง">
              <Input
                variant="filter"
                value={draft.receiver || ""}
                placeholder={`ผู้ดูแลสาขา ${branch}`}
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
      {message && <Notice>{message}</Notice>}
    </>
  );
}
