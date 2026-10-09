import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Composer } from "@/components/organisms/workspace/Composer";
import {
  WithWorkspace,
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { accountById, type AccountId } from "@/lib/accounts";
import { today } from "@/lib/format";
import { mutate, seed, type Values } from "@/lib/store";
import { BranchMeatStock, BranchStock } from "./BranchStock";

/** The page and the composer, as the shell has them, and the toast a save sets. */
const Stock = ({
  account,
  page = "inventory",
}: {
  account: AccountId;
  /** Stock (เนื้อ ข้าวเหนียว น้ำพริก) or Inventory (วัสดุ). */
  page?: "stock" | "inventory";
}) => (
  <WithWorkspace account={account}>
    {(ws) => (
      <>
        {page === "stock" ? (
          <BranchMeatStock ws={ws} />
        ) : (
          <BranchStock ws={ws} />
        )}
        <Composer ws={ws} />
        {ws.toast.message && (
          <p role="status" className="mt-3 text-body-sm text-success">
            {ws.toast.message}
          </p>
        )}
      </>
    )}
  </WithWorkspace>
);

/** The sample (an opening ten days ago, a sheet a day until yesterday) as ศาลาแดง receives
 *  it, after it saved today's two sheets with `meat` and `materials`. */
const savedDb = (meat: Values, materials: Values) =>
  dbFor(
    "saladaeng",
    Object.entries({ meat, materials }).reduce(
      (db, [sheet, values]) =>
        mutate(
          db,
          accountById("saladaeng")!,
          "daily",
          { sheet, ...values },
          "",
          today(),
        ),
      sampleDb,
    ),
  );
const saladaeng = { account: "saladaeng" } as const;
/** Today saved, each sheet with a waste and its reason. */
const saved = {
  args: saladaeng,
  parameters: {
    db: savedDb(
      {
        "used.meat": "3.3",
        "waste.meat": "0.3",
        "reason.meat": "เนื้อตกพื้น",
        "used.rice": "2",
        "used.chili": "4",
        reporter: "น้องฝน",
        note: "ปิดร้านเร็ว",
      },
      {
        "used.m1": "24",
        "used.m4": "14",
        "waste.m4": "4",
        "reason.m4": "ถุงเปียกน้ำ",
        "received.m6": "50",
        reporter: "น้องฝน",
      },
    ),
  },
};
/** Today saved with more used than the branch held. */
const negative = {
  args: saladaeng,
  parameters: {
    db: savedDb(
      { "used.meat": "999", reporter: "น้องฝน" },
      { "used.m1": "99999", reporter: "น้องฝน" },
    ),
  },
};
/** Today saved with no reporter, and a waste with no reason. */
const unsigned = {
  args: saladaeng,
  parameters: {
    db: savedDb(
      { "used.meat": "3", "used.chili": "6", "waste.chili": "2" },
      { "used.m1": "24", "waste.m1": "3" },
    ),
  },
};
const stock = { page: "stock" } as const;
/** Today saved, at 390px. */
const phoneSaved = {
  ...saved,
  ...phone,
  parameters: { ...saved.parameters, ...phone.parameters },
};
const unlock = async ({ canvasElement }: { canvasElement: HTMLElement }) =>
  userEvent.click(
    await within(canvasElement).findByRole("button", { name: "แก้ไขบันทึก" }),
  );
const openingView = async ({ canvasElement }: { canvasElement: HTMLElement }) =>
  userEvent.click(
    await within(canvasElement).findByRole("radio", {
      name: "ตั้งสต๊อกเริ่มต้น",
    }),
  );

const meta = {
  title: "Organisms/Branch/BranchStock",
  component: Stock,
  // 「เพิ่มสินค้า」 opens a modal <dialog>: one per story would stack on a Docs page.
  tags: ["!autodocs"],
  args: { account: "minburi" },
  argTypes: { account: { control: false }, page: { control: false } },
  parameters: { db: dbFor("minburi") },
} satisfies Meta<typeof Stock>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Inventory ของมีนบุรี ตั้งสต๊อกเริ่มต้นแล้ว วันนี้ยังไม่บันทึก: ป้าย「ยังไม่บันทึกวันนี้」·
 *  รายการสินค้าเป็นตาราง มีเส้นแบ่งคอลัมน์และเส้นแบ่งแถว หัวตาราง สินค้า / ยกมา · รับเพิ่ม · ใช้ไป ·
 *  Waste / ทิ้ง · คงเหลือ (คิดให้ทันที) · ช่องเปิดให้พิมพ์ ไม่มีปุ่ม「แก้ไขบันทึก」·
 *  พิมพ์แล้วป้ายเป็น「ยังไม่บันทึก」· กด「บันทึกการใช้วันนี้」บันทึกได้แม้เว้นว่าง ·
 *  ช่องค้นหาซ่อนแถว แต่บันทึกครบทุกรายการ */
export const TodayNotSaved: Story = {};

/** ยังไม่เคยตั้งสต๊อกเริ่มต้น: 「ตั้งสต๊อกเริ่มต้นของมีนบุรีก่อน」พร้อมปุ่มไปหน้าตั้งสต๊อกเริ่มต้น */
export const NoOpening: Story = {
  parameters: { db: dbFor("minburi", seed) },
};

/** Inventory ของศาลาแดง บันทึกวันนี้แล้ว จึงเปิดมาล็อก: ป้าย「บันทึกวันนี้แล้ว」ตัวเลข ผู้บันทึก
 *  และหมายเหตุเป็นข้อความ พิมพ์ไม่ได้ · ปุ่มล่างเป็น「แก้ไขบันทึก」·
 *  ถุงกระดาษมี Waste 4 พร้อมสาเหตุ (ถุงเปียกน้ำ) ในช่อง Waste · ถุงซีลรับเพิ่มเอง 50 ·
 *  「เพิ่มสินค้า」และ「แก้ชื่อ / หน่วย」ยังกดได้ · เปลี่ยนวันที่เป็นวันที่ยังไม่บันทึก ช่องเปิดให้พิมพ์ ·
 *  ด้านบนมีกล่อง「รอยืนยันรับสินค้า」ด้านล่างมี「สินทรัพย์อื่นของสาขา」 */
export const TodaySaved: Story = { ...saved };

/** กด「แก้ไขบันทึก」: ช่องกลับมาพิมพ์ได้ พร้อมค่าที่บันทึกไว้ · ปุ่มล่างเป็น「ยกเลิก」
 *  (กลับไปล็อกด้วยค่าที่บันทึกไว้) กับ「บันทึกการใช้วันนี้」(แก้ไขบันทึกเดิม ไม่ตัดสต๊อกซ้ำ แล้วล็อกอีกครั้ง) */
export const UnlockedForEdit: Story = { ...saved, play: unlock };

/** พิมพ์แล้วกด「บันทึกการใช้วันนี้」: บันทึกสำเร็จแล้วล็อกทันที ตัวเลขเป็นข้อความ
 *  ปุ่มล่างเป็น「แก้ไขบันทึก」 */
export const LockedAfterSave: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const used = (await canvas.findAllByLabelText(/^ใช้ไป/))[0];
    await userEvent.type(used, "2");
    await userEvent.click(
      canvas.getByRole("button", { name: "บันทึกการใช้วันนี้" }),
    );
    await expect(
      await canvas.findByRole("button", { name: "แก้ไขบันทึก" }),
    ).toBeEnabled();
    await expect(canvas.queryAllByLabelText(/^ใช้ไป/)).toHaveLength(0);
  },
};

/** พิมพ์ Waste มากกว่า 0: ช่อง「สาเหตุ waste」ขึ้นมาในช่อง Waste ของแถวนั้น ยังไม่พิมพ์สาเหตุเป็น
 *  「ยังไม่ได้จด」(บันทึกได้) · คงเหลือไม่ถูกหักด้วย Waste ซ้ำ */
export const WasteReason: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    // The sheet's first row under its head.
    const sheet = await canvas.findByRole("region", { name: "ใบสต๊อกรายวัน" });
    const row = within(within(sheet).getAllByRole("row")[1]);
    const left = row.getByLabelText(/^คงเหลือ/).textContent;
    await userEvent.type(row.getByLabelText(/^Waste/), "2");
    await expect(row.getByLabelText(/^สาเหตุ waste/)).toBeVisible();
    await expect(row.getByText("ยังไม่ได้จด")).toBeVisible();
    await expect(row.getByLabelText(/^คงเหลือ/)).toHaveTextContent(left!);
    await expect(canvas.getByText("ยังไม่บันทึก")).toBeVisible();
  },
};

/** ใช้ไปมากกว่าที่มี: ไม่มีการห้ามหรือเตือน คงเหลือติดลบเป็นสีแดง */
export const NegativeRemaining: Story = { ...negative };

/** บันทึกโดยไม่ใส่ผู้บันทึก และมี Waste ที่ไม่มีสาเหตุ: ทั้งสองช่องขึ้น「ยังไม่ได้จด」 */
export const MissingReporter: Story = { ...unsigned };

/** Inventory ของศาลาแดง: บนสุดคือกล่องสีเหลือง「รอยืนยันรับสินค้า」แถวละรายการที่ส่งมาแบบ
 *  「สาขาต้องกดยืนยันรับ」(วันที่ · รายการพร้อม SKU · จำนวน · คลังต้นทาง · ปุ่ม「ยืนยันรับ」) ·
 *  ใต้ใบสต๊อกคือ「สินทรัพย์อื่นของสาขา」ดูได้อย่างเดียว: ของที่ไม่ใช่วัสดุในรายการและสาขามียอดไม่เป็น 0 */
export const PendingReceipt: Story = {
  args: saladaeng,
  parameters: { db: dbFor("saladaeng") },
};

/** กด「ยืนยันรับ」: กล่องรอยืนยันรับหายไป (ไม่มีรายการค้างแล้ว) ถุงสูญญากาศขึ้นใน
 *  「สินทรัพย์อื่นของสาขา」300 และมีข้อความ「จดแล้ว: ยืนยันรับสินค้า」 */
export const ConfirmReceipt: Story = {
  ...PendingReceipt,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const others = () =>
      within(canvas.getByRole("region", { name: "สินทรัพย์อื่นของสาขา" }));
    await expect(others().queryByText("ถุงสูญญากาศ")).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: "ยืนยันรับ ถุงสูญญากาศ" }),
    );
    await waitFor(() =>
      expect(
        canvas.queryByRole("region", { name: "รอยืนยันรับสินค้า" }),
      ).toBeNull(),
    );
    const cells = within(
      others().getByRole("row", { name: /ถุงสูญญากาศ/ }),
    ).getAllByRole("cell");
    await expect(cells.at(-1)).toHaveTextContent("300");
  },
};

/** 「ตั้งสต๊อกเริ่มต้น」ที่บันทึกแล้ว เปิดมาล็อก: ตาราง สินค้า · ยอดตั้งต้น เป็นข้อความ วันที่เริ่มนับพิมพ์ไม่ได้
 *  ปุ่มล่างเป็น「แก้ไขบันทึก」 */
export const OpeningView: Story = { play: openingView };

/** 「ตั้งสต๊อกเริ่มต้น」กด「แก้ไขบันทึก」: ช่องจำนวนและวันที่กลับมาพิมพ์ได้ มี「ยกเลิก」·
 *  บันทึกอีกครั้งเป็นการแก้ยอดตั้งต้นเดิม (แก้วันที่ได้) แล้วกลับไปใบสต๊อกรายวัน */
export const OpeningUnlocked: Story = {
  play: async (context) => {
    await openingView(context);
    await unlock(context);
  },
};

/** 「ตั้งสต๊อกเริ่มต้น」ยังไม่เคยบันทึก: ช่องเปิดให้พิมพ์ ไม่มีปุ่ม「แก้ไขบันทึก」 */
export const OpeningNotSaved: Story = {
  parameters: { db: dbFor("minburi", seed) },
  play: openingView,
};

/** กด「เพิ่มสินค้า」: 「เพิ่มรายการสินค้า」ชื่อสินค้า และหน่วยนับ (พิมพ์เองหรือเลือกจากรายการ) ·
 *  ชื่อว่างหรือซ้ำ ข้อความที่เว็บไม่รับอยู่ข้างปุ่ม */
export const AddItem: Story = {
  play: async ({ canvasElement }) =>
    userEvent.click(
      await within(canvasElement).findByRole("button", { name: "เพิ่มสินค้า" }),
    ),
};

/** กด「แก้ชื่อ / หน่วย」ที่แถว: 「แก้ไขรายการสินค้า」มีชื่อและหน่วยเดิม */
export const EditItem: Story = {
  play: async ({ canvasElement }) =>
    userEvent.click(
      (
        await within(canvasElement).findAllByRole("button", {
          name: /^แก้ชื่อ \/ หน่วย/,
        })
      )[0],
    ),
};

/** Stock ของมีนบุรี วันนี้ยังไม่บันทึก: เนื้อและน้ำพริก (มีนบุรีซื้อข้าวสุก ไม่มีแถวข้าวเหนียวดิบ) ·
 *  รายการคงที่ ไม่มี「เพิ่มสินค้า」และ「แก้ชื่อ / หน่วย」 */
export const StockTodayNotSaved: Story = { args: stock };

/** Stock ยังไม่เคยตั้งสต๊อกเริ่มต้น */
export const StockNoOpening: Story = {
  args: stock,
  parameters: { db: dbFor("minburi", seed) },
};

/** Stock ของศาลาแดง บันทึกวันนี้แล้ว: มีแถว「ข้าวเหนียวดิบ」(ศาลาแดงนึ่งข้าวเอง) ·
 *  เนื้อมี Waste 0.3 กก. พร้อมสาเหตุ (เนื้อตกพื้น) */
export const StockTodaySaved: Story = {
  ...saved,
  args: { ...saladaeng, ...stock },
};

/** Stock: ใช้เนื้อมากกว่าที่มี คงเหลือติดลบเป็นสีแดง */
export const StockNegativeRemaining: Story = {
  ...negative,
  args: { ...saladaeng, ...stock },
};

/** Stock: ไม่มีผู้บันทึก และน้ำพริกมี Waste ที่ไม่มีสาเหตุ ทั้งสองช่องขึ้น「ยังไม่ได้จด」 */
export const StockMissingReporter: Story = {
  ...unsigned,
  args: { ...saladaeng, ...stock },
};

/** Stock「ตั้งสต๊อกเริ่มต้น」 */
export const StockOpeningView: Story = { args: stock, play: openingView };

/** จอ 390px ยังไม่บันทึก: ตารางเดิม เลื่อนซ้ายขวาในการ์ดเพื่อดูคอลัมน์ที่เหลือ (หน้าไม่เลื่อน) ·
 *  ปุ่มบันทึกเต็มความกว้าง */
export const Phone: Story = { ...phone };

/** จอ 390px กด「แก้ไขบันทึก」แล้ว: 「ยกเลิก」กับ「บันทึกการใช้วันนี้」อยู่แถวเดียวกัน */
export const PhoneUnlockedForEdit: Story = { ...phoneSaved, play: unlock };

/** จอ 390px ของศาลาแดง บันทึกวันนี้แล้ว (ล็อก): กล่องรอยืนยันรับเหลือ รายการ จำนวน และปุ่ม「ยืนยันรับ」·
 *  ตารางเป็นข้อความ แถวที่มี Waste มีสาเหตุใต้ตัวเลข · ปุ่ม「แก้ไขบันทึก」เต็มความกว้าง */
export const PhonePendingReceipt: Story = { ...phoneSaved };

/** จอ 390px หน้า Stock */
export const StockPhone: Story = { ...phone, args: stock };

/** จอ 390px「ตั้งสต๊อกเริ่มต้น」 */
export const PhoneOpeningView: Story = { ...phone, play: openingView };
