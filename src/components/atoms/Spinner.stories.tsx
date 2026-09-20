import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

const meta = {
  title: "Atoms/Spinner",
  component: Spinner,
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** No visible text next to it, so `label` carries the meaning for screen readers. */
export const Standalone: Story = { args: { label: "กำลังโหลดข้อมูล" } };

/** The usual case: the button text already says what is happening. */
export const InButton: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="primary" disabled icon={<Spinner />}>
        กำลังบันทึก…
      </Button>
      <Button variant="secondary" disabled icon={<Spinner />}>
        กำลังอัปโหลด…
      </Button>
    </div>
  ),
};
