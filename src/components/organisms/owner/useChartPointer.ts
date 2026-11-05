"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

/** Which bucket of a bar chart's plot shows its figures (`at`, −1: none), read from the
 *  pointer's x over `plotRef`'s element. A mouse clears it on leaving the plot; a tap or a
 *  drag (iPad) leaves it up where the finger stopped, until a press anywhere outside the
 *  plot (the axis, the legend, the page): iPad Safari moves no focus on a tap, so the
 *  chart's `onBlur` alone would never close it. */
export function useChartPointer(count: number) {
  const [at, setAt] = useState(-1);
  const plotRef = useRef<HTMLDivElement>(null);
  const open = at >= 0;
  useEffect(() => {
    if (!open) return;
    const close = (event: globalThis.PointerEvent) => {
      if (!plotRef.current?.contains(event.target as Node)) setAt(-1);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  /** The bucket under the pointer, by where it is across the plot. */
  const pointAt = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const i = Math.floor(((event.clientX - box.left) / box.width) * count);
    setAt(Math.max(0, Math.min(count - 1, i)));
  };
  return {
    at,
    setAt,
    plotRef,
    plotProps: {
      // Read from the finger's x, not each bucket's enter: a touch stays captured by the
      // bucket it began on, so a sideways drag would not move off it. The plot's
      // touch-pan-y leaves the sideways drag to us.
      onPointerDown: pointAt,
      onPointerMove: pointAt,
      // A touch fires leave as the finger lifts: only a mouse clears on leaving.
      onPointerLeave: (event: PointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse") setAt(-1);
      },
    },
  };
}
