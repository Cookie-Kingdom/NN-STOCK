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

/** The workspace content area while the database payload is loading. */
export const Panel: Story = {};

export const PanelLongTable: Story = {
  args: { message: "กำลังโหลดรายการล็อต…", rows: 9 },
};

export const Screen: StoryObj = {
  render: () => <LoadingScreen message="กำลังตรวจสอบสิทธิ์การใช้งาน…" />,
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

export const Blocks: StoryObj = {
  render: () => (
    <div className="grid max-w-125 gap-2.5">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-11" />
      <Skeleton className="h-11" />
    </div>
  ),
};
