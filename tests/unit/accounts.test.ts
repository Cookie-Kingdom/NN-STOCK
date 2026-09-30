import { expect, test } from "vitest";
import { accountById, accounts } from "@/lib/accounts";
import { branchNav, navLabel, ownerNav } from "@/lib/nav";

test("accountById returns known accounts only", () => {
  expect(accountById("minburi")?.branch).toBe("มีนบุรี");
  expect(accountById("nobody")).toBeNull();
  expect(accountById(null)).toBeNull();
  expect(accountById(undefined)).toBeNull();
});

test("navLabel finds a tab in its own nav only", () => {
  expect(navLabel(ownerNav, "po")).toBe("ใบสั่งซื้อ PO");
  expect(navLabel(branchNav, "po")).toBe("");
});

test("every account's home tab is in its role's nav", () => {
  for (const account of accounts)
    expect(
      navLabel(
        account.role === "owner" ? ownerNav : branchNav,
        account.homeTab,
      ),
      account.id,
    ).not.toBe("");
});
