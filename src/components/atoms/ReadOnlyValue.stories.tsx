import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Input } from "./Input";
import { ReadOnlyValue } from "./ReadOnlyValue";

/** `locked` is story-only: the table swaps its Input for ReadOnlyValue once locked. */
type Args = Parameters<typeof ReadOnlyValue>[0] & { locked: boolean };

const meta = {
  title: "Atoms/ReadOnlyValue",
  component: ReadOnlyValue,
  argTypes: {
    children: { control: "text" },
    locked: { control: "boolean" },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/** Pick the state in Controls:
 *  - `locked=true`: the figure as plain text (the table is locked)
 *  - `locked=false`: the editable table Input it replaces, for comparison
 *  - `children`: the figure, e.g. "12.50" */
export const Default: Story = {
  args: { children: "12.50", locked: true },
  render: ({ locked, children }) => (
    <div className="flex items-center gap-3 text-body-sm">
      <span className="text-text-secondary">เนื้อสไลด์</span>
      {locked ? (
        <ReadOnlyValue>{children}</ReadOnlyValue>
      ) : (
        <Input
          key={String(children)}
          variant="table"
          defaultValue={String(children ?? "")}
        />
      )}
    </div>
  ),
};
