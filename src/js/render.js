// WebGL: vẽ hạt và sprite với đúng blend factor như Cocos
(function (M) {
  const GLB = { ZERO: 0, ONE: 1, SRC_COLOR: 768, ONE_MINUS_SRC_COLOR: 769, SRC_ALPHA: 770, ONE_MINUS_SRC_ALPHA: 771, DST_ALPHA: 772, ONE_MINUS_DST_ALPHA: 773, DST_COLOR: 774, ONE_MINUS_DST_COLOR: 775 };
  const MAXQ = 4096;
  class Renderer {
    constructor(canvas) {
      const gl = this.gl = canvas.getContext('webgl', { alpha: false, antialias: true, premultipliedAlpha: false });
      this.canvas = canvas;
      const vs = 'attribute vec2 p;attribute vec2 t;attribute vec4 c;uniform vec4 v;uniform vec2 sz;varying vec2 vt;varying vec4 vc;void main(){vt=t;vc=c;float sx=v.x+p.x*v.z;float sy=v.y-p.y*v.z;gl_Position=vec4(sx/sz.x*2.0-1.0,1.0-sy/sz.y*2.0,0.0,1.0);}';
      const fs = 'precision mediump float;uniform sampler2D s;varying vec2 vt;varying vec4 vc;void main(){gl_FragColor=texture2D(s,vt)*vc;}';
      const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const pr = this.prog = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(pr); gl.useProgram(pr);
      this.buf = gl.createBuffer(); this.data = new Float32Array(MAXQ * 6 * 8); this.n = 0;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buf);
      const loc = n => gl.getAttribLocation(pr, n);
      [['p', 2, 0], ['t', 2, 2], ['c', 4, 4]].forEach(([n, s, o]) => { gl.enableVertexAttribArray(loc(n)); gl.vertexAttribPointer(loc(n), s, gl.FLOAT, false, 32, o * 4); });
      this.uv = gl.getUniformLocation(pr, 'v'); this.usz = gl.getUniformLocation(pr, 'sz');
      gl.enable(gl.BLEND);
      this.tex = new Map();
    }
    texture(asset) {
      const gl = this.gl; let t = this.tex.get(asset.id);
      if (t && t.src === asset.data) return t.tex;
      const img = M.imgOf(asset); if (!img || !img.complete || !img.naturalWidth) return null;
      if (t) gl.deleteTexture(t.tex);
      const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.tex.set(asset.id, { tex, src: asset.data }); return tex;
    }
    begin(view, bg) {
      const gl = this.gl, c = this.canvas, dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.round(c.clientWidth * dpr)), h = Math.max(1, Math.round(c.clientHeight * dpr));
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      gl.viewport(0, 0, w, h); gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform4f(this.uv, c.clientWidth / 2 + view.x, c.clientHeight / 2 + view.y, view.z, 0);
      gl.uniform2f(this.usz, c.clientWidth, c.clientHeight);
    }
    batch(asset, src, dst) {
      this.flush(); const gl = this.gl; this.cur = asset ? this.texture(asset) : null;
      if (this.cur) { gl.bindTexture(gl.TEXTURE_2D, this.cur); gl.blendFunc(GLB[src] ?? 770, GLB[dst] ?? 771); }
      this.tr = (asset && asset.trim) || { x: 0, y: 0, w: asset ? asset.w : 1, h: asset ? asset.h : 1 };
      this.aw = asset ? asset.w : 1; this.ah = asset ? asset.h : 1;
    }
    // quad tâm (x,y) world, rộng w cao h, xoay rotDeg theo chiều kim đồng hồ (như Cocos), màu 0..255
    quad(x, y, w, h, rotDeg, col) {
      if (!this.cur) return; if (this.n >= MAXQ) this.flush();
      const r = -rotDeg * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r), hw = w / 2, hh = h / 2, t = this.tr;
      const u0 = t.x / this.aw, u1 = (t.x + t.w) / this.aw, v0 = t.y / this.ah, v1 = (t.y + t.h) / this.ah;
      const P = [[-hw, -hh, u0, v1], [hw, -hh, u1, v1], [-hw, hh, u0, v0], [hw, hh, u1, v0]];
      const d = this.data; let o = this.n * 48;
      for (const i of [0, 1, 2, 2, 1, 3]) {
        const q = P[i];
        d[o++] = x + q[0] * cs - q[1] * sn; d[o++] = y + q[0] * sn + q[1] * cs; d[o++] = q[2]; d[o++] = q[3];
        d[o++] = col[0] / 255; d[o++] = col[1] / 255; d[o++] = col[2] / 255; d[o++] = col[3] / 255;
      }
      this.n++;
    }
    flush() { if (!this.n) return; const gl = this.gl; gl.bufferData(gl.ARRAY_BUFFER, this.data.subarray(0, this.n * 48), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, this.n * 6); this.n = 0; }
    end() { this.flush(); }
  }
  M.Renderer = Renderer; M.GLB = GLB;
})(window.M = window.M || {});
