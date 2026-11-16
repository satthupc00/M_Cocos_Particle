// Nhập project từ file zip (đã xuất cho Cocos 2.x hoặc 3.x): cần đủ 3 folder Animation, Images, Prefabs và file .meta hợp lệ
(function (M) {
  const RE = { anim: /anim(ation)?s?$/i, img: /images?$/i, pf: /prefabs?$/i };
  const IMG = /\.(png|jpe?g|webp)$/i, ASSET = /\.(png|jpe?g|webp|anim|prefab)$/i;
  const BF3 = ['ZERO', 'ONE', 'SRC_ALPHA', 'DST_ALPHA', 'ONE_MINUS_SRC_ALPHA', 'ONE_MINUS_DST_ALPHA', 'SRC_COLOR', 'DST_COLOR', 'ONE_MINUS_SRC_COLOR', 'ONE_MINUS_DST_COLOR'];
  const fail = msg => { const e = new Error(msg); e.user = true; throw e; };
  const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp' };

  // h: { uid, uuid4, defPS, loadImg }
  async function parse(file, h) {
    let zip; try { zip = await JSZip.loadAsync(file); } catch (e) { fail('Không đọc được file zip này (file hỏng hoặc không phải zip).'); }
    const files = Object.keys(zip.files).filter(p => !zip.files[p].dir && !/(^|\/)(__MACOSX|\.DS_Store|Thumbs\.db)/.test(p));
    const dirs = new Set(['']); files.forEach(p => { const a = p.split('/'); for (let i = 1; i < a.length; i++) dirs.add(a.slice(0, i).join('/') + '/'); });
    const kids = d => [...new Set([...dirs].filter(x => x !== d && x.startsWith(d) && x.slice(d.length).split('/').length === 2).map(x => x.slice(d.length, -1)))];
    // folder Animation không bắt buộc: prefab không dùng chuỗi hình thì Cocos không tạo folder này
    const roots = [...dirs].filter(d => { const k = kids(d); return k.some(n => RE.img.test(n)) && k.some(n => RE.pf.test(n)); });
    if (!roots.length) fail('File zip không hợp lệ: cần có folder Images và Prefabs nằm cạnh nhau (và folder Animation nếu có dùng chuỗi hình).');
    const text = p => zip.file(p).async('string');
    const metaCache = new Map();
    const meta = async p => { if (metaCache.has(p)) return metaCache.get(p); let m = null; const f = zip.file(p + '.meta'); if (f) { try { m = JSON.parse(await f.async('string')); if (!m || typeof m.uuid !== 'string' || !m.uuid) m = null; } catch (e) { m = null; } } metaCache.set(p, m); return m; };

    const out = [];
    for (const D of roots) {
      const bad = [], mine = files.filter(p => p.startsWith(D) && !p.endsWith('.meta'));
      for (const n of kids(D)) if ((RE.anim.test(n) || RE.img.test(n) || RE.pf.test(n)) && !(await meta(D + n))) bad.push(n + '.meta');
      for (const p of mine) if (ASSET.test(p) && !(await meta(p))) bad.push(p.slice(D.length) + '.meta');
      if (bad.length) fail('File zip không hợp lệ: thiếu hoặc hỏng file meta:\n' + bad.slice(0, 6).join('\n') + (bad.length > 6 ? `\n… và ${bad.length - 6} file khác` : ''));
      const v3 = !!(await meta(D + kids(D).find(n => RE.pf.test(n)))).importer;
      const sf = new Map(), clips = new Map(), warn = [], offsOf = new Map();

      // 1) cây folder + ảnh
      const build = async (d, name) => {
        const m = await meta(d.slice(0, -1)), node = { id: h.uid(), type: 'folder', name, uuid: (m && m.uuid) || h.uuid4(), children: [] };
        for (const n of kids(d).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) node.children.push(await build(d + n + '/', n));
        for (const p of mine.filter(p => p.startsWith(d) && !p.slice(d.length).includes('/') && IMG.test(p)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))) {
          const m = await meta(p), fn = p.slice(d.length), ext = fn.match(IMG)[1].toLowerCase(), data = `data:${MIME[ext]};base64,` + b64(await zip.file(p).async('uint8array'));
          let img; try { img = await h.loadImg(data); } catch (e) { fail('Không đọc được ảnh: ' + fn); }
          const subs = Object.values(m.subMetas || {}), a = { id: h.uid(), type: 'image', name: fn.replace(IMG, ''), ext, data, w: img.naturalWidth, h: img.naturalHeight, trim: { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight }, uuid: m.uuid, sub: (!v3 && subs[0] && subs[0].uuid) || h.uuid4() };
          node.children.push(a); sf.set(m.uuid, a); sf.set(a.sub, a); sf.set(m.uuid + '@f9941', a);
        }
        node._dir = d; return node;
      };
      const name = D ? D.slice(0, -1).split('/').pop() : file.name.replace(/\.zip$/i, '');
      const tree = await build(D, name);
      const folderOf = d => { let f = tree; if (d === D) return f; for (const seg of d.slice(D.length, -1).split('/')) f = f.children.find(c => c.type === 'folder' && c.name === seg); return f; };
      const dirOf = p => p.slice(0, p.lastIndexOf('/') + 1);
      const ref = o => o && o.__uuid__ && sf.get(o.__uuid__);

      // 2) animation clip
      for (const p of mine.filter(p => /\.anim$/i.test(p))) {
        let j; try { j = JSON.parse(await text(p)); } catch (e) { fail('File animation bị hỏng: ' + p.slice(D.length)); }
        let frames = [], sample = 30; const offs = {}, note = (name, list) => { if (name && frames.length && list.length) { const i = frames.indexOf(list[0]); if (i >= 0) offs[name] = i; } };
        if (Array.isArray(j)) { sample = j[0].sample || 30; const c = j.find(o => o && o.__type__ === 'cc.ObjectCurve'); if (c) frames = (c._values || []).map(ref).filter(Boolean);
          j.forEach(o => { if (!o || o.__type__ !== 'cc.animation.TrackPath') return; const hp = (o._paths || []).map(x => x && typeof x.__id__ === 'number' ? j[x.__id__] : null).find(x => x && x.__type__ === 'cc.animation.HierarchyPath'); if (!hp) return;
            const tr = j.find(t => t && t.__type__ === 'cc.animation.ObjectTrack' && j[t._binding.path.__id__] === o), cv = tr && j[j[tr._channel.__id__]._curve.__id__]; if (cv) note(hp.path, (cv._values || []).map(ref).filter(Boolean)); }); }
        else { sample = j.sample || 30; const cd = j.curveData || {}, lists = []; const grab = comps => Object.values(comps || {}).forEach(c => c.spriteFrame && lists.push(c.spriteFrame));
          grab(cd.comps); Object.values(cd.paths || {}).forEach(x => grab(x.comps)); if (lists[0]) frames = lists[0].map(k => ref(k.value)).filter(Boolean);
          Object.entries(cd.paths || {}).forEach(([name, x]) => Object.values(x.comps || {}).forEach(c => c.spriteFrame && note(name, c.spriteFrame.map(k => ref(k.value)).filter(Boolean)))); }
        const a = { id: h.uid(), type: 'anim', name: p.slice(p.lastIndexOf('/') + 1).replace(/\.anim$/i, ''), sample, frames: frames.map(f => f.id), uuid: (await meta(p)).uuid }; offsOf.set(a, offs);
        folderOf(dirOf(p)).children.push(a); clips.set(a.uuid, a);
      }

      // 3) prefab
      for (const p of mine.filter(p => /\.prefab$/i.test(p))) {
        let j; try { j = JSON.parse(await text(p)); } catch (e) { fail('File prefab bị hỏng: ' + p.slice(D.length)); }
        const pname = p.slice(p.lastIndexOf('/') + 1).replace(/\.prefab$/i, '');
        if (!Array.isArray(j) || !j[0] || !j[0].data) fail('File prefab không đúng định dạng Cocos: ' + pname);
        const at = r => r && typeof r.__id__ === 'number' ? j[r.__id__] : null, root = at(j[0].data);
        const xf = n => { const pos = n._lpos || n._position || {}, sc = n._lscale || n._scale || {}, eu = n._euler || n._eulerAngles; return { x: pos.x || 0, y: pos.y || 0, sx: sc.x || 1, sy: sc.y || 1, rot: eu ? eu.z || 0 : -(n._rotationX || 0) }; };
        const comps = n => (n._components || []).map(at).filter(Boolean);
        const clipOf = n => { const a = comps(n).find(c => c.__type__ === 'cc.Animation'); const u = a && a._defaultClip && a._defaultClip.__uuid__; return u ? clips.get(u) : null; };
        const t = xf(root), pf = { id: h.uid(), type: 'prefab', kind: 'particle', name: pname, uuid: (await meta(p)).uuid, nodes: [], seqAnim: null, x: 0, y: 0, rot: t.rot, sx: t.sx, sy: t.sy };
        if (typeof root._layer === 'number') pf.layer = root._layer;
        for (const c of (root._children || []).map(at).filter(Boolean)) {
          const cs = comps(c), ps = cs.find(x => x.__type__ === 'cc.ParticleSystem' || x.__type__ === 'cc.ParticleSystem2D'), sp = cs.find(x => x.__type__ === 'cc.Sprite');
          if ((c._children || []).length) warn.push(`${pname}: node con bên trong "${c._name}" bị bỏ qua`);
          if (ps) {
            const is3 = ps.__type__ === 'cc.ParticleSystem2D', bl = v => (is3 ? BF3[v] : Object.keys(M.GLB).find(k => M.GLB[k] === v)) || 'SRC_ALPHA';
            const s = h.defPS(), col = k => { const v = ps['_' + k] || ps[k]; return v ? { r: v.r, g: v.g, b: v.b, a: v.a } : s[k]; }, v2 = k => ps[k] ? { x: ps[k].x || 0, y: ps[k].y || 0 } : s[k];
            for (const k of ['duration', 'emissionRate', 'life', 'lifeVar', 'angle', 'angleVar', 'startSize', 'startSizeVar', 'endSize', 'endSizeVar', 'startSpin', 'startSpinVar', 'endSpin', 'endSpinVar', 'emitterMode', 'speed', 'speedVar',
              'tangentialAccel', 'tangentialAccelVar', 'radialAccel', 'radialAccelVar', 'rotationIsDir', 'startRadius', 'startRadiusVar', 'endRadius', 'endRadiusVar', 'rotatePerS', 'rotatePerSVar', 'autoRemoveOnFinish']) if (ps[k] !== undefined) s[k] = ps[k];
            s.totalParticles = ps.totalParticles !== undefined ? ps.totalParticles : ps._totalParticles !== undefined ? ps._totalParticles : s.totalParticles;
            s.positionType = ps._positionType !== undefined ? ps._positionType : ps.positionType || 0;
            ['startColor', 'startColorVar', 'endColor', 'endColorVar'].forEach(k => s[k] = col(k)); ['sourcePos', 'posVar', 'gravity'].forEach(k => s[k] = v2(k));
            s.srcBlend = bl(ps._srcBlendFactor); s.dstBlend = bl(ps._dstBlendFactor);
            const img = ref(ps._spriteFrame); if (!img) warn.push(`${pname}: emitter "${c._name}" trỏ tới 1 ảnh không có trong zip nên tạm dùng chấm tròn mặc định`);
          pf.nodes.push(Object.assign({ id: h.uid(), type: 'emitter', name: c._name, image: img ? img.id : null, ps: s }, xf(c)));
          } else if (sp) {
            const is3 = !!c._lpos, bl = v => (is3 ? BF3[v] : Object.keys(M.GLB).find(k => M.GLB[k] === v)) || 'SRC_ALPHA', img = ref(sp._spriteFrame), an = clipOf(c);
            pf.kind = 'projectile'; pf.nodes.push(Object.assign({ id: h.uid(), type: 'sprite', name: c._name, image: img ? img.id : null, anim: an ? an.id : null, srcBlend: bl(sp._srcBlendFactor), dstBlend: bl(sp._dstBlendFactor) }, xf(c)));
          } else warn.push(`${pname}: node "${c._name}" không phải ParticleSystem hay Sprite nên bị bỏ qua`);
        }
        const seq = clipOf(root); if (seq && pf.kind === 'particle') { pf.seqAnim = seq.id; const o = offsOf.get(seq) || {}; pf.nodes.forEach(n => { if (n.type === 'emitter' && typeof o[n.name] === 'number') n.seqOff = o[n.name]; }); }
        folderOf(dirOf(p)).children.push(pf);
      }
      (function clean(f) { delete f._dir; f.children.forEach(c => c.type === 'folder' && clean(c)); })(tree);
      out.push({ tree, warn, ver: v3 ? '3.x' : '2.x' });
    }
    return out;
  }
  M.importer = { parse };
})(window.M = window.M || {});
