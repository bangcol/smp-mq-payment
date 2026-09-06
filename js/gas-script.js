/**
 * ====================================================================
 * SISTEM PEMBAYARAN SMP MQ AL HUDA BINANGUN
 * Google Apps Script Backend (Code.gs) - Realtime Multi-Device Sync
 * Salin dan tempel kode ini ke Google Spreadsheet Anda:
 * Extensions -> Apps Script -> Code.gs
 * ====================================================================
 */

// 1. Inisialisasi Database Sheet (Jalankan Sekali Saja)
function setupDatabaseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = {
    'Pembayaran': ['No Kwitansi','Tanggal','NIS','Nama Siswa','ID Pos','Nama Pos','Nominal','Metode','Petugas','Status','Keterangan'],
    'LogAktivitas': ['Waktu','Petugas','Role','Aksi','Detail','Device'],
    'Siswa': ['NIS','NISN','Nama','Gender','Kelas','Jurusan','Ayah','HP','Status','Thn Masuk'],
    'Kelas': ['ID','Nama Kelas','Jurusan','Wali Kelas'],
    'TahunAjaran': ['Tahun Ajaran','Status'],
    'JenisPembayaran': ['ID','Nama','Kategori','Nominal','Status','Keterangan'],
    'AppState': ['DataChunk']
  };

  Object.keys(sheets).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(sheets[name]);
      sheet.getRange(1, 1, 1, sheets[name].length).setFontWeight('bold').setBackground('#0284c7').setFontColor('#ffffff');
    }
  });

  SpreadsheetApp.getUi().alert('✅ Database Spreadsheet SMP MQ Berhasil Dikonfigurasi!');
}

// 2. Simpan AppState dengan aman (Mendukung data besar tanpa batas 50.000 karakter)
function saveAppState(dataObj) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('AppState');
  if (!sheet) {
    sheet = ss.insertSheet('AppState');
  }
  sheet.clear();
  sheet.appendRow(['DataChunk']);
  
  const jsonStr = typeof dataObj === 'string' ? dataObj : JSON.stringify(dataObj);
  const chunkSize = 40000;
  const rows = [];
  for (let i = 0; i < jsonStr.length; i += chunkSize) {
    rows.push([jsonStr.substring(i, i + chunkSize)]);
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, 1).setValues(rows);
  }
}

// 3. Baca AppState lengkap dari sheet
function getAppState() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('AppState');
  if (!sheet || sheet.getLastRow() < 2) return null;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const fullStr = rows.map(r => r[0]).join('');
  if (!fullStr || fullStr.length < 5) return null;
  return fullStr;
}

// 4. Catat Baris Pembayaran ke sheet 'Pembayaran' & 'LogAktivitas'
function processPaymentTransaction(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetTrx = ss.getSheetByName('Pembayaran') || ss.insertSheet('Pembayaran');
  let sheetLog = ss.getSheetByName('LogAktivitas') || ss.insertSheet('LogAktivitas');

  const todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd");
  const kwitansiNo = payload.kwitansiNo || ("KWT-" + todayStr + "-" + String(sheetTrx.getLastRow()).padStart(4, '0'));
  const timestamp = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd HH:mm:ss");

  sheetTrx.appendRow([
    kwitansiNo, timestamp, payload.nis, payload.namaSiswa,
    payload.idPembayaran || payload.posId, payload.namaPembayaran || payload.posNama,
    payload.nominal, payload.metode, payload.petugas, 'Lunas', payload.keterangan || ''
  ]);

  sheetLog.appendRow([
    timestamp, payload.petugas, payload.role || 'Admin', 'PEMBAYARAN',
    'Pembayaran ' + (payload.namaPembayaran || payload.posNama) + ' NIS ' + payload.nis + ' Rp ' + payload.nominal,
    'Web App'
  ]);

  return { status: 'success', kwitansiNo: kwitansiNo };
}

// 5. Endpoint GET (Dibuka oleh semua HP / Laptop saat memuat data)
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getFullState';
    const callback = (e && e.parameter) ? e.parameter.callback : null;

    if (action === 'ping') {
      return respondOutput({ status: 'ok', message: 'API SMP MQ Realtime Aktif!', time: new Date().toISOString() }, callback);
    }

    const rawState = getAppState();
    if (!rawState) {
      return respondOutput({ status: 'empty', message: 'Belum ada data di cloud' }, callback);
    }

    // Jika JSONP callback diminta
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + rawState + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }

    return ContentService.createTextOutput(rawState)
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return respondOutput({ status: 'error', message: err.toString() }, e ? e.parameter.callback : null);
  }
}

// 6. Endpoint POST (Menerima simpan data dari Laptop / HP)
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respondOutput({ status: 'error', message: 'Data kiriman kosong' });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // A. Simpan State Database Lengkap (Semua Device 100% Sinkron)
    if (action === 'SAVE_FULL_STATE') {
      saveAppState(payload.data);
      return respondOutput({ status: 'success', message: 'State berhasil disimpan ke cloud' });
    }

    // B. Simpan Pembayaran
    if (action === 'PAYMENT') {
      const res = processPaymentTransaction(payload.data);
      if (payload.fullState) {
        saveAppState(payload.fullState);
      }
      return respondOutput(res);
    }

    return respondOutput({ status: 'error', message: 'Aksi tidak dikenal: ' + action });
  } catch (err) {
    return respondOutput({ status: 'error', message: err.toString() });
  }
}

function respondOutput(obj, callback) {
  const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonStr + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}
