import { expect, test } from "vitest";
// Aliased: it is a plain function despite the name, and the alias keeps the hooks lint rule quiet.
import { useFoodivaAlerts as foodivaAlerts } from "@/components/organisms/foodiva/useFoodivaAlerts";
import { seed } from "@/lib/store";
import {
  closed,
  confirm,
  dispatch,
  packingList,
  purchase,
  request,
  returned,
  setup,
} from "./fixtures";

const titles = (db: Parameters<typeof foodivaAlerts>[0]) =>
  foodivaAlerts(db).notifications.map((item) => item.title);

test("an empty database asks Foodiva for nothing", () => {
  const alerts = foodivaAlerts(structuredClone(seed));
  expect(alerts.notifications).toEqual([]);
  expect(alerts.badges).toEqual({ foodiva: 0, history: 0 });
});

test("each document Foodiva owes shows up, and drops off once it is filed", () => {
  const s = setup();
  purchase(s, "50");
  expect(foodivaAlerts(s.db).notifications[0]).toEqual({
    title: "ออก Invoice เนื้อ · PO-2026-0001",
    detail: "ยืนยันน้ำหนักและแนบ Invoice ของ PO 50.00 กก.",
    tab: "foodiva",
  });
  expect(foodivaAlerts(s.db).badges.foodiva).toBe(1);

  confirm(s, "50");
  request(s, [["F260909-001", "50"]]);
  expect(titles(s.db)).toEqual(["ทำใบขนส่งขาไป · SH-2026-0001"]);

  dispatch(s);
  expect(titles(s.db)).toEqual(["ทำ Packing List · SH-2026-0001"]);

  packingList(s, "25\n24.5");
  // Owner's move next (the smoke PO): nothing is waiting on Foodiva.
  expect(titles(s.db)).toEqual([]);
  expect(foodivaAlerts(s.db).badges.foodiva).toBe(0);
});

test("a return truck waits for Foodiva to weigh the smoked meat into its freezer", () => {
  const s = closed();
  expect(titles(s.db)).toEqual([]); // Chef House's invoice is not Foodiva's problem
  s.run("owner", "return", {
    returnDate: "2026-09-09",
    returnTime: "09:00",
    origin: "Chef House",
    destination: "Foodiva",
    vehicleType: "รถห้องเย็น",
    plate: "กข123",
    driverName: "คนขับ",
    driverPhone: "0800000000",
    returnKg: "36",
  });
  expect(foodivaAlerts(s.db).notifications).toEqual([
    {
      title: "ชั่งรับเนื้อรมควันเข้าตู้ · SH-2026-0001",
      detail: "เนื้อจาก Chef House 360 กล่องรมควัน อยู่บนรถขากลับ",
      tab: "foodiva",
    },
  ]);
  // Once Foodiva has weighed it in, the lot waits on the Owner's central count.
  expect(titles(returned().db)).toEqual([]);
});

test("every Foodiva alert points at a tab Foodiva actually has", () => {
  const s = closed();
  purchase(s, "60");
  const tabs = foodivaAlerts(s.db).notifications.map((item) => item.tab);
  expect(tabs.length).toBeGreaterThan(0);
  for (const tab of tabs) expect(["foodiva", "history"]).toContain(tab);
});
