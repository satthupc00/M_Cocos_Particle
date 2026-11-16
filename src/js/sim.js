// Mô phỏng hạt theo đúng công thức ParticleSimulator của Cocos Creator (cc.ParticleSystem / cc.ParticleSystem2D)
(function (M) {
  const r11 = () => Math.random() * 2 - 1;
  const rad = d => d * Math.PI / 180;
  const clamp255 = v => v < 0 ? 0 : v > 255 ? 255 : v;

  class Emitter {
    constructor(node) { this.node = node; this.reset(); }
    reset() { this.parts = []; this.elapsed = 0; this.emitCounter = 0; this.active = true; this.finished = false; }
    stop() { this.active = false; }
    alive() { return this.parts.length; }

    emit(wx, wy) {
      const s = this.node.ps, p = {};
      p.ttl = Math.max(0, s.life + s.lifeVar * r11());
      const ttl = p.ttl || 1e-6;
      p.x = s.sourcePos.x + s.posVar.x * r11();
      p.y = s.sourcePos.y + s.posVar.y * r11();
      const c = ['r', 'g', 'b', 'a'];
      p.c = c.map(k => clamp255(s.startColor[k] + s.startColorVar[k] * r11()));
      const ec = c.map(k => clamp255(s.endColor[k] + s.endColorVar[k] * r11()));
      p.dc = ec.map((v, i) => (v - p.c[i]) / ttl);
      const ss = Math.max(0, s.startSize + s.startSizeVar * r11());
      p.size = ss;
      if (s.endSize === -1) p.dsize = 0;
      else p.dsize = (Math.max(0, s.endSize + s.endSizeVar * r11()) - ss) / ttl;
      p.rot = s.startSpin + s.startSpinVar * r11();
      p.drot = (s.endSpin + s.endSpinVar * r11() - p.rot) / ttl;
      p.sx = wx; p.sy = wy;
      const a = rad(s.angle + s.angleVar * r11());
      if (s.emitterMode === 0) {
        const sp = s.speed + s.speedVar * r11();
        p.dx = Math.cos(a) * sp; p.dy = Math.sin(a) * sp;
        p.ra = s.radialAccel + s.radialAccelVar * r11();
        p.ta = s.tangentialAccel + s.tangentialAccelVar * r11();
        if (s.rotationIsDir) p.rot = -Math.atan2(p.dy, p.dx) * 180 / Math.PI;
      } else {
        const sr = s.startRadius + s.startRadiusVar * r11();
        const er = s.endRadius + s.endRadiusVar * r11();
        p.radius = sr;
        p.dradius = s.endRadius === -1 ? 0 : (er - sr) / ttl;
        p.angle = a;
        p.dps = rad(s.rotatePerS + s.rotatePerSVar * r11());
      }
      this.parts.push(p);
    }

    // (wx,wy) vị trí node hiện tại; (px,py) vị trí node ở bước trước (để rải hạt mượt khi node di chuyển)
    step(dt, wx, wy) {
      const s = this.node.ps;
      if (this.active && s.emissionRate > 0) {
        const rate = 1 / s.emissionRate;
        if (this.parts.length < s.totalParticles) this.emitCounter += dt;
        let guard = 0;
        while (this.parts.length < s.totalParticles && this.emitCounter > rate && guard++ < 2000) {
          this.emit(wx, wy); this.emitCounter -= rate;
        }
        this.elapsed += dt;
        if (s.duration !== -1 && s.duration < this.elapsed) this.active = false;
      }
      const ps = this.parts, g = s.gravity;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.ttl -= dt;
        if (p.ttl <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
        if (s.emitterMode === 0) {
          let rx = 0, ry = 0;
          if (p.x || p.y) { const l = Math.hypot(p.x, p.y); rx = p.x / l; ry = p.y / l; }
          const tx = -ry * p.ta, ty = rx * p.ta;
          p.dx += (rx * p.ra + tx + g.x) * dt;
          p.dy += (ry * p.ra + ty + g.y) * dt;
          p.x += p.dx * dt; p.y += p.dy * dt;
        } else {
          p.angle += p.dps * dt; p.radius += p.dradius * dt;
          p.x = -Math.cos(p.angle) * p.radius; p.y = -Math.sin(p.angle) * p.radius;
        }
        for (let k = 0; k < 4; k++) p.c[k] += p.dc[k] * dt;
        p.size = Math.max(0, p.size + p.dsize * dt);
        p.rot += p.drot * dt;
      }
      if (!this.active && !ps.length) this.finished = true;
    }
  }

  // Một prefab đang chạy trong viewport
  class Instance {
    constructor(prefab) { this.prefab = prefab; this.x = 0; this.y = 0; this.time = 0; this.emitters = new Map(); this.headVisible = true; this.headRot = 0; }
    nodePos(node) { const pf = this.prefab, r = (pf.rot || 0) * Math.PI / 180, c = Math.cos(r), sn = Math.sin(r), x = node.x * (pf.sx || 1), y = node.y * (pf.sy || 1); return { x: this.x + x * c - y * sn, y: this.y + x * sn + y * c }; }
    em(node) { let e = this.emitters.get(node.id); if (!e || e.node !== node) { e = new Emitter(node); this.emitters.set(node.id, e); } return e; }
    reset() { this.emitters.clear(); this.time = 0; }
    stopAll() { this.emitters.forEach(e => e.stop()); }
    step(dt, nx, ny) {
      // rải đều theo quãng đường nếu instance di chuyển
      const ox = this.x, oy = this.y, n = Math.max(1, Math.min(8, Math.ceil(dt / (1 / 120))));
      for (let i = 1; i <= n; i++) {
        const f = i / n; this.x = ox + (nx - ox) * f; this.y = oy + (ny - oy) * f;
        for (const node of this.prefab.nodes) if (node.type === 'emitter' && !node.hidden) { const w = this.nodePos(node); this.em(node).step(dt / n, w.x, w.y); }
      }
      this.time += dt;
    }
    count() { let c = 0; this.emitters.forEach(e => c += e.parts.length); return c; }
    done() { for (const node of this.prefab.nodes) if (node.type === 'emitter' && !node.hidden) { const e = this.emitters.get(node.id); if (!e || !e.finished) return false; } return true; }
  }

  // ---- Preset đường bay (chỉ để xem trước) ----
  const PRESETS = {
    arc2:   { name: 'Vòng cung 2 điểm', color: '#3DDC8A', icon: 'M8 40 Q40 -10 72 40' },
    arc3:   { name: 'Vòng cung 3 điểm', color: '#3D9BFF', icon: 'M8 38 Q22 -14 72 30' },
    circle: { name: 'Vòng tròn', color: '#F2B84B', icon: 'M40 5a18 18 0 1 0 .1 0' },
    still:  { name: 'Đứng yên tại chỗ', color: '#8D929C', icon: 'M40 13a10 10 0 1 0 .1 0M40 3v6M40 37v6M20 23h6M54 23h6' },
    free:   { name: 'Vẽ tự do', color: '#E5383B', icon: 'M6 30c10-22 18 12 28-6s14-14 20 0 10 10 20-10' },
  };
  function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  // biến thể 0 luôn là đường gốc; các biến thể sau lệch ngẫu nhiên trong khoảng "Độ random"
  function variant(proj, i) {
    if (!i) return { j: 0, ex: 0, ey: 0, jx: 0, jy: 0 };
    const r = mulberry(1234 + i * 977), q = () => (r() * 2 - 1) * proj.rand;
    return { j: q(), ex: q() * .5, ey: q() * .5, jx: q(), jy: q() };
  }
  const lens = new WeakMap();
  function freeAt(pts, u) {
    let L = lens.get(pts); if (!L || L.n !== pts.length) { L = { n: pts.length, c: [0] }; for (let i = 1; i < pts.length; i++) L.c.push(L.c[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)); lens.set(pts, L); }
    const tot = L.c[L.c.length - 1], d = u * tot; let i = 1; while (i < pts.length - 1 && L.c[i] < d) i++;
    const a = pts[i - 1], b = pts[i], seg = L.c[i] - L.c[i - 1] || 1, t = (d - L.c[i - 1]) / seg, dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
    return { x: a.x + dx * t, y: a.y + dy * t, nx: -dy / l, ny: dx / l };
  }
  function pathPoint(proj, v, u) {
    const ax = proj.sx, ay = proj.sy, bx = proj.ex + v.ex, by = proj.ey + v.ey;
    if (proj.preset === 'arc3') {
      const cx = proj.cx + v.jx, cy = proj.cy + v.jy, px = 2 * cx - (ax + bx) / 2, py = 2 * cy - (ay + by) / 2, w = 1 - u;
      return { x: w * w * ax + 2 * w * u * px + u * u * bx, y: w * w * ay + 2 * w * u * py + u * u * by };
    }
    if (proj.preset === 'circle') {
      const P = proj.circle, mx = (P[0].x + P[1].x + P[2].x + P[3].x) / 4, my = (P[0].y + P[1].y + P[2].y + P[3].y) / 4;
      const rad = (P.reduce((a, q) => a + Math.hypot(q.x - mx, q.y - my), 0) / 4) || 1, k = 1 + v.j / rad;
      const g = i => { const q = P[(i % 4 + 4) % 4]; return { x: mx + (q.x - mx) * k, y: my + (q.y - my) * k }; };
      const f = Math.min(3.9999, u * 4), s = Math.floor(f), t = f - s, p0 = g(s - 1), p1 = g(s), p2 = g(s + 1), p3 = g(s + 2), t2 = t * t, t3 = t2 * t;
      const cr = (a, b, c, d) => .5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      return { x: cr(p0.x, p1.x, p2.x, p3.x), y: cr(p0.y, p1.y, p2.y, p3.y) };
    }
    if (proj.preset === 'free' && proj.free && proj.free.length > 1) { const q = freeAt(proj.free, u), o = Math.sin(u * Math.PI) * v.j * .5; return { x: q.x + q.nx * o, y: q.y + q.ny * o }; }
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1; let nx = -dy / l, ny = dx / l; if (ny < 0) { nx = -nx; ny = -ny; }   // pháp tuyến luôn hướng lên
    const no = 4 * u * (1 - u) * (proj.preset === 'free' ? 0 : proj.amp + v.j);
    return { x: ax + dx * u + nx * no, y: ay + dy * u + ny * no };
  }
  const EASE = { linear: u => u, in: u => u * u, out: u => 1 - (1 - u) * (1 - u), inout: u => u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u) };

  M.sim = { Emitter, Instance, PRESETS, variant, pathPoint, EASE };
})(window.M = window.M || {});
