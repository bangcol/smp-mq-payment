/**
 * Google Apps Script (Code.gs) Source Template
 * Digunakan untuk menghubungkan Frontend Web App ke Google Spreadsheet Database
 */

const GAS_CODE_TEMPLATE = `/**
 * SISTEM BUKU PEMBAYARAN SISWA - GOOGLE APPS SCRIPT BACKEND (Code.gs)
 * Salin kode ini ke Google Apps Script editor yang terhubung ke Google Spreadsheet Anda!
 */

// 1. Inisialisasi Sheet saat pertama kali dijalankan
function setupDatabaseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const sheets = [
    { name: 'Siswa', headers: ['NIS', 'NISN', 'Nama', 'Gender', 'Kelas', 'Jurusan', 'NamaWali', 'HPWali', 'Alamat', 'Status'] },
    { name: 'Transaksi', headers: ['NoKwitansi', 'NIS', 'Tanggal', 'PosID', 'PosNama', 'Bulan', 'Nominal', 'Metode', 'Petugas', 'Catatan'] },
    { name: 'PosPembayaran', headers: ['ID', 'Kode', 'Nama', 'Tipe', 'Tarip', 'Deskripsi'] },
    { name: 'Kelas', headers: ['ID', 'Nama', 'Jurusan', 'WaliKelas'] },
    { name: 'AuditLog', headers: ['Timestamp', 'User', 'Aksi', 'Detail'] }
  ];
  
  sheets.forEach(item => {
    let sheet = ss.getSheetByName(item.name);
    if (!sheet) {
      sheet = ss.insertSheet(item.name);
      sheet.getRange(1, 1, 1, item.headers.length).setValues([item.headers]).setFontWeight('bold').setBackground('#f1f5f9');
      sheet.setFrozenRows(1);
    }
  });
  
  SpreadsheetApp.getUi().alert("Database Sheets Berhasil Diinisialisasi!");
}

// 2. HTTP Web API Entry Point (GET & POST)
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getFullState';
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  if (action === 'getFullState') {
    let sheetState = ss.getSheetByName('AppState');
    if (sheetState && sheetState.getLastRow() >= 1) {
      let raw = sheetState.getRange(1, 1).getValue();
      if (raw && raw.length > 10) {
        return ContentService.createTextOutput(raw).setMimeType(ContentService.MimeType.JSON);
      }
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'empty' })).setMimeType(ContentService.MimeType.JSON);
  }

  let responseData = {};
  
  try {
    if (action === 'getInitialData') {
      responseData = {
        siswa: getSheetDataAsObjects('Siswa'),
        transaksi: getSheetDataAsObjects('Transaksi'),
        pos: getSheetDataAsObjects('PosPembayaran'),
        kelas: getSheetDataAsObjects('Kelas'),
        logs: getSheetDataAsObjects('AuditLog')
      };
    } else if (action === 'getSiswa') {
      responseData = getSheetDataAsObjects('Siswa');
    } else if (action === 'getTransaksi') {
      responseData = getSheetDataAsObjects('Transaksi');
    }
    
    return createJsonResponse({ success: true, data: responseData });
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const action = contents.action;
    const payload = contents.data;
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    let result = { success: true };
    
    if (action === 'SAVE_FULL_STATE') {
      let sheetState = ss.getSheetByName('AppState');
      if (!sheetState) {
        sheetState = ss.insertSheet('AppState');
        sheetState.hideSheet();
      }
      sheetState.getRange(1, 1).setValue(JSON.stringify(payload));
      return createJsonResponse({ success: true, message: 'AppState synchronized' });
    } else if (action === 'addTransaksi' || action === 'PAYMENT') {
      appendRowToSheet('Transaksi', [
        payload.noKwitansi,
        payload.nis,
        payload.tanggal,
        payload.posId,
        payload.posNama,
        payload.bulan || '',
        payload.nominal,
        payload.metode,
        payload.petugas,
        payload.catatan || ''
      ]);
      
      // Log Audit
      appendRowToSheet('AuditLog', [
        new Date().toISOString(),
        payload.petugas,
        'Proses Pembayaran',
        'Pembayaran ' + payload.posNama + ' Rp ' + payload.nominal + ' NIS: ' + payload.nis
      ]);
    } else if (action === 'addSiswa') {
      appendRowToSheet('Siswa', [
        payload.nis,
        payload.nisn,
        payload.nama,
        payload.gender,
        payload.kelas,
        payload.jurusan,
        payload.namaWali,
        payload.hpWali,
        payload.alamat,
        payload.status
      ]);
    } else if (action === 'deleteTransaksi') {
      deleteRowByValue('Transaksi', 1, payload.noKwitansi);
    }
    
    return createJsonResponse(result);
  } catch (err) {
    return createJsonResponse({ success: false, error: err.toString() });
  }
}

// 3. Helper Functions
function getSheetDataAsObjects(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return [];
  
  const values = sheet.getDataRange().getValues();
  if (values.length <= 1) return [];
  
  const headers = values[0];
  const results = [];
  
  for (let i = 1; i < values.length; i++) {
    let rowObj = {};
    for (let j = 0; j < headers.length; j++) {
      rowObj[headers[j]] = values[i][j];
    }
    results.push(rowObj);
  }
  return results;
}

function appendRowToSheet(sheetName, rowArray) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    setupDatabaseSheets();
    sheet = ss.getSheetByName(sheetName);
  }
  sheet.appendRow(rowArray);
}

function deleteRowByValue(sheetName, colIndex1Based, searchValue) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;
  const values = sheet.getDataRange().getValues();
  for (let i = values.length - 1; i >= 1; i--) {
    if (String(values[i][colIndex1Based - 1]) === String(searchValue)) {
      sheet.deleteRow(i + 1);
      break;
    }
  }
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;
