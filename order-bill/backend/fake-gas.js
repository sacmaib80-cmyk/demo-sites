/* fake-gas.js — ตัวจำลองบริการ Google สำหรับรัน Code.gs นอก Google
 * ใช้ 2 ที่: เทสใน Node และโหมดตัวอย่างในเบราว์เซอร์ (ข้อมูลอยู่ใน localStorage ของคนเปิด)
 * ลอกพฤติกรรมที่เคยกัดคนจริงไว้: ค่าที่ขึ้นต้น ' = ข้อความ · ขึ้นต้น = คือสูตร · ตัวเลขล้วนกลายเป็น number (0 หน้าหาย)
 *   และ base64Decode คืนไบต์แบบมีเครื่องหมาย (-128..127) เหมือนของจริง
 * สิ่งที่ตัวนี้จำลองไม่ได้: สิทธิ์ของ Google · เวลาตอบจริง · โควตา ต้องลองบนบัญชีจริงอีกรอบ */
(function (root) {
  function storeValue(v, stats) {
    if (typeof v !== 'string') return v;
    if (v[0] === "'") return v.slice(1);
    if (/^[=]/.test(v)) { if (stats) stats.formulas.push(v); return '#FORMULA!'; }
    if (v !== '' && !isNaN(Number(v))) return Number(v);
    return v;
  }

  function makeSheet(book, data) {
    const s = {
      getName: function () { return data.name; },
      setName: function (n) { data.name = n; return s; },
      setFrozenRows: function () { return s; },
      getLastRow: function () { return data.rows.length; },
      appendRow: function (r) { data.rows.push(r.map(function (v) { return storeValue(v, book.stats); })); book.save(); return s; },
      getDataRange: function () { return { getValues: function () { return data.rows.map(function (r) { return r.slice(); }); } }; },
      getRange: function (row, col, nr, nc) {
        return {
          setValue: function (v) { while (data.rows.length < row) data.rows.push([]); data.rows[row - 1][col - 1] = storeValue(v, book.stats); book.save(); },
          getValue: function () { return data.rows[row - 1][col - 1]; },
          setValues: function (vals) {
            for (let i = 0; i < (nr || 1); i++) for (let j = 0; j < (nc || 1); j++) data.rows[row - 1 + i][col - 1 + j] = storeValue(vals[i][j], book.stats);
            book.save();
          },
        };
      },
    };
    return s;
  }

  function createFakeGas(opts) {
    opts = opts || {};
    const load = opts.load || function () { return null; };
    const persist = opts.save || function () {};
    let db = load() || { props: {}, sheets: null, files: {}, seq: 0 };
    const cacheMem = {};
    const now = opts.now || function () { return Date.now(); };
    const sent = { line: [], mail: [] };
    const stats = { formulas: [] };
    const save = function () { persist(db); };

    const book = {
      stats: stats, save: save,
      getId: function () { return 'book-1'; },
      getUrl: function () { return 'https://docs.google.com/spreadsheets/d/book-1'; },
      setSpreadsheetTimeZone: function () {},
      getSheets: function () { return db.sheets.map(function (d) { return makeSheet(book, d); }); },
      getSheetByName: function (n) { const d = db.sheets.filter(function (x) { return x.name === n; })[0]; return d ? makeSheet(book, d) : null; },
      insertSheet: function (n) { const d = { name: n, rows: [] }; db.sheets.push(d); save(); return makeSheet(book, d); },
    };

    const svc = {
      SpreadsheetApp: {
        create: function () { db.sheets = [{ name: 'Sheet1', rows: [] }]; save(); return book; },
        openById: function () { return book; },
      },
      PropertiesService: {
        getScriptProperties: function () {
          return {
            getProperty: function (k) { return k in db.props ? db.props[k] : null; },
            setProperty: function (k, v) { db.props[k] = String(v); save(); },
          };
        },
      },
      CacheService: {
        getScriptCache: function () {
          return {
            get: function (k) { const c = cacheMem[k]; if (!c || c.until < now()) return null; return c.v; },
            put: function (k, v, secs) {
              if (String(v).length > 100000) throw new Error('Argument too large');
              cacheMem[k] = { v: String(v), until: now() + secs * 1000 };
            },
            remove: function (k) { delete cacheMem[k]; },
          };
        },
      },
      LockService: { getScriptLock: function () { return { waitLock: function () {}, releaseLock: function () {} }; } },
      ContentService: {
        MimeType: { JSON: 'json' },
        createTextOutput: function (t) { const o = { text: t, setMimeType: function () { return o; }, getContent: function () { return t; } }; return o; },
      },
      Utilities: {
        getUuid: function () {
          const h = '0123456789abcdef'; let s = '';
          for (let i = 0; i < 32; i++) s += h[Math.floor(Math.random() * 16)];
          return s.slice(0, 8) + '-' + s.slice(8, 12) + '-' + s.slice(12, 16) + '-' + s.slice(16, 20) + '-' + s.slice(20);
        },
        base64Decode: function (t) {
          if (!/^[A-Za-z0-9+/=\s]*$/.test(t)) throw new Error('Could not decode string.');
          const bin = (root.atob || function (x) { return Buffer.from(x, 'base64').toString('binary'); })(t);
          const out = new Array(bin.length);
          for (let i = 0; i < bin.length; i++) { const c = bin.charCodeAt(i); out[i] = c > 127 ? c - 256 : c; }
          return out;
        },
        newBlob: function (bytes, mime, name) { return { bytes: bytes, mime: mime, name: name }; },
      },
      DriveApp: {
        Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' }, Permission: { VIEW: 'VIEW' },
        createFolder: function (title) { const id = 'folder-' + (++db.seq); db.files[id] = { title: title }; save(); return svc.DriveApp.getFolderById(id); },
        getFolderById: function (id) {
          return {
            getId: function () { return id; },
            createFile: function (blob) {
              const fid = 'file-' + (++db.seq);
              const bytes = blob.bytes.map(function (b) { return b & 0xff; });
              let bin = ''; bytes.forEach(function (b) { bin += String.fromCharCode(b); });
              const data = 'data:' + blob.mime + ';base64,' + (root.btoa || function (x) { return Buffer.from(x, 'binary').toString('base64'); })(bin);
              db.files[fid] = { name: blob.name, url: data, shared: false };
              save();
              return {
                getId: function () { return fid; },
                getUrl: function () { return opts.dataUrls ? data : 'https://drive.google.com/file/d/' + fid + '/view'; },
                setSharing: function () { db.files[fid].shared = true; save(); },
              };
            },
          };
        },
      },
      UrlFetchApp: { fetch: function (u, o) { sent.line.push({ url: u, body: o && o.payload }); return { getResponseCode: function () { return opts.lineStatus || 200; } }; } },
      MailApp: { sendEmail: function (to, sub, text) { sent.mail.push({ to: to, sub: sub, text: text }); } },
      Session: { getEffectiveUser: function () { return { getEmail: function () { return 'owner@example.com'; } }; } },
      Logger: { log: opts.log || function () {} },
      console: { error: opts.onError || function () {}, log: function () {} },
    };

    return { services: svc, sent: sent, stats: stats, db: function () { return db; } };
  }

  // รันโค้ด Code.gs ด้วยบริการจำลองแล้วคืนฟังก์ชันที่ Google จะเรียก
  function bootBackend(source, fake, seedFn) {
    const names = Object.keys(fake.services);
    const code = source + '\n;return { doGet: doGet, doPost: doPost, setup: setup, cell_: cell_ };';
    const api = new Function(names.join(','), code).apply(null, names.map(function (n) { return fake.services[n]; }));
    if (seedFn) seedFn(api, fake);
    return api;
  }

  function callPost(api, body) {
    return JSON.parse(api.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  }

  function callGet(api, params) {
    return JSON.parse(api.doGet({ parameter: params || {} }).getContent());
  }

  const out = { createFakeGas: createFakeGas, bootBackend: bootBackend, callPost: callPost, callGet: callGet };
  if (typeof module !== 'undefined' && module.exports) module.exports = out;
  root.FakeGas = out;
})(typeof window !== 'undefined' ? window : globalThis);
