/**
 * ON-DEMAND JAQUAR NBTN REPORT (100% Exact Clone Formatting & Accurate Math)
 * ----------------------------------------------------------------------------
 * Runs full chronological payment matching first, filters for NBTN, draws 
 * the exact Master layout, and surgically condenses the data table to 9 columns.
 */

function generateNbtnOnDemandPdf() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  
  if (sheet.getName() !== AG.RD_TAB) {
    SpreadsheetApp.getUi().alert('Action Required', 'Please go to the "' + AG.RD_TAB + '" tab and select a dealer first.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }
  
  const row = sheet.getActiveCell().getRow();
  if (row < 2) {
    SpreadsheetApp.getUi().alert('Action Required', 'Please select a valid dealer row.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  const customer = String(sheet.getRange(row, 1).getValue() || '').trim();
  const retailDD = parseInt(sheet.getRange(row, 2).getValue());
  const projectDD = parseInt(sheet.getRange(row, 3).getValue());
  
  if (!customer) return;

  ss.toast('Processing full chronological data for ' + customer + '...', 'Processing', 3);
  
  const src = readCustomerFromTabs(ss, customer);
  if (!src.found) return;
  const partyName = (src.partyName || customer) + (src.city ? ', ' + src.city : '');

  // 1. Apply Due Dates to ALL invoices
  src.invoices.forEach(inv => {
    const dDate = new Date(inv.date);
    if (inv.vchNo !== 'OPENING BAL') dDate.setDate(dDate.getDate() + (inv.isProject ? projectDD : retailDD));
    inv.dueDate = dDate;
  });

  // 2. Sort ALL invoices chronologically
  src.invoices.sort((a,b) => {
    if (a.vchNo === 'OPENING BAL') return -1;
    if (b.vchNo === 'OPENING BAL') return 1;
    if (a.dueDate.getTime() !== b.dueDate.getTime()) return a.dueDate.getTime() - b.dueDate.getTime();
    return String(a.vchNo).localeCompare(String(b.vchNo));
  });

  // 3. Match payments against the FULL dataset for accurate accounting math
  matchPayments(src.invoices, src.receipts);

  // 4. NOW filter for NBTN invoices
  const nbtnInvoices = src.invoices.filter(inv => String(inv.vchNo).toUpperCase().startsWith('NBTN'));
  
  if (nbtnInvoices.length === 0) {
    SpreadsheetApp.getUi().alert('No Data', 'Customer ' + customer + ' has no NBTN invoices on record.', SpreadsheetApp.getUi().ButtonSet.OK);
    return;
  }

  // 5. Calculate metrics using ONLY the filtered NBTN data
  const dueTotalsMap = calculateDueTotals(nbtnInvoices);
  const reportData = generateReportData(nbtnInvoices, dueTotalsMap, AG);
  const summaryMain = calculateSummary(reportData);
  const bucketBlock = computeBucketBlock(nbtnInvoices, retailDD);

  const tempTabName = 'Aging Report (NBTN)';
  const nbtnConfig = { ...AG, REPORT_SHEET: tempTabName };

  ss.toast('Drawing exact layout...', 'Formatting', 3);
  
  // 6. Run the EXACT original layout generator to guarantee perfect formatting
  writeReportToSheet(ss, reportData, summaryMain, partyName, nbtnConfig, COLORS, bucketBlock);
  
  // 7. Surgically remap the data table to the requested 9 columns
  formatAsNbtn9Column(ss, tempTabName, reportData);

  ss.toast('Exporting to PDF...', 'Exporting', 4);

  // 8. Update Title & Export to PDF
  const outTab = ss.getSheetByName(tempTabName);
  outTab.getRange('A1').setValue('AGEING ANALYSIS REPORT (NBTN ONLY)');
  SpreadsheetApp.flush();

  const pdfBlob = exportNbtnPdf(ss, outTab.getSheetId());
  const file = DriveApp.createFile(pdfBlob);
  file.setName(`NBTN_Aging_${customer.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
  
  // Clean up
  ss.deleteSheet(outTab);

  const html = HtmlService.createHtmlOutput(`<div style="font-family:Arial,sans-serif; padding: 20px;"><h3>Jaquar NBTN Report Ready!</h3><p>The exact-match 9-column report for <strong>${customer}</strong> has been generated.</p><a href="${file.getUrl()}" target="_blank" style="display:inline-block; padding: 10px 20px; background-color: #283C50; color: white; text-decoration: none; border-radius: 5px;">Click Here to View & Download PDF</a></div>`)
    .setWidth(350).setHeight(220);
    
  SpreadsheetApp.getUi().showModalDialog(html, 'NBTN Report Generated');
}

/**
 * SURGICAL POST-PROCESSOR
 * Takes the 13-column generated layout and precisely shifts/merges the bottom data table
 * into the 9 requested columns without altering the top summary width/formatting.
 */
function formatAsNbtn9Column(ss, sheetName, reportData) {
  const sheet = ss.getSheetByName(sheetName);
  const lastRow = sheet.getLastRow();
  const startRow = 12; // Standard Header Row
  
  if (lastRow < startRow) return;

  // 1. Break all merges in the bottom data table
  sheet.getRange(startRow, 1, lastRow - startRow + 1, 13).breakApart();

  // 2. Overwrite Headers (Leaving gaps where we will merge)
  const headers = [['Invoice Date', 'Invoice No.', '', 'Due Date', '', 'Amount', 'Total Paid', 'Payment Status', 'Clear Date', 'Adjusted Amount', '', 'Overdue Days', '']];
  sheet.getRange(startRow, 1, 1, 13).setValues(headers);

  // 3. Shift the Data accurately
  if (lastRow > startRow) {
    const oldData = sheet.getRange(startRow + 1, 1, lastRow - startRow, 13).getValues();
    const newData = oldData.map(row => [
      row[0], // Invoice Date
      row[3], // Inv No (was in Col 4)
      '',
      row[4], // Due Date (was in Col 5)
      '',
      row[5], // Amount (was in Col 6)
      row[6], // Paid (was in Col 7)
      row[7], // Status (was in Col 8)
      row[8], // Clear Date (was in Col 9)
      row[9], // Adj Amt (was in Col 10)
      '',
      row[10], // Overdue Days (was in Col 11)
      ''
    ]);
    sheet.getRange(startRow + 1, 1, lastRow - startRow, 13).setValues(newData);

    // Re-apply strict Number Formats
    const MONEY_NF = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
    const DATE_NF = 'dd-MM-yyyy';
    const numRows = lastRow - startRow;
    
    sheet.getRange(startRow + 1, 1, numRows, 1).setNumberFormat(DATE_NF);
    sheet.getRange(startRow + 1, 4, numRows, 2).setNumberFormat(DATE_NF); 
    sheet.getRange(startRow + 1, 6, numRows, 1).setNumberFormat(MONEY_NF); 
    sheet.getRange(startRow + 1, 7, numRows, 1).setNumberFormat(MONEY_NF); 
    sheet.getRange(startRow + 1, 9, numRows, 1).setNumberFormat(DATE_NF); 
    sheet.getRange(startRow + 1, 10, numRows, 2).setNumberFormat(MONEY_NF); 
    sheet.getRange(startRow + 1, 12, numRows, 2).setNumberFormat('0'); 
  }

  // 4. Re-apply Header Merges
  sheet.getRange(startRow, 2, 1, 2).merge();  // Inv No
  sheet.getRange(startRow, 4, 1, 2).merge();  // Due Date
  sheet.getRange(startRow, 10, 1, 2).merge(); // Adj Amt
  sheet.getRange(startRow, 12, 1, 2).merge(); // Overdue

  // 5. Re-apply Vertical Data Merges
  reportData.invoiceMergeRanges.forEach(m => {
    const r = startRow + m.r;
    sheet.getRange(r, 1, m.n, 1).merge().setVerticalAlignment('middle'); 
    sheet.getRange(r, 2, m.n, 2).merge().setVerticalAlignment('middle'); // Inv No
    sheet.getRange(r, 4, m.n, 2).merge().setVerticalAlignment('middle'); // Due Date
    sheet.getRange(r, 6, m.n, 1).merge().setVerticalAlignment('middle'); 
    sheet.getRange(r, 7, m.n, 1).merge().setVerticalAlignment('middle'); 
    sheet.getRange(r, 8, m.n, 1).merge().setVerticalAlignment('middle'); 
    sheet.getRange(r, 12, m.n, 2).merge().setVerticalAlignment('middle'); // Overdue Days
  });

  // 6. Horizontal merges for Receipt Rows
  if (lastRow > startRow) {
    for (let r = startRow + 1; r <= lastRow; r++) {
      sheet.getRange(r, 10, 1, 2).merge().setVerticalAlignment('middle');
    }
  }
  
  // 7. Finalize Grid Borders
  sheet.getRange(startRow, 1, lastRow - startRow + 1, 13).setBorder(true, true, true, true, true, true, '#b0bec5', SpreadsheetApp.BorderStyle.SOLID);
}

// ---- HELPER ----
function exportNbtnPdf(ss, sheetId) {
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&gid=' + sheetId + '&size=A4&portrait=false&fitw=true&scale=2&top_margin=0.30&bottom_margin=0.30&left_margin=0.30&right_margin=0.30&gridlines=false&printtitle=false&sheetnames=false&horizontal_alignment=CENTER';
  const options = { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  const resp = UrlFetchApp.fetch(url, options);
  if (resp.getResponseCode() === 200) return resp.getBlob();
  throw new Error('Failed to export PDF.');
}