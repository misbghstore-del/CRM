const SECRET_TOKEN = "Why-do-we-fall?";

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    if (contents.token !== SECRET_TOKEN) {
      return ContentService.createTextOutput("Error: Unauthorized");
    }
    const data = contents.payload;
    const mode = contents.mode || "replace";
    const targetSheetName = contents.sheetName || "Sheet1";
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(targetSheetName);
    if (!sheet) sheet = ss.insertSheet(targetSheetName);
    if (!data || data.length === 0) {
      return ContentService.createTextOutput("Error: No data found in payload.");
    }
    const headers = Object.keys(data[0]);
    const rows = data.map(obj => headers.map(h => obj[h]));

    // Voucher numbers must never be coerced into dates: force that
    // column to plain text BEFORE writing values.
    const vchCol = headers.indexOf('Voucher No') + 1;   // 1-based; 0 if absent

    if (mode === "replace") {
      sheet.clear();
      if (vchCol > 0) sheet.getRange(1, vchCol, rows.length + 1, 1).setNumberFormat('@');
      sheet.getRange(1, 1, rows.length + 1, headers.length).setValues([headers, ...rows]);
    } else {
      const lastRow = sheet.getLastRow();
      if (lastRow === 0) {
        if (vchCol > 0) sheet.getRange(1, vchCol, rows.length + 1, 1).setNumberFormat('@');
        sheet.getRange(1, 1, rows.length + 1, headers.length).setValues([headers, ...rows]);
      } else {
        if (vchCol > 0) sheet.getRange(lastRow + 1, vchCol, rows.length, 1).setNumberFormat('@');
        sheet.getRange(lastRow + 1, 1, rows.length, headers.length).setValues(rows);
      }
    }
    const now = new Date();
    sheet.getRange(1, headers.length + 2).setValue(
      "Last Updated: " + now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
    return ContentService.createTextOutput(
      "Success: " + mode + " " + targetSheetName +
      " (+" + rows.length + " rows, total now " + sheet.getLastRow() + ")");
  } catch (error) {
    return ContentService.createTextOutput("Error: " + error.toString());
  }
}

/**
 * Serves the Web App UI.
 * The viewport meta tag ensures proper scaling on high-density mobile screens.
 */
function doGet(e) {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('Automation Control Hub')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * TRIGGER: Priority 2 - Daily Action Required
 */
function runDailyOutstandingBatch(pin) {
  // If the PIN is wrong, stop immediately.
  if (pin !== "1234") { // Change "1234" to whatever PIN you want
    return { success: false, message: "Unauthorized: Incorrect PIN." };
  }
  
  try {
    Logger.log("Daily Outstanding Batch Initiated.");
    Utilities.sleep(2000); 
    return { success: true, message: "Daily Outstanding batch queued successfully." };
  } catch (error) {
    return { success: false, message: "Error: " + error.toString() };
  }
}

/**
 * TRIGGER: Priority 4 - Master Dashboard Sync
 */
function runDashboardSync() {
  try {
    Logger.log("Dashboard Sync Initiated.");
    Utilities.sleep(2000);
    return { success: true, message: "Internal Master Dashboard updated." };
  } catch (error) {
    return { success: false, message: "Error: " + error.toString() };
  }
}