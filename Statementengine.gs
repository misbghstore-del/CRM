// ============================================================
// CUSTOMER STATEMENT ENGINE — v4  (statementEngine_v4.gs)
// ------------------------------------------------------------
// Replaces ALL previous engine versions (select-all, delete, paste).
// Setup unchanged: "Statement" tab, customer dropdown in B1
// (from Customers!B2:B), menu Statements > Generate Statement.
//
// v4 changes:
//   - Narration merged across Voucher No + Type (cols B:C) and
//     wrapped, so it can NEVER spill across the amount columns.
//   - STYLE switch: 'clean' (BUSY-like, no per-row boxes) or
//     'boxed' (date/amounts merged across the voucher's rows with
//     full borders). Generate one of each into two tabs to compare.
//   - Column widths tuned to fit A4 portrait printable width.
//   - Header row frozen (repeats on-screen while scrolling).
//
// KNOWN LIMITS (need the future server-side PDF builder, not this):
//   - Sheets PDF export cannot repeat the header row on every page.
//   - Custom menu does not run in the Sheets MOBILE app.
//
// PDF export: File > Download > PDF (A4, Portrait, Fit to width,
// Current sheet, margins Narrow).
// ============================================================

// ---------- EDIT: output style ----------
const STYLE = 'clean';   // 'clean'  or  'boxed'
// ---------- EDIT: which tab to write into ----------
const OUTPUT_TAB = 'Statement';   // e.g. make a 'Statement_Boxed' copy to compare
// ---------- EDIT: company letterhead ----------
const COMPANY_NAME     = 'BHARAT GLASS HOUSE';
const COMPANY_ADDRESS  = '834/A/1 AMRIK SINGH ROAD, OPP. ANNAPURNA MANDIR, BATHINDA';
const COMPANY_GSTIN    = 'GSTIN : 03AAAFB7505P1ZI';
// Statement period is computed dynamically (FY start → generation date) in generateStatement.
// ---------- EDIT: theme ----------
const BAND_COLOR = '#283C50';
const BAND_TEXT  = '#FFFFFF';
const NARR_COLOR = '#777777';
const GRID_COLOR = '#CCCCCC';
// ----------------------------------------

// A4 portrait printable width at Narrow margins ≈ 745–760px.
// Columns sum to 715 → fits with a small safety margin.
const COL_W = { date: 78, vch: 150, type: 132, debit: 110, credit: 110, bal: 135 };

const SOURCE_TABS = [
  ['Sales','Party'], ['SalesReturns','Party'], ['Purchases','Party'],
  ['PurchaseReturns','Party'], ['Receipts','Account'], ['Payments','Account'],
  ['Journals','Account'], ['AcctCreditNotes','Account'], ['AcctDebitNotes','Account']
];

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Statements')
    .addItem('Generate Statement', 'generateStatement')
    .addToUi();
}

function norm(s) { return String(s || '').trim().replace(/\s+/g, ' ').toUpperCase(); }

function toDateObj(v) {
  if (v instanceof Date) return v;
  const s = String(v).trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

function generateStatement() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = (function () { try { return SpreadsheetApp.getUi(); } catch (e) { return null; } })();
  const stmt = ss.getSheetByName(OUTPUT_TAB);
  if (!stmt) throw new Error('Create a tab named "' + OUTPUT_TAB + '" first.');

  const customerRaw = stmt.getRange('B1').getValue();
  const customer = norm(customerRaw);
  if (!customer) throw new Error('Pick a customer in cell B1 first.');
  const tz = Session.getScriptTimeZone();

  // ---- opening balance ----
  let opening = 0, openingFound = false;
  const obSheet = ss.getSheetByName('OpeningBalances');
  if (obSheet && obSheet.getLastRow() > 1) {
    const ob = obSheet.getDataRange().getValues();
    const head = ob[0].map(norm);
    const nameCol = head.indexOf('ACCOUNT'), balCol = head.indexOf('BALANCE');
    for (let i = 1; i < ob.length; i++) {
      if (norm(ob[i][nameCol]) === customer) { opening = Number(ob[i][balCol]) || 0; openingFound = true; break; }
    }
  }

  // ---- collect entries ----
  const entries = [];
  for (const [tabName, partyHeader] of SOURCE_TABS) {
    const sh = ss.getSheetByName(tabName);
    if (!sh || sh.getLastRow() < 2) continue;
    const data = sh.getDataRange().getValues();
    const head = data[0].map(norm);
    const cDate = head.indexOf('DATE'), cVchNo = head.indexOf('VOUCHER NO'),
          cType = head.indexOf('TYPE'), cParty = head.indexOf(norm(partyHeader)),
          cSigned = head.indexOf('SIGNEDAMOUNT'), cNarr = head.indexOf('NARRATION');
    if (cDate < 0 || cParty < 0 || cSigned < 0) continue;
    for (let i = 1; i < data.length; i++) {
      if (norm(data[i][cParty]) !== customer) continue;
      const d = toDateObj(data[i][cDate]);
      if (!d) continue;
      let v = data[i][cVchNo];
      v = (v instanceof Date) ? Utilities.formatDate(v, tz, 'dd-MM-yyyy') : String(v);
      const signed = Number(data[i][cSigned]) || 0;
      entries.push({
        date: d, vchNo: v, type: cType >= 0 ? data[i][cType] : tabName,
        narr: cNarr >= 0 ? String(data[i][cNarr] || '').trim() : '',
        debit: signed < 0 ? Math.abs(signed) : 0,
        credit: signed > 0 ? signed : 0
      });
    }
  }
  entries.sort((a, b) => (a.date - b.date) || a.vchNo.localeCompare(b.vchNo));

  const fmtBal = v => {
    const numStr = Math.abs(v).toFixed(2);
    const intPart = numStr.split('.')[0];
    const decPart = numStr.split('.')[1];
    const lastThree = intPart.slice(-3);
    const other = intPart.slice(0, -3);
    const formattedInt = other ? other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + ',' + lastThree : lastThree;
    return formattedInt + '.' + decPart + (v >= 0 ? ' Dr' : ' Cr');
  };

  // statement period: financial-year start → generation date (computed, not fixed).
  // FY start comes from AG.FY_START (same setting the aging report uses) when
  // available; otherwise it is derived from today (Indian FY, Apr–Mar).
  const genDate = new Date();
  const fyStart = (typeof AG !== 'undefined' && AG.FY_START) ? AG.FY_START
                  : new Date(genDate.getMonth() >= 3 ? genDate.getFullYear()
                                                      : genDate.getFullYear() - 1, 3, 1);
  const statementPeriod = 'From ' + Utilities.formatDate(fyStart, tz, 'dd-MM-yyyy') +
                          ' to '  + Utilities.formatDate(genDate, tz, 'dd-MM-yyyy');

  // ---- build row model with metadata ----
  // kind: 'name','addr','gstin','title','period','info','spacer',
  //       'head','open','entry','narr','totals','closing','footer'
  const model = [];
  model.push({ k: 'name',   c: [COMPANY_NAME,'','','','',''] });
  model.push({ k: 'addr',   c: [COMPANY_ADDRESS,'','','','',''] });
  model.push({ k: 'gstin',  c: [COMPANY_GSTIN,'','','','',''] });
  model.push({ k: 'title',  c: ['STATEMENT OF ACCOUNT','','','','',''] });
  model.push({ k: 'period', c: ['( ' + statementPeriod + ' )','','','','',''] });
  model.push({ k: 'info',   c: ['Account : ' + customerRaw,'','','',
              'Generated: ' + Utilities.formatDate(genDate, tz, 'dd-MM-yyyy'),''] });
  model.push({ k: 'spacer', c: ['','','','','',''] });
  model.push({ k: 'head',   c: ['Date','Voucher No','Type','Debit (Rs)','Credit (Rs)','Balance (Rs)'] });
  model.push({ k: 'open',   c: ['', 'Opening Balance' + (openingFound ? '' : ' (not found — taken as 0)'),
              '', '', '', fmtBal(opening)] });

  let bal = opening, totDr = 0, totCr = 0;
  for (const e of entries) {
    bal += e.debit - e.credit; totDr += e.debit; totCr += e.credit;
    const grp = [];   // indices belonging to this voucher (for 'boxed' merge)
    model.push({ k: 'entry', grp: true,
      c: [ Utilities.formatDate(e.date, tz, 'dd-MM-yyyy'), e.vchNo, e.type,
           e.debit ? e.debit : '', e.credit ? e.credit : '', fmtBal(bal) ] });
    if (e.narr) model.push({ k: 'narr', c: ['', e.narr, '', '', '', ''] });
  }
  model.push({ k: 'totals',  c: ['','','TOTALS', totDr, totCr, ''] });
  model.push({ k: 'closing', c: ['','','CLOSING BALANCE','','', fmtBal(bal)] });
  model.push({ k: 'spacer',  c: ['','','','','',''] });
  model.push({ k: 'footer',  c: ['This is a computer-generated statement and does not require a signature. ' +
              'Please report any discrepancy within 7 days.','','','','',''] });

  // ---- render ----
  const START = 3;
  const rowOf = i => START + i;
  const need = START + model.length + 5;
  if (stmt.getMaxRows() < need) stmt.insertRowsAfter(stmt.getMaxRows(), need - stmt.getMaxRows());

  stmt.setFrozenRows(0);  // clear any prior freeze before wiping
  const wipe = stmt.getRange(START, 1, stmt.getMaxRows() - START + 1, 8);
  wipe.breakApart(); wipe.clear();
  stmt.setRowHeights(START, model.length, 20);

  const values = model.map(m => m.c);
  stmt.getRange(START, 1, model.length, 1).setNumberFormat('@');
  stmt.getRange(START, 2, model.length, 1).setNumberFormat('@');
  stmt.getRange(START, 1, model.length, 6).setValues(values);

  // index lookups
  const idx = {};
  model.forEach((m, i) => {
    if (['name','addr','gstin','title','period','info','head','open','totals','closing','footer'].includes(m.k))
      idx[m.k] = i;
  });

  // letterhead band
  stmt.getRange(rowOf(idx.name), 1, 1, 6).merge()
      .setBackground(BAND_COLOR).setFontColor(BAND_TEXT).setFontWeight('bold').setFontSize(16)
      .setHorizontalAlignment('center').setVerticalAlignment('middle');
  stmt.setRowHeight(rowOf(idx.name), 38);
  stmt.getRange(rowOf(idx.addr), 1, 2, 6).setBackground(BAND_COLOR).setFontColor('#C9D3DD').setFontSize(9).setHorizontalAlignment('center');
  stmt.getRange(rowOf(idx.addr), 1, 1, 6).merge();
  stmt.getRange(rowOf(idx.gstin), 1, 1, 6).merge();

  // title + period
  stmt.getRange(rowOf(idx.title), 1, 1, 6).merge()
      .setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center').setVerticalAlignment('bottom');
  stmt.setRowHeight(rowOf(idx.title), 26);
  stmt.getRange(rowOf(idx.period), 1, 1, 6).merge().setFontSize(9).setFontColor('#555555').setHorizontalAlignment('center');

  // info line
  stmt.getRange(rowOf(idx.info), 1, 1, 4).merge().setFontWeight('bold');
  stmt.getRange(rowOf(idx.info), 5, 1, 2).merge().setHorizontalAlignment('right').setFontSize(9).setFontColor('#555555');

  // table header
  stmt.getRange(rowOf(idx.head), 1, 1, 6)
      .setBackground(BAND_COLOR).setFontColor(BAND_TEXT).setFontWeight('bold')
      .setHorizontalAlignment('center').setVerticalAlignment('middle')
      .setBorder(true, true, true, true, true, true, BAND_COLOR, SpreadsheetApp.BorderStyle.SOLID);
  stmt.setRowHeight(rowOf(idx.head), 24);

  // body alignment over the whole table
  const bodyTop = idx.open, bodyBot = idx.closing;
  const bodyRows = bodyBot - bodyTop + 1;
  stmt.getRange(rowOf(bodyTop), 1, bodyRows, 6).setVerticalAlignment('middle');
  stmt.getRange(rowOf(bodyTop), 4, bodyRows, 3).setHorizontalAlignment('right');
  stmt.getRange(rowOf(bodyTop), 1, bodyRows, 1).setHorizontalAlignment('center');
  stmt.getRange(rowOf(idx.open), 1, 1, 6).setFontStyle('italic');
  stmt.getRange(rowOf(bodyTop), 4, bodyRows, 2).setNumberFormat('[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00');

  // ----- narration rows: MERGE B:C, wrap, never overflow amounts -----
  const narrRows = [];
  model.forEach((m, i) => { if (m.k === 'narr') narrRows.push(i); });
  narrRows.forEach(i => {
    const r = rowOf(i);
    stmt.getRange(r, 2, 1, 2).merge()                       // B:C only
        .setWrap(true).setFontStyle('italic').setFontSize(8).setFontColor(NARR_COLOR)
        .setVerticalAlignment('top').setHorizontalAlignment('left');
    stmt.setRowHeight(r, 15);                               // grows taller if wrapped
  });

  // ----- totals / closing -----
  stmt.getRange(rowOf(idx.totals), 1, 2, 6).setFontWeight('bold').setBackground('#F3F5F7');
  stmt.getRange(rowOf(idx.totals), 1, 1, 6)
      .setBorder(true, null, null, null, null, null, BAND_COLOR, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  stmt.getRange(rowOf(idx.closing), 1, 1, 6)
      .setBorder(null, null, true, null, null, null, BAND_COLOR, SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // footer
  stmt.getRange(rowOf(idx.footer), 1, 1, 6).merge()
      .setFontStyle('italic').setFontSize(8).setFontColor('#888888').setHorizontalAlignment('center');

  // ----- STYLE-specific table treatment -----
  if (STYLE === 'clean') {
    // header underline + thin rule under closing only; light row separators
    stmt.getRange(rowOf(idx.open), 1, bodyRows, 6)
        .setBorder(null, null, null, null, null, true, '#EEEEEE', SpreadsheetApp.BorderStyle.SOLID);
  } else { // 'boxed'
    // For each voucher: merge Date/Debit/Credit/Balance down across its
    // narration row (if any), centre vertically, and box the whole group.
    let i = 0;
    while (i < model.length) {
      if (model[i].k !== 'entry') { i++; continue; }
      const start = i;
      let end = i;
      if (i + 1 < model.length && model[i + 1].k === 'narr') end = i + 1;
      const rTop = rowOf(start), span = end - start + 1;
      if (span > 1) {
        [1, 4, 5, 6].forEach(col => {
          stmt.getRange(rTop, col, span, 1).merge().setVerticalAlignment('middle');
        });
      }
      stmt.getRange(rTop, 1, span, 6)
          .setBorder(true, true, true, true, true, true, GRID_COLOR, SpreadsheetApp.BorderStyle.SOLID);
      i = end + 1;
    }
  }

  // ----- column widths (A4 fit) -----
  stmt.setColumnWidth(1, COL_W.date);
  stmt.setColumnWidth(2, COL_W.vch);
  stmt.setColumnWidth(3, COL_W.type);
  stmt.setColumnWidth(4, COL_W.debit);
  stmt.setColumnWidth(5, COL_W.credit);
  stmt.setColumnWidth(6, COL_W.bal);

  // freeze header row so it repeats on-screen while scrolling
  stmt.setFrozenRows(rowOf(idx.head));

  const doneMsg = 'Statement generated (' + STYLE + '): ' + entries.length + ' entries, ' +
                  narrRows.length + ' with narration. Closing: ' + fmtBal(bal);
  if (ui) ui.alert(doneMsg + '\n\nNow run testStatementPdf to build the PDF.');
  else Logger.log(doneMsg);
}