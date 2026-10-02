import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { documentsDb as db } from "@/components/organisms/owner/LotsPage.fixtures";
import {
  packingListRows,
  purchaseOrderRows,
  smokeOrderPrintRows,
  transportDocumentRows,
  transportDocumentTitle,
} from "@/components/organisms/shared/documentRows";
import { entries, purchaseLots, shipments } from "@/lib/store";
import { DocumentPrintButton } from "./DocumentPrintButton";

const po = purchaseLots(db)[0];
const lot = shipments(db)[0];
const first = (kind: Parameters<typeof entries>[1], lotId = lot.id) =>
  entries(db, kind, lotId)[0];

const meta = {
  title: "Molecules/DocumentPrintButton",
  component: DocumentPrintButton,
  parameters: { db },
} satisfies Meta<typeof DocumentPrintButton>;

export default meta;
type Story = StoryObj<typeof meta>;

/** กดแล้วเปิดเอกสารในหน้าต่างใหม่ (อนุญาต Pop-up ก่อน) มีปุ่ม「ดาวน์โหลด / พิมพ์ PDF」ซึ่งไม่ติดไปในกระดาษ
 *  หัวเอกสาร (ชื่อบริษัท ที่อยู่ ผู้ติดต่อ เบอร์ เลขผู้เสียภาษี โลโก้) มาจาก Settings
 *  PO ซื้อเนื้อ พิมพ์เป็นกระดาษ PO มีราคาและยอดรวม */
export const PurchaseOrder: Story = {
  args: {
    label: "PO ซื้อเนื้อ",
    title: "Purchase Order",
    number: po.poId,
    rows: purchaseOrderRows(db, first("purchase", po.id)),
  },
};

/** PO รมควัน: กระดาษ PO แบบเดียวกัน แต่ไม่มีราคา (ค่ารมจดทีหลัง) และอ้างอิง Packing List ของ Lot */
export const SmokeOrder: Story = {
  args: {
    label: "PO รมควัน",
    title: "Smoke Service Purchase Order",
    number: first("smokeOrder").values.orderNumber,
    rows: smokeOrderPrintRows(db, lot, first("smokeOrder")),
  },
};

/** Packing List: ตารางป้ายและค่า ช่องที่ไม่ได้จดอ่าน "—" */
export const PackingList: Story = {
  args: {
    label: "Packing List",
    title: "Packing List",
    number: lot.poId,
    rows: packingListRows(db, lot, first("packingList")),
  },
};

/** ใบขนส่งขาไป: หนึ่งใบต่อบรรทัดส่งไปรม บอก PO เนื้อของบรรทัดนั้น */
export const TransportOut: Story = {
  args: {
    label: "ใบขนส่งขาไป",
    title: transportDocumentTitle.dispatch,
    number: first("dispatch").values.transferNumber,
    rows: transportDocumentRows(db, lot, first("dispatch")),
  },
};

/** ใบขนส่งขากลับ: หนึ่งใบต่อบรรทัดรถขากลับ */
export const TransportBack: Story = {
  args: {
    label: "ใบขนส่งขากลับ",
    title: transportDocumentTitle.return,
    number: first("return").values.transferNumber,
    rows: transportDocumentRows(db, lot, first("return")),
  },
};
