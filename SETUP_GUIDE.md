# Quick Setup Guide - Stripe Test Mode

## Step 1: Create Stripe Account (2 minutes)

1. Go to https://dashboard.stripe.com/register
2. Sign up with your email
3. **Toggle "Test mode" ON** (top-right corner)

## Step 2: Get Your API Keys (1 minute)

1. Go to: https://dashboard.stripe.com/test/apikeys
2. You'll see two keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`) - Click "Reveal"

## Step 3: Create Test Product (2 minutes)

1. Go to: https://dashboard.stripe.com/test/products
2. Click **"Add product"**
3. Fill in:
   - **Name**: ApplySafe Pro
   - **Description**: Unlimited job scam protection
   - **Price**: $9.99
   - **Billing period**: Monthly
4. Click **"Save product"**
5. Copy the **Price ID** (starts with `price_`)

## Step 4: Setup Backend (2 minutes)

```bash
cd backend

# Copy the example env file
cp .env.example .env

# Edit .env and paste your keys:
# - STRIPE_SECRET_KEY=sk_test_YOUR_KEY
# - STRIPE_PRICE_ID=price_YOUR_PRICE_ID

# Install dependencies
npm install

# Start server
npm start
```

You should see:
```
ApplySafe backend running on port 3000
Stripe configured: true
```

## Step 5: Update Extension (1 minute)

Edit `applysafe-extension/background/subscription.js`:

```javascript
const SUBSCRIPTION_CONFIG = {
  STRIPE_PUBLISHABLE_KEY: 'pk_test_YOUR_KEY_HERE', // Paste your publishable key
  API_ENDPOINT: 'http://localhost:3000/api',
  PRICE_ID: 'price_YOUR_PRICE_ID_HERE' // Paste your price ID
};
```

## Step 6: Test the Extension!

1. **Load extension** in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select `applysafe-extension` folder

2. **Open extension** on any job site (LinkedIn, Indeed, Glassdoor)

3. **See trial banner** - "7 days left • 5 scans remaining today"

4. **Use 5 scans** - Banner updates to show 0 scans left

5. **Click "Upgrade"** - Opens Stripe Checkout

6. **Use test card**:
   - Card: `4242 4242 4242 4242`
   - Expiry: Any future date (e.g., `12/34`)
   - CVC: Any 3 digits (e.g., `123`)
   - ZIP: Any code (e.g., `12345`)

7. **Complete checkout** - Welcome to Pro screen appears!

8. **Extension now has unlimited scans** 🎉

## Test Cards Reference

| Card Number | Behavior |
|------------|----------|
| 4242 4242 4242 4242 | ✅ Success |
| 4000 0000 0000 0002 | ❌ Declined |
| 4000 0027 6000 3184 | 🔐 Requires 3D Secure |

## Verify in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/test/payments
2. You'll see your test payment
3. Go to: https://dashboard.stripe.com/test/subscriptions
4. You'll see the active subscription with 7-day trial

## Troubleshooting

**Backend won't start?**
- Check `.env` file exists (not `.env.example`)
- Verify Stripe keys are correct
- Run `npm install` again

**Checkout not opening?**
- Check backend is running (`http://localhost:3000/health`)
- Check browser console for errors
- Verify API_ENDPOINT in subscription.js

**Trial not starting?**
- Check extension installed correctly
- Open DevTools > Application > Storage
- Should see `subscription` object with trial status

## Going Live

When ready for production:

1. Toggle Stripe to **Live mode**
2. Get **Live API keys** (start with `pk_live_` and `sk_live_`)
3. Create **Live product** (same as test but in live mode)
4. Update extension config with live keys
5. Deploy backend to production (Vercel/Heroku/Railway)
6. Update API_ENDPOINT to production URL

**No code changes needed - just swap the keys!**
