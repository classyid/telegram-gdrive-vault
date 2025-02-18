// Konfigurasi Bot
const BOT_TOKEN = '<token-bot-telegram';
const FOLDER_ID = '<id-folder-google-drive>';
const SPREADSHEET_ID = '<id-spreadsheet>';

// URL Webhook yang akan digunakan
const WEBHOOK_URL = '<link ketika sudah dideploy>';

// Sheet names untuk logging
const CHAT_LOG_SHEET = 'Chat Logs';
const ERROR_LOG_SHEET = 'Error Logs';
const WEBHOOK_LOG_SHEET = 'Webhook Logs';
const FILE_LOG_SHEET = 'File Logs';

// Inisialisasi sheets jika belum ada
function setupLoggingSheets() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  
  // Setup Chat Logs
  if (!ss.getSheetByName(CHAT_LOG_SHEET)) {
    const chatSheet = ss.insertSheet(CHAT_LOG_SHEET);
    chatSheet.appendRow(['Timestamp', 'Chat ID', 'Username', 'Message Type', 'Content', 'Raw Data']);
  }
  
  // Setup Error Logs
  if (!ss.getSheetByName(ERROR_LOG_SHEET)) {
    const errorSheet = ss.insertSheet(ERROR_LOG_SHEET);
    errorSheet.appendRow(['Timestamp', 'Function', 'Error Message', 'Stack Trace', 'Additional Info']);
  }
  
  // Setup Webhook Logs
  if (!ss.getSheetByName(WEBHOOK_LOG_SHEET)) {
    const webhookSheet = ss.insertSheet(WEBHOOK_LOG_SHEET);
    webhookSheet.appendRow(['Timestamp', 'Request Method', 'Content Type', 'Payload', 'Response Code']);
  }
  
  // Setup File Logs
  if (!ss.getSheetByName(FILE_LOG_SHEET)) {
    const fileSheet = ss.insertSheet(FILE_LOG_SHEET);
    fileSheet.appendRow(['Timestamp', 'File Name', 'File Type', 'Size (KB)', 'Drive Link', 'Upload Status']);
  }
}

function setWebhook() {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}`;
    const response = UrlFetchApp.fetch(url);
    logWebhook('setWebhook', 'GET', 'N/A', 'Setting webhook', response.getResponseCode());
    return response.getContentText();
  } catch (error) {
    logError('setWebhook', error);
    throw error;
  }
}

function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    logWebhook('doPost', 'POST', e.postData.type, JSON.stringify(contents), 200);
    
    if (!contents || !contents.message) {
      logError('doPost', new Error('Invalid message format'), e.postData.contents);
      return;
    }
    
    const message = contents.message;
    const chatId = message.chat.id;
    const date = new Date(message.date * 1000);
    
    // Log chat message
    logChat(message, date, e.postData.contents);
    
    // Handling commands
    if (message.text && message.text.startsWith('/')) {
      handleCommands(message.text, chatId);
      return;
    }
    
    // Cek jika ada file dalam pesan
    if (message.document) {
      handleDocument(message.document, chatId);
    } else if (message.photo) {
      handlePhoto(message.photo, chatId);
    } else if (message.video) {
      handleVideo(message.video, chatId);
    } else if (message.audio) {  // Tambah handler untuk audio
      handleAudio(message.audio, chatId);
    }
    
  } catch (error) {
    logError('doPost', error, e.postData.contents);
  }
}

function handleAudio(audio, chatId) {
  try {
    const fileId = audio.file_id;
    const fileName = audio.file_name || `audio_${new Date().getTime()}.${getAudioExtension(audio.mime_type)}`;
    const duration = audio.duration;
    
    // Informasi awal
    sendMessage(chatId, '🎵 Memproses file audio...');
    
    // Get file dari Telegram
    const fileUrl = getFileUrl(fileId);
    if (!fileUrl) {
      sendMessage(chatId, '❌ Gagal mendapatkan URL audio. Silakan coba lagi.');
      return;
    }
    
    // Download dan simpan ke Drive
    const response = UrlFetchApp.fetch(fileUrl, {
      muteHttpExceptions: true,
      validateHttpsCertificates: false,
      followRedirects: true,
      timeoutInSeconds: 300
    });
    
    const fileBlob = response.getBlob();
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(fileBlob);
    file.setName(fileName);
    
    const fileLink = file.getUrl();
    const fileSize = Math.round(file.getSize() / (1024 * 1024)); // Size in MB
    
    // Log file
    logFile(fileName, 'audio', fileSize, fileLink, 'Success');
    
    // Format durasi
    let durationText = 'N/A';
    if (duration) {
      const minutes = Math.floor(duration / 60);
      const seconds = duration % 60;
      durationText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Kirim konfirmasi
    const message = `✅ Audio berhasil disimpan!\n\n` +
                   `🎵 Nama file: ${fileName}\n` +
                   `📦 Ukuran: ${fileSize}MB\n` +
                   `⏱ Durasi: ${durationText}\n` +
                   `🎼 Format: ${getAudioExtension(audio.mime_type).toUpperCase()}\n` +
                   `🕒 Waktu: ${new Date().toLocaleString()}\n\n` +
                   `🔗 Link Google Drive:\n${fileLink}`;
    
    Utilities.sleep(1000);
    sendMessage(chatId, message);
    
  } catch (error) {
    console.error('Error in handleAudio:', error);
    logError('handleAudio', error);
    try {
      sendMessage(chatId, '❌ Terjadi kesalahan saat memproses audio.');
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

// Helper function untuk mendapatkan ekstensi audio
function getAudioExtension(mimeType) {
  switch(mimeType) {
    case 'audio/mpeg': return 'mp3';
    case 'audio/mp4': return 'm4a';
    case 'audio/x-m4a': return 'm4a';
    case 'audio/wav': return 'wav';
    case 'audio/ogg': return 'ogg';
    default: return 'audio';
  }
}

function handleCommands(text, chatId) {
  try {
    const command = text.toLowerCase();
    
    switch(command) {
      case '/start':
        sendMessage(chatId, 'Selamat datang! Bot ini dapat menyimpan file ke Google Drive.\n\nCommand yang tersedia:\n/list - Menampilkan daftar file\n/help - Menampilkan bantuan\n/status - Menampilkan status bot');
        break;
      case '/help':
        sendMessage(chatId, 'Cara menggunakan bot:\n\n1. Kirim dokumen/foto/video untuk menyimpan ke Drive\n2. Gunakan /list untuk melihat daftar file\n3. Setiap file akan mendapat link untuk diakses');
        break;
      case '/list':
        listFiles(chatId);
        break;
      case '/status':
        sendBotStatus(chatId);
        break;
      default:
        sendMessage(chatId, 'Command tidak dikenal. Gunakan /help untuk bantuan.');
    }
  } catch (error) {
    logError('handleCommands', error);
    sendMessage(chatId, '❌ Terjadi kesalahan saat memproses command.');
  }
}

function listFiles(chatId) {
  try {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const files = folder.getFiles();
    let fileList = '📁 Daftar File dalam Drive:\n\n';
    let count = 0;
    
    while (files.hasNext() && count < 20) {
      const file = files.next();
      const fileName = file.getName();
      const fileType = file.getMimeType();
      const fileUrl = file.getUrl();
      const fileSize = Math.round(file.getSize() / 1024);
      const dateCreated = file.getDateCreated().toLocaleString();
      
      fileList += `📄 ${fileName}\n`;
      fileList += `📝 Tipe: ${getSimpleFileType(fileType)}\n`;
      fileList += `📦 Ukuran: ${fileSize}KB\n`;
      fileList += `🕒 Dibuat: ${dateCreated}\n`;
      fileList += `🔗 Link: ${fileUrl}\n\n`;
      
      count++;
    }
    
    sendMessage(chatId, count ? fileList : 'Folder masih kosong.');
  } catch (error) {
    logError('listFiles', error);
    sendMessage(chatId, '❌ Terjadi kesalahan saat mengambil daftar file.');
  }
}

function sendBotStatus(chatId) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const fileLogSheet = ss.getSheetByName(FILE_LOG_SHEET);
    const errorLogSheet = ss.getSheetByName(ERROR_LOG_SHEET);
    
    const totalFiles = Math.max(0, fileLogSheet.getLastRow() - 1);
    const totalErrors = Math.max(0, errorLogSheet.getLastRow() - 1);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const files = folder.getFiles();
    let driveFileCount = 0;
    while (files.hasNext()) {
      files.next();
      driveFileCount++;
    }
    
    const status = `📊 Status Bot:\n\n` +
                  `📁 Total file di Drive: ${driveFileCount}\n` +
                  `📝 Total file terlog: ${totalFiles}\n` +
                  `⚠️ Total error: ${totalErrors}\n` +
                  `🕒 Last check: ${new Date().toLocaleString()}`;
    
    sendMessage(chatId, status);
  } catch (error) {
    logError('sendBotStatus', error);
    sendMessage(chatId, '❌ Gagal mengambil status bot.');
  }
}

function handleDocument(document, chatId) {
  try {
    const fileId = document.file_id;
    const fileName = document.file_name || `document_${new Date().getTime()}`;
    const mimeType = document.mime_type;
    const fileExtension = fileName.split('.').pop().toLowerCase();
    
    // Informasi awal sesuai tipe file
    let processingMessage = '📄 Memproses dokumen...';
    if (['mp4', 'mov', 'avi'].includes(fileExtension)) {
      processingMessage = '🎥 Memproses video...';
    } else if (['m4a', 'mp3', 'wav'].includes(fileExtension)) {
      processingMessage = '🎵 Memproses audio...';
    }
    sendMessage(chatId, processingMessage);
    
    // Get file dari Telegram
    const fileUrl = getFileUrl(fileId);
    if (!fileUrl) {
      console.error('Failed to get file URL for document');
      return;
    }
    
    // Download dan simpan ke Drive
    const response = UrlFetchApp.fetch(fileUrl, {
      muteHttpExceptions: true,
      validateHttpsCertificates: false,
      followRedirects: true,
      timeoutInSeconds: 300 // 5 menit timeout untuk file besar
    });
    
    const fileBlob = response.getBlob();
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(fileBlob);
    file.setName(fileName);
    
    const fileLink = file.getUrl();
    const fileSize = Math.round(file.getSize() / (1024 * 1024)); // Size in MB
    
    // Log file
    logFile(fileName, getFileCategory(fileExtension), fileSize, fileLink, 'Success');
    
    // Kirim pesan konfirmasi sesuai tipe file
    let successMessage = '';
    if (['mp4', 'mov', 'avi'].includes(fileExtension)) {
      successMessage = `✅ Video berhasil disimpan!\n\n` +
                      `🎥 Nama file: ${fileName}\n` +
                      `📦 Ukuran: ${fileSize}MB\n` +
                      `🎬 Format: ${fileExtension.toUpperCase()}\n` +
                      `🕒 Waktu: ${new Date().toLocaleString()}\n\n` +
                      `🔗 Link Google Drive:\n${fileLink}`;
    } else if (['m4a', 'mp3', 'wav'].includes(fileExtension)) {
      successMessage = `✅ Audio berhasil disimpan!\n\n` +
                      `🎵 Nama file: ${fileName}\n` +
                      `📦 Ukuran: ${fileSize}MB\n` +
                      `🎼 Format: ${fileExtension.toUpperCase()}\n` +
                      `🕒 Waktu: ${new Date().toLocaleString()}\n\n` +
                      `🔗 Link Google Drive:\n${fileLink}`;
    } else {
      successMessage = `✅ Dokumen berhasil disimpan!\n\n` +
                      `📄 Nama file: ${fileName}\n` +
                      `📦 Ukuran: ${fileSize}MB\n` +
                      `📝 Format: ${fileExtension.toUpperCase()}\n` +
                      `🕒 Waktu: ${new Date().toLocaleString()}\n\n` +
                      `🔗 Link Google Drive:\n${fileLink}`;
    }
    
    // Gunakan timeout sebelum mengirim pesan
    Utilities.sleep(1000);
    sendMessage(chatId, successMessage);
    
  } catch (error) {
    console.error('Error in handleDocument:', error);
    logError('handleDocument', error);
    try {
      sendMessage(chatId, '❌ Terjadi kesalahan saat memproses file.');
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

// Fungsi helper untuk menentukan kategori file
function getFileCategory(extension) {
  const videoFormats = ['mp4', 'mov', 'avi'];
  const audioFormats = ['m4a', 'mp3', 'wav'];
  
  if (videoFormats.includes(extension)) return 'video';
  if (audioFormats.includes(extension)) return 'audio';
  return 'document';
}

function handlePhoto(photos, chatId) {
  try {
    const photo = photos[photos.length - 1];
    const fileId = photo.file_id;
    const fileName = `photo_${new Date().getTime()}.jpg`;
    
    // Get file dari Telegram menggunakan getFileUrl
    const fileUrl = getFileUrl(fileId);
    if (!fileUrl) {
      sendMessage(chatId, '❌ Gagal mendapatkan URL foto. Silakan coba lagi.');
      return;
    }
    
    // Download dan simpan ke Drive
    const response = UrlFetchApp.fetch(fileUrl, {
      muteHttpExceptions: true,
      validateHttpsCertificates: false,
      followRedirects: true
    });
    
    if (response.getResponseCode() !== 200) {
      sendMessage(chatId, '❌ Gagal mengunduh foto. Silakan coba lagi.');
      return;
    }
    
    const fileBlob = response.getBlob();
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(fileBlob);
    file.setName(fileName);
    
    const fileLink = file.getUrl();
    const fileSize = Math.round(file.getSize() / 1024);
    
    // Log file
    logFile(fileName, 'photo', fileSize, fileLink, 'Success');
    
    // Kirim pesan konfirmasi
    const message = `✅ Foto berhasil disimpan!\n\n` +
                   `📷 Nama file: ${fileName}\n` +
                   `📦 Ukuran: ${fileSize}KB\n` +
                   `🕒 Waktu: ${new Date().toLocaleString()}\n\n` +
                   `🔗 Link Google Drive:\n${fileLink}`;
    
    Utilities.sleep(1000);
    sendMessage(chatId, message);
    
  } catch (error) {
    console.error('Error in handlePhoto:', error);
    logError('handlePhoto', error);
    try {
      sendMessage(chatId, '❌ Terjadi kesalahan saat memproses foto.');
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

function handleVideo(video, chatId) {
  try {
    const fileId = video.file_id;
    const fileName = `video_${new Date().getTime()}.mp4`;
    const fileSize = video.file_size ? Math.round(video.file_size / (1024 * 1024)) : 0; // Convert to MB
    
    // Informasi awal ke user
    sendMessage(chatId, `🎥 Memproses video...\nUkuran: ${fileSize}MB\nMohon tunggu sebentar...`);
    
    // Get file dari Telegram menggunakan getFileUrl
    const fileUrl = getFileUrl(fileId);
    if (!fileUrl) {
      sendMessage(chatId, '❌ Gagal mendapatkan URL video. Silakan coba lagi.');
      return;
    }
    
    // Download dan simpan ke Drive dengan konfigurasi khusus
    const response = UrlFetchApp.fetch(fileUrl, {
      muteHttpExceptions: true,
      validateHttpsCertificates: false,
      followRedirects: true,
      timeoutInSeconds: 300 // 5 menit timeout
    });
    
    if (response.getResponseCode() !== 200) {
      sendMessage(chatId, '❌ Gagal mengunduh video. Silakan coba lagi.');
      return;
    }
    
    const fileBlob = response.getBlob();
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(fileBlob);
    file.setName(fileName);
    
    const fileLink = file.getUrl();
    const actualSize = Math.round(file.getSize() / (1024 * 1024)); // Size in MB
    
    // Log file
    logFile(fileName, 'video', actualSize, fileLink, 'Success');
    
    // Kirim konfirmasi dengan detail lengkap
    const message = `✅ Video berhasil disimpan!\n\n` +
                   `🎥 Nama: ${fileName}\n` +
                   `📦 Ukuran: ${actualSize}MB\n` +
                   `🕒 Waktu: ${new Date().toLocaleString()}\n\n` +
                   `🔗 Link Google Drive:\n${fileLink}`;
    
    Utilities.sleep(1000);
    sendMessage(chatId, message);
    
  } catch (error) {
    console.error('Error in handleVideo:', error);
    logError('handleVideo', error);
    try {
      sendMessage(chatId, '❌ Terjadi kesalahan saat memproses video. Silakan coba lagi.');
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

function downloadAndSave(fileId, fileName, fileType, chatId, mimeType) {
  try {
    const fileUrl = getFileUrl(fileId);
    if (!fileUrl) {
      logError('downloadAndSave', new Error('Failed to get file URL'));
      sendMessage(chatId, '❌ Gagal mendapatkan file URL');
      return;
    }
    
    const response = UrlFetchApp.fetch(fileUrl);
    const fileBlob = response.getBlob();
    
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(fileBlob);
    file.setName(fileName);
    
    const fileLink = file.getUrl();
    const fileSize = Math.round(file.getSize() / 1024);
    
    // Log file upload
    logFile(fileName, fileType, fileSize, fileLink, 'Success');
    
    // Kirim konfirmasi detail
    const message = `✅ File berhasil disimpan!\n\n` +
                   `📄 Nama: ${fileName}\n` +
                   `📝 Tipe: ${getSimpleFileType(mimeType)}\n` +
                   `📦 Ukuran: ${fileSize}KB\n` +
                   `🕒 Waktu: ${new Date().toLocaleString()}\n` +
                   `🔗 Link: ${fileLink}`;
    
    sendMessage(chatId, message);
    
  } catch (error) {
    logError('downloadAndSave', error);
    logFile(fileName, fileType, 0, '', 'Failed');
    sendMessage(chatId, `❌ Terjadi kesalahan saat menyimpan file: ${error.toString()}`);
  }
}

function getFileUrl(fileId) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`;
    const response = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true
    });
    const data = JSON.parse(response.getContentText());
    
    if (data.ok && data.result.file_path) {
      return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
    }
    
    console.error('Failed to get file URL:', data);
    return null;
  } catch (error) {
    console.error('Error in getFileUrl:', error);
    logError('getFileUrl', error);
    return null;
  }
}

// Tambahan helper function untuk mengecek ukuran file
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function sendMessage(chatId, text) {
  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const options = {
      method: 'post',
      muteHttpExceptions: true,
      payload: {
        chat_id: String(chatId), // Pastikan chatId dalam bentuk string
        text: text,
        parse_mode: 'HTML'
      }
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseData = JSON.parse(response.getContentText());
    
    // Log response untuk debugging
    console.log('Telegram Response:', responseData);
    
    // Jika gagal, coba format chat ID yang berbeda
    if (!responseData.ok) {
      options.payload.chat_id = Number(chatId); // Coba dengan format number
      const retryResponse = UrlFetchApp.fetch(url, options);
      const retryData = JSON.parse(retryResponse.getContentText());
      
      if (!retryData.ok) {
        throw new Error(`Failed to send message: ${retryData.description}`);
      }
    }

  } catch (error) {
    console.error('Error in sendMessage:', error);
    logError('sendMessage', error);
  }
}

function logChat(message, date, rawData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(CHAT_LOG_SHEET);
    const messageType = getMessageType(message);
    const content = getMessageContent(message);
    
    sheet.appendRow([
      date,
      message.chat.id,
      message.chat.username || 'N/A',
      messageType,
      content,
      rawData
    ]);
  } catch (error) {
    console.error('Error in logChat:', error);
  }
}

function logError(functionName, error, additionalInfo = '') {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(ERROR_LOG_SHEET);
    sheet.appendRow([
      new Date(),
      functionName,
      error.toString(),
      error.stack || 'No stack trace',
      additionalInfo
    ]);
  } catch (e) {
    console.error('Error in logError:', e);
  }
}

function logWebhook(functionName, method, contentType, payload, responseCode) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(WEBHOOK_LOG_SHEET);
    sheet.appendRow([
      new Date(),
      method,
      contentType,
      payload,
      responseCode
    ]);
  } catch (error) {
    console.error('Error in logWebhook:', error);
  }
}

function logFile(fileName, fileType, size, driveLink, status) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(FILE_LOG_SHEET);
    sheet.appendRow([
      new Date(),
      fileName,
      fileType,
      size,
      driveLink,
      status
    ]);
  } catch (error) {
    console.error('Error in logFile:', error);
  }
}

// Update getMessageType untuk mengenali audio
function getMessageType(message) {
  if (message.document) return 'Document';
  if (message.photo) return 'Photo';
  if (message.video) return 'Video';
  if (message.audio) return 'Audio';
  if (message.text) return 'Text';
  return 'Other';
}

function getMessageContent(message) {
  if (message.document) return message.document.file_name;
  if (message.photo) return 'Photo';
  if (message.video) return 'Video';
  if (message.text) return message.text;
  return 'Unknown content';
}

function getSimpleFileType(mimeType) {
  if (!mimeType) return 'Unknown';
  
  // Audio types
  if (mimeType.includes('audio/mpeg') || 
      mimeType.includes('audio/mp4') || 
      mimeType.includes('audio/x-m4a') ||
      mimeType.includes('audio/wav')) return 'Audio';
      
  // Image types
  if (mimeType.includes('image')) return 'Gambar';
  
  // Video types
  if (mimeType.includes('video')) return 'Video';
  
  // Document types
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('msword') || 
      mimeType.includes('wordprocessingml')) return 'Word';
  if (mimeType.includes('spreadsheetml') || 
      mimeType.includes('ms-excel')) return 'Excel';
  if (mimeType.includes('presentationml') || 
      mimeType.includes('ms-powerpoint')) return 'PowerPoint';
  
  // Other types  
  if (mimeType.includes('text/plain')) return 'Text';
  if (mimeType.includes('application/zip')) return 'ZIP';
  if (mimeType.includes('application/rar')) return 'RAR';
  
  return 'File';
}

// Update getMessageContent untuk mengenali audio
function getMessageContent(message) {
  if (message.document) return message.document.file_name;
  if (message.photo) return 'Photo';
  if (message.video) return 'Video';
  if (message.audio) return message.audio.file_name || 'Audio';
  if (message.text) return message.text;
  return 'Unknown content';
}

// Jalankan setup saat deploy
function setup() {
  try {
    setupLoggingSheets();
    const webhookResponse = setWebhook();
    console.log('Setup completed. Webhook response:', webhookResponse);
    return 'Setup completed successfully';
  } catch (error) {
    console.error('Setup failed:', error);
    return 'Setup failed: ' + error.toString();
  }
}
