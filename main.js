const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let win;
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
  win.on('close', () => { try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), max: win.isMaximized() })); } catch (e) { } });
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
autoUpdater.on('update-downloaded', () => autoUpdater.quitAndInstall(true, true));

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(create);
  app.on('window-all-closed', () => app.quit());
}
