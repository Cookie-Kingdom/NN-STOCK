"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Input } from "@/components/atoms/Input";
import { Caption } from "@/components/atoms/Text";
import { DayCard } from "@/components/molecules/DayCard";
import { FormError } from "@/components/molecules/FormError";
import { timeOf } from "@/components/organisms/shared/noteText";
import { td, th } from "@/components/organisms/shared/tableCell";
import { useSaveMutation } from "@/components/organisms/shared/useSaveMutation";
import type { Workspace } from "@/components/organisms/workspace/useWorkspace";
import { qty, thaiDay } from "@/lib/format";
import { latestDatabase } from "@/lib/persistence";
import {
  branchChili,
  branchMaterial,
  branchMeat,
  materialList,
  mutate,
  titles,
  type Values,
} from "@/lib/store";
import { cn } from "@/lib/utils";

const tones = {
  warning: "bg-warning-subtle font-medium text-warning",
  success: "bg-success-subtle font-medium text-success",
  danger: "bg-danger-subtle font-medium text-danger",
};

/** A table cell. `tone` fills it (yellow not counted, green counted, red below zero) and is
 *  also `data-tone`, for the tests; `right` is a figure. */
export function Cell({
  tone,
  right,
  className,
  ...props
}: ComponentProps<"td"> & { tone?: keyof typeof tones; right?: boolean }) {
  return (
    <td
      data-tone={tone}
      className={cn(
        td,
        right && "text-right font-medium whitespace-nowrap",
        tone && tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** `columns` named in `right` hold figures. */
export function StockTable({
  columns,
  right = [],
  children,
}: {
  columns: string[];
  right?: string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse tabular-nums">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column}
                className={cn(th, right.includes(column) && "text-right")}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** What is left: red below zero. */
export const Left = ({ n }: { n: number }) => (
  <Cell right tone={n < 0 ? "danger" : undefined}>
    {qty(n)}
  </Cell>
);

/** One branch's materials and chili: what is left, when each was last counted (yellow when
 *  never, or more than 7 days ago), and an input per material. 「บันทึกยอดนับ」 saves one
 *  `materials` note dated today that holds only the rows typed (V2-BR-03). The Owner and the
 *  Account Manager count for the branch the card names. */
export function MaterialCount({
  ws,
  branch,
  title = "วัสดุ",
  note,
}: {
  ws: Workspace;
  branch: string;
  title?: string;
  /** The quiet line beside the title. */
  note?: string;
}) {
  const { db, account, today } = ws;
  const [counts, setCounts] = useState<Values>({});
  const { error, setError, run, saving } = useSaveMutation("บันทึกไม่สำเร็จ");
  const chili = branchChili(db, branch);
  const save = async () => {
    setError("");
    const typed = Object.fromEntries(
      Object.entries(counts).filter(([, value]) => value.trim()),
    );
    const next = await run(() =>
      // A branch account's branch is its own; `branch` is read for the Owner and Manager.
      mutate(
        latestDatabase(),
        account,
        "materials",
        { ...typed, branch },
        "",
        today,
      ),
    );
    if (!next) return;
    setCounts({});
    ws.setToast(
      `จดแล้ว: ${titles.materials}${account.role === "branch" ? "" : ` สาขา${branch}`} · ${Object.keys(typed).length} รายการ`,
    );
  };
  return (
    <DayCard
      aria-label={title}
      title={title}
      aside={note && <Caption>{note}</Caption>}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <StockTable
          columns={["รายการ", "คงเหลือ", "นับล่าสุด", "นับได้"]}
          right={["คงเหลือ", "นับได้"]}
        >
          {materialList(db.config).map((m) => {
            const s = branchMaterial(db, branch, m.id, today);
            const key = `count.${m.id}`;
            return (
              <tr key={m.id}>
                <Cell className="md:whitespace-nowrap">{m.name}</Cell>
                <Left n={s.qty} />
                <Cell tone={s.stale ? "warning" : "success"}>
                  <span className="whitespace-nowrap">
                    {!s.countedOn
                      ? "ยังไม่เคยนับ"
                      : s.countedOn === today
                        ? "วันนี้"
                        : thaiDay(s.countedOn)}
                  </span>
                  {/* The space sits outside the span: the cell may break there, not the name. */}
                  {s.countedOn && s.stale && (
                    <>
                      {" "}
                      <span className="whitespace-nowrap">· เกิน 7 วัน</span>
                    </>
                  )}
                </Cell>
                <Cell right className="py-1.5">
                  {/* Text, not number: `mutate` words the refusal of a bad figure. */}
                  <Input
                    inputMode="decimal"
                    aria-label={`นับ ${m.name}`}
                    className="mt-0 ml-auto min-h-10 w-24 text-right max-md:w-20"
                    value={counts[key] ?? ""}
                    onChange={(event) => {
                      setError("");
                      setCounts({ ...counts, [key]: event.target.value });
                    }}
                  />
                </Cell>
              </tr>
            );
          })}
          <tr>
            <Cell className="md:whitespace-nowrap">น้ำพริก (หลอด)</Cell>
            <Left n={chili.qty} />
            <Cell className="whitespace-nowrap">
              {!chili.countedOn
                ? "ยังไม่เคยนับ"
                : chili.countedOn === today
                  ? "วันนี้"
                  : thaiDay(chili.countedOn)}
            </Cell>
            <Cell right className="font-normal text-text-secondary">
              นับในฟอร์มยอดขาย
            </Cell>
          </tr>
        </StockTable>
        <FormError error={error} className="mx-5 mt-3 mb-0 max-md:mx-4" />
        <div className="flex justify-center px-5 pt-3 pb-4">
          <Button type="submit" variant="primary" disabled={saving}>
            บันทึกยอดนับ
          </Button>
        </div>
      </form>
    </DayCard>
  );
}

/** A branch's own stock: its meat (yellow until it is counted today, V2-BR-02), then its
 *  materials and chili with the count inputs. */
export function BranchStock({ ws }: { ws: Workspace }) {
  const branch = ws.account.branch ?? "";
  const meat = branchMeat(ws.db, branch, ws.today);
  const done = meat.countedToday;
  return (
    <div className="flex flex-col gap-4">
      <section
        aria-label="เนื้อคงเหลือ"
        data-tone={done ? "success" : "warning"}
        className={cn(
          "flex flex-col gap-3 rounded-lg border p-5 max-md:p-4",
          done
            ? "border-success/30 bg-success-subtle"
            : "border-warning/40 bg-warning-subtle",
        )}
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2
            className={cn(
              "m-0 text-h2",
              meat.kg < 0
                ? "text-danger"
                : done
                  ? "text-success"
                  : "text-warning",
            )}
          >
            เนื้อคงเหลือ {qty(meat.kg)} กก.
          </h2>
          <Badge
            tone={done ? "success" : "warning"}
            className={cn(
              "border",
              done ? "border-success/30" : "border-warning/40",
            )}
          >
            {done ? "นับแล้ววันนี้" : "วันนี้ยังไม่ได้นับ"}
          </Badge>
        </div>
        <Caption>
          นับล่าสุด{" "}
          {meat.counted
            ? `${thaiDay(meat.counted.date)} ${timeOf(meat.counted.at)} ได้ ${qty(Number(meat.counted.values.kg))} กก.`
            : "ยังไม่เคยนับ"}{" "}
          · หลังจากนั้นเว็บบวกเนื้อที่รับเข้า และหักเนื้อที่ใช้กับที่เสีย
        </Caption>
        <Button
          className="self-start"
          onClick={() => ws.jot({ kind: "meatCount" })}
        >
          นับเนื้อคงเหลือ
        </Button>
      </section>
      <MaterialCount
        ws={ws}
        branch={branch}
        note="ใส่เฉพาะรายการที่นับ ยอดที่นับล่าสุดคือยอดจริง · ไม่ได้นับเกิน 7 วันขึ้นสีเหลือง"
      />
    </div>
  );
}
