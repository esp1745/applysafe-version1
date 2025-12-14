# ApplySafe Backend - Stripe Subscription Server

Simple Node.js backend for handling Stripe subscriptions.

## Setup

1. **Install dependencies:**
```bash
npm install express stripe cors dotenv
```

2. **Create `.env` file:**
```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PRICE_ID=price_your_stripe_price_id
PORT=3000
```

3. **Run server:**
```bash
node server.js
```

## API Endpoints

### POST `/api/create-checkout`
Create Stripe Checkout session for subscription

**Request:**
```json
{
  "priceId": "price_xxx",
  "customerId": "cus_xxx" (optional)
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/..."
}
```

### POST `/api/validate-license`
Validate license key (for manual activation)

**Request:**
```json
{
  "licenseKey": "xxx-xxx-xxx"
}
```

**Response:**
```json
{
  "valid": true,
  "customerId": "cus_xxx"
}
```

### POST `/api/subscription-status`
Get current subscription status

**Request:**
```json
{
  "customerId": "cus_xxx"
}
```

**Response:**
```json
{
  "status": "active",
  "planName": "Pro",
  "renewsAt": 1704067200000
}
```

### POST `/api/cancel-subscription`
Cancel subscription

**Request:**
```json
{
  "customerId": "cus_xxx"
}
```

**Response:**
```json
{
  "success": true,
  "cancelsAt": 1704067200000
}
```

### POST `/api/webhook`
Stripe webhook for payment events (subscription created, canceled, etc.)

## Stripe Dashboard Setup

1. Create product "ApplySafe Pro"
2. Create price (e.g., $9.99/month)
3. Copy Price ID to `.env`
4. Add webhook endpoint: `https://your-domain.com/api/webhook`
5. Subscribe to events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

## Deployment

**Quick Options:**
- **Vercel**: Deploy serverless functions
- **Heroku**: `git push heroku main`
- **Railway**: Connect GitHub repo
- **Render**: Auto-deploy from GitHub

## Testing

Use Stripe test cards:
- Success: `4242 4242 4242 4242`
- Decline: `4000 0000 0000 0002`
