"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Checkbox } from "@/components/atoms/Checkbox";
import { Input } from "@/components/atoms/Input";
import { Select } from "@/components/atoms/Select";
import { Textarea } from "@/components/atoms/Textarea";
import { DialogForm } from "@/components/molecules/DialogForm";
import { FileUploadField } from "@/components/molecules/FileUploadField";
import { FormError } from "@/components/molecules/FormError";
import { FieldHint, FormField } from "@/components/molecules/FormField";
import { FormGrid } from "@/components/molecules/FormGrid";
import { Notice } from "@/components/molecules/Notice";
import { WorkingDateField } from "@/components/molecules/WorkingDateField";
import { ReferenceCard } from "@/components/molecules/ReferenceCard";
import { CloseDayChecklist } from "@/components/organisms/branch/CloseDayChecklist";
import { DailySummary } from "@/components/organisms/branch/DailySummary";
import { MeatDaySummary } from "@/components/organisms/branch/MeatDaySummary";
import { Dialog } from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { DialogFooter } from "@/components/organisms/shared/DialogFooter";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import { AttachmentViewButton } from "@/components/organisms/shared/InvoiceDownloadButton";
import { PackWeightFields } from "@/components/organisms/shared/PackWeightFields";
import { Preview } from "@/components/organisms/shared/Preview";
import { PurchaseOrderDocumentPreview } from "@/components/organisms/shared/PurchaseOrderDocumentPreview";
import { referenceDocument } from "@/components/organisms/shared/referenceDocument";
import { usePrefill } from "@/components/organisms/shared/usePrefill";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import { saveAttachment } from "@/lib/attachment-store";
import { defaults, forms, timeOptions } from "@/lib/forms";
import { latestDatabase } from "@/lib/persistence";
import {
  oldestFrozenLot,
  prefillDrivers,
  prefillValues,
  type PrefillSource,
} from "@/lib/prefill";
import {
  allocationOutstanding,
  balance,
  centralStock,
  closeDayChecklist,
  cookedRiceStock,
  entries,
  mutate,
  n,
  OverStockError,
  packWeightWarning,
  riceSources,
  cooksRice,
  roleName,
  saleWithInfluencers,
  smokingInvoiceRejection,
  stages,
  titles,
  type Database,
  type Role,
  type Values,
  type EntryKind,
} from "@/lib/store";
import { fmt, today } from "@/lib/format";
import { type Modal } from "@/lib/nav";
import { cn } from "@/lib/utils";

type FieldSpec = NonNullable<(typeof forms)[keyof typeof forms]>[number];

const submitLabels: Record<string, string> = {
  closeDay: "ยืนยันปิดวัน",
  purchase: "บันทึก PO เนื้อ",
  smokeOrder: "บันทึก PO รมควันเนื้อ",
  smokingInvoice: "Submit ใบวางบิล",
  dispatch: "สร้างใบขนส่งขาไป",
  return: "สร้างใบขนส่งขากลับ",
};

const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024;

/** A `location` field keeps a free-typed place in `<key>Custom`; the entry stores the
 *  place itself. Shared by the save and the live check so both see the same values. */
function resolveLocations(values: Values) {
  const out = { ...values };
  for (const key of ["origin", "destination"]) {
    if (out[key] === "อื่น ๆ") {
      const custom = out[`${key}Custom`]?.trim();
      if (!custom)
        throw new Error(
          `กรุณาระบุ${key === "origin" ? "ต้นทาง" : "ปลายทาง"}เอง`,
        );
      out[key] = custom;
    }
  }
  return out;
}

/** One control from `forms[kind]`, rendered by its `type`. */
export function EntryFieldControl({
  field: f,
  autoFocus,
  values,
  source,
  set,
  onFile,
  files,
  onFiles,
  onFileError,
}: {
  field: FieldSpec;
  autoFocus: boolean;
  values: Values;
  /** Where the prefilled value came from; absent once the user has changed it. */
  source?: PrefillSource;
  set: (key: string, value: string) => void;
  onFile: (key: string, file: File | null) => void;
  files: File[];
  onFiles: (key: string, files: File[]) => void;
  onFileError: (message: string) => void;
}) {
  if (f.type === "files")
    return (
      <FileUploadField
        label={f.label}
        optional={f.optional}
        // Payment slips (Owner meat and smoking-invoice payments) read "(ไม่บังคับ)".
        optionalText="ไม่บังคับ"
        hint={f.hint}
        accept={f.accept}
        multiple
        maxBytes={MAX_ATTACHMENT_BYTES}
        oversizeMessage="ไฟล์แต่ละไฟล์ต้องมีขนาดไม่เกิน 2 MB"
        onError={onFileError}
        onFiles={(picked) => onFiles(f.key, picked)}
        fileName={files.map((file) => file.name).join("\n")}
      />
    );
  if (f.type === "file")
    return (
      <FileUploadField
        label={f.label}
        optional={f.optional}
        hint={f.hint}
        accept={f.accept}
        required={!f.optional}
        maxBytes={MAX_ATTACHMENT_BYTES}
        oversizeMessage="ไฟล์ Invoice ต้องมีขนาดไม่เกิน 2 MB"
        onError={onFileError}
        onFile={(file) => onFile(f.key, file)}
        fileName={values[f.key]}
      />
    );
  return (
    <FormField
      label={f.label}
      optional={f.optional}
      hint={f.hint}
      wide={f.type === "textarea"}
      prefilled={source}
    >
      {f.type === "select" ? (
        <Select
          value={values[f.key] || ""}
          required={!f.optional}
          onChange={(e) => set(f.key, e.target.value)}
        >
          {!values[f.key] && <option value="">เลือก</option>}
          {f.options!.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      ) : f.type === "location" ? (
        <>
          <Select
            value={values[f.key] || ""}
            required
            onChange={(e) => set(f.key, e.target.value)}
          >
            {f.options!.map((o) => (
              <option key={o}>{o}</option>
            ))}
          </Select>
          {values[f.key] === "อื่น ๆ" && (
            <Input
              autoFocus
              placeholder="พิมพ์จังหวัด / จุดส่งเอง"
              value={values[`${f.key}Custom`] || ""}
              onChange={(e) => set(`${f.key}Custom`, e.target.value)}
            />
          )}
        </>
      ) : f.type === "time" ? (
        <Select
          value={values[f.key] || ""}
          required={!f.optional}
          onChange={(e) => set(f.key, e.target.value)}
        >
          <option value="">เลือกเวลา</option>
          {timeOptions(values[f.key]).map((o) => (
            <option key={o}>{o}</option>
          ))}
        </Select>
      ) : f.type === "textarea" ? (
        <Textarea
          compact={f.key === "note"}
          required={!f.optional}
          rows={f.key === "packs" ? 5 : f.key === "note" ? 1 : 3}
          value={values[f.key] || ""}
          onChange={(e) => set(f.key, e.target.value)}
        />
      ) : (
        <Input
          autoFocus={autoFocus}
          data-autofocus={autoFocus || undefined}
          type={f.type || "text"}
          maxLength={f.digits}
          inputMode={
            f.type === "number" ? "decimal" : f.digits ? "numeric" : undefined
          }
          min={
            f.type === "number"
              ? f.zero
                ? 0
                : f.integer
                  ? 1
                  : 0.01
              : undefined
          }
          step={
            f.type === "number"
              ? f.integer
                ? 1
                : f.key === "packKg"
                  ? 0.001
                  : 0.01
              : undefined
          }
          max={f.key === "tolerance" ? 100 : f.past ? today() : undefined}
          required={!f.optional}
          value={values[f.key] ?? ""}
          onChange={(e) => set(f.key, e.target.value)}
        />
      )}
    </FormField>
  );
}

/** One influencer giveaway entered with the day's sale; `id` keeps React's list stable
 *  while blocks are added and removed. */
type Giveaway = { id: string; values: Values };

const influencerFields = forms.influencerBox ?? [];
/** What a block must have in it before the save is worth trying. */
const influencerRequired = influencerFields
  .filter((field) => !field.optional)
  .map((field) => field.key);

/**
 * The giveaways recorded as part of บันทึกยอดขาย / Waste. Collapsed to one button:
 * pressing it opens a block, pressing it again opens another, so one sale can record
 * several influencers. A sale with no block added saves exactly what it always did.
 */
function SaleInfluencers({
  blocks,
  onAdd,
  onRemove,
  onChange,
}: {
  blocks: Giveaway[];
  /** Adds an empty block and returns its id, or "" when no lot is picked yet. */
  onAdd: () => string;
  onRemove: (id: string) => void;
  onChange: (id: string, key: string, value: string) => void;
}) {
  const addRef = useRef<HTMLButtonElement>(null);
  /* A block that appears without focus is invisible to a keyboard or screen-reader
   * user: the new one's first field takes focus as it mounts, and removing one hands
   * focus back to the add button rather than dropping it on <body>. */
  const pendingFocus = useRef("");
  const noop = () => {};
  return (
    <div className="mt-4.5">
      <h3 className="text-body font-medium">
        อินฟลูเอนเซอร์ที่ส่งของให้วันนี้
      </h3>
      <FieldHint>
        ไม่ได้ส่งวันนี้ก็ปิดวันได้เลย · กดเพิ่มได้หลายคน ระบบคิดน้ำหนักเนื้อจาก
        จำนวนกล่อง × น้ำหนักเฉลี่ยต่อซีลให้เอง
      </FieldHint>
      {blocks.map((block, index) => (
        <div
          key={block.id}
          ref={(node) => {
            if (!node || pendingFocus.current !== block.id) return;
            pendingFocus.current = "";
            node.querySelector<HTMLElement>("input")?.focus();
          }}
          className="mt-3.5 rounded-lg border border-border bg-bg px-4.5 py-3.5 max-md:px-3.5"
        >
          <div className="flex items-center justify-between gap-3">
            <strong className="text-body-sm">
              อินฟลูเอนเซอร์ที่ {index + 1}
            </strong>
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={16} />}
              aria-label={`ลบอินฟลูเอนเซอร์ที่ ${index + 1}`}
              onClick={() => {
                onRemove(block.id);
                addRef.current?.focus();
              }}
            >
              ลบ
            </Button>
          </div>
          <FormGrid className="my-3.5">
            {influencerFields.map((field) => (
              <EntryFieldControl
                key={field.key}
                field={field}
                autoFocus={false}
                values={block.values}
                set={(key, value) => onChange(block.id, key, value)}
                onFile={noop}
                files={[]}
                onFiles={noop}
                onFileError={noop}
              />
            ))}
          </FormGrid>
        </div>
      ))}
      <Button
        ref={addRef}
        className="mt-3.5"
        variant="secondary"
        size="sm"
        icon={<Plus size={16} />}
        onClick={() => {
          pendingFocus.current = onAdd();
        }}
      >
        เพิ่มอินฟลูเอนเซอร์
      </Button>
    </div>
  );
}

export function EntryForm({
  db,
  role,
  date,
  onDate,
  modal,
  onClose,
  onSaved,
  onOpen,
  branch,
}: {
  db: Database;
  role: Role;
  /** The workspace branch: the branch account's own, or config.branch for other roles. */
  branch: string;
  date: string;
  /** Sets the workspace date: the form has no date of its own. */
  onDate: (date: string) => void;
  modal: Modal;
  onClose: () => void;
  onSaved: (db: Database) => void;
  /** Opens another workspace form in place of this one (the close-day checklist). */
  onOpen?: (kind: EntryKind) => void;
}) {
  // WorkspaceModals opens the two document views (ModalKind) in their own dialogs.
  const kind = modal.kind as EntryKind;
  const useLot = [
    "receive",
    "thaw",
    "sale",
    "influencerBox",
    "allocate",
  ].includes(kind);
  const choices = db.lots.filter(
    (l) =>
      l.stage >= 8 &&
      (role === "owner" || entries(db, "allocate", l.id, branch).length),
  );
  // A lot the form cannot use would leave the required select empty and the
  // browser would block submit before onSubmit, with no message from us.
  // Thawing starts on the oldest frozen lot (FIFO), the one mutate expects.
  const [lotId, setLotId] = useState(() => {
    if (!useLot || choices.some((l) => l.id === modal.lotId))
      return modal.lotId;
    const fifo = kind === "thaw" ? oldestFrozenLot(db, branch) : undefined;
    return fifo && choices.some((l) => l.id === fifo.id)
      ? fifo.id
      : (choices[0]?.id ?? "");
  });
  const lot = db.lots.find((l) => l.id === lotId);
  const {
    values,
    sources,
    set: setValue,
    refill,
  } = usePrefill(() => {
    if (kind === "config")
      return { base: { ...db.config }, prefill: { values: {}, sources: {} } };
    const base = { ...defaults(kind, date) };
    if (kind === "receive") base.complete = "1";
    return { base, prefill: prefillValues(db, kind, lot, { branch, date }) };
  });
  /** The prefill for `lotFor` with the form as it stands after `changes`. */
  const prefillFor = (lotFor: typeof lot, changes: Values) =>
    prefillValues(db, kind, lotFor, {
      branch,
      date,
      values: { ...values, ...changes },
    });
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  /* Influencer giveaways are part of the day's sale (one entry each, saved just before
   * the sale). The section starts collapsed: no block, no giveaway. */
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const nextGiveawayId = useRef(0);
  const addGiveaway = () => {
    // A giveaway hangs on the lot the sale itself is open on, so it cannot be filled
    // before that lot is picked (a branch with no thawed lot has none to pick).
    if (!lotId) {
      setError("เลือก Lot ต้นทางก่อน แล้วจึงเพิ่มอินฟลูเอนเซอร์");
      return "";
    }
    const id = `giveaway-${++nextGiveawayId.current}`;
    setGiveaways((current) => [
      ...current,
      {
        id,
        values: {
          ...defaults("influencerBox", date),
          ...prefillValues(db, "influencerBox", lot, { branch, date }).values,
        },
      },
    ]);
    setError("");
    return id;
  };
  const removeGiveaway = (id: string) => {
    setGiveaways((current) => current.filter((g) => g.id !== id));
    setError("");
  };
  const changeGiveaway = (id: string, key: string, value: string) => {
    setGiveaways((current) =>
      current.map((g) =>
        g.id === id ? { ...g, values: { ...g.values, [key]: value } } : g,
      ),
    );
    setError("");
  };
  const attachmentFiles = useRef<Record<string, File>>({});
  /* `files` fields (payment slips) stay out of `values` until the save: the live
   * mutate check would read a list of names as a broken slips JSON. */
  const [multiFiles, setMultiFiles] = useState<Record<string, File[]>>({});
  const allocations = entries(db, "allocate", lotId, branch)
    .map((e) => ({ entry: e, outstanding: allocationOutstanding(db, e) }))
    .filter((a) => a.outstanding > 0);
  /** What a lot option says. Receiving: what Owner sent this branch, what is in and what
   *  is still to come; a lot not yet received would read "0.00 แช่แข็ง" as nothing came. */
  const lotSummary = (id: string) => {
    if (kind === "allocate")
      return `${fmt(centralStock(db, id))} กก. ในคลังกลาง`;
    if (kind === "receive") {
      const sent = entries(db, "allocate", id, branch);
      const kg = (list: typeof sent) =>
        list.reduce((total, e) => total + n(e.values, "kg"), 0);
      const pending = sent.reduce(
        (total, e) => total + allocationOutstanding(db, e),
        0,
      );
      return `ส่งมา ${fmt(kg(sent))} กก. · รับแล้ว ${fmt(kg(entries(db, "receive", id, branch)))} กก. · ค้างรับ ${fmt(pending)} กก.`;
    }
    const stock = balance(db, id, branch);
    return `แช่แข็ง ${fmt(stock.frozen)} กก. / คงเหลือชิล ${fmt(stock.ready)} กก.`;
  };
  const latestSmokingInvoice =
    kind === "smokingInvoice" && lot
      ? entries(db, "smokingInvoice", lot.id).at(-1)
      : undefined;
  const rejection =
    latestSmokingInvoice && smokingInvoiceRejection(db, latestSmokingInvoice);
  const reference =
    lot && !useLot ? referenceDocument(db, kind, lot) : undefined;
  // Minburi only buys cooked rice: no source picker, always the bought-cooked side.
  const riceSource = cooksRice(branch) ? values.riceSource : riceSources[1];
  const formFields = (forms[kind] || []).filter((field) => {
    if (kind === "smoke" && field.key === "packs") return false;
    // ricePurchase follows the round's choice, not the branch (B2); it starts on the
    // branch's last choice.
    if (kind === "ricePurchase" && field.key === "riceSource")
      return cooksRice(branch);
    if (kind === "ricePurchase")
      return riceSource === riceSources[0]
        ? !["cookedRiceKg", "cookedRiceCost"].includes(field.key)
        : riceSource === riceSources[1]
          ? !["rawRiceKg", "rawRiceCost"].includes(field.key)
          : !/^(raw|cooked)Rice/.test(field.key);
    if (kind === "supplyPurchase")
      return branch === "มีนบุรี"
        ? !["rawRiceKg", "rawRiceCost"].includes(field.key)
        : !["cookedRiceKg", "cookedRiceCost"].includes(field.key);
    if (kind === "supplyIssue" && branch === "มีนบุรี")
      return field.key !== "rawRiceIssuedKg";
    return true;
  });
  const set = (key: string, value: string) => {
    setValue(key, value);
    setError("");
    // A field other prefills follow (a branch, a pack count): refill the untouched ones.
    if (prefillDrivers[kind]?.includes(key))
      refill(prefillFor(lot, { [key]: value }));
  };
  const setFile = (key: string, file: File | null) => {
    if (!file) {
      set(key, "");
      delete attachmentFiles.current[key];
      return;
    }
    attachmentFiles.current[key] = file;
    set(key, file.name);
  };
  // Controls mutate() insists on that are rendered outside `formFields`.
  const extraRequired =
    kind === "smoke" ? ["packs"] : kind === "receive" ? ["allocation"] : [];
  const complete =
    (!useLot || Boolean(lotId)) &&
    [
      ...formFields.filter((f) => !f.optional).map((f) => f.key),
      ...extraRequired,
    ].every((key) => String(values[key] ?? "").trim()) &&
    // An open influencer block is part of the form: an unfinished one is not told off.
    giveaways.every((g) =>
      influencerRequired.every((key) => String(g.values[key] ?? "").trim()),
    );
  /* The save's own mutate, run on the values as they stand, so the form can say a
   * weight is over stock while it is being typed instead of after ยืนยัน. mutate
   * clones the database, so a dry run changes nothing. Until every required control
   * has something in it only an over-stock amount is said: an unfinished form must
   * not be told off for being unfinished, but a quantity over stock is wrong already. */
  const liveError = useMemo(() => {
    try {
      // The sale runs the whole composition, so a giveaway over stock is said here
      // and not after บันทึกรายการ; the message names the block that was refused.
      if (kind === "sale" && giveaways.length)
        saleWithInfluencers(
          db,
          branch,
          date,
          lotId,
          giveaways.map((g) => g.values),
          resolveLocations(values),
        );
      else
        mutate(db, role, kind, resolveLocations(values), lotId, date, branch);
      return "";
    } catch (caught) {
      if (!complete && !(caught instanceof OverStockError)) return "";
      return caught instanceof Error ? caught.message : "";
    }
  }, [complete, db, role, kind, values, lotId, date, branch, giveaways]);
  const checklist =
    kind === "closeDay" ? closeDayChecklist(db, branch, date) : [];
  const missing = checklist.find((item) => item.required && !item.done);
  const isPurchaseOrder = kind === "purchase" || kind === "smokeOrder";
  const title = titles[kind];
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    // run() rebuilds the change after a revision conflict; upload each file once.
    const uploaded: Record<string, string> = {};
    const saved = await run(async () => {
      const resolvedValues = resolveLocations(values);
      // A conflict retry sees the entries saved meanwhile: an untouched running
      // number is counted again from them, so two entries never share one.
      const latest = latestDatabase();
      for (const key of ["invoiceNo", "invoiceNumber"]) {
        if (!sources[key]) continue;
        const next = prefillValues(
          latest,
          kind,
          latest.lots.find((l) => l.id === lotId),
          { branch, date, values },
        ).values[key];
        if (next) resolvedValues[key] = next;
      }
      for (const [key, file] of Object.entries(attachmentFiles.current)) {
        resolvedValues[`${key}StorageKey`] = uploaded[key] ??=
          await saveAttachment(file, kind);
      }
      for (const [key, files] of Object.entries(multiFiles)) {
        const list = [];
        for (const [index, file] of files.entries())
          list.push({
            name: file.name,
            storageKey: (uploaded[`${key}.${index}`] ??= await saveAttachment(
              file,
              kind,
            )),
          });
        resolvedValues[key] = JSON.stringify(list);
      }
      /* ponytail: no legacy-attachment migration here any more. Persistence sends
       * the loaded history back untouched (the server rejects edited entries), so
       * the rewrite was discarded, and its re-upload of every old file on each
       * submit could stall or fail a PO or sale that never touched a file. */
      /* The giveaways and the sale land in one save, the giveaways first (see
       * saleWithInfluencers). One invalid block throws before anything is persisted,
       * so nothing at all is written and the form stays open on the block to fix. */
      if (kind === "sale" && giveaways.length)
        return saleWithInfluencers(
          latestDatabase(),
          branch,
          date,
          lotId,
          giveaways.map((g) => g.values),
          resolvedValues,
        );
      return mutate(
        latestDatabase(),
        role,
        kind,
        resolvedValues,
        lotId,
        date,
        branch,
      );
    });
    if (saved) onSaved(saved);
  }
  return (
    <Dialog
      overline={`${date} · ${roleName[role]}`}
      title={title}
      // The sale holds its own long form plus repeated influencer blocks; every
      // other form keeps its width.
      size={
        isPurchaseOrder ? "preview" : kind === "sale" ? "formWide" : "default"
      }
      onClose={onClose}
    >
      {/* noValidate: a native `required` bubble is not in the DOM and Escape on it
          also closes the dialog. Let mutate() refuse and say why in FormError. */}
      <DialogForm noValidate onSubmit={submit}>
        {/* Below lg the PO form and its preview stack in one scroll area: two nested
            scrollers in a fixed-height grid each shrink to a sliver on a phone. */}
        <div
          className={
            isPurchaseOrder
              ? "min-h-0 flex-1 overflow-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(440px,0.95fr)] lg:overflow-hidden"
              : "min-h-0 flex-1 overflow-auto"
          }
        >
          <DialogBody
            className={cn(
              isPurchaseOrder
                ? "border-b border-border max-lg:overflow-visible lg:border-r lg:border-b-0"
                : "overflow-visible",
            )}
          >
            <WorkingDateField asField date={date} onDate={onDate} />
            {isPurchaseOrder && (
              <Notice className="mb-4.5">
                เอกสาร PO ในส่วน Preview จะเปลี่ยนตามข้อมูลที่กรอกทันที
              </Notice>
            )}
            {lot && !useLot && (
              <Notice>
                {lot.id} · {stages[lot.stage]}
              </Notice>
            )}
            {useLot && (
              <FormField label="Lot ต้นทาง">
                <Select
                  autoFocus
                  data-autofocus
                  value={lotId}
                  required
                  onChange={(e) => {
                    setLotId(e.target.value);
                    setError("");
                    // Refill what the user has not changed from the new lot; the
                    // allocation picked for the old lot goes back to the prefill.
                    refill(
                      prefillFor(
                        db.lots.find((l) => l.id === e.target.value),
                        kind === "receive" ? { allocation: "" } : {},
                      ),
                      kind === "receive" ? ["allocation"] : [],
                    );
                  }}
                >
                  <option value="">เลือก Lot</option>
                  {choices.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id} · {lotSummary(l.id)}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            {kind === "receive" && (
              <FormField
                label="ใบจัดสรรที่รับ"
                hint={
                  !allocations.length
                    ? "ยังไม่มีใบจัดสรรค้างรับของ Lot นี้"
                    : undefined
                }
              >
                <Select
                  required
                  value={values.allocation || ""}
                  onChange={(e) => {
                    set("allocation", e.target.value);
                    refill(prefillFor(lot, { allocation: e.target.value }));
                  }}
                >
                  <option value="">เลือกใบจัดสรร</option>
                  {allocations.map((a) => (
                    <option key={a.entry.id} value={a.entry.id}>
                      {a.entry.date} · ค้างรับ {fmt(a.outstanding)} กก. ·{" "}
                      {a.entry.id.slice(0, 6)}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            {kind === "receive" && (
              <label className="mt-4 flex cursor-pointer items-start gap-3 text-body-sm font-medium">
                <Checkbox
                  className="mt-0.5"
                  checked={values.complete === "1"}
                  onChange={(e) => set("complete", e.target.checked ? "1" : "")}
                />
                <span>
                  รับครบใบจัดสรรนี้แล้ว
                  <FieldHint>
                    ปิดใบจัดสรรหลังบันทึก
                    ถ้ารับน้อยกว่ายอดค้างรับต้องใส่เหตุผลส่วนต่าง ·
                    เอาเครื่องหมายออกถ้ายังมีของตามมาอีก
                  </FieldHint>
                </span>
              </label>
            )}
            {kind === "closeDay" && (
              <>
                <CloseDayChecklist
                  items={checklist}
                  onGo={(item) =>
                    item.kind && onOpen ? onOpen(item.kind) : onClose()
                  }
                />
                <MeatDaySummary db={db} branch={branch} date={date} />
                <DailySummary db={db} branch={branch} date={date} />
              </>
            )}
            {rejection && (
              <Notice tone="warning" className="mt-3">
                {`Owner ส่งกลับแก้ไขใบวางบิล ${latestSmokingInvoice?.values.invoiceNumber || ""} · หมายเหตุ: ${rejection.values.comment?.trim() || "ไม่ได้ระบุ"}`}
                {rejection.values.reviewedBy &&
                  ` · ผู้ตรวจ ${rejection.values.reviewedBy}`}
              </Notice>
            )}
            {kind === "smoke" && (
              <Notice>
                บันทึกครั้งละ 1 รอบสโมค ระบบจะสร้าง Lot สโมครายวันแยกให้
                และเก็บวันที่ จำนวนกล่องรมควัน น้ำหนักกล่องรมควัน และ Waste ใน
                Log
              </Notice>
            )}
            {kind === "foodivaConfirm" && (
              <Notice>
                แบ่งน้ำหนักตาม Invoice ให้ครบทุกกิโล: พร้อมส่ง Chef House
                ที่เชียงใหม่ + เนื้อส่วนที่เหลือรอ Owner รับ (Waste)
                ต้องรวมเท่ากับน้ำหนักตาม Invoice
              </Notice>
            )}
            {kind === "unlock" && (
              <Notice tone="warning">
                ปลดล็อกให้เพิ่มรายการแก้ไขของสาขาได้ ประวัติเดิมจะยังอยู่ ยอดขาย
                สต๊อก และรายงานจะคำนวณเพิ่มจากรายการใหม่
              </Notice>
            )}
            {((kind === "supplyPurchase" && branch === "มีนบุรี") ||
              (kind === "ricePurchase" && riceSource === riceSources[1])) && (
              <Notice>
                ข้าวเหนียวสุกคงเหลือ {fmt(cookedRiceStock(db, branch))} กก. ·
                ควรซื้อเพิ่มอย่างน้อย{" "}
                {fmt(
                  Math.max(
                    0,
                    n(db.config, "cookedRicePar") - cookedRiceStock(db, branch),
                  ),
                )}{" "}
                กก. เพื่อให้มีข้าวสุกไม่น้อยกว่า{" "}
                {fmt(n(db.config, "cookedRicePar"))} กก.
                {cookedRiceStock(db, branch) <= 0.001
                  ? " · วันแรกปกติซื้อประมาณ 31–33 กก."
                  : " · ระบบหักของเหลือที่นำกลับมาอุ่นแล้ว จึงซื้อวันถัดไปน้อยลงได้"}
              </Notice>
            )}
            <FormGrid>
              {formFields.map((f, index) => (
                <EntryFieldControl
                  key={f.key}
                  field={f}
                  autoFocus={index === 0 && !useLot}
                  values={values}
                  source={sources[f.key]}
                  set={set}
                  onFile={setFile}
                  files={multiFiles[f.key] ?? []}
                  onFiles={(key, files) => {
                    setMultiFiles((current) => ({ ...current, [key]: files }));
                    setError("");
                  }}
                  onFileError={setError}
                />
              ))}
              {kind === "smoke" && (
                <PackWeightFields
                  value={values.packs || ""}
                  onChange={(value) => set("packs", value)}
                />
              )}
            </FormGrid>
            {/* Only the sale weighs its meat; a giveaway's kg is derived from the
                box count, so it can never be off the 100–103 g band. */}
            {kind === "sale" && (
              <SaleInfluencers
                blocks={giveaways}
                onAdd={addGiveaway}
                onRemove={removeGiveaway}
                onChange={changeGiveaway}
              />
            )}
            {kind === "sale" &&
              n(values, "soldKg") > 0 &&
              packWeightWarning(values) && (
                <Notice tone="warning" className="mt-3">
                  {packWeightWarning(values)}
                </Notice>
              )}
            {reference && (
              <ReferenceCard
                title={reference.title}
                number={reference.number}
                rows={reference.rows.filter(([label]) =>
                  reference.summary.includes(label),
                )}
                action={
                  reference.attachment ? (
                    <AttachmentViewButton {...reference.attachment} />
                  ) : (
                    <DocumentPrintButton
                      title={reference.title}
                      number={reference.number}
                      rows={reference.rows}
                      label="ดูเอกสาร"
                      preview
                    />
                  )
                }
              />
            )}
            {!isPurchaseOrder && kind !== "cmReceive" && (
              <Preview
                db={db}
                branch={branch}
                lot={lot}
                kind={kind}
                v={values}
                giveaways={
                  kind === "sale" ? giveaways.map((g) => g.values) : undefined
                }
              />
            )}
            <FormError error={error} />
          </DialogBody>
          {isPurchaseOrder && (
            <PurchaseOrderDocumentPreview
              db={db}
              lot={lot}
              kind={kind}
              values={values}
              date={date}
            />
          )}
        </div>
        <DialogFooter
          submitting={saving}
          error={missing ? `ยังปิดวันไม่ได้ · ${missing.message}` : liveError}
          submitDisabled={!!missing}
          hint={
            isPurchaseOrder
              ? "ตรวจ Preview ก่อนบันทึก PO"
              : kind === "smokingInvoice"
                ? "Owner ตรวจยอดเรียกเก็บหลัง Submit และชำระตามยอดนี้"
                : "ไฟล์แนบจะถูกอัปโหลดไปเก็บบนระบบ (สำรองไว้ในเบราว์เซอร์นี้ด้วย)"
          }
          onCancel={onClose}
          submitLabel={submitLabels[kind] ?? "บันทึกรายการ"}
        />
      </DialogForm>
    </Dialog>
  );
}
