import database
from datetime import datetime, timedelta

def seed():
    database.init_db()
    # Mevcut verileri kontrol et
    existing = database.get_vehicles()
    if len(existing) > 5:
        print("Veritabanında zaten veri var.")
        return

    now = datetime.now()
    
    # 1. Araç: Yolda (Henüz tescil yapılmamış)
    database.add_vehicle(
        tractor_plate="34 KTL 450",
        trailer_plate="34 TR 890",
        company_name="Ekol Lojistik",
        arrival_date=(now + timedelta(hours=1)).strftime('%Y-%m-%d %H:%M'),
        gross_weight=24200,
        package_count=33,
        customs_doc_no="24TR0018942"
    )

    # 2. Araç: Kapıda / Tescil Yapıldı / Depo Atandı (Depo 2)
    v2_id = database.add_vehicle(
        tractor_plate="35 BRS 112",
        trailer_plate="35 DS 990",
        company_name="Barsan Global",
        arrival_date=now.strftime('%Y-%m-%d %H:%M'),
        gross_weight=18500,
        package_count=26,
        customs_doc_no="24TR0024510"
    )
    database.update_vehicle(v2_id, dock_number="Depo 2")
    database.toggle_tescil(v2_id, force_state=True)

    # 3. Araç: Rampa 1'de / Tescil Yapıldı
    v3_id = database.add_vehicle(
        tractor_plate="06 ANK 776",
        trailer_plate="06 DOR 551",
        company_name="Sertrans Logistics",
        arrival_date=(now - timedelta(hours=1)).strftime('%Y-%m-%d %H:%M'),
        gross_weight=21000,
        package_count=30,
        customs_doc_no="24TR0031129"
    )
    database.update_vehicle(v3_id, dock_number="Rampa 1")
    database.toggle_tescil(v3_id, force_state=True)

    # 4. Araç: Bugün Boşaltıldı / Arşivde
    v4_id = database.add_vehicle(
        tractor_plate="16 BUR 902",
        trailer_plate="16 TL 330",
        company_name="Alışan Lojistik",
        arrival_date=(now - timedelta(hours=3)).strftime('%Y-%m-%d %H:%M'),
        gross_weight=26000,
        package_count=33,
        customs_doc_no="24TR0009988"
    )
    database.toggle_tescil(v4_id, force_state=True)
    database.complete_unloading(v4_id, unloaded_amount="26.000 KG (33 Palet)", unloaded_note="Eksiksiz ve hasarsız teslim alındı", dock_number="Depo 1")

    print("Örnek araç verileri başarıyla yüklendi.")

if __name__ == '__main__':
    seed()
