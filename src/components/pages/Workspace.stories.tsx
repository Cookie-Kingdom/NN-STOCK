import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import {
  dbFor,
  phone,
  sampleDb,
} from "@/components/organisms/workspace/storyWorkspace";
import { accountById } from "@/lib/accounts";
import { Workspace } from "./Workspace";

const meta = {
  title: "Pages/Workspace",
  component: Workspace,
  tags: ["!autodocs"],
  args: { account: accountById("owner")! },
  argTypes: { account: { control: false } },
  parameters: {
    db: sampleDb,
    layout: "fullscreen",
    nextjs: { navigation: { pathname: "/owner/nn-x-lm/daily-log" } },
  },
} satisfies Meta<typeof Workspace>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Owner ที่หน้า Daily Log · หน้าที่แสดงมาจาก URL (`/owner/nn-x-lm/daily-log`) ใน Storybook จึงอยู่หน้าเดิม
 *  การกดเมนูเห็นได้ใน Actions */
export const Owner: Story = {};

/** Account Manager: เปิด `/owner/overview` ก็ได้หน้าแรกของตัวเอง (Daily Log) */
export const Manager: Story = {
  args: { account: accountById("manager")! },
  parameters: {
    db: dbFor("manager"),
    nextjs: { navigation: { pathname: "/owner/overview" } },
  },
};

/** สาขาศาลาแดง */
export const Branch: Story = {
  args: { account: accountById("saladaeng")! },
  parameters: { db: dbFor("saladaeng") },
};

/** สาขา จอ 390px */
export const BranchPhone: Story = { ...Branch, ...phone };
