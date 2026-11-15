const { contextBridge, ipcRenderer } = require('electron');
const pkg = require('./package.json');
let whatsnew = {};
try { whatsnew = require('./whatsnew.json'); } catch (e) { }
contextBridge.exposeInMainWorld('mapi', {
  version: pkg.version,
  whatsnew,
  check: () => ipcRenderer.invoke('upd:check'),
  download: () => ipcRenderer.invoke('upd:download'),
  onProgress: cb => ipcRenderer.on('upd:progress', (_e, p) => cb(p))
});
