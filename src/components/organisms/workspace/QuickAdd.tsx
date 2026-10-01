"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import {
  Dialog,
  skipNextDialogEnter,
} from "@/components/organisms/shared/Dialog";
import { DialogBody } from "@/components/organisms/shared/DialogBody";
import { noteGroups, noteTabs } from "@/components/organisms/shared/noteKinds";
import type { Account } from "@/lib/accounts";
import type { Tab } from "@/lib/nav";
import { titles, type EntryKind } from "@/lib/store";

/**
 * 「จดบันทึก」 in the workspace header: every note the account may record, from any tab.
 * The chooser groups them by what the note is about; picking one opens its form with no
 * lot (the form offers the lot as a field), or goes to the screen a kind is recorded on.
 */
export function QuickAdd({
  account,
  disabled,
  onOpen,
  onTab,
}: {
  account: Account;
  disabled?: boolean;
  /** `ws.open`: the kind's form, on no lot. */
  onOpen: (kind: EntryKind, lotId: string) => void;
  onTab: (tab: Tab) => void;
}) {
  const [choosing, setChoosing] = useState(false);
  const pick = (kind: EntryKind) => {
    setChoosing(false);
    const tab = noteTabs[kind];
    if (tab) return onTab(tab);
    // The form takes the chooser's place: no second enter, focus on its first field.
    skipNextDialogEnter("[data-autofocus]");
    onOpen(kind, "");
  };
  return (
    <>
      <Button
        variant="primary"
        className="max-md:flex-1"
        icon={<Plus />}
        disabled={disabled}
        onClick={() => setChoosing(true)}
      >
        จดบันทึก
      </Button>
      {choosing && (
        <Dialog
          overline="เลือกเรื่องที่จะจด · จดเรื่องไหนเมื่อไรก็ได้"
          title="จดบันทึก"
          closeLabel="ปิด"
          onClose={() => setChoosing(false)}
        >
          <DialogBody>
            {noteGroups(account.role, account.hidesSales).map(
              (group, index) => (
                <section key={group.label} className="mb-5 last:mb-0">
                  <h3 className="mb-2.5 text-body font-medium">
                    {group.label}
                  </h3>
                  <div className="grid grid-cols-2 gap-2.5 max-md:grid-cols-1">
                    {group.kinds.map((kind, first) => (
                      <Button
                        key={kind}
                        // The dialog opens with focus on the first note, not the close button.
                        data-autofocus={index + first === 0 || undefined}
                        className="justify-start text-left whitespace-normal"
                        onClick={() => pick(kind)}
                      >
                        {titles[kind]}
                      </Button>
                    ))}
                  </div>
                </section>
              ),
            )}
          </DialogBody>
        </Dialog>
      )}
    </>
  );
}
