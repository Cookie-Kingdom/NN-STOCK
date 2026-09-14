"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Notice } from "@/components/molecules/Notice";
import { TableFilter } from "@/components/molecules/TableFilter";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import { entries, mutate, type Database, type Entry, type Values } from "@/lib/store";

export function MaterialReceiptConfirmation({ db, branch, date, closed }: { db: Database; branch: string; date: string; closed: boolean }) {
  const pending = entries(db, "materialTransfer", undefined, branch)
    .filter((transfer) => transfer.values.requiresConfirm &&
      !entries(db, "materialConfirm", undefined, branch).some((entry) => entry.values.transferId === transfer.id));
  const [draft, setDraft] = useState<Values>({});
  const [message, setMessage] = useState("");
  const confirm = (transfer: Entry) => {
    try {
      const receivedQuantity = draft[`quantity-${transfer.id}`] || transfer.values.quantity;
      const next = mutate(latestDatabase(), "branch", "materialConfirm", {
        transferId: transfer.id,
        receivedQuantity,
        receiver: draft.receiver || `ผู้ดูแลสาขา ${branch}`,
        reason: draft[`reason-${transfer.id}`] || "",
      }, "", date);
      saveDatabase(next);
      setMessage(`ยืนยันรับ ${transfer.values.material} แล้ว`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "ยืนยันรับไม่สำเร็จ");
    }
  };
  return <>
    <DataTable
      title="รายการวัสดุรอยืนยันรับ (Pending material receipts)"
      columns={["วันที่ส่ง", "วัสดุ", "จำนวนที่ส่ง", "จำนวนที่รับจริง", "เหตุผลส่วนต่าง", "การทำงาน"]}
      rowKeys={pending.map((transfer) => transfer.id)}
      rows={pending.map((transfer) => [
        transfer.date,
        transfer.values.material,
        transfer.values.quantity,
        <Input key={`q-${transfer.id}`} variant="table" type="number" min="1" max={transfer.values.quantity} step="1" aria-label={`จำนวนที่รับจริง ${transfer.values.material}`} value={draft[`quantity-${transfer.id}`] ?? transfer.values.quantity} onChange={(event) => setDraft((current) => ({...current, [`quantity-${transfer.id}`]: event.target.value}))} />,
        <Input key={`r-${transfer.id}`} variant="table" reason placeholder="กรอกเมื่อรับไม่ครบ" aria-label={`เหตุผลส่วนต่าง ${transfer.values.material}`} value={draft[`reason-${transfer.id}`] || ""} onChange={(event) => setDraft((current) => ({...current, [`reason-${transfer.id}`]: event.target.value}))} />,
        <Button key={`b-${transfer.id}`} variant="table" disabled={closed} onClick={() => confirm(transfer)}>ยืนยันรับ</Button>,
      ])}
      action={<TableFilter label="ชื่อผู้รับจริง"><Input variant="filter" value={draft.receiver || ""} placeholder={`ผู้ดูแลสาขา ${branch}`} onChange={(event) => setDraft((current) => ({...current, receiver: event.target.value}))} /></TableFilter>}
    />
    {message && <Notice>{message}</Notice>}
  </>;
}
