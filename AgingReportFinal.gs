/**
 * OUTSTANDING AGING REPORT — Accounts-tab edition
 * ------------------------------------------------------------
 * The display / matching / merge engine below is the PROVEN
 * inherited engine, kept verbatim. The ONLY change is the input
 * layer: instead of parsing a manually-pasted "Master Ledger",
 * it reads the selected customer's transactions directly from the
 * Accounts tabs (Sales, Receipts, ... ) — the same source as the
 * statement engine.
 *
 * Setup: a tab "Aging Input" with a customer dropdown in B1
 * (Data validation from Customers!B2:B). Menu: Aging > Generate.
 *
 * Behaviour:
 *   - Group "Sundry Debtors(JAQUAR)" -> variable due dates
 *     (prompts for project / non-project days) + TWO reports
 *     (ALL + NBTN-only, the NBTN view filtered from the SAME match).
 *   - Other groups -> single fixed due-day rule, ONE report.
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Aging Reports')
    .addItem('Generate Report', 'generateAgingReport')
    .addItem('📧 Email Reports (first 2 → me)', 'batchEmailReports')
    .addItem('Bucket Report — by Due Date', 'generateDueDateBuckets')
    .addItem('Bucket Report — by Invoice Date (Retail/Project)', 'generateInvoiceDateBuckets')
    .addSeparator() 
    .addItem('📊 Generate Master Dashboard', 'generateMasterDashboard')
    .addItem('🖨️ Generate Printable Master PDF', 'generatePrintableMasterPdf')
    .addSeparator()
    .addItem('🚨 Generate Jaquar (NBTN) Report for Current Dealer', 'generateNbtnOnDemandPdf') // <--- ADDED THIS LINE
    .addToUi();
}

// ===================== CONFIG =====================
const AG = {
  INPUT_TAB:        'Aging Input',
  RD_TAB:           'Jaquar RDs',   // A=Customer, B=Retail due days, C=Project due days
  RD_ROW:           3,              // data row to generate for (for now)
  BATCH_TEST_EMAIL: 'paridhi@example.com',  // <-- SET YOUR EMAIL; first runs go here
  BATCH_ROWS:       2,              // how many Jaquar RDs rows to process in the batch (first 2 for now)
  STATEMENT_TAB:    'Statement',    // the statement engine's output tab (ledger PDF source)
  REPORT_SHEET:     'Aging Report',
  REPORT_SHEET_SHORT:'Aging Report (Short)',
  JAQUAR_GROUP:     'Sundry Debtors(JAQUAR)',
  DEFAULT_PROJECT_DAYS: 25,
  DEFAULT_OTHER_DAYS:   15,
  FIXED_DAYS:           15,
  PARTY_NAME_FALLBACK: 'Unknown Party',
  FY_START: new Date(2026,3,1),   // 01-Apr-2026 (current FY 26-27) — change per FY
  ROW_HEIGHT: 28, HEADER_HEIGHT: 35, TITLE_HEIGHT: 40
};
const COLORS = {
  PRIMARY:'#1e3d59', SUCCESS:'#d9ead3', WARNING:'#fff2cc', DANGER:'#ea9999',
  PROJECT_TAG:'#e1f5fe', BORDER:'#b0bec5', HEADER_BG:'#eceff1'
};

// Adjusted-type abbreviations (our tab "Type" values -> short codes)
const TYPE_ABBR = {
  'PURCHASE INVOICE':'PurI', 'SALES INVOICE':'SupO', 'RECEIPT':'Rcpt',
  'CREDIT NOTE':'CrNt', 'DEBIT NOTE':'DrNt', 'JOURNAL':'Jrnl',
  'SALES RETURN':'SlRt', 'PURCHASE RETURN':'PuRt', 'PAYMENT':'Pymt',
  'OPENING CREDIT':'OpCr'
};
function abbrType(t){
  if (!t) return t;
  // strip any trailing star, abbreviate, re-append star
  const star = /★/.test(t) ? ' ★' : '';
  const base = String(t).replace('★','').trim().toUpperCase();
  return (TYPE_ABBR[base] || String(t).replace('★','').trim()) + star;
}

// Full-paise Indian format for all money cells
const MONEY_NF = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';

// ===================== ENTRY =====================
// Reads customer + due-days from the 'Jaquar RDs' tab (row 2 for now):
//   A = customer name, B = retail due days, C = project due days.
// No prompts — set up for unattended/auto generation.
function generateAgingReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  try { runAgingForRow(ss, AG.RD_ROW); ss.toast('✨ Aging generated', 'Success'); }
  catch (e) { SpreadsheetApp.getUi().alert('Error: ' + e.message + '\n\n' + e.stack); }
}

// Core: generate the Aging Report (+ NBTN short for Jaquar) for one row of
// the Jaquar RDs tab. Returns the customer name on success, or null.
function runAgingForRow(ss, row) {
  const rd = ss.getSheetByName(AG.RD_TAB);
  if (!rd) throw new Error('Missing tab "' + AG.RD_TAB + '"');

  const customer = String(rd.getRange(row,1).getValue()||'').trim();
  const retailDD = parseInt(rd.getRange(row,2).getValue());
  const projectDD = parseInt(rd.getRange(row,3).getValue());
  if (!customer) throw new Error('No customer in ' + AG.RD_TAB + '!A' + row);
  if (isNaN(retailDD) || isNaN(projectDD)) throw new Error('Due days missing in ' + AG.RD_TAB + ' row ' + row);

  const src = readCustomerFromTabs(ss, customer);
  if (!src.found) throw new Error('No transactions for: ' + customer);
  const isJaquar = normGrp(src.group) === normGrp(AG.JAQUAR_GROUP);

  const limitDaysProject = projectDD;
  const limitDaysOther   = retailDD;
  const retailDueForBlock = retailDD;

  ss.toast('Building aging for ' + customer + '...', 'Status', 3);

  const partyName = (src.partyName || AG.PARTY_NAME_FALLBACK) + (src.city ? ', ' + src.city : '');
  const { invoices, receipts } = src;

  invoices.forEach(inv => {
    const dDate = new Date(inv.date);
    if (inv.vchNo !== 'OPENING BAL') dDate.setDate(dDate.getDate() + (inv.isProject ? limitDaysProject : limitDaysOther));
    inv.dueDate = dDate;
  });
  invoices.sort((a,b) => {
    if (a.vchNo === 'OPENING BAL') return -1;
    if (b.vchNo === 'OPENING BAL') return 1;
    if (a.dueDate.getTime() !== b.dueDate.getTime()) return a.dueDate.getTime() - b.dueDate.getTime();
    return String(a.vchNo).localeCompare(String(b.vchNo));
  });

  const dueTotalsMap = calculateDueTotals(invoices);
  const allReceiptsFresh = receipts.map(r => ({ ...r, remaining: r.amount }));
  matchPayments(invoices, receipts);

  const reportData = generateReportData(invoices, dueTotalsMap, AG);
  const summaryMain = calculateSummary(reportData);
  const bucketBlock = computeBucketBlock(invoices, retailDueForBlock);
  writeReportToSheet(ss, reportData, summaryMain, partyName, AG, COLORS, bucketBlock);

  if (isJaquar) {
    const shortReportData = generateShortReportData(invoices, allReceiptsFresh, dueTotalsMap, AG);
    const summaryShort = calculateSummary(shortReportData);
    writeShortReportToSheet(ss, shortReportData, summaryShort, partyName, AG, COLORS);
  } else {
    const stale = ss.getSheetByName(AG.REPORT_SHEET_SHORT);
    if (stale) ss.deleteSheet(stale);
  }
  SpreadsheetApp.flush();
  return customer;
}

function normGrp(s){ return String(s||'').replace(/\s+/g,'').toUpperCase(); }

// Compute the two-table (Retail/Project) invoice-age bucket block from
// already-matched invoices. retailDue drives which slab is first-overdue;
// projectDue = retailDue + 10 (the standard gap). Returns everything the
// header/standalone writer needs.
function computeBucketBlock(invoices, retailDue) {
  const projectDue = retailDue + 10;
  const today = new Date();
  const retailLabels  = ['0-4 Days','5-14 Days','15-24 Days','25-34 Days','35 Days & above'];
  const projectLabels = ['0-4 Days','5-14 Days','15-24 Days','25-34 Days','35-44 Days','45 Days & above'];
  const retailEdges  = [4,14,24,34];
  const projectEdges = [4,14,24,34,44];
  const ageSlab = (age, edges) => { for (let i=0;i<edges.length;i++) if (age<=edges[i]) return i; return edges.length; };
  const retail  = new Array(retailLabels.length).fill(0);
  const project = new Array(projectLabels.length).fill(0);
  let overdueIndependent = 0;
  invoices.forEach(inv => {
    if (inv.remaining <= 0.01) return;
    const age = Math.ceil((today - inv.date) / (864e5));
    if (inv.isProject) {
      const s = ageSlab(age, projectEdges); project[s] = toFixedNum(project[s] + inv.remaining);
      if (age > projectDue) overdueIndependent = toFixedNum(overdueIndependent + inv.remaining);
    } else {
      const s = ageSlab(age, retailEdges); retail[s] = toFixedNum(retail[s] + inv.remaining);
      if (age > retailDue) overdueIndependent = toFixedNum(overdueIndependent + inv.remaining);
    }
  });
  const firstOverdueSlab = (edges, dueDays) => {
    const mins = [0]; for (let i=0;i<edges.length;i++) mins.push(edges[i]+1);
    for (let i=0;i<mins.length;i++) if (mins[i] >= dueDays) return i;
    return mins.length-1;
  };
  return {
    retailLabels, projectLabels, retail, project,
    rTotal: toFixedNum(retail.reduce((a,b)=>a+b,0)),
    pTotal: toFixedNum(project.reduce((a,b)=>a+b,0)),
    rFirstOD: firstOverdueSlab(retailEdges, retailDue),
    pFirstOD: firstOverdueSlab(projectEdges, projectDue),
    overdueIndependent, retailDue, projectDue
  };
}

// ===================== NEW INPUT LAYER =====================
function readCustomerFromTabs(ss, customer){
  const KEY = String(customer).trim().toUpperCase().replace(/\s+/g,' ');
  const norm = s => String(s||'').trim().toUpperCase().replace(/\s+/g,' ');
  const out = { found:false, partyName:customer, group:'', city:'', invoices:[], receipts:[] };
  let recCounter = 0;

  // Station (city) from Customers tab — BUSY calls it 'Station'.
  const cust = ss.getSheetByName('Customers');
  if (cust && cust.getLastRow() > 1){
    const v = cust.getDataRange().getValues(), h = v[0].map(norm);
    const cName = (h.indexOf('NAME')>-1?h.indexOf('NAME'):h.indexOf('ACCOUNT')>-1?h.indexOf('ACCOUNT'):h.indexOf('CUSTOMER'));
    const cCity = (h.indexOf('STATION')>-1?h.indexOf('STATION'):h.indexOf('CITY'));
    if (cName>-1 && cCity>-1){
      for (let i=1;i<v.length;i++){
        if (norm(v[i][cName])===KEY){
          let st = String(v[i][cCity]||'').trim();
          // suppress BUSY placeholders that aren't real cities
          if (/^-*\s*others\s*-*$/i.test(st) || st==='') st='';
          out.city = st;
          break;
        }
      }
    }
  }

  const ob = ss.getSheetByName('OpeningBalances');
  let opening = 0;
  const openingDate = AG.FY_START;
  if (ob && ob.getLastRow() > 1){
    const v = ob.getDataRange().getValues(), h = v[0].map(norm);
    const cN=h.indexOf('ACCOUNT'), cB=h.indexOf('BALANCE');
    for (let i=1;i<v.length;i++){
      if (norm(v[i][cN])===KEY){ opening = Number(v[i][cB])||0; out.found=true; break; }
    }
  }
  if (Math.abs(opening) > 0.01){
    if (opening > 0)
      out.invoices.push({ date:openingDate, vchNo:'OPENING BAL', amount:toFixedNum(opening),
                          remaining:toFixedNum(opening), adjustments:[], isProject:false });
    else
      out.receipts.push({ id:'OP_BAL', date:openingDate, amount:toFixedNum(-opening),
                          remaining:toFixedNum(-opening), type:'Opening Credit' });
  }

  const TABS = [['Sales','Party'],['SalesReturns','Party'],['Purchases','Party'],
                ['PurchaseReturns','Party'],['Receipts','Account'],['Payments','Account'],
                ['Journals','Account'],['AcctCreditNotes','Account'],['AcctDebitNotes','Account']];

  TABS.forEach(([tab, partyHdr]) => {
    const sh = ss.getSheetByName(tab);
    if (!sh || sh.getLastRow() < 2) return;
    const v = sh.getDataRange().getValues(), h = v[0].map(norm);
    const cDate=h.indexOf('DATE'), cVch=h.indexOf('VOUCHER NO'), cType=h.indexOf('TYPE'),
          cParty=h.indexOf(norm(partyHdr)), cSigned=h.indexOf('SIGNEDAMOUNT'),
          cNarr=h.indexOf('NARRATION'),
          cGrp=(h.indexOf('PARTY GROUP')>-1?h.indexOf('PARTY GROUP'):h.indexOf('ACCOUNT GROUP'));
    if (cDate<0 || cParty<0 || cSigned<0) return;

    for (let i=1;i<v.length;i++){
      if (norm(v[i][cParty]) !== KEY) continue;
      out.found = true;
      if (!out.group && cGrp>-1) out.group = String(v[i][cGrp]||'').trim();

      const d = parseTabDate(v[i][cDate]);
      if (!d) continue;
      let vch = v[i][cVch];
      vch = (vch instanceof Date) ? Utilities.formatDate(vch, Session.getScriptTimeZone(),'dd-MM-yyyy') : String(vch);
      const narr = cNarr>-1 ? String(v[i][cNarr]||'') : '';
      const typeStr = cType>-1 ? String(v[i][cType]) : tab;
      const signed = Number(v[i][cSigned])||0;
      const debit  = signed<0 ? Math.abs(signed) : 0;
      const credit = signed>0 ? signed : 0;

      if (debit > 0.01){
        const isProject = narr.toUpperCase().includes('PROJECT');
        out.invoices.push({ date:d, vchNo:vch, amount:toFixedNum(debit),
                            remaining:toFixedNum(debit), adjustments:[], isProject });
      } else if (credit > 0.01){
        out.receipts.push({ id:'REC_'+(recCounter++), date:d, amount:toFixedNum(credit),
                            remaining:toFixedNum(credit), type:typeStr });
      }
    }
  });

  out.receipts.sort((a,b)=>{
    if (a.id==='OP_BAL') return -1;
    if (b.id==='OP_BAL') return 1;
    return a.date - b.date;
  });
  return out;
}

function parseTabDate(v){
  if (v instanceof Date) return v;
  const s=String(v).trim(), m=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1],+m[2]-1,+m[3]);
  const d=new Date(s); return isNaN(d)?null:d;
}

// ============================================================================
// ===== INHERITED ENGINE, UNCHANGED ========================================
// ============================================================================

function toFixedNum(num) { return Number(Number(num).toFixed(2)); }

function calculateDueTotals(invoices) {
  const dueTotalsMap = {};
  invoices.forEach(inv => {
    const dKey = inv.dueDate.getTime();
    if (!dueTotalsMap[dKey]) dueTotalsMap[dKey] = 0;
    dueTotalsMap[dKey] = toFixedNum(dueTotalsMap[dKey] + inv.amount);
  });
  return dueTotalsMap;
}

function matchPayments(invoices, receipts) {
  let invoiceIndex = 0;
  receipts.forEach(receipt => {
    const originalAmt = receipt.amount;
    while (receipt.remaining > 0.005 && invoiceIndex < invoices.length) {
      const inv = invoices[invoiceIndex];
      if (inv.remaining <= 0.005) { invoiceIndex++; continue; }
      let isJump = false;
      for (let i = 0; i < invoiceIndex; i++) {
        if (invoices[i].remaining > 0.005) { isJump = true; break; }
      }
      const applied = Math.min(inv.remaining, receipt.remaining);
      inv.remaining = toFixedNum(inv.remaining - applied);
      receipt.remaining = toFixedNum(receipt.remaining - applied);
      let pType = receipt.type ? receipt.type : 'Rcpt';
      if (isJump) pType += ' ★';
      inv.adjustments.push({
        recId: receipt.id, payDate: receipt.date, payAmount: toFixedNum(applied),
        totalReceipt: originalAmt, payType: pType
      });
    }
  });
}

function generateReportData(invoices, dueTotalsMap, CONFIG) {
  const output = [], bgMatrix = [], invoiceMergeRanges = [], dailyMergeRanges = [], receiptMergeRanges = [];
  const today = new Date();
  let currentRow = 1, displayRunningBalance = 0;
  const metrics = { grandTotalInv:0, grandTotalPending:0, grandTotalPaid:0,
    invoicesWithLatePay:0, totalSettledInvoices:0, totalPaidLateAmt:0, overdueTotal:0,
    buckets:{ b0_5:0,b6_14:0,b15_25:0,b26_35:0,bgt35:0 } };

  invoices.forEach(inv => {
    displayRunningBalance = toFixedNum(displayRunningBalance + inv.amount);
    metrics.grandTotalInv = toFixedNum(metrics.grandTotalInv + inv.amount);
    metrics.grandTotalPending = toFixedNum(metrics.grandTotalPending + inv.remaining);
    const isFullyPaid = (inv.remaining <= 0.01);
    if (isFullyPaid) metrics.totalSettledInvoices++;

    const dueDate = inv.dueDate;
    const dueTotalVal = dueTotalsMap[inv.dueDate.getTime()] || 0;
    const invoiceAgeInDays = Math.ceil((today - inv.date) / (864e5));

    if (!isFullyPaid) {
      // Bucket by INVOICE AGE (today - invoice date) on the PENDING amount.
      const ageDays = Math.ceil((today - inv.date) / (864e5));
      if (ageDays <= 5) metrics.buckets.b0_5 += inv.remaining;
      else if (ageDays <= 14) metrics.buckets.b6_14 += inv.remaining;
      else if (ageDays <= 25) metrics.buckets.b15_25 += inv.remaining;
      else if (ageDays <= 35) metrics.buckets.b26_35 += inv.remaining;
      else metrics.buckets.bgt35 += inv.remaining;
    }
    // Total overdue = pending on invoices whose DUE date has passed
    if (!isFullyPaid && Math.ceil((today - inv.dueDate) / (864e5)) > 0) {
      metrics.overdueTotal = toFixedNum(metrics.overdueTotal + inv.remaining);
    }

    let jumpedQueue = false;
    const consolidated = {};
    inv.adjustments.forEach(adj => {
      const k = adj.recId;
      if (!consolidated[k]) consolidated[k] = { ...adj, payAmount: 0, types: new Set() };
      consolidated[k].payAmount = toFixedNum(consolidated[k].payAmount + adj.payAmount);
      if (adj.payType) { consolidated[k].types.add(adj.payType); if (adj.payType.includes('★')) jumpedQueue = true; }
    });
    const finalAdj = Object.values(consolidated).sort((a, b) => a.payDate - b.payDate);

    let totalPaid = 0, hasLatePayment = false;
    finalAdj.forEach(adj => {
      totalPaid = toFixedNum(totalPaid + adj.payAmount);
      const payOverdue = Math.ceil((adj.payDate - dueDate) / (864e5));
      if (payOverdue > 0) { hasLatePayment = true; metrics.totalPaidLateAmt = toFixedNum(metrics.totalPaidLateAmt + adj.payAmount); }
    });
    metrics.grandTotalPaid = toFixedNum(metrics.grandTotalPaid + totalPaid);
    if (isFullyPaid && hasLatePayment) metrics.invoicesWithLatePay++;

    let displayVch = inv.vchNo;
    if (jumpedQueue) displayVch += ' ★';
    const displayPending = isFullyPaid ? '✔ PAID' : inv.remaining;
    const showRunBal = (displayRunningBalance === 0) ? '-' : displayRunningBalance;
    const overdueDaysCurrent = Math.ceil((today - dueDate) / (864e5));
    const isOverdue = (overdueDaysCurrent > 0);
    const colors = determineRowColors(isFullyPaid, hasLatePayment, isOverdue, finalAdj, dueDate, invoiceAgeInDays, CONFIG);

    const rowData = generateInvoiceRows(inv, displayVch, finalAdj, dueTotalVal, dueDate, totalPaid, displayPending, showRunBal, overdueDaysCurrent, displayRunningBalance, colors, CONFIG);
    output.push(...rowData.rows); bgMatrix.push(...rowData.backgrounds);
    if (rowData.mergeCount > 0) invoiceMergeRanges.push({ r: currentRow, n: rowData.mergeCount });
    currentRow += rowData.rows.length;
    displayRunningBalance = toFixedNum(displayRunningBalance - totalPaid);
  });

  output.push(['GRAND TOTAL','-','-','-','-', metrics.grandTotalInv, metrics.grandTotalPaid, metrics.grandTotalPending,'-','-','-','-','-']);
  bgMatrix.push(new Array(13).fill('#CFD8DC'));
  calculateMergeRanges(output, dailyMergeRanges, receiptMergeRanges);
  return { output, bgMatrix, invoiceMergeRanges, dailyMergeRanges, receiptMergeRanges, metrics };
}

function generateShortReportData(invoices, freshReceipts, dueTotalsMap, CONFIG) {
  const output = [], bgMatrix = [], invoiceMergeRanges = [], dailyMergeRanges = [];
  const today = new Date();
  let currentRow = 1, localRunningBalance = 0;
  const metrics = { grandTotalInv:0, grandTotalPending:0, grandTotalPaid:0,
    invoicesWithLatePay:0, totalSettledInvoices:0, totalPaidLateAmt:0, overdueTotal:0,
    buckets:{ b0_5:0,b6_14:0,b15_25:0,b26_35:0,bgt35:0 } };

  const nbtnInvoices = invoices.filter(inv =>
    inv.vchNo === 'OPENING BAL' || String(inv.vchNo).toUpperCase().startsWith('NBTN'));

  nbtnInvoices.forEach(inv => {
    localRunningBalance = toFixedNum(localRunningBalance + inv.amount);
    metrics.grandTotalInv = toFixedNum(metrics.grandTotalInv + inv.amount);
    metrics.grandTotalPending = toFixedNum(metrics.grandTotalPending + inv.remaining);
    const isFullyPaid = (inv.remaining <= 0.01);
    if (isFullyPaid) metrics.totalSettledInvoices++;

    const dueDate = inv.dueDate;
    const dueTotalVal = dueTotalsMap[inv.dueDate.getTime()] || 0;
    const invoiceAgeInDays = Math.ceil((today - inv.date) / (864e5));

    if (!isFullyPaid) {
      // Bucket by INVOICE AGE (today - invoice date) on the PENDING amount.
      const ageDays = Math.ceil((today - inv.date) / (864e5));
      if (ageDays <= 5) metrics.buckets.b0_5 += inv.remaining;
      else if (ageDays <= 14) metrics.buckets.b6_14 += inv.remaining;
      else if (ageDays <= 25) metrics.buckets.b15_25 += inv.remaining;
      else if (ageDays <= 35) metrics.buckets.b26_35 += inv.remaining;
      else metrics.buckets.bgt35 += inv.remaining;
    }
    // Total overdue = pending on invoices whose DUE date has passed
    if (!isFullyPaid && Math.ceil((today - inv.dueDate) / (864e5)) > 0) {
      metrics.overdueTotal = toFixedNum(metrics.overdueTotal + inv.remaining);
    }

    let jumpedQueue = false;
    const consolidated = {};
    inv.adjustments.forEach(adj => {
      const k = adj.recId;
      if (!consolidated[k]) consolidated[k] = { ...adj, payAmount: 0, types: new Set() };
      consolidated[k].payAmount = toFixedNum(consolidated[k].payAmount + adj.payAmount);
      if (adj.payType) { consolidated[k].types.add(adj.payType); if (adj.payType.includes('★')) jumpedQueue = true; }
    });
    const finalAdj = Object.values(consolidated).sort((a, b) => a.payDate - b.payDate);

    let totalPaid = 0, hasLatePayment = false;
    finalAdj.forEach(adj => {
      totalPaid = toFixedNum(totalPaid + adj.payAmount);
      const payOverdue = Math.ceil((adj.payDate - dueDate) / (864e5));
      if (payOverdue > 0) { hasLatePayment = true; metrics.totalPaidLateAmt = toFixedNum(metrics.totalPaidLateAmt + adj.payAmount); }
    });
    metrics.grandTotalPaid = toFixedNum(metrics.grandTotalPaid + totalPaid);
    if (isFullyPaid && hasLatePayment) metrics.invoicesWithLatePay++;

    let displayVch = inv.vchNo;
    if (jumpedQueue) displayVch += ' ★';
    const displayPending = isFullyPaid ? '✔ PAID' : inv.remaining;
    const showRunBal = (localRunningBalance === 0) ? '-' : localRunningBalance;
    const overdueDaysCurrent = Math.ceil((today - dueDate) / (864e5));
    const isOverdue = (overdueDaysCurrent > 0);
    const colors = determineRowColors(isFullyPaid, hasLatePayment, isOverdue, finalAdj, dueDate, invoiceAgeInDays, CONFIG);

    const rowData = generateInvoiceRowsShort(inv, displayVch, finalAdj, dueTotalVal, dueDate, totalPaid, displayPending, showRunBal, overdueDaysCurrent, localRunningBalance, colors, CONFIG);
    output.push(...rowData.rows); bgMatrix.push(...rowData.backgrounds);
    if (rowData.mergeCount > 0) invoiceMergeRanges.push({ r: currentRow, n: rowData.mergeCount });
    currentRow += rowData.rows.length;
    localRunningBalance = toFixedNum(localRunningBalance - totalPaid);
  });

  if (output.length > 0) {
    output.push(['GRAND TOTAL','-','-','-','-', metrics.grandTotalInv, metrics.grandTotalPaid, metrics.grandTotalPending,'-','-','-']);
    bgMatrix.push(new Array(11).fill('#CFD8DC'));
    calculateMergeRangesShort(output, dailyMergeRanges);
  } else {
    output.push(['No NBTN invoices found','-','-','-','-','-','-','-','-','-','-']);
    bgMatrix.push(new Array(11).fill('#FFFFFF'));
  }
  return { output, bgMatrix, invoiceMergeRanges, dailyMergeRanges, metrics };
}

function determineRowColors(isFullyPaid, hasLatePayment, isOverdue, finalAdj, dueDate, invoiceAgeInDays, CONFIG) {
  let pendingColColor = null, invoiceNoColor = null;
  if (isFullyPaid && hasLatePayment) pendingColColor = '#ea9999';
  else if (isFullyPaid) {
    if (finalAdj.length > 0) {
      const lastPaymentDate = new Date(Math.max(...finalAdj.map(a => a.payDate.getTime())));
      const daysDiff = Math.ceil((lastPaymentDate - dueDate) / (864e5));
      pendingColColor = daysDiff > 0 ? '#fff2cc' : '#d9ead3';
    }
  } else if (!isFullyPaid && isOverdue) pendingColColor = '#fff2cc';
  if (!isFullyPaid && isOverdue) invoiceNoColor = '#ea9999';
  return { pendingColColor, invoiceNoColor };
}

function generateInvoiceRows(inv, displayVch, finalAdj, dueTotalVal, dueDate, totalPaid, displayPending, showRunBal, overdueDaysCurrent, displayRunningBalance, colors, CONFIG) {
  const rows = [], backgrounds = []; let mergeCount = 0;
  const pr = inv.isProject ? 'PROJECT' : 'RETAIL';
  // Columns (13): InvDate, DueDateTotal, Type, InvNo, DueDate, Amount,
  //   TotalPaid, Status, ClearDate, AdjustedAmt, OverdueDays, ReceiptAmt, AdjType
  if (finalAdj.length === 0) {
    rows.push([inv.date, dueTotalVal, pr, displayVch, dueDate, inv.amount, 0, displayPending, '-','-', overdueDaysCurrent, '-','-','']);
    const rowBg = new Array(13).fill('#FFFFFF');
    if (colors.pendingColColor) rowBg[7] = colors.pendingColColor;
    if (colors.invoiceNoColor) rowBg[3] = colors.invoiceNoColor;
    if (inv.isProject) rowBg[2] = '#e3f2fd';
    backgrounds.push(rowBg); mergeCount = 1;
  } else {
    finalAdj.forEach((adj, index) => {
      const payOverdue = Math.ceil((adj.payDate - dueDate) / (864e5));
      const tStr = Array.from(adj.types).map(abbrType).join(' + ');
      rows.push([inv.date, dueTotalVal, pr, displayVch, dueDate, inv.amount, totalPaid, displayPending, adj.payDate, adj.payAmount, payOverdue, adj.totalReceipt, tStr, adj.recId]);
      const rowColor = (index === 0) ? '#FFFFFF' : '#F8F9FA';
      const rowBg = new Array(13).fill(rowColor);
      if (colors.pendingColColor) rowBg[7] = colors.pendingColColor;
      if (colors.invoiceNoColor) rowBg[3] = colors.invoiceNoColor;
      if (inv.isProject && index === 0) rowBg[2] = '#e3f2fd';
      backgrounds.push(rowBg); mergeCount++;
    });
    if (inv.remaining > 0.01) {
      rows.push([inv.date, dueTotalVal, pr, displayVch, dueDate, inv.amount, totalPaid, displayPending, '-','-', overdueDaysCurrent, '-','-','']);
      const rowBg = new Array(13).fill('#F8F9FA');
      if (colors.pendingColColor) rowBg[7] = colors.pendingColColor;
      if (colors.invoiceNoColor) rowBg[3] = colors.invoiceNoColor;
      backgrounds.push(rowBg); mergeCount++;
    }
  }
  return { rows, backgrounds, mergeCount };
}

function generateInvoiceRowsShort(inv, displayVch, finalAdj, dueTotalVal, dueDate, totalPaid, displayPending, showRunBal, overdueDaysCurrent, displayRunningBalance, colors, CONFIG) {
  const rows = [], backgrounds = []; let mergeCount = 0;
  const pr = inv.isProject ? 'PROJECT' : 'RETAIL';
  // Columns (11): InvDate, DueDateTotal, Type, InvNo, DueDate, Amount,
  //   TotalPaid, Status, ClearDate, AdjustedAmt, OverdueDays
  if (finalAdj.length === 0) {
    rows.push([inv.date, dueTotalVal, pr, displayVch, dueDate, inv.amount, 0, displayPending, '-','-', overdueDaysCurrent]);
    const rowBg = new Array(11).fill('#FFFFFF');
    if (colors.pendingColColor) rowBg[7] = colors.pendingColColor;
    if (colors.invoiceNoColor) rowBg[3] = colors.invoiceNoColor;
    if (inv.isProject) rowBg[2] = '#e3f2fd';
    backgrounds.push(rowBg); mergeCount = 1;
  } else {
    finalAdj.forEach((adj, index) => {
      const payOverdue = Math.ceil((adj.payDate - dueDate) / (864e5));
      rows.push([inv.date, dueTotalVal, pr, displayVch, dueDate, inv.amount, totalPaid, displayPending, adj.payDate, adj.payAmount, payOverdue]);
      const rowColor = (index === 0) ? '#FFFFFF' : '#F8F9FA';
      const rowBg = new Array(11).fill(rowColor);
      if (colors.pendingColColor) rowBg[7] = colors.pendingColColor;
      if (colors.invoiceNoColor) rowBg[3] = colors.invoiceNoColor;
      if (inv.isProject && index === 0) rowBg[2] = '#e3f2fd';
      backgrounds.push(rowBg); mergeCount++;
    });
    if (inv.remaining > 0.01) {
      rows.push([inv.date, dueTotalVal, pr, displayVch, dueDate, inv.amount, totalPaid, displayPending, '-','-', overdueDaysCurrent]);
      const rowBg = new Array(11).fill('#F8F9FA');
      if (colors.pendingColColor) rowBg[7] = colors.pendingColColor;
      if (colors.invoiceNoColor) rowBg[3] = colors.invoiceNoColor;
      backgrounds.push(rowBg); mergeCount++;
    }
  }
  return { rows, backgrounds, mergeCount };
}

function calculateMergeRanges(output, dailyMergeRanges, receiptMergeRanges) {
  const loopLen = output.length - 1;
  let startR = 1, count = 1;
  for (let i = 1; i < loopLen; i++) {
    const prev = output[i - 1][4], curr = output[i][4];   // Due Date col (index 4)
    if ((prev instanceof Date) && (curr instanceof Date) && prev.getTime() === curr.getTime()) count++;
    else { if (count > 1) dailyMergeRanges.push({ r: startR, n: count }); startR = i + 1; count = 1; }
  }
  if (count > 1) dailyMergeRanges.push({ r: startR, n: count });

  startR = 1; let matchCount = 1;
  for (let i = 1; i < loopLen; i++) {
    const prev = output[i - 1], curr = output[i];
    // receipt identity = unique recId (col index 13). Two different receipts
    // with the same amount/date/type no longer collide.
    const prevKey = String(prev[13]);
    const currKey = String(curr[13]);
    const isReal = (curr[13] !== '' && curr[13] != null) && (typeof curr[11] === 'number' && curr[11] > 0);
    if (currKey === prevKey && isReal) matchCount++;
    else { if (matchCount > 1) receiptMergeRanges.push({ r: startR, n: matchCount }); startR = i + 1; matchCount = 1; }
  }
  if (matchCount > 1) receiptMergeRanges.push({ r: startR, n: matchCount });
}

function calculateMergeRangesShort(output, dailyMergeRanges) {
  const loopLen = output.length - 1;
  if (loopLen <= 1) return;
  let startR = 1, count = 1;
  for (let i = 1; i < loopLen; i++) {
    const prev = output[i - 1][4], curr = output[i][4];   // Due Date col (index 4)
    if ((prev instanceof Date) && (curr instanceof Date) && prev.getTime() === curr.getTime()) count++;
    else { if (count > 1) dailyMergeRanges.push({ r: startR, n: count }); startR = i + 1; count = 1; }
  }
  if (count > 1) dailyMergeRanges.push({ r: startR, n: count });
}

function calculateSummary(reportData) {
  const { metrics } = reportData;
  const lateRatio = metrics.invoicesWithLatePay + ' / ' + metrics.totalSettledInvoices;
  const latePercentage = (metrics.totalSettledInvoices > 0) ? (metrics.invoicesWithLatePay / metrics.totalSettledInvoices) : 0;
  const formatInd = (num) => Number(num).toLocaleString('en-IN', { maximumFractionDigits: 2 });
  const lateAmtRatio = formatInd(metrics.totalPaidLateAmt) + ' / ' + formatInd(metrics.grandTotalPaid);
  const lateAmtPercentage = (metrics.grandTotalPaid > 0) ? (metrics.totalPaidLateAmt / metrics.grandTotalPaid) : 0;
  return { buckets: [metrics.buckets.b0_5, metrics.buckets.b6_14, metrics.buckets.b15_25, metrics.buckets.b26_35, metrics.buckets.bgt35], totalOutstanding: metrics.grandTotalPending, overdueTotal: metrics.overdueTotal, lateRatio, latePercentage, lateAmtRatio, lateAmtPercentage };
}

function writeReportToSheet(ss, reportData, summary, partyName, config, COLORS, bb) {
  let sheet = ss.getSheetByName(config.REPORT_SHEET);
  if (sheet) {
    sheet.clear();
    sheet.setFrozenRows(0); 
  } else {
    sheet = ss.insertSheet(config.REPORT_SHEET);
  }
  
  sheet.setHiddenGridlines(true);
  const MONEY_NF = '[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00';
  const B = SpreadsheetApp.BorderStyle.SOLID;

  // ========================================================================
  // 1. TOP TITLE BAND (Rows 1 & 2)
  // ========================================================================
  sheet.getRange('A1:M1').merge().setValue('AGEING ANALYSIS REPORT')
       .setFontWeight('bold').setFontSize(14).setFontFamily('Roboto')
       .setBackground(COLORS.PRIMARY).setFontColor('white')
       .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);

  sheet.getRange(2, 1, 1, 8).merge().setValue(partyName.toUpperCase())
       .setFontSize(15).setFontWeight('bold').setFontFamily('Roboto')
       .setHorizontalAlignment('left').setVerticalAlignment('middle').setFontColor(COLORS.PRIMARY);
  sheet.getRange(2, 9, 1, 5).merge().setValue('As on: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy'))
       .setFontStyle('italic').setHorizontalAlignment('right').setVerticalAlignment('middle').setFontColor(COLORS.PRIMARY).setFontSize(10);
  sheet.setRowHeight(2, 26);
  sheet.setRowHeight(3, 4); // Spacer

  // ========================================================================
  // 2. LEFT BLOCK: RECONFIGURED OFFSET BUCKETS (Rows 4-10)
  // ========================================================================
  const RCOL0 = 3, TOTC = 8;
  const OD_BG = '#ffcdd2', OK_BG = '#e8f5e9';

  sheet.getRange(4,1,2,1).merge().setValue('RETAIL\nINVOICES')
       .setFontWeight('bold').setFontSize(9).setBackground('#37474f').setFontColor('white')
       .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  
  bb.retailLabels.forEach((lab,i) => sheet.getRange(4, RCOL0+i).setValue(lab));
  sheet.getRange(4, TOTC).setValue('Total');
  
  bb.retail.forEach((v,i) => sheet.getRange(5, RCOL0+i).setValue(v).setNumberFormat(MONEY_NF).setBackground(i >= bb.rFirstOD ? OD_BG : OK_BG));
  sheet.getRange(5, TOTC).setValue(bb.rTotal).setNumberFormat(MONEY_NF).setBackground('#CFD8DC').setFontWeight('bold');

  sheet.getRange(6,1,2,1).merge().setValue('PROJECT\nINVOICES')
       .setFontWeight('bold').setFontSize(9).setBackground('#37474f').setFontColor('white')
       .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true);
  
  bb.projectLabels.forEach((lab,i) => sheet.getRange(6, RCOL0-1+i).setValue(lab));
  sheet.getRange(6, TOTC).setValue('Total');
  
  bb.project.forEach((v,i) => sheet.getRange(7, RCOL0-1+i).setValue(v).setNumberFormat(MONEY_NF).setBackground(i >= bb.pFirstOD ? OD_BG : OK_BG));
  sheet.getRange(7, TOTC).setValue(bb.pTotal).setNumberFormat(MONEY_NF).setBackground('#CFD8DC').setFontWeight('bold');

  // Total Overdue correctly shifted to Row 9
  sheet.getRange(9,1).setValue('TOTAL OVERDUE')
       .setFontWeight('bold').setFontSize(10).setFontColor(COLORS.PRIMARY).setVerticalAlignment('middle');
  
  const colSum = {};
  for (let j = bb.rFirstOD; j < bb.retail.length; j++) colSum[RCOL0 + j] = toFixedNum((colSum[RCOL0 + j] || 0) + bb.retail[j]);
  for (let j = bb.pFirstOD; j < bb.project.length; j++) colSum[RCOL0 - 1 + j] = toFixedNum((colSum[RCOL0 - 1 + j] || 0) + bb.project[j]);
  
  const rdTab = ss.getSheetByName('Jaquar RDs');
  let retailDD = 0, projectDD = 0;
  if (rdTab) {
    const rdData = rdTab.getDataRange().getValues();
    const cleanParty = partyName.split(',')[0].trim();
    for(let i = 1; i < rdData.length; i++) {
      if(String(rdData[i][0]).trim() === cleanParty) {
        retailDD = parseInt(rdData[i][1]) || 0;
        projectDD = parseInt(rdData[i][2]) || 0;
        break;
      }
    }
  }

  let layoutGrandOD = 0;
  for (let c = 2; c < TOTC; c++) {
    const val = colSum[c] || 0;
    
    let isActiveOD = false;
    const ri = c - 3, pj = c - 2;
    if (ri >= 0 && ri <= 4 && ri >= bb.rFirstOD) isActiveOD = true;
    if (pj >= 0 && pj <= 5 && pj >= bb.pFirstOD) isActiveOD = true;
    
    if (isActiveOD) {
      sheet.getRange(9, c).setValue(val).setNumberFormat(MONEY_NF).setFontWeight('bold').setBackground(val > 0 ? '#ffab91' : '#FFFFFF');
      
      // FIXED POSITIONAL BRACKETS (1-10, 11-20, etc.) - Will now print on 0.00 buckets too
      let lab = "";
      if (ri >= 0 && ri <= 4 && ri >= bb.rFirstOD) {
        const offset = ri - bb.rFirstOD;
        lab = (ri === 4) ? `(>${offset * 10} Days)` : `(${offset * 10 + 1}-${(offset + 1) * 10} Days)`;
      } else if (pj >= 0 && pj <= 5 && pj >= bb.pFirstOD) {
        const offset = pj - bb.pFirstOD;
        lab = (pj === 5) ? `(>${offset * 10} Days)` : `(${offset * 10 + 1}-${(offset + 1) * 10} Days)`;
      }
      
      if (lab) sheet.getRange(10, c).setValue(lab).setFontSize(7).setFontStyle('italic').setFontColor('#666').setHorizontalAlignment('center').setVerticalAlignment('middle');
    } else {
      sheet.getRange(9, c).setValue('').setBackground('#FFFFFF');
      sheet.getRange(10, c).setValue('');
    }
    
    layoutGrandOD = toFixedNum(layoutGrandOD + val);
  }
  
  sheet.getRange(9, TOTC).setValue(layoutGrandOD).setNumberFormat(MONEY_NF).setFontWeight('bold').setBackground('#ff8a65');

  // Left Block Styling
  sheet.getRange(4,2,1,TOTC-1).setFontWeight('bold').setBackground(COLORS.HEADER_BG);
  sheet.getRange(6,2,1,TOTC-1).setFontWeight('bold').setBackground(COLORS.HEADER_BG);
  [4,5,6,7].forEach(r => sheet.getRange(r,2,1,TOTC-1).setHorizontalAlignment('center').setVerticalAlignment('middle'));
  sheet.getRange(9,2,1,TOTC-1).setHorizontalAlignment('center').setVerticalAlignment('middle');
  [5,7].forEach(r => sheet.getRange(r,2,1,TOTC-1).setFontWeight('bold'));
  
  sheet.getRange(4,2,2,TOTC-1).setBorder(true,true,true,true,true,true,COLORS.BORDER,B);
  sheet.getRange(6,2,2,TOTC-1).setBorder(true,true,true,true,true,true,COLORS.BORDER,B);
  sheet.getRange(9,2,1,TOTC-1).setBorder(true,true,true,true,true,true,COLORS.BORDER,B);
  sheet.getRange(4,1,2,1).setBorder(true,true,true,true,null,null,COLORS.BORDER,B);
  sheet.getRange(6,1,2,1).setBorder(true,true,true,true,null,null,COLORS.BORDER,B);

  // ========================================================================
  // 3. RIGHT BLOCK: ALIGNED METRICS STACK (Rows 4-9)
  // ========================================================================
  const mL = 9, mR = 13;
  sheet.getRange(4,mL,1,mR-mL+1).merge().setValue('TOTAL OUTSTANDING')
       .setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(5,mL,1,mR-mL+1).merge().setValue(summary.totalOutstanding)
       .setNumberFormat(MONEY_NF).setFontWeight('bold').setFontSize(12).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#b3e5fc');
  
  sheet.getRange(6,mL,1,2).merge().setValue('Late Ratio').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(6,mL+2,1,3).merge().setValue('Late %').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(7,mL,1,2).merge().setValue(summary.lateRatio).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#f8bbd0');
  sheet.getRange(7,mL+2,1,3).merge().setValue(summary.latePercentage).setNumberFormat('0.00%').setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#f8bbd0');
  
  sheet.getRange(8,mL,1,2).merge().setValue('Late Amt Ratio').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(8,mL+2,1,3).merge().setValue('Late Amt %').setFontWeight('bold').setFontSize(9).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground(COLORS.HEADER_BG);
  sheet.getRange(9,mL,1,2).merge().setValue(summary.lateAmtRatio).setFontSize(9).setWrap(true).setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ef9a9a');
  sheet.getRange(9,mL+2,1,3).merge().setValue(summary.lateAmtPercentage).setNumberFormat('0.00%').setHorizontalAlignment('center').setVerticalAlignment('middle').setBackground('#ef9a9a');
  
  sheet.getRange(4,mL,6,mR-mL+1).setBorder(true,true,true,true,true,true,COLORS.BORDER,B);
  
  // Enforce equal heights for the top blocks
  [4,5,6,7,8,9].forEach(r => sheet.setRowHeight(r, 22));
  sheet.setRowHeight(10, 14); // Brackets row

  // ========================================================================
  // 4. DYNAMIC AUDITING LINE (Row 11) (This is hidden right now using white colour text)
  // ========================================================================
  if (Math.abs(layoutGrandOD - bb.overdueIndependent) > 1) {
    sheet.getRange(11,1,1,13).merge()
         .setValue(`Warning: Layout Overdue Variance Identified (${layoutGrandOD} vs ${bb.overdueIndependent})`)
         .setFontColor('white').setFontSize(8).setFontStyle('italic').setHorizontalAlignment('center').setVerticalAlignment('middle');
    sheet.setRowHeight(11, 2);//Change this to sheet.setRowHeight(11, 14) when you want to make it visible in the report
  } else {
    sheet.setRowHeight(11, 2); 
  }

  // ========================================================================
  // 5. PAYMENT TREND COHORT TIMELINE (Rows 12-14)
  // ========================================================================
  const trendData = calculatePaymentTrends(reportData); 
  const trendRow = 12; 
  
  sheet.getRange(trendRow, 1, 1, 13).merge().setValue('PAYMENT BEHAVIOR TRACKING (Net Weighted Credit Score by Cleared Month)   (-ve value means days delayed)')
    .setFontWeight('bold').setFontSize(10).setBackground('#283C50').setFontColor('white')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  
  sheet.getRange(trendRow + 1, 1, 1, 13).setValues([trendData.headers])
    .setFontWeight('bold').setFontSize(9).setBackground('#eceff1')
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#b0bec5', B);
  sheet.getRange(trendRow + 1, 1).setBackground('#37474f').setFontColor('white'); 

  sheet.getRange(trendRow + 2, 1, 1, 13).setValues([trendData.data])
    .setBackgrounds([trendData.colors]).setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle')
    .setBorder(true, true, true, true, true, true, '#b0bec5', B);

  [trendRow, trendRow + 1, trendRow + 2].forEach(r => sheet.setRowHeight(r, 22));
  sheet.setRowHeight(15, 4); // Spacer before table

  // ========================================================================
  // 6. MAIN DATA TABLE BLOCK (Starts at Row 16)
  // ========================================================================
  const startRowOffset = 16; 
  const headers = [['Invoice Date','Due Date Total','Type','Invoice No.','Due Date','Amount','Total Paid','Payment Status','Clear Date','Adjusted Amount','Overdue Status','Receipt Amount','Adj Type']];
  
  sheet.getRange(startRowOffset, 1, 1, 13).setValues(headers).setBackground(COLORS.PRIMARY).setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, 'white', B);
  sheet.setRowHeight(startRowOffset, 32);

  const { output, bgMatrix, invoiceMergeRanges, dailyMergeRanges, receiptMergeRanges } = reportData;
  
  // Transform raw days (Negative = Due in Xd / Positive = X / 0 = 0)
  const transformedOutput = output.map(row => {
    const cleanRow = [...row];
    const rawDays = parseInt(cleanRow[10]);
    if (!isNaN(rawDays)) {
      if (rawDays < 0) {
        cleanRow[10] = `Due in ${Math.abs(rawDays)}d`; 
      } else if (rawDays > 0) {
        cleanRow[10] = rawDays; // Just the positive number
      } else {
        cleanRow[10] = 0; // Just 0
      }
    }
    return cleanRow;
  });

  const outRange = sheet.getRange(startRowOffset + 1, 1, transformedOutput.length, 13);
  outRange.setValues(transformedOutput.map(r => r.slice(0, 13))); 
  outRange.setBackgrounds(bgMatrix);
  
  const lastRowIdx = startRowOffset + transformedOutput.length;
  sheet.getRange(1, 1, lastRowIdx + 5, 13).setFontFamily('Roboto');

  const df = 'dd-MM-yyyy';
  sheet.getRange(startRowOffset + 1, 1, transformedOutput.length, 1).setNumberFormat(df);   
  sheet.getRange(startRowOffset + 1, 5, transformedOutput.length, 1).setNumberFormat(df);   
  sheet.getRange(startRowOffset + 1, 9, transformedOutput.length, 1).setNumberFormat(df);   
  [2, 6, 7, 8, 10, 12].forEach(c => {
    if (c !== 11) { // Apply Money formatting to all except the Overdue Status text column
      sheet.getRange(startRowOffset + 1, c, transformedOutput.length, 1).setNumberFormat(MONEY_NF);
    } else {
      sheet.getRange(startRowOffset + 1, c, transformedOutput.length, 1).setNumberFormat('General'); 
    }
  });

  invoiceMergeRanges.forEach(m => {
    const actualRow = startRowOffset + m.r;
    [1, 3, 4, 5, 6, 7, 8].forEach(c => sheet.getRange(actualRow, c, m.n, 1).merge().setVerticalAlignment('middle'));
    sheet.getRange(actualRow, 1, 1, 13).setFontWeight('bold');
    sheet.getRange(actualRow, 1, m.n, 13).setBorder(true, true, true, true, true, true, '#b0bec5', B);
  });
  
  dailyMergeRanges.forEach(m => sheet.getRange(startRowOffset + m.r, 2, m.n, 1).merge().setVerticalAlignment('middle'));
  receiptMergeRanges.forEach(m => {
    sheet.getRange(startRowOffset + m.r, 12, m.n, 1).merge().setVerticalAlignment('middle');
    sheet.getRange(startRowOffset + m.r, 13, m.n, 1).merge().setVerticalAlignment('middle');
  });

  sheet.getRange(lastRowIdx, 1, 1, 13).setFontWeight('bold').setBackground(COLORS.PRIMARY).setFontColor('white').setBorder(true, true, true, true, null, null);
  outRange.setBorder(null, true, null, true, true, true, '#b0bec5', B);

  sheet.setRowHeights(startRowOffset + 1, transformedOutput.length, 26);
  sheet.setFrozenRows(startRowOffset);
  
  sheet.setColumnWidth(1, 95);  sheet.setColumnWidth(3, 75);  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidth(5, 95);  sheet.setColumnWidth(8, 105); sheet.setColumnWidth(9, 95); 
  sheet.setColumnWidth(11, 100); sheet.setColumnWidth(13, 80);
  sheet.getRange(startRowOffset, 1, transformedOutput.length + 1, 13).setHorizontalAlignment('center');
}

function writeShortReportToSheet(ss, shortReportData, summary, partyName, CONFIG, COLORS) {
  let shortSheet = ss.getSheetByName(CONFIG.REPORT_SHEET_SHORT);
  if (shortSheet) shortSheet.clear(); else shortSheet = ss.insertSheet(CONFIG.REPORT_SHEET_SHORT);
  shortSheet.setHiddenGridlines(true);
  const { output, bgMatrix, invoiceMergeRanges, dailyMergeRanges } = shortReportData;
  const numColumnsToKeep = 11;
  const shortHeaders = [['Invoice Date','Due Date Total','Type','Invoice No.','Due Date','Amount','Total Paid','Payment Status','Clear Date','Adjusted Amount','Overdue Days']];
  const startRowOffset = 7;

  shortSheet.getRange('A1:K1').merge().setValue('AGEING ANALYSIS REPORT (NBTN ONLY)').setFontWeight('bold').setFontSize(14).setFontFamily('Roboto').setBackground(COLORS.PRIMARY).setFontColor('white').setHorizontalAlignment('center').setVerticalAlignment('middle');
  const summaryHeaders = [['0-5 Days','6-14 Days','15-25 Days','26-35 Days','> 35 Days','Total Outstanding','Total Overdue','Late Ratio','Late %','Late Amt Ratio','Late Amt %']];
  shortSheet.getRange(2, 1, 1, 11).setValues(summaryHeaders).setFontWeight('bold').setBackground(COLORS.HEADER_BG).setBorder(true, true, true, true, true, true, '#cfd8dc', SpreadsheetApp.BorderStyle.SOLID).setHorizontalAlignment('center');
  const summaryData = [[summary.buckets[0], summary.buckets[1], summary.buckets[2], summary.buckets[3], summary.buckets[4], summary.totalOutstanding, summary.overdueTotal, summary.lateRatio, summary.latePercentage, summary.lateAmtRatio, summary.lateAmtPercentage]];
  shortSheet.getRange(3, 1, 1, 11).setValues(summaryData).setFontWeight('bold').setFontSize(11).setBorder(true, true, true, true, true, true, '#cfd8dc', SpreadsheetApp.BorderStyle.SOLID).setHorizontalAlignment('center').setVerticalAlignment('middle');
  shortSheet.getRange(3, 8, 1, 4).setWrap(true).setFontSize(9);  // ratio/pct cells: wrap, smaller font

  shortSheet.getRange(3, 1, 1, 7).setNumberFormat(MONEY_NF);
  shortSheet.getRange(3, 8).setNumberFormat('@'); shortSheet.getRange(3, 9).setNumberFormat('0.00%');
  shortSheet.getRange(3, 10).setNumberFormat('@'); shortSheet.getRange(3, 11).setNumberFormat('0.00%');
  const summaryColors = [{range:'A3',color:'#c8e6c9'},{range:'B3',color:'#dcedc8'},{range:'C3',color:'#fff9c4'},{range:'D3',color:'#ffe0b2'},{range:'E3',color:'#ffcdd2'},{range:'F3',color:'#b3e5fc'},{range:'G3',color:'#ffab91'},{range:'H3:I3',color:'#f8bbd0'},{range:'J3:K3',color:'#ef9a9a'}];
  summaryColors.forEach(sc => shortSheet.getRange(sc.range).setBackground(sc.color));

  const partyRow = 5;
  shortSheet.getRange(partyRow, 1, 1, 6).merge().setValue(partyName.toUpperCase()).setFontSize(20).setFontWeight('bold').setFontFamily('Roboto').setHorizontalAlignment('left').setVerticalAlignment('middle').setBackground('#FFFFFF').setFontColor(COLORS.PRIMARY).setBorder(false, false, true, false, false, false, COLORS.PRIMARY, SpreadsheetApp.BorderStyle.SOLID_THICK);
  shortSheet.getRange(partyRow, 7, 1, 5).merge().setValue('As on: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy')).setFontStyle('italic').setHorizontalAlignment('right').setVerticalAlignment('middle').setFontColor(COLORS.PRIMARY).setFontSize(10).setBorder(false, false, true, false, false, false, COLORS.PRIMARY, SpreadsheetApp.BorderStyle.SOLID_THICK);

  shortSheet.getRange(startRowOffset, 1, 1, numColumnsToKeep).setValues(shortHeaders).setBackground(COLORS.PRIMARY).setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center').setVerticalAlignment('middle').setBorder(true, true, true, true, true, true, 'white', SpreadsheetApp.BorderStyle.SOLID);
  const outRange = shortSheet.getRange(startRowOffset + 1, 1, output.length, numColumnsToKeep);
  outRange.setValues(output); outRange.setBackgrounds(bgMatrix);
  const lastRowIdx = startRowOffset + output.length;
  shortSheet.getRange(1, 1, lastRowIdx + 5, numColumnsToKeep).setFontFamily('Roboto');

  const df = 'dd-MM-yyyy';
  shortSheet.getRange(startRowOffset + 1, 1, output.length, 1).setNumberFormat(df);   // Invoice Date
  shortSheet.getRange(startRowOffset + 1, 5, output.length, 1).setNumberFormat(df);   // Due Date
  shortSheet.getRange(startRowOffset + 1, 9, output.length, 1).setNumberFormat(df);   // Clear Date
  [2, 6, 7, 8, 10].forEach(c => shortSheet.getRange(startRowOffset + 1, c, output.length, 1).setNumberFormat(MONEY_NF));
  shortSheet.getRange(startRowOffset + 1, 11, output.length, 1).setNumberFormat('0'); // Overdue Days

  invoiceMergeRanges.forEach(m => {
    const actualRow = startRowOffset + m.r;
    [1, 3, 4, 5, 6, 7, 8].forEach(c => shortSheet.getRange(actualRow, c, m.n, 1).merge().setVerticalAlignment('middle'));
    shortSheet.getRange(actualRow, 1, 1, numColumnsToKeep).setFontWeight('bold');
    shortSheet.getRange(actualRow, 1, m.n, numColumnsToKeep).setBorder(true, true, true, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);
  });
  dailyMergeRanges.forEach(m => shortSheet.getRange(startRowOffset + m.r, 2, m.n, 1).merge().setVerticalAlignment('middle'));

  shortSheet.getRange(lastRowIdx, 1, 1, numColumnsToKeep).setFontWeight('bold').setBackground(COLORS.PRIMARY).setFontColor('white').setBorder(true, true, true, true, null, null);
  outRange.setBorder(null, true, null, true, true, true, COLORS.BORDER, SpreadsheetApp.BorderStyle.SOLID);

  // Re-apply Indian money format AFTER merging.
  [2, 6, 7, 8, 10].forEach(c => shortSheet.getRange(startRowOffset + 1, c, output.length, 1).setNumberFormat(MONEY_NF));
  shortSheet.getRange(3, 1, 1, 7).setNumberFormat(MONEY_NF);

  shortSheet.setRowHeights(startRowOffset + 1, output.length, CONFIG.ROW_HEIGHT);
  shortSheet.setRowHeight(startRowOffset, CONFIG.HEADER_HEIGHT); shortSheet.setRowHeight(1, CONFIG.TITLE_HEIGHT);
  shortSheet.setRowHeight(2, 30); shortSheet.setRowHeight(3, CONFIG.TITLE_HEIGHT);
  shortSheet.setFrozenRows(startRowOffset);
  shortSheet.autoResizeColumns(1, numColumnsToKeep);
  shortSheet.setColumnWidth(1, 95); shortSheet.setColumnWidth(3, 75); shortSheet.setColumnWidth(4, 150);
  shortSheet.setColumnWidth(5, 95); shortSheet.setColumnWidth(8, 105); shortSheet.setColumnWidth(9, 95);
  shortSheet.getRange(1, 1, lastRowIdx + 5, numColumnsToKeep).setHorizontalAlignment('center');
}

// ============================================================
// SUMMARY BUCKET REPORTS (summary only, no invoice rows)
// ============================================================

const BUCKET_COLORS_DUE = ['#c8e6c9','#dcedc8','#e1f5fe','#fff9c4','#ffe0b2','#ffab91','#ef9a9a'];
const BUCKET_COLORS_INV = ['#c8e6c9','#fff9c4','#ffe0b2','#ffab91','#ef9a9a'];

// ---------- REPORT 1: by DUE DATE (one table, all invoices) ----------
function generateDueDateBuckets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const inp = ss.getSheetByName(AG.INPUT_TAB);
    if (!inp) { ui.alert('Create a tab "' + AG.INPUT_TAB + '" with a customer dropdown in B1.'); return; }
    const custRaw = inp.getRange('B1').getValue();
    const customer = String(custRaw||'').trim();
    if (!customer) { ui.alert('Pick a customer in B1 first.'); return; }

    const src = readCustomerFromTabs(ss, customer);
    if (!src.found) { ui.alert('No transactions found for: ' + customer); return; }
    const isJaquar = normGrp(src.group) === normGrp(AG.JAQUAR_GROUP);

    let projDays = AG.DEFAULT_PROJECT_DAYS, otherDays = AG.DEFAULT_OTHER_DAYS;
    if (isJaquar) {
      const p = ui.prompt('Due Days (1/2)', `PROJECT invoices (default ${AG.DEFAULT_PROJECT_DAYS}):`, ui.ButtonSet.OK_CANCEL);
      if (p.getSelectedButton() !== ui.Button.OK) return;
      let t = p.getResponseText().trim(); projDays = (t===''||isNaN(parseInt(t)))?AG.DEFAULT_PROJECT_DAYS:parseInt(t);
      const q = ui.prompt('Due Days (2/2)', `NON-PROJECT invoices (default ${AG.DEFAULT_OTHER_DAYS}):`, ui.ButtonSet.OK_CANCEL);
      if (q.getSelectedButton() !== ui.Button.OK) return;
      t = q.getResponseText().trim(); otherDays = (t===''||isNaN(parseInt(t)))?AG.DEFAULT_OTHER_DAYS:parseInt(t);
    } else { projDays = otherDays = AG.FIXED_DAYS; }

    // assign due dates + match so we bucket the REMAINING (unpaid) amount
    src.invoices.forEach(inv => {
      const d = new Date(inv.date);
      if (inv.vchNo !== 'OPENING BAL') d.setDate(d.getDate() + (inv.isProject ? projDays : otherDays));
      inv.dueDate = d;
    });
    src.invoices.sort((a,b) => {
      if (a.vchNo==='OPENING BAL') return -1; if (b.vchNo==='OPENING BAL') return 1;
      if (a.dueDate.getTime()!==b.dueDate.getTime()) return a.dueDate-b.dueDate;
      return String(a.vchNo).localeCompare(String(b.vchNo));
    });
    matchPayments(src.invoices, src.receipts);

    const today = new Date();
    // 7 slabs by days-past-due (dpd = today - dueDate)
    const labels = ['Due in 15+ Days','Due in 6-15 Days','Due in 1-5 Days','Due Today',
                    'Overdue 1-10 Days','Overdue 11-20 Days','Overdue 21+ Days'];
    const slabs = [0,0,0,0,0,0,0];
    src.invoices.forEach(inv => {
      if (inv.remaining <= 0.01) return;
      const dpd = Math.ceil((today - inv.dueDate) / (864e5));
      let i;
      if (dpd <= -16) i = 0;
      else if (dpd <= -6) i = 1;
      else if (dpd <= -1) i = 2;
      else if (dpd === 0) i = 3;
      else if (dpd <= 10) i = 4;
      else if (dpd <= 20) i = 5;
      else i = 6;
      slabs[i] = toFixedNum(slabs[i] + inv.remaining);
    });
    const total = toFixedNum(slabs.reduce((a,b)=>a+b,0));

    writeBucketSheet(ss, 'Bucket (Due Date)', 'AGEING BY DUE DATE', custRaw, src.group,
                     labels, slabs, total, BUCKET_COLORS_DUE, isJaquar ?
                     `Project ${projDays}d / Non-project ${otherDays}d` : `Fixed ${AG.FIXED_DAYS}d`);
    ss.toast('Due-date bucket report generated', 'Done', 4);
  } catch (e) { ui.alert('Error: ' + e.message + '\n\n' + e.stack); }
}

// ---------- REPORT 2: by INVOICE DATE (two tables: Retail, Project) ----------
function writeBucketSheet(ss, sheetName, title, partyName, group, labels, slabs, total, colors, basisNote) {
  let sh = ss.getSheetByName(sheetName);
  if (sh) sh.clear(); else sh = ss.insertSheet(sheetName);
  sh.setHiddenGridlines(true);
  const C = COLORS, n = labels.length, money = MONEY_NF;

  sh.getRange(1,1,1,n+1).merge().setValue(title).setFontWeight('bold').setFontSize(14)
    .setFontFamily('Roboto').setBackground(C.PRIMARY).setFontColor('white')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1,38);

  sh.getRange(3,1).setValue(partyName.toUpperCase()).setFontSize(14).setFontWeight('bold').setFontColor(C.PRIMARY);
  sh.getRange(4,1).setValue('Group: ' + group + '   |   Terms: ' + basisNote +
    '   |   As on: ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(),'dd-MM-yyyy'))
    .setFontStyle('italic').setFontSize(9).setFontColor('#555');

  // header row of slab labels + Total
  const hdr = labels.concat(['Total Outstanding']);
  sh.getRange(6,1,1,n+1).setValues([hdr]).setFontWeight('bold').setBackground(C.HEADER_BG)
    .setHorizontalAlignment('center').setWrap(true)
    .setBorder(true,true,true,true,true,true,'#cfd8dc',SpreadsheetApp.BorderStyle.SOLID);
  const vals = slabs.concat([total]);
  sh.getRange(7,1,1,n+1).setValues([vals]).setFontWeight('bold').setFontSize(11)
    .setHorizontalAlignment('center').setNumberFormat(money)
    .setBorder(true,true,true,true,true,true,'#cfd8dc',SpreadsheetApp.BorderStyle.SOLID);
  for (let i=0;i<n;i++) sh.getRange(7,i+1).setBackground(colors[i]);
  sh.getRange(7,n+1).setBackground('#CFD8DC');

  sh.setRowHeight(6,40); sh.setRowHeight(7,34);
  for (let i=1;i<=n+1;i++) sh.setColumnWidth(i,120);
  sh.getRange(1,1,7,n+1).setFontFamily('Roboto');
}


// ---------- REPORT 2: by INVOICE DATE — two offset tables (Retail/Project) ----------
// Layout: project table shifted one column right so OVERDUE slabs of both
// tables stack in the same columns. Overdue columns are computed from the
// entered due-days (not hard-coded), and Total Overdue is ALSO computed
// independently as a cross-check.
function generateInvoiceDateBuckets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  try {
    const inp = ss.getSheetByName(AG.INPUT_TAB);
    if (!inp) { ui.alert('Create a tab "' + AG.INPUT_TAB + '" with a customer dropdown in B1.'); return; }
    const custRaw = inp.getRange('B1').getValue();
    const customer = String(custRaw||'').trim();
    if (!customer) { ui.alert('Pick a customer in B1 first.'); return; }

    const src = readCustomerFromTabs(ss, customer);
    if (!src.found) { ui.alert('No transactions found for: ' + customer); return; }
    const isJaquar = normGrp(src.group) === normGrp(AG.JAQUAR_GROUP);

    // due-days drive (a) which invoice-age slab is the first OVERDUE slab and
    // (b) the independent overdue total
    let retailDue = AG.FIXED_DAYS, projectDue = AG.FIXED_DAYS;
    if (isJaquar) {
      const p = ui.prompt('Actual Due Days (1/2)',
        'RETAIL actual due days (e.g. 14 or 4):', ui.ButtonSet.OK_CANCEL);
      if (p.getSelectedButton() !== ui.Button.OK) return;
      let t = p.getResponseText().trim(); retailDue = (t===''||isNaN(parseInt(t)))?14:parseInt(t);
      const q = ui.prompt('Actual Due Days (2/2)',
        'PROJECT actual due days (e.g. 24 or 14):', ui.ButtonSet.OK_CANCEL);
      if (q.getSelectedButton() !== ui.Button.OK) return;
      t = q.getResponseText().trim(); projectDue = (t===''||isNaN(parseInt(t)))?24:parseInt(t);
    }

    // match so we bucket only the unpaid remaining
    src.invoices.forEach(inv => { inv.dueDate = new Date(inv.date); });
    src.invoices.sort((a,b)=>{ if(a.vchNo==='OPENING BAL')return -1; if(b.vchNo==='OPENING BAL')return 1; return a.date-b.date; });
    matchPayments(src.invoices, src.receipts);

    const today = new Date();
    // invoice-age slabs (boundaries per the confirmed spec)
    const retailLabels  = ['0-4 Days','5-14 Days','15-24 Days','25-35 Days','> 35 Days'];
    const projectLabels = ['0-4 Days','5-14 Days','15-24 Days','25-35 Days','36-45 Days','> 45 Days'];
    const retailEdges  = [4,14,24,35];   // <=4,<=14,<=24,<=35,else
    const projectEdges = [4,14,24,35,45];

    const ageSlab = (age, edges) => { for (let i=0;i<edges.length;i++) if (age<=edges[i]) return i; return edges.length; };

    const retail  = new Array(retailLabels.length).fill(0);
    const project = new Array(projectLabels.length).fill(0);
    let overdueIndependent = 0;   // cross-check: sum of remaining where age >= due-days

    src.invoices.forEach(inv => {
      if (inv.remaining <= 0.01) return;
      const age = Math.ceil((today - inv.date) / (864e5));
      if (inv.isProject) {
        project[ageSlab(age, projectEdges)] = toFixedNum(project[ageSlab(age, projectEdges)] + inv.remaining);
        if (age > projectDue) overdueIndependent = toFixedNum(overdueIndependent + inv.remaining);
      } else {
        retail[ageSlab(age, retailEdges)] = toFixedNum(retail[ageSlab(age, retailEdges)] + inv.remaining);
        if (age > retailDue) overdueIndependent = toFixedNum(overdueIndependent + inv.remaining);
      }
    });
    const rTotal = toFixedNum(retail.reduce((a,b)=>a+b,0));
    const pTotal = toFixedNum(project.reduce((a,b)=>a+b,0));

    // Which slab index is the first OVERDUE one? An invoice is overdue when
    // age >= dueDays, i.e. age > dueDays-1. Find first slab whose lower bound
    // is >= dueDays. Retail edges: slab i covers (edge[i-1], edge[i]].
    const firstOverdueSlab = (edges, dueDays) => {
      // slab 0 = [0..edges0]; overdue if the slab's MIN age >= dueDays
      const mins = [0]; for (let i=0;i<edges.length;i++) mins.push(edges[i]+1);
      for (let i=0;i<mins.length;i++) if (mins[i] >= dueDays) return i;
      return mins.length-1;
    };
    const rFirstOD = firstOverdueSlab(retailEdges, retailDue);
    const pFirstOD = firstOverdueSlab(projectEdges, projectDue);

    writeOffsetBucketSheet(ss, 'Bucket (Invoice Date)', custRaw, src.group,
      retailLabels, retail, rTotal, rFirstOD,
      projectLabels, project, pTotal, pFirstOD,
      overdueIndependent, retailDue, projectDue);

    ss.toast('Invoice-date bucket report generated', 'Done', 4);
  } catch (e) { ui.alert('Error: ' + e.message + '\n\n' + e.stack); }
}

// Two stacked tables; project shifted +1 column. Overdue cells highlighted and
// summed; an independent overdue total is shown and flagged if it disagrees.
// Faithful reproduction of the user's Excel layout, refined:
//  - Total column sits immediately after the last slab (no gap column)
//  - TOTAL OVERDUE row same height as slab rows
//  - Borders around all table + total cells (matches the detailed reports)
//  - All bucket and total cells horizontally + vertically centred
function writeOffsetBucketSheet(ss, sheetName, partyName, group,
    rLabels, rData, rTotal, rFirstOD, pLabels, pData, pTotal, pFirstOD,
    overdueIndependent, retailDue, projectDue) {
  let sh = ss.getSheetByName(sheetName);
  if (sh) sh.clear(); else sh = ss.insertSheet(sheetName);
  sh.getRange(1,1,30,12).breakApart();
  sh.setHiddenGridlines(true);
  const C = COLORS, money = MONEY_NF, B = SpreadsheetApp.BorderStyle.SOLID;
  const OD_BG = '#ffcdd2', OK_BG = '#e8f5e9';

  // Project shifted +1 left of retail so overdue slabs stack.
  //   RETAIL slabs at cols C..G (3-7); PROJECT slabs at cols B..G (2-7)
  //   Last slab column = 7 (G); Total column = 8 (H) -> no gap.
  const RCOL0 = 3, PCOL0 = 2, LASTSLAB = 7, TOTCOL = 8, NC = TOTCOL;
  const ROWH = 32;

  // Title band
  sh.getRange(1,1,1,NC).merge().setValue('AGEING BY INVOICE DATE')
    .setFontWeight('bold').setFontSize(14).setFontFamily('Roboto')
    .setBackground(C.PRIMARY).setFontColor('white')
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  sh.setRowHeight(1,38);
  sh.getRange(3,1).setValue(String(partyName).toUpperCase()).setFontSize(14).setFontWeight('bold').setFontColor(C.PRIMARY);
  sh.getRange(4,1).setValue('Group: ' + group + '   |   Due days: Retail ' + retailDue +
    ', Project ' + projectDue + '   |   As on: ' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(),'dd-MM-yyyy'))
    .setFontStyle('italic').setFontSize(9).setFontColor('#555');

  // ---------- RETAIL: title merged A6:A7, headers row6, values row7 ----------
  sh.getRange(6,1,2,1).merge().setValue('RETAIL\nINVOICES').setFontWeight('bold').setFontSize(11)
    .setBackground('#37474f').setFontColor('white').setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setWrap(true);
  rLabels.forEach((lab,i) => sh.getRange(6, RCOL0+i).setValue(lab));
  sh.getRange(6, TOTCOL).setValue('Total');
  rData.forEach((v,i) => sh.getRange(7, RCOL0+i).setValue(v).setNumberFormat(money)
    .setBackground(i >= rFirstOD ? OD_BG : OK_BG));
  sh.getRange(7, TOTCOL).setValue(rTotal).setNumberFormat(money).setBackground('#CFD8DC').setFontWeight('bold');

  // ---------- PROJECT: title merged A9:A10, headers row9, values row10 ----------
  sh.getRange(9,1,2,1).merge().setValue('PROJECT\nINVOICES').setFontWeight('bold').setFontSize(11)
    .setBackground('#37474f').setFontColor('white').setHorizontalAlignment('center')
    .setVerticalAlignment('middle').setWrap(true);
  pLabels.forEach((lab,i) => sh.getRange(9, PCOL0+i).setValue(lab));
  sh.getRange(9, TOTCOL).setValue('Total');
  pData.forEach((v,i) => sh.getRange(10, PCOL0+i).setValue(v).setNumberFormat(money)
    .setBackground(i >= pFirstOD ? OD_BG : OK_BG));
  sh.getRange(10, TOTCOL).setValue(pTotal).setNumberFormat(money).setBackground('#CFD8DC').setFontWeight('bold');

  // header rows styling
  [6,9].forEach(r => sh.getRange(r,2,1,NC-1).setFontWeight('bold').setBackground(C.HEADER_BG));

  // ---------- TOTAL OVERDUE row 12: per-column vertical sums ----------
  sh.getRange(12,1).setValue('TOTAL OVERDUE').setFontWeight('bold').setFontSize(12).setFontColor(C.PRIMARY);
  const colSum = {};
  for (let i=rFirstOD;i<rData.length;i++){ const col=RCOL0+i; colSum[col]=toFixedNum((colSum[col]||0)+rData[i]); }
  for (let i=pFirstOD;i<pData.length;i++){ const col=PCOL0+i; colSum[col]=toFixedNum((colSum[col]||0)+pData[i]); }
  let grand = 0;
  // fill every slab column in the overdue row (0 if none) so the row reads cleanly
  for (let c=PCOL0;c<=LASTSLAB;c++){
    const val = colSum[c] || 0;
    sh.getRange(12,c).setValue(val).setNumberFormat(money).setFontWeight('bold').setBackground('#ffab91');
    grand = toFixedNum(grand + val);
  }
  sh.getRange(12, TOTCOL).setValue(grand).setNumberFormat(money).setFontWeight('bold').setFontSize(12).setBackground('#ff8a65');

  // ---------- alignment: centre all bucket + total cells (h + v) ----------
  // slab/value/total rows: 6,7 (retail), 9,10 (project), 12 (overdue)
  [6,7,9,10,12].forEach(r => sh.getRange(r,2,1,NC-1).setHorizontalAlignment('center').setVerticalAlignment('middle'));
  // also the merged title cells already centred; ensure value rows bold-centered
  [7,10,12].forEach(r => sh.getRange(r,2,1,NC-1).setFontWeight('bold'));

  // ---------- borders around the three table blocks (cols B..Total) ----------
  sh.getRange(6,2,2,NC-1).setBorder(true,true,true,true,true,true,C.BORDER,B);   // retail header+values
  sh.getRange(9,2,2,NC-1).setBorder(true,true,true,true,true,true,C.BORDER,B);   // project header+values
  sh.getRange(12,2,1,NC-1).setBorder(true,true,true,true,true,true,C.BORDER,B);  // total overdue
  // border around the merged title cells too
  sh.getRange(6,1,2,1).setBorder(true,true,true,true,null,null,C.BORDER,B);
  sh.getRange(9,1,2,1).setBorder(true,true,true,true,null,null,C.BORDER,B);

  // ---------- equal row heights ----------
  [6,7,9,10,12].forEach(r => sh.setRowHeight(r, ROWH));

  // cross-check
  const mismatch = Math.abs(grand - overdueIndependent) > 0.01;
  sh.getRange(13,1).setValue(mismatch
      ? '⚠ CHECK: layout overdue ' + grand.toLocaleString('en-IN') +
        ' ≠ independent ' + overdueIndependent.toLocaleString('en-IN')
      : '✓ Overdue cross-check OK (' + overdueIndependent.toLocaleString('en-IN',{minimumFractionDigits:2}) + ')')
    .setFontStyle('italic').setFontSize(9).setFontColor(mismatch ? '#c00' : '#388e3c');

  // widths
  sh.setColumnWidth(1, 120);
  for (let c=2;c<=TOTCOL;c++) sh.setColumnWidth(c, 115);
  sh.getRange(1,1,13,NC).setFontFamily('Roboto');
}

// ============================================================
// BATCH: generate Aging + Statement PDFs and email per customer
// ============================================================
// For now: processes the first AG.BATCH_ROWS rows of Jaquar RDs and emails
// BOTH PDFs (aging + ledger) to AG.BATCH_TEST_EMAIL (you), one email per
// customer. Later: add a customer-email column and switch the recipient.
function batchEmailReports() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const rd = ss.getSheetByName(AG.RD_TAB);
  if (!rd) { ui.alert('Missing tab "' + AG.RD_TAB + '"'); return; }

  const confirm = ui.alert('Email Reports',
    'This will generate and email the first ' + AG.BATCH_ROWS + ' customers\' reports to ' +
    AG.BATCH_TEST_EMAIL + '. Continue?', ui.ButtonSet.OK_CANCEL);
  if (confirm !== ui.Button.OK) return;

  let sent = 0; const errors = [];
  for (let row = 2; row < 2 + AG.BATCH_ROWS; row++) {
    const customerCell = String(rd.getRange(row,1).getValue()||'').trim();
    if (!customerCell) continue;
    try {
      // 1) Aging report
      const customer = runAgingForRow(ss, row);

      // 2) Statement (ledger): drive the statement engine by setting its B1
      const stmtTab = ss.getSheetByName(AG.STATEMENT_TAB);
      if (!stmtTab) throw new Error('Missing "' + AG.STATEMENT_TAB + '" tab for ledger');
      stmtTab.getRange('B1').setValue(customer);
      SpreadsheetApp.flush();
      generateStatement();          // same-project function; writes the Statement tab
      SpreadsheetApp.flush();

      // 3) Export both tabs to PDF with the column header repeating every page
      //    and the banner block shown once. Aging: header row 12, banner 1-11.
      //    Statement: header row 8 ('Date/Voucher...'), banner 1-7.
      const agingPdf = exportWithRepeatHeader(ss, AG.REPORT_SHEET, 12, 1, 11, 'Ageing_' + safeName(customer), true);
      const ledgerPdf = exportWithRepeatHeader(ss, AG.STATEMENT_TAB, 10, 1, 9, 'Statement_' + safeName(customer), false);

      // 4) Email both to the test recipient
      const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy');
      MailApp.sendEmail({
        to: AG.BATCH_TEST_EMAIL,
        subject: 'Account Statement & Ageing — ' + customer + ' (as on ' + today + ')',
        body: 'Dear Sir/Madam,\n\nPlease find attached your account statement and ageing report as on ' +
              today + '.\n\nKindly arrange payment of the overdue amount at the earliest.\n\n' +
              'Regards,\nBharat Glass House',
        attachments: [agingPdf, ledgerPdf]
      });
      sent++;
    } catch (e) {
      errors.push('Row ' + row + ' (' + customerCell + '): ' + e.message);
    }
  }

  ui.alert('Batch done',
    'Emailed: ' + sent + ' customer(s) to ' + AG.BATCH_TEST_EMAIL +
    (errors.length ? '\n\nErrors:\n' + errors.join('\n') : ''),
    ui.ButtonSet.OK);
}

// Export with column-header repeating on every page and the banner (rows
// above the table header) shown once. Builds a temporary sheet:
//   row 1 = the table's column-header row (frozen -> repeats every page)
//   row 2.. = banner block (appears once) then the data rows
function exportWithRepeatHeader(ss, srcName, headerRow, bannerTop, bannerBot, fileLabel, landscape) {
  const src = ss.getSheetByName(srcName);
  if (!src) throw new Error('Sheet not found: ' + srcName);
  const lastRow = src.getLastRow(), lastCol = src.getLastColumn();
  if (lastRow < headerRow) throw new Error('Header row beyond data in ' + srcName);

  const tmpName = '__pdf_tmp__';
  let tmp = ss.getSheetByName(tmpName);
  if (tmp) ss.deleteSheet(tmp);
  tmp = ss.insertSheet(tmpName);

  const copyRows = (srcStartRow, numRows, destStartRow) => {
    if (numRows <= 0) return 0;
    src.getRange(srcStartRow, 1, numRows, lastCol)
       .copyTo(tmp.getRange(destStartRow, 1, numRows, lastCol), {contentsOnly:false});
    return numRows;
  };

  copyRows(headerRow, 1, 1);                 // column header -> row 1
  let dest = 2;
  if (bannerTop && bannerBot && bannerBot >= bannerTop)
    dest += copyRows(bannerTop, bannerBot - bannerTop + 1, dest);   // banner once
  const dataStart = headerRow + 1;
  if (lastRow >= dataStart) dest += copyRows(dataStart, lastRow - dataStart + 1, dest);

  for (let c = 1; c <= lastCol; c++) tmp.setColumnWidth(c, src.getColumnWidth(c));
  tmp.setHiddenGridlines(true);
  tmp.setFrozenRows(1);                       // repeat ONLY the column header
  SpreadsheetApp.flush();

  const blob = exportSheetAsPdf(ss, tmpName, fileLabel, landscape);
  ss.deleteSheet(tmp);
  return blob;
}

// Export a single sheet (by name) to a PDF blob. `landscape` controls
// orientation. Uses fit-to-width (scale=2) so the table paginates by height
// across multiple pages, and frozen rows repeat on each page.
function exportSheetAsPdf(ss, sheetName, fileLabel, landscape) {
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  const gid = sheet.getSheetId();
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?' +
    'format=pdf' +
    '&gid=' + gid +
    '&size=A4' +
    '&portrait=' + (landscape ? 'false' : 'true') +
    '&fitw=true' +              // fit to page WIDTH only
    '&scale=2' +                // 2 = fit to width (height flows to more pages)
    '&top_margin=0.30&bottom_margin=0.30&left_margin=0.30&right_margin=0.30' +
    '&gridlines=false' +
    '&printtitle=false' +
    '&sheetnames=false' +
    '&pagenum=CENTER' +
    '&horizontal_alignment=CENTER';
  const token = ScriptApp.getOAuthToken();
  const resp = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  return resp.getBlob().setName(fileLabel + '.pdf');
}

function safeName(s) { return String(s).replace(/[^\w\-]+/g, '_').replace(/_+/g,'_').slice(0,60); }

// ============================================================================
// DAILY OUTSTANDING-ONLY AGING REPORT
// ============================================================================
function runOutstandingAgingForRow(ss, row) {
  const rd = ss.getSheetByName(AG.RD_TAB);
  if (!rd) throw new Error('Missing tab "' + AG.RD_TAB + '"');

  const customer = String(rd.getRange(row,1).getValue()||'').trim();
  const retailDD = parseInt(rd.getRange(row,2).getValue());
  const projectDD = parseInt(rd.getRange(row,3).getValue());
  if (!customer) throw new Error('No customer in ' + AG.RD_TAB + '!A' + row);

  const src = readCustomerFromTabs(ss, customer);
  if (!src.found) throw new Error('No transactions for: ' + customer);

  const partyName = (src.partyName || AG.PARTY_NAME_FALLBACK) + (src.city ? ', ' + src.city : '');
  const { invoices, receipts } = src;

  invoices.forEach(inv => {
    const dDate = new Date(inv.date);
    if (inv.vchNo !== 'OPENING BAL') dDate.setDate(dDate.getDate() + (inv.isProject ? projectDD : retailDD));
    inv.dueDate = dDate;
  });

  invoices.sort((a,b) => {
    if (a.vchNo === 'OPENING BAL') return -1;
    if (b.vchNo === 'OPENING BAL') return 1;
    if (a.dueDate.getTime() !== b.dueDate.getTime()) return a.dueDate.getTime() - b.dueDate.getTime();
    return String(a.vchNo).localeCompare(String(b.vchNo));
  });

  const dueTotalsMap = calculateDueTotals(invoices);
  matchPayments(invoices, receipts);

  // 1. MATH: Calculate Summary Metrics using the FULL year's data
  // This ensures Late Ratio, Late %, Late Amt Ratio, and Late Amt % are perfectly accurate.
  const fullReportData = generateReportData(invoices, dueTotalsMap, AG);
  const fullSummary = calculateSummary(fullReportData);

  // 2. LAYOUT: Keep ONLY invoices that have a pending balance for the table
  const openInvoices = invoices.filter(inv => inv.remaining > 0.01);
  const openReportData = generateReportData(openInvoices, dueTotalsMap, AG);

  const bucketBlock = computeBucketBlock(invoices, retailDD); // Uses full data for accuracy

  // Temporarily override the output sheet name
  const dailyConfig = { ...AG, REPORT_SHEET: 'Aging Report (Daily Open)' };

  // 3. GENERATE: Pass the filtered rows (openReportData) but the full historical summary (fullSummary)
  writeReportToSheet(ss, openReportData, fullSummary, partyName, dailyConfig, COLORS, bucketBlock);
  
  // Update the Title to reflect it is an action-required report
  const reportSheet = ss.getSheetByName('Aging Report (Daily Open)');
  reportSheet.getRange('A1').setValue('DAILY OUTSTANDING SUMMARY');
  
  SpreadsheetApp.flush();
  return customer;
}

// ============================================================================
// PAYMENT TREND ANALYTICS (Weighted Average Score - CLEAR MONTH GROUPING)
// ============================================================================
function calculatePaymentTrends(reportData) {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0 = Jan, 3 = Apr
  const startYear = currentMonth >= 3 ? currentYear : currentYear - 1;

  // 1. Build the 12-Month Financial Year Array
  const fyLabels = ['LIFETIME SCORE'];
  const fyKeys = ['LIFETIME'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  for (let i = 0; i < 12; i++) {
    const m = (3 + i) % 12; // Starts at April (3)
    const y = (3 + i) > 11 ? startYear + 1 : startYear;
    fyLabels.push(`${monthNames[m]}-${y.toString().slice(-2)}`);
    fyKeys.push(`${m}-${y}`);
  }

  const tracking = {};
  fyKeys.forEach(key => tracking[key] = { sumWeighted: 0, sumAmt: 0 });

  // 2. Loop through report data (Standard cols: 4 = Due Date, 8 = Clear Date, 9 = Adj Amt)
  reportData.output.forEach(row => {
    const dueDate = row[4];
    const clearDate = row[8];
    const adjAmt = parseFloat(row[9]);

    if (clearDate && dueDate && !isNaN(adjAmt) && adjAmt > 0) {
      const d1 = new Date(dueDate).setHours(0,0,0,0);
      const d2 = new Date(clearDate).setHours(0,0,0,0);
      
      // GAMIFIED MATH: Due - Clear (Late is Negative Penalty, Early is Positive Bonus)
      const varianceDays = (d1 - d2) / 86400000;
      const weightedValue = varianceDays * adjAmt;
      
      // NEW GROUPING: By CLEAR DATE (The month the cash actually arrived)
      const m = new Date(clearDate).getMonth();
      const y = new Date(clearDate).getFullYear();
      const monthKey = `${m}-${y}`;

      tracking['LIFETIME'].sumWeighted += weightedValue;
      tracking['LIFETIME'].sumAmt += adjAmt;

      if (tracking[monthKey]) {
        tracking[monthKey].sumWeighted += weightedValue;
        tracking[monthKey].sumAmt += adjAmt;
      }
    }
  });

  // 3. Calculate Final Scores & format for display
  const resultRow = [];
  const colorRow = [];

  fyKeys.forEach(key => {
    const data = tracking[key];
    if (data.sumAmt === 0) {
      resultRow.push('-');
      colorRow.push('#f5f5f5'); 
    } else {
      const avgDays = (data.sumWeighted / data.sumAmt).toFixed(1);
      const val = parseFloat(avgDays);
      
      if (val < 0) {
        resultRow.push(`${avgDays} Score`); // Already negative (e.g. -4.5 Score)
        colorRow.push('#ffcdd2'); // Red (Penalty)
      } else if (val > 0) {
        resultRow.push(`+${avgDays} Score`);  // Positive (e.g. +2.0 Score)
        colorRow.push('#c8e6c9'); // Green (Bonus)
      } else {
        resultRow.push(`0 Score`);           // Exact
        colorRow.push('#e3f2fd'); // Blue (On Target)
      }
    }
  });

  return { headers: fyLabels, data: resultRow, colors: colorRow };
}

function auditPaymentTrends() {
  // 🔴 TYPE THE NAME OF THE CUSTOMER YOU WANT TO AUDIT HERE
  const TARGET_CUSTOMER = "LOVELY BATH CONCEPT 9988278600"; 
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const rd = ss.getSheetByName(AG.RD_TAB);
  
  const data = rd.getDataRange().getValues();
  let retailDD = 0, projectDD = 0;
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === TARGET_CUSTOMER) {
      retailDD = parseInt(data[i][1]);
      projectDD = parseInt(data[i][2]);
      break;
    }
  }

  Logger.log(`========================================================`);
  Logger.log(`🔍 INITIATING AUDIT FOR: ${TARGET_CUSTOMER}`);
  Logger.log(`Target: 0 (Negative Score = Late | Positive Score = Early)`);
  Logger.log(`Grouping Method: Month the Invoice was DUE`);
  Logger.log(`========================================================\n`);

  const src = readCustomerFromTabs(ss, TARGET_CUSTOMER);
  if (!src.found) {
    Logger.log("❌ Customer not found or no transactions exist.");
    return;
  }

  src.invoices.forEach(inv => {
    const dDate = new Date(inv.date);
    if (inv.vchNo !== 'OPENING BAL') dDate.setDate(dDate.getDate() + (inv.isProject ? projectDD : retailDD));
    inv.dueDate = dDate;
  });

  src.invoices.sort((a,b) => {
    if (a.vchNo === 'OPENING BAL') return -1;
    if (b.vchNo === 'OPENING BAL') return 1;
    if (a.dueDate.getTime() !== b.dueDate.getTime()) return a.dueDate.getTime() - b.dueDate.getTime();
    return String(a.vchNo).localeCompare(String(b.vchNo));
  });

  matchPayments(src.invoices, src.receipts);
  const dueTotalsMap = calculateDueTotals(src.invoices);
  const reportData = generateReportData(src.invoices, dueTotalsMap, AG);

  const tracking = {};
  
  Logger.log(`--- INDIVIDUAL ADJUSTMENT BREAKDOWN ---`);
  
  reportData.output.forEach(row => {
    const invNo = row[3];
    const dueDate = row[4];
    const clearDate = row[8];
    const adjAmt = parseFloat(row[9]);

    if (clearDate && dueDate && !isNaN(adjAmt) && adjAmt > 0) {
      const d1 = new Date(dueDate).setHours(0,0,0,0);
      const d2 = new Date(clearDate).setHours(0,0,0,0);
      
      // NEW MATH: Due - Clear (Late is Negative)
      const varianceDays = (d1 - d2) / 86400000; 
      const weightedValue = varianceDays * adjAmt;
      
      // NEW GROUPING: Month the invoice was DUE
      const m = new Date(dueDate).getMonth() + 1; // 1-12 format
      const y = new Date(dueDate).getFullYear();
      const monthKey = `${m}-${y}`;

      if (!tracking[monthKey]) tracking[monthKey] = { sumWeighted: 0, sumAmt: 0 };
      
      tracking[monthKey].sumWeighted += weightedValue;
      tracking[monthKey].sumAmt += adjAmt;
      
      const earlyOrLate = varianceDays < 0 ? "LATE (Penalty)" : varianceDays > 0 ? "EARLY (Bonus)" : "ON-TIME";

      Logger.log(`Inv: ${invNo} | Due: ${Utilities.formatDate(new Date(dueDate), "GMT", "dd-MM-yy")} | Cleared: ${Utilities.formatDate(new Date(clearDate), "GMT", "dd-MM-yy")}`);
      Logger.log(`   -> Adj Amt: ₹${adjAmt}`);
      Logger.log(`   -> Score: ${varianceDays} Days (${earlyOrLate})`);
      Logger.log(`   -> Weight (Amt x Score): ${weightedValue}`);
    }
  });

  Logger.log(`\n========================================================`);
  Logger.log(`📊 FINAL MONTHLY AVERAGES (GROUPED BY DUE MONTH)`);
  Logger.log(`========================================================`);

  for (const [month, data] of Object.entries(tracking)) {
    const avgDays = (data.sumWeighted / data.sumAmt).toFixed(1);
    Logger.log(`Due Month: ${month}`);
    Logger.log(`   Total Adjusted: ₹${data.sumAmt}`);
    Logger.log(`   Total Weighted: ${data.sumWeighted}`);
    Logger.log(`   >> AVERAGE SCORE: ${avgDays} Days`);
    Logger.log(`--------------------------------------------------------`);
  }
}