/* house-data.js — ข้อมูลบ้านชุดเดียว ใช้ทั้งแปลน 2D โมเดล 3D และการชนผนังตอนเดิน
   หน่วยเมตร · x = ซ้ายขวาของแปลน · z = ลึก (0 = ผนังหลัง, 7 = แนวกระจก, 10 = ขอบระเบียง)
   ผนัง: [แนว, พิกัดคงที่, จาก, ถึง, หนา, ช่องเปิด] แนว x = ผนังวิ่งตาม x · แนว z = ผนังวิ่งตาม z
   ช่องเปิด k: glass บานเลื่อนเปิดค้าง (เดินผ่านได้ ส่วนบานซ้อน 35% เดินไม่ได้) · door ประตู · open ช่องกว้าง
   · win หน้าต่าง (เดินผ่านไม่ได้) · under ผนังเตี้ยใต้บันได */
window.HOUSE = (function () {
  const H = {
    floorY: { 1: 0.25, 2: 3.75 },
    wallH: { 1: 3.2, 2: 3.2 },
    rooms: {
      1: [
        { id: 'living', name: 'ห้องนั่งเล่น', x: 0, z: 0, w: 9, d: 7, lx: 5.4, lz: 1.5 },
        { id: 'dining', name: 'ห้องอาหาร', x: 9, z: 0, w: 4, d: 7, lx: 11, lz: 5.9 },
        { id: 'pantry', name: 'แพนทรี', x: 13, z: 0, w: 1.5, d: 3.5, lx: 13.75, lz: 1.5, tiny: true },
        { id: 'under', name: 'ใต้บันได', x: 14.5, z: 0, w: 1.5, d: 3.5, lx: 15.25, lz: 1, tiny: true },
        { id: 'kitchen', name: 'ครัว', x: 16, z: 0, w: 3, d: 3.5, lx: 17, lz: 3.12, floor: 'marble' },
        { id: 'stair', name: 'โถงบันได', x: 13, z: 3.5, w: 3, d: 3.5, lx: 13.8, lz: 4.2, tiny: true },
        { id: 'entry', name: 'โถงทางเข้า', x: 16, z: 3.5, w: 3, d: 3.5, lx: 17.1, lz: 5.4 },
        { id: 'bath1', name: 'ห้องน้ำ', x: 19, z: 0, w: 5, d: 2, lx: 21.4, lz: 1.35, floor: 'marble' },
        { id: 'guest', name: 'ห้องนอนแขก', x: 19, z: 2, w: 5, d: 5, lx: 21.5, lz: 5.4 },
        { id: 'terrace1', name: 'ระเบียง', x: 0, z: 7, w: 24, d: 3, lx: 8.4, lz: 9.4, ext: true },
      ],
      2: [
        { id: 'master', name: 'ห้องนอนใหญ่', x: 2, z: 0, w: 8, d: 7, lx: 6, lz: 4.4 },
        { id: 'walkin', name: 'ห้องแต่งตัว', x: 10, z: 0, w: 3, d: 3.5, lx: 11.5, lz: 1.1, tiny: true },
        { id: 'bath2', name: 'ห้องน้ำใหญ่', x: 10, z: 3.5, w: 3, d: 3.5, lx: 11.9, lz: 4.6, floor: 'marble', tiny: true },
        { id: 'hall', name: 'โถงชั้นบน', x: 13, z: 0, w: 3, d: 7, lx: 14.5, lz: 1, tiny: true },
        { id: 'bed2', name: 'ห้องนอน 2', x: 16, z: 0, w: 5.5, d: 3.5, lx: 18.9, lz: 3 },
        { id: 'bed3', name: 'ห้องนอน 3', x: 16, z: 3.5, w: 3.5, d: 3.5, lx: 17.7, lz: 6.3 },
        { id: 'bath3', name: 'ห้องน้ำ', x: 19.5, z: 3.5, w: 2, d: 3.5, lx: 20.5, lz: 5.4, floor: 'marble', tiny: true },
        { id: 'terrace2', name: 'ระเบียงห้องนอน', x: 2, z: 7, w: 19.5, d: 1.6, lx: 5.8, lz: 7.9, ext: true },
      ],
    },
    walls: {
      1: [
        ['x', 0, 0, 24, 0.3, [{ a: 16.5, b: 18.5, k: 'win', sill: 1.05, head: 2.65 }, { a: 20.4, b: 22.8, k: 'win', sill: 1.3, head: 2.65 }]],
        ['z', 0, 0, 7, 0.3, [{ a: 4.7, b: 6.4, k: 'win', sill: 0, head: 2.85, slats: -1 }]],
        ['z', 24, 0, 7, 0.3, [{ a: 3, b: 5, k: 'win', sill: 0.5, head: 2.65, slats: 1 }]],
        ['x', 7, 0, 24, 0.3, [{ a: 0.6, b: 8.4, k: 'glass', head: 2.75 }, { a: 9.6, b: 14.4, k: 'glass', head: 2.75 }, { a: 16.4, b: 18.6, k: 'glass', head: 2.75 }, { a: 19.8, b: 23.4, k: 'glass', head: 2.75 }]],
        ['z', 9, 0, 7, 0.15, [{ a: 1.8, b: 5.2, k: 'open', head: 2.85 }]],
        ['z', 13, 0, 3.5, 0.15, []],
        ['x', 3.5, 13, 19, 0.15, [{ a: 13.4, b: 14.2, k: 'door', head: 2.25, side: -1 }, { a: 14.5, b: 16, k: 'under', top: 2.02 }, { a: 16.6, b: 18.6, k: 'open', head: 2.75 }]],
        ['z', 14.5, 0, 3.5, 0.15, []],
        ['z', 16, 0, 3.5, 0.15, []],
        ['z', 19, 0, 7, 0.15, [{ a: 3.6, b: 4.5, k: 'door', head: 2.25, side: -1 }]],
        ['x', 2, 19, 24, 0.15, [{ a: 19.25, b: 20.15, k: 'door', head: 2.25, side: -1 }]],
      ],
      2: [
        ['x', 0, 2, 21.5, 0.3, [{ a: 4.5, b: 7.5, k: 'win', sill: 1.2, head: 2.75 }, { a: 17.5, b: 20, k: 'win', sill: 1.1, head: 2.65 }]],
        ['z', 2, 0, 7, 0.3, [{ a: 3.3, b: 5.7, k: 'win', sill: 0, head: 2.85, slats: -1 }]],
        ['z', 21.5, 0, 7, 0.3, [{ a: 1, b: 2.6, k: 'win', sill: 0.6, head: 2.65, slats: 1 }]],
        ['x', 7, 2, 21.5, 0.3, [{ a: 3, b: 9, k: 'glass', head: 2.75 }, { a: 10.15, b: 12.85, k: 'win', sill: 0, head: 2.75 }, { a: 16.4, b: 19.2, k: 'glass', head: 2.75 }, { a: 20, b: 21, k: 'win', sill: 1.1, head: 2.6 }]],
        ['z', 10, 0, 7, 0.15, [{ a: 2.45, b: 3.4, k: 'door', head: 2.25, side: -1 }]],
        ['x', 3.5, 10, 13, 0.15, [{ a: 11, b: 11.9, k: 'door', head: 2.25 }]],
        ['z', 13, 0, 7, 0.15, [{ a: 0.4, b: 1.3, k: 'door', head: 2.25 }]],
        ['z', 16, 0, 7, 0.15, [{ a: 0.4, b: 1.3, k: 'door', head: 2.25 }, { a: 6.15, b: 6.85, k: 'door', head: 2.25, hinge: 'b' }]],
        ['x', 3.5, 16, 21.5, 0.15, []],
        ['z', 19.5, 3.5, 7, 0.15, [{ a: 4.6, b: 5.5, k: 'door', head: 2.25 }]],
      ],
    },
    // บันไดตรง 18 ขั้น: ตีนบันไดอยู่ด้าน z มาก ขึ้นไปหาผนังหลัง · ช่องเปิดพื้นชั้นบนอยู่เหนือแนวนี้
    stair: { x0: 14.6, x1: 15.9, zBottom: 6.1, zTop: 1.6, steps: 18, holeX0: 14.5, holeX1: 16 },
    // ของในบ้าน: t ชนิด · x z w d ตามแปลน · h สูง · c โทนวัสดุ · solid:false เดินทับได้
    items: {
      1: [
        { t: 'rug', x: 1.2, z: 2.6, w: 6.6, d: 3.6, solid: false },
        { t: 'shelf', x: 0.2, z: 0.17, w: 8.6, d: 0.42, h: 2.8 },
        { t: 'sofa', x: 1.7, z: 2.9, w: 4, d: 1, h: 0.76, c: 'ivory', facing: 'z' },
        { t: 'sofa', x: 1.7, z: 3.9, w: 1, d: 1.9, h: 0.76, c: 'ivory', facing: 'x' },
        { t: 'table', x: 3.55, z: 4.35, w: 1.6, d: 0.85, h: 0.34, c: 'stone' },
        { t: 'chair', x: 6.3, z: 3.9, w: 0.86, d: 0.86, h: 0.78, c: 'clay', turn: 'x-' },
        { t: 'lamp', x: 1.35, z: 2.55, w: 0.3, d: 0.3, h: 1.72, solid: false },
        { t: 'table', x: 10.5, z: 1.7, w: 1, d: 2.8, h: 0.75, c: 'walnut', long: 'z' },
        { t: 'dine', x: 10.02, z: 1.95, w: 0.44, d: 0.44, h: 0.82, turn: 'x+' }, { t: 'dine', x: 10.02, z: 2.88, w: 0.44, d: 0.44, h: 0.82, turn: 'x+' }, { t: 'dine', x: 10.02, z: 3.8, w: 0.44, d: 0.44, h: 0.82, turn: 'x+' },
        { t: 'dine', x: 11.54, z: 1.95, w: 0.44, d: 0.44, h: 0.82, turn: 'x-' }, { t: 'dine', x: 11.54, z: 2.88, w: 0.44, d: 0.44, h: 0.82, turn: 'x-' }, { t: 'dine', x: 11.54, z: 3.8, w: 0.44, d: 0.44, h: 0.82, turn: 'x-' },
        { t: 'pendant', x: 11, z: 3.1, w: 0.08, d: 1.9, y: 1.95, solid: false },
        { t: 'cabinet', x: 9.15, z: 0.15, w: 3.7, d: 0.5, h: 0.84, c: 'walnut' },
        { t: 'cabinet', x: 16.1, z: 0.15, w: 2.8, d: 0.62, h: 0.92, c: 'walnut', top: 'marble' },
        { t: 'cabinet', x: 18.3, z: 0.77, w: 0.6, d: 1.3, h: 2.35, c: 'walnut' },
        { t: 'island', x: 16.75, z: 1.45, w: 1.5, d: 0.85, h: 0.92 },
        { t: 'stool', x: 16.95, z: 2.36, w: 0.4, d: 0.4, h: 0.68 }, { t: 'stool', x: 17.75, z: 2.36, w: 0.4, d: 0.4, h: 0.68 },
        { t: 'cabinet', x: 13.1, z: 0.15, w: 1.3, d: 0.5, h: 2.2, c: 'oak' },
        { t: 'console', x: 18.32, z: 4.7, w: 0.56, d: 1.4, h: 0.82 },
        { t: 'plant', x: 13.25, z: 6.1, w: 0.5, d: 0.5, h: 1.5 },
        { t: 'bed', x: 20.4, z: 2.15, w: 2.1, d: 2.2, h: 0.5, c: 'ivory' },
        { t: 'cabinet', x: 22.55, z: 2.15, w: 0.5, d: 0.5, h: 0.5, c: 'walnut' },
        { t: 'tub', x: 22.15, z: 0.2, w: 1.65, d: 0.85, h: 0.58 },
        { t: 'vanity', x: 20.3, z: 0.17, w: 1.6, d: 0.52, h: 0.82 },
        { t: 'lounge', x: 0.9, z: 7.55, w: 1.95, d: 0.72, h: 0.3 }, { t: 'lounge', x: 6.3, z: 7.55, w: 1.95, d: 0.72, h: 0.3 },
        { t: 'sofa', x: 13.6, z: 7.5, w: 2.7, d: 0.82, h: 0.68, c: 'sand', facing: 'z' },
        { t: 'table', x: 14.3, z: 8.5, w: 1.3, d: 0.5, h: 0.32, c: 'teak' },
      ],
      2: [
        { t: 'rug', x: 3.1, z: 0.9, w: 5.8, d: 3.2, solid: false },
        { t: 'bed', x: 4.55, z: 0.3, w: 2.9, d: 2.35, h: 0.54, c: 'ivory' },
        { t: 'cabinet', x: 3.95, z: 0.2, w: 0.55, d: 0.5, h: 0.5, c: 'walnut' }, { t: 'cabinet', x: 7.5, z: 0.2, w: 0.55, d: 0.5, h: 0.5, c: 'walnut' },
        { t: 'bench', x: 4.85, z: 2.76, w: 2.3, d: 0.5, h: 0.44, c: 'clay' },
        { t: 'chair', x: 8.5, z: 4.9, w: 0.86, d: 0.86, h: 0.78, c: 'clay', turn: 'x-' }, { t: 'chair', x: 2.7, z: 4.9, w: 0.86, d: 0.86, h: 0.78, c: 'clay', turn: 'x+' },
        { t: 'cabinet', x: 10.15, z: 0.15, w: 0.6, d: 2.15, h: 2.55, c: 'oak' }, { t: 'cabinet', x: 12.3, z: 1.6, w: 0.55, d: 1.75, h: 2.55, c: 'oak' },
        { t: 'tub', x: 10.2, z: 5.2, w: 0.85, d: 1.6, h: 0.58, long: 'z' },
        { t: 'vanity', x: 12.33, z: 4.4, w: 0.52, d: 1.55, h: 0.82 },
        { t: 'bed', x: 18, z: 0.3, w: 1.9, d: 2, h: 0.5, c: 'ivory' },
        { t: 'cabinet', x: 20.5, z: 2.45, w: 0.85, d: 0.8, h: 0.75, c: 'walnut' },
        { t: 'bed', x: 16.9, z: 3.65, w: 1.7, d: 2, h: 0.5, c: 'ivory' },
        { t: 'tub', x: 19.65, z: 3.65, w: 1.7, d: 0.78, h: 0.58 },
        { t: 'vanity', x: 20.75, z: 5.7, w: 0.65, d: 1.1, h: 0.82 },
        { t: 'chair', x: 3.2, z: 7.3, w: 0.8, d: 0.8, h: 0.72, c: 'sand', turn: 'z+' },
      ],
    },
    // จุดเดิน: ใช้หาทางผ่านประตู [x, z, ชั้น]
    nodes: {
      T: [11, 9.3, 1], Tl: [4.6, 9.1, 1], Tr: [17.7, 9.3, 1],
      L: [6.9, 6.2, 1], Lg: [4.6, 7, 1], Ld: [8.3, 4.8, 1], Dw: [9.7, 4.8, 1], D: [10.1, 5.7, 1], Dg: [12.4, 7, 1],
      C: [13.8, 5, 1], Cf: [14.2, 6.48, 1], S0: [15.25, 6.48, 1], Ef: [16.2, 6.48, 1], E: [17.5, 5.5, 1], Eg: [17.8, 7, 1],
      Ki: [17.5, 3.5, 1], K: [17.45, 3.42, 1], Ea: [17.9, 4.05, 1], Gd: [19, 4.05, 1], Gi: [19.65, 4.05, 1], G: [20.1, 5.6, 1], Ga: [19.65, 3, 1], Bd: [19.7, 2, 1], B: [19.8, 1, 1],
      S1: [15.25, 1.25, 2], U: [14, 0.85, 2], H: [13.75, 3.6, 2], Hn: [13.75, 6.48, 2], Hm: [15.3, 6.48, 2],
      Wd: [13, 0.85, 2], W: [11.5, 1.9, 2], Wm: [10.95, 2.95, 2], Md: [10, 2.93, 2], Mi: [9.1, 3.6, 2], M: [6.4, 6.1, 2], Mg: [6.2, 7, 2], UT: [6.2, 7.85, 2],
      B2d: [11.45, 3.5, 2], B2: [11.5, 4.05, 2], R2d: [16, 0.85, 2], R2: [17, 2.5, 2], R3d: [16, 6.5, 2], R3: [17.6, 6.1, 2], R3a: [19.05, 6.1, 2], R3b: [19.05, 5.1, 2], B3d: [19.5, 5.05, 2], B3: [20.3, 5.1, 2],
    },
    edges: [
      ['T', 'Tl'], ['T', 'Tr'], ['Tl', 'Lg'], ['Lg', 'L'], ['L', 'Ld'], ['Ld', 'Dw'], ['Dw', 'D'], ['D', 'Dg'], ['Dg', 'T'], ['D', 'C'], ['C', 'Cf'], ['Cf', 'S0'], ['S0', 'Ef'], ['Ef', 'E'], ['E', 'Eg'], ['Eg', 'Tr'], ['E', 'Ki'], ['Ki', 'K'], ['E', 'Ea'], ['Ea', 'Gd'], ['Ea', 'Ki'], ['Gd', 'Gi'], ['Gi', 'G'], ['Gi', 'Ga'], ['Ga', 'Bd'], ['Bd', 'B'],
      ['S0', 'S1'], ['S1', 'U'], ['U', 'H'], ['H', 'Hn'], ['Hn', 'Hm'], ['Hm', 'R3d'], ['R3d', 'R3'], ['R3', 'R3a'], ['R3a', 'R3b'], ['R3b', 'B3d'], ['B3d', 'B3'], ['U', 'Wd'], ['Wd', 'W'], ['W', 'Wm'], ['Wm', 'Md'], ['Md', 'Mi'], ['Mi', 'M'], ['M', 'Mg'], ['Mg', 'UT'], ['W', 'B2d'], ['B2d', 'B2'], ['S1', 'R2d'], ['R2d', 'R2'],
    ],
    // ที่กดไปได้เลย: ยืนตรงไหน มองไปทางไหน
    stops: [
      { node: 'Tl', name: 'ระเบียง', look: [20, 12.4] },
      { node: 'L', name: 'ห้องนั่งเล่น', look: [1.5, 2.4] },
      { node: 'D', name: 'ห้องอาหาร', look: [11.1, 0.3], pitch: -0.1 },
      { node: 'K', name: 'ครัว', look: [17.5, 0], pitch: -0.2 },
      { node: 'G', name: 'ห้องนอนแขก', look: [22, 2] },
      { node: 'M', name: 'ห้องนอนใหญ่', look: [5.6, 1], pitch: -0.1 },
      { node: 'B2', name: 'ห้องน้ำใหญ่', look: [10.8, 7.2], pitch: -0.18 },
      { node: 'R2', name: 'ห้องนอน 2', look: [19.5, 0.5] },
      { node: 'UT', name: 'ระเบียงชั้นบน', look: [20, 9.6], pitch: -0.05 },
    ],
  };

  // ตัดผนังเป็นช่วง: ทึบ / ช่องเปิด
  H.segments = function (w) {
    const ops = (w[5] || []).slice().sort(function (p, q) { return p.a - q.a; });
    const out = []; let at = w[2];
    ops.forEach(function (o) {
      if (o.a > at) out.push({ from: at, to: o.a, k: 'solid' });
      out.push({ from: o.a, to: o.b, k: o.k, op: o });
      at = o.b;
    });
    if (at < w[3]) out.push({ from: at, to: w[3], k: 'solid' });
    return out;
  };
  function rectOf(w, from, to) {
    const t = w[4] / 2;
    return w[0] === 'x' ? { x0: from, x1: to, z0: w[1] - t, z1: w[1] + t } : { x0: w[1] - t, x1: w[1] + t, z0: from, z1: to };
  }
  H.rectOf = rectOf;
  // กล่องที่เดินผ่านไม่ได้ของชั้นนั้น (ไม่รวมบันได ตัวเดินจัดการเอง)
  H.solids = function (level) {
    const out = [];
    H.walls[level].forEach(function (w) {
      H.segments(w).forEach(function (s) {
        if (s.k === 'solid' || s.k === 'win' || s.k === 'under') out.push(rectOf(w, s.from, s.to));
        else if (s.k === 'glass') out.push(rectOf(w, s.from, s.from + (s.to - s.from) * 0.35));
      });
    });
    H.items[level].forEach(function (i) {
      if (i.solid === false) return;
      out.push({ x0: i.x, x1: i.x + i.w, z0: i.z, z1: i.z + i.d });
    });
    if (level === 1) {
      [0.3, 6.17, 12.04, 17.91, 23.78].forEach(function (x) { out.push({ x0: x - 0.09, x1: x + 0.09, z0: 9.76, z1: 9.94 }); });
      out.push({ x0: 19.9, x1: 23.3, z0: 7.32, z1: 7.52 }); // ระแนงหน้าห้องนอนแขก
      out.push({ x0: 3, x1: 19, z0: 11.1, z1: 13.7 }); // สระ
      [[0.85, 9.35, 0.3], [23.2, 9.35, 0.3], [8.45, 6.45, 0.23], [0.75, 6.55, 0.17]].forEach(function (q) { out.push({ x0: q[0] - q[2], x1: q[0] + q[2], z0: q[1] - q[2], z1: q[1] + q[2] }); }); // กระถาง
    } else {
      out.push({ x0: 1.8, x1: 21.7, z0: 8.55, z1: 8.7 }, { x0: 1.8, x1: 1.95, z0: 7, z1: 8.7 }, { x0: 21.55, x1: 21.7, z0: 7, z1: 8.7 }); // ราวระเบียง
      out.push({ x0: 14.42, x1: 14.5, z0: 1.6, z1: 6.1 }, { x0: 14.42, x1: 16, z0: 6.1, z1: 6.18 }); // ราวช่องบันได
    }
    return out;
  };
  H.roomAt = function (x, z, level) {
    const list = H.rooms[level];
    for (let i = 0; i < list.length; i++) { const r = list[i]; if (x >= r.x && x <= r.x + r.w && z >= r.z && z <= r.z + r.d) return r; }
    return null;
  };
  // ทางเดินแดดแบบจำลองชุดเดียว ใช้ทั้งแสงในโมเดลและภาพตัดบ้าน
  H.sunAt = function (minutes) {
    const theta = ((minutes / 60 - 6.17) / 12) * Math.PI, elev = Math.sin(theta);
    const x = -Math.cos(theta), y = Math.max(elev, -0.2) * 0.98, z = 0.3 + 0.1 * (1 - Math.abs(elev)), l = Math.hypot(x, y, z);
    return { x: x / l, y: y / l, z: z / l, elev: elev };
  };
  H.areaOf = function (r) { return Math.round(r.w * r.d * 100) / 100; };
  return H;
})();
