<?php
/**
 * FairDeal v2.0 — AI-Powered E-Commerce Fake Discount Detector
 * Enhanced UI with product display, images, and price comparison
 */
$app_name    = "FairDeal";
$app_version = "2.0.0";
// Absolute API base so calls work from http://localhost/fairdeal/frontend/index.php
// We rely on PHP PATH_INFO routing: api.php/health, api.php/products, etc.
// Use PHP-native API which reads model outputs from api/products.json
$api_url     = "http://localhost/fairdeal/api/api.php";
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title><?= $app_name ?> — AI Smart Shopping</title>
  <meta name="description" content="AI-powered fake discount detection. Shop smart, save real money.">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="css/style.css">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js" defer></script>
</head>
<body>

<div id="toastContainer" class="toast-container"></div>

<!-- Product Detail Modal -->
<div class="modal-overlay" id="productModal">
  <div class="modal" style="position:relative">
    <button class="modal-close" onclick="closeModal()">✕</button>
    <div id="modalContent"></div>
  </div>
</div>

<div class="app-wrapper">
  <!-- ── SIDEBAR ──────────────────────────────────────────────── -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <div class="logo-icon">🛡</div>
      <div>
        <div class="logo-text">Fair<span>Deal</span></div>
        
      </div>
    </div>

    <nav class="sidebar-nav">
      <div class="nav-section">
        <div class="nav-label">Overview</div>
        <button class="nav-item active" data-page="dashboard">
          <span class="icon">📊</span> Dashboard
        </button>
      </div>

      <div class="nav-section">
        <div class="nav-label">Shop</div>
        <button class="nav-item" data-page="products">
          <span class="icon">🛍️</span> Browse Products
        </button>
        <button class="nav-item" data-page="recommend">
          <span class="icon">⭐</span> Top Picks
        </button>
        <button class="nav-item" data-page="compare">
          <span class="icon">⚖️</span> Compare
          <span id="compareCount" class="nav-badge">0</span>
        </button>
      </div>

      <div class="nav-section">
        <div class="nav-label">AI Tools</div>
        <button class="nav-item" data-page="predict">
          <span class="icon">🔍</span> Quick Check
        </button>
        <button class="nav-item" data-page="analyze">
          <span class="icon">🧬</span> Deep Analysis
        </button>
      </div>

      <div class="nav-section">
        <div class="nav-label">Intelligence</div>
        <button class="nav-item" data-page="model">
          <span class="icon">🧠</span> Model Insights
        </button>
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="api-status">
        <div class="status-dot" id="statusDot"></div>
        <span id="statusText">Connecting...</span>
      </div>
    </div>
  </aside>

  <!-- ── MAIN ────────────────────────────────────────────────── -->
  <div class="main-content">

    <!-- Topbar -->
    <div class="topbar">
      <div style="display:flex;align-items:center;gap:12px">
        <button class="hamburger" id="hamburger">☰</button>
        <span style="font-weight:700;font-size:15px" id="topbarTitle">Dashboard</span>
      </div>
      <div class="topbar-search">
        <span style="color:var(--text3);font-size:15px">🔍</span>
        <input type="text" id="globalSearch" placeholder="Search products, brands..." oninput="handleGlobalSearch(this.value)">
      </div>
      <div class="topbar-right">
        <button class="btn btn-outline btn-sm" onclick="navigate('compare')">🛒 <span id="cartLabel">Compare (0)</span></button>
        <button class="btn btn-ghost btn-sm" onclick="checkApiHealth()">🔄</button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         PAGE: DASHBOARD
    ═══════════════════════════════════════════════════════ -->
    <div class="page active" id="page-dashboard">
      <div class="page-header">
        <h2>📊 Dashboard</h2>
        <p>AI-powered fake discount detection across <?= number_format(450) ?>+ products</p>
      </div>

      <!-- Flash Sale Banner -->
      <div class="flash-banner">
        <div>
          <div class="flash-title">⚡ Flash Sale Alert</div>
          <div class="flash-sub">AI-verified genuine deals — updated every hour</div>
        </div>
        <div class="flash-timer">
          <div class="timer-block"><span id="t-h">03</span><small>hrs</small></div>
          <span style="color:#fff;font-weight:700">:</span>
          <div class="timer-block"><span id="t-m">47</span><small>min</small></div>
          <span style="color:#fff;font-weight:700">:</span>
          <div class="timer-block"><span id="t-s">22</span><small>sec</small></div>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid" id="statsGrid">
        <div class="stat-card" style="--card-accent:var(--accent)">
          <div class="icon">📦</div>
          <div class="value" id="s-total">—</div>
          <div class="label">Total Products</div>
        </div>
        <div class="stat-card" style="--card-accent:var(--green)">
          <div class="icon">✅</div>
          <div class="value text-green" id="s-genuine">—</div>
          <div class="label">Genuine Deals</div>
        </div>
        <div class="stat-card" style="--card-accent:var(--red)">
          <div class="icon">⚠️</div>
          <div class="value text-red" id="s-fake">—</div>
          <div class="label">Fake Discounts</div>
        </div>
        <div class="stat-card" style="--card-accent:var(--gold)">
          <div class="icon">🏆</div>
          <div class="value" style="color:var(--gold)" id="s-worth">—</div>
          <div class="label">Worth Buying</div>
        </div>
      </div>

      <!-- Charts -->
      <div class="charts-grid">
        <div class="chart-card">
          <div class="chart-title">📊 Fake vs Genuine by Category</div>
          <div class="chart-wrap"><canvas id="categoryChart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">🎯 Model Performance</div>
          <div class="chart-wrap"><canvas id="modelChart"></canvas></div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         PAGE: PRODUCTS
    ═══════════════════════════════════════════════════════ -->
    <div class="page" id="page-products">
      <div class="page-header">
        <h2>🛍️ Browse Products</h2>
        <p>AI trust scores on every product — <span id="totalProductsLabel">450</span> products</p>
      </div>

      <!-- Category Chips -->
      <div class="category-strip" id="categoryChips">
        <div class="cat-chip active" onclick="filterByCategory('')">
          <span class="cat-icon">🔥</span> All
        </div>
        <div class="cat-chip" onclick="filterByCategory('Electronics')"><span class="cat-icon">📱</span> Electronics</div>
        <div class="cat-chip" onclick="filterByCategory('Fashion')"><span class="cat-icon">👟</span> Fashion</div>
        <div class="cat-chip" onclick="filterByCategory('Sports')"><span class="cat-icon">⚽</span> Sports</div>
        <div class="cat-chip" onclick="filterByCategory('Books')"><span class="cat-icon">📚</span> Books</div>
        <div class="cat-chip" onclick="filterByCategory('Beauty')"><span class="cat-icon">💄</span> Beauty</div>
        <div class="cat-chip" onclick="filterByCategory('Groceries')"><span class="cat-icon">🛒</span> Groceries</div>
        <div class="cat-chip" onclick="filterByCategory('Home Appliances')"><span class="cat-icon">🏠</span> Home</div>
      </div>

      <!-- Filters -->
      <div class="products-header">
        <div class="flex gap-2 items-center">
          <span id="productsCount" class="text-dim text-sm">Loading...</span>
        </div>
        <div class="filter-bar">
          <select class="filter-select" id="sortSelect" onchange="applyFilters()">
            <option value="value_score">Best Value</option>
            <option value="rating">Top Rated</option>
            <option value="discount_percentage">Biggest Discount</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="num_reviews">Most Reviews</option>
          </select>
          <select class="filter-select" id="trustFilter" onchange="applyFilters()">
            <option value="">All Products</option>
            <option value="genuine">✅ Genuine Only</option>
            <option value="fake">⚠️ Fake Discounts</option>
            <option value="flash">⚡ Flash Sales</option>
          </select>
          <select class="filter-select" id="ratingFilter" onchange="applyFilters()">
            <option value="0">Any Rating</option>
            <option value="4">4★ & above</option>
            <option value="4.5">4.5★ & above</option>
          </select>
          <button class="btn btn-ghost btn-sm" onclick="clearFilters()">Clear</button>
        </div>
      </div>

      <!-- Products Grid -->
      <div class="products-grid" id="productsGrid">
        <!-- Skeleton loaders -->
        <?php for($i=0;$i<12;$i++): ?>
        <div class="product-card">
          <div style="padding-top:75%;background:var(--surface2)" class="skeleton"></div>
          <div class="product-info">
            <div class="skeleton" style="height:12px;width:60%;margin-bottom:8px"></div>
            <div class="skeleton" style="height:14px;width:90%;margin-bottom:4px"></div>
            <div class="skeleton" style="height:14px;width:70%;margin-bottom:12px"></div>
            <div class="skeleton" style="height:20px;width:50%"></div>
          </div>
        </div>
        <?php endfor; ?>
      </div>

      <!-- Pagination -->
      <div class="pagination" id="pagination"></div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         PAGE: RECOMMENDATIONS
    ═══════════════════════════════════════════════════════ -->
    <div class="page" id="page-recommend">
      <div class="page-header">
        <h2>⭐ Top Picks</h2>
        <p>AI-verified genuine deals — best value for money</p>
      </div>

      <div class="flex gap-2 mb-4 flex-wrap">
        <button class="btn btn-primary" onclick="loadRecommendations('')">🔥 All</button>
        <button class="btn btn-ghost" onclick="loadRecommendations('Electronics')">📱 Electronics</button>
        <button class="btn btn-ghost" onclick="loadRecommendations('Fashion')">👟 Fashion</button>
        <button class="btn btn-ghost" onclick="loadRecommendations('Sports')">⚽ Sports</button>
        <button class="btn btn-ghost" onclick="loadRecommendations('Books')">📚 Books</button>
        <button class="btn btn-ghost" onclick="loadRecommendations('Beauty')">💄 Beauty</button>
        <button class="btn btn-ghost" onclick="loadRecommendations('Home Appliances')">🏠 Home</button>
      </div>

      <div class="recs-strip" id="recsGrid">
        <div class="text-dim text-sm loading-pulse">Loading top picks...</div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         PAGE: COMPARE
    ═══════════════════════════════════════════════════════ -->
    <div class="page" id="page-compare">
      <div class="page-header">
        <h2>⚖️ Compare Products</h2>
        <p>Add up to 4 products from Browse to compare side-by-side</p>
      </div>

      <div id="compareEmptyState" style="text-align:center;padding:60px;color:var(--text2)">
        <div style="font-size:60px;margin-bottom:16px">⚖️</div>
        <div style="font-size:18px;font-weight:600;margin-bottom:8px">No products added yet</div>
        <div style="font-size:14px;margin-bottom:20px">Browse products and click "Compare" on any card</div>
        <button class="btn btn-primary" onclick="navigate('products')">Browse Products →</button>
      </div>

      <div class="compare-grid" id="compareGrid" style="display:none"></div>

      <div id="compareActions" style="display:none;margin-top:20px;display:none">
        <button class="btn btn-outline" onclick="clearCompare()">🗑 Clear All</button>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         PAGE: QUICK PREDICT
    ═══════════════════════════════════════════════════════ -->
    <div class="page" id="page-predict">
      <div class="page-header">
        <h2>🔍 Quick Check</h2>
        <p>Instantly detect if a discount is genuine or manipulated</p>
      </div>

      <div class="form-card">
        <div class="form-title">Enter Product Pricing</div>
        <div class="form-sub">Fill in the price details to get an instant AI verdict</div>
        <div class="form-grid">
          <div class="form-group">
            <label>Original Price (₹) *</label>
            <input type="number" id="p-orig" placeholder="e.g. 5000" min="0">
          </div>
          <div class="form-group">
            <label>Discounted Price (₹) *</label>
            <input type="number" id="p-disc" placeholder="e.g. 3500" min="0">
          </div>
          <div class="form-group">
            <label>Competitor Price (₹) *</label>
            <input type="number" id="p-comp" placeholder="e.g. 4200" min="0">
          </div>
          <div class="form-group">
            <label>Rating (1–5)</label>
            <input type="number" id="p-rat" placeholder="e.g. 4.2" min="1" max="5" step="0.1">
          </div>
          <div class="form-group">
            <label>No. of Reviews</label>
            <input type="number" id="p-rev" placeholder="e.g. 1500" min="0">
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="p-cat">
              <option>Electronics</option><option>Fashion</option><option>Sports</option>
              <option>Books</option><option>Beauty</option><option>Groceries</option>
              <option>Home Appliances</option>
            </select>
          </div>
          <div class="form-group">
            <label>Flash Sale?</label>
            <select id="p-flash"><option value="0">No</option><option value="1">Yes</option></select>
          </div>
          <div class="form-group">
            <label>Price 1 Month Ago (₹)</label>
            <input type="number" id="p-p1m" placeholder="Optional">
          </div>
          <div class="form-group">
            <label>Price 1 Week Ago (₹)</label>
            <input type="number" id="p-p1w" placeholder="Optional">
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-lg" onclick="runPredict()">🔍 Check Discount</button>
          <button class="btn btn-ghost btn-lg" onclick="clearPredict()">Clear</button>
        </div>
      </div>

      <div id="predictResult" class="hidden"></div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         PAGE: DEEP ANALYSIS
    ═══════════════════════════════════════════════════════ -->
    <div class="page" id="page-analyze">
      <div class="page-header">
        <h2>🧬 Deep Analysis</h2>
        <p>Full breakdown with price history, value scores & AI reasoning</p>
      </div>

      <div class="form-card">
        <div class="form-title">Complete Product Analysis</div>
        <div class="form-sub">Provide all details for comprehensive discount validation</div>
        <div class="form-grid">
          <div class="form-group">
            <label>Product Name</label>
            <input type="text" id="a-name" placeholder="e.g. Samsung Galaxy S24">
          </div>
          <div class="form-group">
            <label>Original Price (₹) *</label>
            <input type="number" id="a-orig" placeholder="e.g. 80000" min="0">
          </div>
          <div class="form-group">
            <label>Discounted Price (₹) *</label>
            <input type="number" id="a-disc" placeholder="e.g. 65000" min="0">
          </div>
          <div class="form-group">
            <label>Competitor Price (₹) *</label>
            <input type="number" id="a-comp" placeholder="e.g. 72000" min="0">
          </div>
          <div class="form-group">
            <label>Price 1 Month Ago (₹)</label>
            <input type="number" id="a-p1m" placeholder="e.g. 79000">
          </div>
          <div class="form-group">
            <label>Price 1 Week Ago (₹)</label>
            <input type="number" id="a-p1w" placeholder="e.g. 80000">
          </div>
          <div class="form-group">
            <label>Rating</label>
            <input type="number" id="a-rat" placeholder="e.g. 4.3" min="1" max="5" step="0.1">
          </div>
          <div class="form-group">
            <label>No. of Reviews</label>
            <input type="number" id="a-rev" placeholder="e.g. 2400">
          </div>
          <div class="form-group">
            <label>Stock Left</label>
            <input type="number" id="a-stock" placeholder="e.g. 50">
          </div>
          <div class="form-group">
            <label>Category</label>
            <select id="a-cat">
              <option>Electronics</option><option>Fashion</option><option>Sports</option>
              <option>Books</option><option>Beauty</option><option>Groceries</option>
              <option>Home Appliances</option>
            </select>
          </div>
          <div class="form-group">
            <label>Brand</label>
            <input type="text" id="a-brand" placeholder="e.g. Samsung">
          </div>
          <div class="form-group">
            <label>Flash Sale?</label>
            <select id="a-flash"><option value="0">No</option><option value="1">Yes</option></select>
          </div>
        </div>
        <div class="form-actions">
          <button class="btn btn-primary btn-lg" onclick="runAnalyze()">🧬 Full Analysis</button>
          <button class="btn btn-ghost btn-lg" onclick="clearAnalyze()">Clear</button>
        </div>
      </div>

      <div id="analyzeResult" class="hidden"></div>
    </div>

    <!-- ═══════════════════════════════════════════════════
         PAGE: MODEL INSIGHTS
    ═══════════════════════════════════════════════════════ -->
    <div class="page" id="page-model">
      <div class="page-header">
        <h2>🧠 Model Insights</h2>
        <p>Random Forest classifier performance &amp; feature analysis</p>
      </div>

      <div class="metrics-grid" id="metricsGrid">
        <div class="metric-card"><div class="metric-value">87.8%</div><div class="metric-label">Accuracy</div></div>
        <div class="metric-card"><div class="metric-value">0.91</div><div class="metric-label">ROC-AUC</div></div>
        <div class="metric-card"><div class="metric-value">0.90</div><div class="metric-label">Precision</div></div>
        <div class="metric-card"><div class="metric-value">0.67</div><div class="metric-label">Recall</div></div>
        <div class="metric-card"><div class="metric-value">0.77</div><div class="metric-label">F1 Score</div></div>
        <div class="metric-card"><div class="metric-value">0.87</div><div class="metric-label">CV Mean</div></div>
      </div>

      <div class="chart-card mt-4">
        <div class="chart-title">🎯 Feature Importances</div>
        <div class="feature-bar-list" id="featureList">
          <div class="text-dim text-sm loading-pulse">Loading...</div>
        </div>
      </div>
    </div>

  </div><!-- /main-content -->
</div><!-- /app-wrapper -->

<script>
const API_BASE = '<?= $api_url ?>';
</script>
<script src="js/app.js"></script>
</body>
</html>
