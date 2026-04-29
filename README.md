# 🛡 FairDeal v2.0 — AI Smart Shopping

AI-powered fake discount detection with a beautiful **Amazon-style e-commerce UI**.
Browse 450+ products with real images, trust scores, price comparisons, and more.

---

## ✨ What's New in v2.0

- 🛍️ **Amazon-style product grid** with real product images (Unsplash)
- 🔍 **Global search** across all products
- 🏷️ **Smart badges** — Flash Sale, Best Value, Price Alert, Cheaper than market
- ✅/⚠️ **Trust indicators** on every card (genuine vs fake)
- 🔢 **Score bars** — Price Fairness, Quality, Overall Value
- 📦 **Product detail modal** with similar products
- ⚖️ **Side-by-side comparison** (up to 4 products)
- 🎯 **Advanced filters** — category, rating, trust, flash sale
- 💰 **Real price comparison** vs competitor prices
- ⚡ **Flash sale timer** countdown
- 📊 **Enhanced dashboard** with charts
- 🧬 **Deep analysis** with AI reasoning

---

## 📁 Project Structure

```
fairdeal/
├── ml/
│   ├── dataset.xlsx          ← Your 450 product dataset
│   └── train_model.py        ← ML pipeline (Random Forest)
│
├── api/
│   ├── app.py                ← Enhanced Flask REST API v2.0
│   ├── model.pkl             ← Trained model (after training)
│   ├── le_category.pkl       ← Category encoder
│   ├── le_brand.pkl          ← Brand encoder
│   ├── metadata.json         ← Model metrics & features
│   └── products.json         ← Products with predictions
│
└── frontend/
    ├── index.php             ← Main entry point (full SPA)
    ├── css/style.css         ← Complete dark e-commerce design system
    ├── js/app.js             ← All frontend logic
    └── php/proxy.php         ← PHP → Flask proxy with caching
```

---

## 🚀 Quick Start

### Step 1 — Train the ML Model (optional but recommended)

```bash
pip install scikit-learn pandas numpy flask joblib openpyxl
cd fairdeal/ml
python train_model.py
# → copies model.pkl, le_*.pkl, metadata.json, products.json to ../api/
```

> **Without training**, the API falls back to heuristic scoring from the Excel dataset directly.

### Step 2 — Start the Flask API

```bash
cd fairdeal/api
python app.py
# API runs at: http://localhost:5000
```

### Step 3 — Start the PHP Frontend

```bash
cd fairdeal/frontend
php -S localhost:8080
# Open: http://localhost:8080
```

---

## 🌐 API Endpoints v2.0

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET  | `/api/health`           | Health check + product count |
| GET  | `/api/metadata`         | Model metrics & features |
| GET  | `/api/categories`       | Categories & brands |
| GET  | `/api/products`         | Browse products (advanced filters) |
| GET  | `/api/products/<id>`    | Single product + similar items |
| POST | `/api/predict`          | Quick fake discount check |
| POST | `/api/analyze`          | Full analysis with scores |
| POST | `/api/recommend`        | Top genuine deals |
| POST | `/api/compare`          | Compare 2+ products |
| GET  | `/api/stats`            | Dashboard statistics |
| POST | `/api/feedback`         | User feedback |

### New: GET `/api/products` Parameters

| Param | Description |
|-------|-------------|
| `page` | Page number (default: 1) |
| `per_page` | Items per page (default: 20) |
| `category` | Filter by category |
| `brand` | Filter by brand |
| `search` | Full-text search |
| `sort_by` | value_score, rating, discount_percentage, price_asc, price_desc |
| `genuine_only` | Show only genuine discounts |
| `fake_only` | Show only fake discounts |
| `flash_only` | Show only flash sale items |
| `min_rating` | Minimum star rating |
| `min_price` / `max_price` | Price range filter |

---

## 🎨 UI Pages

| Page | Description |
|------|-------------|
| **Dashboard** | Stats, charts, flash sale banner |
| **Browse Products** | Full e-commerce grid with filters, images, trust indicators |
| **Top Picks** | AI-curated genuine deals by category |
| **Compare** | Side-by-side product comparison (up to 4) |
| **Quick Check** | Enter any price → instant fake detection |
| **Deep Analysis** | Full breakdown with scores, reasoning |
| **Model Insights** | Feature importances, accuracy metrics |

---

## 🛠 Requirements

```
Python 3.8+    flask pandas numpy scikit-learn joblib openpyxl
PHP 7.4+       with cURL extension
```

---

## 📊 Model Performance

| Metric | Value |
|--------|-------|
| Test Accuracy | **87.78%** |
| ROC-AUC | **0.9077** |
| Precision | 0.90 |
| Recall | 0.67 |
| F1 Score | 0.77 |

---

*Built with ❤ — Random Forest · Flask · PHP · HTML/CSS/JS*
