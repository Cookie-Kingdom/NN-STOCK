"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Combobox } from "@/components/atoms/Combobox";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { Muted } from "@/components/atoms/Text";
import { Dialog } from "@/components/molecules/Dialog";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { Cell, StockTable } from "@/components/organisms/branch/BranchStock";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { unitOptions } from "@/lib/forms";
import { newId } from "@/lib/id";
import { latestDatabase } from "@/lib/persistence";
import {
  ingredientList,
  materialList,
  mutate,
  type Database,
  type Material,
  type Values,
} from "@/lib/store";

export const materialsTitle = "รายชื่อวัสดุ";
export const ingredientsTitle = "รายชื่อวัตถุดิบ";
/** The two lists this popup edits: the materials (SKU) and the ingredients (ING code, an
 *  `ing-` id: `sheetOf` reads it as the Stock sheet's). */
const lists = {
  materials: {
    title: materialsTitle,
    key: "materialList",
    what: "วัสดุ",
    code: "SKU",
    read: materialList,
    // ponytail: the clock as the short id; one Owner adds one row at a time.
    newId: () => "m" + Date.now().toString(36),
  },
  ingredients: {
    title: ingredientsTitle,
    key: "ingredientList",
    what: "วัตถุดิบ",
    code: "รหัส",
    read: (db: Database): Material[] => ingredientList(db.config),
    newId: () => "ing-" + newId(),
  },
};

/** Settings 「รายชื่อวัสดุ」 (or, with `list="ingredients"`, 「รายชื่อวัตถุดิบ」, the same way) as a popup, as 「รายการสินค้า (SKU)」 is: every material (the rows a
 *  branch added on its sheet with them), ten rows at a time, under a search by SKU or name.
 *  A row's name and unit are typed, its SKU never (`mutate` issues it on the save); 「เพิ่มวัสดุ」
 *  puts a new row on top, 「ลบ」 takes one out. 「บันทึก」 saves the list as one `config` note
 *  and closes; a row `mutate` refuses is said beside the buttons. */
export function MaterialsDialog({
  ws,
  list = "materials",
  onClose,
}: {
  ws: Workspace;
  list?: keyof typeof lists;
  onClose: () => void;
}) {
  const { account, today } = ws;
  const { title, key, what, code } = lists[list];
  const [saved] = useState<Values[]>(() => lists[list].read(latestDatabase()));
  const [rows, setRows] = useState(saved);
  const [units] = useState(() => unitOptions(latestDatabase()));
  const [search, setSearch] = useState("");
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const word = search.trim().toLowerCase();
  const { limit, more } = useShowMore(word, 10);

  const before = new Map(saved.map((row) => [row.id, row]));
  // A row just added is always in view; the others are searched by the name as saved, so
  // a row does not leave while its name is being typed.
  const added = rows.filter((row) => !before.has(row.id));
  const found = rows.filter((row) => {
    const was = before.get(row.id);
    return (
      was &&
      (!word ||
        (was.sku ?? "").toLowerCase().includes(word) ||
        was.name.toLowerCase().includes(word))
    );
  });
  const set = (id: string, change: Values) => {
    setError("");
    setRows(rows.map((row) => (row.id === id ? { ...row, ...change } : row)));
  };
  const typed: Values[] = rows.map((row) => ({
    ...row,
    name: row.name.trim(),
  }));
  const changed =
    JSON.stringify(typed) !== JSON.stringify(saved) ||
    // A list stored before SKUs: saving it as it is issues them (mutate).
    typed.some((row) => !row.sku);
  const save = async () => {
    const next = await run(() =>
      mutate(
        latestDatabase(),
        account,
        "config",
        { [key]: JSON.stringify(typed) },
        "",
        today,
      ),
    );
    if (!next) return;
    ws.setToast(`บันทึกแล้ว: ${title}`);
    onClose();
  };

  return (
    <Dialog
      size="md"
      title={title}
      subtitle={`ทั้งหมด ${rows.length} รายการ แก้ชื่อและหน่วยนับได้ ส่วน${code}ออกให้อัตโนมัติตอนบันทึก`}
      onClose={onClose}
    >
      <div className="flex items-center gap-2 border-b border-border px-6.5 py-3 max-md:px-4">
        <Input
          type="search"
          variant="filter"
          data-autofocus
          aria-label="ค้นหา"
          placeholder={`ค้นหา${code}หรือชื่อ${what}`}
          className="min-w-0 flex-1"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Button
          size="sm"
          onClick={() => {
            setError("");
            setRows([{ id: lists[list].newId(), name: "", unit: "" }, ...rows]);
          }}
        >
          เพิ่ม{what}
        </Button>
      </div>
      <div className="min-h-0 flex-auto overflow-y-auto">
        <StockTable columns={[code, what, "หน่วยนับ", ""]}>
          {[...added, ...found.slice(0, limit)].map((row) => {
            const name = row.name || `${what}ใหม่`;
            return (
              <tr key={row.id}>
                <Cell className="font-mono whitespace-nowrap text-accent">
                  {row.sku || <Muted as="span">รอบันทึก</Muted>}
                </Cell>
                <Cell className="py-1.5">
                  <Input
                    aria-label={`ชื่อ${what} ${row.sku ?? "ใหม่"}`}
                    className="mt-0 min-h-10 min-w-28"
                    // A row just added is the one being typed.
                    autoFocus={!before.has(row.id) && !row.name}
                    value={row.name}
                    onChange={(event) =>
                      set(row.id, { name: event.target.value })
                    }
                  />
                </Cell>
                <Cell className="py-1.5 [&>span]:mt-0">
                  <Combobox
                    aria-label={`หน่วยนับ ${name}`}
                    className="min-h-10 w-28"
                    placeholder="ชิ้น"
                    options={units}
                    value={row.unit ?? ""}
                    onChange={(unit) => set(row.id, { unit })}
                  />
                </Cell>
                <Cell right className="py-0">
                  <Button
                    variant="link"
                    className="min-h-11 px-2 text-label text-danger hover:text-danger"
                    aria-label={`ลบ ${name}`}
                    onClick={() => {
                      setError("");
                      setRows(rows.filter((x) => x.id !== row.id));
                    }}
                  >
                    ลบ
                  </Button>
                </Cell>
              </tr>
            );
          })}
          {added.length + found.length === 0 && (
            <tr>
              <Cell
                colSpan={4}
                className="py-6 text-center text-text-secondary"
              >
                {rows.length ? "ไม่พบรายการที่ค้นหา" : `ยังไม่มี${what}`}
              </Cell>
            </tr>
          )}
        </StockTable>
        <ShowMore
          shown={Math.min(limit, found.length)}
          total={found.length}
          onMore={more}
        />
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-border px-6.5 py-3 max-md:px-4">
        {error && (
          <span role="alert" className="mr-auto text-body-sm text-danger">
            {error}
          </span>
        )}
        <Button onClick={onClose}>ยกเลิก</Button>
        <Button
          variant="primary"
          disabled={!changed || saving || !!error}
          icon={saving ? <Spinner /> : undefined}
          onClick={save}
        >
          {saving ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </Dialog>
  );
}
