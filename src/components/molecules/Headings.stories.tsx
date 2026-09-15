import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { ChartPanel } from "./ChartPanel";
import { PanelHeading } from "./PanelHeading";
import { SectionHeading } from "./SectionHeading";

const meta = {
  title: "Molecules/Headings",
  component: PanelHeading,
  args: {
    overline: "ตั้งค่า",
    title: "ราคาและต้นทุน",
    description:
      "กำหนดราคาเนื้อดิบ ค่ารมควัน และค่าขนส่งที่ใช้คำนวณต้นทุนต่อล็อต",
    aside: <Button variant="primary">บันทึกการตั้งค่า</Button>,
  },
} satisfies Meta<typeof PanelHeading>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Panel: Story = {};

export const Section: Story = {
  render: () => (
    <SectionHeading
      title="รายการล็อต"
      description="ล็อตที่ยังไม่ปิด 4 รายการ"
      actions={<Button variant="secondary">ส่งออก</Button>}
    />
  ),
};

export const Chart: Story = {
  render: () => (
    <div className="grid max-w-3xl gap-4">
      <ChartPanel overline="รายวัน" title="ยอดขายสาขา" total="฿48,250">
        <div className="mt-4 h-32 rounded-md bg-surface-sunken" />
      </ChartPanel>
      <ChartPanel
        overline="สต๊อก"
        title="คงเหลือสต๊อกกลาง"
        total="84.2 กก."
        totalTone="accent"
      >
        <div className="mt-4 h-32 rounded-md bg-surface-sunken" />
      </ChartPanel>
    </div>
  ),
};
