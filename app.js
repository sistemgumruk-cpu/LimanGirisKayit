// Operasyon ve Saha Yönetimi JavaScript Mantığı
let currentTab = 'active'; // 'active' | 'archive' | 'reports'
let vehiclesData = [];
let companiesList = [];
let refreshInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    setupEventListeners();
    await loadCompanies();
    await loadVehicles();
    await updateStats();
    
    // Otomatik Yenileme (Canlı Senkronizasyon - Her 25 saniyede bir)
    refreshInterval = setInterval(() => {
        if (currentTab === 'active') {
            loadVehicles(true);
            updateStats();
        }
    }, 25000);
}

function setupEventListeners() {
    // Arama kutusu (Gecikmeli arama - Debounce)
    let searchTimeout;
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadVehicles();
            }, 300);
        });
    }

    // Firma Filtresi
    const companyFilter = document.getElementById('companyFilter');
    if (companyFilter) {
        companyFilter.addEventListener('change', () => loadVehicles());
    }

    // Tescil Durumu Filtresi
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) {
        statusFilter.addEventListener('change', () => loadVehicles());
    }

    // Rapor Filtreleri Değişimi
    ['reportDateStart', 'reportDateEnd', 'reportCompanyFilter', 'reportStatusFilter'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => loadReports());
        }
    });

    // Formlar
    const editForm = document.getElementById('editVehicleForm');
    if (editForm) {
        editForm.addEventListener('submit', handleEditFormSubmit);
    }

    const newOpForm = document.getElementById('newOpVehicleForm');
    if (newOpForm) {
        newOpForm.addEventListener('submit', handleNewOpVehicleSubmit);
    }

    const adminPassForm = document.getElementById('adminPasswordForm');
    if (adminPassForm) {
        adminPassForm.addEventListener('submit', handleAdminPasswordSubmit);
    }
}

// ==========================================
// SEKME DEĞİŞİMİ
// ==========================================
function switchTab(tab) {
    currentTab = tab;
    
    const activeBtn = document.getElementById('tabActiveBtn');
    const archiveBtn = document.getElementById('tabArchiveBtn');
    const reportsBtn = document.getElementById('tabReportsBtn');
    const listViewSection = document.getElementById('listViewSection');
    const reportsSection = document.getElementById('reportsSection');
    const kpiStatsGrid = document.getElementById('kpiStatsGrid');
    const statusFilterContainer = document.getElementById('statusFilterContainer');
    const archiveExcelBtn = document.getElementById('archiveExcelBtn');

    // Stil sıfırlama
    [activeBtn, archiveBtn, reportsBtn].forEach(btn => {
        btn.className = "py-3 px-4 font-medium border-b-2 border-transparent text-slate-400 hover:text-slate-200 flex items-center gap-2 whitespace-nowrap transition";
    });

    renderTableHeader(tab);

    if (tab === 'active') {
        activeBtn.className = "py-3 px-4 font-semibold border-b-2 border-blue-500 text-blue-400 flex items-center gap-2 whitespace-nowrap transition";
        listViewSection.classList.remove('hidden');
        reportsSection.classList.add('hidden');
        kpiStatsGrid.classList.remove('hidden');
        statusFilterContainer.classList.remove('hidden');
        if (archiveExcelBtn) archiveExcelBtn.classList.add('hidden');
        loadVehicles();
        updateStats();
    } else if (tab === 'archive') {
        archiveBtn.className = "py-3 px-4 font-semibold border-b-2 border-blue-500 text-blue-400 flex items-center gap-2 whitespace-nowrap transition";
        listViewSection.classList.remove('hidden');
        reportsSection.classList.add('hidden');
        kpiStatsGrid.classList.add('hidden');
        statusFilterContainer.classList.add('hidden');
        if (archiveExcelBtn) archiveExcelBtn.classList.remove('hidden');
        loadVehicles();
    } else if (tab === 'reports') {
        reportsBtn.className = "py-3 px-4 font-semibold border-b-2 border-emerald-500 text-emerald-400 flex items-center gap-2 whitespace-nowrap transition";
        listViewSection.classList.add('hidden');
        reportsSection.classList.remove('hidden');
        if (archiveExcelBtn) archiveExcelBtn.classList.add('hidden');
        // Raporları yükle
        setReportDateRange('today', false);
        loadReports();
    }
    lucide.createIcons();
}

function renderTableHeader(tab) {
    const thead = document.getElementById('vehicleTableHeader');
    if (!thead) return;

    if (tab === 'archive') {
        thead.innerHTML = `
            <tr id="vehicleTableHeaderRow" class="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                <th class="py-3 px-4">Plakalar</th>
                <th class="py-3 px-4">Alıcı Firma</th>
                <th class="py-3 px-4">Varış / Kayıt</th>
                <th class="py-3 px-4">Boşaltma Depo</th>
                <th class="py-3 px-4 text-center">Net (kg)</th>
                <th class="py-3 px-4 text-center">Brüt (kg)</th>
                <th class="py-3 px-4 text-center">Kantar (kg)</th>
                <th class="py-3 px-4 text-center">Kap Adedi</th>
                <th class="py-3 px-4 text-center">Boşaltma Miktarı</th>
                <th class="py-3 px-4 text-center">Evrak / Not</th>
                <th class="py-3 px-4 text-right">Aksiyonlar</th>
            </tr>
        `;
    } else {
        thead.innerHTML = `
            <tr id="vehicleTableHeaderRow" class="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase font-semibold">
                <th class="py-3 px-4">Plakalar</th>
                <th class="py-3 px-4">Alıcı Firma</th>
                <th class="py-3 px-4">Varış / Kayıt</th>
                <th class="py-3 px-4">Boşaltma Depo</th>
                <th class="py-3 px-4 text-center">Liman Giriş Onayı</th>
                <th class="py-3 px-4 text-center">Tescil Durumu</th>
                <th class="py-3 px-4 text-center">Boşaltma Giriş</th>
                <th class="py-3 px-4 text-center">Evrak / Yük</th>
                <th class="py-3 px-4 text-right">Aksiyonlar</th>
            </tr>
        `;
    }
}

// ==========================================
// VERİ YÜKLEME (ARAÇLAR & İSTATİSTİKLER)
// ==========================================
async function loadCompanies() {
    try {
        const res = await fetch('/api/companies');
        const data = await res.json();
        if (data.success) {
            companiesList = data.companies;
            populateCompanyDropdowns();
        }
    } catch (err) {
        console.error('Firma listesi alınamadı:', err);
    }
}

function populateCompanyDropdowns() {
    const filters = ['companyFilter', 'reportCompanyFilter'];
    filters.forEach(id => {
        const sel = document.getElementById(id);
        if (!sel) return;
        const currentVal = sel.value;
        sel.innerHTML = '<option value="">Tüm Alıcı Firmalar</option>';
        companiesList.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            sel.appendChild(opt);
        });
        sel.value = currentVal;
    });
}

async function updateStats() {
    try {
        const res = await fetch('/api/stats');
        const data = await res.json();
        if (data.success) {
            const s = data.stats;
            document.getElementById('statTotalWaiting').textContent = s.total_waiting;
            document.getElementById('statTescilWaiting').textContent = s.tescil_waiting;
            document.getElementById('statRegisteredReady').textContent = s.registered_ready;
            document.getElementById('statUnloadedToday').textContent = s.unloaded_today;
            document.getElementById('badgeActiveCount').textContent = s.total_waiting;
        }
    } catch (err) {
        console.error('İstatistik yüklenemedi:', err);
    }
}

async function loadVehicles(isBackground = false) {
    const tableBody = document.getElementById('vehicleTableBody');
    const mobileContainer = document.getElementById('mobileCardsContainer');
    const emptyState = document.getElementById('emptyState');
    const tableWrapper = document.getElementById('tableWrapper');
    const loadingIndicator = document.getElementById('loadingIndicator');

    if (!isBackground) {
        loadingIndicator.classList.remove('hidden');
        emptyState.classList.add('hidden');
    }

    const search = document.getElementById('searchInput').value.trim();
    const company = document.getElementById('companyFilter').value;
    const status = document.getElementById('statusFilter') ? document.getElementById('statusFilter').value : '';

    let url = '/api/vehicles?';
    if (currentTab === 'active') {
        url += 'is_active=true&';
        if (status) url += `status=${encodeURIComponent(status)}&`;
    } else {
        url += 'status=BOSALTILDI&';
    }

    if (company) url += `company=${encodeURIComponent(company)}&`;
    if (search) url += `search=${encodeURIComponent(search)}&`;

    try {
        const res = await fetch(url);
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        const data = await res.json();
        loadingIndicator.classList.add('hidden');

        if (data.success) {
            vehiclesData = data.vehicles;
            updateLastRefreshTime();

            if (vehiclesData.length === 0) {
                tableBody.innerHTML = '';
                mobileContainer.innerHTML = '';
                emptyState.classList.remove('hidden');
                tableWrapper.classList.add('hidden');
            } else {
                emptyState.classList.add('hidden');
                tableWrapper.classList.remove('hidden');
                renderDesktopTable(vehiclesData);
                renderMobileCards(vehiclesData);
            }
        }
    } catch (err) {
        console.error('Araçlar getirilemedi:', err);
        loadingIndicator.classList.add('hidden');
    }
    lucide.createIcons();
}

function updateLastRefreshTime() {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    const el = document.getElementById('lastRefreshTime');
    if (el) el.textContent = `Son Güncelleme: ${timeStr}`;
}

// ==========================================
// MASAÜSTÜ TABLO ÇİZİMİ
// ==========================================
function renderDesktopTable(vehicles) {
    const tbody = document.getElementById('vehicleTableBody');
    tbody.innerHTML = '';

    vehicles.forEach(v => {
        const tr = document.createElement('tr');
        tr.className = `hover:bg-slate-50/80 transition ${v.is_unloaded ? 'bg-emerald-50/30' : ''}`;

        // Varış Tarihi ve Sisteme Giriş Tarihi Biçimlendirme
        const arrivalFormatted = v.arrival_date ? v.arrival_date.replace('T', ' ') : '-';
        const createdFormatted = v.created_at ? v.created_at.substring(0, 16).replace('T', ' ') : '-';

        // 3 Günlük Mükerrer Plaka Uyarısı
        const duplicateHtml = v.is_duplicate_3days ? `
            <div class="mt-1">
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-xs cursor-help"
                      title="DİKKAT: Bu plakadan son 3 gün içerisinde mükerrer kayıt girilmiştir! (Diğer kayıt: ${v.duplicate_other_date ? v.duplicate_other_date.substring(0, 16).replace('T', ' ') : ''})">
                    <i data-lucide="alert-triangle" class="w-3 h-3 text-amber-600 animate-pulse"></i>
                    <span>3 Günde Mükerrer</span>
                </span>
            </div>
        ` : '';

        const importantNoteHtml = v.important_notes ? `
            <div class="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <i data-lucide="alert-circle" class="w-3 h-3 text-amber-600 shrink-0"></i>
                <span class="truncate max-w-[180px]" title="${v.important_notes}">${v.important_notes}</span>
            </div>
        ` : '';

        const photoBtnHtml = v.document_photo ? `
            <div class="mt-1">
                <button onclick="viewDocumentPhoto('${v.document_photo}', '${v.tractor_plate}')" 
                    class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 transition shadow-sm" title="Taşıma Belgesi Fotoğrafını İncele">
                    <i data-lucide="camera" class="w-3 h-3 text-amber-700"></i> Belge Foto
                </button>
            </div>
        ` : '';

        // Depo / Rampa No Alanı
        const dockHtml = v.dock_number 
            ? `<button onclick="openDockModal(${v.id}, '${v.tractor_plate}', '${v.dock_number}')" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition">
                 <i data-lucide="warehouse" class="w-3.5 h-3.5"></i> ${v.dock_number}
               </button>`
            : `<button onclick="openDockModal(${v.id}, '${v.tractor_plate}', '')" class="text-xs text-slate-400 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-500 rounded-lg px-2 py-1 transition flex items-center gap-1">
                 <i data-lucide="plus" class="w-3 h-3"></i> Depo Ata
               </button>`;

        if (currentTab === 'archive') {
            // ====================================================
            // BOŞALTILAN ARŞİV GÖRÜNÜMÜ:
            // Plakalar - Alıcı Firma - Varış / Kayıt - Boşaltma Depo - Net - Brüt - Kap adedi - Boşaltma miktarı - Evrak / Not - Aksiyonlar
            // ====================================================
            const netWeightFormatted = (v.net_weight !== null && v.net_weight !== undefined && v.net_weight !== '')
                ? `<span class="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">${Number(v.net_weight).toLocaleString('tr-TR')} kg</span>`
                : `<span class="text-slate-300 font-mono">-</span>`;

            const grossWeightFormatted = (v.gross_weight !== null && v.gross_weight !== undefined && v.gross_weight !== '')
                ? `<span class="text-slate-700 font-medium">${Number(v.gross_weight).toLocaleString('tr-TR')} kg</span>`
                : `<span class="text-slate-300 font-mono">-</span>`;

            const kantarWeightFormatted = (v.kantar_weight !== null && v.kantar_weight !== undefined && v.kantar_weight !== '')
                ? `<span class="font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">${Number(v.kantar_weight).toLocaleString('tr-TR')} kg</span>`
                : `<span class="text-slate-300 font-mono">-</span>`;

            const packageFormatted = (v.package_count !== null && v.package_count !== undefined && v.package_count !== '')
                ? `<span class="text-slate-700 font-semibold">${v.package_count} kap</span>`
                : `<span class="text-slate-300 font-mono">-</span>`;

            const unloadAmountFormatted = `
                <div>
                    <span class="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-600"></i> ${v.unloaded_amount || 'Giriş Yapıldı'}
                    </span>
                    <div class="text-[11px] text-slate-400 mt-0.5">${v.unloaded_at ? v.unloaded_at.split(' ')[1] : ''}</div>
                </div>
            `;

            const docNoteParts = [];
            if (v.customs_doc_no) docNoteParts.push(`<span class="font-mono text-slate-600">${v.customs_doc_no}</span>`);
            if (v.unloaded_note) docNoteParts.push(`<div class="text-[11px] text-slate-500 italic mt-0.5 truncate max-w-[140px]" title="${v.unloaded_note}">Not: ${v.unloaded_note}</div>`);
            const docNoteHtml = docNoteParts.length > 0 ? docNoteParts.join('') : '<span class="text-slate-300 font-mono">-</span>';

            tr.innerHTML = `
                <td class="py-3 px-4">
                    <div class="flex flex-col gap-1 items-start">
                        <span class="plate-badge">${v.tractor_plate}</span>
                        <span class="trailer-badge text-[11px]">${v.trailer_plate}</span>
                        ${duplicateHtml}
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="font-semibold text-slate-800">${v.company_name}</span>
                    ${importantNoteHtml}
                </td>
                <td class="py-3 px-4">
                    <div class="text-xs font-semibold text-slate-700">${arrivalFormatted}</div>
                    <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-1" title="Sisteme Giriş Tarihi ve Saati">
                        <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i>
                        <span>Kayıt: ${createdFormatted}</span>
                    </div>
                </td>
                <td class="py-3 px-4">
                    ${dockHtml}
                </td>
                <td class="py-3 px-4 text-center text-xs">
                    ${netWeightFormatted}
                </td>
                <td class="py-3 px-4 text-center text-xs">
                    ${grossWeightFormatted}
                </td>
                <td class="py-3 px-4 text-center text-xs">
                    ${kantarWeightFormatted}
                </td>
                <td class="py-3 px-4 text-center text-xs">
                    ${packageFormatted}
                </td>
                <td class="py-3 px-4 text-center">
                    ${unloadAmountFormatted}
                </td>
                <td class="py-3 px-4 text-center text-xs">
                    ${docNoteHtml}
                    ${photoBtnHtml}
                </td>
                <td class="py-3 px-4 text-right">
                    <div class="inline-flex items-center gap-1">
                        <button onclick="openEditModal(${v.id})" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Düzenle">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteVehicle(${v.id})" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Sil">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            `;
        } else {
            // ====================================================
            // AKTİF SAHA / YOLDAKİLER GÖRÜNÜMÜ
            // ====================================================

            // Liman Giriş Rozeti / Onay Kutusu
            const limanHtml = `
                <label class="relative inline-flex items-center cursor-pointer select-none" title="Liman Giriş Onayı">
                    <input type="checkbox" ${v.is_port_entered ? 'checked' : ''} 
                        onchange="toggleLiman(${v.id}, this.checked)" 
                        class="sr-only peer">
                    <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-600"></div>
                    <span class="ml-2 text-xs font-semibold ${v.is_port_entered ? 'text-cyan-700 font-bold' : 'text-slate-400'}">
                        ${v.is_port_entered ? 'Onaylandı' : 'Bekliyor'}
                    </span>
                </label>
            `;

            // Tescil Rozeti / Onay Kutusu
            const regTimeHtml = v.is_registered && v.registered_at ? `<span class="text-[10px] text-indigo-600 font-mono font-medium block mt-0.5">${v.registered_at.split(' ')[1] || ''}</span>` : '';
            const tescilHtml = `
                <div class="flex flex-col items-center">
                    <label class="relative inline-flex items-center cursor-pointer select-none" title="Tescil Durumu Onayı">
                        <input type="checkbox" ${v.is_registered ? 'checked' : ''} 
                            onchange="toggleTescil(${v.id}, this.checked)" 
                            class="sr-only peer">
                        <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                        <span class="ml-2 text-xs font-semibold ${v.is_registered ? 'text-indigo-700 font-bold' : 'text-slate-400'}">
                            ${v.is_registered ? 'Yapıldı' : 'Bekliyor'}
                        </span>
                    </label>
                    ${regTimeHtml}
                </div>
            `;

            // Boşaltma Giriş Butonu
            const unloadHtml = `
                <button onclick="openUnloadingModal(${v.id}, '${v.tractor_plate}', '${v.dock_number || ''}')"
                    class="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition">
                    <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Boşaltma Giriş
                </button>
            `;

            // Ekstra Yük Bilgileri (Brüt, Kap, T1)
            const extras = [];
            if (v.gross_weight) extras.push(`${v.gross_weight} kg`);
            if (v.package_count) extras.push(`${v.package_count} kap`);
            if (v.customs_doc_no) extras.push(`T1: ${v.customs_doc_no}`);
            const extraText = extras.length > 0 ? extras.join(' • ') : '<span class="text-slate-300">-</span>';

            tr.innerHTML = `
                <td class="py-3 px-4">
                    <div class="flex flex-col gap-1 items-start">
                        <span class="plate-badge">${v.tractor_plate}</span>
                        <span class="trailer-badge text-[11px]">${v.trailer_plate}</span>
                        ${duplicateHtml}
                    </div>
                </td>
                <td class="py-3 px-4">
                    <span class="font-semibold text-slate-800">${v.company_name}</span>
                    ${importantNoteHtml}
                </td>
                <td class="py-3 px-4">
                    <div class="text-xs font-semibold text-slate-700">${arrivalFormatted}</div>
                    <div class="text-[11px] text-slate-400 mt-1 flex items-center gap-1" title="Sisteme Giriş Tarihi ve Saati">
                        <i data-lucide="clock" class="w-3 h-3 text-slate-400"></i>
                        <span>Kayıt: ${createdFormatted}</span>
                    </div>
                </td>
                <td class="py-3 px-4">
                    ${dockHtml}
                </td>
                <td class="py-3 px-4 text-center">
                    ${limanHtml}
                </td>
                <td class="py-3 px-4 text-center">
                    ${tescilHtml}
                </td>
                <td class="py-3 px-4">
                    ${unloadHtml}
                </td>
                <td class="py-3 px-4 text-center text-xs text-slate-600">
                    ${extraText}
                    ${photoBtnHtml}
                </td>
                <td class="py-3 px-4 text-right">
                    <div class="inline-flex items-center gap-1">
                        <button onclick="openEditModal(${v.id})" class="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Düzenle">
                            <i data-lucide="edit-3" class="w-4 h-4"></i>
                        </button>
                        <button onclick="deleteVehicle(${v.id})" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Sil">
                            <i data-lucide="trash-2" class="w-4 h-4"></i>
                        </button>
                    </div>
                </td>
            `;
        }
        tbody.appendChild(tr);
    });
}

// ==========================================
// MOBİL KART GÖRÜNÜMÜ (CEP TELEFONU İÇİN)
// ==========================================
function renderMobileCards(vehicles) {
    const container = document.getElementById('mobileCardsContainer');
    container.innerHTML = '';

    vehicles.forEach(v => {
        const card = document.createElement('div');
        card.className = `vehicle-card bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 ${v.is_unloaded ? 'border-l-4 border-l-emerald-500' : (v.is_registered ? 'border-l-4 border-l-indigo-500' : 'border-l-4 border-l-amber-500')}`;

        const arrivalFormatted = v.arrival_date ? v.arrival_date.replace('T', ' ') : '-';
        const createdFormatted = v.created_at ? v.created_at.substring(0, 16).replace('T', ' ') : '-';

        // Liman Giriş Butonu
        const limanBtnHtml = v.is_unloaded
            ? (v.is_port_entered ? `<span class="text-xs font-bold text-cyan-700 bg-cyan-50 px-2 py-1 rounded-lg">Liman Onaylı</span>` : '')
            : `
                <button onclick="toggleLiman(${v.id}, ${!v.is_port_entered})" 
                    class="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${v.is_port_entered ? 'bg-cyan-100 text-cyan-800 border border-cyan-200' : 'bg-slate-100 text-slate-600 border border-slate-300'}">
                    <i data-lucide="${v.is_port_entered ? 'anchor' : 'circle'}" class="w-3.5 h-3.5 text-cyan-600"></i>
                    <span>${v.is_port_entered ? 'Liman Onay: VERİLDİ' : 'Liman Onay: BEKLİYOR'}</span>
                </button>
            `;

        // Tescil Butonu
        const tescilTime = v.is_registered && v.registered_at ? ` (${v.registered_at.split(' ')[1] || ''})` : '';
        const tescilBtnHtml = v.is_unloaded
            ? `<span class="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg">Tescilli</span>`
            : `
                <button onclick="toggleTescil(${v.id}, ${!v.is_registered})" 
                    class="px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition ${v.is_registered ? 'bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-300'}">
                    <i data-lucide="${v.is_registered ? 'check-circle' : 'circle'}" class="w-3.5 h-3.5 text-indigo-600"></i>
                    <span>${v.is_registered ? 'Tescil: YAPILDI' + tescilTime : 'Tescil: BEKLİYOR'}</span>
                </button>
            `;

        // Depo No
        const dockBtnHtml = v.dock_number
            ? `<button onclick="openDockModal(${v.id}, '${v.tractor_plate}', '${v.dock_number}')" class="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg font-bold text-xs flex items-center gap-1">
                 <i data-lucide="warehouse" class="w-3.5 h-3.5"></i> ${v.dock_number}
               </button>`
            : `<button onclick="openDockModal(${v.id}, '${v.tractor_plate}', '')" class="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-semibold flex items-center gap-1 border border-dashed border-slate-300">
                 <i data-lucide="plus" class="w-3 h-3"></i> Depo Ata
               </button>`;

        // 3 Günlük Mükerrer Plaka Uyarısı (Mobil)
        const duplicateMobileHtml = v.is_duplicate_3days ? `
            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                  title="DİKKAT: Bu plakadan son 3 gün içerisinde mükerrer kayıt girilmiştir! (Diğer kayıt: ${v.duplicate_other_date ? v.duplicate_other_date.substring(0, 16).replace('T', ' ') : ''})">
                <i data-lucide="alert-triangle" class="w-3 h-3 text-amber-600"></i>
                <span>3 Günde Mükerrer</span>
            </span>
        ` : '';

        card.innerHTML = `
            <!-- Kart Üst Başlık -->
            <div class="flex items-start justify-between">
                <div>
                    <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span class="plate-badge text-sm">${v.tractor_plate}</span>
                        <span class="trailer-badge text-xs">${v.trailer_plate}</span>
                        ${duplicateMobileHtml}
                    </div>
                    <h4 class="font-bold text-slate-800 text-sm leading-tight">${v.company_name}</h4>
                </div>
                <div class="flex items-center gap-1">
                    <button onclick="openEditModal(${v.id})" class="p-2 text-slate-400 hover:text-blue-600 rounded-lg">
                        <i data-lucide="edit" class="w-4 h-4"></i>
                    </button>
                    <button onclick="deleteVehicle(${v.id})" class="p-2 text-slate-400 hover:text-red-600 rounded-lg">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>

            <!-- Bilgiler Satırı -->
            ${currentTab === 'archive' ? `
                <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                        <span class="text-slate-400 block text-[10px] uppercase">Varış / Kayıt</span>
                        <span class="font-semibold text-slate-700">${arrivalFormatted}</span>
                        <span class="text-[10px] text-slate-400 block mt-0.5">Kayıt: ${createdFormatted}</span>
                    </div>
                    <div>
                        <span class="text-slate-400 block text-[10px] uppercase">Boşaltma Deposu</span>
                        <div class="mt-0.5">${dockBtnHtml}</div>
                    </div>
                    <div>
                        <span class="text-slate-400 block text-[10px] uppercase">Net Ağırlık</span>
                        <span class="font-bold text-slate-900">${(v.net_weight !== null && v.net_weight !== undefined && v.net_weight !== '') ? Number(v.net_weight).toLocaleString('tr-TR') + ' kg' : '-'}</span>
                    </div>
                    <div>
                        <span class="text-slate-400 block text-[10px] uppercase">Brüt / Kap</span>
                        <span class="font-medium text-slate-700">${(v.gross_weight !== null && v.gross_weight !== undefined && v.gross_weight !== '') ? Number(v.gross_weight).toLocaleString('tr-TR') + ' kg' : '-'} ${(v.package_count ? '(' + v.package_count + ' kap)' : '')}</span>
                    </div>
                    ${(v.kantar_weight !== null && v.kantar_weight !== undefined && v.kantar_weight !== '') ? `
                    <div class="col-span-2 bg-blue-50/70 p-1.5 rounded-lg border border-blue-200/60 flex items-center justify-between">
                        <span class="text-blue-800 font-semibold text-[11px]">Kantar Miktarı:</span>
                        <span class="font-bold text-blue-800 text-xs">${Number(v.kantar_weight).toLocaleString('tr-TR')} kg</span>
                    </div>` : ''}
                    <div class="col-span-2 bg-emerald-50/70 p-1.5 rounded-lg border border-emerald-200/60 flex items-center justify-between">
                        <span class="text-emerald-800 font-semibold text-[11px]">Boşaltma Miktarı:</span>
                        <span class="font-bold text-emerald-700 text-xs">${v.unloaded_amount || 'Giriş Yapıldı'}</span>
                    </div>
                    ${v.customs_doc_no ? `
                    <div class="col-span-2">
                        <span class="text-slate-400 block text-[10px] uppercase">T1 / Karne</span>
                        <span class="font-mono text-slate-700">${v.customs_doc_no}</span>
                    </div>` : ''}
                </div>
            ` : `
                <div class="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div>
                        <span class="text-slate-400 block text-[10px] uppercase">Varış Saati</span>
                        <span class="font-semibold text-slate-700">${arrivalFormatted}</span>
                        <span class="text-[10px] text-slate-400 block mt-0.5" title="Sisteme Kayıt Tarihi">Kayıt: ${createdFormatted}</span>
                    </div>
                    <div>
                        <span class="text-slate-400 block text-[10px] uppercase">Depo / Rampa</span>
                        <div class="mt-0.5">${dockBtnHtml}</div>
                    </div>
                    ${v.gross_weight || v.package_count ? `
                    <div>
                        <span class="text-slate-400 block text-[10px] uppercase">Ağırlık / Kap</span>
                        <span class="font-medium text-slate-700">${v.gross_weight ? v.gross_weight + ' kg' : ''} ${v.package_count ? '(' + v.package_count + ' kap)' : ''}</span>
                    </div>` : ''}
                    ${v.customs_doc_no ? `
                    <div>
                        <span class="text-slate-400 block text-[10px] uppercase">T1 / Karne</span>
                        <span class="font-mono text-slate-700">${v.customs_doc_no}</span>
                    </div>` : ''}
                </div>
            `}

            ${v.important_notes ? `
            <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-2">
                <i data-lucide="alert-triangle" class="w-4 h-4 text-amber-600 shrink-0 mt-0.5"></i>
                <div><strong class="font-bold text-amber-900">Önemli Not:</strong> ${v.important_notes}</div>
            </div>` : ''}

            ${v.document_photo ? `
            <button onclick="viewDocumentPhoto('${v.document_photo}', '${v.tractor_plate}')" 
                class="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition">
                <i data-lucide="camera" class="w-4 h-4 text-amber-700"></i>
                <span>📸 Belge Fotoğrafını İncele (T1 / Karne)</span>
            </button>` : ''}

            <!-- Kart Alt Aksiyonları -->
            <div class="flex flex-wrap items-center justify-between pt-1 gap-2">
                <div class="flex flex-wrap items-center gap-1.5">
                    ${limanBtnHtml}
                    ${tescilBtnHtml}
                </div>
                <div>
                    ${v.is_unloaded ? `
                        <span class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl inline-flex items-center gap-1">
                            <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i> ${v.unloaded_amount || 'Giriş Yapıldı'}
                        </span>
                    ` : `
                        <button onclick="openUnloadingModal(${v.id}, '${v.tractor_plate}', '${v.dock_number || ''}')"
                            class="bg-emerald-600 text-white font-semibold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition">
                            <i data-lucide="check-circle" class="w-4 h-4"></i> Boşaltma Giriş
                        </button>
                    `}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// ==========================================
// AKSİYONLAR: TESCİL, LİMAN, DEPO, BOŞALTMA, DÜZENLEME
// ==========================================

// 1. Tescil Değişimi
async function toggleTescil(id, newState) {
    try {
        const res = await fetch(`/api/vehicles/${id}/tescil`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: newState })
        });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        const data = await res.json();
        if (data.success) {
            showToast(newState ? 'Tescil işlemi onaylandı.' : 'Tescil onayı kaldırıldı.', 'check');
            await loadVehicles(true);
            await updateStats();
        } else {
            showToast(data.message || 'Tescil durumu güncellenemedi!', 'alert-circle', 'bg-red-900');
            await loadVehicles(true);
        }
    } catch (err) {
        console.error('Tescil hatası:', err);
        showToast('Tescil durumu güncellenemedi!', 'alert-circle', 'bg-red-900');
        await loadVehicles(true);
    }
}

// 1.1 Liman Giriş Kaydı Değişimi
async function toggleLiman(id, newState) {
    try {
        const res = await fetch(`/api/vehicles/${id}/liman`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state: newState })
        });
        if (res.status === 401) {
            window.location.href = '/login';
            return;
        }
        const data = await res.json();
        if (data.success) {
            showToast(newState ? 'Liman giriş onayı verildi.' : 'Liman giriş onayı kaldırıldı.', 'anchor');
            await loadVehicles(true);
        } else {
            showToast(data.message || 'Liman giriş onayı güncellenemedi!', 'alert-circle', 'bg-red-900');
            await loadVehicles(true);
        }
    } catch (err) {
        console.error('Liman hatası:', err);
        showToast('Liman giriş onayı güncellenemedi!', 'alert-circle', 'bg-red-900');
        await loadVehicles(true);
    }
}

// 2. Depo / Rampa No Modalı
function openDockModal(id, plate, currentDock) {
    document.getElementById('dockModalVehicleId').value = id;
    document.getElementById('dockModalVehiclePlate').textContent = plate;
    document.getElementById('dockModalInput').value = currentDock || '';
    document.getElementById('dockModal').classList.remove('hidden');
    lucide.createIcons();
}

function setQuickDock(dockName) {
    document.getElementById('dockModalInput').value = dockName;
}

async function saveDockNumber() {
    const id = document.getElementById('dockModalVehicleId').value;
    const dockNumber = document.getElementById('dockModalInput').value.trim();

    try {
        const res = await fetch(`/api/vehicles/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dock_number: dockNumber })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('dockModal');
            showToast('Boşaltma deposu atandı: ' + (dockNumber || 'Temizlendi'));
            await loadVehicles(true);
        }
    } catch (err) {
        showToast('Depo kaydedilemedi!', 'alert-circle', 'bg-red-900');
    }
}

// 3. Boşaltma Modalı
function openUnloadingModal(id, plate, currentDock = '') {
    document.getElementById('unloadingModalVehicleId').value = id;
    document.getElementById('unloadingModalPlate').textContent = plate;
    
    // Araç nesnesini bul ve varsa mevcut net ağırlığı ve kantar miktarını yükle
    const v = vehiclesData.find(x => x.id === id);
    const netEl = document.getElementById('unloadingModalNetWeight');
    if (netEl) {
        netEl.value = (v && v.net_weight !== null && v.net_weight !== undefined) ? v.net_weight : '';
    }
    const kantarEl = document.getElementById('unloadingModalKantarWeight');
    if (kantarEl) {
        kantarEl.value = (v && v.kantar_weight !== null && v.kantar_weight !== undefined) ? v.kantar_weight : '';
    }

    document.getElementById('unloadingModalAmount').value = '';
    document.getElementById('unloadingModalNote').value = '';
    document.getElementById('unloadingModal').classList.remove('hidden');
    lucide.createIcons();
}

async function submitUnloading() {
    const id = document.getElementById('unloadingModalVehicleId').value;
    const amount = document.getElementById('unloadingModalAmount').value.trim() || 'Giriş Yapıldı';
    const note = document.getElementById('unloadingModalNote').value.trim();
    const netEl = document.getElementById('unloadingModalNetWeight');
    const netWeight = netEl ? netEl.value.trim() : '';
    const kantarEl = document.getElementById('unloadingModalKantarWeight');
    const kantarWeight = kantarEl ? kantarEl.value.trim() : '';

    try {
        const res = await fetch(`/api/vehicles/${id}/bosaltma`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unloaded_amount: amount,
                unloaded_note: note,
                net_weight: netWeight ? parseFloat(netWeight) : null,
                kantar_weight: kantarWeight ? parseFloat(kantarWeight) : null
            })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('unloadingModal');
            showToast('Boşaltma girişi başarıyla kaydedildi ve arşive alındı!');
            await loadVehicles();
            await updateStats();
        } else {
            alert(data.message || 'İşlem başarısız');
        }
    } catch (err) {
        showToast('Boşaltma girişi kaydedilemedi!', 'alert-circle', 'bg-red-900');
    }
}

// 4. Detaylı Düzenleme Modalı
async function openEditModal(id) {
    try {
        const res = await fetch(`/api/vehicles/${id}`);
        const data = await res.json();
        if (!data.success) return;
        const v = data.vehicle;

        document.getElementById('editVehicleId').value = v.id;
        document.getElementById('editCreatedAt').textContent = v.created_at ? v.created_at.replace('T', ' ') : '-';
        
        // Mükerrer Kayıt Uyarısı Kontrolü
        const dupWarn = document.getElementById('editDuplicateWarning');
        if (dupWarn) {
            if (v.is_duplicate_3days) {
                const otherDate = v.duplicate_other_date ? v.duplicate_other_date.substring(0, 16).replace('T', ' ') : '';
                document.getElementById('editDuplicateDetail').textContent = `Bu araç plakası (${v.tractor_plate}) için son 3 gün içerisinde başka bir bildirim (${otherDate}) yapılmıştır.`;
                dupWarn.classList.remove('hidden');
            } else {
                dupWarn.classList.add('hidden');
            }
        }

        document.getElementById('editTractor').value = v.tractor_plate || '';
        document.getElementById('editTrailer').value = v.trailer_plate || '';
        document.getElementById('editCompany').value = v.company_name || '';
        document.getElementById('editArrival').value = v.arrival_date || '';
        const editNetEl = document.getElementById('editNetWeight');
        if (editNetEl) editNetEl.value = v.net_weight !== null && v.net_weight !== undefined ? v.net_weight : '';
        const editKantarEl = document.getElementById('editKantarWeight');
        if (editKantarEl) editKantarEl.value = v.kantar_weight !== null && v.kantar_weight !== undefined ? v.kantar_weight : '';
        document.getElementById('editGrossWeight').value = v.gross_weight !== null ? v.gross_weight : '';
        document.getElementById('editPackageCount').value = v.package_count !== null ? v.package_count : '';
        document.getElementById('editCustomsDoc').value = v.customs_doc_no || '';
        document.getElementById('editDockNumber').value = v.dock_number || '';
        document.getElementById('editImportantNotes').value = v.important_notes || '';
        const editRegEl = document.getElementById('editIsRegistered');
        if (editRegEl) {
            editRegEl.value = v.is_registered ? '1' : '0';
        }

        document.getElementById('editModal').classList.remove('hidden');
        lucide.createIcons();
    } catch (err) {
        showToast('Araç detayları alınamadı.', 'alert-circle', 'bg-red-900');
    }
}

async function handleEditFormSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editVehicleId').value;
    const editNetEl = document.getElementById('editNetWeight');
    const editKantarEl = document.getElementById('editKantarWeight');
    const payload = {
        tractor_plate: document.getElementById('editTractor').value.trim(),
        trailer_plate: document.getElementById('editTrailer').value.trim(),
        company_name: document.getElementById('editCompany').value.trim(),
        arrival_date: document.getElementById('editArrival').value.trim(),
        net_weight: editNetEl ? editNetEl.value.trim() : '',
        kantar_weight: editKantarEl ? editKantarEl.value.trim() : '',
        gross_weight: document.getElementById('editGrossWeight').value.trim(),
        package_count: document.getElementById('editPackageCount').value.trim(),
        customs_doc_no: document.getElementById('editCustomsDoc').value.trim(),
        dock_number: document.getElementById('editDockNumber').value.trim(),
        is_registered: parseInt(document.getElementById('editIsRegistered').value) || 0,
        important_notes: document.getElementById('editImportantNotes').value.trim()
    };

    try {
        const res = await fetch(`/api/vehicles/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            closeModal('editModal');
            showToast('Araç bilgileri güncellendi.');
            await loadCompanies();
            await loadVehicles();
        } else {
            alert(data.message || 'Güncelleme başarısız');
        }
    } catch (err) {
        showToast('Kayıt güncellenemedi!', 'alert-circle', 'bg-red-900');
    }
}

// 5. Yeni Araç Ekleme (Operatör tarafından)
function openNewVehicleModal() {
    const form = document.getElementById('newOpVehicleForm');
    form.reset();
    const now = new Date();
    const localIso = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}T${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    document.getElementById('newArrival').value = localIso;
    document.getElementById('newImportantNotes').value = '';
    const newNetEl = document.getElementById('newNetWeight');
    if (newNetEl) newNetEl.value = '';
    const newKantarEl = document.getElementById('newKantarWeight');
    if (newKantarEl) newKantarEl.value = '';
    const newRegEl = document.getElementById('newIsRegistered');
    if (newRegEl) newRegEl.value = '0';
    document.getElementById('newVehicleModal').classList.remove('hidden');
    lucide.createIcons();
}

async function handleNewOpVehicleSubmit(e) {
    e.preventDefault();
    const newNetEl = document.getElementById('newNetWeight');
    const newKantarEl = document.getElementById('newKantarWeight');
    const payload = {
        tractor_plate: document.getElementById('newTractor').value.trim(),
        trailer_plate: document.getElementById('newTrailer').value.trim(),
        company_name: document.getElementById('newCompany').value.trim(),
        arrival_date: document.getElementById('newArrival').value.trim(),
        net_weight: newNetEl ? newNetEl.value.trim() : '',
        kantar_weight: newKantarEl ? newKantarEl.value.trim() : '',
        gross_weight: document.getElementById('newGrossWeight').value.trim(),
        package_count: document.getElementById('newPackageCount').value.trim(),
        customs_doc_no: document.getElementById('newCustomsDoc').value.trim(),
        important_notes: document.getElementById('newImportantNotes').value.trim()
    };

    const dock = document.getElementById('newDockNumber').value.trim();
    const newRegEl = document.getElementById('newIsRegistered');
    const isReg = newRegEl ? parseInt(newRegEl.value) || 0 : 0;

    try {
        const res = await fetch('/api/kayit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            if (data.id && (dock || isReg)) {
                const updates = {};
                if (dock) updates.dock_number = dock;
                if (isReg) updates.is_registered = 1;
                await fetch(`/api/vehicles/${data.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updates)
                });
            }
            closeModal('newVehicleModal');
            showToast('Yeni araç başarıyla eklendi.');
            await loadCompanies();
            await loadVehicles();
            await updateStats();
        } else {
            alert(data.message || 'Ekleme başarısız');
        }
    } catch (err) {
        showToast('Araç eklenemedi!', 'alert-circle', 'bg-red-900');
    }
}

// 5.1 Boşaltılan Arşiv Excel İndirme
function downloadArchiveExcel() {
    const search = document.getElementById('searchInput') ? document.getElementById('searchInput').value.trim() : '';
    const company = document.getElementById('companyFilter') ? document.getElementById('companyFilter').value : '';
    const url = `/api/export/excel?status=BOSALTILDI&company=${encodeURIComponent(company)}&search=${encodeURIComponent(search)}`;
    window.location.href = url;
}

// 6. Şoför Duyurusu / Önemli Notlar Yönetimi
async function openNoticeModal() {
    try {
        const res = await fetch('/api/settings/notice');
        const data = await res.json();
        if (data.success) {
            document.getElementById('noticeModalText').value = data.notice || '';
        }
        document.getElementById('noticeModal').classList.remove('hidden');
        lucide.createIcons();
    } catch (err) {
        showToast('Duyuru bilgisi alınamadı.', 'alert-circle', 'bg-red-900');
    }
}

async function saveDriverNotice() {
    const text = document.getElementById('noticeModalText').value.trim();
    try {
        const res = await fetch('/api/settings/notice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ notice: text })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('noticeModal');
            showToast('Şoförler için önemli not başarıyla güncellendi!');
        }
    } catch (err) {
        showToast('Duyuru kaydedilemedi!', 'alert-circle', 'bg-red-900');
    }
}

// 7. Belge Fotoğrafı Görüntüleme (Lightbox)
function viewDocumentPhoto(photoUrl, plate) {
    if (!photoUrl) return;
    document.getElementById('imageModalPlateTitle').textContent = `Araç: ${plate}`;
    document.getElementById('imageModalImg').src = photoUrl;
    document.getElementById('imageModalDownloadBtn').href = photoUrl;
    document.getElementById('imagePreviewModal').classList.remove('hidden');
    lucide.createIcons();
}

// 8. Araç Silme
async function deleteVehicle(id) {
    if (!confirm('Bu araç kaydını silmek istediğinize emin misiniz?')) {
        return;
    }
    try {
        const res = await fetch(`/api/vehicles/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            showToast('Araç kaydı silindi.');
            await loadVehicles();
            await updateStats();
        }
    } catch (err) {
        showToast('Kayıt silinemedi!', 'alert-circle', 'bg-red-900');
    }
}

// 9. Veritabanı Yönetimi & Yedekleme Merkezi
async function openDbModal() {
    document.getElementById('dbModal').classList.remove('hidden');
    lucide.createIcons();
    await loadDbStatus();
}

async function loadDbStatus() {
    try {
        const res = await fetch('/api/database/status');
        const data = await res.json();
        if (data.success && data.stats) {
            const s = data.stats;
            document.getElementById('dbStatTotal').textContent = `${s.total_vehicles} Araç`;
            document.getElementById('dbStatActive').textContent = `${s.active_vehicles} Adet`;
            document.getElementById('dbStatArchived').textContent = `${s.archived_vehicles} Adet`;
            document.getElementById('dbStatSizes').textContent = `DB: ${s.db_size_human} / Evrak: ${s.upload_size_human} (${s.upload_files_count} Dosya)`;
        }
    } catch (err) {
        console.error('DB durumu alınamadı:', err);
    }
}

function downloadDbBackup() {
    window.location.href = '/api/database/backup/db';
}

function downloadJsonBackup() {
    window.location.href = '/api/database/backup/json';
}

async function handleDbRestore(e) {
    e.preventDefault();
    const fileInput = document.getElementById('dbRestoreFileInput');
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Lütfen yüklenecek bir yedek dosyası seçiniz (.db veya .json).');
        return;
    }
    if (!confirm('DİKKAT: Yedeği geri yüklemek mevcut veritabanı kayıtlarınızı güncelleyecektir. Devam etmek istiyor musunuz?')) {
        return;
    }
    const btn = document.getElementById('dbRestoreBtn');
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Yükleniyor...</span>';
    lucide.createIcons();

    const formData = new FormData();
    formData.append('backup_file', fileInput.files[0]);

    try {
        const res = await fetch('/api/database/restore', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message || 'Yedek başarıyla geri yüklendi!', 'check', 'bg-emerald-900');
            fileInput.value = '';
            await loadDbStatus();
            await loadCompanies();
            await loadVehicles();
            await updateStats();
        } else {
            alert(data.message || 'Geri yükleme başarısız oldu.');
        }
    } catch (err) {
        showToast('Yedek yüklenirken hata oluştu!', 'alert-circle', 'bg-red-900');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>Yedeği Yükle</span>';
        lucide.createIcons();
    }
}

async function cleanupArchivedVehicles() {
    if (!confirm('Sadece arşivdeki (boşaltılmış) araçları ve bu araçlara ait evrak fotoğraflarını kalıcı olarak temizlemek istediğinize emin misiniz?\n\nAktif sahadaki araçlar KORUNACAKTIR.')) {
        return;
    }
    try {
        const res = await fetch('/api/database/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'archive' })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'check', 'bg-slate-900');
            await loadDbStatus();
            await loadCompanies();
            await loadVehicles();
            await updateStats();
        } else {
            alert(data.message || 'İşlem başarısız');
        }
    } catch (err) {
        showToast('Temizlik yapılırken hata oluştu!', 'alert-circle', 'bg-red-900');
    }
}

async function resetAllDatabase() {
    const confirmInput = document.getElementById('dbResetConfirmInput').value.trim().toUpperCase();
    if (confirmInput !== 'SIFIRLA') {
        alert("Lütfen onay kutusuna büyük harflerle 'SIFIRLA' yazınız.");
        return;
    }

    if (!confirm('UYARI: Tüm veritabanı, araç kayıtları ve evrak fotoğrafları TAMAMEN SİLİNECEK ve fabrika ayarlarına dönülecektir!\n\nBu işlem geri alınamaz. Onaylıyor musunuz?')) {
        return;
    }

    try {
        const res = await fetch('/api/database/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'all', confirm_code: confirmInput })
        });
        const data = await res.json();
        if (data.success) {
            showToast(data.message, 'alert-triangle', 'bg-red-950');
            document.getElementById('dbResetConfirmInput').value = '';
            await loadDbStatus();
            await loadCompanies();
            await loadVehicles();
            await updateStats();
        } else {
            alert(data.message || 'Sıfırlama başarısız');
        }
    } catch (err) {
        showToast('Sıfırlama sırasında hata oluştu!', 'alert-circle', 'bg-red-900');
    }
}

// ==========================================
// RAPORLAMA VE EXCEL MODÜLÜ
// ==========================================

function setReportDateRange(type, autoLoad = true) {
    const startEl = document.getElementById('reportDateStart');
    const endEl = document.getElementById('reportDateEnd');
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (type === 'today') {
        startEl.value = todayStr;
        endEl.value = todayStr;
    } else if (type === 'yesterday') {
        const y = new Date();
        y.setDate(y.getDate() - 1);
        const yStr = y.toISOString().split('T')[0];
        startEl.value = yStr;
        endEl.value = yStr;
    } else if (type === 'this_week') {
        const firstDay = new Date(now.setDate(now.getDate() - now.getDay() + 1));
        startEl.value = firstDay.toISOString().split('T')[0];
        endEl.value = new Date().toISOString().split('T')[0];
    } else if (type === 'this_month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        startEl.value = firstDay.toISOString().split('T')[0];
        endEl.value = todayStr;
    } else if (type === 'all') {
        startEl.value = '';
        endEl.value = '';
    }

    if (autoLoad) loadReports();
}

async function loadReports() {
    const dateStart = document.getElementById('reportDateStart').value;
    const dateEnd = document.getElementById('reportDateEnd').value;
    const company = document.getElementById('reportCompanyFilter').value;
    const status = document.getElementById('reportStatusFilter').value;

    let url = `/api/vehicles?date_start=${encodeURIComponent(dateStart)}&date_end=${encodeURIComponent(dateEnd)}&company=${encodeURIComponent(company)}&status=${encodeURIComponent(status)}`;

    try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
            const list = data.vehicles;
            renderReportTable(list);
            calculateReportStats(list);
        }
    } catch (err) {
        console.error('Rapor getirilemedi:', err);
    }
    lucide.createIcons();
}

function calculateReportStats(list) {
    document.getElementById('reportCountTotal').textContent = list.length;
    
    const regCount = list.filter(v => v.is_registered).length;
    document.getElementById('reportCountRegistered').textContent = regCount;

    const unCount = list.filter(v => v.is_unloaded).length;
    document.getElementById('reportCountUnloaded').textContent = unCount;

    // Toplam kap veya tonaj özeti
    let totalCap = 0;
    list.forEach(v => {
        if (v.package_count) totalCap += v.package_count;
    });
    document.getElementById('reportCountQuantity').textContent = totalCap > 0 ? `${totalCap} Kap` : `${list.length} Araç`;
}

function renderReportTable(list) {
    const tbody = document.getElementById('reportTableBody');
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center py-8 text-slate-400">Seçilen filtrelere uyan rapor kaydı bulunamadı.</td></tr>`;
        return;
    }

    list.forEach(v => {
        const tr = document.createElement('tr');
        tr.className = `hover:bg-slate-50 transition ${v.is_unloaded ? 'bg-emerald-50/40' : ''}`;

        const createdFormatted = v.created_at ? v.created_at.substring(0, 16).replace('T', ' ') : '-';

        const limanBadge = v.is_port_entered
            ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-100 text-cyan-800">Girildi (${v.port_entered_at ? v.port_entered_at.split(' ')[1] : ''})</span>`
            : `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">Bekliyor</span>`;

        const tescilBadge = v.is_registered
            ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">Yapıldı (${v.registered_at ? v.registered_at.split(' ')[1] : ''})</span>`
            : `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">Bekliyor</span>`;

        const bosaltmaBadge = v.is_unloaded
            ? `<span class="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">Boşaltıldı (${v.unloaded_amount || '-'})</span>`
            : `<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-100 text-amber-800">Sırada / Bekliyor</span>`;

        const duplicateReportBadge = v.is_duplicate_3days ? `
            <div class="mt-0.5">
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title="Son 3 günde mükerrer kayıt">
                    <i data-lucide="alert-triangle" class="w-3 h-3 text-amber-600"></i> Mükerrer (3 Gün)
                </span>
            </div>
        ` : '';

        tr.innerHTML = `
            <td class="py-3 px-4">
                <div class="font-bold text-slate-800 font-mono text-xs">${v.tractor_plate}</div>
                <div class="text-[11px] text-slate-400 font-mono">${v.trailer_plate}</div>
                ${duplicateReportBadge}
            </td>
            <td class="py-3 px-4">
                <span class="font-semibold text-slate-800 text-xs">${v.company_name}</span>
                ${v.important_notes ? `<div class="text-[11px] text-amber-800 font-medium mt-0.5">⚠️ ${v.important_notes}</div>` : ''}
            </td>
            <td class="py-3 px-4 text-xs">
                <div class="font-medium text-slate-700">${v.arrival_date ? v.arrival_date.replace('T', ' ') : '-'}</div>
                <div class="text-[11px] text-slate-400 mt-0.5">Kayıt: ${createdFormatted}</div>
            </td>
            <td class="py-3 px-4 text-xs font-bold text-blue-700">${v.dock_number || '-'}</td>
            <td class="py-3 px-4 text-center">${limanBadge}</td>
            <td class="py-3 px-4 text-center">${tescilBadge}</td>
            <td class="py-3 px-4">${bosaltmaBadge}</td>
            <td class="py-3 px-4 text-xs font-mono text-slate-600">
                ${v.customs_doc_no || '-'}
                ${v.document_photo ? `<div class="mt-1"><button onclick="viewDocumentPhoto('${v.document_photo}', '${v.tractor_plate}')" class="text-blue-600 hover:text-blue-800 font-bold underline text-[11px] inline-flex items-center gap-1 cursor-pointer"><i data-lucide="camera" class="w-3.5 h-3.5"></i> Belge Gör</button></div>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function downloadExcelReport() {
    const dateStart = document.getElementById('reportDateStart').value;
    const dateEnd = document.getElementById('reportDateEnd').value;
    const company = document.getElementById('reportCompanyFilter').value;
    const status = document.getElementById('reportStatusFilter').value;

    const url = `/api/export/excel?date_start=${encodeURIComponent(dateStart)}&date_end=${encodeURIComponent(dateEnd)}&company=${encodeURIComponent(company)}&status=${encodeURIComponent(status)}`;
    window.location.href = url;
}

// ==========================================
// YARDIMCI FONKSİYONLAR & BİLDİRİMLER
// ==========================================

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function showToast(message, icon = 'check', bgClass = 'bg-slate-900') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    toastMessage.textContent = message;
    toast.className = `fixed bottom-5 right-5 z-50 px-4 py-3 text-white rounded-xl shadow-2xl flex items-center gap-2 text-sm border border-slate-700 transition-all ${bgClass}`;
    toast.classList.remove('hidden');

    lucide.createIcons();
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

// 10. Operasyon Şifre Değiştirme (Admin Yetkili)
function openAdminPasswordModal() {
    const form = document.getElementById('adminPasswordForm');
    if (form) form.reset();
    const uInput = document.getElementById('adminUsername');
    if (uInput) uInput.value = 'admin';
    const errBox = document.getElementById('adminPasswordError');
    if (errBox) errBox.classList.add('hidden');
    document.getElementById('adminPasswordModal').classList.remove('hidden');
    lucide.createIcons();
}

async function handleAdminPasswordSubmit(e) {
    e.preventDefault();
    const adminUser = document.getElementById('adminUsername').value.trim();
    const adminPass = document.getElementById('adminPassword').value.trim();
    const newPass = document.getElementById('adminNewPassword').value.trim();
    const newPassConfirm = document.getElementById('adminNewPasswordConfirm').value.trim();
    const errBox = document.getElementById('adminPasswordError');
    const errText = document.getElementById('adminPasswordErrorText');
    const submitBtn = document.getElementById('adminPasswordSubmitBtn');

    if (errBox) errBox.classList.add('hidden');

    if (newPass !== newPassConfirm) {
        if (errText) errText.textContent = 'Girilen yeni şifreler birbiriyle uyuşmuyor!';
        if (errBox) errBox.classList.remove('hidden');
        return;
    }

    if (newPass.length < 4) {
        if (errText) errText.textContent = 'Yeni şifre en az 4 karakter olmalıdır!';
        if (errBox) errBox.classList.remove('hidden');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i><span>Güncelleniyor...</span>';
    lucide.createIcons();

    try {
        const res = await fetch('/api/admin/change-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                admin_username: adminUser,
                admin_password: adminPass,
                new_password: newPass,
                new_password_confirm: newPassConfirm
            })
        });
        const data = await res.json();
        if (data.success) {
            closeModal('adminPasswordModal');
            showToast(data.message || 'Operasyon şifresi başarıyla güncellendi!', 'check', 'bg-emerald-900');
        } else {
            if (errText) errText.textContent = data.message || 'Şifre güncellenemedi.';
            if (errBox) errBox.classList.remove('hidden');
        }
    } catch (err) {
        if (errText) errText.textContent = 'Sunucuya bağlanırken bir hata oluştu.';
        if (errBox) errBox.classList.remove('hidden');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i><span>Şifreyi Güncelle</span>';
        lucide.createIcons();
    }
}

async function handleLogout() {
    if (confirm('Oturumu kapatmak istiyor musunuz?')) {
        await fetch('/api/logout', { method: 'POST' });
        window.location.href = '/login';
    }
}
