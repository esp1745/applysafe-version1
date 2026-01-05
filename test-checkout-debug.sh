#!/bin/bash

# ApplySafe Checkout Debug Script

echo "🔍 ApplySafe Checkout Diagnostic"
echo "=================================="
echo ""

# Check if backend is running
echo "1️⃣ Checking if backend server is running..."
if nc -z localhost 3000 2>/dev/null; then
    echo "✅ Backend is listening on localhost:3000"
else
    echo "❌ Backend is NOT listening on localhost:3000"
    echo "   Run: cd backend && node server.js"
    exit 1
fi

echo ""

# Test the endpoint directly
echo "2️⃣ Testing /api/create-checkout endpoint..."
response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/create-checkout \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_1SeNEXRvKQf7z4L6T9GroSYi"}')

http_code=$(echo "$response" | tail -1)
body=$(echo "$response" | head -1)

if [ "$http_code" = "200" ]; then
    echo "✅ Endpoint responding with 200 OK"
    if echo "$body" | grep -q "checkout.stripe.com"; then
        echo "✅ Got valid Stripe checkout URL"
    else
        echo "❌ Response doesn't contain Stripe URL"
        echo "   Response: $body"
    fi
else
    echo "❌ Endpoint returned HTTP $http_code"
    echo "   Response: $body"
fi

echo ""

# Check manifest permissions
echo "3️⃣ Checking manifest for localhost permission..."
if grep -q "http://localhost:3000" applysafe-extension/manifest.json; then
    echo "✅ localhost:3000 is in manifest permissions"
else
    echo "⚠️ localhost:3000 NOT in manifest - this may cause 404 errors!"
    echo "   Add to host_permissions in manifest.json"
fi

echo ""

# Check if extension needs reload
echo "4️⃣ Extension status check..."
echo "⚠️ Ensure you reload the extension after any code changes:"
echo "   1. Go to chrome://extensions/"
echo "   2. Find 'ApplySafe - AI Job Scam Detector'"
echo "   3. Click the reload icon"
echo ""

# Show what to test
echo "5️⃣ Next steps:"
echo "   1. Reload extension (chrome://extensions/)"
echo "   2. Open a job posting page (LinkedIn, Indeed, etc)"
echo "   3. Click the Upgrade button"
echo "   4. Check browser DevTools (F12) → Extensions → ApplySafe"
echo "   5. Check the Service Worker console for logs"
