/* store.js — หน้าร้าน: ถาดสินค้า + บิล
   ของแพงที่สุดบนมือถือคือการรอเน็ต จึงโชว์สินค้าจากสำเนาล่าสุดก่อนเสมอ แล้วค่อยอัปเดตราคาตามหลัง
   ราคาจริงตัดสินที่หลังบ้านตอนออกบิลทุกครั้ง สำเนาเก่าเลยทำให้ยอดผิดไม่ได้ */
(function () {
  'use strict';
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const SHIP = 'ส่งถึงที่', PICKUP = 'มารับเอง', PAY_QR = 'โอนพร้อมเพย์', PAY_COD = 'จ่ายปลายทาง', PAY_SHOP = 'จ่ายที่ร้าน';
  const TINT = { rice: '#bfc3b5', chili: '#92210e', garlic: '#5b5e53', shallot: '#995546', pepper: '#745839', star: '#837362', cinnamon: '#b27c37', coriander: '#a58c3e', mung: '#848a2e', shrimp: '#e38a43', mushroom: '#91763d', tamarind: '#b08952', palm: '#b2915a', sesame: '#8e915c', peanut: '#ac966b' };
  const ROT = [0, 40, -25, 80, 15, -60, 120, -10, 55, 200, -35, 95, 25, -80, 150];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wide = matchMedia('(min-width: 1100px)');
  const store = {
    get: function (k, d) { try { const v = localStorage.getItem('orderbill-' + k); return v ? JSON.parse(v) : d; } catch (x) { return d; } },
    set: function (k, v) { try { localStorage.setItem('orderbill-' + k, JSON.stringify(v)); } catch (x) { /* โหมดส่วนตัวเก็บไม่ได้ก็สั่งได้ปกติ */ } },
    del: function (k) { try { localStorage.removeItem('orderbill-' + k); } catch (x) { /* ไม่มีให้ลบ */ } },
  };
  const S = {
    shop: null, products: [], cat: 'ทั้งหมด', q: '', picks: {}, cart: store.get('cart', []), step: 'cart',
    delivery: SHIP, pay: PAY_QR, customer: store.get('cust', {}), errors: {}, err: '', sending: false, reqId: null,
    issued: null, token: null, lastAdded: null, slipUrl: '', afterMsg: '', afterErr: false, linePreview: '',
  };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Number(n) || 0; return n.toLocaleString('th-TH', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }); }
  function product(id) { return S.products.filter(function (p) { return p.id === id; })[0]; }
  function defaultSize(p) { const one = p.sizes.filter(function (z) { return z.name === '1 โล'; })[0]; return (one || p.sizes[0]).name; }
  function pick(p) { const cur = S.picks[p.id]; return p.sizes.some(function (z) { return z.name === cur; }) ? cur : defaultSize(p); }
  function sizeOf(p, name) { return p.sizes.filter(function (z) { return z.name === name; })[0]; }
  function cartLine(id, size) { return S.cart.filter(function (l) { return l.id === id && l.size === size; })[0]; }
  const ICON = {
    minus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    tick: '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 15l6 7L25 4" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  // ---------- ราคาในบิล ----------
  function priced() {
    const lines = [];
    let satang = 0, gone = [];
    S.cart.forEach(function (l) {
      const p = product(l.id); const z = p && sizeOf(p, l.size);
      if (!p || !z) { gone.push(l); return; }
      satang += Math.round(z.price * 100) * l.qty;
      lines.push({ id: l.id, size: l.size, qty: l.qty, name: p.name, price: z.price, sum: Math.round(z.price * 100) * l.qty / 100, out: p.state === 'หมด' });
    });
    const subtotal = satang / 100;
    const shop = S.shop || { shipFee: 0, freeShipAt: 0 };
    const free = shop.freeShipAt && subtotal >= shop.freeShipAt;
    const ship = S.delivery === SHIP && lines.length && !free ? shop.shipFee : 0;
    return { lines: lines, subtotal: subtotal, ship: ship, total: Math.round((subtotal + ship) * 100) / 100, gone: gone, toFree: shop.freeShipAt && !free ? shop.freeShipAt - subtotal : 0 };
  }

  const HERO = $('#hero');

  // ---------- ถาด ----------
  function imgTag(p, i) {
    if (!p.img) return '';
    const m = /^img\/([a-z]+)\.webp$/.exec(p.img);
    const eager = i < 3;
    const tint = m && TINT[m[1]] ? 'background:' + TINT[m[1]] + ';' : '';
    const src = m ? 'img/' + m[1] + '-460.webp' : esc(p.img);
    const set = m ? ' srcset="img/' + m[1] + '-460.webp 460w, ' + esc(p.img) + ' 900w" sizes="(min-width:1100px) 22vw, (min-width:720px) 30vw, 46vw"' : '';
    return '<img src="' + src + '"' + set + ' alt="" width="460" height="460" decoding="async" ' + (eager ? 'fetchpriority="high"' : 'loading="lazy"') + ' style="' + tint + '--r:' + ROT[i % ROT.length] + 'deg">';
  }
  function tagHtml(p) {
    if (p.state === 'หมด') return '<b>หมด</b>';
    const z = sizeOf(p, pick(p));
    const txt = money(z.price);
    return '<b' + (txt.length > 4 ? ' class="long"' : '') + '>' + txt + '</b><small>' + esc(z.name) + '</small>';
  }
  function buyHtml(p) {
    if (p.state === 'หมด') return '';
    const line = cartLine(p.id, pick(p));
    if (!line) return '<button type="button" class="add" data-act="add" aria-label="ใส่ ' + esc(p.name) + ' ลงบิล">ใส่บิล</button>';
    return '<div class="stepper"><button type="button" class="iconBtn" data-act="dec" aria-label="ลด ' + esc(p.name) + '">' + ICON.minus + '</button><b aria-live="polite" aria-label="' + line.qty + ' ในบิล">' + line.qty + '</b><button type="button" class="iconBtn" data-act="inc" aria-label="เพิ่ม ' + esc(p.name) + '">' + ICON.plus + '</button></div>';
  }
  function trayHtml(p, i) {
    const sizes = p.state === 'หมด' ? '' : '<div class="sizes" role="radiogroup" aria-label="ขนาด ' + esc(p.name) + '">' + p.sizes.map(function (z) {
      const on = z.name === pick(p);
      return '<button type="button" class="size" role="radio" aria-checked="' + on + '" data-act="size" data-size="' + esc(z.name) + '">' + esc(z.name) + '</button>';
    }).join('') + '</div>';
    return '<article class="tray' + (p.state === 'หมด' ? ' out' : '') + '" data-id="' + esc(p.id) + '" style="--t:' + (i % 2 ? 7 : -8) + 'deg;--i:' + Math.min(i, 6) + '">' +
      '<div class="dishWrap"><button type="button" class="dish" data-act="dish" tabindex="-1" aria-hidden="true"' + (p.state === 'หมด' ? ' disabled' : '') + '>' + imgTag(p, i) + '</button>' +
      '<span class="tag">' + tagHtml(p) + '</span><div class="buy">' + buyHtml(p) + '</div></div>' +
      '<h3 class="trayName">' + esc(p.name) + '</h3>' +
      '<p class="trayDesc">' + esc(p.desc) + '</p>' + sizes + '</article>';
  }
  function visible() {
    const q = S.q.trim().toLowerCase();
    return S.products.filter(function (p) {
      return (S.cat === 'ทั้งหมด' || p.cat === S.cat) && (!q || (p.name + ' ' + p.cat + ' ' + p.desc).toLowerCase().indexOf(q) >= 0);
    });
  }
  function renderGrid() {
    const list = visible();
    const grid = $('#grid'), none = $('#none');
    grid.classList.remove('loading');
    grid.innerHTML = list.map(trayHtml).join('');
    grid.prepend(HERO);
    none.hidden = list.length > 0;
    if (!list.length) none.innerHTML = 'ไม่มี “' + esc(S.q) + '” ในหมวดนี้<button type="button" class="linkBtn" id="clearQ">ดูของทั้งหมด</button>';
  }
  function syncTray(id) {
    const el = document.querySelector('.tray[data-id="' + CSS.escape(id) + '"]'); const p = product(id);
    if (!el || !p) return;
    $('.tag', el).innerHTML = tagHtml(p);
    $('.buy', el).innerHTML = buyHtml(p);
    el.querySelectorAll('.size').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.size === pick(p))); });
  }
  function renderCats() {
    const cats = ['ทั้งหมด'];
    S.products.forEach(function (p) { if (p.cat && cats.indexOf(p.cat) < 0) cats.push(p.cat); });
    $('#cats').innerHTML = cats.map(function (c) { return '<button type="button" class="cat" data-cat="' + esc(c) + '" aria-pressed="' + (c === S.cat) + '">' + esc(c) + '</button>'; }).join('');
  }
  function renderShop() {
    const s = S.shop;
    const facts = [];
    if (s.cutoff) facts.push(s.cutoff);
    if (s.freeShipAt) facts.push('ครบ ' + money(s.freeShipAt) + ' ส่งฟรี');
    $('#facts').innerHTML = facts.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('');
    $('#footName').textContent = s.name || '';
    $('#footAddr').textContent = [s.address, s.phone && 'โทร ' + s.phone].filter(Boolean).join(' · ');
  }

  // ---------- บิล ----------
  function today(iso) { return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(iso ? new Date(iso) : new Date()); }
  function headHtml(no) {
    const name = (S.shop && S.shop.name) || '';
    return '<header class="billHead"><img src="logo.svg" alt="" width="40" height="40"><div><div class="billShop">' + esc(name) + '</div><div class="billKind">บิลเงินสด</div></div>' +
      '<div class="billNo">เลขที่<b>' + (no ? esc(no) : '<span class="sr">ยังไม่ออกเลข</span>····') + '</b></div></header>';
  }
  function linesHtml(lines, editable) {
    const rows = lines.map(function (l) {
      const isNew = editable && S.lastAdded === l.id + '|' + l.size;
      const ctl = editable
        ? '<span class="lineCtl"><button type="button" class="iconBtn" data-line="dec" data-id="' + esc(l.id) + '" data-size="' + esc(l.size) + '" aria-label="ลด ' + esc(l.name) + '">' + ICON.minus + '</button><span class="hand">' + l.qty + '</span><button type="button" class="iconBtn" data-line="inc" data-id="' + esc(l.id) + '" data-size="' + esc(l.size) + '" aria-label="เพิ่ม ' + esc(l.name) + '">' + ICON.plus + '</button><span class="unit">× ' + money(l.price) + ' บาท</span></span>'
        : '<span class="lineCtl"><span class="unit">' + l.qty + ' × ' + money(l.price) + ' บาท</span></span>';
      return '<div class="line' + (isNew ? ' new' : '') + '"><div class="lineName"><span class="lineMain hand">' + esc(l.name) + ' ' + esc(l.size) + (l.out ? ' (หมด)' : '') + '</span>' + ctl + '</div><div class="lineSum hand">' + money(l.sum) + '</div></div>';
    }).join('');
    const min = editable && S.step === 'cart' ? 5 : 0;
    let blanks = '';
    for (let i = lines.length; i < min; i++) blanks += '<div class="line blank"></div>';
    return '<div class="lines"><div class="lineHead printed"><span>รายการ</span><span>บาท</span></div>' + rows + blanks + '</div>';
  }
  function totalsHtml(sub, ship, total, delivery) {
    return '<div class="totals"><div class="totalRow"><span class="printed">ค่าของ</span><span class="hand">' + money(sub) + '</span></div>' +
      (delivery === SHIP ? '<div class="totalRow"><span class="printed">ค่าส่ง</span><span class="hand">' + (ship ? money(ship) : 'ส่งฟรี') + '</span></div>' : '') +
      '<div class="totalRow grand"><span class="printed">รวมเงิน</span><span class="hand">' + money(total) + '</span></div></div>';
  }
  function fieldHtml(key, label, type, extra) {
    const v = S.customer[key] || '';
    const err = S.errors[key];
    const control = type === 'area'
      ? '<textarea id="f-' + key + '" name="' + key + '" rows="2" ' + extra + '>' + esc(v) + '</textarea>'
      : '<input id="f-' + key + '" name="' + key + '" type="' + type + '" value="' + esc(v) + '" ' + extra + '>';
    return '<label class="field' + (err ? ' bad' : '') + '"><span>' + label + '</span>' + control + (err ? '<em class="fieldErr" style="font-style:normal">' + esc(err) + '</em>' : '') + '</label>';
  }
  function tickHtml(group, value, label, checked) {
    return '<label class="tick"><input type="radio" name="' + group + '" value="' + value + '"' + (checked ? ' checked' : '') + '><span class="box">' + ICON.tick + '</span>' + label + '</label>';
  }
  function formHtml() {
    const payOpts = S.delivery === SHIP ? [[PAY_QR, 'โอนพร้อมเพย์'], [PAY_COD, 'จ่ายปลายทาง']] : [[PAY_QR, 'โอนพร้อมเพย์'], [PAY_SHOP, 'จ่ายที่ร้าน']];
    return '<form class="form" id="orderForm" novalidate>' +
      fieldHtml('name', 'นาม', 'text', 'autocomplete="name" maxlength="80" placeholder="ชื่อคนรับของ"') +
      fieldHtml('phone', 'โทร', 'tel', 'autocomplete="tel" inputmode="tel" maxlength="14" placeholder="08x-xxx-xxxx"') +
      (S.delivery === SHIP ? fieldHtml('address', 'ที่อยู่', 'area', 'autocomplete="street-address" maxlength="300" placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"') : '') +
      '<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div class="pick"><span class="pickTitle">รับของ</span><div class="pickRow">' + tickHtml('delivery', SHIP, 'ส่งถึงที่', S.delivery === SHIP) + tickHtml('delivery', PICKUP, 'มารับเอง', S.delivery === PICKUP) + '</div></div>' +
      '<div class="pick"><span class="pickTitle">จ่ายเงิน</span><div class="pickRow">' + payOpts.map(function (o) { return tickHtml('pay', o[0], o[1], S.pay === o[0]); }).join('') + '</div></div>' +
      '</form>';
  }
  function renderBill() {
    const sheet = $('#sheet');
    if (S.issued) return renderIssued();
    $('#after').hidden = true;
    const r = priced();
    let html = headHtml(null);
    if (S.step === 'form') html += formHtml();
    html += linesHtml(r.lines, true);
    if (!r.lines.length) html += '<p class="emptyHint hand">แตะถาดไหน ของนั้นลงบิล</p>';
    else html += totalsHtml(r.subtotal, r.ship, r.total, S.delivery);
    if (r.lines.length && r.toFree > 0 && S.delivery === SHIP) html += '<p class="nudge">อีก ' + money(r.toFree) + ' บาท ส่งฟรี</p>';
    if (S.err) html += '<p class="billErr" role="alert">' + esc(S.err) + '</p>';
    if (r.lines.length) {
      if (S.step === 'cart') html += '<button type="button" class="go" data-bill="toForm">กรอกชื่อแล้วออกบิล</button>';
      else {
        html += '<button type="button" class="go" data-bill="submit"' + (S.sending ? ' disabled' : '') + '>' + (S.sending ? 'กำลังออกบิล…' : 'ออกบิล ' + money(r.total) + ' บาท') + '</button>';
        html += '<p class="goNote">ยังไม่ตัดเงิน กดแล้วได้เลขบิล</p><button type="button" class="linkBtn backLink" data-bill="toCart">กลับไปเลือกของเพิ่ม</button>';
      }
    }
    sheet.innerHTML = html;
    renderBar(r);
    S.lastAdded = null;
  }
  function renderBar(r) {
    const bar = $('#billBar');
    const count = r.lines.reduce(function (n, l) { return n + l.qty; }, 0);
    bar.hidden = !count;
    if (count) {
      $('#barLabel').textContent = 'ดูบิล ' + r.lines.length + ' รายการ';
      $('#barTotal').textContent = money(r.total);
    }
  }
  function statusSteps(o) {
    const order = o.pay === PAY_QR ? ['รอโอน', 'ตรวจสลิป', 'ยืนยันแล้ว', 'ส่งแล้ว'] : ['รอยืนยัน', 'ยืนยันแล้ว', 'ส่งแล้ว'];
    if (o.status === 'ยกเลิก') return '<ol class="steps"><li class="on">ออเดอร์นี้ถูกยกเลิก</li></ol>';
    const at = order.indexOf(o.status);
    return '<ol class="steps">' + order.map(function (s, i) { return '<li class="' + (i === at ? 'on' : i < at ? 'past' : '') + '"' + (i === at ? ' aria-current="step"' : '') + '>' + s + '</li>'; }).join('') + '</ol>';
  }
  function orderUrl(o) { return location.origin + location.pathname + '#o/' + o.no + '/' + S.token; }
  function renderIssued(hit) {
    const o = S.issued;
    const to = '<div class="form"><div class="field"><span>นาม</span><span class="hand">' + esc(o.name) + '</span></div>' +
      '<div class="field"><span>โทร</span><span class="hand">' + esc(o.phone) + '</span></div>' +
      (o.address ? '<div class="field"><span>ที่อยู่</span><span class="hand">' + esc(o.address) + '</span></div>' : '<div class="field"><span>รับของ</span><span class="hand">' + esc(o.delivery) + '</span></div>') + '</div>';
    $('#sheet').innerHTML = headHtml(o.no) + '<div class="billDate"><span class="printed">วันที่</span><span class="hand">' + today(o.when) + '</span></div>' +
      '<div class="stamp' + (hit ? ' hit' : '') + '">รับออเดอร์แล้ว</div>' + to + linesHtml(o.lines, false) + totalsHtml(o.subtotal, o.ship, o.total, o.delivery);
    const after = $('#after');
    after.hidden = false;
    const needPay = o.pay === PAY_QR && o.status === 'รอโอน';
    const showSlip = o.pay === PAY_QR && ['รอโอน', 'ตรวจสลิป'].indexOf(o.status) >= 0;
    after.innerHTML = '<h2>' + (needPay ? 'โอนแล้วแนบสลิป ร้านจะยืนยันให้' : 'สถานะบิล #' + esc(o.no)) + '</h2>' + statusSteps(o) +
      (o.tracking ? '<p class="afterNote">เลขพัสดุ <strong>' + esc(o.tracking) + '</strong></p>' : '') +
      (needPay ? '<div class="qrBox"><div id="qr" role="img" aria-label="คิวอาร์พร้อมเพย์ ยอด ' + money(o.total) + ' บาท"></div><div class="qrAmount">' + money(o.total) + ' บาท</div><div class="qrName">' + esc(S.shop.promptpayName || '') + '</div>' +
        (window.ShopApi.isDemo ? '<p class="demoWarn">คิวอาร์ตัวอย่าง ห้ามโอนเงินจริง</p>' : '') + '</div>' : '') +
      '<div class="actions">' +
      (showSlip ? '<label class="act main"><input type="file" id="slipFile" accept="image/*">' + (o.hasSlip ? 'แนบสลิปใหม่' : 'แนบสลิป') + '</label>' : '') +
      '<button type="button" class="act' + (showSlip ? '' : ' main') + '" data-after="line">ส่งบิลเข้า LINE ร้าน</button>' +
      '<button type="button" class="act" data-after="image">บันทึกบิลเป็นรูป</button>' +
      '<button type="button" class="act" data-after="new">สั่งบิลใหม่</button></div>' +
      (S.slipUrl ? '<img class="slipThumb" src="' + esc(S.slipUrl) + '" alt="สลิปที่แนบ">' : '') +
      (S.afterMsg ? '<p class="afterNote' + (S.afterErr ? ' err' : '') + '" role="status">' + esc(S.afterMsg) + '</p>' : '') +
      (S.linePreview ? '<div class="linePreview">' + esc(S.linePreview) + '</div>' : '') +
      '<p class="afterNote">เก็บลิงก์หน้านี้ไว้ดูสถานะได้ ลิงก์นี้เปิดได้เฉพาะคนที่มีลิงก์</p>';
    if (needPay) drawQr(o);
    renderBar({ lines: [], total: 0 });
    const bar = $('#billBar');
    bar.hidden = false;
    $('#barLabel').textContent = 'บิล #' + o.no + ' · ' + o.status;
    $('#barTotal').textContent = money(o.total);
  }
  async function drawQr(o) {
    const box = $('#qr');
    if (!box || !S.shop.promptpay) return;
    if (!window.qrcode) {
      await new Promise(function (res, rej) { const s = document.createElement('script'); s.src = 'vendor/qrcode.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
    }
    const qr = window.qrcode(0, 'M');
    qr.addData(window.PromptPay.payload(S.shop.promptpay, o.total));
    qr.make();
    const n = qr.getModuleCount(), cell = 6, pad = 4 * cell;
    const c = document.createElement('canvas');
    c.width = c.height = n * cell + pad * 2;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (qr.isDark(r, k)) x.fillRect(pad + k * cell, pad + r * cell, cell, cell);
    box.innerHTML = ''; box.appendChild(c);
  }

  // ---------- ทำงานกับตะกร้า ----------
  function saveCart() { store.set('cart', S.cart); S.reqId = null; }
  function changeLine(id, size, delta) {
    const l = cartLine(id, size);
    if (l) {
      l.qty = Math.min(99, l.qty + delta);
      if (l.qty <= 0) S.cart = S.cart.filter(function (x) { return x !== l; });
    } else if (delta > 0) { S.cart.push({ id: id, size: size, qty: delta }); }
    saveCart();
    S.err = '';
    if (delta > 0) S.lastAdded = id + '|' + size;
    renderBill();
    syncTray(id);
    if (delta > 0) bumpBar();
  }
  function bumpBar() {
    const bar = $('#billBar');
    bar.classList.remove('bump');
    void bar.offsetWidth;
    bar.classList.add('bump');
  }
  function fly(tray) {
    if (reduced) return;
    const from = $('.dish img', tray);
    if (!from) return;
    const a = from.getBoundingClientRect();
    const target = wide.matches ? $('#sheet .lines') : $('#billBar');
    if (!target || target.hidden) return;
    const b = target.getBoundingClientRect();
    const size = 56;
    const clone = document.createElement('img');
    clone.src = from.currentSrc || from.src;
    clone.className = 'flyer';
    clone.alt = '';
    clone.style.cssText = 'left:' + (a.left + a.width / 2 - size / 2) + 'px;top:' + (a.top + a.height / 2 - size / 2) + 'px;width:' + size + 'px;height:' + size + 'px';
    document.body.appendChild(clone);
    const dx = (b.left + Math.min(b.width, 240) / 2) - (a.left + a.width / 2), dy = (b.top + 24) - (a.top + a.height / 2);
    const anim = clone.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.55 + 'px,' + (dy * 0.55 - 40) + 'px) scale(.9)', opacity: 1, offset: .6 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.3)', opacity: .2 },
    ], { duration: 420, easing: 'cubic-bezier(.3,.7,.3,1)' });
    anim.onfinish = anim.oncancel = function () { clone.remove(); };
  }

  function openBill() {
    if (wide.matches || document.body.classList.contains('billOpen')) return;
    document.body.classList.add('billOpen');
    history.pushState({ bill: 1 }, '');
  }
  function closeBill(fromPop) {
    if (!document.body.classList.contains('billOpen')) return;
    document.body.classList.remove('billOpen');
    if (!fromPop && history.state && history.state.bill) history.back();
  }

  function collectForm() {
    const f = $('#orderForm');
    if (!f) return;
    ['name', 'phone', 'address'].forEach(function (k) { if (f[k]) S.customer[k] = f[k].value; });
    S.website = f.website ? f.website.value : '';
  }
  function validate() {
    const e = {}, c = S.customer;
    if (!(c.name || '').trim()) e.name = 'ใส่ชื่อคนรับของ';
    const tel = (c.phone || '').replace(/[^0-9]/g, '');
    if (!/^0\d{8,9}$/.test(tel)) e.phone = 'เบอร์โทรต้องขึ้นต้นด้วย 0 ยาว 9–10 หลัก';
    if (S.delivery === SHIP && (c.address || '').trim().length < 10) e.address = 'ใส่ที่อยู่ให้ครบ ไม่งั้นส่งของไม่ถึง';
    return e;
  }
  async function submitOrder() {
    if (S.sending) return;
    collectForm();
    S.errors = validate();
    S.err = '';
    if (Object.keys(S.errors).length) {
      renderBill();
      const first = $('#sheet .field.bad input, #sheet .field.bad textarea');
      if (first) first.focus();
      return;
    }
    const r = priced();
    if (r.lines.some(function (l) { return l.out; })) { S.err = 'มีของหมดในบิล ลดออกก่อนออกบิล'; renderBill(); return; }
    S.sending = true;
    S.reqId = S.reqId || (Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
    renderBill();
    let res;
    try {
      res = await window.ShopApi.call('placeOrder', {
        reqId: S.reqId, website: S.website, customer: S.customer, delivery: S.delivery, pay: S.pay,
        items: S.cart.map(function (l) { return { id: l.id, size: l.size, qty: l.qty }; }), expectedTotal: r.total,
      });
    } catch (x) {
      S.sending = false;
      S.err = 'ส่งไม่สำเร็จ เน็ตอาจหลุด ข้อมูลยังอยู่ครบ กดออกบิลอีกครั้งได้เลย ไม่ได้บิลซ้ำ';
      renderBill();
      return;
    }
    S.sending = false;
    if (res.ok) {
      S.issued = res.order; S.token = res.token;
      store.set('cust', { name: S.customer.name, phone: S.customer.phone, address: S.customer.address });
      store.set('last', { no: res.order.no, token: res.token });
      S.cart = []; store.del('cart'); S.step = 'cart'; S.reqId = null;
      history.replaceState(history.state, '', '#o/' + res.order.no + '/' + res.token); // ตั้ง location.hash ตรงๆ จะยิง popstate แล้วบิลบนมือถือปิดเอง
      renderIssued(true);
      renderGrid();
      $('#billScroll').scrollTop = 0;
      return;
    }
    if (res.code === 'PRICE_CHANGED' || res.code === 'SOLD_OUT' || res.code === 'NOT_FOUND') {
      await loadCatalog(true);
      S.err = res.code === 'PRICE_CHANGED' ? 'ราคาเปลี่ยนแล้ว ดูยอดใหม่ก่อนกดออกบิลอีกครั้ง' : res.message;
    } else if (res.code === 'BAD_CUSTOMER') {
      S.err = res.message;
    } else {
      S.err = res.message || 'ออกบิลไม่สำเร็จ ลองอีกครั้ง';
    }
    renderBill();
  }

  async function shrinkImage(file) {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image(); img.src = url; await img.decode();
      const k = Math.min(1, 1600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', 0.8);
    } finally { URL.revokeObjectURL(url); }
  }
  async function uploadSlip(file) {
    S.afterMsg = 'กำลังแนบสลิป…'; S.afterErr = false; renderIssued();
    try {
      const dataUrl = await shrinkImage(file);
      const res = await window.ShopApi.call('uploadSlip', { no: S.issued.no, token: S.token, mime: 'image/jpeg', imageBase64: dataUrl.split(',')[1] });
      if (!res.ok) throw new Error(res.message);
      S.issued = res.order; S.slipUrl = dataUrl;
      S.afterMsg = 'แนบสลิปแล้ว ร้านตรวจยอดแล้วจะยืนยันให้'; S.afterErr = false;
    } catch (x) {
      S.afterMsg = x && x.message && !/load|decode|fetch/i.test(x.message) ? x.message : 'แนบไม่สำเร็จ ไฟล์นี้อาจไม่ใช่รูป ลองเลือกรูปใหม่';
      S.afterErr = true;
    }
    renderIssued();
  }
  function lineText(o) {
    return 'ออเดอร์ #' + o.no + '\n' + o.lines.map(function (l) { return l.name + ' ' + l.size + ' × ' + l.qty + ' = ' + money(l.sum); }).join('\n') +
      (o.ship ? '\nค่าส่ง ' + money(o.ship) : '') + '\nรวม ' + money(o.total) + ' บาท\nดูบิล: ' + orderUrl(o);
  }
  function sendToLine() {
    const o = S.issued, text = lineText(o), oa = S.shop.lineOa;
    if (oa) { location.href = 'https://line.me/R/oaMessage/' + encodeURIComponent(oa) + '/?' + encodeURIComponent(text); return; }
    S.linePreview = 'เว็บจริงปุ่มนี้เปิดแชต LINE ของร้านพร้อมข้อความนี้:\n\n' + text;
    renderIssued();
  }
  async function saveImage() {
    try {
      S.afterMsg = 'กำลังทำรูปบิล…'; S.afterErr = false; renderIssued();
      const blob = await window.BillImage.blob(S.issued, S.shop);
      const name = 'บิล-' + S.issued.no + '.png';
      const file = new File([blob], name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && !wide.matches) {
        await navigator.share({ files: [file], title: name });
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
      }
      S.afterMsg = 'บันทึกบิลแล้ว';
    } catch (x) {
      if (x && x.name === 'AbortError') { S.afterMsg = ''; } else { S.afterMsg = 'ทำรูปบิลไม่สำเร็จ แคปหน้าจอแทนได้'; S.afterErr = true; }
    }
    renderIssued();
  }
  function newBill() {
    S.issued = null; S.token = null; S.slipUrl = ''; S.afterMsg = ''; S.afterErr = false; S.linePreview = '';
    history.replaceState(history.state, '', location.pathname + location.search);
    renderBill();
  }

  // ---------- เหตุการณ์ ----------
  $('#grid').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const tray = btn.closest('.tray'), id = tray.dataset.id, p = product(id);
    if (!p || p.state === 'หมด') return;
    const act = btn.dataset.act;
    if (S.issued && (act === 'add' || act === 'dish' || act === 'inc')) newBill();
    if (act === 'size') { S.picks[id] = btn.dataset.size; syncTray(id); return; }
    if (act === 'add' || act === 'dish') { fly(tray); changeLine(id, pick(p), 1); return; }
    if (act === 'inc') { changeLine(id, pick(p), 1); return; }
    if (act === 'dec') changeLine(id, pick(p), -1);
  });
  $('#cats').addEventListener('click', function (e) {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    S.cat = b.dataset.cat; renderCats(); renderGrid();
  });
  $('#q').addEventListener('input', function (e) { S.q = e.target.value; renderGrid(); });
  $('#none').addEventListener('click', function (e) {
    if (e.target.id !== 'clearQ') return;
    S.q = ''; S.cat = 'ทั้งหมด'; $('#q').value = ''; renderCats(); renderGrid();
  });
  $('#sheet').addEventListener('click', function (e) {
    const line = e.target.closest('[data-line]');
    if (line) {
      collectForm();
      changeLine(line.dataset.id, line.dataset.size, line.dataset.line === 'inc' ? 1 : -1);
      return;
    }
    const b = e.target.closest('[data-bill]');
    if (!b) return;
    if (b.dataset.bill === 'toForm') {
      S.step = 'form'; S.err = ''; renderBill();
      const first = $('#f-name'); if (first && !first.value) first.focus();
    } else if (b.dataset.bill === 'toCart') { collectForm(); S.step = 'cart'; S.errors = {}; renderBill(); } else if (b.dataset.bill === 'submit') submitOrder();
  });
  $('#sheet').addEventListener('change', function (e) {
    if (e.target.name === 'delivery') {
      collectForm();
      S.delivery = e.target.value;
      if (S.delivery === PICKUP && S.pay === PAY_COD) S.pay = PAY_SHOP;
      if (S.delivery === SHIP && S.pay === PAY_SHOP) S.pay = PAY_COD;
      renderBill();
    } else if (e.target.name === 'pay') { S.pay = e.target.value; }
  });
  $('#sheet').addEventListener('input', function (e) {
    const k = e.target.name;
    if (k && S.errors[k]) { delete S.errors[k]; const f = e.target.closest('.field'); if (f) { f.classList.remove('bad'); const m = $('.fieldErr', f); if (m) m.remove(); } }
  });
  $('#after').addEventListener('click', function (e) {
    const b = e.target.closest('[data-after]');
    if (!b) return;
    if (b.dataset.after === 'line') sendToLine();
    else if (b.dataset.after === 'image') saveImage();
    else if (b.dataset.after === 'new') { newBill(); closeBill(); }
  });
  $('#after').addEventListener('change', function (e) { if (e.target.id === 'slipFile' && e.target.files[0]) uploadSlip(e.target.files[0]); });
  $('#billBar').addEventListener('click', openBill);
  $('#billClose').addEventListener('click', function () { closeBill(); });
  addEventListener('popstate', function () { closeBill(true); });
  addEventListener('hashchange', function () { if (!S.issued) openFromHash(); });
  $('#creditBtn').addEventListener('click', async function () {
    const dlg = $('#credits');
    if (!$('#creditList').children.length) {
      try {
        const list = await (await fetch('img/credits.json')).json();
        $('#creditList').innerHTML = list.map(function (c) {
          return '<li>' + esc(c.title) + ' · ' + esc(c.artist || 'ไม่ระบุชื่อ') + ' · ' + esc(c.license) + ' · <a href="' + esc(c.page) + '" target="_blank" rel="noopener">ต้นฉบับ</a></li>';
        }).join('');
      } catch (x) { $('#creditList').innerHTML = '<li>โหลดรายการเครดิตไม่สำเร็จ</li>'; }
    }
    dlg.showModal();
  });
  if (window.ShopApi.isDemo) {
    $('#demoStrip').hidden = false;
    $('#demoReset').addEventListener('click', function () {
      window.ShopApi.resetDemo(); ['cart', 'cust', 'last', 'catalog'].forEach(store.del); location.href = location.pathname;
    });
  }

  // ---------- โหลดข้อมูล ----------
  function applyCatalog(c) {
    S.shop = c.shop; S.products = c.products;
    renderShop(); renderCats(); renderGrid(); renderBill();
  }
  async function loadCatalog(force) {
    let res;
    try { res = await window.ShopApi.call('catalog'); } catch (x) { res = null; }
    if (res && res.ok) {
      $('#stale').hidden = true;
      store.set('catalog', { shop: res.shop, products: res.products, at: Date.now() });
      applyCatalog(res);
      return true;
    }
    if (!S.shop) {
      $('#grid').classList.remove('loading');
      $('#grid').innerHTML = '';
      $('#grid').prepend(HERO);
      $('#none').hidden = false;
      $('#none').innerHTML = 'โหลดรายการสินค้าไม่สำเร็จ เช็กเน็ตแล้วลองอีกครั้ง<button type="button" class="linkBtn" id="retry">โหลดใหม่</button>';
      $('#retry').onclick = function () { location.reload(); };
    } else if (!force) {
      $('#stale').hidden = false;
      $('#stale').textContent = 'ต่อเน็ตไม่ได้ กำลังแสดงราคาล่าสุดที่จำไว้ ยอดจริงจะคิดตอนออกบิล';
    }
    return false;
  }
  async function openFromHash() {
    const m = /^#o\/([^/]+)\/([^/]+)$/.exec(location.hash);
    if (!m) return;
    try {
      const res = await window.ShopApi.call('orderStatus', { no: m[1], token: m[2] });
      if (res.ok) {
        S.issued = res.order; S.token = m[2];
        if (S.shop) renderIssued();
        openBill();
      } else {
        S.err = 'ไม่พบบิลนี้ ลิงก์อาจไม่ครบ';
        history.replaceState(null, '', location.pathname + location.search);
        renderBill();
      }
    } catch (x) { S.err = 'เปิดบิลไม่สำเร็จ เช็กเน็ตแล้วลองอีกครั้ง'; renderBill(); }
  }
  function skeleton() {
    const g = $('#grid');
    g.classList.add('loading');
    let h = '';
    for (let i = 0; i < 6; i++) h += '<div class="tray"><div class="dishWrap"><div class="dish"></div></div><span class="skel"></span></div>';
    g.innerHTML = h;
    g.prepend(HERO);
  }
  (async function boot() {
    const cached = store.get('catalog', null);
    const stall = $('.stall');
    stall.classList.add('enter'); // จังหวะวางถาดลงแผงครั้งเดียวตอนเปิดหน้า
    setTimeout(function () { stall.classList.remove('enter'); }, 900);
    if (cached && cached.products) applyCatalog(cached);
    else { skeleton(); renderBillBlank(); }
    await loadCatalog();
    await openFromHash();
  })();
  function renderBillBlank() { $('#sheet').innerHTML = headHtml(null) + linesHtml([], true); }
  window.__store = { state: S, priced: priced };
})();
