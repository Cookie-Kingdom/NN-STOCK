"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Panel } from "@/components/atoms/Panel";
import { ReadRow } from "@/components/atoms/ReadRow";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { EmptyState } from "@/components/molecules/EmptyState";
import { FormError } from "@/components/molecules/FormError";
import { SectionHeading } from "@/components/molecules/SectionHeading";
import { EditDiff } from "@/components/organisms/shared/EntryDetails";
import { editOutcome } from "@/components/organisms/workspace/editRequestAlerts";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import {
  editApprovers,
  editDecisions,
  editRequestRows,
  mutate,
  entryBy,
  titles,
  type Database,
  type Entry,
  type Role,
  type EntryKind,
} from "@/lib/store";
import { today } from "@/lib/format";

const at = (iso: string) => new Date(iso).toLocaleString("th-TH");
const who = (e: Entry) =>
  `${entryBy(e)}${e.role === "branch" ? ` ${e.branch}` : ""}`;

function RequestRow({
  request,
  decision,
  role,
  onChanged,
}: {
  request: Entry;
  decision?: Entry;
  role: Role;
  onChanged: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const decide = (choice: string) => {
    setError("");
    try {
      saveDatabase(
        mutate(
          latestDatabase(),
          role,
          "editDecision",
          { requestId: request.id, decision: choice, note },
          "",
          today(),
        ),
      );
      onChanged(
        choice === editDecisions.approve
          ? "อนุมัติคำขอแล้ว ระบบใช้ค่าใหม่คำนวณยอดทันที"
          : "ไม่อนุมัติคำขอแล้ว ค่าเดิมยังใช้อยู่",
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    }
  };
  const outcome = editOutcome(decision);
  const approver = editApprovers.includes(role);
  return (
    <div className="border-b border-border py-3.5 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong className="text-body-sm">
          {titles[request.values.targetKind as EntryKind] ||
            request.values.targetKind}{" "}
          · {request.values.targetDate}
          {request.lotId && ` · ${request.lotId}`}
        </strong>
        <Badge
          tone={
            outcome === "สำเร็จ"
              ? "success"
              : outcome === "ไม่สำเร็จ"
                ? "danger"
                : "warning"
          }
        >
          {outcome}
        </Badge>
      </div>
      <ReadRow label="ผู้ขอ" value={`${who(request)} · ${at(request.at)}`} />
      <ReadRow label="เหตุผลที่ขอ" value={request.values.reason} />
      <EditDiff values={request.values} />
      {decision && (
        <>
          <ReadRow
            label="ผลการพิจารณา"
            value={`${decision.values.decision} โดย ${who(decision)} · ${at(decision.at)}`}
          />
          {decision.values.note && (
            <ReadRow label="หมายเหตุ" value={decision.values.note} />
          )}
        </>
      )}
      {!decision && approver && (
        <>
          <ButtonRow compact>
            <Input
              variant="table"
              className="flex-1"
              value={note}
              placeholder="หมายเหตุ (ต้องกรอกเมื่อไม่อนุมัติ)"
              aria-label="หมายเหตุการพิจารณา"
              onChange={(event) => setNote(event.target.value)}
            />
            <Button
              variant="danger"
              onClick={() => decide(editDecisions.reject)}
            >
              ไม่อนุมัติ
            </Button>
            <Button
              variant="primary"
              onClick={() => decide(editDecisions.approve)}
            >
              อนุมัติ
            </Button>
          </ButtonRow>
          <FormError error={error} />
        </>
      )}
    </div>
  );
}

/** Every edit request `db` holds: an approver sees all, a requester its own (pass its
 *  visible database). Waiting ones first, then decided ones, newest first. */
export function EditRequestList({
  db,
  role,
  onChanged,
}: {
  db: Database;
  role: Role;
  onChanged: (message: string) => void;
}) {
  const rows = editRequestRows(db);
  const approver = editApprovers.includes(role);
  const waiting = rows.filter((row) => !row.decision).length;
  return (
    <Panel>
      <SectionHeading
        title="คำขอแก้ไขรายการ"
        description={
          approver
            ? `รอพิจารณา ${waiting} รายการ · อนุมัติแล้วระบบใช้ค่าใหม่ทันที ค่าเดิมเก็บไว้ในประวัติ`
            : "คำขอแก้ไขที่บัญชีนี้ส่ง · ขอแก้ได้จากรายการในประวัติด้านล่าง"
        }
      />
      {rows.length ? (
        rows.map((row) => (
          <RequestRow
            key={row.request.id}
            request={row.request}
            decision={row.decision}
            role={role}
            onChanged={onChanged}
          />
        ))
      ) : (
        <EmptyState text="ยังไม่มีคำขอแก้ไข" />
      )}
    </Panel>
  );
}
