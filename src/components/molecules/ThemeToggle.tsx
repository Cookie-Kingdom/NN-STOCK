"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import {
  applyTheme,
  readThemePref,
  setThemePref,
  subscribeThemePref,
  type ThemePref,
} from "@/lib/theme";

const LABEL: Record<ThemePref, string> = { light: "สว่าง", dark: "มืด" };

/**
 * Switches the colour theme between สว่าง and มืด. A first visit follows the OS theme;
 * the icon shows the current mode and the label says what a press switches to.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const pref = useSyncExternalStore(
    subscribeThemePref,
    readThemePref,
    () => "light" as ThemePref,
  );

  // The inline script in app/layout.tsx sets the class before paint. React's dev-only
  // Strict Mode remount resets <html>'s class to the JSX one, so put it back here.
  useLayoutEffect(() => applyTheme(), []);

  const next: ThemePref = pref === "dark" ? "light" : "dark";
  const Icon = pref === "dark" ? Moon : Sun;
  return (
    <IconButton
      className={className}
      label={`ธีม: ${LABEL[pref]} — กดเพื่อเปลี่ยนเป็น${LABEL[next]}`}
      icon={<Icon size={20} aria-hidden />}
      onClick={() => setThemePref(next)}
    />
  );
}
