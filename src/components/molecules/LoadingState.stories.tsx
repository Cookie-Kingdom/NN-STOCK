import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { LoadingPanel, LoadingScreen, Skeleton } from "./LoadingState";

const meta = {
  title: "Molecules/LoadingState",
  component: LoadingPanel,
} satisfies Meta<typeof LoadingPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The workspace content area while the database payload is loading. Pick in
 *  Controls:
 *  - `message`: e.g. "กำลังโหลดรายการล็อต…"
 *  - `rows`: skeleton rows, e.g. 9 for a long table */
export const Panel: Story = {
  argTypes: {
    message: { control: "text" },
    rows: { control: { type: "number", min: 1, max: 20 } },
  },
};

/** Whole-page wait (session check, first paint). Edit `message` in Controls. */
export const Screen: StoryObj<typeof LoadingScreen> = {
  argTypes: { message: { control: "text" } },
  args: { message: "กำลังตรวจสอบสิทธิ์การใช้งาน…" },
  render: (args) => <LoadingScreen {...args} />,
};

/** Busy buttons: the spinner sits in front of the label, which never changes width. */
export const BusyButtons: StoryObj = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2.5">
      <Button variant="primary" disabled icon={<Spinner />}>
        กำลังบันทึก…
      </Button>
      <Button variant="secondary" disabled icon={<Spinner />}>
        กำลังโหลด
      </Button>
      <Button variant="table" disabled icon={<Spinner />}>
        กำลังเปิด
      </Button>
    </div>
  ),
};

/** Bare `Skeleton` blocks; it has no size of its own, so `className` sets it (edit
 *  the first block's in Controls). */
export const Blocks: StoryObj<typeof Skeleton> = {
  argTypes: { className: { control: "text" } },
  args: { className: "h-5 w-40" },
  render: ({ className }) => (
    <div className="grid max-w-125 gap-2.5">
      <Skeleton className={className} />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
    </div>
  ),
};
