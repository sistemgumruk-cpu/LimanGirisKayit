# TIR Rampa / Operasyon Takip Sistemi

Python + Flask tabanlı operasyon takip uygulaması.

## GitHub'a yükleme

Bu proje **GitHub Pages için değildir**. Flask sunucusu gerektirir. GitHub kaynak kodunun tutulduğu yerdir; uygulama Render, Railway veya benzeri bir Python hosting servisinde çalıştırılmalıdır.

## Ortam değişkenleri

`.env.example` dosyasını `.env` olarak kopyalayın ve gerçek değerleri girin. `.env` GitHub'a gönderilmez.

Gerekli değişkenler:

- `SECRET_KEY`
- `OPERATIONS_USERNAME`
- `OPERATIONS_PASSWORD`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `MAPS_URL`
- `PORT` (hosting sağlayıcısı tarafından veriliyorsa otomatik kullanılabilir)

## Yerelde çalıştırma

```bash
python -m venv .venv
.venv\\Scripts\\activate
pip install -r requirements.txt
python -m flask --app app run --host=0.0.0.0 --port=8000
```

## Render / benzeri hosting

Build command:

```bash
pip install -r requirements.txt
```

Start command:

```bash
gunicorn app:app
```

Ortam değişkenlerini hosting panelinden tanımlayın; gerçek şifreleri GitHub'a koymayın.

## Veritabanı notu

Uygulama şu an SQLite kullanır. Bulut ortamında kalıcı veri için PostgreSQL'e geçiş önerilir. SQLite dosyası `.gitignore` ile GitHub dışında tutulur.

## Yüklenen dosyalar

`uploads/` klasöründeki kullanıcı yüklemeleri GitHub'a gönderilmez.
