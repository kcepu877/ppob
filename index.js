// ============================================
// TELEGRAM BOT MULTI-FILE DENGAN MENU
// CF WORKERS + GITHUB + ADMIN ONLY
// ============================================

// KONFIGURASI - akan diisi dari environment
let CONFIG = {};

// Session storage (in-memory)
const sessions = new Map();

// ============================================
// GITHUB API FUNCTIONS (DIPERBAIKI)
// ============================================

async function getFileContent(fileKey) {
  const fileConfig = CONFIG.FILES[fileKey];
  if (!fileConfig) return { error: 'File tidak ditemukan' };
  
  try {
    const url = `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${fileConfig.path}`;
    console.log('Fetching:', url);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'Telegram-Bot-CF-Worker'
      }
    });
    
    console.log('GitHub Response Status:', response.status);
    
    // Handle 404 - file belum ada
    if (response.status === 404) {
      return { content: '', sha: null, exists: false };
    }
    
    // Handle 401/403 - token error
    if (response.status === 401) {
      return { error: '❌ Token GitHub tidak valid! Periksa GITHUB_TOKEN di dashboard.' };
    }
    
    if (response.status === 403) {
      return { error: '❌ Akses ditolak! Periksa scope token GitHub (butuh repo).' };
    }
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('GitHub Error:', errorData);
      return { error: `❌ HTTP ${response.status}: ${errorData.substring(0, 100)}` };
    }
    
    const data = await response.json();
    const content = atob(data.content);
    return { content, sha: data.sha, exists: true };
    
  } catch (error) {
    console.error('Error reading file:', error);
    return { error: `❌ Error: ${error.message}` };
  }
}

async function updateFileContent(fileKey, newContent, sha = null) {
  const fileConfig = CONFIG.FILES[fileKey];
  if (!fileConfig) return { error: 'File tidak ditemukan' };
  
  try {
    // Jika file belum ada, buat baru
    const body = {
      message: `Update ${fileConfig.name}.txt via Telegram Bot`,
      content: btoa(unescape(encodeURIComponent(newContent))),
      sha: sha // Kalau null, GitHub akan buat file baru
    };
    
    const response = await fetch(
      `https://api.github.com/repos/${CONFIG.REPO_OWNER}/${CONFIG.REPO_NAME}/contents/${fileConfig.path}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
          'User-Agent': 'Telegram-Bot-CF-Worker'
        },
        body: JSON.stringify(body)
      }
    );
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('GitHub Update Error:', errorData);
      return { error: `❌ HTTP ${response.status}: ${errorData.substring(0, 100)}` };
    }
    
    return { success: true };
    
  } catch (error) {
    console.error('Error updating file:', error);
    return { error: `❌ Error: ${error.message}` };
  }
}

// ============================================
// TELEGRAM FUNCTIONS
// ============================================

async function sendMessage(chatId, text, parseMode = 'Markdown', extra = {}) {
  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
      ...extra
    };
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

async function sendKeyboard(chatId, text, keyboard, parseMode = 'Markdown') {
  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`;
    const body = {
      chat_id: chatId,
      text: text,
      parse_mode: parseMode,
      reply_markup: {
        inline_keyboard: keyboard,
        resize_keyboard: true
      }
    };
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error('Error sending keyboard:', error);
  }
}

async function answerCallback(callbackId, text = '') {
  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/answerCallbackQuery`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackId,
        text: text,
        show_alert: false
      })
    });
  } catch (error) {
    console.error('Error answering callback:', error);
  }
}

async function editMessage(chatId, messageId, text, keyboard = null) {
  try {
    const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/editMessageText`;
    const body = {
      chat_id: chatId,
      message_id: messageId,
      text: text,
      parse_mode: 'Markdown'
    };
    
    if (keyboard) {
      body.reply_markup = { inline_keyboard: keyboard };
    }
    
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (error) {
    console.error('Error editing message:', error);
  }
}

// ============================================
// 🔐 ADMIN CHECK
// ============================================

function isAuthorized(chatId) {
  const admins = CONFIG.ADMIN_IDS || [];
  return admins.includes(chatId);
}

async function checkAuth(chatId) {
  if (!isAuthorized(chatId)) {
    await sendMessage(chatId, `
🚫 *Akses Ditolak!*

Anda tidak memiliki izin untuk menggunakan bot ini.

👤 ID Telegram Anda: \`${chatId}\`

Jika Anda adalah admin, tambahkan ID ini ke daftar admin.
    `);
    return false;
  }
  return true;
}

// ============================================
// MENU BUILDERS
// ============================================

function buildMainMenu() {
  return [
    [
      { text: '🇭🇰 HK', callback_data: 'file_hk' },
      { text: '🇺🇸 SDNY', callback_data: 'file_sdny' },
      { text: '🇸🇬 SGP', callback_data: 'file_sgp' }
    ],
    [
      { text: '📊 STATUS SEMUA', callback_data: 'status_all' }
    ]
  ];
}

function buildFileMenu(fileKey) {
  return [
    [
      { text: '✏️ Edit Baris Terakhir', callback_data: `edit_last_${fileKey}` },
      { text: '📝 Tulis Baru', callback_data: `write_new_${fileKey}` }
    ],
    [
      { text: '📤 Kirim = Simpan', callback_data: `save_${fileKey}` },
      { text: '↩️ Kembali', callback_data: 'back_to_menu' }
    ]
  ];
}

// ============================================
// HANDLER FUNCTIONS
// ============================================

async function handleMainMenu(chatId, messageId = null) {
  if (!await checkAuth(chatId)) return;
  
  const text = `
📊 *MENU UTAMA*

Pilih file yang ingin diedit:

🇭🇰 *HK* - Data Hongkong
🇺🇸 *SDNY* - Data Sidney  
🇸🇬 *SGP* - Data Singapore

📌 *Status:* Terhubung ke GitHub
👤 *Admin ID:* \`${chatId}\`
  `;
  
  const keyboard = buildMainMenu();
  
  if (messageId) {
    await editMessage(chatId, messageId, text, keyboard);
  } else {
    await sendKeyboard(chatId, text, keyboard);
  }
}

async function handleFileView(chatId, fileKey, messageId = null) {
  if (!await checkAuth(chatId)) return;
  
  const fileConfig = CONFIG.FILES[fileKey];
  const result = await getFileContent(fileKey);
  
  // Kirim pesan error yang jelas
  if (result.error) {
    await sendMessage(chatId, `
❌ *Gagal membaca file ${fileConfig.name}*

${result.error}

💡 *Solusi:*
1. Periksa GITHUB_TOKEN di dashboard
2. Pastikan token punya scope \`repo\`
3. Pastikan file \`${fileConfig.path}\` ada di repo
4. Periksa REPO_OWNER dan REPO_NAME
    `);
    return;
  }
  
  const content = result.content || '(File kosong)';
  const displayContent = content.length > 3000 
    ? content.substring(0, 3000) + '\n\n... *(file terlalu panjang)*'
    : content;
  
  const text = `
📁 *FILE: ${fileConfig.emoji} ${fileConfig.name}*

\`\`\`
${displayContent}
\`\`\`

📊 *Statistik:*
• Baris: ${content.split('\n').length}
• Karakter: ${content.length}
• SHA: \`${result.sha ? result.sha.substring(0, 8) : 'N/A'}\`

Pilih aksi:
  `;
  
  const keyboard = buildFileMenu(fileKey);
  
  if (messageId) {
    await editMessage(chatId, messageId, text, keyboard);
  } else {
    await sendKeyboard(chatId, text, keyboard);
  }
  
  sessions.set(`${chatId}_current_file`, fileKey);
  sessions.set(`${chatId}_current_sha`, result.sha);
  sessions.set(`${chatId}_current_content`, content);
}

async function handleStatusAll(chatId) {
  if (!await checkAuth(chatId)) return;
  
  let text = '📊 *STATUS SEMUA FILE*\n\n';
  let allOk = true;
  
  for (const [key, config] of Object.entries(CONFIG.FILES)) {
    const result = await getFileContent(key);
    if (result.error) {
      text += `❌ ${config.emoji} *${config.name}*: ${result.error}\n`;
      allOk = false;
    } else {
      const lines = result.content ? result.content.split('\n').length : 0;
      const chars = result.content ? result.content.length : 0;
      text += `✅ ${config.emoji} *${config.name}*: ${lines} baris, ${chars} karakter\n`;
    }
  }
  
  if (!allOk) {
    text += '\n⚠️ Ada error! Periksa token GitHub dan repository.';
  }
  
  text += '\n\n↩️ Klik kembali untuk ke menu utama';
  
  const keyboard = [
    [{ text: '↩️ Kembali ke Menu', callback_data: 'back_to_menu' }]
  ];
  
  await sendKeyboard(chatId, text, keyboard);
}

async function handleEditLastLine(chatId, fileKey, messageId) {
  if (!await checkAuth(chatId)) return;
  
  const result = await getFileContent(fileKey);
  if (result.error) {
    await sendMessage(chatId, `❌ ${result.error}`);
    return;
  }
  
  const lines = result.content ? result.content.split('\n') : [];
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : '(file kosong)';
  
  sessions.set(`${chatId}_edit_mode`, 'edit_last');
  sessions.set(`${chatId}_edit_file`, fileKey);
  sessions.set(`${chatId}_edit_lines`, lines);
  sessions.set(`${chatId}_edit_sha`, result.sha);
  
  const text = `
✏️ *EDIT BARIS TERAKHIR*

Baris terakhir saat ini:
\`\`\`
${lastLine}
\`\`\`

📝 Kirimkan *teks baru* untuk mengganti baris terakhir.
  `;
  
  const keyboard = [
    [{ text: '❌ Batal', callback_data: 'cancel_edit' }]
  ];
  
  await editMessage(chatId, messageId, text, keyboard);
}

async function handleWriteNew(chatId, fileKey, messageId) {
  if (!await checkAuth(chatId)) return;
  
  const result = await getFileContent(fileKey);
  if (result.error) {
    await sendMessage(chatId, `❌ ${result.error}`);
    return;
  }
  
  sessions.set(`${chatId}_edit_mode`, 'write_new');
  sessions.set(`${chatId}_edit_file`, fileKey);
  sessions.set(`${chatId}_edit_content`, result.content || '');
  sessions.set(`${chatId}_edit_sha`, result.sha);
  
  const text = `
📝 *TULIS BARU*

Kirimkan *teks baru* untuk ditambahkan ke file.

*Contoh:*
\`\`\`
Hasil HK: 1234
Tanggal: 2024-01-01
\`\`\`
  `;
  
  const keyboard = [
    [{ text: '❌ Batal', callback_data: 'cancel_edit' }]
  ];
  
  await editMessage(chatId, messageId, text, keyboard);
}

async function handleSaveFile(chatId, fileKey) {
  if (!await checkAuth(chatId)) return;
  
  const sessionKey = `${chatId}_edit_file`;
  const contentKey = `${chatId}_edit_content`;
  const shaKey = `${chatId}_edit_sha`;
  
  if (!sessions.has(sessionKey) || !sessions.has(contentKey)) {
    await sendMessage(chatId, '❌ Tidak ada data yang disimpan.');
    return;
  }
  
  const targetFile = sessions.get(sessionKey);
  const content = sessions.get(contentKey);
  const sha = sessions.get(shaKey);
  
  if (targetFile !== fileKey) {
    await sendMessage(chatId, '❌ File tidak sesuai.');
    return;
  }
  
  const result = await updateFileContent(fileKey, content, sha);
  
  if (result.success) {
    await sendMessage(chatId, `
✅ *File berhasil disimpan!*

📁 File: ${CONFIG.FILES[fileKey].emoji} ${CONFIG.FILES[fileKey].name}
📊 Ukuran: ${content.length} karakter
    `);
    
    sessions.delete(`${chatId}_edit_file`);
    sessions.delete(`${chatId}_edit_content`);
    sessions.delete(`${chatId}_edit_sha`);
    sessions.delete(`${chatId}_edit_mode`);
    sessions.delete(`${chatId}_edit_lines`);
    
    await handleFileView(chatId, fileKey);
  } else {
    await sendMessage(chatId, `❌ ${result.error}`);
  }
}

async function handleListAdmin(chatId) {
  if (!await checkAuth(chatId)) return;
  
  const admins = CONFIG.ADMIN_IDS || [];
  
  let text = '👥 *DAFTAR ADMIN*\n\n';
  
  if (admins.length === 0) {
    text += 'Belum ada admin terdaftar.\n';
  } else {
    admins.forEach((id, index) => {
      text += `${index + 1}. \`${id}\`\n`;
    });
  }
  
  text += `\n📌 *Total:* ${admins.length} admin`;
  text += '\n\n↩️ Klik kembali ke menu utama.';
  
  const keyboard = [
    [{ text: '↩️ Kembali ke Menu', callback_data: 'back_to_menu' }]
  ];
  
  await sendKeyboard(chatId, text, keyboard);
}

// ============================================
// MAIN HANDLER
// ============================================

async function handleMessage(chatId, text) {
  if (!await checkAuth(chatId)) return;
  
  const editMode = sessions.get(`${chatId}_edit_mode`);
  
  if (editMode) {
    const fileKey = sessions.get(`${chatId}_edit_file`);
    const sha = sessions.get(`${chatId}_edit_sha`);
    
    if (!fileKey || !sha) {
      await sendMessage(chatId, '❌ Session expired. Silakan mulai lagi.');
      sessions.delete(`${chatId}_edit_mode`);
      await handleMainMenu(chatId);
      return;
    }
    
    let newContent = '';
    
    if (editMode === 'edit_last') {
      const lines = sessions.get(`${chatId}_edit_lines`) || [];
      if (lines.length > 0) {
        lines[lines.length - 1] = text;
      } else {
        lines.push(text);
      }
      newContent = lines.join('\n');
    } else if (editMode === 'write_new') {
      const currentContent = sessions.get(`${chatId}_edit_content`) || '';
      newContent = currentContent + (currentContent ? '\n' : '') + text;
    }
    
    sessions.set(`${chatId}_edit_content`, newContent);
    
    const preview = newContent.length > 500 
      ? newContent.substring(0, 500) + '\n... *(file terpotong)*'
      : newContent;
    
    const fileConfig = CONFIG.FILES[fileKey];
    await sendMessage(chatId, `
✏️ *Perubahan diterapkan!*

📁 File: ${fileConfig.emoji} ${fileConfig.name}

*Preview:*
\`\`\`
${preview}
\`\`\`

📊 Ukuran: ${newContent.length} karakter

Klik *[📤 Kirim = Simpan]* untuk menyimpan.
    `);
    
    const keyboard = [
      [
        { text: '✏️ Edit Lagi', callback_data: `edit_last_${fileKey}` },
        { text: '📤 Kirim = Simpan', callback_data: `save_${fileKey}` }
      ],
      [
        { text: '❌ Batal', callback_data: 'cancel_edit' }
      ]
    ];
    
    await sendKeyboard(chatId, '📌 *Pilih aksi selanjutnya:*', keyboard);
    return;
  }
  
  await handleMainMenu(chatId);
}

// ============================================
// CLOUDFLARE WORKERS HANDLER
// ============================================

export default {
  async fetch(request, env, ctx) {
    // ============================================
    // AMBIL KONFIGURASI DARI ENVIRONMENT
    // ============================================
    CONFIG = {
      TELEGRAM_TOKEN: env.TELEGRAM_TOKEN,
      GITHUB_TOKEN: env.GITHUB_TOKEN,
      REPO_OWNER: env.REPO_OWNER,
      REPO_NAME: env.REPO_NAME,
      ADMIN_IDS: env.ADMIN_IDS ? env.ADMIN_IDS.split(',').map(id => Number(id.trim())) : [],
      FILES: {
        hk: { name: 'HK', path: 'hk.txt', emoji: '🇭🇰' },
        sdny: { name: 'SDNY', path: 'sdny.txt', emoji: '🇺🇸' },
        sgp: { name: 'SGP', path: 'sgp.txt', emoji: '🇸🇬' }
      }
    };
    
    // Cek environment variables
    if (!CONFIG.TELEGRAM_TOKEN || CONFIG.TELEGRAM_TOKEN === 'YOUR_BOT_TOKEN') {
      return new Response('Error: TELEGRAM_TOKEN not configured', { status: 500 });
    }
    if (!CONFIG.GITHUB_TOKEN || CONFIG.GITHUB_TOKEN === 'YOUR_GITHUB_TOKEN') {
      return new Response('Error: GITHUB_TOKEN not configured', { status: 500 });
    }
    if (!CONFIG.REPO_OWNER || CONFIG.REPO_OWNER === 'username_anda') {
      return new Response('Error: REPO_OWNER not configured', { status: 500 });
    }
    if (!CONFIG.REPO_NAME || CONFIG.REPO_NAME === 'nama_repo_anda') {
      return new Response('Error: REPO_NAME not configured', { status: 500 });
    }
    
    // ============================================
    // HANDLE REQUEST
    // ============================================
    
    if (request.method !== 'POST') {
      return new Response('OK', { status: 200 });
    }
    
    try {
      const body = await request.json();
      console.log('Webhook received:', JSON.stringify(body));
      
      if (body.message) {
        const chatId = body.message.chat.id;
        const text = body.message.text || '';
        
        if (text === '/start' || text === '/start bob') {
          await handleMainMenu(chatId);
          return new Response('OK', { status: 200 });
        }
        
        if (!text.startsWith('/')) {
          await handleMessage(chatId, text);
          return new Response('OK', { status: 200 });
        }
      }
      
      if (body.callback_query) {
        const chatId = body.callback_query.message.chat.id;
        const messageId = body.callback_query.message.message_id;
        const callbackData = body.callback_query.data;
        const callbackId = body.callback_query.id;
        
        await answerCallback(callbackId);
        
        if (callbackData === 'back_to_menu') {
          await handleMainMenu(chatId, messageId);
        }
        else if (callbackData === 'cancel_edit') {
          sessions.delete(`${chatId}_edit_mode`);
          sessions.delete(`${chatId}_edit_file`);
          sessions.delete(`${chatId}_edit_content`);
          sessions.delete(`${chatId}_edit_sha`);
          sessions.delete(`${chatId}_edit_lines`);
          
          await editMessage(chatId, messageId, '✅ Operasi dibatalkan.');
          await handleMainMenu(chatId);
        }
        else if (callbackData === 'status_all') {
          await handleStatusAll(chatId);
        }
        else if (callbackData === 'list_admin') {
          await handleListAdmin(chatId);
        }
        else if (callbackData.startsWith('file_')) {
          const fileKey = callbackData.replace('file_', '');
          if (CONFIG.FILES[fileKey]) {
            await handleFileView(chatId, fileKey, messageId);
          }
        }
        else if (callbackData.startsWith('edit_last_')) {
          const fileKey = callbackData.replace('edit_last_', '');
          if (CONFIG.FILES[fileKey]) {
            await handleEditLastLine(chatId, fileKey, messageId);
          }
        }
        else if (callbackData.startsWith('write_new_')) {
          const fileKey = callbackData.replace('write_new_', '');
          if (CONFIG.FILES[fileKey]) {
            await handleWriteNew(chatId, fileKey, messageId);
          }
        }
        else if (callbackData.startsWith('save_')) {
          const fileKey = callbackData.replace('save_', '');
          if (CONFIG.FILES[fileKey]) {
            await handleSaveFile(chatId, fileKey);
          }
        }
        
        return new Response('OK', { status: 200 });
      }
      
      return new Response('OK', { status: 200 });
      
    } catch (error) {
      console.error('Error processing request:', error);
      return new Response('Error: ' + error.message, { status: 500 });
    }
  }
};
