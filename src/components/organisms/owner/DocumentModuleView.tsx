"use client";

import { Button } from "@/components/atoms/Button";
import { Muted, Footnote } from "@/components/atoms/Text";
import { ButtonRow } from "@/components/molecules/ButtonRow";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { DataTable } from "@/components/organisms/shared/DataTable";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import {
  averageYield,
  entries,
  n,
  processLoss,
  processed,
  produced,
  rawAtFoodiva,
  rawAtSmoker,
  smokingInvoiceStatus,
  steakRawStock,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";

export function DocumentModuleView({
  db,
  open,
}: {
  db: Database;
  open: (kind: string, lotId?: string) => void;
}) {
  const openPo = db.lots.filter((lot) => lot.stage < 8).length;
  const outstandingSupplier = entries(db, "supplierInvoice").filter(
    (entry) => entry.values.paymentStatus !== "Paid",
  );
  const outstandingSmoking = entries(db, "smokingInvoice").filter(
    (entry) => smokingInvoiceStatus(db, entry) !== "ชำระแล้ว",
  );
  const printDocument = () => window.print();
  const kpis = [
    { label: "Open PO", value: openPo, caption: "Lot ที่ยังดำเนินการ" },
    {
      label: "Supplier Invoice ค้างชำระ",
      value: outstandingSupplier.length,
      caption: "ใบ",
    },
    {
      label: "Smoking Invoice ค้างชำระ",
      value: outstandingSmoking.length,
      caption: "ใบ",
    },
    {
      label: "Average Yield",
      value: `${fmt(averageYield(db))}%`,
      caption: "ทุก Smoke Batch",
    },
  ];
  return (
    <div className="grid gap-6">
      <PanelHeading
        overline="DOCUMENT CONTROL"
        title="เอกสารและการตรวจสอบย้อนกลับ"
        description="เอกสารทุกฉบับอ้างอิง PO และ Beef Lot เดียวกับสต๊อก ไม่มีการลบรายการที่ยืนยันแล้ว ให้ใช้ยกเลิกเพื่อรักษาประวัติ"
        aside={
          <Button variant="secondary" onClick={printDocument}>
            พิมพ์ / บันทึก PDF
          </Button>
        }
      />
      <section className="grid grid-cols-4 overflow-hidden rounded-lg border border-border bg-surface max-[1050px]:grid-cols-2 max-[640px]:grid-cols-1">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="grid gap-2 px-6 py-5.5">
            <small className="text-body-sm text-text-secondary">
              {kpi.label}
            </small>
            <strong className="text-num-lg text-text-primary tabular-nums">
              {kpi.value}
            </strong>
            <small className="text-body-sm text-text-secondary">
              {kpi.caption}
            </small>
          </article>
        ))}
      </section>
      <DataTable
        title="Beef Lot traceability และสถานะสต๊อก"
        columns={[
          "PO / Beef Lot",
          "ซื้อจาก",
          "Foodiva",
          "ที่โรงรม",
          "Steak",
          "หลังรม",
          "Loss / Yield",
          "เอกสารต่อไป",
        ]}
        rows={db.lots.map((lot) => {
          const smokeInput = processed(db, lot.id);
          const yieldPct =
            smokeInput > 0 ? (produced(db, lot.id) / smokeInput) * 100 : 0;
          const hasSmokeOrder = entries(db, "smokeOrder", lot.id).length;
          return [
            <span key="lot">
              <strong>{lot.poId}</strong>
              <br />
              {lot.id}
            </span>,
            `${lot.values.supplier || "Foodiva"} · ${fmt(n(lot.values, "orderedKg"))} กก.`,
            `${fmt(rawAtFoodiva(db, lot))} กก.`,
            `${fmt(rawAtSmoker(db, lot))} กก.`,
            `${fmt(steakRawStock(db, lot.id))} กก.`,
            `${fmt(produced(db, lot.id))} กก.`,
            smokeInput
              ? `${fmt(processLoss(db, lot.id))} กก. / ${fmt(yieldPct)}%`
              : "รอผลิต",
            <ButtonRow key="action">
              <Button
                variant="table"
                onClick={() => open("taxDocument", lot.id)}
              >
                ภาษี
              </Button>
              {entries(db, "foodivaConfirm", lot.id).length > 0 &&
                !hasSmokeOrder && (
                  <Muted as="span">ออก PO จากเมนูใบสั่ง PO โรงรมควัน</Muted>
                )}
              {rawAtFoodiva(db, lot) > 0.001 && (
                <Button
                  variant="table"
                  onClick={() => open("steakTransfer", lot.id)}
                >
                  โอนไป Steak
                </Button>
              )}
              {entries(db, "smokeOrder", lot.id).length > 0 && (
                <Muted as="span">Chef_house ออกใบวางบิลจากเมนูงานผลิต</Muted>
              )}
            </ButtonRow>,
          ];
        })}
      />
      <DataTable
        title="Stock Transfer Document"
        columns={[
          "เลขโอน",
          "วันที่",
          "PO / Lot",
          "ต้นทาง → ปลายทาง",
          "ส่งออก",
          "รับจริง",
          "สถานะ",
          "เอกสาร",
        ]}
        rows={[
          ...entries(db, "dispatch").map((entry) => {
            const lot = db.lots.find((item) => item.id === entry.lotId);
            const number = entry.values.transferNumber || entry.id.slice(0, 8);
            return [
              number,
              entry.date,
              `${lot?.poId || "-"} / ${entry.lotId}`,
              `${entry.values.origin} → ${entry.values.destination}`,
              `${fmt(n(entry.values, "dispatchKg"))} กก.`,
              `${fmt(n(lot?.values || {}, "receivedKg"))} กก.`,
              lot?.stage && lot.stage >= 2
                ? "Received by Chef_house"
                : "In Transit",
              <DocumentPrintButton
                key={entry.id}
                title="Stock Transfer Document"
                number={number}
                rows={[
                  ["วันที่", entry.date],
                  ["PO", lot?.poId || "-"],
                  ["Beef Lot", entry.lotId],
                  ["ต้นทาง", entry.values.origin],
                  ["ปลายทาง", entry.values.destination],
                  ["น้ำหนักส่ง", `${fmt(n(entry.values, "dispatchKg"))} กก.`],
                  ["ทะเบียนรถ", entry.values.plate || "-"],
                  ["คนขับ", entry.values.driverName || "-"],
                ]}
              />,
            ];
          }),
          ...entries(db, "steakTransfer").map((entry) => {
            const lot = db.lots.find((item) => item.id === entry.lotId);
            return [
              entry.values.transferNumber,
              entry.values.transferDate,
              `${lot?.poId || "-"} / ${entry.lotId}`,
              "Foodiva / Raw Meat Storage → Steak Production",
              `${fmt(n(entry.values, "quantityKg"))} กก.`,
              `${fmt(n(entry.values, "quantityKg"))} กก.`,
              "Received",
              <DocumentPrintButton
                key={entry.id}
                title="Internal Stock Transfer to Steak"
                number={entry.values.transferNumber}
                rows={[
                  ["วันที่", entry.values.transferDate],
                  ["PO", lot?.poId || "-"],
                  ["Beef Lot", entry.lotId],
                  ["ต้นทาง", entry.values.sourceLocation],
                  ["ปลายทาง", entry.values.destinationLocation],
                  ["จำนวน", `${fmt(n(entry.values, "quantityKg"))} กก.`],
                  ["เหตุผล", entry.values.reason],
                ]}
              />,
            ];
          }),
        ]}
      />
      <DataTable
        title="Supplier Invoice และ Tax documents"
        columns={[
          "ประเภท",
          "เลขที่",
          "วันที่",
          "PO / Lot",
          "ยอดรวม",
          "VAT",
          "สถานะ",
          "เอกสาร",
        ]}
        rows={[
          ...entries(db, "foodivaConfirm").map((entry) => {
            const lot = db.lots.find((item) => item.id === entry.lotId);
            return [
              "Foodiva Meat Invoice",
              entry.values.invoiceNo,
              entry.values.invoiceDate,
              `${lot?.poId || "-"} / ${entry.lotId}`,
              `฿${fmt(n(entry.values, "invoiceAmount"))}`,
              "—",
              "Foodiva ยืนยันแล้ว",
              <DocumentPrintButton
                key={entry.id}
                title="Foodiva Meat Invoice"
                number={entry.values.invoiceNo}
                rows={[
                  ["วันที่ Invoice", entry.values.invoiceDate],
                  ["Foodiva", entry.values.confirmedBy],
                  ["PO", lot?.poId || "-"],
                  ["Beef Lot", entry.lotId],
                  ["จำนวน", `${fmt(n(entry.values, "confirmedKg"))} กก.`],
                  ["ยอดรวม", `฿${fmt(n(entry.values, "invoiceAmount"))}`],
                  ["ไฟล์แนบ", entry.values.attachment],
                ]}
              />,
            ];
          }),
          ...entries(db, "supplierInvoice").map((entry) => {
            const lot = db.lots.find((item) => item.id === entry.lotId);
            return [
              "Supplier Invoice",
              entry.values.invoiceNumber,
              entry.values.invoiceDate,
              `${lot?.poId || "-"} / ${entry.lotId}`,
              `฿${fmt(n(entry.values, "totalAmount"))}`,
              `฿${fmt(n(entry.values, "vat"))}`,
              entry.values.paymentStatus,
              <DocumentPrintButton
                key={entry.id}
                title="Supplier Invoice Record"
                number={entry.values.invoiceNumber}
                rows={[
                  ["วันที่ Invoice", entry.values.invoiceDate],
                  ["Supplier", lot?.values.supplier || "Foodiva"],
                  ["PO", lot?.poId || "-"],
                  ["Beef Lot", entry.lotId],
                  ["จำนวน", `${fmt(n(entry.values, "quantityKg"))} กก.`],
                  [
                    "ยอดก่อน VAT",
                    `฿${fmt(n(entry.values, "amountBeforeVat"))}`,
                  ],
                  ["VAT", `฿${fmt(n(entry.values, "vat"))}`],
                  ["ยอดรวม", `฿${fmt(n(entry.values, "totalAmount"))}`],
                  ["ครบกำหนด", entry.values.dueDate],
                  ["สถานะชำระ", entry.values.paymentStatus],
                ]}
              />,
            ];
          }),
          ...entries(db, "taxDocument").map((entry) => {
            const lot = db.lots.find((item) => item.id === entry.lotId);
            return [
              entry.values.documentType,
              entry.values.documentNumber,
              entry.values.documentDate,
              `${lot?.poId || "-"} / ${entry.lotId}`,
              `฿${fmt(n(entry.values, "amount"))}`,
              `฿${fmt(n(entry.values, "vat"))}`,
              entry.values.attachment ? "แนบไฟล์แล้ว" : "รอแนบไฟล์",
              <DocumentPrintButton
                key={entry.id}
                title={entry.values.documentType}
                number={entry.values.documentNumber}
                rows={[
                  ["วันที่เอกสาร", entry.values.documentDate],
                  ["Supplier", lot?.values.supplier || "Foodiva"],
                  ["PO", lot?.poId || "-"],
                  ["ยอด", `฿${fmt(n(entry.values, "amount"))}`],
                  ["VAT", `฿${fmt(n(entry.values, "vat"))}`],
                  ["ไฟล์แนบ", entry.values.attachment || "—"],
                ]}
              />,
            ];
          }),
          ...entries(db, "smokingInvoice").map((entry) => {
            const lot = db.lots.find((item) => item.id === entry.lotId);
            const status = smokingInvoiceStatus(db, entry);
            return [
              "Smoking Service Invoice",
              entry.values.invoiceNumber,
              entry.values.invoiceDate,
              `${lot?.poId || "-"} / ${entry.lotId}`,
              `฿${fmt(n(entry.values, "netPayable"))}`,
              `฿${fmt(n(entry.values, "vat"))}`,
              status,
              <ButtonRow key={entry.id}>
                <DocumentPrintButton
                  title="Smoking Service Invoice"
                  number={entry.values.invoiceNumber}
                  rows={[
                    ["วันที่ Invoice", entry.values.invoiceDate],
                    ["ผู้ให้บริการ", entry.values.serviceProvider],
                    ["PO", lot?.poId || "-"],
                    ["Beef Lot", entry.lotId],
                    [
                      "จำนวนคิดค่าบริการ",
                      `${fmt(n(entry.values, "serviceQuantity"))} กก.`,
                    ],
                    [
                      "ยอดก่อน VAT",
                      `฿${fmt(n(entry.values, "amountBeforeVat"))}`,
                    ],
                    ["VAT", `฿${fmt(n(entry.values, "vat"))}`],
                    [
                      "หัก ณ ที่จ่าย",
                      `฿${fmt(n(entry.values, "withholdingTax"))}`,
                    ],
                    ["ยอดสุทธิ", `฿${fmt(n(entry.values, "netPayable"))}`],
                    ["ไฟล์แนบ", entry.values.attachment],
                  ]}
                />
                {status === "รอตรวจยอด" && (
                  <Button
                    variant="table"
                    onClick={() => open("invoiceReview", entry.lotId)}
                  >
                    ตรวจยอด
                  </Button>
                )}
                {status === "รอชำระ" && (
                  <Button
                    variant="table"
                    onClick={() => open("invoicePayment", entry.lotId)}
                  >
                    ชำระเงิน
                  </Button>
                )}
              </ButtonRow>,
            ];
          }),
        ]}
      />
      <DataTable
        title="PO รมควัน และผลผลิต"
        columns={[
          "Smoke Order",
          "Lot",
          "น้ำหนักดิบ",
          "Chef_house รับ PO",
          "วันที่ขอรม",
          "Smoke Batch",
          "น้ำหนักหลังรม",
          "Loss",
          "Yield",
          "เอกสาร",
        ]}
        rows={entries(db, "smokeOrder").map((order) => {
          const smokeEntries = entries(db, "smoke", order.lotId);
          const accepted = entries(db, "smokeOrderAccept", order.lotId).at(-1);
          const input = smokeEntries.reduce(
            (sum, entry) => sum + n(entry.values, "inputKg"),
            0,
          );
          const output = smokeEntries.reduce(
            (sum, entry) => sum + n(entry.values, "postSmokeKg"),
            0,
          );
          return [
            order.values.orderNumber,
            order.lotId,
            `${fmt(n(order.values, "rawKg"))} กก.`,
            accepted
              ? `${accepted.values.acceptedBy} · รับแล้ว`
              : "รอยืนยันรับ",
            order.values.requestedSmokeDate,
            smokeEntries
              .map((entry) => entry.values.subLot)
              .filter(Boolean)
              .join(", ") || "รอผล",
            `${fmt(output)} กก.`,
            `${fmt(Math.max(0, input - output))} กก.`,
            input ? `${fmt((output / input) * 100)}%` : "—",
            <DocumentPrintButton
              key={order.id}
              title="Smoke Service Order"
              number={order.values.orderNumber}
              rows={[
                ["วันที่สั่งงาน", order.date],
                ["โรงรม", order.values.smoker],
                ["Beef Lot", order.lotId],
                ["น้ำหนักเนื้อดิบ", `${fmt(n(order.values, "rawKg"))} กก.`],
                [
                  "Chef_house รับ PO",
                  accepted?.values.acceptedBy || "รอยืนยันรับ",
                ],
                ["วันที่ขอรม", order.values.requestedSmokeDate],
                ["อัตราค่ารม", `฿${fmt(n(order.values, "serviceRate"))} / กก.`],
                [
                  "ค่าบริการประมาณการ",
                  `฿${fmt(n(order.values, "estimatedCost"))}`,
                ],
                ["คำสั่งพิเศษ", order.values.instruction || "—"],
                ["คาดว่าเสร็จ", order.values.expectedFinishedDate],
              ]}
            />,
          ];
        })}
      />
      <Footnote className="-mt-1">
        ข้อมูลบันทึกด้วยบทบาทและเวลาอัตโนมัติใน Log ของระบบ
        เอกสารที่ยืนยันแล้วใช้การยกเลิก/ปรับปรุงแทนการลบ เพื่อให้ย้อนรอยได้
      </Footnote>
    </div>
  );
}

// Kept temporarily so older document-control markup can be reused without affecting the read-only view.
void DocumentModuleView;
