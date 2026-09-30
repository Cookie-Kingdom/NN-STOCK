import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Button } from "./Button";
import { Spinner } from "./Spinner";

/** `context` is story-only: where the spinner sits. */
type Args = Parameters<typeof Spinner>[0] & {
  context: "standalone" | "button";
};

const meta = {
  title: "Atoms/Spinner",
  component: Spinner,
  argTypes: {
    context: {
      control: "inline-radio",
      options: ["standalone", "button"],
      labels: { standalone: "เดี่ยว", button: "ในปุ่ม" },
    },
    label: { control: "text" },
    className: { control: "text" },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/** Pick the state in Controls:
 *  - `context=standalone`: no visible text next to it, so `label` carries the
 *    meaning for screen readers (sr-only)
 *  - `context=button`: the usual case — the button text says what is happening,
 *    so `label` is left empty
 *  - `className`: e.g. `size-6 text-accent` for a bigger, coloured spinner */
export const Default: Story = {
  args: { context: "standalone", label: "กำลังโหลดข้อมูล", className: "" },
  render: ({ context, ...args }) =>
    context === "button" ? (
      <Button variant="primary" disabled icon={<Spinner {...args} />}>
        กำลังบันทึก…
      </Button>
    ) : (
      <Spinner {...args} />
    ),
};
