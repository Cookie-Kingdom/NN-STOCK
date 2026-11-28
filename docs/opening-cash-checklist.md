# Opening cash and employee-paid Accounting expenses

The Owner's configuration may store `cashOpeningBalances` as a JSON list of `{ id, date, amount, purpose, project, note? }`. Amount is a nonnegative decimal string with up to two decimals; date is a real day from 2020 through today. One opening is permitted per company/project scope; IDs are unique. Company has `project: ""`; project scopes require their name. No Settings editor or schema change is included.

`cashOpening(db, through, project?)` reads opening cash effective on or before `through`. It contributes only to the cash summary's carried balance. It creates no ledger transaction, cash inflow, chart revenue or P&L income. Owner Accounting aggregates scopes; project Finance reads its own scope. Branch-scoped configuration excludes the key.

Accounting's MoneySummary and cash chart now use `cashBetween`, distinguishing company cash out from employee-paid expenses. The transactional ledger totals remain unchanged. Paid Accounting expenses with source `advance` retain an optional `payer`; `advances(db, project?)` includes these obligations without duplicating Finance pay notes. Existing reimburse notes remain shop-only. Unknown payers remain owed, show as missing, and have no reimbursement action until identified.

- Storybook AccountingPage / OpeningCash and FinancePage / OpeningCash: opening 1,000 + received 300 - company cash 100 = cash 1,200; employee expense 40 remains in expense totals and owed. Toggle light/dark and inspect phone width.
- Composer / AdvancedExpense: payer is visible for source advance, retained on save/edit, and removed when payment source changes.
- Before effective date, opening reads 0; on its date it applies once. October close carries into November and yearly view without duplication.
- Opening must not appear as ledger row, income/P&L revenue or cash inflow chart. Paragon and branch views must not receive LINE MAN opening.
- For Web Import: opening 1,085,055.86 + income 4,085,389.06 - company cash 4,039,526.48 = 1,130,918.44; employee-paid 218,559.42 is still owed. Expense table total remains 4,258,085.90. If reimbursed later, cash falls by the reimbursement once and expenses are not counted again.
- Reject malformed JSON, invalid/future dates, negative or fractional-satang amounts, duplicate IDs or duplicate scope openings. A corrupted stored opening fails closed to zero.

Focused money tests live in `tests/unit/cash-opening.test.ts`. No E2E suite or UI browser validation is claimed. For an opening dated mid-period, that period shows it in carried cash rather than as current-period inflow; the imported opening is the first day of its month.
