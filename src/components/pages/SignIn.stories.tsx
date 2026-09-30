import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { accountById } from "@/lib/accounts";
import {
  MockSession,
  type SessionState,
} from "../../../.storybook/mocks/session";
import { SignIn } from "./SignIn";

type Session = "loading" | "signedOut" | "error" | "signedIn";

const sessions: Record<Session, SessionState> = {
  loading: { ready: false, account: null, error: "" },
  signedOut: { ready: true, account: null, error: "" },
  error: {
    ready: true,
    account: null,
    error: "บัญชีนี้ถูกปิดใช้งาน ติดต่อ Owner",
  },
  signedIn: { ready: true, account: accountById("owner"), error: "" },
};

/** Pick เซสชัน in Controls:
 *  - กำลังตรวจสอบ: the session check is not back yet; the button waits with a spinner.
 *  - ยังไม่เข้าสู่ระบบ: the ready form. Submit `owner@…` (any account id) to log `signIn`
 *    in Actions; any other email shows the sign-in error under the fields.
 *  - ข้อผิดพลาด: the session check itself failed (e.g. an inactive profile).
 *  - เข้าสู่ระบบแล้ว: redirects to the account's workspace (router.replace in Actions). */
const meta = {
  title: "Pages/SignIn",
  component: SignIn,
  parameters: { layout: "fullscreen" },
  argTypes: {
    session: {
      name: "เซสชัน",
      options: Object.keys(sessions),
      control: {
        type: "radio",
        labels: {
          loading: "กำลังตรวจสอบ",
          signedOut: "ยังไม่เข้าสู่ระบบ",
          error: "ข้อผิดพลาด",
          signedIn: "เข้าสู่ระบบแล้ว",
        },
      },
    },
  },
  args: { session: "signedOut" },
  decorators: [
    (Story, { args }) => (
      <MockSession value={sessions[args.session]}>
        <Story />
      </MockSession>
    ),
  ],
  render: () => <SignIn />,
} satisfies Meta<{ session: Session }>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
