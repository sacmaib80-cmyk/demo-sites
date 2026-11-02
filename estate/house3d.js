/* house3d.js — บ้าน 3D ขนาดจริงตามแบบแปลน (หน่วยเมตร) ข้อมูลผนัง/ห้อง/เฟอร์นิเจอร์มาจาก house-data.js ชุดเดียวกับแปลน
   ที่ทำให้ดูเหมือนภาพถ่าย ไม่ใช่ภาพเกม: เรนเดอร์ซ้ำหลายรอบแล้วเฉลี่ย รอบละ 1 ตัวอย่างของ
   ดวงอาทิตย์ (เงานุ่ม) · ฟ้า (เงาตามซอก) · ไฟ/ช่องแสงในบ้าน (แสงนุ่มจากหน้าต่าง) · เลนส์ · พิกเซล (ขอบเนียน)
   ระหว่างขยับใช้ภาพเร็ว 1 รอบ พอหยุดภาพค่อยๆ ละเอียดขึ้น แล้ว GPU หยุดทำงานจนกว่าจะขยับอีก
   ทิศ: +x ตะวันตก · -x ตะวันออก · +z เหนือ (ด้านระเบียง) เช้าแดดมาจากด้าน -x บ่ายจากด้าน +x */
import * as THREE from './vendor/three.module.min.js';

const HD = window.HOUSE;
const F1 = HD.floorY[1], F2 = HD.floorY[2], H1 = HD.wallH[1], H2 = HD.wallH[2], SLAB2 = F1 + H1, ROOF = F2 + H2;
const WATER_Y = -0.09;

function lin(hex) { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; }
const PAL = {
  ivory: lin('#c9bfad'), sand: lin('#ab9a80'), clay: lin('#8f5d41'), char: lin('#37332e'), ink: lin('#26241f'),
  walnut: lin('#6f4a33'), oak: lin('#b9925f'), teak: lin('#94643a'), bronze: lin('#2f261e'), white: lin('#d8d3c9'), brass: lin('#a98a58'),
  sage: lin('#7d8467'), stone: lin('#c9bfae'),
};

// ---------- สร้างเรขาคณิต ----------
class Batch {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  vert(px, py, pz, nx, ny, nz, u, v, col) {
    this.p.push(px, py, pz); this.n.push(nx, ny, nz); this.uv.push(u, v); this.c.push(col[0], col[1], col[2]);
    return this.p.length / 3 - 1;
  }
  tri(a, b, c) {
    const P = this.p, N = this.n;
    const ux = P[b * 3] - P[a * 3], uy = P[b * 3 + 1] - P[a * 3 + 1], uz = P[b * 3 + 2] - P[a * 3 + 2];
    const vx = P[c * 3] - P[a * 3], vy = P[c * 3 + 1] - P[a * 3 + 1], vz = P[c * 3 + 2] - P[a * 3 + 2];
    const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
    const sx = N[a * 3] + N[b * 3] + N[c * 3], sy = N[a * 3 + 1] + N[b * 3 + 1] + N[c * 3 + 1], sz = N[a * 3 + 2] + N[b * 3 + 2] + N[c * 3 + 2];
    if (gx * sx + gy * sy + gz * sz < 0) this.i.push(a, c, b); else this.i.push(a, b, c);
  }
  // กล่องลบมุมนิดเดียว: ของจริงไม่มีขอบคมเฉียบ ขอบที่รับแสงทำให้ดูเป็นวัสดุจริง
  box(x0, y0, z0, x1, y1, z1, opt) {
    opt = opt || {};
    const bevel = opt.bevel == null ? 0.012 : opt.bevel;
    const tint = opt.tint == null ? 1 + (Math.random() - 0.5) * 0.03 : opt.tint;
    const col = opt.color ? [opt.color[0] * tint, opt.color[1] * tint, opt.color[2] * tint] : [tint, tint, tint];
    const uvS = opt.uv || 0.18, uo = opt.fixUv ? 0 : Math.random(), vo = opt.fixUv ? 0 : Math.random();
    const a = [Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1)], b = [Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1)];
    const size = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const c = size.map((s) => Math.min(bevel, s * 0.45));
    const idx = {};
    for (let sx = 0; sx < 2; sx++) for (let sy = 0; sy < 2; sy++) for (let sz = 0; sz < 2; sz++) {
      const s = [sx, sy, sz];
      for (let ax = 0; ax < 3; ax++) {
        const pos = [0, 1, 2].map((k) => {
          const side = s[k] ? b[k] : a[k];
          if (k === ax) return side;
          return side + (s[k] ? -c[k] : c[k]);
        });
        const nor = [0, 0, 0]; nor[ax] = s[ax] ? 1 : -1;
        const u = ax === 0 ? pos[2] : pos[0], v = ax === 1 ? pos[2] : pos[1];
        idx[sx + '' + sy + '' + sz + ax] = this.vert(pos[0], pos[1], pos[2], nor[0], nor[1], nor[2], u * uvS + uo, v * uvS + vo, col);
      }
    }
    const V = (s, ax) => idx[s[0] + '' + s[1] + '' + s[2] + ax];
    for (let ax = 0; ax < 3; ax++) for (let side = 0; side < 2; side++) {
      const k1 = (ax + 1) % 3, k2 = (ax + 2) % 3;
      const cs = [[0, 0], [1, 0], [1, 1], [0, 1]].map((q) => { const s = [0, 0, 0]; s[ax] = side; s[k1] = q[0]; s[k2] = q[1]; return V(s, ax); });
      this.tri(cs[0], cs[1], cs[2]); this.tri(cs[0], cs[2], cs[3]);
    }
    if (bevel > 0) {
      for (let ax = 0; ax < 3; ax++) {
        const k1 = (ax + 1) % 3, k2 = (ax + 2) % 3;
        for (let s1 = 0; s1 < 2; s1++) for (let s2 = 0; s2 < 2; s2++) {
          const c0 = [0, 0, 0], c1 = [0, 0, 0];
          c0[ax] = 0; c1[ax] = 1; c0[k1] = c1[k1] = s1; c0[k2] = c1[k2] = s2;
          const q = [V(c0, k1), V(c1, k1), V(c1, k2), V(c0, k2)];
          this.tri(q[0], q[1], q[2]); this.tri(q[0], q[2], q[3]);
        }
      }
      for (let sx = 0; sx < 2; sx++) for (let sy = 0; sy < 2; sy++) for (let sz = 0; sz < 2; sz++) this.tri(V([sx, sy, sz], 0), V([sx, sy, sz], 1), V([sx, sy, sz], 2));
    }
    return this;
  }
  // กล่องขอบมนสำหรับเบาะ หมอน ที่นอน อ่างอาบน้ำ
  soft(x0, y0, z0, x1, y1, z1, r, col, uvS, puff) {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
    const sx = bx - ax, sy = by - ay, sz = bz - az, cx = (ax + bx) / 2, cy = (ay + by) / 2, cz = (az + bz) / 2;
    const rr = Math.min(r, sx / 2, sy / 2, sz / 2) * 0.999;
    const g = new THREE.BoxGeometry(sx, sy, sz, 6, 6, 6);
    const P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv;
    const map = (v, s) => { const t = Math.abs(v) / (s / 2), g2 = Math.sign(v); if (t > 0.99) return g2 * s / 2; if (t > 0.6) return g2 * (s / 2 - rr * 0.35); if (t > 0.3) return g2 * (s / 2 - rr); return 0; };
    const cl = (v, s) => Math.max(-s / 2 + rr, Math.min(s / 2 - rr, v));
    const S = uvS || 2.4, tint = 1 + (Math.random() - 0.5) * 0.04, c2 = [col[0] * tint, col[1] * tint, col[2] * tint];
    const start = this.p.length / 3;
    for (let k = 0; k < P.count; k++) {
      const x = map(P.getX(k), sx), y = map(P.getY(k), sy), z = map(P.getZ(k), sz);
      const ix = cl(x, sx), iy = cl(y, sy), iz = cl(z, sz);
      let dx = x - ix, dy = y - iy, dz = z - iz; const l = Math.hypot(dx, dy, dz);
      let nx = N.getX(k), ny = N.getY(k), nz = N.getZ(k);
      if (l > 1e-5) { nx = dx / l; ny = dy / l; nz = dz / l; }
      const px = l > 1e-5 ? ix + nx * rr : x, pz = l > 1e-5 ? iz + nz * rr : z; let py = l > 1e-5 ? iy + ny * rr : y;
      if (puff && y > 0) py += puff * (1 - Math.pow(x / (sx / 2), 2)) * (1 - Math.pow(z / (sz / 2), 2));
      const wx = cx + px, wy = cy + py, wz = cz + pz;
      const u = Math.abs(ny) > 0.7 ? wx : Math.abs(nx) > 0.7 ? wz : wx, v = Math.abs(ny) > 0.7 ? wz : wy;
      this.vert(wx, wy, wz, nx, ny, nz, u * S, v * S, c2);
    }
    void U;
    const I = g.index; for (let k = 0; k < I.count; k++) this.i.push(start + I.getX(k));
    return this;
  }
  geometry(geo, matrix, color, uvS) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.normal) g.computeVertexNormals();
    const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv;
    const start = this.p.length / 3, col = color || [1, 1, 1], s = uvS || 0.18;
    for (let k = 0; k < pos.count; k++) {
      this.vert(pos.getX(k), pos.getY(k), pos.getZ(k), nor.getX(k), nor.getY(k), nor.getZ(k), uv ? uv.getX(k) * s : 0, uv ? uv.getY(k) * s : 0, col);
      this.i.push(start + k);
    }
    return this;
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    return g;
  }
}

// ---------- เท็กซ์เจอร์ปั้นในโค้ด ไม่ต้องโหลดไฟล์ ----------
function cv(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h || w; return [c, c.getContext('2d')]; }
function speckle(x, size, spread) {
  const d = x.getImageData(0, 0, size, size);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * spread;
    d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
  }
  x.putImageData(d, 0, 0);
}
function plasterTex() {
  const [c, x] = cv(512); x.fillStyle = '#e6dfd2'; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 220; i++) {
    const px = Math.random() * 512, py = Math.random() * 512, r = 18 + Math.random() * 70;
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    const dark = Math.random() < 0.5;
    g.addColorStop(0, dark ? 'rgba(120,105,85,.035)' : 'rgba(255,255,250,.05)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  speckle(x, 512, 7);
  return c;
}
function grainTex() {
  const s = 512; const [c, x] = cv(s); x.fillStyle = '#f2e9db'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 1500; i++) {
    const px = Math.random() * s, w = 0.4 + Math.random() * 1.8, t = Math.random();
    x.strokeStyle = t < 0.62 ? 'rgba(92,60,30,' + (0.04 + Math.random() * 0.15) + ')' : 'rgba(255,245,225,' + (0.05 + Math.random() * 0.14) + ')';
    x.lineWidth = w;
    x.beginPath(); x.moveTo(px, 0);
    x.bezierCurveTo(px + (Math.random() - 0.5) * 9, s * 0.33, px + (Math.random() - 0.5) * 9, s * 0.66, px, s);
    x.stroke();
  }
  return c;
}
function oakFloorTex() {
  const s = 1024, rows = 22, rh = s / rows; const [c, x] = cv(s);
  for (let r = 0; r < rows; r++) {
    let at = -Math.random() * 400;
    while (at < s) {
      const len = 340 + Math.random() * 380, v = Math.random();
      x.fillStyle = 'rgb(' + Math.round(132 + v * 24) + ',' + Math.round(96 + v * 20) + ',' + Math.round(62 + v * 16) + ')';
      x.fillRect(at, r * rh, len, rh);
      for (let k = 0; k < 26; k++) {
        const yy = r * rh + Math.random() * rh;
        x.strokeStyle = Math.random() < 0.66 ? 'rgba(84,54,26,' + (0.03 + Math.random() * 0.1) + ')' : 'rgba(255,238,205,' + (0.03 + Math.random() * 0.09) + ')';
        x.lineWidth = 0.5 + Math.random();
        x.beginPath(); x.moveTo(at, yy); x.bezierCurveTo(at + len * 0.3, yy + (Math.random() - 0.5) * 5, at + len * 0.6, yy + (Math.random() - 0.5) * 5, at + len, yy); x.stroke();
      }
      x.fillStyle = 'rgba(45,28,14,.55)'; x.fillRect(at, r * rh, 1.3, rh);
      at += len;
    }
    x.fillStyle = 'rgba(45,28,14,.5)'; x.fillRect(0, r * rh, s, 1.2);
  }
  return c;
}
function travertineTex() {
  const s = 1024; const [c, x] = cv(s); x.fillStyle = '#c2b49c'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 700; i++) {
    const yy = Math.random() * s, xx = Math.random() * s, l = 60 + Math.random() * 420;
    x.strokeStyle = Math.random() < 0.55 ? 'rgba(150,128,98,' + (0.03 + Math.random() * 0.1) + ')' : 'rgba(250,244,230,' + (0.04 + Math.random() * 0.12) + ')';
    x.lineWidth = 0.6 + Math.random() * 2.6;
    x.beginPath(); x.moveTo(xx, yy); x.quadraticCurveTo(xx + l / 2, yy + (Math.random() - 0.5) * 7, xx + l, yy + (Math.random() - 0.5) * 3); x.stroke();
  }
  x.fillStyle = 'rgba(92,76,56,.5)';
  for (let i = 0; i < 520; i++) { x.fillRect(Math.random() * s, Math.random() * s, 1 + Math.random() * 5, 0.8 + Math.random() * 1.2); }
  speckle(x, s, 7);
  x.fillStyle = 'rgba(80,66,50,.3)';
  for (let r = 0; r < 4; r++) { x.fillRect(0, r * 256 - 1, s, 2.2); for (let k = 0; k < 2; k++) x.fillRect(((k + (r % 2) * 0.5) * 512) % s, r * 256, 2.2, 256); }
  return c;
}
function marbleTex() {
  const s = 1024; const [c, x] = cv(s); x.fillStyle = '#e9e5de'; x.fillRect(0, 0, s, s);
  x.lineCap = 'round';
  const walk = (px, py, a, steps, w, al) => {
    x.strokeStyle = 'rgba(92,88,84,' + al + ')'; x.lineWidth = w;
    x.beginPath(); x.moveTo(px, py);
    for (let i = 0; i < steps; i++) {
      a += (Math.random() - 0.5) * 0.7; px += Math.cos(a) * 26; py += Math.sin(a) * 26; x.lineTo(px, py);
      if (Math.random() < 0.09 && w > 0.7) { walk(px, py, a + (Math.random() - 0.5) * 1.8, steps * 0.45, w * 0.55, al * 0.75); x.strokeStyle = 'rgba(92,88,84,' + al + ')'; x.lineWidth = w; x.beginPath(); x.moveTo(px, py); }
    }
    x.stroke();
  };
  for (let i = 0; i < 9; i++) { x.filter = 'blur(5px)'; walk(Math.random() * s, Math.random() * s, 0.8 + Math.random(), 40, 12, 0.08); }
  x.filter = 'blur(0.6px)';
  for (let i = 0; i < 11; i++) walk(Math.random() * s, Math.random() * s, 0.7 + Math.random() * 1.2, 34, 2.4, 0.42);
  x.filter = 'none';
  return c;
}
function weaveTex() {
  const s = 256; const [c, x] = cv(s); x.fillStyle = '#efeadf'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < s; i += 2) {
    x.fillStyle = 'rgba(120,105,85,' + (0.05 + Math.random() * 0.1) + ')'; x.fillRect(i, 0, 1, s);
    x.fillStyle = 'rgba(255,255,250,' + (0.04 + Math.random() * 0.12) + ')'; x.fillRect(0, i, s, 1);
  }
  speckle(x, s, 10);
  return c;
}
function rugTex() {
  const s = 512; const [c, x] = cv(s); x.fillStyle = '#92866f'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 9000; i++) {
    x.strokeStyle = Math.random() < 0.5 ? 'rgba(90,76,60,.13)' : 'rgba(240,232,216,.16)'; x.lineWidth = 1;
    const px = Math.random() * s, py = Math.random() * s, a = Math.random() * 6.28;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * 5, py + Math.sin(a) * 5); x.stroke();
  }
  return c;
}
function lawnTex() {
  const s = 1024; const [c, x] = cv(s); x.fillStyle = '#3a4623'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 26000; i++) {
    const px = Math.random() * s, py = Math.random() * s, a = -1.57 + (Math.random() - 0.5) * 1.5, l = 3 + Math.random() * 7, t = Math.random();
    x.strokeStyle = t < 0.45 ? 'rgba(24,36,14,.3)' : t < 0.82 ? 'rgba(112,128,60,.24)' : 'rgba(176,170,96,.18)';
    x.lineWidth = 0.7; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  return c;
}
// ภาพเขียนบนผนัง: หมึกซึมบนผ้าใบ โทนเดียวกับบ้าน
function artTex(seed, base, inks) {
  const w = 640, h = 800; const [c, x] = cv(w, h); x.fillStyle = base; x.fillRect(0, 0, w, h);
  let r = seed;
  const R = () => { r = (r * 16807) % 2147483647; return (r - 1) / 2147483646; };
  x.filter = 'blur(14px)';
  inks.forEach((k, i) => {
    x.fillStyle = k; x.beginPath();
    const y0 = h * (0.3 + i * 0.22 + R() * 0.08);
    x.moveTo(-20, y0);
    for (let px = 0; px <= w + 40; px += 40) x.lineTo(px, y0 + Math.sin(px * 0.009 + R() * 0.8) * 42 + (R() - 0.5) * 22);
    x.lineTo(w + 20, h + 20); x.lineTo(-20, h + 20); x.closePath(); x.fill();
  });
  x.filter = 'none';
  for (let i = 0; i < 2400; i++) {
    x.strokeStyle = (R() < 0.5 ? 'rgba(30,24,18,' : 'rgba(250,244,232,') + (R() * 0.06) + ')';
    x.lineWidth = 0.6 + R() * 2.2;
    const px = R() * w, py = R() * h, l = 10 + R() * 60;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + l, py + (R() - 0.5) * 6); x.stroke();
  }
  return c;
}
// แผ่นช่อใบ: ภาพใบเล็กๆ หลายสิบใบบนแผ่นเดียว ละเอียดกว่าและเบากว่าทำใบทีละใบมาก
function leafCardTex() {
  const s = 512; const [c, x] = cv(s);
  x.clearRect(0, 0, s, s);
  for (let i = 0; i < 230; i++) {
    const a = Math.random() * 6.283, d = Math.pow(Math.random(), 0.7) * s * 0.47, px = s / 2 + Math.cos(a) * d, py = s / 2 + Math.sin(a) * d;
    const l = 12 + Math.random() * 15, w = l * (0.3 + Math.random() * 0.14), rot = Math.random() * 6.283, v = 118 + Math.random() * 137;
    x.save(); x.translate(px, py); x.rotate(rot);
    x.fillStyle = 'rgb(' + Math.round(v) + ',' + Math.round(v) + ',' + Math.round(v * 0.92) + ')';
    x.beginPath(); x.moveTo(-l, 0); x.quadraticCurveTo(0, -w * 1.5, l, 0); x.quadraticCurveTo(0, w * 1.5, -l, 0); x.fill();
    x.restore();
  }
  return c;
}
function soffitTex() {
  const s = 512, n = 8, w = s / n; const [c, x] = cv(s);
  for (let i = 0; i < n; i++) {
    const v = 214 + Math.random() * 41;
    x.fillStyle = 'rgb(' + Math.round(v) + ',' + Math.round(v * 0.96) + ',' + Math.round(v * 0.9) + ')';
    x.fillRect(i * w, 0, w, s);
    for (let k = 0; k < 34; k++) {
      const px = i * w + Math.random() * w;
      x.strokeStyle = Math.random() < 0.6 ? 'rgba(92,60,30,' + (0.04 + Math.random() * 0.12) + ')' : 'rgba(255,245,225,' + (0.04 + Math.random() * 0.1) + ')';
      x.lineWidth = 0.5 + Math.random() * 1.2;
      x.beginPath(); x.moveTo(px, 0); x.bezierCurveTo(px + (Math.random() - 0.5) * 5, s * 0.33, px + (Math.random() - 0.5) * 5, s * 0.66, px, s); x.stroke();
    }
    x.fillStyle = 'rgba(24,12,6,.82)'; x.fillRect(i * w + w - 3, 0, 3, s);
  }
  return c;
}
function makeTex(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- ฉาก ----------
async function buildScene(scene) {
  // แบ่งงานเป็นช่วงสั้นๆ ระหว่างสร้างฉาก คนยังเลื่อนหน้าและกดปุ่มได้
  let last = performance.now();
  const tick = () => { if (performance.now() - last < 14) return null; return new Promise((r) => setTimeout(r, 0)).then(() => { last = performance.now(); }); };
  const T = {};
  for (const j of [['plaster', plasterTex], ['stone', travertineTex], ['oak', oakFloorTex], ['marble', marbleTex], ['grain', grainTex], ['weave', weaveTex], ['rug', rugTex], ['lawn', lawnTex], ['leaf', leafCardTex], ['soffit', soffitTex]]) { T[j[0]] = makeTex(j[1](), true); await tick(); }
  T.leaf.wrapS = T.leaf.wrapT = THREE.ClampToEdgeWrapping;
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ vertexColors: true }, o));
  const grain = T.grain, weave = T.weave;
  const mats = {
    plaster: std({ map: T.plaster, roughness: 0.93 }),
    stone: std({ map: T.stone, roughness: 0.62 }),
    oak: std({ map: T.oak, roughness: 0.42 }),
    marble: std({ map: T.marble, roughness: 0.2 }),
    wood: std({ map: grain, roughness: 0.55 }),
    linen: std({ map: weave, roughness: 0.97 }),
    wool: std({ map: T.rug, roughness: 1 }),
    soffit: std({ map: T.soffit, roughness: 0.6 }),
    paint: std({ roughness: 0.72 }),
    metal: std({ roughness: 0.42, metalness: 0.75 }),
    ceramic: std({ roughness: 0.16 }),
    curtain: std({ map: weave, roughness: 1, side: THREE.DoubleSide }),
    lawn: new THREE.MeshStandardMaterial({ map: T.lawn, roughness: 1, envMapIntensity: 0.35 }),
    leaf: new THREE.MeshStandardMaterial({ map: T.leaf, alphaTest: 0.42, roughness: 0.68, side: THREE.DoubleSide }),
    trunk: std({ roughness: 1 }),
    mirror: new THREE.MeshStandardMaterial({ color: 0xc8ccd0, roughness: 0.05, metalness: 1 }),
    basin: new THREE.MeshStandardMaterial({ color: 0x4a5b5e, roughness: 0.9 }),
    bulb: new THREE.MeshBasicMaterial({ color: 0x000000 }),
    shade: new THREE.MeshStandardMaterial({ color: 0xe9dfca, roughness: 1, emissive: 0xffb872, emissiveIntensity: 0, side: THREE.DoubleSide }),
    glass: new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { tone: { value: new THREE.Color(1, 1, 1) } },
      vertexShader: 'varying vec3 vN; varying vec3 vW; void main(){ vN = mat3(modelMatrix)*normal; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: 'varying vec3 vN; varying vec3 vW; uniform vec3 tone; void main(){ vec3 V = normalize(cameraPosition - vW); float F = 0.04 + 0.96*pow(1.0-abs(dot(normalize(vN),V)),5.0); gl_FragColor = vec4(tone, clamp(F*0.72+0.012,0.0,0.8)); }',
    }),
  };
  mats.lawn.map.repeat.set(1 / 5, 1 / 5);
  mats.lawn.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nfloat lh(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); } float ln(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(lh(i),lh(i+vec2(1,0)),f.x),mix(lh(i+vec2(0,1)),lh(i+vec2(1,1)),f.x),f.y); }');
    sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', '#include <map_fragment>\n  vec2 lw = vMapUv * 5.0; float big = ln(lw*0.11)*0.55 + ln(lw*0.031+3.0)*0.45; diffuseColor.rgb *= 0.74 + big*0.62; diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(1.18,1.08,0.8), smoothstep(0.42,0.7,ln(lw*0.05+7.0))*0.55);');
  };
  const interiorMeshes = [];
  const add = (geo, mat, cast, recv, interior) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast !== false; m.receiveShadow = recv !== false;
    scene.add(m);
    if (interior) interiorMeshes.push(m);
    return m;
  };
  const B = { plaster: new Batch(), stone: new Batch(), oak: new Batch(), marble: new Batch(), wood: new Batch(), linen: new Batch(), wool: new Batch(), paint: new Batch(), metal: new Batch(), ceramic: new Batch(), curtain: new Batch(), glass: new Batch(), bulb: new Batch(), shade: new Batch(), mirror: new Batch(), trunk: new Batch(), soffit: new Batch() };
  const P = { plaster: { uv: 0.16, bevel: 0.004, tint: 1 }, stone: { uv: 0.4167, bevel: 0.006, tint: 1 }, oak: { uv: 0.25, bevel: 0, tint: 1 }, marble: { uv: 0.42, bevel: 0.004, tint: 1 } };
  const wood = (col, bevel) => ({ color: col, uv: 0.8, bevel: bevel == null ? 0.005 : bevel });
  const metal = { color: PAL.bronze, bevel: 0.002, uv: 1, tint: 1 };

  // ---------- ท้องฟ้า ----------
  const skyU = { sunDir: { value: new THREE.Vector3(0, 1, 0) }, zen: { value: new THREE.Color() }, hor: { value: new THREE.Color() }, sunCol: { value: new THREE.Color() }, hill: { value: new THREE.Color() }, cloud: { value: 1 }, sunVis: { value: 1 } };
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, depthTest: false, uniforms: skyU, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
    fragmentShader: `
varying vec3 vD; uniform vec3 sunDir, zen, hor, sunCol, hill; uniform float cloud, sunVis;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(11.3,7.1); a*=0.5; } return s; }
void main(){
  vec3 d = normalize(vD);
  float h = max(d.y,0.0);
  vec3 c = mix(hor, zen, pow(h,0.46));
  float s = max(dot(d,sunDir),0.0);
  c += sunCol*(pow(s,6.0)*0.14 + pow(s,48.0)*0.28)*sunVis;
  c += sunCol*smoothstep(0.99986,0.99995,s)*14.0*sunVis;
  if(d.y>0.005){
    vec2 p = d.xz/(d.y+0.14)*1.2;
    float f = fbm(p*vec2(1.0,2.2)+vec2(3.1,0.7));
    f = smoothstep(0.5,0.82,f)*smoothstep(0.0,0.16,d.y);
    vec3 lit = mix(hor*1.02, sunCol*1.05+hor*0.4, 0.42+0.5*pow(s,3.0));
    c = mix(c, lit, f*cloud);
  }
  float a = atan(d.x,d.z);
  vec2 q = vec2(cos(a),sin(a));
  float h1 = 0.03 + 0.03*fbm(q*2.2+1.7) + 0.007*n2(q*40.0);
  float h2 = 0.014 + 0.024*fbm(q*3.4+6.3) + 0.004*n2(q*90.0);
  c = mix(c, mix(hor,hill,0.42), smoothstep(h1+0.0016,h1,d.y));
  c = mix(c, mix(hor,hill,0.78), smoothstep(h2+0.0012,h2,d.y));
  gl_FragColor = vec4(c,1.0);
}`,
  }));
  sky.frustumCulled = false; sky.renderOrder = -10;
  scene.add(sky);

  // ---------- ที่ดิน ----------
  {
    const R = 700, s = new THREE.Shape();
    s.moveTo(-R, -R); s.lineTo(R, -R); s.lineTo(R, R); s.lineTo(-R, R); s.closePath();
    const h = new THREE.Path(); h.moveTo(3, -11.1); h.lineTo(3, -13.7); h.lineTo(19, -13.7); h.lineTo(19, -11.1); h.closePath();
    s.holes.push(h);
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2);
    add(g, mats.lawn, false, true);
    // อ่างสระ
    const pool = new Batch();
    pool.box(3, -1.5, 11.1, 19, -1.3, 13.7, { bevel: 0 });
    add(pool.build(), mats.basin, false, true);
    [[3, 11.1, 19, 11.12], [3, 13.68, 19, 13.7], [3, 11.1, 3.02, 13.7], [18.98, 11.1, 19, 13.7]].forEach((r) => B.stone.box(r[0], -1.4, r[1], r[2], 0.01, r[3], P.stone));
    // ขอบสระหินกับทางเดินจากระเบียงถึงสระ
    [[2.6, 13.7, 19.4, 14.1], [2.6, 10.1, 19.4, 11.1], [2.6, 11.1, 3, 13.7], [19, 11.1, 19.4, 13.7]].forEach((r) => B.stone.box(r[0], 0, r[1], r[2], 0.05, r[3], P.stone));
    [[-0.1, 10.1, 2.6, 11.1], [19.4, 10.1, 24.1, 11.1]].forEach((r) => B.stone.box(r[0], 0, r[1], r[2], 0.05, r[3], P.stone));
    B.stone.box(-0.1, 0.05, 10.05, 24.1, 0.13, 10.55, P.stone);
    for (let k = 0; k < 16; k++) {
      const t = k / 15, px = 11 + t * 7 + Math.sin(t * 3) * 3.5, pz = 14.9 + t * 24;
      B.stone.box(px - 0.75, -0.02, pz - 0.36, px + 0.75, 0.035, pz + 0.36, P.stone);
    }
  }

  // ---------- พื้น ----------
  B.plaster.box(-0.1, 0, -0.1, 24.1, F1 - 0.03, 10.1, P.plaster);
  const hole = { x0: HD.stair.holeX0, x1: HD.stair.holeX1, z0: HD.stair.zTop, z1: HD.stair.zBottom };
  [1, 2].forEach((lv) => {
    const y = HD.floorY[lv];
    HD.rooms[lv].forEach((r) => {
      const put = (x0, z0, x1, z1) => {
        if (r.ext) B.stone.box(x0, y - 0.04, z0, x1, y, z1, P.stone);
        else if (r.floor === 'marble') B.marble.box(x0, y - 0.04, z0, x1, y, z1, P.marble);
        else B.oak.box(x0, y - 0.04, z0, x1, y, z1, P.oak);
      };
      if (r.id === 'hall') { put(r.x, r.z, hole.x0, r.z + r.d); put(hole.x0, r.z, r.x + r.w, hole.z0); put(hole.x0, hole.z1, r.x + r.w, r.z + r.d); }
      else put(r.x, r.z, r.x + r.w, r.z + r.d);
    });
  });
  // พื้นชั้นสอง/ฝ้าชั้นล่าง: แผ่นเดียวยื่นคลุมระเบียง เจาะช่องบันได
  const slab = { x0: -0.9, x1: 24.9, z0: -0.9, z1: 10.4, y0: SLAB2, y1: F2 - 0.04 };
  [[slab.x0, slab.z0, hole.x0, slab.z1], [hole.x1, slab.z0, slab.x1, slab.z1], [hole.x0, slab.z0, hole.x1, hole.z0], [hole.x0, hole.z1, hole.x1, slab.z1]].forEach((r) => B.plaster.box(r[0], slab.y0, r[1], r[2], slab.y1, r[3], P.plaster));
  // หลังคาบนสุด แผ่นบางยื่นลึก
  B.plaster.box(-1.2, ROOF, -1.6, 24.6, ROOF + 0.24, 10.6, Object.assign({}, P.plaster, { bevel: 0.01 }));
  // ฝ้าไม้สักใต้ชายคา: เงาจากแผ่นนี้กับสีไม้คือของที่ทำให้บ้านดูแพง
  const soffit = (x0, x1, z0, z1, y) => B.soffit.box(x0, y - 0.03, z0, x1, y, z1, { color: PAL.teak, uv: 1 / 1.12, bevel: 0, tint: 1 });
  soffit(-0.9, 24.9, 7.16, 10.4, SLAB2);
  soffit(-1.2, 24.6, 7.16, 10.6, ROOF);

  await tick();
  // ---------- ผนังและช่องเปิด ----------
  const curtains = [], openings = { 1: [], 2: [] };
  const curtain = (x0, x1, z, y0, y1) => {
    const w = x1 - x0, h = y1 - y0, g = new THREE.PlaneGeometry(w, h, Math.ceil(w / 0.022), 1);
    const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
    const ph = Math.random() * 6;
    for (let k = 0; k < p.count; k++) {
      const X = p.getX(k), A = 0.05, f = 2 * Math.PI / 0.24, wob = 0.5 + 0.5 * Math.sin(X * 3.3 + ph);
      const dz = A * Math.sin(X * f + ph) * (0.7 + wob * 0.4);
      p.setXYZ(k, x0 + w / 2 + X, y0 + h / 2 + p.getY(k), z + dz);
      const s = -A * f * Math.cos(X * f + ph) * (0.7 + wob * 0.4), l = Math.hypot(s, 1);
      n.setXYZ(k, s / l, 0, 1 / l);
      uv.setXY(k, uv.getX(k) * w * 4, uv.getY(k) * h * 4);
    }
    curtains.push([g]);
  };
  const pane = (x0, y0, z0, x1, y1, z1) => B.glass.box(x0, y0, z0, x1, y1, z1, { bevel: 0, tint: 1 });
  [1, 2].forEach((lv) => {
    const y0 = HD.floorY[lv], top = y0 + HD.wallH[lv];
    HD.walls[lv].forEach((w) => {
      const front = w[0] === 'x' && w[1] === 7, isX = w[0] === 'x', c = w[1], t = w[4];
      const wb = front ? B.stone : B.plaster, wo = front ? P.stone : P.plaster;
      HD.segments(w).forEach((s) => {
        const r = HD.rectOf(w, s.from, s.to);
        const part = (a, b) => wb.box(r.x0, a, r.z0, r.x1, b, r.z1, wo);
        if (s.k === 'solid') { part(y0, top); return; }
        if (s.k === 'under') { part(y0, y0 + s.op.top); return; }
        const head = y0 + (s.op.head || 2.6), sill = y0 + (s.op.sill || 0);
        if (head < top) part(head, top);
        if (s.k === 'win' && s.op.sill) part(y0, sill);
        const L = s.to - s.from, line = (a, b, ya, yb, off) => {
          const o = off || 0;
          if (isX) B.metal.box(a, ya, c - 0.028 + o, b, yb, c + 0.028 + o, metal);
          else B.metal.box(c - 0.028 + o, ya, a, c + 0.028 + o, yb, b, metal);
        };
        if (s.k === 'win') {
          openings[lv].push({ isX, c, a: s.from, b: s.to, y0: sill, y1: head, dir: isX ? (c < 3 ? 1 : -1) : (c < 3 ? 1 : -1) });
          line(s.from, s.from + 0.05, sill, head); line(s.to - 0.05, s.to, sill, head);
          line(s.from, s.to, head - 0.05, head); line(s.from, s.to, sill, sill + 0.05);
          const bays = Math.max(1, Math.round(L / 1.4));
          for (let k = 1; k < bays; k++) { const m = s.from + (L * k) / bays; line(m - 0.022, m + 0.022, sill, head); }
          if (isX) pane(s.from, sill, c - 0.006, s.to, head, c + 0.006); else pane(c - 0.006, sill, s.from, c + 0.006, head, s.to);
          if (s.op.slats) {
            // ระแนงไม้สักนอกหน้าต่าง: แดดบ่ายเข้ามาเป็นเส้นบนพื้นห้อง
            const sx = c + s.op.slats * 0.42;
            for (let z = s.from - 0.12; z < s.to + 0.12; z += 0.15) B.wood.box(sx - 0.07, y0, z, sx + 0.07, head + 0.08, z + 0.055, { color: PAL.teak, uv: 0.8, bevel: 0.004, tint: 0.88 + Math.random() * 0.22 });
            B.wood.box(sx - 0.1, head + 0.08, s.from - 0.14, sx + 0.1, head + 0.15, s.to + 0.14, wood(PAL.teak));
          }
        }
        if (s.k === 'glass') {
          openings[lv].push({ isX, c, a: s.from, b: s.to, y0: y0, y1: head, dir: -1 });
          // บานเลื่อนเปิดซ้อนกันข้างหนึ่ง ทางเดินโล่งจริง
          line(s.from, s.to, head - 0.05, head); line(s.from, s.to, y0, y0 + 0.02);
          const stack = L * 0.35;
          [-0.05, 0.05].forEach((o, i) => {
            const x0 = s.from + (i ? 0.03 : 0), x1 = s.from + stack - (i ? 0 : 0.03);
            line(x0, x0 + 0.05, y0, head, o); line(x1 - 0.05, x1, y0, head, o);
            line(x0, x1, y0, y0 + 0.05, o);
            pane(x0, y0, c + o - 0.006, x1, head, c + o + 0.006);
          });
          curtain(s.from + 0.04, s.from + Math.min(0.85, stack), c - 0.3, y0 + 0.015, head + 0.24);
          curtain(s.to - Math.min(0.75, L * 0.16), s.to - 0.04, c - 0.3, y0 + 0.015, head + 0.24);
          B.metal.box(s.from, head + 0.2, c - 0.33, s.to, head + 0.23, c - 0.3, metal);
        }
        if (s.k === 'door') {
          const j = (a, b) => (isX ? B.wood.box(a, y0, c - t / 2 - 0.012, b, head, c + t / 2 + 0.012, wood(PAL.walnut, 0.002)) : B.wood.box(c - t / 2 - 0.012, y0, a, c + t / 2 + 0.012, head, b, wood(PAL.walnut, 0.002)));
          j(s.from, s.from + 0.035); j(s.to - 0.035, s.to);
          if (isX) B.wood.box(s.from, head - 0.035, c - t / 2 - 0.012, s.to, head, c + t / 2 + 0.012, wood(PAL.walnut, 0.002));
          else B.wood.box(c - t / 2 - 0.012, head - 0.035, s.from, c + t / 2 + 0.012, head, s.to, wood(PAL.walnut, 0.002));
          // บานเปิดค้าง
          const hinge = s.op.hinge === 'b' ? s.to - 0.03 : s.from + 0.03, side = s.op.side || 1, len = L - 0.06;
          if (isX) { B.wood.box(hinge - 0.02, y0 + 0.008, c + t * 0.5 * side, hinge + 0.02, head - 0.04, c + t * 0.5 * side + len * side, wood(PAL.oak, 0.003)); B.metal.box(hinge + 0.02, y0 + 0.98, c + (t * 0.5 + len - 0.14) * side, hinge + 0.04, y0 + 1, c + (t * 0.5 + len - 0.02) * side, metal); }
          else { B.wood.box(c + t * 0.5 * side, y0 + 0.008, hinge - 0.02, c + t * 0.5 * side + len * side, head - 0.04, hinge + 0.02, wood(PAL.oak, 0.003)); B.metal.box(c + (t * 0.5 + len - 0.14) * side, y0 + 0.98, hinge + 0.02, c + (t * 0.5 + len - 0.02) * side, y0 + 1, hinge + 0.04, metal); }
        }
      });
    });
  });
  // เสาระเบียงเรียวสีบรอนซ์
  [0.3, 6.17, 12.04, 17.91, 23.78].forEach((x) => B.metal.box(x - 0.055, 0.25, 9.8, x + 0.055, SLAB2, 9.91, metal));
  // ระแนงไม้ตามแปลน
  const slats = (x1, x2, z, y0, y1, gap, depth) => {
    for (let x = x1; x < x2; x += gap) B.wood.box(x, y0, z - depth / 2, x + 0.075, y1, z + depth / 2, { color: PAL.teak, uv: 0.8, bevel: 0.004, tint: 0.86 + Math.random() * 0.26 });
  };
  slats(10.2, 16.7, 8.45, F2, ROOF, 0.2, 0.2);
  slats(19.9, 23.3, 7.42, F1, SLAB2, 0.18, 0.18);
  B.wood.box(19.9, SLAB2 - 0.12, 7.32, 23.3, SLAB2 - 0.03, 7.52, wood(PAL.teak));
  // ราวกระจกชั้นบน
  const rail = (x0, z0, x1, z1) => { pane(x0, F2, z0 - 0.006, x1, F2 + 1.04, z1 + 0.006); B.metal.box(x0, F2 + 1.04, z0 - 0.018, x1, F2 + 1.07, z1 + 0.018, metal); };
  rail(2, 8.62, 21.5, 8.62);
  pane(1.994, F2, 7, 2.006, F2 + 1.04, 8.62); B.metal.box(1.98, F2 + 1.04, 7, 2.02, F2 + 1.07, 8.62, metal);
  pane(21.494, F2, 7, 21.506, F2 + 1.04, 8.62); B.metal.box(21.48, F2 + 1.04, 7, 21.52, F2 + 1.07, 8.62, metal);
  rail(14.5, 6.13, 16, 6.13);
  pane(14.454, F2, 1.6, 14.466, F2 + 1.04, 6.13); B.metal.box(14.44, F2 + 1.04, 1.6, 14.48, F2 + 1.07, 6.13, metal);

  await tick();
  // ---------- บันไดไม้ลอย ----------
  {
    const S = HD.stair, rise = (F2 - F1) / S.steps, run = (S.zBottom - S.zTop) / S.steps;
    for (let i = 0; i < S.steps; i++) {
      const y = F1 + (i + 1) * rise, z1 = S.zBottom - i * run, z0 = z1 - run - 0.02;
      B.wood.box(S.x0, y - 0.065, z0, S.x1, y, z1, { color: PAL.oak, uv: 0.8, bevel: 0.006 });
      if (i % 1 === 0 && z1 > 3.55) { [S.x0 + 0.015, S.x1 - 0.015].forEach((x) => B.metal.box(x - 0.008, y, z1 - run / 2 - 0.008, x + 0.008, y + 0.92, z1 - run / 2 + 0.008, metal)); }
    }
    const beam = (x, h, w) => {
      const dz = S.zBottom - S.zTop, dy = F2 - F1, len = Math.hypot(dz, dy), ang = Math.atan2(dy, dz);
      const g = new THREE.BoxGeometry(w, h, len);
      const m = new THREE.Matrix4().makeRotationX(ang);
      m.setPosition(x, F1 + dy / 2 - 0.15, S.zTop + dz / 2);
      B.metal.geometry(g, m, PAL.bronze, 1);
    };
    beam((S.x0 + S.x1) / 2, 0.16, 0.14);
    [S.x0 + 0.015, S.x1 - 0.015].forEach((x) => {
      const zEnd = 3.5, dz = S.zBottom - zEnd, dy = (F2 - F1) * (dz / (S.zBottom - S.zTop)), len = Math.hypot(dz, dy), ang = Math.atan2(dy, dz);
      const g = new THREE.BoxGeometry(0.022, 0.034, len);
      const m = new THREE.Matrix4().makeRotationX(ang);
      m.setPosition(x, F1 + dy / 2 + 0.94, zEnd + dz / 2);
      B.metal.geometry(g, m, PAL.bronze, 1);
    });
  }

  await tick();
  // ---------- ของในบ้าน ----------
  const leafItems = [];
  const lamps = { 1: [], 2: [] };
  const orient = (x0, z0, W, D, turn) => (u0, y0, v0, u1, y1, v1) => {
    if (turn === 'x+') return [x0 + v0, y0, z0 + u0, x0 + v1, y1, z0 + u1];
    if (turn === 'x-') return [x0 + D - v0, y0, z0 + u0, x0 + D - v1, y1, z0 + u1];
    if (turn === 'z-') return [x0 + u0, y0, z0 + D - v0, x0 + u1, y1, z0 + D - v1];
    return [x0 + u0, y0, z0 + v0, x0 + u1, y1, z0 + v1];
  };
  const softB = (b, a, r, col, s, puff) => b.soft(a[0], a[1], a[2], a[3], a[4], a[5], r, col, s, puff);
  const boxB = (b, a, o) => b.box(a[0], a[1], a[2], a[3], a[4], a[5], o);
  const legs4 = (x0, x1, z0, z1, y0, y1, r, inset, o) => { [[x0 + inset, z0 + inset], [x1 - inset, z0 + inset], [x0 + inset, z1 - inset], [x1 - inset, z1 - inset]].forEach((p) => B.metal.box(p[0] - r, y0, p[1] - r, p[0] + r, y1, p[1] + r, o || metal)); };
  const LATHE = [
    [[0, 0], [0.55, 0], [0.8, 0.12], [1, 0.42], [0.86, 0.72], [0.42, 0.9], [0.38, 1], [0.46, 1.04]],
    [[0, 0], [0.7, 0], [1, 0.25], [1, 0.7], [0.82, 0.95], [0.7, 1]],
    [[0, 0], [0.5, 0], [0.62, 0.2], [0.95, 0.55], [0.75, 0.85], [0.28, 1], [0.34, 1.2]],
    [[0, 0], [0.5, 0], [1, 0.8], [0.97, 0.86], [0.45, 0.14], [0, 0.14]],
  ];
  const vase = (b, x, y, z, r, h, col, kind) => {
    const pts = LATHE[kind].map((p) => new THREE.Vector2(p[0] * r, p[1] * h));
    b.geometry(new THREE.LatheGeometry(pts, 26), new THREE.Matrix4().makeTranslation(x, y, z), col, 1);
  };
  const shadeLamp = (x, z, y0, h, r, lv) => {
    B.metal.box(x - 0.012, y0, z - 0.012, x + 0.012, y0 + h, z + 0.012, metal);
    B.shade.geometry(new THREE.CylinderGeometry(r * 0.72, r, r * 1.05, 28, 1, true), new THREE.Matrix4().makeTranslation(x, y0 + h + r * 0.4, z));
    lamps[lv].push({ x, y: y0 + h + r * 0.1, z, k: 0.5 });
  };
  [1, 2].forEach((lv) => {
    const y = HD.floorY[lv];
    HD.items[lv].forEach((i) => {
      const x0 = i.x, z0 = i.z, x1 = i.x + i.w, z1 = i.z + i.d, top = y + (i.h || 0), col = PAL[i.c] || PAL.ivory;
      if (i.t === 'rug') { B.wool.box(x0, y, z0, x1, y + 0.016, z1, { uv: 0.55, bevel: 0.005, tint: 1 }); }
      else if (i.t === 'sofa') {
        const fz = i.facing === 'z', W = fz ? i.w : i.d, D = fz ? i.d : i.w, O = orient(x0, z0, W, D, fz ? 'z+' : 'x+');
        boxB(B.metal, O(0.05, y, 0.05, W - 0.05, y + 0.07, D - 0.05), metal);
        softB(B.linen, O(0, y + 0.07, 0, W, y + 0.27, D), 0.045, col);
        const n = Math.max(1, Math.round(W / 0.95)), cw = W / n;
        for (let k = 0; k < n; k++) {
          softB(B.linen, O(k * cw + 0.006, y + 0.27, 0.2, (k + 1) * cw - 0.006, y + 0.43, D - 0.004), 0.055, col, 2.4, 0.018);
          softB(B.linen, O(k * cw + 0.012, y + 0.36, 0.015, (k + 1) * cw - 0.012, top, 0.26), 0.07, col, 2.4);
        }
        if (W > 2) { softB(B.linen, O(W - 0.62, y + 0.44, 0.28, W - 0.17, y + 0.8, 0.42), 0.06, PAL.clay, 2.4); softB(B.linen, O(0.2, y + 0.44, 0.28, 0.72, y + 0.82, 0.43), 0.06, PAL.sand, 2.4); }
      } else if (i.t === 'table') {
        const m = i.c === 'stone';
        if (m) { B.marble.box(x0, top - 0.05, z0, x1, top, z1, Object.assign({}, P.marble, { bevel: 0.006 })); B.metal.box(x0 + 0.2, y, z0 + 0.14, x1 - 0.2, top - 0.05, z1 - 0.14, metal); B.paint.box(x0 + 0.26, top, z0 + 0.22, x0 + 0.62, top + 0.03, z0 + 0.5, { color: PAL.ink, bevel: 0.002 }); B.paint.box(x0 + 0.29, top + 0.03, z0 + 0.24, x0 + 0.59, top + 0.052, z0 + 0.48, { color: PAL.clay, bevel: 0.002 }); vase(B.ceramic, x1 - 0.42, top, z0 + 0.42, 0.13, 0.09, PAL.ink, 3); }
        else {
          B.wood.box(x0, top - 0.042, z0, x1, top, z1, { color: PAL[i.c] || PAL.walnut, uv: 0.7, bevel: 0.007 });
          legs4(x0, x1, z0, z1, y, top - 0.04, 0.018, 0.08);
          if (i.long === 'z') { vase(B.ceramic, x0 + 0.5, top, z0 + 1.4, 0.2, 0.13, PAL.white, 3); vase(B.ceramic, x0 + 0.48, top, z0 + 0.75, 0.05, 0.2, PAL.ink, 2); vase(B.ceramic, x0 + 0.54, top, z0 + 2.05, 0.04, 0.15, PAL.clay, 2); }
        }
      } else if (i.t === 'chair') {
        const O = orient(x0, z0, i.w, i.d, i.turn);
        const s = i.w;
        const legs = [[0.07, 0.07], [s - 0.07, 0.07], [0.07, s - 0.07], [s - 0.07, s - 0.07]];
        legs.forEach((p) => boxB(B.metal, O(p[0] - 0.012, y, p[1] - 0.012, p[0] + 0.012, y + 0.2, p[1] + 0.012), metal));
        softB(B.linen, O(0.02, y + 0.2, 0.1, s - 0.02, y + 0.41, s), 0.07, col, 2.4, 0.012);
        softB(B.linen, O(0.03, y + 0.36, 0, s - 0.03, top, 0.19), 0.07, col, 2.4);
      } else if (i.t === 'dine') {
        const O = orient(x0, z0, i.w, i.d, i.turn);
        [[0.03, 0.03], [i.w - 0.03, 0.03], [0.03, i.d - 0.03], [i.w - 0.03, i.d - 0.03]].forEach((p) => boxB(B.wood, O(p[0] - 0.014, y, p[1] - 0.014, p[0] + 0.014, y + 0.44, p[1] + 0.014), wood(PAL.walnut, 0.003)));
        softB(B.linen, O(0, y + 0.43, 0, i.w, y + 0.485, i.d), 0.022, PAL.sand);
        boxB(B.wood, O(0.012, y + 0.48, 0.005, i.w - 0.012, top, 0.04), wood(PAL.walnut, 0.008));
      } else if (i.t === 'shelf') {
        const bays = Math.round(i.w / 1.2), bw = i.w / bays, rows = 6, rh = i.h / rows;
        B.wood.box(x0, y, z0, x1, top, z0 + 0.018, wood(PAL.walnut, 0));
        for (let b = 0; b <= bays; b++) B.wood.box(x0 + b * bw - 0.012, y, z0, x0 + b * bw + 0.012, top, z1, wood(PAL.walnut, 0.002));
        for (let r = 0; r <= rows; r++) B.wood.box(x0, y + r * rh - 0.012 + (r === 0 ? 0.012 : 0), z0, x1, y + r * rh + 0.012, z1, wood(PAL.walnut, 0.002));
        const tones = [PAL.ivory, PAL.sand, PAL.clay, PAL.char, PAL.sage, PAL.white, PAL.oak];
        for (let b = 0; b < bays; b++) for (let r = 0; r < rows; r++) {
          const fill = Math.random(), bx0 = x0 + b * bw + 0.03, by = y + r * rh + 0.012;
          if (fill < 0.56) {
            let at = bx0 + (Math.random() < 0.5 ? 0 : bw * 0.3); const end = at + bw * (0.3 + Math.random() * 0.4);
            while (at < Math.min(end, x0 + (b + 1) * bw - 0.05)) {
              const tw = 0.018 + Math.random() * 0.03, th = rh * (0.56 + Math.random() * 0.32), c0 = tones[Math.floor(Math.random() * tones.length)];
              B.paint.box(at, by, z1 - 0.26 - Math.random() * 0.03, at + tw, by + th, z1 - 0.05, { color: c0, bevel: 0, tint: 0.85 + Math.random() * 0.3 });
              at += tw + 0.002;
            }
          } else if (fill < 0.78) {
            const cx = bx0 + bw * (0.25 + Math.random() * 0.4), rr = 0.05 + Math.random() * 0.07;
            vase(B.ceramic, cx, by, z1 - 0.2, rr * 0.95, rr * (1.5 + Math.random() * 1.8), Math.random() < 0.5 ? PAL.white : Math.random() < 0.5 ? PAL.ink : PAL.clay, Math.floor(Math.random() * 3));
          }
        }
      } else if (i.t === 'cabinet') {
        B.wood.box(x0, y + 0.06, z0, x1, top, z1 - 0.02, wood(col, 0.002));
        B.metal.box(x0 + 0.02, y, z0, x1 - 0.02, y + 0.06, z1 - 0.04, metal);
        const n = Math.max(1, Math.round((i.w > 0.9 ? i.w : i.d) / 0.6)), along = i.w > 0.9 || i.w >= i.d;
        for (let k = 0; k < n; k++) {
          if (along) { const a = x0 + (k * i.w) / n, b = x0 + ((k + 1) * i.w) / n; B.wood.box(a + 0.003, y + 0.065, z1 - 0.02, b - 0.003, top - 0.004, z1, wood(col, 0.002)); }
          else { const a = z0 + (k * i.d) / n, b = z0 + ((k + 1) * i.d) / n; B.wood.box(x0 - 0.02, y + 0.065, a + 0.003, x0, top - 0.004, b - 0.003, wood(col, 0.002)); }
        }
        if (i.top === 'marble') B.marble.box(x0, top, z0, x1, top + 0.03, z1 + 0.02, Object.assign({}, P.marble, { bevel: 0.003 }));
        if (i.h && i.h < 1 && i.w > 3) { vase(B.ceramic, x0 + 0.65, top, z0 + 0.25, 0.16, 0.42, PAL.ink, 0); vase(B.ceramic, x0 + 1.05, top, z0 + 0.25, 0.1, 0.24, PAL.white, 2); B.paint.box(x1 - 1.1, top, z0 + 0.08, x1 - 0.72, top + 0.05, z0 + 0.4, { color: PAL.sand, bevel: 0.002 }); }
      } else if (i.t === 'island') {
        B.wood.box(x0 + 0.06, y, z0 + 0.1, x1 - 0.06, top - 0.04, z1 - 0.2, wood(PAL.walnut, 0.002));
        B.marble.box(x0, top - 0.04, z0, x1, top, z1, Object.assign({}, P.marble, { bevel: 0.004 }));
        B.marble.box(x0, y, z0, x0 + 0.04, top - 0.04, z1, Object.assign({}, P.marble, { bevel: 0.002 }));
        B.marble.box(x1 - 0.04, y, z0, x1, top - 0.04, z1, Object.assign({}, P.marble, { bevel: 0.002 }));
        vase(B.ceramic, x0 + 0.42, top, z0 + 0.42, 0.17, 0.11, PAL.white, 3);
      } else if (i.t === 'stool') {
        legs4(x0, x1, z0, z1, y, top - 0.04, 0.009, 0.05);
        B.linen.soft(x0, top - 0.05, z0, x1, top + 0.012, z1, 0.022, PAL.clay);
      } else if (i.t === 'console') {
        B.marble.box(x0, top - 0.035, z0, x1, top, z1, Object.assign({}, P.marble, { bevel: 0.003 }));
        legs4(x0, x1, z0, z1, y, top - 0.03, 0.012, 0.03);
        vase(B.ceramic, x0 + 0.28, top, z0 + 0.44, 0.15, 0.46, PAL.clay, 0);
        B.paint.box(x0 + 0.1, top, z0 + 0.9, x0 + 0.46, top + 0.04, z0 + 1.2, { color: PAL.char, bevel: 0.002 });
      } else if (i.t === 'plant') {
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        B.ceramic.geometry(new THREE.CylinderGeometry(0.24, 0.17, 0.46, 24), new THREE.Matrix4().makeTranslation(cx, y + 0.23, cz), PAL.ink);
        B.trunk.box(cx - 0.012, y + 0.4, cz - 0.012, cx + 0.012, y + 1.1, cz + 0.012, { color: PAL.char, bevel: 0 });
        leafItems.push({ x: cx, y: y + 1.05, z: cz, rx: 0.3, ry: 0.42, rz: 0.3, n: 12, s: 0.42, h: 0.27, sat: 0.34, li: 0.3 });
      } else if (i.t === 'bed') {
        B.wood.box(x0, y + 0.05, z0, x1, y + 0.2, z1, wood(PAL.walnut, 0.006));
        B.metal.box(x0 + 0.08, y, z0 + 0.08, x1 - 0.08, y + 0.05, z1 - 0.08, metal);
        B.linen.soft(x0 - 0.06, y + 0.05, z0 - 0.1, x1 + 0.06, y + 1.16, z0 + 0.03, 0.04, PAL.sand, 2.4);
        B.linen.soft(x0 + 0.03, y + 0.2, z0 + 0.03, x1 - 0.03, top, z1 - 0.03, 0.06, PAL.white, 2.4);
        B.linen.soft(x0 + 0.005, y + 0.26, z0 + 0.62, x1 - 0.005, top + 0.045, z1 - 0.005, 0.05, col, 2.4);
        B.linen.soft(x0 + 0.01, y + 0.28, z1 - 0.72, x1 - 0.01, top + 0.06, z1 - 0.26, 0.04, PAL.clay, 2.4);
        const pw = i.w / 2 - 0.06;
        [x0 + 0.04, x0 + i.w / 2 + 0.02].forEach((px) => {
          B.linen.soft(px, top - 0.02, z0 + 0.05, px + pw, top + 0.24, z0 + 0.2, 0.06, PAL.white, 2.4);
          B.linen.soft(px + 0.02, top - 0.02, z0 + 0.2, px + pw - 0.02, top + 0.15, z0 + 0.34, 0.06, PAL.ivory, 2.4);
        });
      } else if (i.t === 'bench') {
        legs4(x0, x1, z0, z1, y, top - 0.12, 0.012, 0.05);
        B.linen.soft(x0, top - 0.13, z0, x1, top, z1, 0.05, col, 2.4, 0.012);
      } else if (i.t === 'lamp') {
        const cx = x0 + 0.15, cz = z0 + 0.15;
        B.metal.geometry(new THREE.CylinderGeometry(0.13, 0.13, 0.018, 24), new THREE.Matrix4().makeTranslation(cx, y + 0.009, cz), PAL.bronze);
        shadeLamp(cx, cz, y, i.h - 0.22, 0.2, lv);
      } else if (i.t === 'pendant') {
        const cy = y + i.y, cz0 = z0, cz1 = z1;
        B.metal.box(x0 - 0.02, cy, cz0, x0 + 0.06, cy + 0.03, cz1, metal);
        B.bulb.box(x0 - 0.008, cy - 0.003, cz0 + 0.02, x0 + 0.05, cy, cz1 - 0.02, { bevel: 0, tint: 1 });
        [cz0 + 0.2, cz1 - 0.2].forEach((z) => B.metal.box(x0 + 0.018, cy + 0.03, z - 0.003, x0 + 0.024, y + HD.wallH[lv], z + 0.003, metal));
        lamps[lv].push({ x: x0 + 0.02, y: cy - 0.02, z: (cz0 + cz1) / 2, k: 1.2, down: true });
      } else if (i.t === 'tub') {
        const wall = 0.075;
        B.ceramic.soft(x0, y, z0, x1, y + 0.09, z1, 0.03, PAL.white, 1);
        B.ceramic.soft(x0, y + 0.06, z0, x0 + wall, top, z1, 0.03, PAL.white, 1); B.ceramic.soft(x1 - wall, y + 0.06, z0, x1, top, z1, 0.03, PAL.white, 1);
        B.ceramic.soft(x0, y + 0.06, z0, x1, top, z0 + wall, 0.03, PAL.white, 1); B.ceramic.soft(x0, y + 0.06, z1 - wall, x1, top, z1, 0.03, PAL.white, 1);
        const fx = (x0 + x1) / 2, fz = i.long === 'z' ? z0 - 0.1 : z1 + 0.12;
        B.metal.box(fx - 0.012, y, fz - 0.012, fx + 0.012, top + 0.25, fz + 0.012, Object.assign({}, metal, { color: PAL.brass }));
      } else if (i.t === 'vanity') {
        const longZ = i.d > i.w;
        B.wood.box(x0 + 0.02, y + 0.24, z0, x1 - 0.02, top - 0.03, z1 - 0.01, wood(PAL.walnut, 0.002));
        B.marble.box(x0, top - 0.03, z0, x1, top, z1, Object.assign({}, P.marble, { bevel: 0.003 }));
        const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
        vase(B.ceramic, cx, top, cz, 0.2, 0.13, PAL.white, 3);
        if (longZ) {
          const wx = x1 >= 21 ? x1 : x1 + 0.03;
          B.mirror.box(wx - 0.02, top + 0.22, z0 + 0.08, wx - 0.002, top + 1.2, z1 - 0.08, { bevel: 0, tint: 1 });
          B.metal.box(wx - 0.022, top + 0.2, z0 + 0.06, wx, top + 0.22, z1 - 0.06, metal);
        } else {
          B.mirror.box(x0 + 0.08, top + 0.22, z0 - 0.015, x1 - 0.08, top + 1.2, z0 + 0.003, { bevel: 0, tint: 1 });
          B.metal.box(x0 + 0.06, top + 0.2, z0 - 0.017, x1 - 0.06, top + 0.22, z0 + 0.005, metal);
        }
      } else if (i.t === 'lounge') {
        legs4(x0, x1, z0, z1, y, y + 0.14, 0.012, 0.05);
        B.wood.box(x0, y + 0.14, z0, x1, y + 0.18, z1, wood(PAL.teak, 0.008));
        B.linen.soft(x0 + 0.02, y + 0.18, z0 + 0.02, x1 - 0.5, y + 0.28, z1 - 0.02, 0.04, PAL.sand, 2.4);
        B.linen.soft(x1 - 0.52, y + 0.18, z0 + 0.02, x1 - 0.02, y + 0.42, z1 - 0.02, 0.05, PAL.sand, 2.4);
      } else if (i.t === 'box') {
        B.paint.box(x0, y, z0, x1, top, z1, { color: col });
      }
    });
  });
  await tick();
  // ครัว: หินกันเปื้อน อ่างล้าง ก๊อกทองเหลือง เตา โคมเหนือเคาน์เตอร์
  {
    const k = F1 + 0.95;
    B.marble.box(16.08, k, 0.15, 18.9, F1 + 1.05, 0.17, Object.assign({}, P.marble, { bevel: 0.001 }));
    B.paint.box(16.25, k, 0.26, 16.95, k + 0.005, 0.72, { color: PAL.ink, bevel: 0.001 });
    B.metal.box(17.25, k, 0.25, 17.85, k + 0.004, 0.68, metal);
    const brass = Object.assign({}, metal, { color: PAL.brass });
    B.metal.geometry(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(17.55, k, 0.24), new THREE.Vector3(17.55, k + 0.24, 0.24), new THREE.Vector3(17.55, k + 0.31, 0.34), new THREE.Vector3(17.55, k + 0.22, 0.44)]), 14, 0.011, 8, false), null, PAL.brass, 1);
    void brass;
    [17.1, 17.9].forEach((x) => {
      const y = F1 + 1.86;
      B.metal.box(x - 0.003, y, 1.87, x + 0.003, SLAB2, 1.876, metal);
      B.shade.geometry(new THREE.SphereGeometry(0.085, 18, 12), new THREE.Matrix4().makeTranslation(x, y - 0.06, 1.873));
      lamps[1].push({ x, y: y - 0.1, z: 1.873, k: 0.7 });
    });
  }
  // กระถางใหญ่บนระเบียงและมุมห้อง
  [[0.85, 9.35, 1.0], [23.2, 9.35, 1.0], [8.45, 6.45, 0.75]].forEach((q) => {
    const y = F1;
    vase(B.ceramic, q[0], y, q[1], 0.3 * q[2], 0.62 * q[2], PAL.ink, 1);
    B.trunk.box(q[0] - 0.012, y + 0.5 * q[2], q[1] - 0.012, q[0] + 0.012, y + 1.25 * q[2], q[1] + 0.012, { color: PAL.char, bevel: 0 });
    leafItems.push({ x: q[0], y: y + 1.25 * q[2], z: q[1], rx: 0.42 * q[2], ry: 0.5 * q[2], rz: 0.42 * q[2], n: 16, s: 0.46, h: 0.27, sat: 0.34, li: 0.26 });
  });
  vase(B.ceramic, 0.75, F1, 6.55, 0.17, 0.72, PAL.clay, 0);
  // โคมไฟหัวเตียง
  [[4.22, 0.45, 2, 0.5], [7.77, 0.45, 2, 0.5], [22.8, 2.4, 1, 0.5]].forEach((p) => {
    const y = HD.floorY[p[2]] + p[3];
    vase(B.ceramic, p[0], y, p[1], 0.075, 0.14, PAL.clay, 1);
    shadeLamp(p[0], p[1], y + 0.12, 0.16, 0.12, p[2]);
  });
  // ภาพเขียนจริงบนผนัง
  const artMat = (seed, base, inks) => new THREE.MeshStandardMaterial({ map: makeTex(artTex(seed, base, inks), true), roughness: 0.9 });
  const arts = [];
  for (const a of [
    [4109, '#d9cfbd', ['rgba(64,52,42,.55)', 'rgba(146,88,54,.62)', 'rgba(30,28,26,.82)']],
    [7711, '#cfc8ba', ['rgba(86,98,92,.55)', 'rgba(52,62,64,.72)', 'rgba(170,132,88,.5)']],
    [1303, '#2c2822', ['rgba(150,110,72,.55)', 'rgba(216,196,164,.5)', 'rgba(16,14,12,.9)']],
  ]) { arts.push(artMat(a[0], a[1], a[2])); await tick(); }
  const hang = (mat, x0, y0, z0, x1, y1, z1, nx, nz) => {
    const f = new Batch();
    const d = 0.035;
    B.wood.box(x0 - (nz ? 0.02 : 0), y0 - 0.02, z0 - (nx ? 0.02 : 0), x1 + (nz ? 0.02 : 0), y1 + 0.02, z1 + (nx ? 0.02 : 0), wood(PAL.ink, 0.003));
    const w = nz ? x1 - x0 : z1 - z0, h = y1 - y0;
    const g = new THREE.PlaneGeometry(w, h);
    const m = new THREE.Mesh(g, mat);
    m.position.set((x0 + x1) / 2 + nx * (d - 0.015), (y0 + y1) / 2, (z0 + z1) / 2 + nz * (d - 0.015));
    m.rotation.y = nz ? (nz > 0 ? 0 : Math.PI) : (nx > 0 ? Math.PI / 2 : -Math.PI / 2);
    m.receiveShadow = true; m.castShadow = false;
    scene.add(m); interiorMeshes.push(m);
    void f;
  };
  hang(arts[0], 0.15, F1 + 0.95, 1.1, 0.19, F1 + 2.55, 3.1, 1, 0);
  hang(arts[1], 10.1, F1 + 1.2, 0.15, 12, F1 + 2.5, 0.19, 0, 1);
  hang(arts[2], 9.88, F2 + 0.75, 4.4, 9.92, F2 + 2.15, 6.2, -1, 0);
  hang(arts[1], 19.08, F1 + 0.9, 5.2, 19.12, F1 + 2.1, 6.4, 1, 0);
  hang(arts[0], 16.08, F2 + 0.9, 1.7, 16.12, F2 + 2.1, 3.2, 1, 0);

  // ---------- จุดไฟบนฝ้า ----------
  const lights = { 1: [], 2: [] };
  [1, 2].forEach((lv) => {
    const ceil = HD.floorY[lv] + HD.wallH[lv];
    HD.rooms[lv].forEach((r) => {
      if (r.id === 'under') return;
      if (r.ext) {
        const y = (lv === 1 ? SLAB2 : ROOF) - 0.05;
        const z = lv === 1 ? 8.4 : 7.8;
        for (let x = r.x + 2.4; x < r.x + r.w - 1; x += 4.8) { lights[lv].push({ x, y, z, k: 0.75, ext: true }); B.bulb.geometry(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16), new THREE.Matrix4().makeTranslation(x, y + 0.016, z)); }
        return;
      }
      const cols = Math.max(1, Math.round(r.w / 3)), rows = Math.max(1, Math.round(r.d / 3));
      for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) {
        const x = r.x + ((a + 0.5) * r.w) / cols, z = r.z + ((b + 0.5) * r.d) / rows;
        if (x > hole.x0 && x < hole.x1 && z > hole.z0 && z < hole.z1) continue;
        lights[lv].push({ x, y: ceil - 0.05, z, k: 1 });
        B.bulb.geometry(new THREE.CylinderGeometry(0.04, 0.04, 0.012, 16), new THREE.Matrix4().makeTranslation(x, ceil - 0.006, z));
      }
    });
    lamps[lv].forEach((l) => lights[lv].push(l));
  });

  await tick();
  // รวมเป็นก้อนต่อวัสดุ: 15 draw call ทั้งบ้าน
  curtains.forEach((c) => B.curtain.geometry(c[0], null, PAL.ivory, 1));
  add(B.plaster.build(), mats.plaster);
  add(B.stone.build(), mats.stone);
  await tick();
  add(B.oak.build(), mats.oak, true, true, true);
  add(B.marble.build(), mats.marble, true, true, true);
  add(B.wood.build(), mats.wood);
  add(B.soffit.build(), mats.soffit);
  add(B.linen.build(), mats.linen, true, true, true);
  add(B.wool.build(), mats.wool, false, true, true);
  add(B.paint.build(), mats.paint, false, true, true);
  add(B.metal.build(), mats.metal);
  add(B.ceramic.build(), mats.ceramic, true, true, true);
  await tick();
  add(B.curtain.build(), mats.curtain, true, true, true);
  add(B.mirror.build(), mats.mirror, false, false, true);
  add(B.bulb.build(), mats.bulb, false, false, true);
  add(B.shade.build(), mats.shade, false, false, true);
  const glassMesh = add(B.glass.build(), mats.glass, false, false);
  glassMesh.renderOrder = 5;

  await tick();
  // ---------- ต้นไม้ ----------
  const leafPts = leafItems.slice();
  const tree = (x, z, h, spread, opt) => {
    opt = opt || {};
    const limb = (from, dir, len, r, depth) => {
      const end = from.clone().add(dir.clone().multiplyScalar(len));
      const mid = from.clone().lerp(end, 0.5).add(new THREE.Vector3((Math.random() - 0.5) * len * 0.2, 0, (Math.random() - 0.5) * len * 0.2));
      B.trunk.geometry(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, end), opt.far ? 2 : 4, r, opt.far ? 4 : 6, false), null, opt.bark || [0.13, 0.095, 0.07]);
      if (depth === 0) {
        leafPts.push({ x: end.x, y: end.y, z: end.z, rx: opt.rx || 1.25, ry: opt.ry || 0.7, rz: opt.rz || 1.25, n: opt.n || 12, s: opt.s || 1, h: opt.h, sat: opt.sat, li: opt.li, far: opt.far });
        return;
      }
      const n = depth > 2 ? 3 : 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const d = dir.clone().multiplyScalar(0.62).add(new THREE.Vector3(Math.cos(a) * spread, 0.18 + Math.random() * 0.26, Math.sin(a) * spread)).normalize();
        limb(end, d, len * (0.68 + Math.random() * 0.16), r * 0.64, depth - 1);
      }
    };
    limb(new THREE.Vector3(x, 0, z), new THREE.Vector3(0, 1, 0), h * 0.3, opt.r || 0.2, opt.depth == null ? 4 : opt.depth);
  };
  // ต้นใหญ่ให้ร่มฝั่งตะวันตกและหลังบ้าน
  tree(-10.5, 3.2, 14.5, 0.8, { n: 18, rx: 1.5, ry: 0.8, rz: 1.5, depth: 5, r: 0.3 });
  tree(33, -2, 13.5, 0.8, { n: 18, rx: 1.5, ry: 0.8, rz: 1.5, depth: 5, r: 0.3 });
  
  // ทิวไม้หลังบ้าน ไกลออกไปใช้ใบใหญ่น้อยชิ้น
  for (const t of [[-24, -14, 16], [-12, -17, 18], [0, -14, 17], [12, -18, 19], [24, -15, 17], [36, -18, 18], [48, -13, 16], [-36, -8, 15], [60, -6, 15], [6, -30, 22], [30, -32, 23], [-18, -32, 22], [52, -30, 21], [-52, 14, 16], [-44, 36, 17], [-58, 58, 18], [-34, 78, 17], [-8, 92, 18], [18, 96, 19], [44, 94, 18], [68, 80, 18], [84, 56, 17], [78, 30, 16], [92, 8, 18]]) { tree(t[0], t[1], t[2], 0.85, { n: 13, s: 1.8, rx: 2.5, ry: 1.5, rz: 2.5, depth: 4, li: 0.2, sat: 0.34, r: 0.3, far: true }); await tick(); }
  {
    const belt = [];
    for (let x = -70; x <= 110; x += 13) { belt.push([x + (Math.random() - 0.5) * 7, 84 + Math.random() * 12, 19 + Math.random() * 5]); belt.push([x + 6 + (Math.random() - 0.5) * 7, 104 + Math.random() * 16, 22 + Math.random() * 6]); }
    for (let z = 20; z <= 70; z += 13) { belt.push([-62 - Math.random() * 10, z, 19 + Math.random() * 5]); belt.push([98 + Math.random() * 10, z, 19 + Math.random() * 5]); }
    for (let x = -80; x <= 110; x += 16) belt.push([x + (Math.random() - 0.5) * 8, -46 - Math.random() * 16, 24 + Math.random() * 6]);
    for (const t of belt) { tree(t[0], t[1], t[2], 0.86, { n: 15, s: 3, rx: 3.6, ry: 2, rz: 3.6, depth: 3, li: 0.17 + Math.random() * 0.05, sat: 0.34, r: 0.34, far: true }); await tick(); }
  }
  // ลีลาวดีริมสระ: กิ่งหนาโค้ง ช่อใบที่ปลาย ดอกขาว
  const flowers = [];
  const frang = (x, z, h) => {
    const limb = (from, dir, len, r, depth) => {
      const end = from.clone().add(dir.clone().multiplyScalar(len));
      const mid = from.clone().lerp(end, 0.55).add(new THREE.Vector3(0, -len * 0.08, 0));
      B.trunk.geometry(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(from, mid, end), 6, r, 8, false), null, [0.22, 0.2, 0.17]);
      if (depth === 0) {
        leafPts.push({ x: end.x, y: end.y + 0.1, z: end.z, rx: 0.34, ry: 0.2, rz: 0.34, n: 7, s: 0.62, h: 0.25, sat: 0.42, li: 0.3 });
        for (let k = 0; k < 7; k++) flowers.push(new THREE.Vector3(end.x + (Math.random() - 0.5) * 0.38, end.y + 0.16 + Math.random() * 0.14, end.z + (Math.random() - 0.5) * 0.38));
        return;
      }
      for (let i = 0; i < (depth > 2 ? 3 : 2); i++) {
        const a = Math.random() * 6.28;
        const d = dir.clone().multiplyScalar(0.72).add(new THREE.Vector3(Math.cos(a) * 0.72, 0.28 + Math.random() * 0.26, Math.sin(a) * 0.72)).normalize();
        limb(end, d, len * 0.76, r * 0.74, depth - 1);
      }
    };
    limb(new THREE.Vector3(x, 0, z), new THREE.Vector3(0.08, 1, 0.02).normalize(), h * 0.3, 0.13, 3);
  };
  frang(-2.2, 13, 5.2);
  frang(27, 11.6, 6.2);
  await tick();
  add(B.trunk.build(), mats.trunk);
  await tick();

  // ใบไม้: แผ่นช่อใบหันหน้าขึ้นฟ้าเป็นส่วนใหญ่ พุ่มจึงสว่างด้านบนและมืดด้านล่างเองตามแสง
  const leafGeo = new THREE.PlaneGeometry(1, 1);
  const dummy = new THREE.Object3D(), col = new THREE.Color();
  const scatter = (points, cast) => {
    const count = points.reduce((a, p) => a + p.n, 0);
    const m = new THREE.InstancedMesh(leafGeo, mats.leaf, count);
    let li = 0;
    points.forEach((p) => {
      const hue = p.h == null ? 0.205 + Math.random() * 0.045 : p.h;
      const sat = p.sat == null ? 0.42 : p.sat, lum = p.li == null ? 0.25 : p.li;
      for (let i = 0; i < p.n; i++) {
        const a = Math.random() * 6.283, v = Math.random() * 2 - 1, q = Math.sqrt(1 - v * v), r = Math.cbrt(Math.random());
        dummy.position.set(p.x + Math.cos(a) * q * r * p.rx, p.y + v * r * p.ry, p.z + Math.sin(a) * q * r * p.rz);
        const sc = (1.05 + Math.random() * 0.75) * (p.s || 1);
        dummy.scale.set(sc, sc, sc);
        dummy.rotation.set(-Math.PI / 2 + (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, Math.random() * 6.283);
        dummy.updateMatrix();
        m.setMatrixAt(li, dummy.matrix);
        col.setHSL(hue + (Math.random() - 0.5) * 0.03, sat + (Math.random() - 0.5) * 0.12, lum * (0.72 + Math.random() * 0.56));
        m.setColorAt(li, col);
        li++;
      }
    });
    m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false;
    scene.add(m);
    return m;
  };
  await tick();
  scatter(leafPts.filter((p) => !p.far), true);
  scatter(leafPts.filter((p) => p.far), false);
  const flowerMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.052, 0), new THREE.MeshStandardMaterial({ color: 0xf6efdf, roughness: 0.8, emissive: 0x332a16 }), flowers.length);
  flowers.forEach((f, i) => { dummy.position.copy(f); dummy.scale.set(1, 0.55, 1); dummy.rotation.set(Math.random() * 3, Math.random() * 3, 0); dummy.updateMatrix(); flowerMesh.setMatrixAt(i, dummy.matrix); });
  flowerMesh.castShadow = false; flowerMesh.receiveShadow = true;
  scene.add(flowerMesh);
  // พุ่มเตี้ยตามขอบระเบียงและริมผนัง
  const beds = [[-3.4, -1, -1, 11, 1], [24.8, 27.4, -1, 11, 1], [20.2, 24.6, 11.4, 13.6, 0.75], [-1.2, 2.2, 11.4, 13.8, 0.6]];
  const shrubs = [];
  beds.forEach((b) => {
    const area = (b[1] - b[0]) * (b[3] - b[2]);
    for (let i = 0; i < area * 13; i++) shrubs.push({ x: b[0] + Math.random() * (b[1] - b[0]), y: Math.pow(Math.random(), 1.3) * b[4] + 0.1, z: b[2] + Math.random() * (b[3] - b[2]), rx: 0, ry: 0, rz: 0, n: 1, s: 0.46, h: 0.24 + Math.random() * 0.05, sat: 0.38, li: 0.17 + Math.random() * 0.1 });
  });
  const islands = [[-14, 20, 5, 3], [-22, 11, 4, 2.6], [31, 20, 5.5, 3.2], [40, 8, 4.5, 3], [10, 25, 6, 2.6], [-6, 33, 4, 2.2], [24, 36, 5, 2.4], [-30, 26, 4, 3], [-10, 11, 2.6, 2]];
  islands.forEach((b) => {
    const n = Math.round(b[2] * b[3] * 32);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.283, r = Math.sqrt(Math.random());
      const h = (1 - r * r) * 1.15;
      shrubs.push({ x: b[0] + Math.cos(a) * r * b[2], y: Math.random() * h + 0.08, z: b[1] + Math.sin(a) * r * b[3], rx: 0, ry: 0, rz: 0, n: 1, s: 0.5, h: 0.22 + Math.random() * 0.07, sat: 0.36, li: 0.15 + Math.random() * 0.12 });
    }
  });
  scatter(shrubs, true);
  await tick();

  return { mats, lights, openings, interiorMeshes, skyU, sky, tex: T };
}

// ---------- เชดเดอร์ ----------
const FS_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const MIX_FS = 'varying vec2 vUv; uniform sampler2D tA; uniform sampler2D tB; uniform float k; void main(){ gl_FragColor = mix(texture2D(tA, vUv), texture2D(tB, vUv), k); }';
const BRIGHT_FS = 'varying vec2 vUv; uniform sampler2D t; void main(){ vec3 c = min(texture2D(t, vUv).rgb, vec3(12.0)); float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(1.1, 3.2, l), 1.0); }';
const BLUR_FS = 'varying vec2 vUv; uniform sampler2D t; uniform vec2 d; void main(){ vec3 s = texture2D(t, vUv).rgb * 0.2270; s += (texture2D(t, vUv + d * 1.3846).rgb + texture2D(t, vUv - d * 1.3846).rgb) * 0.3162; s += (texture2D(t, vUv + d * 3.2308).rgb + texture2D(t, vUv - d * 3.2308).rgb) * 0.0703; gl_FragColor = vec4(s, 1.0); }';
const FINAL_FS = `
varying vec2 vUv; uniform sampler2D tA; uniform sampler2D tB; uniform sampler2D tBloom; uniform float k; uniform float bloom; uniform float exposure; uniform vec2 res; uniform float seed; uniform float aa; uniform vec2 px;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float h21(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
float lu(vec3 c){ c = c/(1.0+c); return dot(c, vec3(0.3,0.59,0.11)); }
// เกลี่ยขอบแบบเร็วสำหรับภาพระหว่างขยับ: ดูความต่างรอบจุด แล้วเฉลี่ยตามแนวขอบ
vec3 smoothEdges(){
  vec3 m = texture2D(tA, vUv).rgb;
  float ln = lu(texture2D(tA, vUv+vec2(0.0,px.y)).rgb), ls = lu(texture2D(tA, vUv-vec2(0.0,px.y)).rgb), le = lu(texture2D(tA, vUv+vec2(px.x,0.0)).rgb), lw = lu(texture2D(tA, vUv-vec2(px.x,0.0)).rgb), lm = lu(m);
  float mn = min(lm,min(min(ln,ls),min(le,lw))), mx = max(lm,max(max(ln,ls),max(le,lw)));
  if (mx-mn < max(0.035, mx*0.11)) return m;
  vec2 d = vec2(ls-ln, le-lw);
  d = clamp(d/(min(abs(d.x),abs(d.y))+max(0.002,(ln+ls+le+lw)*0.03)), -6.0, 6.0)*px;
  vec3 a = 0.5*(texture2D(tA, vUv+d*(-1.0/6.0)).rgb + texture2D(tA, vUv+d*(1.0/6.0)).rgb);
  vec3 b = 0.5*a + 0.25*(texture2D(tA, vUv-d*0.5).rgb + texture2D(tA, vUv+d*0.5).rgb);
  float lb = lu(b);
  return (lb<mn || lb>mx) ? a : b;
}
void main(){
  vec3 c = aa > 0.5 ? smoothEdges() : mix(texture2D(tA, vUv).rgb, texture2D(tB, vUv).rgb, k);
  c += texture2D(tBloom, vUv).rgb * bloom;
  c *= exposure;
  vec2 q = vUv - 0.5; c *= 1.0 - dot(q,q)*0.34;
  c = aces(c);
  c = pow(c, vec3(1.0/2.2));
  c = mix(c, c*c*(3.0-2.0*c), 0.2);
  c += (h21(vUv*res + seed) - 0.5) / 255.0;
  gl_FragColor = vec4(c, 1.0);
}`;
const WATER_VS = 'varying vec4 vR; varying vec3 vW; uniform mat4 tm; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; vR = tm * w; gl_Position = projectionMatrix * viewMatrix * w; }';
const WATER_FS = `
varying vec4 vR; varying vec3 vW; uniform sampler2D tR; uniform vec3 eye; uniform vec3 deep; uniform vec3 sunDir; uniform vec3 sunCol;
float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); float a=fract(sin(dot(i,vec2(127.1,311.7)))*43758.5453); float b=fract(sin(dot(i+vec2(1,0),vec2(127.1,311.7)))*43758.5453); float c=fract(sin(dot(i+vec2(0,1),vec2(127.1,311.7)))*43758.5453); float d=fract(sin(dot(i+vec2(1,1),vec2(127.1,311.7)))*43758.5453); return mix(mix(a,b,f.x),mix(c,d,f.x),f.y); }
void main(){
  vec2 p = vW.xz * 1.7;
  float e = 0.06; float h = n2(p)+0.5*n2(p*2.3+7.0);
  vec2 g = vec2(n2(p+vec2(e,0.0))+0.5*n2((p+vec2(e,0.0))*2.3+7.0)-h, n2(p+vec2(0.0,e))+0.5*n2((p+vec2(0.0,e))*2.3+7.0)-h)/e;
  vec3 N = normalize(vec3(-g.x*0.012, 1.0, -g.y*0.012));
  vec3 V = normalize(eye - vW);
  float F = 0.05 + 0.95*pow(1.0 - max(dot(N,V),0.0), 4.0);
  vec2 uv = vR.xy/vR.w + N.xz*0.035;
  vec3 refl = texture2D(tR, uv).rgb;
  vec3 H = normalize(V + sunDir);
  float spec = pow(max(dot(N,H),0.0), 1400.0) * 5.0;
  vec3 c = mix(deep, refl, clamp(F*1.1,0.0,1.0)) + sunCol * spec;
  gl_FragColor = vec4(c, 1.0);
}`;

function halton(i, b) { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; }
function lerp(a, b, k) { return a + (b - a) * k; }
function sstep(a, b, x) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function mixColor(out, a, b, k) { out.setRGB(lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)); return out; }
function mix3(a, b, k) { return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]; }

// แสงของเวลานั้น: ทิศแดดจากการหมุนจริง (เอียงมาทางเหนือเล็กน้อย) สีและความแรงตามความสูงดวงอาทิตย์
function lightingAt(minutes) {
  const q = HD.sunAt(minutes), elev = q.elev;
  const dir = new THREE.Vector3(q.x, q.y, q.z);
  const day = sstep(-0.04, 0.2, elev);
  const low = 1 - sstep(0.08, 0.55, elev);
  const night = 1 - sstep(-0.1, 0.1, elev);
  const dusk = sstep(0.34, 0.03, elev) * (1 - night * 0.8);
  return { dir, elev, day, low, night, dusk };
}

export async function createHouse(canvas, opts) {
  const gl2 = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.debug });
  if (!gl2 || !gl2.getExtension('EXT_color_buffer_float')) throw new Error('no-webgl2-float');
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl2, antialias: false });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // แปลงสีเองในพาสสุดท้าย
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.autoClear = true;
  renderer.info.autoReset = false;

  const mobile = opts.mobile;
  // การ์ดจออ่อน: ลดความละเอียดและจำนวนรอบตั้งแต่แรก ลื่นก่อนสวย
  const dbg = gl2.getExtension('WEBGL_debug_renderer_info');
  const gpuName = dbg ? String(gl2.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : '';
  const weakGpu = /GT\s?[1-7]\d\d\b|GeForce\s?(8|9|[1-7]\d\d)\b|Intel.*(HD|UHD) Graphics|Mali-[TG]?\d{1,2}\b|Adreno[^0-9]*[3-5]\d\d/i.test(gpuName);
  let low = opts.quality === 'low' || (opts.quality !== 'high' && (weakGpu || mobile));
  let MAX = opts.samples || (low ? 40 : 96);
  const scene = new THREE.Scene();
  scene.background = null;
  const { mats, lights, openings, interiorMeshes, skyU, tex } = await buildScene(scene);
  const breathe = () => new Promise((r) => setTimeout(r, 0));
  await breathe();
  scene.fog = new THREE.Fog(0xffffff, 95, 560);

  // แสงสะท้อนรอบตัว: ทำให้โลหะ หิน พื้นไม้เป็นมันแบบของจริง สร้างครั้งเดียวตอนเปิด
  {
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(40, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vD; void main(){ float h = vD.y; vec3 up = mix(vec3(1.5,1.55,1.62), vec3(0.75,0.86,1.05), clamp(h,0.0,1.0)); vec3 dn = mix(vec3(0.55,0.5,0.42), vec3(0.2,0.17,0.14), clamp(-h*2.0,0.0,1.0)); float win = smoothstep(0.2,0.0,abs(h-0.16)); gl_FragColor = vec4(mix(dn,up,smoothstep(-0.02,0.04,h)) + win*vec3(1.6,1.55,1.4),1.0); }',
    }));
    envScene.add(envSky);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(envScene, 0, 0.1, 100).texture;
    pm.dispose();
  }

  const camera = new THREE.PerspectiveCamera(24, 1, 0.1, 1500);
  const focus = new THREE.Vector3(10, 2.2, 10);
  const shot = mobile
    ? { target: new THREE.Vector3(12.5, -3.2, 6), dist: 64, az: 0.42, el: 0.1, fov: 34 }
    : { target: new THREE.Vector3(6.6, 5.1, 5), dist: 69, az: 0.46, el: 0.055, fov: 24 };

  // ไฟ
  const center = new THREE.Vector3(12, 2, 6);
  const mkDir = (size) => {
    const l = new THREE.DirectionalLight(0xffffff, 1);
    l.castShadow = true;
    l.shadow.mapSize.set(size, size);
    const c = l.shadow.camera; c.left = -34; c.right = 34; c.top = 34; c.bottom = -34; c.near = 1; c.far = 260;
    l.shadow.bias = -0.0003; l.shadow.normalBias = 0.018;
    l.target.position.copy(center);
    scene.add(l); scene.add(l.target);
    return l;
  };
  const sun = mkDir(low ? 2048 : 4096), sky = mkDir(low ? 1024 : 2048);
  const spot = new THREE.SpotLight(0xffb873, 0, 15, 1.3, 1, 1.8);
  spot.castShadow = true; spot.shadow.mapSize.set(low ? 512 : 1024, low ? 512 : 1024); spot.shadow.bias = -0.0012; spot.shadow.normalBias = 0.02; spot.shadow.camera.near = 0.06; spot.shadow.camera.far = 15;
  scene.add(spot); scene.add(spot.target);
  const hemi = new THREE.HemisphereLight(0xffffff, 0xffffff, 1);
  scene.add(hemi);

  // น้ำ: เงาสะท้อนจริงจากกล้องกระจก
  const mirrorCam = new THREE.PerspectiveCamera();
  const tm = new THREE.Matrix4();
  const water = new THREE.Mesh(new THREE.PlaneGeometry(16, 2.6), new THREE.ShaderMaterial({
    vertexShader: WATER_VS, fragmentShader: WATER_FS,
    uniforms: { tR: { value: null }, tm: { value: tm }, eye: { value: new THREE.Vector3() }, deep: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3() }, sunCol: { value: new THREE.Color() } },
  }));
  water.rotation.x = -Math.PI / 2; water.position.set(11, WATER_Y, 12.4);
  scene.add(water);

  // บัฟเฟอร์
  const rtOpt = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true };
  const accum = [new THREE.WebGLRenderTarget(4, 4, Object.assign({}, rtOpt, { depthBuffer: false })), new THREE.WebGLRenderTarget(4, 4, Object.assign({}, rtOpt, { depthBuffer: false }))];
  const sampleRT = new THREE.WebGLRenderTarget(4, 4, rtOpt);
  const previewRT = new THREE.WebGLRenderTarget(4, 4, Object.assign({}, rtOpt, { samples: low ? 0 : 4 }));
  const reflectRT = new THREE.WebGLRenderTarget(4, 4, rtOpt);
  const bloomRT = [new THREE.WebGLRenderTarget(4, 4, Object.assign({}, rtOpt, { depthBuffer: false })), new THREE.WebGLRenderTarget(4, 4, Object.assign({}, rtOpt, { depthBuffer: false }))];
  water.material.uniforms.tR.value = reflectRT.texture;

  const fsScene = new THREE.Scene(), fsCam = new THREE.Camera();
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
  quad.frustumCulled = false;
  fsScene.add(quad);
  const fsMat = (fragmentShader, uniforms) => new THREE.ShaderMaterial({ vertexShader: FS_VS, fragmentShader, uniforms, depthTest: false, depthWrite: false });
  const mixMat = fsMat(MIX_FS, { tA: { value: null }, tB: { value: null }, k: { value: 0 } });
  const brightMat = fsMat(BRIGHT_FS, { t: { value: null } });
  const blurMat = fsMat(BLUR_FS, { t: { value: null }, d: { value: new THREE.Vector2() } });
  const finalMat = fsMat(FINAL_FS, { tA: { value: null }, tB: { value: null }, tBloom: { value: bloomRT[0].texture }, k: { value: 0 }, bloom: { value: 0 }, exposure: { value: 1 }, res: { value: new THREE.Vector2() }, seed: { value: 0 }, aa: { value: 0 }, px: { value: new THREE.Vector2() } });
  const pass = (mat, target) => { quad.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); };

  // สถานะ
  let W = 4, H = 4, n = 0, minutes = 990, running = false, moving = false, movingUntil = 0, visible = true, dead = false, previewReady = false, lastNow = 0, sunDirty = true, spotBuilt = false;
  let draws = 0, held = false, paused = !!opts.paused, reflectTick = 0, previewFrames = 0, ready = false, shadowsBuilt = false, walkCam = null, controller = null, alwaysLoop = false, focusLevel = 0, focusX = 12, focusZ = 5, exposureBoost = 1, pvScale = low ? 0.75 : 1, emaDt = 16, pvCooldown = 30, frozen = false;
  const L = { sunCol: new THREE.Color(), skyCol: new THREE.Color(), groundCol: new THREE.Color(), sunI: 0, skyE: 0, bounce: 0, night: 0, state: null };
  let baseExposure = 1;

  function applyTime() {
    const s = lightingAt(minutes);
    L.state = s; L.night = s.night;
    const warm = s.low;
    mixColor(L.sunCol, [1.0, 0.94, 0.86], [1.0, 0.56, 0.29], warm);
    L.sunI = 6.4 * s.day * lerp(1, 0.86, warm);
    // ฟ้าทั้งใบ: กลางวันฟ้าซีดแบบเมืองร้อน · โพล้เพล้ม่วงส้ม · กลางคืนน้ำเงินเข้มพอเห็นทรง
    const zen = mix3(mix3([0.11, 0.25, 0.56], [0.1, 0.13, 0.32], s.dusk), [0.006, 0.011, 0.028], s.night);
    const hor = mix3(mix3([0.6, 0.72, 0.86], [1.05, 0.6, 0.36], s.dusk), [0.024, 0.032, 0.062], s.night);
    skyU.zen.value.setRGB(zen[0], zen[1], zen[2]);
    skyU.hor.value.setRGB(hor[0], hor[1], hor[2]);
    skyU.sunDir.value.copy(s.dir);
    skyU.sunCol.value.copy(L.sunCol);
    skyU.sunVis.value = s.day;
    const hill = mix3(mix3([0.12, 0.2, 0.2], [0.16, 0.12, 0.15], s.dusk), [0.007, 0.01, 0.018], s.night);
    skyU.hill.value.setRGB(hill[0], hill[1], hill[2]);
    skyU.cloud.value = lerp(0.5, 0.08, s.night);
    scene.fog.color.setRGB(lerp(hor[0], hill[0], 0.78), lerp(hor[1], hill[1], 0.78), lerp(hor[2], hill[2], 0.78));
    mats.glass.uniforms.tone.value.setRGB(hor[0] * 0.8, hor[1] * 0.8, hor[2] * 0.8);
    const c = mix3(mix3([0.58, 0.68, 0.86], [0.42, 0.38, 0.52], s.dusk), [0.02, 0.032, 0.066], s.night);
    L.skyCol.setRGB(c[0], c[1], c[2]);
    L.skyE = 1.85;
    // แสงเด้งจากพื้นขึ้นใต้ชายคา: สีตามแดดที่ตกบนพื้น นี่คือสิ่งที่ทำให้ใต้ชายคาอุ่น
    const b = 0.42 * s.day + 0.015;
    L.groundCol.setRGB(L.sunCol.r * b + c[0] * 0.14, L.sunCol.g * b * 0.92 + c[1] * 0.14, L.sunCol.b * b * 0.76 + c[2] * 0.14);
    scene.environmentIntensity = lerp(lerp(0.13, 0.1, s.dusk), 0.012, s.night);
    const glow = sstep(0.0, 0.8, s.night + s.dusk * 0.45);
    mats.bulb.color.setRGB(6 * glow, 4.7 * glow, 3.1 * glow);
    mats.shade.emissiveIntensity = 2.3 * glow;
    water.material.uniforms.sunDir.value.copy(s.dir);
    water.material.uniforms.sunCol.value.copy(L.sunCol).multiplyScalar(s.day);
    mixColor(water.material.uniforms.deep.value, [0.05, 0.13, 0.15], [0.004, 0.009, 0.016], s.night);
    finalMat.uniforms.bloom.value = 0.05 + 0.34 * s.night;
    baseExposure = lerp(0.84, 1.12, s.night);
    finalMat.uniforms.exposure.value = baseExposure * exposureBoost;
    sunDirty = true;
    // แผนที่เงาของไฟในบ้านต้องถูกสร้างอย่างน้อยครั้งหนึ่ง ไม่งั้น sampler ว่างทำให้ทุก draw call พังเงียบ (INVALID_OPERATION)
    if (!spotBuilt) { spot.shadow.needsUpdate = true; spotBuilt = true; }
  }

  function heroPose() {
    const az = shot.az, el = shot.el, d = shot.dist;
    return {
      pos: new THREE.Vector3(shot.target.x + Math.sin(az) * Math.cos(el) * d, shot.target.y + Math.sin(el) * d, shot.target.z + Math.cos(az) * Math.cos(el) * d),
      look: shot.target.clone(), fov: shot.fov,
    };
  }
  function placeCamera() {
    if (walkCam) {
      camera.position.copy(walkCam.pos); camera.fov = walkCam.fov; camera.up.set(0, 1, 0);
      camera.lookAt(walkCam.look); camera.updateMatrixWorld();
      return;
    }
    const p = heroPose();
    camera.position.copy(p.pos); camera.fov = p.fov; camera.up.set(0, 1, 0);
    camera.lookAt(p.look); camera.updateMatrixWorld();
  }

  // เลนส์จริงมีระยะชัด: ขยับตำแหน่งกล้องบนหน้าเลนส์ แล้วเฉือนภาพให้ระนาบโฟกัสอยู่กับที่
  function jitterCamera(i) {
    placeCamera();
    camera.updateProjectionMatrix();
    const P = camera.projectionMatrix.elements;
    if (i >= 0) {
      const jx = (halton(i + 1, 2) - 0.5) * 2 / W, jy = (halton(i + 1, 3) - 0.5) * 2 / H;
      P[8] += jx; P[9] += jy;
      const ap = walkCam ? 0 : (opts.aperture == null ? 0.05 : opts.aperture);
      if (ap > 0) {
        const a = halton(i + 1, 5) * Math.PI * 2, r = Math.sqrt(halton(i + 1, 7)) * ap;
        const ox = Math.cos(a) * r, oy = Math.sin(a) * r;
        const R = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), U = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
        camera.position.addScaledVector(R, ox).addScaledVector(U, oy);
        camera.updateMatrixWorld();
        const f = camera.position.distanceTo(focus);
        P[8] -= ox * P[0] / f; P[9] -= oy * P[5] / f;
      }
    }
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  }

  function setLightsSample(i) {
    const s = L.state;
    lightSet(true);
    const a = halton(i + 1, 11) * Math.PI * 2, r = Math.sqrt(halton(i + 1, 13)) * 0.02;
    const T1 = new THREE.Vector3(0, 1, 0).cross(s.dir).normalize(), T2 = s.dir.clone().cross(T1);
    const d = s.dir.clone().addScaledVector(T1, Math.cos(a) * r).addScaledVector(T2, Math.sin(a) * r).normalize();
    sun.position.copy(center).addScaledVector(d, 120);
    sun.color.copy(L.sunCol); sun.intensity = L.sunI;
    // ฟ้าทั้งใบ สุ่มทีละทิศทั่วครึ่งทรงกลม (ค่าเฉลี่ยของแสงหนึ่งทิศ = ฟ้าเต็มใบ มีเงาตามซอกจริง)
    const u = halton(i + 1, 2), v = halton(i + 1, 3);
    const y = Math.max(u, 0.05), rr = Math.sqrt(1 - y * y), ph = v * Math.PI * 2;
    sky.position.set(center.x + rr * Math.cos(ph) * 120, center.y + y * 120, center.z + rr * Math.sin(ph) * 120);
    sky.color.copy(L.skyCol); sky.intensity = L.skyE;
    hemi.color.copy(L.skyCol).multiplyScalar(focusLevel ? 0.05 : 0.0);
    hemi.groundColor.copy(L.groundCol);
    if (L.night > 0.02) { const nb = (focusLevel ? 0.3 : 0.1) * L.night; hemi.groundColor.r += 1.0 * nb; hemi.groundColor.g += 0.68 * nb; hemi.groundColor.b += 0.42 * nb; }
    hemi.intensity = 1;
    setSpot(i);
  }
  // หนึ่งรอบต่อหนึ่งดวง: ไฟบนฝ้าตอนค่ำ และ "แสงจากช่องหน้าต่าง" ตอนกลางวัน ค่าเฉลี่ยจึงเป็นแสงนุ่มจากหลายทิศ
  function setSpot(i) {
    spot.shadow.autoUpdate = false;
    const night = L.night, s = L.state;
    const indoorDay = focusLevel && s.day > 0.02;
    const useLamps = night > 0.01 || s.dusk > 0.25;
    const lampWeight = Math.max(night, sstep(0.25, 0.9, s.dusk) * 0.55);
    const pickWin = indoorDay && (!useLamps || halton(i + 1, 29) > lampWeight);
    if (pickWin) {
      const list = openings[focusLevel];
      const near = list.filter((o) => { const mid = (o.a + o.b) / 2; const dx = (o.isX ? mid : o.c) - focusX, dz = (o.isX ? o.c : mid) - focusZ; return dx * dx + dz * dz < 200; });
      const use = near.length ? near : list;
      const op = use[Math.floor(halton(i + 1, 17) * use.length)];
      const along = lerp(op.a + 0.05, op.b - 0.05, halton(i + 1, 19)), py = lerp(op.y0 + 0.2, op.y1 - 0.05, halton(i + 1, 23));
      // อยู่ระหว่างกระจกกับระแนง: พ้นระนาบกระจกจนไม่จ้าที่วงกบ แต่ไม่ชิดระแนงจนเกิดจุดสว่างเหมือนเปลวไฟ
      const inset = -0.25;
      if (op.isX) { spot.position.set(along, py, op.c + op.dir * inset); spot.target.position.set(along, py - 1.2, op.c + op.dir * 4); }
      else { spot.position.set(op.c + op.dir * inset, py, along); spot.target.position.set(op.c + op.dir * 4, py - 1.2, along); }
      spot.target.updateMatrixWorld();
      const c = L.skyCol, sc = L.sunCol, q = s.day;
      spot.color.setRGB(c.r * 0.46 + sc.r * 0.66 * q, c.g * 0.46 + sc.g * 0.58 * q, c.b * 0.46 + sc.b * 0.38 * q);
      spot.distance = 15; spot.angle = 1.34; spot.penumbra = 1; spot.decay = 2;
      spot.intensity = 26 * use.length * (1 - lampWeight * 0.5) * q;
      spot.shadow.autoUpdate = true;
      return;
    }
    if (!useLamps) { spot.intensity = 0; return; }
    let list = focusLevel ? lights[focusLevel].filter((l) => { const dx = l.x - focusX, dz = l.z - focusZ; return dx * dx + dz * dz < 110; }) : lights[1].concat(lights[2]);
    if (!list.length) list = lights[focusLevel || 1];
    const l = list[Math.floor(halton(i + 1, 17) * list.length)];
    const jr = 0.12;
    spot.position.set(l.x + (halton(i + 1, 19) - 0.5) * jr, l.y, l.z + (halton(i + 1, 23) - 0.5) * jr);
    spot.target.position.set(spot.position.x, l.y - 3, spot.position.z);
    spot.target.updateMatrixWorld();
    spot.color.setRGB(1, 0.72, 0.46);
    spot.distance = 15; spot.angle = 1.32; spot.penumbra = 1; spot.decay = 1.8;
    spot.intensity = (focusLevel ? 15 : 28) * list.length * l.k * Math.max(night, lampWeight);
    spot.shadow.autoUpdate = true;
  }
  function lightSet(full) { if (sky.visible !== full) { sky.visible = full; spot.visible = full; } }
  function setLightsPreview() {
    const s = L.state;
    lightSet(false);
    sun.position.copy(center).addScaledVector(s.dir, 120);
    sun.color.copy(L.sunCol); sun.intensity = L.sunI;
    sky.intensity = 0;
    const indoor = focusLevel ? 1 : 0;
    hemi.color.copy(L.skyCol).multiplyScalar(indoor ? 0.55 : 1);
    if (indoor && L.night > 0.1) hemi.color.lerp(new THREE.Color(0.5, 0.36, 0.22), L.night);
    hemi.groundColor.copy(L.groundCol).multiplyScalar(indoor ? 1.4 : 1);
    if (indoor && L.night > 0.1) hemi.groundColor.lerp(new THREE.Color(0.22, 0.15, 0.09), L.night);
    hemi.intensity = 1;
    spot.intensity = 0; spot.shadow.autoUpdate = false;
    sky.shadow.autoUpdate = false;
    sun.shadow.autoUpdate = false;
    sun.shadow.needsUpdate = sunDirty; sunDirty = false;
    // แผนที่เงาทุกดวงต้องถูกสร้างก่อนวาดครั้งแรก ไม่งั้นทุก draw call พังเงียบ
    if (!shadowsBuilt) { sky.shadow.needsUpdate = true; spot.shadow.needsUpdate = true; shadowsBuilt = true; }
  }

  function setInteriorVisible(v) { interiorMeshes.forEach((m) => { m.visible = v; }); }

  function renderReflection() {
    // กล้องกระจกเหนือผิวน้ำ พร้อมตัดระนาบเฉียงไม่ให้เห็นของใต้น้ำ (วิธีเดียวกับ Reflector ของ Three)
    const planeY = WATER_Y;
    mirrorCam.copy(camera, false);
    mirrorCam.position.set(camera.position.x, 2 * planeY - camera.position.y, camera.position.z);
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const tgt = camera.position.clone().add(dir.multiplyScalar(50));
    tgt.y = 2 * planeY - tgt.y;
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1); up.y = -up.y;
    mirrorCam.up.copy(up);
    mirrorCam.lookAt(tgt);
    mirrorCam.updateMatrixWorld();
    mirrorCam.projectionMatrix.copy(camera.projectionMatrix);
    tm.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    tm.multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, planeY, 0)).applyMatrix4(mirrorCam.matrixWorldInverse);
    const clip = new THREE.Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const p = mirrorCam.projectionMatrix.elements, q = new THREE.Vector4();
    q.x = (Math.sign(clip.x) + p[8]) / p[0]; q.y = (Math.sign(clip.y) + p[9]) / p[5]; q.z = -1; q.w = (1 + p[10]) / p[14];
    clip.multiplyScalar(2 / clip.dot(q));
    p[2] = clip.x; p[6] = clip.y; p[10] = clip.z + 1 - 0.0005; p[14] = clip.w;
    water.visible = false;
    setInteriorVisible(false);
    renderer.setRenderTarget(reflectRT);
    renderer.render(scene, mirrorCam);
    setInteriorVisible(true);
    water.visible = true;
  }
  // ถ้ายืนอยู่ลึกในบ้านแล้วสระอยู่นอกสายตา ข้ามเงาน้ำได้ ประหยัดไปหนึ่งรอบ
  function needsWater() {
    if (!walkCam) return true;
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const toPool = new THREE.Vector3(11 - camera.position.x, -camera.position.y, 12.4 - camera.position.z).normalize();
    return dir.dot(toPool) > 0.15 && (camera.position.z > 3.5 || camera.position.y > 3.5);
  }

  function resizeTargets() {
    [accum[0], accum[1], sampleRT].forEach((t) => t.setSize(W, H));
    previewRT.setSize(Math.max(2, Math.round(W * pvScale)), Math.max(2, Math.round(H * pvScale)));
    reflectRT.setSize(Math.round(W / (low ? 3 : 2)), Math.round(H / (low ? 3 : 2)));
    bloomRT.forEach((t) => t.setSize(Math.round(W / 4), Math.round(H / 4)));
    finalMat.uniforms.res.value.set(W, H);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.75 : 1.5);
    // จำกัดจำนวนพิกเซล: จอใหญ่บนการ์ดอ่อนคือสาเหตุหลักที่ช้า ภาพขยายเองด้วย CSS
    const cap = low ? 1280 * 720 : 1920 * 1200, px = r.width * r.height * dpr * dpr;
    if (px > cap) dpr *= Math.sqrt(cap / px);
    const w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (w === W && h === H) return;
    W = w; H = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    resizeTargets();
    restart();
  }

  function renderBloom(tex) {
    brightMat.uniforms.t.value = tex;
    pass(brightMat, bloomRT[1]);
    for (let i = 0; i < 2; i++) {
      blurMat.uniforms.t.value = bloomRT[1].texture; blurMat.uniforms.d.value.set((1.6 + i) / bloomRT[0].width, 0);
      pass(blurMat, bloomRT[0]);
      blurMat.uniforms.t.value = bloomRT[0].texture; blurMat.uniforms.d.value.set(0, (1.6 + i) / bloomRT[0].height);
      pass(blurMat, bloomRT[1]);
    }
    blurMat.uniforms.t.value = bloomRT[1].texture; blurMat.uniforms.d.value.set(0.5 / bloomRT[0].width, 0.5 / bloomRT[0].height);
    pass(blurMat, bloomRT[0]);
  }

  function drawMain(target, updateShadow) {
    // แผนที่เงาอัปเดตรอบแรกของเฟรมเท่านั้น รอบหลังใช้ชุดเดิม
    renderer.shadowMap.autoUpdate = updateShadow;
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.shadowMap.autoUpdate = false;
  }

  function frame(now) {
    if (dead) return;
    running = false;
    if (!visible || paused) return;
    // การ์ดอ่อน: ล็อกจังหวะเฟรมให้สม่ำเสมอ (ขยับ 30 เฟรม/วินาที ภาพละเอียดเว้นช่วงให้การ์ดหายใจ)
    // เฟรมนิ่งกว่าเร็วกว่าแต่แกว่ง และงานไม่กองคิว ปุ่มกับเมาส์จึงตอบไวขึ้น
    if (low && previewReady && now - lastNow < (moving || held ? 28 : 62)) { request(); return; }
    // เพดานสูงพอ: เฟรมต่ำแล้วเดินต้องยังไปได้ระยะเท่าเดิม ไม่ใช่กลายเป็นเดินสโลว์
    const dt = Math.min(0.12, (now - lastNow) / 1000 || 0.016); lastNow = now;
    // หยุดขยับแป๊บเดียวยังไม่เริ่มงานหนัก ไม่งั้นลากๆ หยุดๆ จะสะดุดทุกครั้ง
    if (controller && controller(dt, now)) { moving = true; movingUntil = now + (low ? 420 : 200); }
    const isMoving = moving && now < movingUntil;
    if (!isMoving) moving = false;
    renderer.info.reset();
    finalMat.uniforms.exposure.value = baseExposure * exposureBoost;
    if (isMoving || !previewReady) {
      // เครื่องอ่อน: ลดความละเอียดภาพระหว่างขยับเอง ให้ลื่นก่อน พอหยุดกลับมาคมเต็มที่
      emaDt = lerp(emaDt, Math.min(120, (now - (frame.prev || now)) || 16), 0.12); frame.prev = now;
      if (opts.pv) { if (pvScale !== opts.pv) { pvScale = opts.pv; resizeTargets(); n = 0; } }
      else if (pvCooldown > 0) pvCooldown--;
      else if (emaDt > (pvScale > 0.75 ? 44 : 80) && pvScale > 0.5) { pvScale -= 0.25; pvCooldown = 45; resizeTargets(); n = 0; }
      else if (emaDt < 24 && pvScale < (low ? 0.75 : 1)) { pvScale += 0.25; pvCooldown = 90; resizeTargets(); n = 0; }
      setLightsPreview();
      jitterCamera(-1);
      // เครื่องไม่รู้จักชื่อแต่ช้าจริง: ลดระดับเองครั้งเดียว
      if (!low && !opts.samples && opts.quality !== 'high' && ++previewFrames > 30 && emaDt > 50) { low = true; MAX = 40; W = 0; resize(); }
      if (needsWater() && (!low || reflectTick++ % 2 === 0)) { renderer.shadowMap.autoUpdate = true; renderReflection(); renderer.shadowMap.autoUpdate = false; drawMainInto(previewRT, false); }
      else drawMainInto(previewRT, true);
      previewReady = true;
      n = 0;
      finalMat.uniforms.tA.value = previewRT.texture; finalMat.uniforms.tB.value = previewRT.texture; finalMat.uniforms.k.value = 0;
      finalMat.uniforms.aa.value = low ? 1 : 0; finalMat.uniforms.px.value.set(1 / previewRT.width, 1 / previewRT.height);
      if (L.night > 0.02 || L.state.dusk > 0.2) renderBloom(previewRT.texture);
      finalMat.uniforms.seed.value = 0;
      pass(finalMat, null);
      draws++;
      request();
      return;
    }
    frame.prev = 0;
    if (n < MAX && !frozen && !held) {
      setLightsSample(n);
      sun.shadow.autoUpdate = true; sky.shadow.autoUpdate = true; sunDirty = true;
      jitterCamera(n);
      const needW = needsWater();
      if (needW) { renderer.shadowMap.autoUpdate = true; renderReflection(); renderer.shadowMap.autoUpdate = false; }
      drawMainInto(sampleRT, !needW);
      // เฉลี่ยรวมสะสม
      mixMat.uniforms.tA.value = accum[0].texture; mixMat.uniforms.tB.value = sampleRT.texture; mixMat.uniforms.k.value = 1 / (n + 1);
      pass(mixMat, accum[1]);
      const t = accum[0]; accum[0] = accum[1]; accum[1] = t;
      n++;
      const w = sstep(4, 22, n);
      if (L.night > 0.02 || L.state.dusk > 0.2) renderBloom(n < 22 ? previewRT.texture : accum[0].texture);
      finalMat.uniforms.tA.value = previewRT.texture; finalMat.uniforms.tB.value = accum[0].texture; finalMat.uniforms.k.value = w; finalMat.uniforms.aa.value = 0;
      pass(finalMat, null);
      draws++;
      request();
    } else if (n >= MAX && exposureChanged) {
      // แสงคงที่แล้ว แค่วาดรอบสุดท้ายใหม่ตามค่าเปิดรับแสงที่เปลี่ยน
      finalMat.uniforms.tA.value = accum[0].texture; finalMat.uniforms.tB.value = accum[0].texture; finalMat.uniforms.k.value = 0; finalMat.uniforms.aa.value = 0;
      pass(finalMat, null);
    }
    exposureChanged = false;
    if (alwaysLoop) request();
  }
  let exposureChanged = false;
  function drawMainInto(target, upd) {
    water.material.uniforms.eye.value.copy(camera.position);
    drawMain(target, upd);
  }
  function request() { if (ready && !paused && !running && !dead && visible) { running = true; requestAnimationFrame(frame); } }
  function restart() { n = 0; previewReady = false; request(); }

  const ro = new ResizeObserver(resize); ro.observe(canvas);
  const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) request(); });
  io.observe(canvas);

  applyTime();
  resize();
  placeCamera();
  camera.updateProjectionMatrix();
  // คอมไพล์เชดเดอร์แบบไม่บล็อกหน้า (บนวินโดวส์คือขั้นที่ช้าที่สุด) แล้วค่อยวาดเฟรมแรก
  try {
    // ภาพเร็วใช้ไฟชุดเล็ก ภาพละเอียดใช้ชุดเต็ม ต้องเตรียมเชดเดอร์ทั้งสองชุด
    lightSet(true);
    await renderer.compileAsync(scene, camera);
    lightSet(false);
    await renderer.compileAsync(scene, camera);
    for (const m of [mixMat, brightMat, blurMat, finalMat]) { quad.material = m; await renderer.compileAsync(fsScene, fsCam); }
    for (const k of Object.keys(tex)) { tex[k].anisotropy = low ? 2 : 8; renderer.initTexture(tex[k]); await breathe(); }
  } catch (x) { /* คอมไพล์ล่วงหน้าไม่ได้ก็ให้เฟรมแรกทำแทน ช้ากว่าแต่ใช้ได้ */ }
  ready = true;
  restart();

  return {
    setTime(m, interactive) {
      if (m === minutes && L.state) return;
      minutes = m; applyTime();
      if (interactive) { moving = true; movingUntil = performance.now() + 110; }
      else { previewReady = false; n = 0; }
      request();
    },
    info() { return { n, max: MAX, W, H, moving, calls: renderer.info.render.calls, tris: renderer.info.render.triangles, done: n >= MAX, pvScale, walking: !!walkCam, low, paused, gpu: gpuName, draws }; },
    dispose() { dead = true; ro.disconnect(); io.disconnect(); renderer.dispose(); },
    // ใช้โดยตัวเดินในบ้าน
    heroPose,
    setCam(c) { walkCam = c; restart(); },
    setController(fn) { controller = fn; alwaysLoop = !!fn; request(); },
    setFocus(level, x, z) { const changed = level !== focusLevel; focusLevel = level; focusX = x; focusZ = z; return changed; },
    setExposureBoost(k) { if (Math.abs(k - exposureBoost) > 0.0005) { exposureBoost = k; exposureChanged = true; request(); } },
    // นิ้วยังกดเมาส์อยู่ อย่าเพิ่งเริ่มภาพละเอียด
    setHold(v) { held = v; if (!v) request(); },
    setPaused(v) { paused = v; if (!v) { emaDt = 16; pvCooldown = 30; restart(); } },
    restart, resize, wake: request,
    project(v3) { const q = v3.clone().project(camera); return { x: (q.x + 1) / 2, y: (1 - q.y) / 2, front: q.z < 1 }; },
    unproject(nx, ny) { return new THREE.Vector3(nx * 2 - 1, 1 - ny * 2, 0.5).unproject(camera).sub(camera.position).normalize(); },
    renderer, scene, camera, shot, THREE,
  };
}
