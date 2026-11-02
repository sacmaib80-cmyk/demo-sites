/* bill-image.js — วาดบิลเป็นรูปให้ลูกค้าเก็บหรือส่งเข้าแชต (ไม่ใช้ไลบรารีแคปหน้าจอ เบากว่าและคมกว่า) */
window.BillImage = (function () {
  const BILL = '#ffec6e', PRINT = '#c8162b', PEN = '#1a39d0', INK = '#12131a';
  const HAND = "'Sriracha', 'Anuphan', cursive", BODY = "'Anuphan', sans-serif", MARK = "'Chonburi', 'Anuphan', serif";
  function money(n) { n = Number(n) || 0; return n.toLocaleString('th-TH', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }); }

  function wrap(x, text, maxWidth) {
    // ตัดบรรทัดภาษาไทยด้วย Intl.Segmenter ไม่ให้ตัดกลางคำ
    const seg = window.Intl && Intl.Segmenter ? Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(text), function (s) { return s.segment; }) : text.split('');
    const lines = []; let cur = '';
    seg.forEach(function (w) {
      if (x.measureText(cur + w).width > maxWidth && cur) { lines.push(cur); cur = w.trimStart(); } else cur += w;
    });
    if (cur) lines.push(cur);
    return lines;
  }

  async function draw(o, shop) {
    await Promise.all([document.fonts.load('28px Sriracha'), document.fonts.load('700 28px Anuphan'), document.fonts.load('32px Chonburi')]).catch(function () {});
    const W = 900, M = 48, scale = 1;
    const c = document.createElement('canvas');
    const measure = c.getContext('2d');
    measure.font = '30px ' + HAND;
    const addressLines = o.address ? wrap(measure, o.address, W - M * 2 - 90) : [];
    const lineRows = o.lines.map(function (l) { return wrap(measure, l.name + ' ' + l.size, W - M * 2 - 190); });
    const rowsH = lineRows.reduce(function (n, r) { return n + r.length * 40 + 42; }, 0);
    const H = 240 + 62 * 2 + Math.max(addressLines.length, 1) * 42 + 20 + 50 + rowsH + 190 + 70;
    c.width = W * scale; c.height = H * scale;
    const x = c.getContext('2d');
    x.fillStyle = BILL; x.fillRect(0, 0, W, H);

    x.fillStyle = PRINT; x.textBaseline = 'alphabetic';
    x.font = '46px ' + MARK; x.fillText(shop.name || '', M, 92);
    x.font = '500 24px ' + BODY; x.fillText('บิลเงินสด', M, 130);
    x.textAlign = 'right';
    x.font = '500 22px ' + BODY; x.fillText('เลขที่', W - M, 62);
    x.font = '700 44px ' + BODY; x.fillText(o.no, W - M, 108);
    x.textAlign = 'left';
    x.strokeStyle = PRINT; x.lineWidth = 4; x.beginPath(); x.moveTo(M, 152); x.lineTo(W - M, 152); x.stroke();

    const date = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(o.when));
    x.textAlign = 'right'; x.fillStyle = PEN; x.font = '30px ' + HAND; x.fillText(date, W - M, 196); x.textAlign = 'left';

    let y = 240;
    const field = function (label, rows) {
      x.fillStyle = PRINT; x.font = '500 24px ' + BODY; x.fillText(label, M, y);
      x.fillStyle = PEN; x.font = '30px ' + HAND;
      rows.forEach(function (t, i) { x.fillText(t, M + 90, y + i * 42); });
      y += (rows.length - 1) * 42 + 14;
      x.strokeStyle = PRINT; x.lineWidth = 1.5; x.beginPath(); x.moveTo(M, y); x.lineTo(W - M, y); x.stroke();
      y += 48;
    };
    field('นาม', [o.name]);
    field('โทร', [o.phone]);
    field(o.address ? 'ที่อยู่' : 'รับของ', o.address ? addressLines : [o.delivery]);

    x.fillStyle = PRINT; x.font = '500 22px ' + BODY; x.fillText('รายการ', M, y - 8);
    x.textAlign = 'right'; x.fillText('จำนวนเงิน (บาท)', W - M, y - 8); x.textAlign = 'left';
    x.lineWidth = 2; x.beginPath(); x.moveTo(M, y + 4); x.lineTo(W - M, y + 4); x.stroke();
    y += 44;
    o.lines.forEach(function (l, i) {
      x.fillStyle = PEN; x.font = '30px ' + HAND;
      lineRows[i].forEach(function (t, k) { x.fillText(t, M, y + k * 40); });
      x.textAlign = 'right'; x.fillText(money(l.sum), W - M, y); x.textAlign = 'left';
      y += (lineRows[i].length - 1) * 40 + 34;
      x.fillStyle = PRINT; x.font = '500 20px ' + BODY; x.fillText(l.qty + ' × ' + money(l.price) + ' บาท', M, y - 2);
      y += 12;
      x.strokeStyle = 'rgba(200,22,43,.45)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(M, y); x.lineTo(W - M, y); x.stroke();
      y += 36;
    });
    const row = function (label, value) {
      x.fillStyle = PRINT; x.font = '500 22px ' + BODY; x.fillText(label, M, y);
      x.textAlign = 'right'; x.fillStyle = PEN; x.font = '30px ' + HAND; x.fillText(value, W - M, y); x.textAlign = 'left';
      y += 44;
    };
    row('ค่าของ', money(o.subtotal));
    if (o.delivery === 'ส่งถึงที่') row('ค่าส่ง', o.ship ? money(o.ship) : 'ส่งฟรี');
    x.strokeStyle = PRINT; x.lineWidth = 4; x.beginPath(); x.moveTo(M, y - 26); x.lineTo(W - M, y - 26); x.stroke();
    y += 26;
    x.fillStyle = PRINT; x.font = '500 26px ' + BODY; x.fillText('รวมเงิน', M, y);
    x.textAlign = 'right'; x.fillStyle = PEN; x.font = '52px ' + HAND; x.fillText(money(o.total), W - M, y + 4); x.textAlign = 'left';

    // ตรายางลงที่ว่างข้างยอดรวมเหมือนบิลจริง ไม่ทับข้อมูล
    x.save();
    x.translate(M + 150, y + 2); x.rotate(-7 * Math.PI / 180);
    x.globalAlpha = 0.86; x.strokeStyle = PRINT; x.lineWidth = 5; x.fillStyle = PRINT;
    x.font = '700 34px ' + BODY;
    const label = 'รับออเดอร์แล้ว';
    const tw = x.measureText(label).width;
    x.strokeRect(-14, -40, tw + 28, 56);
    x.fillText(label, 0, 0);
    x.restore();
    // ตัดส่วนล่างที่ว่างออกตามความยาวจริงของบิล
    const out = document.createElement('canvas');
    out.width = W; out.height = Math.min(H, y + 56);
    out.getContext('2d').drawImage(c, 0, 0);
    return out;
  }

  async function blob(order, shop) {
    const c = await draw(order, shop);
    return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error('toBlob')); }, 'image/png'); });
  }
  return { draw: draw, blob: blob };
})();
