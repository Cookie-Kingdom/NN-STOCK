import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { pick } from "../../../.storybook/pick";
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

const total = pick("total", {
  "฿48,250": "฿48,250",
  "84.2 กก.": "84.2 กก.",
  "฿312 / กก.": "฿312 / กก.",
  ไม่มี: undefined,
});
const aside = pick("aside", {
  ไม่มี: undefined,
  "Badge ต่ำกว่าเป้า": <Badge tone="success">ต่ำกว่าเป้า</Badge>,
});

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
    overline: { control: "text" },
    title: { control: "text" },
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

/** Pick the state in Controls:
 *  - `totalTone="warning"` (default): the figure sits in the warning pill
 *  - `totalTone="accent"`: for stock figures, which are not a money warning (the
 *    stand-in bars follow the tone)
 *  - `total` ไม่มี: the heading keeps the full width
 *  - `aside`: a legend or a status next to the heading, before the total */
export const Default: Story = {
  argTypes: { total: total.argType, aside: aside.argType },
  args: { totalTone: "warning", total: total.initial, aside: aside.initial },
  render: (args) => (
    <ChartPanel {...args}>
      <Bars tone={args.totalTone} />
    </ChartPanel>
  ),
};
