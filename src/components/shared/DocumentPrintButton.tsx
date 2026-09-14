"use client";

// ponytail: copy of the .po-* rules in src/app/workspace.css, because the print popup can't load the app stylesheet. Change both together.
const poCss = `.po-paper{max-width:540px;min-height:700px;margin:0 auto;padding:36px;background:#fff;color:#0f172a;box-shadow:0 10px 30px rgba(15,23,42,.14)}.po-paper-heading{display:flex;justify-content:space-between;gap:18px;padding-bottom:22px;border-bottom:2px solid #2563eb}.po-brand-block{display:flex;align-items:flex-start;gap:12px;min-width:0}.po-logo{display:block;width:48px;height:48px;flex:0 0 48px;border-radius:10px;object-fit:contain;border:1px solid #e2e8f0;background:#fff}.po-paper h3{margin:5px 0 0;color:#2563eb;font-size:25px;letter-spacing:.02em}.po-number{min-width:145px;text-align:right}.po-number span,.po-party-grid section>span,.po-meta-grid span,.po-note>strong{display:block;font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.04em}.po-number strong{display:block;margin-top:6px;color:#0f172a;font-size:12px}.po-party-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;padding:24px 0}.po-party-grid section{min-width:0}.po-party-grid strong{display:block;margin:7px 0;font-size:14px}.po-party-grid p{margin:3px 0;color:#64748b;font-size:11px;line-height:1.55;overflow-wrap:anywhere}.po-meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:14px 0;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0}.po-meta-grid strong{display:block;margin-top:5px;font-size:11px;line-height:1.4}.po-item-table{width:100%;margin-top:22px;border-collapse:collapse;font-size:11px}.po-item-table th{padding:10px 8px;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:10px;font-weight:600;text-align:left;white-space:nowrap}.po-item-table td{padding:12px 8px;border-bottom:1px solid #e2e8f0;line-height:1.45;vertical-align:top}.po-item-table th:nth-child(n+3),.po-item-table td:nth-child(n+3){text-align:right;white-space:nowrap}.po-rate-note{margin-top:14px;padding:10px 12px;background:#f8fafc;border-left:3px solid #64748b;color:#64748b;font-size:10px;line-height:1.55}.po-total{display:flex;justify-content:flex-end;align-items:baseline;gap:26px;margin-top:20px;color:#0f172a}.po-total span{font-size:12px;font-weight:600}.po-total strong{font-size:19px}.po-note{margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0}.po-note p{min-height:22px;margin:7px 0 0;color:#64748b;font-size:11px;line-height:1.55;white-space:pre-line}.po-paper-footer{display:flex;justify-content:space-between;gap:14px;margin-top:46px;padding-top:12px;border-top:1px solid #e2e8f0;color:#64748b;font-size:10px}`;
// The on-screen paper is 540px wide; zoom 1.46 scales it to the A4 width (210mm ≈ 794px) when printing.
const poPageCss = `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;padding:22px;background:#f8fafc;font-family:'Noto Sans Thai',Arial,sans-serif}@media print{body{padding:0;background:#fff}.po-paper{zoom:1.46;min-height:0;box-shadow:none}}${poCss}`;
const sheetCss = `@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e9eee7;font-family:'Noto Sans Thai',Arial,sans-serif;color:#18342e}.sheet{width:210mm;min-height:297mm;margin:0 auto;padding:23mm 20mm;background:#fff}.head{display:flex;justify-content:space-between;gap:20px;padding-bottom:18mm;border-bottom:2px solid #315f4d}.head h1{margin:0;color:#165846;font-size:30px;letter-spacing:.04em}.number{text-align:right}.number span{display:block;color:#617b70;font-size:11px;letter-spacing:.04em}.number strong{display:block;margin-top:8px;color:#174d3f;font-size:15px}.details{width:100%;margin-top:18mm;border-collapse:collapse;font-size:12px}.details th,.details td{padding:12px;border:1px solid #d6e0da;text-align:left}.details th{width:38%;background:#f1f5ef;color:#365d4b}.footer{display:flex;justify-content:space-between;gap:16px;margin-top:32mm;padding-top:12px;border-top:1px solid #d7e0da;color:#718078;font-size:11px}@media print{body{background:#fff}.sheet{margin:0;width:auto;min-height:auto}}`;

export function DocumentPrintButton({ title, number, rows, label = "พิมพ์ / PDF", preview = false }: { title: string; number: string; rows: [string, string][]; label?: string; preview?: boolean }) {
  const print = () => {
    const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char);
    const field = (label: string) => rows.find(([key]) => key === label)?.[1] || "—";
    const f = (label: string) => escape(field(label));
    const dateLabel = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)) : value;
    const isSmoke = title === "Smoke Service Purchase Order";
    const isPurchaseOrder = title === "Purchase Order" || isSmoke;
    const logo = field("โลโก้");
    // Mirrors PurchaseOrderDocumentPreview markup; the logo placeholder is left out so the printed page has no empty box.
    const poHtml = `<article class="po-paper"><div class="po-paper-heading"><div class="po-brand-block">${logo.startsWith("data:image/") ? `<img class="po-logo" src="${escape(logo)}" alt="โลโก้ NerdNuea">` : ""}<div><h3>${isSmoke ? "SMOKING SERVICE PO" : "PURCHASE ORDER"}</h3></div></div><div class="po-number"><span>เลขที่เอกสาร</span><strong>${escape(number)}</strong></div></div>`
      + `<div class="po-party-grid"><section><span>ผู้ซื้อ / Buyer</span><strong>${f("ลูกค้า")}</strong><p>${f("ที่อยู่")}</p><p>Attention: ${f("Attention")}</p><p>โทร. ${f("โทร.")}</p><p>Tax ID: ${f("Tax ID")}</p></section><section><span>${isSmoke ? "ผู้ให้บริการ / Service provider" : "ผู้ขาย / Supplier"}</span><strong>${f("Supplier")}</strong><p>ผู้รับออเดอร์: ${f("ผู้รับออเดอร์")}</p><p>ที่อยู่: ${f("ที่อยู่ผู้ให้บริการ")}</p>${isSmoke ? `<p>บริการรมควันเนื้อตามคำสั่งซื้อ</p><p>อ้างอิง Invoice Foodiva: ${f("Foodiva Invoice")}</p>` : ""}</section></div>`
      + `<div class="po-meta-grid"><div><span>วันที่ออก PO</span><strong>${escape(dateLabel(field("วันที่ PO")))}</strong></div><div><span>${isSmoke ? "คาดว่าจะเสร็จ" : "กำหนดชำระ"}</span><strong>${isSmoke ? escape(dateLabel(field("กำหนดเสร็จ"))) : "ตามข้อตกลง"}</strong></div><div><span>${isSmoke ? "Lot เนื้อ" : "อ้างอิงผู้ขาย"}</span><strong>${f(isSmoke ? "Lot เนื้อ" : "อ้างอิงผู้ขาย")}</strong></div></div>`
      + `<table class="po-item-table"><thead><tr><th>รายการ</th><th>รายละเอียด</th><th>จำนวน</th><th>ราคา / กก.</th><th>รวม</th></tr></thead><tbody><tr><td>${f("สินค้า")}</td><td>${f("ขนาดบรรจุ")}</td><td>${f("จำนวน")}</td><td>${f("ราคา / กก.")}</td><td>${f("ยอดรวมก่อน VAT")}</td></tr></tbody></table>`
      + (isSmoke ? `<div class="po-rate-note">อัตราอัตโนมัติ: ต่ำกว่า 1,000 กก. ฿220 · 1,000 กก. ฿200 · 1,500 กก. ฿180 ต่อกก.</div>` : "")
      + `<div class="po-total"><span>ยอดรวมประมาณการ</span><strong>${f("ยอดรวมก่อน VAT")}</strong></div><div class="po-note"><strong>หมายเหตุ</strong><p>${f("หมายเหตุ")}</p></div><div class="po-paper-footer"><span>ผู้จัดทำ: ${f("Attention")}</span><span>สถานะ: บันทึกในระบบ</span></div></article>`;
    const sheetHtml = `<main class="sheet"><header class="head"><div><h1>${escape(title.toUpperCase())}</h1></div><div class="number"><span>เลขที่เอกสาร</span><strong>${escape(number)}</strong></div></header><table class="details"><tbody>${rows.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value || "—")}</td></tr>`).join("")}</tbody></table><footer class="footer"><span>เอกสารจาก NerdNuea Stock</span><span>สถานะ: บันทึกในระบบ</span></footer></main>`;
    const popup = window.open("", "_blank", "width=880,height=720");
    if (!popup) {
      window.alert("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up สำหรับ localhost:3000 แล้วลองอีกครั้ง");
      return;
    }
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escape(number)}</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Thai:wght@400;600;700&display=swap"><style>${isPurchaseOrder ? poPageCss : sheetCss}</style></head><body>${isPurchaseOrder ? poHtml : sheetHtml}</body></html>`);
    // Wait for the Thai web font, otherwise the first print falls back to Arial.
    if (!preview) popup.addEventListener("load", () => popup.document.fonts.ready.then(() => popup.print()), { once: true });
    popup.document.close();
    if (preview) {
      const download = popup.document.createElement("button");
      download.type = "button";
      download.textContent = "ดาวน์โหลด / พิมพ์ PDF";
      Object.assign(download.style, { position: "fixed", top: "14px", right: "14px", zIndex: "10", padding: "10px 14px", border: "0", borderRadius: "8px", background: "#165846", color: "#fff", fontWeight: "700", cursor: "pointer" });
      download.addEventListener("click", () => popup.print());
      popup.document.body.append(download);
    }
    popup.focus();
  };
  return <button className="table-action" type="button" onClick={print}>{label}</button>;
}
