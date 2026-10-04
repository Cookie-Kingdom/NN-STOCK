// What the note form (Composer) and the PO document share: fields laid out in named
// sections, the 「เว็บคิดให้」 figures, and the footer that counts what is still not jotted.
import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { Caption } from "@/components/atoms/Text";
import { FormError } from "@/components/molecules/FormError";
import { FormGrid } from "@/components/molecules/FormGrid";
import { thaiDay } from "@/lib/format";
import type { Field } from "@/lib/forms";
import { missingText } from "@/lib/store";
import { cn } from "@/lib/utils";

/** A date as a dialog's subtitle says it, with its year. */
export const fullDay = (date: string) =>
  thaiDay(date, { day: "numeric", month: "short", year: "numeric" });

type Group = "when" | "detail" | "money" | "extra";
/** Which section a field sits in. ponytail: a rule over the field itself; a `group` on
 *  `Field` in forms.ts says it outright once a field lands in the wrong section. */
const groupOf = (f: Field): Group =>
  f.key === "dispatchId"
    ? "when"
    : f.unit === "บาท" || f.key === "status" || f.key === "payer"
      ? "money"
      : f.more || f.type === "file" || f.type === "textarea"
        ? "extra"
        : "detail";

/** One section: a small heading over a stable two-column grid (one column on phones and
 *  when `narrow`). `quiet` is the lighter look of the optional last section. */
function Section({
  title,
  hint,
  quiet,
  narrow,
  children,
}: {
  title: string;
  hint?: string;
  quiet?: boolean;
  narrow?: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <h3
        className={cn(
          "m-0 flex flex-wrap items-baseline gap-x-2 text-h3",
          quiet && "text-text-secondary",
        )}
      >
        {title}
        {hint && <Caption className="font-normal">{hint}</Caption>}
      </h3>
      <FormGrid
        className={cn("my-0 items-start gap-4", narrow && "grid-cols-1")}
      >
        {children}
      </FormGrid>
    </section>
  );
}

/** The fields of a form as sections: `when` (the date, lot and branch controls) first, then
 *  the details, the money, and the optional fields shown open under a quieter heading.
 *  `render` is told which field is the first one to type in. */
export function FieldSections({
  whenTitle = "เมื่อไร",
  when,
  shown,
  narrow,
  render,
}: {
  whenTitle?: string;
  when: ReactNode;
  shown: Field[];
  narrow?: boolean;
  render: (f: Field, first: boolean) => ReactNode;
}) {
  const of = (group: Group) => shown.filter((f) => groupOf(f) === group);
  // The first field under the `when` section, in the order the sections show them.
  const first = [...of("detail"), ...of("money"), ...of("extra")][0];
  const list = (group: Group) => of(group).map((f) => render(f, f === first));
  const extra = of("extra");
  return (
    <>
      <Section title={whenTitle} narrow={narrow}>
        {when}
        {list("when")}
      </Section>
      {of("detail").length > 0 && (
        <Section title="รายละเอียด" narrow={narrow}>
          {list("detail")}
        </Section>
      )}
      {of("money").length > 0 && (
        <Section title="เงิน" narrow={narrow}>
          {list("money")}
        </Section>
      )}
      {extra.length > 0 && (
        <Section
          quiet
          narrow={narrow}
          title={
            extra.some((f) => f.type === "file")
              ? "เอกสารแนบ และหมายเหตุ"
              : "ข้อมูลเพิ่มเติม และหมายเหตุ"
          }
          hint="ไม่บังคับ จดเพิ่มทีหลังได้"
        >
          {list("extra")}
        </Section>
      )}
    </>
  );
}

export type Figure = {
  label: string;
  value: string;
  tone?: "success" | "warning";
  /** Starts a new block: a rule above it. */
  rule?: boolean;
};
export type Figures = { rows: Figure[]; note?: string };

/** 「เว็บคิดให้」: the figures the web works out from what is typed, as label / value rows. */
export function FiguresPanel({
  figures,
  className,
}: {
  figures: Figures;
  className?: string;
}) {
  return (
    <aside aria-label="เว็บคิดให้" className={cn("bg-bg", className)}>
      <h3 className="m-0 text-label text-text-secondary">เว็บคิดให้</h3>
      <dl aria-live="polite" className="m-0 mt-3 flex flex-col gap-2.5">
        {figures.rows.map((row) => (
          <div
            key={row.label}
            className={cn(
              "flex items-baseline justify-between gap-3",
              row.rule && "border-t border-border pt-2.5",
            )}
          >
            <dt className="text-body-sm text-text-secondary">{row.label}</dt>
            <dd
              className={cn(
                "m-0 text-right font-semibold tabular-nums",
                row.tone === "success" && "text-success",
                row.tone === "warning" && "text-warning",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {figures.note && (
        <p className="m-0 mt-3 text-caption text-warning">{figures.note}</p>
      )}
    </aside>
  );
}

/** The footer: what is still not jotted on the left (live), the actions on the right. A save
 *  error sits directly above it, outside the scroll area, so a refused save is always seen. */
export function FormFooter({
  stack,
  missing,
  blocked,
  error,
  children,
}: {
  /** A narrow dialog: the count takes its own line above the actions (always so on phones). */
  stack?: boolean;
  /** Empty core fields; `undefined` when the form has none. */
  missing?: number;
  /** Why 「บันทึก」 is off, said in place of the count. */
  blocked?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <>
      {error && (
        <div className="border-t border-border px-6.5 py-3 max-md:px-4">
          <FormError error={error} className="my-0" />
        </div>
      )}
      <footer className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-2 border-t border-border bg-bg px-6.5 py-4 max-md:px-4 max-md:py-3">
        <p
          aria-live="polite"
          className={cn(
            "m-0 mr-auto text-body-sm empty:hidden max-md:w-full",
            stack && "w-full",
          )}
        >
          {blocked ? (
            <span className="font-medium text-warning">{blocked}</span>
          ) : missing ? (
            <>
              <span className="font-medium text-warning">
                {missingText} {missing} ช่อง
              </span>
              <span className="text-text-secondary">
                {" "}
                · บันทึกได้ เติมทีหลังได้
              </span>
            </>
          ) : missing === 0 ? (
            <span className="inline-flex items-center gap-1.5 font-medium text-success">
              <Check size={16} aria-hidden />
              จดครบแล้ว
            </span>
          ) : null}
        </p>
        {children}
      </footer>
    </>
  );
}

export const SaveButton = ({
  saving,
  disabled,
}: {
  saving: boolean;
  disabled?: boolean;
}) => (
  <Button type="submit" variant="primary" disabled={saving || disabled}>
    {saving && <Spinner />}
    {saving ? "กำลังบันทึก" : "บันทึก"}
  </Button>
);
