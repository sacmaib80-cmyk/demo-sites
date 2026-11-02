/* owner.js — หลังร้าน: ออเดอร์ + สินค้า
   เปลี่ยนสถานะแล้วจอเปลี่ยนทันที (ไม่รอเน็ต) ถ้าส่งไม่สำเร็จค่อยย้อนและบอก เพราะหลังบ้าน Apps Script ตอบช้าเป็นวินาที */
(function () {
  'use strict';
  const $ = function (s, r) { return (r || document).querySelector(s); };
  const ST = { WAIT: 'รอโอน', SLIP: 'ตรวจสลิป', NEW: 'รอยืนยัน', OK: 'ยืนยันแล้ว', SENT: 'ส่งแล้ว', CANCEL: 'ยกเลิก' };
  const NEED = [ST.SLIP, ST.NEW];
  const KEY_NAME = 'orderbill-owner-key';
  const wide = matchMedia('(min-width: 960px)');
  const S = { key: '', orders: [], products: [], shop: {}, tab: 'orders', filter: 'ทั้งหมด', current: null, editing: null, loaded: false };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function money(n) { n = Number(n) || 0; return n.toLocaleString('th-TH', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }); }
  function when(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const sameDay = d.toDateString() === new Date().toDateString();
    return sameDay ? d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) + ' น.' : new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' }).format(d);
  }
  function api(action, payload) { return window.ShopApi.call(action, Object.assign({ key: S.key }, payload || {})); }
  let toastTimer;
  function toast(msg, isErr, undo) {
    const t = $('#toast');
    t.hidden = false;
    t.className = 'toast' + (isErr ? ' err' : '');
    t.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button" id="toastUndo">เลิกทำ</button>' : '');
    if (undo) $('#toastUndo').onclick = function () { t.hidden = true; undo(); };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, undo ? 7000 : 3500);
  }

  // ---------- ออเดอร์ ----------
  function badge(status) {
    const cls = NEED.indexOf(status) >= 0 ? 'need' : [ST.SENT, ST.CANCEL].indexOf(status) >= 0 ? 'done' : '';
    return '<span class="badge ' + cls + '">' + esc(status) + '</span>';
  }
  function filtered() {
    if (S.filter === 'ทั้งหมด') return S.orders;
    if (S.filter === 'ต้องทำ') return S.orders.filter(function (o) { return NEED.indexOf(o.status) >= 0; });
    return S.orders.filter(function (o) { return o.status === S.filter; });
  }
  function renderSums() {
    const today = new Date().toDateString();
    const live = S.orders.filter(function (o) { return new Date(o.when).toDateString() === today && o.status !== ST.CANCEL; });
    const sales = live.reduce(function (n, o) { return n + o.total; }, 0);
    const need = S.orders.filter(function (o) { return NEED.indexOf(o.status) >= 0; }).length;
    $('#sums').innerHTML = '<h1 class="todo' + (need ? ' need' : '') + '">' + (need ? 'มี ' + need + ' บิลรอร้านทำ' : 'ไม่มีบิลค้าง') + '</h1><p class="today">วันนี้ ' + live.length + ' บิล · ' + money(sales) + ' บาท</p>';
    $('#filters').innerHTML = ['ทั้งหมด', 'ต้องทำ', ST.WAIT, ST.OK, ST.SENT, ST.CANCEL].map(function (f) {
      return '<button type="button" class="filter" data-filter="' + f + '" aria-pressed="' + (S.filter === f) + '">' + f + '</button>';
    }).join('');
  }
  function renderRows() {
    const list = filtered(), box = $('#orderRows');
    if (!list.length) {
      box.innerHTML = '<div class="empty"><strong>' + (S.orders.length ? 'ไม่มีออเดอร์ในกลุ่มนี้' : 'ยังไม่มีออเดอร์') + '</strong>' + (S.orders.length ? '' : '<p>พอลูกค้าสั่งจากหน้าร้าน บิลจะเข้ามาตรงนี้</p>') + '</div>';
      return;
    }
    box.innerHTML = list.map(function (o) {
      const items = o.lines.map(function (l) { return l.name; }).join(', ');
      return '<button type="button" class="row" data-no="' + esc(o.no) + '" aria-current="' + (S.current === o.no) + '"><span class="rowNo">#' + esc(o.no) + '</span><span><span class="rowName">' + esc(o.name) + '</span><span class="rowSub">' + esc(when(o.when)) + ' · ' + esc(items) + '</span></span><span class="rowEnd"><span class="rowTotal">' + money(o.total) + '</span>' + badge(o.status) + '</span></button>';
    }).join('');
  }
  function billHtml(o) {
    const rows = o.lines.map(function (l) {
      return '<div class="line"><div class="lineName"><span class="lineMain hand">' + esc(l.name) + ' ' + esc(l.size) + '</span><span class="lineCtl"><span class="unit">' + l.qty + ' × ' + money(l.price) + ' บาท</span></span></div><div class="lineSum hand">' + money(l.sum) + '</div></div>';
    }).join('');
    return '<div class="pad ownerBill"><div class="sheet"><header class="billHead"><img src="logo.svg" alt="" width="40" height="40"><div><div class="billShop">' + esc(S.shop.name || '') + '</div><div class="billKind">บิลเงินสด</div></div><div class="billNo">เลขที่<b>' + esc(o.no) + '</b></div></header>' +
      '<div class="form"><div class="field"><span>นาม</span><span class="hand">' + esc(o.name) + '</span></div><div class="field"><span>โทร</span><span class="hand">' + esc(o.phone) + '</span></div>' +
      (o.address ? '<div class="field"><span>ที่อยู่</span><span class="hand">' + esc(o.address) + '</span></div>' : '<div class="field"><span>รับของ</span><span class="hand">' + esc(o.delivery) + '</span></div>') +
      (o.note ? '<div class="field"><span>โน้ต</span><span class="hand">' + esc(o.note) + '</span></div>' : '') + '</div>' +
      '<div class="lines"><div class="lineHead printed"><span>รายการ</span><span>บาท</span></div>' + rows + '</div>' +
      '<div class="totals"><div class="totalRow"><span class="printed">ค่าของ</span><span class="hand">' + money(o.subtotal) + '</span></div>' +
      (o.delivery === 'ส่งถึงที่' ? '<div class="totalRow"><span class="printed">ค่าส่ง</span><span class="hand">' + (o.ship ? money(o.ship) : 'ส่งฟรี') + '</span></div>' : '') +
      '<div class="totalRow grand"><span class="printed">รวมเงิน</span><span class="hand">' + money(o.total) + '</span></div></div></div></div>';
  }
  function actionsHtml(o) {
    const acts = [];
    if (o.status === ST.SLIP) acts.push(['ตรวจยอดแล้ว ยืนยันออเดอร์', ST.OK, true]);
    if (o.status === ST.WAIT) acts.push(['ได้เงินแล้ว ยืนยันออเดอร์', ST.OK, true]);
    if (o.status === ST.NEW) acts.push(['ยืนยันออเดอร์', ST.OK, true]);
    if (o.status === ST.OK) acts.push([o.delivery === 'มารับเอง' ? 'ลูกค้ารับของแล้ว' : 'ส่งของแล้ว', ST.SENT, true]);
    return acts.map(function (a) { return '<button type="button" class="ownerBtn wide' + (a[2] ? ' main' : '') + '" data-status="' + esc(a[1]) + '">' + esc(a[0]) + '</button>'; }).join('');
  }
  function renderDetail() {
    const box = $('#orderDetail');
    const o = S.orders.filter(function (x) { return x.no === S.current; })[0];
    if (!o) {
      box.classList.remove('open');
      box.innerHTML = wide.matches ? '<div class="empty"><strong>เลือกบิลทางซ้าย</strong></div>' : '';
      return;
    }
    if (!wide.matches) box.classList.add('open'); else box.classList.remove('open');
    const paid = o.pay === 'โอนพร้อมเพย์';
    box.innerHTML = '<div class="detailInner"><button type="button" class="backRow" data-back="1"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>ออเดอร์ทั้งหมด</button>' + billHtml(o) +
      '<div class="contact"><a class="ownerBtn" href="tel:' + esc(o.phone) + '">โทรหาลูกค้า</a>' + (o.address ? '<button type="button" class="ownerBtn" data-copy="address">คัดลอกที่อยู่</button>' : '') + '</div>' +
      '<div class="panel"><h3>สถานะ: ' + esc(o.status) + ' · ' + esc(o.pay) + '</h3>' +
      (o.slip ? '<a href="' + esc(o.slip) + '" target="_blank" rel="noopener"><img class="slipImg" src="' + esc(o.slip) + '" alt="สลิปของบิล ' + esc(o.no) + '" onerror="this.replaceWith(document.createTextNode(\'เปิดสลิปในแท็บใหม่\'))"></a>' : '') +
      (paid && [ST.SLIP, ST.WAIT].indexOf(o.status) >= 0 ? '<p class="warn">ดูยอดเข้าในแอปธนาคารก่อนยืนยัน อย่าเชื่อภาพสลิปอย่างเดียว</p>' : '') +
      '<div class="nextActs">' + actionsHtml(o) + '</div>' +
      (o.status === ST.OK || o.status === ST.SENT ? (o.delivery === 'ส่งถึงที่' ? '<label class="track">เลขพัสดุ (ลูกค้าเห็นในหน้าบิล)<input id="trackNo" value="' + esc(o.tracking) + '" maxlength="60" autocomplete="off"></label>' : '') : '') +
      (o.status !== ST.CANCEL ? '<button type="button" class="quietBtn" data-status="' + ST.CANCEL + '">ยกเลิกบิลนี้</button>' : '<button type="button" class="quietBtn" data-status="' + (paid ? ST.WAIT : ST.NEW) + '">เปิดบิลนี้ใหม่</button>') +
      '</div></div>';
  }
  function renderOrders() { renderSums(); renderRows(); renderDetail(); }
  async function setStatus(no, status, quiet) {
    const o = S.orders.filter(function (x) { return x.no === no; })[0];
    if (!o) return;
    const before = o.status;
    const track = $('#trackNo');
    const payload = { no: no, status: status };
    if (track && track.value !== o.tracking) { payload.tracking = track.value; o.tracking = track.value; }
    o.status = status;
    renderOrders();
    try {
      const res = await api('ownerUpdateOrder', payload);
      if (!res.ok) throw new Error(res.message);
      Object.assign(o, res.order);
      renderOrders();
      if (!quiet) toast('บิล #' + no + ' → ' + status, false, function () { setStatus(no, before, true); });
    } catch (x) {
      o.status = before;
      renderOrders();
      toast('เปลี่ยนสถานะไม่สำเร็จ เช็กเน็ตแล้วลองใหม่', true);
    }
  }
  async function loadOrders(silent) {
    try {
      const res = await api('ownerOrders');
      if (!res.ok) throw new Error(res.message);
      S.orders = res.orders;
      const typing = document.activeElement && document.activeElement.id === 'trackNo';
      if (typing) { renderSums(); renderRows(); } else renderOrders();
    } catch (x) { if (!silent) toast('โหลดออเดอร์ไม่สำเร็จ เช็กเน็ตแล้วลองใหม่', true); }
  }

  // ---------- สินค้า ----------
  function photoSrc(p) { return /^img\/[a-z]+\.webp$/.test(p.img || '') ? p.img.replace('.webp', '-460.webp') : (p.img || ''); }
  function renderProducts() {
    $('#productCount').textContent = '(' + S.products.length + ')';
    const box = $('#productRows');
    box.innerHTML = S.products.length ? S.products.map(function (p) {
      return '<button type="button" class="row' + (p.state === 'ขาย' ? '' : ' off') + '" data-product="' + esc(p.id) + '" aria-current="' + (S.editing && S.editing.id === p.id) + '">' +
        (p.img ? '<img class="prodThumb" src="' + esc(photoSrc(p)) + '" alt="" loading="lazy" width="56" height="56">' : '<span class="prodThumb"></span>') +
        '<span><span class="rowName">' + esc(p.name) + '</span><span class="rowSub">' + p.sizes.map(function (z) { return esc(z.name) + ' ' + money(z.price); }).join(' · ') + '</span></span>' +
        '<span class="rowEnd">' + (p.state === 'ขาย' ? '<span class="badge">ขายอยู่</span>' : '<span class="badge ' + (p.state === 'หมด' ? 'need' : 'done') + '">' + esc(p.state) + '</span>') + '</span></button>';
    }).join('') : '<div class="empty"><strong>ยังไม่มีสินค้า</strong><p>กด “เพิ่มสินค้า” เพื่อใส่ชิ้นแรก</p></div>';
    renderEditor();
  }
  function sizeRow(z) {
    return '<div class="sizeRow"><input aria-label="ชื่อขนาด" class="szName" value="' + esc(z.name) + '" placeholder="เช่น 1 โล" maxlength="30"><input aria-label="ราคา" class="szPrice" value="' + esc(z.price) + '" inputmode="decimal" placeholder="ราคา"><button type="button" class="iconBtn" data-size-del aria-label="ลบขนาดนี้"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button></div>';
  }
  function renderEditor() {
    const box = $('#productDetail'), p = S.editing;
    if (!p) {
      box.classList.remove('open');
      box.innerHTML = wide.matches ? '<div class="empty"><strong>เลือกสินค้าเพื่อแก้ราคา</strong></div>' : '';
      return;
    }
    if (!wide.matches) box.classList.add('open'); else box.classList.remove('open');
    const cats = []; S.products.forEach(function (x) { if (x.cat && cats.indexOf(x.cat) < 0) cats.push(x.cat); });
    box.innerHTML = '<div class="detailInner"><button type="button" class="backRow" data-back="1"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>สินค้าทั้งหมด</button>' +
      '<form class="panel edit" id="editForm" novalidate><h3>' + (p.id ? 'แก้ ' + esc(p.name) : 'เพิ่มสินค้าใหม่') + '</h3>' +
      '<div class="photoPick">' + (p.img ? '<img src="' + esc(photoSrc(p)) + '" alt="" width="88" height="88">' : '<span class="ph"></span>') + '<label class="ownerBtn"><input type="file" id="photoFile" accept="image/*">' + (p.img ? 'เปลี่ยนรูป' : 'ใส่รูป') + '</label></div>' +
      '<label>ชื่อสินค้า<input name="name" value="' + esc(p.name) + '" maxlength="80"></label>' +
      '<label>หมวด<input name="cat" value="' + esc(p.cat) + '" maxlength="40" list="catList"><datalist id="catList">' + cats.map(function (c) { return '<option value="' + esc(c) + '">'; }).join('') + '</datalist></label>' +
      '<label>คำอธิบายสั้นๆ<textarea name="desc" maxlength="300" rows="2">' + esc(p.desc) + '</textarea></label>' +
      '<div><div class="sizeHead"><span>ขนาด</span><span>ราคา (บาท)</span><span></span></div><div id="sizeRows" style="display:grid;gap:8px;margin-top:4px">' + (p.sizes.length ? p.sizes : [{ name: '', price: '' }]).map(sizeRow).join('') + '</div><button type="button" class="quietBtn" id="addSize">เพิ่มขนาด</button></div>' +
      '<div class="states" role="radiogroup" aria-label="สถานะสินค้า">' + ['ขาย', 'หมด', 'ซ่อน'].map(function (st) { return '<label><input type="radio" name="state" value="' + st + '"' + ((p.state || 'ขาย') === st ? ' checked' : '') + '><span>' + st + '</span></label>'; }).join('') + '</div>' +
      '<p class="formErr" id="editErr" role="alert" hidden></p>' +
      '<button type="submit" class="ownerBtn main wide" id="saveProduct">บันทึกสินค้า</button></form></div>';
  }
  function readEditor() {
    const f = $('#editForm');
    return {
      id: S.editing.id, img: S.editing.img, name: f.name.value, cat: f.cat.value, desc: f.desc.value, state: f.state.value,
      sizes: Array.from(f.querySelectorAll('.sizeRow')).map(function (r) { return { name: $('.szName', r).value.trim(), price: $('.szPrice', r).value.replace(/,/g, '').trim() }; }).filter(function (z) { return z.name || z.price; }),
    };
  }
  async function saveProduct() {
    const p = readEditor(), err = $('#editErr'), btn = $('#saveProduct');
    err.hidden = true;
    if (!p.name.trim()) { err.textContent = 'ใส่ชื่อสินค้าก่อน'; err.hidden = false; return; }
    if (!p.sizes.length || p.sizes.some(function (z) { return !z.name || !(Number(z.price) > 0); })) { err.textContent = 'ทุกขนาดต้องมีชื่อและราคามากกว่า 0'; err.hidden = false; return; }
    p.sizes = p.sizes.map(function (z) { return { name: z.name, price: Number(z.price) }; });
    btn.disabled = true; btn.textContent = 'กำลังบันทึก…';
    try {
      const res = await api('ownerSaveProduct', { product: p });
      if (!res.ok) throw new Error(res.message);
      await loadProducts();
      S.editing = S.products.filter(function (x) { return x.id === res.id; })[0] || null;
      if (!wide.matches) { S.editing = null; }
      renderProducts();
      toast('บันทึกแล้ว หน้าร้านเห็นราคาใหม่ทันที');
    } catch (x) {
      btn.disabled = false; btn.textContent = 'บันทึกสินค้า';
      err.textContent = x.message && !/fetch|network/i.test(x.message) ? x.message : 'บันทึกไม่สำเร็จ เช็กเน็ตแล้วลองใหม่';
      err.hidden = false;
    }
  }
  async function uploadPhoto(file) {
    try {
      toast('กำลังอัปโหลดรูป…');
      const url = URL.createObjectURL(file);
      const img = new Image(); img.src = url; await img.decode();
      const side = Math.min(img.width, img.height), k = Math.min(1, 900 / side);
      const c = document.createElement('canvas');
      c.width = c.height = Math.round(side * k);
      c.getContext('2d').drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      const data = c.toDataURL('image/jpeg', 0.78);
      const res = await api('ownerUploadPhoto', { mime: 'image/jpeg', imageBase64: data.split(',')[1] });
      if (!res.ok) throw new Error(res.message);
      Object.assign(S.editing, readEditor(), { img: window.ShopApi.isDemo ? data : res.url });
      renderEditor();
      toast('ใส่รูปแล้ว กดบันทึกสินค้าด้วย');
    } catch (x) { toast('อัปโหลดรูปไม่สำเร็จ ลองรูปอื่น', true); }
  }
  async function loadProducts() {
    const res = await api('ownerProducts');
    if (!res.ok) throw new Error(res.message);
    S.products = res.products; S.shop = res.shop;
    $('#shopName').textContent = S.shop.name || '';
  }

  // ---------- เหตุการณ์ ----------
  $('#app').addEventListener('click', function (e) {
    const tab = e.target.closest('[data-tab]');
    if (tab) {
      S.tab = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.tab === S.tab)); });
      $('#tabOrders').hidden = S.tab !== 'orders';
      $('#tabProducts').hidden = S.tab !== 'products';
      if (S.tab === 'products') renderProducts();
      return;
    }
    const filter = e.target.closest('[data-filter]');
    if (filter) { S.filter = filter.dataset.filter; renderSums(); renderRows(); return; }
    const row = e.target.closest('[data-no]');
    if (row) { S.current = row.dataset.no; renderRows(); renderDetail(); return; }
    const back = e.target.closest('[data-back]');
    if (back) {
      if (S.tab === 'orders') { S.current = null; renderOrders(); } else { S.editing = null; renderProducts(); }
      return;
    }
    const st = e.target.closest('[data-status]');
    if (st) { setStatus(S.current, st.dataset.status); return; }
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      const o = S.orders.filter(function (x) { return x.no === S.current; })[0];
      const text = o.name + ' ' + o.phone + '\n' + o.address;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(function () { toast('คัดลอกที่อยู่แล้ว'); }, function () { toast('คัดลอกไม่ได้ กดค้างที่ข้อความแทน', true); });
      return;
    }
    const prod = e.target.closest('[data-product]');
    if (prod) { S.editing = JSON.parse(JSON.stringify(S.products.filter(function (p) { return p.id === prod.dataset.product; })[0])); renderProducts(); return; }
    if (e.target.closest('#newProduct')) { S.editing = { id: '', name: '', cat: '', desc: '', img: '', sizes: [], state: 'ขาย' }; renderProducts(); const n = $('#editForm [name=name]'); if (n) n.focus(); return; }
    if (e.target.closest('#addSize')) { $('#sizeRows').insertAdjacentHTML('beforeend', sizeRow({ name: '', price: '' })); return; }
    const del = e.target.closest('[data-size-del]');
    if (del) { del.closest('.sizeRow').remove(); }
  });
  $('#app').addEventListener('submit', function (e) { if (e.target.id === 'editForm') { e.preventDefault(); saveProduct(); } });
  $('#app').addEventListener('change', function (e) {
    if (e.target.id === 'photoFile' && e.target.files[0]) uploadPhoto(e.target.files[0]);
    if (e.target.id === 'trackNo') {
      const no = S.current, value = e.target.value;
      api('ownerUpdateOrder', { no: no, tracking: value }).then(function (res) {
        if (!res.ok) throw new Error(res.message);
        const o = S.orders.filter(function (x) { return x.no === no; })[0];
        if (o) o.tracking = value;
        toast('บันทึกเลขพัสดุแล้ว');
      }).catch(function () { toast('บันทึกเลขพัสดุไม่สำเร็จ', true); });
    }
  });
  wide.addEventListener('change', function () { renderOrders(); if (S.tab === 'products') renderProducts(); });

  // ---------- เข้าระบบ ----------
  async function enter(key) {
    S.key = key;
    const check = await api('ownerCheck');
    if (!check.ok) return check;
    $('#gate').hidden = true;
    $('#app').hidden = false;
    await Promise.all([loadProducts(), loadOrders()]);
    renderOrders();
    setInterval(function () { if (!document.hidden) loadOrders(true); }, 60000);
    return check;
  }
  function showGate(msg) {
    $('#app').hidden = true;
    $('#gate').hidden = false;
    const err = $('#gateErr');
    err.hidden = !msg; err.textContent = msg || '';
  }
  $('#gateForm').addEventListener('submit', async function (e) {
    e.preventDefault();
    const key = $('#gateKey').value.trim();
    try {
      const res = await enter(key);
      if (res.ok) { try { localStorage.setItem(KEY_NAME, key); } catch (x) { /* โหมดส่วนตัว */ } $('#logout').hidden = false; } else showGate(res.message);
    } catch (x) { showGate('เชื่อมต่อไม่ได้ เช็กเน็ตแล้วลองใหม่'); }
  });
  $('#logout').addEventListener('click', function () { try { localStorage.removeItem(KEY_NAME); } catch (x) { /* ไม่มีให้ลบ */ } location.reload(); });

  (async function boot() {
    if (window.ShopApi.isDemo) {
      $('#demoStrip').hidden = false;
      await enter(await window.ShopApi.demoOwnerKey());
      return;
    }
    const m = /^#k=(.+)$/.exec(location.hash);
    let key = m ? decodeURIComponent(m[1]) : '';
    if (m) history.replaceState(null, '', location.pathname);
    if (!key) { try { key = localStorage.getItem(KEY_NAME) || ''; } catch (x) { key = ''; } }
    if (!key) { showGate(); return; }
    try {
      const res = await enter(key);
      if (res.ok) { try { localStorage.setItem(KEY_NAME, key); } catch (x) { /* โหมดส่วนตัว */ } $('#logout').hidden = false; } else showGate(res.message);
    } catch (x) { showGate('เชื่อมต่อไม่ได้ เช็กเน็ตแล้วลองใหม่'); }
  })();
})();
