/* api.js — ทางเดียวที่หน้าเว็บคุยกับหลังบ้าน
   ใช้ POST แบบ text/plain เพราะ Apps Script ไม่ตอบ preflight (CORS)
   โหมดตัวอย่าง: รัน Code.gs ตัวจริงในเบราว์เซอร์บนบริการจำลอง โค้ดฝั่งร้านจึงเป็นชุดเดียวกับของจริง */
window.ShopApi = (function () {
  const cfg = window.SHOP_CONFIG || {};
  const DEMO_KEY = 'orderbill-demo-v1';
  let demo = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function bootDemo() {
    if (demo) return demo;
    demo = (async function () {
      await loadScript('backend/fake-gas.js');
      await loadScript('backend/demo-seed.js');
      const src = await (await fetch('backend/Code.gs')).text();
      const fake = window.FakeGas.createFakeGas({
        dataUrls: true,
        load: function () { try { return JSON.parse(localStorage.getItem(DEMO_KEY)); } catch (x) { return null; } },
        save: function (db) { try { localStorage.setItem(DEMO_KEY, JSON.stringify(db)); } catch (x) { /* เต็มก็เล่นต่อในหน่วยความจำได้ */ } },
      });
      const api = window.FakeGas.bootBackend(src, fake);
      if (!fake.db().props.SHEET_ID) { api.setup(); window.DemoSeed.seed(fake); fake.services.PropertiesService.getScriptProperties().setProperty('SEEDED', '1'); }
      return { api: api, fake: fake };
    })();
    return demo;
  }

  async function call(action, payload) {
    const body = Object.assign({ action: action }, payload || {});
    if (!cfg.apiUrl) {
      const d = await bootDemo();
      return window.FakeGas.callPost(d.api, body);
    }
    const res = await fetch(cfg.apiUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  return {
    isDemo: !cfg.apiUrl,
    call: call,
    demoOwnerKey: async function () { const d = await bootDemo(); return d.fake.db().props.OWNER_KEY; },
    resetDemo: function () { try { localStorage.removeItem(DEMO_KEY); } catch (x) { /* ไม่มีให้ลบ */ } },
  };
})();
