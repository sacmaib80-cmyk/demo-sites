// ===== ระบบรับออเดอร์ร้านค้า · Apps Script + Google Sheet =====
// หน้าเว็บอยู่คนละที่ (โฮสต์ไฟล์นิ่งฟรี) · ไฟล์นี้เก็บออเดอร์ลงชีตของร้านเอง
// ติดตั้ง: ดู README-TH.md → รัน setup ครั้งเดียว → ทำให้ใช้งานได้เป็นเว็บแอป (ดำเนินการในฐานะ: ฉัน · ผู้มีสิทธิ์: ทุกคน)
//
// "ทุกคน" ปลอดภัยเพราะไฟล์นี้ไม่มีคำสั่งไหนคืนออเดอร์ของคนอื่นให้คนที่ไม่มีรหัส
//   ลูกค้า = เห็นเฉพาะออเดอร์ที่ถือเลขที่ + รหัสลับของตัวเอง
//   เจ้าของร้าน = ต้องมี OWNER_KEY (สร้างตอน setup อยู่ในพร็อพเพอร์ตี้ของสคริปต์)
// ถ้าเพิ่มคำสั่งใหม่ที่อ่านออเดอร์ ต้องเพิ่มเคสใน tests/test-backend.cjs ด้วย

const TAB_P = 'สินค้า', TAB_O = 'ออเดอร์', TAB_S = 'ตั้งค่า';
const P_COLS = ['รหัส', 'ชื่อ', 'หมวด', 'รายละเอียด', 'รูป', 'ขนาดและราคา', 'สถานะ'];
const O_COLS = ['เลขที่', 'รหัสลับ', 'เวลา', 'สถานะ', 'ชื่อ', 'โทร', 'ที่อยู่', 'วิธีรับ', 'วิธีจ่าย', 'ค่าของ', 'ค่าส่ง', 'รวม', 'รายการ', 'สลิป', 'เลขพัสดุ', 'หมายเหตุ'];
const ST = { WAIT_PAY: 'รอโอน', SLIP: 'ตรวจสลิป', NEW: 'รอยืนยัน', OK: 'ยืนยันแล้ว', SENT: 'ส่งแล้ว', CANCEL: 'ยกเลิก' };
const P_STATES = ['ขาย', 'หมด', 'ซ่อน'];
const SHIP = 'ส่งถึงที่', PICKUP = 'มารับเอง';
const PAY_QR = 'โอนพร้อมเพย์', PAY_COD = 'จ่ายปลายทาง', PAY_SHOP = 'จ่ายที่ร้าน';
const MAX_LINES = 30, MAX_QTY = 99, MAX_IMAGE_BYTES = 3 * 1024 * 1024, MAX_SLIPS_PER_ORDER = 5;
const OWNER_ACTIONS = ['ownerCheck', 'ownerOrders', 'ownerUpdateOrder', 'ownerProducts', 'ownerSaveProduct', 'ownerUploadPhoto'];

// ---------- ติดตั้ง ----------
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty('SHEET_ID')) {
    Logger.log('ติดตั้งไว้แล้ว ไม่สร้างซ้ำ · ชีต: ' + openBook_().getUrl());
    return;
  }
  const ss = SpreadsheetApp.create('ออเดอร์ร้าน');
  ss.setSpreadsheetTimeZone('Asia/Bangkok');
  const first = ss.getSheets()[0].setName(TAB_O);
  first.appendRow(O_COLS);
  first.setFrozenRows(1);
  const p = ss.insertSheet(TAB_P);
  p.appendRow(P_COLS);
  p.setFrozenRows(1);
  sampleProducts_().forEach(function (r) { p.appendRow(r.map(cell_)); });
  const s = ss.insertSheet(TAB_S);
  s.appendRow(['ค่า', 'ข้อมูล']);
  s.setFrozenRows(1);
  sampleSettings_().forEach(function (r) { s.appendRow(r.map(cell_)); });
  const owner = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  props.setProperty('SHEET_ID', ss.getId());
  props.setProperty('OWNER_KEY', owner);
  props.setProperty('NEXT_NO', '1');
  props.setProperty('OWNER_EMAIL', Session.getEffectiveUser().getEmail());
  Logger.log('สร้างชีตแล้ว: ' + ss.getUrl());
  Logger.log('รหัสเจ้าของร้าน (เก็บเป็นความลับ): ' + owner);
}

function sampleSettings_() {
  return [
    ['ชื่อร้าน', 'ร้านตัวอย่าง'],
    ['คำโปรย', 'ใส่คำอธิบายร้านสั้นๆ'],
    ['ที่อยู่', 'ที่อยู่ร้าน'],
    ['โทร', ''],
    ['LINE OA', ''],
    ['พร้อมเพย์', ''],
    ['ชื่อบัญชีพร้อมเพย์', ''],
    ['ค่าส่ง', 50],
    ['ส่งฟรีเมื่อครบ', 1000],
    ['ตัดรอบ', 'สั่งก่อน 14:00 ส่งวันนี้'],
  ];
}

function sampleProducts_() {
  return [
    ['P1', 'สินค้าตัวอย่าง', 'ทั่วไป', 'แก้แถวนี้ในแท็บสินค้า หรือในหน้าเจ้าของร้าน', '', 'ครึ่งโล=65; 1 โล=120', 'ขาย'],
  ];
}

// ---------- ทางเข้า ----------
function doGet(e) {
  return run_(function () {
    const action = (e && e.parameter && e.parameter.action) || 'catalog';
    if (action !== 'catalog') throw err_('BAD_REQUEST', 'คำสั่งนี้ต้องส่งแบบ POST');
    return catalog_();
  });
}

function doPost(e) {
  return run_(function () {
    const body = JSON.parse(e.postData.contents);
    const action = String(body.action || '');
    if (OWNER_ACTIONS.indexOf(action) >= 0) requireOwner_(body);
    switch (action) {
      case 'catalog': return catalog_();
      case 'placeOrder': return placeOrder_(body);
      case 'orderStatus': return orderStatus_(body);
      case 'uploadSlip': return uploadSlip_(body);
      case 'ownerCheck': return { ok: true };
      case 'ownerOrders': return ownerOrders_(body);
      case 'ownerUpdateOrder': return ownerUpdateOrder_(body);
      case 'ownerProducts': return ownerProducts_();
      case 'ownerSaveProduct': return ownerSaveProduct_(body);
      case 'ownerUploadPhoto': return ownerUploadPhoto_(body);
      default: throw err_('BAD_REQUEST', 'ไม่รู้จักคำสั่งนี้');
    }
  });
}

function run_(fn) {
  let out;
  try {
    out = fn();
  } catch (x) {
    if (x && x.code) out = { ok: false, code: x.code, message: x.message };
    else {
      console.error(x);
      out = { ok: false, code: 'SERVER_ERROR', message: 'ระบบขัดข้อง ลองใหม่อีกครั้ง' };
    }
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function err_(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// ---------- ชีต ----------
function openBook_() {
  return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('SHEET_ID'));
}

// ใส่ ' นำหน้าข้อความทุกช่องที่มาจากคนนอก: กันสูตรในเซลล์ (=IMPORTXML…) และกันเลข 0 หน้าเบอร์โทรหาย
function cell_(v) {
  return typeof v === 'number' ? v : "'" + String(v == null ? '' : v);
}

function uncell_(v) {
  return typeof v === 'string' ? v.replace(/^'/, '') : v;
}

function rows_(sheet) {
  const all = sheet.getDataRange().getValues();
  const head = all[0].map(uncell_);
  const out = [];
  for (let i = 1; i < all.length; i++) {
    const o = { _row: i + 1 };
    head.forEach(function (h, c) { o[h] = uncell_(all[i][c]); });
    out.push(o);
  }
  return out;
}

function settings_() {
  const out = {};
  rows_(openBook_().getSheetByName(TAB_S)).forEach(function (r) { out[r['ค่า']] = r['ข้อมูล']; });
  return out;
}

function money_(n) {
  return Math.round(Number(n) * 100) / 100;
}

function parseSizes_(text) {
  return String(text || '').split(';').map(function (part) {
    const m = part.split('=');
    if (m.length !== 2) return null;
    const name = m[0].trim(), price = Number(m[1]);
    if (!name || !isFinite(price) || price <= 0) return null;
    return { name: name, price: money_(price) };
  }).filter(Boolean);
}

function publicProduct_(r) {
  return {
    id: String(r['รหัส']), name: r['ชื่อ'], cat: r['หมวด'], desc: r['รายละเอียด'], img: r['รูป'],
    sizes: parseSizes_(r['ขนาดและราคา']), state: r['สถานะ'] || 'ขาย',
  };
}

// ---------- หน้าร้าน ----------
function catalog_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('catalog');
  if (hit) return JSON.parse(hit);
  const s = settings_();
  const products = rows_(openBook_().getSheetByName(TAB_P)).map(publicProduct_)
    .filter(function (p) { return p.state !== 'ซ่อน' && p.sizes.length && p.name; });
  const out = {
    ok: true,
    shop: {
      name: s['ชื่อร้าน'], tagline: s['คำโปรย'], address: s['ที่อยู่'], phone: s['โทร'], lineOa: s['LINE OA'],
      promptpay: s['พร้อมเพย์'], promptpayName: s['ชื่อบัญชีพร้อมเพย์'], shipFee: Number(s['ค่าส่ง']) || 0,
      freeShipAt: Number(s['ส่งฟรีเมื่อครบ']) || 0, cutoff: s['ตัดรอบ'],
    },
    products: products,
  };
  try { cache.put('catalog', JSON.stringify(out), 60); } catch (x) { /* ใหญ่เกินเก็บก็แค่ไม่ใช้แคช */ }
  return out;
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, ' ').trim().slice(0, max);
}

function cleanCustomer_(c, delivery) {
  c = c || {};
  const out = {
    name: clean_(c.name, 80).replace(/\s+/g, ' '),
    phone: clean_(c.phone, 20).replace(/[^0-9]/g, ''),
    address: clean_(c.address, 300),
    note: clean_(c.note, 200),
  };
  if (!out.name) throw err_('BAD_CUSTOMER', 'ยังไม่ได้กรอกชื่อ');
  if (!/^0\d{8,9}$/.test(out.phone)) throw err_('BAD_CUSTOMER', 'เบอร์โทรไม่ถูกต้อง');
  if (delivery === SHIP && out.address.length < 10) throw err_('BAD_CUSTOMER', 'ที่อยู่สั้นไป ส่งของไม่ถึง');
  return out;
}

// ราคาทุกบาทคิดใหม่ที่นี่จากแท็บสินค้า ไม่เชื่อตัวเลขจากหน้าเว็บ
function priceItems_(items, delivery) {
  if (!Array.isArray(items) || !items.length) throw err_('EMPTY_ORDER', 'ยังไม่ได้เลือกสินค้า');
  if (items.length > MAX_LINES) throw err_('BAD_REQUEST', 'รายการเยอะเกินไป');
  const products = {};
  rows_(openBook_().getSheetByName(TAB_P)).forEach(function (r) { products[String(r['รหัส'])] = publicProduct_(r); });
  const s = catalog_().shop;
  const sold = [], lines = [];
  let satang = 0;
  items.forEach(function (it) {
    const p = products[String(it && it.id)];
    const qty = Number(it && it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) throw err_('BAD_REQUEST', 'จำนวนไม่ถูกต้อง');
    if (!p || p.state === 'ซ่อน') throw err_('NOT_FOUND', 'มีสินค้าที่ไม่มีแล้วในบิล');
    if (p.state === 'หมด') { sold.push(p.name); return; }
    const size = p.sizes.filter(function (z) { return z.name === it.size; })[0];
    if (!size) throw err_('PRICE_CHANGED', 'ขนาดสินค้าเปลี่ยนแล้ว');
    satang += Math.round(size.price * 100) * qty;
    lines.push({ id: p.id, name: p.name, size: size.name, price: size.price, qty: qty, sum: money_(size.price * qty) });
  });
  if (sold.length) throw err_('SOLD_OUT', 'ของหมดแล้ว: ' + sold.join(', '));
  const subtotal = satang / 100;
  const ship = delivery === SHIP && !(s.freeShipAt && subtotal >= s.freeShipAt) ? s.shipFee : 0;
  return { lines: lines, subtotal: subtotal, ship: ship, total: money_(subtotal + ship) };
}

function placeOrder_(b) {
  if (b.website) throw err_('BAD_REQUEST', 'ไม่รับคำสั่งนี้');
  const delivery = b.delivery === PICKUP ? PICKUP : SHIP;
  const pay = [PAY_QR, PAY_COD, PAY_SHOP].indexOf(b.pay) >= 0 ? b.pay : PAY_QR;
  if (delivery === PICKUP && pay === PAY_COD) throw err_('BAD_REQUEST', 'มารับเองเลือกจ่ายที่ร้านหรือโอน');
  if (delivery === SHIP && pay === PAY_SHOP) throw err_('BAD_REQUEST', 'ส่งถึงที่เลือกโอนหรือจ่ายปลายทาง');
  const reqId = clean_(b.reqId, 40);
  const cache = CacheService.getScriptCache();
  // กดส่งซ้ำตอนเน็ตช้า = ได้บิลเดิม ไม่นับเป็นการสั่งใหม่
  const again = reqId && cache.get('req:' + reqId);
  if (again) return JSON.parse(again);
  if (!hit_('orders:try', 120, 60)) throw err_('TOO_MANY', 'สั่งถี่เกินไป รอสักครู่แล้วลองใหม่');
  const c = cleanCustomer_(b.customer, delivery);
  const priced = priceItems_(b.items, delivery);
  if (Math.abs(Number(b.expectedTotal) - priced.total) > 0.001) {
    return { ok: false, code: 'PRICE_CHANGED', message: 'ราคาเปลี่ยนแล้ว ดูยอดใหม่ก่อนยืนยัน', lines: priced.lines, subtotal: priced.subtotal, ship: priced.ship, total: priced.total };
  }
  // นับเฉพาะออเดอร์ที่ผ่านทุกข้อ ลูกค้ากรอกผิดแล้วแก้ใหม่ต้องไม่โดนล็อก
  if (!hit_('orders:' + c.phone, 6, 3600)) throw err_('TOO_MANY', 'เบอร์นี้สั่งถี่เกินไป รอสักครู่แล้วลองใหม่');
  if (!hit_('orders:all', 60, 600)) throw err_('TOO_MANY', 'ตอนนี้มีออเดอร์เข้าเยอะมาก รอสักครู่แล้วลองใหม่');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let res;
  try {
    const seen = reqId && cache.get('req:' + reqId);
    if (seen) return JSON.parse(seen);
    const props = PropertiesService.getScriptProperties();
    const n = Number(props.getProperty('NEXT_NO')) || 1;
    props.setProperty('NEXT_NO', String(n + 1));
    const no = ('0000' + n).slice(-4);
    const token = Utilities.getUuid().replace(/-/g, '');
    const status = pay === PAY_QR ? ST.WAIT_PAY : ST.NEW;
    const when = new Date().toISOString();
    const row = {
      'เลขที่': no, 'รหัสลับ': token, 'เวลา': when, 'สถานะ': status, 'ชื่อ': c.name, 'โทร': c.phone,
      'ที่อยู่': delivery === SHIP ? c.address : '', 'วิธีรับ': delivery, 'วิธีจ่าย': pay,
      'ค่าของ': priced.subtotal, 'ค่าส่ง': priced.ship, 'รวม': priced.total,
      'รายการ': JSON.stringify(priced.lines), 'สลิป': '', 'เลขพัสดุ': '', 'หมายเหตุ': c.note,
    };
    openBook_().getSheetByName(TAB_O).appendRow(O_COLS.map(function (h) { return cell_(row[h]); }));
    res = { ok: true, token: token, order: publicOrder_(row) };
    if (reqId) cache.put('req:' + reqId, JSON.stringify(res), 3600);
  } finally {
    lock.releaseLock();
  }
  notifyOwner_('ออเดอร์ใหม่ #' + res.order.no + ' · ' + c.name + ' · ' + res.order.total + ' บาท · ' + pay);
  return res;
}

function maskPhone_(p) {
  const s = String(p);
  return s.length < 7 ? s : s.slice(0, 3) + '-xxx-' + s.slice(-4);
}

function publicOrder_(r) {
  let lines = [];
  try { lines = JSON.parse(r['รายการ']); } catch (x) { /* แถวที่เจ้าของแก้เอง */ }
  return {
    no: String(r['เลขที่']), when: r['เวลา'], status: r['สถานะ'], name: r['ชื่อ'], phone: maskPhone_(r['โทร']),
    address: r['ที่อยู่'], delivery: r['วิธีรับ'], pay: r['วิธีจ่าย'], subtotal: Number(r['ค่าของ']), ship: Number(r['ค่าส่ง']),
    total: Number(r['รวม']), lines: lines, hasSlip: !!r['สลิป'], tracking: r['เลขพัสดุ'], note: r['หมายเหตุ'],
  };
}

function findOrder_(no) {
  const want = String(no == null ? '' : no).trim();
  if (!want) return null;
  return rows_(openBook_().getSheetByName(TAB_O)).filter(function (r) { return String(r['เลขที่']) === want; })[0] || null;
}

// เลขผิดกับรหัสผิดตอบคำเดียวกัน ไม่ให้เดาได้ว่าเลขไหนมีจริง
function orderByToken_(b) {
  const r = findOrder_(b.no);
  if (!r || !b.token || String(r['รหัสลับ']) !== String(b.token)) throw err_('NOT_FOUND', 'ไม่พบออเดอร์นี้');
  return r;
}

function orderStatus_(b) {
  if (!hit_('status:all', 120, 60)) throw err_('TOO_MANY', 'ถี่เกินไป รอสักครู่');
  return { ok: true, order: publicOrder_(orderByToken_(b)) };
}

function imageBlob_(b, name) {
  const mime = String(b.mime || '');
  if (['image/jpeg', 'image/png', 'image/webp'].indexOf(mime) < 0) throw err_('BAD_IMAGE', 'รับเฉพาะไฟล์รูป JPG PNG WEBP');
  const text = String(b.imageBase64 || '');
  if (!text || text.length > MAX_IMAGE_BYTES * 1.4) throw err_('BAD_IMAGE', 'ไฟล์รูปใหญ่เกิน 3 MB');
  let bytes;
  try { bytes = Utilities.base64Decode(text); } catch (x) { throw err_('BAD_IMAGE', 'ไฟล์รูปเสีย'); }
  if (bytes.length > MAX_IMAGE_BYTES) throw err_('BAD_IMAGE', 'ไฟล์รูปใหญ่เกิน 3 MB');
  const u = function (i) { return bytes[i] & 0xff; };
  const isJpg = u(0) === 0xff && u(1) === 0xd8 && u(2) === 0xff;
  const isPng = u(0) === 0x89 && u(1) === 0x50 && u(2) === 0x4e && u(3) === 0x47;
  const isWebp = u(0) === 0x52 && u(1) === 0x49 && u(2) === 0x46 && u(3) === 0x46 && u(8) === 0x57 && u(9) === 0x45;
  if (!(isJpg || isPng || isWebp)) throw err_('BAD_IMAGE', 'ไฟล์นี้ไม่ใช่รูปภาพ');
  return Utilities.newBlob(bytes, mime, name);
}

function folder_(propName, title) {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty(propName);
  if (id) return DriveApp.getFolderById(id);
  const f = DriveApp.createFolder(title);
  props.setProperty(propName, f.getId());
  return f;
}

function uploadSlip_(b) {
  const r = orderByToken_(b);
  if (r['สถานะ'] === ST.CANCEL) throw err_('BAD_REQUEST', 'ออเดอร์นี้ยกเลิกแล้ว');
  if (!hit_('slip:' + r['เลขที่'], MAX_SLIPS_PER_ORDER, 3600)) throw err_('TOO_MANY', 'แนบสลิปถี่เกินไป');
  const file = folder_('SLIP_FOLDER_ID', 'สลิปลูกค้า').createFile(imageBlob_(b, 'สลิป-' + r['เลขที่']));
  const sh = openBook_().getSheetByName(TAB_O);
  sh.getRange(r._row, O_COLS.indexOf('สลิป') + 1).setValue(cell_(file.getUrl()));
  if (r['สถานะ'] === ST.WAIT_PAY) sh.getRange(r._row, O_COLS.indexOf('สถานะ') + 1).setValue(cell_(ST.SLIP));
  notifyOwner_('แนบสลิปแล้ว #' + r['เลขที่'] + ' · ' + r['รวม'] + ' บาท · ตรวจยอดในแอปธนาคารก่อนส่งของ');
  return { ok: true, order: publicOrder_(rows_(sh).filter(function (x) { return x._row === r._row; })[0]) };
}

// ---------- เจ้าของร้าน ----------
function requireOwner_(b) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('ownerfail')) || 0;
  if (fails >= 20) throw err_('LOCKED', 'ใส่รหัสผิดหลายครั้ง รอ 10 นาที');
  const real = PropertiesService.getScriptProperties().getProperty('OWNER_KEY');
  const given = String(b.key || '');
  let diff = real && given.length === real.length ? 0 : 1;
  for (let i = 0; i < given.length && real && i < real.length; i++) diff |= given.charCodeAt(i) ^ real.charCodeAt(i);
  if (diff) {
    cache.put('ownerfail', String(fails + 1), 600);
    throw err_('NOT_OWNER', 'รหัสเจ้าของร้านไม่ถูกต้อง');
  }
}

function ownerOrder_(r) {
  const o = publicOrder_(r);
  o.phone = String(r['โทร']);
  o.slip = r['สลิป'];
  return o;
}

function ownerOrders_(b) {
  const all = rows_(openBook_().getSheetByName(TAB_O)).reverse();
  const limit = Math.min(Number(b.limit) || 200, 500);
  return { ok: true, orders: all.slice(0, limit).map(ownerOrder_), total: all.length };
}

function ownerUpdateOrder_(b) {
  const r = findOrder_(b.no);
  if (!r) throw err_('NOT_FOUND', 'ไม่พบออเดอร์นี้');
  const sh = openBook_().getSheetByName(TAB_O);
  if (b.status !== undefined) {
    const valid = Object.keys(ST).map(function (k) { return ST[k]; });
    if (valid.indexOf(b.status) < 0) throw err_('BAD_REQUEST', 'สถานะไม่ถูกต้อง');
    sh.getRange(r._row, O_COLS.indexOf('สถานะ') + 1).setValue(cell_(b.status));
  }
  if (b.tracking !== undefined) sh.getRange(r._row, O_COLS.indexOf('เลขพัสดุ') + 1).setValue(cell_(clean_(b.tracking, 60)));
  return { ok: true, order: ownerOrder_(findOrder_(b.no)) };
}

function ownerProducts_() {
  const products = rows_(openBook_().getSheetByName(TAB_P)).map(publicProduct_);
  return { ok: true, products: products, shop: catalog_().shop };
}

function ownerSaveProduct_(b) {
  const p = b.product || {};
  const name = clean_(p.name, 80);
  if (!name) throw err_('BAD_PRODUCT', 'ยังไม่ได้ใส่ชื่อสินค้า');
  const sizes = (Array.isArray(p.sizes) ? p.sizes : []).map(function (z) {
    return { name: clean_(z.name, 30).replace(/[=;]/g, ' ').trim(), price: money_(z.price) };
  });
  if (!sizes.length || sizes.some(function (z) { return !z.name || !(z.price > 0) || z.price > 1000000; })) {
    throw err_('BAD_PRODUCT', 'ขนาดหรือราคาไม่ถูกต้อง');
  }
  const state = P_STATES.indexOf(p.state) >= 0 ? p.state : 'ขาย';
  const img = clean_(p.img, 500);
  if (img && !/^(https:\/\/|img\/|data:image\/)/.test(img)) throw err_('BAD_PRODUCT', 'ลิงก์รูปไม่ถูกต้อง');
  const row = [name, clean_(p.cat, 40), clean_(p.desc, 300), img, sizes.map(function (z) { return z.name + '=' + z.price; }).join('; '), state];
  const sh = openBook_().getSheetByName(TAB_P);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let id = clean_(p.id, 20);
  try {
    const found = id && rows_(sh).filter(function (r) { return String(r['รหัส']) === id; })[0];
    if (found) sh.getRange(found._row, 2, 1, row.length).setValues([row.map(cell_)]);
    else {
      id = 'P' + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
      sh.appendRow([id].concat(row).map(cell_));
    }
  } finally {
    lock.releaseLock();
  }
  CacheService.getScriptCache().remove('catalog');
  return { ok: true, id: id };
}

function ownerUploadPhoto_(b) {
  const file = folder_('PHOTO_FOLDER_ID', 'รูปสินค้า').createFile(imageBlob_(b, 'สินค้า-' + Date.now()));
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w900' };
}

// ---------- กันยิงรัว + แจ้งเตือน ----------
function hit_(key, limit, seconds) {
  const cache = CacheService.getScriptCache();
  const n = Number(cache.get('hit:' + key)) || 0;
  if (n >= limit) return false;
  cache.put('hit:' + key, String(n + 1), seconds);
  return true;
}

// ออเดอร์ต้องไม่หายถ้าแจ้งเตือนพัง จึงจับ error ทุกทาง
function notifyOwner_(text) {
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('LINE_TOKEN'), to = props.getProperty('OWNER_LINE_USER_ID');
  if (token && to) {
    try {
      const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + token },
        payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: text }] }),
      });
      if (res.getResponseCode() === 200) return;
    } catch (x) { console.error(x); }
  }
  const mail = props.getProperty('OWNER_EMAIL');
  if (!mail) return;
  try { MailApp.sendEmail(mail, text, text + '\n\nเปิดหน้าเจ้าของร้านเพื่อดูรายละเอียด'); } catch (x) { console.error(x); }
}
