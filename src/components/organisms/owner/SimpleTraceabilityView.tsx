"use client";

import { Fragment, type ReactNode, useState } from "react";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { IconButton } from "@/components/atoms/IconButton";
import { Select } from "@/components/atoms/Select";
import { Footnote, Muted } from "@/components/atoms/Text";
import { PanelHeading } from "@/components/molecules/PanelHeading";
import { TableActions } from "@/components/molecules/TableActions";
import { TableFilter } from "@/components/molecules/TableFilter";
import { PoLotCell } from "@/components/molecules/PoLotCell";
import { ShipmentChainCard } from "@/components/organisms/owner/ShipmentChainCard";
import {
  foodivaInvoiceRows,
  smokeOrderTraceRows,
  smokingInvoiceRows,
  transportDocumentRows,
  transportDocumentTitle,
} from "@/components/organisms/owner/documentRows";
import { TableSection } from "@/components/organisms/shared/TableSection";
import { DocumentPrintButton } from "@/components/organisms/shared/DocumentPrintButton";
import { AttachmentViewButton } from "@/components/organisms/shared/InvoiceDownloadButton";
import { uploadedAttachment } from "@/components/organisms/shared/referenceDocument";
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
  packingListKg,
  processLoss,
  processed,
  produced,
  producedBags,
  entryBy,
  shipmentLines,
  shipments,
  smokingInvoiceStatus,
  stages,
  type Database,
  type Lot,
} from "@/lib/store";
import { fmt } from "@/lib/format";

const registerColumns = [
  "สถานะ",
  "เลขที่การส่ง / Lot",
  "วันที่ Request",
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
  const [sort, setSort] = useState("date-desc");
  // The register is one row per shipment (purchase POs never move through the stages), so it
  // sorts here rather than through DataTable. A purchase PO number still finds its shipments.
  const matches = (lot: Lot | undefined) =>
    matchesDocumentFilter(db, lot, referenceType, query, fromDate, toDate);
  const poLots = (lot: Lot) =>
    shipmentLines(lot).flatMap(
      (line) => db.lots.find((po) => po.id === line.lotId) ?? [],
    );
  const visibleLots = shipments(db)
    .filter((lot) => matches(lot) || poLots(lot).some(matches))
    .sort((a, b) =>
      sort === "po"
        ? a.poId.localeCompare(b.poId)
        : sort === "lot"
          ? a.id.localeCompare(b.id)
          : sort === "date-asc"
            ? lotIssueDate(db, a).localeCompare(lotIssueDate(db, b))
            : lotIssueDate(db, b).localeCompare(lotIssueDate(db, a)),
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
        title="ทะเบียนเอกสารตามการส่ง"
        count={`${visibleLots.length} รายการ`}
        actions={
          <TableActions>
            <Muted as="span" className="text-caption">
              กด ดู เพื่อเปิดเส้นทางเอกสาร
            </Muted>
            <TableFilter label="เรียงตาม">
              <Select
                variant="filter"
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="date-desc">วันที่ Request (ล่าสุดก่อน)</option>
                <option value="date-asc">วันที่ Request (เก่าสุดก่อน)</option>
                <option value="po">เลขที่การส่ง</option>
                <option value="lot">Lot</option>
              </Select>
            </TableFilter>
          </TableActions>
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
                {registerColumns.map((column, index) => (
                  <th
                    key={column}
                    className={`${thClass} ${index === registerColumns.length - 1 ? "text-right" : ""}`}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleLots.length ? (
                visibleLots.map((lot) => {
                  const smokeOrder = entries(db, "smokeOrder", lot.id).at(-1);
                  const chefInvoice = entries(db, "smokingInvoice", lot.id).at(
                    -1,
                  );
                  const dispatch = entries(db, "dispatch", lot.id).at(-1);
                  const chefReceive = entries(db, "cmReceive", lot.id).at(-1);
                  const returnTrip = entries(db, "return", lot.id).at(-1);
                  const foodivaReturn = entries(
                    db,
                    "foodivaReturnReceive",
                    lot.id,
                  ).at(-1);
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
                  ].find(Boolean);
                  const latestDocument = foodivaReturn
                    ? `Foodiva รับเข้าตู้ · ${fmt(n(foodivaReturn.values, "receivedKg"))} กก.`
                    : returnTrip
                      ? `ใบขนส่งกลับ · ${fmt(n(returnTrip.values, "returnKg"))} กก.`
                      : chefInvoice
                        ? `Invoice Chef House · ${chefInvoice.values.invoiceNumber}`
                        : smokeOrder
                          ? `PO โรงรมควัน · ${smokeOrder.values.orderNumber}`
                          : dispatch
                            ? `ใบขนส่งขาไป · ${fmt(packingListKg(db, lot.id) ?? n(dispatch.values, "dispatchKg"))} กก.`
                            : "รอ Foodiva ทำใบขนส่ง";
                  const route = returnTrip
                    ? "Chef House → Foodiva"
                    : lot.stage >= 2 && lot.stage <= 5
                      ? "Foodiva → Chef House"
                      : lot.stage >= 6
                        ? "Chef House → Foodiva"
                        : "Foodiva · รอเริ่มขนส่ง";
                  const chefFile = uploadedAttachment(
                    db,
                    "smokingInvoice",
                    lot.id,
                  );
                  const detailRows: [
                    string,
                    ReactNode,
                    string,
                    string,
                    ReactNode,
                  ][] = [
                    ...poLots(lot).flatMap((po) => {
                      const foodInvoice = entries(
                        db,
                        "foodivaConfirm",
                        po.id,
                      ).at(-1);
                      const foodivaFile = uploadedAttachment(
                        db,
                        "foodivaConfirm",
                        po.id,
                      );
                      return [
                        [
                          "PO เนื้อ",
                          po.poId,
                          lotIssueDate(db, po),
                          "ออกแล้ว",
                          <DocumentPreview
                            key={`po-${po.id}`}
                            title="Purchase Order"
                            number={po.poId}
                            rows={purchaseOrderRows(po, db)}
                          />,
                        ],
                        [
                          "Invoice Foodiva",
                          foodInvoice?.values.invoiceNo || "—",
                          foodInvoice?.values.invoiceDate || "—",
                          foodInvoice
                            ? `ยืนยัน ${fmt(n(foodInvoice.values, "confirmedKg"))} กก.`
                            : "รอ Foodiva",
                          /* An invoice is the counterparty's own file. Only a PO that
                             never got one falls back to the generated sheet. */
                          foodivaFile ? (
                            <AttachmentViewButton
                              key={`food-file-${po.id}`}
                              {...foodivaFile}
                              label="พรีวิว / PDF"
                            />
                          ) : foodInvoice ? (
                            <DocumentPreview
                              key={`food-invoice-${po.id}`}
                              title="Invoice Foodiva"
                              number={foodInvoice.values.invoiceNo || po.poId}
                              rows={foodivaInvoiceRows(db, po, foodInvoice)}
                            />
                          ) : (
                            "—"
                          ),
                        ],
                      ] as [string, ReactNode, string, string, ReactNode][];
                    }),
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
                          rows={smokeOrderTraceRows(db, lot, smokeOrder)}
                        />
                      ) : (
                        "—"
                      ),
                    ],
                    [
                      "Invoice Chef House",
                      chefInvoice?.values.invoiceNumber || "—",
                      chefInvoice?.values.invoiceDate || "—",
                      chefInvoice
                        ? smokingInvoiceStatus(db, chefInvoice)
                        : "รอ Chef House Submit",
                      chefFile ? (
                        <AttachmentViewButton
                          key="chef-file"
                          {...chefFile}
                          label="พรีวิว / PDF"
                        />
                      ) : chefInvoice ? (
                        <DocumentPreview
                          key="chef-invoice"
                          title="Invoice Chef House"
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
                      "ใบขนส่งไป Chef House",
                      dispatch?.values.transferNumber || "—",
                      dispatch?.values.pickupDate || "—",
                      dispatch
                        ? `${fmt(packingListKg(db, lot.id) ?? n(dispatch.values, "dispatchKg"))} กก.`
                        : "รอเรียกรถ",
                      dispatch ? (
                        <DocumentPreview
                          key="dispatch"
                          title={transportDocumentTitle.outbound}
                          number={dispatch.values.transferNumber || lot.id}
                          rows={transportDocumentRows(
                            db,
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
                      "รับที่ Chef House",
                      chefReceive
                        ? `${fmt(n(chefReceive.values, "receivedKg"))} กก.`
                        : "—",
                      chefReceive?.date || "—",
                      chefReceive ? "รับแล้ว" : "รอยืนยันรับ",
                      chefReceive ? (
                        <DocumentPreview
                          key="chef-receive"
                          title="ใบยืนยันรับเนื้อ Chef House"
                          number={`RCV-${lot.id}`}
                          rows={[
                            ["เลขที่การส่ง", lot.poId],
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
                          `เข้าเตา ${fmt(n(entry.values, "inputKg"))} กก. · หลังรม ${fmt(n(entry.values, "postSmokeKg"))} กก. · Waste ${fmt(n(entry.values, "wasteKg"))} กก. · ${entry.values.packCount || "0"} กล่องรมควัน`,
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
                                "จำนวนกล่องรมควัน",
                                `${entry.values.packCount || "0"} กล่องรมควัน`,
                              ],
                              ["น้ำหนักกล่องรมควัน", entry.values.packs || "—"],
                            ]}
                          />,
                        ] as [string, ReactNode, string, string, ReactNode],
                    ),
                    [
                      "ผลผลิตหลังรม",
                      produced(db, lot.id)
                        ? `${fmt(produced(db, lot.id))} กก. · ${producedBags(db, lot.id)} กล่องรมควัน`
                        : "—",
                      produced(db, lot.id) ? "บันทึกแล้ว" : "รอผลิต",
                      produced(db, lot.id) ? "ผลิตแล้ว" : "รอ Chef House",
                      smokeEntries.length ? (
                        <DocumentPreview
                          key="yield"
                          title="สรุปผลผลิตหลังรม"
                          number={`YIELD-${lot.id}`}
                          rows={[
                            ["เลขที่การส่ง", lot.poId],
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
                            [
                              "จำนวนกล่องรมควัน",
                              `${producedBags(db, lot.id)} กล่องรมควัน`,
                            ],
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
                            db,
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
                      (foodivaReturn && returnTrip?.values.transferNumber) ||
                        "—",
                      foodivaReturn?.date || "—",
                      foodivaReturn
                        ? `${fmt(n(foodivaReturn.values, "receivedKg"))} กก. · ${foodivaReturn.values.receivedBags || "—"} กล่องรมควัน`
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
                            .map(
                              (a) =>
                                `${a.values.branch} ${fmt(n(a.values, "kg"))} กก.`,
                            )
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
                          <IconButton
                            size="sm"
                            className="rounded-sm border border-border bg-surface text-h2 leading-none"
                            label={`${isOpen ? "ย่อ" : "ขยาย"}รายละเอียด ${lot.id}`}
                            onClick={() => toggle(lot.id)}
                            icon={isOpen ? "−" : "+"}
                          />
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
                          {latest ? entryBy(latest) : "Owner"}
                        </td>
                        <td className={`${tdClass} text-right`}>
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
                                title="สรุปเอกสารตามการส่ง"
                                number={`TRACE-${lot.id}`}
                                rows={[
                                  ["เลขที่การส่ง", lot.poId],
                                  ["Lot", lot.id],
                                  ["สถานะล่าสุด", stages[lot.stage]],
                                  [
                                    "PO ซื้อ",
                                    poLots(lot)
                                      .map((po) => po.poId)
                                      .join(", ") || "—",
                                  ],
                                  [
                                    "PO โรงรมควัน",
                                    smokeOrder?.values.orderNumber || "—",
                                  ],
                                  [
                                    "Invoice Chef House",
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
                            <ShipmentChainCard db={db} lot={lot} />
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-190 border-collapse bg-surface">
                                <thead>
                                  <tr>
                                    {detailColumns.map((column, index) => (
                                      <th
                                        key={column}
                                        className={`${detailCellClass} bg-bg text-caption text-text-secondary ${index === detailColumns.length - 1 ? "text-right" : ""}`}
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
                                        <td
                                          className={`${detailCellClass} text-right`}
                                        >
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
                    ไม่พบข้อมูล · ยังไม่มีเอกสารตามเงื่อนไขที่เลือก
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
