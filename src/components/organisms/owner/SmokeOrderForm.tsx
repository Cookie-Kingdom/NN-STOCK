"use client";

import { useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FormError } from "@/components/molecules/FormError";
import { FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { LotProgressChips } from "@/components/molecules/LotProgressChips";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { EntryFieldControl } from "@/components/organisms/shared/EntryForm";
import { PurchaseOrderDocumentPreview } from "@/components/organisms/shared/PurchaseOrderDocumentPreview";
import { usePrefill } from "@/components/organisms/shared/usePrefill";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { defaults, forms } from "@/lib/forms";
import { fmt } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import { prefillValues, type Prefill } from "@/lib/prefill";
import {
  check,
  entries,
  mutate,
  packingListKg,
  poRemainingKg,
  purchaseLots,
  shipments,
  titles,
  type Database,
  type Lot,
} from "@/lib/store";

/** A batch that does not exist yet: what the prefill reads for "ชุดใหม่" (no Packing List). */
const newBatch: Lot = {
  id: "",
  poId: "",
  kind: "shipment",
  values: {},
  config: {},
};

/**
 * The Owner's smoke PO (SMK-08). One form does what the Request and the smoke PO did:
 * pick the batch ("ชุดใหม่" or one Foodiva / Chef House already opened without a PO),
 * say how many kg each purchase PO sends (`lines`, each showing what it has left), and the
 * PO itself. Nothing is waited for: a PO with no Foodiva invoice or a batch with no Packing
 * List still saves, and `mutate` says so as a warning.
 */
export function SmokeOrderForm({
  db,
  lotId,
  date,
  onDate,
  onClose,
  onSaved,
}: {
  db: Database;
  /** The batch to issue the PO on; `""` opens a new one. */
  lotId: string;
  date: string;
  onDate: (date: string) => void;
  onClose: () => void;
  onSaved: (next: Database) => void;
}) {
  const openBatches = shipments(db).filter(
    (lot) => !entries(db, "smokeOrder", lot.id).length,
  );
  const [batch, setBatch] = useState(() =>
    openBatches.some((lot) => lot.id === lotId) ? lotId : "",
  );
  const lot = openBatches.find((item) => item.id === batch);
  const pos = purchaseLots(db).filter((po) => poRemainingKg(db, po.id) > 0.001);
  const [kg, setKg] = useState<Record<string, string>>({});
  const total = pos.reduce((sum, po) => sum + (Number(kg[po.id]) || 0), 0);
  /** rawKg follows the Packing List when the batch has one, else the kg chosen per PO. */
  const prefillFor = (target: Lot | undefined, linesKg: number): Prefill => {
    const base = prefillValues(db, "smokeOrder", target ?? newBatch, { date });
    if (packingListKg(db, target?.id ?? "") !== undefined || linesKg <= 0)
      return base;
    return {
      values: { ...base.values, rawKg: String(+linesKg.toFixed(6)) },
      sources: {
        ...base.sources,
        rawKg: { label: "ตามยอด PO ซื้อที่เลือก" },
      },
    };
  };
  const { values, sources, set, refill } = usePrefill(() => ({
    base: { ...defaults("smokeOrder", date), smoker: "Chef House" },
    prefill: prefillFor(lot, 0),
  }));
  const { error, setError, run, saving } = useSaveMutation(
    "ออก PO รมควันไม่สำเร็จ",
  );
  const input = {
    ...values,
    lines: JSON.stringify(
      pos
        .filter((po) => kg[po.id]?.trim())
        .map((po) => ({ lotId: po.id, kg: kg[po.id].trim() })),
    ),
  };
  const formFields = forms.smokeOrder ?? [];
  const complete = formFields
    .filter((field) => !field.optional)
    .every((field) => String(values[field.key] ?? "").trim());
  // The save's own mutate as a dry run (it clones). Warnings at once; a refusal only
  // once every required field has something in it.
  const dryRun = check(() =>
    mutate(db, "owner", "smokeOrder", input, batch, date),
  );
  const live = {
    warnings: dryRun.warnings,
    error: complete ? dryRun.error : "",
  };
  const setLine = (poId: string, value: string) => {
    const next = { ...kg, [poId]: value };
    setKg(next);
    setError("");
    refill(
      prefillFor(
        lot,
        pos.reduce((sum, po) => sum + (Number(next[po.id]) || 0), 0),
      ),
    );
  };
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const saved = await run(() =>
      mutate(latestDatabase(), "owner", "smokeOrder", input, batch, date),
    );
    if (saved) onSaved(saved);
  }
  return (
    <Dialog
      overline={lot ? `${lot.poId} · ${lot.id}` : "ชุดรมควันใหม่"}
      title={titles.smokeOrder}
      size="preview"
      onClose={onClose}
    >
      <DialogForm noValidate onSubmit={submit}>
        <div className="min-h-0 flex-auto overflow-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.95fr)] lg:overflow-hidden">
          <DialogBody className="border-b border-border max-lg:overflow-visible lg:border-r lg:border-b-0">
            <WorkingDateField asField date={date} onDate={onDate} />
            <FormField
              label="ชุดรมควัน"
              hint="ชุดที่ Foodiva หรือ Chef House เปิดไว้แล้วแต่ยังไม่มี PO รมควัน หรือเปิดชุดใหม่"
            >
              <Select
                autoFocus
                data-autofocus
                value={batch}
                onChange={(event) => {
                  const next = openBatches.find(
                    (item) => item.id === event.target.value,
                  );
                  setBatch(event.target.value);
                  setError("");
                  refill(prefillFor(next, total));
                }}
              >
                <option value="">ชุดใหม่ (ระบบออกเลขที่การส่งให้)</option>
                {openBatches.map((item) => {
                  const listKg = packingListKg(db, item.id);
                  return (
                    <option key={item.id} value={item.id}>
                      {item.poId} · {item.id}
                      {listKg === undefined
                        ? " · ยังไม่มี Packing List"
                        : ` · Packing List ${fmt(listKg)} กก.`}
                    </option>
                  );
                })}
              </Select>
            </FormField>
            {lot && (
              <Notice className="mt-3">
                <LotProgressChips db={db} lotId={lot.id} />
              </Notice>
            )}
            <DataTable
              title="PO ซื้อที่ใช้ในชุดนี้ (กก.)"
              columns={[
                "เลข PO",
                "Invoice เนื้อ",
                "คงเหลือ",
                "ส่งชุดนี้ (กก.)",
              ]}
              numericColumns={["ส่งชุดนี้ (กก.)"]}
              emptyText="ไม่มี PO ซื้อที่มีเนื้อคงเหลือ · ออก PO รมควันได้โดยไม่ระบุ PO ซื้อ แล้วผูกภายหลัง"
              rowKeys={pos.map((po) => po.id)}
              rows={pos.map((po) => {
                const invoice = entries(db, "foodivaConfirm", po.id).at(-1);
                return [
                  <strong key="po">{po.poId}</strong>,
                  invoice ? (
                    invoice.values.invoiceNo || "มีแล้ว"
                  ) : (
                    <Badge key="invoice" tone="warning">
                      ยังไม่มี Invoice
                    </Badge>
                  ),
                  `${fmt(poRemainingKg(db, po.id))} กก.`,
                  <Input
                    key="kg"
                    variant="table"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    aria-label={`น้ำหนักที่ส่งจาก ${po.poId}`}
                    placeholder="0"
                    value={kg[po.id] || ""}
                    onChange={(event) => setLine(po.id, event.target.value)}
                  />,
                ];
              })}
            />
            <FormGrid>
              {formFields.map((field) => (
                <EntryFieldControl
                  key={field.key}
                  field={field}
                  autoFocus={false}
                  values={values}
                  source={sources[field.key]}
                  set={(key, value) => {
                    set(key, value);
                    setError("");
                  }}
                  onFile={() => {}}
                  files={[]}
                  onFiles={() => {}}
                  onFileError={setError}
                />
              ))}
            </FormGrid>
            <FormError error={error} />
          </DialogBody>
          <PurchaseOrderDocumentPreview
            db={db}
            lot={lot}
            kind="smokeOrder"
            values={values}
            date={date}
          />
        </div>
        <DialogFooter
          submitting={saving}
          error={live.error}
          warning={live.warnings}
          hint={`รวม PO ซื้อ ${fmt(total)} กก. · ตรวจ Preview ก่อนบันทึก PO`}
          onCancel={onClose}
          submitLabel="บันทึก PO รมควันเนื้อ"
        />
      </DialogForm>
    </Dialog>
  );
}
