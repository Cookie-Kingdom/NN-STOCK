import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Panel } from "@/components/atoms/Panel";
import { ShowMore, useShowMore } from "./ShowMore";

const items = Array.from({ length: 47 }, (_, i) => `รายการที่ ${i + 1}`);

/** A list of 47 rows, 20 at a time. */
const Rows = () => {
  const { limit, more } = useShowMore();
  return (
    <Panel flush className="max-w-105 overflow-hidden">
      <ul className="m-0 list-none p-0">
        {items.slice(0, limit).map((item) => (
          <li
            key={item}
            className="border-b border-border px-5 py-2 text-body-sm last:border-b-0"
          >
            {item}
          </li>
        ))}
      </ul>
      <ShowMore shown={limit} total={items.length} onMore={more} />
    </Panel>
  );
};

const meta = {
  title: "Molecules/ShowMore",
  component: ShowMore,
  args: { shown: 20, total: 47, onMore: () => {} },
} satisfies Meta<typeof ShowMore>;

export default meta;
type Story = StoryObj<typeof meta>;

/** ปุ่มใต้ตารางยาว: บอกจำนวนแถวที่ยังไม่ได้แสดง */
export const Default: Story = {};

/** กดแล้วแถวเพิ่มทีละ 20 พอครบทุกแถวปุ่มหายไป */
export const InList: Story = { render: () => <Rows /> };
