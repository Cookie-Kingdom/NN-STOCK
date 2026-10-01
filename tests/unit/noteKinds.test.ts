import { describe, expect, it } from "vitest";
import {
  lotRequiredKinds,
  noteGroups,
  poLotKinds,
} from "@/components/organisms/shared/noteKinds";
import { defaults } from "@/lib/forms";
import { today } from "@/lib/format";
import {
  batchKinds,
  check,
  mutate,
  seed,
  titles,
  type ActingRole,
  type EntryKind,
} from "@/lib/store";
import { retiredKinds } from "@/lib/store/model";

const kindsOf = (role: ActingRole, hidesSales = false) =>
  noteGroups(role, hidesSales).flatMap((group) => group.kinds);

/** What mutate refuses `kind` with when `role` records it on no lot ("" when it saves). */
const refusal = (role: ActingRole, kind: EntryKind) =>
  check(() =>
    mutate(
      seed,
      role,
      kind,
      defaults(kind, today()),
      "",
      today(),
      role === "branch" ? "ศาลาแดง" : "",
    ),
  ).error;

// Corrections, bookkeeping, the settings and the legacy kind: never a note.
const notNotes: EntryKind[] = [
  "chefEdit",
  "config",
  "void",
  "entryEdit",
  "editRequest",
  "editDecision",
  "link",
  "steakTransfer",
];

describe("จดบันทึก (noteKinds)", () => {
  it.each(["owner", "branch"] as const)(
    "offers %s every kind mutate lets it record, and no other",
    (role) => {
      const allowed = (Object.keys(titles) as EntryKind[]).filter(
        (kind) =>
          !retiredKinds.includes(kind) &&
          !notNotes.includes(kind) &&
          refusal(role, kind) !== "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้",
      );
      expect(kindsOf(role).sort()).toEqual(allowed.sort());
    },
  );

  it("requires a lot only where mutate refuses the kind without one", () => {
    const lotKinds = kindsOf("owner").filter(
      (kind) => batchKinds.includes(kind) || poLotKinds.includes(kind),
    );
    expect(lotKinds.filter((kind) => refusal("owner", kind)).sort()).toEqual(
      [...lotRequiredKinds].sort(),
    );
  });

  it("offers no form that asks for sale money to an account that hides sales", () => {
    expect(kindsOf("branch")).toContain("sale");
    expect(kindsOf("branch", true)).not.toContain("sale");
    // The Account Manager acts as the Owner: none of the Owner's notes carries sale money.
    expect(kindsOf("owner", true)).toEqual(kindsOf("owner"));
  });
});
