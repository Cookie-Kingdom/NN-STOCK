"use client";

import { useId, useRef, useState, type ComponentProps } from "react";
import { ChevronDown } from "lucide-react";
import { Input, type ControlVariantProps } from "@/components/atoms/Input";
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
 * or picked. To pick from a fixed list only, use `Select`; from a list that grows,
 * `SearchSelect`.
 *
 * `strict`: still typed and searched, but only an option stands. On blur, text that is an
 * option's `value` (case and outer spaces aside) becomes that value; any other is cleared.
 *
 * `onPick` gets a suggestion picked from the list in place of `onChange`, for a caller that
 * tells a pick from typed text.
 *
 * Keyboard: arrows move, Enter picks the highlighted suggestion, Escape closes the list.
 */
export function Combobox({
  options,
  value,
  onChange,
  onPick = onChange,
  strict,
  className,
  ...props
}: Omit<ComponentProps<"input">, "value" | "onChange"> &
  ControlVariantProps & {
    options: Option[];
    value: string;
    onChange: (value: string) => void;
    onPick?: (value: string) => void;
    strict?: boolean;
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
    if (shown[index]) onPick(shown[index].value);
  };

  return (
    // The `form` variant's top margin is the wrapper's; the other variants have none.
    <span
      className={cn(
        "relative block",
        (props.variant ?? "form") === "form" && "mt-2",
      )}
    >
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
        onBlur={() => {
          setList(null);
          if (!strict) return;
          const match =
            options.find((o) => o.value.trim().toLowerCase() === text)?.value ??
            "";
          if (match !== value) onChange(match);
        }}
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

/**
 * A `Select` that is searched, for a list that grows (lots, materials, products): the same
 * `options`, `value` and `onChange` (an option's `value`, never the typed text). Typing
 * narrows the list by label and hint; only a pick, or a typed label on leaving the field,
 * changes the value; any other text is dropped then. The option whose value is `""` is the
 * placeholder too: clearing the text chooses it, as its row does.
 */
export function SearchSelect({
  options,
  value,
  onChange,
  placeholder,
  ...props
}: Omit<ComponentProps<typeof Combobox>, "strict" | "onPick">) {
  /** The text being typed; `null` while the field reads the chosen option. */
  const [typed, setTyped] = useState<string | null>(null);
  const labelOf = (option: Option) => option.label ?? option.value;
  const none = options.find((option) => option.value === "");
  const chosen = value && options.find((option) => option.value === value);
  const commit = (text: string) => {
    const key = text.trim().toLowerCase();
    const hit = key
      ? options.find((option) => labelOf(option).trim().toLowerCase() === key)
      : none;
    setTyped(null);
    if (hit && hit.value !== value) onChange(hit.value);
  };
  return (
    <span className="contents" onBlur={() => typed !== null && commit(typed)}>
      <Combobox
        {...props}
        data-value={value}
        placeholder={placeholder ?? (none && labelOf(none))}
        // ponytail: a row is its label, so two options of one label read as one; give the
        // rows their own keys if a list ever holds such a pair.
        options={options.map((option) => ({
          value: labelOf(option),
          label: option.hint,
        }))}
        value={typed ?? (chosen ? labelOf(chosen) : value)}
        // A click on a chosen field types over it.
        onFocus={(event) => event.target.select()}
        onChange={setTyped}
        onPick={commit}
      />
    </span>
  );
}
