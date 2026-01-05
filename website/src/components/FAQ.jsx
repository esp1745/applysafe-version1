import { useState } from 'react'
import './FAQ.css'

const faqs = [
  {
    q: 'Is ApplySafe really free?',
    a: 'Yes! The free tier includes 10 scans per day and basic protection features. Upgrade to Pro for unlimited scans and advanced AI analysis.'
  },
  {
    q: 'How does scam detection work?',
    a: 'Our AI analyzes job postings for red flags like vague descriptions, unrealistic pay, requests for personal info, and patterns from known scam databases.'
  },
  {
    q: 'Which job sites are supported?',
    a: 'ApplySafe works on LinkedIn, Indeed, Glassdoor, ZipRecruiter, and most major job boards. We\'re constantly adding support for more sites.'
  },
  {
    q: 'Is my data private?',
    a: 'Absolutely. All analysis happens locally in your browser. We never store your job search history or personal information on our servers.'
  },
  {
    q: 'How accurate is the H-1B sponsor data?',
    a: 'Our H-1B data comes directly from USCIS records and is updated quarterly. We show historical visa approvals from 2010-2024.'
  },
  {
    q: 'Can I use ApplySafe on multiple devices?',
    a: 'Yes! Sign in with your account to sync your settings and whitelist across all your Chrome browsers.'
  }
]

const FAQ = () => {
  const [open, setOpen] = useState(null)

  return (
    <section id="faq" className="faq">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">FAQ</span>
          <h2>Frequently Asked Questions</h2>
          <p>Got questions? We've got answers.</p>
        </div>

        <div className="faq-list">
          {faqs.map((faq, i) => (
            <div key={i} className={`faq-item ${open === i ? 'open' : ''}`}>
              <button className="faq-q" onClick={() => setOpen(open === i ? null : i)}>
                {faq.q}
                <span className="faq-icon">{open === i ? '−' : '+'}</span>
              </button>
              {open === i && <p className="faq-a">{faq.a}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default FAQ
