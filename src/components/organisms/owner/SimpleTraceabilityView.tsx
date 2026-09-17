"use client";

import { Fragment, type ReactNode, useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Footnote, Muted } from "@/components/atoms/Text";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { PoLotCell } from "@/components/molecules/PoLotCell";
import {
  foodivaInvoiceRows,
  smokeOrderTraceRows,
  smokingInvoiceRows,
  transportDocumentRows,
  transportDocumentTitle,
} from "@/components/organisms/owner/documentRows";
import { TableSection } from "@/components/organisms/shared/TableSection";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import {
  DocumentFilterBar,
  lotIssueDate,
  matchesDocumentFilter,
  purchaseOrderRows,
  type DocumentReferenceType,
} from "@/components/organisms/shared/documents";
import {
  entries,
  n,
  processLoss,
  processed,
  produced,
  producedBags,
  roleName,
  smokingInvoiceStatus,
  stages,
  type Database,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const registerColumns = [
  "สถานะ",
  "เลข PO / Lot",
  "วันที่ออก PO",
  "เอกสารล่าสุด",
  "เส้นทางล่าสุด",
  "ผู้ดำเนินการล่าสุด",
  "การทำงาน",
];
const detailColumns = [
  "เอกสาร / ขั้นตอน",
  "เลขอ้างอิง",
  "วันที่",
  "สถานะ / น้ำหนัก",
  "เอกสาร",
];

const thClass =
  "sticky top-0 border-b border-border bg-bg px-4.5 py-3.5 text-left align-middle text-caption font-semibold tracking-[0.03em] whitespace-nowrap text-text-secondary";
const tdClass =
  "border-b border-border px-4.5 py-4 text-left align-middle leading-[1.45] whitespace-normal [tr:last-child>&]:border-b-0";
const expandCellClass = "w-10.5 pr-1.5 text-center";
const detailCellClass =
  "border-b border-border px-5 py-3 text-left whitespace-nowrap [tr:last-child>&]:border-b-0";

function DocumentPreview({
  title,
  number,
  rows,
}: {
  title: string;
  number: string;
  rows: [string, string][];
}) {
  return (
    <DocumentPrintButton
      title={title}
      number={number}
      rows={rows}
      label="พรีวิว / PDF"
      preview
    />
  );
}

export function SimpleTraceabilityView({ db }: { db: Database }) {
  const [referenceType, setReferenceType] =
    useState<DocumentReferenceType>("po");
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [expandedLot, setExpandedLot] = useState<string | null>(null);
  const visibleLots = db.lots.filter((lot) =>
    matchesDocumentFilter(db, lot, referenceType, query, fromDate, toDate),
  );
  const toggle = (lotId: string) =>
    setExpandedLot((current) => (current === lotId ? null : lotId));
  return (
    <div className="grid gap-6">
      <PanelHeading
        overline="READ-ONLY TRACEABILITY"
        title="เอกสารและการตรวจสอบย้อนกลับ"
        description="ตารางสำหรับอ่านเส้นทางของแต่ละ Lot เท่านั้น การตรวจยอด ชำระเงิน และดาวน์โหลด Invoice ให้ทำจากเมนูใบ Invoice"
      />

      <DocumentFilterBar
        referenceType={referenceType}
        query={query}
        fromDate={fromDate}
        toDate={toDate}
        onReferenceType={setReferenceType}
        onQuery={setQuery}
        onFromDate={setFromDate}
        onToDate={setToDate}
      />

      <TableSection
        title="ทะเบียนเอกสารตาม Lot"
        count={`${visibleLots.length} รายการ`}
        actions={
          <Muted as="span" className="text-caption">
            กด ดู เพื่อเปิดเส้นทางเอกสาร
          </Muted>
        }
      >
        <div className="max-w-full overflow-auto">
          <table className="w-full min-w-260 border-separate border-spacing-0 tabular-nums">
            <thead>
              <tr>
                <th
                  aria-label="ขยายรายละเอียด"
                  className={`${thClass} ${expandCellClass}`}
                />
                {registerColumns.map((column) => (
                  <th key={column} className={thClass}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleLots.length ? (
                visibleLots.map((lot) => {
                  const foodInvoice = entries(db, "foodivaConfirm", lot.id).at(
                    -1,
                  );
                  const smokeOrder = entries(db, "smokeOrder", lot.id).at(-1);
                  const chefInvoice = entries(db, "smokingInvoice", lot.id).at(
                    -1,
                  );
                  const dispatch = entries(db, "dispatch", lot.id).at(-1);
                  const chefReceive = entries(db, "cmReceive", lot.id).at(-1);
                  const returnTrip = entries(db, "return", lot.id).at(-1);
                  const foodivaReturn = entries(db, "foodivaReturnReceive", lot.id).at(-1);
                  const central = entries(db, "central", lot.id).at(-1);
                  const allocations = entries(db, "allocate", lot.id);
                  const sales = entries(db, "sale", lot.id);
                  const smokeEntries = entries(db, "smoke", lot.id);
                  const latest = [
                    returnTrip,
                    chefReceive,
                    dispatch,
                    chefInvoice,
                    smokeOrder,
                    foodInvoice,
                  ].find(Boolean);
                  const latestDocument = returnTrip
                    ? `ใบขนส่งกลับ · ${fmt(n(returnTrip.values, "returnKg"))} กก.`
                    : chefInvoice
                      ? `Invoice Chef_house · ${chefInvoice.values.invoiceNumber}`
                      : smokeOrder
                        ? `PO โรงรมควัน · ${smokeOrder.values.orderNumber}`
                        : foodInvoice
                          ? `Invoice Foodiva · ${foodInvoice.values.invoiceNo}`
                          : "รอ Invoice Foodiva";
                  const route = returnTrip
                    ? "Chef_house → Foodiva"
                    : lot.stage >= 2 && lot.stage <= 5
                      ? "Foodiva → Chef_house"
                      : lot.stage >= 6
                        ? "Chef_house → Foodiva"
                        : "Foodiva · รอเริ่มขนส่ง";
                  const detailRows: [
                    string,
                    ReactNode,
                    string,
                    string,
                    ReactNode,
                  ][] = [
                    [
                      "PO เนื้อ",
                      lot.poId,
                      lotIssueDate(db, lot),
                      "ออกแล้ว",
                      <DocumentPreview
                        key="po"
                        title="Purchase Order"
                        number={lot.poId}
                        rows={purchaseOrderRows(lot, db)}
                      />,
                    ],
                    [
                      "Invoice Foodiva",
                      foodInvoice?.values.invoiceNo || "—",
                      foodInvoice?.values.invoiceDate || "—",
                      foodInvoice
                        ? `ยืนยัน ${fmt(n(foodInvoice.values, "confirmedKg"))} กก.`
                        : "รอ Foodiva",
                      foodInvoice ? (
                        <DocumentPreview
                          key="food-invoice"
                          title="Invoice Foodiva"
                          number={foodInvoice.values.invoiceNo || lot.poId}
                          rows={foodivaInvoiceRows(db, lot, foodInvoice)}
                        />
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      "PO โรงรมควัน",
                      smokeOrder?.values.orderNumber || "—",
                      smokeOrder?.date || "—",
                      smokeOrder
                        ? `${fmt(n(smokeOrder.values, "rawKg"))} กก.`
                        : "รอ Owner ออก PO",
                      smokeOrder ? (
                        <DocumentPreview
                          key="smoke-order"
                          title="Smoke Service Purchase Order"
                          number={smokeOrder.values.orderNumber || lot.poId}
                          rows={smokeOrderTraceRows(
                            lot,
                            smokeOrder,
                            foodInvoice,
                          )}
                        />
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      "Invoice Chef_house",
                      chefInvoice?.values.invoiceNumber || "—",
                      chefInvoice?.values.invoiceDate || "—",
                      chefInvoice
                        ? smokingInvoiceStatus(db, chefInvoice)
                        : "รอ Chef_house Submit",
                      chefInvoice ? (
                        <DocumentPreview
                          key="chef-invoice"
                          title="Invoice Chef_house"
                          number={chefInvoice.values.invoiceNumber || lot.poId}
                          rows={smokingInvoiceRows(
                            db,
                            lot,
                            chefInvoice,
                            smokeOrder,
                          )}
                        />
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      "ใบขนส่งไป Chef_house",
                      dispatch?.values.transferNumber || "—",
                      dispatch?.values.pickupDate || "—",
                      dispatch
                        ? `${fmt(n(dispatch.values, "dispatchKg"))} กก.`
                        : "รอเรียกรถ",
                      dispatch ? (
                        <DocumentPreview
                          key="dispatch"
                          title={transportDocumentTitle.outbound}
                          number={dispatch.values.transferNumber || lot.id}
                          rows={transportDocumentRows(
                            lot,
                            dispatch,
                            "outbound",
                          )}
                        />
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      "รับที่ Chef_house",
                      chefReceive
                        ? `${fmt(n(chefReceive.values, "receivedKg"))} กก.`
                        : "—",
                      chefReceive?.date || "—",
                      chefReceive ? "รับแล้ว" : "รอยืนยันรับ",
                      chefReceive ? (
                        <DocumentPreview
                          key="chef-receive"
                          title="ใบยืนยันรับเนื้อ Chef_house"
                          number={`RCV-${lot.id}`}
                          rows={[
                            ["PO", lot.poId],
                            ["Lot เนื้อ", lot.id],
                            ["วันที่รับ", chefReceive.date],
                            ["เวลาถึง", chefReceive.values.arrival],
                            [
                              "น้ำหนักรับจริง",
                              `${fmt(n(chefReceive.values, "receivedKg"))} กก.`,
                            ],
                            ["หมายเหตุ", chefReceive.values.note || "—"],
                          ]}
                        />
                      ) : (
                        "—"
                      ),
                    ],
                    ...smokeEntries.map(
                      (entry) =>
                        [
                          "Lot สโมครายวัน",
                          entry.values.subLot || "—",
                          entry.values.smokeDate || entry.date,
                          `เข้าเตา ${fmt(n(entry.values, "inputKg"))} กก. · หลังรม ${fmt(n(entry.values, "postSmokeKg"))} กก. · Waste ${fmt(n(entry.values, "wasteKg"))} กก. · ${entry.values.packCount || "0"} ถุง`,
                          <DocumentPreview
                            key={entry.id}
                            title="บันทึก Lot สโมครายวัน"
                            number={entry.values.subLot || entry.id}
                            rows={[
                              ["Lot หลัก", lot.id],
                              ["Lot สโมค", entry.values.subLot || "—"],
                              [
                                "วันที่สโมค",
                                entry.values.smokeDate || entry.date,
                              ],
                              [
                                "น้ำหนักเข้าเตา",
                                `${fmt(n(entry.values, "inputKg"))} กก.`,
                              ],
                              [
                                "น้ำหนักหลังรม",
                                `${fmt(n(entry.values, "postSmokeKg"))} กก.`,
                              ],
                              [
                                "น้ำหนัก Waste",
                                `${fmt(n(entry.values, "wasteKg"))} กก.`,
                              ],
                              [
                                "จำนวนถุง",
                                `${entry.values.packCount || "0"} ถุง`,
                              ],
                              ["น้ำหนักถุง", entry.values.packs || "—"],
                            ]}
                          />,
                        ] as [string, ReactNode, string, string, ReactNode],
                    ),
                    [
                      "ผลผลิตหลังรม",
                      produced(db, lot.id)
                        ? `${fmt(produced(db, lot.id))} กก. · ${producedBags(db, lot.id)} ถุง`
                        : "—",
                      produced(db, lot.id) ? "บันทึกแล้ว" : "รอผลิต",
                      produced(db, lot.id) ? "ผลิตแล้ว" : "รอ Chef_house",
                      smokeEntries.length ? (
                        <DocumentPreview
                          key="yield"
                          title="สรุปผลผลิตหลังรม"
                          number={`YIELD-${lot.id}`}
                          rows={[
                            ["PO", lot.poId],
                            ["Lot เนื้อ", lot.id],
                            ["จำนวน Lot สโมค", `${smokeEntries.length} รอบ`],
                            [
                              "น้ำหนักเข้าเตารวม",
                              `${fmt(processed(db, lot.id))} กก.`,
                            ],
                            [
                              "น้ำหนักหลังรมรวม",
                              `${fmt(produced(db, lot.id))} กก.`,
                            ],
                            ["จำนวนถุง", `${producedBags(db, lot.id)} ถุง`],
                            [
                              "Waste รวม",
                              `${fmt(processLoss(db, lot.id))} กก.`,
                            ],
                          ]}
                        />
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      "ใบขนส่งกลับ Foodiva",
                      returnTrip?.values.transferNumber || "—",
                      returnTrip?.values.returnDate || "—",
                      returnTrip
                        ? `${fmt(n(returnTrip.values, "returnKg"))} กก.`
                        : "รอเรียกรถกลับ",
                      returnTrip ? (
                        <DocumentPreview
                          key="return"
                          title={transportDocumentTitle.return}
                          number={returnTrip.values.transferNumber || lot.id}
                          rows={transportDocumentRows(
                            lot,
                            returnTrip,
                            "return",
                          )}
                        />
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      "Foodiva รับเข้าตู้",
                      // Received against the return transfer; there is no separate receipt document.
                      (foodivaReturn && returnTrip?.values.transferNumber) || "—",
                      foodivaReturn?.date || "—",
                      foodivaReturn
                        ? `${fmt(n(foodivaReturn.values, "receivedKg"))} กก. · ${foodivaReturn.values.receivedBags || "—"} ถุง`
                        : "รอ Foodiva รับ",
                      "—",
                    ],
                    [
                      "รับเข้าสต๊อกกลาง",
                      // Received against the return transfer; there is no separate receipt document.
                      (central && returnTrip?.values.transferNumber) || "—",
                      central?.date || "—",
                      central
                        ? `${fmt(n(central.values, "centralKg"))} กก.`
                        : "รอรับเข้าสต๊อกกลาง",
                      "—",
                    ],
                    [
                      "จัดสรรไปสาขา",
                      allocations.length ? `${allocations.length} ใบ` : "—",
                      allocations.at(-1)?.date || "—",
                      allocations.length
                        ? allocations
                            .map((a) => `${a.values.branch} ${fmt(n(a.values, "kg"))} กก.`)
                            .join(" · ")
                        : "รอจัดสรร",
                      "—",
                    ],
                    [
                      "ขายที่สาขา",
                      sales.length ? `${sales.length} วัน` : "—",
                      sales.at(-1)?.date || "—",
                      sales.length
                        ? `ขาย ${fmt(sales.reduce((t, e) => t + n(e.values, "soldKg"), 0))} กก. · Waste ${fmt(sales.reduce((t, e) => t + n(e.values, "wasteKg"), 0))} กก.`
                        : "ยังไม่มียอดขาย",
                      "—",
                    ],
                  ];
                  const isOpen = expandedLot === lot.id;
                  return (
                    <Fragment key={lot.id}>
                      <tr className="hover:bg-bg">
                        <td className={`${tdClass} ${expandCellClass}`}>
                          <button
                            type="button"
                            className="grid size-6 place-items-center rounded-sm border border-border bg-surface text-h2 leading-none text-text-secondary hover:bg-bg"
                            aria-label={`${isOpen ? "ย่อ" : "ขยาย"}รายละเอียด ${lot.id}`}
                            onClick={() => toggle(lot.id)}
                          >
                            {isOpen ? "−" : "+"}
                          </button>
                        </td>
                        <td className={tdClass}>
                          <Badge tone={lot.stage >= 8 ? "success" : "danger"}>
                            {stages[lot.stage]}
                          </Badge>
                        </td>
                        <td className={tdClass}>
                          <PoLotCell
                            poId={lot.poId}
                            lotId={<Muted as="span">{lot.id}</Muted>}
                          />
                        </td>
                        <td className={tdClass}>{lotIssueDate(db, lot)}</td>
                        <td className={tdClass}>{latestDocument}</td>
                        <td className={tdClass}>{route}</td>
                        <td className={tdClass}>
                          {latest ? roleName[latest.role] : "Owner"}
                        </td>
                        <td className={tdClass}>
                          <Button
                            variant="table"
                            onClick={() => toggle(lot.id)}
                          >
                            {isOpen ? "ซ่อน" : "ดู"}
                          </Button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td
                            colSpan={8}
                            className="border-b border-border bg-bg p-0 text-left whitespace-normal [tr:last-child>&]:border-b-0"
                          >
                            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                              <div className="grid gap-0.75">
                                <strong>
                                  {lot.poId} / {lot.id}
                                </strong>
                                <span className="text-caption text-text-secondary">
                                  ลำดับเอกสารและจุดตรวจสอบย้อนกลับ
                                </span>
                              </div>
                              <DocumentPreview
                                title="สรุปเอกสารตาม Lot"
                                number={`TRACE-${lot.id}`}
                                rows={[
                                  ["PO", lot.poId],
                                  ["Lot", lot.id],
                                  ["สถานะล่าสุด", stages[lot.stage]],
                                  [
                                    "Invoice Foodiva",
                                    foodInvoice?.values.invoiceNo || "—",
                                  ],
                                  [
                                    "PO โรงรมควัน",
                                    smokeOrder?.values.orderNumber || "—",
                                  ],
                                  [
                                    "Invoice Chef_house",
                                    chefInvoice?.values.invoiceNumber || "—",
                                  ],
                                  [
                                    "Lot สโมค",
                                    smokeEntries
                                      .map((entry) => entry.values.subLot)
                                      .filter(Boolean)
                                      .join(", ") || "—",
                                  ],
                                  [
                                    "ใบขนส่งขาไป",
                                    dispatch?.values.transferNumber || "—",
                                  ],
                                  [
                                    "ใบขนส่งขากลับ",
                                    returnTrip?.values.transferNumber || "—",
                                  ],
                                ]}
                              />
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-190 border-collapse bg-surface">
                                <thead>
                                  <tr>
                                    {detailColumns.map((column) => (
                                      <th
                                        key={column}
                                        className={`${detailCellClass} bg-bg text-caption text-text-secondary`}
                                      >
                                        {column}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {detailRows.map(
                                    (
                                      [
                                        type,
                                        number,
                                        documentDate,
                                        status,
                                        action,
                                      ],
                                      index,
                                    ) => (
                                      <tr key={`${type}-${index}`}>
                                        <td className={detailCellClass}>
                                          {type}
                                        </td>
                                        <td className={detailCellClass}>
                                          {number}
                                        </td>
                                        <td className={detailCellClass}>
                                          {documentDate}
                                        </td>
                                        <td className={detailCellClass}>
                                          {status}
                                        </td>
                                        <td className={detailCellClass}>
                                          {action}
                                        </td>
                                      </tr>
                                    ),
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              ) : (
                <tr>
                  <td
                    className={`${tdClass} p-7 text-center text-text-secondary`}
                    colSpan={8}
                  >
                    ยังไม่มีเอกสารตามเงื่อนไขที่เลือก
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </TableSection>

      <Footnote className="-mt-1">
        หน้านี้อ่านอย่างเดียวและไม่เปลี่ยนข้อมูลใด ๆ ทุกขั้นตอนยังทำจากเมนู PO,
        ใบ Invoice, ใบขนส่ง, งานผลิต และสต๊อกตามเดิม
      </Footnote>
    </div>
  );
}
