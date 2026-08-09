// ============================================
// CLEAN TEXT FUNCTION
// ============================================

function cleanText(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map(line => line.trimEnd())  // Hapus spasi di akhir baris
    .filter(line => line !== '')  // Hapus baris kosong (kalau mau retain, hapus filter ini)
    .join('\n')
    .trimEnd();  // Hapus newline di akhir
}

// ============================================
// EDIT BARIS TERAKHIR
// ============================================

async function handleEditLastLine(chatId, fileKey, messageId) {
  if (!await checkAuth(chatId)) return;
  
  const result = await getFileContent(fileKey);
  if (result.error) {
    await sendMessage(chatId, `❌ ${result.error}`);
    return;
  }
  
  const lines = result.content ? result.content.split('\n') : [];
  const lastLine = lines.length > 0 ? lines[lines.length - 1] : '';
  const previousLines = lines.length > 0 ? lines.slice(0, -1) : [];
  
  sessions.set(`${chatId}_edit_mode`, 'edit_last');
  sessions.set(`${chatId}_edit_file`, fileKey);
  sessions.set(`${chatId}_edit_previous_lines`, previousLines);
  sessions.set(`${chatId}_edit_sha`, result.sha);
  sessions.set(`${chatId}_edit_current_last`, lastLine);
  
  const text = `
✏️ *EDIT BARIS TERAKHIR*

Baris terakhir saat ini:
\`\`\`
${lastLine || '(kosong)'}
\`\`\`

📝 Kirimkan *teks baru* untuk menggantinya.
  `;
  
  const keyboard = [[{ text: '❌ Batal', callback_data: 'cancel_edit' }]];
  await editMessage(chatId, messageId, text, keyboard);
}

// ============================================
// MAIN HANDLER (DIPERBAIKI)
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
    const cleanedText = cleanText(text); // ← Bersihin teks input
    
    if (editMode === 'edit_last') {
      const previousLines = sessions.get(`${chatId}_edit_previous_lines`) || [];
      const allLines = [...previousLines, cleanedText];
      newContent = allLines.join('\n');
    } else if (editMode === 'write_new') {
      const currentContent = sessions.get(`${chatId}_edit_content`) || '';
      newContent = currentContent + (currentContent ? '\n' : '') + cleanedText;
    }
    
    // Simpan content
    sessions.set(`${chatId}_edit_content`, newContent);
    
    // Preview
    const preview = newContent.length > 500 
      ? newContent.substring(0, 500) + '\n...'
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
      [{ text: '❌ Batal', callback_data: 'cancel_edit' }]
    ];
    
    await sendKeyboard(chatId, '📌 *Pilih aksi selanjutnya:*', keyboard);
    return;
  }
  
  await handleMainMenu(chatId);
}

// ============================================
// SAVE FILE (DIPERBAIKI)
// ============================================

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
  let content = sessions.get(contentKey);
  const sha = sessions.get(shaKey);
  
  if (targetFile !== fileKey) {
    await sendMessage(chatId, '❌ File tidak sesuai.');
    return;
  }
  
  // 🔥 CLEAN CONTENT SEBELUM SIMPAN
  content = cleanText(content);
  
  const result = await updateFileContent(fileKey, content, sha);
  
  if (result.success) {
    await sendMessage(chatId, `
✅ *File berhasil disimpan!*

📁 File: ${CONFIG.FILES[fileKey].emoji} ${CONFIG.FILES[fileKey].name}
📊 Ukuran: ${content.length} karakter
📝 Format: Clean (tanpa double enter/spasi berlebih)
    `);
    
    sessions.delete(`${chatId}_edit_file`);
    sessions.delete(`${chatId}_edit_content`);
    sessions.delete(`${chatId}_edit_sha`);
    sessions.delete(`${chatId}_edit_mode`);
    sessions.delete(`${chatId}_edit_previous_lines`);
    sessions.delete(`${chatId}_edit_current_last`);
    
    await handleFileView(chatId, fileKey);
  } else {
    await sendMessage(chatId, `❌ ${result.error}`);
  }
}
