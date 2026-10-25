/* The cells of the plain tables (Finance, Overview, Inventory, Settings). */
export const th =
  "border-b border-border-strong bg-surface-head px-5 py-2 text-left text-caption font-semibold whitespace-nowrap text-text-primary max-md:px-2.5";
export const td =
  "border-b border-border px-5 py-3 align-middle text-body-sm max-md:px-2.5 [tr:last-child>&]:border-b-0";
/* A total row's cell in a `tfoot`, over `td`: the head's fill, behind a firmer rule. */
export const tf = "border-t border-border-strong bg-surface-head font-semibold";
/* Every table's grid, as the Accounting ledger drew it first: a line between the columns,
   the row under the pointer, and a narrower inset than th/td's, so more columns fit. */
export const grid =
  "w-full border-collapse [&_tbody_tr:hover]:bg-surface-sunken [&_td]:border-r [&_td]:px-3 [&_td:last-child]:border-r-0 [&_th]:border-r [&_th]:px-3 [&_th:last-child]:border-r-0";
