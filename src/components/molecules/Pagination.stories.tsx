import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Pagination } from "./Pagination";

const meta = {
  title: "Molecules/Pagination",
  component: Pagination,
  args: { page: 0, pageCount: 5, pageSize: 20, onPage: () => {} },
} satisfies Meta<typeof Pagination>;

export default meta;
type Story = StoryObj<typeof meta>;

function Interactive(args: Story["args"]) {
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

export const Default: Story = { render: (args) => <Interactive {...args} /> };
