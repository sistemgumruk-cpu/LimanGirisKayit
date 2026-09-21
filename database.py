import sqlite3
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logistics.db')

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tractor_plate TEXT NOT NULL,
            trailer_plate TEXT NOT NULL,
            company_name TEXT NOT NULL,
            arrival_date TEXT NOT NULL,
            gross_weight REAL DEFAULT NULL,
            net_weight REAL DEFAULT NULL,
            kantar_weight REAL DEFAULT NULL,
            package_count INTEGER DEFAULT NULL,
            customs_doc_no TEXT DEFAULT '',
            dock_number TEXT DEFAULT '',
            is_registered INTEGER DEFAULT 0,
            registered_at TEXT DEFAULT NULL,
            is_unloaded INTEGER DEFAULT 0,
            unloaded_amount TEXT DEFAULT '',
            unloaded_at TEXT DEFAULT NULL,
            unloaded_note TEXT DEFAULT '',
            important_notes TEXT DEFAULT '',
            document_photo TEXT DEFAULT '',
            status TEXT DEFAULT 'YOLDA',
            is_port_entered INTEGER DEFAULT 0,
            port_entered_at TEXT DEFAULT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Kolon göçü (Eski veritabanlarında alanlar yoksa ekle)
    cursor.execute("PRAGMA table_info(vehicles)")
    columns = [row['name'] for row in cursor.fetchall()]
    if 'net_weight' not in columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN net_weight REAL DEFAULT NULL")
    if 'kantar_weight' not in columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN kantar_weight REAL DEFAULT NULL")
    if 'important_notes' not in columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN important_notes TEXT DEFAULT ''")
    if 'document_photo' not in columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN document_photo TEXT DEFAULT ''")
    if 'is_port_entered' not in columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN is_port_entered INTEGER DEFAULT 0")
    if 'port_entered_at' not in columns:
        cursor.execute("ALTER TABLE vehicles ADD COLUMN port_entered_at TEXT DEFAULT NULL")

    # Ayarlar ve Şoför Önemli Notları / Duyuruları Tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')

    # Varsayılan şoför önemli notu (boşsa ekle)
    cursor.execute("SELECT value FROM settings WHERE key = 'driver_notice'")
    if not cursor.fetchone():
        default_notice = (
            "⚠️ DİKKAT: Varış tarih ve saatinin boşaltma operasyonunun düzgün planlanabilmesi için doğru ve "
            "eksiksiz girilmesi zorunludur. Aksi durumda boşaltma operasyonunda cezalandırma politikası uygulanmakta "
            "olup, belirtilen saatte tesise gelmeyen araçlar gün sonuna bırakılarak en son boşaltma işlemine tabi tutulacaktır."
        )
        cursor.execute("INSERT INTO settings (key, value) VALUES ('driver_notice', ?)", (default_notice,))

    # Varsayılan operasyon şifresi (boşsa ekle)
    cursor.execute("SELECT value FROM settings WHERE key = 'operations_password'")
    if not cursor.fetchone():
        initial_password = os.environ.get('OPERATIONS_PASSWORD', 'change-this-operations-password')
        cursor.execute("INSERT INTO settings (key, value) VALUES ('operations_password', ?)", (initial_password,))

    # İndeksler (hızlı filtreleme ve raporlama için)
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_arrival_date ON vehicles(arrival_date)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_company ON vehicles(company_name)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_status ON vehicles(status)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_tractor_plate ON vehicles(tractor_plate)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_created_at ON vehicles(created_at)')
    conn.commit()
    conn.close()

def get_setting(key, default=""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row['value'] if row else default

def set_setting(key, value):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()
    return True

def clean_plate(plate):
    if not plate:
        return ""
    # Türkçe karakter duyarlı büyük harfe çevirme
    translation = str.maketrans({'i': 'İ', 'ı': 'I'})
    return plate.translate(translation).upper().strip()

def add_vehicle(tractor_plate, trailer_plate, company_name, arrival_date,
                gross_weight=None, package_count=None, customs_doc_no=None,
                important_notes="", document_photo="", net_weight=None, kantar_weight=None):
    conn = get_connection()
    cursor = conn.cursor()
    
    tractor = clean_plate(tractor_plate)
    trailer = clean_plate(trailer_plate)
    company = company_name.strip() if company_name else ""
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

    cursor.execute('''
        INSERT INTO vehicles (
            tractor_plate, trailer_plate, company_name, arrival_date,
            gross_weight, net_weight, kantar_weight, package_count, customs_doc_no, important_notes,
            document_photo, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'YOLDA', ?)
    ''', (
        tractor, trailer, company, arrival_date,
        gross_weight if gross_weight else None,
        net_weight if net_weight else None,
        kantar_weight if kantar_weight else None,
        package_count if package_count else None,
        customs_doc_no.strip() if customs_doc_no else "",
        important_notes.strip() if important_notes else "",
        document_photo.strip() if document_photo else "",
        now_str
    ))
    vehicle_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return vehicle_id

def get_vehicles(status=None, company=None, date_start=None, date_end=None, search=None, is_active_only=False):
    conn = get_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT v.*,
          EXISTS (
            SELECT 1 FROM vehicles v2
            WHERE v2.id != v.id
              AND (
                UPPER(REPLACE(v2.tractor_plate, ' ', '')) = UPPER(REPLACE(v.tractor_plate, ' ', ''))
                OR (v.trailer_plate != '' AND UPPER(REPLACE(v2.trailer_plate, ' ', '')) = UPPER(REPLACE(v.trailer_plate, ' ', '')))
              )
              AND ABS(julianday(replace(v.created_at, 'T', ' ')) - julianday(replace(v2.created_at, 'T', ' '))) <= 3.0
          ) AS is_duplicate_3days,
          (
            SELECT v2.created_at FROM vehicles v2
            WHERE v2.id != v.id
              AND (
                UPPER(REPLACE(v2.tractor_plate, ' ', '')) = UPPER(REPLACE(v.tractor_plate, ' ', ''))
                OR (v.trailer_plate != '' AND UPPER(REPLACE(v2.trailer_plate, ' ', '')) = UPPER(REPLACE(v.trailer_plate, ' ', '')))
              )
              AND ABS(julianday(replace(v.created_at, 'T', ' ')) - julianday(replace(v2.created_at, 'T', ' '))) <= 3.0
            ORDER BY v2.created_at DESC
            LIMIT 1
          ) AS duplicate_other_date
        FROM vehicles v
        WHERE 1=1
    """
    params = []
    
    if is_active_only:
        # Aktif sahada/yolda olanlar (henüz boşaltılmamış olanlar)
        query += " AND v.is_unloaded = 0"
        if status == 'TESCIL_YAPILDI':
            query += " AND v.is_registered = 1"
        elif status == 'TESCIL_BEKLIYOR':
            query += " AND v.is_registered = 0"
    elif status == 'BOSALTILDI':
        query += " AND v.is_unloaded = 1"
    elif status == 'TESCIL_YAPILDI':
        query += " AND v.is_registered = 1 AND v.is_unloaded = 0"
    elif status == 'TESCIL_BEKLIYOR':
        query += " AND v.is_registered = 0 AND v.is_unloaded = 0"

    if company and company.strip():
        query += " AND v.company_name = ?"
        params.append(company.strip())

    if date_start and date_start.strip():
        query += " AND v.arrival_date >= ?"
        params.append(date_start.strip() + " 00:00:00" if len(date_start.strip()) == 10 else date_start.strip())

    if date_end and date_end.strip():
        query += " AND v.arrival_date <= ?"
        params.append(date_end.strip() + " 23:59:59" if len(date_end.strip()) == 10 else date_end.strip())

    if search and search.strip():
        s = f"%{search.strip().upper()}%"
        query += " AND (UPPER(v.tractor_plate) LIKE ? OR UPPER(v.trailer_plate) LIKE ? OR UPPER(v.company_name) LIKE ? OR UPPER(v.customs_doc_no) LIKE ? OR UPPER(v.dock_number) LIKE ?)"
        params.extend([s, s, s, s, s])

    # Sıralama: Aktifler için varış tarihine göre, tamamlananlar için boşaltılma/varışa göre
    query += " ORDER BY v.arrival_date ASC, v.id DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    vehicles = [dict(row) for row in rows]
    conn.close()
    return vehicles

def get_vehicle_by_id(vehicle_id):
    conn = get_connection()
    cursor = conn.cursor()
    query = """
        SELECT v.*,
          EXISTS (
            SELECT 1 FROM vehicles v2
            WHERE v2.id != v.id
              AND (
                UPPER(REPLACE(v2.tractor_plate, ' ', '')) = UPPER(REPLACE(v.tractor_plate, ' ', ''))
                OR (v.trailer_plate != '' AND UPPER(REPLACE(v2.trailer_plate, ' ', '')) = UPPER(REPLACE(v.trailer_plate, ' ', '')))
              )
              AND ABS(julianday(replace(v.created_at, 'T', ' ')) - julianday(replace(v2.created_at, 'T', ' '))) <= 3.0
          ) AS is_duplicate_3days,
          (
            SELECT v2.created_at FROM vehicles v2
            WHERE v2.id != v.id
              AND (
                UPPER(REPLACE(v2.tractor_plate, ' ', '')) = UPPER(REPLACE(v.tractor_plate, ' ', ''))
                OR (v.trailer_plate != '' AND UPPER(REPLACE(v2.trailer_plate, ' ', '')) = UPPER(REPLACE(v.trailer_plate, ' ', '')))
              )
              AND ABS(julianday(replace(v.created_at, 'T', ' ')) - julianday(replace(v2.created_at, 'T', ' '))) <= 3.0
            ORDER BY v2.created_at DESC
            LIMIT 1
          ) AS duplicate_other_date
        FROM vehicles v
        WHERE v.id = ?
    """
    cursor.execute(query, (vehicle_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def update_vehicle(vehicle_id, **fields):
    conn = get_connection()
    cursor = conn.cursor()
    
    # İzin verilen alanlar
    allowed = {
        'tractor_plate', 'trailer_plate', 'company_name', 'arrival_date',
        'gross_weight', 'net_weight', 'kantar_weight', 'package_count', 'customs_doc_no', 'dock_number',
        'is_registered', 'registered_at', 'is_unloaded', 'unloaded_amount',
        'unloaded_at', 'unloaded_note', 'important_notes', 'document_photo', 'status',
        'is_port_entered', 'port_entered_at'
    }
    
    set_clauses = []
    params = []
    for key, value in fields.items():
        if key in allowed:
            if key in ['tractor_plate', 'trailer_plate']:
                value = clean_plate(value)
            set_clauses.append(f"{key} = ?")
            params.append(value)
            
    if not set_clauses:
        conn.close()
        return False
        
    params.append(vehicle_id)
    query = f"UPDATE vehicles SET {', '.join(set_clauses)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    return True

def toggle_tescil(vehicle_id, force_state=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_registered, is_unloaded, status FROM vehicles WHERE id = ?", (vehicle_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
        
    current = bool(row['is_registered'])
    is_unloaded = bool(row['is_unloaded'])
    new_state = (not current) if force_state is None else bool(force_state)
    reg_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S') if new_state else None
    
    if is_unloaded:
        status = 'BOSALTILDI'
    else:
        status = 'TESCIL_YAPILDI' if new_state else 'YOLDA'
    
    cursor.execute('''
        UPDATE vehicles 
        SET is_registered = ?, registered_at = ?, status = ?
        WHERE id = ?
    ''', (1 if new_state else 0, reg_time, status, vehicle_id))
    
    conn.commit()
    conn.close()
    return {'is_registered': new_state, 'registered_at': reg_time}

def toggle_port_entry(vehicle_id, force_state=None):
    """Liman giriş kaydı yapıldı / yapılmadı durumunu günceller"""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_port_entered FROM vehicles WHERE id = ?", (vehicle_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
        
    current = bool(row['is_port_entered'])
    new_state = (not current) if force_state is None else bool(force_state)
    entry_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S') if new_state else None
    
    cursor.execute('''
        UPDATE vehicles 
        SET is_port_entered = ?, port_entered_at = ?
        WHERE id = ?
    ''', (1 if new_state else 0, entry_time, vehicle_id))
    
    conn.commit()
    conn.close()
    return {'is_port_entered': new_state, 'port_entered_at': entry_time}

def complete_unloading(vehicle_id, unloaded_amount='Onaylandı', unloaded_note='', dock_number=None, net_weight=None, kantar_weight=None):
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    
    amount_str = str(unloaded_amount).strip() if unloaded_amount and str(unloaded_amount).strip() else 'Onaylandı'

    updates = [
        "is_unloaded = 1",
        "unloaded_amount = ?",
        "unloaded_at = ?",
        "unloaded_note = ?",
        "status = 'BOSALTILDI'"
    ]
    params = [amount_str, now_str, unloaded_note]
    
    if dock_number:
        updates.append("dock_number = ?")
        params.append(dock_number)

    if net_weight is not None:
        updates.append("net_weight = ?")
        params.append(net_weight)

    if kantar_weight is not None:
        updates.append("kantar_weight = ?")
        params.append(kantar_weight)
        
    params.append(vehicle_id)
    query = f"UPDATE vehicles SET {', '.join(updates)} WHERE id = ?"
    cursor.execute(query, params)
    conn.commit()
    conn.close()
    return {'is_unloaded': True, 'unloaded_at': now_str}

def get_port_approved_vehicles(limit=50):
    """
    Şoförlerin takip edebilmesi için liman giriş onayı verilmiş (is_port_entered = 1)
    ve henüz boşaltılmamış (is_unloaded = 0) araçların plaka, firma ve onay zamanı bilgilerini döner.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            id, tractor_plate, trailer_plate, company_name, dock_number,
            port_entered_at, is_port_entered, is_unloaded, unloaded_at, status, created_at
        FROM vehicles
        WHERE is_port_entered = 1 AND (is_unloaded = 0 OR is_unloaded IS NULL)
        ORDER BY port_entered_at DESC, id DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    vehicles = [dict(r) for r in rows]
    conn.close()
    return vehicles

def get_approved_vehicles(limit=50):
    """
    Şoförlerin takip edebilmesi için boşaltma girişi yapılmış (is_unloaded = 1)
    araçların plaka, depo, firma ve onay zamanı bilgilerini döner.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT 
            id, tractor_plate, trailer_plate, company_name, dock_number,
            unloaded_at, unloaded_amount, is_port_entered, port_entered_at, status, created_at
        FROM vehicles
        WHERE is_unloaded = 1
        ORDER BY unloaded_at DESC, id DESC
        LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    vehicles = [dict(r) for r in rows]
    conn.close()
    return vehicles

def get_driver_tracking_vehicles(limit=50):
    """
    Şoför takip ekranı için hem liman giriş onayı verilenleri (boşaltılmamış olanlar)
    hem de boşaltma girişi yapılanları birlikte döner.
    """
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Liman Giriş Onayı Verilenler (is_port_entered = 1 AND is_unloaded = 0)
    cursor.execute("""
        SELECT 
            id, tractor_plate, trailer_plate, company_name, dock_number,
            port_entered_at, is_port_entered, is_unloaded, unloaded_at, status, created_at
        FROM vehicles
        WHERE is_port_entered = 1 AND (is_unloaded = 0 OR is_unloaded IS NULL)
        ORDER BY port_entered_at DESC, id DESC
        LIMIT ?
    """, (limit,))
    port_vehicles = [dict(r) for r in cursor.fetchall()]

    # 2. Boşaltma Girişi Yapılanlar (is_unloaded = 1)
    cursor.execute("""
        SELECT 
            id, tractor_plate, trailer_plate, company_name, dock_number,
            unloaded_at, unloaded_amount, is_port_entered, port_entered_at, status, created_at
        FROM vehicles
        WHERE is_unloaded = 1
        ORDER BY unloaded_at DESC, id DESC
        LIMIT ?
    """, (limit,))
    unloaded_vehicles = [dict(r) for r in cursor.fetchall()]

    conn.close()
    return {
        'port_vehicles': port_vehicles,
        'unloaded_vehicles': unloaded_vehicles
    }

def delete_vehicle(vehicle_id):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM vehicles WHERE id = ?", (vehicle_id,))
    conn.commit()
    conn.close()
    return True

def get_distinct_companies():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT DISTINCT company_name FROM vehicles WHERE company_name != '' ORDER BY company_name ASC")
    rows = cursor.fetchall()
    conn.close()
    return [r['company_name'] for r in rows]

def get_summary_stats():
    conn = get_connection()
    cursor = conn.cursor()
    today_str = datetime.now().strftime('%Y-%m-%d')
    
    # Toplam bekleyen (boşaltılmamış)
    cursor.execute("SELECT COUNT(*) as count FROM vehicles WHERE is_unloaded = 0")
    total_waiting = cursor.fetchone()['count']
    
    # Tescil bekleyenler
    cursor.execute("SELECT COUNT(*) as count FROM vehicles WHERE is_registered = 0 AND is_unloaded = 0")
    tescil_waiting = cursor.fetchone()['count']
    
    # Tescil yapılmış ama boşaltılmamış
    cursor.execute("SELECT COUNT(*) as count FROM vehicles WHERE is_registered = 1 AND is_unloaded = 0")
    registered_ready = cursor.fetchone()['count']
    
    # Bugün boşaltılanlar
    cursor.execute("SELECT COUNT(*) as count FROM vehicles WHERE is_unloaded = 1 AND DATE(unloaded_at) = ?", (today_str,))
    unloaded_today = cursor.fetchone()['count']

    # Bugün varış beklenen toplam araç
    cursor.execute("SELECT COUNT(*) as count FROM vehicles WHERE DATE(arrival_date) = ?", (today_str,))
    total_today = cursor.fetchone()['count']
    
    conn.close()
    return {
        'total_waiting': total_waiting,
        'tescil_waiting': tescil_waiting,
        'registered_ready': registered_ready,
        'unloaded_today': unloaded_today,
        'total_today': total_today
    }

# ==========================================
# VERİTABANI YÖNETİMİ, YEDEKLEME & TEMİZLİK
# ==========================================

def get_db_stats():
    """Veritabanı boyutu, kayıt sayıları ve evrak depolama istatistiklerini döner"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) as count FROM vehicles")
    total_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) as count FROM vehicles WHERE is_unloaded = 0")
    active_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) as count FROM vehicles WHERE is_unloaded = 1")
    archived_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) as count FROM vehicles WHERE is_registered = 1")
    registered_count = cursor.fetchone()['count']

    cursor.execute("SELECT COUNT(*) as count FROM vehicles WHERE document_photo != '' AND document_photo IS NOT NULL")
    photo_records_count = cursor.fetchone()['count']

    conn.close()

    # DB Dosya Boyutu
    db_size_bytes = os.path.getsize(DB_PATH) if os.path.exists(DB_PATH) else 0

    # Uploads Klasörü Boyutu ve Dosya Sayısı
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    upload_files_count = 0
    upload_size_bytes = 0
    if os.path.exists(uploads_dir):
        for fname in os.listdir(uploads_dir):
            if fname.startswith('.'):
                continue
            fpath = os.path.join(uploads_dir, fname)
            if os.path.isfile(fpath):
                upload_files_count += 1
                upload_size_bytes += os.path.getsize(fpath)

    def _fmt(b):
        if b < 1024:
            return f"{b} B"
        elif b < 1024 * 1024:
            return f"{b / 1024:.1f} KB"
        else:
            return f"{b / (1024 * 1024):.2f} MB"

    return {
        'total_vehicles': total_count,
        'active_vehicles': active_count,
        'archived_vehicles': archived_count,
        'registered_vehicles': registered_count,
        'photo_records_count': photo_records_count,
        'db_size_bytes': db_size_bytes,
        'db_size_human': _fmt(db_size_bytes),
        'upload_files_count': upload_files_count,
        'upload_size_bytes': upload_size_bytes,
        'upload_size_human': _fmt(upload_size_bytes),
        'db_path': DB_PATH
    }

def clear_archived_vehicles():
    """Yalnızca boşaltılmış/arşivlenmiş araçları ve fotoğraflarını siler"""
    conn = get_connection()
    cursor = conn.cursor()

    # Silinecek araçların fotoğraflarını topla
    cursor.execute("SELECT document_photo FROM vehicles WHERE is_unloaded = 1 AND document_photo != ''")
    photos = [r['document_photo'] for r in cursor.fetchall()]

    cursor.execute("DELETE FROM vehicles WHERE is_unloaded = 1")
    deleted_count = cursor.rowcount
    conn.commit()

    # Veritabanı boyutunu küçült
    cursor.execute("VACUUM")
    conn.commit()
    conn.close()

    # Fiziksel fotoğrafları sil
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    deleted_photos = 0
    for p in photos:
        if p and p.startswith('/uploads/'):
            filename = os.path.basename(p)
            filepath = os.path.join(uploads_dir, filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    deleted_photos += 1
                except OSError:
                    pass

    return {
        'deleted_vehicles': deleted_count,
        'deleted_photos': deleted_photos
    }

def reset_all_vehicles():
    """Tüm araç kayıtlarını sıfırlar ve uploads klasörünü temizler"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("DELETE FROM vehicles")
    deleted_count = cursor.rowcount
    cursor.execute("DELETE FROM sqlite_sequence WHERE name='vehicles'")
    conn.commit()
    cursor.execute("VACUUM")
    conn.commit()
    conn.close()

    # Uploads klasörünü temizle (.gitkeep hariç)
    uploads_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
    deleted_photos = 0
    if os.path.exists(uploads_dir):
        for fname in os.listdir(uploads_dir):
            if fname.startswith('.'):
                continue
            fpath = os.path.join(uploads_dir, fname)
            if os.path.isfile(fpath):
                try:
                    os.remove(fpath)
                    deleted_photos += 1
                except OSError:
                    pass

    return {
        'deleted_vehicles': deleted_count,
        'deleted_photos': deleted_photos
    }

def export_all_data():
    """Tüm araçları ve ayarları bir dictionary olarak döner (JSON yedekleme için)"""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM vehicles ORDER BY id ASC")
    vehicles = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM settings")
    settings = {r['key']: r['value'] for r in cursor.fetchall()}

    conn.close()
    return {
        'version': '1.0',
        'exported_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_records': len(vehicles),
        'settings': settings,
        'vehicles': vehicles
    }

def import_data_from_json(data):
    """JSON yedek verisini veritabanına yükler (Mevcut veriyi korur veya üzerine yazar)"""
    if not isinstance(data, dict) or 'vehicles' not in data:
        raise ValueError("Geçersiz yedek dosyası formatı.")

    conn = get_connection()
    cursor = conn.cursor()

    # Ayarları geri yükle
    settings = data.get('settings', {})
    for k, v in settings.items():
        cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (k, v))

    # Araçları geri yükle
    vehicles = data.get('vehicles', [])
    imported = 0
    for v in vehicles:
        cursor.execute('''
            INSERT OR REPLACE INTO vehicles (
                id, tractor_plate, trailer_plate, company_name, arrival_date,
                gross_weight, net_weight, kantar_weight, package_count, customs_doc_no, dock_number,
                is_registered, registered_at, is_unloaded, unloaded_amount,
                unloaded_at, unloaded_note, important_notes, document_photo,
                status, is_port_entered, port_entered_at, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            v.get('id'), v.get('tractor_plate', ''), v.get('trailer_plate', ''),
            v.get('company_name', ''), v.get('arrival_date', ''),
            v.get('gross_weight'), v.get('net_weight'), v.get('kantar_weight'), v.get('package_count'),
            v.get('customs_doc_no', ''), v.get('dock_number', ''),
            v.get('is_registered', 0), v.get('registered_at'),
            v.get('is_unloaded', 0), v.get('unloaded_amount', ''),
            v.get('unloaded_at'), v.get('unloaded_note', ''),
            v.get('important_notes', ''), v.get('document_photo', ''),
            v.get('status', 'YOLDA'),
            v.get('is_port_entered', 0), v.get('port_entered_at'),
            v.get('created_at')
        ))
        imported += 1

    conn.commit()
    conn.close()
    return imported

