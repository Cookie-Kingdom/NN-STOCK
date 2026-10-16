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
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { unitOptions } from "@/lib/forms";
import { dateLabel } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import {
  branchItem,
  mutate,
  sheetItems,
  sheetNote,
  titles,
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
          inputMode="decimal"
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

/** A sheet's save, in its card's head beside the heading. Locked (what it shows is saved):
 *  「แก้ไขบันทึก」, which opens the inputs again. Open: the save, beside 「ยกเลิก」 when there is
 *  a saved sheet to go back to. */
function SaveActions({
  save,
  locked,
  saving,
  onEdit,
  onCancel,
}: {
  /** What the save button says. */
  save: string;
  locked: boolean;
  saving: boolean;
  onEdit: () => void;
  onCancel?: () => void;
}) {
  return locked ? (
    <Button size="sm" onClick={onEdit}>
      แก้ไขบันทึก
    </Button>
  ) : (
    // Never the element 「แก้ไขบันทึก」 was: a button its own click turns into a submit submits.
    <span className="flex gap-1.5">
      {onCancel && (
        <Button size="sm" onClick={onCancel}>
          ยกเลิก
        </Button>
      )}
      <Button size="sm" type="submit" variant="primary" disabled={saving}>
        {save}
      </Button>
    </span>
  );
}

/** The day's sheet (V2-CAL-10): per row what is left, live, first (the page is mostly for
 *  reading it), then what the day's sales and gift boxes took by themselves (ตัดจากยอดขาย,
 *  never typed: a column of its own on the materials sheet, a line under ใช้ไป on the meat
 *  sheet), then what the branch types (รับเพิ่ม on top of what came in by itself, ใช้ไป, and
 *  of that the Waste). The balance carried forward feeds what is left and is not shown. The
 *  save stands in the card's head. Nothing is refused (V2-RUL-05): below zero is red, an
 *  empty reporter or a Waste with no reason is saved and marked ยังไม่ได้จด. The first save of a day is a `daily`
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
  /** Inventory's sheet says what the sales took in a column; Stock's under ใช้ไป. */
  const soldColumn = sheet === "materials";

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
            <SaveActions
              save="บันทึกการใช้วันนี้"
              locked={locked}
              saving={saving}
              onEdit={() => setEditing(true)}
              onCancel={note && reset}
            />
          </>
        }
      >
        <FormError error={error} className="mx-5 my-3 max-md:mx-4" />
        {/* A phone scrolls the table sideways inside the card, as the page's other tables do. */}
        <StockTable
          columns={[
            "สินค้า",
            "คงเหลือ",
            ...(soldColumn ? ["ตัดจากยอดขาย"] : []),
            "รับเพิ่ม",
            "ใช้ไป",
            "Waste / ทิ้ง",
          ]}
          right={[
            "คงเหลือ",
            "ตัดจากยอดขาย",
            "รับเพิ่ม",
            "ใช้ไป",
            "Waste / ทิ้ง",
          ]}
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
                  <span className="block font-semibold">{name}</span>
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
                <Cell
                  right
                  aria-label={`คงเหลือ ${name}`}
                  tone={left < 0 ? "danger" : undefined}
                  className="text-num-md font-semibold"
                >
                  {n3(left)} <Caption as="span">{unit}</Caption>
                </Cell>
                {soldColumn && (
                  <Cell right aria-label={`ตัดจากยอดขาย ${name}`}>
                    {info.sold ? n3(info.sold) : <Muted as="span">—</Muted>}
                  </Cell>
                )}
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
                      รับจาก Owner {n3(info.autoReceived)}
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
                  {!soldColumn && info.sold !== 0 && (
                    <Caption
                      aria-label={`ตัดจากยอดขาย ${name}`}
                      className="mt-1 block font-normal"
                    >
                      ตัดจากยอดขาย {n3(info.sold)}
                    </Caption>
                  )}
                  {/* The meat the day's sales held is not taken: the branch weighs it. */}
                  {info.weigh && (
                    <Caption
                      aria-label={`ตัดจากยอดขาย ${name}`}
                      className="mt-1 block font-normal text-warning"
                    >
                      มียอดขาย · ชั่งแล้วกรอกน้ำหนักที่ใช้ไปเอง
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
              </tr>
            );
          })}
          {shown.length === 0 && (
            <tr>
              <Cell
                colSpan={soldColumn ? 6 : 5}
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
          ตามส่วนประกอบของสินค้าใน Settings ไม่ต้องพิมพ์ซ้ำใน “ใช้ไป” ·
          ยกเว้นเนื้อ เว็บไม่ตัดให้ ชั่งแล้วกรอกน้ำหนักที่ใช้ไปเองใน “ใช้ไป”
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
        <Caption className="block border-t border-border px-5 py-3 max-md:px-4">
          {items.length} รายการสินค้า ·{" "}
          {note
            ? "แก้ไขวันเดิม ไม่ตัดสต๊อกซ้ำ"
            : "ยกยอดคงเหลือไปวันถัดไปอัตโนมัติ"}
        </Caption>
      </DayCard>
    </form>
  );
}

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
  const [unit, setUnit] = useState(editing?.unit ?? "ชิ้น");
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
              options={unitOptions(ws.db)}
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

/** A branch's daily stock sheet, of its own branch always: 「ใบสต๊อกรายวัน」 (`DailyForm`).
 *  `sheet` "meat" is the Stock page's (fixed rows), "materials" the Inventory page's, whose list the
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
  const [dialog, setDialog] = useState<Material | "new">();
  const items = sheetItems(db, sheet);
  const shown = items.filter(
    (item) =>
      !word ||
      item.name.toLowerCase().includes(word) ||
      item.sku.toLowerCase().includes(word),
  );
  return (
    <div className="flex flex-col gap-4">
      <DailyForm
        ws={ws}
        sheet={sheet}
        items={items}
        shown={shown}
        onItem={sheet === "materials" ? setDialog : undefined}
      />
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
