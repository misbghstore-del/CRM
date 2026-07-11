/**
 * PRINTABLE CONSOLIDATED MASTER REPORT - OFFSET BUCKET LAYOUT
 * ----------------------------------------------------------------------------
 * Replicates the exact offset "Aging By Invoice Date" bucket layout 
 * (where Retail is shifted 1 cell right of Project) for every dealer 
 * and exports as a PDF.
 */

function generatePrintableMasterPdf() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rd = ss.getSheetByName(AG.RD_TAB);
  if (!rd) throw new Error('Missing tab "' + AG.RD_TAB + '"');

  const data = rd.getDataRange().getValues();
  const outTabName = 'Print_Master_Temp';
  let outTab = ss.getSheetByName(outTabName);
  
  if (outTab) outTab.clear();
  else outTab = ss.insertSheet(outTabName);

  ss.toast('Calculating dealer offset buckets...', 'Processing', 5);

  const outputRows = [];
  const formatBlocks = []; 
  let currentRow = 1;

  // 1. Draw Main Report Header
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy');
  outputRows.push([`CONSOLIDATED AGING REPORT — ${todayStr}`, "", "", "", "", "", "", ""]);
  currentRow++;
  outputRows.push(["", "", "", "", "", "", "", ""]); 
  currentRow++;

  // 2. Loop through every dealer
  for (let i = 1; i < data.length; i++) {
    const customer = String(data[i][0]).trim();
    const retailDD = parseInt(data[i][1]);
    const projectDD = parseInt(data[i][2]);
    
    if (!customer || isNaN(retailDD) || isNaN(projectDD)) continue;

    const src = readCustomerFromTabs(ss, customer);
    if (!src.found) continue;

    const { invoices, receipts } = src;

    invoices.forEach(inv => {
      const dDate = new Date(inv.date);
      if (inv.vchNo !== 'OPENING BAL') dDate.setDate(dDate.getDate() + (inv.isProject ? projectDD : retailDD));
      inv.dueDate = dDate;
    });

    matchPayments(invoices, receipts);
    const bb = computeBucketBlock(invoices, retailDD);
    const totalOut = toFixedNum(bb.rTotal + bb.pTotal);
    
    if (totalOut <= 0.01) continue;

    // --- BUILD OFFSET DEALER BLOCK ---
    const startRow = currentRow;

    // Row 1: Customer Name
    outputRows.push([customer, "", "", "", "", "", "Total:", totalOut]);
    
    // Row 2: Retail Labels (Shifted 1 right: starts at index 2)
    outputRows.push(["RETAIL\nINVOICES", "", bb.retailLabels[0], bb.retailLabels[1], bb.retailLabels[2], bb.retailLabels[3], bb.retailLabels[4], "Total"]);
    
    // Row 3: Retail Values
    outputRows.push(["", "", bb.retail[0], bb.retail[1], bb.retail[2], bb.retail[3], bb.retail[4], bb.rTotal]);
    
    // Row 4: Project Labels (Starts at index 1)
    outputRows.push(["PROJECT\nINVOICES", bb.projectLabels[0], bb.projectLabels[1], bb.projectLabels[2], bb.projectLabels[3], bb.projectLabels[4], bb.projectLabels[5], "Total"]);
    
    // Row 5: Project Values
    outputRows.push(["", bb.project[0], bb.project[1], bb.project[2], bb.project[3], bb.project[4], bb.project[5], bb.pTotal]);
    
    // Row 6: Total Overdue (Vertical sums of overlapping columns)
    const colSum = {};
    for (let j = bb.rFirstOD; j < bb.retail.length; j++) { 
      colSum[3 + j] = toFixedNum((colSum[3 + j] || 0) + bb.retail[j]); 
    }
    for (let j = bb.pFirstOD; j < bb.project.length; j++) { 
      colSum[2 + j] = toFixedNum((colSum[2 + j] || 0) + bb.project[j]); 
    }
    
    let grandOD = 0;
    const odRow = ["TOTAL OVERDUE", 0, 0, 0, 0, 0, 0, 0]; 
    for (let c = 2; c <= 7; c++) {
      if (colSum[c] !== undefined) {
        odRow[c - 1] = colSum[c]; 
        grandOD = toFixedNum(grandOD + colSum[c]);
      } else {
        odRow[c - 1] = 0;
      }
    }
    odRow[7] = grandOD;
    outputRows.push(odRow);

    // Track formatting bounds
    formatBlocks.push({ row: startRow, rFirstOD: bb.rFirstOD, pFirstOD: bb.pFirstOD });
    currentRow += 6;

    // Spacer
    outputRows.push(["", "", "", "", "", "", "", ""]);
    currentRow++;
  }

  if (outputRows.length === 2) {
    ss.toast("No outstanding dues found.", "Done", 3);
    return;
  }

  ss.toast('Applying visual layout...', 'Formatting', 5);

  // 3. Write Data
  outTab.getRange(1, 1, outputRows.length, 8).setValues(outputRows);
  
  // 4. Global Formatting Setup
  outTab.getRange(1, 1, outputRows.length, 8)
    .setFontFamily("Roboto")
    .setVerticalAlignment("middle")
    .setNumberFormat('[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00');

  // Exact widths from the original offset bucket report
  outTab.setColumnWidth(1, 130); 
  for(let c = 2; c <= 8; c++) outTab.setColumnWidth(c, 105);

  // Main Header
  outTab.getRange(1, 1, 1, 8).merge().setBackground('#283C50').setFontColor('white').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
  outTab.setRowHeight(1, 40);

  // Block Formatting Engine
  const OD_BG = '#ffcdd2', OK_BG = '#e8f5e9', HDR_BG = '#eceff1', BDR = '#b0bec5';
  const B = SpreadsheetApp.BorderStyle.SOLID;

  formatBlocks.forEach(blk => {
    const sr = blk.row;
    
    // Customer Name Row
    outTab.getRange(sr, 1, 1, 6).merge().setFontSize(14).setFontWeight('bold').setFontColor('#1e3d59');
    outTab.getRange(sr, 7).setHorizontalAlignment('right').setFontWeight('bold');
    outTab.getRange(sr, 8).setFontWeight('bold').setBackground('#b3e5fc');

    // Title Merges (Retail & Project)
    outTab.getRange(sr + 1, 1, 2, 1).merge().setBackground('#37474f').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);
    outTab.getRange(sr + 3, 1, 2, 1).merge().setBackground('#37474f').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);

    // Header Backgrounds
    outTab.getRange(sr + 1, 2, 1, 7).setBackground(HDR_BG).setFontWeight('bold');
    outTab.getRange(sr + 3, 2, 1, 7).setBackground(HDR_BG).setFontWeight('bold');
    
    // Retail Data Colors
    outTab.getRange(sr + 2, 8).setBackground('#CFD8DC').setFontWeight('bold');
    for(let i = 0; i < 5; i++) {
      outTab.getRange(sr + 2, 3 + i).setBackground(i >= blk.rFirstOD ? OD_BG : OK_BG);
    }

    // Project Data Colors
    outTab.getRange(sr + 4, 8).setBackground('#CFD8DC').setFontWeight('bold');
    for(let i = 0; i < 6; i++) {
      outTab.getRange(sr + 4, 2 + i).setBackground(i >= blk.pFirstOD ? OD_BG : OK_BG);
    }

    // Overdue Row
    outTab.getRange(sr + 5, 1).setFontWeight('bold').setFontColor('#1e3d59');
    outTab.getRange(sr + 5, 2, 1, 6).setBackground('#ffab91').setFontWeight('bold');
    outTab.getRange(sr + 5, 8).setBackground('#ff8a65').setFontWeight('bold');

    // Alignment & Borders
    outTab.getRange(sr + 1, 2, 5, 7).setHorizontalAlignment('center');
    [sr+2, sr+4, sr+5].forEach(r => outTab.getRange(r, 2, 1, 7).setFontWeight('bold'));
    
    outTab.getRange(sr + 1, 2, 2, 7).setBorder(true,true,true,true,true,true,BDR,B);
    outTab.getRange(sr + 3, 2, 2, 7).setBorder(true,true,true,true,true,true,BDR,B);
    outTab.getRange(sr + 5, 2, 1, 7).setBorder(true,true,true,true,true,true,BDR,B);
    outTab.getRange(sr + 1, 1, 2, 1).setBorder(true,true,true,true,null,null,BDR,B);
    outTab.getRange(sr + 3, 1, 2, 1).setBorder(true,true,true,true,null,null,BDR,B);

    // Row Heights
    [sr+1, sr+2, sr+3, sr+4, sr+5].forEach(r => outTab.setRowHeight(r, 26));
  });

  SpreadsheetApp.flush();
  ss.toast('Exporting to PDF...', 'Exporting', 5);

  // 5. Export to PDF directly to Drive
  const pdfBlob = exportPrintableMaster(ss, outTab.getSheetId());
  const file = DriveApp.createFile(pdfBlob);
  file.setName(`Printable_Master_Aging_${todayStr}.pdf`);
  
  // Clean up the temp tab
  ss.deleteSheet(outTab);

  // Show a popup with the link to the PDF
  const html = HtmlService.createHtmlOutput(`<div style="font-family:Arial,sans-serif; padding: 20px;"><h3>PDF Generated Successfully!</h3><p>Your printable master report has been saved to your Google Drive.</p><a href="${file.getUrl()}" target="_blank" style="display:inline-block; padding: 10px 20px; background-color: #283C50; color: white; text-decoration: none; border-radius: 5px;">Click Here to Open PDF</a></div>`)
    .setWidth(350).setHeight(200);
    
  // FAIL-SAFE: If run from the Editor, log the URL instead of crashing
  try {
    SpreadsheetApp.getUi().showModalDialog(html, 'Printable Report Ready');
  } catch (e) {
    Logger.log('PDF Generated Successfully! You can find it in your Google Drive here: ' + file.getUrl());
  }
}

// ---- PDF EXPORTER HELPER ----
function exportPrintableMaster(ss, sheetId) {
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?' +
    'format=pdf' +
    '&gid=' + sheetId +
    '&size=A4' +
    '&portrait=true' +
    '&fitw=true' +
    '&top_margin=0.40&bottom_margin=0.40&left_margin=0.30&right_margin=0.30' +
    '&gridlines=false&printtitle=false&sheetnames=false&horizontal_alignment=CENTER';
    
  const token = ScriptApp.getOAuthToken();
  const resp = UrlFetchApp.fetch(url, { 
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  
  if (resp.getResponseCode() === 200) {
    return resp.getBlob();
  } else {
    throw new Error('Failed to export PDF.');
  }
}