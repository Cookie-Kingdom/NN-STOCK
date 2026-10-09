"use client";

import { useState, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Combobox } from "@/components/atoms/Combobox";
import { Input } from "@/components/atoms/Input";
import { MissingMark } from "@/components/atoms/MissingMark";
import { Caption } from "@/components/atoms/Text";
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

/** The columns of a row from md up; a phone stacks the name, the three inputs side by side,
 *  then what is left. */
const grid =
  "grid gap-x-3 gap-y-2 px-5 max-md:grid-cols-3 max-md:px-4 md:grid-cols-[minmax(0,1fr)_repeat(3,7.5rem)_8.5rem] md:items-start";

/** One figure of a row: its label shows on a phone only (the header row names it from md
 *  up), its accessible name says the item too. */
function Figure({
  label,
  name,
  value,
  onChange,
  children,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  /** Under the input. */
  children?: ReactNode;
}) {
  return (
    <label className="block min-w-0 text-caption font-medium text-text-secondary">
      <span className="md:sr-only">{label}</span>
      <Input
        type="number"
        inputMode="decimal"
        step="0.001"
        min="0"
        aria-label={`${label} ${name}`}
        className="mt-1 text-right md:mt-0"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {children}
    </label>
  );
}

const dateField = "mt-0 w-auto min-w-40";
const saveBar =
  "flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-border px-5 py-3 max-md:px-4";

/** The day's sheet (V2-CAL-10): per row the balance carried forward, what the branch types
 *  (รับเพิ่ม on top of what came in by itself, ใช้ไป, and of that the Waste) and what is
 *  left, live. Nothing is refused (V2-RUL-05): below zero is red, an empty reporter or a
 *  Waste with no reason is saved and marked ยังไม่ได้จด. The first save of a day is a `daily`
 *  note, a later one an edit of it. */
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
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const note = sheetNote(db, "daily", branch, sheet, date);
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
    setEdits({});
    ws.setToast(`จดแล้ว: ${titles.daily} · ${dateLabel(date)}`);
  };

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        save();
      }}
    >
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <FormField label="วันที่บันทึก">
          <Input
            type="date"
            max={today}
            className={cn(dateField, "mt-2")}
            value={date}
            onChange={(event) => {
              setError("");
              setEdits({});
              setDate(event.target.value);
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
        กรอกแค่รับเพิ่ม ใช้ไป และ waste · คงเหลือ = ยกมา + รับเพิ่ม − ใช้ไป
      </Caption>
      <DayCard
        aria-label="ใบสต๊อกรายวัน"
        title="รายการสินค้า"
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
        <div
          aria-hidden
          className={cn(
            grid,
            "border-b border-border py-2 text-caption font-semibold text-text-secondary max-md:hidden [&>*:not(:first-child)]:text-right",
          )}
        >
          <span>สินค้า / ยกมา</span>
          <span>รับเพิ่ม</span>
          <span>ใช้ไป</span>
          <span>Waste / ทิ้ง</span>
          <span>คงเหลือ</span>
        </div>
        <ul className="m-0 list-none p-0">
          {shown.map((item) => {
            const { id, name, unit } = item;
            const info = branchItem(db, branch, id, date);
            const left =
              info.opening +
              info.autoReceived +
              num(at(`received.${id}`)) -
              num(at(`used.${id}`));
            const wasted = num(at(`waste.${id}`)) > 0;
            return (
              <li
                key={id}
                aria-label={name}
                className={cn(grid, "border-b border-border py-3")}
              >
                <div className="min-w-0 max-md:col-span-3">
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
                </div>
                <Figure
                  label="รับเพิ่ม"
                  name={name}
                  value={at(`received.${id}`)}
                  onChange={set(`received.${id}`)}
                >
                  {/* A transfer, a payment with a quantity, the meat received: already in. */}
                  {info.autoReceived !== 0 && (
                    <Caption className="mt-1 block text-right font-normal">
                      เข้าเอง {n3(info.autoReceived)}
                    </Caption>
                  )}
                </Figure>
                <Figure
                  label="ใช้ไป"
                  name={name}
                  value={at(`used.${id}`)}
                  onChange={set(`used.${id}`)}
                />
                <Figure
                  label="Waste / ทิ้ง"
                  name={name}
                  value={at(`waste.${id}`)}
                  onChange={set(`waste.${id}`)}
                />
                <div
                  aria-label={`คงเหลือ ${name}`}
                  data-tone={left < 0 ? "danger" : undefined}
                  className={cn(
                    "flex items-baseline justify-end gap-1.5 text-num-md font-semibold tabular-nums max-md:col-span-3 md:min-h-11.5 md:items-center",
                    left < 0 && "text-danger",
                  )}
                >
                  <Caption as="span" className="mr-auto md:hidden">
                    คงเหลือ
                  </Caption>
                  {n3(left)}
                  <Caption as="span">{unit}</Caption>
                </div>
                {wasted && (
                  <FormField
                    wide
                    label={
                      <>
                        สาเหตุ waste{" "}
                        {!at(`reason.${id}`).trim() && <MissingMark />}
                      </>
                    }
                  >
                    <Input
                      aria-label={`สาเหตุ waste ${name}`}
                      placeholder="เช่น ซองชำรุด / หมดอายุ / หก"
                      value={at(`reason.${id}`)}
                      onChange={(event) =>
                        set(`reason.${id}`)(event.target.value)
                      }
                    />
                  </FormField>
                )}
              </li>
            );
          })}
          {shown.length === 0 && (
            <li className="px-5 py-8 text-center text-text-secondary">
              ไม่พบรายการที่ค้นหา
            </li>
          )}
        </ul>
        <Caption className="block px-5 py-3 max-md:px-4">
          “ใช้ไป” รวม waste แล้ว · ช่อง waste บันทึกเพื่อดูของเสียเท่านั้น
          ไม่หักสต๊อกซ้ำ
        </Caption>
        <div className="grid gap-4 border-t border-border px-5 py-4 max-md:px-4 md:grid-cols-2">
          <FormField
            label={
              <>ผู้บันทึก {note && !at("reporter").trim() && <MissingMark />}</>
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
        <FormError error={error} className="mx-5 my-3 max-md:mx-4" />
        <div className={saveBar}>
          <Caption>
            {items.length} รายการสินค้า ·{" "}
            {note
              ? "แก้ไขวันเดิม ไม่ตัดสต๊อกซ้ำ"
              : "ยกยอดคงเหลือไปวันถัดไปอัตโนมัติ"}
          </Caption>
          <Button
            type="submit"
            variant="primary"
            className="max-md:w-full"
            disabled={saving}
          >
            บันทึกการใช้วันนี้
          </Button>
        </div>
      </DayCard>
    </form>
  );
}

/** 「ตั้งสต๊อกเริ่มต้น」: what each row holds at the start of a date. The branch has one
 *  opening per sheet: a save after the first edits it (its date too), and every later day is
 *  worked out again from it. A row left empty is not set, so it starts from 0. */
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
        save();
      }}
    >
      <FormField label="เริ่มนับตั้งแต่วันที่" className="self-start">
        <Input
          type="date"
          max={today}
          className={cn(dateField, "mt-2")}
          value={date}
          onChange={(event) => {
            setError("");
            setDate(event.target.value);
          }}
        />
      </FormField>
      <Caption>
        เริ่มจากของที่มีอยู่จริง · แก้ไขยอดตั้งต้นได้ ระบบคำนวณคงเหลือทุกวันใหม่
        · ถ้าไม่มี ใส่ 0
      </Caption>
      <DayCard aria-label="ตั้งสต๊อกเริ่มต้น" title="ของตั้งต้น">
        <ul className="m-0 list-none p-0">
          {shown.map(({ id, name, unit }) => (
            <li
              key={id}
              className="flex items-center justify-between gap-3 border-b border-border px-5 py-2.5 max-md:px-4"
            >
              <span className="min-w-0 font-semibold">{name}</span>
              <span className="flex shrink-0 items-center gap-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.001"
                  min="0"
                  aria-label={`ของตั้งต้น ${name}`}
                  className="mt-0 w-32 text-right max-md:w-28"
                  value={at(id)}
                  onChange={(event) => {
                    setError("");
                    setEdits({ ...edits, [`qty.${id}`]: event.target.value });
                  }}
                />
                <Caption as="span" className="w-12">
                  {unit}
                </Caption>
              </span>
            </li>
          ))}
        </ul>
        <FormError error={error} className="mx-5 my-3 max-md:mx-4" />
        <div className={saveBar}>
          <Caption>{items.length} รายการสินค้า</Caption>
          <Button
            type="submit"
            variant="primary"
            className="max-md:w-full"
            disabled={saving}
          >
            บันทึกของตั้งต้น
          </Button>
        </div>
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
