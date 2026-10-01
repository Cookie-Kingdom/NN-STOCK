import { expect, test } from "vitest";
import {
  activeBatches,
  latestNote,
  latestNoteLabel,
} from "@/components/organisms/owner/lotSteps";
import { useOwnerAlerts as ownerAlerts } from "@/components/organisms/owner/useOwnerAlerts";
import {
  openPurchasePos,
  smokedAtFoodiva,
  titles,
  unlinkedSummary,
} from "@/lib/store";
import {
  confirm,
  day,
  dispatch,
  last,
  purchase,
  ready,
  returned,
  setup,
  smokeOrder,
} from "./fixtures";

const branch = "ศาลาแดง";

test("DASH-01 the ไม่ระบุ Lot figure is what is left in the bucket, and the bell says the same kg", () => {
  const s = setup();
  s.run("branch", "receive", { kg: "10" }, "");
  s.run("branch", "thaw", { kg: "5" }, "");
  s.run(
    "branch",
    "sale",
    {
      boxes: "0",
      chiliAddons: "0",
      soldKg: "2",
      wasteKg: "0",
      riceWasteKg: "0",
      expense: "0",
      lineMan: "100",
    },
    "",
  );
  // 5 kg still frozen + 3 kg chill left: selling from the bucket lowers it.
  expect(unlinkedSummary(s.db)).toMatchObject({
    meatKg: { [branch]: 8 },
    meatReceives: 1,
  });
  const bell = () =>
    ownerAlerts(s.db).notifications.find((item) =>
      item.title.startsWith("เนื้อสาขายังไม่ผูก Lot"),
    );
  expect(bell()?.title).toBe("เนื้อสาขายังไม่ผูก Lot: 8.00 กก.");
  // Linked to a batch, the receive leaves the bucket and the bell goes quiet.
  const batch = ready();
  batch.run("branch", "receive", { kg: "10" }, "");
  batch.run(
    "branch",
    "link",
    { targetId: last(batch).id, lotId: batch.db.lots.at(-1)!.id },
    "",
  );
  expect(unlinkedSummary(batch.db)).toMatchObject({
    meatKg: {},
    meatReceives: 0,
  });
});

test("Open PO counts purchase POs with beef left to send or the meat invoice unpaid", () => {
  const s = setup();
  purchase(s, "40");
  const po = s.db.lots[0];
  expect(openPurchasePos(s.db).map((lot) => lot.id)).toEqual([po.id]);
  confirm(s, "40");
  smokeOrder(s, [[po.id, "40"]], "40", "");
  // Fully drawn, still unpaid: open.
  expect(openPurchasePos(s.db)).toHaveLength(1);
  s.run(
    "owner",
    "meatPayment",
    { paymentDate: day, paidBy: "Owner", paidAmount: "1", slips: "[]" },
    po.id,
  );
  expect(openPurchasePos(s.db)).toHaveLength(0);
});

test("smoked beef at Foodiva is what it took in less what the Owner counted into central", () => {
  const back = returned();
  expect(smokedAtFoodiva(back.db, back.db.lots.at(-1)!)).toBe(36);
  const stocked = ready();
  expect(smokedAtFoodiva(stocked.db, stocked.db.lots.at(-1)!)).toBe(1);
  expect(smokedAtFoodiva(stocked.db, stocked.db.lots[0])).toBe(0);
});

test("DASH-02 counts its 30 days back from today, not from the newest entry", () => {
  const s = setup();
  purchase(s, "40");
  confirm(s, "40");
  dispatch(s, "");
  const batch = s.db.lots.at(-1)!.id;
  // Recorded on their business day, so `at` does not keep the batch active on its own.
  for (const entry of s.db.entries) entry.at = `${day}T08:00:00.000Z`;
  expect(activeBatches(s.db, day).map((lot) => lot.id)).toEqual([batch]);
  expect(activeBatches(s.db, "2026-10-09").map((lot) => lot.id)).toEqual([
    batch,
  ]);
  // More than 30 days after the batch's last entry: nothing is active any more.
  expect(activeBatches(s.db, "2026-10-10")).toEqual([]);
  // An entry recorded within the 30 days (a back-dated one) keeps it active (DASH-02).
  s.db.entries.at(-1)!.at = "2026-10-05T08:00:00.000Z";
  expect(activeBatches(s.db, "2026-10-10").map((lot) => lot.id)).toEqual([
    batch,
  ]);
});

test("จดล่าสุด is the newest live note on the batch, not the furthest along", () => {
  const s = ready();
  const lotId = s.db.lots.at(-1)!.id;
  expect(latestNote(s.db, lotId)).toBe("central");
  // PRIN-02: there is no order, so an "earlier" record written afterwards is the newest.
  s.run("owner", "prepare", { preSmokeKg: "96" }, lotId);
  expect(latestNote(s.db, lotId)).toBe("prepare");
  expect(latestNoteLabel(s.db, lotId)).toBe(titles.prepare);
  // A voided note does not count, even with a live one of its kind before it; the void
  // itself is no note.
  s.run("owner", "central", { centralKg: "34" }, lotId);
  expect(latestNote(s.db, lotId)).toBe("central");
  s.run("owner", "void", { targetId: last(s).id, reason: "ผิดชุด" }, lotId);
  expect(latestNote(s.db, lotId)).toBe("prepare");
  // A branch receive with no lot, linked onto the batch afterwards, counts on that batch.
  s.run("branch", "receive", { kg: "10" }, "");
  expect(latestNote(s.db, lotId)).toBe("prepare");
  s.run("branch", "link", { targetId: last(s).id, lotId }, "");
  expect(latestNote(s.db, lotId)).toBe("receive");
  expect(latestNoteLabel(s.db, "no-such-lot")).toBe("—");
});
