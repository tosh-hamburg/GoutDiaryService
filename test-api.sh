#!/bin/bash
# API Test Script

BASE_URL="http://localhost:3001"

echo "=== Teste API Endpunkte ==="
echo ""

echo "1. Health Check:"
curl -s "$BASE_URL/health" | jq '.' || curl -s "$BASE_URL/health"
echo ""
echo ""

echo "2. Teste Uric Acid Values (GET):"
curl -s "$BASE_URL/api/v1/uric-acid-values?userId=test-user" | jq '.' || curl -s "$BASE_URL/api/v1/uric-acid-values?userId=test-user"
echo ""
echo ""

echo "3. Teste Uric Acid Stats:"
curl -s "$BASE_URL/api/v1/uric-acid-values/stats?userId=test-user&days=30" | jq '.' || curl -s "$BASE_URL/api/v1/uric-acid-values/stats?userId=test-user&days=30"
echo ""
echo ""

echo "4. Teste Meals (GET):"
curl -s "$BASE_URL/api/v1/meals?userId=test-user" | jq '.' || curl -s "$BASE_URL/api/v1/meals?userId=test-user"
echo ""


