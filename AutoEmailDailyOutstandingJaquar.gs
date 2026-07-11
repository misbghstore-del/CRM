/**
 * AUTO EMAIL - DAILY OUTSTANDING REPORT (State Machine)
 * ----------------------------------------------------------------------------
 * Generates and emails ONLY the "Daily Action Required" Aging Report.
 * Uses Column I (9) for status tracking.
 */

const CONFIG_DAILY = {
  TAB_RDS: 'Jaquar RDs',
  COL_STATUS: 9, // Tracks status in Column I (Leaves Col H safe for Fortnightly reports)
  MAX_EXECUTION_TIME_MS: 1.5 * 60 * 1000, // 1.5 minutes
  RESUME_TRIGGER_MINS: 2 
};

// ---- MAIN ENTRY POINT (Run this DAILY via Trigger) ----
async function startDailyOutstandingEmailBatch() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG_DAILY.TAB_RDS);
  
  // 1. Clear visual statuses in Column I
  const lastRow = sh.getLastRow();
  if (lastRow > 1) {
    sh.getRange(2, CONFIG_DAILY.COL_STATUS, lastRow - 1, 1).clearContent();
  }
  
  // 2. Wipe the hidden mid-process states for the daily run
  const props = PropertiesService.getDocumentProperties();
  const keys = props.getKeys();
  keys.forEach(k => {
    if (k.startsWith('DAILY_BATCH_')) props.deleteProperty(k);
  });

  // 3. Auto-empty the Temp Folder from yesterday
  const folders = DriveApp.getFoldersByName("Temp_Daily_AutoEmail");
  if (folders.hasNext()) {
    const folder = folders.next();
    const files = folder.getFiles();
    while (files.hasNext()) files.next().setTrashed(true);
  }
  
  // Kick off processing
  await processDailyOutstandingBatch();
}

// ---- CORE PROCESSOR ----
async function processDailyOutstandingBatch() {
  const startTime = new Date().getTime();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(CONFIG_DAILY.TAB_RDS);
  const data = sh.getDataRange().getValues(); 
  const tempFolder = getDailyTempFolder();
  const props = PropertiesService.getDocumentProperties();
  
  // Loop starts at 1 to skip the header row
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const customer = String(row[0]).trim(); 
    const email1 = String(row[4]).trim();   
    const email2 = String(row[5]).trim();   
    const email3 = String(row[6]).trim();   
    
    if (!customer || !email1) continue;

    // Load hidden state for this specific row
    const stateKey = `DAILY_BATCH_${i}`;
    let stateStr = props.getProperty(stateKey);
    let state = stateStr ? JSON.parse(stateStr) : { status: 'Pending' };

    if (state.status === 'Sent' || state.status === 'Error' || state.status === 'No Dues') continue;

    Logger.log(`Processing Daily Outstanding: ${customer} | Phase: ${state.status}`);

    try {
      // ==========================================
      // PHASE 1: GENERATE OUTSTANDING PDF
      // ==========================================
      if (state.status === 'Pending') {
        runOutstandingAgingForRow(ss, i + 1); 
        SpreadsheetApp.flush();
        
        const agingSheet = ss.getSheetByName('Aging Report (Daily Open)');
        const totalOutstanding = agingSheet.getRange('I5').getDisplayValue() || '0.00';
        const totalOverdue = agingSheet.getRange('H9').getDisplayValue() || '0.00';

        // ZERO BALANCE CHECK: Skip sending if no dues
        if (totalOutstanding === '0.00' || totalOutstanding === '') {
          state.status = 'No Dues';
          props.setProperty(stateKey, JSON.stringify(state));
          sh.getRange(i + 1, CONFIG_DAILY.COL_STATUS).setValue('No Dues - Skipped');
          continue;
        }

        const agingBlobs = makeDailyOutstandingPdf(ss); 
        const agingPdf = await PDFApp.mergePDFs(agingBlobs);
        agingPdf.setName(`Outstanding_Summary_${customer.replace(/[^A-Za-z0-9]+/g, '_')}.pdf`);
        
        // Save to Drive and record state
        const file = tempFolder.createFile(agingPdf);
        state.agingId = file.getId();
        state.outstanding = totalOutstanding;
        state.overdue = totalOverdue;
        state.status = 'Pdf_Done';
        
        props.setProperty(stateKey, JSON.stringify(state));
        sh.getRange(i + 1, CONFIG_DAILY.COL_STATUS).setValue('Generating PDF...');

        if (checkDailyTimeout(startTime)) return; 
      }

      // ==========================================
      // PHASE 2: COMPILE, EMAIL, AND CLEANUP
      // ==========================================
      if (state.status === 'Pdf_Done') {
        const agingFile = DriveApp.getFileById(state.agingId);

        const ccSet = new Set();
        if (email2 && email2 !== email1) ccSet.add(email2);
        if (email3 && email3 !== email1 && email3 !== email2) ccSet.add(email3);
        const ccEmailStr = Array.from(ccSet).join(',');

        const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd-MM-yyyy');
        const subject = `Action Required: Outstanding Dues - ${customer} (${today})`;
        
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; color: #333333; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #283C50; color: #ffffff; padding: 20px; text-align: center;">
              <h2 style="margin: 0; font-size: 22px; letter-spacing: 1px;">BHARAT GLASS HOUSE</h2>
              <p style="margin: 5px 0 0; font-size: 13px; color: #c9d3dd; text-transform: uppercase;">Daily Outstanding Summary</p>
            </div>
            <div style="padding: 30px 20px;">
              <p style="font-size: 15px; margin-top: 0;">Dear <strong>${customer}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.6;">Please find attached a summary of your currently outstanding invoices as of <strong>${today}</strong>.</p>
              
              <div style="background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 15px; margin: 25px 0; display: table; width: 100%; box-sizing: border-box;">
                <div style="display: table-cell; width: 50%; text-align: center; border-right: 1px solid #dee2e6; padding-right: 10px;">
                  <p style="margin: 0; font-size: 12px; color: #6c757d; text-transform: uppercase;">Total Outstanding</p>
                  <p style="margin: 5px 0 0; font-size: 18px; color: #283C50; font-weight: bold;">₹ ${state.outstanding}</p>
                </div>
                <div style="display: table-cell; width: 50%; text-align: center; padding-left: 10px;">
                  <p style="margin: 0; font-size: 12px; color: #6c757d; text-transform: uppercase;">Total Overdue</p>
                  <p style="margin: 5px 0 0; font-size: 18px; color: #d32f2f; font-weight: bold;">₹ ${state.overdue}</p>
                </div>
              </div>

              <div style="background-color: #fff8eb; border-left: 4px solid #f5b041; padding: 12px 15px; margin: 20px 0;">
                <p style="margin: 0; font-size: 13px; color: #5c4011;"><strong>Action Required:</strong> Kindly arrange for the payment of the overdue amount at the earliest.</p>
              </div>

            </div>
            <div style="background-color: #f1f5f9; padding: 20px; font-size: 11px; color: #666666; text-align: center; border-top: 1px solid #e0e0e0;">
              <p style="margin: 0; font-size: 12px;"><strong>Accounts Team</strong> | BHARAT GLASS HOUSE</p>
            </div>
          </div>
        `;

        MailApp.sendEmail({
          to: email1,
          cc: ccEmailStr,
          subject: subject,
          htmlBody: htmlBody,
          attachments: [agingFile.getBlob()]
        });

        // Cleanup
        agingFile.setTrashed(true);

        state.status = 'Sent';
        props.setProperty(stateKey, JSON.stringify(state));
        sh.getRange(i + 1, CONFIG_DAILY.COL_STATUS).setValue('Sent');
        
        Logger.log(`Daily report sent successfully to ${email1}`);

        if (checkDailyTimeout(startTime)) return; 
      }

    } catch (e) {
      Logger.log(`Error processing ${customer}: ${e.message}`);
      sh.getRange(i + 1, CONFIG_DAILY.COL_STATUS).setValue('Error');
      
      state.status = 'Error';
      props.setProperty(stateKey, JSON.stringify(state));
    }
  }
  
  Logger.log('Daily Outstanding Batch completed successfully!');
}

// ---- HELPERS ----

function checkDailyTimeout(startTime) {
  if (new Date().getTime() - startTime > CONFIG_DAILY.MAX_EXECUTION_TIME_MS) {
    Logger.log('Time limit reached. Pausing and scheduling resume trigger...');
    deleteDailyTriggers();
    ScriptApp.newTrigger('processDailyOutstandingBatch')
      .timeBased()
      .after(CONFIG_DAILY.RESUME_TRIGGER_MINS * 60 * 1000)
      .create();
    return true; 
  }
  return false;
}

function deleteDailyTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === 'processDailyOutstandingBatch') {
      ScriptApp.deleteTrigger(trigger);
    }
  }
}

function getDailyTempFolder() {
  const folderName = "Temp_Daily_AutoEmail";
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(folderName);
}