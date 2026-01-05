// ApplySafe Landing Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  // Open Dashboard button
  const openDashboardBtn = document.getElementById('openDashboard');
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', () => {
      // Open the main dashboard
      const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
      chrome.tabs.create({ url: dashboardUrl });
    });
  }

  // Get Started buttons
  const getStartedBtns = document.querySelectorAll('#getStarted, #ctaGetStarted');
  getStartedBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Check if user is logged in
      chrome.storage.local.get(['user'], (result) => {
        if (result.user) {
          // User is logged in, open dashboard
          const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
          chrome.tabs.create({ url: dashboardUrl });
        } else {
          // User is not logged in, trigger sign in
          chrome.runtime.sendMessage({ action: 'signIn' }, (response) => {
            if (response && response.success) {
              const dashboardUrl = chrome.runtime.getURL('dashboard/dashboard.html');
              chrome.tabs.create({ url: dashboardUrl });
            }
          });
        }
      });
    });
  });

  // Watch Demo button
  const watchDemoBtn = document.getElementById('watchDemo');
  if (watchDemoBtn) {
    watchDemoBtn.addEventListener('click', () => {
      // You can add a video modal or link to a demo video
      alert('Demo video coming soon!');
    });
  }

  // Upgrade to Pro button
  const upgradeProBtn = document.getElementById('upgradePro');
  if (upgradeProBtn) {
    upgradeProBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openCheckout' }, (response) => {
        if (response && response.url) {
          chrome.tabs.create({ url: response.url });
        }
      });
    });
  }

  // Smooth scroll for anchor links
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // Add scroll effect to header
  const header = document.querySelector('.header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      header.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08)';
    } else {
      header.style.boxShadow = 'none';
    }
  });

  // Animate stats on scroll
  const animateValue = (element, start, end, duration) => {
    const startTimestamp = performance.now();
    const step = (timestamp) => {
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const value = Math.floor(progress * (end - start) + start);
      element.textContent = value.toLocaleString() + (element.dataset.suffix || '');
      if (progress < 1) {
        requestAnimationFrame(step);
      }
    };
    requestAnimationFrame(step);
  };

  // Intersection Observer for animations
  const observerOptions = {
    threshold: 0.2
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('animate-in');
        
        // Animate stat values
        const statValues = entry.target.querySelectorAll('.stat-value');
        statValues.forEach(stat => {
          const text = stat.textContent;
          const value = parseInt(text.replace(/[^0-9]/g, ''));
          if (value && !stat.dataset.animated) {
            stat.dataset.animated = 'true';
            if (text.includes('+')) {
              stat.dataset.suffix = '+';
            }
            animateValue(stat, 0, value, 1500);
          }
        });
      }
    });
  }, observerOptions);

  // Observe sections
  document.querySelectorAll('.hero-stats, .features-grid, .steps, .pricing-cards').forEach(section => {
    observer.observe(section);
  });
});
