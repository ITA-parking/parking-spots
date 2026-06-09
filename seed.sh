#!/bin/bash
set -e

JWT=$1
if [ -z "$JWT" ]; then
    echo "Usage: ./seed.sh <jwt-token>"
    exit 1
fi

BASE_URL=${BASE_URL:-http://localhost:7010}
AUTH="Authorization: Bearer $JWT"

echo "==> Creating parking regions..."

REGION_A=$(curl -sf -X POST "$BASE_URL/parking-regions" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{"name":"City Center","description":"Downtown parking zone"}')
echo "Region A: $REGION_A"
REGION_A_ID=$(echo $REGION_A | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

REGION_B=$(curl -sf -X POST "$BASE_URL/parking-regions" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d '{"name":"Airport","description":"Airport long-stay and short-stay parking"}')
echo "Region B: $REGION_B"
REGION_B_ID=$(echo $REGION_B | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)

echo ""
echo "==> Creating pricing..."

curl -sf -X POST "$BASE_URL/pricing" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{\"parking_region_id\":\"$REGION_A_ID\",\"price_per_hour\":2.50,\"currency\":\"EUR\",\"valid_from\":\"2025-01-01\"}" | cat
echo ""

curl -sf -X POST "$BASE_URL/pricing" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{\"parking_region_id\":\"$REGION_B_ID\",\"price_per_hour\":5.00,\"currency\":\"EUR\",\"valid_from\":\"2025-01-01\"}" | cat
echo ""

echo "==> Creating operating hours (Mon-Fri 07:00-22:00, Sat 08:00-20:00)..."

for DAY in 1 2 3 4 5; do
    curl -sf -X POST "$BASE_URL/operating-hours" \
        -H "Content-Type: application/json" \
        -H "$AUTH" \
        -d "{\"parking_region_id\":\"$REGION_A_ID\",\"day_of_week\":$DAY,\"open_time\":\"07:00:00\",\"close_time\":\"22:00:00\"}" > /dev/null
done
curl -sf -X POST "$BASE_URL/operating-hours" \
    -H "Content-Type: application/json" \
    -H "$AUTH" \
    -d "{\"parking_region_id\":\"$REGION_A_ID\",\"day_of_week\":6,\"open_time\":\"08:00:00\",\"close_time\":\"20:00:00\"}" > /dev/null
echo "Done"

echo ""
echo ""
echo "==> Done! Summary:"
echo "  City Center region ID: $REGION_A_ID"
echo "  Airport region ID:     $REGION_B_ID"
