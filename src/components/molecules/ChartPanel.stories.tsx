import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Badge } from "@/components/atoms/Badge";
import { cn } from "@/lib/utils";
import { ChartPanel } from "./ChartPanel";

const week = [
  { day: "จ.", height: 46 },
  { day: "อ.", height: 72 },
  { day: "พ.", height: 38 },
  { day: "พฤ.", height: 84 },
  { day: "ศ.", height: 61 },
  { day: "ส.", height: 93 },
  { day: "อา.", height: 55 },
];

/** Stand-in for the real chart, so the story shows the panel and not the library. */
function Bars({ tone = "warning" }: { tone?: "warning" | "accent" }) {
  return (
    <div className="mt-5 flex h-32 items-end gap-2">
      {week.map(({ day, height }) => (
        <div key={day} className="flex flex-1 flex-col items-center gap-1.5">
          <div
            className={cn(
              "w-full rounded-sm",
              tone === "accent" ? "bg-accent/25" : "bg-warning/25",
            )}
            style={{ height: `${height}%` }}
          />
          <span className="text-caption text-text-secondary">{day}</span>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: "Molecules/ChartPanel",
  component: ChartPanel,
  args: {
    overline: "รายสัปดาห์",
    title: "ยอดขายสาขาศาลาแดง",
    total: "฿48,250",
    children: <Bars />,
  },
  argTypes: {
    totalTone: { control: "inline-radio", options: ["warning", "accent"] },
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChartPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Default `totalTone="warning"`: the figure sits in the warning pill. */
export const WithTotal: Story = {};

/** `totalTone="accent"` for stock figures, which are not a money warning. */
export const AccentTotal: Story = {
  args: {
    overline: "สต๊อกกลาง",
    title: "คงเหลือเนื้อรมควัน",
    total: "84.2 กก.",
    totalTone: "accent",
    children: <Bars tone="accent" />,
  },
};

/** No `total` — the heading keeps the full width. */
export const NoTotal: Story = {
  args: {
    overline: "เปรียบเทียบสาขา",
    title: "น้ำหนักรับเข้า ศาลาแดง / มีนบุรี",
    total: undefined,
  },
};

/** `aside` puts a legend or a status next to the heading, before the total. */
export const WithAside: Story = {
  args: {
    overline: "ต้นทุนต่อล็อต",
    title: "ต้นทุนเนื้อดิบเฉลี่ย",
    total: "฿312 / กก.",
    aside: <Badge tone="success">ต่ำกว่าเป้า</Badge>,
  },
};
