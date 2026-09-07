/* Thư viện nhỏ gọi GitHub Contents API để đọc/ghi file trong repo dữ liệu */
window.GH = (function () {
  const C = window.VNA_CONFIG;
  const KEY = 'vna_gh_token';
  const base = () => `https://api.github.com/repos/${C.owner}/${C.dataRepo}`;
  const token = () => localStorage.getItem(KEY) || sessionStorage.getItem('vna_gh_token_session') || '';
  const setToken = (t) => (t ? localStorage.setItem(KEY, t.trim()) : localStorage.removeItem(KEY));

  async function api(path, opts = {}) {
    const r = await fetch(base() + path, {
      ...opts,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token()}`, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
    });
    if (r.status === 404 && opts.allow404) return null;
    if (!r.ok) { let m = ''; try { m = (await r.json()).message; } catch {} throw new Error(`GitHub ${r.status}: ${m || r.statusText}`); }
    return r.status === 204 ? null : r.json();
  }

  // base64 <-> utf8
  const b64encode = (str) => { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach((b) => (bin += String.fromCharCode(b))); return btoa(bin); };
  const b64decode = (b64) => { const bin = atob(b64.replace(/\n/g, '')); const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0)); return new TextDecoder().decode(bytes); };
  const blobToB64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(blob); });

  async function getFile(path) { return api(`/contents/${path}?ref=${C.branch}&t=${Date.now()}`, { allow404: true, cache: 'no-store' }); }
  async function readJSON(path, fallback = null) { const f = await getFile(path); if (!f) return { data: fallback, sha: null }; return { data: JSON.parse(b64decode(f.content)), sha: f.sha }; }
  async function putRaw(path, contentB64, message) {
    const cur = await getFile(path);
    return api(`/contents/${path}`, { method: 'PUT', body: JSON.stringify({ message, content: contentB64, branch: C.branch, ...(cur ? { sha: cur.sha } : {}) }) });
  }
  const writeJSON = (path, obj, message) => putRaw(path, b64encode(JSON.stringify(obj, null, 2) + '\n'), message);
  const uploadBlob = async (path, blob, message) => putRaw(path, await blobToB64(blob), message);
  async function deleteFile(path, message) { const cur = await getFile(path); if (!cur) return null; return api(`/contents/${path}`, { method: 'DELETE', body: JSON.stringify({ message, sha: cur.sha, branch: C.branch }) }); }
  async function check() { const r = await api(''); return { name: r.full_name, private: r.private, canPush: !!r.permissions?.push }; }

  return { token, setToken, api, getFile, readJSON, writeJSON, uploadBlob, deleteFile, check };
})();
