# Accounting import fidelity

The authoritative source is the `Web Import (Project)` worksheet. Correct each existing transaction by its verified ID, date, direction and amount; keep the entry history. The opening row is an existing cash opening, not income.

Native item, category, description, supplier/customer, reference, project and amount come from the source cells. `values.importedAccounting` retains only source display values that the application otherwise replaces: source label, category, SKU, purpose label and status label. Explicit empty cells stay empty. Native source/status/project continue to control calculations and permissions. Source fields R–U and workbook/row/hash provenance stay in the note.

Manual edits retain unaffected source cells. Changing a native source, category, item/SKU, project/purpose or status retires its corresponding display override. Imported items display their saved item name rather than a catalogue rename. Unknown override keys, non-string values and malformed JSON are rejected.

Verification:

- AccountingPage / ImportedAccounting in Storybook: original source/status, supplier and description; blank SKU and purpose. Check both themes and phone width.
- Unit tests cover imported expense/income labels, financial isolation, unrelated edits, affected-cell invalidation and malformed input.
- Corrective import compares all 21 columns of all 267 transactions (5,607 cells), including blanks and source notes. The opening row is checked separately.
- Expected opening 1,085,055.86; income 4,085,389.06; spending 4,258,085.90; remaining 912,359.02; employee reimbursement liability 218,559.42.
- No user, branch, attachment, lot or prior audit entry is changed. Applying data does not deploy the rendering change.
