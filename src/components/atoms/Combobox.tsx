"use client";

import { useId, useRef, useState, type ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/atoms/Input";
import {
  dropdownFocus,
  OptionList,
  useDropdown,
  type Option,
} from "@/components/atoms/Select";
import { cn } from "@/lib/utils";

/**
 * A text field with suggestions: any typed text stands, and `options` are offered in a
 * list under it (an option's `value` is the text it types; a `label` that differs is
 * shown beside it and is searched too). A click or an arrow key lists them all; typing narrows the list to the
 * ones that hold the typed text, shown strong in each. `onChange` gets the text, typed
 * or picked. To pick from a fixed list only, use `Select`.
 *
 * Keyboard: arrows move, Enter picks the highlighted suggestion, Escape closes the list.
 */
export function Combobox({
  options,
  value,
  onChange,
  className,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange"> & {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const control = useRef<HTMLInputElement>(null);
  /** `null` while the list is closed. `active` is -1 until an arrow or the pointer picks
   *  a row; `narrow` once the text was typed since the list opened. */
  const [list, setList] = useState<{ active: number; narrow: boolean } | null>(
    null,
  );
  const text = value.trim().toLowerCase();
  const shown =
    list?.narrow && text
      ? options.filter((option) =>
          [option.value, option.label ?? ""].some((s) =>
            s.toLowerCase().includes(text),
          ),
        )
      : options;
  const open = list !== null && shown.length > 0;
  const popup = useDropdown(open, control);

  const choose = (index: number) => {
    setList(null);
    if (shown[index]) onChange(shown[index].value);
  };

  return (
    <span className="relative mt-2 block">
      <Input
        ref={control}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={
          open && list.active >= 0 ? `${id}-${list.active}` : undefined
        }
        autoComplete="off"
        value={value}
        className={cn("mt-0 pr-10", dropdownFocus, className)}
        onChange={(event) => {
          onChange(event.target.value);
          setList({ active: -1, narrow: true });
        }}
        // Not on focus: a Dialog focuses its first field as it opens.
        onClick={() => setList(list ?? { active: -1, narrow: false })}
        onBlur={() => setList(null)}
        onKeyDown={(event) => {
          const { key } = event;
          if (key === "ArrowDown" || key === "ArrowUp") {
            if (!shown.length) return;
            event.preventDefault();
            const step = key === "ArrowDown" ? 1 : -1;
            setList(
              open
                ? {
                    ...list,
                    active: Math.max(
                      0,
                      Math.min(shown.length - 1, list.active + step),
                    ),
                  }
                : { active: 0, narrow: false },
            );
          } else if (key === "Enter" && open && list.active >= 0) {
            // Otherwise Enter is the form's, as in any text field.
            event.preventDefault();
            choose(list.active);
          } else if (key === "Escape" && open) {
            // Inside a Dialog, Escape closes the list and leaves the form open.
            event.preventDefault();
            event.stopPropagation();
            setList(null);
          }
        }}
        {...props}
      />
      <ChevronDown
        size={16}
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-secondary transition-transform duration-(--motion-base) ease-(--ease-enter)",
          open && "rotate-180",
        )}
      />
      {open && (
        <OptionList
          id={id}
          ref={popup}
          // The text that a pick types is the row; a label that differs (a SKU) sits beside it.
          options={shown.map(({ value, label }) => ({
            value,
            hint: label === value ? undefined : label,
          }))}
          value={value}
          active={list.active}
          mark={list.narrow ? value.trim() : ""}
          onActive={(active) => setList({ ...list, active })}
          onChoose={choose}
        />
      )}
    </span>
  );
}
