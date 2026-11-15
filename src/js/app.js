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
  async function newProjectile(project, name) {
    const glow = await builtinImg(project, 'Glow');
    const impact = await newParticle(project, name + '_Impact', { img: 'Spark', play: 'once', ps: { totalParticles: 24, life: .45, lifeVar: .15, speed: 420, speedVar: 160, startSize: 34, startSizeVar: 12, endSize: 0, endSizeVar: 0, gravity: { x: 0, y: -300 }, startColor: C(255, 240, 150, 255), endColor: C(255, 110, 20, 0), dstBlend: 'ONE' } });
    const pf = add(subFolder(project, 'Prefabs'), { type: 'prefab', kind: 'projectile', name, nodes: [],
      proj: { preset: 'arc', sx: -300, sy: -200, ex: 300, ey: 120, dur: .8, amp: 220, rand: 60, variants: 3, ease: 'linear', rotateDir: true, rotOffset: 0, impact: impact.id, seed: 0 } });
    pf.nodes.push({ id: uid(), type: 'emitter', name: 'Trail', x: 0, y: 0, image: glow.id, ps: defPS({ totalParticles: 90, emissionRate: 160, life: .4, lifeVar: .15, angle: 0, angleVar: 180, speed: 0, speedVar: 25, gravity: { x: 0, y: 0 },
      startSize: 46, startSizeVar: 10, endSize: 0, endSizeVar: 0, startSpin: 0, startSpinVar: 0, endSpin: 0, endSpinVar: 0, startColor: C(255, 225, 90, 255), endColor: C(255, 90, 0, 0), dstBlend: 'ONE' }) });
    pf.nodes.push({ id: uid(), type: 'sprite', name: 'Head', x: 0, y: 0, scale: 1, image: glow.id, anim: null, srcBlend: 'SRC_ALPHA', dstBlend: 'ONE' });
    return pf;
  }
  async function makeSequence(files, name, project) {
    const imgs = await importFiles(files, mkFolder(subFolder(project, 'Images'), name));
    if (!imgs.length) return null;
    return add(subFolder(project, 'Animations'), { type: 'anim', name: name + '_Loop', sample: 30, frames: imgs.map(i => i.id) });
  }
  async function bootstrap() {
    S = { root: { id: 'root', type: 'folder', name: 'assets', children: [] }, canvas: { w: 960, h: 640 }, tab: 'particle', open: {}, sel: null, folder: null, ver: '213', bg: 0 };
    idx = null;
    const p1 = mkFolder(S.root, 'Coin_FX'); ['Animations', 'Images', 'Prefabs'].forEach(k => subFolder(p1, k));
    const a = await newParticle(p1, 'Particle_Burst', { ps: { startColor: C(255, 205, 60, 255), endColor: C(255, 170, 30, 255) } });
    const p2 = mkFolder(S.root, 'Projectile_FX'); ['Animations', 'Images', 'Prefabs'].forEach(k => subFolder(p2, k));
    const b = await newProjectile(p2, 'Projectile');
    S.open = { particle: a.id, projectile: b.id }; S.folder = subFolder(p1, 'Prefabs').id; S.sel = a.nodes[0].id;
  }

  // ================= lưu tự động =================
  const DB = () => new Promise((ok, no) => { const r = indexedDB.open('m-cocos-particle', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  async function load() { try { const db = await DB(); return await new Promise(ok => { const r = db.transaction('kv').objectStore('kv').get('state'); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); }); } catch (e) { return null; } }
  let saveT;
  function dirty() { idx = null; clearTimeout(saveT); saveT = setTimeout(async () => { try { const db = await DB(); db.transaction('kv', 'readwrite').objectStore('kv').put(JSON.stringify(S), 'state'); } catch (e) { } }, 600); }

  // ================= runtime / viewport =================
  const cur = () => { const a = byId(S.open[S.tab]); return a && a.type === 'prefab' ? a : null; };
  const selNode = () => { const pf = cur(); return pf ? pf.nodes.find(n => n.id === S.sel) || null : null; };
  const views = { particle: { x: 0, y: 0, z: 1 }, projectile: { x: 0, y: 0, z: 1 } };
  const view = () => views[S.tab];
  const BGS = [[.169, .176, .192], [0, 0, 0], [.45, .45, .47], [.09, .22, .16]];
  let R, inst = null, impact = null, playing = true, doneT = 0, fly = null, last = performance.now();
  const viewEl = $('#view'), ov = $('#ov');
  function restart() {
    const pf = cur(); inst = pf ? new M.sim.Instance(pf) : null; impact = null; doneT = 0; fly = null;
    if (pf && pf.kind === 'projectile') startFly();
  }
  function startFly() {
    const pf = cur(), pj = pf.proj; inst.reset(); impact = null;
    const v = M.sim.variant(pj, Math.floor(Math.random() * Math.max(1, pj.variants)));
    fly = { t: 0, v, phase: 'fly', it: 0 }; inst.x = pj.sx; inst.y = pj.sy; inst.headVisible = true; inst.headRot = 0;
  }
  function advance(dt) {
    const pf = cur(); if (!pf) return; if (!inst || inst.prefab !== pf) restart();
    if (pf.kind === 'particle') {
      inst.step(dt, 0, 0);
      if (emitters(pf).length && inst.done()) { doneT += dt; if (doneT > .7) { inst.reset(); doneT = 0; } }
      return;
    }
    const pj = pf.proj;
    if (fly.phase === 'fly') {
      fly.t += dt; const u = Math.min(1, fly.t / Math.max(.05, pj.dur)), p = M.sim.pathPoint(pj, fly.v, M.sim.EASE[pj.ease](u));
      const dx = p.x - inst.x, dy = p.y - inst.y;
      if (pj.rotateDir && (dx || dy)) inst.headRot = -Math.atan2(dy, dx) * 180 / Math.PI + pj.rotOffset; else if (!pj.rotateDir) inst.headRot = pj.rotOffset;
      inst.step(dt, p.x, p.y);
      if (u >= 1) { fly.phase = 'impact'; inst.stopAll(); inst.headVisible = false; const ip = byId(pj.impact); if (ip) { impact = new M.sim.Instance(ip); impact.x = p.x; impact.y = p.y; } }
    } else {
      fly.it += dt; inst.step(dt, inst.x, inst.y);
      if (impact) { impact.step(dt, impact.x, impact.y); if (fly.it > .3) impact.stopAll(); }
      if (fly.it > .5 && !inst.count() && (!impact || !impact.count())) startFly();
    }
  }
  const getA = id => byId(id);
  function frameOf(anim, i, n, time) { const fr = M.seqFrames(anim, i, n, getA); return fr.length ? fr[Math.floor(time * anim.sample) % fr.length] : null; }
  function drawInst(I) {
    const pf = I.prefab, ems = emitters(pf), seq = pf.kind === 'particle' && byId(pf.seqAnim);
    for (const n of pf.nodes) {
      if (n.hidden) continue;
      let a = byId(n.image);
      if (n.type === 'emitter') {
        if (seq) a = frameOf(seq, ems.indexOf(n), ems.length, I.time) || a;
        const e = I.emitters.get(n.id); if (!e || !a) continue;
        R.batch(a, n.ps.srcBlend, n.ps.dstBlend); const ar = a.w / a.h, kw = ar > 1 ? 1 : ar, kh = ar > 1 ? 1 / ar : 1, free = n.ps.positionType === 0, bx = I.x + n.x, by = I.y + n.y;
        for (const p of e.parts) R.quad((free ? p.sx : bx) + p.x, (free ? p.sy : by) + p.y, p.size * kw, p.size * kh, p.rot, p.c);
      } else if (I.headVisible) {
        const an = byId(n.anim); if (an) a = frameOf(an, 0, 1, I.time) || a; if (!a) continue;
        R.batch(a, n.srcBlend, n.dstBlend); R.quad(I.x + n.x, I.y + n.y, a.w * n.scale, a.h * n.scale, I.headRot, [255, 255, 255, 255]);
      }
    }
  }
  const w2s = (x, y) => { const v = view(); return [viewEl.clientWidth / 2 + v.x + x * v.z, viewEl.clientHeight / 2 + v.y - y * v.z]; };
  const s2w = (sx, sy) => { const v = view(); return [(sx - viewEl.clientWidth / 2 - v.x) / v.z, -(sy - viewEl.clientHeight / 2 - v.y) / v.z]; };
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
    if (pf.kind === 'projectile') {
      const pj = pf.proj, col = M.sim.PRESETS[pj.preset].color; g.setLineDash([5, 5]); g.lineWidth = 1.5; g.strokeStyle = col; g.globalAlpha = .7;
      for (let i = 0; i < Math.max(1, pj.variants); i++) { const vr = M.sim.variant(pj, i); g.beginPath(); for (let k = 0; k <= 60; k++) { const p = M.sim.pathPoint(pj, vr, k / 60), s = w2s(p.x, p.y); k ? g.lineTo(s[0], s[1]) : g.moveTo(s[0], s[1]); } g.stroke(); }
      g.setLineDash([]); g.globalAlpha = 1;
      [['A', pj.sx, pj.sy], ['B', pj.ex, pj.ey]].forEach(([t, x, y]) => { const s = w2s(x, y); g.fillStyle = '#1F2126'; g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(s[0], s[1], 9, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 10px "Segoe UI",sans-serif'; g.fillText(t, s[0] - 3.5, s[1] + 3.5); });
    }
    const n = selNode();
    if (n && inst) {
      const s = w2s(inst.x + n.x, inst.y + n.y); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(s[0], s[1], 7, 0, 7); g.moveTo(s[0] - 12, s[1]); g.lineTo(s[0] + 12, s[1]); g.moveTo(s[0], s[1] - 12); g.lineTo(s[0], s[1] + 12); g.stroke();
      if (n.type === 'emitter' && (n.ps.posVar.x || n.ps.posVar.y)) { g.setLineDash([4, 4]); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.strokeRect(s[0] - n.ps.posVar.x * v.z, s[1] - n.ps.posVar.y * v.z, n.ps.posVar.x * 2 * v.z, n.ps.posVar.y * 2 * v.z); g.setLineDash([]); }
    }
  }
  let stT = 0;
  function tick(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    if (playing) advance(dt);
    R.begin(view(), BGS[S.bg || 0]);
    if (S.ref) { const b = S.ref; R.batch(refAsset(), 'SRC_ALPHA', 'ONE_MINUS_SRC_ALPHA'); const o = b.opacity * 2.55; R.quad(b.x, b.y, b.w * b.scale, b.h * b.scale, 0, [255, 255, 255, o]); R.flush(); }
    if (cur() && inst && inst.prefab === cur()) { drawInst(inst); if (impact) drawInst(impact); } R.end();
    drawOverlay();
    if (now - stT > 250) { stT = now; status(); }
    requestAnimationFrame(tick);
  }
  function status() {
    const pf = cur(); $('#empty').classList.toggle('hide', !!pf);
    $('#st').textContent = !pf ? 'Chưa mở prefab' : `${pf.kind === 'particle' ? 'Particle System' : 'Projectile'} · ${pf.name} · ${emitters(pf).length} emitter · ${inst ? inst.count() + (impact ? impact.count() : 0) : 0} hạt`;
    $('#st2').textContent = pf && pf.kind === 'projectile' ? 'Đường bay chỉ để xem trước — khi xuất, prefab nằm tại (0,0)' : '';
    $('#zoom').textContent = Math.round(view().z * 100) + '%';
  }
  // ---- ảnh nền để ướm thử ----
  const refAsset = () => ({ id: '__ref', data: S.ref.data, w: S.ref.w, h: S.ref.h, trim: { x: 0, y: 0, w: S.ref.w, h: S.ref.h } });
  function renderRef() {
    const bar = $('#refBar'), b = S.ref; bar.classList.toggle('hide', !b || b.locked); $('#btnRef').classList.toggle('on', !!b);
    if (b && !b.locked) { $('#refScale').value = b.scale; $('#refOp').value = b.opacity; }
    $('#hint').textContent = b && !b.locked ? 'Đang chỉnh ảnh nền: kéo chuột trái để di chuyển ảnh · bấm Apply để khoá' : 'Lăn chuột: zoom · Giữ chuột phải hoặc phím cách + kéo: pan · Kéo chuột trái: di chuyển node đang chọn';
  }
  async function pickRef() { const fs = await pickFiles($('#fileImg')); if (!fs.length) return; const data = await readFile(fs[0]), img = await loadImg(data);
    S.ref = { data, w: img.naturalWidth, h: img.naturalHeight, x: 0, y: 0, scale: 1, opacity: 100, locked: false }; dirty(); renderRef(); }
  function refMenu(e) {
    if (!S.ref) return pickRef(); const r = e.currentTarget.getBoundingClientRect();
    ctxMenu(r.left, r.bottom + 4, [[S.ref.locked ? 'Chỉnh lại vị trí ảnh nền' : 'Khoá ảnh nền (Apply)', () => { S.ref.locked = !S.ref.locked; dirty(); renderRef(); }], ['Đổi ảnh khác…', pickRef], ['Gỡ ảnh nền', () => { S.ref = null; dirty(); renderRef(); }]]);
  }
  function fit() { const v = view(); v.z = Math.max(.05, Math.min((viewEl.clientWidth - 80) / S.canvas.w, (viewEl.clientHeight - 110) / S.canvas.h)); v.x = 0; v.y = 12; }

  // chuột trong viewport
  let space = false, drag = null;
  viewEl.addEventListener('contextmenu', e => e.preventDefault());
  viewEl.addEventListener('wheel', e => { e.preventDefault(); const r = viewEl.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, v = view(), [wx, wy] = s2w(mx, my);
    v.z = Math.max(.05, Math.min(16, v.z * Math.exp(-e.deltaY * .0015))); v.x = mx - viewEl.clientWidth / 2 - wx * v.z; v.y = my - viewEl.clientHeight / 2 + wy * v.z; }, { passive: false });
  viewEl.addEventListener('pointerdown', e => {
    if (e.target.closest('.vbar,.refbar')) return;
    const r = viewEl.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top, pf = cur();
    if (e.button === 1 || e.button === 2 || space) drag = { k: 'pan' };
    else if (e.button === 0 && S.ref && !S.ref.locked) drag = { k: 'ref' };
    else if (e.button === 0 && pf) {
      if (pf.kind === 'projectile') for (const [k, x, y] of [['s', pf.proj.sx, pf.proj.sy], ['e', pf.proj.ex, pf.proj.ey]]) { const s = w2s(x, y); if (Math.hypot(s[0] - mx, s[1] - my) < 13) drag = { k: 'pt', p: k }; }
      if (!drag && selNode()) drag = { k: 'node' };
    }
    if (drag) { drag.x = e.clientX; drag.y = e.clientY; viewEl.setPointerCapture(e.pointerId); viewEl.style.cursor = drag.k === 'pan' ? 'grabbing' : 'move'; e.preventDefault(); }
  });
  viewEl.addEventListener('pointermove', e => {
    if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y, v = view(); drag.x = e.clientX; drag.y = e.clientY;
    if (drag.k === 'pan') { v.x += dx; v.y += dy; return; }
    if (drag.k === 'ref') { S.ref.x = Math.round(S.ref.x + dx / v.z); S.ref.y = Math.round(S.ref.y - dy / v.z); drag.moved = true; return; }
    const pf = cur(), wx = dx / v.z, wy = -dy / v.z;
    if (drag.k === 'node') { const n = selNode(); n.x = r1(n.x + wx); n.y = r1(n.y + wy); }
    else { const pj = pf.proj, k = drag.p; pj[k + 'x'] = Math.round(pj[k + 'x'] + wx); pj[k + 'y'] = Math.round(pj[k + 'y'] + wy); }
    drag.moved = true; syncInputs();
  });
  const endDrag = () => { if (drag && drag.moved) dirty(); drag = null; viewEl.style.cursor = ''; };
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
  function openPrefab(pf) { S.tab = pf.kind; S.open[pf.kind] = pf.id; S.sel = pf.nodes[0] && pf.kind === 'particle' ? pf.nodes[0].id : null; restart(); renderAll(); dirty(); }
  function removeAsset(a) {
    const ids = new Set(); walk(x => ids.add(x.id), a);
    const p = parentOf(a.id); p.children.splice(p.children.indexOf(a), 1); idx = null;
    walk(x => { if (x.type === 'prefab') { if (ids.has(x.seqAnim)) x.seqAnim = null; if (x.proj && ids.has(x.proj.impact)) x.proj.impact = null; x.nodes.forEach(n => { if (ids.has(n.image)) n.image = null; if (ids.has(n.anim)) n.anim = null; }); } if (x.type === 'anim') x.frames = x.frames.filter(f => !ids.has(f)); });
    for (const k in S.open) if (ids.has(S.open[k])) S.open[k] = null;
    if (ids.has(S.folder)) S.folder = p.id;
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
  function folderMenu(f, x, y) {
    const items = [['Particle prefab mới', () => createPrefab('particle', f)], ['Projectile prefab mới', () => createPrefab('projectile', f)], '-',
      ['Tạo folder con', async () => { const n = await ask('Folder mới', 'Tên folder', 'Folder', 'Tạo'); if (n) { mkFolder(f, clean(n)); dirty(); renderAssets(); } }],
      ['Import ảnh…', async () => { const fs = await pickFiles($('#fileImg')); if (fs.length) { await importFiles(fs, f); S.folder = f.id; dirty(); renderAssets(); } }],
      ['Nhập tên tiền tố…', async () => { const n = await ask('Nhập tên tiền tố', `Thêm tiền tố vào tên của mọi file, folder con và node nằm trong "${esc(f.name)}" (vd: 9683_)`, '', 'Thêm tiền tố'); if (n) applyPrefix(f, clean(n)); }]];
    if (f !== S.root) items.push('-', ['Đổi tên', () => renameAsset(f)], ['Xoá', async () => { if (await confirmDlg('Xoá folder', `Xoá "${esc(f.name)}" và mọi thứ bên trong?`)) removeAsset(f); }]);
    ctxMenu(x, y, items);
  }
  function fileMenu(a, x, y) {
    const items = [];
    if (a.type === 'prefab') items.push(['Mở', () => openPrefab(a)], ['Nhân bản', () => { const c = clone(a); delete c.id; c.nodes.forEach(n => n.id = uid()); const f = parentOf(a.id); c.name = a.name + '_copy'; add(f, c); dirty(); renderAssets(); }]);
    items.push(['Đổi tên', () => renameAsset(a)], ['Xoá', async () => { if (await confirmDlg('Xoá', `Xoá "${esc(a.name)}"?`)) removeAsset(a); }]);
    ctxMenu(x, y, items);
  }

  // ================= render: assets =================
  function renderAssets() {
    idx = null; let f = byId(S.folder); if (!f || f.type !== 'folder') { f = S.root; S.folder = 'root'; }
    const rows = []; (function rec(x, d) { rows.push(`<div class="row-item ${x.id === S.folder ? 'sel' : ''}" style="padding-left:${10 + d * 16}px" data-fid="${x.id}" data-drop="folder:${x.id}">${IC.folder}<span>${esc(x.name)}</span></div>`); x.children.filter(c => c.type === 'folder').forEach(c => rec(c, d + 1)); })(S.root, 0);
    $('#ftree').innerHTML = rows.join('');
    $('#curFolder').textContent = f === S.root ? '' : '/ ' + f.name;
    const order = { folder: 0, prefab: 1, anim: 2, image: 3 };
    $('#grid').innerHTML = [...f.children].sort((a, b) => order[a.type] - order[b.type] || natural(a, b)).map(a => {
      let ic = '', st = '';
      if (a.type === 'folder') ic = `<i class="fd">${IC.folder}</i>`;
      else if (a.type === 'image') st = a.data;
      else if (a.type === 'anim') { const fr = byId(a.frames[0]); if (fr) st = fr.data; else ic = `<i class="an">${IC.anim}</i>`; }
      else ic = a.kind === 'particle' ? `<i class="pf">${IC.spark}</i>` : `<i class="pj">${IC.proj}</i>`;
      const tip = { folder: 'Folder', image: `Ảnh ${a.w}×${a.h}`, anim: `Animation clip · ${a.frames ? a.frames.length : 0} hình`, prefab: a.kind === 'particle' ? 'Particle prefab — bấm đúp để mở' : 'Projectile prefab — bấm đúp để mở' }[a.type];
      return `<div class="thumb ${S.open[S.tab] === a.id ? 'sel' : ''}" data-aid="${a.id}" title="${esc(a.name)} · ${tip}"${a.type === 'folder' ? ` data-drop="folder:${a.id}"` : ''}>${ic || `<i style="background-image:url(${st})"></i>`}${esc(a.name)}</div>`;
    }).join('') || '<div class="note" style="padding:8px">Folder trống. Bấm chuột phải để tạo prefab hoặc import ảnh, hoặc kéo ảnh từ ngoài vào đây.</div>';
  }
  $('#ftree').addEventListener('click', e => { const r = e.target.closest('[data-fid]'); if (r) { S.folder = r.dataset.fid; renderAssets(); } });
  $('#ftree').addEventListener('contextmenu', e => { e.preventDefault(); const r = e.target.closest('[data-fid]'); if (r) { S.folder = r.dataset.fid; renderAssets(); folderMenu(byId(r.dataset.fid), e.clientX, e.clientY); } });
  $('#gridWrap').addEventListener('contextmenu', e => { e.preventDefault(); const t = e.target.closest('[data-aid]'), a = t && byId(t.dataset.aid); if (a && a.type !== 'folder') fileMenu(a, e.clientX, e.clientY); else folderMenu(a || byId(S.folder), e.clientX, e.clientY); });
  $('#gridWrap').addEventListener('dblclick', e => { const t = e.target.closest('[data-aid]'), a = t && byId(t.dataset.aid); if (!a) return; if (a.type === 'folder') { S.folder = a.id; renderAssets(); } else if (a.type === 'prefab') openPrefab(a); });
  $('#btnAddAsset').onclick = e => { const r = e.currentTarget.getBoundingClientRect(); folderMenu(byId(S.folder) || S.root, r.left - 180, r.bottom + 4); };

  // kéo asset (pointer events, có ghost)
  let ad = null;
  $('#grid').addEventListener('pointerdown', e => { const t = e.target.closest('[data-aid]'); if (!t || e.button !== 0) return; ad = { a: byId(t.dataset.aid), x: e.clientX, y: e.clientY, g: null, on: null }; });
  const accepts = (drop, a) => { const k = drop.split(':')[0]; return k === 'view' ? a.type === 'prefab' : k === 'folder' ? true : k === 'img' ? a.type === 'image' : k === 'seq' ? a.type === 'anim' : k === 'sanim' ? a.type === 'image' || a.type === 'anim' : k === 'impact' ? a.type === 'prefab' && a.kind === 'particle' : false; };
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
    if (k === 'view') return openPrefab(a);
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
    const pf = cur(); if (!pf) { $('#treeList').innerHTML = '<div class="note" style="padding:8px 10px">Chưa mở prefab.</div>'; return; }
    $('#treeList').innerHTML = `<div class="row-item ${!S.sel ? 'sel' : ''}" data-nid="">${IC.root}<span>${esc(pf.name)}</span></div>` + pf.nodes.map(n =>
      `<div class="row-item ${n.id === S.sel ? 'sel' : ''} ${n.hidden ? 'off' : ''}" style="padding-left:26px" data-nid="${n.id}" title="Bấm đúp để đổi tên">${IC[n.type]}<span>${esc(n.name)}</span><button class="mini" data-act="eye" title="Ẩn / hiện trong xem trước">${IC.eye}</button>${n.type === 'emitter' ? `<button class="mini" data-act="del" title="Xoá emitter (Delete)">${IC.x}</button>` : ''}</div>`).join('');
    $('#btnAddNode').title = pf.kind === 'particle' ? 'Thêm emitter' : 'Thêm emitter đuôi (trail)';
  }
  function delNode(id) { const pf = cur(), i = pf.nodes.findIndex(n => n.id === id); if (i < 0 || pf.nodes[i].type !== 'emitter') return; pf.nodes.splice(i, 1); if (S.sel === id) S.sel = null; restart(); dirty(); renderTree(); renderProps(); }
  $('#treeList').addEventListener('click', e => {
    const r = e.target.closest('[data-nid]'); if (!r) return; const pf = cur(), b = e.target.closest('[data-act]');
    if (b) { if (b.dataset.act === 'del') return delNode(r.dataset.nid); const n = pf.nodes.find(n => n.id === r.dataset.nid); n.hidden = !n.hidden; dirty(); return renderTree(); }
    S.sel = r.dataset.nid || null; renderTree(); renderProps();
  });
  $('#treeList').addEventListener('dblclick', async e => {
    const r = e.target.closest('[data-nid]'); if (!r || e.target.closest('[data-act]')) return; const pf = cur();
    if (!r.dataset.nid) return renameAsset(pf);
    const n = pf.nodes.find(n => n.id === r.dataset.nid), v = await ask('Đổi tên node', 'Tên mới', n.name); if (!v) return;
    let name = clean(v); if (pf.nodes.some(x => x !== n && x.name === name)) name = nodeName(pf, name); n.name = name; dirty(); renderTree(); renderProps();
  });
  $('#btnAddNode').onclick = async () => {
    const pf = cur(); if (!pf) return; const src = selNode() && selNode().type === 'emitter' ? selNode() : emitters(pf)[emitters(pf).length - 1];
    const base = src ? src.name.replace(/_\d+$/, '') : 'Emitter';
    const n = src ? Object.assign(clone(src), { id: uid(), name: nodeName(pf, base) }) : { id: uid(), type: 'emitter', name: nodeName(pf, base), x: 0, y: 0, image: (await builtinImg(projectOf(pf), 'Circle')).id, ps: defPS() };
    pf.nodes.splice(src ? pf.nodes.indexOf(src) + 1 : 0, 0, n); S.sel = n.id; if (!src && pf.kind === 'particle') applyMode(pf, [n]); dirty(); renderAll();
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
  function emitterProps(n, seqOn) {
    const s = n.ps, g = s.emitterMode === 0;
    return `<div class="sec"><b>Hình ảnh hạt</b>${slot('img', byId(n.image), 'Sprite Frame', seqOn ? 'Đang dùng chuỗi hình. Ảnh này dùng khi gỡ chuỗi hình' : 'Kéo ảnh vào đây hoặc bấm để chọn')}</div>
    <div class="sec"><b>Node</b>${row('Position', num('node', 'x', 'X'), num('node', 'y', 'Y'))}</div>
    <div class="sec"><b>ParticleSystem</b>
      ${fN('Duration', 'node', 'ps.duration', '', 'Thời gian phát (giây). -1 = loop mãi')}${fN('Emission Rate', 'node', 'ps.emissionRate', '', 'Số hạt sinh ra mỗi giây')}${fN('Life', 'node', 'ps.life', 'ps.lifeVar', 'Thời gian sống của hạt (giây) và độ lệch')}${fN('Total Particles', 'node', 'ps.totalParticles', '', 'Số hạt tối đa cùng lúc')}
      ${fCol('Start Color', 'node', 'ps.startColor')}${fCol('Start Color Var', 'node', 'ps.startColorVar')}${fCol('End Color', 'node', 'ps.endColor')}${fCol('End Color Var', 'node', 'ps.endColorVar')}
      ${fN('Angle', 'node', 'ps.angle', 'ps.angleVar', 'Hướng bắn (độ) và độ lệch')}${fN('Start Size', 'node', 'ps.startSize', 'ps.startSizeVar')}${fN('End Size', 'node', 'ps.endSize', 'ps.endSizeVar', 'Kích thước cuối. -1 = giữ nguyên như Start Size')}
      ${fN('Start Spin', 'node', 'ps.startSpin', 'ps.startSpinVar')}${fN('End Spin', 'node', 'ps.endSpin', 'ps.endSpinVar')}${fXY('Source Pos', 'node', 'ps.sourcePos')}${fXY('Pos Var', 'node', 'ps.posVar', 'Vùng sinh hạt (± X, ± Y)')}
      ${fSel('Position Type', 'node', 'ps.positionType', [[0, 'FREE'], [1, 'RELATIVE'], [2, 'GROUPED']], 1)}${fSel('Emitter Mode', 'node', 'ps.emitterMode', [[0, 'GRAVITY'], [1, 'RADIUS']], 1)}
      ${g ? fXY('Gravity', 'node', 'ps.gravity') + fN('Speed', 'node', 'ps.speed', 'ps.speedVar') + fN('Tangential Accel', 'node', 'ps.tangentialAccel', 'ps.tangentialAccelVar') + fN('Radial Accel', 'node', 'ps.radialAccel', 'ps.radialAccelVar') + fSel('Rotation Is Dir', 'node', 'ps.rotationIsDir', [[false, 'false'], [true, 'true']])
        : fN('Start Radius', 'node', 'ps.startRadius', 'ps.startRadiusVar') + fN('End Radius', 'node', 'ps.endRadius', 'ps.endRadiusVar') + fN('Rotate Per S', 'node', 'ps.rotatePerS', 'ps.rotatePerSVar')}
      ${fSel('Src Blend Factor', 'node', 'ps.srcBlend', BL)}${fSel('Dst Blend Factor', 'node', 'ps.dstBlend', BL)}
      <div class="note">Cột phải là giá trị "Var" (độ lệch ngẫu nhiên ±). Tên thông số trùng với ParticleSystem trong Cocos.</div></div>`;
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
      else h += `<div class="sec"><div class="note" style="margin:0">Chọn 1 emitter ở Node Tree để chỉnh thông số ParticleSystem và ảnh của hạt.</div></div>`;
    } else if (!n) {
      const pj = pf.proj, ip = byId(pj.impact);
      h += `<div class="sec"><b>Preset đường bay</b><div class="presets">${Object.entries(M.sim.PRESETS).map(([k, p]) => `<div class="chip ${pj.preset === k ? 'on' : ''}" data-preset="${k}"><svg viewBox="0 0 80 46">${[0, 1, 2].map(i => `<path d="${chipPath(k, i)}" stroke="${p.color}" opacity="${i ? .4 : 1}"/>`).join('')}</svg>${p.name}</div>`).join('')}</div>
        <div class="note">Các đường cùng màu là các biến thể random trong cùng 1 preset. Đường bay chỉ để xem trước, khi xuất prefab nằm tại (0,0).</div></div>
      <div class="sec"><b>Đường bay (xem trước)</b>${row('Điểm đầu (A)', num('proj', 'sx', 'X'), num('proj', 'sy', 'Y'))}${row('Điểm cuối (B)', num('proj', 'ex', 'X'), num('proj', 'ey', 'Y'))}
        ${row('Thời gian bay', num('proj', 'dur'), '<small>giây</small>')}${row('Độ cong', num('proj', 'amp'), '<small>px</small>')}${row('Độ random', num('proj', 'rand'), '<small>px</small>')}${row('Số biến thể', num('proj', 'variants'), '<small>đường / preset</small>')}
        ${fSel('Tốc độ', 'proj', 'ease', [['linear', 'Đều'], ['in', 'Nhanh dần'], ['out', 'Chậm dần'], ['inout', 'Chậm – nhanh – chậm']])}
        <div class="f"><label>Xoay theo hướng</label>${seg('proj', 'rotateDir', [[true, 'Có'], [false, 'Không']])}</div>${row('Góc lệch', num('proj', 'rotOffset'), '<small>độ</small>', 'Xoay thêm cho Head')}</div>
      <div class="sec"><b>FX bung ra ở điểm cuối</b>${slot('impact', ip, 'Không có FX', ip ? 'Particle prefab · bấm ✕ để gỡ' : 'Kéo 1 Particle prefab từ Assets vào đây', 'impact')}
        <div class="note">FX này là prefab riêng nằm cùng folder, được xuất kèm trong zip.</div></div>`;
    } else if (n.type === 'sprite') {
      const an = byId(n.anim);
      h += `<div class="sec"><b>Head (đầu đạn)</b>${slot('sanim', an || byId(n.image), 'Sprite Frame', an ? `Chuỗi ${an.frames.length} hình · Animation clip` : 'Kéo ảnh hoặc Animation clip vào đây', an ? 'sanim' : '')}
        <div class="f" style="margin-top:8px"><label>Import</label><button class="btn w2" data-dir="sanim" title="Chọn folder chứa chuỗi PNG cho Head">Import folder chuỗi hình…</button></div>
        ${an ? row('Tốc độ (fps)', num(an.id, 'sample'), `<small>${an.frames.length} hình</small>`) : ''}</div>
      <div class="sec"><b>Node</b>${row('Position', num('node', 'x', 'X'), num('node', 'y', 'Y'))}${row('Scale', num('node', 'scale', 'Kích thước Head (1 = 100%)'), '<small>× kích thước ảnh</small>')}${fSel('Src Blend Factor', 'node', 'srcBlend', BL)}${fSel('Dst Blend Factor', 'node', 'dstBlend', BL)}</div>`;
    } else h += emitterProps(n, false);
    P.innerHTML = h;
  }
  function chipPath(k, i) { const pj = { preset: k, sx: 8, sy: k === 'arc' ? 6 : 23, ex: 72, ey: k === 'arc' ? 6 : 23, amp: k === 'arc' ? 34 - i * 9 : 24 - i * 6, rand: 0, seed: i }, v = M.sim.variant(pj, i); v.ex = v.ey = 0; if (i === 1) v.s = -v.s; let d = ''; for (let j = 0; j <= 40; j++) { const p = M.sim.pathPoint(pj, v, j / 40); d += (j ? 'L' : 'M') + p.x.toFixed(1) + ' ' + (46 - p.y).toFixed(1); } return d; }
  function syncInputs() { $$('#props [data-k]').forEach(i => { if (i === document.activeElement || i.dataset.col !== undefined) return; const t = target(i.dataset.o); if (t) { const v = gp(t, i.dataset.k); if (v !== undefined && String(i.value) !== String(v)) i.value = v; } }); }
  const P = $('#props');
  P.addEventListener('input', e => {
    const i = e.target; if (!i.dataset.k) return; const t = target(i.dataset.o); if (!t) return;
    if (i.dataset.col !== undefined) { const c = gp(t, i.dataset.k), v = parseInt(i.value.slice(1), 16); c.r = v >> 16; c.g = v >> 8 & 255; c.b = v & 255; }
    else if (i.tagName === 'SELECT') { let v = i.value; if (i.dataset.n !== undefined) v = +v; else if (v === 'true' || v === 'false') v = v === 'true'; sp(t, i.dataset.k, v); if (/emitterMode$/.test(i.dataset.k)) renderProps(); }
    else { const v = parseFloat(i.value); if (isNaN(v)) return; sp(t, i.dataset.k, i.dataset.k === 'variants' ? Math.max(1, Math.min(12, Math.round(v))) : i.dataset.k === 'sample' ? Math.max(1, v) : v); }
    dirty();
  });
  P.addEventListener('click', async e => {
    const pf = cur(), n = selNode(); let b;
    if ((b = e.target.closest('[data-clear]'))) { e.stopPropagation(); const k = b.dataset.clear; if (k === 'seq') pf.seqAnim = null; if (k === 'sanim') n.anim = null; if (k === 'impact') pf.proj.impact = null; dirty(); return renderProps(); }
    if ((b = e.target.closest('[data-seg]'))) { const [o, k, v] = b.dataset.seg.split('|'); sp(target(o), k, v === 'true' ? true : v === 'false' ? false : v); if (k === 'mode') applyMode(pf); if (k === 'play') applyPlay(pf); restart(); dirty(); return renderProps(); }
    if ((b = e.target.closest('[data-preset]'))) { pf.proj.preset = b.dataset.preset; dirty(); renderProps(); return startFly(); }
    if ((b = e.target.closest('[data-dir]'))) { const fs = (await pickFiles($('#fileDir'))).filter(isImg); if (!fs.length) return toast('Folder không có ảnh PNG/JPG nào'); const nm = (fs[0].webkitRelativePath || '').split('/')[0]; return slotFiles(b.dataset.dir, fs, nm); }
    if ((b = e.target.closest('[data-pick]'))) { const k = b.dataset.pick; if (k === 'impact' || k === 'seq') return; const fs = await pickFiles($('#fileImg')); if (fs.length) slotFiles(k, fs); }
  });

  // giữ chuột + kéo ngang trên ô số để tăng giảm nhanh (Shift = chậm, bấm thường = gõ số)
  const INTK = /totalParticles$|variants$|\.a$|^(sx|sy|ex|ey)$/;
  let scrub = null;
  document.addEventListener('pointerdown', e => {
    const i = e.target; if (e.button !== 0 || !i.matches || !i.matches('input.num[type=number]') || i === document.activeElement) return;
    const v = parseFloat(i.value) || 0, a = Math.abs(v), int = INTK.test(i.dataset.k || '') || i.id === 'cw' || i.id === 'ch';
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

  // ================= header =================
  function renderTabs() { $$('.tab').forEach(b => b.classList.toggle('on', b.dataset.t === S.tab)); const b = $('.tab.on'), bar = $('#tabbar'); bar.style.left = b.offsetLeft + 'px'; bar.style.width = b.offsetWidth + 'px'; }
  $('#tabs').addEventListener('click', e => { const t = e.target.dataset.t; if (!t || t === S.tab) return; S.tab = t; S.sel = null; restart(); renderAll(); dirty(); });
  ['cw', 'ch'].forEach((id, i) => $('#' + id).addEventListener('input', e => { const v = parseInt(e.target.value); if (v > 0) { S.canvas[i ? 'h' : 'w'] = v; dirty(); } }));
  $('#btnPlay').onclick = () => { playing = !playing; $('#btnPlay').textContent = playing ? 'Dừng' : 'Phát'; };
  $('#btnRestart').onclick = () => { restart(); if (!playing) $('#btnPlay').click(); };
  $('#btnFit').onclick = fit;
  $('#btnRef').onclick = refMenu;
  $('#refApply').onclick = () => { S.ref.locked = true; dirty(); renderRef(); toast('Đã khoá ảnh nền. Bấm "Ảnh nền" để chỉnh lại hoặc gỡ.'); };
  $('#refDel').onclick = () => { S.ref = null; dirty(); renderRef(); };
  $('#refScale').addEventListener('input', e => { const v = parseFloat(e.target.value); if (v > 0) { S.ref.scale = v; dirty(); } });
  $('#refOp').addEventListener('input', e => { const v = parseFloat(e.target.value); if (!isNaN(v)) { S.ref.opacity = Math.max(0, Math.min(100, v)); dirty(); } });
  $('#btnBg').onclick = () => { S.bg = ((S.bg || 0) + 1) % BGS.length; dirty(); };
  const typing = e => /INPUT|SELECT|TEXTAREA/.test(e.target.tagName);
  document.addEventListener('keydown', e => {
    if (e.code === 'Space' && !typing(e)) { space = true; e.preventDefault(); if (!e.repeat) spaceT = performance.now(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'e') { e.preventDefault(); return exportDlg(); }
    if (typing(e) || $('.modal') || e.ctrlKey || e.altKey) return;
    if (e.key.toLowerCase() === 'r') $('#btnRestart').click(); if (e.key.toLowerCase() === 'f') fit();
    if (e.key === 'Delete' && S.sel) delNode(S.sel);
  });
  let spaceT = 0;
  document.addEventListener('keyup', e => { if (e.code === 'Space') { space = false; if (!typing(e) && !$('.modal') && performance.now() - spaceT < 250 && !drag) $('#btnPlay').click(); } });

  // ================= xuất =================
  async function exportDlg() {
    if ($('.modal')) return; const tops = S.root.children.filter(c => c.type === 'folder'); if (!tops.length) return toast('Chưa có folder nào để xuất');
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
  function renderAll() { renderRef(); renderTabs(); renderTree(); renderAssets(); renderProps(); $('#cw').value = S.canvas.w; $('#ch').value = S.canvas.h; status(); }
  function fitAll() { const t = S.tab; for (const k of ['particle', 'projectile']) { S.tab = k; fit(); } S.tab = t; }
  async function init() {
    if (api) document.documentElement.classList.add('electron');
    const saved = await load();
    if (saved) { try { S = JSON.parse(saved); if (!S.root || !S.canvas) throw 0; } catch (e) { S = null; } }
    if (!S) await bootstrap();
    idx = null; walk(a => { if (a.type === 'image') a.trim = { x: 0, y: 0, w: a.w, h: a.h }; if (a.type === 'prefab') a.nodes.forEach(n => { if (n.type === 'sprite' && !(n.scale > 0)) n.scale = 1; }); });
    R = new M.Renderer($('#gl'));
    await Promise.all(all().filter(a => a.type === 'image').map(a => { const i = M.imgOf(a); return i.complete ? 0 : new Promise(ok => { i.onload = i.onerror = ok; }); }));
    fitAll(); restart(); renderAll();
    window.addEventListener('resize', renderTabs);
    requestAnimationFrame(t => { last = t; tick(t); });
    setTimeout(() => checkUpdate(false), 1200);
    M.debug = { S: () => S, all, byId, exportBuild: (id, v) => M.exporter.build(byId(id), v, all()), makeSequence, cur, projectOf, renderAll, dirty };
  }
  init();
})(window.M = window.M || {});
