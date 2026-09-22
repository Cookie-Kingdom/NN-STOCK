"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { ReadRow } from "@/components/atoms/ReadRow";
import { Textarea } from "@/components/atoms/Textarea";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { EntryFieldControl } from "@/components/organisms/shared/EntryForm";
import { SlipList } from "@/components/organisms/shared/InvoiceDownloadButton";
import { forms } from "@/lib/forms";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import {
  editApprovers,
  editBlock,
  editLockedKeys,
  entries,
  entryEdits,
  mutate,
  openEditRequest,
  roleName,
  titles,
  unpack,
  type Database,
  type Entry,
  type Role,
  type Values,
} from "@/lib/store";
import { fmt, today } from "@/lib/format";

const reversibleKinds = [
  "allocate",
  "chiliAllocate",
  "receive",
  "thaw",
  "ricePurchase",
  "chiliPurchase",
  "riceIssue",
  "chiliIssue",
  "rice",
  "riceCarry",
  "sale",
  "influencerBox",
  "materials",
  "materialReceive",
  "generalPurchase",
  "materialTransfer",
  "materialConfirm",
  "closeDay",
  "expense",
  "unlock",
  "shipmentRequest",
];

/** Labels for computed values that are not fields of the entry's form. */
const derivedLabels: Record<string, string> = {
  postSmokeKg: "น้ำหนักผลิตรวม",
  packCount: "จำนวนกล่องรมควัน",
  outboundCost: "ค่ารถขาไป",
  returnCost: "ค่ารถขากลับ",
  revenue: "ยอดขายบันทึก",
  menuTotal: "ยอดตามเมนู",
  chiliAddons: "น้ำพริกที่ขายแยก",
  chiliComplimentary: "น้ำพริกแถม (ยกเลิกแล้ว)",
  riceServings: "ข้าวเหนียวในกล่อง",
  chiliSold: "น้ำพริกที่ตัดสต๊อกรวม",
  allocation: "ใบจัดสรร",
  batches: "Log สโมคที่แก้ไข",
  meatCost: "ต้นทุนเนื้อที่ตัดสต๊อก",
  wasteCost: "ต้นทุนเนื้อ Waste",
  revision: "บันทึกครั้งที่",
  correctionReason: "เหตุผลที่แก้ไข",
  lines: "PO ที่ขอส่ง",
  requestedKg: "น้ำหนักที่ขอส่งรวม (กก.)",
  reason: "เหตุผล",
  decision: "ผลการพิจารณา",
  note: "หมายเหตุ",
};

export const fieldLabel = (kind: string, key: string) =>
  forms[kind]?.find((f) => f.key === key)?.label || derivedLabels[key] || key;

const at = (iso: string) => new Date(iso).toLocaleString("th-TH");

/** A Request's `lines` JSON as one "PO-2026-0001 × 300.00 กก." per line. */
function requestLines(value: string, db?: Database) {
  try {
    const lines: { lotId?: string; kg?: string }[] = JSON.parse(value);
    return lines
      .map((line) => {
        const po = db?.lots.find((l) => l.id === line.lotId)?.poId;
        return `${po || line.lotId} × ${fmt(Number(line.kg))} กก.`;
      })
      .join("\n");
  } catch {
    return value;
  }
}

/** Before → after of an edit, request or decision: only the values it changes. */
export function EditDiff({ values }: { values: Values }) {
  const from = unpack("from.", values),
    to = unpack("to.", values);
  const changed = Object.keys(to).filter((k) => (from[k] ?? "") !== to[k]);
  return changed.length ? (
    changed.map((k) => (
      <ReadRow
        key={k}
        label={fieldLabel(values.targetKind, k)}
        value={`${from[k] || "–"} → ${to[k] || "–"}`}
      />
    ))
  ) : (
    <ReadRow label="ค่าที่แก้" value="ไม่มีค่าที่เปลี่ยน" />
  );
}

/** The entry's own form, prefilled with its current values, plus the reason. An approver's
 *  save applies at once; anyone else's is a request the approver decides. */
export function EditEntryForm({
  entry,
  request,
  error,
  onCancel,
  onSubmit,
}: {
  entry: Entry;
  request: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (values: Values, reason: string) => void;
}) {
  const fields = (forms[entry.kind] ?? []).filter(
    (f) =>
      f.type !== "file" &&
      f.type !== "files" &&
      !editLockedKeys.includes(f.key),
  );
  const [values, setValues] = useState<Values>(() => ({ ...entry.values }));
  const [reason, setReason] = useState("");
  const noop = () => {};
  return (
    <form
      className="mt-3.5 border-t border-border pt-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(
          Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? ""])),
          reason,
        );
      }}
    >
      <Notice>
        {request
          ? "ส่งคำขอให้ Owner พิจารณา · ค่าจะเปลี่ยนเมื่ออนุมัติแล้วเท่านั้น"
          : "บันทึกแล้วค่าใหม่ใช้ทันที · ประวัติเก็บค่าเดิม เหตุผล และเวลาไว้"}
      </Notice>
      <FormGrid>
        {fields.map((f, index) => (
          <EntryFieldControl
            key={f.key}
            field={f}
            autoFocus={index === 0}
            values={values}
            set={(key, value) => setValues((old) => ({ ...old, [key]: value }))}
            onFile={noop}
            files={[]}
            onFiles={noop}
            onFileError={noop}
          />
        ))}
        <FormField label={request ? "เหตุผลที่ขอแก้ไข" : "เหตุผลที่แก้ไข"} wide>
          <Textarea
            compact
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>
      </FormGrid>
      <FormError error={error ?? ""} />
      <ButtonRow compact>
        <Button type="button" onClick={onCancel}>
          กลับ
        </Button>
        <Button type="submit" variant="primary">
          {request ? "ส่งคำขอแก้ไข" : "บันทึกการแก้ไข"}
        </Button>
      </ButtonRow>
    </form>
  );
}

/** Who changed this entry and when: each applied edit with its before → after. */
function EditTrail({ db, edits }: { db: Database; edits: Entry[] }) {
  return (
    <div className="mt-3.5 grid gap-2 border-t border-border pt-3.5">
      <strong className="text-body-sm">ประวัติการแก้ไข</strong>
      {edits.map((edit) => {
        const request =
          edit.kind === "editDecision"
            ? entries(db, "editRequest").find(
                (e) => e.id === edit.values.requestId,
              )
            : undefined;
        return (
          <div key={edit.id} className="rounded-md bg-surface-sunken px-3">
            <ReadRow
              label="ผู้แก้ไข"
              value={
                request
                  ? `ขอโดย ${roleName[request.role]}${request.role === "branch" ? ` ${request.branch}` : ""} · ${at(request.at)}\nอนุมัติโดย ${roleName[edit.role]} · ${at(edit.at)}`
                  : `${roleName[edit.role]} แก้ไขโดยตรง · ${at(edit.at)}`
              }
            />
            <ReadRow
              label="เหตุผล"
              value={request?.values.reason || edit.values.reason || "–"}
            />
            <EditDiff values={edit.values} />
          </div>
        );
      })}
    </div>
  );
}

export function EntryDetails({
  entry: e,
  db,
  role,
  branch = "",
  voided = false,
  hideSales = false,
  open,
  onChanged,
}: {
  entry: Entry;
  /** The log as `role` sees it: resolves PO numbers, edits and open requests. */
  db?: Database;
  role: Role;
  branch?: string;
  /** A later "void" entry targets this one: no second cancel. */
  voided?: boolean;
  /** Its sales money was stripped (Account Manager): editing a sale would save it blank. */
  hideSales?: boolean;
  /** Start expanded (stories). */
  open?: boolean;
  onChanged: (message: string) => void;
}) {
  const [mode, setMode] = useState<"" | "cancel" | "edit">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const owner = role === "owner";
  const approver = editApprovers.includes(role);
  const reversible = reversibleKinds.includes(e.kind) && !voided;
  const edits = db ? entryEdits(db, e.id) : [];
  // Current values: the entry with its edits applied (entries() does the overlay).
  const current =
    (edits.length && db && entries(db, e.kind).find((x) => x.id === e.id)) || e;
  const pending = db ? openEditRequest(db, e.id) : undefined;
  const editable =
    !!db &&
    !voided &&
    !(hideSales && e.kind === "sale") &&
    !editBlock(db, e, role, branch);
  const run = (kind: string, values: Values, done: string, fail: string) => {
    setError("");
    try {
      saveDatabase(
        mutate(latestDatabase(), role, kind, values, "", today(), branch),
      );
      setMode("");
      onChanged(done);
    } catch (error) {
      setError(error instanceof Error ? error.message : fail);
    }
  };
  const isEdit = ["entryEdit", "editRequest", "editDecision"].includes(e.kind);
  return (
    <details open={open} className="border-b border-border py-3.5">
      <summary>
        <span>
          {titles[e.kind] || e.kind}
          {isEdit &&
            e.values.targetKind &&
            ` · ${titles[e.values.targetKind]}`}{" "}
          <small>
            {/* A void has no lot, and its branch is only the config default. */}
            {[
              isEdit ? e.values.targetDate : e.date,
              e.kind === "void" ? "" : e.lotId || e.branch,
              roleName[e.role],
            ]
              .filter(Boolean)
              .join(" · ")}
            {voided && " · ยกเลิกแล้ว"}
          </small>
          {/* Recorded on a later Bangkok day than its business date: owner audits these. */}
          {!isEdit &&
            e.date <
              new Date(e.at).toLocaleDateString("en-CA", {
                timeZone: "Asia/Bangkok",
              }) && (
              <Badge tone="warning" className="ml-2">
                บันทึกย้อนหลัง
              </Badge>
            )}
          {edits.length > 0 && (
            <Badge tone="warning" className="ml-2">
              แก้ไขแล้ว
            </Badge>
          )}
          {pending && <Badge className="ml-2">มีคำขอแก้ไขรอพิจารณา</Badge>}
          {e.kind === "editDecision" && (
            <Badge
              tone={e.values.decision === "อนุมัติ" ? "success" : "danger"}
              className="ml-2"
            >
              {e.values.decision}
            </Badge>
          )}
          {/* The review's outcome and note to Chef House, readable without expanding. */}
          {e.kind === "invoiceReview" && (
            <small>
              {e.values.decision}
              {e.values.comment?.trim() &&
                ` · หมายเหตุถึง Chef House: ${e.values.comment.trim()}`}
            </small>
          )}
        </span>
        <span>ดูรายละเอียด</span>
      </summary>
      {isEdit ? (
        <>
          {["reason", "decision", "note"]
            .filter((k) => e.values[k])
            .map((k) => (
              <ReadRow
                key={k}
                label={fieldLabel(e.kind, k)}
                value={e.values[k]}
              />
            ))}
          <EditDiff values={e.values} />
        </>
      ) : (
        Object.entries(current.values)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => (
            <ReadRow
              key={k}
              label={fieldLabel(e.kind, k)}
              value={
                k === "slips" ? (
                  <SlipList value={v} />
                ) : k === "lines" &&
                  ["shipmentRequest", "shipmentRequestEdit"].includes(
                    e.kind,
                  ) ? (
                  <span className="whitespace-pre-line">
                    {requestLines(v, db)}
                  </span>
                ) : (
                  v
                )
              }
            />
          ))
      )}
      <small className="text-text-secondary">บันทึก {at(e.at)}</small>
      {db && edits.length > 0 && <EditTrail db={db} edits={edits} />}
      {mode === "edit" ? (
        <EditEntryForm
          entry={current}
          request={!approver}
          error={error}
          onCancel={() => setMode("")}
          onSubmit={(values, why) =>
            run(
              approver ? "entryEdit" : "editRequest",
              { targetId: e.id, values: JSON.stringify(values), reason: why },
              approver
                ? "แก้ไขรายการแล้ว ระบบคำนวณยอดใหม่และเก็บค่าเดิมไว้ในประวัติ"
                : "ส่งคำขอแก้ไขแล้ว รอ Owner พิจารณา · ผลจะแจ้งที่กระดิ่ง",
              "บันทึกการแก้ไขไม่สำเร็จ",
            )
          }
        />
      ) : (
        <>
          <FormError error={error} className="mt-3.5" />
          {((editable && !(pending && !approver)) || (owner && reversible)) && (
            <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-border pt-3.5">
              {mode === "cancel" ? (
                <>
                  <Input
                    variant="table"
                    reason
                    className="flex-1"
                    value={reason}
                    placeholder="เหตุผลที่ยกเลิกรายการ"
                    aria-label="เหตุผลที่ยกเลิกรายการ"
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Button onClick={() => setMode("")}>กลับ</Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      run(
                        "void",
                        { targetId: e.id, reason },
                        "ยกเลิกรายการแล้ว ระบบคำนวณยอดใหม่และเก็บเหตุผลไว้ในประวัติ",
                        "ยกเลิกรายการไม่สำเร็จ",
                      )
                    }
                  >
                    ยืนยันยกเลิก
                  </Button>
                </>
              ) : (
                <ButtonRow className="my-0">
                  {editable && !(pending && !approver) && (
                    <Button onClick={() => setMode("edit")}>
                      {approver ? "แก้ไข" : "ขอแก้ไข"}
                    </Button>
                  )}
                  {owner && reversible && (
                    <Button onClick={() => setMode("cancel")}>
                      แก้รายการผิดด้วยการยกเลิก
                    </Button>
                  )}
                </ButtonRow>
              )}
            </div>
          )}
        </>
      )}
    </details>
  );
}
