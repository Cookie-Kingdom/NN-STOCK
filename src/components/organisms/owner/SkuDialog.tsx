"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { Caption } from "@/components/atoms/Text";
import { Dialog } from "@/components/molecules/Dialog";
import { ShowMore, useShowMore } from "@/components/molecules/ShowMore";
import { Cell, StockTable } from "@/components/organisms/branch/BranchStock";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { latestDatabase } from "@/lib/persistence";
import { mutate, skuCatalogue } from "@/lib/store";

export const skuTitle = "รายการสินค้า (SKU)";

/** Settings 「รายการสินค้า (SKU)」 as a popup: every SKU with its name, ten rows at a time,
 *  under a search by SKU or name. A ledger item's name is typed here (`skuNames`); a
 *  material's is read-only, it is named in รายชื่อวัสดุ. 「บันทึก」 saves the names as one
 *  `config` note and closes; a name `mutate` refuses is said beside the buttons. */
export function SkuDialog({
  ws,
  onClose,
}: {
  ws: Workspace;
  onClose: () => void;
}) {
  const { account, today } = ws;
  const [items] = useState(() => skuCatalogue(latestDatabase()));
  /** The names typed, by SKU: only the ones changed. */
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const word = search.trim().toLowerCase();
  const { limit, more } = useShowMore(word, 10);

  const nameOf = (item: (typeof items)[number]) => typed[item.sku] ?? item.name;
  // Searched by the name as saved: a row does not leave while its name is being typed.
  const found = items.filter(
    (item) =>
      !word ||
      item.sku.toLowerCase().includes(word) ||
      item.name.toLowerCase().includes(word),
  );
  const changed = items.some((item) => nameOf(item).trim() !== item.name);
  const save = async () => {
    const next = await run(() =>
      mutate(
        latestDatabase(),
        account,
        "config",
        {
          // Only the ledger items' names: a material's is in รายชื่อวัสดุ.
          skuNames: JSON.stringify(
            items
              .filter((item) => !item.material)
              .map((item) => ({ sku: item.sku, name: nameOf(item).trim() })),
          ),
        },
        "",
        today,
      ),
    );
    if (!next) return;
    ws.setToast(`บันทึกแล้ว: ${skuTitle}`);
    onClose();
  };

  return (
    <Dialog
      size="md"
      title={skuTitle}
      subtitle={`${items.length} รายการ · SKU ออกโดยเว็บ แก้ได้เฉพาะชื่อ`}
      onClose={onClose}
    >
      <div className="border-b border-border px-6.5 py-3 max-md:px-4">
        <Input
          type="search"
          variant="filter"
          data-autofocus
          aria-label="ค้นหา"
          placeholder="ค้นหา SKU หรือชื่อรายการ"
          className="w-full"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="min-h-0 flex-auto overflow-y-auto">
        <StockTable columns={["SKU", "ชื่อรายการ", "ประเภท"]}>
          {found.slice(0, limit).map((item) => (
            <tr key={item.sku}>
              <Cell className="font-mono whitespace-nowrap text-accent">
                {item.sku}
              </Cell>
              {item.material ? (
                <Cell>{item.name}</Cell>
              ) : (
                <Cell className="py-1.5">
                  <Input
                    aria-label={`ชื่อรายการ ${item.sku}`}
                    className="mt-0 min-h-10 min-w-28"
                    value={nameOf(item)}
                    onChange={(event) => {
                      setError("");
                      setTyped({ ...typed, [item.sku]: event.target.value });
                    }}
                  />
                </Cell>
              )}
              <Cell>
                <Caption as="span">
                  {item.material
                    ? "วัสดุ · แก้ชื่อที่ รายชื่อวัสดุ"
                    : "รายการในบัญชีซื้อ"}
                </Caption>
              </Cell>
            </tr>
          ))}
          {found.length === 0 && (
            <tr>
              <Cell
                colSpan={3}
                className="py-6 text-center text-text-secondary"
              >
                {items.length
                  ? "ไม่มีรายการที่ตรงกับคำค้น"
                  : "ยังไม่มีรายการที่มี SKU"}
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
