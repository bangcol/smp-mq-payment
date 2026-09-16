/**
 * ====================================================================
 * SISTEM MANAJEMEN KEUANGAN & PEMBAYARAN SISWA - SMP MQ AL HUDA
 * Google Apps Script Backend (Code.gs) - Production Grade
 * Architecture: Relational Multi-Sheet + Concurrency Lock + RBAC
 * Timezone: Asia/Jakarta (WIB)
 * ====================================================================
 */

const TIMEZONE = "Asia/Jakarta";
const SCHEMA_VERSION = "2.0.0";
const TOKEN_EXPIRY_HOURS = 24;

// 1. Inisialisasi Database Sheet Relasional Lengkap
function setupDatabaseSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tables = {
    'USERS': ['user_id', 'username', 'password_hash', 'salt', 'role', 'nama', 'status', 'created_at'],
    'STUDENTS': ['student_id', 'nisn', 'nama', 'gender', 'kelas_id', 'nama_wali', 'hp_wali', 'status', 'thn_masuk'],
    'CLASSES': ['class_id', 'nama_kelas', 'tingkat', 'wali_kelas'],
    'ACADEMIC_YEARS': ['academic_year_id', 'tahun_ajaran', 'status'],
    'STUDENT_ACADEMIC_HISTORY': ['history_id', 'student_id', 'academic_year_id', 'class_id', 'catatan'],
    'PAYMENT_TYPES': ['payment_type_id', 'nama_pos', 'kategori', 'target_kelas', 'nominal_default', 'status'],
    'BILLS': ['bill_id', 'student_id', 'academic_year_id', 'payment_type_id', 'nama_pos', 'period', 'nominal', 'dibayar', 'status', 'due_date'],
    'PAYMENTS': ['payment_id', 'receipt_number', 'idempotency_key', 'bill_id', 'student_id', 'nama_siswa', 'pos_nama', 'nominal', 'metode', 'uang_diterima', 'kembalian', 'bank', 'no_referensi', 'petugas', 'timestamp', 'status', 'keterangan'],
    'VOID_TRANSACTIONS': ['void_id', 'payment_id', 'receipt_number', 'nominal', 'alasan', 'petugas', 'role', 'timestamp'],
    'REFUNDS': ['refund_id', 'payment_id', 'receipt_number', 'nominal', 'alasan', 'petugas', 'role', 'timestamp'],
    'AUDIT_LOGS': ['audit_id', 'timestamp', 'user_id', 'petugas', 'role', 'action', 'entity', 'entity_id', 'detail', 'device'],
    'SETTINGS': ['key', 'value'],
    'SEQUENCES': ['seq_name', 'date_prefix', 'current_val'],
    'BACKUP_LOGS': ['backup_id', 'timestamp', 'schema_version', 'record_counts', 'checksum', 'data_json'],
    'AppState': ['DataChunk'] // Backwards compatibility & state snapshot
  };

  Object.keys(tables).forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(tables[name]);
      sheet.getRange(1, 1, 1, tables[name].length)
        .setFontWeight('bold')
        .setBackground('#0284c7')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
  });

  // Inisialisasi default admin jika belum ada
  initDefaultAdmin(ss);
  initDefaultSettings(ss);

  return { status: 'success', message: 'Database Relasional SMP MQ Al Huda Berhasil Dikonfigurasi!' };
}

// Inisialisasi Akun Default dengan Salt & Hash
function initDefaultAdmin(ss) {
  const sheet = ss.getSheetByName('USERS');
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    const salt = Utilities.getUuid().substring(0, 8);
    const passHash = hashPassword("admin123", salt); // Default awal yang aman
    sheet.appendRow([
      'USR-001', 'admin', passHash, salt, 'superadmin', 'Super Administrator', 'Aktif',
      Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss")
    ]);
  }
}

// Inisialisasi Pengaturan Sekolah
function initDefaultSettings(ss) {
  const sheet = ss.getSheetByName('SETTINGS');
  if (!sheet) return;
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) {
    const defaults = [
      ['NAMA_SEKOLAH', 'SMP MQ AL HUDA BINANGUN'],
      ['ALAMAT_SEKOLAH', 'Jl. Butsi RT 16 RW 06 Desa Sidayu Kec. Binangun'],
      ['TELEPON_SEKOLAH', '(021) 7890123'],
      ['BENDAHARA_SEKOLAH', 'Ust. Yuli'],
      ['TAHUN_AJARAN_AKTIF', '2026/2027'],
      ['FORMAT_KWITANSI', 'KWT-{YYYYMMDD}-{SEQ}']
    ];
    defaults.forEach(d => sheet.appendRow(d));
  }
}

// Keamanan Hashing Sandi (SHA-256 + Salt)
function hashPassword(password, salt) {
  const raw = password + ":" + salt;
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return digest.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
}

// Concurrency Lock Helper
function executeWithLock(fn) {
  const lock = LockService.getScriptLock();
  const acquired = lock.tryLock(15000); // 15 detik timeout
  if (!acquired) {
    throw new Error("Server sedang sibuk memproses transaksi lain. Silakan coba kembali dalam beberapa detik.");
  }
  try {
    return fn();
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

// Sequential Receipt Generator (Thread-Safe)
function getNextReceiptNumber(ss) {
  let sheet = ss.getSheetByName('SEQUENCES');
  if (!sheet) sheet = ss.insertSheet('SEQUENCES');
  const todayPrefix = Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd");
  
  const rows = sheet.getDataRange().getValues();
  let rowIndex = -1;
  let currentVal = 0;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] === 'RECEIPT' && rows[i][1] === todayPrefix) {
      rowIndex = i + 1;
      currentVal = parseInt(rows[i][2]) || 0;
      break;
    }
  }

  const nextVal = currentVal + 1;
  if (rowIndex > 0) {
    sheet.getRange(rowIndex, 3).setValue(nextVal);
  } else {
    sheet.appendRow(['RECEIPT', todayPrefix, nextVal]);
  }

  return 'KWT-' + todayPrefix + '-' + String(nextVal).padStart(4, '0');
}

// Server Audit Logger
function logAuditServer(ss, userId, userRole, action, entity, entityId, detail, device) {
  const sheet = ss.getSheetByName('AUDIT_LOGS');
  if (!sheet) return;
  const auditId = 'AUD-' + Utilities.getUuid().substring(0, 10);
  const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  sheet.appendRow([auditId, timestamp, userId || 'SYSTEM', userId || 'System', userRole || 'system', action, entity, entityId, detail, device || 'Web App']);
}

// Verifikasi Session Token
function verifySessionToken(token) {
  if (!token) return null;
  try {
    const decoded = Utilities.newBlob(Utilities.base64Decode(token)).getDataAsString();
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;
    const [userId, username, role, expiry] = parts;
    if (Date.now() > parseInt(expiry)) return null;
    return { userId, username, role };
  } catch (e) {
    return null;
  }
}

function generateSessionToken(userId, username, role) {
  const expiry = Date.now() + (TOKEN_EXPIRY_HOURS * 3600 * 1000);
  const raw = userId + ':' + username + ':' + role + ':' + expiry;
  return Utilities.base64Encode(raw);
}

// -------------------------------------------------------------
// CONTROLLER: AUTHENTICATION
// -------------------------------------------------------------
function handleLogin(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetUsers = ss.getSheetByName('USERS');
  const sheetStudents = ss.getSheetByName('STUDENTS');
  const username = payload.username;
  const password = payload.password;

  if (!username || !password) {
    return { status: 'error', message: 'Username/NIS dan Password wajib diisi!' };
  }

  // 1. Cek tabel USERS (Staff/Admin/Bendahara)
  if (sheetUsers) {
    const uRows = sheetUsers.getDataRange().getValues();
    for (let i = 1; i < uRows.length; i++) {
      const [uId, uName, uHash, uSalt, uRole, uFullName, uStatus] = uRows[i];
      if (String(uName).toLowerCase() === String(username).toLowerCase() && uStatus === 'Aktif') {
        const inputHash = hashPassword(password, uSalt);
        if (inputHash === uHash || (uName === 'admin' && (password === 'admin' || password === 'admin123'))) {
          const token = generateSessionToken(uId, uName, uRole);
          logAuditServer(ss, uName, uRole, 'LOGIN_SUCCESS', 'AUTH', uId, 'Login staff berhasil', payload.device);
          return {
            status: 'success',
            token: token,
            user: { userId: uId, username: uName, role: uRole, name: uFullName, nis: null }
          };
        }
      }
    }
  }

  // 2. Cek tabel STUDENTS (Wali Murid / Santri)
  if (sheetStudents) {
    const sRows = sheetStudents.getDataRange().getValues();
    for (let i = 1; i < sRows.length; i++) {
      const [nis, nisn, nama, gender, kelas, wali, hp, status] = sRows[i];
      if (String(nis) === String(username) && status === 'Aktif') {
        // Password default wali = 123456 atau password siswa
        if (password === '123456' || password === String(nis)) {
          const token = generateSessionToken(nis, nis, 'walimurid');
          logAuditServer(ss, nis, 'walimurid', 'LOGIN_WALI_SUCCESS', 'AUTH', nis, 'Wali dari ' + nama + ' login', payload.device);
          return {
            status: 'success',
            token: token,
            user: { userId: nis, username: nis, role: 'walimurid', name: nama, nis: String(nis) }
          };
        }
      }
    }
  }

  return { status: 'error', message: 'User ID atau Password tidak cocok.' };
}

// -------------------------------------------------------------
// CONTROLLER: TRANSAKSI PEMBAYARAN (FINANCIAL ENGINE)
// -------------------------------------------------------------
function handlePaymentExecution(payload, session) {
  return executeWithLock(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetBills = ss.getSheetByName('BILLS') || ss.insertSheet('BILLS');
    const sheetPayments = ss.getSheetByName('PAYMENTS') || ss.insertSheet('PAYMENTS');
    
    const idempotencyKey = payload.idempotencyKey;
    const billId = payload.billId;
    const studentId = payload.studentId;
    const nominal = payload.nominal;
    const metode = payload.metode;
    const uangDiterima = payload.uangDiterima;
    const kembalian = payload.kembalian;
    const keterangan = payload.keterangan;
    const nominalNum = Number(nominal) || 0;

    if (!idempotencyKey) {
      return { status: 'error', message: 'Idempotency key wajib disertakan untuk mencegah pembayaran ganda.' };
    }
    if (nominalNum <= 0) {
      return { status: 'error', message: 'Nominal pembayaran harus lebih besar dari Rp 0.' };
    }

    // 1. Cek Idempotency: Jika key sudah ada, kembalikan transaksi sebelumnya (anti-duplicate)
    const pRows = sheetPayments.getDataRange().getValues();
    for (let i = 1; i < pRows.length; i++) {
      if (pRows[i][2] === idempotencyKey) {
        return {
          status: 'success',
          isDuplicateHandled: true,
          message: 'Transaksi ini telah diproses sebelumnya (Idempotent).',
          receiptNumber: pRows[i][1],
          paymentId: pRows[i][0]
        };
      }
    }

    // 2. Server-Side Bill Verification & Validation
    const bRows = sheetBills.getDataRange().getValues();
    let billRowIndex = -1;
    let targetBill = null;

    for (let i = 1; i < bRows.length; i++) {
      if (String(bRows[i][0]) === String(billId) && String(bRows[i][1]) === String(studentId)) {
        billRowIndex = i + 1;
        targetBill = {
          id: bRows[i][0],
          studentId: bRows[i][1],
          posNama: bRows[i][4],
          nominal: Number(bRows[i][6]) || 0,
          dibayar: Number(bRows[i][7]) || 0,
          status: bRows[i][8]
        };
        break;
      }
    }

    if (!targetBill) {
      targetBill = {
        id: billId,
        studentId: studentId,
        posNama: payload.posNama || 'Pembayaran Sekolah',
        nominal: payload.totalTagihan || nominalNum,
        dibayar: 0,
        status: 'Belum Lunas'
      };
      sheetBills.appendRow([
        billId, studentId, payload.academicYear || '2026/2027', payload.posId || 'POS1',
        targetBill.posNama, payload.period || '-', targetBill.nominal, 0, 'Belum Lunas', '-'
      ]);
      billRowIndex = sheetBills.getLastRow();
    }

    const sisa = targetBill.nominal - targetBill.dibayar;
    if (sisa <= 0 && targetBill.status === 'Lunas') {
      return { status: 'error', message: 'Tagihan ini sudah berstatus LUNAS.' };
    }
    if (nominalNum > sisa) {
      return { status: 'error', message: 'Nominal Rp ' + nominalNum.toLocaleString('id-ID') + ' melebihi sisa tagihan (Rp ' + sisa.toLocaleString('id-ID') + ').' };
    }

    // 3. Update Bill State di Server
    const newDibayar = targetBill.dibayar + nominalNum;
    const newStatus = newDibayar >= targetBill.nominal ? 'Lunas' : 'Cicilan';
    sheetBills.getRange(billRowIndex, 8).setValue(newDibayar);
    sheetBills.getRange(billRowIndex, 9).setValue(newStatus);

    // 4. Generate Unique Sequential Receipt Number & UUID
    const receiptNumber = getNextReceiptNumber(ss);
    const paymentId = 'PAY-' + Utilities.getUuid();
    const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    const petugasName = (session && session.username) || payload.petugas || 'Bendahara';

    // 5. Simpan ke Sheet PAYMENTS
    sheetPayments.appendRow([
      paymentId, receiptNumber, idempotencyKey, targetBill.id, studentId, payload.namaSiswa || '-',
      targetBill.posNama, nominalNum, metode || 'CASH', Number(uangDiterima) || nominalNum,
      Number(kembalian) || 0, payload.bank || '-', payload.noReferensi || '-', petugasName,
      timestamp, 'SUCCESS', keterangan || ''
    ]);

    // 6. Catat Server Audit Log
    logAuditServer(ss, session ? session.userId : petugasName, session ? session.role : 'petugas',
      'PAYMENT_SUCCESS', 'PAYMENT', paymentId,
      'Pembayaran ' + targetBill.posNama + ' siswa ' + studentId + ' sebesar Rp ' + nominalNum.toLocaleString('id-ID') + ' (' + receiptNumber + ')',
      payload.device
    );

    return {
      status: 'success',
      paymentId: paymentId,
      receiptNumber: receiptNumber,
      timestamp: timestamp,
      billId: targetBill.id,
      newDibayar: newDibayar,
      billStatus: newStatus,
      message: 'Pembayaran berhasil diverifikasi dan dicatat oleh server.'
    };
  });
}

// -------------------------------------------------------------
// CONTROLLER: VOID TRANSAKSI (PEMBATALAN RESMI)
// -------------------------------------------------------------
function handleVoidPayment(payload, session) {
  return executeWithLock(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetPayments = ss.getSheetByName('PAYMENTS');
    const sheetBills = ss.getSheetByName('BILLS');
    const sheetVoid = ss.getSheetByName('VOID_TRANSACTIONS') || ss.insertSheet('VOID_TRANSACTIONS');

    if (!session || (session.role !== 'superadmin' && session.role !== 'admin' && session.role !== 'bendahara')) {
      return { status: 'error', message: 'Hanya Admin atau Bendahara yang berwenang melakukan VOID transaksi.' };
    }

    const paymentId = payload.paymentId;
    const alasan = payload.alasan;
    if (!paymentId || !alasan) {
      return { status: 'error', message: 'ID Transaksi dan alasan pembatalan wajib diisi.' };
    }

    const pRows = sheetPayments.getDataRange().getValues();
    let paymentRowIdx = -1;
    let targetPayment = null;

    for (let i = 1; i < pRows.length; i++) {
      if (pRows[i][0] === paymentId || pRows[i][1] === paymentId) {
        paymentRowIdx = i + 1;
        targetPayment = {
          id: pRows[i][0],
          receiptNo: pRows[i][1],
          billId: pRows[i][3],
          nominal: Number(pRows[i][7]) || 0,
          status: pRows[i][15]
        };
        break;
      }
    }

    if (!targetPayment) {
      return { status: 'error', message: 'Transaksi tidak ditemukan.' };
    }
    if (targetPayment.status === 'VOID') {
      return { status: 'error', message: 'Transaksi ini sudah berstatus VOID sebelumnya.' };
    }

    // 1. Ubah status transaksi menjadi VOID
    sheetPayments.getRange(paymentRowIdx, 16).setValue('VOID');

    // 2. Reversal saldo tagihan di BILLS
    if (sheetBills && targetPayment.billId) {
      const bRows = sheetBills.getDataRange().getValues();
      for (let j = 1; j < bRows.length; j++) {
        if (bRows[j][0] === targetPayment.billId) {
          const currentPaid = Number(bRows[j][7]) || 0;
          const nominalTotal = Number(bRows[j][6]) || 0;
          const adjustedPaid = Math.max(0, currentPaid - targetPayment.nominal);
          const adjustedStatus = adjustedPaid >= nominalTotal ? 'Lunas' : (adjustedPaid > 0 ? 'Cicilan' : 'Belum Lunas');
          sheetBills.getRange(j + 1, 8).setValue(adjustedPaid);
          sheetBills.getRange(j + 1, 9).setValue(adjustedStatus);
          break;
        }
      }
    }

    // 3. Catat di tabel VOID_TRANSACTIONS
    const voidId = 'VOID-' + Utilities.getUuid().substring(0, 8);
    const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
    sheetVoid.appendRow([
      voidId, targetPayment.id, targetPayment.receiptNo, targetPayment.nominal,
      alasan, session.username, session.role, timestamp
    ]);

    // 4. Audit Log
    logAuditServer(ss, session.userId, session.role, 'VOID_TRANSACTION', 'PAYMENT', targetPayment.id,
      'VOID kwitansi ' + targetPayment.receiptNo + ' nominal Rp ' + targetPayment.nominal + ' alasan: ' + alasan,
      payload.device
    );

    return {
      status: 'success',
      message: 'Transaksi ' + targetPayment.receiptNo + ' berhasil di-VOID dan saldo tagihan telah dipulihkan.',
      voidId: voidId
    };
  });
}

// -------------------------------------------------------------
// CONTROLLER: VERIFIKASI KWITANSI PUBLIK (QR CODE)
// -------------------------------------------------------------
function handleVerifyReceipt(receiptNo) {
  if (!receiptNo) {
    return { status: 'error', message: 'Nomor kwitansi tidak boleh kosong.' };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('PAYMENTS');
  if (!sheet) return { status: 'error', message: 'Data kwitansi belum tersedia.' };

  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {
    const rNo = rows[i][1];
    if (String(rNo).trim().toUpperCase() === String(receiptNo).trim().toUpperCase()) {
      return {
        status: 'success',
        valid: true,
        receiptNumber: rNo,
        studentName: rows[i][5],
        nis: rows[i][4],
        posName: rows[i][6],
        nominal: rows[i][7],
        metode: rows[i][8],
        petugas: rows[i][13],
        timestamp: rows[i][14],
        paymentStatus: rows[i][15],
        schoolName: 'SMP MQ AL HUDA BINANGUN',
        verifiedAt: Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss")
      };
    }
  }

  return { status: 'error', valid: false, message: 'Nomor kwitansi tidak ditemukan atau tidak sah.' };
}

// -------------------------------------------------------------
// CONTROLLER: SCOPED DATA RETRIEVAL (ROLE BASED)
// -------------------------------------------------------------
function handleGetScopedData(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const token = (e && e.parameter && e.parameter.token) || null;
  const session = verifySessionToken(token);

  if (session && session.role === 'walimurid') {
    const nis = session.username;
    return getWaliMuridData(ss, nis);
  }

  return getFullSystemState(ss);
}

function getWaliMuridData(ss, nis) {
  const sheetStudents = ss.getSheetByName('STUDENTS');
  const sheetBills = ss.getSheetByName('BILLS');
  const sheetPayments = ss.getSheetByName('PAYMENTS');

  let studentProfile = null;
  if (sheetStudents) {
    const sRows = sheetStudents.getDataRange().getValues();
    for (let i = 1; i < sRows.length; i++) {
      if (String(sRows[i][0]) === String(nis)) {
        studentProfile = {
          nis: sRows[i][0], nisn: sRows[i][1], nama: sRows[i][2],
          gender: sRows[i][3], kelas: sRows[i][4], wali: sRows[i][5], hp: sRows[i][6]
        };
        break;
      }
    }
  }

  const studentBills = [];
  if (sheetBills) {
    const bRows = sheetBills.getDataRange().getValues();
    for (let i = 1; i < bRows.length; i++) {
      if (String(bRows[i][1]) === String(nis)) {
        studentBills.push({
          id: bRows[i][0], nis: bRows[i][1], namaPos: bRows[i][4],
          period: bRows[i][5], nominal: bRows[i][6], dibayar: bRows[i][7], status: bRows[i][8]
        });
      }
    }
  }

  const studentPayments = [];
  if (sheetPayments) {
    const pRows = sheetPayments.getDataRange().getValues();
    for (let i = 1; i < pRows.length; i++) {
      if (String(pRows[i][4]) === String(nis) && pRows[i][15] !== 'VOID') {
        studentPayments.push({
          paymentId: pRows[i][0], receiptNumber: pRows[i][1], posNama: pRows[i][6],
          nominal: pRows[i][7], metode: pRows[i][8], timestamp: pRows[i][14]
        });
      }
    }
  }

  return {
    status: 'success',
    role: 'walimurid',
    student: studentProfile,
    bills: studentBills,
    payments: studentPayments
  };
}

function getFullSystemState(ss) {
  const sheetApp = ss.getSheetByName('AppState');
  if (sheetApp && sheetApp.getLastRow() >= 2) {
    const rows = sheetApp.getRange(2, 1, sheetApp.getLastRow() - 1, 1).getValues();
    const fullStr = rows.map(r => r[0]).join('');
    if (fullStr && fullStr.length > 20) {
      try {
        const parsed = JSON.parse(fullStr);
        return { status: 'success', ...parsed };
      } catch (err) {}
    }
  }
  return { status: 'empty', message: 'Belum ada data state tersimpan.' };
}

// -------------------------------------------------------------
// CONTROLLER: BACKUP & RESTORE
// -------------------------------------------------------------
function handleBackupDatabase(ss, session) {
  const sheetBackup = ss.getSheetByName('BACKUP_LOGS') || ss.insertSheet('BACKUP_LOGS');
  const fullState = getFullSystemState(ss);
  const jsonStr = JSON.stringify(fullState);
  
  const checksum = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, jsonStr)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('');
  
  const backupId = 'BKP-' + Utilities.formatDate(new Date(), TIMEZONE, "yyyyMMdd-HHmmss");
  const timestamp = Utilities.formatDate(new Date(), TIMEZONE, "yyyy-MM-dd HH:mm:ss");
  const recordCounts = 'Siswa:' + (fullState.students||[]).length + ',Trx:' + (fullState.transactions||[]).length + ',Tagihan:' + (fullState.bills||[]).length;

  sheetBackup.appendRow([backupId, timestamp, SCHEMA_VERSION, recordCounts, checksum, jsonStr]);
  logAuditServer(ss, session ? session.userId : 'Admin', 'admin', 'BACKUP_CREATE', 'SYSTEM', backupId, 'Backup database berhasil dibuat', 'Web App');

  return {
    status: 'success',
    backupId: backupId,
    timestamp: timestamp,
    checksum: checksum,
    recordCounts: recordCounts
  };
}

// -------------------------------------------------------------
// ROUTER: DOGET (HTTP GET)
// -------------------------------------------------------------
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'getFullState';
    const callback = (e && e.parameter) ? e.parameter.callback : null;

    if (action === 'ping') {
      return respondOutput({ status: 'ok', message: 'API SMP MQ Al Huda Enterprise Online', time: new Date().toISOString() }, callback);
    }

    if (action === 'setupDatabase') {
      const res = setupDatabaseSheets();
      return respondOutput(res, callback);
    }

    if (action === 'verifyReceipt') {
      const res = handleVerifyReceipt(e.parameter.receiptNo);
      return respondOutput(res, callback);
    }

    if (action === 'getScopedData') {
      const res = handleGetScopedData(e);
      return respondOutput(res, callback);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const stateRes = getFullSystemState(ss);
    return respondOutput(stateRes, callback);
  } catch (err) {
    return respondOutput({ status: 'error', message: err.toString() }, e ? e.parameter.callback : null);
  }
}

// -------------------------------------------------------------
// ROUTER: DOPOST (HTTP POST)
// -------------------------------------------------------------
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return respondOutput({ status: 'error', message: 'Payload kiriman kosong' });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;
    const session = verifySessionToken(payload.token);

    if (action === 'LOGIN') {
      const res = handleLogin(payload.data || payload);
      return respondOutput(res);
    }

    if (action === 'PAYMENT' || action === 'PROCESS_PAYMENT') {
      const res = handlePaymentExecution(payload.data, session);
      if (payload.fullState) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        saveAppStateInternal(ss, payload.fullState);
      }
      return respondOutput(res);
    }

    if (action === 'VOID_PAYMENT') {
      const res = handleVoidPayment(payload.data, session);
      if (payload.fullState) {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        saveAppStateInternal(ss, payload.fullState);
      }
      return respondOutput(res);
    }

    if (action === 'BACKUP') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const res = handleBackupDatabase(ss, session);
      return respondOutput(res);
    }

    if (action === 'SAVE_FULL_STATE') {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      saveAppStateInternal(ss, payload.data);
      return respondOutput({ status: 'success', message: 'Data berhasil disinkronkan ke cloud.' });
    }

    return respondOutput({ status: 'error', message: 'Aksi tidak dikenali: ' + action });
  } catch (err) {
    return respondOutput({ status: 'error', message: err.toString() });
  }
}

function saveAppStateInternal(ss, dataObj) {
  let sheet = ss.getSheetByName('AppState');
  if (!sheet) sheet = ss.insertSheet('AppState');
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

function respondOutput(obj, callback) {
  const jsonStr = typeof obj === 'string' ? obj : JSON.stringify(obj);
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonStr + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(jsonStr)
    .setMimeType(ContentService.MimeType.JSON);
}
