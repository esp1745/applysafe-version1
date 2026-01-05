// ApplySafe Welcome Page JavaScript

document.addEventListener('DOMContentLoaded', () => {
  const emailInput = document.getElementById('welcomeEmailInput');
  const emailSignInBtn = document.getElementById('emailSignInBtn');
  const signInBtn = document.getElementById('signInBtn');
  const skipBtn = document.getElementById('skipBtn');

  // Email Sign In
  emailSignInBtn.addEventListener('click', handleEmailSignIn);
  emailInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleEmailSignIn();
  });

  async function handleEmailSignIn() {
    const email = emailInput.value.trim();
    
    if (!email) {
      showError('Please enter your email');
      return;
    }
    
    if (!email.includes('@')) {
      showError('Please enter a valid email');
      return;
    }
    
    emailSignInBtn.classList.add('loading');
    emailSignInBtn.disabled = true;
    emailSignInBtn.innerHTML = 'Signing in...';
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'signInWithEmail',
        email: email,
        name: email.split('@')[0]
      });
      
      if (response && response.success) {
        showSuccess('Welcome! You\'re all set.');
        setTimeout(() => {
          // Close the welcome page or navigate to dashboard
          window.location.href = 'chrome-extension://' + chrome.runtime.id + '/dashboard/dashboard.html';
        }, 1500);
      } else {
        resetEmailButton();
        showError(response?.error || 'Sign in failed. Please try again.');
      }
    } catch (error) {
      console.error('Email sign-in error:', error);
      resetEmailButton();
      showError('Sign in failed: ' + error.message);
    }
  }

  function resetEmailButton() {
    emailSignInBtn.classList.remove('loading');
    emailSignInBtn.disabled = false;
    emailSignInBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
      </svg>
      Sign in with Email
    `;
  }

  // Sign in with Google (backup)
  signInBtn.addEventListener('click', async () => {
    signInBtn.classList.add('loading');
    signInBtn.disabled = true;
    signInBtn.innerHTML = 'Opening Google Sign In...';
    
    try {
      // Send sign in message - this will open Google OAuth popup
      chrome.runtime.sendMessage({ action: 'signIn' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Sign in error:', chrome.runtime.lastError);
          resetSignInButton();
          showError('Sign in failed. Please try again.');
          return;
        }
        
        if (response && response.success) {
          // Successfully signed in, go to a job board
          showSuccess('Welcome! You\'re all set.');
          setTimeout(() => {
            // Open LinkedIn Jobs as a starting point
            window.location.href = 'https://www.linkedin.com/jobs/';
          }, 1500);
        } else {
          resetSignInButton();
          showError(response?.error || 'Sign in failed. Please try again.');
        }
      });
    } catch (error) {
      console.error('Sign in error:', error);
      resetSignInButton();
      showError('Sign in failed. Please try again.');
    }
  });
  
  function resetSignInButton() {
    signInBtn.classList.remove('loading');
    signInBtn.disabled = false;
    signInBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      Sign in with Google
    `;
  }

  // Skip and start with free scans
  skipBtn.addEventListener('click', () => {
    showSuccess('Great! You have 3 free scans per day.');
    setTimeout(() => {
      // Open LinkedIn Jobs as a starting point
      window.location.href = 'https://www.linkedin.com/jobs/';
    }, 1500);
  });
});

// Show success message
function showSuccess(message) {
  showToast(message, 'success');
}

// Show error message
function showError(message) {
  showToast(message, 'error');
}

// Toast notification
function showToast(message, type = 'info') {
  // Remove existing toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    padding: 15px 30px;
    border-radius: 10px;
    font-weight: 500;
    z-index: 1000;
    animation: slideUp 0.3s ease;
    ${type === 'success' ? 'background: #10b981; color: white;' : ''}
    ${type === 'error' ? 'background: #ef4444; color: white;' : ''}
    ${type === 'info' ? 'background: #333; color: white;' : ''}
  `;

  // Add animation keyframes
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from { opacity: 0; transform: translateX(-50%) translateY(20px); }
      to { opacity: 1; transform: translateX(-50%) translateY(0); }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(toast);

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
