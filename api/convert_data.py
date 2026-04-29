import pandas as pd
import json
import os
import numpy as np

# Path configuration
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
XL_PATH = os.path.join(BASE_DIR, 'dataset.xlsx')
JSON_PATH = os.path.join(BASE_DIR, 'products.json')

def get_product_badges(product):
    badges = []
    if product.get('is_flash_sale'):
        badges.append({"label": "⚡ Flash Sale", "color": "#ff6b35"})
    if product.get('predicted_fake') == 0 and product.get('value_score', 0) > 0.75:
        badges.append({"label": "🏆 Best Value", "color": "#00b09b"})
    if product.get('predicted_fake') == 1:
        badges.append({"label": "⚠️ Price Alert", "color": "#e74c3c"})
    if product.get('stock_left', 100) < 20:
        badges.append({"label": "🔥 Only few left", "color": "#f39c12"})
    if product.get('cheaper_than_competitor'):
        badges.append({"label": "💰 Cheaper than market", "color": "#27ae60"})
    return badges

def get_product_image(product_name, category):
    # Simplified image mapping or just use Unsplash source
    # The PHP API will handle dynamic image generation if needed
    return None 

def convert():
    if not os.path.exists(XL_PATH):
        print(f"Error: {XL_PATH} not found")
        return

    print(f"Reading {XL_PATH}...")
    df = pd.read_excel(XL_PATH)
    
    products = []
    print(f"Processing {len(df)} rows...")
    
    for _, row in df.iterrows():
        d = row.to_dict()
        
        # Numeric conversions
        orig = float(d.get('original_price', 0))
        disc = float(d.get('discounted_price', 0))
        comp = float(d.get('competitor_price', disc))
        rat  = float(d.get('rating', 4.0))
        rev  = float(d.get('num_reviews', 100))
        
        # Scoring logic (Synchronized with app.py)
        price_fairness = float(np.clip(1 - (disc - comp) / (comp + 1), 0, 1))
        quality = float(np.clip((rat - 3.7) / (4.9 - 3.7) * 0.6 + np.log1p(rev) / np.log1p(12000) * 0.4, 0, 1))
        
        # Fake probability (heuristic based on is_fake_discount column)
        is_fake = bool(d.get('is_fake_discount', False))
        fake_prob = 0.82 if is_fake else 0.15
        
        value = float(np.clip(price_fairness * 0.4 + quality * 0.4 + (1 - fake_prob) * 0.2, 0, 1))
        
        cat = d.get('category', 'Electronics')
        name = d.get('product_name', 'Unnamed Product')
        
        product = {
            "product_id":          str(d.get('product_id', '')),
            "product_name":        name,
            "category":            cat,
            "brand":               d.get('brand', 'Generic'),
            "original_price":      orig,
            "discounted_price":    disc,
            "discount_percentage": float(d.get('discount_percentage', 0)),
            "competitor_price":    comp,
            "rating":              rat,
            "num_reviews":         int(rev),
            "stock_left":          int(d.get('stock_left', 50)),
            "is_flash_sale":       bool(d.get('is_flash_sale', False)),
            "is_fake_discount":    is_fake,
            "predicted_fake":      1 if is_fake else 0,
            "fake_probability":    round(fake_prob, 4),
            "genuine_probability": round(1 - fake_prob, 4),
            "price_fairness_score":round(price_fairness, 4),
            "quality_score":       round(quality, 4),
            "value_score":         round(value, 4),
            "worth_buying":        bool((fake_prob < 0.5) and (value >= 0.4)),
            "cheaper_than_competitor": bool(disc < comp),
            "actual_savings":      round(orig - disc, 2),
            "verdict":             "FAKE DISCOUNT" if is_fake else "GENUINE DISCOUNT",
            "risk_level":          "HIGH" if fake_prob > 0.7 else "MEDIUM" if fake_prob > 0.4 else "LOW",
        }
        product['badges'] = get_product_badges(product)
        products.append(product)
    
    print(f"Saving to {JSON_PATH}...")
    with open(JSON_PATH, 'w') as f:
        json.dump(products, f, indent=2)
    print("Done!")

if __name__ == "__main__":
    convert()
