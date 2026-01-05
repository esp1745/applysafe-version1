import './Hero.css'

const Hero = () => {
  return (
    <section className="hero">
      <div className="container hero-content">
        <div className="hero-text">
          <span className="hero-badge">🛡️ AI-Powered Protection</span>
          <h1>
            Protect Your Job Search from <span className="text-gradient">Scams</span>
          </h1>
          <p>
            ApplySafe instantly analyzes job postings to detect fraud, fake recruiters, 
            and phishing attempts. Get real-time protection while you browse.
          </p>
          <div className="hero-cta">
            <a href="#" className="btn btn-primary btn-large">
              <ChromeIcon />
              Add to Chrome — It's Free
            </a>
            <a href="#how-it-works" className="btn btn-secondary btn-large">
              See How It Works
            </a>
          </div>
          <div className="hero-stats">
            <div className="stat">
              <strong>50K+</strong>
              <span>Active Users</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <strong>1M+</strong>
              <span>Jobs Analyzed</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <strong>99%</strong>
              <span>Accuracy</span>
            </div>
          </div>
        </div>

        <div className="hero-visual">
          <div className="browser-mockup">
            <div className="browser-header">
              <div className="dots">
                <span className="dot red" />
                <span className="dot yellow" />
                <span className="dot green" />
              </div>
              <div className="url-bar">
                <LockIcon />
                linkedin.com/jobs
              </div>
            </div>
            <div className="browser-content">
              <JobCard 
                safe={true}
                title="Senior Software Engineer"
                company="Google"
                badge="Safe"
              />
              <JobCard 
                safe={false}
                title="Work From Home - $5000/week"
                company="Unknown LLC"
                badge="Warning"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="hero-bg" />
    </section>
  )
}

const JobCard = ({ safe, title, company, badge }) => (
  <div className={`job-card ${safe ? 'safe' : 'danger'}`}>
    <div className="job-avatar">{company[0]}</div>
    <div className="job-info">
      <strong>{title}</strong>
      <span>{company}</span>
    </div>
    <span className={`job-badge ${safe ? 'safe' : 'danger'}`}>
      {safe ? '✓' : '!'} {badge}
    </span>
  </div>
)

const ChromeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="4"/>
  </svg>
)

const LockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2"/>
    <path d="M7 11V7a5 5 0 0110 0v4"/>
  </svg>
)

export default Hero
