#!/bin/bash

# ApplySafe User Creation & Database Verification Script

echo "🔍 ApplySafe Database & Authentication Test"
echo "=============================================="
echo ""

# Check if backend is running
echo "1️⃣ Checking if backend is running..."
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "✅ Backend is running on localhost:3000"
else
    echo "❌ Backend is not running!"
    echo "   Run: cd backend && node server.js"
    exit 1
fi

echo ""

# Check MongoDB connection
echo "2️⃣ Checking MongoDB connection..."
health=$(curl -s http://localhost:3000/api/health)
if echo "$health" | grep -q '"mongodb":"connected"'; then
    echo "✅ MongoDB is connected"
elif echo "$health" | grep -q '"mongodb":"disconnected"'; then
    echo "⚠️ MongoDB is disconnected (auth issue)"
    echo "   Connection error will be shown in MongoDB URI config"
else
    echo "❓ MongoDB status unclear"
fi

echo ""

# Test Google Auth Endpoint
echo "3️⃣ Testing Google Auth endpoint..."
auth_response=$(curl -s -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{
    "token": "test-token",
    "email": "test@applysafe.dev",
    "name": "Test User",
    "picture": "https://example.com/avatar.jpg"
  }')

if echo "$auth_response" | grep -q "token"; then
    echo "✅ Auth endpoint working"
    jwt_token=$(echo "$auth_response" | grep -o '"token":"[^"]*"' | cut -d'"' -f4 | head -1)
    echo "   JWT Token: ${jwt_token:0:30}..."
else
    echo "⚠️ Auth endpoint response:"
    echo "   $auth_response"
fi

echo ""

# Test User Profile Endpoint
echo "4️⃣ Testing User Profile endpoint..."
if [ ! -z "$jwt_token" ]; then
    profile=$(curl -s -X GET http://localhost:3000/api/user/profile \
      -H "Authorization: Bearer $jwt_token")
    
    if echo "$profile" | grep -q "email"; then
        echo "✅ Profile endpoint working"
        echo "   Response: $profile" | head -1
    else
        echo "⚠️ Profile endpoint response:"
        echo "   $profile"
    fi
fi

echo ""

# Check what collections exist in MongoDB
echo "5️⃣ MongoDB Collections (via health endpoint)..."
curl -s http://localhost:3000/api/health | jq '.' 2>/dev/null || echo "   (Could not parse health response)"

echo ""

echo "📝 Next Steps:"
echo "1. Sign in through the extension to create a real user"
echo "2. Go to MongoDB Atlas → Cluster1 → Browse Collections"
echo "3. Check the 'users' collection to see created users"
echo "4. User should have: email, name, picture, subscriptionStatus, etc."
echo ""

echo "🧪 To manually verify database:"
echo "   mongo 'mongodb+srv://esparance7_db_user:PASSWORD@cluster1.gaalih.mongodb.net/applysafe' --eval 'db.users.find().pretty()'"
