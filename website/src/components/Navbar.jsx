import { useState } from 'react'
import './Navbar.css'

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <nav className="navbar">
      <div className="container navbar-content">
        <a href="/" className="logo">
          <svg viewBox="0 0 24 24" className="logo-icon">
            <path fill="#10b981" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-1 6h2v2h-2V7zm0 4h2v6h-2v-6z"/>
          </svg>
          <span>ApplySafe</span>
        </a>

        <div className="nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it Works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>

        <div className="nav-actions">
          <a href="#" className="btn btn-secondary">Sign In</a>
          <a href="#" className="btn btn-primary install-btn">
            <ChromeIcon />
            Add to Chrome
          </a>
        </div>

        <button className="mobile-menu-btn" onClick={() => setMobileOpen(!mobileOpen)}>
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {mobileOpen && (
        <div className="mobile-menu">
          <a href="#features" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="#how-it-works" onClick={() => setMobileOpen(false)}>How it Works</a>
          <a href="#pricing" onClick={() => setMobileOpen(false)}>Pricing</a>
          <a href="#faq" onClick={() => setMobileOpen(false)}>FAQ</a>
          <a href="#" className="btn btn-primary">Add to Chrome</a>
        </div>
      )}
    </nav>
  )
}

const ChromeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
    <circle cx="12" cy="12" r="4"/>
  </svg>
)

export default Navbar
