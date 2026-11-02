/* walk.js — เดินในบ้าน: ระดับสายตา 1.6 ม. · ชนผนังและเฟอร์นิเจอร์จริง (ข้อมูลชุดเดียวกับแปลน) · ขึ้นลงบันไดได้
   ลากเพื่อมอง · คลิกพื้นเพื่อเดินไปตรงนั้น · W A S D หรือลูกศร · กดชื่อห้องแล้วเดินไปเองผ่านประตู
   ระหว่างเดินเป็นภาพเร็ว พอหยุดภาพละเอียดขึ้นเองจนนิ่ง GPU พัก */
const HD = window.HOUSE;
const F1 = HD.floorY[1], F2 = HD.floorY[2], S = HD.stair;
const R = 0.2, EYE = 1.6;
const SOLIDS = { 1: HD.solids(1), 2: HD.solids(2) };
const BOUNDS = { 1: { x0: -3.4, x1: 35, z0: -2.6, z1: 21 }, 2: { x0: 2.15, x1: 21.35, z0: 0.15, z1: 8.45 } };
const CODE = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyQ: 'q', KeyE: 'e', ArrowUp: 'arrowup', ArrowDown: 'arrowdown', ArrowLeft: 'arrowleft', ArrowRight: 'arrowright', ShiftLeft: 'shift', ShiftRight: 'shift' };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smoother = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

export function floorAt(x, z, level) {
  if (level === 2) return F2;
  if (x > -0.1 && x < 24.1 && z > -0.1 && z < 10.05) return F1;
  if (x > -0.1 && x < 24.1 && z >= 10.05 && z < 10.55) return 0.13;
  if (x > 2.6 && x < 19.4 && z >= 10.1 && z < 14.1) return 0.05;
  return 0.02;
}
function hitRect(x, z, r, pad) { return x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad; }
const STAIR_L1 = { x0: S.x0 - 0.1, x1: S.x1 + 0.1, z0: S.zTop, z1: S.zBottom };
const HOLE_L2 = { x0: S.holeX0, x1: S.holeX1, z0: S.zTop, z1: S.zBottom };
export function blocked(x, z, level, pad) {
  const p = pad == null ? R : pad, b = BOUNDS[level];
  if (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1) return true;
  const list = SOLIDS[level];
  for (let i = 0; i < list.length; i++) if (hitRect(x, z, list[i], p)) return true;
  return hitRect(x, z, level === 1 ? STAIR_L1 : HOLE_L2, p);
}
function clearLine(a, b, level) {
  const d = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(d / 0.08));
  for (let i = 1; i <= n; i++) if (blocked(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, level, R - 0.03)) return false;
  return true;
}
// กราฟทางเดิน: เส้นตรงถ้าไปได้ ไม่งั้นเดินตามจุดผ่านประตู
const GRAPH = {};
Object.keys(HD.nodes).forEach((k) => { GRAPH[k] = []; });
HD.edges.forEach((e) => {
  const a = HD.nodes[e[0]], b = HD.nodes[e[1]], d = Math.hypot(a[0] - b[0], a[1] - b[1]) + (a[2] !== b[2] ? 3 : 0);
  GRAPH[e[0]].push([e[1], d]); GRAPH[e[1]].push([e[0], d]);
});
function nearNodes(x, z, level) {
  const out = [];
  Object.keys(HD.nodes).forEach((k) => {
    const n = HD.nodes[k];
    if (n[2] !== level) return;
    const d = Math.hypot(n[0] - x, n[1] - z);
    if (d < 0.02 || clearLine([x, z], [n[0], n[1]], level)) out.push([k, d]);
  });
  return out.sort((p, q) => p[1] - q[1]).slice(0, 5);
}
export function findPath(from, to) {
  if (from.level === to.level && clearLine([from.x, from.z], [to.x, to.z], from.level)) return [to];
  const starts = nearNodes(from.x, from.z, from.level), goals = nearNodes(to.x, to.z, to.level);
  if (!starts.length || !goals.length) return null;
  const dist = {}, prev = {}, seen = {};
  starts.forEach((s) => { dist[s[0]] = s[1]; });
  for (;;) {
    let u = null, best = Infinity;
    Object.keys(dist).forEach((k) => { if (!seen[k] && dist[k] < best) { best = dist[k]; u = k; } });
    if (u == null) break;
    seen[u] = true;
    GRAPH[u].forEach((e) => { const d = dist[u] + e[1]; if (dist[e[0]] == null || d < dist[e[0]]) { dist[e[0]] = d; prev[e[0]] = u; } });
  }
  let end = null, bestEnd = Infinity;
  goals.forEach((g) => { if (dist[g[0]] != null && dist[g[0]] + g[1] < bestEnd) { bestEnd = dist[g[0]] + g[1]; end = g[0]; } });
  if (end == null) return null;
  const chain = []; let k = end;
  while (k) { const n = HD.nodes[k]; chain.unshift({ x: n[0], z: n[1], level: n[2] }); k = prev[k]; }
  chain.push(to);
  // ตัดจุดที่ไม่จำเป็น เส้นเดินจะไม่หักเป็นมุมฉากตามกราฟ
  const out = []; let cur = from, i = 0;
  while (i < chain.length) {
    let j = chain.length - 1;
    while (j > i && !(chain[j].level === cur.level && chain[i].level === cur.level && clearLine([cur.x, cur.z], [chain[j].x, chain[j].z], cur.level) && sameLevelBetween(chain, i, j))) j--;
    out.push(chain[j]); cur = chain[j]; i = j + 1;
  }
  return out;
}
function sameLevelBetween(c, i, j) { for (let k = i; k <= j; k++) if (c[k].level !== c[i].level) return false; return true; }

export function createWalk(house, ui) {
  const T = house.THREE, cam = { pos: new T.Vector3(), look: new T.Vector3(), fov: 60 };
  const canvas = house.renderer.domElement;
  const mobile = ui.mobile, FOV = mobile ? 74 : 60;
  const st = { x: 11, z: 9.2, level: 1, onStair: false, eyeY: F1 + EYE, yaw: Math.PI, pitch: -0.02, yawT: Math.PI, pitchT: -0.02, active: false, flight: null, path: null, pathI: 0, speed: 0, keys: {}, gazeHold: false, finalLook: null, room: null, focusAt: [0, 0], boost: 1 };
  const reduced = ui.reduced;

  function setRoomUI() {
    const r = st.onStair ? { id: 'stairs', name: 'บันได' } : (HD.roomAt(st.x, st.z, st.level) || { id: 'garden', name: 'สวน', ext: true });
    if (st.room === r.id) return;
    st.room = r.id;
    ui.onRoom(r, st.level);
  }
  function applyCam() {
    const y = st.yaw, p = st.pitch, c = Math.cos(p);
    cam.pos.set(st.x, st.eyeY, st.z);
    cam.look.set(st.x + Math.sin(y) * c, st.eyeY + Math.sin(p), st.z + Math.cos(y) * c);
    cam.fov = FOV;
  }
  const stopInfo = (i) => { const s = HD.stops[i], n = HD.nodes[s.node]; return { x: n[0], z: n[1], level: n[2], look: s.look, name: s.name, pitch: s.pitch }; };
  function yawTo(x, z) { return Math.atan2(x - st.x, z - st.z); }

  function setPath(path, finalLook, finalPitch) {
    if (!path || !path.length) { ui.onBlocked(); return false; }
    st.path = path; st.pathI = 0; st.finalLook = finalLook || null; st.finalPitch = finalPitch == null ? -0.04 : finalPitch; st.gazeHold = false;
    let len = 0, px = st.x, pz = st.z;
    path.forEach((w) => { len += Math.hypot(w.x - px, w.z - pz); px = w.x; pz = w.z; });
    st.pathLen = len;
    st.vMax = len > 14 ? 3.4 : len > 7 ? 2.5 : 1.9;
    house.wake();
    return true;
  }
  function goStop(i) { const s = stopInfo(i); setPath(findPath({ x: st.x, z: st.z, level: st.level }, s), s.look, s.pitch); }
  function walkToPoint(x, z, level) { setPath(findPath({ x: st.x, z: st.z, level: st.level }, { x, z, level })); }

  // ก้าวหนึ่งเฟรมตามทาง
  function stepPath(dt) {
    const w = st.path[st.pathI];
    // ระหว่างบันได: เดินตรงตามแกน z ไม่เช็กชน
    const dx = w.x - st.x, dz = w.z - st.z, d = Math.hypot(dx, dz);
    const last = st.pathI === st.path.length - 1;
    const remaining = d + (last ? 0 : 3);
    const vWant = Math.min(st.vMax, 0.25 + remaining * 1.5);
    st.speed += clamp(vWant - st.speed, -3.2 * dt, 2.4 * dt);
    const step = st.speed * dt;
    if (d <= Math.max(step, 0.03) || (!last && d < 0.3)) {
      st.x = last ? w.x : st.x; st.z = last ? w.z : st.z;
      // เฟรมกระตุกอาจข้ามจุดลงบันไดไปเลย ต้องเช็กสถานะบันไดซ้ำตอนถึงจุด ไม่งั้นค้างอยู่ชั้นเดิม
      updateStairState(dz);
      if (w.level !== st.level && !st.onStair) { st.level = w.level; }
      st.pathI++;
      if (st.pathI >= st.path.length) { st.path = null; st.speed = 0; }
      return;
    }
    st.x += (dx / d) * step; st.z += (dz / d) * step;
    updateStairState(dz);
    if (!st.gazeHold) {
      const ending = st.finalLook && last && d < 1.7;
      st.yawT = ending ? yawTo(st.finalLook[0], st.finalLook[1]) : Math.atan2(dx, dz);
      st.pitchT = st.onStair ? (dz < 0 ? 0.1 : -0.16) : ending ? st.finalPitch : -0.03;
    }
  }
  function updateStairState(dz) {
    const inBand = st.x > S.x0 - 0.05 && st.x < S.x1 + 0.05;
    if (!st.onStair && inBand) {
      if (st.level === 1 && st.z < S.zBottom + 0.28 && dz < 0) st.onStair = true;
      if (st.level === 2 && st.z > S.zTop - 0.28 && dz > 0) st.onStair = true;
    } else if (st.onStair) {
      if (st.z >= S.zBottom + 0.3) { st.onStair = false; st.level = 1; }
      else if (st.z <= S.zTop - 0.3) { st.onStair = false; st.level = 2; }
    }
  }
  function floorNow() {
    if (st.onStair) { const t = clamp((S.zBottom - st.z) / (S.zBottom - S.zTop), 0, 1); return F1 + t * (F2 - F1); }
    return floorAt(st.x, st.z, st.level);
  }
  function stepKeys(dt) {
    const k = st.keys;
    const fwd = (k.w || k.arrowup ? 1 : 0) - (k.s || k.arrowdown ? 1 : 0), side = (k.d ? 1 : 0) - (k.a ? 1 : 0), turn = (k.arrowright || k.e ? 1 : 0) - (k.arrowleft || k.q ? 1 : 0);
    if (turn) { st.yawT -= turn * dt * 1.9; st.gazeHold = true; }
    if (!fwd && !side) { st.speed = Math.max(0, st.speed - 5 * dt); if (st.speed <= 0) return false; }
    else st.speed = Math.min(k.shift ? 3 : 1.9, st.speed + 4.5 * dt);
    if (fwd || side) { st.dirX = Math.sin(st.yawT) * fwd - Math.cos(st.yawT) * side; st.dirZ = Math.cos(st.yawT) * fwd + Math.sin(st.yawT) * side; const l = Math.hypot(st.dirX, st.dirZ) || 1; st.dirX /= l; st.dirZ /= l; st.path = null; }
    const dx = (st.dirX || 0) * st.speed * dt, dz = (st.dirZ || 0) * st.speed * dt;
    if (st.onStair) {
      st.z += dz; st.x = clamp(st.x + dx, S.x0 + 0.18, S.x1 - 0.18);
      updateStairState(dz);
    } else {
      updateStairState(dz);
      if (st.onStair) { st.z += dz; st.x = clamp(st.x, S.x0 + 0.18, S.x1 - 0.18); return true; }
      // ยืนชิดของอยู่แล้ว (เช่นเพิ่งเดินมาตามทาง) ใช้ระยะกันชนเล็กลง ไม่งั้นติดอยู่กับที่ทุกทิศ
      const pad = blocked(st.x, st.z, st.level) ? 0.02 : R;
      if (!blocked(st.x + dx, st.z, st.level, pad)) st.x += dx;
      if (!blocked(st.x, st.z + dz, st.level, pad)) st.z += dz;
    }
    return true;
  }

  function update(dt, now) {
    if (st.flight) {
      const f = st.flight, t = clamp((now - f.t0) / f.dur, 0, 1), e = smoother(t);
      cam.pos.lerpVectors(f.from.pos, f.to.pos, e);
      // โค้งลงเล็กน้อย เหมือนเดินเข้าหาบ้านไม่ใช่พุ่งเป็นเส้นตรง
      cam.pos.y += Math.sin(e * Math.PI) * f.arc;
      cam.look.lerpVectors(f.from.look, f.to.look, smoother(Math.min(1, t * 1.05)));
      cam.fov = f.from.fov + (f.to.fov - f.from.fov) * e;
      if (t >= 1) { const done = f.done; st.flight = null; if (done) done(); }
      return true;
    }
    if (!st.active) return false;
    let moved = false;
    const anyKey = st.keys.w || st.keys.a || st.keys.s || st.keys.d || st.keys.arrowup || st.keys.arrowdown || st.keys.arrowleft || st.keys.arrowright || st.keys.q || st.keys.e;
    if (anyKey || (st.speed > 0 && !st.path)) { if (stepKeys(dt)) moved = true; }
    else if (st.path) { stepPath(dt); moved = true; }
    // มอง: ค่อยๆ หมุน สายตาไม่เหวี่ยง ขอบฟ้านิ่ง
    const rate = st.dragging ? 45 : st.path ? 2.8 : 9;
    const dy = wrap(st.yawT - st.yaw), dp = st.pitchT - st.pitch;
    if (Math.abs(dy) > 0.0006 || Math.abs(dp) > 0.0006) {
      const k = 1 - Math.exp(-dt * rate);
      st.yaw = wrap(st.yaw + dy * k); st.pitch += dp * k;
      moved = true;
    }
    const fy = floorNow() + EYE, dE = fy - st.eyeY;
    if (Math.abs(dE) > 0.0008) { st.eyeY += dE * (1 - Math.exp(-dt * 11)); moved = true; }
    if (moved) {
      applyCam(); setRoomUI(); ui.onMove(st);
      if (Math.hypot(st.x - st.focusAt[0], st.z - st.focusAt[1]) > 1.2) { house.setFocus(st.level, st.x, st.z); st.focusAt = [st.x, st.z]; }
    }
    // ค่าเปิดรับแสง: เข้าในบ้านตาปรับ นอกบ้านหรี่ลง
    const r = HD.roomAt(st.x, st.z, st.level);
    const want = (r && !r.ext) ? ui.boostIn() : 1;
    st.boost += (want - st.boost) * (1 - Math.exp(-dt * 2.2));
    house.setExposureBoost(st.boost);
    return moved;
  }

  // ---------- เมาส์/นิ้ว ----------
  let ptr = null;
  function floorHit(nx, ny) {
    const dir = house.unproject(nx, ny);
    const fy = st.onStair ? floorNow() : floorAt(st.x, st.z, st.level);
    if (dir.y > -0.012) return null;
    const t = (fy - st.eyeY) / dir.y;
    return { x: st.x + dir.x * t, z: st.z + dir.z * t, dir, dist: t };
  }
  const canvasXY = (e) => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height, r]; };
  function reachOf(h) {
    // เดินเส้นตรงไปจนกว่าจะชน: คลิกเลยกำแพงก็เดินไปหยุดที่กำแพง
    const d = Math.hypot(h.x - st.x, h.z - st.z), n = Math.ceil(d / 0.08), lv = st.level;
    let lx = st.x, lz = st.z;
    for (let i = 1; i <= n; i++) {
      const x = st.x + ((h.x - st.x) * i) / n, z = st.z + ((h.z - st.z) * i) / n;
      if (blocked(x, z, lv)) break;
      lx = x; lz = z;
    }
    return [lx, lz, Math.hypot(lx - st.x, lz - st.z)];
  }
  function onDown(e) {
    if (e.button !== 0 && e.button !== 2 && e.pointerType === 'mouse') return;
    ptr = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), yaw: st.yawT, pitch: st.pitchT, moved: false, button: e.button, mouse: e.pointerType === 'mouse' };
    st.dragging = true;
    house.setHold(true);
    try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* ไม่เป็นไร */ }
    ui.hideHint();
  }
  function onMove(e) {
    if (ptr && e.pointerId === ptr.id) {
      const dx = e.clientX - ptr.x, dy = e.clientY - ptr.y;
      if (Math.abs(dx) + Math.abs(dy) > 5) ptr.moved = true;
      if (ptr.moved) {
        // เมาส์หันตามมือแบบเกม ลากจอกว้างหนึ่งจอได้ราว 230° · นิ้วจับภาพแล้วลากแบบแผนที่
        const k = ptr.mouse ? 0.0042 : 0.006, dir = ptr.mouse ? -1 : 1;
        st.yawT = ptr.yaw + dir * dx * k; st.pitchT = clamp(ptr.pitch + dir * dy * k, -0.62, 0.55);
        st.gazeHold = true;
        house.wake();
        ui.reticle(null);
      }
      return;
    }
    if (e.pointerType !== 'mouse' || st.flight || !st.active) return;
    const [nx, ny] = canvasXY(e);
    const h = floorHit(nx, ny);
    if (!h) { ui.reticle(null); return; }
    ui.reticle({ x: e.clientX, y: e.clientY, s: clamp(3.2 / h.dist, 0.25, 1.2), squash: clamp(-h.dir.y * 1.3, 0.2, 1) });
  }
  function onUp(e) {
    if (!ptr || e.pointerId !== ptr.id) return;
    const was = ptr; ptr = null; st.dragging = false;
    house.setHold(false);
    if (was.moved || was.button === 2 || performance.now() - was.t > 500 || st.flight) return;
    const [nx, ny] = canvasXY(e);
    const h = floorHit(nx, ny);
    if (!h) return;
    // คลิกที่บันได = ขึ้นหรือลง
    if (!st.onStair && hitRect(h.x, h.z, st.level === 1 ? STAIR_L1 : HOLE_L2, 0.05)) { goOtherFloor(); return; }
    const [lx, lz, d] = reachOf(h);
    if (d < 0.25) { ui.onBlocked(); return; }
    setPath([{ x: lx, z: lz, level: st.level }]);
  }
  function goOtherFloor() {
    const n = st.level === 1 ? HD.nodes.S1 : HD.nodes.S0;
    setPath(findPath({ x: st.x, z: st.z, level: st.level }, { x: n[0], z: n[1], level: n[2] }));
  }
  function onKey(e) {
    if (!st.active) return;
    if (e.type === 'keydown' && e.key === 'Escape') { exit(); return; }
    // อ่านตำแหน่งปุ่ม (e.code) แป้นไทยปุ่ม W ส่งตัวอักษร "ไ" ถ้าอ่านตัวอักษรจะเดินไม่ไป
    const k = CODE[e.code];
    if (!k) return;
    // โฟกัสอยู่ที่แถบเวลา: ลูกศรใช้เลื่อนแถบ แต่ W A S D ยังเดินได้
    const onRange = e.target && e.target.tagName === 'INPUT';
    if (onRange && k.indexOf('arrow') === 0) return;
    if (e.type === 'keydown') { st.keys[k] = true; ui.hideHint(); e.preventDefault(); house.wake(); } else st.keys[k] = false;
  }
  function onBlur() { st.keys = {}; }
  function noMenu(e) { e.preventDefault(); }

  function attach() {
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('contextmenu', noMenu);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', onBlur);
  }
  function detach() {
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('contextmenu', noMenu);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    window.removeEventListener('blur', onBlur);
  }

  function place(stopIndex) {
    const s = stopInfo(stopIndex == null ? 0 : stopIndex);
    st.x = s.x; st.z = s.z; st.level = s.level; st.onStair = false; st.path = null; st.speed = 0; st.keys = {};
    st.yaw = st.yawT = Math.atan2(s.look[0] - s.x, s.look[1] - s.z);
    st.pitch = st.pitchT = s.pitch == null ? -0.04 : s.pitch;
    st.eyeY = floorAt(s.x, s.z, s.level) + EYE;
    st.room = null; st.focusAt = [s.x, s.z];
    house.setFocus(s.level, s.x, s.z);
    applyCam();
    setRoomUI();
    ui.onMove(st);
  }
  function enter(stopIndex) {
    if (st.active || st.flight) { if (stopIndex != null && st.active) goStop(stopIndex); return; }
    attach();
    ui.onEnter();
    house.setController(update);
    const fromOutside = stopIndex == null && !reduced;
    if (fromOutside) {
      // บินจากภาพไกลลงมาหยุดที่ระเบียงระดับสายตา มองเข้าไปในบ้าน
      const start = { x: 5.9, z: 9.4, look: [4.4, 3.4] };
      const from = house.heroPose();
      st.x = start.x; st.z = start.z; st.level = 1; st.onStair = false;
      st.eyeY = F1 + EYE; st.yaw = st.yawT = Math.atan2(start.look[0] - start.x, start.look[1] - start.z); st.pitch = st.pitchT = -0.03; st.room = null;
      applyCam();
      const to = { pos: cam.pos.clone(), look: cam.look.clone(), fov: FOV };
      cam.pos.copy(from.pos); cam.look.copy(from.look); cam.fov = from.fov;
      house.setCam(cam);
      house.setFocus(0, 12, 5);
      house.setPaused(false);
      st.flight = { from: { pos: from.pos.clone(), look: from.look.clone(), fov: from.fov }, to, t0: performance.now(), dur: 3000, arc: 1.2, done: () => {
        st.active = true; house.setFocus(1, st.x, st.z); st.focusAt = [st.x, st.z]; setRoomUI(); applyCam(); ui.onMove(st); ui.onArrive();
      } };
    } else {
      ui.fade(true, () => {
        place(stopIndex == null ? 0 : stopIndex);
        house.setCam(cam);
        house.setPaused(false);
        st.active = true; ui.onArrive();
        ui.fade(false);
      });
    }
  }
  function exit() {
    if (!st.active && !st.flight) return;
    st.active = false; st.flight = null; st.path = null; st.keys = {};
    ui.onExitStart();
    ui.fade(true, () => {
      detach();
      house.setController(null);
      house.setPaused(true);
      house.setCam(null);
      house.setFocus(0, 12, 5);
      st.boost = 1; house.setExposureBoost(1);
      ui.onExit();
      ui.fade(false);
    });
  }
  return { enter, exit, goStop, goOtherFloor, walkToPoint, state: () => st, isActive: () => st.active || !!st.flight };
}
