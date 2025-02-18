# 📁 Telegram Drive Guardian

Bot Telegram yang memungkinkan penyimpanan otomatis file ke Google Drive dengan sistem logging terintegrasi menggunakan Google Spreadsheet.

## 🌟 Fitur Utama

### 📊 Database Spreadsheet
- **Chat Logs** - Mencatat riwayat percakapan dan interaksi
- **Error Logs** - Tracking error untuk pemeliharaan
- **Webhook Logs** - Monitoring aktivitas webhook
- **File Logs** - Pencatatan detail file yang diupload

### 📂 Dukungan Format File
- 📄 Dokumen (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT)
- 🖼️ Gambar (JPG, JPEG, PNG, GIF)
- 🎥 Video (MP4, MOV, AVI)
- 🎵 Audio (MP3, M4A, WAV, OGG)
- 📦 Arsip (ZIP, RAR)

### ⚡ Fitur Bot
- `/start` - Pesan selamat datang & informasi penggunaan
- `/help` - Panduan lengkap penggunaan bot
- `/list` - Menampilkan daftar file tersimpan
- `/status` - Menampilkan status dan statistik bot

### 🔍 Informasi File
- Nama file
- Ukuran file
- Format file
- Link Google Drive
- Waktu upload
- Status upload

### 🛡️ Keamanan
- Validasi file
- Timeout handling
- Error logging
- Backup sistem

## 🚀 Cara Penggunaan

1. Start bot di Telegram
2. Kirim file yang ingin disimpan
3. Bot akan memproses dan menyimpan ke Drive
4. Dapatkan link akses file
5. Pantau status di dashboard

## ⚙️ Setup & Instalasi

### Prasyarat
- Google Account
- Google Apps Script
- Telegram Bot Token
- Google Drive Folder
- Google Spreadsheet

### Langkah Instalasi
1. Clone repository
2. Setup Google Apps Script
3. Konfigurasi Telegram Bot
4. Setup Spreadsheet
5. Deploy webhook
6. Test bot

## 📝 Konfigurasi

Sesuaikan variabel berikut di `Code.gs`:
```javascript
const BOT_TOKEN = 'YOUR_BOT_TOKEN';
const FOLDER_ID = 'YOUR_DRIVE_FOLDER_ID';
const SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
