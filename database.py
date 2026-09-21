import os
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor

# PostgreSQL is used on Render.
# DATABASE_URL must be set in the Render Web Service environment.
DB_PATH = "PostgreSQL (Render)"

def get_connection():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError(
            "DATABASE_URL ortam değişkeni bulunamadı. "
            "Render Web Service > Environment bölümüne PostgreSQL Internal Database URL ekleyin."
        )
    return psycopg2.connect(database_url, cursor_factory=RealDictCursor)

def _fetchone(cursor):
    row = cursor.fetchone()
    return dict(row) if row else None

def _fetchall(cursor):
    return [dict(row) for row in cursor.fetchall()]

def init_db():
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS vehicles (
                    id SERIAL PRIMARY KEY,
                    tractor_plate TEXT NOT NULL,
                    trailer_plate TEXT NOT NULL,
                    company_name TEXT NOT NULL,
                    arrival_date TEXT NOT NULL,
                    gross_weight DOUBLE PRECISION DEFAULT NULL,
                    net_weight DOUBLE PRECISION DEFAULT NULL,
                    kantar_weight DOUBLE PRECISION DEFAULT NULL,
                    package_count INTEGER DEFAULT NULL,
                    customs_doc_no TEXT DEFAULT '',
                    dock_number TEXT DEFAULT '',
                    is_registered SMALLINT DEFAULT 0,
                    registered_at TEXT DEFAULT NULL,
                    is_unloaded SMALLINT DEFAULT 0,
                    unloaded_amount TEXT DEFAULT '',
                    unloaded_at TEXT DEFAULT NULL,
                    unloaded_note TEXT DEFAULT '',
                    important_notes TEXT DEFAULT '',
                    document_photo TEXT DEFAULT '',
                    status TEXT DEFAULT 'YOLDA',
                    is_port_entered SMALLINT DEFAULT 0,
                    port_entered_at TEXT DEFAULT NULL,
                    created_at TEXT DEFAULT TO_CHAR(NOW(), 'YYYY-MM-DD HH24:MI:SS')
                )
            """)

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT
                )
            """)

            # Güvenli kolon kontrolü/migration.
            cursor.execute("""
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'vehicles'
            """)
            columns = {row["column_name"] for row in cursor.fetchall()}

            migrations = {
                "net_weight": "DOUBLE PRECISION DEFAULT NULL",
                "kantar_weight": "DOUBLE PRECISION DEFAULT NULL",
                "important_notes": "TEXT DEFAULT ''",
                "document_photo": "TEXT DEFAULT ''",
                "is_port_entered": "SMALLINT DEFAULT 0",
                "port_entered_at": "TEXT DEFAULT NULL",
            }
            for column, definition in migrations.items():
                if column not in columns:
                    cursor.execute(
                        f"ALTER TABLE vehicles ADD COLUMN {column} {definition}"
                    )

            cursor.execute(
                "SELECT value FROM settings WHERE key = 'driver_notice'"
            )
            if not cursor.fetchone():
                default_notice = (
                    "⚠️ DİKKAT: Varış tarih ve saatinin boşaltma operasyonunun düzgün "
                    "planlanabilmesi için doğru ve eksiksiz girilmesi zorunludur. "
                    "Aksi durumda boşaltma operasyonunda cezalandırma politikası "
                    "uygulanmakta olup, belirtilen saatte tesise gelmeyen araçlar "
                    "gün sonuna bırakılarak en son boşaltma işlemine tabi tutulacaktır."
                )
                cursor.execute(
                    """
                    INSERT INTO settings (key, value)
                    VALUES (%s, %s)
                    ON CONFLICT (key) DO NOTHING
                    """,
                    ("driver_notice", default_notice),
                )

            cursor.execute(
                "SELECT value FROM settings WHERE key = 'operations_password'"
            )
            if not cursor.fetchone():
                initial_password = os.environ.get(
                    "OPERATIONS_PASSWORD", "change-this-operations-password"
                )
                cursor.execute(
                    """
                    INSERT INTO settings (key, value)
                    VALUES (%s, %s)
                    ON CONFLICT (key) DO NOTHING
                    """,
                    ("operations_password", initial_password),
                )

            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_arrival_date ON vehicles(arrival_date)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_company ON vehicles(company_name)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_status ON vehicles(status)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_tractor_plate ON vehicles(tractor_plate)"
            )
            cursor.execute(
                "CREATE INDEX IF NOT EXISTS idx_created_at ON vehicles(created_at)"
            )

        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_setting(key, default=""):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT value FROM settings WHERE key = %s", (key,))
            row = cursor.fetchone()
            return row["value"] if row else default
    finally:
        conn.close()

def set_setting(key, value):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO settings (key, value)
                VALUES (%s, %s)
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                """,
                (key, value),
            )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def clean_plate(plate):
    if not plate:
        return ""
    translation = str.maketrans({"i": "İ", "ı": "I"})
    return str(plate).translate(translation).upper().strip()

def add_vehicle(
    tractor_plate,
    trailer_plate,
    company_name,
    arrival_date,
    gross_weight=None,
    package_count=None,
    customs_doc_no=None,
    important_notes="",
    document_photo="",
    net_weight=None,
    kantar_weight=None,
):
    conn = get_connection()
    try:
        tractor = clean_plate(tractor_plate)
        trailer = clean_plate(trailer_plate)
        company = company_name.strip() if company_name else ""
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        with conn.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO vehicles (
                    tractor_plate, trailer_plate, company_name, arrival_date,
                    gross_weight, net_weight, kantar_weight, package_count,
                    customs_doc_no, important_notes, document_photo, status, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'YOLDA', %s)
                RETURNING id
                """,
                (
                    tractor,
                    trailer,
                    company,
                    arrival_date,
                    gross_weight if gross_weight is not None else None,
                    net_weight if net_weight is not None else None,
                    kantar_weight if kantar_weight is not None else None,
                    package_count if package_count is not None else None,
                    customs_doc_no.strip() if customs_doc_no else "",
                    important_notes.strip() if important_notes else "",
                    document_photo.strip() if document_photo else "",
                    now_str,
                ),
            )
            vehicle_id = cursor.fetchone()['id']

        conn.commit()
        return vehicle_id
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

_DUPLICATE_SQL = """
    EXISTS (
        SELECT 1
        FROM vehicles v2
        WHERE v2.id != v.id
          AND (
            UPPER(REPLACE(v2.tractor_plate, ' ', '')) =
                UPPER(REPLACE(v.tractor_plate, ' ', ''))
            OR (
                v.trailer_plate != ''
                AND UPPER(REPLACE(v2.trailer_plate, ' ', '')) =
                    UPPER(REPLACE(v.trailer_plate, ' ', ''))
            )
          )
          AND ABS(
              EXTRACT(
                  EPOCH FROM (
                      TO_TIMESTAMP(REPLACE(v.created_at, 'T', ' '), 'YYYY-MM-DD HH24:MI:SS')
                      - TO_TIMESTAMP(REPLACE(v2.created_at, 'T', ' '), 'YYYY-MM-DD HH24:MI:SS')
                  )
              )
          ) <= 259200
    ) AS is_duplicate_3days,
    (
        SELECT v2.created_at
        FROM vehicles v2
        WHERE v2.id != v.id
          AND (
            UPPER(REPLACE(v2.tractor_plate, ' ', '')) =
                UPPER(REPLACE(v.tractor_plate, ' ', ''))
            OR (
                v.trailer_plate != ''
                AND UPPER(REPLACE(v2.trailer_plate, ' ', '')) =
                    UPPER(REPLACE(v.trailer_plate, ' ', ''))
            )
          )
          AND ABS(
              EXTRACT(
                  EPOCH FROM (
                      TO_TIMESTAMP(REPLACE(v.created_at, 'T', ' '), 'YYYY-MM-DD HH24:MI:SS')
                      - TO_TIMESTAMP(REPLACE(v2.created_at, 'T', ' '), 'YYYY-MM-DD HH24:MI:SS')
                  )
              )
          ) <= 259200
        ORDER BY v2.created_at DESC
        LIMIT 1
    ) AS duplicate_other_date
"""

def get_vehicles(
    status=None,
    company=None,
    date_start=None,
    date_end=None,
    search=None,
    is_active_only=False,
):
    conn = get_connection()
    try:
        query = f"""
            SELECT v.*, {_DUPLICATE_SQL}
            FROM vehicles v
            WHERE 1=1
        """
        params = []

        if is_active_only:
            query += " AND v.is_unloaded = 0"
            if status == "TESCIL_YAPILDI":
                query += " AND v.is_registered = 1"
            elif status == "TESCIL_BEKLIYOR":
                query += " AND v.is_registered = 0"
        elif status == "BOSALTILDI":
            query += " AND v.is_unloaded = 1"
        elif status == "TESCIL_YAPILDI":
            query += " AND v.is_registered = 1 AND v.is_unloaded = 0"
        elif status == "TESCIL_BEKLIYOR":
            query += " AND v.is_registered = 0 AND v.is_unloaded = 0"

        if company and company.strip():
            query += " AND v.company_name = %s"
            params.append(company.strip())

        if date_start and date_start.strip():
            query += " AND v.arrival_date >= %s"
            params.append(
                date_start.strip() + " 00:00:00"
                if len(date_start.strip()) == 10
                else date_start.strip()
            )

        if date_end and date_end.strip():
            query += " AND v.arrival_date <= %s"
            params.append(
                date_end.strip() + " 23:59:59"
                if len(date_end.strip()) == 10
                else date_end.strip()
            )

        if search and search.strip():
            s = f"%{search.strip().upper()}%"
            query += """
                AND (
                    UPPER(v.tractor_plate) LIKE %s
                    OR UPPER(v.trailer_plate) LIKE %s
                    OR UPPER(v.company_name) LIKE %s
                    OR UPPER(v.customs_doc_no) LIKE %s
                    OR UPPER(v.dock_number) LIKE %s
                )
            """
            params.extend([s, s, s, s, s])

        query += " ORDER BY v.arrival_date ASC, v.id DESC"

        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, params)
            return _fetchall(cursor)
    finally:
        conn.close()

def get_vehicle_by_id(vehicle_id):
    conn = get_connection()
    try:
        query = f"""
            SELECT v.*, {_DUPLICATE_SQL}
            FROM vehicles v
            WHERE v.id = %s
        """
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(query, (vehicle_id,))
            return _fetchone(cursor)
    finally:
        conn.close()

def update_vehicle(vehicle_id, **fields):
    allowed = {
        "tractor_plate",
        "trailer_plate",
        "company_name",
        "arrival_date",
        "gross_weight",
        "net_weight",
        "kantar_weight",
        "package_count",
        "customs_doc_no",
        "dock_number",
        "is_registered",
        "registered_at",
        "is_unloaded",
        "unloaded_amount",
        "unloaded_at",
        "unloaded_note",
        "important_notes",
        "document_photo",
        "status",
        "is_port_entered",
        "port_entered_at",
    }

    set_clauses = []
    params = []

    for key, value in fields.items():
        if key in allowed:
            if key in ("tractor_plate", "trailer_plate"):
                value = clean_plate(value)
            set_clauses.append(f"{key} = %s")
            params.append(value)

    if not set_clauses:
        return False

    params.append(vehicle_id)
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(
                f"UPDATE vehicles SET {', '.join(set_clauses)} WHERE id = %s",
                params,
            )
            changed = cursor.rowcount > 0
        conn.commit()
        return changed
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def toggle_tescil(vehicle_id, force_state=None):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                "SELECT is_registered, is_unloaded, status FROM vehicles WHERE id = %s",
                (vehicle_id,),
            )
            row = cursor.fetchone()
            if not row:
                return False

            current = bool(row["is_registered"])
            is_unloaded = bool(row["is_unloaded"])
            new_state = (not current) if force_state is None else bool(force_state)
            reg_time = (
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                if new_state
                else None
            )

            if is_unloaded:
                status = "BOSALTILDI"
            else:
                status = "TESCIL_YAPILDI" if new_state else "YOLDA"

            cursor.execute(
                """
                UPDATE vehicles
                SET is_registered = %s, registered_at = %s, status = %s
                WHERE id = %s
                """,
                (1 if new_state else 0, reg_time, status, vehicle_id),
            )

        conn.commit()
        return {"is_registered": new_state, "registered_at": reg_time}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def toggle_port_entry(vehicle_id, force_state=None):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                "SELECT is_port_entered FROM vehicles WHERE id = %s",
                (vehicle_id,),
            )
            row = cursor.fetchone()
            if not row:
                return False

            current = bool(row["is_port_entered"])
            new_state = (not current) if force_state is None else bool(force_state)
            entry_time = (
                datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                if new_state
                else None
            )

            cursor.execute(
                """
                UPDATE vehicles
                SET is_port_entered = %s, port_entered_at = %s
                WHERE id = %s
                """,
                (1 if new_state else 0, entry_time, vehicle_id),
            )

        conn.commit()
        return {
            "is_port_entered": new_state,
            "port_entered_at": entry_time,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def complete_unloading(
    vehicle_id,
    unloaded_amount="Onaylandı",
    unloaded_note="",
    dock_number=None,
    net_weight=None,
    kantar_weight=None,
):
    conn = get_connection()
    try:
        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        amount_str = (
            str(unloaded_amount).strip()
            if unloaded_amount and str(unloaded_amount).strip()
            else "Onaylandı"
        )

        updates = [
            "is_unloaded = 1",
            "unloaded_amount = %s",
            "unloaded_at = %s",
            "unloaded_note = %s",
            "status = 'BOSALTILDI'",
        ]
        params = [amount_str, now_str, unloaded_note]

        if dock_number:
            updates.append("dock_number = %s")
            params.append(dock_number)
        if net_weight is not None:
            updates.append("net_weight = %s")
            params.append(net_weight)
        if kantar_weight is not None:
            updates.append("kantar_weight = %s")
            params.append(kantar_weight)

        params.append(vehicle_id)

        with conn.cursor() as cursor:
            cursor.execute(
                f"UPDATE vehicles SET {', '.join(updates)} WHERE id = %s",
                params,
            )

        conn.commit()
        return {"is_unloaded": True, "unloaded_at": now_str}
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_port_approved_vehicles(limit=50):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT
                    id, tractor_plate, trailer_plate, company_name, dock_number,
                    port_entered_at, is_port_entered, is_unloaded, unloaded_at,
                    status, created_at
                FROM vehicles
                WHERE is_port_entered = 1 AND (is_unloaded = 0 OR is_unloaded IS NULL)
                ORDER BY port_entered_at DESC, id DESC
                LIMIT %s
                """,
                (limit,),
            )
            return _fetchall(cursor)
    finally:
        conn.close()

def get_approved_vehicles(limit=50):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT
                    id, tractor_plate, trailer_plate, company_name, dock_number,
                    unloaded_at, unloaded_amount, is_port_entered,
                    port_entered_at, status, created_at
                FROM vehicles
                WHERE is_unloaded = 1
                ORDER BY unloaded_at DESC, id DESC
                LIMIT %s
                """,
                (limit,),
            )
            return _fetchall(cursor)
    finally:
        conn.close()

def get_driver_tracking_vehicles(limit=50):
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT
                    id, tractor_plate, trailer_plate, company_name, dock_number,
                    port_entered_at, is_port_entered, is_unloaded, unloaded_at,
                    status, created_at
                FROM vehicles
                WHERE is_port_entered = 1 AND (is_unloaded = 0 OR is_unloaded IS NULL)
                ORDER BY port_entered_at DESC, id DESC
                LIMIT %s
                """,
                (limit,),
            )
            port_vehicles = _fetchall(cursor)

            cursor.execute(
                """
                SELECT
                    id, tractor_plate, trailer_plate, company_name, dock_number,
                    unloaded_at, unloaded_amount, is_port_entered,
                    port_entered_at, status, created_at
                FROM vehicles
                WHERE is_unloaded = 1
                ORDER BY unloaded_at DESC, id DESC
                LIMIT %s
                """,
                (limit,),
            )
            unloaded_vehicles = _fetchall(cursor)

        return {
            "port_vehicles": port_vehicles,
            "unloaded_vehicles": unloaded_vehicles,
        }
    finally:
        conn.close()

def delete_vehicle(vehicle_id):
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("DELETE FROM vehicles WHERE id = %s", (vehicle_id,))
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def get_distinct_companies():
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT DISTINCT company_name
                FROM vehicles
                WHERE company_name != ''
                ORDER BY company_name ASC
                """
            )
            return [r["company_name"] for r in cursor.fetchall()]
    finally:
        conn.close()

def get_summary_stats():
    conn = get_connection()
    try:
        today_str = datetime.now().strftime("%Y-%m-%d")
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                "SELECT COUNT(*) AS count FROM vehicles WHERE is_unloaded = 0"
            )
            total_waiting = cursor.fetchone()["count"]

            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM vehicles
                WHERE is_registered = 0 AND is_unloaded = 0
                """
            )
            tescil_waiting = cursor.fetchone()["count"]

            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM vehicles
                WHERE is_registered = 1 AND is_unloaded = 0
                """
            )
            registered_ready = cursor.fetchone()["count"]

            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM vehicles
                WHERE is_unloaded = 1 AND LEFT(unloaded_at, 10) = %s
                """,
                (today_str,),
            )
            unloaded_today = cursor.fetchone()["count"]

            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM vehicles
                WHERE LEFT(arrival_date, 10) = %s
                """,
                (today_str,),
            )
            total_today = cursor.fetchone()["count"]

        return {
            "total_waiting": total_waiting,
            "tescil_waiting": tescil_waiting,
            "registered_ready": registered_ready,
            "unloaded_today": unloaded_today,
            "total_today": total_today,
        }
    finally:
        conn.close()

def _format_bytes(b):
    if b < 1024:
        return f"{b} B"
    if b < 1024 * 1024:
        return f"{b / 1024:.1f} KB"
    return f"{b / (1024 * 1024):.2f} MB"

def get_db_stats():
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT COUNT(*) AS count FROM vehicles")
            total_count = cursor.fetchone()["count"]

            cursor.execute(
                "SELECT COUNT(*) AS count FROM vehicles WHERE is_unloaded = 0"
            )
            active_count = cursor.fetchone()["count"]

            cursor.execute(
                "SELECT COUNT(*) AS count FROM vehicles WHERE is_unloaded = 1"
            )
            archived_count = cursor.fetchone()["count"]

            cursor.execute(
                "SELECT COUNT(*) AS count FROM vehicles WHERE is_registered = 1"
            )
            registered_count = cursor.fetchone()["count"]

            cursor.execute(
                """
                SELECT COUNT(*) AS count
                FROM vehicles
                WHERE document_photo != '' AND document_photo IS NOT NULL
                """
            )
            photo_records_count = cursor.fetchone()["count"]

            cursor.execute(
                "SELECT pg_database_size(current_database()) AS size_bytes"
            )
            db_size_bytes = cursor.fetchone()["size_bytes"]

        uploads_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "uploads"
        )
        upload_files_count = 0
        upload_size_bytes = 0

        if os.path.exists(uploads_dir):
            for fname in os.listdir(uploads_dir):
                if fname.startswith("."):
                    continue
                fpath = os.path.join(uploads_dir, fname)
                if os.path.isfile(fpath):
                    upload_files_count += 1
                    upload_size_bytes += os.path.getsize(fpath)

        return {
            "total_vehicles": total_count,
            "active_vehicles": active_count,
            "archived_vehicles": archived_count,
            "registered_vehicles": registered_count,
            "photo_records_count": photo_records_count,
            "db_size_bytes": db_size_bytes,
            "db_size_human": _format_bytes(db_size_bytes),
            "upload_files_count": upload_files_count,
            "upload_size_bytes": upload_size_bytes,
            "upload_size_human": _format_bytes(upload_size_bytes),
            "db_path": DB_PATH,
        }
    finally:
        conn.close()

def _delete_upload_files(photos):
    uploads_dir = os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "uploads"
    )
    deleted_photos = 0

    for p in photos:
        if p and p.startswith("/uploads/"):
            filename = os.path.basename(p)
            filepath = os.path.join(uploads_dir, filename)
            if os.path.exists(filepath):
                try:
                    os.remove(filepath)
                    deleted_photos += 1
                except OSError:
                    pass

    return deleted_photos

def clear_archived_vehicles():
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute(
                """
                SELECT document_photo
                FROM vehicles
                WHERE is_unloaded = 1 AND document_photo != ''
                """
            )
            photos = [r["document_photo"] for r in cursor.fetchall()]

            cursor.execute("DELETE FROM vehicles WHERE is_unloaded = 1")
            deleted_count = cursor.rowcount

        conn.commit()
        deleted_photos = _delete_upload_files(photos)

        return {
            "deleted_vehicles": deleted_count,
            "deleted_photos": deleted_photos,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def reset_all_vehicles():
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT document_photo FROM vehicles WHERE document_photo != ''")
            photos = [r["document_photo"] for r in cursor.fetchall()]

            cursor.execute("DELETE FROM vehicles")
            deleted_count = cursor.rowcount

            # SERIAL sequence reset.
            cursor.execute(
                """
                SELECT setval(
                    pg_get_serial_sequence('vehicles', 'id'),
                    1,
                    false
                )
                """
            )

        conn.commit()

        uploads_dir = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "uploads"
        )
        deleted_photos = 0
        if os.path.exists(uploads_dir):
            for fname in os.listdir(uploads_dir):
                if fname.startswith("."):
                    continue
                fpath = os.path.join(uploads_dir, fname)
                if os.path.isfile(fpath):
                    try:
                        os.remove(fpath)
                        deleted_photos += 1
                    except OSError:
                        pass

        return {
            "deleted_vehicles": deleted_count,
            "deleted_photos": deleted_photos,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def export_all_data():
    conn = get_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            cursor.execute("SELECT * FROM vehicles ORDER BY id ASC")
            vehicles = _fetchall(cursor)

            cursor.execute("SELECT * FROM settings")
            settings = {r["key"]: r["value"] for r in cursor.fetchall()}

        return {
            "version": "1.0",
            "database": "PostgreSQL",
            "exported_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "total_records": len(vehicles),
            "settings": settings,
            "vehicles": vehicles,
        }
    finally:
        conn.close()

def import_data_from_json(data):
    if not isinstance(data, dict) or "vehicles" not in data:
        raise ValueError("Geçersiz yedek dosyası formatı.")

    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            settings = data.get("settings", {})
            for k, v in settings.items():
                cursor.execute(
                    """
                    INSERT INTO settings (key, value)
                    VALUES (%s, %s)
                    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
                    """,
                    (k, v),
                )

            vehicles = data.get("vehicles", [])
            imported = 0

            for v in vehicles:
                cursor.execute(
                    """
                    INSERT INTO vehicles (
                        id, tractor_plate, trailer_plate, company_name, arrival_date,
                        gross_weight, net_weight, kantar_weight, package_count,
                        customs_doc_no, dock_number, is_registered, registered_at,
                        is_unloaded, unloaded_amount, unloaded_at, unloaded_note,
                        important_notes, document_photo, status, is_port_entered,
                        port_entered_at, created_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        tractor_plate = EXCLUDED.tractor_plate,
                        trailer_plate = EXCLUDED.trailer_plate,
                        company_name = EXCLUDED.company_name,
                        arrival_date = EXCLUDED.arrival_date,
                        gross_weight = EXCLUDED.gross_weight,
                        net_weight = EXCLUDED.net_weight,
                        kantar_weight = EXCLUDED.kantar_weight,
                        package_count = EXCLUDED.package_count,
                        customs_doc_no = EXCLUDED.customs_doc_no,
                        dock_number = EXCLUDED.dock_number,
                        is_registered = EXCLUDED.is_registered,
                        registered_at = EXCLUDED.registered_at,
                        is_unloaded = EXCLUDED.is_unloaded,
                        unloaded_amount = EXCLUDED.unloaded_amount,
                        unloaded_at = EXCLUDED.unloaded_at,
                        unloaded_note = EXCLUDED.unloaded_note,
                        important_notes = EXCLUDED.important_notes,
                        document_photo = EXCLUDED.document_photo,
                        status = EXCLUDED.status,
                        is_port_entered = EXCLUDED.is_port_entered,
                        port_entered_at = EXCLUDED.port_entered_at,
                        created_at = EXCLUDED.created_at
                    """,
                    (
                        v.get("id"),
                        v.get("tractor_plate", ""),
                        v.get("trailer_plate", ""),
                        v.get("company_name", ""),
                        v.get("arrival_date", ""),
                        v.get("gross_weight"),
                        v.get("net_weight"),
                        v.get("kantar_weight"),
                        v.get("package_count"),
                        v.get("customs_doc_no", ""),
                        v.get("dock_number", ""),
                        v.get("is_registered", 0),
                        v.get("registered_at"),
                        v.get("is_unloaded", 0),
                        v.get("unloaded_amount", ""),
                        v.get("unloaded_at"),
                        v.get("unloaded_note", ""),
                        v.get("important_notes", ""),
                        v.get("document_photo", ""),
                        v.get("status", "YOLDA"),
                        v.get("is_port_entered", 0),
                        v.get("port_entered_at"),
                        v.get("created_at"),
                    ),
                )
                imported += 1

            if vehicles:
                cursor.execute(
                    """
                    SELECT setval(
                        pg_get_serial_sequence('vehicles', 'id'),
                        COALESCE((SELECT MAX(id) FROM vehicles), 1),
                        (SELECT COUNT(*) > 0 FROM vehicles)
                    )
                    """
                )

        conn.commit()
        return imported
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
