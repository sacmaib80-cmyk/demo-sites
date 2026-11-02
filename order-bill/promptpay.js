/* promptpay.js — สร้างข้อความ QR พร้อมเพย์แบบกำหนดยอด (มาตรฐาน EMV ของ ธปท.)
   โครงเดียวกับไลบรารี promptpay-qr (MIT) · CRC ตรวจกับค่าอ้างอิงมาตรฐาน: "123456789" → 29B1 */
(function (root) {
  function crc16(text) {
    let crc = 0xffff;
    for (let i = 0; i < text.length; i++) {
      crc ^= text.charCodeAt(i) << 8;
      for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    return ('0000' + crc.toString(16).toUpperCase()).slice(-4);
  }
  function f(id, value) { return id + ('00' + value.length).slice(-2) + value; }
  function payload(target, amount) {
    const num = String(target).replace(/[^0-9]/g, '');
    const type = num.length >= 15 ? '03' : num.length >= 13 ? '02' : '01';
    const account = num.length >= 13 ? num : ('0000000000000' + num.replace(/^0/, '66')).slice(-13);
    const data = [
      f('00', '01'),
      f('01', amount ? '12' : '11'),
      f('29', f('00', 'A000000677010111') + f(type, account)),
      f('58', 'TH'),
      f('53', '764'),
      amount ? f('54', Number(amount).toFixed(2)) : '',
    ].join('');
    const withCrcHead = data + '6304';
    return withCrcHead + crc16(withCrcHead);
  }
  const out = { payload: payload, crc16: crc16 };
  if (typeof module !== 'undefined' && module.exports) module.exports = out;
  root.PromptPay = out;
})(typeof window !== 'undefined' ? window : globalThis);
