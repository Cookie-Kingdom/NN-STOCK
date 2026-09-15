import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  Banknote,
  Boxes,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { KpiCard } from "./KpiCard";

const meta = {
  title: "Molecules/KpiCard",
  component: KpiCard,
  args: {
    tone: "sales",
    icon: <Banknote size={17} />,
    label: "ยอดขายวันนี้",
    value: "฿48,250",
    caption: "+12% จากเมื่อวาน",
    captionTone: "gain",
  },
  argTypes: {
    tone: {
      control: "select",
      options: ["sales", "cost", "positive", "negative", "boxes"],
    },
    captionTone: {
      control: "inline-radio",
      options: [undefined, "gain", "loss"],
    },
  },
} satisfies Meta<typeof KpiCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Sales: Story = {
  decorators: [
    (Story) => (
      <div className="max-w-xs">
        <Story />
      </div>
    ),
  ],
};

export const Row: Story = {
  decorators: [
    (Story) => (
      <div className="w-[64rem] max-w-full">
        <Story />
      </div>
    ),
  ],
  render: () => (
    <div className="grid grid-cols-4 gap-4 max-md:grid-cols-1">
      <KpiCard
        tone="sales"
        icon={<Banknote size={17} />}
        label="ยอดขาย"
        value="฿48,250"
      />
      <KpiCard
        tone="cost"
        icon={<Wallet size={17} />}
        label="ต้นทุน"
        value="฿21,400"
      />
      <KpiCard
        tone="positive"
        icon={<TrendingUp size={17} />}
        label="กำไร"
        value="฿26,850"
        caption="+8.1%"
        captionTone="gain"
      />
      <KpiCard
        tone="negative"
        icon={<TrendingDown size={17} />}
        label="ของเสีย"
        value="3.2 กก."
        caption="สูงกว่าเป้า"
        captionTone="loss"
      />
      <KpiCard
        tone="boxes"
        icon={<Boxes size={17} />}
        label="กล่องคงเหลือ"
        value="126"
      />
    </div>
  ),
};
