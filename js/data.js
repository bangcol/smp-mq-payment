// data.js – Mock data, constants, and utility helpers for the Payment Book System

/* ---------- Constants ---------- */
// List of month keys & display names used for the SPP matrix (July to June)
const MONTHS_LIST = [
  { key: '07', name: 'Juli' },
  { key: '08', name: 'Agustus' },
  { key: '09', name: 'September' },
  { key: '10', name: 'Oktober' },
  { key: '11', name: 'November' },
  { key: '12', name: 'Desember' },
  { key: '01', name: 'Januari' },
  { key: '02', name: 'Februari' },
  { key: '03', name: 'Maret' },
  { key: '04', name: 'April' },
  { key: '05', name: 'Mei' },
  { key: '06', name: 'Juni' }
];

// Default school settings (used by the UI & printable documents)
const DEFAULT_SETTINGS = {
  schoolName: 'SMP MQ AL HUDA BINANGUN',
  schoolAddress: 'Jl. Butsi RT 16 RW 06 Desa Sidayu Kec. Binangun',
  schoolPhone: '(021) 7890123',
  schoolEmail: 'info@smpmqalhuda.sch.id',
  principalName: 'Kepala Sekolah SMP MQ',
  treasurerName: 'Ust. Yuli',
  bankName: 'Bank Syariah Indonesia (BSI)',
  bankAccountNo: '0012345678',
  bankAccountHolder: 'SMP MQ AL HUDA',
  activeTA: '2026/2027',
  gasUrl: 'https://script.google.com/macros/s/AKfycby_HTh_tJkSEXlqtVEXC4rbvbHiRvhGKYYEuw2ZQJZ4gYnKpZ2ZgAifibLabFx7e8hp/exec'
};

/* ---------- Simple LocalStorage Wrapper ---------- */
const StorageManager = {
  get(key, defaultValue) {
    const raw = localStorage.getItem(key);
    if (raw === null) return defaultValue;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed parse storage key', key, e);
      return defaultValue;
    }
  },
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }
};

/* ---------- Helper Functions ---------- */
function formatRupiah(num) {
  const n = Number(num) || 0;
  return 'Rp ' + n.toLocaleString('id-ID');
}

// Simple Indonesian terbilang (up to billions) – used for printable kwitansi
function terbilangRupiah(num) {
  const angka = Number(num);
  if (isNaN(angka)) return '';
  if (angka === 0) return 'nol rupiah';
  const satuan = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
  const belasan = ['sepuluh', 'sebelas', 'dua belas', 'tiga belas', 'empat belas', 'lima belas', 'enam belas', 'tujuh belas', 'delapan belas', 'sembilan belas'];
  const puluhan = ['', '', 'dua puluh', 'tiga puluh', 'empat puluh', 'lima puluh', 'enam puluh', 'tujuh puluh', 'delapan puluh', 'sembilan puluh'];
  const ratus = ['', 'seratus', 'dua ratus', 'tiga ratus', 'empat ratus', 'lima ratus', 'enam ratus', 'tujuh ratus', 'delapan ratus', 'sembilan ratus'];

  function toWords(n) {
    if (n < 10) return satuan[n];
    if (n < 20) return belasan[n - 10];
    if (n < 100) {
      const d = Math.floor(n / 10);
      const s = n % 10;
      return puluhan[d] + (s ? ' ' + satuan[s] : '');
    }
    if (n < 1000) {
      const h = Math.floor(n / 100);
      const rest = n % 100;
      return ratus[h] + (rest ? ' ' + toWords(rest) : '');
    }
    if (n < 1_000_000) {
      const th = Math.floor(n / 1000);
      const rest = n % 1000;
      const thWord = th === 1 ? 'seribu' : toWords(th) + ' ribu';
      return thWord + (rest ? ' ' + toWords(rest) : '');
    }
    if (n < 1_000_000_000) {
      const jt = Math.floor(n / 1_000_000);
      const rest = n % 1_000_000;
      const jtWord = jt === 1 ? 'satu juta' : toWords(jt) + ' juta';
      return jtWord + (rest ? ' ' + toWords(rest) : '');
    }
    // beyond billions (capped for demo)
    return toWords(Math.floor(n / 1_000_000_000)) + ' milyar' + (n % 1_000_000_000 ? ' ' + toWords(n % 1_000_000_000) : '');
  }
  return toWords(angka) + ' rupiah';
}

/* ---------- Mock Data (replace with real data on production) ---------- */
// Students (siswa)
const mockSiswa = [
  {
    nis: '20250701',
    nisn: '00123456789',
    nama: 'Muhammad Budi Santoso',
    gender: 'L',
    kelas: 'VII A',
    jurusan: 'Reguler',
    namaWali: 'Ahmad Santoso',
    hpWali: '628123456789',
    alamat: 'Cirebon',
    status: 'Aktif'
  },
  {
    nis: '20250702',
    nisn: '00123456790',
    nama: 'Nabila Zahra',
    gender: 'P',
    kelas: 'VIII B',
    jurusan: 'Reguler',
    namaWali: 'Siti Zahra',
    hpWali: '628987654321',
    alamat: 'Cirebon',
    status: 'Aktif'
  },
  // add more demo students as needed
];

// Classes (kelas)
const mockKelas = [
  { id: 'kls-1', nama: 'VII A', jurusan: 'Reguler', waliKelas: 'Ust. Abdullah' },
  { id: 'kls-2', nama: 'VII B', jurusan: 'Reguler', waliKelas: 'Ust. Abdullah' },
  { id: 'kls-3', nama: 'VIII A', jurusan: 'Reguler', waliKelas: 'Ust. Abdullah' },
  { id: 'kls-4', nama: 'VIII B', jurusan: 'Reguler', waliKelas: 'Ust. Abdullah' },
  { id: 'kls-5', nama: 'IX A', jurusan: 'Reguler', waliKelas: 'Ust. Abdullah' },
  { id: 'kls-6', nama: 'IX B', jurusan: 'Reguler', waliKelas: 'Ust. Abdullah' }
];

// Tahun Ajaran (ta)
const mockTA = [
  { id: 'ta-2024', nama: '2024/2025', status: 'Non-Aktif' },
  { id: 'ta-2025', nama: '2025/2026', status: 'Aktif' }
];

// Pos Pembayaran (pos) – include SPP and a few others
const mockPos = [
  { id: 'pos-spp', kode: 'SPP', nama: 'SPP Bulanan', tipe: 'bulanan', tarip: 350000, deskripsi: 'Pembayaran SPP tiap bulan' },
  { id: 'pos-gedung', kode: 'GED', nama: 'Uang Gedung', tipe: 'bebas', tarip: 600000, deskripsi: 'Uang gedung umum' },
  { id: 'pos-seragam', kode: 'SRG', nama: 'Seragam Sekolah', tipe: 'sekali', tarip: 500000, deskripsi: 'Seragam standar' },
  { id: 'pos-buku', kode: 'BK', nama: 'Buku LKS', tipe: 'sekali', tarip: 300000, deskripsi: 'Buku LKS tiap semester' },
  { id: 'pos-ujian', kode: 'UJN', nama: 'Biaya Ujian', tipe: 'tahunan', tarip: 250000, deskripsi: 'Uang ujian akhir tahun' }
];

// Transaction log (transaksi) – initially empty, will be populated by the app
const mockTransaksi = [];

// Activity logs (audit)
const mockLogs = [];

/* ---------- Initialize LocalStorage if empty ---------- */
function initMockData() {
  if (!localStorage.getItem('siswa')) StorageManager.set('siswa', mockSiswa);
  if (!localStorage.getItem('kelas')) StorageManager.set('kelas', mockKelas);
  if (!localStorage.getItem('ta')) StorageManager.set('ta', mockTA);
  if (!localStorage.getItem('pos')) StorageManager.set('pos', mockPos);
  if (!localStorage.getItem('transaksi')) StorageManager.set('transaksi', mockTransaksi);
  if (!localStorage.getItem('logs')) StorageManager.set('logs', mockLogs);
  if (!localStorage.getItem('settings')) StorageManager.set('settings', DEFAULT_SETTINGS);
}

// Run once on load
initMockData();

/* ---------- Export for other scripts (optional) ---------- */
window.MONTHS_LIST = MONTHS_LIST;
window.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
window.StorageManager = StorageManager;
window.formatRupiah = formatRupiah;
window.terbilangRupiah = terbilangRupiah;
