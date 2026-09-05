/**
 * Core Application Logic Controller
 * Sistem Buku Pembayaran Siswa - SMP / SMA MQ
 */

let currentView = 'dashboard';
let currentRole = 'superadmin';
let selectedTrxStudentNis = '20250701'; // Default selected student
let chartBulananInstance = null;
let chartTunggakanInstance = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    loadSettings();
    initNotificationList();
    renderAllViews();
    switchRole(currentRole);
    showView('dashboard');
}

// 1. SETTINGS & THEMING
function loadSettings() {
    const settings = StorageManager.get('settings', DEFAULT_SETTINGS);
    
    // Update displays
    document.querySelectorAll('.school-title-display').forEach(el => {
        el.textContent = settings.schoolName;
    });
    
    const badgeTA = document.getElementById('active-ta-badge');
    if (badgeTA) badgeTA.textContent = `TA ${settings.activeTA}`;

    // Load dark mode preference
    if (localStorage.getItem('theme') === 'dark' || 
        (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
}

function toggleDarkMode() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
    // Re-render charts with dark/light mode compatible text colors
    if (currentView === 'dashboard') {
        renderDashboardCharts();
    }
}

// 2. ROLE SWITCHER & PERMISSIONS
function switchRole(role) {
    currentRole = role;
    const userAvatar = document.getElementById('user-avatar');
    const userName = document.getElementById('user-display-name');
    const userRoleLabel = document.getElementById('user-role-label');

    // Toggle navigation accessibility
    const masterGroups = document.querySelectorAll('.master-group');
    const adminOnly = document.querySelectorAll('.admin-only');
    const superadminOnly = document.querySelectorAll('.superadmin-only');

    if (role === 'superadmin') {
        if (userAvatar) userAvatar.textContent = 'SA';
        if (userName) userName.textContent = 'Super Administrator';
        if (userRoleLabel) userRoleLabel.textContent = 'Akses Penuh Sistem';
        
        masterGroups.forEach(el => el.classList.remove('hidden'));
        adminOnly.forEach(el => el.classList.remove('hidden'));
        superadminOnly.forEach(el => el.classList.remove('hidden'));
    } else if (role === 'adminkeu') {
        if (userAvatar) userAvatar.textContent = 'AK';
        if (userName) userName.textContent = 'Siti Rahmawati, S.E.';
        if (userRoleLabel) userRoleLabel.textContent = 'Admin Keuangan';

        masterGroups.forEach(el => el.classList.remove('hidden'));
        adminOnly.forEach(el => el.classList.remove('hidden'));
        superadminOnly.forEach(el => el.classList.add('hidden'));
    } else if (role === 'walikelas') {
        if (userAvatar) userAvatar.textContent = 'WK';
        if (userName) userName.textContent = 'Ust. Abdullah, S.Pd.';
        if (userRoleLabel) userRoleLabel.textContent = 'Wali Kelas VII A';

        masterGroups.forEach(el => el.classList.add('hidden'));
        adminOnly.forEach(el => el.classList.add('hidden'));
        superadminOnly.forEach(el => el.classList.add('hidden'));
    } else if (role === 'walimurid') {
        if (userAvatar) userAvatar.textContent = 'WM';
        if (userName) userName.textContent = 'Ahmad Santoso';
        if (userRoleLabel) userRoleLabel.textContent = 'Wali Murid (Muhammad Budi)';

        masterGroups.forEach(el => el.classList.add('hidden'));
        adminOnly.forEach(el => el.classList.add('hidden'));
        superadminOnly.forEach(el => el.classList.add('hidden'));
        showView('portal-wali');
        return;
    }

    if (currentView === 'portal-wali' && role !== 'walimurid') {
        showView('dashboard');
    }
}

// 3. NAVIGATION VIEW ROUTER
function showView(viewId) {
    currentView = viewId;

    // Update active nav styling
    document.querySelectorAll('.nav-item').forEach(nav => {
        nav.classList.remove('bg-brand-50', 'text-brand-600', 'dark:bg-slate-700', 'dark:text-brand-300');
        nav.classList.add('text-slate-600', 'dark:text-slate-300');
    });

    const activeNav = document.getElementById('nav-' + viewId);
    if (activeNav) {
        activeNav.classList.add('bg-brand-50', 'text-brand-600', 'dark:bg-slate-700', 'dark:text-brand-300');
    }

    // Hide all views
    document.querySelectorAll('.app-view').forEach(view => {
        view.classList.add('hidden');
    });

    // Show target view
    const targetView = document.getElementById('view-' + viewId);
    if (targetView) {
        targetView.classList.remove('hidden');
    }

    // Close mobile sidebar if open
    const sidebar = document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
    }

    // Refresh view specific data
    if (viewId === 'dashboard') renderDashboard();
    else if (viewId === 'transaksi') renderTransaksiView();
    else if (viewId === 'portal-wali') renderPortalWaliView();
    else if (viewId === 'siswa') renderMasterSiswaTable();
    else if (viewId === 'kelas-ta') renderKelasAndTATables();
    else if (viewId === 'jenis-pembayaran') renderJenisPembayaranGrid();
    else if (viewId === 'laporan') renderLaporanView();
    else if (viewId === 'log') renderAuditLogView();
    else if (viewId === 'pengaturan') renderPengaturanView();
    else if (viewId === 'apps-script') renderAppsScriptView();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('-translate-x-full');
    }
}

// 4. NOTIFICATIONS LOGIC
function toggleNotificationDropdown() {
    const dropdown = document.getElementById('notif-dropdown');
    if (dropdown) dropdown.classList.toggle('hidden');
}

function initNotificationList() {
    const notifList = document.getElementById('notif-list');
    if (!notifList) return;

    const notifs = [
        { time: '10 min lalu', title: 'Pembayaran Diterima', desc: 'KW-20250812-004 SPP Agustus Budi Santoso (Rp 350.000)' },
        { time: '1 jam lalu', title: 'Reminder Tunggakan', desc: 'Tagihan Uang Gedung Aisyah Nur Syafiqah jatuh tempo' },
        { time: 'Kemarin', title: 'Siswa Baru', desc: 'Nabila Zahra telah ditambahkan ke Kelas VIII B' }
    ];

    notifList.innerHTML = notifs.map(n => `
        <div class="px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition cursor-pointer">
            <div class="font-semibold text-slate-800 dark:text-slate-100">${n.title}</div>
            <div class="text-slate-500 text-[11px]">${n.desc}</div>
            <div class="text-[10px] text-slate-400 mt-1">${n.time}</div>
        </div>
    `).join('');
}

function markAllNotifRead() {
    Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Semua notifikasi telah ditandai dibaca',
        showConfirmButton: false,
        timer: 2000
    });
    toggleNotificationDropdown();
}

// 5. DASHBOARD CALCULATIONS & RENDER
function renderDashboard() {
    const siswaList = StorageManager.get('siswa', []);
    const trxList = StorageManager.get('transaksi', []);
    const posList = StorageManager.get('pos', []);

    // Metric 1: Active Siswa
    document.getElementById('dash-stat-siswa').textContent = siswaList.filter(s => s.status === 'Aktif').length;

    // Metric 2: Bayar Hari Ini (Assume current mock date is 2025-08-12 or today)
    const todayStr = new Date().toISOString().split('T')[0];
    const todayTrx = trxList.filter(t => t.tanggal === todayStr || t.tanggal === '2025-08-12');
    const todayTotal = todayTrx.reduce((sum, t) => sum + Number(t.nominal), 0);
    document.getElementById('dash-stat-today').textContent = formatRupiah(todayTotal);
    document.getElementById('dash-stat-today-count').textContent = `${todayTrx.length} Transaksi`;

    // Metric 3: Bayar Bulan Ini
    const monthTotal = trxList.reduce((sum, t) => sum + Number(t.nominal), 0);
    document.getElementById('dash-stat-month').textContent = formatRupiah(monthTotal);

    // Metric 4: Total Tunggakan (Global Estimate)
    let totalTunggakanGlobal = 0;
    siswaList.forEach(siswa => {
        totalTunggakanGlobal += calculateStudentTunggakan(siswa.nis);
    });
    document.getElementById('dash-stat-tunggakan').textContent = formatRupiah(totalTunggakanGlobal);

    // Metric 5: Pos Count
    document.getElementById('dash-stat-pos').textContent = `${posList.length} Pos`;

    // Top Tunggakan Table
    renderTopTunggakanTable(siswaList);

    // Recent Logs List
    renderDashboardRecentLogs();

    // Render Charts
    renderDashboardCharts();
}

function calculateStudentTunggakan(nis) {
    const trxList = StorageManager.get('transaksi', []);
    const posList = StorageManager.get('pos', []);

    let totalObligation = 0;
    let totalPaid = 0;

    // SPP (12 Months x SPP Rate)
    const posSPP = posList.find(p => p.kode === 'SPP');
    const sppRate = posSPP ? posSPP.tarip : 350000;
    
    // We count target as current active elapsed months (e.g. 3 months: Juli, Ags, Sept)
    const activeMonthsCount = 3; 
    totalObligation += (sppRate * activeMonthsCount);

    // Add other fixed pos
    posList.filter(p => p.kode !== 'SPP').forEach(pos => {
        totalObligation += Number(pos.tarip);
    });

    // Calculate total paid by student
    const studentTrx = trxList.filter(t => t.nis === nis);
    totalPaid = studentTrx.reduce((sum, t) => sum + Number(t.nominal), 0);

    const tunggakan = totalObligation - totalPaid;
    return tunggakan > 0 ? tunggakan : 0;
}

function renderTopTunggakanTable(siswaList) {
    const tbody = document.getElementById('dash-tunggakan-table');
    if (!tbody) return;

    // Calculate tunggakan for each student and sort
    const mapped = siswaList.map(s => {
        const tunggakan = calculateStudentTunggakan(s.nis);
        return { ...s, tunggakan };
    }).filter(s => s.tunggakan > 0).sort((a, b) => b.tunggakan - a.tunggakan).slice(0, 5);

    if (mapped.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400">Tidak ada data tunggakan. Semua siswa lunas!</td></tr>`;
        return;
    }

    tbody.innerHTML = mapped.map(s => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
            <td class="p-3 pl-5 font-semibold text-slate-800 dark:text-slate-100">
                ${s.nama}
                <div class="text-[10px] text-slate-400">NIS: ${s.nis}</div>
            </td>
            <td class="p-3"><span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded font-medium">${s.kelas}</span></td>
            <td class="p-3 text-rose-500 font-semibold">SPP & Uang Gedung</td>
            <td class="p-3 font-bold text-rose-600 dark:text-rose-400">${formatRupiah(s.tunggakan)}</td>
            <td class="p-3 pr-5 text-right space-x-1">
                <button onclick="selectStudentForTrx('${s.nis}')" class="px-2.5 py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[11px] font-semibold">
                    <i class="fa-solid fa-cash-register mr-1"></i> Bayar
                </button>
                <button onclick="shareTagihanWhatsApp('${s.nis}')" class="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold">
                    <i class="fa-brands fa-whatsapp"></i> WA
                </button>
            </td>
        </tr>
    `).join('');
}

function renderDashboardRecentLogs() {
    const logs = StorageManager.get('logs', []).slice(0, 4);
    const container = document.getElementById('dash-recent-logs');
    if (!container) return;

    container.innerHTML = logs.map(l => `
        <div class="flex space-x-3 text-xs">
            <div class="w-2 h-2 rounded-full bg-brand-500 mt-1.5 flex-shrink-0"></div>
            <div>
                <div class="font-semibold text-slate-800 dark:text-slate-200">${l.aksi}</div>
                <div class="text-slate-500 text-[11px] leading-relaxed">${l.detail}</div>
                <div class="text-[10px] text-slate-400 mt-0.5">${l.timestamp} - ${l.user}</div>
            </div>
        </div>
    `).join('');
}

function renderDashboardCharts() {
    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? '#334155' : '#e2e8f0';

    // 1. Chart Bulanan (Bar Chart)
    const ctxBulanan = document.getElementById('chartBulanan');
    if (ctxBulanan) {
        if (chartBulananInstance) chartBulananInstance.destroy();
        chartBulananInstance = new Chart(ctxBulanan, {
            type: 'bar',
            data: {
                labels: ['Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember', 'Januari', 'Februari', 'Maret'],
                datasets: [
                    {
                        label: 'Realisasi Kas (Rp)',
                        data: [28500000, 32100000, 18500000, 0, 0, 0, 0, 0, 0],
                        backgroundColor: '#0284c7',
                        borderRadius: 6
                    },
                    {
                        label: 'Target Anggaran (Rp)',
                        data: [35000000, 35000000, 35000000, 35000000, 35000000, 35000000, 35000000, 35000000, 35000000],
                        backgroundColor: isDark ? '#334155' : '#e2e8f0',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: textColor } }
                },
                scales: {
                    x: { ticks: { color: textColor }, grid: { color: gridColor } },
                    y: { ticks: { color: textColor }, grid: { color: gridColor } }
                }
            }
        });
    }

    // 2. Chart Tunggakan (Doughnut Chart)
    const ctxTunggakan = document.getElementById('chartTunggakan');
    if (ctxTunggakan) {
        if (chartTunggakanInstance) chartTunggakanInstance.destroy();
        chartTunggakanInstance = new Chart(ctxTunggakan, {
            type: 'doughnut',
            data: {
                labels: ['SPP Bulanan', 'Uang Gedung', 'Seragam', 'Buku LKS', 'Biaya Ujian'],
                datasets: [{
                    data: [45, 30, 12, 8, 5],
                    backgroundColor: ['#0284c7', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: textColor, font: { size: 11 } } }
                }
            }
        });
    }
}

// 6. PEMBAYARAN TRANSAKSI SISWA ENGINE (CORE FEATURE)
function renderTransaksiView() {
    renderStudentSelectionGrid('');
    if (selectedTrxStudentNis) {
        loadStudentTransactionProfile(selectedTrxStudentNis);
    }
}

function searchStudent(query) {
    const classFilter = document.getElementById('filter-kelas-transaksi').value;
    renderStudentSelectionGrid(query, classFilter);
}

function filterStudentByKelas(kelas) {
    const query = document.getElementById('search-student-input').value;
    renderStudentSelectionGrid(query, kelas);
}

function resetStudentSearch() {
    document.getElementById('search-student-input').value = '';
    document.getElementById('filter-kelas-transaksi').value = '';
    renderStudentSelectionGrid('');
}

function renderStudentSelectionGrid(query = '', filterKelas = '') {
    const container = document.getElementById('student-search-results');
    if (!container) return;

    const siswaList = StorageManager.get('siswa', []);
    const filtered = siswaList.filter(s => {
        const matchName = s.nama.toLowerCase().includes(query.toLowerCase()) || s.nis.includes(query);
        const matchKelas = !filterKelas || s.kelas === filterKelas;
        return matchName && matchKelas;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full bg-white dark:bg-slate-800 p-8 rounded-2xl text-center text-slate-400">
                <i class="fa-solid fa-user-slash text-4xl mb-2"></i>
                <p class="text-sm font-medium">Siswa tidak ditemukan untuk kata kunci tersebut.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(s => {
        const tunggakan = calculateStudentTunggakan(s.nis);
        const initials = s.nama.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        
        return `
            <div onclick="selectStudentForTrx('${s.nis}')" class="bg-white dark:bg-slate-800 rounded-2xl border ${selectedTrxStudentNis === s.nis ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200/80 dark:border-slate-700'} p-5 hover:shadow-md transition cursor-pointer flex flex-col justify-between">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-xl bg-brand-100 dark:bg-slate-700 text-brand-700 dark:text-brand-300 font-bold flex items-center justify-center text-base">
                        ${initials}
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">${s.nama}</h4>
                        <div class="text-xs text-slate-400 mt-0.5">NIS: ${s.nis} | <span class="font-medium text-slate-600 dark:text-slate-300">${s.kelas}</span></div>
                    </div>
                </div>
                <div class="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex justify-between items-center text-xs">
                    <div>
                        <span class="text-slate-400 block text-[10px]">Tunggakan:</span>
                        <span class="font-bold ${tunggakan > 0 ? 'text-rose-500' : 'text-emerald-500'}">${tunggakan > 0 ? formatRupiah(tunggakan) : 'LUNAS'}</span>
                    </div>
                    <button class="px-3 py-1 bg-brand-50 text-brand-600 dark:bg-slate-700 dark:text-brand-300 rounded-lg font-semibold hover:bg-brand-100 transition">
                        Buka Buku &rarr;
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function selectStudentForTrx(nis) {
    selectedTrxStudentNis = nis;
    renderStudentSelectionGrid(document.getElementById('search-student-input').value);
    loadStudentTransactionProfile(nis);
    
    const container = document.getElementById('transaksi-active-student-container');
    if (container) container.classList.remove('hidden');
}

function loadStudentTransactionProfile(nis) {
    const siswaList = StorageManager.get('siswa', []);
    const siswa = siswaList.find(s => s.nis === nis);
    if (!siswa) return;

    // Header Card
    document.getElementById('trx-student-name').textContent = siswa.nama;
    document.getElementById('trx-student-info').textContent = `NIS: ${siswa.nis} | NISN: ${siswa.nisn || '-'} | Kelas: ${siswa.kelas} | Jurusan: ${siswa.jurusan}`;
    document.getElementById('trx-student-parents').textContent = `Wali: ${siswa.namaWali} (${siswa.hpWali || '-'})`;
    
    const initials = siswa.nama.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    document.getElementById('trx-student-avatar').textContent = initials;

    const totalTunggakan = calculateStudentTunggakan(nis);
    document.getElementById('trx-student-tunggakan').textContent = formatRupiah(totalTunggakan);

    // Render 12 Months SPP Grid Matrix
    renderSPPMonthsGrid(nis);

    // Render Other Bills (Non-SPP)
    renderOtherBillsList(nis);

    // Render Student History
    renderStudentHistoryTable(nis);
}

function renderSPPMonthsGrid(nis) {
    const grid = document.getElementById('spp-months-grid');
    if (!grid) return;

    const trxList = StorageManager.get('transaksi', []);
    const posList = StorageManager.get('pos', []);
    const posSPP = posList.find(p => p.kode === 'SPP');
    const sppRate = posSPP ? posSPP.tarip : 350000;

    grid.innerHTML = MONTHS_LIST.map(m => {
        // Find if paid for this month
        const paidTrx = trxList.find(t => t.nis === nis && t.posId === 'pos-spp' && t.bulan === m.key);

        if (paidTrx) {
            return `
                <div class="month-card bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3 text-center flex flex-col justify-between">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-xs text-emerald-800 dark:text-emerald-300">${m.name}</span>
                        <i class="fa-solid fa-circle-check text-emerald-500 text-sm"></i>
                    </div>
                    <div class="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold my-1">LUNAS</div>
                    <div class="text-[9px] text-slate-500 dark:text-slate-400">${paidTrx.tanggal}</div>
                    <div class="text-[9px] font-semibold text-emerald-800 dark:text-emerald-300">${formatRupiah(paidTrx.nominal)}</div>
                    <button onclick="reprintKwitansi('${paidTrx.noKwitansi}')" class="mt-2 w-full py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[10px] font-medium transition flex items-center justify-center space-x-1">
                        <i class="fa-solid fa-print"></i>
                        <span>Kwitansi</span>
                    </button>
                </div>
            `;
        } else {
            return `
                <div class="month-card bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3 text-center flex flex-col justify-between hover:border-rose-400 transition">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold text-xs text-slate-800 dark:text-slate-200">${m.name}</span>
                        <i class="fa-solid fa-circle-xmark text-rose-400 text-sm"></i>
                    </div>
                    <div class="text-[10px] text-rose-600 dark:text-rose-400 font-bold my-1">BELUM BAYAR</div>
                    <div class="text-[11px] font-extrabold text-slate-700 dark:text-slate-300">${formatRupiah(sppRate)}</div>
                    <button onclick="openModalBayarSPP('${nis}', '${m.key}', '${m.name}', ${sppRate})" class="mt-2 w-full py-1 bg-brand-600 hover:bg-brand-700 text-white rounded text-[10px] font-semibold shadow-sm transition">
                        Bayar SPP
                    </button>
                </div>
            `;
        }
    }).join('');
}

function renderOtherBillsList(nis) {
    const container = document.getElementById('other-bills-list');
    if (!container) return;

    const trxList = StorageManager.get('transaksi', []);
    const posList = StorageManager.get('pos', []).filter(p => p.kode !== 'SPP');

    container.innerHTML = posList.map(pos => {
        // Calculate total paid for this pos by this student
        const paidTrx = trxList.filter(t => t.nis === nis && t.posId === pos.id);
        const totalPaid = paidTrx.reduce((sum, t) => sum + Number(t.nominal), 0);
        const remaining = Number(pos.tarip) - totalPaid;
        const percent = Math.min(100, Math.round((totalPaid / Number(pos.tarip)) * 100));
        const isLunas = remaining <= 0;

        return `
            <div class="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 space-y-2">
                <div class="flex justify-between items-start">
                    <div>
                        <div class="font-bold text-xs text-slate-800 dark:text-slate-100">${pos.nama}</div>
                        <div class="text-[10px] text-slate-400">${pos.deskripsi}</div>
                    </div>
                    <span class="px-2 py-0.5 text-[10px] font-bold rounded ${isLunas ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'}">
                        ${isLunas ? 'Lunas' : 'Belum Lunas'}
                    </span>
                </div>

                ${pos.tipe === 'bebas' ? `
                    <div class="space-y-1">
                        <div class="flex justify-between text-[10px] font-medium text-slate-500 dark:text-slate-400">
                            <span>Terbayar: ${formatRupiah(totalPaid)}</span>
                            <span>Target: ${formatRupiah(pos.tarip)}</span>
                        </div>
                        <div class="w-full bg-slate-200 dark:bg-slate-600 h-2 rounded-full overflow-hidden">
                            <div class="bg-brand-500 h-full rounded-full" style="width: ${percent}%;"></div>
                        </div>
                    </div>
                ` : `
                    <div class="text-xs font-semibold text-slate-700 dark:text-slate-300">
                        Tagihan: ${formatRupiah(pos.tarip)}
                    </div>
                `}

                ${!isLunas ? `
                    <button onclick="openModalBayarPos('${nis}', '${pos.id}', '${pos.nama}', ${remaining}, '${pos.tipe}')" class="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition flex items-center justify-center space-x-1">
                        <i class="fa-solid fa-plus-circle"></i>
                        <span>${pos.tipe === 'bebas' ? 'Proses Cicilan / Bayar' : 'Bayar Tagihan Ini'}</span>
                    </button>
                ` : `
                    <div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold text-center py-1">
                        <i class="fa-solid fa-check-circle mr-1"></i> Pembayaran Selesai
                    </div>
                `}
            </div>
        `;
    }).join('');
}

function renderStudentHistoryTable(nis) {
    const tbody = document.getElementById('trx-student-history-table');
    if (!tbody) return;

    const trxList = StorageManager.get('transaksi', []).filter(t => t.nis === nis).reverse();

    if (trxList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-slate-400">Belum ada riwayat transaksi pembayaran.</td></tr>`;
        return;
    }

    tbody.innerHTML = trxList.map(t => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
            <td class="p-3 font-mono font-bold text-slate-800 dark:text-slate-100">${t.noKwitansi}</td>
            <td class="p-3">${t.tanggal}</td>
            <td class="p-3 font-semibold text-brand-600 dark:text-brand-400">${t.posNama}</td>
            <td class="p-3 font-bold text-emerald-600 dark:text-emerald-400">${formatRupiah(t.nominal)}</td>
            <td class="p-3"><span class="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded font-medium text-[10px]">${t.metode}</span></td>
            <td class="p-3 text-slate-500">${t.petugas}</td>
            <td class="p-3 text-right space-x-1">
                <button onclick="reprintKwitansi('${t.noKwitansi}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded text-[11px] font-medium transition" title="Cetak Kwitansi">
                    <i class="fa-solid fa-print"></i>
                </button>
                <button onclick="shareKwitansiWhatsApp('${t.noKwitansi}')" class="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded text-[11px] font-medium transition" title="Kirim WA Kwitansi">
                    <i class="fa-brands fa-whatsapp"></i>
                </button>
                ${currentRole === 'superadmin' ? `
                    <button onclick="voidTransaction('${t.noKwitansi}')" class="px-2 py-1 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded text-[11px] font-medium transition" title="Void / Batalkan">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                ` : ''}
            </td>
        </tr>
    `).join('');
}

// 7. PORTAL WALI MURID ENGINE
function renderPortalWaliView() {
    const nis = '20250701'; // Demo Wali Murid Budi Santoso
    const siswaList = StorageManager.get('siswa', []);
    const siswa = siswaList.find(s => s.nis === nis);
    if (!siswa) return;

    document.getElementById('wali-child-name').textContent = siswa.nama;
    document.getElementById('wali-child-detail').textContent = `NIS: ${siswa.nis} | Kelas: ${siswa.kelas} | Wali: ${siswa.namaWali}`;

    const tunggakan = calculateStudentTunggakan(nis);
    document.getElementById('wali-child-tunggakan').textContent = formatRupiah(tunggakan);

    // Calculate overall completion percent
    const posList = StorageManager.get('pos', []);
    const trxList = StorageManager.get('transaksi', []).filter(t => t.nis === nis);
    
    let totalTarget = 350000 * 12; // SPP
    posList.filter(p => p.kode !== 'SPP').forEach(p => totalTarget += Number(p.tarip));
    
    const totalPaid = trxList.reduce((sum, t) => sum + Number(t.nominal), 0);
    const progressPercent = Math.min(100, Math.round((totalPaid / totalTarget) * 100));

    document.getElementById('wali-progress-text').textContent = `${progressPercent}% Lunas`;
    document.getElementById('wali-progress-bar').style.width = `${progressPercent}%`;

    // Unpaid Bills
    const unpaidContainer = document.getElementById('wali-unpaid-bills');
    if (unpaidContainer) {
        // Collect unpaid months & pos
        const posSPP = posList.find(p => p.kode === 'SPP');
        const sppRate = posSPP ? posSPP.tarip : 350000;
        let unpaidItems = [];

        MONTHS_LIST.slice(0, 3).forEach(m => { // First 3 months active
            const paid = trxList.find(t => t.posId === 'pos-spp' && t.bulan === m.key);
            if (!paid) {
                unpaidItems.push({ name: `SPP Bulanan (${m.name})`, amount: sppRate });
            }
        });

        posList.filter(p => p.kode !== 'SPP').forEach(pos => {
            const paidSum = trxList.filter(t => t.posId === pos.id).reduce((s, t) => s + Number(t.nominal), 0);
            const rem = Number(pos.tarip) - paidSum;
            if (rem > 0) {
                unpaidItems.push({ name: pos.nama, amount: rem });
            }
        });

        if (unpaidItems.length === 0) {
            unpaidContainer.innerHTML = `<div class="p-4 text-center text-emerald-500 font-semibold">Alhamdulillah, seluruh tagihan telah LUNAS!</div>`;
        } else {
            unpaidContainer.innerHTML = unpaidItems.map(item => `
                <div class="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600">
                    <div>
                        <div class="font-bold text-xs text-slate-800 dark:text-slate-100">${item.name}</div>
                        <div class="text-[10px] text-rose-500 font-semibold">Jatuh Tempo / Belum Lunas</div>
                    </div>
                    <span class="font-extrabold text-sm text-rose-600 dark:text-rose-400">${formatRupiah(item.amount)}</span>
                </div>
            `).join('');
        }
    }

    // Paid History
    const historyContainer = document.getElementById('wali-paid-history');
    if (historyContainer) {
        if (trxList.length === 0) {
            historyContainer.innerHTML = `<div class="p-4 text-center text-slate-400">Belum ada riwayat pembayaran.</div>`;
        } else {
            historyContainer.innerHTML = trxList.slice(0, 5).reverse().map(t => `
                <div class="flex justify-between items-center p-3 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
                    <div>
                        <div class="font-bold text-xs text-slate-800 dark:text-slate-100">${t.posNama}</div>
                        <div class="text-[10px] text-slate-400">${t.tanggal} | ${t.metode}</div>
                    </div>
                    <div class="text-right">
                        <span class="font-bold text-sm text-emerald-600 dark:text-emerald-400 block">${formatRupiah(t.nominal)}</span>
                        <button onclick="reprintKwitansi('${t.noKwitansi}')" class="text-[10px] text-brand-600 font-semibold hover:underline">Download Kwitansi</button>
                    </div>
                </div>
            `).join('');
        }
    }
}

// 8. PAYMENT PROCESS & MODALS LOGIC
function openModalBayarSPP(nis, bulanKey, bulanNama, nominal) {
    const siswaList = StorageManager.get('siswa', []);
    const siswa = siswaList.find(s => s.nis === nis);
    if (!siswa) return;

    const noKwitansi = generateNoKwitansi();

    Swal.fire({
        title: 'Konfirmasi Pembayaran SPP',
        html: `
            <div class="text-left text-xs space-y-3 p-2">
                <div class="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <div class="font-bold text-sm text-slate-800 dark:text-slate-100">${siswa.nama}</div>
                    <div class="text-slate-500">NIS: ${siswa.nis} | Kelas: ${siswa.kelas}</div>
                </div>
                <div>
                    <label class="block font-semibold mb-1">Pos Pembayaran:</label>
                    <input type="text" value="SPP Bulanan (${bulanNama})" readonly class="w-full p-2 bg-slate-100 dark:bg-slate-700 border rounded font-semibold text-slate-800 dark:text-slate-100">
                </div>
                <div>
                    <label class="block font-semibold mb-1">Nominal (Rp):</label>
                    <input type="number" id="swal-nominal" value="${nominal}" class="w-full p-2 border rounded font-bold text-brand-600">
                </div>
                <div>
                    <label class="block font-semibold mb-1">Metode Pembayaran:</label>
                    <select id="swal-metode" class="w-full p-2 border rounded">
                        <option value="Tunai">Tunai / Cash</option>
                        <option value="Transfer Bank">Transfer Bank (BSI)</option>
                        <option value="QRIS">QRIS / E-Wallet</option>
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">Catatan / Keterangan:</label>
                    <input type="text" id="swal-catatan" value="SPP Bulan ${bulanNama}" class="w-full p-2 border rounded">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-print mr-1"></i> Proses & Cetak Kwitansi',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#0284c7',
        preConfirm: () => {
            const nom = document.getElementById('swal-nominal').value;
            const met = document.getElementById('swal-metode').value;
            const cat = document.getElementById('swal-catatan').value;
            if (!nom || nom <= 0) {
                Swal.showValidationMessage('Nominal harus lebih dari 0');
                return false;
            }
            return { nominal: Number(nom), metode: met, catatan: cat };
        }
    }).then((res) => {
        if (res.isConfirmed) {
            executePayment({
                noKwitansi,
                nis,
                tanggal: new Date().toISOString().split('T')[0],
                posId: 'pos-spp',
                posNama: `SPP Bulanan (${bulanNama})`,
                bulan: bulanKey,
                nominal: res.value.nominal,
                metode: res.value.metode,
                petugas: getPetugasName(),
                catatan: res.value.catatan
            });
        }
    });
}

function openModalBayarPos(nis, posId, posNama, maxNominal, tipe) {
    const siswaList = StorageManager.get('siswa', []);
    const siswa = siswaList.find(s => s.nis === nis);
    if (!siswa) return;

    const noKwitansi = generateNoKwitansi();
    const defaultNominal = tipe === 'bebas' ? Math.min(1000000, maxNominal) : maxNominal;

    Swal.fire({
        title: `Pembayaran ${posNama}`,
        html: `
            <div class="text-left text-xs space-y-3 p-2">
                <div class="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                    <div class="font-bold text-sm text-slate-800 dark:text-slate-100">${siswa.nama}</div>
                    <div class="text-slate-500">NIS: ${siswa.nis} | Kelas: ${siswa.kelas}</div>
                </div>
                <div>
                    <label class="block font-semibold mb-1">Nominal Pembayaran / Cicilan (Rp):</label>
                    <input type="number" id="swal-nominal" value="${defaultNominal}" max="${maxNominal}" class="w-full p-2 border rounded font-bold text-brand-600">
                    <span class="text-[10px] text-slate-400">Sisa Tagihan Maksimal: ${formatRupiah(maxNominal)}</span>
                </div>
                <div>
                    <label class="block font-semibold mb-1">Metode Pembayaran:</label>
                    <select id="swal-metode" class="w-full p-2 border rounded">
                        <option value="Tunai">Tunai / Cash</option>
                        <option value="Transfer Bank">Transfer Bank (BSI)</option>
                        <option value="QRIS">QRIS / E-Wallet</option>
                    </select>
                </div>
                <div>
                    <label class="block font-semibold mb-1">Catatan:</label>
                    <input type="text" id="swal-catatan" value="Pembayaran ${posNama}" class="w-full p-2 border rounded">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-print mr-1"></i> Proses & Cetak Kwitansi',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#0284c7',
        preConfirm: () => {
            const nom = document.getElementById('swal-nominal').value;
            const met = document.getElementById('swal-metode').value;
            const cat = document.getElementById('swal-catatan').value;
            if (!nom || nom <= 0) {
                Swal.showValidationMessage('Nominal harus lebih dari 0');
                return false;
            }
            return { nominal: Number(nom), metode: met, catatan: cat };
        }
    }).then((res) => {
        if (res.isConfirmed) {
            executePayment({
                noKwitansi,
                nis,
                tanggal: new Date().toISOString().split('T')[0],
                posId,
                posNama: tipe === 'bebas' ? `${posNama} (Cicilan)` : posNama,
                bulan: null,
                nominal: res.value.nominal,
                metode: res.value.metode,
                petugas: getPetugasName(),
                catatan: res.value.catatan
            });
        }
    });
}

function executePayment(trxObj) {
    const trxList = StorageManager.get('transaksi', []);
    trxList.push(trxObj);
    StorageManager.set('transaksi', trxList);

    // Log Audit
    addAuditLog('Proses Pembayaran', `KW: ${trxObj.noKwitansi} - ${trxObj.posNama} Rp ${trxObj.nominal} (NIS: ${trxObj.nis})`);

    // Reload UI
    loadStudentTransactionProfile(trxObj.nis);
    renderDashboard();

    // Show Kwitansi Printable Modal
    reprintKwitansi(trxObj.noKwitansi);
}

function generateNoKwitansi() {
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randNum = Math.floor(100 + Math.random() * 900);
    return `KW-${dateStr}-${randNum}`;
}

function getPetugasName() {
    if (currentRole === 'superadmin') return 'Super Admin';
    if (currentRole === 'adminkeu') return 'Siti Rahmawati';
    return 'Petugas Keuangan';
}

function voidTransaction(noKwitansi) {
    Swal.fire({
        title: 'Batalkan Transaksi Ini?',
        text: `Nomor Kwitansi: ${noKwitansi} akan dihapus dari sistem!`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonText: 'Batal',
        confirmButtonText: 'Ya, Batalkan (Void)'
    }).then((res) => {
        if (res.isConfirmed) {
            let trxList = StorageManager.get('transaksi', []);
            trxList = trxList.filter(t => t.noKwitansi !== noKwitansi);
            StorageManager.set('transaksi', trxList);

            addAuditLog('Pembatalan Transaksi', `Kwitansi ${noKwitansi} telah dibatalkan / void.`);
            loadStudentTransactionProfile(selectedTrxStudentNis);
            renderDashboard();

            Swal.fire('Terhapus!', 'Transaksi telah dibatalkan.', 'success');
        }
    });
}

// 9. PRINT RECEIPT (KWITANSI) & SLIP TAGIHAN MODALS
function reprintKwitansi(noKwitansi) {
    const trxList = StorageManager.get('transaksi', []);
    const trx = trxList.find(t => t.noKwitansi === noKwitansi);
    if (!trx) return;

    const siswaList = StorageManager.get('siswa', []);
    const siswa = siswaList.find(s => s.nis === trx.nis) || { nama: '-', nis: '-', kelas: '-' };
    const settings = StorageManager.get('settings', DEFAULT_SETTINGS);

    const terbilangTxt = terbilangRupiah(trx.nominal);

    const modalHtml = `
        <div id="printable-receipt" class="p-6 bg-white text-slate-800 max-w-2xl mx-auto rounded-2xl border border-slate-300 shadow-xl font-sans">
            <!-- Header Kop Surat -->
            <div class="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-xl bg-slate-900 text-white font-bold text-2xl flex items-center justify-center">
                        <i class="fa-solid fa-school"></i>
                    </div>
                    <div>
                        <h2 class="font-black text-lg text-slate-900 leading-tight uppercase">${settings.schoolName}</h2>
                        <p class="text-xs text-slate-600">${settings.schoolAddress}</p>
                        <p class="text-[10px] text-slate-500">Telp: ${settings.schoolPhone} | Email: ${settings.schoolEmail}</p>
                    </div>
                </div>
                <div class="text-right">
                    <span class="px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded">KWITANSI PEMBAYARAN</span>
                    <div class="text-xs font-mono font-bold mt-1 text-slate-700">${trx.noKwitansi}</div>
                    <div class="text-[10px] text-slate-500">${trx.tanggal}</div>
                </div>
            </div>

            <!-- Detail Kwitansi Body -->
            <table class="w-full text-xs mb-4 border-collapse">
                <tbody>
                    <tr class="border-b border-slate-100">
                        <td class="py-2 font-semibold text-slate-500 w-32">Telah Diterima Dari</td>
                        <td class="py-2 font-bold text-slate-900">: ${siswa.nama} (NIS: ${siswa.nis})</td>
                    </tr>
                    <tr class="border-b border-slate-100">
                        <td class="py-2 font-semibold text-slate-500">Kelas / Jurusan</td>
                        <td class="py-2 font-semibold text-slate-800">: ${siswa.kelas} (${siswa.jurusan || 'Reguler'})</td>
                    </tr>
                    <tr class="border-b border-slate-100">
                        <td class="py-2 font-semibold text-slate-500">Untuk Pembayaran</td>
                        <td class="py-2 font-bold text-brand-700">: ${trx.posNama}</td>
                    </tr>
                    <tr class="border-b border-slate-100">
                        <td class="py-2 font-semibold text-slate-500">Metode & Catatan</td>
                        <td class="py-2 text-slate-700">: ${trx.metode} (${trx.catatan || '-'})</td>
                    </tr>
                    <tr class="bg-slate-50">
                        <td class="py-3 px-2 font-semibold text-slate-500">Jumlah Uang</td>
                        <td class="py-3 px-2 font-black text-xl text-emerald-700">: ${formatRupiah(trx.nominal)}</td>
                    </tr>
                    <tr class="bg-slate-50">
                        <td class="py-2 px-2 font-semibold text-slate-500">Terbilang</td>
                        <td class="py-2 px-2 italic font-semibold text-slate-800">: "${terbilangTxt}"</td>
                    </tr>
                </tbody>
            </table>

            <!-- Signatures Footer -->
            <div class="grid grid-cols-2 gap-8 text-center text-xs mt-8 pt-4 border-t border-slate-200">
                <div>
                    <p class="text-slate-500 mb-12">Penyetor / Wali Murid,</p>
                    <p class="font-bold text-slate-900 border-b border-slate-400 inline-block px-4 pb-0.5">${siswa.namaWali || 'Wali Murid'}</p>
                </div>
                <div>
                    <p class="text-slate-500 mb-12">Cirebon, ${trx.tanggal}<br>Bendahara / Admin Keuangan,</p>
                    <p class="font-bold text-slate-900 border-b border-slate-400 inline-block px-4 pb-0.5">${settings.treasurerName}</p>
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        html: modalHtml,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-print"></i> Cetak Kwitansi',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#0284c7'
    }).then((res) => {
        if (res.isConfirmed) {
            window.print();
        }
    });
}

function openModalInvoiceTagihan(nis) {
    const siswaList = StorageManager.get('siswa', []);
    const siswa = siswaList.find(s => s.nis === nis);
    if (!siswa) return;

    const settings = StorageManager.get('settings', DEFAULT_SETTINGS);
    const posList = StorageManager.get('pos', []);
    const trxList = StorageManager.get('transaksi', []).filter(t => t.nis === nis);

    let rowsHtml = '';
    let totalTunggakan = 0;

    // SPP
    const posSPP = posList.find(p => p.kode === 'SPP');
    const sppRate = posSPP ? posSPP.tarip : 350000;
    MONTHS_LIST.slice(0, 3).forEach(m => {
        const paid = trxList.find(t => t.posId === 'pos-spp' && t.bulan === m.key);
        if (!paid) {
            totalTunggakan += sppRate;
            rowsHtml += `
                <tr class="border-b border-slate-100">
                    <td class="py-2 px-3">SPP Bulanan (${m.name})</td>
                    <td class="py-2 px-3 text-center"><span class="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded">Belum Lunas</span></td>
                    <td class="py-2 px-3 text-right font-bold text-rose-600">${formatRupiah(sppRate)}</td>
                </tr>
            `;
        }
    });

    // Other Pos
    posList.filter(p => p.kode !== 'SPP').forEach(pos => {
        const paidSum = trxList.filter(t => t.posId === pos.id).reduce((s, t) => s + Number(t.nominal), 0);
        const rem = Number(pos.tarip) - paidSum;
        if (rem > 0) {
            totalTunggakan += rem;
            rowsHtml += `
                <tr class="border-b border-slate-100">
                    <td class="py-2 px-3">${pos.nama} ${pos.tipe === 'bebas' ? '(Sisa Cicilan)' : ''}</td>
                    <td class="py-2 px-3 text-center"><span class="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold rounded">Belum Lunas</span></td>
                    <td class="py-2 px-3 text-right font-bold text-rose-600">${formatRupiah(rem)}</td>
                </tr>
            `;
        }
    });

    const modalHtml = `
        <div id="printable-invoice" class="p-6 bg-white text-slate-800 max-w-2xl mx-auto rounded-2xl border border-slate-300 shadow-xl font-sans">
            <!-- Kop -->
            <div class="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-4">
                <div>
                    <h2 class="font-black text-lg text-slate-900 leading-tight uppercase">${settings.schoolName}</h2>
                    <p class="text-xs text-slate-600">${settings.schoolAddress}</p>
                </div>
                <div class="text-right">
                    <span class="px-3 py-1 bg-amber-500 text-white text-xs font-bold rounded">RINCIAN TAGIHAN</span>
                    <div class="text-[10px] text-slate-500 mt-1">Per Tanggal: ${new Date().toISOString().split('T')[0]}</div>
                </div>
            </div>

            <!-- Student Info -->
            <div class="p-3 bg-slate-50 rounded-xl mb-4 text-xs grid grid-cols-2 gap-2">
                <div><strong>Nama Siswa:</strong> ${siswa.nama}</div>
                <div><strong>NIS / NISN:</strong> ${siswa.nis} / ${siswa.nisn || '-'}</div>
                <div><strong>Kelas:</strong> ${siswa.kelas}</div>
                <div><strong>Nama Wali:</strong> ${siswa.namaWali} (${siswa.hpWali || '-'})</div>
            </div>

            <!-- Table Tagihan -->
            <table class="w-full text-xs mb-4 border border-slate-200">
                <thead class="bg-slate-100 font-bold uppercase text-slate-700">
                    <tr>
                        <th class="py-2 px-3 text-left">Pos Pembayaran</th>
                        <th class="py-2 px-3 text-center">Status</th>
                        <th class="py-2 px-3 text-right">Nominal Tagihan</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml || `<tr><td colspan="3" class="py-4 text-center text-emerald-600 font-bold">Semua Tagihan Lunas</td></tr>`}
                </tbody>
                <tfoot class="bg-rose-50 font-bold">
                    <tr>
                        <td colspan="2" class="py-3 px-3 text-right text-rose-900 uppercase">Total Sisa Tunggakan:</td>
                        <td class="py-3 px-3 text-right text-base text-rose-600 font-black">${formatRupiah(totalTunggakan)}</td>
                    </tr>
                </tfoot>
            </table>

            <!-- Bank Transfer Info -->
            <div class="p-3 bg-brand-50 rounded-xl text-xs border border-brand-200 mb-6">
                <div class="font-bold text-brand-900 mb-1"><i class="fa-solid fa-building-columns mr-1"></i> Rekening Pembayaran Resmi:</div>
                <div class="text-brand-800">${settings.bankName}: <strong>${settings.bankAccountNo}</strong> a.n ${settings.bankAccountHolder}</div>
            </div>

            <!-- Signatures -->
            <div class="grid grid-cols-2 gap-8 text-center text-xs pt-4 border-t border-slate-200">
                <div>
                    <p class="text-slate-500 mb-12">Mengetahui,<br>Kepala Sekolah</p>
                    <p class="font-bold text-slate-900 border-b border-slate-400 inline-block px-4 pb-0.5">${settings.principalName}</p>
                </div>
                <div>
                    <p class="text-slate-500 mb-12">Bendahara Sekolah,</p>
                    <p class="font-bold text-slate-900 border-b border-slate-400 inline-block px-4 pb-0.5">${settings.treasurerName}</p>
                </div>
            </div>
        </div>
    `;

    Swal.fire({
        html: modalHtml,
        width: '700px',
        showCancelButton: true,
        confirmButtonText: '<i class="fa-solid fa-print"></i> Cetak Slip Tagihan',
        cancelButtonText: 'Tutup',
        confirmButtonColor: '#0284c7'
    }).then((res) => {
        if (res.isConfirmed) {
            window.print();
        }
    });
}

// 10. WHATSAPP INTEGRATION
function shareTagihanWhatsApp(nis) {
    const siswaList = StorageManager.get('siswa', []);
    const siswa = siswaList.find(s => s.nis === nis);
    if (!siswa) return;

    const settings = StorageManager.get('settings', DEFAULT_SETTINGS);
    const totalTunggakan = calculateStudentTunggakan(nis);

    let phone = siswa.hpWali ? siswa.hpWali.replace(/[^0-9]/g, '') : '';
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    const text = `Assalamu'alaikum Wr. Wb. Yth. Bapak/Ibu Wali dari *${siswa.nama}* (NIS: ${siswa.nis}, Kelas: ${siswa.kelas}).

Berikut rincian informasi tunggakan keuangan siswa di *${settings.schoolName}*:
----------------------------------
*Total Sisa Tunggakan: ${formatRupiah(totalTunggakan)}*
----------------------------------

Pembayaran dapat dilakukan melalui Transfer Bank:
🏦 *${settings.bankName}*
💳 No. Rekening: *${settings.bankAccountNo}*
👤 a.n: *${settings.bankAccountHolder}*

Mohon konfirmasi setelah melakukan transfer. Terima kasih.
Wassalamu'alaikum Wr. Wb.
_${settings.treasurerName} - Keuangan ${settings.schoolName}_`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function shareKwitansiWhatsApp(noKwitansi) {
    const trxList = StorageManager.get('transaksi', []);
    const trx = trxList.find(t => t.noKwitansi === noKwitansi);
    if (!trx) return;

    const siswaList = StorageManager.get('siswa', []);
    const siswa = siswaList.find(s => s.nis === trx.nis) || { nama: '-', nis: '-', kelas: '-' };
    const settings = StorageManager.get('settings', DEFAULT_SETTINGS);

    let phone = siswa.hpWali ? siswa.hpWali.replace(/[^0-9]/g, '') : '';
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    const text = `Assalamu'alaikum Wr. Wb. Yth. Wali Murid *${siswa.nama}*.

Terima kasih, pembayaran sebesar *${formatRupiah(trx.nominal)}* untuk *${trx.posNama}* telah kami terima pada tanggal ${trx.tanggal}.

No. Kwitansi: *${trx.noKwitansi}*
Metode: ${trx.metode}

Salam,
_${settings.treasurerName} - Keuangan ${settings.schoolName}_`;

    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function printRincianTagihan(nis) {
    openModalInvoiceTagihan(nis);
}

// 11. MASTER DATA MANAGEMENT (SISWA, KELAS, TA, POS)
function renderMasterSiswaTable() {
    const tbody = document.getElementById('master-siswa-tbody');
    if (!tbody) return;

    const searchInput = document.getElementById('filter-master-siswa-search');
    const kelasSelect = document.getElementById('filter-master-siswa-kelas');
    const query = searchInput ? searchInput.value.toLowerCase() : '';
    const filterKelas = kelasSelect ? kelasSelect.value : '';

    const siswaList = StorageManager.get('siswa', []);
    const filtered = siswaList.filter(s => {
        const matchStr = s.nama.toLowerCase().includes(query) || s.nis.includes(query);
        const matchKls = !filterKelas || s.kelas === filterKelas;
        return matchStr && matchKls;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-4 text-center text-slate-400">Tidak ada data siswa ditemukan.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition">
            <td class="p-3 pl-5 font-mono font-bold text-slate-800 dark:text-slate-100">${s.nis} / <span class="text-slate-400 font-normal">${s.nisn || '-'}</span></td>
            <td class="p-3 font-semibold text-slate-800 dark:text-slate-100">${s.nama}</td>
            <td class="p-3">${s.gender}</td>
            <td class="p-3"><span class="px-2 py-0.5 bg-brand-50 text-brand-600 dark:bg-slate-700 dark:text-brand-300 font-medium rounded text-[11px]">${s.kelas} (${s.jurusan})</span></td>
            <td class="p-3">${s.namaWali}</td>
            <td class="p-3 font-mono text-[11px]">${s.hpWali || '-'}</td>
            <td class="p-3"><span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">${s.status}</span></td>
            <td class="p-3 pr-5 text-right space-x-1">
                <button onclick="editSiswa('${s.nis}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded text-[11px]" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button onclick="deleteSiswa('${s.nis}')" class="px-2 py-1 bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 text-rose-700 dark:text-rose-300 rounded text-[11px]" title="Hapus"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function openModalAddStudent() {
    const kelasList = StorageManager.get('kelas', []);
    const kelasOptions = kelasList.map(k => `<option value="${k.nama}">${k.nama} (${k.jurusan})</option>`).join('');

    Swal.fire({
        title: 'Tambah Siswa Baru',
        html: `
            <div class="text-left text-xs space-y-3 p-2">
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block font-semibold mb-1">NIS (Nomor Induk):</label>
                        <input type="text" id="swal-nis" placeholder="20250707" class="w-full p-2 border rounded">
                    </div>
                    <div>
                        <label class="block font-semibold mb-1">NISN:</label>
                        <input type="text" id="swal-nisn" placeholder="0081234507" class="w-full p-2 border rounded">
                    </div>
                </div>
                <div>
                    <label class="block font-semibold mb-1">Nama Lengkap Siswa:</label>
                    <input type="text" id="swal-nama" placeholder="Nama Siswa" class="w-full p-2 border rounded font-semibold">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block font-semibold mb-1">Jenis Kelamin:</label>
                        <select id="swal-gender" class="w-full p-2 border rounded">
                            <option value="L">Laki-Laki (L)</option>
                            <option value="P">Perempuan (P)</option>
                        </select>
                    </div>
                    <div>
                        <label class="block font-semibold mb-1">Kelas:</label>
                        <select id="swal-kelas" class="w-full p-2 border rounded">
                            ${kelasOptions}
                        </select>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block font-semibold mb-1">Nama Orang Tua / Wali:</label>
                        <input type="text" id="swal-namawali" placeholder="Nama Wali" class="w-full p-2 border rounded">
                    </div>
                    <div>
                        <label class="block font-semibold mb-1">No HP / WA Wali:</label>
                        <input type="text" id="swal-hpwali" placeholder="081234567890" class="w-full p-2 border rounded">
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Simpan Siswa',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#0284c7',
        preConfirm: () => {
            const nis = document.getElementById('swal-nis').value;
            const nama = document.getElementById('swal-nama').value;
            if (!nis || !nama) {
                Swal.showValidationMessage('NIS dan Nama Siswa wajib diisi!');
                return false;
            }
            return {
                nis,
                nisn: document.getElementById('swal-nisn').value,
                nama,
                gender: document.getElementById('swal-gender').value,
                kelas: document.getElementById('swal-kelas').value,
                jurusan: 'Reguler',
                namaWali: document.getElementById('swal-namawali').value,
                hpWali: document.getElementById('swal-hpwali').value,
                alamat: 'Cirebon',
                status: 'Aktif'
            };
        }
    }).then((res) => {
        if (res.isConfirmed) {
            const siswaList = StorageManager.get('siswa', []);
            siswaList.push(res.value);
            StorageManager.set('siswa', siswaList);

            addAuditLog('Tambah Siswa', `Menambahkan siswa baru: ${res.value.nama} (${res.value.nis})`);
            renderMasterSiswaTable();
            renderDashboard();

            Swal.fire('Berhasil!', 'Data siswa baru telah disimpan.', 'success');
        }
    });
}

function deleteSiswa(nis) {
    Swal.fire({
        title: 'Hapus Siswa Ini?',
        text: 'Data siswa yang dihapus tidak dapat dikembalikan!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        confirmButtonText: 'Ya, Hapus'
    }).then((res) => {
        if (res.isConfirmed) {
            let siswaList = StorageManager.get('siswa', []);
            siswaList = siswaList.filter(s => s.nis !== nis);
            StorageManager.set('siswa', siswaList);

            renderMasterSiswaTable();
            renderDashboard();
            Swal.fire('Terhapus!', 'Data siswa telah dihapus.', 'success');
        }
    });
}

function renderKelasAndTATables() {
    // Kelas Table
    const kelasBody = document.getElementById('kelas-tbody');
    if (kelasBody) {
        const kelasList = StorageManager.get('kelas', []);
        kelasBody.innerHTML = kelasList.map(k => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td class="p-2.5 font-bold text-slate-800 dark:text-slate-100">${k.nama}</td>
                <td class="p-2.5">${k.jurusan}</td>
                <td class="p-2.5">${k.waliKelas}</td>
                <td class="p-2.5 text-right"><button onclick="deleteKelas('${k.id}')" class="text-rose-500 hover:underline">Hapus</button></td>
            </tr>
        `).join('');
    }

    // TA Table
    const taBody = document.getElementById('ta-tbody');
    if (taBody) {
        const taList = StorageManager.get('ta', []);
        taBody.innerHTML = taList.map(t => `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td class="p-2.5 font-bold text-slate-800 dark:text-slate-100">${t.nama}</td>
                <td class="p-2.5"><span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.status === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}">${t.status}</span></td>
                <td class="p-2.5 text-right">${t.status !== 'Aktif' ? `<button onclick="setTAActive('${t.id}')" class="text-brand-600 font-semibold hover:underline">Aktifkan</button>` : 'Aktif'}</td>
            </tr>
        `).join('');
    }
}

function promptAddKelas() {
    Swal.fire({
        title: 'Tambah Kelas Baru',
        html: `
            <input type="text" id="swal-kls-nama" placeholder="Nama Kelas (e.g. VII C)" class="w-full p-2 border rounded mb-2 text-xs">
            <input type="text" id="swal-kls-wali" placeholder="Nama Wali Kelas" class="w-full p-2 border rounded text-xs">
        `,
        showCancelButton: true,
        confirmButtonText: 'Simpan',
        preConfirm: () => {
            const nama = document.getElementById('swal-kls-nama').value;
            const wali = document.getElementById('swal-kls-wali').value;
            if (!nama) return false;
            return { nama, waliKelas: wali || '-' };
        }
    }).then((res) => {
        if (res.isConfirmed) {
            const list = StorageManager.get('kelas', []);
            list.push({ id: 'kls-' + Date.now(), nama: res.value.nama, jurusan: 'Reguler', waliKelas: res.value.waliKelas });
            StorageManager.set('kelas', list);
            renderKelasAndTATables();
        }
    });
}

function promptAddTA() {
    Swal.fire({
        title: 'Tambah Tahun Ajaran',
        input: 'text',
        inputPlaceholder: '2026/2027',
        showCancelButton: true,
        confirmButtonText: 'Simpan'
    }).then((res) => {
        if (res.isConfirmed && res.value) {
            const list = StorageManager.get('ta', []);
            list.push({ id: 'ta-' + Date.now(), nama: res.value, status: 'Rencana' });
            StorageManager.set('ta', list);
            renderKelasAndTATables();
        }
    });
}

function setTAActive(id) {
    let list = StorageManager.get('ta', []);
    list.forEach(t => t.status = (t.id === id ? 'Aktif' : 'Non-Aktif'));
    StorageManager.set('ta', list);

    const activeItem = list.find(t => t.id === id);
    if (activeItem) {
        const settings = StorageManager.get('settings', DEFAULT_SETTINGS);
        settings.activeTA = activeItem.nama;
        StorageManager.set('settings', settings);
        loadSettings();
    }
    renderKelasAndTATables();
}

function renderJenisPembayaranGrid() {
    const container = document.getElementById('jenis-pembayaran-container');
    if (!container) return;

    const posList = StorageManager.get('pos', []);

    container.innerHTML = posList.map(p => `
        <div class="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/80 dark:border-slate-700 p-5 shadow-sm flex flex-col justify-between">
            <div>
                <div class="flex justify-between items-center mb-2">
                    <span class="px-2.5 py-0.5 bg-brand-50 text-brand-600 dark:bg-slate-700 dark:text-brand-300 font-bold rounded text-[10px] uppercase">${p.tipe}</span>
                    <span class="font-mono text-xs font-bold text-slate-400">${p.kode}</span>
                </div>
                <h3 class="font-bold text-slate-800 dark:text-slate-100 text-base mb-1">${p.nama}</h3>
                <p class="text-xs text-slate-500 dark:text-slate-400 mb-3">${p.deskripsi}</p>
                <div class="text-xl font-black text-brand-600 dark:text-brand-400 mb-4">${formatRupiah(p.tarip)}</div>
            </div>
            <div class="flex space-x-2 pt-3 border-t border-slate-100 dark:border-slate-700">
                <button onclick="editPos('${p.id}')" class="flex-1 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg transition">Edit Tarif</button>
                <button onclick="deletePos('${p.id}')" class="px-3 py-1.5 bg-rose-100 dark:bg-rose-950 hover:bg-rose-200 text-rose-700 dark:text-rose-300 text-xs font-semibold rounded-lg transition"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function openModalAddPos() {
    Swal.fire({
        title: 'Tambah Pos Pembayaran Baru',
        html: `
            <div class="text-left text-xs space-y-3 p-2">
                <div>
                    <label class="block font-semibold mb-1">Nama Pos Pembayaran:</label>
                    <input type="text" id="swal-pos-nama" placeholder="e.g. Uang Ekstrakurikuler" class="w-full p-2 border rounded">
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <label class="block font-semibold mb-1">Kode Pos:</label>
                        <input type="text" id="swal-pos-kode" placeholder="EKS" class="w-full p-2 border rounded uppercase">
                    </div>
                    <div>
                        <label class="block font-semibold mb-1">Tipe Pembayaran:</label>
                        <select id="swal-pos-tipe" class="w-full p-2 border rounded">
                            <option value="bulanan">Bulanan (SPP Matrix)</option>
                            <option value="bebas">Bebas (Dapat Dicicil)</option>
                            <option value="tahunan">Tahunan</option>
                            <option value="sekali">Sekali Bayar</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block font-semibold mb-1">Tarif Standar (Nominal Rp):</label>
                    <input type="number" id="swal-pos-tarip" placeholder="250000" class="w-full p-2 border rounded font-bold text-brand-600">
                </div>
                <div>
                    <label class="block font-semibold mb-1">Deskripsi:</label>
                    <input type="text" id="swal-pos-desc" placeholder="Keterangan singkat pos" class="w-full p-2 border rounded">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Simpan Pos',
        cancelButtonText: 'Batal',
        confirmButtonColor: '#0284c7',
        preConfirm: () => {
            const nama = document.getElementById('swal-pos-nama').value;
            const tarip = document.getElementById('swal-pos-tarip').value;
            if (!nama || !tarip) {
                Swal.showValidationMessage('Nama dan Tarif wajib diisi');
                return false;
            }
            return {
                id: 'pos-' + Date.now(),
                kode: document.getElementById('swal-pos-kode').value || 'POS',
                nama,
                tipe: document.getElementById('swal-pos-tipe').value,
                tarip: Number(tarip),
                deskripsi: document.getElementById('swal-pos-desc').value || '-'
            };
        }
    }).then((res) => {
        if (res.isConfirmed) {
            const posList = StorageManager.get('pos', []);
            posList.push(res.value);
            StorageManager.set('pos', posList);
            renderJenisPembayaranGrid();
            renderDashboard();
            Swal.fire('Berhasil!', 'Pos Pembayaran baru telah disimpan.', 'success');
        }
    });
}

function deletePos(id) {
    Swal.fire({
        title: 'Hapus Pos Pembayaran?',
        text: 'Pos ini akan dihapus dari daftar master.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444'
    }).then((res) => {
        if (res.isConfirmed) {
            let list = StorageManager.get('pos', []);
            list = list.filter(p => p.id !== id);
            StorageManager.set('pos', list);
            renderJenisPembayaranGrid();
            renderDashboard();
        }
    });
}

// 12. LAPORAN KEUANGAN & AUDIT LOG
function renderLaporanView() {
    const tbody = document.getElementById('laporan-tbody');
    if (!tbody) return;

    const trxList = StorageManager.get('transaksi', []).reverse();
    const totalPemasukan = trxList.reduce((s, t) => s + Number(t.nominal), 0);

    const totalTrxEl = document.getElementById('lap-stat-total');
    if (totalTrxEl) totalTrxEl.textContent = formatRupiah(totalPemasukan);

    const countTrxEl = document.getElementById('lap-stat-count');
    if (countTrxEl) countTrxEl.textContent = `${trxList.length} Transaksi`;

    const siswaList = StorageManager.get('siswa', []);
    tbody.innerHTML = trxList.map(t => {
        const siswa = siswaList.find(s => s.nis === t.nis) || { nama: '-', kelas: '-' };
        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <td class="p-3 pl-5 font-mono text-xs font-bold text-slate-800 dark:text-slate-100">${t.noKwitansi}</td>
                <td class="p-3 text-xs">${t.tanggal}</td>
                <td class="p-3 text-xs font-semibold text-slate-800 dark:text-slate-100">${siswa.nama} <div class="text-[10px] text-slate-400">NIS: ${t.nis}</div></td>
                <td class="p-3 text-xs">${siswa.kelas}</td>
                <td class="p-3 text-xs font-semibold text-brand-600 dark:text-brand-400">${t.posNama}</td>
                <td class="p-3 text-xs font-bold text-emerald-600 dark:text-emerald-400">${formatRupiah(t.nominal)}</td>
                <td class="p-3 text-xs">${t.metode}</td>
                <td class="p-3 text-xs text-slate-500">${t.petugas}</td>
            </tr>
        `;
    }).join('');
}

function exportLaporanExcel() {
    const trxList = StorageManager.get('transaksi', []);
    let csvContent = "data:text/csv;charset=utf-8,No Kwitansi,Tanggal,NIS,Nama Pos,Nominal,Metode,Petugas\n";
    trxList.forEach(t => {
        csvContent += `"${t.noKwitansi}","${t.tanggal}","${t.nis}","${t.posNama}",${t.nominal},"${t.metode}","${t.petugas}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laporan_Keuangan_SMP_MQ_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function renderAuditLogView() {
    const container = document.getElementById('log-timeline');
    if (!container) return;

    const logs = StorageManager.get('logs', []);

    container.innerHTML = logs.map(l => `
        <div class="flex items-start space-x-4 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <div class="w-10 h-10 rounded-xl bg-brand-50 dark:bg-slate-700 text-brand-600 dark:text-brand-300 flex items-center justify-center font-bold text-base flex-shrink-0">
                <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <div class="flex-1 text-xs">
                <div class="flex justify-between items-center">
                    <span class="font-bold text-slate-800 dark:text-slate-100 text-sm">${l.aksi}</span>
                    <span class="text-[10px] text-slate-400">${l.timestamp}</span>
                </div>
                <div class="text-slate-600 dark:text-slate-300 mt-1">${l.detail}</div>
                <div class="text-[10px] text-slate-400 mt-1">Oleh: ${l.user}</div>
            </div>
        </div>
    `).join('');
}

function addAuditLog(aksi, detail) {
    const logs = StorageManager.get('logs', []);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    logs.unshift({
        timestamp: nowStr,
        user: getPetugasName(),
        aksi,
        detail
    });
    StorageManager.set('logs', logs);
}

// 13. PENGATURAN & APPS SCRIPT CODE VIEW
function renderPengaturanView() {
    const settings = StorageManager.get('settings', DEFAULT_SETTINGS);

    document.getElementById('set-school-name').value = settings.schoolName;
    document.getElementById('set-school-address').value = settings.schoolAddress;
    document.getElementById('set-school-phone').value = settings.schoolPhone;
    document.getElementById('set-school-email').value = settings.schoolEmail;
    document.getElementById('set-principal-name').value = settings.principalName;
    document.getElementById('set-treasurer-name').value = settings.treasurerName;
    document.getElementById('set-bank-name').value = settings.bankName;
    document.getElementById('set-bank-acc').value = settings.bankAccountNo;
    document.getElementById('set-bank-holder').value = settings.bankAccountHolder;
    document.getElementById('set-gas-url').value = settings.gasUrl || '';
}

function saveSettingsForm(e) {
    if (e) e.preventDefault();

    const settings = {
        schoolName: document.getElementById('set-school-name').value,
        schoolAddress: document.getElementById('set-school-address').value,
        schoolPhone: document.getElementById('set-school-phone').value,
        schoolEmail: document.getElementById('set-school-email').value,
        principalName: document.getElementById('set-principal-name').value,
        treasurerName: document.getElementById('set-treasurer-name').value,
        bankName: document.getElementById('set-bank-name').value,
        bankAccountNo: document.getElementById('set-bank-acc').value,
        bankAccountHolder: document.getElementById('set-bank-holder').value,
        activeTA: StorageManager.get('settings', DEFAULT_SETTINGS).activeTA,
        gasUrl: document.getElementById('set-gas-url').value
    };

    StorageManager.set('settings', settings);
    loadSettings();

    Swal.fire('Tersimpan!', 'Pengaturan sekolah telah diperbarui.', 'success');
}

function renderAppsScriptView() {
    const codeContainer = document.getElementById('gas-code-display');
    if (codeContainer && typeof GAS_CODE_TEMPLATE !== 'undefined') {
        codeContainer.textContent = GAS_CODE_TEMPLATE;
    }
}

function copyGasCode() {
    const codeText = document.getElementById('gas-code-display').textContent;
    navigator.clipboard.writeText(codeText).then(() => {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: 'Kode GAS berhasil disalin ke clipboard!',
            showConfirmButton: false,
            timer: 2000
        });
    });
}
