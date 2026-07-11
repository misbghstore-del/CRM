/**
 * AUTO EMAIL & WHATSAPP - INTERNAL CONSOLIDATED MASTER REPORT
 * ----------------------------------------------------------------------------
 * Generates the offset bucket layout for all dealers, perfectly paginates 
 * it to prevent page-cuts, emails it to the team, sends a WhatsApp alert, 
 * and immediately deletes the cached file.
 */

const TEAM_CONFIG = {
  EMAIL_TO: 'bghbathgallery@gmail.com',       // <--- ENTER YOUR TEAM EMAIL HERE
  WHATSAPP_NUMBER: '919876543210',       // <--- ENTER YOUR TEAM WA NUMBER HERE
  DEALERS_PER_PAGE: 6                    // Adjusted to 3 to accommodate the new label row safely
};

// ---- MAIN AUTOMATION TRIGGER ----
async function sendDailyInternalMaster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const todayStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy');
  
  Logger.log('1. Building Master Report Data...');
  const outTab = buildMasterReportSheet(ss, todayStr);
  if (!outTab) return; // Exits if no dues exist
  
  Logger.log('2. Paginating and Generating PDF Blobs...');
  const pdfBlobs = paginateMasterReport(ss, outTab);
  
  Logger.log('3. Merging PDF...');
  const finalPdf = await PDFApp.mergePDFs(pdfBlobs);
  finalPdf.setName(`Daily_Master_Collections_${todayStr}.pdf`);
  
  Logger.log('4. Staging in Drive for WhatsApp/Email...');
  const tempFolder = getDailyTempFolder();
  const file = tempFolder.createFile(finalPdf);
  
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  Logger.log('5. Sending Email...');
  sendTeamEmail(file, todayStr);
  
  Logger.log('6. Sending WhatsApp...');
  sendTeamWhatsApp(file.getDownloadUrl(), todayStr);
  
  Logger.log('7. Cleaning up Google Drive...');
  file.setTrashed(true);
  ss.deleteSheet(outTab);
  
  Logger.log('✅ Internal Master Report Dispatched Successfully!');
}

// ----------------------------------------------------------------------
// 1. DATA BUILDER (Exact Offset Layout)
// ----------------------------------------------------------------------
function buildMasterReportSheet(ss, todayStr) {
  const rd = ss.getSheetByName(AG.RD_TAB);
  const data = rd.getDataRange().getValues();
  const outTabName = 'Print_Master_Temp';
  let outTab = ss.getSheetByName(outTabName);
  
  if (outTab) outTab.clear();
  else outTab = ss.insertSheet(outTabName);

  const outputRows = [];
  const formatBlocks = []; 
  let currentRow = 1;

  outputRows.push([`CONSOLIDATED AGING REPORT — ${todayStr}`, "", "", "", "", "", "", ""]);
  currentRow++;
  outputRows.push(["", "", "", "", "", "", "", ""]); 
  currentRow++;

  for (let i = 1; i < data.length; i++) {
    const customer = String(data[i][0]).trim();
    const retailDD = parseInt(data[i][1]);
    const projectDD = parseInt(data[i][2]);
    
    if (!customer || isNaN(retailDD) || isNaN(projectDD)) continue;
    const src = readCustomerFromTabs(ss, customer);
    if (!src.found) continue;

    src.invoices.forEach(inv => {
      const dDate = new Date(inv.date);
      if (inv.vchNo !== 'OPENING BAL') dDate.setDate(dDate.getDate() + (inv.isProject ? projectDD : retailDD));
      inv.dueDate = dDate;
    });

    matchPayments(src.invoices, src.receipts);
    const bb = computeBucketBlock(src.invoices, retailDD);
    const totalOut = toFixedNum(bb.rTotal + bb.pTotal);
    
    if (totalOut <= 0.01) continue;

    const startRow = currentRow;
    outputRows.push([customer, "", "", "", "", "", "Total:", totalOut]);
    outputRows.push(["RETAIL\nINVOICES", "", bb.retailLabels[0], bb.retailLabels[1], bb.retailLabels[2], bb.retailLabels[3], bb.retailLabels[4], "Total"]);
    outputRows.push(["", "", bb.retail[0], bb.retail[1], bb.retail[2], bb.retail[3], bb.retail[4], bb.rTotal]);
    outputRows.push(["PROJECT\nINVOICES", bb.projectLabels[0], bb.projectLabels[1], bb.projectLabels[2], bb.projectLabels[3], bb.projectLabels[4], bb.projectLabels[5], "Total"]);
    outputRows.push(["", bb.project[0], bb.project[1], bb.project[2], bb.project[3], bb.project[4], bb.project[5], bb.pTotal]);
    
    const colSum = {};
    for (let j = bb.rFirstOD; j < bb.retail.length; j++) colSum[3 + j] = toFixedNum((colSum[3 + j] || 0) + bb.retail[j]); 
    for (let j = bb.pFirstOD; j < bb.project.length; j++) colSum[2 + j] = toFixedNum((colSum[2 + j] || 0) + bb.project[j]); 
    
    let grandOD = 0;
    const odRow = ["TOTAL OVERDUE", "", "", "", "", "", "", 0]; 
    const activeODCols = []; // Track which columns get the red highlight

    for (let c = 2; c <= 7; c++) {
      if (colSum[c] !== undefined) {
        odRow[c - 1] = colSum[c]; 
        grandOD = toFixedNum(grandOD + colSum[c]);
        activeODCols.push(true);
      } else {
        odRow[c - 1] = ""; // Keep non-overdue cells entirely blank
        activeODCols.push(false);
      }
    }
    odRow[7] = grandOD;
    outputRows.push(odRow);

    // Dynamic Overdue Days Labels row (1-10 Days, etc.)
    const odLabelsRow = ["", "", "", "", "", "", "", ""];
    const rLo=[0,5,15,25,35], rHi=[4,14,24,34,null];
    const pLo=[0,5,15,25,35,45], pHi=[4,14,24,34,44,null];
    const odRange = (lo,hi,due) => (hi==null) ? ('> '+(lo-1-due)+' days') : ((lo-due)+'-'+(hi-due)+' days');

    for (let c = 2; c <= 7; c++) {
      if (colSum[c] !== undefined) {
        const ri = c - 3, pj = c - 2;
        const lab = (ri >= 0 && ri <= 4 && ri >= bb.rFirstOD) 
            ? odRange(rLo[ri], rHi[ri], retailDD) 
            : odRange(pLo[pj], pHi[pj], projectDD);
        odLabelsRow[c - 1] = '(' + lab + ')';
      }
    }
    outputRows.push(odLabelsRow);

    outputRows.push(["", "", "", "", "", "", "", ""]); // Spacer
    formatBlocks.push({ row: startRow, rFirstOD: bb.rFirstOD, pFirstOD: bb.pFirstOD, activeODCols: activeODCols });
    currentRow += 8;
  }

  if (outputRows.length <= 2) return null;

  outTab.getRange(1, 1, outputRows.length, 8).setValues(outputRows);
  outTab.getRange(1, 1, outputRows.length, 8).setFontFamily("Roboto").setVerticalAlignment("middle").setNumberFormat('[>=10000000]##\\,##\\,##\\,##0.00;[>=100000]##\\,##\\,##0.00;##,##0.00');

  outTab.setColumnWidth(1, 130); 
  for(let c = 2; c <= 8; c++) outTab.setColumnWidth(c, 105);

  outTab.getRange(1, 1, 1, 8).merge().setBackground('#283C50').setFontColor('white').setFontWeight('bold').setFontSize(14).setHorizontalAlignment('center');
  outTab.setRowHeight(1, 40);

  const OD_BG = '#ffcdd2', OK_BG = '#e8f5e9', HDR_BG = '#eceff1', BDR = '#b0bec5', B = SpreadsheetApp.BorderStyle.SOLID;

  formatBlocks.forEach(blk => {
    const sr = blk.row;
    outTab.getRange(sr, 1, 1, 6).merge().setFontSize(14).setFontWeight('bold').setFontColor('#1e3d59');
    outTab.getRange(sr, 7).setHorizontalAlignment('right').setFontWeight('bold');
    outTab.getRange(sr, 8).setFontWeight('bold').setBackground('#b3e5fc');

    outTab.getRange(sr + 1, 1, 2, 1).merge().setBackground('#37474f').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);
    outTab.getRange(sr + 3, 1, 2, 1).merge().setBackground('#37474f').setFontColor('white').setFontWeight('bold').setHorizontalAlignment('center').setWrap(true);

    outTab.getRange(sr + 1, 2, 1, 7).setBackground(HDR_BG).setFontWeight('bold');
    outTab.getRange(sr + 3, 2, 1, 7).setBackground(HDR_BG).setFontWeight('bold');
    
    outTab.getRange(sr + 2, 8).setBackground('#CFD8DC').setFontWeight('bold');
    for(let i = 0; i < 5; i++) outTab.getRange(sr + 2, 3 + i).setBackground(i >= blk.rFirstOD ? OD_BG : OK_BG);

    outTab.getRange(sr + 4, 8).setBackground('#CFD8DC').setFontWeight('bold');
    for(let i = 0; i < 6; i++) outTab.getRange(sr + 4, 2 + i).setBackground(i >= blk.pFirstOD ? OD_BG : OK_BG);

    outTab.getRange(sr + 5, 1).setFontWeight('bold').setFontColor('#1e3d59');
    
    // Dynamic Red Highlighting (Only colors cells that are actually overdue)
    const odBgs = blk.activeODCols.map(isActive => isActive ? '#ffab91' : '#FFFFFF');
    outTab.getRange(sr + 5, 2, 1, 6).setBackgrounds([odBgs]).setFontWeight('bold');
    outTab.getRange(sr + 5, 8).setBackground('#ff8a65').setFontWeight('bold');

    // Overdue Labels Formatting
    outTab.getRange(sr + 6, 2, 1, 6).setFontSize(8).setFontStyle('italic').setFontColor('#666666').setHorizontalAlignment('center');
    outTab.setRowHeight(sr + 6, 16);

    outTab.getRange(sr + 1, 2, 5, 7).setHorizontalAlignment('center');
    [sr+2, sr+4, sr+5].forEach(r => outTab.getRange(r, 2, 1, 7).setFontWeight('bold'));
    
    outTab.getRange(sr + 1, 2, 2, 7).setBorder(true,true,true,true,true,true,BDR,B);
    outTab.getRange(sr + 3, 2, 2, 7).setBorder(true,true,true,true,true,true,BDR,B);
    outTab.getRange(sr + 5, 2, 1, 7).setBorder(true,true,true,true,true,true,BDR,B);
    outTab.getRange(sr + 1, 1, 2, 1).setBorder(true,true,true,true,null,null,BDR,B);
    outTab.getRange(sr + 3, 1, 2, 1).setBorder(true,true,true,true,null,null,BDR,B);

    [sr+1, sr+2, sr+3, sr+4, sr+5].forEach(r => outTab.setRowHeight(r, 26));
  });

  SpreadsheetApp.flush();
  return outTab;
}

// ----------------------------------------------------------------------
// 2. PERFECT PAGINATION ENGINE
// ----------------------------------------------------------------------
function paginateMasterReport(ss, outTab) {
  const dataEnd = outTab.getLastRow();
  const maxRows = outTab.getMaxRows();
  const blobs = [];
  
  // Every dealer block is exactly 8 rows. Row 1 and 2 are headers.
  const DEALER_ROWS = 8; 
  const blocks = [];
  
  for (let r = 3; r <= dataEnd; r += (DEALER_ROWS * TEAM_CONFIG.DEALERS_PER_PAGE)) {
    blocks.push({
      start: r,
      end: Math.min(r + (DEALER_ROWS * TEAM_CONFIG.DEALERS_PER_PAGE) - 1, dataEnd)
    });
  }

  for (let p = 0; p < blocks.length; p++) {
    outTab.showRows(1, maxRows);
    
    // Hide all dealers NOT on this page (Keep Rows 1-2 visible as Header)
    outTab.hideRows(3, maxRows - 2); 
    
    // Unhide the specific chunk of dealers for this page
    outTab.showRows(blocks[p].start, blocks[p].end - blocks[p].start + 1); 
    
    SpreadsheetApp.flush();
    blobs.push(exportMasterPdf(ss, outTab.getSheetId()));
    
    if (p < blocks.length - 1) Utilities.sleep(2500); // Prevent 429 errors
  }
  
  return blobs;
}

function exportMasterPdf(ss, sheetId) {
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=pdf&gid=' + sheetId + '&size=A4&portrait=true&fitw=true&top_margin=0.40&bottom_margin=0.40&left_margin=0.30&right_margin=0.30&gridlines=false&printtitle=false&sheetnames=false&horizontal_alignment=CENTER';
  const options = { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  for (let attempt = 1; attempt <= 3; attempt++) {
    const resp = UrlFetchApp.fetch(url, options);
    if (resp.getResponseCode() === 200) return resp.getBlob();
    if (resp.getResponseCode() === 429) Utilities.sleep(attempt * 4000); 
    else throw new Error(`Export failed: HTTP ${resp.getResponseCode()}`);
  }
  throw new Error('Failed to export PDF due to limits.');
}

// ----------------------------------------------------------------------
// 3. DISPATCHERS (Email & WhatsApp)
// ----------------------------------------------------------------------
function sendTeamEmail(file, todayStr) {
  const subject = `Daily Collections Master Report — ${todayStr}`;
  const body = `Team,\n\nPlease find the consolidated aging report for all active Jaquar dealers attached.\n\nEnsure high-priority overdue accounts are followed up on today.\n\nAutomated Alert System`;
  
  MailApp.sendEmail({
    to: TEAM_CONFIG.EMAIL_TO,
    subject: subject,
    body: body,
    attachments: [file.getBlob()]
  });
}

function sendTeamWhatsApp(pdfUrl, todayStr) {
  // ---- WHATSAPP API INTEGRATION BLOCK ----
  // This is a standard template for Meta/Interakt/Wati APIs.
  // Replace the URL, Bearer Token, and Payload structure based on your specific provider.
  
  /* const apiUrl = "https://your-whatsapp-api-provider.com/v1/messages";
  const token = "YOUR_API_ACCESS_TOKEN";
  
  const payload = {
    "messaging_product": "whatsapp",
    "to": TEAM_CONFIG.WHATSAPP_NUMBER,
    "type": "template",
    "template": {
      "name": "daily_collections_master",
      "language": { "code": "en" },
      "components": [
        {
          "type": "header",
          "parameters": [
            { "type": "document", "document": { "link": pdfUrl, "filename": `Master_Report_${todayStr}.pdf` } }
          ]
        },
        {
          "type": "body",
          "parameters": [ { "type": "text", "text": todayStr } ]
        }
      ]
    }
  };

  const options = {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    Logger.log("WhatsApp API Response: " + response.getContentText());
  } catch (e) {
    Logger.log("WhatsApp Alert Failed: " + e.message);
  }
  */
}

function getDailyTempFolder() {
  const folderName = "Temp_Daily_AutoEmail";
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}