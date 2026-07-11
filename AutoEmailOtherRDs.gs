/**
 * AUTO EMAIL REPORTS - OTHER RDs (State Machine)
 * ----------------------------------------------------------------------------
 * Processes non-Jaquar customers. Tracks status in Column F (6).
 */

const CONFIG_OTHER = {
  TAB_RDS: 'Other RDs',
  COL_STATUS: 6, 
  MAX_EXECUTION_TIME_MS: 1.5 * 60 * 1000, 
  RESUME_TRIGGER_MINS: 2 
};

async function startOtherEmailBatch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG_OTHER.TAB_RDS);
  
  const lastRow = sh.getLastRow();
  if (lastRow > 1) sh.getRange(2, CONFIG_OTHER.COL_STATUS, lastRow - 1, 1).clearContent();
  
  const props = PropertiesService.getDocumentProperties();
  props.getKeys().forEach(k => { if (k.startsWith('OTHER_BATCH_')) props.deleteProperty(k); });
  
  const folders = DriveApp.getFoldersByName("Temp_Reports_Other");
  if (folders.hasNext()) {
    const files = folders.next().getFiles();
    while (files.hasNext()) files.next().setTrashed(true);
  }
  
  await processOtherEmailBatch();
}

async function processOtherEmailBatch() {
  const startTime = new Date().getTime();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG_OTHER.TAB_RDS);
  const data = sh.getDataRange().getValues(); 
  const tempFolder = getOtherTempFolder();
  const props = PropertiesService.getDocumentProperties();
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const customer = String(row[0]).trim(); 
    const email1 = String(row[2]).trim(); // Col C
    const email2 = String(row[3]).trim(); // Col D  
    const email3 = String(row[4]).trim(); // Col E
    
    if (!customer || !email1) continue;

    const stateKey = `OTHER_BATCH_${i}`;
    let stateStr = props.getProperty(stateKey);
    let state = stateStr ? JSON.parse(stateStr) : { status: 'Pending' };

    if (state.status === 'Sent' || state.status === 'Error') continue;

    Logger.log(`Processing Other: ${customer} | Phase: ${state.status}`);

    try {
      // PHASE 1: AGING PDF
      if (state.status === 'Pending') {
        runOtherAgingForRow(ss, i + 1); 
        SpreadsheetApp.flush();
        
        const agingSheet = ss.getSheetByName('Aging Report (Other)');
        const totalOutstanding = agingSheet.getRange('I5').getDisplayValue() || '0.00';
        const totalOverdue = agingSheet.getRange('H9').getDisplayValue() || '0.00';

        const agingBlobs = makeOtherPdf(ss); 
        const agingPdf = await PDFApp.mergePDFs(agingBlobs);
        agingPdf.setName(`Aging_Report_${customer.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
        
        const file = tempFolder.createFile(agingPdf);
        state.agingId = file.getId();
        state.outstanding = totalOutstanding;
        state.overdue = totalOverdue;
        state.status = 'Aging_Done';
        
        props.setProperty(stateKey, JSON.stringify(state));
        sh.getRange(i + 1, CONFIG_OTHER.COL_STATUS).setValue('Generating PDFs...');
        if (checkOtherTimeout(startTime)) return; 
      }

      // PHASE 2: STATEMENT PDF
      if (state.status === 'Aging_Done') {
        const stmtSheet = ss.getSheetByName('Statement');
        stmtSheet.getRange('B1').setValue(customer);
        generateStatement(); 
        SpreadsheetApp.flush();
        
        const stmtBlobs = makeStatementPdfV2(ss); 
        const stmtPdf = await PDFApp.mergePDFs(stmtBlobs);
        stmtPdf.setName(`Statement_${customer.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);

        const file = tempFolder.createFile(stmtPdf);
        state.stmtId = file.getId();
        state.status = 'Pdf_Done';
        
        props.setProperty(stateKey, JSON.stringify(state));
        if (checkOtherTimeout(startTime)) return; 
      }

      // PHASE 3: EMAIL
      if (state.status === 'Pdf_Done') {
        const agingFile = DriveApp.getFileById(state.agingId);
        const stmtFile = DriveApp.getFileById(state.stmtId);

        const ccSet = new Set();
        if (email2 && email2 !== email1) ccSet.add(email2);
        if (email3 && email3 !== email1 && email3 !== email2) ccSet.add(email3);
        const ccEmailStr = Array.from(ccSet).join(',');

        const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy');
        const subject = `${customer} - Account Statement & Aging (${today})`;
        
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; color: #333333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px;">
            <div style="background-color: #283C50; color: #ffffff; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 22px;">BHARAT GLASS HOUSE</h2>
              <p style="margin: 5px 0 0; font-size: 13px; color: #c9d3dd; text-transform: uppercase;">Account Statement & Aging Report</p>
            </div>
            <div style="padding: 30px 20px;">
              <p>Dear <strong>${customer}</strong>,</p>
              <p>Please find attached your updated Account Statement and Aging Report as of <strong>${today}</strong>.</p>
              <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin: 25px 0; display: table; width: 100%; box-sizing: border-box;">
                <div style="display: table-cell; width: 50%; text-align: center; border-right: 1px solid #dee2e6;">
                  <p style="margin: 0; font-size: 12px; color: #6c757d; text-transform: uppercase;">Total Outstanding</p>
                  <p style="margin: 5px 0 0; font-size: 18px; color: #283C50; font-weight: bold;">₹ ${state.outstanding}</p>
                </div>
                <div style="display: table-cell; width: 50%; text-align: center;">
                  <p style="margin: 0; font-size: 12px; color: #6c757d; text-transform: uppercase;">Total Overdue</p>
                  <p style="margin: 5px 0 0; font-size: 18px; color: #d32f2f; font-weight: bold;">₹ ${state.overdue}</p>
                </div>
              </div>
            </div>
          </div>
        `;

        MailApp.sendEmail({
          to: email1, cc: ccEmailStr, subject: subject, htmlBody: htmlBody,
          attachments: [agingFile.getBlob(), stmtFile.getBlob()]
        });

        agingFile.setTrashed(true); stmtFile.setTrashed(true);
        state.status = 'Sent';
        props.setProperty(stateKey, JSON.stringify(state));
        sh.getRange(i + 1, CONFIG_OTHER.COL_STATUS).setValue('Sent');
        
        Logger.log(`Email sent successfully to ${email1}`);
        if (checkOtherTimeout(startTime)) return; 
      }
    } catch (e) {
      Logger.log(`Error processing ${customer}: ${e.message}`);
      sh.getRange(i + 1, CONFIG_OTHER.COL_STATUS).setValue('Error');
      state.status = 'Error'; props.setProperty(stateKey, JSON.stringify(state));
    }
  }
}

// ---- HELPERS ----
function checkOtherTimeout(startTime) {
  if (new Date().getTime() - startTime > CONFIG_OTHER.MAX_EXECUTION_TIME_MS) {
    ScriptApp.getProjectTriggers().forEach(t => { if (t.getHandlerFunction() === 'processOtherEmailBatch') ScriptApp.deleteTrigger(t); });
    ScriptApp.newTrigger('processOtherEmailBatch').timeBased().after(CONFIG_OTHER.RESUME_TRIGGER_MINS * 60 * 1000).create();
    return true; 
  }
  return false;
}

function getOtherTempFolder() {
  const folders = DriveApp.getFoldersByName("Temp_Reports_Other");
  return folders.hasNext() ? folders.next() : DriveApp.createFolder("Temp_Reports_Other");
}