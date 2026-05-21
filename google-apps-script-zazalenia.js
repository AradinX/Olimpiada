const SPREADSHEET_ID = 'WKLEJ_TUTAJ_ID_ARKUSZA';
const SHEET_NAME = 'Zazalenia';

function doGet() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const complaints = values.slice(1).map(row => ({
    createdAt: row[0],
    name: row[1],
    text: row[2]
  })).filter(item => item.name && item.text);

  return ContentService
    .createTextOutput(JSON.stringify({ complaints }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(event) {
  const payload = JSON.parse(event.postData.contents || '{}');
  const sheet = getSheet();
  sheet.appendRow([
    payload.createdAt || new Date().toISOString(),
    payload.name || '',
    payload.text || ''
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['createdAt', 'name', 'text']);
  }

  return sheet;
}
