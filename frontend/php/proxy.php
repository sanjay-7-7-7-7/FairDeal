<?php
/**
 * FairDeal v2.0 — PHP → Flask API Proxy
 * Handles CORS, caching, and error logging
 */

$FLASK_BASE = 'http://localhost:5000/api';
$CACHE_DIR  = sys_get_temp_dir() . '/fairdeal_cache';
$CACHE_TTL  = 60; // seconds

if (!is_dir($CACHE_DIR)) mkdir($CACHE_DIR, 0755, true);

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$endpoint = isset($_GET['endpoint']) ? '/' . ltrim($_GET['endpoint'], '/') : '/health';
$method   = $_SERVER['REQUEST_METHOD'];
$body     = file_get_contents('php://input');

// Cache GET requests
$cacheKey = md5($method . $endpoint . http_build_query($_GET));
$cachePath = "$CACHE_DIR/$cacheKey.json";
if ($method === 'GET' && file_exists($cachePath) && (time() - filemtime($cachePath)) < $CACHE_TTL) {
    echo file_get_contents($cachePath);
    exit;
}

$ch = curl_init($FLASK_BASE . $endpoint . ($method === 'GET' ? '?' . http_build_query(array_diff_key($_GET, ['endpoint'=>''])) : ''));
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST  => $method,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS     => ($method === 'POST') ? $body : null,
    CURLOPT_TIMEOUT        => 10,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error    = curl_error($ch);
curl_close($ch);

if ($error) {
    http_response_code(503);
    echo json_encode(['error' => 'Flask API unavailable: ' . $error]);
    exit;
}

http_response_code($httpCode);
if ($method === 'GET' && $httpCode === 200) file_put_contents($cachePath, $response);
echo $response;
