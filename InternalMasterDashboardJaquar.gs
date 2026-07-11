/**
 * CONSOLIDATED INTERNAL DASHBOARD
 * ----------------------------------------------------------------------------
 * Loops through all Jaquar RDs, calculates their aging buckets in the background,
 * and outputs a single, sortable leaderboard for the collections team.
 */

function generateMasterDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rd = ss.getSheetByName(AG.RD_TAB);
  if (!rd) throw new Error('Missing tab "' + AG.RD_TAB + '"');

  const data = rd.getDataRange().getValues();
  const outTabName = 'Master Dashboard';
  let outTab = ss.getSheetByName(outTabName);
  
  if (outTab) {
    outTab.clear(); // Wipe yesterday's board
  } else {
    outTab = ss.insertSheet(outTabName);
  }

  // 1. Setup Dashboard Headers
  const headers = [
    "Customer Name", 
    "Total Outstanding", 
    "TOTAL OVERDUE", 
    "Retail: 0-4 Days", "Retail: 5-14 Days", "Retail: 15-24 Days", "Retail: 25-34 Days", "Retail: 35+ Days",
    "Project: 0-4 Days", "Project: 5-14 Days", "Project: 15-24 Days", "Project: 25-34 Days", "Project: 35-44 Days", "Project: 45+ Days",
    "Team Remarks / Follow-up Notes"
  ];

  const outputRows = [];
  ss.toast('Compiling master data...', 'Dashboard', 3);

  // 2. Loop through every dealer and calculate math
  for (let i = 1; i < data.length; i++) {
    const customer = String(data[i][0]).trim();
    const retailDD = parseInt(data[i][1]);
    const projectDD = parseInt(data[i][2]);
    
    if (!customer || isNaN(retailDD) || isNaN(projectDD)) continue;

    const src = readCustomerFromTabs(ss, customer);
    if (!src.found) continue;

    const { invoices, receipts } = src;

    // Apply Due Dates
    invoices.forEach(inv => {
      const dDate = new Date(inv.date);
      if (inv.vchNo !== 'OPENING BAL') dDate.setDate(dDate.getDate() + (inv.isProject ? projectDD : retailDD));
      inv.dueDate = dDate;
    });

    matchPayments(invoices, receipts);

    // Run the Bucket Engine
    const bb = computeBucketBlock(invoices, retailDD);
    const totalOut = toFixedNum(bb.rTotal + bb.pTotal);
    
    // Skip dealers who owe nothing
    if (totalOut <= 0.01) continue;

    // Compile the row
    outputRows.push([
      customer,
      totalOut,
      bb.overdueIndependent,
      ...bb.retail,  // 5 items
      ...bb.project, // 6 items
      ""             // Empty string for Remarks column
    ]);
  }

  // 3. Sort the Leaderboard (Highest Overdue at the top, then Highest Outstanding)
  outputRows.sort((a, b) => b[2] - a[2] || b[1] - a[1]);

  // 4. Draw the Dashboard
  // Title Band
  outTab.getRange(1, 1, 1, headers.length).setBackground('#283C50').setFontColor('white').setFontWeight('bold');
  
  // Set Column A independently so the freeze pane can drop cleanly
  outTab.getRange(1, 1).setValue("MASTER").setHorizontalAlignment('center').setVerticalAlignment('middle');
  
  // Merge Column B through O for the main title
  outTab.getRange(1, 2, 1, headers.length - 1).merge()
    .setValue(`INTERNAL COLLECTIONS DASHBOARD — As on ${Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy')}`)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setFontSize(14);
    
  outTab.setRowHeight(1, 40);

  // Header Row
  outTab.getRange(2, 1, 1, headers.length).setValues([headers])
    .setBackground('#37474f').setFontColor('white').setFontWeight('bold')
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  outTab.setRowHeight(2, 45);

  // Data Rows
  if (outputRows.length > 0) {
    const dataRange = outTab.getRange(3, 1, outputRows.length, headers.length);
    dataRange.setValues(outputRows).setVerticalAlignment('middle');
    
    // Format all money columns (Indian format)
    const moneyFormat = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
    outTab.getRange(3, 2, outputRows.length, 13).setNumberFormat(moneyFormat);

    // Styling the specific columns
    outTab.getRange(3, 1, outputRows.length, 1).setFontWeight('bold'); // Customer Name
    outTab.getRange(3, 2, outputRows.length, 1).setBackground('#e3f2fd').setFontWeight('bold'); // Total Outstanding
    outTab.getRange(3, 3, outputRows.length, 1).setBackground('#ffcdd2').setFontColor('#c62828').setFontWeight('bold'); // Overdue
    
    // Add gridlines
    dataRange.setBorder(true, true, true, true, true, true, '#cfd8dc', SpreadsheetApp.BorderStyle.SOLID);
    
    // Make the remarks column a light yellow to indicate it can be typed in
    outTab.getRange(3, 15, outputRows.length, 1).setBackground('#fff9c4');
  }

  // Freeze the top 2 rows and the Customer Name column for easy scrolling
  outTab.setFrozenRows(2);
  outTab.setFrozenColumns(1);
  
  // Clean up column widths
  outTab.setColumnWidth(1, 250); // Customer Name
  for (let c = 2; c <= 14; c++) {
    outTab.setColumnWidth(c, 110);
  }
  outTab.setColumnWidth(15, 300); // Remarks

  ss.toast('Dashboard ready!', 'Success', 3);
}