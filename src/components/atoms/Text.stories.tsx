import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Caption, Footnote, Muted } from "./Text";

type Args = {
  variant: "Caption" | "Muted" | "Footnote";
  as: "default" | "span";
  children: string;
};

const meta = {
  title: "Atoms/Text",
  argTypes: {
    variant: {
      control: "inline-radio",
      options: ["Caption", "Muted", "Footnote"],
    },
    as: {
      control: "inline-radio",
      options: ["default", "span"],
      labels: { default: "(default: small / p)", span: "span" },
    },
    children: { control: "text" },
  },
} satisfies Meta<Args>;

export default meta;
type Story = StoryObj<Args>;

/** Pick the state in Controls:
 *  - `variant=Caption`: small hint under a field or in a table cell (`<small>`)
 *  - `variant=Muted`: secondary paragraph under a heading (`<p>`)
 *  - `variant=Footnote`: closing note under a panel, gap above built in (`<p>`,
 *    ignores `as`)
 *  - `as=span`: Caption/Muted inline, inside a sentence — the preview wraps it in
 *    one so the difference shows */
export const Default: Story = {
  args: {
    variant: "Caption",
    as: "default",
    children: "บรรทัดเล็กใต้ฟิลด์หรือในช่องตาราง",
  },
  render: ({ variant, as, children }) => {
    if (variant === "Footnote") return <Footnote>{children}</Footnote>;
    const Tag = variant === "Caption" ? Caption : Muted;
    if (as === "span")
      return (
        <p>
          ข้อความปกติ <Tag as="span">{children}</Tag> ต่อท้าย
        </p>
      );
    return <Tag>{children}</Tag>;
  },
};
