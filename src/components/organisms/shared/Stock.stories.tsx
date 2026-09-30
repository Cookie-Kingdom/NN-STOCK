import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  centralDb,
  chillDb,
  day,
  demoDb,
  nextDay,
  unlinkedBranchDb,
} from "../../../../.storybook/fixtures";
import { pick } from "../../../../.storybook/pick";
import { branches, shipments, type Database } from "@/lib/store";
import { BranchStockSummary } from "./BranchStockSummary";
import { MeatStockTable } from "./MeatStockTable";
import { SupplyStock } from "./SupplyStock";

const meta: Meta = {
  title: "Organisms/Shared/Stock",
  parameters: { db: demoDb },
};

export default meta;

const branchCheck = {
  name: "สาขา",
  control: "check" as const,
  options: [...branches],
};

const meatDb = pick("ข้อมูล", {
  "ตัวอย่าง 7 วัน": demoDb,
  เพิ่งเข้าสต๊อกกลาง: centralDb,
  "เนื้อยังไม่ผูก Lot": unlinkedBranchDb,
});

/** เลือกใน Controls:
 *  - มุมมอง: Owner เห็นทุกสาขา, Chef House เห็นสต๊อกผลิต
 *  - ข้อมูล: รอบตัวอย่างที่ขายแล้ว, Lot ที่เพิ่งเข้าสต๊อกกลาง หรือสาขารับเนื้อไม่ระบุ Lot
 *    (Owner มีแถว 「ไม่ระบุ Lot」 ท้ายตาราง) */
export const MeatStock: StoryObj<{
  variant: "owner" | "chef";
  db: Database;
}> = {
  argTypes: {
    variant: {
      name: "มุมมอง",
      control: {
        type: "radio",
        labels: { owner: "Owner", chef: "Chef House" },
      },
      options: ["owner", "chef"],
    },
    db: meatDb.argType,
  },
  args: { variant: "owner", db: meatDb.initial },
  render: ({ variant, db }) => (
    <MeatStockTable
      key={`${variant}-${db.entries.length}`}
      db={db}
      variant={variant}
      lots={shipments(db)}
    />
  ),
};

/** เลือกสาขาใน Controls: หนึ่งคอลัมน์ต่อสาขาที่เลือก */
export const Supply: StoryObj<{ branches: string[] }> = {
  argTypes: { branches: branchCheck },
  args: { branches: [...branches] },
  render: ({ branches }) => <SupplyStock db={demoDb} branches={branches} />,
};

const summaryDb = pick("ข้อมูล", {
  "ชิลยกมา (ศาลาแดง)": chillDb,
  "เนื้อยังไม่ผูก Lot": unlinkedBranchDb,
  "ตัวอย่าง 7 วัน": demoDb,
});
const summaryDay = pick("วัน", {
  วันแรก: day,
  วันถัดไป: nextDay,
  "ไม่ระบุ (วันนี้)": undefined,
});

/** เลือกใน Controls:
 *  - ข้อมูล:
 *    - ชิลยกมา: วันแรกรับเข้าและละลาย 70 kg ใช้ไป 65.5 kg เหลือชิล 4.5 kg; วันถัดไป
 *      ชิลยกมา 4.5 kg ยังไม่มีการเคลื่อนไหว
 *    - เนื้อยังไม่ผูก Lot: แถว "ไม่ระบุ Lot" กับ badge "ยังไม่ผูก Lot" (รับ 10 kg แช่แข็ง
 *      4 kg ชิล 3 kg) และเลือกได้ในตัวกรอง Lot 14 วัน
 *    - ตัวอย่าง 7 วัน: รอบขายเต็ม
 *  - สาขา: สาขาเดียว = มุมมองสาขา; หลายสาขา = มุมมอง Owner มีตัวเลือกสาขา
 *  - วัน: `initialDate` */
export const BranchSummary: StoryObj<{
  db: Database;
  branches: string[];
  date?: string;
}> = {
  argTypes: {
    db: summaryDb.argType,
    branches: branchCheck,
    date: summaryDay.argType,
  },
  args: {
    db: summaryDb.initial,
    branches: ["ศาลาแดง"],
    date: summaryDay.initial,
  },
  render: ({ db, branches, date }) => (
    <BranchStockSummary
      key={`${db.entries.length}-${branches.join()}-${date}`}
      db={db}
      branches={branches}
      initialDate={date}
    />
  ),
};
