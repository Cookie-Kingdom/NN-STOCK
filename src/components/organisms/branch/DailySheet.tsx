"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Combobox } from "@/components/atoms/Combobox";
import { DatePicker } from "@/components/atoms/DatePicker";
import { Input } from "@/components/atoms/Input";
import { MissingMark } from "@/components/atoms/MissingMark";
import { ReadRow } from "@/components/atoms/ReadRow";
import { Caption, Muted } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { Dialog } from "@/components/molecules/Dialog";
import { EmptyState } from "@/components/molecules/EmptyState";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { SegmentedChoice } from "@/components/molecules/SegmentedChoice";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { dateLabel } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import {
  branchItem,
  entries,
  materialList,
  mutate,
  sheetItems,
  sheetNote,
  titles,
  type Database,
  type Material,
  type Sheet,
  type Values,
} from "@/lib/store";
import { cn } from "@/lib/utils";
// A cycle with the page that draws this sheet: both sides use the other at render only.
import { Cell, StockTable } from "./BranchStock";

/** A sheet figure: three decimals at most, as its inputs take. */
const n3 = (x: number) =>
  x.toLocaleString("th-TH", { maximumFractionDigits: 3 });
/** What a figure's input holds, as a number: empty or unreadable is 0 (`mutate` words the
 *  refusal of a bad one on save). */
const num = (text = "") => Number(text) || 0;

/** The branch's opening of `sheet`, the latest by date: the one the opening view edits. */
const openingNote = (db: Database, branch: string, sheet: Sheet) =>
  entries(db, "opening", undefined, branch)
    .filter((e) => e.values.sheet === sheet)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);

/** A card whose table has a line between its columns, as the page's other tables have. */
const lined = "[&_:is(td,th)+:is(td,th)]:border-l";

/** One figure of a row, in its own cell: its input, whose accessible name says the item too,
 *  or once the sheet is locked the saved figure as text. */
function Figure({
  label,
  name,
  value,
  onChange,
  locked,
  className,
  children,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  locked: boolean;
  className?: string;
  /** Under the figure. */
  children?: ReactNode;
}) {
  return (
    <Cell right className={cn("w-28", className)}>
      {locked ? (
        value ? (
          n3(num(value))
        ) : (
          <Muted as="span">—</Muted>
        )
      ) : (
        <Input
          type="number"
          inputMode="decimal"
          step="0.001"
          min="0"
          aria-label={`${label} ${name}`}
          className="mt-0 min-w-20 text-right"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      {children}
    </Cell>
  );
}

const dateField = "mt-0 w-auto min-w-40";

/** The foot of a sheet. Locked (what it shows is saved): 「แก้ไขบันทึก」, which opens the inputs
 *  again. Open: the save, beside 「ยกเลิก」 when there is a saved sheet to go back to. */
function SaveBar({
  caption,
  save,
  locked,
  saving,
  onEdit,
  onCancel,
}: {
  caption: ReactNode;
  /** What the save button says. */
  save: string;
  locked: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-5 py-3 max-md:px-4">
      <Caption>{caption}</Caption>
      {locked ? (
        <Button className="max-md:w-full" onClick={onEdit}>
          แก้ไขบันทึก
        </Button>
      ) : (
        // Never the element 「แก้ไขบันทึก」 was: a button its own click turns into a submit submits.
        <span className="flex gap-2 max-md:w-full">
          {onCancel && <Button onClick={onCancel}>ยกเลิก</Button>}
          <Button
            type="submit"
            variant="primary"
            className="max-md:flex-1"
            disabled={saving}
          >
            {save}
          </Button>
        </span>
      )}
    </div>
  );
}

/** The day's sheet (V2-CAL-10): per row the balance carried forward, what the branch types
 *  (รับเพิ่ม on top of what came in by itself, ใช้ไป, and of that the Waste), under ใช้ไป what
 *  the day's sales and gift boxes took by themselves (ตัดจากยอดขาย, never typed) and what is
 *  left, live. Nothing is refused (V2-RUL-05): below zero is red, an empty reporter or a
 *  Waste with no reason is saved and marked ยังไม่ได้จด. The first save of a day is a `daily`
 *  note, a later one an edit of it. A day that has its note is locked, its figures read as
 *  text, until 「แก้ไขบันทึก」: the lock follows the note, so a save and a change of date set it. */
function DailyForm({
  ws,
  sheet,
  items,
  shown,
  onItem,
}: {
  ws: Workspace;
  sheet: Sheet;
  items: Material[];
  /** The rows the page's search leaves; every row is saved. */
  shown: Material[];
  /** Opens the list item dialog (the materials sheet only). */
  onItem?: (item: Material | "new") => void;
}) {
  const { db, account, today } = ws;
  const branch = account.branch ?? "";
  const [date, setDate] = useState(today);
  /** What was typed since the day was loaded, over the day's saved note. */
  const [edits, setEdits] = useState<Values>({});
  /** 「แก้ไขบันทึก」 was pressed on this day's saved sheet. */
  const [editing, setEditing] = useState(false);
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const note = sheetNote(db, "daily", branch, sheet, date);
  const locked = !!note && !editing;
  /** Back to the day as it is saved. */
  const reset = () => {
    setError("");
    setEdits({});
    setEditing(false);
  };
  const at = (key: string) => edits[key] ?? note?.values[key] ?? "";
  const set = (key: string) => (value: string) => {
    setError("");
    setEdits({ ...edits, [key]: value });
  };
  const dirty = Object.keys(edits).length > 0;
  const day = date === today ? "วันนี้" : "วันนั้น";

  const save = async () => {
    setError("");
    const values: Values = {
      sheet,
      reporter: at("reporter"),
      note: at("note"),
      ...Object.fromEntries(
        items.flatMap(({ id }) => [
          [`received.${id}`, at(`received.${id}`)],
          [`used.${id}`, at(`used.${id}`)],
          [`waste.${id}`, at(`waste.${id}`)],
          // A reason belongs to a Waste: none left behind once the Waste is cleared.
          [
            `reason.${id}`,
            num(at(`waste.${id}`)) > 0 ? at(`reason.${id}`) : "",
          ],
        ]),
      ),
    };
    const next = await run(() => {
      const latest = latestDatabase();
      const saved = sheetNote(latest, "daily", branch, sheet, date);
      return saved
        ? mutate(
            latest,
            account,
            "entryEdit",
            { targetId: saved.id, values: JSON.stringify(values) },
            "",
            today,
          )
        : mutate(latest, account, "daily", values, "", date);
    });
    if (!next) return;
    reset();
    ws.setToast(`จดแล้ว: ${titles.daily} · ${dateLabel(date)}`);
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!locked) save();
      }}
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <FormField label="วันที่บันทึก">
          <DatePicker
            title="วันที่บันทึก"
            max={today}
            className={cn(dateField, "mt-2")}
            value={date}
            onChange={(next) => {
              reset();
              setDate(next);
            }}
          />
        </FormField>
        <Badge
          aria-live="polite"
          tone={dirty ? "warning" : note ? "success" : "neutral"}
          className="mb-3"
        >
          {dirty
            ? "ยังไม่บันทึก"
            : note
              ? `บันทึก${day}แล้ว`
              : `ยังไม่บันทึก${day}`}
        </Badge>
      </div>
      <Caption>
        กรอกแค่รับเพิ่ม ใช้ไป และ waste · คงเหลือ = ยกมา + รับเพิ่ม − ใช้ไป −
        ตัดจากยอดขาย
      </Caption>
      <DayCard
        aria-label="ใบสต๊อกรายวัน"
        title="รายการสินค้า"
        className={lined}
        aside={
          <>
            {shown.length < items.length && (
              <Caption aria-live="polite">
                {shown.length} จาก {items.length} รายการ
              </Caption>
            )}
            {onItem && (
              <Button
                size="sm"
                icon={<Plus aria-hidden />}
                onClick={() => onItem("new")}
              >
                เพิ่มสินค้า
              </Button>
            )}
          </>
        }
      >
        {/* A phone scrolls the table sideways inside the card, as the page's other tables do. */}
        <StockTable
          columns={[
            "สินค้า / ยกมา",
            "รับเพิ่ม",
            "ใช้ไป",
            "Waste / ทิ้ง",
            "คงเหลือ",
          ]}
          right={["รับเพิ่ม", "ใช้ไป", "Waste / ทิ้ง", "คงเหลือ"]}
        >
          {shown.map((item) => {
            const { id, name, unit } = item;
            const info = branchItem(db, branch, id, date);
            const left =
              info.opening +
              info.autoReceived +
              num(at(`received.${id}`)) -
              num(at(`used.${id}`)) -
              info.sold;
            const reason = at(`reason.${id}`).trim();
            return (
              <tr key={id}>
                <Cell className="min-w-28">
                  <span className="font-semibold">{name}</span>
                  <Caption className="block">
                    ยกมา {n3(info.opening)} {unit}
                  </Caption>
                  {onItem && (
                    <Button
                      variant="text"
                      aria-label={`แก้ชื่อ / หน่วย ${name}`}
                      onClick={() => onItem(item)}
                    >
                      แก้ชื่อ / หน่วย
                    </Button>
                  )}
                </Cell>
                <Figure
                  label="รับเพิ่ม"
                  name={name}
                  locked={locked}
                  value={at(`received.${id}`)}
                  onChange={set(`received.${id}`)}
                >
                  {/* A transfer, a payment with a quantity, the meat received: already in. */}
                  {info.autoReceived !== 0 && (
                    <Caption className="mt-1 block font-normal">
                      เข้าเอง {n3(info.autoReceived)}
                    </Caption>
                  )}
                </Figure>
                <Figure
                  label="ใช้ไป"
                  name={name}
                  locked={locked}
                  value={at(`used.${id}`)}
                  onChange={set(`used.${id}`)}
                >
                  {/* The day's sales and gift boxes: taken already, beside what is typed. */}
                  {info.sold !== 0 && (
                    <Caption
                      aria-label={`ตัดจากยอดขาย ${name}`}
                      className="mt-1 block font-normal"
                    >
                      ตัดจากยอดขาย {n3(info.sold)}
                    </Caption>
                  )}
                </Figure>
                {/* Wide enough for the reason, so typing a Waste moves no column. */}
                <Figure
                  label="Waste / ทิ้ง"
                  name={name}
                  locked={locked}
                  className="w-44"
                  value={at(`waste.${id}`)}
                  onChange={set(`waste.${id}`)}
                >
                  {num(at(`waste.${id}`)) > 0 && (
                    <span className="mt-1.5 block font-normal whitespace-normal">
                      {locked ? (
                        reason && <Caption as="span">สาเหตุ: {reason}</Caption>
                      ) : (
                        <Input
                          aria-label={`สาเหตุ waste ${name}`}
                          placeholder="สาเหตุ เช่น ซองชำรุด / หก"
                          className="mt-0 mb-1 min-w-36"
                          value={at(`reason.${id}`)}
                          onChange={(event) =>
                            set(`reason.${id}`)(event.target.value)
                          }
                        />
                      )}
                      {!reason && <MissingMark />}
                    </span>
                  )}
                </Figure>
                <Cell
                  right
                  aria-label={`คงเหลือ ${name}`}
                  tone={left < 0 ? "danger" : undefined}
                  className="text-num-md font-semibold"
                >
                  {n3(left)} <Caption as="span">{unit}</Caption>
                </Cell>
              </tr>
            );
          })}
          {shown.length === 0 && (
            <tr>
              <Cell
                colSpan={5}
                className="py-8 text-center text-text-secondary"
              >
                ไม่พบรายการที่ค้นหา
              </Cell>
            </tr>
          )}
        </StockTable>
        <Caption className="block px-5 py-3 max-md:px-4">
          “ใช้ไป” รวม waste แล้ว · ช่อง waste บันทึกเพื่อดูของเสียเท่านั้น
          ไม่หักสต๊อกซ้ำ · “ตัดจากยอดขาย” เว็บตัดให้เองจากยอดขายและกล่องที่แจก
          ตามส่วนประกอบของสินค้าใน Settings ไม่ต้องพิมพ์ซ้ำใน “ใช้ไป”
        </Caption>
        {locked ? (
          <div className="border-t border-border px-5 py-1 max-md:px-4">
            <ReadRow
              label="ผู้บันทึก"
              value={at("reporter").trim() || <MissingMark />}
            />
            <ReadRow label="หมายเหตุ" value={at("note").trim() || "—"} />
          </div>
        ) : (
          <div className="grid gap-4 border-t border-border px-5 py-4 max-md:px-4 md:grid-cols-2">
            <FormField
              label={
                <>
                  ผู้บันทึก {note && !at("reporter").trim() && <MissingMark />}
                </>
              }
            >
              <Input
                value={at("reporter")}
                onChange={(event) => set("reporter")(event.target.value)}
              />
            </FormField>
            <FormField label="หมายเหตุ" optional>
              <Input
                value={at("note")}
                onChange={(event) => set("note")(event.target.value)}
              />
            </FormField>
          </div>
        )}
        <FormError error={error} className="mx-5 my-3 max-md:mx-4" />
        <SaveBar
          caption={
            <>
              {items.length} รายการสินค้า ·{" "}
              {note
                ? "แก้ไขวันเดิม ไม่ตัดสต๊อกซ้ำ"
                : "ยกยอดคงเหลือไปวันถัดไปอัตโนมัติ"}
            </>
          }
          save="บันทึกการใช้วันนี้"
          locked={locked}
          saving={saving}
          onEdit={() => setEditing(true)}
          onCancel={note && reset}
        />
      </DayCard>
    </form>
  );
}

/** 「ตั้งสต๊อกเริ่มต้น」: what each row holds at the start of a date. The branch has one
 *  opening per sheet: a save after the first edits it (its date too), and every later day is
 *  worked out again from it. A row left empty is not set, so it starts from 0. A saved opening
 *  is locked, its date too, until 「แก้ไขบันทึก」. */
function OpeningForm({
  ws,
  sheet,
  items,
  shown,
  onSaved,
}: {
  ws: Workspace;
  sheet: Sheet;
  items: Material[];
  shown: Material[];
  onSaved: () => void;
}) {
  const { db, account, today } = ws;
  const branch = account.branch ?? "";
  const opening = openingNote(db, branch, sheet);
  const [date, setDate] = useState(opening?.date ?? today);
  const [edits, setEdits] = useState<Values>({});
  const [editing, setEditing] = useState(false);
  const locked = !!opening && !editing;
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const at = (id: string) =>
    edits[`qty.${id}`] ?? opening?.values[`qty.${id}`] ?? "";

  const save = async () => {
    setError("");
    const values: Values = {
      sheet,
      ...Object.fromEntries(items.map(({ id }) => [`qty.${id}`, at(id)])),
    };
    const next = await run(() => {
      const latest = latestDatabase();
      const saved = openingNote(latest, branch, sheet);
      return saved
        ? mutate(
            latest,
            account,
            "entryEdit",
            {
              targetId: saved.id,
              values: JSON.stringify(values),
              toDate: date,
            },
            "",
            today,
          )
        : mutate(latest, account, "opening", values, "", date);
    });
    if (!next) return;
    ws.setToast(`จดแล้ว: ${titles.opening} · ${dateLabel(date)}`);
    onSaved();
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!locked) save();
      }}
    >
      <FormField label="เริ่มนับตั้งแต่วันที่" className="self-start">
        <DatePicker
          title="เริ่มนับตั้งแต่วันที่"
          max={today}
          className={cn(dateField, "mt-2")}
          disabled={locked}
          value={date}
          onChange={(next) => {
            setError("");
            setDate(next);
          }}
        />
      </FormField>
      <Caption>
        เริ่มจากของที่มีอยู่จริง · แก้ไขยอดตั้งต้นได้ ระบบคำนวณคงเหลือทุกวันใหม่
        · ถ้าไม่มี ใส่ 0
      </Caption>
      <DayCard
        aria-label="ตั้งสต๊อกเริ่มต้น"
        title="ของตั้งต้น"
        className={lined}
      >
        <StockTable columns={["สินค้า", "ยอดตั้งต้น"]} right={["ยอดตั้งต้น"]}>
          {shown.map(({ id, name, unit }) => (
            <tr key={id}>
              <Cell className="font-semibold">{name}</Cell>
              <Cell right className="w-56 max-md:w-44">
                <span className="flex items-center justify-end gap-2">
                  {locked ? (
                    at(id) ? (
                      n3(num(at(id)))
                    ) : (
                      <Muted as="span">—</Muted>
                    )
                  ) : (
                    <Input
                      type="number"
                      inputMode="decimal"
                      step="0.001"
                      min="0"
                      aria-label={`ของตั้งต้น ${name}`}
                      className="mt-0 w-32 text-right max-md:w-24"
                      value={at(id)}
                      onChange={(event) => {
                        setError("");
                        setEdits({
                          ...edits,
                          [`qty.${id}`]: event.target.value,
                        });
                      }}
                    />
                  )}
                  <Caption as="span" className="w-12 text-left">
                    {unit}
                  </Caption>
                </span>
              </Cell>
            </tr>
          ))}
        </StockTable>
        <FormError error={error} className="mx-5 my-3 max-md:mx-4" />
        <SaveBar
          caption={<>{items.length} รายการสินค้า</>}
          save="บันทึกของตั้งต้น"
          locked={locked}
          saving={saving}
          onEdit={() => setEditing(true)}
          onCancel={
            opening &&
            (() => {
              setError("");
              setEdits({});
              setDate(opening.date);
              setEditing(false);
            })
          }
        />
      </DayCard>
    </form>
  );
}

const units = ["ชิ้น", "กก.", "กรัม", "ถุง", "กล่อง", "แพ็ก", "ใบ", "ลิตร"];

/** 「เพิ่มรายการสินค้า」 / 「แก้ไขรายการสินค้า」: one row of the material list both branches
 *  read, saved as a `stockItem` note. A name `mutate` refuses (empty, taken) is said beside
 *  the buttons. */
function ItemDialog({
  ws,
  item,
  onClose,
}: {
  ws: Workspace;
  item: Material | "new";
  onClose: () => void;
}) {
  const { account, today } = ws;
  const editing = item === "new" ? undefined : item;
  const [name, setName] = useState(editing?.name ?? "");
  const [unit, setUnit] = useState(editing?.unit ?? units[0]);
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const title = editing ? "แก้ไขรายการสินค้า" : "เพิ่มรายการสินค้า";
  const save = async () => {
    setError("");
    const next = await run(() =>
      mutate(
        latestDatabase(),
        account,
        "stockItem",
        { id: editing?.id ?? "", name, unit },
        "",
        today,
      ),
    );
    if (!next) return;
    ws.setToast(`จดแล้ว: ${titles.stockItem} · ${name.trim()}`);
    onClose();
  };
  return (
    <Dialog size="sm" title={title} onClose={onClose}>
      <form
        noValidate
        className="flex min-h-0 flex-auto flex-col"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <div className="flex flex-col gap-4 overflow-y-auto px-6.5 py-4 max-md:px-4">
          <FormField label="ชื่อสินค้า">
            <Input
              data-autofocus
              value={name}
              onChange={(event) => {
                setError("");
                setName(event.target.value);
              }}
            />
          </FormField>
          <FormField label="หน่วยนับ">
            <Combobox
              options={[
                ...new Set([
                  ...units,
                  ...materialList(ws.db).map((m) => m.unit),
                ]),
              ].map((value) => ({ value }))}
              value={unit}
              onChange={setUnit}
            />
          </FormField>
          <Caption>
            ใช้ร่วมกันทั้งสองสาขา การเปลี่ยนหน่วยเป็นการแก้ชื่อหน่วย
            ไม่แปลงตัวเลขเดิม
          </Caption>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-border px-6.5 py-3 max-md:px-4">
          {error && (
            <span role="alert" className="mr-auto text-body-sm text-danger">
              {error}
            </span>
          )}
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button type="submit" variant="primary" disabled={saving}>
            บันทึก
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** A branch's daily stock sheet, of its own branch always: 「ใบสต๊อกรายวัน」 (`DailyForm`), or
 *  until the sheet has an opening a pointer to 「ตั้งสต๊อกเริ่มต้น」 (`OpeningForm`). `sheet`
 *  "meat" is the Stock page's (fixed rows), "materials" the Inventory page's, whose list the
 *  branch adds to and renames. `word` is the page's search: it hides rows, never from a save. */
export function DailySheet({
  ws,
  sheet,
  word = "",
}: {
  ws: Workspace;
  sheet: Sheet;
  word?: string;
}) {
  const { db } = ws;
  const branch = ws.account.branch ?? "";
  const [view, setView] = useState<"daily" | "opening">("daily");
  const [dialog, setDialog] = useState<Material | "new">();
  const items = sheetItems(db, sheet, branch);
  const shown = items.filter(
    (item) =>
      !word ||
      item.name.toLowerCase().includes(word) ||
      item.sku.toLowerCase().includes(word),
  );
  const opening = openingNote(db, branch, sheet);
  return (
    <div className="flex flex-col gap-4">
      <SegmentedChoice
        label="มุมมอง"
        className="self-start"
        options={[
          { value: "daily", label: titles.daily },
          { value: "opening", label: titles.opening },
        ]}
        value={view}
        onChange={setView}
      />
      {view === "opening" ? (
        <OpeningForm
          ws={ws}
          sheet={sheet}
          items={items}
          shown={shown}
          onSaved={() => setView("daily")}
        />
      ) : opening ? (
        <DailyForm
          ws={ws}
          sheet={sheet}
          items={items}
          shown={shown}
          onItem={sheet === "materials" ? setDialog : undefined}
        />
      ) : (
        <EmptyState
          text={
            <>
              <span className="mb-4 block">
                ตั้งสต๊อกเริ่มต้นของ{branch}ก่อน
              </span>
              <Button variant="primary" onClick={() => setView("opening")}>
                {titles.opening}
              </Button>
            </>
          }
        />
      )}
      {dialog && (
        <ItemDialog
          ws={ws}
          item={dialog}
          onClose={() => setDialog(undefined)}
        />
      )}
    </div>
  );
}
