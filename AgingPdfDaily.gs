/**
 * DAILY OUTSTANDING AGING PDF — Rate-Limited "Hide & Export" Engine
 */

const PDF_AG_DAILY = {
  TAB:         'Aging Report (Daily Open)',   
  BANNER_TOP:  1,             
  BANNER_BOT:  12,             
  HEADER_ROW:  13,            
  DATA_START:  14,            
  ROWS_PAGE1:  18,  
  ROWS_PAGEN:  30,  
};

function makeDailyOutstandingPdf(ss) {
  const src = ss.getSheetByName(PDF_AG_DAILY.TAB);
  if (!src) throw new Error('No "' + PDF_AG_DAILY.TAB + '" tab.');

  const bTop = PDF_AG_DAILY.BANNER_TOP;
  const bBot = PDF_AG_DAILY.BANNER_BOT;       
  const dataStart = PDF_AG_DAILY.DATA_START;  
  const dataEnd = src.getLastRow();
  const maxRows = src.getMaxRows(); 
  
  if (dataEnd < dataStart) throw new Error('No daily outstanding data rows found.');

  const safe = agDaily_safeBreakRows(src, dataStart, dataEnd, 4); 
  const blocks = agDaily_buildBlocks(safe, dataStart, dataEnd);
  const pages = agDaily_packPages(blocks, PDF_AG_DAILY.ROWS_PAGE1, PDF_AG_DAILY.ROWS_PAGEN);
  
  const blobs = [];
  const merges = src.getRange(dataStart, 1, dataEnd - dataStart + 1, 13).getMergedRanges();
  const verticalMerges = merges.filter(m => m.getNumRows() > 1);

  try {
    for (let p = 0; p < pages.length; p++) {
      const pg = pages[p];
      const pgStart = pg.start;
      const pgEnd = pg.start + pg.n - 1;

      src.showRows(1, maxRows);
      const restoredColors = []; 

      if (p === 0) {
        if (pgEnd < maxRows) src.hideRows(pgEnd + 1, maxRows - pgEnd);
      } else {
        src.hideRows(1, bBot);
        if (pgStart > dataStart) src.hideRows(dataStart, pgStart - dataStart);
        if (pgEnd < maxRows) src.hideRows(pgEnd + 1, maxRows - pgEnd);

        verticalMerges.forEach(m => {
          const mStart = m.getRow();
          const mEnd = mStart + m.getNumRows() - 1;
          if (mStart < pgStart && mEnd >= pgStart) {
            const cell = src.getRange(mStart, m.getColumn());
            restoredColors.push({ cell: cell, color: cell.getFontColor() });
            cell.setFontColor(cell.getBackground());
          }
        });
      }
      
      SpreadsheetApp.flush();
      blobs.push(agDaily_exportPdf(ss, src)); 

      restoredColors.forEach(item => { item.cell.setFontColor(item.color); });
      
      if (p < pages.length - 1) Utilities.sleep(2500); 
    }
  } finally {
    src.showRows(1, maxRows);
  }
  
  return blobs;
}

function agDaily_safeBreakRows(sheet, dataStart, dataEnd, invoiceCol) {
  const merges = sheet.getRange(dataStart, invoiceCol, dataEnd - dataStart + 1, 1).getMergedRanges();
  const unsafe = {};
  merges.forEach(m => {
    const a = m.getRow(), b = a + m.getNumRows() - 1;
    for (let r = a + 1; r <= b; r++) unsafe[r] = true;
  });
  const safe = [];
  for (let r = dataStart; r <= dataEnd; r++) if (!unsafe[r]) safe.push(r);
  if (safe[0] !== dataStart) safe.unshift(dataStart);
  return safe;
}

function agDaily_buildBlocks(safeRows, dataStart, dataEnd) {
  const rows = safeRows.slice().sort((a, b) => a - b);
  rows.push(dataEnd + 1); 
  const blocks = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const n = rows[i + 1] - rows[i];
    if (n > 0) blocks.push({ start: rows[i], n: n });
  }
  return blocks;
}

function agDaily_packPages(blocks, page1Budget, pageNBudget) {
  const pages = [];
  let cur = [], rows = 0, budget = page1Budget;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (cur.length && rows + b.n > budget) {
      pages.push(cur); cur = []; rows = 0; budget = pageNBudget;
    }
    cur.push(b); rows += b.n;
  }
  if (cur.length) pages.push(cur);
  return pages.map(pg => ({ start: pg[0].start, n: pg.reduce((s, x) => s + x.n, 0) }));
}

function agDaily_exportPdf(ss, sheet) {
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&gid=' + sheet.getSheetId() + '&size=A4&portrait=false&fitw=true&scale=2&top_margin=0.30&bottom_margin=0.30&left_margin=0.30&right_margin=0.30&gridlines=false&printtitle=false&sheetnames=false&horizontal_alignment=CENTER';
  const options = { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = UrlFetchApp.fetch(url, options);
    if (resp.getResponseCode() === 200) return resp.getBlob();
    if (resp.getResponseCode() === 429) Utilities.sleep(attempt * 4000); 
    else throw new Error(`Export failed: HTTP ${resp.getResponseCode()}`);
  }
  throw new Error('Failed to export PDF due to Google API limits.');
}

async function testFullDailyPdf() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  Logger.log("1. Generating filtered data tab...");
  runOutstandingAgingForRow(ss, 2); // Row 2 = Your first dealer in Jaquar RDs
  SpreadsheetApp.flush();
  
  Logger.log("2. Slicing data into high-speed PDF pages...");
  const blobs = makeDailyOutstandingPdf(ss);
  
  Logger.log("3. Merging pages...");
  const finalPdf = await PDFApp.mergePDFs(blobs);
  finalPdf.setName("Test_Daily_Outstanding.pdf");
  
  Logger.log("4. Saving to your Google Drive...");
  DriveApp.createFile(finalPdf);
  
  Logger.log("✅ Success! Check your main Google Drive for 'Test_Daily_Outstanding.pdf'");
}