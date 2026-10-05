# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Owner** (`/owner`): runs the shop, sees everything including sales, payroll and profit. Opens the app to check how the shop is doing and to jot the steps of the partners (the meat supplier and the smoker).
- **Account Manager** (`/owner`, `hidesSales`): keeps the books; never sees sales, payroll, P&L, Overview or Settings.
- **Branch accounts** (`/branch`: ศาลาแดง, มีนบุรี): jot the day's sales, receipts and counts, mostly on a phone.

Foodiva (meat supplier) and Chef House (smoker) are partners, not users.

## Product Purpose

A note-taking app for the accounts and stock of a meat supply chain. Accounts jot notes; the web works out every figure (stock, cost, money, P&L) from the append-only entry log. Nothing computed is stored. Success: the Owner trusts the figures without keeping a spreadsheet beside it.

## Operating Context

- The UI is in Thai; page names are English.
- Any note can be jotted at any time, backdated or not; there is no forced order. A missing core field is saved and shown as "ยังไม่ได้จด".
- Sales are jotted per branch per day, per sales channel; each channel has a GP percentage.
- Pages of a project sit in a sidebar section named after it. One project exists today: "Nerdnuea x LINE MAN".

## Capabilities and Constraints

- Confirmed 2026-10-05: more projects of the same shape (boxes sold through sales channels, per branch) will be added. The Owner's Overview becomes the shop's Revenue across every project, shown with revenue and operating profit, switchable between a month and a year.
- Undecided: how a second project is stored (today every PO and sale belongs to the one project).
- The domain core (`src/lib/store`) is pure; every change goes through `mutate`.

## Brand Commitments

- Token system in `src/styles/tokens.css`: slate neutrals, blue accent, a warm-graphite dark theme; Noto Sans Thai Looped.
- State colours are business rules: green is money in, red is money out, amber is a warning.

## Evidence on Hand

- Spec: vault `Spec/Account Stocking v2/Spec v2.md`.
- Sample data set: `src/lib/store/demo.ts`. It holds one project; figures for other projects in a mock are synthetic and must be labelled so.

## Product Principles

1. Numbers are the product: tabular, aligned, always traceable to the notes behind them.
2. Never invent a figure: what is not jotted is shown as not jotted.
3. Each account sees only what it may see.
4. The same vocabulary on every page; familiarity over surprise.
