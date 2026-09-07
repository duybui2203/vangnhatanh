/* Vàng Nhật Anh – logic trang chủ */
(function () {
  const C = window.VNA_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(n) + ' ₫';
  const fmtK = (n) => (n == null ? '—' : new Intl.NumberFormat('vi-VN').format(n));
  const fmtPhone = (p) => String(p || '').replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
  const imgUrl = (p) => (!p ? '' : /^https?:/i.test(p) ? p : C.dataBase + p);
  const bucket = () => Math.floor(Date.now() / 300000); // đổi mỗi 5 phút để vượt cache CDN

  // live = đọc theo nhánh (dùng cho bảng giá, luôn kèm tham số chống cache); mặc định đọc theo commit đã ghim
  async function loadJSON(path, { bust = bucket(), optional = false, live = false } = {}) {
    const url = (live ? C.liveBase || C.dataBase : C.dataBase) + path + (bust != null ? `?v=${bust}` : '');
    const r = await fetch(url, { cache: 'no-cache' });
    if (!r.ok) { if (optional) return null; throw new Error(`${path}: HTTP ${r.status}`); }
    return r.json();
  }

  // Ghim dữ liệu + ảnh vào commit mới nhất của repo dữ liệu -> vừa lưu trong admin là F5 thấy ngay,
  // không dính cache 5 phút của raw.githubusercontent.com. Lỗi thì dùng URL nhánh như cũ.
  async function pinLatestCommit() {
    if (sessionStorage.getItem('vna_data_base')) return; // đang chạy thử local
    try {
      const r = await fetch(`https://api.github.com/repos/${C.owner}/${C.dataRepo}/commits/${C.branch}`, { headers: { Accept: 'application/vnd.github.sha' }, cache: 'no-store' });
      if (!r.ok) return;
      const sha = (await r.text()).trim();
      if (/^[0-9a-f]{40}$/.test(sha)) { C.liveBase = C.dataBase; C.dataBase = `https://raw.githubusercontent.com/${C.owner}/${C.dataRepo}/${sha}/`; }
    } catch {}
  }

  const ICONS = {
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    zalo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-4.6A8 8 0 1 1 21 12z"/></svg>',
    flame: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2 .8-3.5 2-4.5.2 1.5 1 2.5 2 3 0-3 .5-6.5 1-9.5z"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.9 6.6 7.1.7-5.4 4.8 1.6 7L12 17.5 5.8 21l1.6-7L2 9.3l7.1-.7z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/></svg>',
    gem: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 5-7 13L5 8z"/><path d="M5 8h14M9 8l3 13 3-13M9 8l3-5 3 5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-4.6-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.4-9 9-9 9z"/></svg>',
  };

  const state = { settings: null, categories: [], products: {}, active: null, swiper: null };

  // ---------- Header / footer ----------
  function renderSettings(s) {
    document.title = `${s.brand || 'Vàng Nhật Anh'} – ${s.slogans?.[0] || 'Trang sức vàng cao cấp'}`;
    // "CÔNG TY TNHH VÀNG NHẬT ANH" -> dòng nhỏ "CÔNG TY TNHH" + tên thương hiệu lớn
    const m = /^(công ty (tnhh|cổ phần|cp)|doanh nghiệp tư nhân|dntn|tiệm vàng|cửa hàng)\s+(.+)$/i.exec((s.company || '').trim());
    const nameHTML = m ? `<small>${esc(m[1].toUpperCase())}</small>${esc(m[3].toUpperCase())}` : esc(s.company);
    $('#brandName').innerHTML = nameHTML;
    $('#footerName').innerHTML = nameHTML;
    $('#brandAddr span').textContent = s.address;
    const addr = $('#footerAddr'); addr.textContent = s.address; addr.href = s.mapUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address)}`;
    const tel = `tel:${s.phone}`, zl = `https://zalo.me/${s.zalo || s.phone}`;
    ['#footerCall', '#footerPhone', '#fabCall'].forEach((id) => ($(id).href = tel));
    ['#footerZalo', '#footerZaloTxt', '#fabZalo'].forEach((id) => ($(id).href = zl));
    $('#footerPhone').textContent = fmtPhone(s.phone);
    $('#footerZaloTxt').textContent = `Zalo: ${fmtPhone(s.zalo || s.phone)}`;
    $('#footerHours').textContent = s.hours || '';
    $('#copyright').textContent = `© ${new Date().getFullYear()} ${s.company}. Giá tham khảo, có thể thay đổi theo thị trường.`;
    $('#footerSlogans').innerHTML = (s.slogans || []).map((x) => `<li>${esc(x)}</li>`).join('');
    // slogan xoay vòng ở header
    const box = $('#brandSlogan');
    box.innerHTML = (s.slogans || []).map((x, i) => `<span class="${i === 0 ? 'on' : ''}">${esc(x)}</span>`).join('');
    const spans = box.querySelectorAll('span');
    if (spans.length > 1) { let i = 0; setInterval(() => { spans[i].classList.remove('on'); i = (i + 1) % spans.length; spans[i].classList.add('on'); }, 3500); }
    // cam kết
    const cm = $('#commits');
    if (s.commitments?.length) cm.innerHTML = s.commitments.map((c) => `<div class="commit"><div class="ic">${ICONS[c.icon] || ICONS.star}</div><div><b>${esc(c.title)}</b><p>${esc(c.text)}</p></div></div>`).join('');
    else $('#commitsSection').hidden = true;
  }

  // ---------- Slider + chips ----------
  function renderCategories(cats) {
    const visible = cats.filter((c) => c.visible !== false);
    $('#heroSlides').innerHTML = visible.map((c) => `
      <div class="swiper-slide">
        <div class="slide" data-cat="${esc(c.id)}">
          <img src="${imgUrl(c.banner)}" alt="${esc(c.name)}" loading="lazy" />
          ${c.badge ? `<div class="hot-badge">${ICONS.flame}${esc(c.badge)}</div>` : ''}
          <div class="slide-caption">
            <div class="slide-sub">${esc(c.subtitle || 'Bộ sưu tập')}</div>
            <div class="slide-title">${esc(c.name)}</div>
            <span class="slide-cta">Xem sản phẩm ${ICONS.arrow}</span>
          </div>
        </div>
      </div>`).join('');
    $('#catChips').innerHTML = visible.map((c) => `
      <button class="cat-chip" data-cat="${esc(c.id)}"><span class="ic"><img src="${imgUrl(c.icon)}" alt="" /></span><span class="nm">${esc(c.name)}</span></button>`).join('');
    $('#footerCats').innerHTML = visible.map((c) => `<li><a href="#products" data-cat="${esc(c.id)}">${ICONS.gem}${esc(c.name)}</a></li>`).join('');

    if (state.swiper) state.swiper.destroy(true, true);
    state.swiper = new Swiper('#heroSwiper', {
      loop: visible.length > 1, speed: 700, autoplay: { delay: C.slideDelayMs, disableOnInteraction: false, pauseOnMouseEnter: true },
      pagination: { el: '.swiper-pagination', clickable: true }, grabCursor: true,
    });
    document.querySelectorAll('[data-cat]').forEach((el) => el.addEventListener('click', (e) => {
      e.preventDefault();
      selectCategory(el.dataset.cat, true);
    }));
    if (visible.length) selectCategory((visible.find((c) => /bán chạy|ban chay|hot/i.test(c.badge || '')) || visible.find((c) => c.badge) || visible[0]).id, false);
  }

  async function selectCategory(id, scroll) {
    const cat = state.categories.find((c) => c.id === id); if (!cat) return;
    state.active = id;
    document.querySelectorAll('.cat-chip').forEach((b) => b.classList.toggle('active', b.dataset.cat === id));
    const chip = document.querySelector(`.cat-chip[data-cat="${id}"]`), rail = $('#catChips');
    if (chip && rail) rail.scrollTo({ left: chip.offsetLeft - rail.clientWidth / 2 + chip.offsetWidth / 2, behavior: scroll ? 'smooth' : 'auto' });
    $('#productsTitle').textContent = cat.name;
    $('#productsNote').textContent = cat.subtitle || '';
    if (scroll) $('#products').scrollIntoView({ behavior: 'smooth', block: 'start' });
    const grid = $('#productGrid');
    if (!state.products[id]) {
      grid.innerHTML = '<div class="card skeleton" style="aspect-ratio:1/1.4"></div><div class="card skeleton" style="aspect-ratio:1/1.4"></div>';
      try { state.products[id] = (await loadJSON(`data/products/${id}.json`, { optional: true })) || []; } catch { state.products[id] = []; }
    }
    if (state.active !== id) return;
    renderProducts(cat, state.products[id]);
  }

  function renderProducts(cat, list) {
    const s = state.settings; const tel = `tel:${s.phone}`, zl = `https://zalo.me/${s.zalo || s.phone}`;
    const items = (list || []).filter((p) => p.visible !== false);
    $('#productGrid').innerHTML = items.length ? items.map((p) => `
      <article class="card">
        <div class="card-img"><img src="${imgUrl(p.image) || imgUrl(cat.banner)}" alt="${esc(p.name)}" loading="lazy" />${p.badge ? `<span class="card-badge">${esc(p.badge)}</span>` : ''}</div>
        <div class="card-body">
          <div class="card-name">${esc(p.name)}</div>
          <div class="card-meta">${esc([p.gold, p.weight].filter(Boolean).join(' · '))}</div>
          <div class="card-price ${p.price ? '' : 'contact'}">${p.price ? fmtVND(p.price) : 'Liên hệ'}</div>
        </div>
        <div class="card-actions">
          <a class="btn-ic call" href="${tel}">${ICONS.phone}Gọi</a>
          <a class="btn-ic zalo" href="${zl}" target="_blank" rel="noopener">${ICONS.zalo}Zalo</a>
        </div>
      </article>`).join('') : `<div class="empty">Danh mục <b>${esc(cat.name)}</b> đang được cập nhật. Vui lòng liên hệ ${fmtPhone(s.phone)} để được tư vấn.</div>`;
  }

  // ---------- Bảng giá vàng ----------
  const fmtTime = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
  const dmy = (ymd) => (ymd ? ymd.split('-').reverse().join('/') : '');
  function shiftDate(ymd, d) { const [y, m, dd] = ymd.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, dd + d)); return t.toISOString().slice(0, 10); }
  function delta(today, yest) {
    if (today == null || yest == null) return '';
    const d = today - yest; if (d === 0) return `<span class="delta flat">▬</span>`;
    return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'}${fmtK(Math.abs(d))}</span>`;
  }
  async function renderPrices() {
    const s = state.settings;
    let latest = null, yest = null;
    try { latest = await loadJSON('data/prices/latest.json', { bust: Date.now(), live: true }); } catch { latest = null; }
    if (latest?.date) {
      for (let i = 1; i <= 4 && !yest; i++) { try { yest = await loadJSON(`data/prices/history/${shiftDate(latest.date, -i)}.json`, { optional: true, live: true }); } catch { yest = null; } }
    }
    const ymap = Object.fromEntries((yest?.rows || []).map((r) => [r.id, r]));
    const own = s.ownPrice || {};
    const rows = [];
    rows.push(`<tr class="own"><td><span class="name">${esc(own.name || 'Vàng Nhật Anh')}</span><span class="src">Giá tại cửa hàng</span></td>
      <td>${fmtK(own.buy)}${delta(own.buy, own.prevBuy)}</td><td>${fmtK(own.sell)}${delta(own.sell, own.prevSell)}</td>
      <td class="y">${fmtK(own.prevBuy)}</td><td class="y">${fmtK(own.prevSell)}</td></tr>`);
    for (const r of latest?.rows || []) {
      const y = ymap[r.id] || (r.prevBuy || r.prevSell ? { buy: r.prevBuy, sell: r.prevSell } : null);
      rows.push(`<tr class="${r.stale ? 'stale' : ''}"><td><span class="name">${esc(r.name)}</span>${r.stale && r.time ? `<span class="src">Cập nhật ${fmtTime(r.time)}</span>` : ''}</td>
        <td>${fmtK(r.buy)}${delta(r.buy, y?.buy)}</td><td>${fmtK(r.sell)}${delta(r.sell, y?.sell)}</td>
        <td class="y">${fmtK(y?.buy)}</td><td class="y">${fmtK(y?.sell)}</td></tr>`);
    }
    $('#priceBody').innerHTML = rows.join('');
    $('#priceUpdated').textContent = latest ? `Cập nhật lúc ${fmtTime(latest.updatedAt)}` : 'Chưa có dữ liệu giá thị trường';
    $('#priceDate').textContent = latest?.date ? `Hôm nay ${dmy(latest.date)}` : '';
    $('#thToday').textContent = latest?.date ? `Hôm nay (${dmy(latest.date)})` : 'Hôm nay';
    const yd = yest?.date || latest?.prevDate;
    $('#thYesterday').textContent = yd ? `Hôm qua (${dmy(yd)})` : 'Hôm qua';
  }

  // ---------- Đăng nhập (xem auth.js) ----------
  function setupLogin() {
    const modal = $('#loginModal');
    $('#loginBtn').addEventListener('click', () => { if (sessionStorage.getItem('vna_admin') === '1') return (location.href = 'admin/'); modal.classList.add('open'); setTimeout(() => $('#loginUser').focus(), 50); });
    $('#loginClose').addEventListener('click', () => modal.classList.remove('open'));
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });
    $('#loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Đang đăng nhập…';
      const ok = await VNA_AUTH.login($('#loginUser').value, $('#loginPass').value);
      btn.disabled = false; btn.textContent = 'Đăng nhập';
      if (!ok) { $('#loginError').textContent = 'Sai tài khoản hoặc mật khẩu.'; return; }
      location.href = 'admin/';
    });
  }

  // ---------- Khởi động ----------
  async function init() {
    setupLogin();
    try {
      await pinLatestCommit();
      const [settings, categories] = await Promise.all([loadJSON('data/settings.json'), loadJSON('data/categories.json')]);
      state.settings = settings; state.categories = categories;
      renderSettings(settings);
      renderCategories(categories);
      renderPrices();
      setInterval(renderPrices, C.pricesRefreshMs);
    } catch (err) {
      console.error(err);
      $('#productGrid').innerHTML = `<div class="empty">Không tải được dữ liệu (${esc(err.message)}).<br/>Kiểm tra repo <b>${esc(C.owner)}/${esc(C.dataRepo)}</b> đã công khai và có thư mục <b>data/</b>.</div>`;
      $('#priceUpdated').textContent = 'Không tải được dữ liệu';
    }
  }
  document.addEventListener('DOMContentLoaded', init);
})();
