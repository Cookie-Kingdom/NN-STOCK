"use client";

import { useState } from "react";
import { Button } from "@/components/atoms/Button";
import { Combobox, SearchSelect } from "@/components/atoms/Combobox";
import { Input } from "@/components/atoms/Input";
import { Spinner } from "@/components/atoms/Spinner";
import { Caption } from "@/components/atoms/Text";
import { Dialog } from "@/components/molecules/Dialog";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { unitOptions } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  boxProduct,
  gramItems,
  materialList,
  mutate,
  productMoney,
  productUnit,
  products,
  salesChannels,
  sheetItems,
  type Database,
  type Values,
} from "@/lib/store";

export const productsTitle = "รายการสินค้า";

/** A product as the popup holds it: every figure as typed. `code` is only read (`mutate`
 *  issues it); `prices` is the price per sales channel, by the channel's key. */
export type ProductDraft = {
  id: string;
  code: string;
  name: string;
  unit: string;
  off: boolean;
  price: string;
  cost: string;
  prices: Record<string, string>;
  items: { id: string; qty: string }[];
};

/** What a product may be built from: the meat, the raw rice and the chili, then every
 *  material, each with the unit its quantity is typed in. */
export const productItems = (db: Database) =>
  [...sheetItems(db, "meat"), ...materialList(db)].map((item) => ({
    id: item.id,
    name: item.name,
    unit: gramItems.includes(item.id) ? "กรัม" : item.unit,
  }));

/** 「รายการสินค้า」 as it stands, a draft per product. */
export const productDrafts = (db: Database): ProductDraft[] =>
  products(db.config).map((product) => {
    const { price, cost, prices } = productMoney(db.config, product.id);
    return {
      id: product.id,
      code: product.code,
      name: product.name,
      unit: product.unit,
      off: product.off,
      price: String(price ?? ""),
      cost: String(cost ?? ""),
      prices: { ...prices },
      items: [...product.items].map(([id, qty]) => ({ id, qty: String(qty) })),
    };
  });

/** A new product, not in the list until saved. */
export const newProduct = (): ProductDraft => ({
  // ponytail: the clock as the short id; one Owner adds one product at a time.
  id: "p" + Date.now().toString(36),
  code: "",
  name: "",
  unit: productUnit(""),
  off: false,
  price: "",
  cost: "",
  prices: {},
  items: [],
});

/** The drafts as `config` holds them: `products` (what a branch reads too) and `productMoney`
 *  (the Owner's only). A component with no quantity is not kept, nor a channel price left
 *  empty; the code is not sent (`mutate` keeps or issues it). */
const stored = (list: ProductDraft[]): Values => ({
  products: JSON.stringify(
    list.map(({ id, name, unit, off, items }) => ({
      id,
      name: name.trim(),
      unit: unit.trim(),
      ...(off && { off }),
      items: items
        .map((item) => ({ id: item.id, qty: item.qty.trim() }))
        .filter((item) => item.qty),
    })),
  ),
  productMoney: JSON.stringify(
    list.map(({ id, price, cost, prices }) => ({
      id,
      price: price.trim(),
      cost: cost.trim(),
      prices: Object.fromEntries(
        Object.entries(prices)
          .map(([key, value]) => [key, String(value).trim()])
          .filter(([, value]) => value),
      ),
    })),
  ),
});

/** One product of Settings 「รายการสินค้า」 as a popup: its code (read only), its name, its unit, its
 *  price, its cost beside the meat, its price per sales channel (empty: the price), its
 *  components (a stock item and how much one piece takes) and whether it is off sale. 「บันทึก」 lays
 *  it over the list as it stands now and saves that as one `config` note, only the keys it
 *  changed; 「ลบสินค้า」 takes it out once confirmed (never the standard box). What `mutate` refuses is said
 *  beside the buttons. */
export function ProductDialog({
  ws,
  product,
  onClose,
}: {
  ws: Workspace;
  product: ProductDraft;
  onClose: () => void;
}) {
  const { account, today } = ws;
  const [draft, setDraft] = useState(product);
  /** 「ลบสินค้า」 was pressed: the popup asks once before it takes the product out. */
  const [removing, setRemoving] = useState(false);
  const [all] = useState(() => productItems(latestDatabase()));
  const [channels] = useState(() => salesChannels(latestDatabase().config));
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const isNew = !productDrafts(latestDatabase()).some(
    (p) => p.id === product.id,
  );
  const set = (change: Partial<ProductDraft>) => {
    setError("");
    setDraft({ ...draft, ...change });
  };
  const setQty = (id: string, qty: string) =>
    set({
      items: draft.items.map((item) =>
        item.id === id ? { ...item, qty } : item,
      ),
    });
  // The unit as typed words the popup; left empty it is the product's default.
  const unit = draft.unit.trim() || productUnit(draft.id);
  const left = all.filter(
    (item) => !draft.items.some((used) => used.id === item.id),
  );

  /** Saves the list as it stands now with this product put in, or with `remove` taken out. */
  const save = async (remove = false) => {
    const input = () => {
      const now = productDrafts(latestDatabase());
      const next = remove
        ? now.filter((p) => p.id !== draft.id)
        : now.some((p) => p.id === draft.id)
          ? now.map((p) => (p.id === draft.id ? draft : p))
          : [...now, draft];
      const before = stored(now);
      return Object.fromEntries(
        Object.entries(stored(next)).filter(
          ([key, value]) =>
            value !== before[key] ||
            // A product saved before codes has none: any save of the list issues it.
            (key === "products" && now.some((p) => !p.code)),
        ),
      );
    };
    if (Object.keys(input()).length) {
      const next = await run(() =>
        mutate(latestDatabase(), account, "config", input(), "", today),
      );
      if (!next) return;
      ws.setToast(
        remove
          ? `ลบสินค้าแล้ว: ${product.name}`
          : `บันทึกแล้ว: ${productsTitle}`,
      );
    }
    onClose();
  };

  return (
    <Dialog
      size="md"
      title={isNew ? "เพิ่มสินค้า" : `แก้ไขสินค้า: ${product.name}`}
      subtitle={`ขายหรือแจก 1 ${unit} เว็บตัดสต๊อกของสาขาตามส่วนประกอบในนี้`}
      onClose={onClose}
    >
      <div className="min-h-0 flex-auto overflow-y-auto px-6.5 max-md:px-4">
        <Caption className="mt-4.5 block">
          {draft.code
            ? `รหัสสินค้า ${draft.code}`
            : "รหัสสินค้าออกให้อัตโนมัติตอนบันทึก"}
        </Caption>
        <FormGrid>
          <FormField label="ชื่อสินค้า">
            <Input
              data-autofocus
              value={draft.name}
              onChange={(event) => set({ name: event.target.value })}
            />
          </FormField>
          <FormField label="หน่วยนับ">
            <Combobox
              options={unitOptions(latestDatabase())}
              value={draft.unit}
              onChange={(unit) => set({ unit })}
            />
          </FormField>
          <FormField label={`ราคาขายต่อ${unit} (บาท)`}>
            {/* Text, not number: `mutate` words the refusal of a bad figure. */}
            <Input
              inputMode="decimal"
              value={draft.price}
              onChange={(event) => set({ price: event.target.value })}
            />
          </FormField>
          <FormField
            label={`ต้นทุนอื่นต่อ${unit} (บาท)`}
            hint="ต้นทุนนอกจากเนื้อ เช่น แพ็กเกจ ส่วนต้นทุนเนื้อเว็บคิดให้จากส่วนประกอบ「เนื้อ」"
          >
            <Input
              inputMode="decimal"
              value={draft.cost}
              onChange={(event) => set({ cost: event.target.value })}
            />
          </FormField>
        </FormGrid>
        <section
          aria-label="ราคาขายแยกตามช่องทางขาย"
          className="mb-4.5 flex flex-col gap-2"
        >
          <h3 className="m-0 text-label text-text-secondary">
            ราคาขายแยกตามช่องทางขาย
          </h3>
          <Caption>ช่องทางที่เว้นว่างใช้ราคาขายด้านบน</Caption>
          {channels.map((channel) => (
            <div
              key={channel.key}
              className="grid grid-cols-[minmax(0,1fr)_5.5rem_3rem] items-center gap-2"
            >
              <span className="[overflow-wrap:anywhere]">{channel.name}</span>
              <Input
                inputMode="decimal"
                aria-label={`ราคาขาย ${channel.name}`}
                className="mt-0 min-h-10 text-right"
                placeholder={draft.price.trim()}
                value={draft.prices[channel.key] ?? ""}
                onChange={(event) =>
                  set({
                    prices: {
                      ...draft.prices,
                      [channel.key]: event.target.value,
                    },
                  })
                }
              />
              <Caption as="span">บาท</Caption>
            </div>
          ))}
        </section>
        <section aria-label="ส่วนประกอบ" className="mb-4.5 flex flex-col gap-2">
          <h3 className="m-0 text-label text-text-secondary">
            ส่วนประกอบต่อ 1 {unit}
          </h3>
          {draft.items.length === 0 && (
            <Caption>ยังไม่ตั้งส่วนประกอบ ขายแล้วจะไม่ตัดสต๊อก</Caption>
          )}
          {draft.items.map((item) => {
            // A material since removed from the list still reads by its id.
            const known = all.find((x) => x.id === item.id);
            const name = known?.name ?? item.id;
            return (
              <div
                key={item.id}
                className="grid grid-cols-[minmax(0,1fr)_5.5rem_3rem_auto] items-center gap-2"
              >
                <span className="[overflow-wrap:anywhere]">{name}</span>
                <Input
                  inputMode="decimal"
                  aria-label={`จำนวน ${name}`}
                  className="mt-0 min-h-10 text-right"
                  value={item.qty}
                  onChange={(event) => setQty(item.id, event.target.value)}
                />
                <Caption as="span">{known?.unit}</Caption>
                <Button
                  variant="link"
                  className="min-h-11 px-2 text-label text-danger hover:text-danger"
                  aria-label={`ลบ ${name}`}
                  onClick={() =>
                    set({ items: draft.items.filter((x) => x.id !== item.id) })
                  }
                >
                  ลบ
                </Button>
              </div>
            );
          })}
          {left.length > 0 && (
            <SearchSelect
              aria-label="เพิ่มส่วนประกอบ"
              placeholder="ค้นหาแล้วเลือกส่วนประกอบ"
              // Never holds a choice: a pick becomes a row above.
              value=""
              options={left.map((item) => ({
                value: item.id,
                label: item.name,
                hint: item.unit,
              }))}
              onChange={(id) =>
                set({ items: [...draft.items, { id, qty: "" }] })
              }
            />
          )}
        </section>
        <label className="flex min-h-11 w-fit items-center gap-2 font-semibold">
          <input
            type="checkbox"
            className="size-5 accent-accent"
            checked={draft.off}
            onChange={(event) => set({ off: event.target.checked })}
          />
          หยุดขาย
        </label>
        <Caption className="mb-4.5 block">
          สินค้าที่หยุดขายไม่ขึ้นในฟอร์มยอดขายและกล่องแจกใหม่
          ยอดที่เคยจดยังนับตามเดิม
        </Caption>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 border-t border-border px-6.5 py-3 max-md:px-4">
        {error && (
          <span role="alert" className="w-full text-body-sm text-danger">
            {error}
          </span>
        )}
        {removing ? (
          <>
            <span role="alert" className="w-full text-body-sm text-danger">
              ลบ「{product.name}」? ยอดที่เคยจดของสินค้านี้จะไม่ถูกนับอีก
              ถ้าแค่เลิกขาย ให้ติ๊ก「หยุดขาย」แทน ยอดที่เคยจดจะยังนับอยู่
            </span>
            <Button disabled={saving} onClick={() => setRemoving(false)}>
              ไม่ลบ
            </Button>
            <Button
              variant="primary"
              disabled={saving}
              icon={saving ? <Spinner /> : undefined}
              onClick={() => save(true)}
            >
              ยืนยันลบ
            </Button>
          </>
        ) : (
          <>
            {!isNew && product.id !== boxProduct && (
              <Button
                variant="link"
                className="mr-auto min-h-11 px-2 text-danger hover:text-danger"
                disabled={saving}
                onClick={() => setRemoving(true)}
              >
                ลบสินค้า
              </Button>
            )}
            <Button onClick={onClose}>ยกเลิก</Button>
            <Button
              variant="primary"
              disabled={saving || !!error}
              icon={saving ? <Spinner /> : undefined}
              onClick={() => save()}
            >
              {saving ? "กำลังบันทึก…" : "บันทึก"}
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
