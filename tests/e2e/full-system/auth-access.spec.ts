import { expect, test, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  type AccountKey,
  loadSampleData,
  menuItem,
  pointAndClick,
  sidebar,
  signInAs,
  startFresh,
  step,
  tableSection,
} from "../helpers";

/* Lane A — การเข้าสู่ระบบและสิทธิ์ (Plan §5 A1–A7). Local SQLite only:
 * sign-in is <account>@local.test with any password (src/lib/session.ts). */
test.skip(
  process.env.NEXT_PUBLIC_LOCAL_DB !== "1",
  "local sign-in (<account>@local.test) only exists in pnpm test:e2e:local",
);

/* Oracle copied verbatim from src/lib/nav.ts (tab id, label, nav order) and
 * src/lib/accounts.ts (path, name, title, branch). Kept literal on purpose so a
 * change to either file fails here instead of silently passing. */
type TabDef = [id: string, label: string];
const OWNER_TABS: TabDef[] = [
  ["owner-dashboard", "แดชบอร์ด"],
  ["po", "ใบสั่งซื้อ PO"],
  ["smoke-po", "ใบสั่ง PO โรงรมควัน"],
  ["invoices", "ใบ Invoice"],
  ["transport", "ใบขนส่ง"],
  ["central-receive", "รับเนื้อเข้าสต๊อกกลาง"],
  ["branch-status", "จัดสรรเนื้อ และสต๊อกไปสาขา"],
  ["stock", "สต๊อกของทั้งหมด"],
  ["meat-log", "Log เนื้อคงเหลือ"],
  ["documents", "เอกสารและ Traceability"],
  ["report", "รายงาน"],
  ["history", "Log"],
  ["config", "ตั้งค่า"],
];
const FOODIVA_TABS: TabDef[] = [
  ["foodiva", "PO และสต๊อก Foodiva"],
  ["history", "ประวัติ"],
];
const CHEF_TABS: TabDef[] = [
  ["cm-receive", "ยืนยันรับเนื้อ"],
  ["work", "งานผลิต"],
  ["stock", "สต๊อก"],
  ["history", "ประวัติ"],
];
const BRANCH_TABS: TabDef[] = [
  ["day", "กรอกรายวัน"],
  ["stock", "สต๊อก"],
  ["branch-summary", "สรุปสาขา"],
  ["history", "ประวัติ"],
];

type Profile = {
  actor: string;
  path: string;
  name: string;
  title: string;
  branch?: string;
  tabs: TabDef[];
};
const PROFILES: Record<AccountKey, Profile> = {
  owner: {
    actor: "Owner",
    path: "/owner",
    name: "Owner",
    title: "เจ้าของร้าน",
    tabs: OWNER_TABS,
  },
  foodiva: {
    actor: "Foodiva",
    path: "/foodiva",
    name: "Foodiva",
    title: "ผู้ขายเนื้อ · ออก Invoice",
    tabs: FOODIVA_TABS,
  },
  chef: {
    actor: "Chef House",
    path: "/chef",
    name: "Chef House",
    title: "ฝ่ายผลิต · เชียงใหม่",
    tabs: CHEF_TABS,
  },
  saladaeng: {
    actor: "สาขาศาลาแดง",
    path: "/branch",
    name: "สาขาศาลาแดง",
    title: "ผู้ดูแลสาขา",
    branch: "ศาลาแดง",
    tabs: BRANCH_TABS,
  },
  minburi: {
    actor: "สาขามีนบุรี",
    path: "/branch",
    name: "สาขามีนบุรี",
    title: "ผู้ดูแลสาขา",
    branch: "มีนบุรี",
    tabs: BRANCH_TABS,
  },
};
const ALL_ACCOUNTS = Object.keys(PROFILES) as AccountKey[];
const ALL_LABELS = [
  ...new Set(Object.values(PROFILES).flatMap((p) => p.tabs.map((t) => t[1]))),
];

/** homeTab in accounts.ts is the first nav item of every role. */
const home = (p: Profile) => `${p.path}/${p.tabs[0][0]}`;
const SIGN_IN_URL = /:\d+\/$/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** A nav label, allowing the CountPill digits the button text carries ("ตั้งค่า1"). */
const withPill = (label: string) => new RegExp(`^${escapeRe(label)}\\s*\\d*$`);

/** Sidebar nav labels in order, without the count pill digits. */
async function menuLabels(page: Page) {
  const texts = await sidebar(page)
    .locator("nav")
    .getByRole("button")
    .allTextContents();
  return texts.map((t) => t.replace(/\d+$/, "").trim());
}

/** The workspace is on `tab`: URL, aria-current in the sidebar, page h1 and
 * the overline "<account name>[ · <branch>]" (WorkspaceShell → PageHeading). */
async function expectWorkspace(page: Page, p: Profile, [id, label]: TabDef) {
  // Sign-in lands on /<role>, whose server redirect() to the home tab is compiled on
  // first hit in `next dev`; with parallel e2e lanes that alone can pass 30 s.
  await expect(page).toHaveURL(new RegExp(`${p.path}/${id}$`), {
    timeout: 90_000,
  });
  const active = sidebar(page).locator('nav button[aria-current="page"]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveText(withPill(label));
  const h1 = page.locator("main").getByRole("heading", { level: 1 });
  await expect(h1).toHaveText(label);
  // PageHeading renders <Overline/> as the <span> right before the h1. The owner
  // dashboard repeats "Owner" elsewhere in main, so anchor on that sibling.
  const overline = `${p.name}${p.branch ? ` · ${p.branch}` : ""}`;
  await expect(h1.locator("xpath=preceding-sibling::span[1]")).toHaveText(
    overline,
  );
}

async function expectSignInPage(page: Page) {
  await expect(page).toHaveURL(SIGN_IN_URL, { timeout: 30_000 });
  await expect(
    page.getByRole("heading", { name: "เข้าสู่ระบบ" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "ออกจากระบบ" })).toHaveCount(0);
  await expect(sidebar(page)).toHaveCount(0);
}

test("A1 ทั้ง 5 บัญชีเข้าสู่ระบบแล้ว landing ถูก header แสดงชื่อบัญชี/สาขา และเมนูครบตาม role ไม่มีเมนูของ role อื่น", async ({
  page,
}) => {
  await startFresh(page);
  for (const account of ALL_ACCOUNTS) {
    const p = PROFILES[account];
    await step(
      page,
      `${p.actor}: เข้าสู่ระบบ → landing ${home(p)} · header/เมนูตรงตาม role`,
      async () => {
        await signInAs(page, account);
        await expectWorkspace(page, p, p.tabs[0]);
        // แถบบนสุดคือแบรนด์ ชื่อบัญชี/สาขาอยู่ที่ sidebar และ overline ของหน้า
        await expect(page.getByRole("banner")).toContainText("NerdNuea Stock");
        const nav = sidebar(page);
        await expect(nav.getByText(p.name, { exact: true })).toBeVisible();
        await expect(nav.getByText(p.title, { exact: true })).toBeVisible();
        expect(await menuLabels(page)).toEqual(p.tabs.map((t) => t[1]));
        for (const label of ALL_LABELS) {
          if (p.tabs.some((t) => t[1] === label)) continue;
          await expect(menuItem(page, label)).toHaveCount(0);
        }
      },
    );
  }
});

test("A2 บัญชีที่ไม่มีในระบบ (nobody@local.test) ค้างหน้าเข้าสู่ระบบพร้อมข้อความ", async ({
  page,
}) => {
  await startFresh(page);
  await step(
    page,
    "ระบบ: nobody@local.test เข้าสู่ระบบ → ค้างหน้าเข้าสู่ระบบ + ข้อความโหมด local",
    async () => {
      await page.getByLabel("อีเมล").fill("nobody@local.test");
      await page.getByLabel("รหัสผ่าน").fill("local-test");
      await pointAndClick(
        page,
        page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }),
      );
      await expect(
        page.getByText(
          "โหมด local: ใช้อีเมล owner@local.test, foodiva@, chef@, saladaeng@ หรือ minburi@local.test",
          { exact: true },
        ),
      ).toBeVisible();
      await expectSignInPage(page);
    },
  );
  await step(
    page,
    "ระบบ: หลังเข้าไม่สำเร็จ เปิด /owner/po ตรง ๆ ก็ยังถูกพากลับหน้าเข้าสู่ระบบ",
    async () => {
      await page.goto("/owner/po");
      await expectSignInPage(page);
    },
  );
  // ponytail: local mode takes any password (session.ts signIn); the wrong-password
  // case only exists against Supabase and is out of this lane's scope (Plan §5 A2).
});

const CROSS: [AccountKey, string[]][] = [
  ["foodiva", ["/owner", "/chef", "/branch"]],
  ["chef", ["/owner", "/foodiva", "/branch"]],
  ["saladaeng", ["/owner", "/chef", "/foodiva"]],
  ["owner", ["/chef", "/foodiva", "/branch"]],
];

test("A3 เปิด route ของ role อื่นตรง ๆ ทุกคู่ (base และ tab ลึก) ถูกพากลับ route ตัวเอง", async ({
  page,
}) => {
  await startFresh(page);
  for (const [account, targets] of CROSS) {
    const p = PROFILES[account];
    await step(page, `${p.actor}: เข้าสู่ระบบ`, async () => {
      await signInAs(page, account);
      await expectWorkspace(page, p, p.tabs[0]);
    });
    for (const target of targets) {
      const other = Object.values(PROFILES).find((o) => o.path === target)!;
      for (const url of [target, `${target}/${other.tabs[1][0]}`]) {
        await step(
          page,
          `${p.actor}: เปิด ${url} → ถูกพากลับ ${home(p)}`,
          async () => {
            await page.goto(url);
            await expectWorkspace(page, p, p.tabs[0]);
            expect(await menuLabels(page)).toEqual(p.tabs.map((t) => t[1]));
            await expect(
              page.getByRole("heading", { name: other.tabs[0][1] }),
            ).toHaveCount(0);
          },
        );
      }
    }
  }
});

test("A4 ยังไม่เข้าสู่ระบบ เปิด /owner/po และ /branch/day (และ tab ของ role อื่น) ถูกพาไปหน้าเข้าสู่ระบบ", async ({
  page,
}) => {
  await startFresh(page);
  for (const url of [
    "/owner/po",
    "/branch/day",
    "/chef/work",
    "/foodiva/foodiva",
  ]) {
    await step(
      page,
      `ระบบ: ยังไม่เข้าสู่ระบบ เปิด ${url} → หน้าเข้าสู่ระบบ`,
      async () => {
        await page.goto(url);
        await expectSignInPage(page);
      },
    );
  }
});

test("A5 ออกจากระบบแล้วไปหน้าเข้าสู่ระบบ กด back ไม่กลับเข้า workspace", async ({
  page,
}) => {
  await startFresh(page);
  await step(page, "Owner: เข้าสู่ระบบแล้วเปิด tab ใบสั่งซื้อ PO", async () => {
    await signInAs(page, ACCOUNTS.owner);
    // router.push → มี history entry ของ workspace ให้ back กลับไปหาได้จริง
    await pointAndClick(page, menuItem(page, "ใบสั่งซื้อ PO"));
    await expectWorkspace(page, PROFILES.owner, ["po", "ใบสั่งซื้อ PO"]);
  });
  await step(page, "Owner: ออกจากระบบ → หน้าเข้าสู่ระบบ", async () => {
    await pointAndClick(page, page.getByRole("button", { name: "ออกจากระบบ" }));
    await expectSignInPage(page);
  });
  await step(
    page,
    "ระบบ: กด back → ยังอยู่หน้าเข้าสู่ระบบ ไม่เห็น workspace",
    async () => {
      await page.goBack();
      await expectSignInPage(page);
    },
  );
  await step(
    page,
    "ระบบ: เปิด /owner/owner-dashboard หลังออกจากระบบ → หน้าเข้าสู่ระบบ",
    async () => {
      await page.goto("/owner/owner-dashboard");
      await expectSignInPage(page);
    },
  );
});

test("A6 deep link ทุก tab ของทุก role เปิดได้ sidebar ไฮไลต์ถูก และ reload แล้วยังอยู่ tab เดิม", async ({
  page,
}) => {
  await startFresh(page);
  for (const account of ["owner", "foodiva", "chef", "saladaeng"] as const) {
    const p = PROFILES[account];
    await step(page, `${p.actor}: เข้าสู่ระบบ`, () => signInAs(page, account));
    for (const tab of p.tabs) {
      await step(
        page,
        `${p.actor}: deep link ${p.path}/${tab[0]} → "${tab[1]}" ไฮไลต์ · reload ยังอยู่`,
        async () => {
          await page.goto(`${p.path}/${tab[0]}`);
          await expectWorkspace(page, p, tab);
          await page.reload();
          await expectWorkspace(page, p, tab);
        },
      );
    }
  }
});

test("A6 tab ที่ไม่มี (/owner/nope) ตอบ 404 ไม่แสดง workspace", async ({
  page,
}) => {
  await startFresh(page);
  await step(page, "Owner: เข้าสู่ระบบ", () => signInAs(page, ACCOUNTS.owner));
  await step(
    page,
    "Owner: เปิด /owner/nope → 404 ของ Next (dynamicParams=false) ไม่มี sidebar",
    async () => {
      const response = await page.goto("/owner/nope");
      expect(response?.status()).toBe(404);
      await expect(page).toHaveURL(/\/owner\/nope$/);
      await expect(
        page.getByRole("heading", { name: "This page could not be found." }),
      ).toBeVisible();
      await expect(sidebar(page)).toHaveCount(0);
    },
  );
});

test("A7 saladaeng กับ minburi เห็นชื่อสาขาตัวเองบน header และสรุปสาขาไม่ปนกัน (7-day sample)", async ({
  page,
}) => {
  await startFresh(page);
  await step(page, "ระบบ: โหลดข้อมูลตัวอย่าง 7 วัน", () =>
    loadSampleData(page),
  );

  const summaries: Partial<Record<AccountKey, string>> = {};
  for (const account of ["saladaeng", "minburi"] as const) {
    const p = PROFILES[account];
    const other = account === "saladaeng" ? "มีนบุรี" : "ศาลาแดง";
    await step(
      page,
      `${p.actor}: เข้าสู่ระบบ → header "${p.name} · ${p.branch}"`,
      async () => {
        await signInAs(page, account);
        await expectWorkspace(page, p, p.tabs[0]);
        await expect(page.locator("main")).toContainText(`สาขา ${p.branch}`);
        await expect(page.locator("main")).not.toContainText(other);
      },
    );
    await step(
      page,
      `${p.actor}: สรุปสาขา เป็นตัวเลขของ ${p.branch} เท่านั้น`,
      async () => {
        await pointAndClick(page, menuItem(page, "สรุปสาขา"));
        await expectWorkspace(page, p, ["branch-summary", "สรุปสาขา"]);
        const table = tableSection(
          page,
          new RegExp(`^สรุปรายวัน · \\d{4}-\\d{2}-\\d{2} · ${p.branch}$`),
        );
        await expect(table).toBeVisible();
        const row = (label: string) =>
          table.getByRole("row").filter({ hasText: label });
        // roleplay(): Owner จัดสรรน้ำพริก 20 หลอด/วัน × 7 วัน ให้ทุกสาขา
        await expect(row("น้ำพริกที่ Owner จัดสรร")).toContainText("140");
        if (account === "saladaeng") {
          // ซื้อข้าวดิบ 5 กก./วัน เบิก 3 กก./วัน หุงหมดทุกวัน → 35 − 21 = 14 · เบิกค้าง 0
          await expect(row("ข้าวเหนียวดิบคงเหลือ")).toContainText("14.00");
          await expect(row("ข้าวเหนียวดิบที่เบิกแล้วยังไม่หุง")).toContainText(
            "0.00",
          );
          await expect(table).not.toContainText("ข้าวเหนียวสุกที่ควรซื้อเพิ่ม");
        } else {
          await expect(row("ข้าวเหนียวสุกที่ควรซื้อเพิ่ม")).toBeVisible();
          await expect(table).not.toContainText("ข้าวเหนียวดิบคงเหลือ");
        }
        await expect(page.locator("main")).not.toContainText(other);
        summaries[account] = await table.innerText();
      },
    );
  }
  await step(page, "ระบบ: สรุปสาขาของสองสาขาไม่เหมือนกัน", async () => {
    expect(summaries.saladaeng).toBeTruthy();
    expect(summaries.saladaeng).not.toBe(summaries.minburi);
  });
});
