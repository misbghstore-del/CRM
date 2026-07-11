/**
 * AGING PDF — v3.1 (Rate-Limited "Hide & Export" + Text Masking)
 * ----------------------------------------------------------------------------
 * Paginates the "Aging Report" tab into a multi-page A4 LANDSCAPE PDF.
 * Uses Row-Hiding on the live sheet, throttled to prevent 429 errors,
 * and dynamically masks continuation merges so values don't print twice.
 */

const PDF_AG_V3 = {
  TAB:         'Aging Report',   
  BANNER_TOP:  1,             
  BANNER_BOT:  15,             
  HEADER_ROW:  16,            
  DATA_START:  17,            
  
  ROWS_PAGE1:  18,  
  ROWS_PAGEN:  30,  
};

// ---- Build one landscape single-page PDF blob per page ----
function makeAgingPdfV3(ss) {
  const src = ss.getSheetByName(PDF_AG_V3.TAB);
  if (!src) throw new Error('No "' + PDF_AG_V3.TAB + '" tab.');

  const bTop = PDF_AG_V3.BANNER_TOP;
  const bBot = PDF_AG_V3.BANNER_BOT;       
  const H = PDF_AG_V3.HEADER_ROW;
  const dataStart = PDF_AG_V3.DATA_START;  
  const dataEnd = src.getLastRow();
  const maxRows = src.getMaxRows(); 
  
  if (dataEnd < dataStart) throw new Error('No aging data rows found.');

  const safe = ag3_safeBreakRows(src, dataStart, dataEnd, 4); 
  const blocks = ag3_buildBlocks(safe, dataStart, dataEnd);
  const pages = ag3_packPages(blocks, PDF_AG_V3.ROWS_PAGE1, PDF_AG_V3.ROWS_PAGEN);
  
  Logger.log('High-Speed Aging pages: ' + pages.length);

  const blobs = [];
  
  // Find all vertical merges to handle cross-page masking (e.g., Receipt Amounts)
  const merges = src.getRange(dataStart, 1, dataEnd - dataStart + 1, 13).getMergedRanges();
  const verticalMerges = merges.filter(m => m.getNumRows() > 1);

  try {
    for (let p = 0; p < pages.length; p++) {
      const pg = pages[p];
      const pgStart = pg.start;
      const pgEnd = pg.start + pg.n - 1;

      src.showRows(1, maxRows);
      const restoredColors = []; // Tracks font colors to restore

      if (p === 0) {
        if (pgEnd < maxRows) {
          src.hideRows(pgEnd + 1, maxRows - pgEnd);
        }
      } else {
        src.hideRows(1, bBot);
        if (pgStart > dataStart) src.hideRows(dataStart, pgStart - dataStart);
        if (pgEnd < maxRows) src.hideRows(pgEnd + 1, maxRows - pgEnd);

        // MASK CONTINUATION MERGES
        // If a merge started on a prior page but continues here, make its text invisible
        verticalMerges.forEach(m => {
          const mStart = m.getRow();
          const mEnd = mStart + m.getNumRows() - 1;
          if (mStart < pgStart && mEnd >= pgStart) {
            const cell = src.getRange(mStart, m.getColumn());
            restoredColors.push({
              cell: cell,
              color: cell.getFontColor()
            });
            // Hide text by matching font color to background
            cell.setFontColor(cell.getBackground());
          }
        });
      }
      
      SpreadsheetApp.flush();
      blobs.push(ag3_exportOriginalAsPdf(ss, src)); 

      // RESTORE font colors instantly after the PDF page is captured
      restoredColors.forEach(item => {
        item.cell.setFontColor(item.color);
      });
      
      if (p < pages.length - 1) {
        Utilities.sleep(2500); 
      }
    }
  } finally {
    // FAIL-SAFE: ALWAYS unhide rows and ensure sheet returns to normal
    src.showRows(1, maxRows);
  }
  
  return blobs;
}

// ----------------------------------------------------------------------
// PAGINATION LOGIC
// ----------------------------------------------------------------------

function ag3_safeBreakRows(sheet, dataStart, dataEnd, invoiceCol) {
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

function ag3_buildBlocks(safeRows, dataStart, dataEnd) {
  const rows = safeRows.slice().sort((a, b) => a - b);
  rows.push(dataEnd + 1); 
  const blocks = [];
  for (let i = 0; i < rows.length - 1; i++) {
    const n = rows[i + 1] - rows[i];
    if (n > 0) blocks.push({ start: rows[i], n: n });
  }
  return blocks;
}

function ag3_packPages(blocks, page1Budget, pageNBudget) {
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

// ----------------------------------------------------------------------
// PDF EXPORTER WITH AUTO-RETRY
// ----------------------------------------------------------------------

function ag3_exportOriginalAsPdf(ss, sheet) {
  const gid = sheet.getSheetId();
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?' +
    'format=pdf' +
    '&gid=' + gid +
    '&size=A4' +
    '&portrait=false' +   
    '&fitw=true&scale=2' +
    '&top_margin=0.30&bottom_margin=0.30&left_margin=0.30&right_margin=0.30' +
    '&gridlines=false&printtitle=false&sheetnames=false&horizontal_alignment=CENTER';
    
  const token = ScriptApp.getOAuthToken();
  const options = { 
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true 
  };

  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = UrlFetchApp.fetch(url, options);
    const code = resp.getResponseCode();
    if (code === 200) {
      return resp.getBlob();
    } else if (code === 429) {
      Logger.log(`Rate limited by Google (429). Retrying attempt ${attempt}...`);
      Utilities.sleep(attempt * 4000); 
    } else {
      throw new Error(`Export failed with HTTP code ${code}`);
    }
  }
  
  throw new Error('Failed to export PDF after 3 attempts due to Google API limits.');
}