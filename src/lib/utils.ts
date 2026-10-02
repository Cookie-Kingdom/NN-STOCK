import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * `cn` for all components. Unlike stock `twMerge`, this
 * one knows the custom type scale in `tokens.css`. Stock tailwind-merge reads
 * `text-body` / `text-caption` / `text-num-lg` as *colours*, so
 * `cn("text-body", "text-accent")` silently drops the font size.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        "h1",
        "h2",
        "h3",
        "body",
        "body-sm",
        "label",
        "caption",
        "num-lg",
        "num-md",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
