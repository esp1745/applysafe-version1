import './CTA.css'

const CTA = () => {
  return (
    <section className="cta">
      <div className="container cta-content">
        <h2>Ready to Protect Your Job Search?</h2>
        <p>Join thousands of job seekers who trust ApplySafe to keep them safe.</p>
        <div className="cta-buttons">
          <a href="#" className="btn btn-white btn-large">
            <ChromeIcon />
            Add to Chrome — Free
          </a>
        </div>
        <span className="cta-note">✓ No credit card required • ✓ Free forever tier</span>
      </div>
    </section>
  )
}

const ChromeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="4"/>
  </svg>
)

export default CTA
