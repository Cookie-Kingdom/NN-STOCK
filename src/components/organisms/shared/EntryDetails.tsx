"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { MissingMark } from "@/components/atoms/MissingMark";
import { ReadRow } from "@/components/atoms/ReadRow";
import { Select } from "@/components/atoms/Select";
import { Textarea } from "@/components/atoms/Textarea";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { EntryFieldControl } from "@/components/organisms/shared/EntryForm";
import { SlipList } from "@/components/molecules/AttachmentButton";
import { LinkDialog } from "@/components/organisms/shared/LinkDialog";
import { SmokeOrderLines } from "@/components/organisms/owner/SmokeOrderLines";
import {
  canLink,
  isLinked,
  linkOf,
  linkableKinds,
  lotName,
  referenceText,
} from "@/components/organisms/shared/entryReferences";
import { editFields, forms } from "@/lib/forms";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import {
  batchKinds,
  changeKinds,
  editBlock,
  dateField,
  editLockedKeys,
  entries,
  entryEdits,
  check,
  isVoided,
  lotMovableKinds,
  missingKeys,
  missingText,
  mutate,
  entryBy,
  poRemainingKg,
  purchaseLots,
  saleMoneyKeys,
  shipments,
  titles,
  unpack,
  voidBlock,
  type Database,
  type Entry,
  type ActingRole,
  type Values,
  type EntryKind,
} from "@/lib/store";
import { today } from "@/lib/format";

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
  chiliExpected: "น้ำพริกที่ควรเหลือตอนนับ",
  allocation: "ใบจัดสรร",
  batches: "Log สโมคที่แก้ไข",
  // chefEdit has no form of its own: its `missing` names these round fields.
  preSmokeKg: "น้ำหนักก่อนสโมค",
  smokeDate: "วันที่สโมค",
  inputKg: "น้ำหนักเข้าเตา",
  wasteKg: "Waste",
  packs: "น้ำหนักกล่องรมควัน",
  meatCost: "ต้นทุนเนื้อที่ตัดสต๊อก",
  wasteCost: "ต้นทุนเนื้อ Waste",
  revision: "บันทึกครั้งที่",
  correctionReason: "เหตุผลที่แก้ไข",
  lines: "PO ที่ขอส่ง",
  requestedKg: "น้ำหนักที่ขอส่งรวม (กก.)",
  reason: "เหตุผล",
  decision: "ผลการพิจารณา",
  note: "หมายเหตุ",
  orderId: "PO รมควัน",
  invoiceId: "Invoice ค่ารมควัน",
  targetId: "รายการที่ผูก",
  lotId: "ชุดรมควัน",
  material: "วัสดุ",
  receivedQuantity: "จำนวนที่รับ",
  receiver: "ผู้รับ",
};

/** A `link` repeats its target's kind, date, role and branch for the SQL check; the target's
 *  name already says them. */
const linkEchoKeys = ["targetKind", "targetDate", "targetRole", "targetBranch"];

const fieldLabel = (kind: string, key: string) =>
  editFields(kind as EntryKind).find((f) => f.key === key)?.label ||
  forms[kind]?.find((f) => f.key === key)?.label ||
  derivedLabels[key] ||
  titles[key as EntryKind] || // closeDay's unfinished checklist items
  key;

const at = (iso: string) => new Date(iso).toLocaleString("th-TH");

/** Who wrote an entry, a branch account with its branch: "ผู้ดูแลสาขา ศาลาแดง". */
export const entryWho = (e: Entry) =>
  `${entryBy(e)}${e.role === "branch" ? ` ${e.branch}` : ""}`;

/** A delete (`void`) by what it deletes (EDT-23): an entry, an edit or a link (that undoes
 *  it) or another delete (that puts the entry back). */
export const voidWords = (kind: EntryKind) =>
  kind === "void"
    ? {
        button: "กู้คืนรายการ",
        confirm: "ยืนยันกู้คืน",
        done: "กู้คืนรายการแล้ว ระบบคำนวณยอดใหม่",
        fail: "กู้คืนรายการไม่สำเร็จ",
      }
    : kind === "entryEdit" || kind === "link"
      ? {
          button: "ย้อนกลับ",
          confirm: "ยืนยันย้อนกลับ",
          done: "ย้อนกลับแล้ว ระบบใช้ค่าเดิมและคำนวณยอดใหม่",
          fail: "ย้อนกลับไม่สำเร็จ",
        }
      : {
          button: "ลบรายการ",
          confirm: "ยืนยันลบ",
          done: "ลบรายการแล้ว ระบบคำนวณยอดใหม่ · กู้คืนได้ที่ประวัติการแก้ไขและลบ",
          fail: "ลบรายการไม่สำเร็จ",
        };

/** What the delete of another change is called. */
const undoTitles: Partial<Record<EntryKind, string>> = {
  void: "กู้คืนรายการ",
  entryEdit: "ย้อนกลับการแก้ไข",
  link: "ย้อนกลับการผูก",
};

/** What a change (an edit, a link, a delete) did, and the entry it is about by its title,
 *  date and lot, as far as `db` names them. An undo names the change it undoes, which names
 *  the entry. */
export function changeOf(db: Database | undefined, e: Entry) {
  const find = (id = "") => db?.entries.find((x) => x.id === id);
  const target = find(e.values.targetId);
  const targetKind = e.values.targetKind || target?.kind;
  const undo =
    e.kind === "void" ? undoTitles[targetKind as EntryKind] : undefined;
  const about = undo ? find(target?.values.targetId) : target;
  const kind = undo ? target?.values.targetKind : targetKind;
  return {
    title: undo || titles[e.kind] || e.kind,
    name: [
      titles[kind as EntryKind] || kind,
      undo ? target?.values.targetDate : e.values.targetDate || target?.date,
      about?.lotId && lotName(db, about.lotId),
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/** Before → after of an edit: only the values it changes, and where it moved the entry (its
 *  date, its lot; `db` names the lots). */
export function EditDiff({ values, db }: { values: Values; db?: Database }) {
  const from = unpack("from.", values),
    to = unpack("to.", values);
  const rows = [
    ...Object.keys(to)
      .filter((k) => k !== "missing" && (from[k] ?? "") !== to[k])
      .map((k) => [
        k,
        fieldLabel(values.targetKind, k),
        `${from[k] || "–"} → ${to[k] || "–"}`,
      ]),
    ...(values.toDate
      ? [["toDate", "วันที่ทำรายการ", `${values.fromDate} → ${values.toDate}`]]
      : []),
    ...(values.toLotId
      ? [
          [
            "toLotId",
            "Lot",
            `${lotName(db, values.fromLotId)} → ${lotName(db, values.toLotId)}`,
          ],
        ]
      : []),
  ];
  return rows.length ? (
    rows.map(([key, label, value]) => (
      <ReadRow key={key} label={label} value={value} />
    ))
  ) : (
    <ReadRow label="ค่าที่แก้" value="ไม่มีค่าที่เปลี่ยน" />
  );
}

/** The entry's own form, prefilled with its current values, plus its date, its lot (the
 *  kinds an edit may move, EDT-24) and the reason. The save applies at once, for any account
 *  that may edit the entry (EDT-22). */
export function EditEntryForm({
  entry,
  db,
  error,
  hideSales = false,
  initialReason = "",
  onCancel,
  onSubmit,
}: {
  entry: Entry;
  /** The log, for a smoke PO's purchase-PO lines (SMK-05) and the lots an entry moves to. */
  db?: Database;
  error?: string;
  /** Account Manager: the form has no sale-money field, and the save sends none (C4). */
  hideSales?: boolean;
  /** Starts the reason box, for an edit opened for one purpose (RET-07's PO match). */
  initialReason?: string;
  onCancel: () => void;
  /** `moved`: `toDate` and `toLotId`, each only when it changed. */
  onSubmit: (values: Values, reason: string, moved: Values) => void;
}) {
  const fields = editFields(entry.kind).filter(
    (f) =>
      !editLockedKeys.includes(f.key) &&
      !(hideSales && saleMoneyKeys.includes(f.key)),
  );
  const [date, setDate] = useState(entry.date);
  const [lotId, setLotId] = useState(entry.lotId);
  // Only the Owner's kinds move (a branch never gets this form for one): to another batch,
  // or to another purchase PO.
  const onBatch = batchKinds.includes(entry.kind);
  const lots =
    db && lotMovableKinds.includes(entry.kind)
      ? onBatch
        ? shipments(db)
        : purchaseLots(db)
      : undefined;
  const [values, setValues] = useState<Values>(() => {
    const start = { ...entry.values };
    // A place typed by hand is not among the select's options: it goes back under "อื่น ๆ".
    for (const f of fields)
      if (
        f.type === "location" &&
        start[f.key] &&
        !f.options!.includes(start[f.key])
      ) {
        start[`${f.key}Custom`] = start[f.key];
        start[f.key] = "อื่น ๆ";
      }
    return start;
  });
  const [reason, setReason] = useState(initialReason);
  // SMK-05: a smoke PO's lines are edited with the same table the new PO form uses.
  const own: Record<string, number> = Object.fromEntries(
    (JSON.parse(entry.values.lines || "[]") as Values[]).map((line) => [
      line.lotId,
      Number(line.kg),
    ]),
  );
  const [kg, setKg] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(own).map(([id, v]) => [id, String(v)])),
  );
  const linePos =
    db && entry.kind === "smokeOrder"
      ? purchaseLots(db).filter(
          (po) => po.id in own || poRemainingKg(db, po.id) > 0.001,
        )
      : undefined;
  const noop = () => {};
  return (
    <form
      className="mt-3.5 border-t border-border pt-3.5"
      // noValidate: a field left empty is saved and marked (GEN-02), in an edit too; the
      // browser's own "fill out this field" would stop an edit that fills only one of them.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        // "อื่น ๆ" with a place typed saves the place; left empty it stays "อื่น ๆ".
        const resolved = { ...values };
        for (const f of fields)
          if (f.type === "location" && resolved[f.key] === "อื่น ๆ")
            resolved[f.key] = resolved[`${f.key}Custom`]?.trim() || "อื่น ๆ";
        onSubmit(
          {
            ...Object.fromEntries(
              fields.map((f) => [f.key, resolved[f.key] ?? ""]),
            ),
            ...(linePos && {
              lines: JSON.stringify(
                linePos
                  .filter((po) => kg[po.id]?.trim())
                  .map((po) => ({ lotId: po.id, kg: kg[po.id].trim() })),
              ),
            }),
          },
          reason,
          {
            ...(date && date !== entry.date && { toDate: date }),
            ...(lotId !== entry.lotId && { toLotId: lotId }),
          },
        );
      }}
    >
      <Notice>
        บันทึกแล้วค่าใหม่ใช้ทันที · ประวัติเก็บค่าเดิม เหตุผล และเวลาไว้ ·
        ย้อนกลับได้
      </Notice>
      {db && linePos && (
        <SmokeOrderLines
          db={db}
          pos={linePos}
          kg={kg}
          own={own}
          onLine={(poId, value) => setKg((old) => ({ ...old, [poId]: value }))}
        />
      )}
      <FormGrid>
        {/* A date that is one of the kind's own fields is edited there. */}
        {!dateField[entry.kind] && (
          <FormField label="วันที่ทำรายการ">
            <Input
              type="date"
              max={today()}
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </FormField>
        )}
        {lots && (
          <FormField label={onBatch ? "ชุดรมควัน" : "PO ซื้อ"}>
            <Select
              value={lotId}
              onChange={(event) => setLotId(event.target.value)}
            >
              {/* The lot it sits on, when that one is deleted or was never named. */}
              {!lots.some((lot) => lot.id === entry.lotId) && (
                <option value={entry.lotId}>{lotName(db, entry.lotId)}</option>
              )}
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lotName(db, lot.id)}
                </option>
              ))}
            </Select>
          </FormField>
        )}
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
        <FormField label="เหตุผลที่แก้ไข" optional wide>
          <Textarea
            compact
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
          บันทึกการแก้ไข
        </Button>
      </ButtonRow>
    </form>
  );
}

/** Who changed this entry and when: each applied edit with its before → after. */
function EditTrail({ db, edits }: { db?: Database; edits: Entry[] }) {
  return (
    <div className="mt-3.5 grid gap-2 border-t border-border pt-3.5">
      <strong className="text-body-sm">ประวัติการแก้ไข</strong>
      {edits.map((edit) => (
        <div key={edit.id} className="rounded-md bg-surface-sunken px-3">
          <ReadRow
            label="ผู้แก้ไข"
            value={`${entryWho(edit)} แก้ไข · ${at(edit.at)}`}
          />
          <ReadRow label="เหตุผล" value={edit.values.reason || "–"} />
          <EditDiff values={edit.values} db={db} />
        </div>
      ))}
    </div>
  );
}

export function EntryDetails({
  entry: e,
  db,
  role,
  branch = "",
  hideSales = false,
  lookup: lookupProp,
  open,
  onChanged,
}: {
  entry: Entry;
  /** The log as `role` sees it: resolves PO numbers and edits. */
  db?: Database;
  role: ActingRole;
  branch?: string;
  /** Its sales money was stripped (Account Manager): the edit form leaves the money fields
   *  out, and the server keeps the money as it is (restore_sale_money). */
  hideSales?: boolean;
  /** The whole log this account holds (not only its own entries): names the documents an
   *  entry refers to (a branch's allocation is the Owner's), finds its live `link`, lists
   *  what it can be linked to and says whether it is deleted and may be changed (what
   *  `mutate` will check). Defaults to `db`. */
  lookup?: Database;
  /** Start expanded (stories). */
  open?: boolean;
  onChanged: (message: string) => void;
}) {
  const [mode, setMode] = useState<"" | "delete" | "edit" | "link">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const lookup = lookupProp ?? db;
  // Deleted, or for an edit, a link or a delete: undone (EDT-23).
  const voided = !!lookup && isVoided(lookup, e.id);
  const edits = db ? entryEdits(db, e.id) : [];
  // As it stands now: values, date and lot with its edits applied (entries() does the
  // overlay); a deleted entry is not among them and reads as it was recorded.
  const edited = (db && entries(db, e.kind).find((x) => x.id === e.id)) || e;
  /* Its live link, read from the whole log: an Owner's void of a branch's link is not among
   * the branch's own entries. The link only ever sets `lotId`. */
  const link = linkOf(lookup, e.id);
  const current = link
    ? { ...edited, lotId: link.values.lotId || edited.lotId }
    : edited;
  const linkable = !!lookup && !voided && canLink(e, role, branch);
  // EDT-22/20: any account edits and deletes what `canChange` lets it, directly.
  const editable = !!lookup && !editBlock(lookup, e, role, branch);
  const deletable = !!lookup && !voidBlock(lookup, e, role, branch);
  const words = voidWords(e.kind);
  const run = (kind: EntryKind, values: Values, done: string, fail: string) => {
    setError("");
    let next = undefined as Database | undefined;
    // A stock left below zero is only a warning: it is said with the result, and saved.
    const { warnings, error } = check(() => {
      next = mutate(latestDatabase(), role, kind, values, "", today(), branch);
    });
    if (!next) return setError(error || fail);
    saveDatabase(next);
    setMode("");
    onChanged([done, ...warnings].join(" · "));
  };
  // Rows about another entry. The request kinds are retired; an old log may still hold some.
  const isEdit = ["entryEdit", "void", "editRequest", "editDecision"].includes(
    e.kind,
  );
  const change = isEdit || e.kind === "link" ? changeOf(lookup, e) : undefined;
  const missing = missingKeys(current.values);
  return (
    <details open={open} className="border-b border-border py-3.5">
      <summary>
        <span>
          {change
            ? [change.title, change.name].filter(Boolean).join(" · ")
            : titles[e.kind] || e.kind}{" "}
          <small>
            {(change
              ? [entryWho(e)]
              : [current.date, current.lotId || e.branch, entryBy(e)]
            )
              .filter(Boolean)
              .join(" · ")}
          </small>
          {voided && (
            <Badge
              tone={changeKinds.includes(e.kind) ? "neutral" : "danger"}
              className="ml-2"
            >
              {changeKinds.includes(e.kind) ? "ย้อนกลับแล้ว" : "ลบแล้ว"}
            </Badge>
          )}
          {/* Recorded on a later Bangkok day than its business date: owner audits these. */}
          {!change &&
            current.date <
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
          {/* LNK-04: a linked target and the link itself; branch meat still in the bucket. */}
          {((e.kind === "link" && !voided) || (link && isLinked(current))) && (
            <Badge tone="success" className="ml-2">
              ผูกแล้ว
            </Badge>
          )}
          {linkableKinds.includes(e.kind) && !voided && !isLinked(current) && (
            <Badge tone="warning" className="ml-2">
              ยังไม่ผูก Lot
            </Badge>
          )}
          {!isEdit && missing.length > 0 && (
            <Badge tone="warning" className="ml-2">
              {missingText} {missing.length} ช่อง
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
          {e.kind !== "void" && <EditDiff values={e.values} db={lookup} />}
        </>
      ) : (
        <>
          {linkableKinds.includes(e.kind) && (
            <ReadRow
              label={derivedLabels.lotId}
              value={lotName(lookup, current.lotId)}
            />
          )}
          {Object.entries(current.values)
            .filter(
              ([k, v]) =>
                v !== "" &&
                k !== "missing" &&
                !missing.includes(k) &&
                !(e.kind === "link" && linkEchoKeys.includes(k)),
            )
            .map(([k, v]) => {
              const reference = referenceText(lookup, k, v);
              return (
                <ReadRow
                  key={k}
                  label={fieldLabel(e.kind, k)}
                  value={
                    k === "slips" ? (
                      <SlipList value={v} />
                    ) : reference !== undefined ? (
                      <span className="whitespace-pre-line">{reference}</span>
                    ) : (
                      v
                    )
                  }
                />
              );
            })}
          {missing.map((k) => (
            <ReadRow
              key={k}
              label={fieldLabel(e.kind, k)}
              value={<MissingMark />}
            />
          ))}
        </>
      )}
      <small className="text-text-secondary">บันทึก {at(e.at)}</small>
      {edits.length > 0 && <EditTrail db={lookup} edits={edits} />}
      {mode === "edit" ? (
        <EditEntryForm
          entry={current}
          db={db}
          error={error}
          hideSales={hideSales}
          onCancel={() => setMode("")}
          onSubmit={(values, why, moved) =>
            run(
              "entryEdit",
              {
                targetId: e.id,
                values: JSON.stringify(values),
                reason: why,
                ...moved,
              },
              "แก้ไขรายการแล้ว ระบบคำนวณยอดใหม่และเก็บค่าเดิมไว้ในประวัติ",
              "บันทึกการแก้ไขไม่สำเร็จ",
            )
          }
        />
      ) : (
        <>
          <FormError error={error} className="mt-3.5" />
          {(editable || deletable || linkable) && (
            <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-border pt-3.5">
              {mode === "delete" ? (
                <>
                  <Input
                    variant="table"
                    reason
                    className="flex-1"
                    value={reason}
                    placeholder="เหตุผล (ถ้ามี)"
                    aria-label="เหตุผล"
                    onChange={(event) => setReason(event.target.value)}
                  />
                  <Button onClick={() => setMode("")}>กลับ</Button>
                  <Button
                    variant={e.kind === "void" ? "primary" : "danger"}
                    onClick={() =>
                      run(
                        "void",
                        { targetId: e.id, reason },
                        words.done,
                        words.fail,
                      )
                    }
                  >
                    {words.confirm}
                  </Button>
                </>
              ) : (
                <ButtonRow className="my-0">
                  {editable && (
                    <Button onClick={() => setMode("edit")}>แก้ไข</Button>
                  )}
                  {linkable && (
                    <Button onClick={() => setMode("link")}>
                      {isLinked(current) ? "เปลี่ยนการผูก…" : "ผูกกับ…"}
                    </Button>
                  )}
                  {deletable && (
                    <Button onClick={() => setMode("delete")}>
                      {words.button}
                    </Button>
                  )}
                </ButtonRow>
              )}
            </div>
          )}
          {mode === "link" && lookup && (
            <LinkDialog
              entry={current}
              db={lookup}
              role={role}
              branch={branch}
              onClose={() => setMode("")}
              onLinked={(message) => {
                setMode("");
                onChanged(message);
              }}
            />
          )}
        </>
      )}
    </details>
  );
}
