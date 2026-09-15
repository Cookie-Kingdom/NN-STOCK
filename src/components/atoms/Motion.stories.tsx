import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { Button } from "./Button";

/** Motion tokens live in `styles/tokens.css`. All motion is cut to 1ms under
 * `prefers-reduced-motion: reduce` (globals.css), so components need no
 * `motion-reduce:` classes. */
const meta = {
  title: "Atoms/Motion",
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const tokens = [
  ["--motion-fast", "120ms", "กด, เปลี่ยนสีตอน hover"],
  ["--motion-base", "200ms", "popover, toast, เฟดเนื้อหา"],
  ["--motion-slow", "320ms", "dialog, แถบความคืบหน้า"],
  ["--ease-enter", "cubic-bezier(0.16, 1, 0.3, 1)", "เข้า (ชะลอตอนจบ)"],
  ["--ease-exit", "cubic-bezier(0.4, 0, 1, 1)", "ออก (เร่งตอนจบ)"],
  ["--ease-standard", "cubic-bezier(0.2, 0, 0, 1)", "เปลี่ยนสถานะทั่วไป"],
] as const;

export const Tokens: Story = {
  render: () => (
    <table className="text-body-sm">
      <tbody>
        {tokens.map(([name, value, use]) => (
          <tr key={name} className="border-b">
            <td className="py-2 pr-4 font-mono">{name}</td>
            <td className="py-2 pr-4 font-mono tabular-nums">{value}</td>
            <td className="py-2 text-text-secondary">{use}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

const animations = ["animate-fade-in", "animate-fade-up", "animate-scale-in"];

/** Click to replay — the key change re-mounts each box. */
export const Animations: Story = {
  render: function Render() {
    const [run, setRun] = useState(0);
    return (
      <div className="grid gap-4">
        <Button
          className="justify-self-start"
          onClick={() => setRun((n) => n + 1)}
        >
          เล่นอีกครั้ง
        </Button>
        <div className="flex flex-wrap gap-4">
          {animations.map((cls) => (
            <div
              key={`${cls}-${run}`}
              className={`${cls} grid h-24 w-40 place-items-center rounded-md border bg-surface font-mono text-caption`}
            >
              {cls}
            </div>
          ))}
        </div>
      </div>
    );
  },
};
