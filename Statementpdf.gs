/**
 * STATEMENT (LEDGER) PDF — v3.2 (Rate-Limited "Hide & Export" Engine)
 * ----------------------------------------------------------------------------
 * Paginates the "Statement" tab into a multi-page A4 PORTRAIT PDF.
 * Uses Row-Hiding on the live sheet, throttled to prevent Google HTTP 429 errors.
 */

const PDF_STMT = {
  TAB:         'Statement',   
  BANNER_TOP:  3,             
  BANNER_BOT:  9,             
  HEADER_ROW:  10,            
  DATA_START:  11,            
  
  MAX_PIXELS_PAGE1: 750,  
  MAX_PIXELS_PAGEN: 850,  
};

// ---- Build one portrait single-page PDF blob per page ----
function makeStatementPdfV2(ss) {
  const src = ss.getSheetByName(PDF_STMT.TAB);
  if (!src) throw new Error('No "' + PDF_STMT.TAB + '" tab.');

  const bTop = PDF_STMT.BANNER_TOP;
  const bBot = PDF_STMT.BANNER_BOT;       
  const H = PDF_STMT.HEADER_ROW;
  const dataStart = PDF_STMT.DATA_START;  
  const dataEnd = src.getLastRow();
  const maxRows = src.getMaxRows(); 
  
  if (dataEnd < dataStart) throw new Error('No statement data rows found.');

  const safe = safeBreakRowsStmtV2(src, dataStart, dataEnd);
  const blocks = buildBlocksByHeight(src, safe, dataStart, dataEnd);
  const pages = packPagesByHeight(blocks, PDF_STMT.MAX_PIXELS_PAGE1, PDF_STMT.MAX_PIXELS_PAGEN);
  
  Logger.log('High-Speed Statement pages: ' + pages.length);

  const blobs = [];
  
  src.showRows(1, maxRows);

  for (let p = 0; p < pages.length; p++) {
    const pg = pages[p];
    const pgStart = pg.start;
    const pgEnd = pg.start + pg.n - 1;

    src.showRows(1, maxRows);

    if (p === 0) {
      if (bTop > 1) {
        src.hideRows(1, bTop - 1);
      }
      if (pgEnd < maxRows) {
        src.hideRows(pgEnd + 1, maxRows - pgEnd);
      }
    } else {
      src.hideRows(1, bBot);
      src.hideRows(dataStart, pgStart - dataStart);
      if (pgEnd < maxRows) {
        src.hideRows(pgEnd + 1, maxRows - pgEnd);
      }
    }
    
    SpreadsheetApp.flush();
    blobs.push(stmt_exportOriginalAsPdf(ss, src)); 
    
    // THROTTLE: Wait 2.5 seconds between page exports to prevent Google 429 Rate Limits
    if (p < pages.length - 1) {
      Utilities.sleep(2500); 
    }
  }

  src.showRows(1, maxRows);
  return blobs;
}

// ----------------------------------------------------------------------
// DYNAMIC PIXEL PAGINATION LOGIC
// ----------------------------------------------------------------------

function safeBreakRowsStmtV2(sheet, dataStart, dataEnd) {
  const n = dataEnd - dataStart + 1;
  const merges = sheet.getRange(dataStart, 1, n, 6).getMergedRanges();
  const nonBreak = {};
  
  merges.forEach(function (m) {
    if (m.getColumn() === 2 && m.getNumColumns() === 2 && m.getNumRows() === 1) nonBreak[m.getRow()] = true;
  });

  const typeCol = sheet.getRange(dataStart, 3, n, 1).getValues();
  let totalsRow = -1;
  for (let i = 0; i < n; i++) {
    if (String(typeCol[i][0]).trim().toUpperCase() === 'TOTALS') { totalsRow = dataStart + i; break; }
  }
  if (totalsRow > 0) for (let r = totalsRow + 1; r <= dataEnd; r++) nonBreak[r] = true;

  const safe = [];
  for (let r = dataStart; r <= dataEnd; r++) if (!nonBreak[r]) safe.push(r);
  if (safe[0] !== dataStart) safe.unshift(dataStart);
  return safe;
}

function buildBlocksByHeight(sheet, safeRows, dataStart, dataEnd) {
  const rows = safeRows.slice().sort(function (a, b) { return a - b; });
  rows.push(dataEnd + 1); 
  const blocks = [];
  
  for (let i = 0; i < rows.length - 1; i++) {
    const startRow = rows[i];
    const n = rows[i + 1] - startRow;
    if (n > 0) {
      let heightPx = 0;
      for (let r = startRow; r < startRow + n; r++) heightPx += sheet.getRowHeight(r);
      blocks.push({ start: startRow, n: n, h: heightPx });
    }
  }
  return blocks;
}

function packPagesByHeight(blocks, page1BudgetPx, pageNBudgetPx) {
  const pages = [];
  let cur = [], currentHeight = 0, budget = page1BudgetPx;
  
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (cur.length && currentHeight + b.h > budget) {
      pages.push(cur); cur = []; currentHeight = 0; budget = pageNBudgetPx;
    }
    cur.push(b); currentHeight += b.h;
  }
  if (cur.length) pages.push(cur);
  return pages.map(function (pg) {
    return { start: pg[0].start, n: pg.reduce(function (s, x) { return s + x.n; }, 0) };
  });
}

// ----------------------------------------------------------------------
// PDF EXPORTER WITH AUTO-RETRY
// ----------------------------------------------------------------------

function stmt_exportOriginalAsPdf(ss, sheet) {
  const gid = sheet.getSheetId();
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?' +
    'format=pdf' +
    '&gid=' + gid +
    '&size=A4' +
    '&portrait=true' +
    '&fitw=true&scale=2' +
    '&top_margin=0.30&bottom_margin=0.30&left_margin=0.30&right_margin=0.30' +
    '&gridlines=false&printtitle=false&sheetnames=false&horizontal_alignment=CENTER';
    
  const token = ScriptApp.getOAuthToken();
  const options = { 
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true // Prevents script from hard-crashing on 429
  };

  // Attempt the fetch up to 3 times
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = UrlFetchApp.fetch(url, options);
    const code = resp.getResponseCode();
    
    if (code === 200) {
      return resp.getBlob();
    } else if (code === 429) {
      Logger.log(`Rate limited by Google (429). Retrying attempt ${attempt}...`);
      Utilities.sleep(attempt * 4000); // Exponential backoff: waits 4s, then 8s
    } else {
      throw new Error(`Export failed with HTTP code ${code}`);
    }
  }
  
  throw new Error('Failed to export PDF after 3 attempts due to Google API limits.');
}