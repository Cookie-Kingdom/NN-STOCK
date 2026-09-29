import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import { Pagination } from "./Pagination";

const meta = {
  title: "Molecules/Pagination",
  component: Pagination,
  argTypes: {
    page: {
      control: { type: "number", min: 0, step: 1 },
      description: "0-based",
    },
    pageCount: {
      control: { type: "number", min: 0, step: 1 },
      description: "1 or less renders nothing",
    },
    pageSize: { control: { type: "number", min: 1, step: 1 } },
  },
  args: { page: 0, pageCount: 5, pageSize: 20, onPage: fn() },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Driven straight by Controls: page 0 disables "ก่อนหน้า", the last page disables
 *  "ถัดไป", pageCount ≤ 1 hides the whole row. Clicks show in Actions. */
export const Default: Story = {};

function Stateful(args: Story["args"]) {
  const [page, setPage] = useState(0);
  return (
    <Pagination
      pageCount={args?.pageCount ?? 5}
      pageSize={args?.pageSize ?? 20}
      page={page}
      onPage={setPage}
    />
  );
}

/** Clicking actually moves the page (local state; the `page` control is ignored). */
export const Interactive: Story = {
  argTypes: { page: { control: false } },
  render: (args) => <Stateful {...args} />,
};
