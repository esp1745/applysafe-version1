import { useState } from 'react'
import './Pricing.css'

const plans = [
  {
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    description: 'Basic protection for casual job seekers',
    features: [
      { text: '10 scans per day', included: true },
      { text: 'Basic scam detection', included: true },
      { text: 'H-1B sponsor lookup', included: true },
      { text: 'AI analysis', included: false },
      { text: 'Priority support', included: false }
    ]
  },
  {
    name: 'Pro',
    price: { monthly: 9, yearly: 7 },
    description: 'Full protection for serious job seekers',
    featured: true,
    features: [
      { text: 'Unlimited scans', included: true },
      { text: 'Advanced AI detection', included: true },
      { text: 'H-1B sponsor lookup', included: true },
      { text: 'Company deep analysis', included: true },
      { text: 'Priority support', included: true }
    ]
  },
  {
    name: 'Enterprise',
    price: { monthly: 'Custom', yearly: 'Custom' },
    description: 'For teams and organizations',
    features: [
      { text: 'Everything in Pro', included: true },
      { text: 'Team dashboard', included: true },
      { text: 'API access', included: true },
      { text: 'Custom integrations', included: true },
      { text: 'Dedicated support', included: true }
    ]
  }
]

const Pricing = () => {
  const [yearly, setYearly] = useState(false)

  return (
    <section id="pricing" className="pricing">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Pricing</span>
          <h2>Simple, Transparent Pricing</h2>
          <p>Start free, upgrade when you need more</p>
        </div>

        <div className="pricing-toggle">
          <span className={!yearly ? 'active' : ''}>Monthly</span>
          <label className="toggle">
            <input type="checkbox" checked={yearly} onChange={() => setYearly(!yearly)} />
            <span className="slider" />
          </label>
          <span className={yearly ? 'active' : ''}>Yearly</span>
          <span className="save-badge">Save 20%</span>
        </div>

        <div className="pricing-cards">
          {plans.map((plan, i) => (
            <div key={i} className={`pricing-card ${plan.featured ? 'featured' : ''}`}>
              {plan.featured && <span className="featured-badge">Most Popular</span>}
              <h3>{plan.name}</h3>
              <div className="price">
                {typeof plan.price.monthly === 'number' ? (
                  <>
                    <span className="currency">$</span>
                    <span className="amount">{yearly ? plan.price.yearly : plan.price.monthly}</span>
                    <span className="period">/mo</span>
                  </>
                ) : (
                  <span className="amount custom">Custom</span>
                )}
              </div>
              <p className="plan-desc">{plan.description}</p>
              <ul className="plan-features">
                {plan.features.map((f, j) => (
                  <li key={j} className={f.included ? '' : 'disabled'}>
                    {f.included ? '✓' : '×'} {f.text}
                  </li>
                ))}
              </ul>
              <button className={`btn ${plan.featured ? 'btn-primary' : 'btn-secondary'} btn-full`}>
                {plan.name === 'Enterprise' ? 'Contact Sales' : 'Get Started'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Pricing
