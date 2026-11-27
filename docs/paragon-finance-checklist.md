# Paragon Finance verification

Scope: Owner sidebar group `Nerdnuea x Paragon`, with only Finance at `/owner/nn-x-prg/finance`. It reads Accounting income and expense notes whose project exactly matches that name.

- Open FinancePage / Paragon and ParagonPhone in Storybook; use the theme toolbar to inspect light and dark. Fixture includes LINE MAN records and Paragon income/expense, built through `mutate`.
- Open AppSidebar / Paragon; confirm the new group contains Finance alone and its selected route differs from LINE MAN Finance. At phone width, find the group in Menu.
- Confirm branch accounts still have only Sales, Stock, Inventory and Daily Log.
- Open `/owner/nn-x-prg/finance` in the app; compare money totals, cash chart, P&L and latest records with Accounting filtered to Project `Nerdnuea x Paragon`.
- Confirm LINE MAN payments, reimbursements, sales, supplier debt and channel receivables do not appear in Paragon Finance. Existing LINE MAN Finance remains unchanged.
- Open each Paragon header action; expense and income default to purpose Project and Project `Nerdnuea x Paragon`. Save-and-jot-another should keep that project.
- Edit or delete a Paragon note and verify the change affects its figures. Writes use the complete workspace database, preserving other projects.
- Revisit the route directly and reload; production static route generation includes it.

Implementation reuses FinancePage and existing header/composer/sidebar. No schema, authorization, calculations or remote records are changed by these UI files. The read-only Paragon projection resolves edit/delete overlays before filtering; save/edit actions retain the original workspace.

Automated unit/E2E suites were not requested. Build/lint, Storybook compilation and a focused assert-based routing/project isolation check are recorded in the implementation report.
