"use client";

import { Button } from "@/components/atoms/Button";
import { dateLabel } from "@/components/organisms/shared/documentRows";
import {
  PO_PAGE_CSS,
  POPUP_DOWNLOAD_BUTTON_STYLE,
  SHEET_CSS,
} from "@/components/organisms/shared/printDocumentCss";

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ] || char,
  );

export function DocumentPrintButton({
  title,
  number,
  rows,
  label = "พิมพ์ / PDF",
  preview = false,
}: {
  title: string;
  number: string;
  rows: [string, string][];
  label?: string;
  preview?: boolean;
}) {
  const print = () => {
    const field = (label: string) =>
      rows.find(([key]) => key === label)?.[1] || "—";
    const f = (label: string) => escape(field(label));
    const isSmoke = title === "Smoke Service Purchase Order";
    const isPurchaseOrder = title === "Purchase Order" || isSmoke;
    const logo = field("โลโก้");
    // Mirrors PurchaseOrderDocumentPreview markup; the logo placeholder is left out so the printed page has no empty box.
    const poHtml =
      `<article class="po-paper"><div class="po-paper-heading"><div class="po-brand-block">${logo.startsWith("data:image/") ? `<img class="po-logo" src="${escape(logo)}" alt="โลโก้ NerdNuea">` : ""}<div><h3>${isSmoke ? "SMOKING SERVICE PO" : "PURCHASE ORDER"}</h3></div></div><div class="po-number"><span>เลขที่เอกสาร</span><strong>${escape(number)}</strong></div></div>` +
      `<div class="po-party-grid"><section><span>ผู้ซื้อ / Buyer</span><strong>${f("ลูกค้า")}</strong><p>${f("ที่อยู่")}</p><p>Attention: ${f("Attention")}</p><p>โทร. ${f("โทร.")}</p><p>Tax ID: ${f("Tax ID")}</p></section><section><span>${isSmoke ? "ผู้ให้บริการ / Service provider" : "ผู้ขาย / Supplier"}</span><strong>${f("Supplier")}</strong><p>ผู้รับออเดอร์: ${f("ผู้รับออเดอร์")}</p><p>ที่อยู่: ${f("ที่อยู่ผู้ให้บริการ")}</p>${isSmoke ? `<p>บริการรมควันเนื้อตามคำสั่งซื้อ</p><p>อ้างอิง Invoice Foodiva: ${f("Foodiva Invoice")}</p>` : ""}</section></div>` +
      `<div class="po-meta-grid"><div><span>วันที่ออก PO</span><strong>${escape(dateLabel(field("วันที่ PO")))}</strong></div><div><span>${isSmoke ? "คาดว่าจะเสร็จ" : "กำหนดชำระ"}</span><strong>${isSmoke ? escape(dateLabel(field("กำหนดเสร็จ"))) : "ตามข้อตกลง"}</strong></div><div><span>${isSmoke ? "Lot เนื้อ" : "อ้างอิงผู้ขาย"}</span><strong>${f(isSmoke ? "Lot เนื้อ" : "อ้างอิงผู้ขาย")}</strong></div></div>` +
      `<table class="po-item-table"><thead><tr><th>รายการ</th><th>รายละเอียด</th><th>จำนวน</th><th>ราคา / กก.</th><th>รวม</th></tr></thead><tbody><tr><td>${f("สินค้า")}</td><td>${f("ขนาดบรรจุ")}</td><td>${f("จำนวน")}</td><td>${f("ราคา / กก.")}</td><td>${f("ยอดรวมก่อน VAT")}</td></tr></tbody></table>` +
      (isSmoke
        ? `<div class="po-rate-note">อัตราอัตโนมัติ: ต่ำกว่า 1,000 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก. ฿180 ต่อกก.</div>`
        : "") +
      `<div class="po-total"><span>ยอดรวมประมาณการ</span><strong>${f("ยอดรวมก่อน VAT")}</strong></div><div class="po-note"><strong>หมายเหตุ</strong><p>${f("หมายเหตุ")}</p></div><div class="po-paper-footer"><span>ผู้จัดทำ: ${f("Attention")}</span><span>สถานะ: บันทึกในระบบ</span></div></article>`;
    const sheetHtml = `<main class="sheet"><header class="head"><div><h1>${escape(title.toUpperCase())}</h1></div><div class="number"><span>เลขที่เอกสาร</span><strong>${escape(number)}</strong></div></header><table class="details"><tbody>${rows.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value || "—")}</td></tr>`).join("")}</tbody></table><footer class="footer"><span>เอกสารจาก NerdNuea Stock</span><span>สถานะ: บันทึกในระบบ</span></footer></main>`;
    const popup = window.open("", "_blank", "width=880,height=720");
    if (!popup) {
      window.alert(
        "เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up สำหรับ localhost:3000 แล้วลองอีกครั้ง",
      );
      return;
    }
    popup.document.open();
    popup.document.write(
      `<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escape(number)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap"><style>${isPurchaseOrder ? PO_PAGE_CSS : SHEET_CSS}</style></head><body>${isPurchaseOrder ? poHtml : sheetHtml}</body></html>`,
    );
    // Wait for the Thai web font, otherwise the first print falls back to Arial.
    if (!preview)
      popup.addEventListener(
        "load",
        () => popup.document.fonts.ready.then(() => popup.print()),
        { once: true },
      );
    popup.document.close();
    if (preview) {
      const download = popup.document.createElement("button");
      download.type = "button";
      download.textContent = "ดาวน์โหลด / พิมพ์ PDF";
      Object.assign(download.style, POPUP_DOWNLOAD_BUTTON_STYLE);
      download.addEventListener("click", () => popup.print());
      popup.document.body.append(download);
    }
    popup.focus();
  };
  return (
    <Button variant="table" onClick={print}>
      {label}
    </Button>
  );
}
