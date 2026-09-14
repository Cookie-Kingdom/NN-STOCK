"use client";


export function DocumentPrintButton({ title, number, rows, label = "พิมพ์ / PDF", preview = false }: { title: string; number: string; rows: [string, string][]; label?: string; preview?: boolean }) {
  const print = () => {
    const escape = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] || char);
    const field = (label: string) => rows.find(([key]) => key === label)?.[1] || "—";
    const isSmokePurchaseOrder = title === "Smoke Service Purchase Order";
    const isPurchaseOrder = title === "Purchase Order" || isSmokePurchaseOrder;
    const supplierHeading = isSmokePurchaseOrder ? "ผู้ให้บริการ / SERVICE PROVIDER" : "ผู้ขาย / SUPPLIER";
    const dueLabel = isSmokePurchaseOrder ? "กำหนดเสร็จ" : "กำหนดชำระ";
    const dueValue = isSmokePurchaseOrder ? field("กำหนดเสร็จ") : "ตามข้อตกลง";
    const referenceLabel = isSmokePurchaseOrder ? "Lot เนื้อ" : "อ้างอิงผู้ขาย";
    const referenceValue = isSmokePurchaseOrder ? field("Lot เนื้อ") : field("อ้างอิงผู้ขาย");
    const supplierExtra = isSmokePurchaseOrder
      ? `<p>ผู้รับออเดอร์: ${escape(field("ผู้รับออเดอร์"))}</p><p>ที่อยู่: ${escape(field("ที่อยู่ผู้ให้บริการ"))}</p><p>อ้างอิง Invoice Food Diva: ${escape(field("Food Diva Invoice"))}</p>`
      : "";
    const documentContent = isPurchaseOrder
      ? `<section class="party-grid"><div><span>ผู้ซื้อ / BUYER</span><strong>${escape(field("ลูกค้า"))}</strong><p>Reg. Address: ${escape(field("ที่อยู่"))}</p><p>Attention: ${escape(field("Attention"))}</p><p>โทร. ${escape(field("โทร."))}</p><p>Tax ID: ${escape(field("Tax ID"))}</p></div><div><span>${supplierHeading}</span><strong>${escape(field("Supplier"))}</strong>${supplierExtra}</div></section><section class="meta-grid"><div><span>วันที่ออก PO</span><strong>${escape(field("วันที่ PO"))}</strong></div><div><span>${dueLabel}</span><strong>${escape(dueValue)}</strong></div><div><span>${referenceLabel}</span><strong>${escape(referenceValue)}</strong></div></section><table class="items"><thead><tr><th>รายการ</th><th>รายละเอียด</th><th>จำนวน</th><th>ราคา / กก.</th><th>รวม</th></tr></thead><tbody><tr><td>${escape(field("สินค้า"))}</td><td>${escape(field("ขนาดบรรจุ"))}</td><td>${escape(field("จำนวน"))}</td><td>${escape(field("ราคา / กก."))}</td><td>${escape(field("ยอดรวมก่อน VAT"))}</td></tr></tbody></table><div class="total"><span>ยอดรวมประมาณการ</span><strong>${escape(field("ยอดรวมก่อน VAT"))}</strong></div><section class="note"><span>หมายเหตุ</span><p>${escape(field("หมายเหตุ"))}</p></section>`
      : `<table class="details"><tbody>${rows.map(([label, value]) => `<tr><th>${escape(label)}</th><td>${escape(value || "—")}</td></tr>`).join("")}</tbody></table>`;
    const popup = window.open("", "_blank", "width=880,height=720");
    if (!popup) {
      window.alert("เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up สำหรับ localhost:3000 แล้วลองอีกครั้ง");
      return;
    }
    popup.document.open();
    popup.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${escape(number)}</title><style>@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;background:#e9eee7;font-family:Arial,'Noto Sans Thai',sans-serif;color:#18342e}.sheet{width:210mm;min-height:297mm;margin:0 auto;padding:23mm 20mm;background:#fff}.head{display:flex;justify-content:space-between;gap:20px;padding-bottom:18mm;border-bottom:2px solid #315f4d}.head h1{margin:0;color:#165846;font-size:30px;letter-spacing:.04em}.number{text-align:right}.number span,.party-grid span,.meta-grid span,.note span{display:block;color:#617b70;font-size:11px;letter-spacing:.04em}.number strong{display:block;margin-top:8px;color:#174d3f;font-size:15px}.party-grid{display:grid;grid-template-columns:1fr 1fr;gap:30px;padding:16mm 0}.party-grid strong{display:block;margin:8px 0 15px;font-size:17px}.party-grid p{margin:5px 0;color:#546b61;font-size:12px;line-height:1.55}.meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;padding:12px 0;border-top:1px solid #d7e0da;border-bottom:1px solid #d7e0da}.meta-grid strong{display:block;margin-top:7px;font-size:12px}.items,.details{width:100%;margin-top:18mm;border-collapse:collapse;font-size:12px}.items th{padding:10px 8px;border-bottom:1px solid #b7c8bd;color:#587066;font-size:11px;text-align:left}.items td{padding:13px 8px;border-bottom:1px solid #dce5df;vertical-align:top}.items th:nth-child(n+3),.items td:nth-child(n+3){text-align:right;white-space:nowrap}.total{display:flex;justify-content:flex-end;align-items:baseline;gap:30px;margin-top:18px;color:#184f40}.total span{font-weight:700}.total strong{font-size:23px}.note{min-height:80px;margin-top:18mm;padding-top:13px;border-top:1px solid #d7e0da}.note p{margin:8px 0;color:#536a60;font-size:12px;line-height:1.6}.details th,.details td{padding:12px;border:1px solid #d6e0da;text-align:left}.details th{width:38%;background:#f1f5ef;color:#365d4b}.footer{display:flex;justify-content:space-between;gap:16px;margin-top:32mm;padding-top:12px;border-top:1px solid #d7e0da;color:#718078;font-size:11px}@media print{body{background:#fff}.sheet{margin:0;width:auto;min-height:auto}}</style></head><body><main class="sheet"><header class="head"><div><h1>${escape(title.toUpperCase())}</h1></div><div class="number"><span>เลขที่เอกสาร</span><strong>${escape(number)}</strong></div></header>${documentContent}<footer class="footer"><span>เอกสารจาก NerdNuea Stock</span><span>สถานะ: บันทึกในระบบ</span></footer></main></body></html>`);
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
    if (!preview) popup.setTimeout(() => popup.print(), 150);
  };
  return <button className="table-action" type="button" onClick={print}>{label}</button>;
}
