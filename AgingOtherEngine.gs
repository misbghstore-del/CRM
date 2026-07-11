/**
 * OTHER CUSTOMERS (NON-JAQUAR) - AGING ENGINE & PDF EXPORTER
 * ----------------------------------------------------------------------------
 * 1:1 clone of the main Aging layout. Generates a single-band aging report 
 * with dynamic bucket sizes, the full Late Ratios metrics stack, and 
 * perfectly matched formatting.
 */

const AG_OTHER = {
  TAB_RDS: 'Other RDs',
  REPORT_SHEET: 'Aging Report (Other)',
  BANNER_TOP: 1,
  BANNER_BOT: 11,
  HEADER_ROW: 12,
  DATA_START: 13,
  ROWS_PAGE1: 18,
  ROWS_PAGEN: 30
};

// 1. REPORT GENERATOR
function runOtherAgingForRow(ss, row) {
  const rd = ss.getSheetByName(AG_OTHER.TAB_RDS);
  if (!rd) throw new Error('Missing tab "' + AG_OTHER.TAB_RDS + '"');

  const customer = String(rd.getRange(row, 1).getValue() || '').trim();
  const dueDays = parseInt(rd.getRange(row, 2).getValue());
  if (!customer || isNaN(dueDays)) throw new Error('Invalid data at row ' + row);

  const src = readCustomerFromTabs(ss, customer);
  if (!src.found) throw new Error('No transactions for: ' + customer);

  const partyName = (src.partyName || 'Unknown Party') + (src.city ? ', ' + src.city : '');

  // Apply single fixed due-day rule
  src.invoices.forEach(inv => {
    const dDate = new Date(inv.date);
    if (inv.vchNo !== 'OPENING BAL') dDate.setDate(dDate.getDate() + dueDays);
    inv.dueDate = dDate;
  });

  src.invoices.sort((a,b) => {
    if (a.vchNo === 'OPENING BAL') return -1;
    if (b.vchNo === 'OPENING BAL') return 1;
    if (a.dueDate.getTime() !== b.dueDate.getTime()) return a.dueDate.getTime() - b.dueDate.getTime();
    return String(a.vchNo).localeCompare(String(b.vchNo));
  });

  const dueTotalsMap = calculateDueTotals(src.invoices);
  matchPayments(src.invoices, src.receipts);

  // Dynamic Bucket Math (Sizes perfectly to the due days)
  const today = new Date();
  const step = 15; // Width of overdue buckets
  const edges = [dueDays, dueDays + step, dueDays + step*2, dueDays + step*3];
  const labels = [
    `0-${dueDays} Days`,
    `${dueDays+1}-${dueDays+step} Days`,
    `${dueDays+step+1}-${dueDays+step*2} Days`,
    `${dueDays+step*2+1}-${dueDays+step*3} Days`,
    `> ${dueDays+step*3} Days`
  ];
  
  const buckets = [0, 0, 0, 0, 0];
  let overdueIndependent = 0;

  src.invoices.forEach(inv => {
    if (inv.remaining <= 0.01) return;
    const age = Math.ceil((today - inv.date) / 864e5);
    
    let s = 0;
    while (s < edges.length && age > edges[s]) s++;
    buckets[s] = toFixedNum(buckets[s] + inv.remaining);
    
    if (age > dueDays) overdueIndependent = toFixedNum(overdueIndependent + inv.remaining);
  });
  
  const totalOut = toFixedNum(buckets.reduce((a,b)=>a+b,0));

  // Generate metrics using the PROVEN main engine
  const reportData = generateReportData(src.invoices, dueTotalsMap, { ROW_HEIGHT: 28, HEADER_HEIGHT: 35 });
  const summary = calculateSummary(reportData);
  
  writeOtherReportLayout(ss, reportData, summary, partyName, dueDays, labels, buckets, totalOut, overdueIndependent, step);
  SpreadsheetApp.flush();
  return customer;
}

// 2. PERFECT CLONE LAYOUT PAINTER
function writeOtherReportLayout(ss, reportData, summary, partyName, dueDays, labels, buckets, totalOut, overdueIndependent, step) {
  let sheet = ss.getSheetByName(AG_OTHER.REPORT_SHEET);
  if (sheet) sheet.clear();
  else sheet = ss.insertSheet(AG_OTHER.REPORT_SHEET);
  
  sheet.setHiddenGridlines(true);
  
  const COLORS = { PRIMARY:'#1e3d59', SUCCESS:'#d9ead3', WARNING:'#fff2cc', DANGER:'#ea9999', PROJECT_TAG:'#e1f5fe', BORDER:'#b0bec5', HEADER_BG:'#eceff1' };
  const MONEY_NF = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
  const B = SpreadsheetApp.BorderStyle.SOLID;

  // Title band
  sheet.getRange('A1:M1').merge().setValue('AGEING ANALYSIS REPORT').setFontWeight('bold').setFontSize(14).setFontFamily('Roboto').setBackground(COLORS.PRIMARY).setFontColor('white').setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);

  // Party + As-on
  sheet.getRange(2, 1, 1, 8).merge().setValue(partyName.toUpperCase()).setFontSize(16).setFontWeight('bold').setFontFamily('Roboto').setHorizontalAlignment('left').setVerticalAlignment('middle').setFontColor(COLORS.PRIMARY);
  sheet.getRange(2, 9, 1, 5).merge().setValue('Terms: ' + dueDays + ' Days   |   As on: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy')).setFontStyle('italic').setHorizontalAlignment('right').setVerticalAlignment('middle').setFontColor(COLORS.PRIMARY).setFontSize(10);

  // ===== LEFT: Bucket Block (cols 1-8), rows 4-10 =====
  const RCOL0 = 3, TOTC = 8;
  const OD_BG = '#ffcdd2', OK_BG = '#e8f5e9';

  sheet.getRange(4,1,2,1).merge().setValue('INVOICES').setFontWeight('bold').setFontSize(10).setBackground('#37474f').setFontColor('white').setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  
  labels.forEach((lab,i) => sheet.getRange(4, RCOL0+i).setValue(lab));
  sheet.getRange(4, TOTC).setValue('Total');
  
  buckets.forEach((v,i) => sheet.getRange(5, RCOL0+i).setValue(v).setNumberFormat(MONEY_NF).setBackground(i >= 1 ? OD_BG : OK_BG));
  sheet.getRange(5, TOTC).setValue(totalOut).setNumberFormat(MONEY_NF).setBackground('#CFD8DC').setFontWeight('bold');

  // Total Overdue Row (9)
  sheet.getRange(9,1).setValue('TOTAL OVERDUE').setFontWeight('bold').setFontSize(11).setFontColor(COLORS.PRIMARY).setWrap(true).setVerticalAlignment('middle');
  let grandOD = 0;
  for (let i = 1; i < buckets.length; i++) {
    const val = buckets[i];
    sheet.getRange(9, RCOL0+i).setValue(val).setNumberFormat(MONEY_NF).setFontWeight('bold').setBackground('#ffab91');
    grandOD = toFixedNum(grandOD + val);
  }
  sheet.getRange(9, TOTC).setValue(grandOD).setNumberFormat(MONEY_NF).setFontWeight('bold').setBackground('#ff8a65');

  // Overdue Days Labels (Row 10)
  for (let i = 1; i < buckets.length; i++) {
    const odLabel = (i === 4) ? `> ${step*3} days` : `${(i-1)*step + 1}-${i*step} days`;
    sheet.getRange(10, RCOL0+i).setValue('(' + odLabel + ')').setFontSize(7).setFontStyle('italic').setFontColor('#666').setHorizontalAlignment('center').setVerticalAlignment('middle');
  }
  sheet.setRowHeight(10,14);

  // Left Block Styling
  sheet.getRange(4,2,1,TOTC-1).setFontWeight('bold').setBackground(COLORS.HEADER_BG);
  [4,5,9].forEach(r => sheet.getRange(r,2,1,TOTC-1).setHorizontalAlignment('center').setVerticalAlignment('middle'));
  [5,9].forEach(r => sheet.getRange(r,2,1,TOTC-1).setFontWeight('bold'));
  sheet.getRange(4,2,2,TOTC-1).setBorder(true,true,true,true,true,true,COLORS.BORDER,B);
  sheet.getRange(9,2,1,TOTC-1).setBorder(true,true,true,true,true,true,COLORS.BORDER,B);
  sheet.getRange(4,1,2,1).setBorder(true,true,true,true,null,null,COLORS.BORDER,B);

  // ===== RIGHT: Metrics Stack (cols 9-13), rows 4-9 =====
  const mL = 9, mR = 13;
  sheet.getRange(4,mL,1,mR-mL+1).merge().setValue('TOTAL OUTSTANDING').setFontWeight('bold').setFontSize(10).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(5,mL,1,mR-mL+1).merge().setValue(summary.totalOutstanding).setNumberFormat(MONEY_NF).setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#b3e5fc');
  sheet.getRange(6,mL,1,2).merge().setValue('Late Ratio').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(6,mL+2,1,3).merge().setValue('Late %').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(7,mL,1,2).merge().setValue(summary.lateRatio).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#f8bbd0');
  sheet.getRange(7,mL+2,1,3).merge().setValue(summary.latePercentage).setNumberFormat('0.00%').setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#f8bbd0');
  sheet.getRange(8,mL,1,2).merge().setValue('Late Amt Ratio').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(8,mL+2,1,3).merge().setValue('Late Amt %').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(9,mL,1,2).merge().setValue(summary.lateAmtRatio).setFontSize(9).setWrap(true).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ef9a9a');
  sheet.getRange(9,mL+2,1,3).merge().setValue(summary.lateAmtPercentage).setNumberFormat('0.00%').setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ef9a9a');
  sheet.getRange(4,mL,6,mR-mL+1).setBorder(true,true,true,true,true,true,COLORS.BORDER,B);

  [4,5,6,7,9].forEach(r => sheet.setRowHeight(r, 26));
  sheet.setRowHeight(8, 22);

  // ===== Data Table =====
  const startRowOffset = 12;
  const headers = [['Invoice Date','Due Date Total','Type','Invoice No.','Due Date','Amount','Total Paid','Payment Status','Clear Date','Adjusted Amount','Overdue Days','Receipt Amount','Adj Type']];
  
  sheet.getRange(startRowOffset, 1, 1, 13).setValues(headers).setBackground(COLORS.PRIMARY).setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, 'white', B);
  
  const { output, bgMatrix, invoiceMergeRanges, dailyMergeRanges, receiptMergeRanges } = reportData;
  const outRange = sheet.getRange(startRowOffset + 1, 1, output.length, 13);
  outRange.setValues(output.map(r => r.slice(0, 13))); 
  outRange.setBackgrounds(bgMatrix);
  
  const lastRowIdx = startRowOffset + output.length;
  sheet.getRange(1, 1, lastRowIdx + 10, 13).setFontFamily('Roboto');

  const df = 'dd-MM-yyyy';
  sheet.getRange(startRowOffset + 1, 1, output.length, 1).setNumberFormat(df);   
  sheet.getRange(startRowOffset + 1, 5, output.length, 1).setNumberFormat(df);   
  sheet.getRange(startRowOffset + 1, 9, output.length, 1).setNumberFormat(df);   
  [2, 6, 7, 8, 10, 12].forEach(c => sheet.getRange(startRowOffset + 1, c, output.length, 1).setNumberFormat(MONEY_NF));
  sheet.getRange(startRowOffset + 1, 11, output.length, 1).setNumberFormat('0'); 

  invoiceMergeRanges.forEach(m => {
    const actualRow = startRowOffset + m.r;
    [1, 3, 4, 5, 6, 7, 8].forEach(c => sheet.getRange(actualRow, c, m.n, 1).merge().setVerticalAlignment('middle'));
    sheet.getRange(actualRow, 1, 1, 13).setFontWeight('bold');
    sheet.getRange(actualRow, 1, m.n, 13).setBorder(true, true, true, true, true, true, COLORS.BORDER, B);
  });
  
  dailyMergeRanges.forEach(m => sheet.getRange(startRowOffset + m.r, 2, m.n, 1).merge().setVerticalAlignment('middle'));
  receiptMergeRanges.forEach(m => {
    sheet.getRange(startRowOffset + m.r, 12, m.n, 1).merge().setVerticalAlignment('middle');
    sheet.getRange(startRowOffset + m.r, 13, m.n, 1).merge().setVerticalAlignment('middle');
  });

  sheet.getRange(lastRowIdx, 1, 1, 13).setFontWeight('bold').setBackground(COLORS.PRIMARY).setFontColor('white').setBorder(true, true, true, true, null, null);
  outRange.setBorder(null, true, null, true, true, true, COLORS.BORDER, B);

  [2, 6, 7, 8, 10, 12].forEach(c => sheet.getRange(startRowOffset + 1, c, output.length, 1).setNumberFormat(MONEY_NF));

  sheet.setRowHeights(startRowOffset + 1, output.length, 28);
  sheet.setRowHeight(startRowOffset, 35);
  sheet.setFrozenRows(startRowOffset);
  
  sheet.setColumnWidth(1, 95); sheet.setColumnWidth(3, 75); sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 95); sheet.setColumnWidth(8, 105); sheet.setColumnWidth(9, 95); sheet.setColumnWidth(13, 80);
  sheet.getRange(1, 1, lastRowIdx + 10, 13).setHorizontalAlignment('center');
}

// 3. RATE-LIMITED EXPORTER
function makeOtherPdf(ss) {
  const src = ss.getSheetByName(AG_OTHER.REPORT_SHEET);
  const dataEnd = src.getLastRow();
  const maxRows = src.getMaxRows(); 
  
  const safe = ag3_safeBreakRows(src, AG_OTHER.DATA_START, dataEnd, 4); 
  const blocks = ag3_buildBlocks(safe, AG_OTHER.DATA_START, dataEnd);
  const pages = ag3_packPages(blocks, AG_OTHER.ROWS_PAGE1, AG_OTHER.ROWS_PAGEN);
  
  const blobs = [];
  const merges = src.getRange(AG_OTHER.DATA_START, 1, dataEnd - AG_OTHER.DATA_START + 1, 13).getMergedRanges();
  const verticalMerges = merges.filter(m => m.getNumRows() > 1);

  try {
    for (let p = 0; p < pages.length; p++) {
      const pg = pages[p];
      src.showRows(1, maxRows);
      const restoredColors = []; 

      if (p === 0) {
        if (pg.start + pg.n - 1 < maxRows) src.hideRows(pg.start + pg.n, maxRows - (pg.start + pg.n - 1));
      } else {
        src.hideRows(1, AG_OTHER.BANNER_BOT);
        if (pg.start > AG_OTHER.DATA_START) src.hideRows(AG_OTHER.DATA_START, pg.start - AG_OTHER.DATA_START);
        if (pg.start + pg.n - 1 < maxRows) src.hideRows(pg.start + pg.n, maxRows - (pg.start + pg.n - 1));

        verticalMerges.forEach(m => {
          if (m.getRow() < pg.start && m.getRow() + m.getNumRows() - 1 >= pg.start) {
            const cell = src.getRange(m.getRow(), m.getColumn());
            restoredColors.push({ cell: cell, color: cell.getFontColor() });
            cell.setFontColor(cell.getBackground());
          }
        });
      }
      SpreadsheetApp.flush();
      blobs.push(ag3_exportOriginalAsPdf(ss, src)); 
      restoredColors.forEach(item => { item.cell.setFontColor(item.color); });
      if (p < pages.length - 1) Utilities.sleep(2500); 
    }
  } finally {
    src.showRows(1, maxRows);
  }
  return blobs;
}

// ---- TEST FUNCTION ----
function testOtherAging() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  Logger.log("Testing Other RDs Aging Engine...");
  
  // Row 2 is the first data row in your "Other RDs" tab
  runOtherAgingForRow(ss, 2); 
  
  Logger.log("✅ Success! Check the 'Aging Report (Other)' tab in your spreadsheet.");
}