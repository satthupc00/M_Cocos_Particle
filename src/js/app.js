(function (M) {
  'use strict';
  const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const uid = () => 'a' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
  const uuid4 = () => crypto.randomUUID();
  const clone = o => JSON.parse(JSON.stringify(o));
  const IC = {
    folder: '<svg class="fold" viewBox="0 0 24 24"><path d="M3 6h6l2 2h10v11H3z"/></svg>',
    emitter: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="2.5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2 2M16.4 16.4l2 2M18.4 5.6l-2 2M7.6 16.4l-2 2"/></svg>',
    sprite: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 16l5-5 4 4 3-3 4 4"/></svg>',
    root: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/></svg>',
    anim: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/></svg>',
    proj: '<svg viewBox="0 0 24 24"><path d="M3 20C8 6 14 4 21 6"/><circle cx="21" cy="6" r="2"/></svg>',
    caret: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    scene: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    spark: '<svg viewBox="0 0 24 24"><path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z"/></svg>',
  };
  let S;

  // ================= assets =================
  const walk = (fn, f = S.root, parent = null) => { fn(f, parent); (f.children || []).forEach(c => walk(fn, c, f)); };
  const all = () => { const a = []; walk(x => a.push(x)); return a; };
  let idx = null;
  const byId = id => { if (!id) return null; if (!idx) { idx = new Map(); walk((x, p) => idx.set(x.id, { a: x, p })); } const r = idx.get(id); return r ? r.a : null; };
  const parentOf = id => { byId(id); const r = idx.get(id); return r ? r.p : null; };
  const projectOf = a => { let p = a; while (p && parentOf(p.id) && parentOf(p.id) !== S.root) p = parentOf(p.id); return p && p !== S.root && p.type === 'folder' ? p : null; };
  const uniq = (folder, name, skip) => { const has = n => folder.children.some(c => c !== skip && c.name === n); if (!has(name)) return name; let i = 1; while (has(name + '_' + i)) i++; return name + '_' + i; };
  const add = (folder, a) => { a.id = a.id || uid(); a.uuid = uuid4(); a.name = uniq(folder, a.name); folder.children.push(a); idx = null; return a; };
  const mkFolder = (parent, name) => add(parent, { type: 'folder', name, children: [] });
  function subFolder(project, kind) {
    const re = { Images: /images?$/i, Animations: /anim(ation)?s?$/i, Prefabs: /prefabs?$/i }[kind];
    return project.children.find(c => c.type === 'folder' && re.test(c.name)) || mkFolder(project, kind);
  }
  // folder hệ thống (Scenes, Backgrounds): không xuất vào zip
  const sysFolder = name => S.root.children.find(c => c.type === 'folder' && c.sys === name) || Object.assign(mkFolder(S.root, name), { sys: name });
  const pathOf = a => { const p = []; for (let x = a; x && x !== S.root; x = parentOf(x.id)) p.unshift(x.name); return p.join('/'); };
  const resolve = (path, type) => { let f = S.root; for (const seg of String(path || '').split('/')) f = f && f.children ? f.children.find(c => c.name === seg) : null; return f && f.type === type ? f : null; };
  const imgCache = new Map();
  M.imgOf = a => { let c = imgCache.get(a.id); if (!c || c.src !== a.data) { const img = new Image(); img.src = a.data; c = { img, src: a.data }; imgCache.set(a.id, c); } return c.img; };
  function trimRect(img) {
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (d[(y * c.width + x) * 4 + 3] > 0) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? { x: 0, y: 0, w: c.width, h: c.height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  }
  const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  async function mkImage(folder, name, data, ext = 'png') {
    const img = await loadImg(data);
    return add(folder, { type: 'image', name, ext, data, w: img.naturalWidth, h: img.naturalHeight, trim: { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }, sub: uuid4() });
  }
  const readFile = f => new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(f); });
  const isImg = f => /^image\/(png|jpeg|webp)$/.test(f.type) || /\.(png|jpe?g|webp)$/i.test(f.name);
  const natural = (a, b) => a.name.localeCompare(b.name, undefined, { numeric: true });
  async function importFiles(files, folder) {
    const out = [];
    for (const f of [...files].filter(isImg).sort(natural)) {
      const ext = (f.name.match(/\.(\w+)$/) || [, 'png'])[1].toLowerCase();
      out.push(await mkImage(folder, f.name.replace(/\.\w+$/, ''), await readFile(f), ext));
    }
    return out;
  }
  function builtin(kind) {
    const n = kind === 'Glow' ? 128 : 64, c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d'), h = n / 2;
    if (kind === 'Circle') { g.fillStyle = '#fff'; g.beginPath(); g.arc(h, h, h - 4, 0, 7); g.fill(); }
    else if (kind === 'Glow') { const r = g.createRadialGradient(h, h, 0, h, h, h); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(.25, 'rgba(255,255,255,.75)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, n, n); }
    else { g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, r = i % 2 ? 5 : h - 2; g.lineTo(h + Math.cos(a) * r, h + Math.sin(a) * r); } g.fill(); }
    return c.toDataURL('image/png');
  }
  async function builtinImg(project, kind) {
    const f = subFolder(project, 'Images');
    return f.children.find(c => c.type === 'image' && c.builtin === kind) || Object.assign(await mkImage(f, kind, builtin(kind)), { builtin: kind });
  }

  // ================= prefab =================
  const C = (r, g, b, a) => ({ r, g, b, a });
  const defPS = o => Object.assign({
    duration: -1, emissionRate: 25, life: 1.6, lifeVar: 0.3, totalParticles: 40,
    startColor: C(255, 255, 255, 255), startColorVar: C(0, 0, 0, 0), endColor: C(255, 255, 255, 255), endColorVar: C(0, 0, 0, 0),
    angle: 90, angleVar: 180, startSize: 40, startSizeVar: 10, endSize: 40, endSizeVar: 10, startSpin: 0, startSpinVar: 180, endSpin: 360, endSpinVar: 180,
    sourcePos: { x: 0, y: 0 }, posVar: { x: 0, y: 0 }, positionType: 0, emitterMode: 0, gravity: { x: 0, y: -500 }, speed: 600, speedVar: 150,
    tangentialAccel: 0, tangentialAccelVar: 0, radialAccel: 0, radialAccelVar: 0, rotationIsDir: false,
    startRadius: 0, startRadiusVar: 0, endRadius: 200, endRadiusVar: 0, rotatePerS: 180, rotatePerSVar: 0,
    srcBlend: 'SRC_ALPHA', dstBlend: 'ONE_MINUS_SRC_ALPHA', autoRemoveOnFinish: false
  }, o || {});
  const emitters = pf => pf.nodes.filter(n => n.type === 'emitter');
  const nodeName = (pf, base) => { let i = 1; while (pf.nodes.some(n => n.name === base + '_' + i)) i++; return base + '_' + i; };
  const r1 = v => Math.round(v * 10) / 10;
  function applyPlay(pf, nodes = emitters(pf)) {
    for (const n of nodes) { const s = n.ps;
      if (pf.play === 'once') { s.duration = pf.mode === 'burst' ? 0.2 : 1.5; s.emissionRate = Math.max(1, Math.round(s.totalParticles / s.duration)); }
      else { s.duration = -1; s.emissionRate = Math.max(1, r1(s.totalParticles / Math.max(.1, s.life))); } }
  }
  function applyMode(pf, nodes = emitters(pf)) {
    for (const n of nodes) { const s = n.ps; s.emitterMode = 0; s.speed = Math.abs(s.speed) || 600; n.x = 0;
      if (pf.mode === 'burst') { n.y = 0; s.posVar = { x: 0, y: 0 }; s.angle = 90; s.angleVar = 180; s.gravity = { x: 0, y: -500 }; }
      else { n.y = Math.round(S.canvas.h / 2 + 80); s.posVar = { x: Math.round(S.canvas.w / 2), y: 0 }; s.angle = -90; s.angleVar = 8; s.gravity = { x: 0, y: -150 }; s.life = r1((S.canvas.h + 220) / s.speed); } }
    applyPlay(pf, nodes);
  }
  async function newParticle(project, name, opt = {}) {
    const img = await builtinImg(project, opt.img || 'Circle');
    const pf = add(subFolder(project, 'Prefabs'), { type: 'prefab', kind: 'particle', name, mode: 'burst', play: opt.play || 'loop', seqAnim: null, nodes: [] });
    pf.nodes.push({ id: uid(), type: 'emitter', name: 'Emitter_1', x: 0, y: 0, image: img.id, ps: defPS(opt.ps) });
    applyPlay(pf); return pf;
  }
  const defProj = impact => ({ preset: 'arc2', sx: -300, sy: -200, ex: 300, ey: 120, dur: .8, amp: 220, rand: 60, variants: 3, ease: 'linear', rotateDir: true, rotOffset: 0, impact: impact || null });
  function normProj(pj) {
    if (!M.sim.PRESETS[pj.preset]) pj.preset = 'arc2';
    if (typeof pj.cx !== 'number') { pj.cx = Math.round((pj.sx + pj.ex) / 2); pj.cy = Math.round(Math.max(pj.sy, pj.ey) + 150); }
    if (!Array.isArray(pj.circle) || pj.circle.length !== 4) pj.circle = [{ x: -180, y: 0 }, { x: 0, y: 180 }, { x: 180, y: 0 }, { x: 0, y: -180 }];
    if (!Array.isArray(pj.free)) pj.free = [];
  }
  async function newProjectile(project, name) {
    const glow = await builtinImg(project, 'Glow');
    const impact = await newParticle(project, name + '_Impact', { img: 'Spark', play: 'once', ps: { totalParticles: 24, life: .45, lifeVar: .15, speed: 420, speedVar: 160, startSize: 34, startSizeVar: 12, endSize: 0, endSizeVar: 0, gravity: { x: 0, y: -300 }, startColor: C(255, 240, 150, 255), endColor: C(255, 110, 20, 0), dstBlend: 'ONE' } });
    const pf = add(subFolder(project, 'Prefabs'), { type: 'prefab', kind: 'projectile', name, nodes: [],
      proj: defProj(impact.id) });
    pf.nodes.push({ id: uid(), type: 'emitter', name: 'Trail', x: 0, y: 0, image: glow.id, ps: defPS({ totalParticles: 90, emissionRate: 160, life: .4, lifeVar: .15, angle: 0, angleVar: 180, speed: 0, speedVar: 25, gravity: { x: 0, y: 0 },
      startSize: 46, startSizeVar: 10, endSize: 0, endSizeVar: 0, startSpin: 0, startSpinVar: 0, endSpin: 0, endSpinVar: 0, startColor: C(255, 225, 90, 255), endColor: C(255, 90, 0, 0), dstBlend: 'ONE' }) });
    pf.nodes.push({ id: uid(), type: 'sprite', name: 'Head', x: 0, y: 0, image: glow.id, anim: null, srcBlend: 'SRC_ALPHA', dstBlend: 'ONE' });
    return pf;
  }
  async function makeSequence(files, name, project) {
    const imgs = await importFiles(files, mkFolder(subFolder(project, 'Images'), name));
    if (!imgs.length) return null;
    return add(subFolder(project, 'Animations'), { type: 'anim', name: name + '_Loop', sample: 30, frames: imgs.map(i => i.id) });
  }
  async function seqFromData(list, name, project) {
    const f = mkFolder(subFolder(project, 'Images'), name), ids = [];
    for (const it of list) ids.push((await mkImage(f, it.name, it.data)).id);
    return add(subFolder(project, 'Animations'), { type: 'anim', name: name + '_Loop', sample: 30, frames: ids });
  }
  // nền mẫu tự vẽ (khung máy quay số đơn giản) để ướm thử hiệu ứng
  function sampleBg() {
    const W = 960, H = 640, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const bg = g.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, 620); bg.addColorStop(0, '#2647B0'); bg.addColorStop(1, '#0B1238'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.save(); g.translate(W / 2, H / 2); g.fillStyle = 'rgba(120,170,255,.10)'; for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.beginPath(); g.moveTo(0, 0); g.lineTo(-70, -800); g.lineTo(70, -800); g.fill(); } g.restore();
    const rr = (x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
    const fx = 150, fy = 110, fw = 660, fh = 360, gold = g.createLinearGradient(0, fy, 0, fy + fh); gold.addColorStop(0, '#FFD84D'); gold.addColorStop(1, '#F07A1A');
    rr(fx - 14, fy - 14, fw + 28, fh + 28, 34); g.fillStyle = gold; g.fill(); rr(fx, fy, fw, fh, 22); g.fillStyle = '#121A4A'; g.fill();
    g.strokeStyle = 'rgba(255,216,77,.75)'; g.lineWidth = 3; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(fx + fw * i / 5, fy + 8); g.lineTo(fx + fw * i / 5, fy + fh - 8); g.stroke(); }
    g.fillStyle = '#FFF6C8'; for (let i = 0; i <= 12; i++) for (const y of [fy - 7, fy + fh + 7]) { g.beginPath(); g.arc(fx + fw * i / 12, y, 4, 0, 7); g.fill(); }
    for (let i = 0; i < 3; i++) { rr(250 + i * 160, 520, 140, 62, 16); g.fillStyle = '#2FB8A0'; g.fill(); g.lineWidth = 4; g.strokeStyle = '#FFD84D'; g.stroke(); }
    rr(750, 508, 150, 86, 20); g.fillStyle = '#E5383B'; g.fill(); g.lineWidth = 5; g.strokeStyle = '#FFD84D'; g.stroke();
    return c.toDataURL('image/jpeg', .86);
  }
  async function bootstrap() {
    S = { root: { id: 'root', type: 'folder', name: 'assets', children: [] }, canvas: { w: 960, h: 640 }, tab: 'particle', scene: { particle: [], projectile: [] }, sel: null, folder: null, ver: '213', bg: 0, ptab: 'm' };
    idx = null;
    const p1 = mkFolder(S.root, 'Coin_FX'); ['Animations', 'Images', 'Prefabs'].forEach(k => subFolder(p1, k));
    const a = await newParticle(p1, 'Coin_Burst', { ps: { totalParticles: 30, life: 1.8, startSize: 70, startSizeVar: 15, endSize: 70, endSizeVar: 15, speed: 650 } });
    if (window.M_SAMPLE && M_SAMPLE.coins.length) a.seqAnim = (await seqFromData(M_SAMPLE.coins, 'Coin', p1)).id;
    applyPlay(a);
    const p2 = mkFolder(S.root, 'Projectile_FX'); ['Animations', 'Images', 'Prefabs'].forEach(k => subFolder(p2, k));
    const b = await newProjectile(p2, 'Projectile');
    const bgA = await mkImage(sysFolder('Backgrounds'), 'Sample_BG', sampleBg(), 'jpg'); S.ref = { img: bgA.id, x: 0, y: 0, scale: 1, opacity: 100, locked: true };
    S.scene = { particle: [a.id], projectile: [b.id] }; S.folder = subFolder(p1, 'Prefabs').id; S.sel = { pf: a.id, node: a.nodes[0].id }; normAll();
  }

  // ================= lưu tự động =================
  const DB = () => new Promise((ok, no) => { const r = indexedDB.open('m-cocos-particle', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  async function load() { try { const db = await DB(); return await new Promise(ok => { const r = db.transaction('kv').objectStore('kv').get('state'); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }); } catch (e) { return null; } }
  let saveT;
  // mọi prefab / node đều có vị trí, góc xoay, tỉ lệ
  const xf = o => { if (typeof o.x !== 'number') o.x = 0; if (typeof o.y !== 'number') o.y = 0; if (typeof o.rot !== 'number') o.rot = 0; if (!(o.sx > 0)) o.sx = o.scale > 0 ? o.scale : 1; if (!(o.sy > 0)) o.sy = o.scale > 0 ? o.scale : 1; delete o.scale; };
  function normAll() { walk(a => { if (a.type === 'image') a.trim = { x: 0, y: 0, w: a.w, h: a.h }; if (a.type === 'prefab') { xf(a); a.nodes.forEach(xf); if (a.kind === 'projectile') normProj(a.proj || (a.proj = defProj())); } });
    if (S.ref && !S.ref.data && !byId(S.ref.img)) S.ref = null;
    if (!S.scene) S.scene = { particle: S.open && S.open.particle ? [S.open.particle] : [], projectile: S.open && S.open.projectile ? [S.open.projectile] : [] };
    for (const k of ['particle', 'projectile']) S.scene[k] = (S.scene[k] || []).filter(id => { const a = byId(id); return a && a.type === 'prefab'; });
    if (S.sel && typeof S.sel !== 'object') S.sel = null; delete S.open; }
  function save() { clearTimeout(saveT); saveT = setTimeout(async () => { try { const db = await DB(); db.transaction('kv', 'readwrite').objectStore('kv').put(JSON.stringify(S), 'state'); } catch (e) { } }, 250); }
  // ---- undo / redo (10 bước) : chỉ lưu phần nội dung, ảnh được giữ riêng để nhẹ ----
  const DOC = ['root', 'canvas', 'scene', 'ref'], blobKey = new Map(), blobVal = new Map(), HMAX = 10;
  const snap = () => JSON.stringify(DOC.map(k => S[k] === undefined ? null : S[k]), (k, v) => { if (k !== 'data' || typeof v !== 'string') return v; let t = blobKey.get(v); if (!t) { t = '\u0001' + blobKey.size; blobKey.set(v, t); blobVal.set(t, v); } return t; });
  let hist = [], redoS = [], base = null, histT;
  function commit() { clearTimeout(histT); if (base === null) return; const s = snap(); if (s === base) return; hist.push(base); if (hist.length > HMAX) hist.shift(); redoS = []; base = s; undoBtns(); }
  function restore(s) { const a = JSON.parse(s, (k, v) => k === 'data' && typeof v === 'string' && blobVal.has(v) ? blobVal.get(v) : v); DOC.forEach((k, i) => S[k] = a[i]); idx = null;
    if (!byId(S.folder)) S.folder = 'root'; if (S.sel && !scenePfs().some(p => p.id === S.sel.pf)) select(scenePfs()[0] || null); restart(); renderAll(); save(); undoBtns(); }
  function undo() { commit(); if (!hist.length) return toast('Không còn bước nào để hoàn tác'); redoS.push(base); base = hist.pop(); restore(base); }
  function redo() { commit(); if (!redoS.length) return toast('Không còn bước nào để làm lại'); hist.push(base); base = redoS.pop(); restore(base); }
  function undoBtns() { $('#btnUndo').disabled = !hist.length; $('#btnRedo').disabled = !redoS.length; }
  function dirty() { idx = null; normAll(); save(); clearTimeout(histT); histT = setTimeout(commit, 350); }

  // ================= runtime / viewport =================
  // Node Tree của mỗi tab là 1 "scene" gồm nhiều prefab vẽ song song; prefab nằm dưới vẽ sau (đè lên trên)
  const scenePfs = () => (S.scene[S.tab] || []).map(byId).filter(a => a && a.type === 'prefab');
  const cur = () => { const l = scenePfs(); return l.find(p => S.sel && p.id === S.sel.pf) || l[0] || null; };
  const selNode = () => { const pf = cur(); return pf && S.sel && S.sel.pf === pf.id ? pf.nodes.find(n => n.id === S.sel.node) || null : null; };
  const select = (pf, node) => { S.sel = pf ? { pf: pf.id, node: node ? node.id : null } : null; };
  const views = { particle: { x: 0, y: 0, z: 1 }, projectile: { x: 0, y: 0, z: 1 } };
  const view = () => views[S.tab];
  const BGS = [[.169, .176, .192], [0, 0, 0], [.45, .45, .47], [.09, .22, .16]];
  let R, playing = true, last = performance.now(), tool = 'move';
  const RT = new Map();
  const viewEl = $('#view'), ov = $('#ov');
  function restart() { RT.clear(); }
  function startFly(pf, r) {
    const pj = pf.proj; r.inst.reset(); r.impact = null;
    const v = M.sim.variant(pj, Math.floor(Math.random() * Math.max(1, pj.variants)));
    r.fly = { t: 0, v, phase: 'fly', it: 0 }; const p0 = M.sim.pathPoint(pj, v, 0); r.inst.x = p0.x; r.inst.y = p0.y; r.inst.headVisible = true; r.inst.headRot = 0;
  }
  function rtOf(pf) {
    let r = RT.get(pf.id);
    if (!r || r.inst.prefab !== pf) { r = { inst: new M.sim.Instance(pf), impact: null, fly: null, doneT: 0 }; RT.set(pf.id, r); if (pf.kind === 'projectile') startFly(pf, r); else { r.inst.x = pf.x; r.inst.y = pf.y; } }
    return r;
  }
  function stepPf(pf, r, dt) {
    const inst = r.inst;
    if (pf.kind === 'particle') {
      inst.step(dt, pf.x, pf.y);
      if (emitters(pf).length && inst.done()) { r.doneT += dt; if (r.doneT > .7) { inst.reset(); r.doneT = 0; } }
      return;
    }
    const pj = pf.proj, fly = r.fly;
    if (fly.phase === 'fly') {
      fly.t += dt; const u = Math.min(1, fly.t / Math.max(.05, pj.dur)), p = M.sim.pathPoint(pj, fly.v, M.sim.EASE[pj.ease](u));
      const dx = p.x - inst.x, dy = p.y - inst.y;
      if (pj.rotateDir && (dx || dy)) inst.headRot = -Math.atan2(dy, dx) * 180 / Math.PI + pj.rotOffset; else if (!pj.rotateDir) inst.headRot = pj.rotOffset;
      inst.step(dt, p.x, p.y);
      if (u >= 1) { fly.phase = 'impact'; inst.stopAll(); inst.headVisible = false; const ip = byId(pj.impact); if (ip) { r.impact = new M.sim.Instance(ip); r.impact.x = p.x; r.impact.y = p.y; } }
    } else {
      fly.it += dt; inst.step(dt, inst.x, inst.y);
      if (r.impact) { r.impact.step(dt, r.impact.x, r.impact.y); if (fly.it > .3) r.impact.stopAll(); }
      if (fly.it > .5 && !inst.count() && (!r.impact || !r.impact.count())) startFly(pf, r);
    }
  }
  function advance(dt) {
    const list = scenePfs(), ids = new Set(list.map(p => p.id));
    for (const k of [...RT.keys()]) if (!ids.has(k)) RT.delete(k);
    for (const pf of list) stepPf(pf, rtOf(pf), dt);
  }
  const getA = id => byId(id);
  function frameOf(anim, i, n, time) { const fr = M.seqFrames(anim, i, n, getA); return fr.length ? fr[Math.floor(time * anim.sample) % fr.length] : null; }
  // ma trận xoay + co giãn (góc ngược chiều kim đồng hồ như Cocos)
  const lin = o => { const r = (o.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r); return [c * o.sx, sn * o.sx, -sn * o.sy, c * o.sy]; };
  const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3]];
  function drawInst(I) {
    const pf = I.prefab, ems = emitters(pf), seq = pf.kind === 'particle' && byId(pf.seqAnim), LR = lin(pf);
    if (pf.hidden) return;
    for (const n of pf.nodes) {
      if (n.hidden) continue;
      let a = byId(n.image); const W = I.nodePos(n); R.mat(mul(LR, lin(n)), W.x, W.y);
      if (n.type === 'emitter') {
        if (seq) a = frameOf(seq, ems.indexOf(n), ems.length, I.time) || a;
        const e = I.emitters.get(n.id); if (!e || !a) continue;
        R.batch(a, n.ps.srcBlend, n.ps.dstBlend); const ar = a.w / a.h, kw = ar > 1 ? 1 : ar, kh = ar > 1 ? 1 / ar : 1, free = n.ps.positionType === 0;
        for (const p of e.parts) R.quad(p.x - (free ? W.x - p.sx : 0), p.y - (free ? W.y - p.sy : 0), p.size * kw, p.size * kh, p.rot, p.c);
      } else if (I.headVisible) {
        const an = byId(n.anim); if (an) a = frameOf(an, 0, 1, I.time) || a; if (!a) continue;
        R.batch(a, n.srcBlend, n.dstBlend); R.quad(0, 0, a.w, a.h, I.headRot, [255, 255, 255, 255]);
      }
    }
    R.mat([1, 0, 0, 1], 0, 0);
  }
  const w2s = (x, y) => { const v = view(); return [viewEl.clientWidth / 2 + v.x + x * v.z, viewEl.clientHeight / 2 + v.y - y * v.z]; };
  const s2w = (sx, sy) => { const v = view(); return [(sx - viewEl.clientWidth / 2 - v.x) / v.z, -(sy - viewEl.clientHeight / 2 - v.y) / v.z]; };
  // vị trí (world) của thứ đang chọn: node hoặc gốc prefab
  function selPos() { const pf = cur(); if (!pf) return null; const r = RT.get(pf.id); if (!r) return null; const n = selNode(); return n ? r.inst.nodePos(n) : { x: r.inst.x, y: r.inst.y }; }
  function drawOverlay() {
    const dpr = window.devicePixelRatio || 1, w = viewEl.clientWidth, h = viewEl.clientHeight;
    if (ov.width !== Math.round(w * dpr) || ov.height !== Math.round(h * dpr)) { ov.width = Math.round(w * dpr); ov.height = Math.round(h * dpr); }
    const g = ov.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    const v = view(); let step = 50; while (step * v.z < 28) step *= 2; while (step * v.z > 120) step /= 2;
    const [ox, oy] = w2s(0, 0); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.055)'; g.beginPath();
    for (let x = ox % (step * v.z); x < w; x += step * v.z) { g.moveTo(Math.round(x) + .5, 0); g.lineTo(Math.round(x) + .5, h); }
    for (let y = oy % (step * v.z); y < h; y += step * v.z) { g.moveTo(0, Math.round(y) + .5); g.lineTo(w, Math.round(y) + .5); }
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.moveTo(ox, 0); g.lineTo(ox, h); g.moveTo(0, oy); g.lineTo(w, oy); g.stroke();
    const cw = S.canvas.w * v.z, ch = S.canvas.h * v.z;
    g.strokeStyle = 'rgba(229,56,59,.9)'; g.lineWidth = 1.5; g.strokeRect(ox - cw / 2, oy - ch / 2, cw, ch);
    g.fillStyle = '#8D929C'; g.font = '11px "Segoe UI",sans-serif'; g.fillText(`Canvas ${S.canvas.w} × ${S.canvas.h}`, ox - cw / 2 + 4, oy - ch / 2 - 6);
    const pf = cur(); if (!pf) return;
    if (!S.hidePath) for (const q of scenePfs()) {
      if (q.kind !== 'projectile' || q.hidden) continue;
      const pj = q.proj, col = M.sim.PRESETS[pj.preset].color; g.setLineDash([5, 5]); g.lineWidth = 1.5; g.strokeStyle = col; g.globalAlpha = q === pf ? .7 : .3;
      for (let i = 0; i < Math.max(1, pj.variants); i++) { const vr = M.sim.variant(pj, i); g.beginPath(); for (let k = 0; k <= 160; k++) { const p = M.sim.pathPoint(pj, vr, k / 160), s = w2s(p.x, p.y); k ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); } g.stroke(); }
      g.setLineDash([]); g.globalAlpha = 1; if (q !== pf) continue;
      handles(pj).forEach(([t, o, kx, ky]) => { const s = w2s(o[kx], o[ky]); g.fillStyle = '#1F2126'; g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(s[0], s[1], 9, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 10px "Segoe UI",sans-serif'; g.fillText(t, s[0] - 3.5, s[1] + 3.5); });
    }
    const n = selNode(), P0 = selPos();
    if (P0) {
      const s = w2s(P0.x, P0.y); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath();
      if (n) g.arc(s[0], s[1], 7, 0, 7); else g.rect(s[0] - 6, s[1] - 6, 12, 12);
      g.moveTo(s[0] - 12, s[1]); g.lineTo(s[0] + 12, s[1]); g.moveTo(s[0], s[1] - 12); g.lineTo(s[0], s[1] + 12); g.stroke();
      if (n && n.type === 'emitter' && (n.ps.posVar.x || n.ps.posVar.y)) {
        const m = mul(lin(pf), lin(n)), px = n.ps.posVar.x, py = n.ps.posVar.y; g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath();
        [[-px, -py], [px, -py], [px, py], [-px, py]].forEach(([x, y], i) => { const q = w2s(P0.x + m[0] * x + m[2] * y, P0.y + m[1] * x + m[3] * y); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }); g.closePath(); g.stroke(); g.setLineDash([]);
      }
    }
  }
  let stT = 0;
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (playing) advance(dt);
    R.begin(view(), BGS[S.bg || 0]); R.mat([1, 0, 0, 1], 0, 0);
    const ra = refAsset(); if (ra) { const b = S.ref; R.batch(ra, 'SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA'); R.quad(b.x, b.y, ra.w * b.scale, ra.h * b.scale, 0, [255, 255, 255, b.opacity * 2.55]); R.flush(); }
    for (const pf of scenePfs()) { const r = RT.get(pf.id); if (!r) continue; drawInst(r.inst); if (r.impact) drawInst(r.impact); }
    R.end();
    drawOverlay();
    if (now - stT > 250) { stT = now; status(); }
    requestAnimationFrame(tick);
  }
  function status() {
    const list = scenePfs(), pf = cur(); $('#empty').classList.toggle('hide', !!pf);
    let cnt = 0, em = 0; for (const q of list) { em += emitters(q).length; const r = RT.get(q.id); if (r) cnt += r.inst.count() + (r.impact ? r.impact.count() : 0); }
    $('#st').textContent = !pf ? 'Chưa mở prefab' : `${list.length} prefab · ${em} emitter · ${cnt} hạt · đang chọn: ${selNode() ? selNode().name : pf.name}`;
    $('#st2').textContent = pf && pf.kind === 'projectile' ? 'Đường bay chỉ để xem trước — khi xuất, prefab nằm tại (0,0)' : '';
    $('#zoom').textContent = Math.round(view().z * 100) + '%';
  }
  // ---- ảnh nền để ướm thử ----
  const refAsset = () => S.ref ? byId(S.ref.img) : null;
  function setRef(a, locked) { S.ref = { img: a.id, x: 0, y: 0, scale: 1, opacity: 100, locked: !!locked }; dirty(); renderRef(); renderAssets(); }
  const HINT = 'Lăn chuột: zoom · Giữ chuột phải hoặc phím cách + kéo: pan · Kéo chuột trái: di chuyển / xoay / co giãn thứ đang chọn (W / E / T)';
  function renderRef() {
    const bar = $('#refBar'), b = S.ref; bar.classList.toggle('hide', !b || b.locked); $('#btnRef').classList.toggle('on', !!b);
    if (b && !b.locked) { $('#refScale').value = b.scale; $('#refOp').value = b.opacity; }
    $('#hint').textContent = drawMode ? 'Đang vẽ đường bay: giữ chuột trái và kéo trên Viewport, thả chuột để xong' : b && !b.locked ? 'Đang chỉnh ảnh nền: kéo chuột trái để di chuyển ảnh · bấm Apply để khoá' : HINT;
  }
  async function pickRef() { const fs = await pickFiles($('#fileImg')); if (!fs.length) return; const im = await importFiles(fs.slice(0, 1), sysFolder('Backgrounds')); if (im.length) setRef(im[0]); }
  function refMenu(e) {
    if (!S.ref) return pickRef(); const r = e.currentTarget.getBoundingClientRect();
    ctxMenu(r.left, r.bottom + 4, [[S.ref.locked ? 'Chỉnh lại vị trí ảnh nền' : 'Khoá ảnh nền (Apply)', () => { S.ref.locked = !S.ref.locked; dirty(); renderRef(); }], ['Đổi ảnh khác…', pickRef], ['Gỡ ảnh nền', () => { S.ref = null; dirty(); renderRef(); }]]);
  }
  function fit() { const v = view(); v.z = Math.max(.05, Math.min((viewEl.clientWidth - 80) / S.canvas.w, (viewEl.clientHeight - 110) / S.canvas.h)); v.x = 0; v.y = 12; }
  function setTool(t) { tool = t; $$('#tools button').forEach(b => b.classList.toggle('on', b.dataset.tool === t)); }

  // chuột trong viewport
  let space = false, drag = null, drawMode = false;
  const handles = pj => pj.preset === 'arc3' ? [['A', pj, 'sx', 'sy'], ['C', pj, 'cx', 'cy'], ['B', pj, 'ex', 'ey']] : pj.preset === 'circle' ? pj.circle.map((q, i) => [String(i + 1), q, 'x', 'y']) : pj.preset === 'free' ? [] : [['A', pj, 'sx', 'sy'], ['B', pj, 'ex', 'ey']];
  viewEl.addEventListener('contextmenu', e => e.preventDefault());
  viewEl.addEventListener('wheel', e => { e.preventDefault(); const r = viewEl.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = view(), [wx, wy] = s2w(mx, my);
    v.z = Math.max(.05, Math.min(16, v.z * Math.exp(-e.deltaY * .0015))); v.x = mx - viewEl.clientWidth / 2 - wx * v.z; v.y = my - viewEl.clientHeight / 2 + wy * v.z; }, { passive: false });
  viewEl.addEventListener('pointerdown', e => {
    if (e.target.closest('.vbar,.refbar')) return;
    const r = viewEl.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, pf = cur();
    if (e.button === 1 || e.button === 2 || space) drag = { k: 'pan' };
    else if (e.button === 0 && drawMode && pf && pf.kind === 'projectile') { const [wx, wy] = s2w(mx, my); pf.proj.free = [{ x: Math.round(wx), y: Math.round(wy) }]; drag = { k: 'draw' }; }
    else if (e.button === 0 && S.ref && !S.ref.locked) drag = { k: 'ref' };
    else if (e.button === 0 && pf) {
      if (pf.kind === 'projectile' && !S.hidePath) for (const hd of handles(pf.proj)) { const s = w2s(hd[1][hd[2]], hd[1][hd[3]]); if (Math.hypot(s[0] - mx, s[1] - my) < 13) drag = { k: 'pt', hd }; }
      if (!drag) { const t = selNode() || pf, c = selPos() || { x: 0, y: 0 }, s = w2s(c.x, c.y);
        drag = { k: 'xf', t, node: !!selNode(), a0: Math.atan2(-(my - s[1]), mx - s[0]), x0: e.clientX, rot: t.rot, sx: t.sx, sy: t.sy, cx: s[0] + r.left, cy: s[1] + r.top }; }
    }
    if (drag) { drag.x = e.clientX; drag.y = e.clientY; viewEl.setPointerCapture(e.pointerId); viewEl.style.cursor = drag.k === 'pan' ? 'grabbing' : 'move'; e.preventDefault(); }
  });
  viewEl.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y, v = view(); drag.x = e.clientX; drag.y = e.clientY;
    if (drag.k === 'pan') { v.x += dx; v.y += dy; return; }
    if (drag.k === 'ref') { S.ref.x = Math.round(S.ref.x + dx / v.z); S.ref.y = Math.round(S.ref.y - dy / v.z); drag.moved = true; return; }
    const pf = cur(), wx = dx / v.z, wy = -dy / v.z;
    if (drag.k === 'draw') { const rc = viewEl.getBoundingClientRect(), [px, py] = s2w(e.clientX - rc.left, e.clientY - rc.top), a = pf.proj.free, l = a[a.length - 1]; if (Math.hypot(px - l.x, py - l.y) * v.z > 5) a.push({ x: Math.round(px), y: Math.round(py) }); drag.moved = true; return; }
    if (drag.k === 'pt') { const [, o, kx, ky] = drag.hd; o[kx] = Math.round(o[kx] + wx); o[ky] = Math.round(o[ky] + wy); }
    else { const t = drag.t;
      if (tool === 'move') {
        if (drag.node) { const m = lin(pf), det = m[0] * m[3] - m[1] * m[2] || 1; t.x = r1(t.x + (m[3] * wx - m[2] * wy) / det); t.y = r1(t.y + (-m[1] * wx + m[0] * wy) / det); }
        else if (pf.kind === 'particle') { t.x = r1(t.x + wx); t.y = r1(t.y + wy); }
      } else if (tool === 'rotate') { const a = Math.atan2(-(e.clientY - drag.cy), e.clientX - drag.cx); let d = (a - drag.a0) * 180 / Math.PI; t.rot = r1(drag.rot + d); if (e.shiftKey) t.rot = Math.round(t.rot / 15) * 15; }
      else { const f = Math.max(.02, 1 + (e.clientX - drag.x0) / 150); t.sx = Math.round(drag.sx * f * 100) / 100; t.sy = Math.round(drag.sy * f * 100) / 100; }
    }
    drag.moved = true; syncInputs();
  });
  const endDrag = () => { const d = drag; drag = null; viewEl.style.cursor = ''; if (!d) return; if (d.moved) dirty(); if (d.k === 'draw') { drawMode = false; const pf = cur(); if (pf) RT.delete(pf.id); renderProps(); renderRef(); } };
  viewEl.addEventListener('pointerup', endDrag); viewEl.addEventListener('pointercancel', endDrag);

  // ================= dialog / toast / menu =================
  function toast(msg, ms = 2600) { $$('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = msg; document.body.append(t); if (ms) setTimeout(() => t.remove(), ms); return t; }
  function modal(html, onOpen) {
    return new Promise(ok => {
      const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = `<div class="dlg" role="dialog">${html}</div>`; document.body.append(m);
      const close = v => { m.remove(); document.removeEventListener('keydown', key, true); ok(v); };
      const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(null); } };
      document.addEventListener('keydown', key, true);
      m.addEventListener('pointerdown', e => { if (e.target === m) close(null); });
      m.querySelectorAll('[data-close]').forEach(b => b.onclick = () => close(null));
      onOpen && onOpen(m, close);
    });
  }
  const dlgHead = t => `<h4>${t}<button class="mini" data-close title="Đóng (Esc)">${IC.x}</button></h4>`;
  function ask(title, label, value = '', okText = 'OK') {
    return modal(`${dlgHead(title)}<form><div class="bd"><p>${label}</p><input class="num" id="askIn" value="${esc(value)}" spellcheck="false"></div><div class="ft"><button type="button" class="btn" data-close>Huỷ</button><button class="btn primary">${okText}</button></div></form>`,
      (m, close) => { const i = m.querySelector('#askIn'); i.focus(); i.select(); m.querySelector('form').onsubmit = e => { e.preventDefault(); close(i.value.trim() || null); }; });
  }
  const confirmDlg = (title, msg, okText = 'Xoá') => modal(`${dlgHead(title)}<div class="bd"><p>${msg}</p></div><div class="ft"><button class="btn" data-close>Huỷ</button><button class="btn primary" id="okB">${okText}</button></div>`, (m, close) => { m.querySelector('#okB').onclick = () => close(true); m.querySelector('#okB').focus(); });
  function ctxMenu(x, y, items) {
    $$('.ctx').forEach(c => c.remove()); const c = document.createElement('div'); c.className = 'ctx';
    items.forEach(it => { if (it === '-') return c.append(document.createElement('hr')); const d = document.createElement('div'); d.textContent = it[0]; d.onclick = () => { c.remove(); it[1](); }; c.append(d); });
    document.body.append(c); const r = c.getBoundingClientRect();
    c.style.left = Math.max(4, Math.min(x, innerWidth - r.width - 6)) + 'px'; c.style.top = Math.max(4, Math.min(y, innerHeight - r.height - 6)) + 'px';
  }
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.ctx')) $$('.ctx').forEach(c => c.remove()); }, true);

  // ================= thao tác asset =================
  const clean = s => s.replace(/[\\/:*?"<>|]/g, '').trim();
  async function targetProject(folder, askName) {
    let p = folder && folder !== S.root ? projectOf(folder) : null;
    if (!p) { const n = await ask('Folder hiệu ứng mới', 'Tên folder (sẽ có sẵn Animations, Images, Prefabs bên trong)', askName, 'Tạo'); if (!n) return null; p = mkFolder(S.root, clean(n)); ['Animations', 'Images', 'Prefabs'].forEach(k => subFolder(p, k)); }
    return p;
  }
  async function createPrefab(kind, folder) {
    const p = await targetProject(folder, kind === 'particle' ? 'Particle_FX' : 'Projectile_FX'); if (!p) return;
    const n = await ask(kind === 'particle' ? 'Particle prefab mới' : 'Projectile prefab mới', 'Tên prefab', kind === 'particle' ? 'Particle' : 'Projectile', 'Tạo'); if (!n) return;
    const pf = kind === 'particle' ? await newParticle(p, clean(n)) : await newProjectile(p, clean(n));
    S.folder = parentOf(pf.id).id; openPrefab(pf); dirty(); renderAssets();
  }
  function openPrefab(pf) { S.tab = pf.kind; S.scene[S.tab] = [pf.id]; select(pf, pf.kind === 'particle' ? pf.nodes[0] : null); restart(); renderAll(); dirty(); }
  function removeAsset(a) {
    const ids = new Set(); walk(x => ids.add(x.id), a);
    const p = parentOf(a.id); p.children.splice(p.children.indexOf(a), 1); idx = null;
    walk(x => { if (x.type === 'prefab') { if (ids.has(x.seqAnim)) x.seqAnim = null; if (x.proj && ids.has(x.proj.impact)) x.proj.impact = null; x.nodes.forEach(n => { if (ids.has(n.image)) n.image = null; if (ids.has(n.anim)) n.anim = null; }); } if (x.type === 'anim') x.frames = x.frames.filter(f => !ids.has(f)); });
    for (const k in S.scene) S.scene[k] = S.scene[k].filter(id => !ids.has(id));
    if (S.sel && ids.has(S.sel.pf)) select(scenePfs()[0] || null);
    if (ids.has(S.folder)) S.folder = p.id;
    if (S.ref && ids.has(S.ref.img)) S.ref = null;
    restart(); dirty(); renderAll();
  }
  function applyPrefix(folder, prefix) {
    if (!/[_\-]$/.test(prefix)) prefix += '_'; let n = 0;
    const fix = s => s.startsWith(prefix) ? s : (n++, prefix + s);
    folder.children.forEach(c => walk(x => { x.name = fix(x.name); if (x.type === 'prefab') x.nodes.forEach(nd => nd.name = fix(nd.name)); }, c));
    dirty(); renderAll(); toast(`Đã thêm tiền tố "${esc(prefix)}" cho ${n} tên`);
  }
  async function renameAsset(a) { const n = await ask('Đổi tên', 'Tên mới', a.name); if (!n) return; a.name = uniq(parentOf(a.id), clean(n), a); dirty(); renderAll(); }
  function moveAsset(a, folder) {
    if (a === folder || parentOf(a.id) === folder) return; let ok = true; walk(x => { if (x === folder) ok = false; }, a); if (!ok) return;
    const p = parentOf(a.id); p.children.splice(p.children.indexOf(a), 1); a.name = uniq(folder, a.name); folder.children.push(a); dirty(); renderAssets();
  }
  function pickFiles(input) { return new Promise(ok => { input.value = ''; input.onchange = () => ok([...input.files]); input.click(); }); }
  // ---- nhập project từ zip ----
  async function importZip(file) {
    const t0 = toast('Đang đọc file zip…', 0);
    try {
      const res = await M.importer.parse(file, { uid, uuid4, defPS, loadImg }); let first = null, warn = [];
      for (const r of res) { const t = r.tree; t.name = uniq(S.root, t.name); S.root.children.push(t); idx = null; warn = warn.concat(r.warn);
        walk(a => { if (a.type !== 'prefab') return; first = first || a;
          if (a.kind === 'particle') { const e = emitters(a)[0]; a.mode = e && e.ps.posVar.x > 100 ? 'fall' : 'burst'; a.play = e && e.ps.duration !== -1 ? 'once' : 'loop'; } else a.proj = defProj(); }, t); }
      t0.remove(); dirty(); if (first) { S.folder = parentOf(first.id).id; openPrefab(first); } else renderAll();
      toast(`Đã nhập ${res.length} project từ "${esc(file.name)}"` + (warn.length ? `<br><span style="color:var(--warn)">${warn.slice(0, 3).map(esc).join('<br>')}</span>` : ''), warn.length ? 7000 : 3000);
    } catch (err) { t0.remove(); if (!err.user) console.error(err);
      modal(`${dlgHead('Không nhập được file zip')}<div class="bd"><p style="white-space:pre-wrap;color:var(--text)">${esc(err.user ? err.message : 'File zip không đúng định dạng project Cocos (' + err.message + ')')}</p><p>File zip cần có đủ 3 folder Animation, Images, Prefabs và các file .meta đi kèm (giống file do app này hoặc Cocos xuất ra).</p></div><div class="ft"><button class="btn primary" data-close>Đóng</button></div>`); }
  }
  // ---- scene: chỉ lưu đường dẫn tới prefab và ảnh nền ----
  const scenes = () => { const f = S.root.children.find(c => c.sys === 'Scenes'); return f ? f.children.filter(c => c.type === 'scene') : []; };
  function saveScene(name) {
    const f = sysFolder('Scenes'), ra = refAsset(), link = k => { const a = byId((S.scene[k] || [])[0]); return a ? pathOf(a) : null; };
    const data = { canvas: { w: S.canvas.w, h: S.canvas.h }, tab: S.tab, prefabs: { particle: link('particle'), projectile: link('projectile') }, bgColor: S.bg || 0, hidePath: !!S.hidePath,
      bg: ra ? { path: pathOf(ra), x: S.ref.x, y: S.ref.y, scale: S.ref.scale, opacity: S.ref.opacity, locked: S.ref.locked } : null };
    let sc = f.children.find(c => c.type === 'scene' && c.name === name); const had = !!sc;
    if (sc) Object.assign(sc, data); else sc = add(f, Object.assign({ type: 'scene', name }, data));
    dirty(); renderAssets(); toast(had ? `Đã cập nhật scene "${esc(name)}"` : `Đã lưu scene "${esc(name)}" vào folder Scenes`);
  }
  function loadScene(sc) {
    const miss = [];
    for (const k of ['particle', 'projectile']) { const path = sc.prefabs && sc.prefabs[k]; if (!path) { continue; } const a = resolve(path, 'prefab'); if (a) S.scene[k] = [a.id]; else { S.scene[k] = []; miss.push(path); } }
    if (sc.bg) { const a = resolve(sc.bg.path, 'image'); if (a) S.ref = { img: a.id, x: sc.bg.x, y: sc.bg.y, scale: sc.bg.scale, opacity: sc.bg.opacity, locked: sc.bg.locked }; else { S.ref = null; miss.push(sc.bg.path); } } else S.ref = null;
    if (sc.canvas) S.canvas = { w: sc.canvas.w, h: sc.canvas.h }; S.bg = sc.bgColor || 0; S.hidePath = !!sc.hidePath; if (sc.tab) S.tab = sc.tab;
    select(scenePfs()[0] || null); restart(); fitAll(); dirty(); renderAll();
    if (miss.length) modal(`${dlgHead('Scene thiếu file')}<div class="bd"><p>Các file sau đã bị xoá, đổi tên hoặc di chuyển nên không được nạp vào scene:</p><ul>${miss.map(m => `<li>${esc(m)}</li>`).join('')}</ul></div><div class="ft"><button class="btn primary" data-close>Đóng</button></div>`);
    else toast(`Đã mở scene "${esc(sc.name)}"`);
  }
  function sceneMenu(e) {
    const r = e.currentTarget.getBoundingClientRect(), l = scenes();
    ctxMenu(r.left, r.bottom + 4, [['Lưu scene…', async () => { const n = await ask('Lưu scene', 'Tên scene (trùng tên sẽ ghi đè). Scene chỉ lưu đường dẫn tới prefab đang mở và ảnh nền.', l.length ? l[l.length - 1].name : 'Scene_1', 'Lưu'); if (n) saveScene(clean(n)); }]]
      .concat(l.length ? ['-'] : [], l.map(sc => ['Mở: ' + sc.name, () => loadScene(sc)])));
  }
  function folderMenu(f, x, y) {
    const items = [['Particle prefab mới', () => createPrefab('particle', f)], ['Projectile prefab mới', () => createPrefab('projectile', f)], '-',
      ['Tạo folder con', async () => { const n = await ask('Folder mới', 'Tên folder', 'Folder', 'Tạo'); if (n) { mkFolder(f, clean(n)); dirty(); renderAssets(); } }],
      ['Import ảnh…', async () => { const fs = await pickFiles($('#fileImg')); if (fs.length) { await importFiles(fs, f); S.folder = f.id; dirty(); renderAssets(); } }],
      ['Nhập tên tiền tố…', async () => { const n = await ask('Nhập tên tiền tố', `Thêm tiền tố vào tên của mọi file, folder con và node nằm trong "${esc(f.name)}" (vd: 9683_)`, '', 'Thêm tiền tố'); if (n) applyPrefix(f, clean(n)); }]];
    if (f === S.root) items.push('-', ['Nhập project từ zip…', async () => { const fs = await pickFiles($('#fileZip')); for (const z of fs) await importZip(z); }]);
    if (f !== S.root) items.push('-', ['Đổi tên', () => renameAsset(f)], ['Xoá', async () => { if (await confirmDlg('Xoá folder', `Xoá "${esc(f.name)}" và mọi thứ bên trong?`)) removeAsset(f); }]);
    ctxMenu(x, y, items);
  }
  function fileMenu(a, x, y) {
    const items = [];
    if (a.type === 'prefab') items.push(['Mở', () => openPrefab(a)]);
    if (a.type === 'scene') items.push(['Mở scene', () => loadScene(a)]);
    if (a.type === 'image') items.push(['Đặt làm ảnh nền', () => setRef(a)]);
    items.push(['Nhân bản (Ctrl+D)', () => dupAsset(a)]);
    items.push(['Đổi tên', () => renameAsset(a)], ['Xoá', async () => { if (await confirmDlg('Xoá', `Xoá "${esc(a.name)}"?`)) removeAsset(a); }]);
    ctxMenu(x, y, items);
  }

  // ================= render: assets =================
  function renderAssets() {
    idx = null; let f = byId(S.folder); if (!f || f.type !== 'folder') { f = S.root; S.folder = 'root'; }
    const rows = [], col = S.collapsed || (S.collapsed = {});
    for (let p = parentOf(f.id); p; p = parentOf(p.id)) delete col[p.id];      // luôn mở các folder cha của folder đang chọn
    (function rec(x, d) { const subs = x.children.filter(c => c.type === 'folder'), shut = !!col[x.id];
      rows.push(`<div class="row-item ${x.id === S.folder ? 'sel' : ''}" style="padding-left:${6 + d * 16}px" data-fid="${x.id}" data-drop="folder:${x.id}"><i class="caret ${shut ? '' : 'open'} ${subs.length ? '' : 'none'}" data-caret title="${shut ? 'Mở rộng' : 'Thu gọn'}">${IC.caret}</i>${IC.folder}<span>${esc(x.name)}</span></div>`);
      if (!shut) subs.forEach(c => rec(c, d + 1)); })(S.root, 0);
    $('#ftree').innerHTML = rows.join('');
    $('#curFolder').textContent = f === S.root ? '' : '/ ' + f.name;
    const order = { folder: 0, scene: 1, prefab: 1, anim: 2, image: 3 };
    $('#grid').innerHTML = [...f.children].sort((a, b) => order[a.type] - order[b.type] || natural(a, b)).map(a => {
      let ic = '', st = '';
      if (a.type === 'folder') ic = `<i class="fd">${IC.folder}</i>`;
      else if (a.type === 'image') st = a.data;
      else if (a.type === 'anim') { const fr = byId(a.frames[0]); if (fr) st = fr.data; else ic = `<i class="an">${IC.anim}</i>`; }
      else if (a.type === 'scene') ic = `<i class="an">${IC.scene}</i>`;
      else ic = a.kind === 'particle' ? `<i class="pf">${IC.spark}</i>` : `<i class="pj">${IC.proj}</i>`;
      const tip = { folder: 'Folder', image: `Ảnh ${a.w}×${a.h}`, anim: `Animation clip · ${a.frames ? a.frames.length : 0} hình`, prefab: a.kind === 'particle' ? 'Particle prefab — bấm đúp để mở' : 'Projectile prefab — bấm đúp để mở', scene: 'Scene — bấm đúp để mở' }[a.type];
      return `<div class="thumb ${(S.scene[S.tab] || []).includes(a.id) ? 'sel' : ''} ${S.selAsset === a.id ? 'pick' : ''}" data-aid="${a.id}" title="${esc(a.name)} · ${tip}"${a.type === 'folder' ? ` data-drop="folder:${a.id}"` : ''}>${ic || `<i style="background-image:url(${st})"></i>`}${esc(a.name)}</div>`;
    }).join('') || '<div class="note" style="padding:8px">Folder trống. Bấm chuột phải để tạo prefab hoặc import ảnh, hoặc kéo ảnh từ ngoài vào đây.</div>';
  }
  $('#ftree').addEventListener('click', e => { const r = e.target.closest('[data-fid]'); if (!r) return; area = 'ftree';
    if (e.target.closest('[data-caret]')) { const c = S.collapsed || (S.collapsed = {}), id = r.dataset.fid; if (c[id]) delete c[id]; else { c[id] = 1; let inside = false; walk(x => { if (x.id === S.folder && x.id !== id) inside = true; }, byId(id)); if (inside) S.folder = id; } dirty(); return renderAssets(); }
    S.folder = r.dataset.fid; S.selAsset = null; renderAssets(); });
  $('#ftree').addEventListener('dblclick', e => { const r = e.target.closest('[data-fid]'); if (!r || e.target.closest('[data-caret]')) return; const c = S.collapsed || (S.collapsed = {}), id = r.dataset.fid; if (c[id]) delete c[id]; else c[id] = 1; dirty(); renderAssets(); });
  $('#ftree').addEventListener('contextmenu', e => { e.preventDefault(); const r = e.target.closest('[data-fid]'); if (r) { S.folder = r.dataset.fid; renderAssets(); folderMenu(byId(r.dataset.fid), e.clientX, e.clientY); } });
  $('#gridWrap').addEventListener('contextmenu', e => { e.preventDefault(); const t = e.target.closest('[data-aid]'), a = t && byId(t.dataset.aid); if (a && a.type !== 'folder') fileMenu(a, e.clientX, e.clientY); else folderMenu(a || byId(S.folder), e.clientX, e.clientY); });
  $('#gridWrap').addEventListener('dblclick', e => { const t = e.target.closest('[data-aid]'), a = t && byId(t.dataset.aid); if (!a) return; if (a.type === 'folder') { S.folder = a.id; renderAssets(); } else if (a.type === 'prefab') openPrefab(a); else if (a.type === 'scene') loadScene(a); });
  $('#btnAddAsset').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); folderMenu(byId(S.folder) || S.root, r.left - 180, r.bottom + 4); };

  // kéo asset (pointer events, có ghost)
  let ad = null, area = 'tree';
  $('#grid').addEventListener('pointerdown', e => { const t = e.target.closest('[data-aid]'); area = 'assets'; if (!t) { if (S.selAsset) { S.selAsset = null; renderAssets(); } return; } if (S.selAsset !== t.dataset.aid) { S.selAsset = t.dataset.aid; $$('#grid .thumb').forEach(x => x.classList.toggle('pick', x.dataset.aid === S.selAsset)); } if (e.button !== 0) return; ad = { a: byId(t.dataset.aid), x: e.clientX, y: e.clientY, g: null, on: null }; });
  const accepts = (drop, a) => { const k = drop.split(':')[0]; return k === 'view' ? a.type === 'prefab' || a.type === 'image' : k === 'tree' ? a.type === 'prefab' : k === 'folder' ? true : k === 'img' ? a.type === 'image' : k === 'seq' ? a.type === 'anim' : k === 'sanim' ? a.type === 'image' || a.type === 'anim' : k === 'impact' ? a.type === 'prefab' && a.kind === 'particle' : false; };
  document.addEventListener('pointermove', e => {
    if (!ad) return;
    if (!ad.g) { if (Math.hypot(e.clientX - ad.x, e.clientY - ad.y) < 5) return; ad.g = document.createElement('div'); ad.g.className = 'ghost'; ad.g.textContent = ad.a.name; document.body.append(ad.g); document.body.style.cursor = 'grabbing'; }
    ad.g.style.left = e.clientX + 12 + 'px'; ad.g.style.top = e.clientY + 10 + 'px';
    const el = document.elementFromPoint(e.clientX, e.clientY), t = el && el.closest('[data-drop]'), ok = t && accepts(t.dataset.drop, ad.a) ? t : null;
    if (ad.on !== ok) { ad.on && ad.on.classList.remove('drop-on'); ok && ok.classList.add('drop-on'); ad.on = ok; }
  });
  document.addEventListener('pointerup', () => {
    if (!ad) return; const d = ad; ad = null; document.body.style.cursor = '';
    if (d.g) d.g.remove(); if (!d.on) return; d.on.classList.remove('drop-on'); dropAsset(d.on.dataset.drop, d.a);
  });
  const isBuiltin = n => { const i = byId(n.image); return !i || !!i.builtin; };
  const whiten = n => { if (n.type !== 'emitter' || !isBuiltin(n)) return; for (const k of ['startColor', 'endColor']) Object.assign(n.ps[k], { r: 255, g: 255, b: 255 }); };
  function dropAsset(drop, a) {
    const [k, id] = drop.split(':'), pf = cur(), n = selNode();
    if (k === 'view' && a.type === 'image') return setRef(a);
    if (k === 'view' || k === 'tree') return openPrefab(a);
    if (k === 'folder') return moveAsset(a, byId(id));
    if (k === 'img' && n) { if (!a.builtin) whiten(n); n.image = a.id; }
    if (k === 'seq' && pf) { emitters(pf).forEach(whiten); pf.seqAnim = a.id; }
    if (k === 'sanim' && n) { if (a.type === 'anim') n.anim = a.id; else { n.image = a.id; n.anim = null; } }
    if (k === 'impact' && pf) { if (a === pf) return; pf.proj.impact = a.id; }
    dirty(); renderProps();
  }
  // kéo file từ ngoài vào
  document.addEventListener('dragover', e => { if (![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); const t = e.target.closest && e.target.closest('[data-drop]'); $$('.drop-on').forEach(x => x !== t && x.classList.remove('drop-on')); if (t && /^(img|seq|sanim|grid|folder)/.test(t.dataset.drop)) t.classList.add('drop-on'); });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) $$('.drop-on').forEach(x => x.classList.remove('drop-on')); });
  document.addEventListener('drop', async e => {
    if (![...e.dataTransfer.types].includes('Files')) return; e.preventDefault(); $$('.drop-on').forEach(x => x.classList.remove('drop-on'));
    const zips = [...e.dataTransfer.files].filter(f => /\.zip$/i.test(f.name)); if (zips.length) { for (const z of zips) await importZip(z); return; }
    const t = e.target.closest && e.target.closest('[data-drop]'), files = [...e.dataTransfer.files].filter(isImg); if (!t || !files.length) return;
    const [k, id] = t.dataset.drop.split(':');
    if (k === 'grid' || k === 'folder') { const f = byId(k === 'grid' ? S.folder : id); await importFiles(files, f); S.folder = f.id; dirty(); renderAssets(); toast(`Đã thêm ${files.length} ảnh vào "${esc(f.name)}"`); }
    else await slotFiles(k, files);
  });
  // ảnh từ ngoài -> tự clone vào folder Images của prefab đang mở rồi gán
  async function slotFiles(k, files, seqName) {
    const pf = cur(), n = selNode(); if (!pf) return; const project = projectOf(pf); if (!project) return;
    if (k === 'seq' || (k === 'sanim' && files.length > 1)) {
      const an = await makeSequence(files, clean(seqName || files[0].name.replace(/\.\w+$/, '').replace(/[_\-\s]*\d+$/, '') || 'Seq'), project); if (!an) return;
      if (k === 'seq') { emitters(pf).forEach(whiten); pf.seqAnim = an.id; } else if (n) n.anim = an.id;
      toast(`Đã tạo chuỗi hình "${esc(an.name)}" · ${an.frames.length} hình`);
    } else if (n) { const im = await importFiles(files.slice(0, 1), subFolder(project, 'Images')); if (!im.length) return; whiten(n); n.image = im[0].id; if (k === 'sanim') n.anim = null; toast(`Đã thêm ảnh "${esc(im[0].name)}" vào ${esc(subFolder(project, 'Images').name)}`); }
    dirty(); renderAll();
  }

  // ================= render: node tree =================
  function renderTree() {
    const list = scenePfs(), c = cur(), sn = selNode();
    if (!list.length) { $('#treeList').innerHTML = '<div class="note" style="padding:8px 10px">Chưa mở prefab. Bấm đúp vào 1 prefab trong Assets.</div>'; return; }
    $('#treeList').innerHTML = list.map(pf =>
      `<div class="row-item ${pf === c && !sn ? 'sel' : ''} ${pf.hidden ? 'off' : ''}" data-pf="${pf.id}" data-nid="" data-key="${pf.id}" title="Bấm đúp để đổi tên · giữ và kéo để đổi thứ tự">${pf.kind === 'particle' ? IC.root : IC.proj}<span>${esc(pf.name)}</span><button class="mini" data-act="eye" title="Ẩn / hiện trong xem trước">${IC.eye}</button></div>` +
      pf.nodes.map(n => `<div class="row-item ${n === sn ? 'sel' : ''} ${n.hidden || pf.hidden ? 'off' : ''}" style="padding-left:26px" data-pf="${pf.id}" data-nid="${n.id}" data-key="${n.id}" title="Bấm đúp để đổi tên · giữ và kéo để đổi thứ tự">${IC[n.type]}<span>${esc(n.name)}</span><button class="mini" data-act="eye" title="Ẩn / hiện trong xem trước">${IC.eye}</button>${n.type === 'emitter' ? `<button class="mini" data-act="del" title="Xoá emitter (Delete)">${IC.x}</button>` : ''}</div>`).join('')).join('');
  }
  // vẽ lại danh sách có animation trượt (FLIP) theo data-key
  function flipRender(box, render) {
    const first = new Map([...box.querySelectorAll('[data-key]')].map(el => [el.dataset.key, el.getBoundingClientRect()]));
    render();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    box.querySelectorAll('[data-key]').forEach(el => { const a = first.get(el.dataset.key); if (!a) return; const b = el.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top; if (!dx && !dy) return;
      el.style.transition = 'none'; el.style.transform = `translate(${dx}px,${dy}px)`;
      requestAnimationFrame(() => { el.style.transition = 'transform var(--t-med) var(--ease-out)'; el.style.transform = ''; }); });
  }
  const pfOf = id => scenePfs().find(p => p.id === id);
  function delNode(pf, id) { const i = pf.nodes.findIndex(n => n.id === id); if (i < 0) return; pf.nodes.splice(i, 1); if (S.sel && S.sel.node === id) select(pf); RT.delete(pf.id); dirty(); flipRender($('#treeList'), renderTree); renderProps(); }
  function unscene(pf) { const l = S.scene[S.tab], i = l.indexOf(pf.id); if (i < 0) return; l.splice(i, 1); select(scenePfs()[Math.min(i, l.length - 1)] || null); dirty(); flipRender($('#treeList'), renderTree); renderProps(); renderAssets(); toast(`Đã bỏ "${esc(pf.name)}" khỏi Node Tree. File trong Assets vẫn còn.`); }
  function delSelected() { const pf = cur(); if (!pf || !S.sel) return; const n = selNode(); if (n) delNode(pf, n.id); else unscene(pf); }
  function addToScene(pf, after) {
    return openPrefab(pf);
    const l = S.scene[S.tab]; if (l.includes(pf.id)) { select(pf); renderAll(); return toast(`"${esc(pf.name)}" đã có trong Node Tree`); }
    const i = after ? l.indexOf(after.id) + 1 : l.length; l.splice(i, 0, pf.id); select(pf); dirty(); flipRender($('#treeList'), renderTree); renderProps(); renderAssets(); renderPathBtn();
  }
  function dupAsset(a) {
    if (!a || a.type === 'folder') { toast('Chỉ nhân bản được file (prefab, ảnh, animation clip)'); return null; }
    const c = clone(a); delete c.id; if (c.nodes) c.nodes.forEach(n => n.id = uid()); if (c.sub) c.sub = uuid4();
    c.name = a.name + '_copy'; add(parentOf(a.id), c); dirty(); renderAssets(); return c;
  }
  // Ctrl+D: nhân bản node đang chọn, hoặc cả prefab nếu đang chọn gốc
  function dupSelected() {
    const pf = cur(); if (!pf) return; const n = selNode();
    if (n) { const c = Object.assign(clone(n), { id: uid(), name: nodeName(pf, n.name.replace(/_\d+$/, '')) }); pf.nodes.splice(pf.nodes.indexOf(n) + 1, 0, c); select(pf, c); dirty(); flipRender($('#treeList'), renderTree); renderProps(); }
    else { const c = dupAsset(pf); if (c) toast(`Đã nhân bản thành "${esc(c.name)}" trong Assets`); }
  }
  // bấm chọn / nút ẩn / nút xoá
  $('#treeList').addEventListener('click', e => {
    const r = e.target.closest('[data-pf]'); if (!r) return; const pf = pfOf(r.dataset.pf); if (!pf) return; const n = pf.nodes.find(x => x.id === r.dataset.nid), b = e.target.closest('[data-act]');
    if (b) { if (b.dataset.act === 'del') { if (n && n.type === 'emitter') delNode(pf, n.id); return; } const t = n || pf; t.hidden = !t.hidden; dirty(); return renderTree(); }
  });
  $('#treeList').addEventListener('dblclick', async e => {
    const r = e.target.closest('[data-pf]'); if (!r || e.target.closest('[data-act]')) return; const pf = pfOf(r.dataset.pf); if (!pf) return;
    if (!r.dataset.nid) return renameAsset(pf);
    const n = pf.nodes.find(x => x.id === r.dataset.nid), v = await ask('Đổi tên node', 'Tên mới', n.name); if (!v) return;
    let name = clean(v); if (pf.nodes.some(x => x !== n && x.name === name)) name = nodeName(pf, name); n.name = name; dirty(); renderTree(); renderProps();
  });
  // giữ và kéo để đổi thứ tự (node trong cùng prefab, hoặc các prefab với nhau)
  let td = null;
  $('#treeList').addEventListener('pointerdown', e => {
    area = 'tree'; const r = e.target.closest('[data-pf]'); if (!r || e.button !== 0 || e.target.closest('[data-act]')) return; const pf = pfOf(r.dataset.pf); if (!pf) return;
    const n = pf.nodes.find(x => x.id === r.dataset.nid) || null;
    if (!S.sel || S.sel.pf !== pf.id || S.sel.node !== (n ? n.id : null)) { select(pf, n); $$('#treeList .row-item').forEach(x => x.classList.toggle('sel', x === r)); renderProps(); renderPathBtn(); }
    td = { pf, n, x: e.clientX, y: e.clientY, g: null, to: null };
  });
  viewEl.addEventListener('pointerdown', () => area = 'tree');
  document.addEventListener('pointermove', e => {
    if (!td) return; const box = $('#treeList');
    if (!td.g) { if (Math.hypot(e.clientX - td.x, e.clientY - td.y) < 5) return; td.g = document.createElement('div'); td.g.className = 'ghost'; td.g.textContent = td.n ? td.n.name : td.pf.name; document.body.append(td.g);
      td.line = document.createElement('div'); td.line.className = 'dropline'; box.append(td.line); document.body.style.cursor = 'grabbing'; }
    td.g.style.left = e.clientX + 12 + 'px'; td.g.style.top = e.clientY + 10 + 'px'; td.to = null;
    const el = document.elementFromPoint(e.clientX, e.clientY), row = el && el.closest('#treeList [data-pf]'); let y = null;
    if (row) { const rc = row.getBoundingClientRect(), below = e.clientY > rc.top + rc.height / 2, tp = pfOf(row.dataset.pf), bx = box.getBoundingClientRect();
      if (td.n) { if (tp === td.pf) { const i = row.dataset.nid ? td.pf.nodes.findIndex(x => x.id === row.dataset.nid) + (below ? 1 : 0) : 0; td.to = { i }; y = (row.dataset.nid && !below ? rc.top : rc.bottom); } }
      else if (tp) { const l = S.scene[S.tab], rows = [...box.querySelectorAll(`[data-pf="${tp.id}"]`)], top = rows[0].getBoundingClientRect().top, bot = rows[rows.length - 1].getBoundingClientRect().bottom, after = e.clientY > (top + bot) / 2;
        td.to = { i: l.indexOf(tp.id) + (after ? 1 : 0) }; y = after ? bot : top; }
      if (y !== null) td.line.style.top = y - bx.top + box.scrollTop - 1 + 'px'; }
    td.line.style.display = td.to ? 'block' : 'none';
  });
  document.addEventListener('pointerup', () => {
    if (!td) return; const d = td; td = null; document.body.style.cursor = ''; if (!d.g) return; d.g.remove(); d.line.remove(); if (!d.to) return;
    const arr = d.n ? d.pf.nodes : S.scene[S.tab], item = d.n || d.pf.id, from = arr.indexOf(item); let to = d.to.i; if (to > from) to--; if (to === from) return;
    arr.splice(from, 1); arr.splice(to, 0, item); if (d.n) RT.delete(d.pf.id); dirty(); flipRender($('#treeList'), renderTree);
  });
  $('#btnAddNode').onclick = async e => {
    const pf = cur(); if (!pf) return toast('Chưa có prefab trong Node Tree');
    const addEm = async () => { const src = selNode() && selNode().type === 'emitter' ? selNode() : emitters(pf)[emitters(pf).length - 1], base = src ? src.name.replace(/_\d+$/, '') : 'Emitter';
      const n = src ? Object.assign(clone(src), { id: uid(), name: nodeName(pf, base) }) : { id: uid(), type: 'emitter', name: nodeName(pf, base), x: 0, y: 0, image: (await builtinImg(projectOf(pf), 'Circle')).id, ps: defPS() };
      pf.nodes.splice(src ? pf.nodes.indexOf(src) + 1 : 0, 0, n); if (!src && pf.kind === 'particle') applyMode(pf, [n]); select(pf, n); dirty(); renderAll(); };
    if (pf.kind === 'particle') return addEm();
    const r = e.currentTarget.getBoundingClientRect();
    ctxMenu(r.left - 150, r.bottom + 4, [['Thêm emitter (đuôi / trail)', addEm], ['Thêm Head (sprite)', async () => { const n = { id: uid(), type: 'sprite', name: nodeName(pf, 'Head'), x: 0, y: 0, image: (await builtinImg(projectOf(pf), 'Glow')).id, anim: null, srcBlend: 'SRC_ALPHA', dstBlend: 'ONE' }; pf.nodes.push(n); select(pf, n); dirty(); renderAll(); }]]);
  };

  // ================= render: properties =================
  const gp = (o, k) => k.split('.').reduce((a, c) => a == null ? a : a[c], o);
  const sp = (o, k, v) => { const p = k.split('.'), l = p.pop(); p.reduce((a, c) => a[c], o)[l] = v; };
  const target = o => o === 'node' ? selNode() : o === 'pf' ? cur() : o === 'proj' ? cur().proj : o === 'canvas' ? S.canvas : byId(o);
  const hex = c => '#' + [c.r, c.g, c.b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  const num = (o, k, tip = '') => `<input class="num" type="number" step="any" data-o="${o}" data-k="${k}" value="${gp(target(o), k)}" title="${tip}">`;
  const row = (label, a, b = '', tip = '') => `<div class="f"><label title="${tip || label}">${label}</label>${b === '' ? a.replace('class="num"', 'class="num w2"') : a + b}</div>`;
  const fN = (label, o, k, k2, tip) => row(label, num(o, k, label), k2 ? num(o, k2, label + ' Var') : '', tip);
  const fXY = (label, o, k, tip) => row(label, num(o, k + '.x', 'X'), num(o, k + '.y', 'Y'), tip);
  const fCol = (label, o, k) => `<div class="f"><label>${label}</label><div class="colr w2"><input type="color" data-o="${o}" data-k="${k}" data-col value="${hex(gp(target(o), k))}" title="${label}"><input class="num" type="number" min="0" max="255" data-o="${o}" data-k="${k}.a" value="${gp(target(o), k).a}" title="Alpha (0–255)"></div></div>`;
  const fSel = (label, o, k, opts, n) => `<div class="f"><label>${label}</label><select class="num w2" data-o="${o}" data-k="${k}" ${n ? 'data-n' : ''}>${opts.map(([v, t]) => `<option value="${v}" ${String(gp(target(o), k)) === String(v) ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
  const seg = (o, k, opts) => `<div class="seg w2">${opts.map(([v, t]) => `<button data-seg="${o}|${k}|${v}" class="${String(gp(target(o), k)) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const BL = Object.keys(M.GLB).map(k => [k, k]);
  function slot(drop, asset, title, sub, clear) {
    let bg = '', ic = '';
    if (asset && asset.type === 'image') bg = asset.data; else if (asset && asset.type === 'anim') { const f = byId(asset.frames[0]); if (f) bg = f.data; } else if (asset && asset.type === 'prefab') ic = IC.spark;
    return `<div class="slot" data-drop="${drop}" data-pick="${drop}" title="Bấm để chọn file, hoặc kéo từ Assets / từ ngoài vào"><i ${bg ? `style="background-image:url(${bg})"` : ''}>${ic}</i><span><b>${asset ? esc(asset.name) : title}</b>${sub}</span>${asset && clear ? `<button class="mini" data-clear="${clear}" title="Gỡ">${IC.x}</button>` : ''}</div>`;
  }
  const nodeSec = (o, title, pos = true) => `<div class="sec"><b>${title}</b>${pos ? row('Position', num(o, 'x', 'X'), num(o, 'y', 'Y')) : ''}${row('Rotation', num(o, 'rot', 'Góc xoay (độ, ngược chiều kim đồng hồ)'), '<small>độ</small>')}${row('Scale', num(o, 'sx', 'Scale X'), num(o, 'sy', 'Scale Y'))}</div>`;
  // ---- tab "M particle": tên tiếng Việt gọn, mỗi ô ghi thẳng vào thông số Cocos tương ứng ----
  const P1 = k => ({ g: s => s[k], s: (s, v) => { s[k] = v; } }), P2 = (k, a) => ({ g: s => s[k][a], s: (s, v) => { s[k][a] = v; } });
  const MF = {
    total: { g: s => s.totalParticles, s: (s, v) => { s.totalParticles = Math.max(1, Math.round(v)); } }, rate: P1('emissionRate'), life: P1('life'), lifeV: P1('lifeVar'), dur: P1('duration'),
    size0: P1('startSize'), size0V: P1('startSizeVar'), size1: P1('endSize'), size1V: P1('endSizeVar'),
    spin0: { g: s => s.startSpin, s: (s, v) => { s.endSpin = r1(s.endSpin + v - s.startSpin); s.startSpin = v; } }, spin0V: P1('startSpinVar'),
    spinSpd: { g: s => r1((s.endSpin - s.startSpin) / Math.max(.01, s.life)), s: (s, v) => { s.endSpin = r1(s.startSpin + v * s.life); } },
    spinSpdV: { g: s => r1(s.endSpinVar / Math.max(.01, s.life)), s: (s, v) => { s.endSpinVar = r1(Math.abs(v) * s.life); } },
    dir: P1('angle'), dirV: P1('angleVar'), spd: P1('speed'), spdV: P1('speedVar'), gx: P2('gravity', 'x'), gy: P2('gravity', 'y'), pvx: P2('posVar', 'x'), pvy: P2('posVar', 'y'),
    radial: P1('radialAccel'), radialV: P1('radialAccelVar'), tang: P1('tangentialAccel'), tangV: P1('tangentialAccelVar')
  };
  const MS = {
    blend: { g: s => s.srcBlend === 'SRC_ALPHA' && s.dstBlend === 'ONE_MINUS_SRC_ALPHA' ? 'normal' : s.srcBlend === 'SRC_ALPHA' && s.dstBlend === 'ONE' ? 'add' : 'custom', s: (s, v) => { if (v === 'custom') return; s.srcBlend = 'SRC_ALPHA'; s.dstBlend = v === 'add' ? 'ONE' : 'ONE_MINUS_SRC_ALPHA'; } },
    follow: { g: s => String(s.positionType), s: (s, v) => { s.positionType = +v; } },
    rotdir: { g: s => String(!!s.rotationIsDir), s: (s, v) => { s.rotationIsDir = v === 'true'; } }
  };
  const ptabs = () => `<div class="seg ptab"><button data-ptab="m" class="${S.ptab === 'cc' ? '' : 'on'}" title="Thông số gọn bằng tiếng Việt">M particle</button><button data-ptab="cc" class="${S.ptab === 'cc' ? 'on' : ''}" title="Thông số gốc của Cocos">CC</button></div>`;
  function mProps(n) {
    const s = n.ps, mi = (k, tip = '') => `<input class="num" type="number" step="any" data-m="${k}" value="${MF[k].g(s)}" title="${tip}">`;
    const mN = (label, k, k2, tip, unit) => row(label, mi(k, label), k2 ? mi(k2, 'Độ lệch ngẫu nhiên ±') : unit ? `<small>${unit}</small>` : '', tip);
    const mS = (label, k, opts, tip = '') => `<div class="f"><label title="${tip || label}">${label}</label><select class="num w2" data-ms="${k}">${opts.map(([v, t]) => `<option value="${v}" ${MS[k].g(s) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
    const bl = MS.blend.g(s);
    return `<div class="note" style="margin:0 0 8px">Ô bên phải (nếu có) là độ lệch ngẫu nhiên ±. Mọi thay đổi ở đây tự cập nhật sang tab CC.</div>
      <b class="sub">Số lượng</b>${mN('Số hạt tối đa', 'total', '', 'Số hạt nhiều nhất có mặt cùng lúc', 'hạt')}${mN('Hạt sinh mỗi giây', 'rate', '', 'Mỗi giây sinh ra bao nhiêu hạt', 'hạt/giây')}${mN('Thời gian sống', 'life', 'lifeV', 'Mỗi hạt tồn tại bao nhiêu giây')}${mN('Thời gian phát', 'dur', '', 'Emitter phát trong bao nhiêu giây. -1 = phát mãi', 'giây (-1 = mãi)')}
      <b class="sub">Màu</b>${fCol('Màu bắt đầu', 'node', 'ps.startColor')}${fCol('Màu kết thúc', 'node', 'ps.endColor')}${mS('Kiểu hoà màu', 'blend', [['normal', 'Normal (hình đặc)'], ['add', 'Additive (phát sáng)']].concat(bl === 'custom' ? [['custom', 'Tuỳ chỉnh (xem tab CC)']] : []), 'Normal: hình đặc như ảnh gốc. Additive: cộng sáng, hợp với lửa, tia sáng')}
      <b class="sub">Kích thước</b>${mN('Kích thước đầu', 'size0', 'size0V', 'Kích thước hạt lúc sinh ra (px)')}${mN('Kích thước cuối', 'size1', 'size1V', 'Kích thước hạt lúc biến mất (px). -1 = giữ nguyên')}
      <b class="sub">Xoay hạt</b>${mN('Góc xoay ban đầu', 'spin0', 'spin0V', 'Góc của hạt lúc sinh ra (độ)')}${mN('Tốc độ xoay', 'spinSpd', 'spinSpdV', 'Hạt tự xoay bao nhiêu độ mỗi giây')}${mS('Xoay theo hướng bay', 'rotdir', [['false', 'Không'], ['true', 'Có']], 'Hạt tự quay đầu theo hướng đang bay')}
      <b class="sub">Chuyển động</b>${s.emitterMode === 0 ? mN('Hướng bay', 'dir', 'dirV', 'Hướng bắn hạt (độ): 0 = sang phải, 90 = lên trên') + mN('Tốc độ bay', 'spd', 'spdV', 'Tốc độ lúc bắn ra (px/giây)') + row('Trọng lực', mi('gx', 'Ngang (X)'), mi('gy', 'Dọc (Y): số âm = rơi xuống'), 'Lực kéo hạt theo ngang / dọc') + mN('Hút / đẩy khỏi tâm', 'radial', 'radialV', 'Số âm: hút về tâm. Số dương: đẩy ra xa') + mN('Xoáy quanh tâm', 'tang', 'tangV', 'Hạt bay vòng quanh tâm')
        : '<div class="note">Emitter này đang ở chế độ RADIUS (bay vòng tròn). Chỉnh ở tab CC.</div>'}
      <b class="sub">Vị trí</b>${row('Vị trí', num('node', 'x', 'X'), num('node', 'y', 'Y'), 'Vị trí của emitter')}${row('Độ lệch vị trí', mi('pvx', 'Ngang ±'), mi('pvy', 'Dọc ±'), 'Hạt sinh ra ngẫu nhiên trong vùng ± này quanh emitter')}${mS('Hạt đi theo emitter', 'follow', [['0', 'Không (hạt ở lại chỗ sinh ra)'], ['2', 'Có (đi theo emitter)'], ['1', 'Theo node cha']], 'Khi emitter di chuyển, hạt đã sinh có đi theo không')}`;
  }
  function projProps(pj) {
    const pt = (label, o, kx, ky) => row(label, num(o, kx, 'X'), num(o, ky, 'Y'));
    let pts = '';
    if (pj.preset === 'arc2') pts = pt('Điểm đầu (A)', 'proj', 'sx', 'sy') + pt('Điểm cuối (B)', 'proj', 'ex', 'ey') + row('Độ cong', num('proj', 'amp'), '<small>px</small>');
    else if (pj.preset === 'arc3') pts = pt('Điểm đầu (A)', 'proj', 'sx', 'sy') + pt('Điểm giữa (C)', 'proj', 'cx', 'cy') + pt('Điểm cuối (B)', 'proj', 'ex', 'ey');
    else if (pj.preset === 'circle') pts = [0, 1, 2, 3].map(i => pt('Điểm ' + (i + 1), 'proj', `circle.${i}.x`, `circle.${i}.y`)).join('');
    else pts = `<div class="f"><label>Vẽ đường</label><button class="btn w2 ${drawMode ? 'primary' : ''}" data-draw title="Bấm rồi giữ chuột trái kéo trên Viewport để vẽ đường bay">${drawMode ? 'Đang chờ vẽ…' : 'Vẽ đường bay trên Viewport'}</button></div><div class="note">${pj.free.length > 1 ? 'Đã có đường vẽ (' + pj.free.length + ' điểm). Bấm nút để vẽ lại.' : 'Chưa có đường vẽ: bấm nút rồi kéo chuột trên Viewport.'}</div>`;
    return `<div class="sec"><b>Preset đường bay</b><div class="presets" style="grid-template-columns:repeat(2,1fr)">${Object.entries(M.sim.PRESETS).map(([k, p]) => `<div class="chip ${pj.preset === k ? 'on' : ''}" data-preset="${k}"><svg viewBox="0 0 80 46"><path d="${p.icon}" stroke="${p.color}"/></svg>${p.name}</div>`).join('')}</div>
        <div class="note">Kéo các điểm tròn trên Viewport để chỉnh. Đường bay chỉ để xem trước, khi xuất prefab nằm tại (0,0).</div></div>
      <div class="sec"><b>Đường bay (xem trước)</b>${pts}
        ${row('Thời gian bay', num('proj', 'dur'), '<small>giây</small>')}${row('Độ random', num('proj', 'rand'), '<small>px</small>')}${row('Số biến thể', num('proj', 'variants'), '<small>đường cùng màu</small>')}
        ${fSel('Tốc độ', 'proj', 'ease', [['linear', 'Đều'], ['in', 'Nhanh dần'], ['out', 'Chậm dần'], ['inout', 'Chậm – nhanh – chậm']])}
        <div class="f"><label>Xoay theo hướng</label>${seg('proj', 'rotateDir', [[true, 'Có'], [false, 'Không']])}</div>${row('Góc lệch', num('proj', 'rotOffset'), '<small>độ</small>', 'Xoay thêm cho Head')}</div>`;
  }
  function emitterProps(n, seqOn) {
    const s = n.ps, g = s.emitterMode === 0;
    return `<div class="sec"><b>Hình ảnh hạt</b>${slot('img', byId(n.image), 'Sprite Frame', seqOn ? 'Đang dùng chuỗi hình. Ảnh này dùng khi gỡ chuỗi hình' : 'Kéo ảnh vào đây hoặc bấm để chọn')}</div>
    ${nodeSec('node', 'Node')}
    <div class="sec">${ptabs()}${S.ptab === 'cc' ? `<div class="note" style="margin:0 0 8px">Thông số gốc của Cocos: tên trùng với ParticleSystem trong Cocos Creator. Cột phải là giá trị "Var" (độ lệch ngẫu nhiên ±).</div>
      ${fN('Duration', 'node', 'ps.duration', '', 'Thời gian phát (giây). -1 = loop mãi')}${fN('Emission Rate', 'node', 'ps.emissionRate', '', 'Số hạt sinh ra mỗi giây')}${fN('Life', 'node', 'ps.life', 'ps.lifeVar', 'Thời gian sống của hạt (giây) và độ lệch')}${fN('Total Particles', 'node', 'ps.totalParticles', '', 'Số hạt tối đa cùng lúc')}
      ${fCol('Start Color', 'node', 'ps.startColor')}${fCol('Start Color Var', 'node', 'ps.startColorVar')}${fCol('End Color', 'node', 'ps.endColor')}${fCol('End Color Var', 'node', 'ps.endColorVar')}
      ${fN('Angle', 'node', 'ps.angle', 'ps.angleVar', 'Hướng bắn (độ) và độ lệch')}${fN('Start Size', 'node', 'ps.startSize', 'ps.startSizeVar')}${fN('End Size', 'node', 'ps.endSize', 'ps.endSizeVar', 'Kích thước cuối. -1 = giữ nguyên như Start Size')}
      ${fN('Start Spin', 'node', 'ps.startSpin', 'ps.startSpinVar')}${fN('End Spin', 'node', 'ps.endSpin', 'ps.endSpinVar')}${fXY('Source Pos', 'node', 'ps.sourcePos')}${fXY('Pos Var', 'node', 'ps.posVar', 'Vùng sinh hạt (± X, ± Y)')}
      ${fSel('Position Type', 'node', 'ps.positionType', [[0, 'FREE'], [1, 'RELATIVE'], [2, 'GROUPED']], 1)}${fSel('Emitter Mode', 'node', 'ps.emitterMode', [[0, 'GRAVITY'], [1, 'RADIUS']], 1)}
      ${g ? fXY('Gravity', 'node', 'ps.gravity') + fN('Speed', 'node', 'ps.speed', 'ps.speedVar') + fN('Tangential Accel', 'node', 'ps.tangentialAccel', 'ps.tangentialAccelVar') + fN('Radial Accel', 'node', 'ps.radialAccel', 'ps.radialAccelVar') + fSel('Rotation Is Dir', 'node', 'ps.rotationIsDir', [[false, 'false'], [true, 'true']])
        : fN('Start Radius', 'node', 'ps.startRadius', 'ps.startRadiusVar') + fN('End Radius', 'node', 'ps.endRadius', 'ps.endRadiusVar') + fN('Rotate Per S', 'node', 'ps.rotatePerS', 'ps.rotatePerSVar')}
      ${fSel('Src Blend Factor', 'node', 'ps.srcBlend', BL)}${fSel('Dst Blend Factor', 'node', 'ps.dstBlend', BL)}
      ` : mProps(n)}</div>`;
  }
  function renderProps() {
    const pf = cur(), n = selNode(), P = $('#props'); $('#selName').textContent = pf ? (n ? n.name : pf.name) : '';
    if (!pf) { P.innerHTML = '<div class="note" style="padding:10px">Mở một prefab để chỉnh thông số.</div>'; return; }
    let h = '';
    if (pf.kind === 'particle') {
      const an = byId(pf.seqAnim);
      h += `<div class="sec"><b>Kiểu hiệu ứng</b><div class="f"><label>Mode</label>${seg('pf', 'mode', [['burst', 'Bung từ giữa'], ['fall', 'Rơi từ trên']])}</div><div class="f"><label>Phát</label>${seg('pf', 'play', [['once', '1 lần'], ['loop', 'Loop mãi']])}</div></div>
      <div class="sec"><b>Chuỗi hình (gán cho mọi emitter)</b>${slot('seq', an, 'Chưa có chuỗi hình', an ? `${an.frames.length} hình · Animation clip` : 'Kéo Animation clip vào, hoặc bấm nút bên dưới', 'seq')}
        <div class="f" style="margin-top:8px"><label>Import</label><button class="btn w2" data-dir="seq" title="Chọn folder chứa chuỗi PNG — tự tạo Animation clip và gán vào mọi emitter">Import folder chuỗi hình…</button></div>
        ${an ? row('Tốc độ (fps)', num(an.id, 'sample', 'Số hình mỗi giây'), `<small>${an.frames.length} hình</small>`) : ''}</div>`;
      if (n) h += emitterProps(n, !!an);
      else h += nodeSec('pf', 'Node gốc (' + esc(pf.name) + ')') + `<div class="sec"><div class="note" style="margin:0">Chọn 1 emitter ở Node Tree để chỉnh thông số ParticleSystem và ảnh của hạt. Position của node gốc chỉ để sắp xếp khi xem trước; Rotation và Scale được xuất vào prefab.</div></div>`;
    } else if (!n) {
      const pj = pf.proj, ip = byId(pj.impact);
      h += projProps(pj) + `
      <div class="sec"><b>FX bung ra ở điểm cuối</b>${slot('impact', ip, 'Không có FX', ip ? 'Particle prefab · bấm ✕ để gỡ' : 'Kéo 1 Particle prefab từ Assets vào đây', 'impact')}
        <div class="note">FX này là prefab riêng nằm cùng folder, được xuất kèm trong zip.</div></div>` + nodeSec('pf', 'Node gốc (' + esc(pf.name) + ')', false);
    } else if (n.type === 'sprite') {
      const an = byId(n.anim);
      h += `<div class="sec"><b>Head (đầu đạn)</b>${slot('sanim', an || byId(n.image), 'Sprite Frame', an ? `Chuỗi ${an.frames.length} hình · Animation clip` : 'Kéo ảnh hoặc Animation clip vào đây', an ? 'sanim' : '')}
        <div class="f" style="margin-top:8px"><label>Import</label><button class="btn w2" data-dir="sanim" title="Chọn folder chứa chuỗi PNG cho Head">Import folder chuỗi hình…</button></div>
        ${an ? row('Tốc độ (fps)', num(an.id, 'sample'), `<small>${an.frames.length} hình</small>`) : ''}</div>
      ${nodeSec('node', 'Node')}<div class="sec"><b>Blend</b>${fSel('Src Blend Factor', 'node', 'srcBlend', BL)}${fSel('Dst Blend Factor', 'node', 'dstBlend', BL)}</div>`;
    } else h += emitterProps(n, false);
    P.innerHTML = h;
  }
  function chipPath(k, i) { const pj = { preset: k, sx: 8, sy: k === 'arc' ? 6 : 23, ex: 72, ey: k === 'arc' ? 6 : 23, amp: k === 'arc' ? 34 - i * 9 : 24 - i * 6, rand: 0, seed: i }, v = M.sim.variant(pj, i); v.ex = v.ey = 0; if (i === 1) v.s = -v.s; let d = ''; for (let j = 0; j <= 40; j++) { const p = M.sim.pathPoint(pj, v, j / 40); d += (j ? 'L' : 'M') + p.x.toFixed(1) + ' ' + (46 - p.y).toFixed(1); } return d; }
  function syncInputs() { const sn = selNode(); if (sn && sn.ps) $$('#props [data-m]').forEach(i => { if (i !== document.activeElement) { const v = MF[i.dataset.m].g(sn.ps); if (String(i.value) !== String(v)) i.value = v; } });
    $$('#props [data-k]').forEach(i => { if (i === document.activeElement || i.dataset.col !== undefined) return; const t = target(i.dataset.o); if (t) { const v = gp(t, i.dataset.k); if (v !== undefined && String(i.value) !== String(v)) i.value = v; } }); }
  const P = $('#props');
  P.addEventListener('input', e => {
    const i = e.target, sn = selNode();
    if (i.dataset.m && sn) { const v = parseFloat(i.value); if (isNaN(v)) return; MF[i.dataset.m].s(sn.ps, v); syncInputs(); return dirty(); }
    if (i.dataset.ms && sn) { MS[i.dataset.ms].s(sn.ps, i.value); return dirty(); }
    if (!i.dataset.k) return; const t = target(i.dataset.o); if (!t) return;
    if (i.dataset.col !== undefined) { const c = gp(t, i.dataset.k), v = parseInt(i.value.slice(1), 16); c.r = v >> 16; c.g = v >> 8 & 255; c.b = v & 255; }
    else if (i.tagName === 'SELECT') { let v = i.value; if (i.dataset.n !== undefined) v = +v; else if (v === 'true' || v === 'false') v = v === 'true'; sp(t, i.dataset.k, v); if (/emitterMode$/.test(i.dataset.k)) renderProps(); }
    else { const v = parseFloat(i.value); if (isNaN(v)) return; sp(t, i.dataset.k, i.dataset.k === 'variants' ? Math.max(1, Math.min(12, Math.round(v))) : i.dataset.k === 'sample' ? Math.max(1, v) : v); }
    dirty();
  });
  P.addEventListener('click', async e => {
    const pf = cur(), n = selNode(); let b;
    if ((b = e.target.closest('[data-ptab]'))) { S.ptab = b.dataset.ptab; save(); return renderProps(); }
    if ((b = e.target.closest('[data-draw]'))) { drawMode = !drawMode; renderProps(); return renderRef(); }
    if ((b = e.target.closest('[data-clear]'))) { e.stopPropagation(); const k = b.dataset.clear; if (k === 'seq') pf.seqAnim = null; if (k === 'sanim') n.anim = null; if (k === 'impact') pf.proj.impact = null; dirty(); return renderProps(); }
    if ((b = e.target.closest('[data-seg]'))) { const [o, k, v] = b.dataset.seg.split('|'); sp(target(o), k, v === 'true' ? true : v === 'false' ? false : v); if (k === 'mode') applyMode(pf); if (k === 'play') applyPlay(pf); RT.delete(pf.id); dirty(); return renderProps(); }
    if ((b = e.target.closest('[data-preset]'))) { pf.proj.preset = b.dataset.preset; dirty(); renderProps(); RT.delete(pf.id); return; }
    if ((b = e.target.closest('[data-dir]'))) { const fs = (await pickFiles($('#fileDir'))).filter(isImg); if (!fs.length) return toast('Folder không có ảnh PNG/JPG nào'); const nm = (fs[0].webkitRelativePath || '').split('/')[0]; return slotFiles(b.dataset.dir, fs, nm); }
    if ((b = e.target.closest('[data-pick]'))) { const k = b.dataset.pick; if (k === 'impact' || k === 'seq') return; const fs = await pickFiles($('#fileImg')); if (fs.length) slotFiles(k, fs); }
  });

  // giữ chuột + kéo ngang trên ô số để tăng giảm nhanh (Shift = chậm, bấm thường = gõ số)
  const INTK = /totalParticles$|variants$|\.a$|^(sx|sy|ex|ey)$/;
  let scrub = null;
  document.addEventListener('pointerdown', e => {
    const i = e.target; if (e.button !== 0 || !i.matches || !i.matches('input.num[type=number]') || i === document.activeElement) return;
    const v = parseFloat(i.value) || 0, a = Math.abs(v), int = INTK.test(i.dataset.k || '') || i.dataset.m === 'total' || i.id === 'cw' || i.id === 'ch';
    scrub = { i, x: e.clientX, v, on: false, int, step: int ? Math.max(.25, a / 200) : a >= 100 ? 1 : a >= 10 ? .25 : a >= 1 ? .02 : .01 };
    e.preventDefault(); i.setPointerCapture(e.pointerId);
  }, true);
  document.addEventListener('pointermove', e => {
    if (!scrub) return; const d = e.clientX - scrub.x; if (!scrub.on) { if (Math.abs(d) < 4) return; scrub.on = true; document.body.classList.add('scrubbing'); }
    let v = scrub.v + d * scrub.step * (e.shiftKey ? .1 : 1); v = scrub.int ? Math.round(v) : Math.round(v * 100) / 100;
    if (scrub.i.min !== '' && v < +scrub.i.min) v = +scrub.i.min; if (scrub.i.max !== '' && v > +scrub.i.max) v = +scrub.i.max;
    if (String(v) !== scrub.i.value) { scrub.i.value = v; scrub.i.dispatchEvent(new Event('input', { bubbles: true })); }
  }, true);
  const endScrub = () => { if (!scrub) return; const s = scrub; scrub = null; document.body.classList.remove('scrubbing'); if (!s.on) { s.i.focus(); s.i.select(); } };
  document.addEventListener('pointerup', endScrub, true); document.addEventListener('pointercancel', endScrub, true);

  // ================= kéo đổi kích thước các bảng =================
  const bodyEl = $('.body'), LIM = { lw: [150, 520], rw: [240, 640], bh: [90, 600] };
  function applyLayout() { const L = S.layout || (S.layout = { lw: 230, rw: 340, bh: 210 }); for (const k in LIM) bodyEl.style.setProperty('--' + k, L[k] + 'px'); }
  let rs = null;
  bodyEl.addEventListener('pointerdown', e => { const sp = e.target.closest('.split'); if (!sp) return; rs = { k: sp.dataset.k, x: e.clientX, y: e.clientY, v: S.layout[sp.dataset.k], sp }; sp.classList.add('on'); sp.setPointerCapture(e.pointerId); e.preventDefault(); });
  bodyEl.addEventListener('pointermove', e => { if (!rs) return; const r = bodyEl.getBoundingClientRect(), L = S.layout;
    let v = rs.k === 'lw' ? rs.v + e.clientX - rs.x : rs.k === 'rw' ? rs.v - (e.clientX - rs.x) : rs.v - (e.clientY - rs.y);
    const max = rs.k === 'bh' ? r.height - 140 : r.width - (rs.k === 'lw' ? L.rw : L.lw) - 260;
    L[rs.k] = Math.round(Math.max(LIM[rs.k][0], Math.min(LIM[rs.k][1], max, v))); applyLayout(); });
  const endRs = () => { if (!rs) return; rs.sp.classList.remove('on'); rs = null; dirty(); renderTabs(); };
  bodyEl.addEventListener('pointerup', endRs); bodyEl.addEventListener('pointercancel', endRs);
  bodyEl.addEventListener('dblclick', e => { const sp = e.target.closest('.split'); if (!sp) return; S.layout[sp.dataset.k] = { lw: 230, rw: 340, bh: 210 }[sp.dataset.k]; applyLayout(); dirty(); });

  // ================= header =================
  function renderTabs() { $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === S.tab)); const b = $('.tab.on'), bar = $('#tabbar'); bar.style.left = b.offsetLeft + 'px'; bar.style.width = b.offsetWidth + 'px'; }
  $('#tabs').addEventListener('click', e => { const t = e.target.dataset.t; if (!t || t === S.tab) return; S.tab = t; select(scenePfs()[0] || null); restart(); renderAll(); dirty(); });
  $('#btnUndo').onclick = undo; $('#btnRedo').onclick = redo;
  $('#tools').addEventListener('click', e => { const t = e.target.dataset.tool; if (t) setTool(t); });
  ['cw', 'ch'].forEach((id, i) => $('#' + id).addEventListener('input', e => { const v = parseInt(e.target.value); if (v > 0) { S.canvas[i ? 'h' : 'w'] = v; dirty(); } }));
  $('#btnPlay').onclick = () => { playing = !playing; $('#btnPlay').textContent = playing ? 'Dừng' : 'Phát'; };
  $('#btnRestart').onclick = () => { restart(); if (!playing) $('#btnPlay').click(); };
  $('#btnFit').onclick = fit;
  $('#btnRef').onclick = refMenu; $('#btnScene').onclick = sceneMenu;
  $('#refApply').onclick = () => { S.ref.locked = true; dirty(); renderRef(); toast('Đã khoá ảnh nền. Bấm "Ảnh nền" để chỉnh lại hoặc gỡ.'); };
  $('#refDel').onclick = () => { S.ref = null; dirty(); renderRef(); };
  $('#refScale').addEventListener('input', e => { const v = parseFloat(e.target.value); if (v > 0) { S.ref.scale = v; dirty(); } });
  $('#refOp').addEventListener('input', e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { S.ref.opacity = Math.max(0, Math.min(100, v)); dirty(); } });
  $('#btnPath').onclick = () => { S.hidePath = !S.hidePath; dirty(); renderPathBtn(); };
  $('#btnBg').onclick = () => { S.bg = ((S.bg || 0) + 1) % BGS.length; dirty(); };
  const typing = e => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !typing(e)) { space = true; e.preventDefault(); if (!e.repeat) spaceT = performance.now(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'e') { e.preventDefault(); return exportDlg(); }
    if (e.ctrlKey && !$('.modal')) { const k = e.key.toLowerCase();
      if (k === 'z') { e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return e.shiftKey ? redo() : undo(); }
      if (k === 'y') { e.preventDefault(); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return redo(); }
      if (k === 'd' && !typing(e)) { e.preventDefault(); return area === 'assets' ? dupAsset(byId(S.selAsset)) : dupSelected(); } }
    if (typing(e) || $('.modal') || e.ctrlKey || e.altKey) return;
    if (e.key.toLowerCase() === 'r') $('#btnRestart').click(); if (e.key.toLowerCase() === 'f') fit();
    const tk = { w: 'move', e: 'rotate', t: 'scale' }[e.key.toLowerCase()]; if (tk) setTool(tk);
    if (e.key === 'Delete') {
      const a = area === 'assets' ? byId(S.selAsset) : area === 'ftree' ? byId(S.folder) : null;
      const dn = area === 'tree' ? selNode() : null;
      if (dn && dn.type === 'emitter') return delNode(cur(), dn.id);
      if (a && a !== S.root) confirmDlg('Xoá', `Xoá "${esc(a.name)}"${a.type === 'folder' ? ' và mọi thứ bên trong' : ''}?`).then(ok => { if (ok) { S.selAsset = null; removeAsset(a); } });
    }
  });
  let spaceT = 0;
  document.addEventListener('keyup', e => { if (e.code === 'Space') { space = false; if (!typing(e) && !$('.modal') && performance.now() - spaceT < 250 && !drag) $('#btnPlay').click(); } });

  // ================= xuất =================
  async function exportDlg() {
    if ($('.modal')) return; const tops = S.root.children.filter(c => c.type === 'folder' && !c.sys); if (!tops.length) return toast('Chưa có folder nào để xuất');
    const pf = cur(), def = (pf && projectOf(pf)) || tops[0];
    const r = await modal(`${dlgHead('Xuất zip cho Cocos')}<div class="bd"><p>Phiên bản Cocos Creator</p><div class="seg" id="exVer"><button data-v="213" class="${S.ver === '213' ? 'on' : ''}">Cocos 2.1.3</button><button data-v="363" class="${S.ver === '363' ? 'on' : ''}">Cocos 3.6.3</button></div>
      <p>Folder cần xuất</p><select class="num" id="exF">${tops.map(t => `<option value="${t.id}" ${t === def ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
      <p>File tạo ra: <b id="exName" style="color:var(--text)"></b></p><p>Giải nén rồi kéo folder vào mục assets của project Cocos.</p></div><div class="ft"><button class="btn" data-close>Huỷ</button><button class="btn primary" id="exGo">Xuất zip</button></div>`,
      (m, close) => { const upd = () => m.querySelector('#exName').textContent = `${byId(m.querySelector('#exF').value).name}_${S.ver}.zip`; upd();
        m.querySelector('#exVer').onclick = e => { const v = e.target.dataset.v; if (!v) return; S.ver = v; m.querySelectorAll('#exVer button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); upd(); };
        m.querySelector('#exF').onchange = upd; m.querySelector('#exGo').onclick = () => close(m.querySelector('#exF').value); m.querySelector('#exGo').focus(); });
    if (!r) return; dirty();
    try { const out = await M.exporter.build(byId(r), S.ver, all()); M.lastExport = out;
      const a = document.createElement('a'); a.href = URL.createObjectURL(out.blob); a.download = out.name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast(`Đã xuất <b>${esc(out.name)}</b>` + (out.warn.length ? `<br><span style="color:var(--warn)">Lưu ý: ${out.warn.slice(0, 3).map(esc).join('; ')}</span>` : ''), out.warn.length ? 7000 : 3000);
    } catch (err) { console.error(err); toast('Xuất thất bại: ' + esc(err.message), 6000); }
  }
  $('#btnExport').onclick = exportDlg;

  // ================= cập nhật / cài đặt =================
  const api = window.mapi || null, WN = (api && api.whatsnew) || window.WHATSNEW || { version: '', date: '', new: [], improved: [], fixed: [] };
  let newVer = null;
  function setUpd(state, text) { const b = $('#btnUpd'); b.classList.remove('ok', 'busy', 'has'); if (state) b.classList.add(state); b.title = 'Kiểm tra cập nhật' + (text ? ' · ' + text : ''); $('#latest').classList.toggle('hide', state !== 'ok'); }
  async function checkUpdate(manual) {
    if (newVer && manual) return offerUpdate();
    setUpd('busy', 'Đang kiểm tra…');
    let r; try { r = api ? await api.check() : { status: 'latest' }; } catch (e) { r = { status: 'error' }; }
    if (!r || !r.status) r = { status: 'error' };
    if (r.status === 'available') { newVer = r.version; setUpd('has', 'Có bản mới v' + r.version); offerUpdate(); }
    else if (r.status === 'latest') { setUpd('ok', 'Đã là bản mới nhất'); if (manual) toast('Bạn đang dùng bản mới nhất'); }
    else { setUpd('', 'Không kiểm tra được'); if (manual) toast('Không kiểm tra được bản cập nhật. Kiểm tra lại kết nối mạng.'); }
  }
  function offerUpdate() { const t = toast(`Có bản mới <b>v${esc(newVer)}</b> <button class="btn primary" id="doUpd">Cập nhật</button>`, 0); t.querySelector('#doUpd').onclick = () => { t.innerHTML = 'Đang tải bản mới… <b id="updPct">0%</b>'; api.download(); }; }
  if (api && api.onProgress) api.onProgress(p => { const e = $('#updPct'); if (e) e.textContent = Math.round(p) + '%'; });
  $('#btnUpd').onclick = () => checkUpdate(true);
  const fmtDate = d => d ? d.split('-').reverse().join('/') : '';
  function whatsNew() {
    const grp = (t, a) => a && a.length ? `<h5>${t}</h5><ul>${a.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '';
    modal(`${dlgHead("What's new")}<div class="bd"><p>v${esc(WN.version)} · ${fmtDate(WN.date)}</p>${grp('Mới', WN.new)}${grp('Cải thiện', WN.improved)}${grp('Sửa lỗi', WN.fixed)}${newVer ? `<p>Có bản mới v${esc(newVer)}</p>` : ''}</div><div class="ft"><button class="btn primary" data-close>Đóng</button></div>`);
  }
  $('#btnSet').onclick = () => modal(`${dlgHead('Cài đặt')}<div class="bd"><p>Phiên bản</p><div class="verrow"><b>v${esc((api && api.version) || WN.version)}</b><button class="btn" id="sWN">${IC.spark} What's new</button><button class="btn" id="sUp">Kiểm tra cập nhật</button></div>
    <p>Project</p><div class="verrow"><button class="btn" id="sReset">Tạo lại project mẫu</button></div><p>Mọi thay đổi được lưu tự động trên máy này.</p></div><div class="ft"><button class="btn primary" data-close>Đóng</button></div>`,
    (m, close) => { m.querySelector('#sWN').onclick = () => { close(); whatsNew(); }; m.querySelector('#sUp').onclick = () => { close(); checkUpdate(true); };
      m.querySelector('#sReset').onclick = async () => { close(); if (await confirmDlg('Tạo lại project mẫu', 'Xoá toàn bộ assets hiện tại và tạo lại project mẫu ban đầu?', 'Tạo lại')) { await bootstrap(); restart(); fitAll(); renderAll(); dirty(); } }; });

  // ================= khởi động =================
  function renderPathBtn() { const b = $('#btnPath'); b.classList.toggle('hide', !scenePfs().some(p => p.kind === 'projectile')); b.classList.toggle('on', !S.hidePath); b.textContent = S.hidePath ? 'Hiện đường bay' : 'Ẩn đường bay'; }
  function renderAll() { undoBtns(); applyLayout(); renderPathBtn(); renderRef(); renderTabs(); renderTree(); renderAssets(); renderProps(); $('#cw').value = S.canvas.w; $('#ch').value = S.canvas.h; status(); }
  function fitAll() { const t = S.tab; for (const k of ['particle', 'projectile']) { S.tab = k; fit(); } S.tab = t; }
  async function init() {
    if (api) document.documentElement.classList.add('electron');
    const saved = await load();
    if (saved) { try { S = JSON.parse(saved); if (!S.root || !S.canvas) throw 0; } catch (e) { S = null; } }
    if (!S) await bootstrap();
    idx = null;
    if (S.ref && S.ref.data) { const d = S.ref.data, a = await mkImage(sysFolder('Backgrounds'), 'Background', d, /^data:image\/jpe?g/.test(d) ? 'jpg' : 'png'); S.ref.img = a.id; delete S.ref.data; delete S.ref.w; delete S.ref.h; }
    normAll(); for (const k of ['particle', 'projectile']) S.scene[k] = S.scene[k].slice(0, 1); if (!S.sel) select(scenePfs()[0] || null);
    R = new M.Renderer($('#gl'));
    await Promise.all(all().filter(a => a.type === 'image').map(a => { const i = M.imgOf(a); return i.complete ? 0 : new Promise(ok => { i.onload = i.onerror = ok; }); }));
    fitAll(); restart(); setTool('move'); base = snap(); renderAll();
    window.addEventListener('resize', renderTabs);
    requestAnimationFrame(t => { last = t; tick(t); });
    setTimeout(() => checkUpdate(false), 1200);
    M.debug = { S: () => S, all, byId, exportBuild: (id, v) => M.exporter.build(byId(id), v, all()), makeSequence, cur, projectOf, importZip, saveScene, loadScene, scenes, renderAll, dirty, selNode, scene: scenePfs, hist: () => [hist.length, redoS.length] };
  }
  init();
})(window.M = window.M || {});
