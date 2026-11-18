const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');
const { initLicense } = require('./license.js');

let win, unsaved = false;   // unsaved: có thay đổi chưa Xuất zip (app không tự lưu project)
ipcMain.on('dirty', (_e, v) => { unsaved = !!v; });
const stateFile = () => path.join(app.getPath('userData'), 'window.json');
const readState = () => { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return {}; } };

function create() {
  const st = readState();
  win = new BrowserWindow({
    width: st.width || 1440, height: st.height || 880, x: st.x, y: st.y, minWidth: 1100, minHeight: 640,
    title: 'M Cocos Particle', backgroundColor: '#1F2126', icon: path.join(__dirname, 'build/icon.png'),
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#1F2126', symbolColor: '#FFFFFF', height: 58 }, autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  if (st.max) win.maximize();
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'src/index.html'));
  win.on('close', e => {
    if (unsaved) { const r = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Thoát', 'Ở lại'], defaultId: 1, cancelId: 1, title: 'M Cocos Particle', message: 'Thoát app?', detail: 'App không tự lưu project. Những gì chưa Xuất zip sẽ mất.' }); if (r === 1) { e.preventDefault(); return; } } try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch (e) { } });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;
ipcMain.handle('upd:check', async () => {
  if (!app.isPackaged) return { status: 'latest' };
  try {
    const r = await autoUpdater.checkForUpdates();
    const v = r && r.updateInfo && r.updateInfo.version;
    if (v && v !== app.getVersion() && autoUpdater.currentVersion.compare(v) < 0) return { status: 'available', version: v };
    return { status: 'latest' };
  } catch (e) { return { status: 'error' }; }
});
ipcMain.handle('upd:download', async () => { try { await autoUpdater.downloadUpdate(); } catch (e) { } });
autoUpdater.on('download-progress', p => win && win.webContents.send('upd:progress', p.percent));
autoUpdater.on('update-downloaded', () => { unsaved = false; autoUpdater.quitAndInstall(true, true); });

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(() => { initLicense(() => win); create(); });
  app.on('window-all-closed', () => app.quit());
}
