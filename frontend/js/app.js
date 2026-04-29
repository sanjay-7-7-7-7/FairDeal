/**
 * FairDeal v2.0 — Main Application JS
 * E-Commerce UI with AI Fake Discount Detection
 */

/* ── App State ────────────────────────────────────────────────── */
const state = {
  products: [], total: 0, page: 1, perPage: 20,
  category: '', sort: 'value_score', trustFilter: '',
  ratingFilter: 0, search: '',
  compareList: [],
  stats: null, metadata: null,
  charts: {}
};

/* ── Format Helpers ───────────────────────────────────────────── */
const fmt = {
  price: n => '₹' + Number(n).toLocaleString('en-IN'),
  pct:   n => n.toFixed(1) + '%',
  stars: r => {
    const full = Math.floor(r), half = r % 1 >= 0.5 ? 1 : 0, empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
  },
  num: n => n >= 1000 ? (n/1000).toFixed(1) + 'k' : n,
  score: s => Math.round(s * 100)
};

/* ── Image Helper ────────────────────────────────────────────── */
function productImageUrl(p) {
  if (p.image_url) return p.image_url;
  
  const name = (p.product_name || '').toLowerCase();
  const cat = (p.category || '').toLowerCase();
  let search = 'product';

  const mapping = [
    { keywords: ['bat', 'cricket'], term: 'cricket bat' },
    { keywords: ['shoe', 'sneaker', 'footwear', 'nike', 'adidas', 'puma', 'campus', 'bata'], term: 'shoes' },
    { keywords: ['laptop', 'macbook', 'hp', 'dell', 'lenovo', 'asus', 'victus', 'xps', 'keyboard'], term: 'laptop' },
    { keywords: ['phone', 'iphone', 'galaxy', 'smartphone', 'oneplus', 'samsung', 'xiaomi', 'oppo', 'vivo', 'realme', 'nothing'], term: 'smartphone' },
    { keywords: ['earbuds', 'headphone', 'airpods', 'tws', 'boat', 'sony', 'buds', 'speaker'], term: 'headphones' },
    { keywords: ['watch', 'smartwatch'], term: 'smartwatch' },
    { keywords: ['book', 'mathematics', 'potter', 'hardcover', 'paperback', 'engineering', 'science'], term: 'book' },
    { keywords: ['washing machine', 'machine', 'bosch', 'laundry'], term: 'washing machine' },
    { keywords: ['fridge', 'refrigerator'], term: 'refrigerator' },
    { keywords: ['ac', 'air conditioner'], term: 'air conditioner' },
    { keywords: ['tv', 'television', 'led', 'smart tv'], term: 'smart television' },
    { keywords: ['kurta', 'shirt', 'dress', 'clothing', 'fashion', 'jeans', 'zara', 'h&m', 'top', 'overshirt', 't-shirt'], term: 'fashion clothing' },
    { keywords: ['moisturizer', 'cream', 'foundation', 'skincare', 'nivea', 'lakme', 'maybelline', 'beauty', 'serum', 'lipstick', 'face'], term: 'skincare beauty' },
    { keywords: ['coffee', 'bru', 'nescafe'], term: 'coffee' },
    { keywords: ['rice', 'basmati', 'india gate'], term: 'rice' },
    { keywords: ['noodles', 'maggi'], term: 'noodles' },
    { keywords: ['heater', 'havells'], term: 'room heater' },
    { keywords: ['fan'], term: 'ceiling fan' },
    { keywords: ['bulb', 'led bulb'], term: 'light bulb' },
  ];

  for (const item of mapping) {
    if (item.keywords.some(k => name.includes(k) || cat.includes(k))) {
      search = item.term;
      break;
    }
  }

  const base = 'https://loremflickr.com/400/400/';
  const sigSource = p.product_id ? p.product_id.replace(/\D/g, '') : Math.floor(Math.random() * 1000);
  const lock = parseInt(sigSource) || 1;
  return `${base}${encodeURIComponent(search)}?lock=${lock}`;
}

/* ── Toast ────────────────────────────────────────────────────── */
function toast(msg, type = 'info', dur = 3500) {
  const c = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const ic = {success:'✓', error:'✕', info:'ℹ'};
  el.innerHTML = `<span style="font-size:16px">${ic[type]||'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transform = 'translateX(100%)'; setTimeout(() => el.remove(), 300); }, dur);
}

/* ── API Helper ───────────────────────────────────────────────── */
async function api(endpoint, method = 'GET', body = null) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/* ── Navigation ───────────────────────────────────────────────── */
function navigate(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const page = document.getElementById(`page-${pageId}`);
  if (page) page.classList.add('active');
  const nav = document.querySelector(`[data-page="${pageId}"]`);
  if (nav) nav.classList.add('active');
  const titles = { dashboard:'Dashboard', products:'Browse Products', recommend:'Top Picks',
    compare:'Compare Products', predict:'Quick Check', analyze:'Deep Analysis', model:'Model Insights' };
  document.getElementById('topbarTitle').textContent = titles[pageId] || 'FairDeal';
  document.getElementById('sidebar').classList.remove('open');

  if (pageId === 'dashboard' && !state.stats) loadDashboard();
  if (pageId === 'products') loadProducts();
  if (pageId === 'recommend') loadRecommendations('');
  if (pageId === 'compare') renderCompare();
  if (pageId === 'model' && !state.metadata) loadModelInsights();
}

/* ── API Health ───────────────────────────────────────────────── */
async function checkApiHealth() {
  const dot = document.getElementById('statusDot');
  const txt = document.getElementById('statusText');
  try {
    const d = await api('/health');
    dot.className = 'status-dot online';
    txt.textContent = `Online · ${d.products} products`;
  } catch {
    dot.className = 'status-dot offline';
    txt.textContent = 'API Offline';
  }
}

/* ── DASHBOARD ────────────────────────────────────────────────── */
async function loadDashboard() {
  try {
    const data = await api('/stats');
    state.stats = data;
    document.getElementById('s-total').textContent = data.total_products;
    document.getElementById('s-genuine').textContent = data.genuine_discounts;
    document.getElementById('s-fake').textContent = data.fake_discounts;
    document.getElementById('s-worth').textContent = data.worth_buying;
    renderCategoryChart(data.by_category);
    renderModelChart(data.model_metrics);
  } catch(e) { toast('Dashboard load failed: ' + e.message, 'error'); }
}

function renderCategoryChart(byCat) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (state.charts.cat) state.charts.cat.destroy();
  const cats = Object.keys(byCat);
  const genuine = cats.map(c => byCat[c].genuine || 0);
  const fake = cats.map(c => byCat[c].fake || 0);
  state.charts.cat = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: cats.map(c => c.replace(' Appliances','')),
      datasets: [
        { label: 'Genuine', data: genuine, backgroundColor: 'rgba(0,214,143,0.7)', borderRadius: 4 },
        { label: 'Fake', data: fake, backgroundColor: 'rgba(255,71,87,0.7)', borderRadius: 4 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { color: '#9a9ab0', font: { family: 'DM Sans' } } } },
      scales: {
        x: { stacked: true, ticks: { color: '#5a5a75', font: { size: 11 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        y: { stacked: true, ticks: { color: '#5a5a75' }, grid: { color: 'rgba(255,255,255,0.05)' } }
      }
    }
  });
}

function renderModelChart(metrics) {
  const ctx = document.getElementById('modelChart').getContext('2d');
  if (state.charts.model) state.charts.model.destroy();
  const labels = ['Accuracy', 'ROC-AUC', 'Precision', 'Recall', 'F1 Score'];
  const values = [
    (metrics.accuracy || 0.878) * 100,
    (metrics.roc_auc || 0.908) * 100,
    (metrics.precision || 0.90) * 100,
    (metrics.recall || 0.67) * 100,
    (metrics.f1 || 0.77) * 100
  ];
  state.charts.model = new Chart(ctx, {
    type: 'radar',
    data: {
      labels,
      datasets: [{
        label: 'Model Score',
        data: values,
        backgroundColor: 'rgba(108,99,255,0.2)',
        borderColor: '#6c63ff',
        pointBackgroundColor: '#6c63ff',
        pointRadius: 4
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        r: {
          min: 0, max: 100,
          ticks: { color: '#5a5a75', stepSize: 25, backdropColor: 'transparent' },
          grid: { color: 'rgba(255,255,255,0.07)' },
          pointLabels: { color: '#9a9ab0', font: { size: 12 } }
        }
      }
    }
  });
}

/* ── PRODUCTS ─────────────────────────────────────────────────── */
async function loadProducts(reset = false) {
  if (reset) { state.page = 1; state.products = []; }
  const grid = document.getElementById('productsGrid');
  grid.innerHTML = Array(8).fill(0).map(() => `
    <div class="product-card">
      <div style="padding-top:75%;background:var(--surface2)" class="skeleton"></div>
      <div class="product-info">
        <div class="skeleton" style="height:12px;width:60%;margin-bottom:8px"></div>
        <div class="skeleton" style="height:14px;width:90%;margin-bottom:4px"></div>
        <div class="skeleton" style="height:14px;width:70%;margin-bottom:12px"></div>
        <div class="skeleton" style="height:20px;width:50%"></div>
      </div>
    </div>`).join('');

  try {
    const params = new URLSearchParams({
      page: state.page, per_page: state.perPage,
      sort_by: state.sort,
    });
    if (state.category) params.set('category', state.category);
    if (state.search) params.set('search', state.search);
    if (state.ratingFilter) params.set('min_rating', state.ratingFilter);
    if (state.trustFilter === 'genuine') params.set('genuine_only', 'true');
    if (state.trustFilter === 'fake') params.set('fake_only', 'true');
    if (state.trustFilter === 'flash') params.set('flash_only', 'true');

    const data = await api('/products?' + params);
    state.products = data.products;
    state.total = data.total;

    document.getElementById('totalProductsLabel').textContent = data.total;
    document.getElementById('productsCount').textContent = `Showing ${data.products.length} of ${data.total} products`;

    renderProducts(data.products);
    renderPagination(data.page, data.total_pages);
  } catch (e) {
    console.error('API Error:', e);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)">
      <div style="font-size:40px">⚠️</div>
      <div style="margin-top:12px">Could not load products — PHP API unavailable.<br>
      <code style="font-size:12px;color:var(--accent2)">check api/api.php and products.json</code></div></div>`;
    toast('Cannot connect to API: ' + (e.message || e), 'error');
  }
}

function renderProducts(products) {
  const grid = document.getElementById('productsGrid');
  if (!products.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px;color:var(--text2)">
      <div style="font-size:48px">🔍</div><div style="margin-top:12px">No products found. Try changing filters.</div></div>`;
    return;
  }
  grid.innerHTML = products.map(p => buildProductCard(p)).join('');
}

function buildProductCard(p) {
  const isFake = p.predicted_fake === 1;
  const savingsPct = p.discount_percentage ? p.discount_percentage.toFixed(0) : 0;
  const trustClass = isFake ? 'trust-fake' : 'trust-genuine';
  const trustIcon = isFake ? '⚠' : '✓';
  const inCompare = state.compareList.find(c => c.product_id === p.product_id);

  const badges = (p.badges || []).slice(0, 2).map(b =>
    `<span class="badge" style="background:${b.color}">${b.label}</span>`).join('');

  const stars = fmt.stars(p.rating || 4);
  return `
  <div class="product-card" onclick="openProduct('${p.product_id}')">
    <div class="product-img-wrap">
      <img class="product-img" src="${productImageUrl(p)}"
           onerror="this.src='https://loremflickr.com/400/400/product?lock=${p.product_id ? p.product_id.replace(/\D/g, '') : 1}'"
           alt="${escHtml(p.product_name)}" loading="lazy">
      <div class="product-badges">${badges}</div>
      <div class="trust-indicator ${trustClass}">${trustIcon}</div>
      ${p.discount_percentage > 0 ? `<div style="position:absolute;bottom:8px;left:8px;background:rgba(0,0,0,0.75);color:#fff;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px">-${savingsPct}%</div>` : ''}
    </div>
    <div class="product-info">
      <div class="product-brand">${escHtml(p.brand || '')}</div>
      <div class="product-name">${escHtml(p.product_name)}</div>
      <div class="price-block">
        <div class="price-row">
          <span class="price-current">${fmt.price(p.discounted_price)}</span>
          ${p.original_price > p.discounted_price ? `<span class="price-original">${fmt.price(p.original_price)}</span>` : ''}
          ${p.discount_percentage > 0 ? `<span class="price-discount">${savingsPct}% off</span>` : ''}
        </div>
        <div class="rating-row">
          <span class="stars">${stars}</span>
          <span style="font-size:13px;font-weight:600">${p.rating}</span>
          <span class="rating-count">(${fmt.num(p.num_reviews)})</span>
        </div>
      </div>
    </div>
    <div class="product-footer">
      <button class="btn ${isFake ? 'btn-outline' : 'btn-green'} btn-sm" style="flex:1;font-size:12px" onclick="event.stopPropagation();openProduct('${p.product_id}')">
        ${isFake ? '⚠️ View Details' : '🛒 View Deal'}
      </button>
      <button class="btn btn-ghost btn-sm btn-icon" title="Add to Compare"
        onclick="event.stopPropagation();toggleCompare('${p.product_id}')"
        id="cmp-${p.product_id}" style="${inCompare ? 'background:var(--accent-glow);color:var(--accent2)' : ''}">⚖</button>
    </div>
  </div>`;
}

function renderPagination(current, total) {
  if (total <= 1) { document.getElementById('pagination').innerHTML = ''; return; }
  let html = '';
  html += `<button class="page-btn" onclick="goPage(${current-1})" ${current<=1?'disabled':''}>‹</button>`;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 2) {
      html += `<button class="page-btn ${i===current?'active':''}" onclick="goPage(${i})">${i}</button>`;
    } else if (Math.abs(i - current) === 3) {
      html += `<span style="padding:0 4px;color:var(--text3)">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="goPage(${current+1})" ${current>=total?'disabled':''}>›</button>`;
  document.getElementById('pagination').innerHTML = html;
}

function goPage(p) { state.page = p; loadProducts(); window.scrollTo(0, 0); }

function filterByCategory(cat) {
  state.category = cat; state.page = 1;
  document.querySelectorAll('.cat-chip').forEach(el => {
    const chip = el.getAttribute('onclick');
    el.classList.toggle('active', chip && chip.includes(`'${cat}'`));
  });
  loadProducts();
}

function applyFilters() {
  state.sort = document.getElementById('sortSelect').value;
  const tf = document.getElementById('trustFilter').value;
  state.trustFilter = tf;
  state.ratingFilter = parseFloat(document.getElementById('ratingFilter').value) || 0;
  loadProducts(true);
}

function clearFilters() {
  document.getElementById('sortSelect').value = 'value_score';
  document.getElementById('trustFilter').value = '';
  document.getElementById('ratingFilter').value = '0';
  document.getElementById('globalSearch').value = '';
  state.sort = 'value_score'; state.trustFilter = ''; state.ratingFilter = 0; state.search = '';
  filterByCategory('');
}

let searchTimer;
function handleGlobalSearch(val) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = val.trim();
    state.page = 1;
    if (document.getElementById('page-products').classList.contains('active') || val) {
      if (!document.getElementById('page-products').classList.contains('active')) navigate('products');
      loadProducts(true);
    }
  }, 350);
}

/* ── PRODUCT DETAIL MODAL ─────────────────────────────────────── */
async function openProduct(productId) {
  const overlay = document.getElementById('productModal');
  const content = document.getElementById('modalContent');
  overlay.classList.add('open');
  content.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text2)"><div class="loading-pulse" style="font-size:32px">🔍</div><div style="margin-top:12px">Loading...</div></div>`;

  try {
    const { product: p, similar_products, price_history } = await api(`/products/${productId}`);
    const isFake = p.predicted_fake === 1;
    const savingsPct = p.discount_percentage ? p.discount_percentage.toFixed(1) : '0.0';
    const savings = p.original_price - p.discounted_price;

    const simHtml = (similar_products || []).slice(0, 4).map(s => `
      <div onclick="openProduct('${s.product_id}')" style="cursor:pointer;background:var(--surface2);border-radius:8px;overflow:hidden;transition:opacity 0.2s" onmouseover="this.style.opacity=0.8" onmouseout="this.style.opacity=1">
        <img src="${s.image_url}" onerror="this.src='https://loremflickr.com/400/400/product?lock=${s.product_id ? s.product_id.replace(/\D/g, '') : 1}'" style="width:100%;height:90px;object-fit:cover" loading="lazy">
        <div style="padding:8px">
          <div style="font-size:11px;color:var(--text2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escHtml(s.product_name)}</div>
          <div style="font-size:13px;font-weight:700;margin-top:2px">${fmt.price(s.discounted_price)}</div>
        </div>
      </div>`).join('');

    content.innerHTML = `
      <div class="modal-grid">
        <div class="modal-img-col">
          <img class="modal-img" src="${productImageUrl(p)}"
            onerror="this.src='https://loremflickr.com/400/400/product?lock=${p.product_id ? p.product_id.replace(/\D/g, '') : 1}'"
            alt="${escHtml(p.product_name)}">
          ${p.badges && p.badges.length ? `<div style="padding:12px;display:flex;gap:6px;flex-wrap:wrap">
            ${p.badges.map(b => `<span class="badge" style="background:${b.color}">${b.label}</span>`).join('')}
          </div>` : ''}
        </div>
        <div class="modal-info-col" style="max-height:80vh;overflow-y:auto">
          <div class="modal-brand">${escHtml(p.brand || '')} · ${escHtml(p.category)}</div>
          <div class="modal-title">${escHtml(p.product_name)}</div>

          <div class="rating-row" style="margin-bottom:12px">
            <span class="stars">${fmt.stars(p.rating)}</span>
            <span style="font-weight:600">${p.rating}</span>
            <span class="rating-count">${fmt.num(p.num_reviews)} reviews</span>
            ${p.stock_left < 20 ? `<span style="color:var(--red);font-size:12px;font-weight:600">Only ${p.stock_left} left!</span>` : ''}
          </div>

          <!-- Price Block -->
          <div style="background:var(--surface2);border-radius:10px;padding:14px;margin-bottom:14px">
            <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap">
              <span class="modal-price-big">${fmt.price(p.discounted_price)}</span>
              ${p.original_price > p.discounted_price ? `<span class="modal-price-orig">${fmt.price(p.original_price)}</span>` : ''}
            </div>
            ${p.discount_percentage > 0 ? `<span class="modal-discount-badge">${savingsPct}% OFF — You save ${fmt.price(savings)}</span>` : ''}
            <div style="font-size:12px;color:var(--text2);margin-top:4px">Competitor price: <strong style="color:var(--text1)">${fmt.price(p.competitor_price)}</strong>
              ${p.cheaper_than_competitor ? ' <span style="color:var(--green)">✓ Cheaper than market</span>' : ' <span style="color:var(--red)">↑ Above market price</span>'}
            </div>
          </div>

          <!-- Trust Verdict -->
          <div class="trust-verdict ${isFake ? 'fake' : 'genuine'}">
            <span class="verdict-icon">${isFake ? '⚠️' : '✅'}</span>
            <div class="verdict-text">
              <div class="verdict-label" style="color:${isFake ? 'var(--red)' : 'var(--green)'}">${p.verdict}</div>
              <div class="verdict-sub">AI Confidence: ${(p.genuine_probability * 100).toFixed(1)}% · Risk: ${p.risk_level}</div>
            </div>
          </div>

          <!-- Score Bars -->
          <div class="score-bars">
            <div style="font-size:13px;font-weight:600;margin-bottom:10px">Trust Scores</div>
            ${[['Price Fairness', p.price_fairness_score], ['Quality Score', p.quality_score], ['Overall Value', p.value_score]].map(([label, score]) => `
            <div class="score-bar-item">
              <div class="score-bar-label"><span>${label}</span><span style="font-weight:600">${fmt.score(score || 0)}%</span></div>
              <div class="score-bar-track"><div class="score-bar-fill" style="width:${fmt.score(score || 0)}%;background:${(score||0) > 0.6 ? 'var(--green)' : (score||0) > 0.3 ? 'var(--gold)' : 'var(--red)'}"></div></div>
            </div>`).join('')}
          </div>

          <!-- Quick Info -->
          <div class="info-grid">
            <div class="info-item"><div class="i-label">Category</div><div class="i-value">${escHtml(p.category)}</div></div>
            <div class="info-item"><div class="i-label">Brand</div><div class="i-value">${escHtml(p.brand || 'N/A')}</div></div>
            <div class="info-item"><div class="i-label">Stock Left</div><div class="i-value" style="color:${p.stock_left < 20 ? 'var(--red)' : 'var(--green)'}">${p.stock_left}</div></div>
            <div class="info-item"><div class="i-label">Flash Sale</div><div class="i-value">${p.is_flash_sale ? '⚡ Yes' : 'No'}</div></div>
          </div>

          <!-- Actions -->
          <div style="display:flex;gap:8px;margin-top:14px">
            <button class="btn ${isFake ? 'btn-outline' : 'btn-green'} btn-full" onclick="toast('${isFake ? 'Caution: price may be inflated!' : 'Great deal! Added to cart concept.'}', '${isFake ? 'error' : 'success'}')">
              ${isFake ? '⚠️ Buy Cautiously' : '🛒 Buy Now'}
            </button>
            <button class="btn btn-ghost btn-icon" onclick="toggleCompare('${p.product_id}');toast('Added to comparison','info')" title="Compare">⚖</button>
          </div>

          <!-- Similar Products -->
          ${simHtml ? `
          <div style="margin-top:20px">
            <div style="font-size:13px;font-weight:600;margin-bottom:10px;color:var(--text2)">Similar Products</div>
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${simHtml}</div>
          </div>` : ''}
        </div>
      </div>`;
  } catch(e) {
    content.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text2)">Failed to load product details</div>`;
  }
}

function closeModal() {
  document.getElementById('productModal').classList.remove('open');
}

/* ── COMPARE ──────────────────────────────────────────────────── */
function toggleCompare(productId) {
  const idx = state.compareList.findIndex(p => p.product_id === productId);
  if (idx > -1) {
    state.compareList.splice(idx, 1);
    toast('Removed from comparison', 'info');
  } else {
    if (state.compareList.length >= 4) { toast('Max 4 products for comparison', 'error'); return; }
    const p = state.products.find(p => p.product_id === productId);
    if (p) { state.compareList.push(p); toast('Added to comparison', 'success'); }
  }
  updateCompareCount();
  const btn = document.getElementById(`cmp-${productId}`);
  if (btn) {
    const isIn = state.compareList.find(c => c.product_id === productId);
    btn.style.background = isIn ? 'var(--accent-glow)' : '';
    btn.style.color = isIn ? 'var(--accent2)' : '';
  }
}

function updateCompareCount() {
  const n = state.compareList.length;
  document.getElementById('compareCount').textContent = n;
  document.getElementById('cartLabel').textContent = `Compare (${n})`;
}

function renderCompare() {
  const grid = document.getElementById('compareGrid');
  const empty = document.getElementById('compareEmptyState');
  const actions = document.getElementById('compareActions');
  if (!state.compareList.length) {
    grid.style.display = 'none'; empty.style.display = 'block'; actions.style.display = 'none'; return;
  }
  empty.style.display = 'none'; grid.style.display = 'grid'; actions.style.display = 'flex';
  const best = state.compareList.reduce((a, b) => (a.value_score||0) > (b.value_score||0) ? a : b);
  grid.innerHTML = state.compareList.map(p => {
    const isBest = p.product_id === best.product_id;
    const isFake = p.predicted_fake === 1;
    return `
    <div class="compare-card ${isBest ? 'winner' : ''}">
      ${isBest ? '<div class="winner-tag">🏆 Best Value</div>' : ''}
      <img class="compare-img" src="${productImageUrl(p)}" onerror="this.src='https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&q=80'" alt="${escHtml(p.product_name)}" loading="lazy">
      <div class="compare-info">
        <div style="font-size:11px;color:var(--accent2);font-weight:600">${escHtml(p.brand||'')}</div>
        <div style="font-size:14px;font-weight:600;margin:4px 0 8px;line-height:1.3">${escHtml(p.product_name)}</div>
        <div style="font-size:20px;font-weight:700;margin-bottom:4px">${fmt.price(p.discounted_price)}</div>
        <div style="font-size:12px;color:var(--text2)">MRP ${fmt.price(p.original_price)} · ${p.discount_percentage.toFixed(0)}% off</div>
        <div style="margin:10px 0;display:flex;flex-direction:column;gap:6px">
          ${[['Value Score', p.value_score], ['Price Fairness', p.price_fairness_score], ['Quality', p.quality_score]].map(([l,v]) => `
          <div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px"><span style="color:var(--text2)">${l}</span><span style="font-weight:600">${fmt.score(v||0)}%</span></div>
            <div class="score-bar-track"><div class="score-bar-fill" style="width:${fmt.score(v||0)}%;background:${(v||0)>0.6?'var(--green)':(v||0)>0.3?'var(--gold)':'var(--red)'}"></div></div>
          </div>`).join('')}
        </div>
        <div style="padding:8px;border-radius:8px;background:${isFake?'var(--red-dim)':'var(--green-dim)'};font-size:12px;font-weight:600;color:${isFake?'var(--red)':'var(--green)'}">
          ${isFake ? '⚠️ Fake Discount' : '✅ Genuine Deal'}
        </div>
        <div style="display:flex;gap:6px;margin-top:10px">
          <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openProduct('${p.product_id}')">Details</button>
          <button class="btn btn-ghost btn-sm btn-icon" onclick="removeFromCompare('${p.product_id}')">✕</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function removeFromCompare(id) {
  state.compareList = state.compareList.filter(p => p.product_id !== id);
  updateCompareCount(); renderCompare();
}
function clearCompare() { state.compareList = []; updateCompareCount(); renderCompare(); }

/* ── RECOMMENDATIONS ──────────────────────────────────────────── */
async function loadRecommendations(category) {
  const grid = document.getElementById('recsGrid');
  grid.innerHTML = `<div class="text-dim text-sm loading-pulse" style="grid-column:1/-1">Loading top picks...</div>`;
  try {
    const data = await api('/recommend', 'POST', { category, top_n: 12 });
    if (!data.recommendations.length) {
      grid.innerHTML = '<div class="text-dim text-sm">No recommendations found.</div>'; return;
    }
    grid.innerHTML = data.recommendations.map(p => buildProductCard(p)).join('');
  } catch(e) { grid.innerHTML = '<div class="text-dim text-sm">API not available</div>'; }
}

/* ── PREDICT ──────────────────────────────────────────────────── */
async function runPredict() {
  const orig = parseFloat(document.getElementById('p-orig').value);
  const disc = parseFloat(document.getElementById('p-disc').value);
  const comp = parseFloat(document.getElementById('p-comp').value);
  if (!orig || !disc || !comp) { toast('Please fill in all required fields', 'error'); return; }

  const body = {
    original_price: orig, discounted_price: disc, competitor_price: comp,
    rating: parseFloat(document.getElementById('p-rat').value) || 4.0,
    num_reviews: parseInt(document.getElementById('p-rev').value) || 100,
    category: document.getElementById('p-cat').value,
    is_flash_sale: parseInt(document.getElementById('p-flash').value),
    price_1_month_ago: parseFloat(document.getElementById('p-p1m').value) || orig * 0.95,
    price_1_week_ago: parseFloat(document.getElementById('p-p1w').value) || orig * 0.97,
  };

  const btn = event.target;
  btn.textContent = '🔍 Analyzing...'; btn.disabled = true;
  try {
    const r = await api('/predict', 'POST', body);
    const isFake = r.is_fake_discount === 1;
    const resultEl = document.getElementById('predictResult');
    resultEl.className = 'result-card';
    resultEl.innerHTML = `
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px">
        <div style="font-size:48px">${isFake ? '⚠️' : '✅'}</div>
        <div>
          <div style="font-size:22px;font-weight:700;color:${isFake?'var(--red)':'var(--green)'}">${r.verdict}</div>
          <div style="color:var(--text2);font-size:14px">Confidence: <strong>${r.confidence}%</strong> · Risk Level: <strong style="color:${r.risk_level==='HIGH'?'var(--red)':r.risk_level==='MEDIUM'?'var(--gold)':'var(--green)'}">${r.risk_level}</strong></div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div class="info-item"><div class="i-label">Genuine Probability</div><div class="i-value text-green">${(r.genuine_probability*100).toFixed(1)}%</div></div>
        <div class="info-item"><div class="i-label">Fake Probability</div><div class="i-value text-red">${(r.fake_probability*100).toFixed(1)}%</div></div>
        <div class="info-item"><div class="i-label">You Save</div><div class="i-value">${fmt.price(orig - disc)}</div></div>
        <div class="info-item"><div class="i-label">vs Competitor</div><div class="i-value ${disc<comp?'text-green':'text-red'}">${disc<comp?'▼ Cheaper':'▲ Pricier'} by ${fmt.price(Math.abs(disc-comp))}</div></div>
      </div>
      <div style="margin-top:14px;padding:12px;background:${isFake?'var(--red-dim)':'var(--green-dim)'};border-radius:8px;font-size:14px">
        ${isFake ? '⚠️ <strong>Caution:</strong> This discount may be inflated. Compare with competitor prices before buying.' : '✅ <strong>Safe to buy</strong> — This appears to be a genuine discount based on price history and market data.'}
      </div>`;
  } catch(e) { toast('Prediction failed: ' + e.message, 'error'); }
  finally { btn.textContent = '🔍 Check Discount'; btn.disabled = false; }
}

function clearPredict() {
  ['p-orig','p-disc','p-comp','p-rat','p-rev','p-p1m','p-p1w'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('predictResult').className = 'hidden';
}

/* ── ANALYZE ──────────────────────────────────────────────────── */
async function runAnalyze() {
  const orig = parseFloat(document.getElementById('a-orig').value);
  const disc = parseFloat(document.getElementById('a-disc').value);
  const comp = parseFloat(document.getElementById('a-comp').value);
  if (!orig || !disc || !comp) { toast('Fill in price fields', 'error'); return; }

  const body = {
    product_name: document.getElementById('a-name').value,
    original_price: orig, discounted_price: disc, competitor_price: comp,
    price_1_month_ago: parseFloat(document.getElementById('a-p1m').value) || orig * 0.95,
    price_1_week_ago: parseFloat(document.getElementById('a-p1w').value) || orig * 0.97,
    rating: parseFloat(document.getElementById('a-rat').value) || 4.0,
    num_reviews: parseInt(document.getElementById('a-rev').value) || 100,
    stock_left: parseInt(document.getElementById('a-stock').value) || 50,
    category: document.getElementById('a-cat').value,
    brand: document.getElementById('a-brand').value,
    is_flash_sale: parseInt(document.getElementById('a-flash').value),
  };

  const btn = event.target;
  btn.textContent = '🧬 Analyzing...'; btn.disabled = true;
  try {
    const r = await api('/analyze', 'POST', body);
    const pred = r.prediction; const scores = r.scores; const pa = r.price_analysis;
    const isFake = pred.is_fake_discount === 1;
    const resultEl = document.getElementById('analyzeResult');
    resultEl.className = 'result-card';
    resultEl.innerHTML = `
      <div style="font-size:18px;font-weight:700;margin-bottom:16px">📋 Full Analysis Report</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <div style="font-size:14px;font-weight:600;margin-bottom:10px">AI Verdict</div>
          <div class="trust-verdict ${isFake?'fake':'genuine'}">
            <span class="verdict-icon">${isFake?'⚠️':'✅'}</span>
            <div><div class="verdict-label" style="color:${isFake?'var(--red)':'var(--green)'}">${pred.verdict}</div>
            <div class="verdict-sub">${pred.confidence}% confidence · ${pred.risk_level} risk</div></div>
          </div>
          <div style="margin-top:12px;font-size:14px;font-weight:600;margin-bottom:8px">Trust Scores</div>
          ${[['Price Fairness', scores.price_fairness_score], ['Quality Score', scores.quality_score], ['Overall Value', scores.value_score]].map(([l,v]) => `
          <div class="score-bar-item">
            <div class="score-bar-label"><span style="font-size:13px">${l}</span><span style="font-weight:600">${fmt.score(v||0)}%</span></div>
            <div class="score-bar-track"><div class="score-bar-fill" style="width:${fmt.score(v||0)}%;background:${(v||0)>0.6?'var(--green)':(v||0)>0.3?'var(--gold)':'var(--red)'}"></div></div>
          </div>`).join('')}
        </div>
        <div>
          <div style="font-size:14px;font-weight:600;margin-bottom:10px">Price Analysis</div>
          <div class="info-grid">
            <div class="info-item"><div class="i-label">Original Price</div><div class="i-value">${fmt.price(pa.original_price)}</div></div>
            <div class="info-item"><div class="i-label">Discounted Price</div><div class="i-value">${fmt.price(pa.discounted_price)}</div></div>
            <div class="info-item"><div class="i-label">Competitor Price</div><div class="i-value">${fmt.price(pa.competitor_price)}</div></div>
            <div class="info-item"><div class="i-label">Actual Savings</div><div class="i-value text-green">${fmt.price(pa.actual_savings)}</div></div>
            <div class="info-item"><div class="i-label">Real Discount</div><div class="i-value">${pa.real_discount_pct.toFixed(1)}%</div></div>
            <div class="info-item"><div class="i-label">vs Market</div><div class="i-value ${pa.vs_market<0?'text-green':'text-red'}">${pa.cheaper_than_market?'Cheaper':'Pricier'} by ${fmt.price(Math.abs(pa.vs_market))}</div></div>
          </div>
        </div>
      </div>
      ${r.reasoning && r.reasoning.length ? `
      <div style="margin-top:16px">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px">AI Reasoning</div>
        ${r.reasoning.map(reason => `<div style="display:flex;gap:8px;align-items:flex-start;padding:8px;background:var(--surface3);border-radius:6px;margin-bottom:6px;font-size:13px"><span>${isFake?'⚠':'ℹ'}</span><span>${reason}</span></div>`).join('')}
      </div>` : ''}
      <div style="margin-top:16px;padding:14px;background:var(--surface3);border-radius:10px;font-size:14px;line-height:1.5">
        <strong>Recommendation:</strong> ${r.recommendation}
      </div>`;
  } catch(e) { toast('Analysis failed: ' + e.message, 'error'); }
  finally { btn.textContent = '🧬 Full Analysis'; btn.disabled = false; }
}

function clearAnalyze() {
  ['a-name','a-orig','a-disc','a-comp','a-p1m','a-p1w','a-rat','a-rev','a-stock','a-brand'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('analyzeResult').className = 'hidden';
}

/* ── MODEL INSIGHTS ───────────────────────────────────────────── */
async function loadModelInsights() {
  try {
    const data = await api('/stats');
    state.metadata = data;
    const fi = data.feature_importances || {};
    const sorted = Object.entries(fi).sort((a,b) => b[1]-a[1]);
    const list = document.getElementById('featureList');
    list.innerHTML = sorted.map(([name, val]) => `
      <div class="feature-bar">
        <div class="feature-name">${name.replace(/_/g,' ')}</div>
        <div class="feature-track"><div class="feature-fill" style="width:${(val*100).toFixed(0)}%"></div></div>
        <div class="feature-pct">${(val*100).toFixed(1)}%</div>
      </div>`).join('');

    const m = data.model_metrics || {};
    const metricEl = document.getElementById('metricsGrid');
    metricEl.innerHTML = [
      ['Accuracy', ((m.accuracy||0.878)*100).toFixed(1)+'%'],
      ['ROC-AUC', (m.roc_auc||0.908).toFixed(3)],
      ['Precision', (m.precision||0.90).toFixed(2)],
      ['Recall', (m.recall||0.67).toFixed(2)],
      ['F1 Score', (m.f1||0.77).toFixed(2)],
      ['CV Mean', (m.cv_mean||0.87).toFixed(2)],
    ].map(([label, val]) => `
      <div class="metric-card">
        <div class="metric-value">${val}</div>
        <div class="metric-label">${label}</div>
      </div>`).join('');
  } catch(e) { /* silent */ }
}

/* ── FLASH SALE TIMER ─────────────────────────────────────────── */
function startTimer() {
  let h = 3, m = 47, s = 22;
  setInterval(() => {
    s--; if (s < 0) { s = 59; m--; if (m < 0) { m = 59; h = (h - 1 + 24) % 24; } }
    const pad = n => String(n).padStart(2,'0');
    const te = document.getElementById('t-h'); if (te) te.textContent = pad(h);
    const tm = document.getElementById('t-m'); if (tm) tm.textContent = pad(m);
    const ts = document.getElementById('t-s'); if (ts) ts.textContent = pad(s);
  }, 1000);
}

/* ── Utility ──────────────────────────────────────────────────── */
function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

/* ── INIT ─────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  checkApiHealth();
  loadDashboard();
  startTimer();

  // Nav clicks
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.addEventListener('click', () => navigate(el.dataset.page));
  });

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  // Close modal on overlay click
  document.getElementById('productModal').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Keyboard shortcut
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault(); document.getElementById('globalSearch').focus();
    }
  });
});
