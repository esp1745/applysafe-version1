import './Features.css'

const features = [
  {
    icon: '🔍',
    title: 'Scam Detection',
    description: 'AI analyzes job postings for red flags like vague descriptions, unrealistic pay, and suspicious requirements.'
  },
  {
    icon: '✅',
    title: 'H-1B Sponsor Check',
    description: 'Instantly verify if a company has sponsored H-1B visas, with historical data on visa approvals.'
  },
  {
    icon: '⚡',
    title: 'Real-Time Alerts',
    description: 'Get instant warnings while browsing LinkedIn, Indeed, and other job sites.'
  },
  {
    icon: '🛡️',
    title: 'Company Verification',
    description: 'Cross-reference companies against known scam databases and verify legitimacy.'
  },
  {
    icon: '📊',
    title: 'Risk Scoring',
    description: 'Each job gets a safety score from 0-100, making it easy to spot risky postings.'
  },
  {
    icon: '🔒',
    title: 'Privacy First',
    description: 'All analysis happens locally. Your job search data never leaves your browser.'
  }
]

const Features = () => {
  return (
    <section id="features" className="features">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">Features</span>
          <h2>Everything You Need to Stay Safe</h2>
          <p>Powerful tools to protect your job search from scams and fraud</p>
        </div>
        
        <div className="features-grid">
          {features.map((feature, i) => (
            <div key={i} className="feature-card">
              <span className="feature-icon">{feature.icon}</span>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Features
