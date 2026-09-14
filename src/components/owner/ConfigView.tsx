"use client";

import { type ReactNode, useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { latestDatabase, saveDatabase } from "@/lib/persistence";
import { branches, materials, mutate, n, seed, type Database, type Values } from "@/lib/store";
import { fmt } from "@/lib/format";

export function ConfigView({ db }: { db: Database }) {
  type ConfigSection =
    "main" | "documents" | "pricing" | "supplies" | "production" | "branch" | "materials";
  const initial = () => {
    const values = { ...seed.config, ...db.config };
    for (let i = 0; i < materials.length; i++) {
      values[`material${i}`] = values[`material${i}`] || values[`material${i}_saladaeng`] || values[`material${i}_minburi`] || "0";
      values[`materialPrice${i}`] = values[`materialPrice${i}`] || values[`materialPrice${i}_saladaeng`] || values[`materialPrice${i}_minburi`] || "0";
    }
    return values;
  };
  const [draft, setDraft] = useState<Values>(initial);
  const [editing, setEditing] = useState<ConfigSection | null>(null);
  const [message, setMessage] = useState("");
  const row = (
    label: string,
    value: ReactNode,
    unit: string,
    detail: string,
  ): ReactNode[] => [<strong key="label">{label}</strong>, value, unit, detail];
  const startEdit = (section: ConfigSection) => {
    const current = latestDatabase().config;
    const values = { ...seed.config, ...current };
    for (let i = 0; i < materials.length; i++) {
      values[`material${i}`] = values[`material${i}`] || values[`material${i}_saladaeng`] || values[`material${i}_minburi`] || "0";
      values[`materialPrice${i}`] = values[`materialPrice${i}`] || values[`materialPrice${i}_saladaeng`] || values[`materialPrice${i}_minburi`] || "0";
    }
    setDraft(values);
    setEditing(section);
    setMessage("");
  };
  const set = (key: string, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setMessage("");
  };
  const save = () => {
    try {
      const next = mutate(
        latestDatabase(),
        "owner",
        "config",
        draft,
        "",
        new Date().toISOString().slice(0, 10),
      );
      saveDatabase(next);
      setEditing(null);
      setMessage("บันทึกแล้ว · กลับสู่โหมดดูข้อมูล");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "บันทึกไม่สำเร็จ");
    }
  };
  const action = (section: ConfigSection) => (
    <div className="inline-table-action">
      {editing === section && message && <span>{message}</span>}
      {editing === section ? (
        <>
          <button
            className="secondary"
            type="button"
            onClick={() => setEditing(null)}
          >
            ยกเลิก (Cancel)
          </button>
          <button className="primary" type="button" onClick={save}>
            บันทึกและล็อก (Save & lock)
          </button>
        </>
      ) : (
        <button
          className="secondary request-edit"
          type="button"
          disabled={editing !== null}
          onClick={() => startEdit(section)}
        >
          {editing ? "กำลังแก้ตารางอื่น" : "ขอแก้ไข (Request edit)"}
        </button>
      )}
    </div>
  );
  const valueCell = (
    section: ConfigSection,
    key: string,
    display: (value: string) => string = (value) => value,
    type: "number" | "time" | "branch" | "text" | "date" | "textarea" | "file" = "number",
  ) => {
    if (editing !== section) {
      if (type === "file" && db.config[key])
        // Stored locally as a data URL, so Next image optimization cannot process it.
        // eslint-disable-next-line @next/next/no-img-element
        return <img className="config-logo-preview" src={db.config[key]} alt="โลโก้ NerdNuea" />;
      return (
        <span className="read-only-value">
          {type === "file"
            ? "ยังไม่ได้อัปโหลด"
            : display(db.config[key] || seed.config[key] || "—")}
        </span>
      );
    }
    if (type === "branch")
      return (
        <select
          className="table-edit-control"
          aria-label={key}
          value={draft[key]}
          onChange={(event) => set(key, event.target.value)}
        >
          {branches.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      );
    if (type === "textarea")
      return (
        <textarea
          className="table-edit-control config-textarea"
          aria-label={key}
          rows={3}
          value={draft[key] ?? ""}
          onChange={(event) => set(key, event.target.value)}
        />
      );
    if (type === "file")
      return (
        <div className="config-logo-upload">
          <input
            aria-label="อัปโหลดโลโก้ NerdNuea"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (!file) return;
              if (file.size > 1024 * 1024) {
                setMessage("ไฟล์โลโก้ต้องมีขนาดไม่เกิน 1 MB");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => {
                setDraft((current) => ({ ...current, [key]: String(reader.result), logoName: file.name }));
                setMessage(`เลือกโลโก้ ${file.name} แล้ว · กดบันทึกและล็อกเพื่อใช้กับ PO`);
              };
              reader.readAsDataURL(file);
            }}
          />
          {draft[key] && (
            // Stored locally as a data URL, so Next image optimization cannot process it.
            // eslint-disable-next-line @next/next/no-img-element
            <img className="config-logo-preview" src={draft[key]} alt="ตัวอย่างโลโก้ NerdNuea" />
          )}
          <small>{draft.logoName || "รองรับ PNG, JPG, WebP หรือ SVG ไม่เกิน 1 MB"}</small>
        </div>
      );
    return (
      <input
        className="table-edit-control"
        aria-label={key}
        type={type === "time" ? "time" : type === "date" ? "date" : type === "text" ? "text" : "number"}
        min={type === "number" ? "0" : undefined}
        step={key === "packKg" ? "0.001" : key === "tolerance" ? "1" : "0.01"}
        value={draft[key] ?? ""}
        onChange={(event) => set(key, event.target.value)}
      />
    );
  };
  const materialSettingsSource = editing === "materials" ? draft : db.config;
  const sharedMaterialValue = (index: number, price = false) => {
    const key = `${price ? "materialPrice" : "material"}${index}`;
    return n(materialSettingsSource, key)
      || n(materialSettingsSource, `${key}_saladaeng`)
      || n(materialSettingsSource, `${key}_minburi`);
  };
  const materialSettingsColumns = ["วัสดุ (Material)", "จำนวนฐาน (Par level)", "ราคาต่อหน่วย (Unit price)", "มูลค่าฐาน (Par value)", "ใช้กับสาขา"];
  const materialSettingsRows = materials.map((name, index) => {
    const amount = sharedMaterialValue(index);
    const price = sharedMaterialValue(index, true);
    return [
      <strong key="label">{name}</strong>,
      editing === "materials"
        ? valueCell("materials", `material${index}`, (value) => `${fmt(Number(value))} ชิ้น`)
        : <span className="read-only-value" key="amount">{fmt(amount)} ชิ้น</span>,
      editing === "materials"
        ? valueCell("materials", `materialPrice${index}`, (value) => `฿${fmt(Number(value))} / ชิ้น`)
        : <span className="read-only-value" key="price">฿{fmt(price)} / ชิ้น</span>,
      <span className="read-only-value" key="total">฿{fmt(amount * price)}</span>,
      "ศาลาแดง และ มีนบุรี",
    ];
  });

  return (
    <div className="settings-stack">
      <section className="panel config-heading">
        <div>
          <h2>ตั้งค่าระบบ (Settings)</h2>
          <p className="muted">
            รายการด้านล่างคือค่าที่ Owner ปรับได้ทั้งหมดในเดโม
            ค่าต้นทุนการผลิตและค่ารถจะถูกบันทึกติดกับ PO ตอนสร้างรายการ
          </p>
        </div>
        {message && !editing && (
          <span className="save-confirmation">{message}</span>
        )}
      </section>
      <DataTable
        title="ข้อมูลหลักก่อนเริ่มระบบ (System setup)"
        action={action("main")}
        columns={["รายการ (Setting)", "ค่าปัจจุบัน (Current value)", "หน่วย", "ใช้ในระบบ"]}
        rows={[
          row("ชื่อบริษัท / ลูกค้า", valueCell("main", "companyName", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("ที่อยู่บริษัท", valueCell("main", "companyAddress", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("ผู้ติดต่อ (Attention)", valueCell("main", "attention", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("เบอร์ติดต่อ", valueCell("main", "companyPhone", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("เลขประจำตัวผู้เสียภาษี", valueCell("main", "taxId", undefined, "text"), "ข้อความ", "เติมใน PO อัตโนมัติ"),
          row("วันเริ่มใช้งานจริง", valueCell("main", "systemStartDate", undefined, "date"), "วันที่", "กำหนดวันเริ่มเก็บข้อมูลจริง"),
          row("สาขาที่เปิดใช้งาน", "ศาลาแดง, มีนบุรี", "2 สาขา", "ใช้กับสต๊อก รายงาน และบัญชีสาขา"),
        ]}
      />
      <DataTable
        title="ข้อมูลบนใบ PO (PO document setup)"
        action={action("documents")}
        columns={["รายการ (Setting)", "ค่าปัจจุบัน (Current value)", "หน่วย", "ใช้ใน PO"]}
        rows={[
          row("โลโก้ NerdNuea", valueCell("documents", "logoData", undefined, "file"), "รูปภาพ", "แสดงหัวเอกสารทั้ง PO Foodiva และ PO Chef_house"),
          row("ผู้รับออเดอร์ Foodiva", valueCell("documents", "foodDivaContact", undefined, "text"), "ข้อความ", "แสดงฝั่งผู้ขายใน PO เนื้อ"),
          row("ที่อยู่บริษัท Foodiva", valueCell("documents", "foodDivaAddress", undefined, "textarea"), "ข้อความ", "แสดงฝั่งผู้ขายใน PO เนื้อ"),
          row("ผู้รับออเดอร์ Chef_house", valueCell("documents", "chefHouseContact", undefined, "text"), "ข้อความ", "แสดงฝั่งผู้ให้บริการใน PO โรงรมควัน"),
          row("ที่อยู่บริษัท Chef_house", valueCell("documents", "chefHouseAddress", undefined, "textarea"), "ข้อความ", "แสดงฝั่งผู้ให้บริการใน PO โรงรมควัน"),
        ]}
      />
      <DataTable
        title="ราคาและการขาย (Pricing & sales)"
        action={action("pricing")}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย (Unit)",
          "ใช้คำนวณ (Purpose)",
        ]}
        rows={[
          row(
            "ราคากล่องมาตรฐาน (Standard box price)",
            valueCell(
              "pricing",
              "boxPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / กล่อง",
            "ยอดขายกล่องปกติ",
          ),
          row(
            "ราคาเนื้อซีลเพิ่ม (Add-on pack price)",
            valueCell(
              "pricing",
              "addonPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / แพ็ก",
            "ยอดขายเนื้อเพิ่ม",
          ),
          row(
            "น้ำหนักเฉลี่ยต่อซีล (Average sealed meat weight)",
            valueCell(
              "pricing",
              "packKg",
              (value) => `${fmt(Number(value) * 1000)} กรัม`,
            ),
            "กรัม / ซีล",
            "ค่ากลาง 101.5 กรัม ระบบยอมรับช่วง 100–103 กรัม",
          ),
          row(
            "ข้าวเหนียวในกล่อง (Included sticky rice)",
            "฿0.00",
            "200 กรัม / กล่อง",
            "รวมอยู่ในราคากล่อง",
          ),
          row(
            "ราคาขายน้ำพริกหลอด (Chili selling price)",
            valueCell(
              "pricing",
              "chiliPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / หลอด",
            "น้ำพริกจำหน่ายแยกทุกหลอด ไม่รวมอยู่ในกล่องมาตรฐาน",
          ),
        ]}
      />
      <DataTable
        title="วัตถุดิบสาขา (Branch supplies)"
        action={action("supplies")}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย (Unit)",
          "ใช้ควบคุม (Purpose)",
        ]}
        rows={[
          row(
            "จำนวนฐานข้าวเหนียวดิบ (Raw rice par level)",
            valueCell("supplies", "rawRicePar", (value) => fmt(Number(value))),
            "กก.",
            "ระดับสต๊อกเป้าหมายของแต่ละสาขา",
          ),
          row(
            "ราคาต่อหน่วยข้าวเหนียวดิบ (Raw rice unit price)",
            valueCell(
              "supplies",
              "rawRiceUnitPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / กก.",
            "ราคามาตรฐานสำหรับประเมินมูลค่าสต๊อก",
          ),
          row(
            "จำนวนฐานน้ำพริก (Chili par level)",
            valueCell("supplies", "chiliPar", (value) => fmt(Number(value))),
            "หลอด",
            "ระดับสต๊อกเป้าหมายของแต่ละสาขา",
          ),
          row(
            "ราคาต่อหน่วยน้ำพริก (Chili unit price)",
            valueCell(
              "supplies",
              "chiliUnitPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / หลอด",
            "ราคามาตรฐานสำหรับประเมินมูลค่าสต๊อก",
          ),
          row(
            "จำนวนฐานข้าวเหนียวสุกมีนบุรี (Cooked rice par level)",
            valueCell("supplies", "cookedRicePar", (value) =>
              fmt(Number(value)),
            ),
            "กก.",
            "ยอดข้าวพร้อมขายขั้นต่ำหลังซื้อเข้า ปัจจุบันตั้งไว้ 30 กก.",
          ),
          row(
            "ราคาต่อหน่วยข้าวเหนียวสุก (Cooked rice unit price)",
            valueCell(
              "supplies",
              "cookedRiceUnitPrice",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / กก.",
            "ราคามาตรฐานสำหรับข้าวเหนียวสุกที่มีนบุรีซื้อ",
          ),
        ]}
      />
      <DataTable
        title="การผลิตและขนส่ง (Production & logistics)"
        action={action("production")}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย (Unit)",
          "ใช้คำนวณ (Purpose)",
        ]}
        rows={[
          row(
            "ค่ารมควันตามน้ำหนัก PO (Smoking fee tiers)",
            "500 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก. ฿180",
            "บาท / กก.",
            "ระบบเลือกอัตราให้อัตโนมัติจากน้ำหนักในใบ PO รมควัน",
          ),
          row(
            "ค่าขนส่งขาไป (Outbound delivery fee)",
            valueCell(
              "production",
              "outboundFee",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / เที่ยว",
            "ต้นทุนส่งไป Chef_house เที่ยวเดียว",
          ),
          row(
            "ค่าขนส่งขากลับ (Return delivery fee)",
            valueCell(
              "production",
              "returnFee",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / เที่ยว",
            "ต้นทุนรับสินค้ากลับเที่ยวเดียว",
          ),
          row(
            "ค่าขนส่งไป-กลับ (Round-trip fee)",
            valueCell(
              "production",
              "roundFee",
              (value) => `฿${fmt(Number(value))}`,
            ),
            "บาท / รอบ",
            "ต้นทุนเมื่อเลือกเที่ยวไปกลับ",
          ),
        ]}
      />
      <DataTable
        title="กติกาสาขา (Branch rules)"
        action={action("branch")}
        columns={[
          "รายการ (Setting)",
          "ค่าปัจจุบัน (Current value)",
          "หน่วย (Unit)",
          "ผลต่อการทำงาน (Effect)",
        ]}
        rows={[
          row(
            "สาขาของบัญชีผู้ดูแล (Assigned branch)",
            valueCell("branch", "branch", undefined, "branch"),
            "สาขา",
            "กำหนดข้อมูลที่บัญชีสาขาเห็นและกรอกได้",
          ),
          row(
            "ค่าคลาดเคลื่อนยอดขาย (Sales tolerance)",
            valueCell("branch", "tolerance", (value) => fmt(Number(value))),
            "%",
            "กำหนดช่วงยอดขายที่ยอมรับได้",
          ),
          row(
            "เวลาเริ่มปิดวัน (Day-closing time)",
            valueCell("branch", "closeTime", undefined, "time"),
            "นาฬิกา",
            "เวลา 22:00 ระบบล็อกข้อมูลเมื่อปิดวัน Owner ปลดล็อกกรณีพิเศษได้",
          ),
        ]}
      />
      <DataTable
        title="จำนวนฐานและราคาวัสดุทั้งร้าน (Material par levels & unit prices)"
        action={action("materials")}
        columns={materialSettingsColumns}
        rows={materialSettingsRows}
      />
      <p className="footnote">
        จำนวนฐานและราคามาตรฐานชุดเดียวใช้กับศาลาแดงและมีนบุรี ส่วนการซื้อวัสดุให้บันทึกจากเมนูสต๊อก
        เพื่อเก็บวันที่ จำนวน และราคาซื้อจริงในแต่ละรอบ
      </p>
    </div>
  );
}
