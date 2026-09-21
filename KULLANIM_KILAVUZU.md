# 🚚 Tır & Yük Boşaltma / Rampa Takip Sistemi

Bu sistem; antrepo ve depolara gelen tırların yoldayken şoför veya nakliye temsilcileri tarafından sisteme bildirilmesini, operasyon ekibinin ise gelen araçları canlı olarak izleyip **depo/rampa ataması yapmasını, tescil onayı vermesini, boşaltma miktarını kaydetmesini ve firma bazlı günlük raporlar almasını** sağlar.

---

## ⚡ Hızlı Başlatma

Sistemi başlatmak için klasördeki **`baslat.bat`** dosyasına **çift tıklamanız** yeterlidir.

Alternatif olarak terminalden:
```bash
python app.py
```

Sistem açıldığında ekranda iki adet bağlantı adresi göreceksiniz:
1. **🖥️ Bilgisayarınızdan kullanmak için:**  
   👉 [http://localhost:8000](http://localhost:8000)

2. **📱 Telefondan / Tabletten kullanmak için (Aynı Wi-Fi ağına bağlıyken):**  
   👉 `http://<Bilgisayarınızın-Yerel-IP-Adresi>:8000` (Örn: `http://192.168.1.35:8000`)

---

## 🔑 Giriş Bilgileri

* **Şoför / Nakliyeci Kayıt Formu:**  
  Herkese açıktır (Şifresiz). Doğrudan ana sayfaya (`/`) girilir.
* **Operasyon & Rampa Yönetim Paneli:**  
  * **Kullanıcı Adı:** `sistem`  
  * **Şifre:** `.env` / hosting ortam değişkenindeki `OPERATIONS_PASSWORD` değeri

---

## 📋 Sistem Özellikleri ve Kullanımı

### 1. Şoför & Nakliyeci Kayıt Ekranı (`/` veya `/kayit`)
* **🏢 Sistem Gümrük Müşavirliği Logosu:** Şoför giriş ekranının en üstünde yer alan resmi kurumsal logo ile profesyonel bir görünüm sunulur.
* **📍 Boşaltma Konumu & Navigasyon:** Şoförler sayfanın en üstündeki yeşil karttan veya kayıt tamamlandıktan sonra açılan ekrandan **"Google Haritalar'da Aç"** butonuna tıklayarak doğrudan boşaltma tesisine navigasyon başlatabilir.
  * [Google Maps Konumu](https://maps.app.goo.gl/F9ELLLUwNawegT8r5?g_st=iw)
* **⚠️ Varış Saati & Cezalandırma Politikası Uyarısı:** Varış saatinin altına eklenen kırmızı dikkat kutusuyla şoförlere; belirtilen saatte gelmemeleri durumunda cezalandırma politikası uygulanacağı ve gün sonuna bırakılarak **en son boşaltmaya tabi tutulacakları** açıkça hatırlatılır.
* **📢 Operasyon Duyuruları:** Operasyon ekibinin belirlediği güncel duyurular şoför formunun en üstünde sarı kutuda canlı görünür.
* **Zorunlu Alanlar:** Çekici Plaka, Dorse Plaka, **Alıcı Firma**, Varış Tarihi/Saati (ETA).
* **📸 Taşıma Belgesi Fotoğrafı (T1 / Tır Karnesi):** Şoförler telefonun kamerasını açarak tek dokunuşla T1 veya Tır Karnesi belgesinin fotoğrafını çekip sisteme yükleyebilir (galeriden veya dosyadan seçme de desteklenir).
* **Opsiyonel Alanlar:** Brüt Ağırlık (kg/ton), Kap Adedi, T1 / Tır Karnesi No, Varsa Önemli Not (örn: vinç gerekir, soğuk zincir vb.).
* **📋 Canlı Boşaltma Onayı & Depo Takip Listesi:** Şoför kayıt formunun hemen altında, operasyon tarafından **boşaltma onayı verilmiş araçların plaka bilgileri, atanmış depo/rampa numaraları ve onay zamanları** canlı olarak listelenir. Şoförler arama kutusuna plakalarını yazarak boşaltma yapacakları deponun belirlenip belirlenmediğini anlık takip edebilir. Liste her 20 saniyede bir otomatik yenilenir.

### 2. Operasyon Paneli (`/operasyon`)
* **🔑 Operasyon Şifresi Değiştirme Modülü (Yönetici Yetkili):**
  * Üst menüdeki **"Şifre Değiştir"** butonu ile açılan modülden `sistem` kullanıcısının giriş şifresi değiştirilebilir.
  * Güvenlik amacıyla bu işlem yalnızca yönetici bilgileriyle yapılabilir:
    * **Yönetici Kullanıcı Adı:** `admin`
    * **Yönetici Şifresi:** `.env` / hosting ortam değişkenindeki `ADMIN_PASSWORD` değeri
  * Değiştirilen şifre veritabanına anında işlenir ve sistem yeniden başlasa da kalıcı olur.
* **⚠️ 3 Gün İçinde Mükerrer Plaka Uyarısı:**
  * Araçlar birden fazla kez sisteme kayıt girebilir (mükerrer kayda izin verilir).
  * Ancak aynı plakadan (büyük/küçük harf ve boşluk fark etmeksizin) **son 3 gün (72 saat) içinde** başka bir kayıt varsa, operasyon tablosunda ve mobil kartlarda plakanın hemen yanında sarı renkli **"⚠️ 3 Günde Mükerrer"** rozeti görüntülenir. Üzerine gelindiğinde diğer kaydın tarihini gösterir.
* **💾 Veritabanı Yönetimi & Yedekleme:** Üst çubuktaki **"Veritabanı & Yedek"** butonuna tıklandığında açılan yönetim merkezinden:
  * Veritabanının dosya boyutu, yüklenen evrak disk alanı ve toplam araç sayıları anlık incelenebilir.
  * **SQLite (.db)** veya **JSON (.json)** formatında tüm veritabanı yedeği tek tıkla bilgisayara indirilebilir.
  * Daha önce alınmış bir yedek dosyası seçilerek sisteme geri yüklenebilir.
  * **Sadece Arşivi Temizle:** Yoldaki aktif araçlara dokunmadan sadece boşaltılmış geçmiş araçlar silinebilir.
  * **Tüm Veritabanını Sıfırla:** Güvenlik onay kodu (`SIFIRLA`) ile sistem fabrika ayarlarına döndürülebilir.
* **📸 Belge Fotoğrafı İnceleme (Lightbox):** Şoförün yüklediği T1 veya Tır Karnesi fotoğrafı, araç kartında ve tabloda sarı **"Belge Foto"** butonuyla görüntülenir. Tıklandığında fotoğraf yüksek çözünürlüklü olarak ekranda açılır, büyütülebilir veya bilgisayara/telefona indirilebilir.
* **📢 Şoför Duyurusu Yönetimi:** Üst bardaki **"Şoför Duyurusu"** butonuna basarak şoför formundaki sarı bilgilendirme metnini dilediğiniz an değiştirebilirsiniz.
* **Önemli Notlar Gösterimi:** Bir araçta şoför veya operatör tarafından girilmiş önemli bir not varsa tabloda ve mobil kartta uyarı rozetiyle öne çıkarılır.
* **⚓ Liman Giriş Kaydı (Liman Girişi Yapıldı):** Araç limana/sahaya giriş yaptığında tek tıkla işaretlenebilir. Giriş yapıldığı saat otomatik olarak sisteme kaydedilir. Hem masaüstü tablodan anahtarla (toggle) hem de mobil kartlardan tek dokunuşla yönetilebilir.
* **🕒 Sisteme Giriş Tarihi ve Saati Takibi:** Şoför veya personelin araç kaydını sisteme ilk girdiği an (`created_at`), operasyon tablosunda "Varış / Kayıt" sütununda, mobil kartlarda ve araç detay düzenleme penceresinde net olarak gösterilir.
* **Tescil Onayı:** Tescil yapıldığında tek tıkla işaretlenir; tescilin onaylandığı saat otomatik kaydedilir.
* **Boşaltma Depo / Rampa No:** Hızlı butonlar (Depo 1, Depo 2, Rampa 1 vb.) veya serbest metinle atanabilir.
* **✅ Boşaltma Onayı:** Operasyon tablosundaki **"Boşaltma Onayı"** sütununda yer alan **"Boşaltma Onayla"** butonu ile araca hızlıca boşaltma onayı verilir. Miktar girişi opsiyoneldir (boş bırakılırsa doğrudan *"Onaylandı"* olarak işlenir) ve onaylanan araçlar anında şoför bilgi ekranındaki takip listesine düşer.
* **Canlı Takip:** Ekran her 25 saniyede bir otomatik güncellenir; bilgisayar ile telefon senkronize kalır.

### 3. Firma & Günlük Raporlama (`/operasyon` -> Raporlar Sekmesi)
* **Tarih Filtreleri:** "Bugün", "Dün", "Bu Hafta", "Bu Ay" veya özel iki tarih arası seçim.
* **Alıcı Firma Filtresi:** Açılır kutudan seçilen spesifik firmanın tüm araçları anında listelenir.
* **Özet Metrikler:** Filtrelenen kriterlerdeki toplam araç sayısı, tescil yapılanlar ve boşaltılanlar anlık hesaplanır.
* **⚓ Liman Girişi, Mükerrer Kayıt ve Sisteme Kayıt Gösterimi:** Rapor tablosunda ve Excel çıktısında araçların sisteme kayıt tarihi, liman giriş zamanı, tescil onay zamanları ve 3 günlük mükerrer durumu ayrıntılı listelenir.
* **📸 Rapor Tablosunda Belge Kontrolü:** Rapor tablosunda her aracın gümrük belge no ve varsa yüklenmiş belge fotoğrafı butonu yer alır.
* **Excel İndir (.xlsx):** Tek tıkla tüm filtrelenmiş veriler renklendirilmiş ve biçimlendirilmiş resmi bir Excel tablosu olarak bilgisayara indirilir. Sisteme kayıt zamanı, liman giriş kaydı ve zamanı, mükerrer araç durumu ile belge fotoğrafı durumları Excel'e eksiksiz aktarılır.

---

## 💾 Veri Güvenliği ve İnternet Yayını
* Tüm veriler SQLite veritabanında saklanır. İnternette (Render, Railway, VPS vb.) yayınlandığında `.gitignore` ve `Procfile` dosyaları hazırdır.
* Detaylı bulut kurulumu için **`README.md`** dosyasını inceleyebilirsiniz.
