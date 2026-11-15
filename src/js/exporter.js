// Xuất zip cho Cocos Creator 2.1.3 và 3.6.3 (cấu trúc bám theo prefab mẫu thật)
(function (M) {
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const fileId = () => { let s = ''; for (let i = 0; i < 22; i++) s += B64[Math.random() * 64 | 0]; return s; };
  const BF3 = { ZERO: 0, ONE: 1, SRC_ALPHA: 2, DST_ALPHA: 3, ONE_MINUS_SRC_ALPHA: 4, ONE_MINUS_DST_ALPHA: 5, SRC_COLOR: 6, DST_COLOR: 7, ONE_MINUS_SRC_COLOR: 8, ONE_MINUS_DST_COLOR: 9 };
  const MAT2D = 'eca5d2f2-8ef6-41c2-bbe6-f9c79d09c432';
  const col = c => ({ __type__: 'cc.Color', r: Math.round(c.r), g: Math.round(c.g), b: Math.round(c.b), a: Math.round(c.a) });
  const v2 = (x, y) => ({ __type__: 'cc.Vec2', x, y });
  const v3 = (x, y, z) => ({ __type__: 'cc.Vec3', x, y, z });
  const J = o => JSON.stringify(o, null, 2);
  const trimOf = a => ({ x: 0, y: 0, w: a.w, h: a.h });   // không cắt mép: mọi hình trong chuỗi giữ cùng kích thước

  // ---------- tham chiếu sprite frame ----------
  const sf2 = img => img ? { __uuid__: img.sub } : null;
  const sf3 = img => img ? { __uuid__: img.uuid + '@f9941', __expectedType__: 'cc.SpriteFrame' } : null;

  // ---------- thứ tự frame của chuỗi hình cho từng emitter (lệch pha để hạt không lật giống hệt nhau) ----------
  function seqFrames(anim, idx, count, get) {
    const fr = anim.frames.map(get).filter(Boolean), n = fr.length;
    if (!n) return [];
    const off = count > 1 ? Math.floor(idx * n / count) % n : 0;
    return fr.map((_, i) => fr[(i + off) % n]);
  }
  M.seqFrames = seqFrames;

  // ================= 2.1.3 =================
  function ps2(node, id, img) {
    const s = node.ps;
    return {
      __type__: 'cc.ParticleSystem', _name: node.name + '<ParticleSystem>', _objFlags: 0, node: { __id__: id }, _enabled: true,
      _materials: [{ __uuid__: MAT2D }], _srcBlendFactor: M.GLB[s.srcBlend], _dstBlendFactor: M.GLB[s.dstBlend], _custom: true, _file: null,
      _spriteFrame: sf2(img), _texture: img ? { __uuid__: img.uuid } : null, _stopped: true, playOnLoad: true, autoRemoveOnFinish: !!s.autoRemoveOnFinish,
      totalParticles: s.totalParticles, duration: s.duration, emissionRate: s.emissionRate, life: s.life, lifeVar: s.lifeVar,
      _startColor: col(s.startColor), _startColorVar: col(s.startColorVar), _endColor: col(s.endColor), _endColorVar: col(s.endColorVar),
      angle: s.angle, angleVar: s.angleVar, startSize: s.startSize, startSizeVar: s.startSizeVar, endSize: s.endSize, endSizeVar: s.endSizeVar,
      startSpin: s.startSpin, startSpinVar: s.startSpinVar, endSpin: s.endSpin, endSpinVar: s.endSpinVar,
      sourcePos: v2(s.sourcePos.x, s.sourcePos.y), posVar: v2(s.posVar.x, s.posVar.y), _positionType: s.positionType, positionType: s.positionType,
      emitterMode: s.emitterMode, gravity: v2(s.gravity.x, s.gravity.y), speed: s.speed, speedVar: s.speedVar,
      tangentialAccel: s.tangentialAccel, tangentialAccelVar: s.tangentialAccelVar, radialAccel: s.radialAccel, radialAccelVar: s.radialAccelVar,
      rotationIsDir: !!s.rotationIsDir, startRadius: s.startRadius, startRadiusVar: s.startRadiusVar, endRadius: s.endRadius, endRadiusVar: s.endRadiusVar,
      rotatePerS: s.rotatePerS, rotatePerSVar: s.rotatePerSVar, '_N$preview': true, _id: ''
    };
  }
  function node2(name, parent, level, x, y, w, h, t = {}) {
    return {
      __type__: 'cc.Node', _name: name, _objFlags: 0, _parent: parent, _children: [], _active: true, _level: level, _components: [], _prefab: null,
      _opacity: 255, _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 }, _contentSize: { __type__: 'cc.Size', width: w, height: h },
      _anchorPoint: v2(0.5, 0.5), _position: v3(x, y, 0), _scale: v3(t.sx || 1, t.sy || 1, 1), _eulerAngles: v3(0, 0, t.rot || 0), _skewX: 0, _skewY: 0, _is3DNode: false, groupIndex: 0, _id: ''
    };
  }
  const anim2 = (id, clip) => ({ __type__: 'cc.Animation', _name: '', _objFlags: 0, node: { __id__: id }, _enabled: true, _defaultClip: { __uuid__: clip.uuid }, _clips: [{ __uuid__: clip.uuid }], playOnLoad: true, _id: '' });

  function prefab2(pf, get) {
    const out = [{ __type__: 'cc.Prefab', _name: '', _objFlags: 0, _native: '', data: { __id__: 1 }, optimizationPolicy: 0, asyncLoadAssets: false, readonly: false }];
    const info = () => ({ __type__: 'cc.PrefabInfo', root: { __id__: 1 }, asset: { __uuid__: pf.uuid }, fileId: fileId(), sync: false });
    const root = node2(pf.name, null, 1, 0, 0, 0, 0, pf); out.push(root);
    const seq = pf.kind === 'particle' && get(pf.seqAnim), ems = pf.nodes.filter(n => n.type === 'emitter');
    for (const n of pf.nodes) {
      const id = out.length; let img = get(n.image);
      if (n.type === 'emitter') {
        if (seq) img = seqFrames(seq, ems.indexOf(n), ems.length, get)[0] || img;
        const nd = node2(n.name, { __id__: 1 }, 2, n.x, n.y, 0, 0, n); out.push(nd);
        nd._components.push({ __id__: out.length }); out.push(ps2(n, id, img));
        nd._prefab = { __id__: out.length }; out.push(info());
      } else {
        const an = get(n.anim); if (an) img = get(an.frames[0]) || img;
        const t = img ? trimOf(img) : { w: 0, h: 0 };
        const nd = node2(n.name, { __id__: 1 }, 2, n.x, n.y, t.w, t.h, n); out.push(nd);
        nd._components.push({ __id__: out.length });
        out.push({
          __type__: 'cc.Sprite', _name: n.name + '<Sprite>', _objFlags: 0, node: { __id__: id }, _enabled: true, _materials: [{ __uuid__: MAT2D }],
          _srcBlendFactor: M.GLB[n.srcBlend], _dstBlendFactor: M.GLB[n.dstBlend], _spriteFrame: sf2(img), _type: 0, _sizeMode: 1, _fillType: 0,
          _fillCenter: v2(0, 0), _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _atlas: null, _id: ''
        });
        if (an) { nd._components.push({ __id__: out.length }); out.push(anim2(id, an)); }
        nd._prefab = { __id__: out.length }; out.push(info());
      }
      root._children.push({ __id__: id });
    }
    if (seq) { root._components.push({ __id__: out.length }); out.push(anim2(1, seq)); }
    root._prefab = { __id__: out.length }; out.push(info());
    return out;
  }

  // danh sách nơi dùng clip: emitter (theo tên node con) và sprite (ngay trên node)
  function clipUsers(anim, prefabs) {
    const paths = [], seen = new Set(); let onNode = false;
    for (const pf of prefabs) {
      if (pf.kind === 'particle' && pf.seqAnim === anim.id) {
        const ems = pf.nodes.filter(n => n.type === 'emitter');
        ems.forEach((n, i) => { if (!seen.has(n.name)) { seen.add(n.name); paths.push({ name: n.name, idx: i, count: ems.length }); } });
      }
      for (const n of pf.nodes) if (n.type === 'sprite' && n.anim === anim.id) onNode = true;
    }
    if (!paths.length && !onNode) onNode = true;
    return { paths, onNode };
  }
  const clipTimes = (anim, n) => Array.from({ length: n }, (_, i) => i / anim.sample);

  function clip2(anim, prefabs, get) {
    const u = clipUsers(anim, prefabs), n = anim.frames.map(get).filter(Boolean).length, times = clipTimes(anim, n);
    const keys = fr => fr.map((f, i) => ({ frame: times[i], value: { __uuid__: f.sub } }));
    const cd = {};
    if (u.onNode) cd.comps = { 'cc.Sprite': { spriteFrame: keys(seqFrames(anim, 0, 1, get)) } };
    if (u.paths.length) { cd.paths = {}; for (const p of u.paths) cd.paths[p.name] = { comps: { 'cc.ParticleSystem': { spriteFrame: keys(seqFrames(anim, p.idx, p.count, get)) } } }; }
    return { __type__: 'cc.AnimationClip', _name: anim.name, _objFlags: 0, _native: '', _duration: n ? (n - 1) / anim.sample : 0, sample: anim.sample, speed: 1, wrapMode: 2, curveData: cd, events: [] };
  }
  function imgMeta2(a) {
    const t = trimOf(a);
    return {
      ver: '2.3.3', uuid: a.uuid, type: 'sprite', wrapMode: 'clamp', filterMode: 'bilinear', premultiplyAlpha: false, genMipmaps: false, packable: true, platformSettings: {},
      subMetas: { [a.name]: { ver: '1.0.4', uuid: a.sub, rawTextureUuid: a.uuid, trimType: 'custom', trimThreshold: 0, rotated: false,
        offsetX: t.x + t.w / 2 - a.w / 2, offsetY: a.h / 2 - (t.y + t.h / 2), trimX: t.x, trimY: t.y, width: t.w, height: t.h, rawWidth: a.w, rawHeight: a.h,
        borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0, subMetas: {} } }
    };
  }

  // ================= 3.6.3 =================
  function ps3(node, id, pid, img) {
    const s = node.ps;
    return {
      __type__: 'cc.ParticleSystem2D', _name: '', _objFlags: 0, node: { __id__: id }, _enabled: true, __prefab: { __id__: pid }, _customMaterial: null,
      _srcBlendFactor: BF3[s.srcBlend], _dstBlendFactor: BF3[s.dstBlend], _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
      duration: s.duration, emissionRate: s.emissionRate, life: s.life, lifeVar: s.lifeVar, angle: s.angle, angleVar: s.angleVar,
      startSize: s.startSize, startSizeVar: s.startSizeVar, endSize: s.endSize, endSizeVar: s.endSizeVar,
      startSpin: s.startSpin, startSpinVar: s.startSpinVar, endSpin: s.endSpin, endSpinVar: s.endSpinVar,
      sourcePos: v2(s.sourcePos.x, s.sourcePos.y), posVar: v2(s.posVar.x, s.posVar.y), emitterMode: s.emitterMode, gravity: v2(s.gravity.x, s.gravity.y),
      speed: s.speed, speedVar: s.speedVar, tangentialAccel: s.tangentialAccel, tangentialAccelVar: s.tangentialAccelVar, radialAccel: s.radialAccel, radialAccelVar: s.radialAccelVar,
      rotationIsDir: !!s.rotationIsDir, startRadius: s.startRadius, startRadiusVar: s.startRadiusVar, endRadius: s.endRadius, endRadiusVar: s.endRadiusVar,
      rotatePerS: s.rotatePerS, rotatePerSVar: s.rotatePerSVar, playOnLoad: true, autoRemoveOnFinish: !!s.autoRemoveOnFinish, _preview: true, preview: true, _custom: true, _file: null,
      _spriteFrame: sf3(img), _totalParticles: s.totalParticles,
      _startColor: col(s.startColor), _startColorVar: col(s.startColorVar), _endColor: col(s.endColor), _endColorVar: col(s.endColorVar), _positionType: s.positionType, _id: ''
    };
  }
  function prefab3(pf, get) {
    const out = [{ __type__: 'cc.Prefab', _name: pf.name, _objFlags: 0, _native: '', data: { __id__: 1 }, optimizationPolicy: 0, persistent: false, asyncLoadAssets: false }];
    const node3 = (name, parent, x, y, t = {}) => { const hr = (t.rot || 0) * Math.PI / 360; const o = { __type__: 'cc.Node', _name: name, _objFlags: 0 }; if (!parent) o.__editorExtras__ = {};
      return Object.assign(o, { _parent: parent, _children: [], _active: true, _components: [], _prefab: null, _lpos: v3(x, y, 0), _lrot: { __type__: 'cc.Quat', x: 0, y: 0, z: Math.sin(hr), w: Math.cos(hr) }, _lscale: v3(t.sx || 1, t.sy || 1, 1), _layer: 33554432, _euler: v3(0, 0, t.rot || 0), _id: '' }); };
    // thêm component + CompPrefabInfo ngay sau
    const addComp = (nd, make) => { const cid = out.length; nd._components.push({ __id__: cid }); out.push(make(cid + 1)); out.push({ __type__: 'cc.CompPrefabInfo', fileId: fileId() }); };
    const ui = (nid, w, h) => pid => ({ __type__: 'cc.UITransform', _name: '', _objFlags: 0, node: { __id__: nid }, _enabled: true, __prefab: { __id__: pid }, _contentSize: { __type__: 'cc.Size', width: w, height: h }, _anchorPoint: v2(0.5, 0.5), _id: '' });
    const anim = (nid, clip) => pid => { const r = { __uuid__: clip.uuid, __expectedType__: 'cc.AnimationClip' }; return { __type__: 'cc.Animation', _name: '', _objFlags: 0, node: { __id__: nid }, _enabled: true, __prefab: { __id__: pid }, playOnLoad: true, _clips: [r], _defaultClip: r, _id: '' }; };
    const info = () => ({ __type__: 'cc.PrefabInfo', root: { __id__: 1 }, asset: { __id__: 0 }, fileId: fileId() });
    const root = node3(pf.name, null, 0, 0, pf); out.push(root);
    const seq = pf.kind === 'particle' && get(pf.seqAnim), ems = pf.nodes.filter(n => n.type === 'emitter');
    for (const n of pf.nodes) {
      const id = out.length; let img = get(n.image);
      const nd = node3(n.name, { __id__: 1 }, n.x, n.y, n); out.push(nd); root._children.push({ __id__: id });
      if (n.type === 'emitter') {
        if (seq) img = seqFrames(seq, ems.indexOf(n), ems.length, get)[0] || img;
        addComp(nd, ui(id, 100, 100)); addComp(nd, pid => ps3(n, id, pid, img));
      } else {
        const an = get(n.anim); if (an) img = get(an.frames[0]) || img;
        const t = img ? trimOf(img) : { w: 100, h: 100 };
        addComp(nd, ui(id, t.w, t.h));
        addComp(nd, pid => ({
          __type__: 'cc.Sprite', _name: '', _objFlags: 0, node: { __id__: id }, _enabled: true, __prefab: { __id__: pid }, _customMaterial: null,
          _srcBlendFactor: BF3[n.srcBlend], _dstBlendFactor: BF3[n.dstBlend], _color: { __type__: 'cc.Color', r: 255, g: 255, b: 255, a: 255 },
          _spriteFrame: sf3(img), _type: 0, _fillType: 0, _sizeMode: 1, _fillCenter: v2(0, 0), _fillStart: 0, _fillRange: 0, _isTrimmedMode: true, _useGrayscale: false, _atlas: null, _id: ''
        }));
        if (an) addComp(nd, anim(id, an));
      }
      nd._prefab = { __id__: out.length }; out.push(info());
    }
    addComp(root, ui(1, 100, 100));
    if (seq) addComp(root, anim(1, seq));
    root._prefab = { __id__: out.length }; out.push(info());
    return out;
  }
  function clip3(anim, prefabs, get) {
    const u = clipUsers(anim, prefabs), n = anim.frames.map(get).filter(Boolean).length, times = clipTimes(anim, n);
    const head = { __type__: 'cc.AnimationClip', _name: anim.name, _objFlags: 0, __editorExtras__: { embeddedPlayerGroups: [] }, _native: '', sample: anim.sample, speed: 1, wrapMode: 2, enableTrsBlending: false,
      _duration: n ? (n - 1) / anim.sample : 0, _hash: Math.random() * 2147483647 | 0, _tracks: [], _exoticAnimation: null, _events: [], _embeddedPlayers: [] };
    const out = [head];
    const track = (hier, comp, frames) => {
      const t = out.length; head._tracks.push({ __id__: t });
      const paths = []; out.push(null, null);                       // t: track, t+1: trackPath
      if (hier) { paths.push({ __id__: out.length }); out.push({ __type__: 'cc.animation.HierarchyPath', path: hier }); }
      paths.push({ __id__: out.length }); out.push({ __type__: 'cc.animation.ComponentPath', component: comp });
      paths.push('spriteFrame');
      const ch = out.length; out.push({ __type__: 'cc.animation.Channel', _curve: { __id__: ch + 1 } });
      out.push({ __type__: 'cc.ObjectCurve', _times: times, _values: frames.map(sf3) });
      out[t] = { __type__: 'cc.animation.ObjectTrack', _binding: { __type__: 'cc.animation.TrackBinding', path: { __id__: t + 1 } }, _channel: { __id__: ch } };
      out[t + 1] = { __type__: 'cc.animation.TrackPath', _paths: paths };
    };
    if (u.onNode) track(null, 'cc.Sprite', seqFrames(anim, 0, 1, get));
    for (const p of u.paths) track(p.name, 'cc.ParticleSystem2D', seqFrames(anim, p.idx, p.count, get));
    return out;
  }
  function imgMeta3(a) {
    const t = trimOf(a), hw = t.w / 2, hh = t.h / 2, id = a.uuid;
    return {
      ver: '1.0.25', importer: 'image', imported: true, uuid: id, files: ['.json', '.' + a.ext],
      subMetas: {
        '6c48a': { importer: 'texture', uuid: id + '@6c48a', displayName: a.name, id: '6c48a', name: 'texture',
          userData: { wrapModeS: 'clamp-to-edge', wrapModeT: 'clamp-to-edge', imageUuidOrDatabaseUri: id, isUuid: true, visible: false, minfilter: 'linear', magfilter: 'linear', mipfilter: 'none', anisotropy: 0 },
          ver: '1.0.22', imported: true, files: ['.json'], subMetas: {} },
        'f9941': { importer: 'sprite-frame', uuid: id + '@f9941', displayName: a.name, id: 'f9941', name: 'spriteFrame',
          userData: { trimType: 'custom', trimThreshold: 0, rotated: false, offsetX: t.x + t.w / 2 - a.w / 2, offsetY: a.h / 2 - (t.y + t.h / 2), trimX: t.x, trimY: t.y, width: t.w, height: t.h, rawWidth: a.w, rawHeight: a.h,
            borderTop: 0, borderBottom: 0, borderLeft: 0, borderRight: 0, packable: true, pixelsToUnit: 100, pivotX: 0.5, pivotY: 0.5, meshType: 0,
            vertices: { rawPosition: [-hw, -hh, 0, hw, -hh, 0, -hw, hh, 0, hw, hh, 0], indexes: [0, 1, 2, 2, 1, 3],
              uv: [t.x, t.y + t.h, t.x + t.w, t.y + t.h, t.x, t.y, t.x + t.w, t.y],
              nuv: [t.x / a.w, (a.h - t.y - t.h) / a.h, (t.x + t.w) / a.w, (a.h - t.y - t.h) / a.h, t.x / a.w, (a.h - t.y) / a.h, (t.x + t.w) / a.w, (a.h - t.y) / a.h],
              minPos: [-hw, -hh, 0], maxPos: [hw, hh, 0] },
            isUuid: true, imageUuidOrDatabaseUri: id + '@6c48a', atlasUuid: '' },
          ver: '1.0.11', imported: true, files: ['.json'], subMetas: {} }
      },
      userData: { type: 'sprite-frame', fixAlphaTransparencyArtifacts: true, hasAlpha: true, redirect: id + '@f9941' }
    };
  }

  // ================= zip =================
  function dataToBytes(d) { const b = atob(d.split(',')[1]), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  // folder: node thư mục cần xuất; ver: '213' | '363'; all: mọi asset trong project
  function build(folder, ver, all) {
    const zip = new JSZip(), v3x = ver === '363', byId = new Map(all.map(a => [a.id, a])), get = id => id ? byId.get(id) : null;
    const prefabs = all.filter(a => a.type === 'prefab'), inside = new Set(), warn = [];
    (function mark(f) { inside.add(f.id); (f.children || []).forEach(mark); })(folder);
    const meta = (path, o) => zip.file(path + '.meta', J(o) + (v3x ? '\n' : ''));
    const walk = (f, path) => {
      zip.folder(path);
      meta(path, v3x ? { ver: '1.1.0', importer: 'directory', imported: true, uuid: f.uuid, files: [], subMetas: {}, userData: { compressionType: {}, isRemoteBundle: {} } }
        : { ver: '1.0.1', uuid: f.uuid, isSubpackage: false, subpackageName: '', subMetas: {} });
      for (const a of f.children) {
        const p = path + '/' + a.name;
        if (a.type === 'folder') walk(a, p);
        else if (a.type === 'image') { zip.file(p + '.' + a.ext, dataToBytes(a.data)); meta(p + '.' + a.ext, v3x ? imgMeta3(a) : imgMeta2(a)); }
        else if (a.type === 'anim') {
          zip.file(p + '.anim', J(v3x ? clip3(a, prefabs, get) : clip2(a, prefabs, get)));
          meta(p + '.anim', v3x ? { ver: '2.0.3', importer: 'animation-clip', imported: true, uuid: a.uuid, files: ['.cconb'], subMetas: {}, userData: { name: a.name } } : { ver: '2.1.0', uuid: a.uuid, subMetas: {} });
        } else if (a.type === 'prefab') {
          zip.file(p + '.prefab', J(v3x ? prefab3(a, get) : prefab2(a, get)));
          meta(p + '.prefab', v3x ? { ver: '1.1.40', importer: 'prefab', imported: true, uuid: a.uuid, files: ['.json'], subMetas: {}, userData: { syncNodeName: a.name } }
            : { ver: '1.2.1', uuid: a.uuid, optimizationPolicy: 'AUTO', asyncLoadAssets: false, readonly: false, subMetas: {} });
          const refs = [a.seqAnim, ...a.nodes.flatMap(n => [n.image, n.anim])].filter(Boolean);
          for (const r of refs) { const t = get(r); if (!t) continue; for (const x of (t.type === 'anim' ? [t.id, ...t.frames] : [t.id])) if (!inside.has(x) && get(x)) warn.push(`${a.name} dùng "${get(x).name}" nằm ngoài folder xuất`); }
        }
      }
    };
    walk(folder, folder.name);
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(blob => ({ blob, name: `${folder.name}_${ver}.zip`, warn: [...new Set(warn)] }));
  }
  M.exporter = { build, prefab2, prefab3, clip2, clip3 };
})(window.M = window.M || {});
