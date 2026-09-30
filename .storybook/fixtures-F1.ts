// Chunk F1: extra branch fixtures, built by the real `mutate` on top of ./fixtures.
import { mutate, type Database } from "@/lib/store";
import { chillDb, day } from "./fixtures";

const branch = "ศาลาแดง";
/** chillDb (day still open) with 20 chili tubes allocated to ศาลาแดง. */
const chiliDb = mutate(
  chillDb,
  "owner",
  "chiliAllocate",
  {
    branch,
    chiliTubes: "20",
    receiver: "ผู้ดูแลศาลาแดง",
    reference: "CHILI-F1",
  },
  "",
  day,
  branch,
);
/** chiliDb plus a sale selling 2 tubes and counting the shelf at `count`
 *  (18 matches, anything else is a mismatch with a remark). */
const chiliCounted = (count: number): Database =>
  mutate(
    chiliDb,
    "branch",
    "sale",
    {
      boxes: "0",
      addons: "0",
      chiliAddons: "2",
      soldKg: "0",
      wasteKg: "0",
      riceWasteKg: "0",
      expense: "0",
      lineMan: "0",
      chiliCount: String(count),
      chiliRemark: count === 18 ? "" : "หลอดแตก 1 หลอด",
    },
    "",
    day,
    branch,
  );

export const chiliMatchDb: Database = chiliCounted(18);
export const chiliMismatchDb: Database = chiliCounted(17);
