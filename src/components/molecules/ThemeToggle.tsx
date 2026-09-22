"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { IconButton } from "@/components/atoms/IconButton";
import {
  applyTheme,
  nextThemePref,
  readThemePref,
  setThemePref,
  subscribeThemePref,
  type ThemePref,
} from "@/lib/theme";

const LABEL: Record<ThemePref, string> = {
  system: "ระบบ",
  light: "สว่าง",
  dark: "มืด",
};

const ICON: Record<ThemePref, typeof Sun> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

/**
 * Cycles the colour theme: ระบบ (follow the OS, the default) → สว่าง → มืด. The icon
 * shows the current setting; the label says what it is and what a press switches to.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const pref = useSyncExternalStore(
    subscribeThemePref,
    readThemePref,
    () => "system" as ThemePref,
  );

  // The inline script in app/layout.tsx sets the class before paint. React's dev-only
  // Strict Mode remount resets <html>'s class to the JSX one, so put it back here.
  useLayoutEffect(() => applyTheme(), []);

  const next = nextThemePref(pref);
  const Icon = ICON[pref];
  return (
    <IconButton
      className={className}
      label={`ธีม: ${LABEL[pref]} — กดเพื่อเปลี่ยนเป็น${LABEL[next]}`}
      icon={<Icon size={20} aria-hidden />}
      onClick={() => setThemePref(next)}
    />
  );
}
