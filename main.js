const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'ОКТРУ — Поиск кодов товаров',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#0a0d14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => win.show());

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ── IPC: load user-overridden data ─────────────────
ipcMain.handle('load-user-data', async () => {
  const p = path.join(app.getPath('userData'), 'data.json');
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {}
  return null;
});

// ── IPC: save updated data to userData dir ─────────
ipcMain.handle('save-data-json', async (event, jsonString) => {
  const p = path.join(app.getPath('userData'), 'data.json');
  try {
    fs.writeFileSync(p, jsonString, 'utf8');
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// ── IPC: Gemini AI Search ──────────────────────────
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

ipcMain.handle('embed-query', async (event, query) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === "") {
    return { success: false, error: "API ключ не настроен в main.js" };
  }
  try {
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.trim());
    
    // 1. Умное расширение запроса (Query Expansion)
    const textModel = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    const prompt = `Пользователь ищет лабораторный товар/запчасть: "${query}". 
Напиши 1-2 общих названия официальной категории для этого товара (без указания конкретных химических элементов или узких свойств). 
Например, если запрос "Лампа с полым катодом для цинка", ответь "Запасные части для спектрометров, оптические детали".
Верни ТОЛЬКО название категории, коротко.`;
    
    const textResult = await textModel.generateContent(prompt);
    const category = textResult.response.text().trim();
    const expandedQuery = `${query}. ${category}`;

    // 2. Векторизация
    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-2" });
    const result = await embedModel.embedContent({
      content: { role: 'user', parts: [{ text: expandedQuery }] },
      outputDimensionality: 256
    });
    return { success: true, vector: result.embedding.values, expandedQuery };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('ask-gemini', async (event, query) => {
  if (!GEMINI_API_KEY || GEMINI_API_KEY.trim() === "") {
    return { success: false, error: "API ключ не настроен в main.js" };
  }
  try {
    // Убираем пробелы из ключа на всякий случай
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.trim());
    // Используем самую легкую модель Gemini Lite
    const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
    
    const prompt = `Пользователь ищет "${query}" в справочнике товаров/услуг. 
Дай 3-5 официальных синонимов, названий категорий или связанных терминов в именительном падеже, которые могут встретиться в строгом классификаторе товаров (ТНВЭД / ОКТРУ).
Верни ТОЛЬКО валидный JSON массив строк. Больше ничего не пиши, никаких пояснений.
Пример: ["портативный компьютер", "ноутбук", "эвм"]`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();
    
    if (text.startsWith('\`\`\`')) {
      text = text.replace(/^\`\`\`(json)?/i, '').replace(/\`\`\`$/, '').trim();
    }
    
    const synonyms = JSON.parse(text);
    return { success: true, data: synonyms };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
