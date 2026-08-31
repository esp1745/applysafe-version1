// ApplySafe Backend - Stripe Subscription Server
require('dotenv').config(); // Load .env FIRST

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const Anthropic = require('@anthropic-ai/sdk');
const sequelize = require('./database');
const User = require('./models/User');
const UserData = require('./models/UserData');

const app = express();

let scoreJobPosting = null;
let mlLoadAttempted = false;

function getScoreJobPosting() {
  if (scoreJobPosting || mlLoadAttempted) {
    return scoreJobPosting;
  }

  mlLoadAttempted = true;

  try {
    ({ scoreJobPosting } = require('./ml/predict'));
  } catch (error) {
    console.warn('ML classifier unavailable, continuing without ONNX scoring:', error.message);
    scoreJobPosting = null;
  }

  return scoreJobPosting;
}

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>ApplySafe Backend</title>
        <style>
          :root {
            color-scheme: light;
            --bg: #f4f8ff;
            --card: rgba(255, 255, 255, 0.92);
            --text: #10224f;
            --muted: #5f7196;
            --border: rgba(16, 34, 79, 0.12);
            --accent: #16d7c0;
            --accent-dark: #0f2f78;
          }
          * { box-sizing: border-box; }
          body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            font-family: "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif;
            background:
              radial-gradient(circle at top left, rgba(79, 156, 255, 0.25), transparent 38%),
              radial-gradient(circle at right center, rgba(22, 215, 192, 0.22), transparent 32%),
              linear-gradient(180deg, #eef5ff 0%, var(--bg) 100%);
            color: var(--text);
          }
          .card {
            width: min(720px, 100%);
            padding: 32px;
            border-radius: 28px;
            background: var(--card);
            border: 1px solid var(--border);
            box-shadow: 0 24px 80px rgba(15, 47, 120, 0.12);
          }
          .eyebrow {
            display: inline-flex;
            align-items: center;
            gap: 10px;
            padding: 8px 14px;
            border-radius: 999px;
            background: rgba(22, 215, 192, 0.12);
            color: var(--accent-dark);
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .dot {
            width: 10px;
            height: 10px;
            border-radius: 999px;
            background: var(--accent);
          }
          h1 {
            margin: 18px 0 12px;
            font-size: clamp(32px, 5vw, 48px);
            line-height: 1;
          }
          p {
            margin: 0;
            font-size: 16px;
            line-height: 1.6;
            color: var(--muted);
          }
          .links {
            margin-top: 26px;
            display: grid;
            gap: 12px;
          }
          a {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 14px 16px;
            border-radius: 16px;
            text-decoration: none;
            color: var(--accent-dark);
            background: rgba(255, 255, 255, 0.85);
            border: 1px solid rgba(16, 34, 79, 0.1);
            font-weight: 600;
          }
          a span {
            color: var(--muted);
            font-size: 14px;
            font-weight: 500;
          }
        </style>
      </head>
      <body>
        <main class="card">
          <div class="eyebrow"><span class="dot"></span>ApplySafe Backend</div>
          <h1>Backend is running</h1>
          <p>
            This Vercel deployment powers the Chrome extension API for auth, analysis,
            subscriptions, and diagnostics.
          </p>
          <div class="links">
            <a href="/api/health">Health status <span>/api/health</span></a>
            <a href="/api/ai-status">AI status <span>/api/ai-status</span></a>
            <a href="/success">Checkout success page <span>/success</span></a>
            <a href="/cancel">Checkout cancel page <span>/cancel</span></a>
          </div>
        </main>
      </body>
    </html>
  `);
});

// Initialize Stripe AFTER environment variables are loaded
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Anthropic Claude client (API key stored securely in environment)
const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// Connect to Postgres (Supabase)
let dbReady = false;

function getDatabaseTroubleshootingHint(error) {
  const message = error?.message || '';

  if (/tenant\/user .* not found/i.test(message) || /tenant or user not found/i.test(message)) {
    return [
      'Supabase pooler rejected the tenant/user.',
      'Re-copy the exact connection string from Supabase Dashboard > Connect.',
      'For pooler URLs, the username must be in the form postgres.[project-ref].',
      'If your database password contains special characters, URL-encode it or reset it to a simpler password before rebuilding the URI.',
      'If the exact dashboard string still fails on both ports 5432 and 6543, restart the Supabase project and check Supabase support for a stuck pooler tenant.'
    ].join(' ');
  }

  return '';
}

async function connectToDatabase() {
  if (dbReady) {
    return sequelize;
  }

  try {
    await sequelize.authenticate();
    await sequelize.sync();
    dbReady = true;
    console.log(' Connected to Postgres (Supabase)');
    return sequelize;
  } catch (err) {
    console.error(' Postgres connection error:', err.message);
    const dbHint = getDatabaseTroubleshootingHint(err);
    if (dbHint) {
      console.error(' Supabase hint:', dbHint);
    }
    dbReady = false;
    throw err;
  }
}

// Store license keys and users in memory
const licenses = new Map();
const userUsage = new Map();

// =====================================
// DEBUG/HEALTH ENDPOINTS
// =====================================

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let connectionError = null;

  if (!dbReady) {
    try {
      await connectToDatabase();
    } catch (err) {
      connectionError = err.message;
    }
  }

  res.json({
    status: dbReady ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    postgres: dbReady ? 'connected' : 'disconnected',
    connectionError: connectionError,
    anthropic: !!anthropic,
    stripe: !!process.env.STRIPE_SECRET_KEY
  });
});

// =====================================
// CLAUDE AI ANALYSIS PROXY ENDPOINT
// =====================================

// Analyze job posting using Claude AI
app.post('/api/analyze-job', async (req, res) => {
  try {
    const { jobData, prompt } = req.body;
    
    // Check if Anthropic is configured
    if (!anthropic) {
      console.log('Anthropic API not configured, returning fallback');
      return res.status(503).json({ 
        error: 'AI analysis not available',
        fallback: true,
        message: 'Please use heuristic analysis'
      });
    }
    
    // Validate request
    if (!jobData && !prompt) {
      return res.status(400).json({ error: 'Missing jobData or prompt' });
    }
    
    // Rate limiting check (optional - can be enhanced)
    // For now, we'll rely on subscription checks
    
    console.log('Processing AI analysis request for:', jobData?.title || 'custom prompt');

    // Score with our custom-trained classifier as an extra signal for Claude.
    // Not used as a standalone verdict - it false-positives on the short,
    // sparsely-scraped postings the extension typically produces, since it
    // was trained on a richer schema (company_profile, requirements, etc.)
    // than the extension scrapes.
    let mlScore = null;
    if (jobData && !prompt) {
      try {
        const scoreJobPostingFn = getScoreJobPosting();
        if (scoreJobPostingFn) {
          const result = await scoreJobPostingFn(jobData);
          mlScore = result.probability;
          console.log('ML classifier score:', mlScore.toFixed(4));
        } else {
          console.log('ML classifier not available, skipping ONNX score');
        }
      } catch (mlError) {
        console.error('ML scoring failed (continuing with Claude only):', mlError.message);
      }
    }

    // Call Claude API
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: prompt || buildAnalysisPrompt(jobData, mlScore)
      }]
    });
    
    // Extract response
    const responseText = message.content[0].text;
    
    console.log('AI analysis completed successfully');
    
    // Parse the JSON response from Claude
    let analysis;
    try {
      // Extract JSON from the response (Claude might include extra text)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
        // Add timestamp
        analysis.timestamp = Date.now();
        analysis.aiAnalyzed = true;
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError.message);
      // Return a basic structure if parsing fails
      analysis = {
        riskScore: 30,
        jobTitle: jobData.title || 'Unknown',
        company: jobData.company || 'Unknown',
        redFlags: ['Unable to fully analyze posting'],
        positiveIndicators: [],
        explanation: responseText.substring(0, 200),
        timestamp: Date.now(),
        aiAnalyzed: false
      };
    }
    
    res.json({
      success: true,
      analysis: analysis,
      mlScore: mlScore,
      usage: {
        input_tokens: message.usage?.input_tokens,
        output_tokens: message.usage?.output_tokens
      }
    });
    
  } catch (error) {
    console.error('AI analysis error:', error.message);
    
    // Handle specific Anthropic errors
    if (error.status === 429) {
      return res.status(429).json({ error: 'Rate limit exceeded', fallback: true });
    }
    if (error.status === 401) {
      return res.status(500).json({ error: 'AI service configuration error', fallback: true });
    }
    
    res.status(500).json({ 
      error: error.message || 'AI analysis failed',
      fallback: true
    });
  }
});

// Helper function to build analysis prompt
function buildAnalysisPrompt(jobData, mlScore) {
  const mlContext = mlScore === null || mlScore === undefined
    ? ''
    : `
INTERNAL ML CLASSIFIER SIGNAL (advisory only, do not defer to it):
Our custom-trained classifier scored this posting ${Math.round(mlScore * 100)}% likely fraudulent.
This classifier was trained on postings with rich structured metadata (company profile, listed
requirements/benefits, logo presence) that this scraped posting mostly lacks, so it is KNOWN to
false-positive on short/sparse-but-legitimate postings, and to miss scams involving check-cashing,
money orders, or wire-transfer-via-Western-Union schemes (patterns absent from its training data).
Treat this score as one weak, unreliable hint alongside your own independent read of the text below
- do not let a high score override your judgment on an otherwise clean, ordinary posting, and do not
let a low score wave through language matching check/wire-transfer scam patterns.
`;

  return `You are an expert job scam detector. Analyze this job posting and provide a balanced risk assessment.

JOB POSTING DATA:
Title: ${jobData.title || 'Not provided'}
Company: ${jobData.company || 'Not provided'}
Location: ${jobData.location || 'Not provided'}
Salary: ${jobData.salary || 'Not provided'}
Description: ${(jobData.description || '').substring(0, 3000)}

Contact Emails Found: ${(jobData.contactEmail || []).join(', ') || 'None'}
Company Domain: ${jobData.companyDomain || 'Unknown'}
${mlContext}
SCORING GUIDELINES:
- Well-known companies (Fortune 500, major tech, consulting firms like TCS, Infosys, Accenture, Google, Amazon, Microsoft, etc.) should score 5-20 unless there are CRITICAL red flags
- Missing salary is NORMAL for many legitimate jobs - do NOT heavily penalize this
- Only flag "vague responsibilities" if truly unusable, not just brief

CRITICAL SCAM INDICATORS (High Risk - Score 60+):
1. Requests for upfront payment, fees, or "investment"
2. Requests for personal banking info or SSN before hiring
3. "Too good to be true" salary/benefits for entry-level work
4. Generic email domains (gmail, yahoo) for business communication from supposedly large companies
5. No verifiable company information or website
6. Pressure tactics ("act now", "limited positions")
7. Work-from-home schemes promising unrealistic income

MINOR CONCERNS (Low impact on score):
1. Missing salary information (common and normal)
2. Brief job description (not necessarily bad)
3. Standard corporate language

POSITIVE INDICATORS (Significantly reduce risk):
1. Well-known, established company (-20 to -30 points)
2. Verifiable company with working website
3. Professional email domain matching company
4. Clear job requirements
5. Standard interview process mentioned
6. Company has H-1B sponsorship history (major trust signal)

IMPORTANT: Avoid contradictions! If salary is missing, do NOT also say "reasonable salary". Only include indicators you can actually verify from the posting.

RESPOND IN THIS EXACT JSON FORMAT:
{
  "riskScore": <number 0-100>,
  "jobTitle": "<extracted job title>",
  "company": "<extracted company name>",
  "redFlags": ["<only include if there are genuine concerns>"],
  "positiveIndicators": ["<only include what you can verify from the posting>"],
  "explanation": "<2-3 sentence summary>"
}

Most legitimate postings from known companies should score 5-25. Reserve 30+ for actual concerns.`;
}

// Health check endpoint for AI service
app.get('/api/ai-status', (req, res) => {
  res.json({
    aiEnabled: !!anthropic,
    model: 'claude-haiku-4-5-20251001',
    status: anthropic ? 'ready' : 'not configured'
  });
});

// =====================================
// STRIPE & AUTH ENDPOINTS
// =====================================

// Create Stripe Checkout Session
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { priceId, customerId, customerEmail } = req.body;
    
    // Generate unique session ID for tracking
    const clientReferenceId = `ext_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Build session config
    const sessionConfig = {
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId || process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `https://esp1745-applysafe-version1.vercel.app/api/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://esp1745-applysafe-version1.vercel.app/api/cancel`,
      client_reference_id: clientReferenceId,
      subscription_data: {
        trial_period_days: 7, // 7-day free trial
      },
      // Disable saved payment methods to prevent showing previous customer's info
      saved_payment_method_options: {
        payment_method_save: 'disabled',
      },
    };
    
    // Only add customer if it exists (not null/undefined/empty)
    if (customerId && customerId.trim()) {
      sessionConfig.customer = customerId;
    } else if (customerEmail && customerEmail.trim()) {
      // If no customer ID but email provided, use email
      sessionConfig.customer_email = customerEmail;
    }
    
    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.json({ url: session.url, sessionId: session.id, clientReferenceId });
  } catch (error) {
    console.error('Checkout error details:', {
      message: error.message,
      type: error.type,
      code: error.code,
      stack: error.stack,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      priceId: req.body.priceId || process.env.STRIPE_PRICE_ID
    });
    res.status(500).json({ 
      error: error.message,
      details: error.type || 'Unknown error',
      configured: !!process.env.STRIPE_SECRET_KEY
    });
  }
});

// Get Checkout Session Details
app.get('/api/get-session', async (req, res) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({ error: 'session_id required' });
    }
    
    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    res.json({
      customerId: session.customer,
      subscriptionId: session.subscription,
      status: session.status,
      paymentStatus: session.payment_status
    });
  } catch (error) {
    console.error('Get session error:', error);
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
    const { customerId, licenseKey, email } = req.body;
    
    let customer = customerId;
    let userFromDb = null;
    
    // If license key provided, get customer from license
    if (licenseKey && !customer) {
      const licenseData = licenses.get(licenseKey);
      customer = licenseData?.customerId;
    }
    
    // If no customer ID but email provided, look up user in Postgres
    if (!customer && email) {
      try {
        userFromDb = await User.findOne({ where: { email } });
        if (userFromDb && userFromDb.stripeCustomerId) {
          customer = userFromDb.stripeCustomerId;
          console.log('Found customer by email:', email, customer);
        } else if (userFromDb && userFromDb.subscriptionStatus === 'active') {
          // User marked active in DB but no Stripe customer - return active
          console.log('User marked active in DB without Stripe customer:', email);
          return res.json({
            status: 'active',
            planName: 'Pro',
            renewsAt: null,
            cancelsAt: null,
            stripeCustomerId: userFromDb.stripeCustomerId
          });
        }
      } catch (dbError) {
        console.error('Postgres lookup error:', dbError.message);
        // Continue without DB lookup
      }
    }
    
    // If still no customer but have email, try to find Stripe customer directly by email
    if (!customer && email) {
      try {
        const customers = await stripe.customers.list({ email: email, limit: 1 });
        if (customers.data.length > 0) {
          customer = customers.data[0].id;
          console.log('Found Stripe customer by email directly:', email, customer);
        }
      } catch (stripeError) {
        console.error('Stripe customer lookup error:', stripeError.message);
      }
    }
    
    if (!customer) {
      console.log('No customer found for subscription-status:', { customerId, email });
      return res.json({ status: 'inactive' });
    }
    
    // Get subscriptions for customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer,
      status: 'all',
      limit: 1,
    });
    
    if (subscriptions.data.length === 0) {
      return res.json({ status: 'inactive', stripeCustomerId: customer });
    }
    
    const subscription = subscriptions.data[0];
    
    // Treat 'trialing' as 'active' for extension compatibility
    let mappedStatus = subscription.status;
    if (mappedStatus === 'trialing') mappedStatus = 'active';
    res.json({
      status: mappedStatus, // active, canceled, past_due, etc.
      planName: 'Pro',
      renewsAt: subscription.current_period_end * 1000,
      cancelsAt: subscription.cancel_at ? subscription.cancel_at * 1000 : null,
      stripeCustomerId: customer
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

      // Update user subscription status to active in Postgres
      let user = await User.findOne({ where: { stripeCustomerId: session.customer } });
      if (!user && session.customer_email) {
        user = await User.findOne({ where: { email: session.customer_email } });
      }
      if (user) {
        user.subscriptionStatus = 'active';
        user.stripeCustomerId = session.customer;
        await user.save();
        console.log('User subscription activated:', user.email);
      } else {
        console.warn('No user found to activate for customer:', session.customer, session.customer_email);
      }
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

// Success redirect - shows HTML page that can be detected by extension
app.get('/success', async (req, res) => {
  const sessionId = req.query.session_id;
  
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Successful - ApplySafe</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          .container {
            background: white;
            padding: 60px 48px;
            border-radius: 20px;
            box-shadow: 0 25px 70px rgba(0,0,0,0.3);
            text-align: center;
            max-width: 480px;
            width: 100%;
            animation: slideUp 0.5s ease-out;
          }
          @keyframes slideUp {
            from {
              opacity: 0;
              transform: translateY(30px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          .checkmark {
            width: 90px;
            height: 90px;
            border-radius: 50%;
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            margin: 0 auto 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 56px;
            color: white;
            font-weight: 300;
            box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);
            animation: checkPop 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55) 0.2s both;
          }
          @keyframes checkPop {
            0% { transform: scale(0); }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); }
          }
          h1 { 
            color: #111827; 
            margin: 0 0 16px;
            font-size: 32px;
            font-weight: 700;
            letter-spacing: -0.5px;
          }
          p { 
            color: #6b7280; 
            margin: 0 0 32px; 
            line-height: 1.6;
            font-size: 16px;
          }
          .features {
            background: #f9fafb;
            border-radius: 12px;
            padding: 24px;
            margin-bottom: 32px;
            text-align: left;
          }
          .feature {
            display: flex;
            align-items: center;
            padding: 12px 0;
            color: #374151;
            font-size: 15px;
            line-height: 1.5;
          }
          .feature:not(:last-child) {
            border-bottom: 1px solid #e5e7eb;
          }
          .feature::before {
            content: '✓';
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            background: #10b981;
            color: white;
            border-radius: 50%;
            font-size: 14px;
            font-weight: 700;
            margin-right: 12px;
            flex-shrink: 0;
          }
          button {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            padding: 14px 40px;
            border-radius: 10px;
            font-size: 16px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          }
          button:hover { 
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
          }
          button:active {
            transform: translateY(0);
          }
          .note {
            margin-top: 24px;
            color: #9ca3af;
            font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="checkmark">✓</div>
          <h1>Payment Successful!</h1>
          <p>Your ApplySafe Pro subscription is now active</p>
          <div class="features">
            <div class="feature">Unlimited job scans with AI analysis</div>
            <div class="feature">Real-time H1B visa sponsor verification</div>
            <div class="feature">Complete job history and analytics</div>
            <div class="feature">Priority support from our team</div>
          </div>
          <button onclick="closeTab()">Close This Tab</button>
          <div class="note">Press Cmd+W (Mac) or Ctrl+W (Windows) to close</div>
        </div>
        <script>
          // Try multiple methods to close the tab
          function closeTab() {
            // Method 1: window.close() - works if opened by script
            window.close();
            
            // Method 2: Show instructions if close failed
            setTimeout(() => {
              alert('Press Cmd+W (Mac) or Ctrl+W (Windows) to close this tab');
            }, 100);
          }
          
          // Store success data in localStorage for extension to read
          try {
            const successData = {
              type: 'APPLYSAFE_PAYMENT_SUCCESS',
              sessionId: '${sessionId}',
              customerId: '${session.customer}',
              timestamp: Date.now()
            };
            localStorage.setItem('applysafe_payment_success', JSON.stringify(successData));
            
            // Also try to communicate with extension if it's monitoring
            if (window.chrome && chrome.runtime) {
              chrome.runtime.sendMessage('YOUR_EXTENSION_ID', successData);
            }
          } catch (e) {
            console.log('Extension communication not available');
          }
          
          // Auto-attempt close after 3 seconds
          setTimeout(() => {
            window.close();
          }, 3000);
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error retrieving session');
  }
});

// Cancel redirect
app.get('/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Cancelled - ApplySafe</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
          margin: 0;
          background: #f3f4f6;
        }
        .container {
          background: white;
          padding: 48px;
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          text-align: center;
          max-width: 400px;
        }
        h1 { color: #1f2937; margin: 0 0 12px; }
        p { color: #6b7280; margin: 0 0 24px; line-height: 1.6; }
        button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 32px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          font-weight: 600;
        }
        button:hover { background: #2563eb; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Payment Cancelled</h1>
        <p>You can return to ApplySafe and try again whenever you're ready.</p>
        <button onclick="window.close()">Close Tab</button>
      </div>
    </body>
    </html>
  `);
});

// ============================================
// Authentication Endpoints
// ============================================

// Verify Google token and create/login user
app.post('/api/auth/google', async (req, res) => {
  try {
    const { googleToken, email, name, picture } = req.body;

    console.log('🔐 Auth request received:', { email, name, hasToken: !!googleToken });
    console.log('🔑 GOOGLE_CLIENT_ID configured:', process.env.GOOGLE_CLIENT_ID ? 'YES' : 'NO');

    // Verify Google token - try as ID token first, then as access token
    let googleId;
    let verifiedEmail = email;
    
    try {
      // Try verifying as ID token first
      console.log('🔍 Attempting ID token verification...');
      const ticket = await googleClient.verifyIdToken({
        idToken: googleToken,
        audience: process.env.GOOGLE_CLIENT_ID
      });
      const payload = ticket.getPayload();
      googleId = payload['sub'];
      verifiedEmail = payload['email'];
      console.log('✅ ID token verified:', verifiedEmail);
    } catch (idTokenError) {
      // If ID token verification fails, try as access token
      console.log('❌ ID token verification failed:', idTokenError.message);
      console.log('🔍 Attempting access token verification...');
      try {
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${googleToken}` }
        });
        
        console.log('📡 Google userinfo response status:', userInfoResponse.status);
        
        if (!userInfoResponse.ok) {
          const errorText = await userInfoResponse.text();
          console.error('❌ Google userinfo error:', errorText);
          throw new Error('Failed to verify access token');
        }
        
        const userInfo = await userInfoResponse.json();
        googleId = userInfo.id;
        verifiedEmail = userInfo.email;
        
        console.log('✅ Access token verified:', verifiedEmail);
        
        // Verify the email matches what was sent
        if (verifiedEmail !== email) {
          console.error('❌ Email mismatch:', { sent: email, verified: verifiedEmail });
          throw new Error('Email mismatch');
        }
      } catch (accessTokenError) {
        console.error('❌ Both token verification methods failed');
        console.error('ID token error:', idTokenError.message);
        console.error('Access token error:', accessTokenError.message);
        throw new Error('Invalid token');
      }
    }

    // Find or create user in Postgres
    await connectToDatabase();
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // Create new user
      user = User.build({
        googleId,
        email,
        name,
        picture,
        subscriptionStatus: 'free',
        trialStartDate: new Date()
      });
      await user.save();
      console.log('✅ New user created in Postgres:', { email, name });
    } else {
      // Update existing user with latest info
      user.name = name;
      user.picture = picture;
      user.googleId = googleId;
      await user.save();
      console.log('✅ User updated in Postgres:', { email, name });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ JWT generated for:', email);

    res.json({
      success: true,
      userId: user.id,
      token,
      subscriptionStatus: user.subscriptionStatus,
      trialInfo: getUserTrialInfo(user)
    });

  } catch (error) {
    console.error('❌ Auth error:', error);
    res.status(401).json({ error: 'Authentication failed', message: error.message });
  }
});

// Simple Email Authentication Endpoint
app.post('/api/auth/email', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    console.log('📧 Email auth request:', { email, name });
    
    // Ensure database connection
    await connectToDatabase();

    // Find or create user in Postgres
    let user = await User.findOne({ where: { email } });

    if (!user) {
      // Create new user
      user = await User.create({
        email,
        name: name || email.split('@')[0],
        authProvider: 'email',
        subscriptionStatus: 'trial',
        trialStartDate: new Date()
      });
      console.log('✅ New user created:', email);
    } else {
      // Update last login
      user.lastLogin = new Date();
      user.loginCount = (user.loginCount || 0) + 1;
      await user.save();
      console.log('✅ User login updated:', email);
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log('✅ JWT generated for:', email);

    res.json({
      success: true,
      userId: user.id,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      subscriptionStatus: user.subscriptionStatus,
      trialInfo: { trialDaysLeft: 14 }
    });

  } catch (error) {
    console.error('❌ Email auth error:', error);
    res.status(500).json({ error: 'Authentication failed', message: error.message });
  }
});

// Middleware to verify JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.userId = decoded.userId;
    req.userEmail = decoded.email;
    next();
  });
}

// Check if user can use a feature
app.post('/api/usage/check', authenticateToken, async (req, res) => {
  try {
    const { feature } = req.body;
    const userId = req.userId;

    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Pro users have unlimited access
    if (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'pro') {
      await incrementUserUsage(userId);
      return res.json({
        allowed: true,
        reason: 'pro_subscription',
        scansLeft: -1, // unlimited
        isPro: true
      });
    }

    // Check trial status
    const trialInfo = getUserTrialInfo(user);
    if (!trialInfo.isTrialActive) {
      return res.json({
        allowed: false,
        reason: 'trial_expired',
        message: 'Your 7-day trial has expired. Upgrade to Pro for unlimited scans.',
        daysLeft: 0,
        scansLeft: 0
      });
    }

    // Check daily limit
    const usage = userUsage.get(userId);
    const today = new Date().toDateString();
    
    if (usage.lastScanDate !== today) {
      // Reset daily count
      usage.dailyScans = 0;
      usage.lastScanDate = today;
    }

    if (usage.dailyScans >= 10) {
      return res.json({
        allowed: false,
        reason: 'daily_limit_reached',
        message: 'Daily limit of 10 scans reached. Upgrade to Pro or try again tomorrow.',
        scansLeft: 0,
        daysLeft: trialInfo.daysLeft
      });
    }

    // Allow usage and increment count
    usage.dailyScans++;
    usage.totalScans++;

    res.json({
      allowed: true,
      reason: 'free_trial',
      scansLeft: 10 - usage.dailyScans,
      daysLeft: trialInfo.daysLeft,
      isPro: false,
      scansToday: usage.dailyScans
    });

  } catch (error) {
    console.error('Usage check error:', error);
    res.status(500).json({ error: 'Failed to check usage' });
  }
});

// Get user profile and usage stats
app.get('/api/user/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = users.get(userId);
    const usage = userUsage.get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const trialInfo = getUserTrialInfo(user);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture
      },
      subscription: {
        status: user.subscriptionStatus,
        customerId: user.customerId
      },
      trial: trialInfo,
      usage: {
        today: usage.dailyScans,
        total: usage.totalScans
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// Upgrade user to Pro
app.post('/api/user/upgrade', authenticateToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = users.get(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{
        price: process.env.STRIPE_PRICE_ID,
        quantity: 1,
      }],
      success_url: `https://esp1745-applysafe-version1.vercel.app/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://esp1745-applysafe-version1.vercel.app/cancel`,
      client_reference_id: userId,
      customer_email: user.email,
      metadata: {
        userId: userId
      }
    });

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

// Helper functions for user management
function getUserTrialInfo(user) {
  const trialStartDate = user.trialStartDate || user.createdAt;
  const daysElapsed = Math.floor((Date.now() - trialStartDate) / (1000 * 60 * 60 * 24));
  const isTrialActive = daysElapsed < 7;

  return {
    isTrialActive,
    daysLeft: Math.max(0, 7 - daysElapsed),
    trialStartDate
  };
}

async function incrementUserUsage(userId) {
  const usage = userUsage.get(userId);
  if (usage) {
    usage.totalScans++;
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Debug endpoint to check configuration
app.get('/api/debug', (req, res) => {
  res.json({
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    stripeKeyPrefix: process.env.STRIPE_SECRET_KEY?.substring(0, 10),
    priceIdConfigured: !!process.env.STRIPE_PRICE_ID,
    priceId: process.env.STRIPE_PRICE_ID,
    nodeEnv: process.env.NODE_ENV
  });
});

// Success redirect - shows success page
app.get('/api/success', (req, res) => {
  const sessionId = req.query.session_id;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Successful - ApplySafe</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #10B981, #059669); }
        .container { background: white; padding: 40px; border-radius: 12px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.2); max-width: 500px; }
        h1 { color: #10B981; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; }
        .checkmark { font-size: 64px; color: #10B981; margin-bottom: 20px; }
        button { background: #10B981; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; margin-top: 20px; }
        button:hover { background: #059669; }
        .ext-link { background: #059669; margin-left: 10px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="checkmark">✓</div>
        <h1>Payment Successful!</h1>
        <p>Welcome to ApplySafe Pro! Your subscription is now active.</p>
        <p>You now have unlimited scans and access to all premium features.</p>
        <p><small>Session ID: ${sessionId}</small></p>
        <button onclick="window.close()">Close This Tab</button>
        <div style="margin-top: 24px;">
          <strong>Next Steps:</strong>
          <p style="margin: 12px 0 0 0;">Your payment was successful!<br>
          Please return to the <b>ApplySafe extension popup</b> in your browser to access your Pro features.</p>
          <p style="font-size: 0.95em; color: #666; margin-top: 10px;">Click the ApplySafe icon in your browser toolbar to open the extension.</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Cancel redirect
app.get('/api/cancel', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payment Cancelled - ApplySafe</title>
      <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f3f4f6; }
        .container { background: white; padding: 40px; border-radius: 12px; text-center; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 500px; }
        h1 { color: #ef4444; margin-bottom: 20px; }
        p { color: #666; line-height: 1.6; }
        button { background: #6b7280; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; font-size: 16px; margin-top: 20px; }
        button:hover { background: #4b5563; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Payment Cancelled</h1>
        <p>Your payment was cancelled. No charges were made.</p>
        <p>You can try again anytime from the ApplySafe extension.</p>
        <button onclick="window.close()">Close This Tab</button>
      </div>
    </body>
    </html>
  `);
});

// =====================================
// V3 API ENDPOINTS - Cloud Sync & AI Features
// =====================================

// Middleware to verify user authentication
const verifyUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findOne({ where: { email: decoded.email } });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Sync user data (applications & reminders)
app.post('/api/v3/sync', verifyUser, async (req, res) => {
  try {
    const { applications, reminders, scanHistory, lastSync } = req.body;
    const userId = req.user.id;

    console.log('📥 Sync request from user:', userId, {
      applications: applications?.length || 0,
      reminders: reminders?.length || 0,
      scanHistory: scanHistory?.length || 0
    });

    // Get or create user data row
    let userData = await UserData.findOne({ where: { userId } });

    if (!userData) {
      // First sync - save everything
      await UserData.create({
        userId,
        applications: applications || [],
        reminders: reminders || [],
        scanHistory: scanHistory || [],
        lastSync: new Date()
      });

      return res.json({
        success: true,
        message: 'Initial sync complete',
        data: {
          applications: applications || [],
          reminders: reminders || [],
          scanHistory: scanHistory || []
        }
      });
    }

    // Merge data - prefer newer items
    const mergedApps = mergeArrays(userData.applications || [], applications || [], 'id');
    const mergedReminders = mergeArrays(userData.reminders || [], reminders || [], 'id');
    const mergedScanHistory = mergeArrays(userData.scanHistory || [], scanHistory || [], 'url');

    console.log('✅ Merged data:', {
      applications: mergedApps.length,
      reminders: mergedReminders.length,
      scanHistory: mergedScanHistory.length
    });

    // Update database
    userData.applications = mergedApps;
    userData.reminders = mergedReminders;
    userData.scanHistory = mergedScanHistory;
    userData.lastSync = new Date();
    await userData.save();

    res.json({
      success: true,
      message: 'Sync complete',
      data: {
        applications: mergedApps,
        reminders: mergedReminders,
        scanHistory: mergedScanHistory
      }
    });
  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
});

// Get synced data
app.get('/api/v3/sync', verifyUser, async (req, res) => {
  try {
    const userId = req.user.id;
    const userData = await UserData.findOne({ where: { userId } });

    res.json({
      success: true,
      data: {
        applications: userData?.applications || [],
        reminders: userData?.reminders || [],
        scanHistory: userData?.scanHistory || [],
        lastSync: userData?.lastSync
      }
    });
  } catch (error) {
    console.error('Get sync error:', error);
    res.status(500).json({ error: 'Failed to get data' });
  }
});

// Helper function to merge arrays
function mergeArrays(existing, incoming, idField) {
  const map = new Map();
  
  // Add existing items
  existing.forEach(item => map.set(item[idField], item));
  
  // Merge/overwrite with incoming items (prefer newer)
  incoming.forEach(item => {
    const existingItem = map.get(item[idField]);
    if (!existingItem || new Date(item.updatedAt || item.createdAt) > new Date(existingItem.updatedAt || existingItem.createdAt)) {
      map.set(item[idField], item);
    }
  });
  
  return Array.from(map.values());
}

// Generate cover letter with AI
app.post('/api/v3/generate-cover-letter', verifyUser, async (req, res) => {
  try {
    // Support both parameter formats (new: skills/tone, old: userSkills/jobTitle/company)
    const { jobDescription, skills, userSkills, tone, jobTitle, company } = req.body;
    const candidateSkills = skills || userSkills || '';
    
    if (!anthropic) {
      return res.status(503).json({ error: 'AI service not available' });
    }
    
    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description is required' });
    }
    
    // Check Stripe for actual subscription status
    let hasProSubscription = false;
    try {
      const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
      if (customers.data.length > 0) {
        const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, limit: 1 });
        if (subs.data.length > 0 && subs.data[0].status === 'active') {
          hasProSubscription = true;
        }
      }
    } catch (stripeError) {
      console.log('Could not check Stripe:', stripeError.message);
    }
    
    if (!hasProSubscription) {
      return res.status(403).json({ error: 'Pro subscription required', message: 'Upgrade to Pro to use AI features' });
    }
    
    const toneInstructions = {
      professional: 'Use formal, professional language.',
      friendly: 'Use warm, approachable language while remaining professional.',
      confident: 'Use assertive, confident language that highlights achievements.',
      enthusiastic: 'Use energetic, passionate language showing excitement about the role.'
    };
    
    const prompt = `Write a compelling cover letter for this job posting. ${toneInstructions[tone] || toneInstructions.professional}

${jobTitle ? `JOB TITLE: ${jobTitle}` : ''}
${company ? `COMPANY: ${company}` : ''}

JOB DESCRIPTION:
${jobDescription}

${candidateSkills ? `CANDIDATE'S KEY SKILLS:\n${candidateSkills}` : ''}

Write a 3-4 paragraph cover letter that:
1. Opens with a strong hook showing genuine interest
2. Highlights relevant skills and experience that match the job requirements
3. Shows understanding of the company/role
4. Ends with a confident call to action

Do NOT use generic phrases like "I am writing to express my interest" or "I am a hard worker".
Make it specific, compelling, and tailored to the job.`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
    
    res.json({
      success: true,
      coverLetter: message.content[0].text
    });
  } catch (error) {
    console.error('Cover letter error:', error);
    res.status(500).json({ error: 'Failed to generate cover letter' });
  }
});

// Analyze resume match with job description
app.post('/api/v3/analyze-resume', verifyUser, async (req, res) => {
  try {
    const { resumeText, jobDescription } = req.body;
    
    if (!anthropic) {
      return res.status(503).json({ error: 'AI service not available' });
    }
    
    // Check Stripe for actual subscription status
    let hasProSubscription = false;
    try {
      const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
      if (customers.data.length > 0) {
        const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, limit: 1 });
        if (subs.data.length > 0 && subs.data[0].status === 'active') {
          hasProSubscription = true;
        }
      }
    } catch (stripeError) {
      console.log('Could not check Stripe:', stripeError.message);
    }
    
    if (!hasProSubscription) {
      return res.status(403).json({ error: 'Pro subscription required', message: 'Upgrade to Pro to use AI features' });
    }
    
    if (!resumeText || !jobDescription) {
      return res.status(400).json({ error: 'Resume text and job description are required' });
    }
    
    const prompt = `Analyze how well this resume matches the job description. Be specific and actionable.

RESUME:
${resumeText.substring(0, 3000)}

JOB DESCRIPTION:
${jobDescription.substring(0, 2000)}

Provide a detailed analysis in this exact JSON format:
{
  "score": <number 0-100>,
  "matchingSkills": ["skill1", "skill2", ...],
  "missingSkills": ["skill1", "skill2", ...],
  "recommendations": "Specific recommendations to improve resume for this job",
  "keywordMatches": ["keyword1", "keyword2", ...],
  "experienceAlignment": "Brief assessment of how experience aligns with requirements"
}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
    
    let analysis;
    try {
      const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
      analysis = JSON.parse(jsonMatch[0]);
    } catch {
      analysis = { 
        score: 70, 
        raw: message.content[0].text,
        matchingSkills: [],
        missingSkills: [],
        recommendations: message.content[0].text
      };
    }
    
    res.json({ success: true, analysis });
  } catch (error) {
    console.error('Resume analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze resume' });
  }
});

// Interview preparation tips
app.post('/api/v3/interview-prep', verifyUser, async (req, res) => {
  try {
    // Support both jobDescription and jobTitle/company params
    const { jobDescription, jobTitle, company, industry } = req.body;
    
    if (!anthropic) {
      return res.status(503).json({ error: 'AI service not available' });
    }
    
    // Check Stripe for actual subscription status
    let hasProSubscription = false;
    try {
      const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
      if (customers.data.length > 0) {
        const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, limit: 1 });
        if (subs.data.length > 0 && subs.data[0].status === 'active') {
          hasProSubscription = true;
        }
      }
    } catch (stripeError) {
      console.log('Could not check Stripe:', stripeError.message);
    }
    
    if (!hasProSubscription) {
      return res.status(403).json({ error: 'Pro subscription required', message: 'Upgrade to Pro to use AI features' });
    }
    
    // Build job context from available params
    const jobContext = jobDescription 
      ? `JOB DESCRIPTION:\n${jobDescription.substring(0, 2000)}`
      : `JOB TITLE: ${jobTitle || 'Software Engineer'}\nCOMPANY: ${company || 'Not specified'}\nINDUSTRY: ${industry || 'Technology'}`;
    
    const prompt = `Generate comprehensive interview preparation materials.

${jobContext}

Provide:
1. 5 likely interview questions (mix of technical and behavioral)
2. Brief tips on how to answer each question
3. Key topics to research about the company/role
4. Skills to emphasize during the interview
5. Smart questions the candidate should ask the interviewer

Format as JSON:
{
  "questions": ["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"],
  "tips": ["Tip 1", "Tip 2", "Tip 3", "Tip 4", "Tip 5"],
  "research": ["Topic 1", "Topic 2", "Topic 3"],
  "skillsToEmphasize": ["skill1", "skill2", "skill3"],
  "questionsToAsk": ["Question to ask 1?", "Question to ask 2?", "Question to ask 3?"]
}`;

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });
    
    let prep;
    try {
      const jsonMatch = message.content[0].text.match(/\{[\s\S]*\}/);
      prep = JSON.parse(jsonMatch[0]);
    } catch {
      prep = { raw: message.content[0].text };
    }
    
    // Return in both formats for compatibility
    res.json({ success: true, prep, prepMaterials: prep });
  } catch (error) {
    console.error('Interview prep error:', error);
    res.status(500).json({ error: 'Failed to generate prep materials' });
  }
});

// AI Chat assistant
app.post('/api/v3/chat', verifyUser, async (req, res) => {
  try {
    const { message, context } = req.body;
    
    if (!anthropic) {
      return res.status(503).json({ error: 'AI service not available' });
    }
    
    // Check Stripe for actual subscription status
    let hasProSubscription = false;
    try {
      const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
      if (customers.data.length > 0) {
        const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, limit: 1 });
        if (subs.data.length > 0 && subs.data[0].status === 'active') {
          hasProSubscription = true;
        }
      }
    } catch (stripeError) {
      console.log('Could not check Stripe:', stripeError.message);
    }
    
    if (!hasProSubscription) {
      return res.status(403).json({ error: 'Pro subscription required', message: 'Upgrade to Pro to use AI features' });
    }
    
    const prompt = `You are a helpful job search assistant. Answer the user's question helpfully and concisely.

${context ? `Context: ${context}\n` : ''}
User question: ${message}

Provide a helpful, actionable response.`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }]
    });
    
    res.json({
      success: true,
      reply: response.content[0].text
    });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Chat failed' });
  }
});

// =====================================
// ADMIN ENDPOINTS
// =====================================

// Admin secret for protecting admin routes
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'applysafe-admin-2024';

// Middleware to verify admin access
const verifyAdmin = (req, res, next) => {
  const adminKey = req.headers['x-admin-key'] || req.query.adminKey;
  if (adminKey !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Unauthorized: Invalid admin key' });
  }
  next();
};

// Get all users (admin only)
app.get('/api/admin/users', verifyAdmin, async (req, res) => {
  try {
    const users = await User.findAll({ order: [['createdAt', 'DESC']] });

    const stats = {
      totalUsers: users.length,
      proUsers: users.filter(u => u.subscriptionStatus === 'active' || u.subscriptionStatus === 'pro').length,
      freeUsers: users.filter(u => u.subscriptionStatus === 'free' || !u.subscriptionStatus).length,
      trialUsers: users.filter(u => u.subscriptionStatus === 'trial').length,
    };

    res.json({
      success: true,
      stats,
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        picture: u.picture,
        subscriptionStatus: u.subscriptionStatus || 'free',
        createdAt: u.createdAt,
        stripeCustomerId: u.stripeCustomerId ? '••••' + u.stripeCustomerId.slice(-4) : null
      }))
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user count (public - for landing page)
app.get('/api/stats/users', async (req, res) => {
  try {
    const count = await User.count();
    res.json({ userCount: count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Admin dashboard HTML page
app.get('/admin', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>ApplySafe Admin Dashboard</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f3f4f6; min-height: 100vh; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #1f2937; margin-bottom: 20px; }
        .login-form { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px; margin: 100px auto; }
        .login-form input { width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 8px; margin-bottom: 15px; font-size: 16px; }
        .login-form button { width: 100%; background: #10B981; color: white; border: none; padding: 12px; border-radius: 8px; font-size: 16px; cursor: pointer; }
        .login-form button:hover { background: #059669; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        .stat-card h3 { color: #6b7280; font-size: 14px; margin-bottom: 8px; }
        .stat-card .value { font-size: 36px; font-weight: bold; color: #1f2937; }
        .stat-card.pro .value { color: #10B981; }
        .users-table { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f9fafb; font-weight: 600; color: #374151; }
        tr:hover { background: #f9fafb; }
        .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; }
        .badge.pro { background: #d1fae5; color: #059669; }
        .badge.free { background: #e5e7eb; color: #6b7280; }
        .badge.trial { background: #fef3c7; color: #d97706; }
        .hidden { display: none; }
        .error { color: #ef4444; margin-top: 10px; }
        .refresh-btn { background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; margin-bottom: 20px; }
        .refresh-btn:hover { background: #4b5563; }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Login Form -->
        <div id="loginForm" class="login-form">
          <h2 style="margin-bottom: 20px; text-align: center;">🔐 Admin Login</h2>
          <input type="password" id="adminKey" placeholder="Enter Admin Key" />
          <button onclick="login()">Login</button>
          <p id="loginError" class="error hidden"></p>
        </div>
        
        <!-- Dashboard -->
        <div id="dashboard" class="hidden">
          <h1>📊 ApplySafe Admin Dashboard</h1>
          <button class="refresh-btn" onclick="loadUsers()">🔄 Refresh</button>
          
          <div class="stats">
            <div class="stat-card">
              <h3>Total Users</h3>
              <div class="value" id="totalUsers">-</div>
            </div>
            <div class="stat-card pro">
              <h3>Pro Subscribers</h3>
              <div class="value" id="proUsers">-</div>
            </div>
            <div class="stat-card">
              <h3>Free Users</h3>
              <div class="value" id="freeUsers">-</div>
            </div>
            <div class="stat-card">
              <h3>Trial Users</h3>
              <div class="value" id="trialUsers">-</div>
            </div>
          </div>
          
          <div class="users-table">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody id="usersTable">
                <tr><td colspan="4" style="text-align: center;">Loading...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      <script>
        let adminKey = '';
        
        function login() {
          adminKey = document.getElementById('adminKey').value;
          loadUsers();
        }
        
        async function loadUsers() {
          try {
            const res = await fetch('/api/admin/users?adminKey=' + encodeURIComponent(adminKey));
            const data = await res.json();
            
            if (data.error) {
              document.getElementById('loginError').textContent = data.error;
              document.getElementById('loginError').classList.remove('hidden');
              return;
            }
            
            // Show dashboard
            document.getElementById('loginForm').classList.add('hidden');
            document.getElementById('dashboard').classList.remove('hidden');
            
            // Update stats
            document.getElementById('totalUsers').textContent = data.stats.totalUsers;
            document.getElementById('proUsers').textContent = data.stats.proUsers;
            document.getElementById('freeUsers').textContent = data.stats.freeUsers;
            document.getElementById('trialUsers').textContent = data.stats.trialUsers;
            
            // Update table
            const tbody = document.getElementById('usersTable');
            tbody.innerHTML = data.users.map(u => \`
              <tr>
                <td>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="\${u.picture || 'https://via.placeholder.com/32'}" style="width: 32px; height: 32px; border-radius: 50%;" />
                    \${u.name || 'Unknown'}
                  </div>
                </td>
                <td>\${u.email}</td>
                <td><span class="badge \${u.subscriptionStatus}">\${u.subscriptionStatus}</span></td>
                <td>\${new Date(u.createdAt).toLocaleDateString()}</td>
              </tr>
            \`).join('');
            
          } catch (error) {
            console.error('Error:', error);
            document.getElementById('loginError').textContent = 'Failed to connect to server';
            document.getElementById('loginError').classList.remove('hidden');
          }
        }
        
        // Check for stored key
        document.getElementById('adminKey').addEventListener('keypress', (e) => {
          if (e.key === 'Enter') login();
        });
      </script>
    </body>
    </html>
  `);
});

// =====================================
// USER TRACKING ENDPOINTS
// =====================================

// Get all users (admin endpoint)
app.get('/api/admin/users', async (req, res) => {
  try {
    await connectToDatabase();
    const users = await User.findAll({
      attributes: ['id', 'email', 'name', 'createdAt', 'lastLogin', 'loginCount', 'totalScans', 'totalJobsAnalyzed', 'subscriptionStatus']
    });

    res.json({
      success: true,
      totalUsers: users.length,
      users: users
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users', message: error.message });
  }
});

// Get user stats by email
app.get('/api/user/stats/:email', async (req, res) => {
  try {
    await connectToDatabase();
    const user = await User.findOne({ where: { email: req.params.email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        loginCount: user.loginCount,
        totalScans: user.totalScans,
        totalJobsAnalyzed: user.totalJobsAnalyzed,
        subscriptionStatus: user.subscriptionStatus,
        isPremium: user.isPremium
      }
    });
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    res.status(500).json({ error: 'Failed to fetch user stats', message: error.message });
  }
});

// Log user activity
app.post('/api/user/activity', async (req, res) => {
  try {
    const { email, action, details } = req.body;
    
    if (!email || !action) {
      return res.status(400).json({ error: 'Email and action are required' });
    }
    
    await connectToDatabase();
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Add activity to log
    user.activityLog = [
      ...(user.activityLog || []),
      { action, timestamp: new Date(), details: details || {} }
    ];

    // Update user with activity log and metrics
    if (action === 'scan') {
      user.totalScans = (user.totalScans || 0) + 1;
    } else if (action === 'sync') {
      user.lastSyncDate = new Date();
    }

    await user.save();
    
    res.json({ success: true, message: 'Activity logged' });
  } catch (error) {
    console.error('❌ Error logging activity:', error);
    res.status(500).json({ error: 'Failed to log activity', message: error.message });
  }
});

// Get dashboard stats
app.get('/api/admin/stats', async (req, res) => {
  try {
    await connectToDatabase();
    const totalUsers = await User.count();
    const freeUsers = await User.count({ where: { subscriptionStatus: 'free' } });
    const trialUsers = await User.count({ where: { subscriptionStatus: 'trial' } });
    const paidUsers = await User.count({ where: { subscriptionStatus: 'paid' } });

    const users = await User.findAll();
    const totalScans = users.reduce((sum, user) => sum + (user.totalScans || 0), 0);
    const totalJobs = users.reduce((sum, user) => sum + (user.totalJobsAnalyzed || 0), 0);
    const premiumUsers = await User.count({ where: { isPremium: true } });
    
    res.json({
      success: true,
      stats: {
        totalUsers,
        freeUsers,
        trialUsers,
        paidUsers,
        totalScans,
        totalJobsAnalyzed: totalJobs,
        premiumUsers
      }
    });
  } catch (error) {
    console.error('❌ Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;

// For local development
if (process.env.NODE_ENV !== 'production' && require.main === module) {
  app.listen(PORT, () => {
    console.log(`ApplySafe backend running on port ${PORT}`);
    console.log(`Stripe configured: ${!!process.env.STRIPE_SECRET_KEY}`);
  });
}

// Export for Vercel serverless
module.exports = app;
