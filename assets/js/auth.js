/* Đăng nhập admin + giải mã token GitHub được lưu (đã mã hoá bằng mật khẩu) trong repo dữ liệu */
window.VNA_AUTH = (function () {
  const C = window.VNA_CONFIG;
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

  async function sha256(str) { const b = await crypto.subtle.digest('SHA-256', enc.encode(str)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  async function deriveKey(password, salt) {
    const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encrypt(password, text) {
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
    return { v: 1, salt: b64(salt), iv: b64(iv), ct: b64(ct) };
  }
  async function decrypt(password, blob) {
    const key = await deriveKey(password, unb64(blob.salt));
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, key, unb64(blob.ct));
    return dec.decode(pt);
  }
  async function checkPassword(user, pass) { return user.trim() === C.admin.user && (await sha256(pass)) === C.admin.passHash; }

  // Đăng nhập: kiểm tra tk/mk, sau đó thử lấy token đã mã hoá (data/auth.json) và giải mã cho phiên này
  async function login(user, pass) {
    if (!(await checkPassword(user, pass))) return false;
    sessionStorage.setItem('vna_admin', '1');
    try {
      const r = await fetch(`${C.dataBase}data/auth.json?v=${Date.now()}`, { cache: 'no-store' });
      if (r.ok) { const blob = await r.json(); const token = await decrypt(pass, blob); if (token) sessionStorage.setItem('vna_gh_token_session', token.trim()); }
    } catch (e) { console.warn('Không giải mã được token đã lưu:', e.message); }
    return true;
  }
  function logout() { sessionStorage.removeItem('vna_admin'); sessionStorage.removeItem('vna_gh_token_session'); }
  return { sha256, encrypt, decrypt, checkPassword, login, logout };
})();
