// ApplySafe Backend - Stripe Subscription Server
const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

// Store license keys in memory (use database in production)
const licenses = new Map();

// Create Stripe Checkout Session
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { priceId, customerId, successUrl, cancelUrl } = req.body;
    
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId || process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: successUrl || 'https://yourdomain.com/success',
      cancel_url: cancelUrl || 'https://yourdomain.com/cancel',
      customer: customerId,
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
      },
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Validate License Key
app.post('/api/validate-license', async (req, res) => {
  try {
    const { licenseKey } = req.body;
    
    const licenseData = licenses.get(licenseKey);
    
    if (licenseData && licenseData.status === 'active') {
      res.json({
        valid: true,
        customerId: licenseData.customerId,
        planName: 'Pro',
      });
    } else {
      res.json({ valid: false });
    }
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Subscription Status
app.post('/api/subscription-status', async (req, res) => {
  try {
    const { customerId, licenseKey } = req.body;
    
    let customer = customerId;
    
    // If license key provided, get customer from license
    if (licenseKey && !customer) {
      const licenseData = licenses.get(licenseKey);
      customer = licenseData?.customerId;
    }
    
    if (!customer) {
      return res.json({ status: 'inactive' });
    }
    
    // Get subscriptions for customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer,
      status: 'all',
      limit: 1,
    });
    
    if (subscriptions.data.length === 0) {
      return res.json({ status: 'inactive' });
    }
    
    const subscription = subscriptions.data[0];
    
    res.json({
      status: subscription.status, // active, canceled, past_due, etc.
      planName: 'Pro',
      renewsAt: subscription.current_period_end * 1000,
      cancelsAt: subscription.cancel_at ? subscription.cancel_at * 1000 : null,
    });
  } catch (error) {
    console.error('Status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cancel Subscription
app.post('/api/cancel-subscription', async (req, res) => {
  try {
    const { customerId } = req.body;
    
    // Get active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    
    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }
    
    const subscription = subscriptions.data[0];
    
    // Cancel at period end (don't cancel immediately)
    const canceled = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });
    
    res.json({
      success: true,
      cancelsAt: canceled.current_period_end * 1000,
    });
  } catch (error) {
    console.error('Cancel error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Stripe Webhook Handler
app.post('/api/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      console.log('Checkout completed:', session.id);
      
      // Generate license key
      const licenseKey = generateLicenseKey();
      licenses.set(licenseKey, {
        customerId: session.customer,
        status: 'active',
        createdAt: Date.now(),
      });
      
      console.log('License created:', licenseKey);
      break;
      
    case 'customer.subscription.updated':
      const updatedSub = event.data.object;
      console.log('Subscription updated:', updatedSub.id, updatedSub.status);
      break;
      
    case 'customer.subscription.deleted':
      const deletedSub = event.data.object;
      console.log('Subscription deleted:', deletedSub.id);
      
      // Deactivate license
      for (const [key, data] of licenses.entries()) {
        if (data.customerId === deletedSub.customer) {
          data.status = 'inactive';
          console.log('License deactivated:', key);
        }
      }
      break;
      
    default:
      console.log(`Unhandled event type: ${event.type}`);
  }
  
  res.json({ received: true });
});

// Generate random license key
function generateLicenseKey() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = '';
  for (let i = 0; i < 4; i++) {
    if (i > 0) key += '-';
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return key;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`ApplySafe backend running on port ${PORT}`);
  console.log(`Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
});
