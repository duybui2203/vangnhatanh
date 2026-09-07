/* Trang quản trị Vàng Nhật Anh */
(function () {
  const C = window.VNA_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const imgUrl = (p) => (!p ? '' : /^https?:/i.test(p) ? p : `${C.dataBase}${p}?v=${Date.now()}`);
  const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
  const slugify = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'muc';
  const vnDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);

  const state = { settings: null, categories: [], products: {}, curCat: null };

  // ---------- Tiện ích UI ----------
  function toast(msg, ms = 3200) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t); setTimeout(() => t.remove(), ms); }
  function busy(on, text = 'Đang lưu…') { $('#busy').classList.toggle('on', !!on); $('#busyText').textContent = text; }
  function openModal(id) { $(id).classList.add('open'); }
  function closeModals() { $$('.modal').forEach((m) => m.classList.remove('open')); }
  $$('[data-close]').forEach((b) => b.addEventListener('click', closeModals));
  $$('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m) closeModals(); }));
  async function run(text, fn) {
    if (!GH.token()) { toast('Chưa có GitHub token. Vào tab “Kết nối GitHub”.'); showTab('token'); return false; }
    busy(true, text);
    try { await fn(); toast('Đã lưu. Website sẽ tự cập nhật trong giây lát.'); return true; }
    catch (e) { console.error(e); alert('Lỗi: ' + e.message); return false; }
    finally { busy(false); }
  }

  // ---------- Nén ảnh trên trình duyệt ----------
  async function compressImage(file, { maxW = 1600, maxH = 1600, quality = 0.82, square = false } = {}) {
    const bmp = await createImageBitmap(file);
    let { width: w, height: h } = bmp;
    let sx = 0, sy = 0, sw = w, sh = h;
    if (square) { const m = Math.min(w, h); sx = (w - m) / 2; sy = (h - m) / 2; sw = sh = m; w = h = m; }
    const scale = Math.min(1, maxW / w, maxH / h);
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
    cv.getContext('2d').drawImage(bmp, sx, sy, sw, sh, 0, 0, cw, ch);
    let blob = await new Promise((r) => cv.toBlob(r, 'image/webp', quality));
    let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') { blob = await new Promise((r) => cv.toBlob(r, 'image/jpeg', quality)); ext = 'jpg'; }
    return { blob, ext };
  }
  function previewFile(input, img) { input.addEventListener('change', () => { const f = input.files[0]; if (f) img.src = URL.createObjectURL(f); }); }

  // ---------- Cổng đăng nhập ----------
  async function sha256(str) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join(''); }
  $('#gateForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = await VNA_AUTH.login($('#gateUser').value, $('#gatePass').value);
    if (!ok) return ($('#gateError').textContent = 'Sai tài khoản hoặc mật khẩu.');
    enter();
  });
  $('#logoutBtn').addEventListener('click', () => { VNA_AUTH.logout(); location.href = '../'; });

  // ---------- Tabs ----------
  function showTab(name) { $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name)); $$('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name)); history.replaceState(null, '', '#' + name); }
  $$('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

  // ---------- Token ----------
  $('#repoName').textContent = `${C.owner}/${C.dataRepo}`;
  $('#tokenSave').addEventListener('click', async () => {
    const t = $('#tokenInput').value.trim(); if (!t) return;
    GH.setToken(t); await checkToken();
  });
  $('#tokenClear').addEventListener('click', () => { GH.setToken(''); sessionStorage.removeItem('vna_gh_token_session'); $('#tokenInput').value = ''; $('#tokenStatus').innerHTML = ''; $('#repoInfo').textContent = 'Chưa kết nối GitHub'; });
  // Lưu token lên web dưới dạng mã hoá bằng mật khẩu admin -> máy khác chỉ cần đăng nhập tk/mk
  $('#tokenPublish').addEventListener('click', async () => {
    const t = $('#tokenInput').value.trim() || GH.token(); if (!t) return alert('Chưa có token.');
    const pass = prompt('Nhập lại mật khẩu admin để mã hoá token:'); if (pass == null) return;
    if (!(await VNA_AUTH.checkPassword(C.admin.user, pass))) return alert('Mật khẩu không đúng.');
    GH.setToken(t);
    await run('Đang mã hoá & lưu token…', async () => {
      const blob = await VNA_AUTH.encrypt(pass, t);
      await GH.writeJSON('data/auth.json', blob, 'Lưu token admin (đã mã hoá)');
    });
    await checkToken();
  });
  $('#tokenUnpublish').addEventListener('click', async () => {
    if (!confirm('Xóa token đã lưu trên web? Các máy khác sẽ phải nhập token lại.')) return;
    await run('Đang xóa…', () => GH.deleteFile('data/auth.json', 'Xóa token admin đã lưu'));
  });
  async function checkToken() {
    const st = $('#tokenStatus');
    if (!GH.token()) { st.innerHTML = '<div class="status err">Chưa có token – chỉ xem được, không lưu được.</div>'; $('#repoInfo').textContent = 'Chưa kết nối GitHub'; return; }
    try {
      const r = await GH.check();
      st.innerHTML = r.canPush ? `<div class="status ok">✓ Kết nối OK: ${esc(r.name)} – có quyền ghi.</div>` : `<div class="status err">Kết nối được ${esc(r.name)} nhưng token KHÔNG có quyền ghi (Contents: Read and write).</div>`;
      $('#repoInfo').textContent = `${r.name} · ${r.canPush ? 'sẵn sàng lưu' : 'chỉ đọc'}`;
    } catch (e) { st.innerHTML = `<div class="status err">${esc(e.message)}</div>`; $('#repoInfo').textContent = 'Token lỗi'; }
  }

  // ---------- Tải dữ liệu (qua API để không bị cache) ----------
  async function loadAll() {
    const headers = GH.token() ? undefined : {};
    const read = async (path, fb) => {
      if (GH.token()) return (await GH.readJSON(path, fb)).data;
      const r = await fetch(`${C.dataBase}${path}?v=${Date.now()}`); return r.ok ? r.json() : fb;
    };
    state.settings = await read('data/settings.json', {});
    state.categories = await read('data/categories.json', []);
    renderCats(); renderProdCatSelect(); renderPrice(); renderInfo();
  }

  // ---------- Danh mục ----------
  const arrowUp = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  const arrowDn = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
  const pen = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13 7l4 4"/></svg>';
  const trash = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
  function renderCats() {
    $('#catList').innerHTML = state.categories.map((c, i) => `
      <div class="item ${c.visible === false ? 'hidden-item' : ''}">
        <img src="${imgUrl(c.icon)}" alt="" />
        <div class="info"><b>${esc(c.name)}${c.badge ? `<span class="tag">${esc(c.badge)}</span>` : ''}${c.visible === false ? '<span class="tag">Ẩn</span>' : ''}</b><span>${esc(c.subtitle || '')} · id: ${esc(c.id)}</span></div>
        <div class="acts">
          <button class="icon-btn" data-up="${i}" ${i === 0 ? 'disabled' : ''}>${arrowUp}</button>
          <button class="icon-btn" data-down="${i}" ${i === state.categories.length - 1 ? 'disabled' : ''}>${arrowDn}</button>
          <button class="icon-btn" data-edit="${i}">${pen}</button>
          <button class="icon-btn danger" data-del="${i}">${trash}</button>
        </div>
      </div>`).join('') || '<p class="help">Chưa có danh mục nào.</p>';
    $$('[data-up]').forEach((b) => b.onclick = () => moveCat(+b.dataset.up, -1));
    $$('[data-down]').forEach((b) => b.onclick = () => moveCat(+b.dataset.down, 1));
    $$('[data-edit]').forEach((b) => b.onclick = () => openCat(+b.dataset.edit));
    $$('[data-del]').forEach((b) => b.onclick = () => delCat(+b.dataset.del));
  }
  const saveCats = (msg) => GH.writeJSON('data/categories.json', state.categories, msg);
  async function moveCat(i, d) {
    const j = i + d; if (j < 0 || j >= state.categories.length) return;
    [state.categories[i], state.categories[j]] = [state.categories[j], state.categories[i]];
    renderCats();
    await run('Đang đổi thứ tự…', () => saveCats('Đổi thứ tự danh mục'));
  }
  let editCatIdx = -1;
  function openCat(i) {
    editCatIdx = i; const c = i >= 0 ? state.categories[i] : {};
    $('#catModalTitle').textContent = i >= 0 ? 'Sửa danh mục' : 'Thêm danh mục';
    $('#cName').value = c.name || ''; $('#cSub').value = c.subtitle || ''; $('#cBadge').value = c.badge || ''; $('#cVisible').checked = c.visible !== false;
    $('#cBanner').value = ''; $('#cIcon').value = ''; $('#cBannerPrev').src = imgUrl(c.banner) || ''; $('#cIconPrev').src = imgUrl(c.icon) || ''; $('#catError').textContent = '';
    openModal('#catModal');
  }
  $('#addCat').addEventListener('click', () => openCat(-1));
  previewFile($('#cBanner'), $('#cBannerPrev')); previewFile($('#cIcon'), $('#cIconPrev'));
  $('#catForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isNew = editCatIdx < 0;
    const name = $('#cName').value.trim();
    const bannerFile = $('#cBanner').files[0], iconFile = $('#cIcon').files[0];
    if (isNew && (!bannerFile || !iconFile)) return ($('#catError').textContent = 'Danh mục mới cần đủ ảnh lớn và icon.');
    let id = isNew ? slugify(name) : state.categories[editCatIdx].id;
    if (isNew) { let base = id, n = 2; while (state.categories.some((c) => c.id === id)) id = `${base}-${n++}`; }
    const cat = isNew ? { id, name, subtitle: '', badge: '', banner: '', icon: '', visible: true } : { ...state.categories[editCatIdx] };
    cat.name = name; cat.subtitle = $('#cSub').value.trim(); cat.badge = $('#cBadge').value.trim(); cat.visible = $('#cVisible').checked;
    const ok = await run('Đang tải ảnh lên…', async () => {
      if (bannerFile) { const { blob, ext } = await compressImage(bannerFile, { maxW: 1600, maxH: 1200, quality: 0.85 }); cat.banner = `images/categories/${id}/banner.${ext}`; await GH.uploadBlob(cat.banner, blob, `Ảnh banner danh mục ${name}`); }
      if (iconFile) { const { blob, ext } = await compressImage(iconFile, { maxW: 256, maxH: 256, quality: 0.9, square: true }); cat.icon = `images/categories/${id}/icon.${ext}`; await GH.uploadBlob(cat.icon, blob, `Icon danh mục ${name}`); }
      if (isNew) { state.categories.push(cat); await GH.writeJSON(`data/products/${id}.json`, [], `Tạo danh mục ${name}`); }
      else state.categories[editCatIdx] = cat;
      await saveCats(`${isNew ? 'Thêm' : 'Sửa'} danh mục ${name}`);
    });
    if (ok) { closeModals(); renderCats(); renderProdCatSelect(); }
  });
  async function delCat(i) {
    const c = state.categories[i];
    if (!confirm(`Xóa danh mục “${c.name}” và toàn bộ sản phẩm trong đó?`)) return;
    const ok = await run('Đang xóa…', async () => {
      state.categories.splice(i, 1);
      await saveCats(`Xóa danh mục ${c.name}`);
      await GH.deleteFile(`data/products/${c.id}.json`, `Xóa sản phẩm danh mục ${c.name}`).catch(() => {});
    });
    if (ok) { delete state.products[c.id]; renderCats(); renderProdCatSelect(); }
  }

  // ---------- Sản phẩm ----------
  function renderProdCatSelect() {
    const sel = $('#prodCat');
    sel.innerHTML = state.categories.map((c) => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
    if (!state.categories.some((c) => c.id === state.curCat)) state.curCat = state.categories[0]?.id || null;
    if (state.curCat) sel.value = state.curCat;
    loadProds();
  }
  $('#prodCat').addEventListener('change', () => { state.curCat = $('#prodCat').value; loadProds(); });
  async function loadProds() {
    const id = state.curCat; const list = $('#prodList');
    if (!id) return (list.innerHTML = '<p class="help">Hãy tạo danh mục trước.</p>');
    if (!state.products[id]) {
      list.innerHTML = '<p class="help">Đang tải…</p>';
      try {
        if (GH.token()) state.products[id] = (await GH.readJSON(`data/products/${id}.json`, [])).data || [];
        else { const r = await fetch(`${C.dataBase}data/products/${id}.json?v=${Date.now()}`); state.products[id] = r.ok ? await r.json() : []; }
      } catch { state.products[id] = []; }
    }
    if (state.curCat !== id) return;
    const items = state.products[id];
    list.innerHTML = items.map((p, i) => `
      <div class="item ${p.visible === false ? 'hidden-item' : ''}">
        <img src="${imgUrl(p.image)}" alt="" />
        <div class="info"><b>${esc(p.name)}${p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}${p.visible === false ? '<span class="tag">Ẩn</span>' : ''}</b><span>${p.price ? fmtVND(p.price) : 'Liên hệ'}${p.gold ? ' · ' + esc(p.gold) : ''}${p.weight ? ' · ' + esc(p.weight) : ''}</span></div>
        <div class="acts">
          <button class="icon-btn" data-pup="${i}" ${i === 0 ? 'disabled' : ''}>${arrowUp}</button>
          <button class="icon-btn" data-pdown="${i}" ${i === items.length - 1 ? 'disabled' : ''}>${arrowDn}</button>
          <button class="icon-btn" data-pedit="${i}">${pen}</button>
          <button class="icon-btn danger" data-pdel="${i}">${trash}</button>
        </div>
      </div>`).join('') || '<p class="help">Danh mục này chưa có sản phẩm. Bấm “+ Thêm sản phẩm”.</p>';
    $$('[data-pup]').forEach((b) => b.onclick = () => moveProd(+b.dataset.pup, -1));
    $$('[data-pdown]').forEach((b) => b.onclick = () => moveProd(+b.dataset.pdown, 1));
    $$('[data-pedit]').forEach((b) => b.onclick = () => openProd(+b.dataset.pedit));
    $$('[data-pdel]').forEach((b) => b.onclick = () => delProd(+b.dataset.pdel));
  }
  const saveProds = (id, msg) => GH.writeJSON(`data/products/${id}.json`, state.products[id], msg);
  async function moveProd(i, d) {
    const arr = state.products[state.curCat]; const j = i + d; if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]]; loadProds();
    await run('Đang đổi thứ tự…', () => saveProds(state.curCat, 'Đổi thứ tự sản phẩm'));
  }
  let editProdIdx = -1;
  function openProd(i) {
    editProdIdx = i; const p = i >= 0 ? state.products[state.curCat][i] : {};
    $('#prodModalTitle').textContent = i >= 0 ? 'Sửa sản phẩm' : 'Thêm sản phẩm';
    $('#pName').value = p.name || ''; $('#pPrice').value = p.price ?? ''; $('#pBadge').value = p.badge || ''; $('#pGold').value = p.gold || ''; $('#pWeight').value = p.weight || '';
    $('#pDesc').value = p.desc || ''; $('#pVisible').checked = p.visible !== false; $('#pImage').value = ''; $('#pImagePrev').src = imgUrl(p.image) || ''; $('#prodError').textContent = '';
    openModal('#prodModal');
  }
  $('#addProd').addEventListener('click', () => { if (!state.curCat) return toast('Hãy tạo danh mục trước.'); openProd(-1); });
  previewFile($('#pImage'), $('#pImagePrev'));
  $('#prodForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const catId = state.curCat; const arr = state.products[catId]; const isNew = editProdIdx < 0;
    const file = $('#pImage').files[0];
    if (isNew && !file) return ($('#prodError').textContent = 'Sản phẩm mới cần có ảnh.');
    const p = isNew ? { id: `${catId}-${Date.now().toString(36)}`, image: '' } : { ...arr[editProdIdx] };
    p.name = $('#pName').value.trim(); const pr = $('#pPrice').value.trim(); p.price = pr ? Number(pr) : null;
    p.badge = $('#pBadge').value.trim(); p.gold = $('#pGold').value.trim(); p.weight = $('#pWeight').value.trim(); p.desc = $('#pDesc').value.trim(); p.visible = $('#pVisible').checked;
    const ok = await run('Đang tải ảnh lên…', async () => {
      if (file) { const { blob, ext } = await compressImage(file, { maxW: 1000, maxH: 1000, quality: 0.85, square: true }); p.image = `images/products/${catId}/${p.id}.${ext}`; await GH.uploadBlob(p.image, blob, `Ảnh sản phẩm ${p.name}`); }
      if (isNew) arr.push(p); else arr[editProdIdx] = p;
      await saveProds(catId, `${isNew ? 'Thêm' : 'Sửa'} sản phẩm ${p.name}`);
    });
    if (ok) { closeModals(); loadProds(); }
  });
  async function delProd(i) {
    const arr = state.products[state.curCat]; const p = arr[i];
    if (!confirm(`Xóa sản phẩm “${p.name}”?`)) return;
    const ok = await run('Đang xóa…', async () => {
      arr.splice(i, 1);
      await saveProds(state.curCat, `Xóa sản phẩm ${p.name}`);
      if (p.image && p.image.startsWith('images/products/') && !p.image.includes('placeholder')) await GH.deleteFile(p.image, `Xóa ảnh ${p.name}`).catch(() => {});
    });
    if (ok) loadProds();
  }

  // ---------- Giá Vàng Nhật Anh ----------
  function renderPrice() {
    const o = state.settings.ownPrice || {};
    $('#ownBuy').value = o.buy ?? ''; $('#ownSell').value = o.sell ?? ''; $('#ownPrevBuy').value = o.prevBuy ?? ''; $('#ownPrevSell').value = o.prevSell ?? ''; $('#ownName').value = o.name || 'Vàng Nhật Anh';
    $('#ownUpdated').textContent = o.updatedAt ? `Lần cập nhật cuối: ${new Date(o.updatedAt).toLocaleString('vi-VN')}` : '';
  }
  $('#savePrice').addEventListener('click', async () => {
    const o = { ...(state.settings.ownPrice || {}) };
    const nb = Number($('#ownBuy').value), ns = Number($('#ownSell').value);
    if (!nb || !ns) return alert('Nhập đủ giá mua và giá bán.');
    // Sang ngày mới: giá đang có trở thành "hôm qua" (trừ khi người dùng đã tự sửa ô hôm qua)
    const lastDay = o.updatedAt ? vnDate(new Date(o.updatedAt)) : null;
    let pb = Number($('#ownPrevBuy').value) || null, ps = Number($('#ownPrevSell').value) || null;
    if (lastDay && lastDay !== vnDate() && pb === (o.prevBuy ?? null) && ps === (o.prevSell ?? null)) { pb = o.buy ?? pb; ps = o.sell ?? ps; }
    state.settings.ownPrice = { name: $('#ownName').value.trim() || 'Vàng Nhật Anh', buy: nb, sell: ns, prevBuy: pb, prevSell: ps, updatedAt: new Date().toISOString() };
    const ok = await run('Đang lưu giá…', () => GH.writeJSON('data/settings.json', state.settings, `Cập nhật giá Vàng Nhật Anh ${nb}/${ns}`));
    if (ok) renderPrice();
  });

  // ---------- Thông tin chung ----------
  const ICON_OPTS = ['shield', 'refresh', 'gem', 'heart', 'star'];
  function renderInfo() {
    const s = state.settings;
    $('#sCompany').value = s.company || ''; $('#sBrand').value = s.brand || ''; $('#sSlogans').value = (s.slogans || []).join('\n'); $('#sAddress').value = s.address || '';
    $('#sMap').value = s.mapUrl || ''; $('#sPhone').value = s.phone || ''; $('#sZalo').value = s.zalo || ''; $('#sHours').value = s.hours || '';
    renderCommitRows(s.commitments || []);
  }
  function renderCommitRows(list) {
    $('#commitRows').innerHTML = list.map((c, i) => `
      <div class="commit-row" data-i="${i}">
        <div class="field"><select class="ci">${ICON_OPTS.map((o) => `<option value="${o}" ${c.icon === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div><div class="field" style="margin-bottom:6px"><input class="ct" type="text" placeholder="Tiêu đề" value="${esc(c.title)}" /></div><div class="field" style="margin:0"><input class="cx" type="text" placeholder="Mô tả ngắn" value="${esc(c.text)}" /></div></div>
        <button type="button" class="icon-btn danger crm">${trash}</button>
      </div>`).join('');
    $$('.crm').forEach((b) => b.onclick = () => { const rows = readCommitRows(); rows.splice(+b.closest('.commit-row').dataset.i, 1); renderCommitRows(rows); });
  }
  const readCommitRows = () => $$('.commit-row').map((r) => ({ icon: $('.ci', r).value, title: $('.ct', r).value.trim(), text: $('.cx', r).value.trim() })).filter((c) => c.title);
  $('#addCommit').addEventListener('click', () => renderCommitRows([...readCommitRows(), { icon: 'star', title: '', text: '' }]));
  $('#saveInfo').addEventListener('click', async () => {
    const s = state.settings;
    s.company = $('#sCompany').value.trim(); s.brand = $('#sBrand').value.trim(); s.slogans = $('#sSlogans').value.split('\n').map((x) => x.trim()).filter(Boolean);
    s.address = $('#sAddress').value.trim(); s.mapUrl = $('#sMap').value.trim(); s.phone = $('#sPhone').value.replace(/\D/g, ''); s.zalo = $('#sZalo').value.replace(/\D/g, ''); s.hours = $('#sHours').value.trim();
    s.commitments = readCommitRows();
    await run('Đang lưu thông tin…', () => GH.writeJSON('data/settings.json', s, 'Cập nhật thông tin chung'));
  });

  // ---------- Vào trang ----------
  async function enter() {
    $('#gate').hidden = true; $('#app').hidden = false;
    $('#tokenInput').value = GH.token();
    await checkToken();
    const hash = location.hash.slice(1);
    showTab(hash && $('#panel-' + hash) ? hash : 'cats'); // luôn vào Danh mục (hoặc tab đang mở trước đó)
    if (!GH.token()) toast('Chưa có quyền lưu trên máy này. Xem tab “Kết nối GitHub” khi cần lưu.', 5000);
    try { await loadAll(); } catch (e) { alert('Không tải được dữ liệu: ' + e.message); }
  }
  if (sessionStorage.getItem('vna_admin') === '1') enter();
})();
