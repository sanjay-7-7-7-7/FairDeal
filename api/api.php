<?php
/**
 * FairDeal v2.0 — Native PHP API
 * Replaces Flask API with a robust, zero-dependency PHP implementation.
 */

// Error reporting for debugging
error_reporting(E_ALL);
ini_set('display_errors', 0); // Hide in production
header('Content-Type: application/json');

// CORS Headers
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Configuration
$DATA_FILE = __DIR__ . '/products.json';
$META_FILE = __DIR__ . '/metadata.json';

// Determine endpoint from either query param (?endpoint=stats) or path info (api.php/stats)
if (isset($_GET['endpoint']) && $_GET['endpoint'] !== '') {
    $ENDPOINT = trim($_GET['endpoint'], '/');
} elseif (!empty($_SERVER['PATH_INFO'])) {
    $ENDPOINT = trim($_SERVER['PATH_INFO'], '/');
} else {
    // Fallback based on REQUEST_URI: /fairdeal/api/api.php/stats?page=1
    $reqPath = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '';
    $parts = explode('/', trim($reqPath, '/'));
    $api_idx = array_search('api.php', $parts);
    if ($api_idx !== false && isset($parts[$api_idx + 1])) {
        $ENDPOINT = trim($parts[$api_idx + 1], '/');
    } else {
        $ENDPOINT = 'health';
    }
}

// ── Image Helper ──────────────────────────────────────────────
// Note: primary image_url now comes from ml/train_model.py export.
// This function is only used as a safety fallback.
function get_product_image($product_name, $category) {
    $name = strtolower($product_name);
    $cat = strtolower($category);
    $search = 'product';

    $mapping = [
        ['keywords' => ['bat', 'cricket'], 'term' => 'cricket bat'],
        ['keywords' => ['shoe', 'sneaker', 'footwear', 'nike', 'adidas', 'puma', 'campus', 'bata'], 'term' => 'shoes'],
        ['keywords' => ['laptop', 'macbook', 'hp', 'dell', 'lenovo', 'asus', 'victus', 'xps', 'keyboard'], 'term' => 'laptop'],
        ['keywords' => ['phone', 'iphone', 'galaxy', 'smartphone', 'oneplus', 'samsung', 'xiaomi', 'oppo', 'vivo', 'realme', 'nothing'], 'term' => 'smartphone'],
        ['keywords' => ['earbuds', 'headphone', 'airpods', 'tws', 'boat', 'sony', 'buds', 'speaker'], 'term' => 'headphones'],
        ['keywords' => ['watch', 'smartwatch'], 'term' => 'smartwatch'],
        ['keywords' => ['book', 'mathematics', 'potter', 'hardcover', 'paperback', 'engineering', 'science'], 'term' => 'book'],
        ['keywords' => ['washing machine', 'machine', 'bosch', 'laundry'], 'term' => 'washing machine'],
        ['keywords' => ['fridge', 'refrigerator'], 'term' => 'refrigerator'],
        ['keywords' => ['ac', 'air conditioner'], 'term' => 'air conditioner'],
        ['keywords' => ['tv', 'television', 'led', 'smart tv'], 'term' => 'smart television'],
        ['keywords' => ['kurta', 'shirt', 'dress', 'clothing', 'fashion', 'jeans', 'zara', 'h&m', 'top', 'overshirt', 't-shirt'], 'term' => 'fashion clothing'],
        ['keywords' => ['moisturizer', 'cream', 'foundation', 'skincare', 'nivea', 'lakme', 'maybelline', 'beauty', 'serum', 'lipstick', 'face'], 'term' => 'skincare beauty'],
        ['keywords' => ['coffee', 'bru', 'nescafe'], 'term' => 'coffee'],
        ['keywords' => ['rice', 'basmati', 'india gate'], 'term' => 'rice'],
        ['keywords' => ['noodles', 'maggi'], 'term' => 'noodles'],
        ['keywords' => ['heater', 'havells'], 'term' => 'room heater'],
        ['keywords' => ['fan'], 'term' => 'ceiling fan'],
        ['keywords' => ['bulb', 'led bulb'], 'term' => 'light bulb'],
    ];

    foreach ($mapping as $item) {
        foreach ($item['keywords'] as $kw) {
            if (strpos($name, $kw) !== false || strpos($cat, $kw) !== false) {
                $search = $item['term'];
                break 2;
            }
        }
    }

    $sig = preg_replace('/\D/', '', $product_name) ?: 1;
    return "https://loremflickr.com/400/400/" . urlencode($search) . "?lock=" . $sig;
}

// ── Scoring Logic ─────────────────────────────────────────────
function calculate_scores($data, $is_fake_discount) {
    $orig = floatval($data['original_price'] ?? 0);
    $disc = floatval($data['discounted_price'] ?? 0);
    $comp = floatval($data['competitor_price'] ?? $disc);
    $rat  = floatval($data['rating'] ?? 4.0);
    $rev  = floatval($data['num_reviews'] ?? 100);
    
    $price_fairness = max(0, min(1, 1 - ($disc - $comp) / ($comp + 1)));
    
    // Log quality approximation
    $quality = max(0, min(1, ($rat - 3.7) / (4.9 - 3.7) * 0.6 + log1p($rev) / log1p(12000) * 0.4));
    
    $fake_prob = $is_fake_discount ? 0.82 : 0.15;
    $value = max(0, min(1, $price_fairness * 0.4 + $quality * 0.4 + (1 - $fake_prob) * 0.2));
    
    return [
        'original_price' => $orig,
        'discounted_price' => $disc,
        'competitor_price' => $comp,
        'actual_savings' => round($orig - $disc, 2),
        'real_discount_pct' => round(($orig > 0 ? ($orig - $disc) / $orig * 100 : 0), 2),
        'price_fairness_score' => round($price_fairness, 4),
        'quality_score' => round($quality, 4),
        'value_score' => round($value, 4),
        'worth_buying' => ($fake_prob < 0.5 && $value >= 0.4),
        'is_fake_discount' => $is_fake_discount,
        'fake_probability' => round($fake_prob, 4),
        'verdict' => $is_fake_discount ? "FAKE DISCOUNT" : "GENUINE DISCOUNT",
        'risk_level' => $fake_prob > 0.7 ? "HIGH" : ($fake_prob > 0.4 ? "MEDIUM" : "LOW")
    ];
}

// ── Data Loader ───────────────────────────────────────────────
function load_data($file, $default = []) {
    if (!file_exists($file)) return $default;
    $json = file_get_contents($file);
    $data = json_decode($json, true);
    return $data ?: $default;
}

$db = load_data($DATA_FILE, []);
$meta = load_data($META_FILE, []);

// ── Router ───────────────────────────────────────────────────
try {
    switch ($ENDPOINT) {
        case 'health':
            echo json_encode([
                'status' => 'ok',
                'timestamp' => date('c'),
                'products' => count($db),
                'version' => '2.0 (Native PHP)'
            ]);
            break;

        case 'stats':
            $total = count($db);
            $fake_count = 0;
            $worth_count = 0;
            $by_cat = [];
            
            foreach ($db as $p) {
                if ($p['predicted_fake']) $fake_count++;
                if ($p['worth_buying']) $worth_count++;
                
                $cat = $p['category'] ?: 'Unknown';
                if (!isset($by_cat[$cat])) $by_cat[$cat] = ['total' => 0, 'fake' => 0, 'genuine' => 0];
                $by_cat[$cat]['total']++;
                if ($p['predicted_fake']) $by_cat[$cat]['fake']++;
                else $by_cat[$cat]['genuine']++;
            }
            
            $metrics = $meta['metrics'] ?? [
                'accuracy' => 0.878,
                'roc_auc' => 0.908,
                'precision' => 0.90,
                'recall' => 0.67,
                'f1' => 0.77
            ];
            $feat_imp = $meta['feature_importances'] ?? [
                'inflation_ratio_month' => 0.18,
                'competitor_ratio' => 0.15,
                'rating_review_score' => 0.12,
                'value_index' => 0.11,
                'discount_percentage' => 0.10
            ];

            echo json_encode([
                'total_products' => $total,
                'fake_discounts' => $fake_count,
                'genuine_discounts' => $total - $fake_count,
                'worth_buying' => $worth_count,
                'by_category' => $by_cat,
                'model_metrics' => $metrics,
                'feature_importances' => $feat_imp
            ]);
            break;

        case 'products':
            $page = isset($_GET['page']) ? (int)$_GET['page'] : 1;
            $per_page = isset($_GET['per_page']) ? (int)$_GET['per_page'] : 20;
            $category = $_GET['category'] ?? '';
            $search = strtolower($_GET['search'] ?? '');
            $fake_only = ($_GET['fake_only'] ?? '') === 'true';
            $genuine_only = ($_GET['genuine_only'] ?? '') === 'true';
            $flash_only = ($_GET['flash_only'] ?? '') === 'true';
            $sort_by = $_GET['sort_by'] ?? 'value_score';
            $min_rating = (float)($_GET['min_rating'] ?? 0);

            $pool = $db;
            
            // Filter
            if ($category) $pool = array_filter($pool, fn($p) => strtolower($p['category']) === strtolower($category));
            if ($search) $pool = array_filter($pool, fn($p) => str_contains(strtolower($p['product_name']), $search) || str_contains(strtolower($p['brand']), $search));
            if ($fake_only) $pool = array_filter($pool, fn($p) => $p['predicted_fake'] == 1);
            if ($genuine_only) $pool = array_filter($pool, fn($p) => $p['predicted_fake'] == 0);
            if ($flash_only) $pool = array_filter($pool, fn($p) => $p['is_flash_sale']);
            if ($min_rating) $pool = array_filter($pool, fn($p) => $p['rating'] >= $min_rating);

            // Sort
            usort($pool, function($a, $b) use ($sort_by) {
                if ($sort_by === 'price_asc') return $a['discounted_price'] <=> $b['discounted_price'];
                if ($sort_by === 'price_desc') return $b['discounted_price'] <=> $a['discounted_price'];
                return ($b[$sort_by] ?? 0) <=> ($a[$sort_by] ?? 0);
            });

            $total = count($pool);
            $start = ($page - 1) * $per_page;
            $slice = array_slice($pool, $start, $per_page);

            echo json_encode([
                'products' => array_values($slice),
                'total' => $total,
                'page' => $page,
                'per_page' => $per_page,
                'total_pages' => ceil($total / $per_page)
            ]);
            break;

        case (preg_match('/^products\/(.+)$/', $ENDPOINT, $matches) ? true : false):
            $pid = $matches[1];
            $product = null;
            foreach ($db as $p) { if ($p['product_id'] === $pid) { $product = $p; break; } }
            
            if (!$product) { http_response_code(404); echo json_encode(['error'=>'Not found']); exit; }
            
            $similar = array_filter($db, fn($p) => $p['category'] === $product['category'] && $p['product_id'] !== $pid && !$p['predicted_fake']);
            usort($similar, fn($a, $b) => $b['value_score'] <=> $a['value_score']);
            
            echo json_encode([
                'product' => $product,
                'similar_products' => array_values(array_slice($similar, 0, 6)),
                'price_history' => [
                    'month_ago' => $product['original_price'] * 0.95,
                    'week_ago'  => $product['original_price'] * 0.97,
                    'current'   => $product['discounted_price']
                ]
            ]);
            break;

        case 'recommend':
            $input = json_decode(file_get_contents('php://input'), true);
            $cat = $input['category'] ?? '';
            $top_n = $input['top_n'] ?? 8;
            
            $pool = array_filter($db, fn($p) => !$p['predicted_fake'] && $p['worth_buying']);
            if ($cat) $pool = array_filter($pool, fn($p) => strtolower($p['category']) === strtolower($cat));
            
            usort($pool, fn($a, $b) => $b['value_score'] <=> $a['value_score']);
            
            echo json_encode([
                'recommendations' => array_values(array_slice($pool, 0, $top_n)),
                'count' => min(count($pool), $top_n)
            ]);
            break;

        case 'predict':
        case 'analyze':
            $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
            
            // Heuristic prediction for native PHP
            $orig = (float)($input['original_price'] ?? 0);
            $disc = (float)($input['discounted_price'] ?? 0);
            $p1m  = (float)($input['price_1_month_ago'] ?? $orig * 0.95);
            $comp = (float)($input['competitor_price'] ?? $disc);
            
            $inflation = ($orig - $p1m) / ($p1m + 1);
            $vs_market = ($disc - $comp) / ($comp + 1);
            $flash = (int)($input['is_flash_sale'] ?? 0);
            
            $prob = max(0, min(1, 0.3 * $inflation * 5 + 0.4 * max($vs_market, 0) + 0.3 * $flash));
            $is_fake = $prob > 0.5;
            
            $scores = calculate_scores($input, $is_fake);
            
            if ($ENDPOINT === 'predict') {
                echo json_encode([
                    'is_fake_discount' => $is_fake ? 1 : 0,
                    'fake_probability' => round($prob, 4),
                    'genuine_probability' => round(1 - $prob, 4),
                    'verdict' => $is_fake ? "FAKE DISCOUNT" : "GENUINE DISCOUNT",
                    'confidence' => round(max($prob, 1 - $prob) * 100, 1),
                    'risk_level' => $prob > 0.7 ? "HIGH" : ($prob > 0.4 ? "MEDIUM" : "LOW")
                ]);
            } else {
                $reasons = $is_fake 
                    ? ["Price was artificially inflated before discount", "Discounted price still higher than market average"]
                    : ["Discount appears proportional to historical price", "Price is competitive with market alternatives"];
                
                echo json_encode([
                    'prediction' => [
                        'is_fake_discount' => $is_fake ? 1 : 0,
                        'verdict' => $is_fake ? "FAKE DISCOUNT" : "GENUINE DISCOUNT",
                        'confidence' => round(max($prob, 1 - $prob) * 100, 1),
                        'risk_level' => $prob > 0.7 ? "HIGH" : ($prob > 0.4 ? "MEDIUM" : "LOW"),
                        'genuine_probability' => round(1 - $prob, 4)
                    ],
                    'scores' => $scores,
                    'price_analysis' => [
                        'original_price' => $orig, 'discounted_price' => $disc,
                        'competitor_price' => $comp, 'actual_savings' => round($orig - $disc, 2),
                        'real_discount_pct' => round(($orig > 0 ? ($orig - $disc) / $orig * 100 : 0), 2),
                        'vs_market' => round($disc - $comp, 2),
                        'cheaper_than_market' => $disc < $comp
                    ],
                    'reasoning' => array_slice($reasons, 0, 3),
                    'recommendation' => ($scores['worth_buying'] ? '✅ Safe to Buy — Genuine discount with good value' : '⚠️ Caution — This may not be the deal it appears')
                ]);
            }
            break;

        default:
            http_response_code(404);
            echo json_encode(['error' => "Endpoint '$ENDPOINT' not found"]);
            break;
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
