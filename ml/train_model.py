"""
FairDeal - Fake Discount Detection ML Pipeline
Steps: Data Loading → EDA → Preprocessing → Feature Engineering →
       Model Training → Hyperparameter Tuning → Evaluation → Export
"""

import pandas as pd
import numpy as np
import joblib
import json
import warnings
import os
warnings.filterwarnings('ignore')

from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, GridSearchCV, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (accuracy_score, precision_score, recall_score,
                              f1_score, confusion_matrix, roc_auc_score,
                              classification_report)

print("=" * 60)
print("  FAIRDEAL — Fake Discount Detection ML Pipeline")
print("=" * 60)

# ─── STEP 1: LOAD & EDA ───────────────────────────────────────
print("\n[STEP 1] Loading Dataset & EDA")

# Prefer the provided CSV dataset; fall back to original Excel name if needed
csv_path = os.path.join(os.path.dirname(__file__), "ML_dataset_fake discount.csv")
if os.path.exists(csv_path):
    df = pd.read_csv(csv_path)
else:
    # Backward compatibility if someone still has the old Excel file
    df = pd.read_excel("dataset.xlsx")
print(f"  Dataset shape : {df.shape}")
print(f"  Columns       : {list(df.columns)}")
print(f"  Missing values: {df.isnull().sum().sum()}")
print(f"  Duplicates    : {df.duplicated().sum()}")
print(f"\n  Target Distribution:")
vc = df['is_fake_discount'].value_counts()
for k, v in vc.items():
    label = "Fake Discount" if k == 1 else "Genuine Discount"
    print(f"    {label} ({k}): {v} ({v/len(df)*100:.1f}%)")

# ─── STEP 2: PREPROCESSING ────────────────────────────────────
print("\n[STEP 2] Preprocessing")

df = df.drop_duplicates()

# Basic missing-value handling to keep the model robust
numeric_cols = [
    'price_1_month_ago', 'price_1_week_ago', 'original_price',
    'discounted_price', 'discount_percentage', 'competitor_price',
    'rating', 'num_reviews', 'stock_left'
]
for col in numeric_cols:
    if col in df.columns:
        # Fill with sensible defaults
        if col == 'competitor_price':
            df[col] = df[col].fillna(df['discounted_price'])
        elif col in ('price_1_month_ago', 'price_1_week_ago'):
            df[col] = df[col].fillna(df['original_price'])
        elif col == 'rating':
            df[col] = df[col].fillna(df[col].median())
        elif col == 'num_reviews':
            df[col] = df[col].fillna(df[col].median())
        else:
            df[col] = df[col].fillna(df[col].median())

bool_cols = ['is_flash_sale', 'is_fake_discount']
for col in bool_cols:
    if col in df.columns:
        df[col] = df[col].fillna(0).astype(int)

# Drop non-predictive identifier columns but keep for reference
product_ids   = df['product_id'].astype(str).copy()
product_names = df['product_name'].astype(str).copy()

# Encode categorical features
le_cat   = LabelEncoder()
le_brand = LabelEncoder()

df['category_enc'] = le_cat.fit_transform(df['category'])
df['brand_enc']    = le_brand.fit_transform(df['brand'])

print(f"  Categories encoded: {list(le_cat.classes_)}")
print(f"  Brands encoded    : {df['brand'].nunique()} unique brands")

# ─── STEP 3: FEATURE ENGINEERING ─────────────────────────────
print("\n[STEP 3] Feature Engineering")

# Price manipulation signals
df['price_inflated_vs_month'] = df['original_price'] - df['price_1_month_ago']
df['price_inflated_vs_week']  = df['original_price'] - df['price_1_week_ago']
df['inflation_ratio_month']   = df['original_price'] / (df['price_1_month_ago'] + 1)
df['inflation_ratio_week']    = df['original_price'] / (df['price_1_week_ago'] + 1)

# Competitor comparison
df['vs_competitor']           = df['discounted_price'] - df['competitor_price']
df['competitor_ratio']        = df['discounted_price'] / (df['competitor_price'] + 1)
df['cheaper_than_competitor'] = (df['discounted_price'] < df['competitor_price']).astype(int)

# Discount quality signals
df['actual_savings']          = df['original_price'] - df['discounted_price']
df['discount_to_competitor']  = (df['original_price'] - df['competitor_price']) / (df['competitor_price'] + 1)

# Rating & review signals
df['rating_review_score']     = df['rating'] * np.log1p(df['num_reviews'])
df['value_index']             = (df['rating'] * df['num_reviews']) / (df['discounted_price'] + 1)

# Stock pressure signal (fake discounts often pair with low/high stock extremes)
df['low_stock_flag']          = (df['stock_left'] < 20).astype(int)

# Flash sale + fake discount interaction
df['flash_discount_combo']    = df['is_flash_sale'] * df['discount_percentage']

print("  Engineered features:")
new_feats = ['price_inflated_vs_month','price_inflated_vs_week','inflation_ratio_month',
             'inflation_ratio_week','vs_competitor','competitor_ratio','cheaper_than_competitor',
             'actual_savings','discount_to_competitor','rating_review_score','value_index',
             'low_stock_flag','flash_discount_combo']
for f in new_feats:
    print(f"    + {f}")

# ─── STEP 4: DEFINE FEATURES & TARGET ────────────────────────
print("\n[STEP 4] Defining Feature Matrix")

FEATURES = [
    # Original numerical
    'price_1_month_ago','price_1_week_ago','original_price','discounted_price',
    'discount_percentage','competitor_price','rating','num_reviews','stock_left',
    'is_flash_sale',
    # Encoded categorical
    'category_enc','brand_enc',
    # Engineered
    'price_inflated_vs_month','price_inflated_vs_week','inflation_ratio_month',
    'inflation_ratio_week','vs_competitor','competitor_ratio','cheaper_than_competitor',
    'actual_savings','discount_to_competitor','rating_review_score','value_index',
    'low_stock_flag','flash_discount_combo'
]

TARGET = 'is_fake_discount'

X = df[FEATURES]
y = df[TARGET]

print(f"  Feature count : {len(FEATURES)}")
print(f"  Samples       : {len(X)}")

# ─── STEP 5: TRAIN/TEST SPLIT ─────────────────────────────────
print("\n[STEP 5] Train/Test Split (80/20 Stratified)")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)
print(f"  Train size: {len(X_train)} | Test size: {len(X_test)}")
print(f"  Train class balance: {dict(y_train.value_counts())}")
print(f"  Test  class balance: {dict(y_test.value_counts())}")

# Handle class imbalance with class_weight (SMOTE unavailable offline)
class_counts = y_train.value_counts()
class_weight = {0: 1.0, 1: class_counts[0] / class_counts[1]}
print(f"  Class weights applied: {class_weight}")

# ─── STEP 6: HYPERPARAMETER TUNING ───────────────────────────
print("\n[STEP 6] Hyperparameter Tuning (GridSearchCV)")

param_grid = {
    'n_estimators'    : [100, 200, 300],
    'max_depth'       : [None, 10, 20],
    'min_samples_split': [2, 5],
    'min_samples_leaf' : [1, 2],
    'max_features'    : ['sqrt', 'log2']
}

rf_base = RandomForestClassifier(
    class_weight=class_weight,
    random_state=42,
    n_jobs=-1
)

cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)

grid_search = GridSearchCV(
    estimator=rf_base,
    param_grid=param_grid,
    cv=cv,
    scoring='f1',
    n_jobs=-1,
    verbose=0
)

grid_search.fit(X_train, y_train)

best_params = grid_search.best_params_
print(f"  Best params: {best_params}")
print(f"  Best CV F1 : {grid_search.best_score_:.4f}")

# ─── STEP 7: FINAL MODEL TRAINING ────────────────────────────
print("\n[STEP 7] Training Final Model with Best Params")

model = RandomForestClassifier(
    **best_params,
    class_weight=class_weight,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

# ─── STEP 8: EVALUATION ──────────────────────────────────────
print("\n[STEP 8] Model Evaluation")

y_train_pred = model.predict(X_train)
y_test_pred  = model.predict(X_test)
y_test_prob  = model.predict_proba(X_test)[:, 1]

train_acc = accuracy_score(y_train, y_train_pred)
test_acc  = accuracy_score(y_test,  y_test_pred)
precision = precision_score(y_test, y_test_pred)
recall    = recall_score(y_test, y_test_pred)
f1        = f1_score(y_test, y_test_pred)
roc_auc   = roc_auc_score(y_test, y_test_prob)
cm        = confusion_matrix(y_test, y_test_pred)

print(f"\n  Train Accuracy : {train_acc:.4f} ({train_acc*100:.2f}%)")
print(f"  Test  Accuracy : {test_acc:.4f}  ({test_acc*100:.2f}%)")
print(f"  Precision      : {precision:.4f}")
print(f"  Recall         : {recall:.4f}")
print(f"  F1 Score       : {f1:.4f}")
print(f"  ROC-AUC        : {roc_auc:.4f}")
print(f"\n  Confusion Matrix:")
print(f"    TN={cm[0][0]}  FP={cm[0][1]}")
print(f"    FN={cm[1][0]}  TP={cm[1][1]}")
print(f"\n  Overfitting gap: {abs(train_acc - test_acc):.4f}")
if abs(train_acc - test_acc) < 0.05:
    print("  ✓ No significant overfitting detected")
else:
    print("  ⚠ Some overfitting — consider regularization")

# Cross-validation
cv_scores = cross_val_score(model, X, y, cv=cv, scoring='accuracy')
print(f"\n  5-Fold CV Accuracy: {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
print(f"  CV Scores: {[round(s, 4) for s in cv_scores]}")

print(f"\n  Classification Report:")
print(classification_report(y_test, y_test_pred,
      target_names=['Genuine Discount', 'Fake Discount']))

# ─── STEP 9: FEATURE IMPORTANCE ──────────────────────────────
print("\n[STEP 9] Feature Importances (Top 15)")

importances = model.feature_importances_
feat_imp = sorted(zip(FEATURES, importances), key=lambda x: x[1], reverse=True)
for rank, (feat, imp) in enumerate(feat_imp[:15], 1):
    bar = '█' * int(imp * 200)
    print(f"  {rank:2d}. {feat:<35s} {imp:.4f} {bar}")

# ─── STEP 10: EXPORT MODEL & METADATA ────────────────────────
print("\n[STEP 10] Exporting Model & Artifacts")

os.makedirs('../api', exist_ok=True)

# Save model
joblib.dump(model, '../api/model.pkl')

# Save encoders
joblib.dump(le_cat,   '../api/le_category.pkl')
joblib.dump(le_brand, '../api/le_brand.pkl')

# Save scaler (optional, RF doesn't need it but good practice)
scaler = StandardScaler()
scaler.fit(X_train)
joblib.dump(scaler, '../api/scaler.pkl')

# Save metadata only (frontend display data stays in the 450-product dataset)
metadata = {
    "features"      : FEATURES,
    "target"        : TARGET,
    "categories"    : list(le_cat.classes_),
    "brands"        : list(le_brand.classes_),
    "best_params"   : best_params,
    "metrics": {
        "train_accuracy": round(float(train_acc), 4),
        "test_accuracy" : round(float(test_acc),  4),
        "precision"     : round(float(precision), 4),
        "recall"        : round(float(recall),    4),
        "f1_score"      : round(float(f1),        4),
        "roc_auc"       : round(float(roc_auc),   4),
        "cv_mean"       : round(float(cv_scores.mean()), 4),
        "cv_std"        : round(float(cv_scores.std()),  4),
        "confusion_matrix": cm.tolist()
    },
    "feature_importances": {f: round(float(i), 6) for f, i in feat_imp},
    "train_size"    : int(len(X_train)),
    "test_size"     : int(len(X_test)),
    "total_samples" : int(len(df))
}

with open('../api/metadata.json', 'w') as f:
    json.dump(metadata, f, indent=2)

print("  ✓ model.pkl        → api/model.pkl")
print("  ✓ le_category.pkl  → api/le_category.pkl")
print("  ✓ le_brand.pkl     → api/le_brand.pkl")
print("  ✓ scaler.pkl       → api/scaler.pkl")
print("  ✓ metadata.json    → api/metadata.json")

print("\n" + "=" * 60)
print(f"  TRAINING COMPLETE")
print(f"  Test Accuracy : {test_acc*100:.2f}%")
print(f"  ROC-AUC       : {roc_auc:.4f}")
print(f"  F1 Score      : {f1:.4f}")
print("=" * 60)
