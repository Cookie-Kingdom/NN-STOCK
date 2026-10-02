import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  ACCOUNTS,
  BATCH_ID,
  MISSING,
  NO_LOT,
  PO_ID,
  SCREENS,
  bangkokDate,
  expectWarning,
  field,
  idsOnScreen,
  logRow,
  lotSelect,
  menuItem,
  openBranchTask,
  openMenu,
  pointAndClick,
  saveEntry,
  sidebar,
  signInAs,
  startFresh,
  step,
  tableRow,
  tableSection,
  toast,
  topDialog,
  typeValue,
} from "./helpers";

/* The note-taking UI (vault: Features/Note Taking UX/Checklist, card "UI เป็นสมุดจด"): the
 * screens are a notebook, not a workflow. 「จดบันทึก」 in the header opens any note from any
 * tab, the lot is a field of the note, 「บันทึกและจดต่อ」 keeps the form open for the next
 * one, and a branch reads what it noted under 「จดแล้ววันนี้」. Nothing waits on anything. */

/** One note of the Owner's chooser and what its form is like when opened from there. */
type Note = {
  title: string;
  /** The form's "Lot" field: `free` starts on "ไม่ระบุ Lot" (saving opens a new batch,
   *  PSM-46), `required` offers no such choice (PSM-47). Absent: the form has no such field. */
  lot?: "free" | "required";
  /** A form with no 「บันทึกและจดต่อ」 (PSM-49). */
  single?: true;
  /** Something only this form says. */
  shows?: string;
};

const OWNER_NOTES: [group: string, notes: Note[]][] = [
  [
    "ซื้อ",
    [
      { title: "สร้าง PO เนื้อ" },
      { title: "ออกและอัปโหลด Invoice เนื้อ", lot: "required" },
      { title: "บันทึกซื้อวัสดุเข้าคลัง Owner", single: true },
      { title: "บันทึกการซื้ออื่น ๆ", single: true },
    ],
  ],
  [
    "ผลิต",
    [
      {
        title: "ออก PO รมควันเนื้อ",
        single: true,
        shows: "ชุดใหม่ (ระบบออกเลขที่การส่งให้)",
      },
      { title: "ยืนยันรับ PO รมควัน", lot: "required" },
      {
        title: "ยืนยันรับเนื้อที่ Chef House",
        single: true,
        shows: "เปิดชุดใหม่ ระบบออกเลขที่การส่งให้เมื่อบันทึก",
      },
      { title: "น้ำหนักก่อนสโมค", lot: "free" },
      { title: "บันทึก Lot สโมครายวัน", lot: "free" },
      { title: "ยืนยันปิด Lot", lot: "free" },
    ],
  ],
  [
    "ขนส่ง / รับเข้า",
    [
      {
        title: "ทำใบขนส่งขาไป",
        single: true,
        shows: "Foodiva · ชุดใหม่",
      },
      { title: "สร้าง Packing List", single: true },
      { title: "เรียกรถขากลับ", lot: "free" },
      { title: "ยืนยันรับเข้าตู้ที่ Foodiva", lot: "free" },
      { title: "รับเข้าสต๊อกกลาง", lot: "free" },
      { title: "รับเนื้อส่วนที่เหลือจาก Foodiva", lot: "required" },
    ],
  ],
  [
    "เงิน",
    [
      { title: "ชำระ Invoice เนื้อ Foodiva", lot: "required" },
      {
        title: "สร้าง / Submit ใบวางบิลค่ารมควัน",
        lot: "free",
        // SVC-01: a note with no lot opens a batch that has no smoke PO to bill by.
        shows: "น้ำหนักที่คิดค่ารมควัน (กก.)",
      },
      { title: "ตรวจยอด Invoice ค่ารมควัน", lot: "required" },
      { title: "ชำระ Invoice ค่ารมควัน", lot: "free" },
      { title: "ค่าใช้จ่าย Owner" },
    ],
  ],
  ["ประจำวัน", [{ title: "ปลดล็อกวัน", single: true }]],
];

const BRANCH_NOTES: [group: string, notes: (string | RegExp)[]][] = [
  ["ซื้อ", ["ซื้อข้าวเหนียวเข้าสต๊อก"]],
  ["รับเข้า", ["รับของเข้าสาขา", "รับวัสดุเข้าสาขา", "รับน้ำพริกเข้าสาขา"]],
  [
    "สต๊อก / วัตถุดิบ",
    [
      "แบ่งละลายเนื้อ",
      "เบิกข้าวเหนียวดิบวันนี้",
      "ข้าวเหนียวช่วงเช้า",
      "ยืนยันข้าวเหนียวสุกคงเหลือ",
      /^เช็ควัสดุ \d+ รายการ$/,
    ],
  ],
  [
    "ขาย / ประจำวัน",
    ["บันทึกยอดขาย / Waste", "อินฟลูเอนเซอร์", "ยืนยันปิดวัน"],
  ],
];

const OWNER_TABS = [
  "แดชบอร์ด",
  "ใบสั่งซื้อ PO",
  "ใบสั่ง PO โรงรมควัน",
  "ใบ Invoice",
  "Invoice เนื้อ · ใบขนส่ง · รับเข้าตู้",
  "ชั่งรับเนื้อ",
  "ผลิต · สโมค · Invoice ค่ารม",
  "ใบขนส่งขาไป",
  "เรียกรถขากลับ",
  "รับเนื้อเข้าสต๊อกกลาง",
  "สต๊อกเนื้อสาขา",
  "สต๊อกของทั้งหมด",
  "Log เนื้อคงเหลือ",
  "เอกสารและ Traceability",
  "รายงาน",
  "Log",
  "ตั้งค่า",
];
const BRANCH_TABS = [
  "จดรายวัน",
  "รับวัสดุ",
  "ตรวจนับสต๊อกวัสดุวันนี้",
  "ข้าวเหนียววันนี้",
  "สต๊อก",
  "สรุปคงเหลือเนื้อ รายวัน / รายล็อต",
  "สรุปสาขา",
  "ประวัติ",
];

const MORE = "บันทึกและจดต่อ";

/** What a save says: `savedMessage` in WorkspaceModals (a space after a Latin word). */
const saved = (title: string) =>
  `${title}${/[A-Za-z0-9.)]$/.test(title) ? " " : ""}แล้ว`;

/** 「จดบันทึก」, in the workspace header. */
function noteButton(page: Page) {
  return page
    .getByRole("banner")
    .getByRole("button", { name: "จดบันทึก", exact: true });
}

/** The page title: the tab the user is on. */
function tabTitle(page: Page) {
  return page.getByRole("heading", { level: 1 });
}

/** The title in the header of the dialog on top (a form has headings of its own below). */
function dialogTitle(page: Page) {
  return topDialog(page).locator(":scope > header h2");
}

/** Opens the chooser and picks `note`: its form takes the chooser's place. */
async function pickNote(page: Page, note: string | RegExp) {
  await pointAndClick(page, noteButton(page));
  await pointAndClick(
    page,
    topDialog(page).getByRole("button", { name: note, exact: true }),
  );
}

/** The open chooser lists exactly these groups, and in each exactly these notes, in this
 *  order. The texts are compared whole, so a numbered group or note would fail. */
async function expectChooser(
  page: Page,
  groups: [group: string, notes: (string | RegExp)[]][],
) {
  const chooser = topDialog(page);
  await expect(dialogTitle(page)).toHaveText("จดบันทึก");
  await expect(chooser).toContainText(
    "เลือกเรื่องที่จะจด · จดเรื่องไหนเมื่อไรก็ได้",
  );
  await expect(chooser.getByRole("heading", { level: 3 })).toHaveText(
    groups.map(([group]) => group),
  );
  for (const [group, notes] of groups)
    await expect(
      chooser
        .locator("section")
        .filter({
          has: page.getByRole("heading", { name: group, exact: true }),
        })
        .getByRole("button"),
    ).toHaveText(notes);
}

/** Every tab of the signed-in workspace carries 「จดบันทึก」 in its header. */
async function expectNoteButtonOnEveryTab(page: Page, tabs: string[]) {
  await expect(
    sidebar(page).getByRole("navigation").getByRole("button"),
  ).toHaveCount(tabs.length);
  for (const tab of tabs) {
    await menuItem(page, tab).click();
    await expect(tabTitle(page)).toHaveText(tab);
    await expect(noteButton(page)).toBeEnabled();
  }
}

/** The "Lot" field a batch or purchase-PO note has when it is opened with no lot. */
function noteLot(page: Page) {
  return topDialog(page).getByRole("combobox", { name: /^Lot/ });
}

const moreButton = (page: Page) =>
  topDialog(page).getByRole("button", { name: MORE, exact: true });

/** 「บันทึกและจดต่อ」: the entry is saved and the same form is back, fresh, saying so. */
async function saveAndKeepNoting(page: Page, title: string) {
  await pointAndClick(page, moreButton(page));
  await expect(
    topDialog(page)
      .getByRole("status")
      .filter({ hasText: `${saved(title)} · จดรายการใหม่ได้เลย` }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(1);
  await expect(dialogTitle(page)).toHaveText(title);
}

async function closeDialog(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

/** The bell's panel, opened for `read` and closed again. */
async function readBell(page: Page, read: (panel: Locator) => Promise<void>) {
  await pointAndClick(
    page,
    page.getByRole("button", { name: /^การแจ้งเตือน \d+ รายการ$/ }),
  );
  await read(page.getByRole("region", { name: "การแจ้งเตือน" }));
  await page.keyboard.press("Escape");
}

/** 「จดแล้ววันนี้」 on the branch day tab. */
function todayFeed(page: Page) {
  return page
    .locator("main section")
    .filter({
      has: page.getByRole("heading", { name: "จดแล้ววันนี้", exact: true }),
    })
    .first();
}

/** The feed is on `date`, holds `count` entries and lists `titles` from the top. */
async function expectFeed(
  page: Page,
  date: string,
  count: number,
  titles: RegExp[] = [],
) {
  const feed = todayFeed(page);
  await expect(feed).toContainText(
    `วันที่ ${date} · ${count} รายการ · ล่าสุดอยู่บนสุด · กดรายการเพื่อดูรายละเอียด`,
  );
  await expect(feed.locator("details")).toHaveCount(count);
  if (!count) await expect(feed).toContainText("ยังไม่มีรายการของวันนี้");
  for (const [index, title] of titles.entries())
    await expect(feed.locator("details > summary").nth(index)).toHaveText(
      title,
    );
}

/** None of `buttons` is the filled (primary) button: no row marks one note as the next. */
async function expectNoNextStep(buttons: Locator) {
  expect(
    await buttons.evaluateAll(
      (all) =>
        all.filter((button) => button.classList.contains("bg-accent")).length,
    ),
    "no filled button among the row actions",
  ).toBe(0);
}

test.beforeEach(async ({ page }) => {
  await startFresh(page);
});

test("ACC-18 ACC-19 ACC-20 PSM-48 จดบันทึก is on every tab of the Owner and the Account Manager; the chooser groups the notes, works from the keyboard, and each note opens its form in place; every note that starts on ไม่ระบุ Lot is saved there and opens a batch", async ({
  page,
}) => {
  const groups = OWNER_NOTES.map(
    ([group, notes]) =>
      [group, notes.map((note) => note.title)] as [string, string[]],
  );

  await step(page, "Owner: ปุ่มจดบันทึกอยู่ที่หัวทุกแท็บ", async () => {
    await signInAs(page, ACCOUNTS.owner);
    await expectNoteButtonOnEveryTab(page, OWNER_TABS);
  });

  await step(
    page,
    "Owner: เปิดด้วยคีย์บอร์ด focus ที่รายการแรก Esc คืน focus ที่ปุ่ม",
    async () => {
      await noteButton(page).focus();
      await page.keyboard.press("Enter");
      await expectChooser(page, groups);
      const chooser = topDialog(page);
      await expect(
        chooser.getByRole("button", { name: "ปิด", exact: true }),
      ).toBeVisible();
      // On the first note, not on the close button; Tab walks them in the order shown.
      await expect(
        chooser.getByRole("button", { name: "สร้าง PO เนื้อ", exact: true }),
      ).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(
        chooser.getByRole("button", {
          name: "ออกและอัปโหลด Invoice เนื้อ",
          exact: true,
        }),
      ).toBeFocused();
      await closeDialog(page);
      await expect(noteButton(page)).toBeFocused();
    },
  );

  await step(
    page,
    "Owner: Enter บนรายการ ฟอร์มเปิดแทนตัวเลือก focus ที่ช่องแรก",
    async () => {
      await page.keyboard.press("Enter");
      await page.keyboard.press("Enter");
      const form = topDialog(page);
      await expect(page.getByRole("dialog")).toHaveCount(1);
      await expect(dialogTitle(page)).toHaveText("สร้าง PO เนื้อ");
      await expect(form.getByLabel(/^ผู้ขาย/)).toBeFocused();
      await closeDialog(page);
    },
  );

  await step(
    page,
    "Owner: จดจากแท็บรายงาน Enter ในช่อง = บันทึกและปิด ยังอยู่แท็บเดิม",
    async () => {
      await openMenu(page, "รายงาน");
      await pickNote(page, "ค่าใช้จ่าย Owner");
      await field(page, /^จำนวนเงิน/, "1500");
      await field(page, /^ผู้จ่ายเงิน/, "เจ้าของร้าน");
      await field(page, /^รายละเอียด/, "ค่าน้ำแข็ง");
      // The form has 「บันทึกและจดต่อ」, and Enter is still the plain save.
      await expect(moreButton(page)).toBeEnabled();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(toast(page, saved("ค่าใช้จ่าย Owner"))).toBeVisible();
      await expect(tabTitle(page)).toHaveText("รายงาน");
      await expect(page).toHaveURL(/\/owner\/report(?:[/?#]|$)/);
    },
  );

  await step(
    page,
    "Account Manager: ปุ่มอยู่ทุกแท็บ รายการเท่ากับ Owner",
    async () => {
      await signInAs(page, ACCOUNTS.manager);
      await expectNoteButtonOnEveryTab(page, OWNER_TABS.slice(1));
      await pointAndClick(page, noteButton(page));
      await expectChooser(page, groups);
      // The branch's notes are not the Owner workspace's to make.
      await expect(topDialog(page)).not.toContainText(/ยอดขาย|ปิดวัน/);
      await closeDialog(page);
    },
  );

  await step(
    page,
    "Account Manager: ทุกรายการเปิดฟอร์มของตัวเอง ไม่มีช่องเงินขาย · Lot เป็นช่องของฟอร์ม",
    async () => {
      for (const note of OWNER_NOTES.flatMap(([, notes]) => notes)) {
        await noteButton(page).click();
        await topDialog(page)
          .getByRole("button", { name: note.title, exact: true })
          .click();
        // One dialog: the form replaced the chooser.
        await expect(page.getByRole("dialog")).toHaveCount(1);
        const form = topDialog(page);
        await expect(dialogTitle(page), note.title).not.toHaveText("จดบันทึก");
        // ACC-20: no form here asks for sale money.
        await expect(form, note.title).not.toContainText("LINE MAN");
        await expect(form.getByLabel(/ยอดขาย/), note.title).toHaveCount(0);
        if (note.shows)
          await expect(form, note.title).toContainText(note.shows);
        await expect(moreButton(page), note.title).toHaveCount(
          note.single ? 0 : 1,
        );
        const lot = noteLot(page);
        if (!note.lot) await expect(lot, note.title).toHaveCount(0);
        else {
          const free = note.lot === "free";
          await expect(lot, note.title).toHaveValue(free ? NO_LOT : "");
          await expect(
            lot.locator(`option[value="${NO_LOT}"]`),
            note.title,
          ).toHaveCount(free ? 1 : 0);
          await expect(form, note.title).toContainText(
            free
              ? "ไม่ระบุ Lot · ระบบเปิดชุดใหม่ให้รายการนี้"
              : "รายการนี้จดได้เมื่อระบุ Lot",
          );
          await expect(lot, note.title).toBeFocused();
        }
        // Every form opens on its first field, whatever control that is, never on the
        // close button (where Enter would shut it).
        await expect(
          form.getByRole("button", { name: "ปิดฟอร์ม", exact: true }),
          note.title,
        ).not.toBeFocused();
        await closeDialog(page);
      }
      // The two purchases into the store are one form with a switch between them.
      await pickNote(page, "บันทึกการซื้ออื่น ๆ");
      await expect(
        topDialog(page)
          .getByRole("radiogroup", { name: "ซื้ออะไรเข้าคลัง" })
          .getByRole("radio", { name: /^ซื้ออื่น ๆ/ }),
      ).toBeChecked();
      await closeDialog(page);
      // None of that moved the manager off its tab.
      await expect(tabTitle(page)).toHaveText(OWNER_TABS.at(-1)!);
    },
  );

  await step(
    page,
    "Account Manager: จดน้ำหนักก่อนสโมคโดยไม่ระบุ Lot ได้ชุดใหม่ Log บอกว่าแทน Chef House",
    async () => {
      await pickNote(page, "น้ำหนักก่อนสโมค");
      await field(page, /น้ำหนักหลังแกะซับ ก่อนสโมค/, "40");
      await saveEntry(page);
      await openMenu(page, SCREENS.production.menu);
      expect(await idsOnScreen(page, BATCH_ID), "one new batch").toHaveLength(
        1,
      );
      await openMenu(page, "Log");
      await expect(logRow(page, "น้ำหนักก่อนสโมค")).toContainText(
        "Account Manager · แทน Chef House",
      );
    },
  );

  // PSM-46 / GEN-09 for the other seven notes that start on "ไม่ระบุ Lot": each is saved as
  // it opens, with nothing typed (GEN-02), and each opens a batch of its own.
  await step(
    page,
    "Account Manager: อีก 7 รายการ บันทึกโดยไม่ระบุ Lot และไม่กรอกอะไร ได้ชุดใหม่รายการละชุด",
    async () => {
      const free = OWNER_NOTES.flatMap(([, notes]) => notes)
        .filter((note) => note.lot === "free")
        .map((note) => note.title)
        .filter((title) => title !== "น้ำหนักก่อนสโมค");
      expect(free).toHaveLength(7);
      for (const title of free) {
        await pickNote(page, title);
        await expect(noteLot(page), title).toHaveValue(NO_LOT);
        await saveEntry(page);
        await expect(toast(page, saved(title)), title).toBeVisible();
      }
      await openMenu(page, "Log");
      const batches: string[] = [];
      for (const title of free) {
        const summary = logRow(page, title).locator("summary");
        // The fields left empty are marked, not asked for.
        await expect(summary, title).toContainText(MISSING);
        batches.push((await summary.innerText()).match(BATCH_ID)?.[0] ?? title);
      }
      await openMenu(page, SCREENS.production.menu);
      const listed = await idsOnScreen(page, BATCH_ID);
      // The seven new ones and the pre-smoke note's: eight batches, none shared.
      expect(listed).toHaveLength(8);
      expect(new Set(batches).size).toBe(7);
      expect(listed).toEqual(expect.arrayContaining(batches));
    },
  );
});

test("PSM-45 PSM-46 PSM-47 PSM-49 PSM-50 PSM-51 GEN-09 the lot is a field of the note: ไม่ระบุ Lot opens a new batch, บันทึกและจดต่อ keeps the form on its lot, and the notes that need a lot are refused without one", async ({
  page,
}) => {
  await signInAs(page, ACCOUNTS.owner);
  const main = page.locator("main");
  let batch = "";

  await step(
    page,
    "Owner: สร้าง PO เนื้อจากแดชบอร์ด บันทึกแล้วยังอยู่แดชบอร์ด",
    async () => {
      await expect(tabTitle(page)).toHaveText("แดชบอร์ด");
      await pickNote(page, "สร้าง PO เนื้อ");
      await field(page, /น้ำหนักสั่งซื้อ/, "300");
      await field(page, /ราคาเนื้อ/, "250");
      await saveEntry(page);
      // PSM-50: the save says what was saved and nothing about a next step or another tab.
      await expect(toast(page, saved("สร้าง PO เนื้อ"))).toHaveText(
        "สร้าง PO เนื้อแล้ว",
      );
      await expect(tabTitle(page)).toHaveText("แดชบอร์ด");
      await expect(page).not.toHaveURL(/\/owner\/po/);
    },
  );

  await step(
    page,
    "Owner: น้ำหนักก่อนสโมค ไม่ระบุ Lot → บันทึกและจดต่อ เปิดชุดใหม่ ฟอร์มยังอยู่ที่ไม่ระบุ Lot",
    async () => {
      await pickNote(page, "น้ำหนักก่อนสโมค");
      const lot = noteLot(page);
      // No batch exists yet: the only choice is to open one.
      await expect(lot.locator("option")).toHaveText(["ไม่ระบุ Lot"]);
      await expect(lot).toHaveValue(NO_LOT);
      await field(page, /น้ำหนักหลังแกะซับ ก่อนสโมค/, "50");
      await saveAndKeepNoting(page, "น้ำหนักก่อนสโมค");
      // The same form again: empty, still on "ไม่ระบุ Lot", focus back on its first field.
      await expect(
        topDialog(page).getByLabel(/น้ำหนักหลังแกะซับ ก่อนสโมค/),
      ).toHaveValue("");
      await expect(lot).toHaveValue(NO_LOT);
      await expect(lot).toBeFocused();
      // The batch that note opened is now a lot to pick: `S… · SH-…`.
      await expect(lot.locator("option")).toHaveText([
        /^S\d{6}-\d{3}-[0-9a-z]{4} · SH-\d{4}-\d{4}$/i,
        "ไม่ระบุ Lot",
      ]);
      batch = (await lot.locator("option").first().getAttribute("value"))!;
      await closeDialog(page);
      await openMenu(page, SCREENS.production.menu);
      expect(await idsOnScreen(page, BATCH_ID)).toEqual([batch]);
    },
  );

  // PRIN-01: the weigh-in is noted after the pre-smoke weight it "comes before".
  await step(
    page,
    "Owner: จดชั่งรับทีหลังก่อนสโมค จดล่าสุดตามที่จดจริง · มีปุ่ม Edit ทั้งที่ยังไม่มีรอบสโมค",
    async () => {
      const row = tableRow(page, SCREENS.production.table, batch);
      const edit = row.getByRole("button", { name: "Edit ข้อมูลก่อนปิด Lot" });
      await expect(row.getByRole("cell").nth(3)).toHaveText("ยังไม่ได้จดรับ");
      await expect(row.getByRole("cell").nth(4)).toHaveText("น้ำหนักก่อนสโมค");
      // Nothing to correct yet: mutate would refuse it, so the button is not there.
      await expect(edit).toHaveCount(0);
      await pointAndClick(
        page,
        row.getByRole("button", {
          name: "ยืนยันรับเนื้อที่ Chef House",
          exact: true,
        }),
      );
      // On the row's batch, not a new one, and with no lot to pick.
      await expect(noteLot(page)).toHaveCount(0);
      await expect(topDialog(page)).toContainText(
        /Chef House · SH-\d{4}-\d{4}/,
      );
      await field(page, /^น้ำหนักรับรวม/, "52");
      await saveEntry(page);
      await expect(
        toast(page, saved("ยืนยันรับเนื้อที่ Chef House")),
      ).toBeVisible();
      await expect(row.getByRole("cell").nth(3)).toHaveText("52.00 กก.");
      await expect(row.getByRole("cell").nth(4)).toHaveText(
        "ยืนยันรับเนื้อที่ Chef House",
      );
      await expect(edit).toBeVisible();
    },
  );

  await step(
    page,
    "Owner: บันทึก Lot สโมครายวัน เลือกชุดเดิม → จดต่อบนชุดเดิม → Enter บันทึกและปิด",
    async () => {
      const round = async () => {
        await field(page, /น้ำหนักเข้าเตารอบนี้/, "20");
        await field(page, /น้ำหนัก Waste/, "1");
        await typeValue(
          page,
          topDialog(page).getByLabel("กล่องรมควันที่ 1 กี่กิโล"),
          "19",
        );
      };
      await pickNote(page, "บันทึก Lot สโมครายวัน");
      const lot = noteLot(page);
      await lot.selectOption(batch);
      // PSM-51: on a lot, the form says the newest note that lot holds.
      await expect(topDialog(page)).toContainText(
        `${batch} · จดล่าสุด: ยืนยันรับเนื้อที่ Chef House`,
      );
      await round();
      await saveAndKeepNoting(page, "บันทึก Lot สโมครายวัน");
      await expect(lot).toHaveValue(batch);
      await expect(lot).toBeFocused();
      // A fresh form, counted again from what is saved: 50 kg before smoking less the
      // 20 of the round just noted, and no box typed yet.
      await expect(
        topDialog(page).getByLabel(/น้ำหนักเข้าเตารอบนี้/),
      ).toHaveValue("30");
      await expect(
        topDialog(page).getByLabel("กล่องรมควันที่ 1 กี่กิโล"),
      ).toHaveValue("");
      await expect(topDialog(page)).toContainText(
        `${batch} · จดล่าสุด: บันทึก Lot สโมครายวัน`,
      );
      await round();
      await topDialog(page)
        .getByLabel(/น้ำหนัก Waste/)
        .press("Enter");
      await expect(page.getByRole("dialog")).toHaveCount(0);
      // Both rounds went on the batch that was picked: no second batch was opened.
      await expect(
        main.getByRole("heading", { name: "Log Lot สโมครายวัน 2 รอบ" }),
      ).toBeVisible();
      expect(await idsOnScreen(page, BATCH_ID)).toEqual([batch]);
    },
  );

  await step(
    page,
    "Owner: ตารางงานผลิตบอกจดล่าสุด ปุ่มทุกปุ่มเป็นปุ่มรอง · ฟอร์มจากแถวไม่มีช่อง Lot",
    async () => {
      const table = tableSection(
        page,
        new RegExp(`^${SCREENS.production.table}$`),
      );
      await expect(table.getByRole("columnheader")).toHaveText([
        "Lot",
        "PO รมควัน",
        "เอกสาร PO",
        "รับจริง",
        "จดล่าสุด",
        "น้ำหนักหลังรมควัน",
        "กล่องรมควัน",
        "การทำงาน",
      ]);
      const row = tableRow(page, SCREENS.production.table, batch);
      await expect(row.getByRole("cell").nth(4)).toHaveText(
        "บันทึก Lot สโมครายวัน",
      );
      // What is not noted is said in a neutral chip, and no button is "the next one". The
      // one note mutate refuses here (no smoke PO to accept) has no button.
      await expect(row.getByText("ยังไม่มี PO รมควัน")).toHaveClass(
        /bg-surface-sunken/,
      );
      await expect(row.getByRole("button")).toHaveText([
        "ยืนยันรับเนื้อที่ Chef House · บันทึกเพิ่ม/แก้",
        "น้ำหนักก่อนสโมค · บันทึกเพิ่ม/แก้",
        "บันทึก Lot สโมครายวัน",
        "Edit ข้อมูลก่อนปิด Lot",
        "ยืนยันปิด Lot",
        "สร้าง / Submit ใบวางบิล",
      ]);
      await expectNoNextStep(row.getByRole("button"));
      await pointAndClick(
        page,
        row.getByRole("button", { name: "ยืนยันปิด Lot", exact: true }),
      );
      const form = topDialog(page);
      await expect(noteLot(page)).toHaveCount(0);
      await expect(form).toContainText(
        `${batch} · จดล่าสุด: บันทึก Lot สโมครายวัน`,
      );
      // The notice of the earlier 「บันทึกและจดต่อ」 does not follow into another form.
      await expect(form).not.toContainText("จดรายการใหม่ได้เลย");
      await expect(moreButton(page)).toBeVisible();
      await closeDialog(page);
    },
  );

  await step(
    page,
    "Owner: Edit ข้อมูลก่อนปิด Lot ไม่มีบันทึกและจดต่อ บันทึกแล้วไม่บอกขั้นถัดไป",
    async () => {
      const row = tableRow(page, SCREENS.production.table, batch);
      await pointAndClick(
        page,
        row.getByRole("button", { name: "Edit ข้อมูลก่อนปิด Lot" }),
      );
      const form = topDialog(page);
      await expect(form).toContainText(
        "แก้ได้ทุกเมื่อ · ถ้าปิด Lot แล้วยังบันทึกได้ ระบบจะแจ้งให้ทราบ",
      );
      await expect(moreButton(page)).toHaveCount(0);
      await field(page, /^น้ำหนักรับรวม/, "51");
      await saveEntry(page);
      await expect(toast(page, "แก้ไขข้อมูล Lot แล้ว")).toHaveText(
        "แก้ไขข้อมูล Lot แล้ว",
      );
      await expect(row.getByRole("cell").nth(3)).toHaveText("51.00 กก.");
    },
  );

  await step(
    page,
    "Owner: ชำระ Invoice เนื้อ ต้องระบุ PO ซื้อ · จดต่อถูกปฏิเสธ แก้แล้วบันทึกปกติปิดฟอร์ม",
    async () => {
      await pickNote(page, "ชำระ Invoice เนื้อ Foodiva");
      const lot = noteLot(page);
      await expect(lot).toHaveValue("");
      await expect(lot.locator("option").first()).toHaveText("เลือก Lot");
      await expect(lot.locator("option").nth(1)).toHaveText(PO_ID);
      await field(page, /^ยอดชำระ/, "75000");
      await field(page, /^ผู้ดำเนินการชำระ/, "เจ้าของร้าน");
      await pointAndClick(page, moreButton(page));
      const form = topDialog(page);
      await expect(
        form
          .getByRole("alert")
          .filter({ hasText: "รายการนี้ต้องทำกับ PO ซื้อ" }),
      ).toBeVisible();
      await expect(form).not.toContainText("จดรายการใหม่ได้เลย");
      await lot.selectOption({ index: 1 });
      // The refused 「บันทึกและจดต่อ」 is not remembered: the plain save closes the form.
      await saveEntry(page);
      await expect(
        toast(page, saved("ชำระ Invoice เนื้อ Foodiva")),
      ).toBeVisible();
      // PRIN-03: one payment per invoice is still the rule.
      await pickNote(page, "ชำระ Invoice เนื้อ Foodiva");
      await lot.selectOption({ index: 1 });
      await field(page, /^ยอดชำระ/, "75000");
      await field(page, /^ผู้ดำเนินการชำระ/, "เจ้าของร้าน");
      await expect(
        topDialog(page)
          .getByRole("alert")
          .filter({ hasText: "ชำระ Invoice เนื้อใบนี้แล้ว" }),
      ).toBeVisible();
      await expect(moreButton(page)).toBeDisabled();
      await closeDialog(page);
    },
  );

  await step(
    page,
    "Owner: ยืนยันรับ PO รมควัน ตรวจยอด Invoice ค่ารมควัน และปลดล็อกวัน ยังปฏิเสธ ไม่เปิดชุดใหม่",
    async () => {
      await pickNote(page, "ยืนยันรับ PO รมควัน");
      const form = topDialog(page);
      const submit = form.locator('button[type="submit"]').last();
      await pointAndClick(page, submit);
      await expect(form.getByRole("alert")).toContainText(
        "ยังไม่มี PO รมควันจาก Owner",
      );
      // On the batch that has no smoke PO it is refused as the form is filled in.
      await noteLot(page).selectOption(batch);
      await field(page, /^ชื่อผู้รับ PO/, "หัวหน้าผลิต Chef House");
      await expect(
        form
          .getByRole("alert")
          .filter({ hasText: "ยังไม่มี PO รมควันจาก Owner" }),
      ).toBeVisible();
      await expect(submit).toBeDisabled();
      await expect(moreButton(page)).toBeDisabled();
      await closeDialog(page);

      await pickNote(page, "ตรวจยอด Invoice ค่ารมควัน");
      await pointAndClick(
        page,
        topDialog(page).locator('button[type="submit"]').last(),
      );
      await expect(topDialog(page).getByRole("alert")).toContainText(
        "ไม่พบ Invoice ค่ารมควันที่ต้องตรวจ",
      );
      await closeDialog(page);

      // A day that was never closed has nothing to unlock.
      await pickNote(page, "ปลดล็อกวัน");
      await field(page, /^เหตุผลปลดล็อก/, "ทดสอบ");
      await expect(
        topDialog(page)
          .getByRole("alert")
          .filter({ hasText: "วันนี้ยังไม่ได้ปิด" }),
      ).toBeVisible();
      await expect(
        topDialog(page).locator('button[type="submit"]').last(),
      ).toBeDisabled();
      await closeDialog(page);

      await openMenu(page, SCREENS.production.menu);
      expect(await idsOnScreen(page, BATCH_ID)).toEqual([batch]);
      await openMenu(page, "Log");
      await expect(logRow(page, "ชำระ Invoice เนื้อ Foodiva")).toBeVisible();
      for (const refused of [
        "ยืนยันรับ PO รมควัน",
        "ตรวจยอด Invoice ค่ารมควัน",
      ])
        await expect(logRow(page, refused)).toHaveCount(0);
    },
  );

  await step(
    page,
    "Owner: แดชบอร์ดและกระดิ่งบอกว่ายังไม่ได้จดอะไร ไม่สั่งให้ทำ",
    async () => {
      await openMenu(page, SCREENS.ownerDashboard.menu);
      const summary = main.getByRole("button", { name: /^ยังไม่ครบ \d+ จุด/ });
      await expect(summary).toHaveClass(/bg-surface-sunken/);
      await pointAndClick(page, summary);
      const details = page.locator("#owner-alert-details");
      await expect(
        details.getByRole("heading", { name: "รายการที่ยังไม่ครบ" }),
      ).toBeVisible();
      await expect(details).toContainText(/การส่ง SH-\d{4}-\d{4}/);
      await expect(details).toContainText(
        "ยังไม่ได้จด: PO รมควัน, ใบขนส่ง, Packing List, ปิด Lot และอีก",
      );
      await expect(details).not.toContainText(/ต้อง|ACTION REQUIRED/);
      await readBell(page, async (panel) => {
        await expect(panel).toContainText(/แจ้งเตือน \d+ รายการ/);
        await expect(panel).toContainText(
          /ชุด SH-\d{4}-\d{4} ยังไม่ได้จด \d+ รายการ/,
        );
        await expect(panel).not.toContainText(/ต้อง|งานค้าง/);
      });
    },
  );
});

test("ACC-18 ACC-19 PSM-49 STK-41 a branch notes from จดบันทึก on any tab and keeps noting; จดแล้ววันนี้ lists each entry at once under its date, and the other branch sees none of them", async ({
  page,
}) => {
  const BRANCH = "ศาลาแดง";
  const today = bangkokDate();
  const yesterday = bangkokDate(-1);
  const stock = `ตารางสต๊อกทั้งหมด · ${BRANCH}`;
  const bucket = "ไม่ระบุ Lot · เนื้อรมควัน";
  const RECEIVE = /^รับของเข้าสาขา/;
  const dayMenu = menuItem(page, SCREENS.branchDay.menu);
  const dayRow = (label: string) =>
    tableRow(page, `จดวันนี้ · ${BRANCH}`, label);

  await step(
    page,
    "สาขาศาลาแดง: ปุ่มจดบันทึกอยู่ทุกแท็บ ตัวเลือก 4 กลุ่ม",
    async () => {
      await signInAs(page, ACCOUNTS.saladaeng);
      await expectNoteButtonOnEveryTab(page, BRANCH_TABS);
      await noteButton(page).focus();
      await page.keyboard.press("Enter");
      await expectChooser(page, BRANCH_NOTES);
      await expect(
        topDialog(page).getByRole("button", {
          name: "ซื้อข้าวเหนียวเข้าสต๊อก",
          exact: true,
        }),
      ).toBeFocused();
      // Enter on it: its form, with focus on the first field (a select here).
      await page.keyboard.press("Enter");
      await expect(dialogTitle(page)).toHaveText("ซื้อข้าวเหนียวเข้าสต๊อก");
      await expect(
        topDialog(page).getByRole("combobox", {
          name: /^รอบนี้ข้าวเหนียวมาจาก/,
        }),
      ).toBeFocused();
      await closeDialog(page);
      // The material count is a screen, not a dialog: the note goes to its tab.
      await pickNote(page, /^เช็ควัสดุ \d+ รายการ$/);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(tabTitle(page)).toHaveText("ตรวจนับสต๊อกวัสดุวันนี้");
    },
  );

  await step(page, "สาขาศาลาแดง: จดแล้ววันนี้ยังว่าง", async () => {
    await openMenu(page, SCREENS.branchDay.menu);
    await expectFeed(page, today, 0);
  });

  await step(
    page,
    "สาขาศาลาแดง: จากแท็บสต๊อก รับของ 10 กก. → บันทึกและจดต่อ → อีก 5 กก. ยังอยู่แท็บสต๊อก",
    async () => {
      await openMenu(page, "สต๊อก");
      await pickNote(page, "รับของเข้าสาขา");
      await expect(lotSelect(page)).toHaveValue(NO_LOT);
      await field(page, /น้ำหนักรับเข้าสาขา/, "10");
      await saveAndKeepNoting(page, "รับของเข้าสาขา");
      // Saved at once: the stock table behind the dialog already holds it.
      await expect(tableRow(page, stock, bucket)).toContainText(
        "แช่แข็ง 10.00",
      );
      await expect(
        topDialog(page).getByLabel(/น้ำหนักรับเข้าสาขา/),
      ).toHaveValue("");
      await expect(lotSelect(page)).toHaveValue(NO_LOT);
      await expect(lotSelect(page)).toBeFocused();
      await field(page, /น้ำหนักรับเข้าสาขา/, "5");
      await saveEntry(page);
      await expect(toast(page, saved("รับของเข้าสาขา"))).toBeVisible();
      await expect(tabTitle(page)).toHaveText("สต๊อก");
      await expect(tableRow(page, stock, bucket)).toContainText(
        "แช่แข็ง 15.00",
      );
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: จดแล้ววันนี้มี 2 รายการ กระดิ่งบอกว่ายังไม่ได้จดแบ่งละลาย",
    async () => {
      await openMenu(page, SCREENS.branchDay.menu);
      await expectFeed(page, today, 2, [RECEIVE, RECEIVE]);
      // The menu counts the day's lines of the bell: the thaw and the close.
      await expect(dayMenu).toHaveText(/2$/);
      await readBell(page, async (panel) => {
        await expect(panel).toContainText(
          `ยังไม่ได้จดแบ่งละลายเนื้อวันที่ ${today}`,
        );
        await expect(panel).toContainText("มีเนื้อแช่แข็ง 1 Lot");
        await expect(panel).not.toContainText("ยังไม่ได้จดยอดขาย");
        await expect(panel).not.toContainText("ต้อง");
      });
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: แบ่งละลายจากตาราง ขึ้นบนสุดของจดแล้ววันนี้",
    async () => {
      await openBranchTask(page, "แบ่งละลาย");
      await field(page, /น้ำหนักละลาย/, "4");
      await saveEntry(page);
      await expectFeed(page, today, 3, [/^แบ่งละลายเนื้อ/, RECEIVE, RECEIVE]);
      await expect(dayRow("แบ่งละลายเนื้อ")).toContainText("จดแล้ว");
      await expect(dayMenu).toHaveText(/2$/);
      await readBell(page, async (panel) => {
        await expect(panel).not.toContainText("ยังไม่ได้จดแบ่งละลายเนื้อ");
        await expect(panel).toContainText(`ยังไม่ได้จดยอดขายวันที่ ${today}`);
        await expect(panel).toContainText("มีเนื้อละลายพร้อมขาย");
      });
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: จดบันทึก → ยอดขาย → บันทึกและจดต่อ รายการขึ้นทันทีหลังฟอร์ม",
    async () => {
      await pickNote(page, "บันทึกยอดขาย / Waste");
      await expect(lotSelect(page)).toHaveValue(NO_LOT);
      await field(page, /กล่องมาตรฐาน/, "20");
      await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "2");
      await saveAndKeepNoting(page, "บันทึกยอดขาย / Waste");
      await expect(lotSelect(page)).toBeFocused();
      // The form is still open, and the feed behind it already lists the sale.
      await expectFeed(page, today, 4, [
        /^บันทึกยอดขาย \/ Waste/,
        /^แบ่งละลายเนื้อ/,
        RECEIVE,
        RECEIVE,
      ]);
      await closeDialog(page);
      await expect(dayRow("ยอดขาย")).toContainText("จดแล้ว");
      // Noted, so the count drops: only the day not closed is left.
      await expect(dayMenu).toHaveText(/1$/);
      await readBell(page, async (panel) => {
        await expect(panel).not.toContainText("ยังไม่ได้จดยอดขาย");
        await expect(panel).toContainText(
          new RegExp(`ยังไม่ได้จด \\d+ รายการของวันที่ ${today}`),
        );
        await expect(panel).toContainText(
          "ดูรายการได้ที่สรุปก่อนปิดวัน · ปิดวันได้ทุกเวลา",
        );
      });
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: กดรายการในจดแล้ววันนี้ แก้ไข ผูก ลบได้ · ลบรายการรับ 5 กก.",
    async () => {
      const entry = logRow(page, "รับของเข้าสาขา");
      await pointAndClick(page, entry.locator("summary"));
      await expect(entry).toContainText("น้ำหนักรับเข้าสาขา (กก.)5");
      for (const action of ["แก้ไข", "ผูกกับ…", "ลบรายการ"])
        await expect(
          entry.getByRole("button", { name: action, exact: true }),
        ).toBeVisible();
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "ลบรายการ", exact: true }),
      );
      await pointAndClick(
        page,
        entry.getByRole("button", { name: "ยืนยันลบ", exact: true }),
      );
      await expect(toast(page, "ลบรายการแล้ว ระบบคำนวณยอดใหม่")).toBeVisible();
      // The delete is a note of the day too, and the entry it took out says so.
      await expectFeed(page, today, 5, [/^ลบรายการ · รับของเข้าสาขา/]);
      await expect(
        todayFeed(page)
          .locator("details > summary")
          .filter({ hasText: RECEIVE })
          .filter({ hasText: "ลบแล้ว" }),
      ).toHaveCount(1);
    },
  );

  await step(
    page,
    "สาขาศาลาแดง: เปลี่ยนวันที่ทำรายการเป็นเมื่อวาน รายการเปลี่ยนตามวันที่",
    async () => {
      await page.locator("main").getByLabel("วันที่ทำรายการ").fill(yesterday);
      await expectFeed(page, yesterday, 0);
      await openBranchTask(page, "รับของ");
      await field(page, /น้ำหนักรับเข้าสาขา/, "3");
      await saveEntry(page);
      await expectFeed(page, yesterday, 1, [RECEIVE]);
      await expect(todayFeed(page).locator("details > summary")).toContainText(
        "บันทึกย้อนหลัง",
      );
      await pointAndClick(
        page,
        page.locator("main").getByRole("button", { name: "ใช้วันนี้" }),
      );
      await expectFeed(page, today, 5, [/^ลบรายการ · รับของเข้าสาขา/]);
    },
  );

  await step(page, "สาขามีนบุรี: ไม่มีรายการของศาลาแดง", async () => {
    await signInAs(page, ACCOUNTS.minburi);
    await expectFeed(page, today, 0);
    await page.locator("main").getByLabel("วันที่ทำรายการ").fill(yesterday);
    await expectFeed(page, yesterday, 0);
  });
});

test("STK-42 PRIN-01 a branch with no meat notes the sale, the thaw and the receive in any order: every row of จดวันนี้ stays open", async ({
  page,
}) => {
  const today = bangkokDate();
  const table = tableSection(page, /^จดวันนี้ · มีนบุรี$/);
  const dayRow = (label: string) => tableRow(page, "จดวันนี้ · มีนบุรี", label);
  const actions = table.locator("tbody").getByRole("button");
  await signInAs(page, ACCOUNTS.minburi);

  await step(
    page,
    "สาขามีนบุรี: ตารางจดวันนี้ไม่มีลำดับ ปุ่มทั้งห้ากดได้ทั้งที่ไม่มีเนื้อ",
    async () => {
      await expect(tabTitle(page)).toHaveText("จดรายวัน");
      await expect(table.getByRole("columnheader")).toHaveText([
        "รายการ",
        "สถานะ",
        "จด",
      ]);
      // The names as they are: no "1." to "5." in front.
      await expect(table.locator("tbody tr > td:first-child")).toHaveText([
        "รับเนื้อเข้าสาขา",
        "แบ่งละลายเนื้อ",
        "ข้าวเหนียว",
        "ยอดขาย",
        "ปิดวัน",
      ]);
      await expect(actions).toHaveText([
        "รับของ",
        "แบ่งละลาย",
        "ไปเมนูข้าวเหนียววันนี้",
        "จดยอดขาย",
        "ตรวจและปิดวัน",
      ]);
      await expectNoNextStep(actions);
      // (The filled look the check rules out is the one 「จดบันทึก」 itself has.)
      await expect(noteButton(page)).toHaveClass(/(^|\s)bg-accent(\s|$)/);
      for (const action of await actions.all())
        await expect(action).toBeEnabled();
      await expect(dayRow("แบ่งละลายเนื้อ")).toContainText("ไม่มีเนื้อแช่แข็ง");
      await expect(dayRow("ยอดขาย").getByText("ยังไม่ได้จด")).toHaveClass(
        /bg-surface-sunken/,
      );
      await expect(table).not.toContainText(
        /ต้อง|รอ(บันทึก|เนื้อละลาย)|พร้อมปิดวัน/,
      );
      // NTF-13/14: with no meat the bell has no thaw or sale line; the buttons work anyway.
      await readBell(page, async (panel) => {
        await expect(panel).not.toContainText(/แบ่งละลาย|ยอดขาย/);
        await expect(panel).toContainText(
          new RegExp(`ยังไม่ได้จด \\d+ รายการของวันที่ ${today}`),
        );
      });
    },
  );

  // From 「จดบันทึก」 the forms open where the table's buttons open them: on "ไม่ระบุ Lot".
  await step(
    page,
    "สาขามีนบุรี: จดบันทึก → ยอดขาย และแบ่งละลาย เปิดที่ไม่ระบุ Lot เหมือนปุ่มในตาราง",
    async () => {
      await pickNote(page, "แบ่งละลายเนื้อ");
      await expect(lotSelect(page)).toHaveValue(NO_LOT);
      await closeDialog(page);
      await pickNote(page, "บันทึกยอดขาย / Waste");
      await expect(lotSelect(page)).toHaveValue(NO_LOT);
      await pointAndClick(
        page,
        topDialog(page).getByRole("button", { name: "เพิ่มอินฟลูเอนเซอร์" }),
      );
      await expect(topDialog(page).getByRole("alert")).toHaveCount(0);
      await closeDialog(page);
    },
  );

  await step(
    page,
    "สาขามีนบุรี: จดยอดขายก่อน ฟอร์มเปิดที่ไม่ระบุ Lot เตือนแล้วบันทึก",
    async () => {
      await openBranchTask(page, "จดยอดขาย");
      await expect(lotSelect(page)).toHaveValue(NO_LOT);
      await field(page, /กล่องมาตรฐาน/, "2");
      await field(page, /น้ำหนักเนื้อที่ใช้ไปจริงวันนี้/, "0.2");
      await expectWarning(page, /ไม่พอ/);
      await saveEntry(page);
      await expect(dayRow("ยอดขาย")).toContainText("จดแล้ว");
    },
  );

  await step(
    page,
    "สาขามีนบุรี: แล้วแบ่งละลาย 1 กก. เตือนสต๊อกแช่แข็งไม่พอ บันทึกได้",
    async () => {
      await openBranchTask(page, "แบ่งละลาย");
      await expect(lotSelect(page)).toHaveValue(NO_LOT);
      await field(page, /น้ำหนักละลาย/, "1");
      await expectWarning(page, "สต๊อกแช่แข็งไม่พอ");
      await saveEntry(page);
      await expect(dayRow("แบ่งละลายเนื้อ")).toContainText("จดแล้ว");
    },
  );

  await step(
    page,
    "สาขามีนบุรี: แล้วค่อยรับของ ทุกปุ่มยังกดได้ จดแล้ววันนี้เรียงตามที่จด",
    async () => {
      await openBranchTask(page, "รับของ");
      await field(page, /น้ำหนักรับเข้าสาขา/, "10");
      await saveEntry(page);
      await expectFeed(page, today, 3, [
        /^รับของเข้าสาขา/,
        /^แบ่งละลายเนื้อ/,
        /^บันทึกยอดขาย \/ Waste/,
      ]);
      for (const action of await actions.all())
        await expect(action).toBeEnabled();
    },
  );

  await step(
    page,
    "สาขามีนบุรี: สรุปก่อนปิดวันบอกที่ยังไม่ได้จด ปิดวันได้ ไม่มีบันทึกและจดต่อ",
    async () => {
      await openBranchTask(page, "ตรวจและปิดวัน");
      const form = topDialog(page);
      await expect(dialogTitle(page)).toHaveText("ยืนยันปิดวัน");
      const summary = form.locator("section").filter({
        has: page.getByRole("heading", { name: "สรุปก่อนปิดวัน" }),
      });
      await expect(summary.getByRole("columnheader")).toHaveText([
        "รายการ",
        "สถานะ",
        "จด",
      ]);
      await expect(
        form
          .getByRole("status")
          .filter({ hasText: /^ยังไม่ได้จด \d+ รายการ · .+ · ปิดวันได้/ }),
      ).toBeVisible();
      await expect(moreButton(page)).toHaveCount(0);
      await expect(form.locator('button[type="submit"]').last()).toBeEnabled();
      await closeDialog(page);
    },
  );
});

/* AppHeader: below `md` the actions take a row of their own under the brand, so the
 * button keeps its label on a phone. */
test("ACC-18 on a phone จดบันทึก has a row of its own under the brand with its label whole; from 768 px it shares the brand's row", async ({
  page,
}) => {
  const desktop = { width: 1440, height: 900 };
  const brand = page.getByRole("banner").locator("strong").first();
  const box = async (locator: Locator) => (await locator.boundingBox())!;
  const bell = page.getByRole("button", { name: /^การแจ้งเตือน \d+ รายการ$/ });

  /** The header at `width`: the button under the brand (`stacked`) or beside it. */
  async function expectHeader(width: number, stacked: boolean) {
    await page.setViewportSize({ width, height: 900 });
    const button = noteButton(page);
    await expect(button).toBeVisible();
    const [logo, note, ring] = [
      await box(brand),
      await box(button),
      await box(bell),
    ];
    if (stacked) expect(note.y).toBeGreaterThanOrEqual(logo.y + logo.height);
    else expect(note.y).toBeLessThan(logo.y + logo.height);
    // The bell sits on the button's row, and both are inside the screen.
    expect(
      Math.abs(ring.y + ring.height / 2 - (note.y + note.height / 2)),
    ).toBeLessThan(2);
    expect(note.x).toBeGreaterThanOrEqual(0);
    expect(ring.x + ring.width).toBeLessThanOrEqual(width);
    // The label is whole (not clipped) and the page does not scroll sideways.
    expect(
      await button.evaluate((el) => el.scrollWidth <= el.clientWidth),
      "จดบันทึก is not clipped",
    ).toBe(true);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `no sideways scroll at ${width}px`,
    ).toBe(true);
  }

  await step(
    page,
    "Owner: หัวจอ 360 390 767 px สองแถว · 768 px แถวเดียว",
    async () => {
      await signInAs(page, ACCOUNTS.owner);
      for (const width of [360, 390, 767]) await expectHeader(width, true);
      await expectHeader(768, false);
    },
  );

  await step(
    page,
    "Owner (จอ 390 px): ตัวเลือกเรียงคอลัมน์เดียว ชื่อยาวไม่ล้นจอ · ปุ่มท้ายฟอร์มกดได้ครบ",
    async () => {
      await page.setViewportSize({ width: 390, height: 900 });
      await bell.click();
      const panel = await box(
        page.getByRole("region", { name: "การแจ้งเตือน" }),
      );
      expect(panel.x).toBeGreaterThanOrEqual(0);
      expect(panel.x + panel.width).toBeLessThanOrEqual(390);
      await page.keyboard.press("Escape");
      await noteButton(page).click();
      const notes = topDialog(page).locator("section").getByRole("button");
      const boxes = await Promise.all((await notes.all()).map(box));
      expect(new Set(boxes.map((note) => Math.round(note.x))).size).toBe(1);
      for (const note of boxes)
        expect(note.x + note.width).toBeLessThanOrEqual(390);
      await topDialog(page)
        .getByRole("button", { name: "ค่าใช้จ่าย Owner", exact: true })
        .click();
      const footer = topDialog(page).locator("footer").getByRole("button");
      await expect(footer).toHaveText([
        "บันทึกและจดต่อ",
        "ยกเลิก",
        "บันทึกรายการ",
      ]);
      const buttons = await Promise.all((await footer.all()).map(box));
      for (const [index, button] of buttons.entries()) {
        expect(button.x).toBeGreaterThanOrEqual(0);
        expect(button.x + button.width).toBeLessThanOrEqual(390);
        // No button lies over the one before it.
        const before = buttons[index - 1];
        if (before)
          expect(
            button.x >= before.x + before.width ||
              button.y >= before.y + before.height,
          ).toBe(true);
      }
      await closeDialog(page);
    },
  );

  await step(page, "สาขาศาลาแดง: หัวจอมือถือเหมือนกัน", async () => {
    await page.setViewportSize(desktop);
    await signInAs(page, ACCOUNTS.saladaeng);
    await expectHeader(390, true);
    await expectHeader(768, false);
  });
});
