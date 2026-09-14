import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "../outputs/01a09546-2cbe-7162-a99e-dac0bf15ed7b";
const videoPath = "artifacts/nerdnuea-full-loop.webm";
const runDate = new Date("2026-09-12T00:00:00+07:00");
const font = "Arial";

const cases = [
  ["UAT-OWN-001", "Owner", "Stock", "Record central chili purchase", "Open All Stock, record 20 chili tubes with supplier, unit price and receipt reference", "Purchase is saved and central stock/cost increases", "Passed"],
  ["UAT-OWN-002", "Owner", "Stock", "Allocate chili to Sala Daeng", "Allocate 10 tubes and record receiver/reference", "Sala Daeng opening chili stock increases", "Passed"],
  ["UAT-OWN-003", "Owner", "Stock", "Allocate chili to Min Buri", "Allocate 10 tubes and record receiver/reference", "Min Buri opening chili stock increases", "Passed"],
  ["UAT-OWN-004", "Owner", "Meat PO", "Create Foodiva meat PO", "Enter company, contact, tax, packing, 500 kg and unit price", "PO is saved and appears for Foodiva", "Passed"],
  ["UAT-FD-001", "Foodiva", "Invoice", "Receive PO and upload meat invoice", "Enter invoice number, 500 kg, total amount, attach PDF and confirm", "Invoice is linked to the PO and submitted", "Passed"],
  ["UAT-OWN-005", "Owner", "Smoking PO", "Create Chef_house smoking PO", "Create service PO for 500 kg with production instruction", "Smoking PO appears in Chef_house work", "Passed"],
  ["UAT-CHF-001", "Chef_house", "Smoking PO", "Accept smoking PO", "Open production work and confirm receipt of smoking PO", "PO status changes to accepted", "Passed"],
  ["UAT-CHF-002", "Chef_house", "Billing", "Submit service invoice", "Enter invoice number, attach the invoice PDF and enter details; the system calculates the smoking fee", "Owner receives invoice alert for review", "Passed"],
  ["UAT-OWN-006", "Owner", "Billing", "Review Chef_house invoice", "Open Invoice menu, inspect invoice and enter reviewer name", "Invoice is approved for payment", "Passed"],
  ["UAT-OWN-007", "Owner", "Payment", "Record Chef_house payment", "Enter amount, operator and payment reference", "Payment is recorded against service invoice", "Passed"],
  ["UAT-OWN-008", "Owner", "Transport", "Create outbound transport document", "Select Bangkok to Chiang Mai and enter pickup time, vehicle, driver and 500 kg", "Transport is linked to PO/Lot", "Passed"],
  ["UAT-CHF-003", "Chef_house", "Receiving", "Receive raw meat", "Select arrival, enter arrival time and actual 500 kg", "Received weight is stored for the Lot", "Passed"],
  ["UAT-CHF-004", "Chef_house", "Production", "Record pre-smoke weight", "Enter 500 kg after unpacking/preparation", "Pre-smoke weight is stored", "Passed"],
  ["UAT-CHF-005", "Chef_house", "Production", "Record smoked output bags", "Enter 500 kg batch and five bags of 100 kg", "Five bags and total output are available to Owner", "Passed"],
  ["UAT-CHF-006", "Chef_house", "Production", "Close production Lot", "Enter closer name and confirm Lot close", "Lot is locked and ready for return transport", "Passed"],
  ["UAT-OWN-009", "Owner", "Transport", "Create return transport document", "Select Chiang Mai to Bangkok and record vehicle/driver/500 kg", "Return transport is linked to the Lot", "Passed"],
  ["UAT-FD-002", "Foodiva", "Receiving", "Receive smoked meat return", "Confirm 500 kg returned from Chef_house", "Smoked stock is held at Foodiva", "Passed"],
  ["UAT-OWN-010", "Owner", "Central Stock", "Receive smoked meat into central stock", "Confirm transfer from Foodiva", "Central smoked meat stock becomes available", "Passed"],
  ["UAT-OWN-011", "Owner", "Allocation", "Allocate bags to both branches", "Assign two bags to Sala Daeng and two bags to Min Buri", "Each branch receives a pending allocation", "Passed"],
  ["UAT-SAL-001", "Sala Daeng", "Receiving", "Receive branch allocation", "Select allocation and confirm 200 kg / 2 bags", "Frozen branch stock increases", "Passed"],
  ["UAT-SAL-002", "Sala Daeng", "Defrost", "Defrost meat", "Record 0.1 kg / 1 bag for daily use", "Ready-to-sell quantity increases", "Passed"],
  ["UAT-SAL-003", "Sala Daeng", "Materials", "Record daily material use", "Complete material usage table", "Material balances update", "Passed"],
  ["UAT-SAL-004", "Sala Daeng", "Rice", "Purchase and process raw sticky rice", "Record supplier, 5 kg purchase, cost, issue and cooking output", "Raw/cooked rice records update", "Passed"],
  ["UAT-SAL-005", "Sala Daeng", "Sales", "Record sales and chili variance", "Record standard box, chili sale, actual count, variance remark, meat weight and LINE MAN sales", "Stock and daily revenue update", "Passed"],
  ["UAT-SAL-006", "Sala Daeng", "Day Close", "Close branch day", "Enter branch manager name and confirm", "Daily record is locked and shown as closed", "Passed"],
  ["UAT-MIN-001", "Min Buri", "Receiving", "Receive branch allocation", "Select allocation and confirm 200 kg / 2 bags", "Frozen branch stock increases", "Passed"],
  ["UAT-MIN-002", "Min Buri", "Defrost", "Defrost meat", "Record 0.1 kg / 1 bag for daily use", "Ready-to-sell quantity increases", "Passed"],
  ["UAT-MIN-003", "Min Buri", "Materials", "Record daily material use", "Complete material usage table", "Material balances update", "Passed"],
  ["UAT-MIN-004", "Min Buri", "Rice", "Purchase cooked sticky rice and carry remainder", "Record supplier, 32 kg purchase, cost, 31.8 kg remainder and variance reason", "Purchase and next-day carry are saved", "Passed"],
  ["UAT-MIN-005", "Min Buri", "Sales", "Record sales and chili variance", "Record standard box, chili sale, actual count, variance remark, meat weight and LINE MAN sales", "Stock and daily revenue update", "Passed"],
  ["UAT-MIN-006", "Min Buri", "Day Close", "Close branch day", "Enter branch manager name and confirm", "Daily record is locked and shown as closed", "Passed"],
  ["UAT-OWN-012", "Owner", "Dashboard", "Review final dashboard", "Return to Owner after both branch day closes", "Dashboard loads with completed workflow data", "Passed"],
];

const wb = Workbook.create();
const summary = wb.worksheets.add("UAT Summary");
const tests = wb.worksheets.add("Test Cases");
const signoff = wb.worksheets.add("Sign-off");

for (const sheet of [summary, tests, signoff]) {
  sheet.showGridLines = false;
  sheet.getRange("A1:Z200").format.font = { name: font, size: 10, color: "#26332F" };
}

summary.getRange("A1:H1").merge();
summary.getRange("A1").values = [["NerdNuea Stock UAT"]];
summary.getRange("A1").format.font = { name: font, size: 18, bold: true, color: "#153F38" };
summary.getRange("A2:H2").merge();
summary.getRange("A2").values = [["Playwright full business loop across Owner, Foodiva, Chef_house, Sala Daeng and Min Buri"]];
summary.getRange("A2").format.font = { name: font, size: 10, italic: true, color: "#65736E" };
summary.getRange("A4:B9").values = [
  ["Test date", runDate],
  ["Environment", "Local · http://localhost:3000/"],
  ["Automation", "Playwright 1.63.0 · Chromium"],
  ["Recorded evidence", videoPath],
  ["Automated result", "Passed"],
  ["Scope", "One complete business loop and one daily close for each branch"],
];
summary.getRange("A4:A9").format.font = { name: font, bold: true, color: "#153F38" };
summary.getRange("B4").format.numberFormat = "yyyy-mm-dd";
summary.getRange("A11:D11").values = [["Role", "Test cases", "Passed", "Failed"]];
const roles = ["Owner", "Foodiva", "Chef_house", "Sala Daeng", "Min Buri"];
summary.getRange("A12:A16").values = roles.map((r) => [r]);
summary.getRange("B12").formulas = [["=COUNTIF('Test Cases'!$B$5:$B$104,A12)"]];
summary.getRange("B12:B16").fillDown();
summary.getRange("C12").formulas = [["=COUNTIFS('Test Cases'!$B$5:$B$104,A12,'Test Cases'!$G$5:$G$104,\"Passed\")"]];
summary.getRange("C12:C16").fillDown();
summary.getRange("D12").formulas = [["=COUNTIFS('Test Cases'!$B$5:$B$104,A12,'Test Cases'!$G$5:$G$104,\"Failed\")"]];
summary.getRange("D12:D16").fillDown();
summary.getRange("A18:B21").values = [
  ["Automated test cases", cases.length],
  ["Passed", null],
  ["Failed", null],
  ["Pass rate", null],
];
summary.getRange("B19").formulas = [["=COUNTIF('Test Cases'!$G$5:$G$104,\"Passed\")"]];
summary.getRange("B20").formulas = [["=COUNTIF('Test Cases'!$G$5:$G$104,\"Failed\")"]];
summary.getRange("B21").formulas = [["=B19/B18"]];
summary.getRange("B21").format.numberFormat = "0.0%";
summary.getRange("A23:H25").values = [
  ["Acceptance notes", null, null, null, null, null, null, null],
  ["Automated status confirms the tested demo flow completed without Playwright errors. Customer UAT status and signatures remain editable in this workbook.", null, null, null, null, null, null, null],
  ["The run covers one complete transaction loop. Seven-day repetition, authentication, database persistence and production integrations are outside this automated run.", null, null, null, null, null, null, null],
];
summary.getRange("A23:H23").merge(); summary.getRange("A24:H24").merge(); summary.getRange("A25:H25").merge();

tests.getRange("A1:J1").merge();
tests.getRange("A1").values = [["UAT Test Cases"]];
tests.getRange("A1").format.font = { name: font, size: 18, bold: true, color: "#153F38" };
tests.getRange("A2:J2").merge();
tests.getRange("A2").values = [["Automated results are from the Playwright run. Customer UAT fields can be updated during acceptance testing."]];
tests.getRange("A4:J4").values = [["Test Case", "Role", "Module", "Scenario", "Test steps", "Expected result", "Automated result", "Customer UAT", "Tester / date", "Remarks"]];
tests.getRange(`A5:G${cases.length + 4}`).values = cases;
tests.getRange(`H5:H${cases.length + 4}`).values = cases.map(() => ["Pending"]);
tests.getRange(`H5:H${cases.length + 4}`).dataValidation = { rule: { type: "list", values: ["Pending", "Pass", "Fail", "Blocked"] } };
const testTable = tests.tables.add(`A4:J${cases.length + 4}`, true, "UATCases");
testTable.style = "TableStyleMedium4";
tests.freezePanes.freezeRows(4);
tests.freezePanes.freezeColumns(2);

signoff.getRange("A1:F1").merge();
signoff.getRange("A1").values = [["UAT Sign-off"]];
signoff.getRange("A1").format.font = { name: font, size: 18, bold: true, color: "#153F38" };
signoff.getRange("A3:B9").values = [
  ["Project", "NerdNuea Stock"],
  ["Environment", "Local demo"],
  ["Automated test result", "Passed"],
  ["Customer decision", "Pending"],
  ["Customer name", ""],
  ["Signature", ""],
  ["Date", ""],
];
signoff.getRange("B6").dataValidation = { rule: { type: "list", values: ["Pending", "Accepted", "Accepted with conditions", "Rejected"] } };
signoff.getRange("A11:F11").merge();
signoff.getRange("A11").values = [["Conditions / open issues"]];
signoff.getRange("A12:F18").merge();

const header = { fill: "#1C554B", font: { name: font, bold: true, color: "#FFFFFF" }, verticalAlignment: "center", horizontalAlignment: "center", wrapText: true };
summary.getRange("A11:D11").format = header;
tests.getRange("A4:J4").format = header;
signoff.getRange("A11:F11").format = header;
for (const range of [summary.getRange("A4:B9"), summary.getRange("A12:D16"), summary.getRange("A18:B21"), signoff.getRange("A3:B9")]) {
  range.format.borders = { preset: "inside", style: "thin", color: "#D8E0DC" };
}
summary.getRange("A23:H23").format = { fill: "#E4ECE8", font: { name: font, bold: true, color: "#153F38" } };
summary.getRange("A24:H25").format.wrapText = true;
summary.getRange("A24:H25").format.rowHeight = 36;
tests.getRange(`A5:J${cases.length + 4}`).format.verticalAlignment = "top";
tests.getRange(`D5:F${cases.length + 4}`).format.wrapText = true;
tests.getRange(`A5:J${cases.length + 4}`).format.rowHeight = 42;
tests.getRange(`G5:G${cases.length + 4}`).conditionalFormats.add("containsText", { text: "Passed", format: { fill: "#DDF2E5", font: { color: "#17623A", bold: true } } });
tests.getRange(`H5:H${cases.length + 4}`).conditionalFormats.add("containsText", { text: "Fail", format: { fill: "#FBE0DE", font: { color: "#A52A24", bold: true } } });
tests.getRange(`H5:H${cases.length + 4}`).conditionalFormats.add("containsText", { text: "Pass", format: { fill: "#DDF2E5", font: { color: "#17623A", bold: true } } });
tests.getRange(`H5:H${cases.length + 4}`).conditionalFormats.add("containsText", { text: "Pending", format: { fill: "#FFF1CC", font: { color: "#7A5900" } } });

summary.getRange("A:H").format.columnWidth = 14;
summary.getRange("A:A").format.columnWidth = 23;
summary.getRange("B:B").format.columnWidth = 58;
tests.getRange("A:A").format.columnWidth = 15;
tests.getRange("B:C").format.columnWidth = 16;
tests.getRange("D:D").format.columnWidth = 28;
tests.getRange("E:F").format.columnWidth = 48;
tests.getRange("G:H").format.columnWidth = 18;
tests.getRange("I:I").format.columnWidth = 22;
tests.getRange("J:J").format.columnWidth = 34;
signoff.getRange("A:A").format.columnWidth = 24;
signoff.getRange("B:F").format.columnWidth = 22;
signoff.getRange("A12:F18").format = { fill: "#FFFDF7", borders: { preset: "outside", style: "thin", color: "#C9D1CD" }, wrapText: true, verticalAlignment: "top" };

await fs.mkdir(outputDir, { recursive: true });
const output = await SpreadsheetFile.exportXlsx(wb);
await output.save(`${outputDir}/NerdNuea-UAT.xlsx`);

const summaryInspect = await wb.inspect({ kind: "table", range: "UAT Summary!A1:H25", include: "values,formulas", tableMaxRows: 30, tableMaxCols: 10 });
console.log(summaryInspect.ndjson);
const errors = await wb.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!", options: { useRegex: true, maxResults: 100 }, summary: "final formula error scan" });
console.log(errors.ndjson);
for (const [sheetName, range, file] of [["UAT Summary", "A1:H25", "summary.png"], ["Test Cases", `A1:J${cases.length + 4}`, "test-cases.png"], ["Sign-off", "A1:F18", "sign-off.png"]]) {
  const image = await wb.render({ sheetName, range, scale: 1 });
  await fs.writeFile(`./${file}`, new Uint8Array(await image.arrayBuffer()));
}
