"use client";

import {
  cloneElement,
  isValidElement,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Badge } from "@/components/atoms/Badge";
import { Footnote } from "@/components/atoms/Text";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Textarea } from "@/components/atoms/Textarea";
import { FileUploadField } from "@/components/molecules/FileUploadField";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import {
  ReadOnlyValue,
  SectionAction,
} from "@/components/organisms/shared/SectionAction";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { logoAccept, saveLogo, useLogoSrc } from "@/lib/attachment-store";
import { timeOptions } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  branches,
  materials,
  mutate,
  n,
  seed,
  type Database,
  type Values,
} from "@/lib/store";
import { fmt, today } from "@/lib/format";

type ConfigSection =
  | "main"
  | "documents"
  | "pricing"
  | "supplies"
  | "production"
  | "branch"
  | "materials";

type ValueType = "number" | "time" | "branch" | "text" | "textarea" | "file";

const settingColumns = [
  "รายการ (Setting)",
  "ค่าปัจจุบัน (Current value)",
  "หน่วย (Unit)",
];
const materialSettingsColumns = [
  "วัสดุ (Material)",
  "จำนวนฐาน (Par level)",
  "ราคาต่อหน่วย (Unit price)",
  "มูลค่าฐาน (Par value)",
  "ใช้กับสาขา",
];
const logoMaxBytes = 1024 * 1024;
const logoPreviewClass =
  "block size-15.5 rounded-md border border-border bg-surface object-contain";

/** The logo to show: a storage key, or a data URL saved before logos moved to storage. */
const logoOf = (values: Values) =>
  values.logoStorageKey || values.logoData || "";

function LogoImage({ source, alt }: { source: string; alt: string }) {
  const src = useLogoSrc(source);
  return src ? (
    // A blob or data URL, so Next image optimization cannot process it.
    // eslint-disable-next-line @next/next/no-img-element
    <img className={logoPreviewClass} src={src} alt={alt} />
  ) : null;
}

const asIs = (value: string) => value;
const baht = (value: string) => `฿${fmt(Number(value))}`;
const plain = (value: string) => fmt(Number(value));

/** Config merged over seed defaults, with legacy per-branch material values folded into the shared keys. */
function draftFromConfig(config: Values): Values {
  const values = { ...seed.config, ...config };
  for (let i = 0; i < materials.length; i++) {
    values[`material${i}`] =
      values[`material${i}`] ||
      values[`material${i}_saladaeng`] ||
      values[`material${i}_minburi`] ||
      "0";
    values[`materialPrice${i}`] =
      values[`materialPrice${i}`] ||
      values[`materialPrice${i}_saladaeng`] ||
      values[`materialPrice${i}_minburi`] ||
      "0";
  }
  return values;
}

/** The save's own change, rebased on the config it starts from. Shared by the save and
 *  the live check so both refuse for the same reason. */
function buildConfig(from: Database, changed: Values) {
  return mutate(
    from,
    "owner",
    "config",
    { ...draftFromConfig(from.config), ...changed },
    "",
    // Bangkok's calendar day, not UTC's (COR-14): until 07:00 Bangkok, UTC is still on yesterday.
    today(),
  );
}

function settingRow(
  label: string,
  value: ReactNode,
  unit: string,
  detail: string,
): ReactNode[] {
  // The edit control is announced by the row's Thai name, not just its config key.
  const control =
    isValidElement<{ label?: string }>(value) && value.type === ConfigValue
      ? cloneElement(value, { label: label.split(" (")[0] })
      : value;
  return [<strong key="label">{label}</strong>, control, unit, detail];
}

type EditProps = {
  editing: ConfigSection | null;
  draft: Values;
  config: Values;
  onChange: (key: string, value: string) => void;
  onLogo: (file: File) => void;
  onMessage: (message: string) => void;
};

function ConfigValue({
  section,
  name,
  label,
  display = asIs,
  type = "number",
  editing,
  draft,
  config,
  onChange,
  onLogo,
  onMessage,
}: EditProps & {
  section: ConfigSection;
  name: string;
  /** Thai display name for the control's accessible label. */
  label?: string;
  display?: (value: string) => string;
  type?: ValueType;
}) {
  // Key kept in parentheses so existing label lookups by config key still match.
  const ariaLabel = label ? `${label} (${name})` : name;
  if (editing !== section) {
    if (type === "file" && logoOf(config))
      return <LogoImage source={logoOf(config)} alt="โลโก้ NerdNuea" />;
    return (
      <ReadOnlyValue>
        {type === "file"
          ? "ยังไม่ได้อัปโหลด"
          : display(config[name] || seed.config[name] || "—")}
      </ReadOnlyValue>
    );
  }
  if (type === "time") {
    const current = draft[name] || "";
    return (
      <Select
        variant="table"
        aria-label={ariaLabel}
        value={current}
        onChange={(event) => onChange(name, event.target.value)}
      >
        {timeOptions(current).map((slot) => (
          <option key={slot}>{slot}</option>
        ))}
      </Select>
    );
  }
  if (type === "branch")
    return (
      <Select
        variant="table"
        aria-label={ariaLabel}
        value={draft[name]}
        onChange={(event) => onChange(name, event.target.value)}
      >
        {branches.map((branchName) => (
          <option key={branchName}>{branchName}</option>
        ))}
      </Select>
    );
  if (type === "textarea")
    return (
      <Textarea
        variant="table"
        className="min-w-55"
        aria-label={ariaLabel}
        rows={3}
        value={draft[name] ?? ""}
        onChange={(event) => onChange(name, event.target.value)}
      />
    );
  if (type === "file")
    return (
      <FileUploadField
        label="อัปโหลดโลโก้ NerdNuea"
        hideLabel
        className="min-w-52.5"
        accept={logoAccept}
        maxBytes={logoMaxBytes}
        oversizeMessage="ไฟล์โลโก้ต้องมีขนาดไม่เกิน 1 MB"
        onError={onMessage}
        onFile={(file) => {
          if (file) onLogo(file);
        }}
        preview={
          logoOf(draft) && (
            <LogoImage source={logoOf(draft)} alt="ตัวอย่างโลโก้ NerdNuea" />
          )
        }
        hint={draft.logoName || "รองรับ PNG, JPG หรือ WebP ไม่เกิน 1 MB"}
      />
    );
  return (
    <Input
      variant="table"
      aria-label={ariaLabel}
      type={type === "text" ? "text" : "number"}
      inputMode={type === "number" ? "decimal" : undefined}
      min={type === "number" ? "0" : undefined}
      step={name === "packKg" ? "0.001" : name === "tolerance" ? "1" : "0.01"}
      value={draft[name] ?? ""}
      onChange={(event) => onChange(name, event.target.value)}
    />
  );
}

/* The edit in progress outlives this view: if the workspace remounts (the session
 * re-checks on every auth event), the user gets back what they had typed instead of the
 * read-only table. Cleared once the section is saved or cancelled. */
const unsavedEdit: {
  current: { draft: Values; base: Values; editing: ConfigSection } | null;
} = { current: null };

export function ConfigView({ db }: { db: Database }) {
  const [draft, setDraft] = useState<Values>(
    () => unsavedEdit.current?.draft ?? draftFromConfig(db.config),
  );
  // The config the draft started from, so a save sends only the fields changed here.
  const [base, setBase] = useState<Values>(
    () => unsavedEdit.current?.base ?? draft,
  );
  const [editing, setEditing] = useState<ConfigSection | null>(
    () => unsavedEdit.current?.editing ?? null,
  );
  useEffect(() => {
    unsavedEdit.current = editing ? { draft, base, editing } : null;
  }, [draft, base, editing]);
  // Status, logo and error messages share one slot, so the hook's error slot doubles as it.
  const {
    error: message,
    setError: setMessage,
    run,
    saving,
  } = useSaveMutation("บันทึกไม่สำเร็จ");
  const startEdit = (section: ConfigSection) => {
    const fresh = draftFromConfig(latestDatabase().config);
    setDraft(fresh);
    setBase(fresh);
    setEditing(section);
    setMessage("");
  };
  const set = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
  };
  // The file goes to storage now; the config saves only its key (and clears a legacy data URL).
  const readLogo = async (file: File) => {
    setMessage(`กำลังอัปโหลดโลโก้ ${file.name}…`);
    try {
      const key = await saveLogo(file);
      setDraft((current) => ({
        ...current,
        logoStorageKey: key,
        logoData: "",
        logoName: file.name,
      }));
      setMessage(
        `เลือกโลโก้ ${file.name} แล้ว · กดบันทึกและล็อกเพื่อใช้กับ PO`,
      );
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "อัปโหลดโลโก้ไม่สำเร็จ",
      );
    }
  };
  // Only the fields touched in this section are sent, so a setting someone else saved
  // meanwhile is kept.
  const changed = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(draft).filter(([key, value]) => value !== base[key]),
      ),
    [draft, base],
  );
  /* The save's own mutate, run on the draft as it stands, so a value the rules refuse is
   * said while it is being typed instead of after บันทึกและล็อก. mutate clones the
   * database, so a dry run changes nothing. Only while a section is open: the read-only
   * table has nothing to complain about. */
  const liveError = useMemo(() => {
    if (!editing) return "";
    try {
      buildConfig(db, changed);
      return "";
    } catch (caught) {
      return caught instanceof Error ? caught.message : "";
    }
  }, [editing, db, changed]);
  const save = async () => {
    const next = await run(() => buildConfig(latestDatabase(), changed));
    if (!next) return;
    setEditing(null);
    setMessage("บันทึกแล้ว · กลับสู่โหมดดูข้อมูล");
  };
  const edit: EditProps = {
    editing,
    draft,
    config: db.config,
    onChange: set,
    onLogo: readLogo,
    onMessage: setMessage,
  };
  const actionProps = {
    editing,
    message,
    error: liveError,
    saving,
    onCancel: () => setEditing(null),
    onSave: save,
    onStartEdit: startEdit,
  };
  const materialSettingsSource = editing === "materials" ? draft : db.config;
  const sharedMaterialValue = (index: number, price = false) => {
    const key = `${price ? "materialPrice" : "material"}${index}`;
    return (
      n(materialSettingsSource, key) ||
      n(materialSettingsSource, `${key}_saladaeng`) ||
      n(materialSettingsSource, `${key}_minburi`)
    );
  };
  const materialSettingsRows = materials.map((name, index) => {
    const amount = sharedMaterialValue(index);
    const price = sharedMaterialValue(index, true);
    return [
      <strong key="label">{name}</strong>,
      editing === "materials" ? (
        <ConfigValue
          {...edit}
          section="materials"
          name={`material${index}`}
          label={`${name} · จำนวนฐาน`}
          display={(value) => `${fmt(Number(value))} ชิ้น`}
        />
      ) : (
        <ReadOnlyValue key="amount">{fmt(amount)} ชิ้น</ReadOnlyValue>
      ),
      editing === "materials" ? (
        <ConfigValue
          {...edit}
          section="materials"
          name={`materialPrice${index}`}
          label={`${name} · ราคาต่อหน่วย`}
          display={(value) => `฿${fmt(Number(value))} / ชิ้น`}
        />
      ) : (
        <ReadOnlyValue key="price">฿{fmt(price)} / ชิ้น</ReadOnlyValue>
      ),
      <ReadOnlyValue key="total">฿{fmt(amount * price)}</ReadOnlyValue>,
      "ศาลาแดง และ มีนบุรี",
    ];
  });

  return (
    <div className="grid gap-6">
      <PanelHeading
        title="ตั้งค่าระบบ (Settings)"
        description="รายการด้านล่างคือค่าที่ Owner ปรับได้ทั้งหมดในเดโม ค่าต้นทุนการผลิตจะถูกบันทึกติดกับ PO ตอนสร้างรายการ ส่วนค่ารถใช้ค่าปัจจุบัน ณ ตอนสร้างใบขนส่ง"
        aside={
          message && !editing ? (
            <Badge tone="inverse" className="flex-none">
              {message}
            </Badge>
          ) : undefined
        }
      />
      <DataTable
        title="ข้อมูลหลักก่อนเริ่มระบบ (System setup)"
        action={<SectionAction section="main" {...actionProps} />}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย",
          "ใช้ในระบบ",
        ]}
        rows={[
          settingRow(
            "ชื่อบริษัท / ลูกค้า",
            <ConfigValue
              {...edit}
              section="main"
              name="companyName"
              type="text"
            />,
            "ข้อความ",
            "เติมใน PO อัตโนมัติ",
          ),
          settingRow(
            "ที่อยู่บริษัท",
            <ConfigValue
              {...edit}
              section="main"
              name="companyAddress"
              type="text"
            />,
            "ข้อความ",
            "เติมใน PO อัตโนมัติ",
          ),
          settingRow(
            "ผู้ติดต่อ (Attention)",
            <ConfigValue
              {...edit}
              section="main"
              name="attention"
              type="text"
            />,
            "ข้อความ",
            "เติมใน PO อัตโนมัติ",
          ),
          settingRow(
            "เบอร์ติดต่อ",
            <ConfigValue
              {...edit}
              section="main"
              name="companyPhone"
              type="text"
            />,
            "ข้อความ",
            "เติมใน PO อัตโนมัติ",
          ),
          settingRow(
            "เลขประจำตัวผู้เสียภาษี",
            <ConfigValue {...edit} section="main" name="taxId" type="text" />,
            "ข้อความ",
            "เติมใน PO อัตโนมัติ",
          ),
          settingRow(
            "สาขาที่เปิดใช้งาน",
            "ศาลาแดง, มีนบุรี",
            "2 สาขา",
            "ใช้กับสต๊อก รายงาน และบัญชีสาขา",
          ),
        ]}
      />
      <DataTable
        title="ข้อมูลบนใบ PO (PO document setup)"
        action={<SectionAction section="documents" {...actionProps} />}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย",
          "ใช้ใน PO",
        ]}
        rows={[
          settingRow(
            "โลโก้ NerdNuea",
            <ConfigValue
              {...edit}
              section="documents"
              name="logoData"
              type="file"
            />,
            "รูปภาพ",
            "แสดงหัวเอกสารทั้ง PO Foodiva และ PO Chef House",
          ),
          settingRow(
            "ผู้รับออเดอร์ Foodiva",
            <ConfigValue
              {...edit}
              section="documents"
              name="foodivaContact"
              type="text"
            />,
            "ข้อความ",
            "แสดงฝั่งผู้ขายใน PO เนื้อ",
          ),
          settingRow(
            "ที่อยู่บริษัท Foodiva",
            <ConfigValue
              {...edit}
              section="documents"
              name="foodivaAddress"
              type="textarea"
            />,
            "ข้อความ",
            "แสดงฝั่งผู้ขายใน PO เนื้อ",
          ),
          settingRow(
            "ผู้รับออเดอร์ Chef House",
            <ConfigValue
              {...edit}
              section="documents"
              name="chefHouseContact"
              type="text"
            />,
            "ข้อความ",
            "แสดงฝั่งผู้ให้บริการใน PO โรงรมควัน",
          ),
          settingRow(
            "ที่อยู่บริษัท Chef House",
            <ConfigValue
              {...edit}
              section="documents"
              name="chefHouseAddress"
              type="textarea"
            />,
            "ข้อความ",
            "แสดงฝั่งผู้ให้บริการใน PO โรงรมควัน",
          ),
        ]}
      />
      <DataTable
        title="ราคาและการขาย (Pricing & sales)"
        action={<SectionAction section="pricing" {...actionProps} />}
        columns={[...settingColumns, "ใช้คำนวณ (Purpose)"]}
        rows={[
          settingRow(
            "ราคากล่องมาตรฐาน (Standard box price)",
            <ConfigValue
              {...edit}
              section="pricing"
              name="boxPrice"
              display={baht}
            />,
            "บาท / กล่อง",
            "ยอดขายกล่องปกติ",
          ),
          settingRow(
            "ราคาเนื้อซีลเพิ่ม (Add-on pack price)",
            <ConfigValue
              {...edit}
              section="pricing"
              name="addonPrice"
              display={baht}
            />,
            "บาท / แพ็ก",
            "ยอดขายเนื้อเพิ่ม",
          ),
          settingRow(
            "น้ำหนักเฉลี่ยต่อซีล (Average sealed meat weight)",
            <ConfigValue
              {...edit}
              section="pricing"
              name="packKg"
              display={(value) => `${fmt(Number(value) * 1000)} กรัม`}
            />,
            "กรัม / ซีล",
            "ค่ากลาง 101.5 กรัม ระบบยอมรับช่วง 100–103 กรัม",
          ),
          settingRow(
            "ข้าวเหนียวในกล่อง (Included sticky rice)",
            "฿0.00",
            "200 กรัม / กล่อง",
            "รวมอยู่ในราคากล่อง",
          ),
          settingRow(
            "ราคาขายน้ำพริกหลอด (Chili selling price)",
            <ConfigValue
              {...edit}
              section="pricing"
              name="chiliPrice"
              display={baht}
            />,
            "บาท / หลอด",
            "น้ำพริกจำหน่ายแยกทุกหลอด ไม่รวมอยู่ในกล่องมาตรฐาน",
          ),
        ]}
      />
      <DataTable
        title="วัตถุดิบสาขา (Branch supplies)"
        action={<SectionAction section="supplies" {...actionProps} />}
        columns={[...settingColumns, "ใช้ควบคุม (Purpose)"]}
        rows={[
          settingRow(
            "จำนวนฐานข้าวเหนียวดิบ (Raw rice par level)",
            <ConfigValue
              {...edit}
              section="supplies"
              name="rawRicePar"
              display={plain}
            />,
            "กก.",
            "ระดับสต๊อกเป้าหมายของแต่ละสาขา",
          ),
          settingRow(
            "ราคาต่อหน่วยข้าวเหนียวดิบ (Raw rice unit price)",
            <ConfigValue
              {...edit}
              section="supplies"
              name="rawRiceUnitPrice"
              display={baht}
            />,
            "บาท / กก.",
            "ราคามาตรฐานสำหรับประเมินมูลค่าสต๊อก",
          ),
          settingRow(
            "จำนวนฐานน้ำพริก (Chili par level)",
            <ConfigValue
              {...edit}
              section="supplies"
              name="chiliPar"
              display={plain}
            />,
            "หลอด",
            "ระดับสต๊อกเป้าหมายของแต่ละสาขา",
          ),
          settingRow(
            "ราคาต่อหน่วยน้ำพริก (Chili unit price)",
            <ConfigValue
              {...edit}
              section="supplies"
              name="chiliUnitPrice"
              display={baht}
            />,
            "บาท / หลอด",
            "ราคามาตรฐานสำหรับประเมินมูลค่าสต๊อก",
          ),
          settingRow(
            "จำนวนฐานข้าวเหนียวสุก (Cooked rice par level)",
            <ConfigValue
              {...edit}
              section="supplies"
              name="cookedRicePar"
              display={plain}
            />,
            "กก.",
            "ยอดข้าวสุกที่ควรมีหลังซื้อข้าวสุกเข้า (เตือนเท่านั้น ไม่บล็อก)",
          ),
          settingRow(
            "ราคาต่อหน่วยข้าวเหนียวสุก (Cooked rice unit price)",
            <ConfigValue
              {...edit}
              section="supplies"
              name="cookedRiceUnitPrice"
              display={baht}
            />,
            "บาท / กก.",
            "ราคามาตรฐานสำหรับข้าวเหนียวสุกที่มีนบุรีซื้อ",
          ),
        ]}
      />
      <DataTable
        title="การผลิตและขนส่ง (Production & logistics)"
        action={<SectionAction section="production" {...actionProps} />}
        columns={[...settingColumns, "ใช้คำนวณ (Purpose)"]}
        rows={[
          settingRow(
            "ค่ารมควันตามน้ำหนัก PO (Smoking fee tiers)",
            "500 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก. ฿180",
            "บาท / กก.",
            "ระบบเลือกอัตราให้อัตโนมัติจากน้ำหนักในใบ PO รมควัน",
          ),
          settingRow(
            "ค่าขนส่งขาไป (Outbound delivery fee)",
            <ConfigValue
              {...edit}
              section="production"
              name="outboundFee"
              display={baht}
            />,
            "บาท / เที่ยว",
            "ต้นทุนส่งไป Chef House เที่ยวเดียว",
          ),
          settingRow(
            "ค่าขนส่งขากลับ (Return delivery fee)",
            <ConfigValue
              {...edit}
              section="production"
              name="returnFee"
              display={baht}
            />,
            "บาท / เที่ยว",
            "ต้นทุนรับสินค้ากลับเที่ยวเดียว",
          ),
          settingRow(
            "ค่าขนส่งไป-กลับ (Round-trip fee)",
            <ConfigValue
              {...edit}
              section="production"
              name="roundFee"
              display={baht}
            />,
            "บาท / รอบ",
            "ต้นทุนเมื่อเลือกเที่ยวไปกลับ",
          ),
        ]}
      />
      <DataTable
        title="กติกาสาขา (Branch rules)"
        action={<SectionAction section="branch" {...actionProps} />}
        columns={[...settingColumns, "ผลต่อการทำงาน (Effect)"]}
        rows={[
          settingRow(
            "สาขาเริ่มต้น (Default branch)",
            <ConfigValue
              {...edit}
              section="branch"
              name="branch"
              type="branch"
            />,
            "สาขา",
            "ใช้เมื่อ Owner, Foodiva หรือ Chef House ทำรายการโดยไม่เลือกสาขา · บัญชีสาขาใช้สาขาของตัวเองเสมอ",
          ),
          settingRow(
            "ค่าคลาดเคลื่อนยอดขาย (Sales tolerance)",
            <ConfigValue
              {...edit}
              section="branch"
              name="tolerance"
              display={plain}
            />,
            "%",
            "กำหนดช่วงยอดขายที่ยอมรับได้",
          ),
        ]}
      />
      <DataTable
        title="จำนวนฐานและราคาวัสดุทั้งร้าน (Material par levels & unit prices)"
        action={<SectionAction section="materials" {...actionProps} />}
        columns={materialSettingsColumns}
        rows={materialSettingsRows}
      />
      <Footnote className="-mt-1">
        จำนวนฐานและราคามาตรฐานชุดเดียวใช้กับศาลาแดงและมีนบุรี
        ส่วนการซื้อวัสดุให้บันทึกจากเมนูสต๊อก เพื่อเก็บวันที่ จำนวน
        และราคาซื้อจริงในแต่ละรอบ
      </Footnote>
    </div>
  );
}
