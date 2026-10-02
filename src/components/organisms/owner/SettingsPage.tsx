"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { ReadOnlyValue } from "@/components/atoms/ReadOnlyValue";
import { Textarea } from "@/components/atoms/Textarea";
import { DayCard } from "@/components/molecules/DayCard";
import { FileUploadField } from "@/components/molecules/FileUploadField";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { SectionAction } from "@/components/molecules/SectionAction";
import { Cell, StockTable } from "@/components/organisms/branch/BranchStock";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { logoAccept, saveLogo, useLogoSrc } from "@/lib/attachment-store";
import { latestDatabase } from "@/lib/persistence";
import {
  materialList,
  mutate,
  payCategories,
  salesChannels,
  seed,
  type Values,
} from "@/lib/store";

type Section = "numbers" | "channels" | "categories" | "materials" | "header";
type ListSection = "channels" | "categories" | "materials";
type Setting = {
  key: string;
  label: string;
  unit?: string;
  wide?: boolean;
  /** An address: several lines. */
  lines?: boolean;
};

const numbers: Setting[] = [
  { key: "boxPrice", label: "ราคากล่อง", unit: "บาท" },
  { key: "packKg", label: "น้ำหนักเนื้อต่อกล่อง", unit: "กก." },
  { key: "packCost", label: "ต้นทุนแพ็กเกจต่อกล่อง", unit: "บาท" },
];
const header: Setting[] = [
  { key: "companyName", label: "ชื่อบริษัท" },
  { key: "attention", label: "ผู้ติดต่อ" },
  { key: "companyPhone", label: "เบอร์ติดต่อ" },
  { key: "taxId", label: "เลขผู้เสียภาษี" },
  { key: "companyAddress", label: "ที่อยู่", wide: true },
  { key: "foodivaContact", label: "ผู้รับออเดอร์ Foodiva" },
  { key: "chefHouseContact", label: "ผู้รับออเดอร์ Chef House" },
  { key: "foodivaAddress", label: "ที่อยู่ Foodiva", wide: true, lines: true },
  {
    key: "chefHouseAddress",
    label: "ที่อยู่ Chef House",
    wide: true,
    lines: true,
  },
];
const logoKeys = ["logoStorageKey", "logoData", "logoName"];
/** A list setting: the `config` key that holds it as JSON, the value that names a row, the
 *  figure a row carries beside its name, and the id a new row gets (blueprint 1.3). */
const lists: Record<
  ListSection,
  {
    title: string;
    key: string;
    id: "key" | "id";
    name: string;
    extra?: { key: string; label: string };
    add: string;
    prefix: string;
  }
> = {
  channels: {
    title: "ช่องทางขาย",
    key: "salesChannels",
    id: "key",
    name: "ช่องทาง",
    extra: { key: "gp", label: "GP %" },
    add: "เพิ่มช่องทาง",
    // Sale money is hidden from the Account Manager by this prefix.
    prefix: "sales.",
  },
  categories: {
    title: "หมวดจ่ายเงิน",
    key: "payCategories",
    id: "id",
    name: "หมวด",
    add: "เพิ่มหมวด",
    prefix: "c",
  },
  materials: {
    title: "รายชื่อวัสดุ",
    key: "materialList",
    id: "id",
    name: "วัสดุ",
    extra: { key: "perBox", label: "ใช้ต่อกล่อง" },
    add: "เพิ่มวัสดุ",
    prefix: "m",
  },
};
const titles: Record<Section, string> = {
  numbers: "ตัวเลขที่เว็บใช้คิด",
  header: "ข้อมูลหัวเอกสาร",
  channels: lists.channels.title,
  categories: lists.categories.title,
  materials: lists.materials.title,
};
const isList = (section: Section): section is ListSection => section in lists;
/** The ten categories the rules hang on: renamed, never removed. */
const fixedCategories = payCategories(seed.config).map((c) => c.id);
/** A list as its rows are stored: every value a string. */
const rowsOf = (config: Values, section: ListSection): Values[] =>
  section === "channels"
    ? salesChannels(config).map((c) => ({ ...c, gp: String(c.gp) }))
    : section === "materials"
      ? materialList(config).map((m) => ({
          ...m,
          perBox: m.perBox === null ? "" : String(m.perBox),
        }))
      : payCategories(config);
/** `from` with one empty row more, under a new id. */
const addRow = (section: ListSection, from: Values[]): Values[] => [
  ...from,
  {
    // ponytail: the clock as the short id; one Owner adds one row at a time.
    [lists[section].id]: lists[section].prefix + Date.now().toString(36),
    name: "",
    ...(lists[section].extra && { [lists[section].extra.key]: "" }),
  },
];
const grid =
  "m-0 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-4 p-5 max-md:p-4";
const foot = "flex justify-center px-5 pt-3 pb-4";

function Logo({ source }: { source: string }) {
  const src = useLogoSrc(source);
  return src ? (
    // A blob or data URL, so Next image optimization cannot process it.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="block size-15.5 rounded-md border border-border bg-surface object-contain"
      src={src}
      alt="โลโก้บนเอกสาร"
    />
  ) : null;
}
/** The logo to show: a storage key, or a data URL saved before logos moved to storage. */
const logoOf = (values: Values) =>
  values.logoStorageKey || values.logoData || "";

/** What the web reckons with and what the documents print (spec section 8), Owner only.
 *  One section is open at a time; 「บันทึก」 saves that section as its own `config` note, and
 *  a value `mutate` refuses is said beside the buttons. */
export function SettingsPage({ ws }: { ws: Workspace }) {
  const { db, account, today } = ws;
  const [editing, setEditing] = useState<Section | null>(null);
  /** The open section's plain values, or its rows when it is a list. */
  const [draft, setDraft] = useState<Values>({});
  const [rows, setRows] = useState<Values[]>([]);
  const [message, setMessage] = useState("");
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");

  /** Opens a section on the settings as they stand; `add` starts a list on a new row. */
  const start = (section: Section, add = false) => {
    const config = latestDatabase().config;
    setDraft({ ...config });
    if (isList(section)) {
      const now = rowsOf(config, section);
      setRows(add ? addRow(section, now) : now);
    }
    setEditing(section);
    setError("");
    setMessage("");
  };
  const set = (key: string, value: string) => {
    setError("");
    setDraft((last) => ({ ...last, [key]: value }));
  };
  const setRow = (index: number, key: string, value: string) => {
    setError("");
    setRows(
      rows.map((row, i) => (i === index ? { ...row, [key]: value } : row)),
    );
  };
  // The file goes to storage now; the settings keep only its key (and drop a legacy data URL).
  const pickLogo = async (file: File | null) => {
    if (!file) return;
    setError("");
    setMessage(`กำลังอัปโหลดโลโก้ ${file.name}…`);
    try {
      const key = await saveLogo(file);
      setDraft((last) => ({
        ...last,
        logoStorageKey: key,
        logoData: "",
        logoName: file.name,
      }));
      setMessage("เลือกโลโก้แล้ว · กดบันทึกเพื่อใช้กับเอกสาร");
    } catch (caught) {
      setMessage("");
      setError(
        caught instanceof Error ? caught.message : "อัปโหลดโลโก้ไม่สำเร็จ",
      );
    }
  };
  const save = async () => {
    const section = editing;
    if (!section) return;
    const config = latestDatabase().config;
    // Only what this section changed is sent, so a setting saved meanwhile elsewhere stands.
    let input: Values;
    if (isList(section)) {
      const typed = rows.map((row) => ({ ...row, name: row.name.trim() }));
      input =
        JSON.stringify(typed) === JSON.stringify(rowsOf(config, section))
          ? {}
          : { [lists[section].key]: JSON.stringify(typed) };
    } else
      input = Object.fromEntries(
        (section === "numbers"
          ? numbers.map((f) => f.key)
          : [...header.map((f) => f.key), ...logoKeys]
        )
          .map((key) => [key, (draft[key] ?? "").trim()])
          .filter(([key, value]) => value !== (config[key] ?? "")),
      );
    if (Object.keys(input).length) {
      const next = await run(() =>
        mutate(latestDatabase(), account, "config", input, "", today),
      );
      if (!next) return;
      ws.setToast(`บันทึกแล้ว: ${titles[section]}`);
    }
    setEditing(null);
  };

  const card = (section: Section, note: ReactNode, children: ReactNode) => (
    <DayCard
      key={section}
      aria-label={titles[section]}
      title={titles[section]}
      aside={
        <SectionAction
          section={section}
          editing={editing}
          message={message}
          error={error}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={save}
          onStartEdit={start}
          editLabel="แก้ไข"
          saveLabel="บันทึก"
          cancelLabel="ยกเลิก"
          otherLabel="กำลังแก้ส่วนอื่น"
        />
      }
    >
      <p className="px-5 pt-3 pb-1 text-caption text-text-secondary max-md:px-4">
        {note}
      </p>
      {children}
    </DayCard>
  );
  /** Plain settings: read as a list of figures, edited as a form. */
  const plain = (section: Section, list: Setting[], more?: ReactNode) =>
    editing === section ? (
      <FormGrid className={grid}>
        {list.map((f) => (
          <FormField
            key={f.key}
            wide={f.wide}
            label={f.unit ? `${f.label} (${f.unit})` : f.label}
          >
            {f.lines ? (
              <Textarea
                rows={3}
                value={draft[f.key] ?? ""}
                onChange={(event) => set(f.key, event.target.value)}
              />
            ) : (
              // Text, not number: `mutate` words the refusal of a bad figure.
              <Input
                inputMode={f.unit ? "decimal" : undefined}
                value={draft[f.key] ?? ""}
                onChange={(event) => set(f.key, event.target.value)}
              />
            )}
          </FormField>
        ))}
        {more}
      </FormGrid>
    ) : (
      <dl className={grid}>
        {list.map((f) => (
          <div key={f.key} className={f.wide ? "col-span-full" : undefined}>
            <dt className="text-label text-text-secondary">{f.label}</dt>
            <dd className="m-0 font-semibold [overflow-wrap:anywhere] whitespace-pre-line">
              {db.config[f.key]
                ? `${db.config[f.key]}${f.unit ? ` ${f.unit}` : ""}`
                : "—"}
            </dd>
          </div>
        ))}
        {more}
      </dl>
    );
  /** A list: its rows as a table, with inputs, 「ลบ」 and one more row while it is open. */
  const list = (section: ListSection, removable: (row: Values) => boolean) => {
    const { id, name, extra, add } = lists[section];
    const open = editing === section;
    return (
      <>
        {section === "categories" && !open ? (
          <div className="flex flex-wrap gap-2 p-5 max-md:p-4">
            {payCategories(db.config).map((c) => (
              <Badge key={c.id}>{c.name}</Badge>
            ))}
          </div>
        ) : (
          <StockTable
            columns={[
              name,
              ...(extra ? [extra.label] : []),
              ...(open ? [""] : []),
            ]}
            right={extra ? [extra.label] : []}
          >
            {(open ? rows : rowsOf(db.config, section)).map((row, index) => (
              <tr key={row[id]}>
                {open ? (
                  <>
                    <Cell className="py-1.5">
                      <Input
                        aria-label={`${name} ${index + 1}`}
                        className="mt-0 min-h-10 min-w-28"
                        // A row just added is the one being typed.
                        autoFocus={!row.name}
                        value={row.name}
                        onChange={(event) =>
                          setRow(index, "name", event.target.value)
                        }
                      />
                    </Cell>
                    {extra && (
                      <Cell right className="py-1.5">
                        <Input
                          inputMode="decimal"
                          aria-label={`${extra.label} ${row.name}`}
                          className="mt-0 ml-auto min-h-10 w-20 text-right"
                          value={row[extra.key]}
                          onChange={(event) =>
                            setRow(index, extra.key, event.target.value)
                          }
                        />
                      </Cell>
                    )}
                    <Cell right className="py-0">
                      {removable(row) && (
                        <Button
                          variant="link"
                          className="min-h-11 px-2 text-label text-danger hover:text-danger"
                          aria-label={`ลบ ${row.name}`}
                          onClick={() => {
                            setError("");
                            setRows(rows.filter((_, i) => i !== index));
                          }}
                        >
                          ลบ
                        </Button>
                      )}
                    </Cell>
                  </>
                ) : (
                  <>
                    <Cell>{row.name}</Cell>
                    {extra && (
                      <Cell right>
                        <ReadOnlyValue>{row[extra.key] || "—"}</ReadOnlyValue>
                      </Cell>
                    )}
                  </>
                )}
              </tr>
            ))}
          </StockTable>
        )}
        <div className={foot}>
          <Button
            size="sm"
            disabled={editing !== null && !open}
            onClick={() =>
              open ? setRows(addRow(section, rows)) : start(section, true)
            }
          >
            {add}
          </Button>
        </div>
      </>
    );
  };
  const logo = logoOf(editing === "header" ? draft : db.config);

  return (
    <div className="flex flex-col gap-4">
      {card(
        "numbers",
        "แก้แล้วตัวเลขในหน้าอื่นเปลี่ยนตาม",
        plain("numbers", numbers),
      )}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-4">
        {card(
          "channels",
          "เพิ่มช่องทางแล้วฟอร์มยอดขายมีช่องยอดเงินเพิ่ม · ช่องทางแรกลบไม่ได้ · ลบช่องทางแล้ว ยอดที่เคยจดในช่องทางนั้นไม่ถูกนับ",
          list("channels", (row) => row.key !== "lineMan"),
        )}
        {card(
          "categories",
          `${payCategories(db.config).length} หมวด · หมวดตั้งต้น ${fixedCategories.length} หมวดแก้ชื่อได้ ลบไม่ได้`,
          list("categories", (row) => !fixedCategories.includes(row.id)),
        )}
      </div>
      {card(
        "materials",
        '"ใช้ต่อกล่อง" เว้นว่างได้ รายการที่ว่าง เว็บไม่ประมาณการใช้ระหว่างรอบนับ',
        list("materials", () => true),
      )}
      {card(
        "header",
        "ใช้กับ PO ซื้อเนื้อ, PO รมควัน, Packing List, ใบขนส่ง",
        plain(
          "header",
          header,
          editing === "header" ? (
            <FileUploadField
              wide
              label="โลโก้บนเอกสาร"
              accept={logoAccept}
              maxBytes={1024 * 1024}
              oversizeMessage="ไฟล์โลโก้ใหญ่เกิน 1 MB"
              onError={setError}
              onFile={pickLogo}
              preview={logo && <Logo source={logo} />}
              hint={draft.logoName || "PNG, JPG หรือ WebP ไม่เกิน 1 MB"}
            />
          ) : (
            <div className="col-span-full">
              <dt className="text-label text-text-secondary">โลโก้บนเอกสาร</dt>
              <dd className="m-0 mt-1 font-semibold">
                {logo ? <Logo source={logo} /> : "ยังไม่มีโลโก้"}
              </dd>
            </div>
          ),
        ),
      )}
    </div>
  );
}
