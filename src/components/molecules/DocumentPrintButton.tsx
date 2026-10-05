"use client";

import { FileText } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import {
  PO_PAGE_CSS,
  SHEET_CSS,
} from "@/components/organisms/shared/printDocumentCss";
import { useLogoSrc } from "@/lib/attachment-store";
import { dateLabel } from "@/lib/format";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char,
  );

/** The rows that make a document's head (the company block from Settings), not its table. */
const headKeys = ["ลูกค้า", "ที่อยู่", "Attention", "โทร.", "Tax ID", "โลโก้"];

/** The two titles laid out as a PO paper; any other is a label and value sheet. */
const poTitles = ["Purchase Order", "Smoke Service Purchase Order"];

const status = (draft?: boolean) =>
  `สถานะ: ${draft ? "ฉบับร่าง ยังไม่บันทึก" : "บันทึกในระบบ"}`;

/** The PO paper's markup (`PO_CSS` styles it), shared by the print popup and the on-screen
 *  preview of `PoDocumentDialog`. `draft`: not saved yet, so it says ฉบับร่าง. */
export function poPaperHtml({
  title,
  number,
  rows,
  logo,
  draft,
}: {
  title: string;
  number: string;
  rows: [string, string][];
  logo?: string;
  draft?: boolean;
}) {
  const field = (label: string) =>
    rows.find(([key]) => key === label)?.[1] || "—";
  const f = (label: string) => escape(field(label));
  const isSmoke = title === "Smoke Service Purchase Order";
  const waste = field("Waste");
  return (
    `<article class="po-paper"><div class="po-paper-heading"><div class="po-brand-block">${logo ? `<img class="po-logo" src="${escape(logo)}" alt="โลโก้">` : ""}<div><h3>${isSmoke ? "SMOKING SERVICE PO" : "PURCHASE ORDER"}</h3></div></div><div class="po-number"><span>เลขที่เอกสาร${draft ? " · ฉบับร่าง" : ""}</span><strong>${escape(number)}</strong></div></div>` +
    `<div class="po-party-grid"><section><span>ผู้ซื้อ / Buyer</span><strong>${f("ลูกค้า")}</strong><p>${f("ที่อยู่")}</p><p>Attention: ${f("Attention")}</p><p>โทร. ${f("โทร.")}</p><p>Tax ID: ${f("Tax ID")}</p></section><section><span>${isSmoke ? "ผู้ให้บริการ / Service provider" : "ผู้ขาย / Supplier"}</span><strong>${f("Supplier")}</strong><p>ผู้รับออเดอร์: ${f("ผู้รับออเดอร์")}</p><p>ที่อยู่: ${f("ที่อยู่ผู้ให้บริการ")}</p>${isSmoke ? `<p>บริการรมควันเนื้อตามคำสั่งซื้อ</p><p>อ้างอิง Packing List: ${f("Packing List")}</p>` : ""}</section></div>` +
    `<div class="po-meta-grid"><div><span>วันที่ออก PO</span><strong>${escape(dateLabel(field("วันที่ PO")))}</strong></div><div><span>${isSmoke ? "คาดว่าจะเสร็จ" : "กำหนดชำระ"}</span><strong>${isSmoke ? escape(dateLabel(field("กำหนดเสร็จ"))) : "ตามข้อตกลง"}</strong></div><div><span>${isSmoke ? "เลขที่การส่ง" : "อ้างอิงผู้ขาย"}</span><strong>${f(isSmoke ? "เลขที่การส่ง" : "อ้างอิงผู้ขาย")}</strong></div></div>` +
    `<table class="po-item-table"><thead><tr><th>รายการ</th><th>รายละเอียด</th><th>จำนวน</th><th>ราคา / กก.</th><th>รวม</th></tr></thead><tbody><tr><td>${f("สินค้า")}</td><td>${f("ขนาดบรรจุ")}</td><td>${f("จำนวน")}</td><td>${f("ราคา / กก.")}</td><td>${f("ยอดรวมก่อน VAT")}</td></tr>` +
    // A PO เนื้อ's waste is on the paper so the seller sends it; it is never charged.
    (waste !== "—"
      ? `<tr><td>Waste</td><td>ไม่คิดเงิน</td><td>${escape(waste.replace(" (ไม่คิดเงิน)", ""))}</td><td>—</td><td>—</td></tr>`
      : "") +
    `</tbody></table><div class="po-total"><span>ยอดรวมประมาณการ</span><strong>${f("ยอดรวมก่อน VAT")}</strong></div>` +
    `<div class="po-note"><strong>หมายเหตุ</strong><p>${f("หมายเหตุ")}</p></div><div class="po-paper-footer"><span>ผู้จัดทำ: ${f("Attention")}</span><span>${status(draft)}</span></div></article>`
  );
}

/** Opens one document in a new window, ready to print or save as PDF. `rows` come from
 *  `documentRows.ts`. A `title` of "Purchase Order" or "Smoke Service Purchase Order" is laid
 *  out as a PO paper; any other title is a sheet of label and value rows under that title.
 *  `draft`: rows of values not saved yet (a preview number); the paper says ฉบับร่าง. */
export function DocumentPrintButton({
  title,
  number,
  rows,
  label,
  draft,
  size = "sm",
}: {
  title: string;
  number: string;
  rows: [string, string][];
  label: string;
  draft?: boolean;
  size?: "sm" | "md";
}) {
  // Loaded on mount, so it is ready by the click: the popup must open inside the click.
  const logo = useLogoSrc(rows.find(([key]) => key === "โลโก้")?.[1]);
  const open = () => {
    const f = (label: string) =>
      escape(rows.find(([key]) => key === label)?.[1] || "—");
    const isPurchaseOrder = poTitles.includes(title);
    const sheetHtml =
      `<main class="sheet"><header class="head"><div>${logo ? `<img class="logo" src="${escape(logo)}" alt="โลโก้">` : ""}<h1>${escape(title.toUpperCase())}</h1><p class="company"><strong>${f("ลูกค้า")}</strong>${f("ที่อยู่")}<br>โทร. ${f("โทร.")} · Tax ID: ${f("Tax ID")}</p></div><div class="number"><span>เลขที่เอกสาร</span><strong>${escape(number)}</strong></div></header>` +
      `<table class="details"><tbody>${rows
        .filter(([label]) => !headKeys.includes(label))
        .map(
          ([label, value]) =>
            `<tr><th>${escape(label)}</th><td>${escape(value || "—")}</td></tr>`,
        )
        .join(
          "",
        )}</tbody></table><footer class="footer"><span>เอกสารจาก NerdNuea Stock</span><span>${status(draft)}</span></footer></main>`;
    const popup = window.open("", "_blank", "width=880,height=720");
    if (!popup) {
      window.alert(
        `เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up สำหรับ ${window.location.host} แล้วลองอีกครั้ง`,
      );
      return;
    }
    popup.document.open();
    popup.document.write(
      `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escape(number)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai+Looped:wght@400;600;700&display=swap"><style>${isPurchaseOrder ? PO_PAGE_CSS : SHEET_CSS}</style></head><body>${isPurchaseOrder ? poPaperHtml({ title, number, rows, logo, draft }) : sheetHtml}<button type="button" class="print-button">ดาวน์โหลด / พิมพ์ PDF</button></body></html>`,
    );
    popup.document.close();
    popup.document
      .querySelector(".print-button")
      ?.addEventListener("click", () => popup.print());
    popup.focus();
  };
  return (
    <Button
      size={size}
      className="max-md:min-h-11"
      icon={<FileText aria-hidden />}
      onClick={open}
    >
      {label}
    </Button>
  );
}
