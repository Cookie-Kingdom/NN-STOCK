"use client";

import { useState } from "react";
import type { Prefill, PrefillSource } from "@/lib/prefill";
import type { Values } from "@/lib/store";

type State = {
  /** The form's own defaults: a key a refill no longer fills goes back to its default. */
  base: Values;
  values: Values;
  sources: Record<string, PrefillSource>;
  /** Keys the user has changed: a refill never writes over them. */
  touched: Set<string>;
  /** Keys the last fill wrote, so a refill can clear one the new fill no longer has. */
  filled: Set<string>;
};

/**
 * Form values that start from a prefill and remember which keys the user has changed.
 * `set` is the user's edit: the key is theirs from then on and loses its caption.
 * `refill` is for a selection the prefill depends on (a lot, an allocation, a branch):
 * call it from that control's change handler with the prefill for the new selection,
 * and it rewrites only the keys the user has not touched. `reset` hands keys back to
 * the prefill first (an allocation picked for the old lot means nothing on the new one).
 */
export function usePrefill(initial: () => { base: Values; prefill: Prefill }) {
  const [state, setState] = useState<State>(() => {
    const { base, prefill } = initial();
    return {
      base,
      values: { ...base, ...prefill.values },
      sources: { ...prefill.sources },
      touched: new Set(),
      filled: new Set(Object.keys(prefill.values)),
    };
  });
  const set = (key: string, value: string) =>
    setState((s) => {
      const sources = { ...s.sources };
      delete sources[key];
      return {
        ...s,
        values: { ...s.values, [key]: value },
        sources,
        touched: new Set(s.touched).add(key),
      };
    });
  const refill = (prefill: Prefill, reset: string[] = []) =>
    setState((s) => {
      const touched = new Set(s.touched);
      for (const key of reset) touched.delete(key);
      const values = { ...s.values };
      const sources: State["sources"] = {};
      const filled = new Set<string>();
      for (const key of new Set([
        ...s.filled,
        ...Object.keys(prefill.values),
        ...reset,
      ])) {
        if (touched.has(key)) continue;
        values[key] = prefill.values[key] ?? s.base[key] ?? "";
        if (key in prefill.values) filled.add(key);
        if (prefill.sources[key]) sources[key] = prefill.sources[key];
      }
      return { ...s, values, sources, filled, touched };
    });
  return { values: state.values, sources: state.sources, set, refill };
}
