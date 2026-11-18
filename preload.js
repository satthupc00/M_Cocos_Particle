const { contextBridge, ipcRenderer, clipboard } = require('electron');
const pkg = require('./package.json');
let whatsnew = {};
try { whatsnew = require('./whatsnew.json'); } catch (e) { }
contextBridge.exposeInMainWorld('mapi', {
  version: pkg.version,
  whatsnew,
  check: () => ipcRenderer.invoke('upd:check'),
  download: () => ipcRenderer.invoke('upd:download'),
  setDirty: v => ipcRenderer.send('dirty', !!v),
  onProgress: cb => ipcRenderer.on('upd:progress', (_e, p) => cb(p)),
  lic: {
    call: (channel, ...args) => /^(license|admin)-[a-z-]+$/.test(channel) ? ipcRenderer.invoke(channel, ...args) : Promise.resolve({ error: 'bad channel' }),
    onStatus: cb => ipcRenderer.on('license-status', (_e, s) => cb(s)),
    copy: text => clipboard.writeText(String(text))
  }
});
