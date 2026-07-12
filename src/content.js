function injectButton() {
  if (document.getElementById('torbox-manager-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'torbox-manager-btn';
  
  // Create TorBox icon
  btn.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
    </svg>
    Open File Manager
  `;

  // Apply premium floating glassmorphism styling
  Object.assign(btn.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    zIndex: '999999',
    background: '#00d287',
    color: '#0e1111',
    border: 'none',
    borderRadius: '30px',
    padding: '12px 24px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontWeight: 'bold',
    fontSize: '0.9rem',
    boxShadow: '0 8px 24px rgba(0, 210, 135, 0.4)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    transition: 'all 0.2s ease-in-out',
    outline: 'none'
  });

  btn.addEventListener('mouseenter', () => {
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 12px 32px rgba(0, 210, 135, 0.6)';
    btn.style.background = '#00f09b';
  });

  btn.addEventListener('mouseleave', () => {
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 8px 24px rgba(0, 210, 135, 0.4)';
    btn.style.background = '#00d287';
  });

  btn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'open_manager' });
  });

  document.body.appendChild(btn);
}

// Only inject if user is on the dashboard
function checkAndInject() {
  if (window.location.pathname.startsWith('/dashboard')) {
    injectButton();
  } else {
    const existing = document.getElementById('torbox-manager-btn');
    if (existing) existing.remove();
  }
}

// Observe page transitions since dashboards are often single-page apps (SPAs)
checkAndInject();
const observer = new MutationObserver(checkAndInject);
observer.observe(document.documentElement, { childList: true, subtree: true });
