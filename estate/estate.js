/* estate.js — ร่มเงา เรสซิเดนซ์: เวลาแดด · เดินในบ้าน · แบบแปลน · ผังแปลง · ฟอร์มนัดชม
   เปิดเว็บกี่โมง บ้านเป็นแสงเวลานั้น ลากแถบแล้วแสงทั้งบ้านเปลี่ยนตามจริง */
(function () {
  'use strict';
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  const HD = window.HOUSE;

  // ---------- เวลาแดด ----------
  // ภาพนิ่งเรนเดอร์จากโมเดลเดียวกับที่เดินได้ ลากแถบแล้วเลื่อนระหว่างภาพ จอแนวตั้งมีชุดของตัวเอง
  const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 900;
  const KEY = [
    { t: 375, img: '0615' }, { t: 500, img: '0820' }, { t: 600, img: '1000' }, { t: 750, img: '1230' }, { t: 900, img: '1500' },
    { t: 1000, img: '1640' }, { t: 1065, img: '1745' }, { t: 1105, img: '1825' }, { t: 1170, img: '1930' },
  ];
  const stage = $('#stage');
  const layers = {};
  function addLayer(name, eager) {
    if (layers[name]) return;
    const im = new Image();
    im.alt = '';
    im.decoding = 'async';
    if (portrait) { im.width = 780; im.height = 1690; im.src = 'art/m-sun-' + name + '.webp'; }
    else {
      im.width = 1920; im.height = 1080;
      im.srcset = 'art/sun-' + name + '-960.webp 960w, art/sun-' + name + '.webp 1920w';
      im.sizes = '100vw';
      im.src = 'art/sun-' + name + '.webp';
    }
    if (eager) im.fetchPriority = 'high';
    im.dataset.name = name;
    stage.appendChild(im);
    layers[name] = im;
  }
  const params = new URLSearchParams(location.search);
  function parseT(s) { const m = /^(\d{1,2}):(\d{2})$/.exec(s || ''); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
  function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
  const start = Math.min(1320, Math.max(360, parseT(params.get('t')) != null ? parseT(params.get('t')) : nowMinutes()));

  let sec = null;
  const secInput = $('#secTime');
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function sentence(t) {
    if (t < 420) return 'ก่อนแดดออก บ้านยังเย็นจากกลางคืน';
    if (t < 600) return 'แดดเช้าผ่านระแนงเข้าห้องนั่งเล่นฝั่งตะวันออก';
    if (t < 840) return 'แดดอยู่เหนือหัว เข้าได้แค่ขอบระเบียง';
    if (t < 1020) return 'แดดบ่ายอยู่ทิศตะวันตก ระแนงหน้าห้องนอนแขกรับไว้';
    if (t < 1100) return 'แดดต่ำลอดใต้ชายคา เข้าถึงพื้นห้องนั่งเล่น';
    return 'เปิดไฟในบ้าน ระเบียงยังนั่งต่อได้';
  }
  function setTime(t) {
    let i = 0;
    while (i < KEY.length - 2 && t >= KEY[i + 1].t) i++;
    const a = KEY[i], b = KEY[i + 1];
    const k = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
    // ภาพที่ยังโหลดไม่เสร็จห้ามจาง ไม่งั้นจอวูบเป็นสีพื้น ให้ภาพที่มีอยู่รับแทนเต็มตัว
    const ready = function (n) { return layers[n] && layers[n].complete && layers[n].naturalWidth > 0; };
    let wa = 1 - k, wb = k;
    if (a.img !== b.img && !ready(b.img) && ready(a.img)) { wa = 1; wb = 0; }
    if (a.img !== b.img && !ready(a.img) && ready(b.img)) { wa = 0; wb = 1; }
    Object.keys(layers).forEach(function (n) {
      const on = (n === a.img ? wa : 0) + (n === b.img ? wb : 0);
      layers[n].style.opacity = String(on);
      // ภาพที่ไม่แสดงต้องไม่กินการ์ดจอ
      layers[n].style.visibility = on > 0 ? 'visible' : 'hidden';
    });
    const label = pad(Math.floor(t / 60)) + ':' + pad(t % 60);
    $('#clock').textContent = label;
    $('#sunLine').textContent = sentence(t);
    $('#wClock').textContent = label;
    $('#wTime').value = String(t);
    if (sec) { secInput.value = String(t); sec.update(t); }
    const arrow = $('#sunArrow');
    if (arrow) {
      arrow.setAttribute('transform', 'rotate(' + Math.round(((t - 720) / 360) * 90) + ')');
      arrow.style.display = t >= 360 && t <= 1090 ? '' : 'none';
    }
  }
  const input = $('#time');
  input.value = String(start);
  function userTime(v) { input.value = String(v); ensureLayers(v); setTime(v); if (house) house.setTime(v, true); }
  // ภาพเวลาอื่นโหลดตอนคนเริ่มแตะแถบเท่านั้น คนที่ไม่แตะไม่ต้องโหลด
  function ensureLayers(t) { let i = 0; while (i < KEY.length - 2 && t >= KEY[i + 1].t) i++; addLayer(KEY[i].img); addLayer(KEY[i + 1].img); }
  function loadAllStills() { KEY.forEach(function (k) { addLayer(k.img); }); }
  input.addEventListener('pointerdown', loadAllStills);
  input.addEventListener('keydown', loadAllStills);
  input.addEventListener('input', function () { userTime(Number(input.value)); });
  $('#wTime').addEventListener('input', function (e) { userTime(Number(e.target.value)); });

  // หน้าบ้านเป็นภาพนิ่งเสมอ เลื่อนลื่นบนทุกเครื่อง · 3D เปิดเมื่อกดเดินเข้าบ้านเท่านั้น และหยุดทำงานเมื่อออกมา
  let house = null, walk = null, booting = null;
  const canGL = (function () { try { const c = document.createElement('canvas').getContext('webgl2'); return !!(c && c.getExtension('EXT_color_buffer_float')); } catch (x) { return false; } })();
  const use3D = canGL && params.get('still') !== '1';
  const mobile = matchMedia('(max-width: 899px)').matches;
  const enterBtn = $('#enterBtn');
  const debugBoot = params.get('boot') === '1';
  let canvasEl = null;
  function boot3D() {
    if (booting) return booting;
    booting = Promise.all([import('./house3d.js'), import('./walk.js')]).then(function (ms) {
      canvasEl = document.createElement('canvas');
      canvasEl.className = 'house3d';
      stage.appendChild(canvasEl);
      return ms[0].createHouse(canvasEl, { mobile: mobile, samples: Number(params.get('samples')) || 0, debug: params.get('debug') === '1', quality: params.get('q'), pv: Number(params.get('pv')) || 0, paused: !debugBoot }).then(function (h) {
        house = h;
        window.__house = house;
        window.__readyMs = Math.round(performance.now());
        house.setTime(Number(input.value));
        if (debugBoot) canvasEl.classList.add('on');
        walk = ms[1].createWalk(house, walkUI(mobile));
        window.__walk = walk;
        window.__walkLib = ms[1];
        return walk;
      });
    }).catch(function (x) {
      console.warn('3D ใช้ไม่ได้ ใช้ภาพนิ่งต่อ', x && x.message);
      enterBtn.hidden = true;
      return null;
    });
    return booting;
  }
  function enterHouse(i) {
    if (!use3D) return;
    if (walk) { walk.enter(i); return; }
    enterBtn.textContent = 'กำลังเตรียมบ้าน';
    enterBtn.setAttribute('aria-busy', 'true');
    boot3D().then(function (w) {
      enterBtn.textContent = 'เดินเข้าไปในบ้าน';
      enterBtn.removeAttribute('aria-busy');
      if (w) w.enter(i);
    });
  }
  ensureLayers(start);
  setTime(start);
  if (use3D) {
    enterBtn.hidden = false;
    enterBtn.addEventListener('click', function () { lastFocus = this; enterHouse(); });
    // เอาเมาส์มาจ่อปุ่มก็เริ่มเตรียมเลย กดแล้วจะรอสั้นลง
    enterBtn.addEventListener('pointerenter', boot3D, { once: true });
    if (debugBoot) boot3D();
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches && params.get('motion') !== '1';

  // ---------- เดินในบ้าน ----------
  let lastFocus = null, scrollBack = 0, noteTimer = 0;
  function behind() { return document.querySelectorAll('.top, .heroText, .sun, main > section:not(.hero), .foot'); }
  function walkUI(mobile) {
    const ui = $('#walkUI'), fadeEl = $('#walkFade'), hint = $('#wHint'), note = $('#wNote'), ret = $('#wReticle');
    let curStop = -1, mapLevel = 0, meEl = null;
    hint.textContent = mobile ? 'ลากเพื่อมองรอบตัว · แตะพื้นเพื่อเดิน' : 'ลากเมาส์เพื่อหัน · คลิกพื้นเพื่อเดิน · W A S D เดิน · Q E หัน';
    $('#wStops').innerHTML = HD.stops.map(function (s, i) { return '<button type="button" data-go="' + i + '">' + esc(s.name) + '</button>'; }).join('');
    $('#wStops').addEventListener('click', function (e) {
      const b = e.target.closest('[data-go]');
      if (b && walk) { hideHint(); walk.goStop(Number(b.dataset.go)); }
    });
    $('#wExit').addEventListener('click', function () { if (walk) walk.exit(); });
    $('#wFloorBtn').addEventListener('click', function () { if (walk) { hideHint(); walk.goOtherFloor(); } });
    function hideHint() { hint.classList.add('off'); }
    function drawMap(level) {
      mapLevel = level;
      const s = 34, X = function (m) { return +(m * s).toFixed(1); };
      let o = '';
      HD.rooms[level].forEach(function (r) {
        if (r.ext) o += '<rect class="mExt" x="' + X(r.x) + '" y="' + X(r.z) + '" width="' + X(r.w) + '" height="' + X(r.d) + '"/>';
      });
      HD.walls[level].forEach(function (w) {
        HD.segments(w).forEach(function (seg) {
          const q = HD.rectOf(w, seg.from, seg.to);
          if (seg.k === 'solid' || seg.k === 'under') o += '<rect class="mWall" x="' + X(q.x0) + '" y="' + X(q.z0) + '" width="' + Math.max(1.5, X(q.x1 - q.x0)) + '" height="' + Math.max(1.5, X(q.z1 - q.z0)) + '"/>';
          else if (seg.k === 'glass' || seg.k === 'win') { const m = w[1]; o += w[0] === 'x' ? '<path class="mOpen" d="M' + X(seg.from) + ' ' + X(m) + 'H' + X(seg.to) + '"/>' : '<path class="mOpen" d="M' + X(m) + ' ' + X(seg.from) + 'V' + X(seg.to) + '"/>'; }
        });
      });
      HD.rooms[level].forEach(function (r) { o += '<rect class="mRoom" data-mx="' + (r.x + r.w / 2) + '" data-mz="' + (r.z + r.d / 2) + '" x="' + X(r.x) + '" y="' + X(r.z) + '" width="' + X(r.w) + '" height="' + X(r.d) + '"><title>' + esc(r.name) + '</title></rect>'; });
      o += '<g id="wMe"><path class="mMe" d="M0 0L-13 24A27 27 0 0 0 13 24Z" opacity=".55"/><circle class="mMe" r="6"/></g>';
      $('#wMap').innerHTML = o;
      meEl = $('#wMe');
    }
    $('#wMap').addEventListener('click', function (e) {
      const r = e.target.closest('[data-mx]');
      if (!r || !walk) return;
      hideHint();
      // ไปห้องที่กด: เลือกจุดเดินที่ใกล้กลางห้องที่สุด
      let best = null, bd = 1e9;
      Object.keys(HD.nodes).forEach(function (k) { const n = HD.nodes[k]; if (n[2] !== mapLevel) return; const d = Math.hypot(n[0] - r.dataset.mx, n[1] - r.dataset.mz); if (d < bd) { bd = d; best = n; } });
      if (best) walk.walkToPoint(best[0], best[1], best[2]);
    });
    return {
      mobile: mobile, reduced: reduced,
      boostIn: function () { return 1.7; },
      fade: function (on, then) {
        fadeEl.classList.toggle('on', on);
        if (then) setTimeout(then, reduced ? 40 : 340);
      },
      onEnter: function () {
        scrollBack = window.scrollY;
        behind().forEach(function (el) { el.inert = true; });
        document.body.classList.add('walking');
        if (canvasEl) canvasEl.classList.add('on');
        ui.hidden = false; ui.classList.remove('off');
        hint.classList.remove('off');
        // โฟกัสที่กล่อง ไม่ใช่ปุ่มออก กด Space แล้วจะได้ไม่หลุดออกจากบ้านโดยไม่ตั้งใจ
        ui.focus({ preventScroll: true });
        ui.style.opacity = '0';
      },
      onArrive: function () {
        ui.style.transition = 'opacity .5s'; ui.style.opacity = '1';
        setTimeout(hideHint, 9000);
      },
      onExitStart: function () { ui.style.opacity = '0'; },
      onExit: function () {
        behind().forEach(function (el) { el.inert = false; });
        document.body.classList.remove('walking');
        if (canvasEl) canvasEl.classList.remove('on');
        ui.hidden = true;
        window.scrollTo(0, scrollBack);
        if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
      },
      onRoom: function (room, level) {
        $('#wRoom').textContent = room.name;
        $('#wFloor').textContent = 'ชั้น ' + level;
        $('#wFloorBtn').textContent = level === 1 ? 'ขึ้นชั้นบน' : 'ลงชั้นล่าง';
        if (mapLevel !== level) drawMap(level);
        let cur = -1;
        HD.stops.forEach(function (s, i) { const n = HD.nodes[s.node], r = HD.roomAt(n[0], n[1], n[2]); if (r && r.id === room.id) cur = i; });
        if (cur !== curStop) {
          curStop = cur;
          document.querySelectorAll('#wStops button').forEach(function (b, i) { if (i === cur) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
        }
      },
      onMove: function (st) {
        if (!meEl) return;
        meEl.setAttribute('transform', 'translate(' + (st.x * 34).toFixed(1) + ' ' + (st.z * 34).toFixed(1) + ') rotate(' + (-st.yaw * 57.2958).toFixed(1) + ')');
      },
      onBlocked: function () {
        note.textContent = 'ไปทางนั้นไม่ได้';
        note.classList.add('on');
        clearTimeout(noteTimer);
        noteTimer = setTimeout(function () { note.classList.remove('on'); }, 1300);
      },
      hideHint: hideHint,
      reticle: function (r) {
        if (!r) { ret.classList.remove('on'); return; }
        ret.classList.add('on');
        ret.style.transform = 'translate(' + r.x + 'px,' + r.y + 'px) scale(' + r.s.toFixed(3) + ',' + (r.s * r.squash).toFixed(3) + ')';
      },
    };
  }
  document.addEventListener('click', function (e) {
    const b = e.target.closest('[data-stop]') || (e.target.closest('.shot') && e.target.closest('.shot').querySelector('[data-stop]'));
    if (b && (e.target.closest('[data-stop]') || e.target.closest('.go'))) { lastFocus = b; enterHouse(Number(b.dataset.stop)); }
  });

  // ---------- แบบแปลน: วาดจากข้อมูลชุดเดียวกับโมเดล 3D ----------
  // หน่วยเมตร × S · ด้านล่างของแปลนคือทิศเหนือ (ระเบียงหันเหนือ) · เลขพื้นที่คือ กว้าง × ลึก จริงของห้องนั้น
  const S = 34, OX = 74, OY = 58;
  const X = function (m) { return +(OX + m * S).toFixed(1); };
  const Y = function (m) { return +(OY + m * S).toFixed(1); };
  function fmtArea(a) { return (Math.round(a * 10) / 10).toString(); }
  function rectM(cls, x0, z0, x1, z1) { return '<rect class="' + cls + '" x="' + X(x0) + '" y="' + Y(z0) + '" width="' + ((x1 - x0) * S).toFixed(1) + '" height="' + ((z1 - z0) * S).toFixed(1) + '"/>'; }
  function drawFloor(level) {
    let s = '';
    HD.walls[level].forEach(function (w) {
      const isX = w[0] === 'x', c = w[1], g = 2.5;
      HD.segments(w).forEach(function (seg) {
        const q = HD.rectOf(w, seg.from, seg.to);
        if (seg.k === 'solid' || seg.k === 'under') { s += rectM('poche', q.x0, q.z0, q.x1, q.z1); return; }
        if (seg.k === 'glass' || seg.k === 'win') {
          s += isX ? '<path class="thin" d="M' + X(seg.from) + ' ' + (Y(c) - g) + 'H' + X(seg.to) + 'M' + X(seg.from) + ' ' + (Y(c) + g) + 'H' + X(seg.to) + '"/>' : '<path class="thin" d="M' + (X(c) - g) + ' ' + Y(seg.from) + 'V' + Y(seg.to) + 'M' + (X(c) + g) + ' ' + Y(seg.from) + 'V' + Y(seg.to) + '"/>';
          if (seg.op.slats) { const off = seg.op.slats * 0.42; for (let m = seg.from; m < seg.to; m += 0.2) s += '<path class="hair" d="M' + X(c + off - 0.07) + ' ' + Y(m) + 'H' + X(c + off + 0.07) + '"/>'; }
          return;
        }
        if (seg.k === 'door') {
          const r = (seg.to - seg.from) * S, side = seg.op.side || 1, atB = seg.op.hinge === 'b';
          if (isX) { const hx = X(atB ? seg.to : seg.from), dir = atB ? -1 : 1; s += '<path class="hair" d="M' + hx + ' ' + Y(c) + 'v' + (r * side) + 'A' + r + ' ' + r + ' 0 0 ' + ((side * dir > 0) ? 0 : 1) + ' ' + (hx + r * dir) + ' ' + Y(c) + '"/>'; }
          else { const hy = Y(atB ? seg.to : seg.from), dir = atB ? -1 : 1; s += '<path class="hair" d="M' + X(c) + ' ' + hy + 'h' + (r * side) + 'A' + r + ' ' + r + ' 0 0 ' + ((side * dir > 0) ? 1 : 0) + ' ' + X(c) + ' ' + (hy + r * dir) + '"/>'; }
        }
      });
    });
    HD.items[level].forEach(function (i) {
      const x0 = i.x, z0 = i.z, x1 = i.x + i.w, z1 = i.z + i.d;
      if (i.t === 'rug') s += rectM('hair dash soft', x0, z0, x1, z1);
      else if (i.t === 'pendant' || i.t === 'lamp') return;
      else if (i.t === 'bed') { s += rectM('hair', x0, z0, x1, z1) + rectM('hair', x0 + 0.08, z0 + 0.05, x0 + i.w / 2 - 0.04, z0 + 0.4) + rectM('hair', x0 + i.w / 2 + 0.04, z0 + 0.05, x1 - 0.08, z0 + 0.4); }
      else if (i.t === 'plant') s += '<circle class="hair" cx="' + X((x0 + x1) / 2) + '" cy="' + Y((z0 + z1) / 2) + '" r="' + (i.w * S * 0.5) + '"/>';
      else s += rectM('hair', x0, z0, x1, z1);
    });
    // บันได
    const st = HD.stair, run = (st.zBottom - st.zTop) / st.steps;
    let tread = '';
    for (let k = 0; k <= st.steps; k++) tread += 'M' + X(st.x0) + ' ' + Y(st.zBottom - k * run) + 'H' + X(st.x1);
    s += '<path class="hair" d="' + tread + '"/>' + rectM('thin', st.x0, st.zTop, st.x1, st.zBottom);
    if (level === 1) {
      [0.3, 6.17, 12.04, 17.91, 23.78].forEach(function (m) { s += '<rect class="post" x="' + (X(m) - 3) + '" y="' + (Y(9.85) - 3) + '" width="6" height="6"/>'; });
      for (let m = 19.9; m < 23.3; m += 0.24) s += '<path class="thin" d="M' + X(m) + ' ' + Y(7.42) + 'v-5"/>';
      s += '<rect class="poolFill" x="' + X(3) + '" y="' + Y(11.1) + '" width="' + 16 * S + '" height="' + 2.6 * S + '"/><rect class="thin" x="' + X(3) + '" y="' + Y(11.1) + '" width="' + 16 * S + '" height="' + 2.6 * S + '"/>';
      s += '<text class="lblS halo" x="' + X(11) + '" y="' + (Y(12.4) + 4) + '" text-anchor="middle">สระ 16 × 2.6 ม.</text>';
      s += dimLine(X(0), Y(0) - 34, X(24), Y(0) - 34, '24.00') + dimLine(X(0) - 32, Y(0), X(0) - 32, Y(7), '7.00') + dimLine(X(0) - 32, Y(7), X(0) - 32, Y(10), '3.00');
    } else {
      for (let m = 10.2; m < 16.7; m += 0.26) s += '<path class="thin" d="M' + X(m) + ' ' + Y(8.45) + 'v-8"/>';
      s += '<text class="lblS" x="' + X(13.4) + '" y="' + (Y(8.45) + 16) + '" text-anchor="middle">ระแนงไม้บังแดด</text>';
      s += dimLine(X(2), Y(0) - 34, X(21.5), Y(0) - 34, '19.50') + dimLine(X(2) - 32, Y(0), X(2) - 32, Y(7), '7.00');
    }
    s += '<rect class="hair dash" x="' + X(-0.9) + '" y="' + Y(-0.9) + '" width="' + 25.8 * S + '" height="' + 11.3 * S + '"/>';
    s += '<text class="lblS" x="' + X(25) + '" y="' + (Y(-0.9) - 6) + '" text-anchor="end">ขอบหลังคา</text>';
    return s;
  }
  let floor = 1, selected = null;
  function dimLine(x1, y1, x2, y2, label) {
    const horiz = y1 === y2;
    const t = 5;
    const ticks = horiz
      ? '<path class="hair" d="M' + x1 + ' ' + (y1 - t) + 'V' + (y1 + t) + 'M' + x2 + ' ' + (y2 - t) + 'V' + (y2 + t) + '"/>'
      : '<path class="hair" d="M' + (x1 - t) + ' ' + y1 + 'H' + (x1 + t) + 'M' + (x2 - t) + ' ' + y2 + 'H' + (x2 + t) + '"/>';
    const tx = horiz ? (x1 + x2) / 2 : x1 - 8;
    const ty = horiz ? y1 - 7 : (y1 + y2) / 2;
    const attr = horiz ? 'text-anchor="middle"' : 'text-anchor="middle" transform="rotate(-90 ' + tx + ' ' + ty + ')"';
    return '<path class="hair" d="M' + x1 + ' ' + y1 + 'L' + x2 + ' ' + y2 + '"/>' + ticks + '<text class="lblS" x="' + tx + '" y="' + ty + '" ' + attr + '>' + label + '</text>';
  }
  function stopForRoom(r) {
    let idx = -1;
    HD.stops.forEach(function (s, i) { const n = HD.nodes[s.node]; if (n[2] === floor && HD.roomAt(n[0], n[1], n[2]) === r) idx = i; });
    return idx;
  }
  function renderPlan() {
    const rooms = HD.rooms[floor];
    let s = '';
    rooms.forEach(function (r) {
      s += '<rect class="roomArea' + (r.ext ? ' ext' : '') + (selected === r.id ? ' on' : '') + '" data-room="' + r.id + '" x="' + X(r.x) + '" y="' + Y(r.z) + '" width="' + r.w * S + '" height="' + r.d * S + '"/>';
    });
    s += drawFloor(floor);
    rooms.forEach(function (r) {
      if (r.tiny) { s += '<text class="lblS halo" x="' + X(r.lx) + '" y="' + Y(r.lz) + '" text-anchor="middle">' + r.name + '</text>'; return; }
      s += '<text class="lbl halo" x="' + X(r.lx) + '" y="' + Y(r.lz) + '" text-anchor="middle">' + r.name + '</text>';
      s += '<text class="lblS halo" x="' + X(r.lx) + '" y="' + (Y(r.lz) + 17) + '" text-anchor="middle">' + fmtArea(HD.areaOf(r)) + ' ตร.ม.</text>';
    });
    // วงทิศ: เหนืออยู่ล่าง จุดคือตำแหน่งแดดตามแถบเวลา + สเกล
    s += '<g transform="translate(934 556)"><circle r="30" class="hair"/><path d="M0 30 L-5 18 H5 Z" class="poche"/><text class="lblS" y="46" text-anchor="middle">เหนือ</text><g id="sunArrow"><circle cy="-30" r="6" class="poche"/></g></g>';
    s += '<g transform="translate(74 596)"><path class="thin" d="M0 0V6H' + 5 * S + 'V0M' + S + ' 0V6M' + 2 * S + ' 0V6"/><text class="lblS" x="0" y="-5" text-anchor="middle">0</text><text class="lblS" x="' + S + '" y="-5" text-anchor="middle">1</text><text class="lblS" x="' + 2 * S + '" y="-5" text-anchor="middle">2</text><text class="lblS" x="' + 5 * S + '" y="-5" text-anchor="middle">5 ม.</text></g>';
    $('#planSvg').innerHTML = s;
    const total = rooms.reduce(function (n, r) { return n + HD.areaOf(r); }, 0);
    $('#rooms').innerHTML = rooms.map(function (r) {
      const on = selected === r.id, stop = stopForRoom(r);
      const go = on && stop >= 0 && canGL && params.get('still') !== '1' ? '<span class="roomGo"><button type="button" data-stop="' + stop + '">เดินไปห้องนี้</button></span>' : '';
      return '<li><button type="button" data-room="' + r.id + '" aria-pressed="' + on + '"><span>' + r.name + '</span><span class="rA">' + fmtArea(HD.areaOf(r)) + ' ตร.ม.</span></button>' + go + '</li>';
    }).join('') + '<li class="roomsTotal"><span>รวม' + (floor === 1 ? 'ชั้น 1' : 'ชั้น 2') + '</span><span>' + fmtArea(total) + ' ตร.ม.</span></li>';
    setTime(Number(input.value));
  }
  document.addEventListener('click', function (e) {
    const fl = e.target.closest('[data-floor]');
    if (fl) {
      floor = Number(fl.dataset.floor); selected = null;
      document.querySelectorAll('[data-floor]').forEach(function (b) { b.setAttribute('aria-pressed', String(b === fl)); });
      renderPlan();
      return;
    }
    const room = e.target.closest('[data-room]');
    if (room) {
      selected = selected === room.dataset.room ? null : room.dataset.room;
      renderPlan();
    }
  });

  // ---------- ผังแปลง ----------
  const PLOTS = [
    { no: 1, x: 90, y: 90, w: 230, h: 180, r: 0, size: 280, price: 38.5, faces: 'ทิศเหนือ', sun: 'เที่ยงวันแดดเข้าแค่ขอบระเบียง', state: 'ว่าง' },
    { no: 2, x: 360, y: 70, w: 230, h: 180, r: 0, size: 295, price: 39.9, faces: 'ทิศเหนือ', sun: 'เที่ยงวันแดดเข้าแค่ขอบระเบียง', state: 'จองแล้ว' },
    { no: 3, x: 630, y: 90, w: 270, h: 190, r: 0, size: 340, price: 44, faces: 'ทิศเหนือ มองเห็นเขา', sun: 'เที่ยงวันแดดเข้าแค่ขอบระเบียง', state: 'ว่าง' },
    { no: 4, x: 90, y: 380, w: 230, h: 180, r: 0, size: 270, price: 38.5, faces: 'ทิศใต้', sun: 'โดนแดดตรงมากกว่าแปลงทิศเหนือ', state: 'ขายแล้ว' },
    { no: 5, x: 360, y: 400, w: 230, h: 180, r: 0, size: 275, price: 39.5, faces: 'ทิศใต้', sun: 'โดนแดดตรงมากกว่าแปลงทิศเหนือ', state: 'ว่าง' },
    { no: 6, x: 630, y: 380, w: 270, h: 190, r: 0, size: 320, price: 42.5, faces: 'ทิศใต้ ติดลำธาร', sun: 'โดนแดดตรงมากกว่าแปลงทิศเหนือ', state: 'ว่าง' },
  ];
  let plot = PLOTS[0];
  function renderSite() {
    let s = '';
    // เส้นชั้นความสูง: ที่ดินลาดลงไปทางลำธาร
    [[70, 40], [150, 30], [235, 22], [470, 26], [545, 34], [612, 44]].forEach(function (c, i) {
      s += '<path class="contour" d="M0 ' + c[0] + ' C210 ' + (c[0] - c[1]) + ' 390 ' + (c[0] + c[1]) + ' 560 ' + c[0] + ' S860 ' + (c[0] - c[1]) + ' 1000 ' + (c[0] + (i % 2 ? 10 : -8)) + '"/>';
    });
    // ลำธารขอบใต้
    s += '<path class="stream" d="M1000 588 C900 600 800 628 690 612 S520 640 430 640"/><text class="lblS" x="836" y="628" text-anchor="middle">ลำธาร</text>';
    s += '<path class="road" d="M0 322 C200 302 330 342 500 322 S820 302 1000 332"/>';
    s += '<text class="lblS" x="500" y="326" text-anchor="middle">ถนนในโครงการ</text>';
    PLOTS.forEach(function (p) {
      const sold = p.state === 'ขายแล้ว';
      const top = p.y < 300; // แถวบนระเบียงหันเหนือ (ขึ้น) แถวล่างหันใต้ (ลง)
      const bw = p.w * 0.6, bh = 24, bx = p.x + (p.w - bw) / 2;
      const by = top ? p.y + 66 : p.y + p.h - 66 - bh;
      const ty = top ? by - 14 : by + bh, py = top ? by - 34 : by + bh + 20;
      s += '<g class="plotG' + (sold ? ' sold' : '') + (plot && plot.no === p.no ? ' on' : '') + '" data-plot="' + p.no + '"' + (sold ? '' : ' tabindex="0" role="button" aria-pressed="' + (plot && plot.no === p.no) + '" aria-label="แปลง ' + p.no + ' ' + p.state + ' ' + p.price + ' ล้านบาท"') + '>' +
        '<rect class="plot" x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '"/>' +
        '<rect class="poche" x="' + bx + '" y="' + by + '" width="' + bw + '" height="' + bh + '" style="pointer-events:none"/>' +
        '<rect class="hair" x="' + bx + '" y="' + ty + '" width="' + bw + '" height="14" style="pointer-events:none"/>' +
        '<rect class="hair poolMini" x="' + (bx + bw * 0.12) + '" y="' + py + '" width="' + bw * 0.66 + '" height="11" style="pointer-events:none"/>';
      // ต้นไม้ที่มุมแปลงด้านถนน
      [0.1, 0.16, 0.88].forEach(function (k, i) {
        s += '<circle class="hair" style="pointer-events:none" cx="' + (p.x + p.w * k) + '" cy="' + (top ? p.y + p.h - 22 - i * 6 : p.y + 24 + i * 6) + '" r="' + (9 + i * 2) + '"/>';
      });
      s += '<text class="plotNo" x="' + (p.x + p.w * 0.5) + '" y="' + (top ? p.y + p.h - 28 : p.y + 42) + '" text-anchor="middle">' + p.no + '</text>' +
        '<text class="plotSt" x="' + (p.x + p.w * 0.5) + '" y="' + (top ? p.y + p.h - 10 : p.y + 60) + '" text-anchor="middle">' + (p.state === 'ว่าง' ? p.price + ' ล้าน' : p.state) + '</text></g>';
    });
    s += '<g transform="translate(956 44)"><circle r="16" class="hair"/><path d="M0 -16 L-5 -3 H5 Z" class="poche"/><text class="lblS" y="32" text-anchor="middle">เหนือ</text></g>';
    $('#siteSvg').innerHTML = s;
    const c = $('#plotCard');
    if (!plot) { c.innerHTML = '<p>เลือกแปลงบนผัง</p>'; return; }
    c.innerHTML = '<h3>แปลง ' + plot.no + '</h3><dl>' +
      '<dt>ราคา</dt><dd>' + plot.price + ' ล้านบาท</dd>' +
      '<dt>ที่ดิน</dt><dd>' + plot.size + ' ตร.ว.</dd>' +
      '<dt>ระเบียงหัน</dt><dd>' + esc(plot.faces) + '</dd>' +
      '<dt>แดดบนระเบียง</dt><dd>' + esc(plot.sun) + '</dd>' +
      '<dt>สถานะ</dt><dd>' + esc(plot.state) + '</dd></dl>' +
      (plot.state === 'ว่าง' ? '<a class="btnMain" href="#visit" data-want="' + plot.no + '">นัดชมแปลงนี้</a>' : '<p>แปลงนี้จองแล้ว เลือกแปลงอื่นได้</p>');
  }
  function choosePlot(no) {
    const p = PLOTS.filter(function (x) { return x.no === no; })[0];
    if (!p || p.state === 'ขายแล้ว') return;
    plot = p;
    renderSite();
  }
  $('#siteSvg').addEventListener('click', function (e) { const g = e.target.closest('[data-plot]'); if (g) choosePlot(Number(g.dataset.plot)); });
  $('#siteSvg').addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const g = e.target.closest('[data-plot]');
    if (g) { e.preventDefault(); const n = Number(g.dataset.plot); choosePlot(n); const again = document.querySelector('[data-plot="' + n + '"]'); if (again) again.focus(); }
  });
  $('#plotCard').addEventListener('click', function (e) {
    const w = e.target.closest('[data-want]');
    if (w) $('#pickedPlot').textContent = 'แปลงที่อยากดู: แปลง ' + w.dataset.want;
  });

  // ---------- นัดชม ----------
  $('#visitForm').addEventListener('submit', function (e) {
    e.preventDefault();
    const f = e.target, err = $('#formErr');
    err.hidden = true;
    f.querySelectorAll('.line').forEach(function (l) { l.classList.remove('bad'); });
    const tel = f.phone.value.replace(/[^0-9]/g, '');
    if (!f.name.value.trim()) { err.textContent = 'ใส่ชื่อก่อน'; err.hidden = false; f.name.closest('.line').classList.add('bad'); f.name.focus(); return; }
    if (!/^0\d{8,9}$/.test(tel)) { err.textContent = 'เบอร์โทรต้องขึ้นต้นด้วย 0 ยาว 9–10 หลัก'; err.hidden = false; f.phone.closest('.line').classList.add('bad'); f.phone.focus(); return; }
    if (f.website.value) return;
    f.hidden = true;
    const d = $('#visitDone');
    d.hidden = false;
    d.textContent = 'ได้รับแล้ว ' + f.name.value.trim() + ' ' + f.slot.value + ' ทางโครงการจะโทรยืนยันที่ ' + tel + ' (เว็บตัวอย่าง ไม่มีการส่งข้อมูล)';
  });

  // ---------- ภาพตัดบ้าน: เส้นแดดคำนวณจากขนาดจริง ----------
  function buildSection() {
    const narrow = window.innerWidth < 900;
    const S = narrow ? 46 : 78, zMin = 4.9, zMax = 15.1, yMin = -1.15, yMax = 7.75;
    const W = Math.round((zMax - zMin) * S), Hh = Math.round((yMax - yMin) * S);
    const Z = function (z) { return +((z - zMin) * S).toFixed(1); };
    const Y = function (y) { return +((yMax - y) * S).toFixed(1); };
    const box = function (cls, z0, y0, z1, y1) { return '<rect class="' + cls + '" x="' + Z(z0) + '" y="' + Y(y1) + '" width="' + ((z1 - z0) * S).toFixed(1) + '" height="' + ((y1 - y0) * S).toFixed(1) + '"/>'; };
    const line = function (cls, z0, y0, z1, y1) { return '<line class="' + cls + '" x1="' + Z(z0) + '" y1="' + Y(y0) + '" x2="' + Z(z1) + '" y2="' + Y(y1) + '"/>'; };
    const text = function (cls, z, y, s) { return '<text class="' + cls + '" x="' + Z(z) + '" y="' + Y(y) + '" text-anchor="middle">' + s + '</text>'; };
    const dim = function (z0, z1, y, label) { const t = 0.07; return line('hair', z0, y, z1, y) + line('hair', z0, y - t, z0, y + t) + line('hair', z1, y - t, z1, y + t) + text('lblS halo', (z0 + z1) / 2, y + 0.09, label); };
    const svg = $('#secSvg');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + Hh);
    svg.style.setProperty('--secFs', (narrow ? 20 : 14) + 'px');
    let s = '<polygon id="secShade" class="secShade"/><polygon id="secShade2" class="secShade"/>';
    s += line('thin', zMin, 0, 3 + 8.1, 0) + line('thin', 13.7, 0, zMax, 0);
    // ผืนดินใต้พื้น: ขีดเฉียงบางๆ
    for (let z = zMin; z < zMax; z += 0.22) { if (z > 11 && z < 13.8) continue; s += line('soft hair', z, 0, z - 0.14, -0.16); }
    // ส่วนที่ถูกตัด
    s += box('poche', zMin, 0, 10.1, 0.25) + box('poche', zMin, 3.45, 10.4, 3.75) + box('poche', zMin, 6.95, 10.6, 7.19);
    s += box('poche', 6.85, 3, 7.15, 3.45) + box('poche', 6.85, 6.5, 7.15, 6.95);
    // กระจก เสา ราว ระแนง
    s += line('thin', 6.97, 0.25, 6.97, 3) + line('thin', 7.03, 0.25, 7.03, 3) + line('thin', 6.97, 3.75, 6.97, 6.5) + line('thin', 7.03, 3.75, 7.03, 6.5);
    s += line('hair', 9.85, 0.25, 9.85, 3.45) + line('thin', 8.62, 3.75, 8.62, 4.79) + box('poche', 8.56, 4.79, 8.68, 4.83);
    s += line('hair', 8.35, 3.75, 8.35, 6.95) + line('hair', 8.55, 3.75, 8.55, 6.95) + text('lblS halo', 8.45, 5.4, 'ระแนง');
    // สระ
    s += box('poolFill', 11.1, -0.95, 13.7, -0.09) + line('thin', 11.1, 0, 11.1, -0.95) + line('thin', 13.7, 0, 13.7, -0.95) + line('thin', 11.1, -0.95, 13.7, -0.95) + line('hair', 11.1, -0.09, 13.7, -0.09);
    s += box('poche', 10.1, 0, 11.1, 0.05) + box('poche', 13.7, 0, 14.1, 0.05);
    // คนยืนบอกสเกล สูง 1.72 ม.
    const px = 7.95, py = 0.25;
    s += '<circle class="poche" cx="' + Z(px) + '" cy="' + Y(py + 1.6) + '" r="' + (0.105 * S).toFixed(1) + '"/>';
    s += '<path class="poche" d="M' + Z(px - 0.17) + ' ' + Y(py + 1.42) + 'Q' + Z(px) + ' ' + Y(py + 1.5) + ' ' + Z(px + 0.17) + ' ' + Y(py + 1.42) + 'L' + Z(px + 0.14) + ' ' + Y(py + 0.82) + 'L' + Z(px + 0.1) + ' ' + Y(py) + 'L' + Z(px + 0.01) + ' ' + Y(py) + 'L' + Z(px) + ' ' + Y(py + 0.72) + 'L' + Z(px - 0.01) + ' ' + Y(py) + 'L' + Z(px - 0.1) + ' ' + Y(py) + 'L' + Z(px - 0.14) + ' ' + Y(py + 0.82) + 'Z"/>';
    // ระยะ
    s += dim(7.15, 10.4, 2.92, '3.40 ม.') + dim(7, 10, -0.46, 'ระเบียง 3.00 ม.');
    s += text('lblS', 12.4, -0.62, 'สระ') + text('lblS', 5.85, 1.5, 'ในบ้าน') + text('lblS', 5.85, 5, 'ชั้น 2');
    // เส้นแดด อยู่บนสุด
    s += '<line id="secLit" class="secLit"/><line id="secLit2" class="secLit"/><line id="secIn" class="secLit"/><line id="secRay" class="secRay"/><line id="secRay2" class="secRay"/><circle id="secSun" class="secSun" r="' + (narrow ? 13 : 13) + '"/>';
    svg.innerHTML = s;
    const shade = function (edgeZ, edgeY, floorY) {
      return function (k) {
        const zs = edgeZ - (edgeY - floorY) * k;
        const points = zs >= 7 ? [[edgeZ, edgeY], [zs, floorY], [7, floorY], [7, edgeY]] : [[edgeZ, edgeY], [7, edgeY - (edgeZ - 7) / k], [7, edgeY]];
        return { zs: zs, points: points };
      };
    };
    const low1 = shade(10.4, 3.45, 0.25), up2 = shade(10.6, 6.95, 3.75);
    const setLine = function (id, z0, y0, z1, y1, on) {
      const e = $('#' + id);
      if (!on) { e.style.display = 'none'; return; }
      e.style.display = '';
      e.setAttribute('x1', Z(z0)); e.setAttribute('y1', Y(y0)); e.setAttribute('x2', Z(z1)); e.setAttribute('y2', Y(y1));
    };
    const poly = function (id, pts) { $('#' + id).setAttribute('points', pts ? pts.map(function (q) { return Z(q[0]) + ',' + Y(q[1]); }).join(' ') : ''); };
    return {
      update: function (t) {
        const d = HD.sunAt(t), up = d.y > 0.03;
        const label = '<b>' + pad(Math.floor(t / 60)) + ':' + pad(t % 60) + '</b> ';
        if (!up) {
          ['secLit', 'secLit2', 'secIn', 'secRay', 'secRay2'].forEach(function (id) { setLine(id, 0, 0, 0, 0, false); });
          $('#secSun').style.display = 'none';
          poly('secShade', null); poly('secShade2', null);
          $('#secRead').innerHTML = label + 'ไม่มีแดด เปิดไฟในบ้านแล้ว';
          return;
        }
        const k = d.z / d.y, a = low1(k), b = up2(k);
        poly('secShade', a.points); poly('secShade2', b.points);
        // ส่วนที่แดดถึงบนพื้นระเบียง และที่ลอดเข้าในบ้าน
        setLine('secLit', Math.max(a.zs, 7), 0.25, 10, 0.25, a.zs < 10);
        setLine('secLit2', Math.max(b.zs, 7), 3.75, 8.62, 3.75, b.zs < 8.62);
        setLine('secIn', Math.max(a.zs, zMin), 0.25, 7, 0.25, a.zs < 7);
        // เส้นแดดจากดวงอาทิตย์ผ่านขอบชายคาลงพื้น
        const reach = Math.min((zMax - 0.3 - 10.4) / d.z, (yMax - 0.3 - 3.45) / d.y);
        const sz = 10.4 + d.z * reach, sy = 3.45 + d.y * reach;
        const endZ = Math.max(a.zs, zMin), endY = 3.45 - (10.4 - endZ) / k;
        setLine('secRay', sz, sy, endZ, endY, true);
        const end2 = Math.max(b.zs, 7), endY2 = 6.95 - (10.6 - end2) / k;
        const reach2 = Math.min((zMax - 0.3 - 10.6) / d.z, (yMax - 0.3 - 6.95) / d.y);
        setLine('secRay2', 10.6 + d.z * reach2, 6.95 + d.y * reach2, end2, endY2, true);
        const sun = $('#secSun');
        sun.style.display = '';
        sun.setAttribute('cx', Z(sz)); sun.setAttribute('cy', Y(sy));
        let say;
        if (a.zs >= 10) say = 'ร่มเต็มระเบียง';
        else if (a.zs >= 7) say = 'ร่มลึก ' + (a.zs - 7).toFixed(1) + ' ม. จากระเบียงลึก 3 ม.';
        else say = 'แดดต่ำลอดเข้าในบ้าน ' + (7 - Math.max(a.zs, zMin)).toFixed(1) + ' ม. ขึ้นไป';
        $('#secRead').innerHTML = label + say;
      },
    };
  }
  sec = buildSection();
  secInput.addEventListener('input', function () { sec.update(Number(secInput.value)); });

  renderPlan();
  renderSite();
  setTime(Number(input.value));
})();
