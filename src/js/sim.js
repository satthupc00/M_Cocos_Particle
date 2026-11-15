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
    em(node) { let e = this.emitters.get(node.id); if (!e || e.node !== node) { e = new Emitter(node); this.emitters.set(node.id, e); } return e; }
    reset() { this.emitters.clear(); this.time = 0; }
    stopAll() { this.emitters.forEach(e => e.stop()); }
    step(dt, nx, ny) {
      // rải đều theo quãng đường nếu instance di chuyển
      const ox = this.x, oy = this.y, n = Math.max(1, Math.min(8, Math.ceil(dt / (1 / 120))));
      for (let i = 1; i <= n; i++) {
        const f = i / n; this.x = ox + (nx - ox) * f; this.y = oy + (ny - oy) * f;
        for (const node of this.prefab.nodes) if (node.type === 'emitter' && !node.hidden) this.em(node).step(dt / n, this.x + node.x, this.y + node.y);
      }
      this.time += dt;
    }
    count() { let c = 0; this.emitters.forEach(e => c += e.parts.length); return c; }
    done() { for (const node of this.prefab.nodes) if (node.type === 'emitter' && !node.hidden) { const e = this.emitters.get(node.id); if (!e || !e.finished) return false; } return true; }
  }

  // ---- Preset đường bay (chỉ để xem trước) ----
  // trả về hàm u(0..1) -> {x,y}; v = bộ số random của biến thể
  const PRESETS = {
    arc:    { name: 'Vòng cung', color: '#3DDC8A', f: (u, v) => [0, 4 * u * (1 - u) * v.a] },
    wave:   { name: 'Sóng chữ S', color: '#E5383B', f: (u, v) => [0, Math.sin(u * Math.PI * 2) * v.a * .6 * v.s] },
    line:   { name: 'Thẳng', color: '#3D9BFF', f: (u, v) => [0, 4 * u * (1 - u) * v.j] },
    spiral: { name: 'Xoắn ốc', color: '#F2B84B', f: (u, v) => { const e = Math.sin(u * Math.PI), t = u * Math.PI * 4 * v.s; return [Math.sin(t) * e * v.a * .35, (1 - Math.cos(t)) * e * v.a * .35 * v.s]; } },
    zigzag: { name: 'Zigzag', color: '#7B5CFF', f: (u, v) => { const t = u * 3; const tri = 1 - 4 * Math.abs((t % 1) - .5); return [0, tri * Math.sin(u * Math.PI) * v.a * .5 * v.s]; } },
    loop:   { name: 'Vòng lại', color: '#22C3A6', f: (u, v) => [-Math.sin(u * Math.PI * 2) * v.a * .6, (1 - Math.cos(u * Math.PI * 2)) * v.a * .5 * v.s] },
  };
  function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function variant(proj, i) {
    const r = mulberry(1234 + i * 977 + (proj.seed || 0));
    const j = (r() * 2 - 1) * proj.rand;
    return { a: proj.amp + j, j, s: (proj.preset === 'arc' || proj.preset === 'line') ? 1 : (r() < .5 ? -1 : 1), ex: (r() * 2 - 1) * proj.rand * .5, ey: (r() * 2 - 1) * proj.rand * .5 };
  }
  function pathPoint(proj, v, u) {
    const ax = proj.sx, ay = proj.sy, bx = proj.ex + v.ex, by = proj.ey + v.ey;
    const dx = bx - ax, dy = by - ay, l = Math.hypot(dx, dy) || 1, tx = dx / l, ty = dy / l;
    let nx = -ty, ny = tx; if (ny < 0) { nx = -nx; ny = -ny; }   // pháp tuyến luôn hướng lên
    const [al, no] = PRESETS[proj.preset].f(u, v);
    return { x: ax + dx * u + tx * al + nx * no, y: ay + dy * u + ty * al + ny * no };
  }
  const EASE = { linear: u => u, in: u => u * u, out: u => 1 - (1 - u) * (1 - u), inout: u => u < .5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u) };

  M.sim = { Emitter, Instance, PRESETS, variant, pathPoint, EASE };
})(window.M = window.M || {});
