/**
 * Light / dark theme preference. The `.dark` class on <html> is the one switch the token
 * layer (`styles/tokens.css`) and Storybook read. The preference is per browser, kept in
 * localStorage; "system" (the default) stores nothing and follows `prefers-color-scheme`.
 */

export type ThemePref = "system" | "light" | "dark";

export const THEME_STORAGE_KEY = "nn-theme";
const CHANGE_EVENT = "nn-themechange";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Order the toggle cycles through. */
export const THEME_ORDER: ThemePref[] = ["system", "light", "dark"];

/**
 * Runs in <head> before first paint (see app/layout.tsx), so the saved theme shows with
 * no flash. It keeps listening: in "system" an OS switch applies straight away, and a
 * choice made in another tab applies here too. Must stay in step with `applyTheme`.
 */
export const themeInitScript = `(()=>{const k=${JSON.stringify(THEME_STORAGE_KEY)},m=matchMedia(${JSON.stringify(DARK_QUERY)}),s=()=>{let p=null;try{p=localStorage.getItem(k)}catch(e){}document.documentElement.classList.toggle("dark",p==="dark"||(p!=="light"&&m.matches))};s();m.addEventListener("change",s);addEventListener("storage",e=>{if(e.key===k||e.key===null)s()})})()`;

export function readThemePref(): ThemePref {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (value === "light" || value === "dark") return value;
  } catch {
    // Storage blocked (private mode, sandboxed frame): fall back to the system theme.
  }
  return "system";
}

/** Sets the `.dark` class on <html> for `pref`. */
export function applyTheme(pref: ThemePref = readThemePref()) {
  const dark =
    pref === "dark" || (pref === "system" && matchMedia(DARK_QUERY).matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function setThemePref(pref: ThemePref) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Not persisted; the choice still applies to this page.
  }
  applyTheme(pref);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** For `useSyncExternalStore`: fires when this tab or another one changes the preference. */
export function subscribeThemePref(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function nextThemePref(pref: ThemePref): ThemePref {
  return THEME_ORDER[(THEME_ORDER.indexOf(pref) + 1) % THEME_ORDER.length];
}
