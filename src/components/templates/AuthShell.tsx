import type { ReactNode } from "react";
import { Panel } from "@/components/atoms/Panel";
import { Footnote, Muted } from "@/components/atoms/Text";
import { ThemeToggle } from "@/components/molecules/ThemeToggle";
import { AppBrand } from "@/components/organisms/workspace/AppHeader";

/**
 * The signed-out page layout: one centred card on the app background, headed by the
 * `AppBrand` the workspace header also uses. Sign-in, sign-up and anything else a
 * visitor without an account reaches are the same layout with different `children`,
 * so the route supplies only its form. `WorkspaceShell` is the layout for everything
 * after sign-in.
 */
export function AuthShell({
  title,
  description,
  /** The closing line under the card, above nothing — account rules, help, terms. */
  footnote,
  children,
}: {
  title: ReactNode;
  description?: ReactNode;
  footnote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen place-items-center bg-bg px-4 py-8 text-body text-text-primary">
      <Panel className="w-full max-w-115 p-7.5 shadow-xs">
        <div className="mb-5.5 flex items-start justify-between gap-3 border-b border-border pb-5.5">
          {/* Not `responsive`: the card is already narrow, so the h2 title fits a phone. */}
          <AppBrand />
          <ThemeToggle className="-mt-1.5 -mr-2" />
        </div>
        <h1 className="mb-1 text-h1">{title}</h1>
        {description && <Muted className="text-body-sm">{description}</Muted>}
        {children}
        {footnote && (
          <Footnote className="mt-0 border-t border-border pt-4">
            {footnote}
          </Footnote>
        )}
      </Panel>
    </div>
  );
}
