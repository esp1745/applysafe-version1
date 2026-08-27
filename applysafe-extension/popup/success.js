// ApplySafe: Stripe Checkout Success Handler
// This script runs on popup/success.html and forces a subscription sync after payment.

(async function() {
  // Show loading spinner or message
  const statusEl = document.getElementById('status');
  const closeBtn = document.getElementById('closeSuccessBtn');

  closeBtn?.addEventListener('click', () => {
    window.close();
  });

  if (statusEl) statusEl.textContent = 'Finalizing your subscription...';

  // Force subscription sync
  try {
    await chrome.runtime.sendMessage({ action: 'syncSubscription' });
    if (statusEl) statusEl.textContent = 'Subscription activated! You can now close this tab.';
  } catch (e) {
    if (statusEl) statusEl.textContent = 'There was a problem updating your subscription. Please sign out and in again.';
  }
})();
