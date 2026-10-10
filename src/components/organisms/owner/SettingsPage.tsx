"use client";

import { useState, type ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { ReadOnlyValue } from "@/components/atoms/ReadOnlyValue";
import { Muted } from "@/components/atoms/Text";
import { Textarea } from "@/components/atoms/Textarea";
import { DayCard } from "@/components/molecules/DayCard";
import { FileUploadField } from "@/components/molecules/FileUploadField";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { SectionAction } from "@/components/molecules/SectionAction";
import { Cell, StockTable } from "@/components/organisms/branch/BranchStock";
import {
  ProductDialog,
  newProduct,
  productDrafts,
  productItems,
  productsTitle,
  type ProductDraft,
} from "./ProductDialog";
import { SkuDialog, skuTitle } from "./SkuDialog";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { logoAccept, saveLogo, useLogoSrc } from "@/lib/attachment-store";
import { latestDatabase } from "@/lib/persistence";
import {
  branches,
  materialList,
  mutate,
  payCategories,
  rawRiceBranches,
  salesChannels,
  seed,
  skuCatalogue,
  type Database,
  type Values,
} from "@/lib/store";

type Section =
  "numbers" | "channels" | "categories" | "rice" | "materials" | "header";
type ListSection = "channels" | "categories" | "materials";
type Setting = {
  key: string;
  label: string;
  unit?: string;
  wide?: boolean;
  /** Starts a row: the first field of a party's block. */
  row?: boolean;
  /** An address: several lines. */
  lines?: boolean;
};

const numbers: Setting[] = [
  { key: "packKg", label: "น้ำหนักเนื้อต่อกล่อง", unit: "กก." },
  { key: "shippingFee", label: "ค่าขนส่งไป-กลับต่อรอบ", unit: "บาท" },
  { key: "smokeRate", label: "ค่ารมต่อกก. ต่ำกว่า 1,000 กก.", unit: "บาท" },
  { key: "smokeRate1000", label: "ค่ารมต่อกก. ตั้งแต่ 1,000 กก.", unit: "บาท" },
  { key: "smokeRate1500", label: "ค่ารมต่อกก. ตั้งแต่ 1,500 กก.", unit: "บาท" },
];
/** In the order a PO prints them: the buyer, then each seller. */
const header: Setting[] = [
  { key: "companyName", label: "ชื่อบริษัท" },
  { key: "companyAddress", label: "ที่อยู่", wide: true },
  { key: "attention", label: "ผู้ติดต่อ" },
  { key: "companyPhone", label: "เบอร์ติดต่อ" },
  { key: "taxId", label: "เลขผู้เสียภาษี" },
  { key: "foodivaContact", label: "ผู้รับออเดอร์ Foodiva", row: true },
  { key: "foodivaAddress", label: "ที่อยู่ Foodiva", wide: true, lines: true },
  { key: "chefHouseContact", label: "ผู้รับออเดอร์ Chef House", row: true },
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
    // An added channel keeps its money under this prefix (checkConfig).
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
    extra: { key: "unit", label: "หน่วยนับ" },
    add: "เพิ่มวัสดุ",
    prefix: "m",
  },
};
const titles: Record<Section, string> = {
  numbers: "ตัวเลขสำหรับคำนวณ",
  header: "ข้อมูลหัวเอกสาร",
  rice: "สาขาที่ใช้ข้าวเหนียวดิบ",
  channels: lists.channels.title,
  categories: lists.categories.title,
  materials: lists.materials.title,
};
const isList = (section: Section): section is ListSection => section in lists;
/** The ten categories the rules hang on: renamed, never removed. */
const fixedCategories = payCategories(seed.config).map((c) => c.id);
/** A list as its rows are stored: every value a string. The materials are the list in use
 *  (`materialList(db)`): the rows a branch added on its sheet are in it. */
const rowsOf = (db: Database, section: ListSection): Values[] =>
  section === "channels"
    ? salesChannels(db.config).map((c) => ({ ...c, gp: String(c.gp) }))
    : section === "materials"
      ? materialList(db)
      : payCategories(db.config);
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
/** The project's own settings (/owner/nn-x-lm/settings): the figures, the raw rice
 *  branches, the product list and the materials. The rest is the shop's (/owner/settings). */
export const ProjectSettingsPage = ({ ws }: { ws: Workspace }) => (
  <SettingsPage ws={ws} project />
);

export function SettingsPage({
  ws,
  project = false,
}: {
  ws: Workspace;
  project?: boolean;
}) {
  const { db, account, today } = ws;
  const [editing, setEditing] = useState<Section | null>(null);
  /** The open section's plain values, or its rows when it is a list. */
  const [draft, setDraft] = useState<Values>({});
  const [rows, setRows] = useState<Values[]>([]);
  const [message, setMessage] = useState("");
  const [skusOpen, setSkusOpen] = useState(false);
  /** The product whose popup is open. */
  const [product, setProduct] = useState<ProductDraft | null>(null);
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");

  /** Opens a section on the settings as they stand; `add` starts a list on a new row. */
  const start = (section: Section, add = false) => {
    const config = latestDatabase().config;
    setDraft({ ...config });
    if (isList(section)) {
      const now = rowsOf(latestDatabase(), section);
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
      setMessage("เลือกโลโก้แล้ว กดบันทึกเพื่อใช้กับเอกสาร");
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
    const latest = latestDatabase();
    const config = latest.config;
    // Only what this section changed is sent, so a setting saved meanwhile elsewhere stands.
    let input: Values;
    if (isList(section)) {
      const typed: Values[] = rows.map((row) => ({
        ...row,
        name: row.name.trim(),
      }));
      input =
        JSON.stringify(typed) === JSON.stringify(rowsOf(latest, section)) &&
        // A list stored before SKUs: saving it as it is issues them (mutate).
        !(section === "materials" && typed.some((row) => !row.sku))
          ? {}
          : { [lists[section].key]: JSON.stringify(typed) };
    } else
      input = Object.fromEntries(
        (section === "numbers"
          ? numbers.map((f) => f.key)
          : section === "rice"
            ? ["rawRiceBranches"]
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
        />
      }
    >
      <p className="px-5 pt-3 pb-1 text-caption text-text-secondary max-md:px-4">
        {note}
      </p>
      {children}
    </DayCard>
  );
  /** Plain settings: read as a list of figures, edited as a form. `first` goes above them
   *  (the logo, at the top of a document). */
  const plain = (section: Section, list: Setting[], first?: ReactNode) =>
    editing === section ? (
      <FormGrid className={grid}>
        {first}
        {list.map((f) => (
          <FormField
            key={f.key}
            wide={f.wide}
            className={f.row ? "col-start-1" : undefined}
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
      </FormGrid>
    ) : (
      <dl className={grid}>
        {first}
        {list.map((f) => (
          <div
            key={f.key}
            className={
              f.wide ? "col-span-full" : f.row ? "col-start-1" : undefined
            }
          >
            <dt className="text-label text-text-secondary">{f.label}</dt>
            <dd className="m-0 font-semibold [overflow-wrap:anywhere] whitespace-pre-line">
              {db.config[f.key]
                ? `${db.config[f.key]}${f.unit ? ` ${f.unit}` : ""}`
                : "—"}
            </dd>
          </div>
        ))}
      </dl>
    );
  /** A list: its rows as a table, with inputs, 「ลบ」 and one more row while it is open. */
  const list = (section: ListSection, removable: (row: Values) => boolean) => {
    const { id, name, extra, add } = lists[section];
    const open = editing === section;
    // A material's SKU: issued by the web when the list is saved, never typed.
    const sku = section === "materials";
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
              ...(sku ? ["SKU"] : []),
              name,
              ...(extra ? [extra.label] : []),
              ...(open ? [""] : []),
            ]}
            right={extra ? [extra.label] : []}
          >
            {(open ? rows : rowsOf(db, section)).map((row, index) => (
              <tr key={row[id]}>
                {sku && (
                  <Cell className="font-mono whitespace-nowrap text-accent">
                    {row.sku || (
                      <Muted as="span">{open ? "รอบันทึก" : "—"}</Muted>
                    )}
                  </Cell>
                )}
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
                          // A material's unit is a word; the other figure is a number.
                          inputMode={sku ? undefined : "decimal"}
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
  const stockItems = productItems(db);
  const skus = skuCatalogue(db);
  const materialSkus = skus.filter((item) => item.material).length;
  const logo = logoOf(editing === "header" ? draft : db.config);
  const riceAt = rawRiceBranches(editing === "rice" ? draft : db.config);

  return (
    // A wide screen: two columns of sections, so the forms and tables keep their width.
    <div className="flex flex-col gap-4 2xl:grid 2xl:grid-cols-2 2xl:items-start">
      {project ? (
        <>
          <div className="flex min-w-0 flex-col gap-4">
            {card(
              "numbers",
              "ตัวเลขในหน้าอื่นจะเปลี่ยนตามค่าที่แก้ในนี้",
              plain("numbers", numbers),
            )}
            {card(
              "rice",
              "สาขาที่นึ่งข้าวเองจะนับข้าวเหนียวดิบ (กก.) ในหน้า Inventory ของสาขา ส่วนสาขาที่ไม่ได้เลือกจะไม่มีแถวข้าวเหนียวดิบ",
              <div className="flex flex-wrap gap-x-6 gap-y-1 px-5 pt-1 pb-4 max-md:px-4">
                {branches.map((branch) => (
                  <label
                    key={branch}
                    className="flex min-h-11 items-center gap-2 font-semibold"
                  >
                    <input
                      type="checkbox"
                      className="size-5 accent-accent"
                      checked={riceAt.includes(branch)}
                      disabled={editing !== "rice"}
                      onChange={(event) =>
                        set(
                          "rawRiceBranches",
                          JSON.stringify(
                            branches.filter((b) =>
                              b === branch
                                ? event.target.checked
                                : riceAt.includes(b),
                            ),
                          ),
                        )
                      }
                    />
                    สาขา{branch}
                  </label>
                ))}
              </div>,
            )}
            <DayCard
              aria-label={productsTitle}
              title={productsTitle}
              aside={
                <Button
                  size="sm"
                  disabled={editing !== null}
                  onClick={() => setProduct(newProduct())}
                >
                  เพิ่มสินค้า
                </Button>
              }
            >
              <p className="px-5 pt-3 pb-1 text-caption text-text-secondary max-md:px-4">
                สินค้าแต่ละรายการมีช่องจำนวนในฟอร์มยอดขายและกล่องแจก ขายหรือแจก
                1 ชิ้น เว็บตัดสต๊อกของสาขาตามส่วนประกอบให้เอง แยกจาก “ใช้ไป”
                ที่สาขาพิมพ์ แก้ส่วนประกอบแล้วยอดย้อนหลังคิดใหม่ตามล่าสุด
                สินค้าแรกลบไม่ได้ และจำนวนที่เคยจดของสินค้าที่ลบแล้วจะไม่ถูกนับ
                กดชื่อสินค้าเพื่อแก้ไข
              </p>
              <StockTable
                columns={["สินค้า", "ราคา", "ต้นทุนอื่น"]}
                right={["ราคา", "ต้นทุนอื่น"]}
              >
                {productDrafts(db).map((row) => (
                  <tr key={row.id}>
                    <Cell>
                      <Button
                        variant="link"
                        className="min-h-11 px-0 text-left font-semibold"
                        aria-label={`แก้ไข ${row.name}`}
                        disabled={editing !== null}
                        onClick={() => setProduct(row)}
                      >
                        {row.name}
                      </Button>
                      <Muted as="span" className="block text-caption">
                        {row.items
                          .map((item) => {
                            const known = stockItems.find(
                              (x) => x.id === item.id,
                            );
                            return `${known?.name ?? item.id} ${item.qty} ${known?.unit ?? ""}`.trim();
                          })
                          .join(" · ") || "ยังไม่ตั้งส่วนประกอบ"}
                      </Muted>
                    </Cell>
                    <Cell right>{row.price ? `${row.price} บาท` : "—"}</Cell>
                    <Cell right>{row.cost ? `${row.cost} บาท` : "—"}</Cell>
                  </tr>
                ))}
              </StockTable>
            </DayCard>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            {card(
              "materials",
              'รายการของใบสต๊อกรายวันหน้า Inventory ของสาขา รวมรายการที่สาขาเพิ่มเอง "หน่วยนับ" คือหน่วยของตัวเลขในใบสต๊อก เว้นว่างจะเป็น "ชิ้น" SKU ออกให้อัตโนมัติตอนบันทึก และไม่เปลี่ยนเมื่อแก้ชื่อ',
              list("materials", () => true),
            )}
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 flex-col gap-4">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-4">
              {card(
                "channels",
                "ช่องทางที่เพิ่มจะมีช่องยอดเงินในฟอร์มยอดขาย ช่องทางแรกลบไม่ได้ และยอดที่เคยจดในช่องทางที่ลบแล้วจะไม่ถูกนับ",
                list("channels", (row) => row.key !== "lineMan"),
              )}
              {card(
                "categories",
                `ทั้งหมด ${payCategories(db.config).length} หมวด หมวดตั้งต้น ${fixedCategories.length} หมวดแก้ชื่อได้แต่ลบไม่ได้`,
                list("categories", (row) => !fixedCategories.includes(row.id)),
              )}
            </div>
            <DayCard
              aria-label={skuTitle}
              title={skuTitle}
              aside={
                <Button size="sm" onClick={() => setSkusOpen(true)}>
                  เปิดรายการ
                </Button>
              }
            >
              <p className="px-5 pt-3 pb-1 text-caption text-text-secondary max-md:px-4">
                SKU ออกให้อัตโนมัติ หนึ่งรายการมีเลขเดียวและไม่ใช้ซ้ำ
                รายการจากหน้า Accounting จะได้ SKU ตอนจดค่าใช้จ่ายด้วยชื่อใหม่
                เมื่อแก้ชื่อในรายการ แถวเดิมในหน้า Accounting จะเปลี่ยนชื่อตาม
                ส่วน SKU ยังเป็นเลขเดิม
              </p>
              <dl className={grid}>
                <div>
                  <dt className="text-label text-text-secondary">วัสดุ</dt>
                  <dd className="m-0 font-semibold">{materialSkus} รายการ</dd>
                </div>
                <div>
                  <dt className="text-label text-text-secondary">
                    รายการจากหน้า Accounting
                  </dt>
                  <dd className="m-0 font-semibold">
                    {skus.length - materialSkus} รายการ
                  </dd>
                </div>
              </dl>
            </DayCard>
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            {card(
              "header",
              "หัวเอกสารของ PO เนื้อ, PO รมควัน, Packing List และใบขนส่ง",
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
                    <dt className="text-label text-text-secondary">
                      โลโก้บนเอกสาร
                    </dt>
                    <dd className="m-0 mt-1 font-semibold">
                      {logo ? <Logo source={logo} /> : "ยังไม่มีโลโก้"}
                    </dd>
                  </div>
                ),
              ),
            )}
          </div>
        </>
      )}
      {skusOpen && <SkuDialog ws={ws} onClose={() => setSkusOpen(false)} />}
      {product && (
        <ProductDialog
          ws={ws}
          product={product}
          onClose={() => setProduct(null)}
        />
      )}
    </div>
  );
}
