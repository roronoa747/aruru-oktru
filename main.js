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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
