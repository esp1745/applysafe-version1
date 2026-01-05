import './HowItWorks.css'

const steps = [
  {
    num: 1,
    title: 'Install Extension',
    description: 'Add ApplySafe to Chrome in one click. No account required to start.'
  },
  {
    num: 2,
    title: 'Browse Jobs',
    description: 'Search for jobs on LinkedIn, Indeed, or any job site as you normally would.'
  },
  {
    num: 3,
    title: 'Get Protected',
    description: 'ApplySafe automatically scans each posting and alerts you to any risks.'
  }
]

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="how-it-works">
      <div className="container">
        <div className="section-header">
          <span className="section-badge">How It Works</span>
          <h2>Start Protecting Your Job Search</h2>
          <p>Get set up in under 30 seconds</p>
        </div>

        <div className="steps">
          {steps.map((step, i) => (
            <div key={i} className="step">
              <div className="step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default HowItWorks
