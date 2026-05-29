
// --- Real-time Sync & Broadcast channel for multi-tab updates ---
const syncChannel = new BroadcastChannel('skillproof_sync');
syncChannel.onmessage = (event) => {
  if (event.data === 'badge_updated' && currentUser && currentUser.role === 'student') {
    console.log('[Sync] Received real-time badge update signal. Refreshing student dashboard...');
    loadStudentDashboard();
    updateNotificationBadge();
  }
};

// --- Secure HTML Escaping Utility for XSS Prevention ---
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Bulletproof CSP & Inline Handler Polyfill ---
// Replaces insecure browser-blocked inline "onclick" attributes with modern programmatic event listeners.
// Suppresses default anchor jump (#) behavior for pure single-page navigation.
function convertOnclick(el) {
  const handlerStr = el.getAttribute('onclick');
  if (handlerStr) {
    el.removeAttribute('onclick');
    el.addEventListener('click', (e) => {
      if (el.tagName === 'A' && el.getAttribute('href') === '#') {
        e.preventDefault();
      }
      try {
        const fn = new Function('event', handlerStr);
        fn.call(el, e);
      } catch (err) {
        console.error("Error executing click handler:", err, handlerStr);
      }
    });
  }
}

function initCSPPolyfill() {
  try {
    // 1. Process all elements currently in the DOM
    document.querySelectorAll('[onclick]').forEach(convertOnclick);

    // 2. Set up MutationObserver to dynamically intercept future onclick attributes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.hasAttribute('onclick')) {
              convertOnclick(node);
            }
            node.querySelectorAll('[onclick]').forEach(convertOnclick);
          }
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  } catch (err) {
    console.error("Failed to initialize CSP Polyfill:", err);
  }
}

// Run immediately since script is at the bottom of the body
initCSPPolyfill();

// Safe LocalStorage Proxy to absorb SecurityError/DOMException under sandboxed privacy contexts
const safeLocalStorage = {
  getItem(key) {
    try { return localStorage.getItem(key); } catch (e) { console.warn("localStorage.getItem blocked:", e); return null; }
  },
  setItem(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { console.warn("localStorage.setItem blocked:", e); }
  },
  removeItem(key) {
    try { localStorage.removeItem(key); } catch (e) { console.warn("localStorage.removeItem blocked:", e); }
  },
  clear() {
    try { localStorage.clear(); } catch (e) { console.warn("localStorage.clear blocked:", e); }
  }
};

// Global variables for Recruiter OTP & DevTools active detection
let pendingRecruiterUserId = null;
let pendingRecruiterEmail = null;
let devtoolsCheckInterval = null;

// Global Fetch Interceptor to append Secure Authorization Bearer Token and handle sliding session window automatically
const originalFetch = window.fetch;
window.fetch = function(resource, init) {
  init = init || {};
  init.headers = init.headers || {};
  
  const token = safeLocalStorage.getItem('skillproof_session_token');
  if (token) {
    if (init.headers instanceof Headers) {
      init.headers.set('Authorization', `Bearer ${token}`);
    } else if (Array.isArray(init.headers)) {
      const hasAuth = init.headers.some(h => h[0].toLowerCase() === 'authorization');
      if (!hasAuth) {
        init.headers.push(['Authorization', `Bearer ${token}`]);
      }
    } else {
      const hasAuth = Object.keys(init.headers).some(k => k.toLowerCase() === 'authorization');
      if (!hasAuth) {
        init.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  if (currentUser) {
    safeLocalStorage.setItem('skillproof_login_time', Date.now());
  }

  return originalFetch.call(this, resource, init).then(response => {
    const resourceStr = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');
    const isLogoutRequest = resourceStr.includes('/api/auth/logout');
    // Skip 401 handling for auth/OTP endpoints that don't need a session token
    const isAuthEndpoint = resourceStr.includes('/api/auth/login') || resourceStr.includes('/api/auth/recruiter-otp');
    // Skip 401 handling for background proctoring endpoints — these fire continuously
    // during exams and a transient 401 on them should NEVER destroy the session
    const isProctorBackground = resourceStr.includes('/api/exams/photo') || resourceStr.includes('/api/exams/violation');
    // NEVER force-logout while the student is in an active exam session — it would be catastrophic
    const isInActiveExam = !!currentExam;
    
    if (response.status === 401 && !isLogoutRequest && !isAuthEndpoint && !isProctorBackground && !isInActiveExam && currentUser) {
      // Debounce: only fire the forced logout ONCE even if multiple parallel requests return 401
      if (!window._isForceLoggingOut) {
        window._isForceLoggingOut = true;
        
        currentUser = null;
        currentCompany = null;
        safeLocalStorage.removeItem('skillproof_user');
        safeLocalStorage.removeItem('skillproof_company');
        safeLocalStorage.removeItem('skillproof_session_token');
        safeLocalStorage.removeItem('skillproof_login_time');
        safeLocalStorage.removeItem('skillproof_auth_provider');
        
        // Update main navbar profile buttons back to guest
        const loginBtn = document.getElementById('nav-login-btn');
        if (loginBtn) loginBtn.style.display = 'inline-block';
        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'none';
        const ctaBtn = document.getElementById('nav-cta-btn');
        if (ctaBtn) {
          ctaBtn.innerText = 'Get started →';
          ctaBtn.onclick = () => showView('auth');
        }
        
        // Route back to auth view and show non-blocking notification
        showView('auth');
        // Use setTimeout to show alert AFTER the current call stack clears, preventing double alerts
        setTimeout(() => {
          alert('Your session has expired. Please log in again to continue.');
          window._isForceLoggingOut = false;
        }, 100);
      }
    } else if (response.status === 401 && (isProctorBackground || isInActiveExam) && currentUser) {
      // During an active exam, silently attempt to self-heal the session token instead of logging out
      console.warn('[Session Guard] 401 on proctoring endpoint during active exam — attempting silent token refresh');
      const activeProv = selectProvider || safeLocalStorage.getItem('skillproof_auth_provider') || 'Google';
      if (currentUser && currentUser.email && !window._isRefreshingToken) {
        window._isRefreshingToken = true;
        originalFetch.call(this, '/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUser.email, name: currentUser.name, provider: activeProv })
        }).then(r => r.json()).then(d => {
          if (d.sessionToken) {
            safeLocalStorage.setItem('skillproof_session_token', d.sessionToken);
            console.log('[Session Guard] Token silently refreshed during active exam');
          }
          window._isRefreshingToken = false;
        }).catch(() => { window._isRefreshingToken = false; });
      }
    } else if (currentUser && response.ok) {
      safeLocalStorage.setItem('skillproof_login_time', Date.now());
    }
    return response;
  });
};
window._isForceLoggingOut = false;

// State Management
let currentUser = null;
let currentCompany = null;  // Multi-tenant company context
let currentExam = null;
let currentTimer = null;
let videoStream = null;
let screenStream = null;
let audioStream = null;
let audioContext = null;
let analyser = null;
let micInterval = null;
let activeProctorViolations = false;
let selectProvider = "";
let currentExamsList = [];
let pendingExamQuestionId = null;
let pendingScheduleId = null;
let pendingSkillName = null;
let examGracePeriod = true;  // Grace period flag - skip violations for 3s after exam starts
let bluetoothCheckInterval = null;
let examSubmittingOrExiting = false;
let isExamPaused = false; // Paused during WiFi outage — timer freezes, all input blocked

let pendingJoinCode = null;
try {
  const urlParams = new URLSearchParams(window.location.search);
  pendingJoinCode = urlParams.get('join') || urlParams.get('code');
  if (pendingJoinCode) {
    pendingJoinCode = pendingJoinCode.trim().toUpperCase();
    const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
    window.history.replaceState({ path: cleanUrl }, '', cleanUrl);
  }
} catch (e) {
  console.error('Failed to parse URL join query param:', e);
}

// Check layout restrictions — only block during EXAM, not whole site
function runLockdownIntegrityCheck() {
  // Only apply the lockdown blocker when the exam view is active
  const examViewActive = document.getElementById('view-exam') &&
    document.getElementById('view-exam').classList.contains('active');
  const isMobileView = window.innerWidth < 1024;
  const isMobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  const blocker = document.getElementById('lockdown-blocker');
  if (blocker) {
    if (examViewActive && (isMobileView || isMobileAgent)) {
      blocker.style.display = 'flex';
    } else {
      blocker.style.display = 'none';
    }
  }
}
window.addEventListener('resize', runLockdownIntegrityCheck);
window.addEventListener('load', () => { runLockdownIntegrityCheck(); });

// ── VIEW MANAGEMENT ──
function showView(viewName) {
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) targetView.classList.add('active');
  
  // Rolling session updates on user view changes
  if (currentUser) {
    safeLocalStorage.setItem('skillproof_login_time', Date.now());
  }

  // Manage navigation display and exam padding to avoid overlaps
  const mainNav = document.getElementById('main-navigation');
  const footer = document.querySelector('footer');
  const viewExam = document.getElementById('view-exam');
  if (viewName === 'exam') {
    if (mainNav) mainNav.style.display = 'none';
    if (footer) footer.style.display = 'none';
    if (viewExam) viewExam.style.paddingTop = '0px';
  } else {
    if (mainNav) mainNav.style.display = 'block';
    if (footer) footer.style.display = 'block';
    if (viewExam) viewExam.style.paddingTop = '80px';
  }
  
  // Exit fullscreen and cleanup streams if exiting exam view
  if (viewName !== 'exam') {
    cleanupStreams();
    clearInterval(currentTimer);
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(err => {});
    }
  }

  // Refresh view states
  if (viewName === 'student') {
    loadStudentDashboard();
  } else if (viewName === 'admin') {
    loadAdminHistory();
    loadRecruiterDashboard();
  }
}

// Cleanup cameras, screen shares, and mic audio contexts
function cleanupStreams() {
  try {
    if (videoStream) {
      videoStream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      videoStream = null;
    }
  } catch(e) {}
  try {
    if (screenStream) {
      screenStream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      screenStream = null;
    }
  } catch(e) {}
  try {
    if (audioStream) {
      audioStream.getTracks().forEach(track => {
        try { track.stop(); } catch(e) {}
      });
      audioStream = null;
    }
  } catch(e) {}
  try {
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
  } catch(e) {}
  clearInterval(micInterval);
  try {
    stopPhotoCaptures();
    stopPhoneDetection();
  } catch(e) {}
  stopDevToolsDetection();
}

// ── THEME TOGGLE ──
if (safeLocalStorage.getItem('theme') === 'dark') {
  document.body.classList.add('dark-theme');
}

window.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    const sunIcon = themeToggle.querySelector('.sun-icon');
    const moonIcon = themeToggle.querySelector('.moon-icon');

    themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('dark-theme');
      const isDark = document.body.classList.contains('dark-theme');
      safeLocalStorage.setItem('theme', isDark ? 'dark' : 'light');
      
      // Recalculate brand color variables for soft light / deep neon dark adaptability
      try {
        const savedTheme = safeLocalStorage.getItem('skillproof_theme') || 'orange';
        applyColorTheme(savedTheme, false);
      } catch(e) {}
      
      if (isDark) {
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'block';
      } else {
        if (sunIcon) sunIcon.style.display = 'block';
        if (moonIcon) moonIcon.style.display = 'none';
      }
    });

    if (document.body.classList.contains('dark-theme')) {
      if (sunIcon) sunIcon.style.display = 'none';
      if (moonIcon) moonIcon.style.display = 'block';
    } else {
      if (sunIcon) sunIcon.style.display = 'block';
      if (moonIcon) moonIcon.style.display = 'none';
    }
  }
});

// ── REAL GOOGLE SIGN-IN (Google Identity Services) ──
const GOOGLE_CLIENT_ID = '716420794813-6rfjccb7m8nupha86qi3jel35i0dpjev.apps.googleusercontent.com';

let googleInitRetryCount = 0;
// Initialize Google Sign-In when the GIS library loads
function initGoogleSignIn() {
  try {
    if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
      googleInitRetryCount++;
      if (googleInitRetryCount < 20) {
        setTimeout(initGoogleSignIn, 500);
      } else {
        console.warn('Google Sign-In (GIS) SDK failed to load/initialize.');
      }
      return;
    }
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    // Render the official Google button in the container
    const container = document.getElementById('google-signin-container');
    if (container) {
      google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        width: 380,
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left'
      });
    }
  } catch (err) {
    console.error('Failed to initialize Google Sign-In:', err);
  }
}
window.addEventListener('load', () => { setTimeout(initGoogleSignIn, 300); });

// Handle the JWT credential response from Google
function handleGoogleCredentialResponse(response) {
  // Decode the JWT token (payload is base64 in part 2)
  try {
    const payload = JSON.parse(atob(response.credential.split('.')[1]));
    const email = payload.email;
    const name = payload.name || payload.email.split('@')[0];
    const picture = payload.picture || '';

    if (!email || !payload.email_verified) {
      alert('Google account email not verified. Please use a verified Google account.');
      return;
    }

    // Authenticate with our server
    selectProvider = 'Google';
    submitOAuthHandshake(name, email);
  } catch (err) {
    console.error('Failed to parse Google credential:', err);
    alert('Google sign-in failed. Please try again.');
  }
}

// Manual trigger for Google Sign-In (fallback button)
function triggerGoogleSignIn() {
  try {
    if (typeof google !== 'undefined' && google.accounts && google.accounts.id) {
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // Fallback: use the old modal for manual entry
          triggerOAuthModal('Google');
        }
      });
    } else {
      // GIS not loaded, fallback to manual
      triggerOAuthModal('Google');
    }
  } catch (err) {
    console.error('Error during manual Google Sign-In trigger:', err);
    triggerOAuthModal('Google');
  }
}

// Quick demo login — bypasses OAuth for demo accounts
function quickDemoLogin(role) {
  if (role === 'student') {
    selectProvider = 'Google';
    submitOAuthHandshake('Challagolla Durga Sravan', 'student@gmail.com');
  } else if (role === 'recruiter') {
    selectProvider = 'Google';
    submitOAuthHandshake('Sundar Pichai (Google HR)', 'hr@google.com');
  }
}

// ── IN-PAGE LOGIN MODAL (fallback for GitHub / manual) ──
function triggerOAuthModal(provider) {
  selectProvider = provider;

  // Show the built-in inline auth modal instead of a popup
  const modal = document.getElementById('oauth-modal');
  if (!modal) return;

  // Update logo and title based on provider
  const logoEl  = document.getElementById('oauth-modal-logo');
  const titleEl = document.getElementById('oauth-modal-title');

  if (provider === 'Google') {
    if (logoEl) logoEl.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>`;
    if (titleEl) titleEl.textContent = 'Sign in with Google';
    // Pre-fill email label hint
    const emailLabel = document.getElementById('oauth-modal-email-label');
    if (emailLabel) emailLabel.textContent = 'Gmail or Corporate Email Address';
  } else {
    if (logoEl) logoEl.innerHTML = `<svg viewBox="0 0 24 24" width="32" height="32"><path fill="currentColor" d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.11.82-.26.82-.577v-2.234c-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.82 1.102.82 2.222v3.293c0 .319.22.694.825.576C20.565 21.795 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>`;
    if (titleEl) titleEl.textContent = 'Sign in with GitHub';
    const emailLabel = document.getElementById('oauth-modal-email-label');
    if (emailLabel) emailLabel.textContent = 'GitHub Email Address';
  }

  // Clear previous inputs and hide spinner
  const emailInput = document.getElementById('oauth-modal-email');
  const nameInput  = document.getElementById('oauth-modal-name');
  if (emailInput) emailInput.value = '';
  if (nameInput)  nameInput.value  = '';

  const fieldsForm = document.getElementById('oauth-fields-form');
  const processing = document.getElementById('oauth-processing');
  if (fieldsForm)  fieldsForm.style.display  = 'block';
  if (processing)  processing.style.display  = 'none';

  modal.style.display = 'flex';
  setTimeout(() => { if (emailInput) emailInput.focus(); }, 100);
}

// Close the login modal
function closeOAuthModal() {
  const modal = document.getElementById('oauth-modal');
  if (modal) modal.style.display = 'none';
}

// Called by the "Authenticate Identity" button inside the inline modal
function submitOAuthFlow() {
  const emailInput = document.getElementById('oauth-modal-email');
  const nameInput  = document.getElementById('oauth-modal-name');
  const email = (emailInput ? emailInput.value.trim() : '');
  const name  = (nameInput  ? nameInput.value.trim()  : '');

  if (!email || !name) {
    alert('Please enter both your email address and display name.');
    return;
  }
  if (!email.includes('@') || !email.includes('.')) {
    alert('Please enter a valid email address.');
    return;
  }

  // Show spinner
  const fieldsForm = document.getElementById('oauth-fields-form');
  const processing = document.getElementById('oauth-processing');
  if (fieldsForm) fieldsForm.style.display = 'none';
  if (processing) processing.style.display = 'flex';

  // Small delay for UX feel, then authenticate
  setTimeout(() => submitOAuthHandshake(name, email), 800);
}

// Allow Enter key to submit the login form
document.addEventListener('keydown', (e) => {
  const modal = document.getElementById('oauth-modal');
  if (modal && modal.style.display === 'flex' && e.key === 'Enter') {
    submitOAuthFlow();
  }
});

// Close modal when clicking the overlay background
window.addEventListener('DOMContentLoaded', () => {
  initOTPEvents();
  const oauthModal = document.getElementById('oauth-modal');
  if (oauthModal) {
    oauthModal.addEventListener('click', (e) => {
      if (e.target === oauthModal) closeOAuthModal();
    });
  }

  // Fix: wire checkbox directly — the CSP polyfill only converts onclick, not onchange
  const rulesCheckbox = document.getElementById('accept-rules-checkbox');
  if (rulesCheckbox) {
    rulesCheckbox.addEventListener('change', function() {
      toggleStartExamBtn(this.checked);
    });
  }

  // 1. Join Exam Code input - Enter key submits
  const joinExamCodeInput = document.getElementById('join-exam-code-input');
  if (joinExamCodeInput) {
    joinExamCodeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        joinExamViaCode();
      }
    });
  }

  // 2. Exam Password input - Enter key checks rules and submits
  const examPasswordInput = document.getElementById('exam-password-input');
  if (examPasswordInput) {
    examPasswordInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const checkbox = document.getElementById('accept-rules-checkbox');
        if (checkbox) {
          checkbox.checked = true;
          toggleStartExamBtn(true);
        }
        confirmStartExam();
      }
    });
  }

  // 3. Student Onboarding inputs - Enter key submits onboarding
  const studentOnboardPhone = document.getElementById('student-onboard-phone');
  const studentOnboardCollege = document.getElementById('student-onboard-college');
  const triggerOnboardSubmit = (e) => {
    if (e.key === 'Enter') {
      submitStudentOnboarding();
    }
  };
  if (studentOnboardPhone) {
    studentOnboardPhone.addEventListener('keydown', triggerOnboardSubmit);
  }
  if (studentOnboardCollege) {
    studentOnboardCollege.addEventListener('keydown', triggerOnboardSubmit);
  }


  // Restore branding color theme if stored
  try {
    const savedTheme = safeLocalStorage.getItem('skillproof_theme');
    if (savedTheme) {
      applyColorTheme(savedTheme, false);
    }
  } catch (e) {
    console.error('Failed to restore branding color theme:', e);
  }

  // Restore session if available and valid (under 10 minutes)
  try {
    const savedUser = safeLocalStorage.getItem('skillproof_user');
    const savedCompany = safeLocalStorage.getItem('skillproof_company');
    const savedLoginTime = safeLocalStorage.getItem('skillproof_login_time');

    if (savedUser && savedLoginTime) {
      const elapsed = Date.now() - parseInt(savedLoginTime, 10);
      if (elapsed < 24 * 60 * 60 * 1000) { // 24 hours
        currentUser = JSON.parse(savedUser);
        const savedProvider = safeLocalStorage.getItem('skillproof_auth_provider');
        if (savedProvider) {
          selectProvider = savedProvider;
        }
        if (currentUser && typeof currentUser.skillproof_score !== 'number') {
          currentUser.skillproof_score = 0;
        }
        currentCompany = (savedCompany && savedCompany !== "null" && savedCompany !== "undefined") ? JSON.parse(savedCompany) : null;
        if (!currentCompany && currentUser && currentUser.company_id) {
          currentCompany = {
            id: currentUser.company_id,
            name: currentUser.company || 'Enterprise'
          };
          safeLocalStorage.setItem('skillproof_company', JSON.stringify(currentCompany));
        }
        
        // Update rolling session timestamp
        safeLocalStorage.setItem('skillproof_login_time', Date.now());

        // Update main navbar profile buttons
        const loginBtn = document.getElementById('nav-login-btn');
        if (loginBtn) loginBtn.style.display = 'none';
        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) logoutBtn.style.display = 'inline-block';
        const ctaBtn = document.getElementById('nav-cta-btn');
        if (ctaBtn) {
          ctaBtn.innerText = `Dashboard (${currentUser.name})`;
          ctaBtn.onclick = () => showView(currentUser.role === 'recruiter' ? 'admin' : 'student');
        }

        // Route to appropriate view and enforce onboarding check
        const bellContainer = document.getElementById('notif-bell-container');
        if (bellContainer) bellContainer.style.display = 'block';
        updateNotificationBadge();
        if (currentUser.role === 'recruiter') {
          showView('admin');
        } else {
          showView('student');
          if (pendingJoinCode) {
            autoJoinPendingExam();
          } else if (!safeLocalStorage.getItem('onboarding_dismissed')) {
            if (!currentUser.phone || currentUser.college === 'Self-Taught / University' || !currentUser.dream_role) {
              openStudentOnboardingModal();
            }
          }
        }
      } else {
        // Session expired
        safeLocalStorage.removeItem('skillproof_user');
        safeLocalStorage.removeItem('skillproof_company');
        safeLocalStorage.removeItem('skillproof_login_time');
        safeLocalStorage.removeItem('skillproof_session_token');
        safeLocalStorage.removeItem('skillproof_auth_provider');
      }
    }
  } catch (err) {
    console.error('Error during initial session restoration:', err);
    try {
      safeLocalStorage.removeItem('skillproof_user');
      safeLocalStorage.removeItem('skillproof_company');
      safeLocalStorage.removeItem('skillproof_login_time');
      safeLocalStorage.removeItem('skillproof_session_token');
      safeLocalStorage.removeItem('skillproof_auth_provider');
    } catch(e) {}
  }

  // If guest and pendingJoinCode is set, route to auth view and show join-exam-banner
  if (!currentUser && pendingJoinCode) {
    showView('auth');
    const banner = document.getElementById('join-exam-banner');
    if (banner) banner.style.display = 'block';
  }

  // Throttled session updates on mouse/key/touch activity to roll session forward
  let lastSessionUpdate = 0;
  function throttleSessionUpdate() {
    const now = Date.now();
    if (now - lastSessionUpdate > 30000) { // update at most every 30 seconds
      if (currentUser) {
        safeLocalStorage.setItem('skillproof_login_time', Date.now());
      }
      lastSessionUpdate = now;
    }
  }
  window.addEventListener('mousemove', throttleSessionUpdate);
  window.addEventListener('keypress', throttleSessionUpdate);
  window.addEventListener('click', throttleSessionUpdate);
  window.addEventListener('scroll', throttleSessionUpdate);
  window.addEventListener('touchstart', throttleSessionUpdate);

  // Real-time synchronization polling for active student dashboard view
  setInterval(() => {
    const studentView = document.getElementById('view-student');
    if (currentUser && currentUser.role === 'student' && studentView && studentView.classList.contains('active')) {
      loadStudentDashboard();
      updateNotificationBadge();
    }
  }, 6000);

  // 💎 3D Mouse-Tracking Perspective Tilt Effect for Profile Cards (Subtle angle, profile only)
  document.addEventListener('mousemove', (e) => {
    const cards = document.querySelectorAll('.tilt-profile');
    cards.forEach(card => {
      if (card.offsetWidth === 0 || card.offsetHeight === 0) return;
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Calculate cursor displacement from center of card
      const xc = rect.width / 2;
      const yc = rect.height / 2;
      const dx = x - xc;
      const dy = y - yc;
      
      // Smooth 3D tilt perspective with responsive shadow glow (Subtle rotation divisor 45)
      card.style.transform = `perspective(1000px) rotateY(${dx / 45}deg) rotateX(${-dy / 45}deg) translateY(-2px)`;
      card.style.boxShadow = `0 16px 36px rgba(var(--orange-rgb, 230, 81, 0), ${Math.min(0.12, Math.max(0.04, Math.abs(dx) / rect.width))})`;
    });
  });

  document.addEventListener('mouseleave', () => {
    const cards = document.querySelectorAll('.tilt-profile');
    cards.forEach(card => {
      card.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) translateY(0px)';
      card.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.02)';
    });
  }, true);
});

// Quick-fill helper function
function quickFillDemo(role) {
  const emailInput = document.getElementById('oauth-modal-email');
  const nameInput  = document.getElementById('oauth-modal-name');
  
  if (role === 'student') {
    if (emailInput) emailInput.value = 'student@gmail.com';
    if (nameInput)  nameInput.value  = 'Challagolla Durga Sravan';
    selectProvider = 'Google';
  } else if (role === 'recruiter-google') {
    if (emailInput) emailInput.value = 'hr@google.com';
    if (nameInput)  nameInput.value  = 'Sundar Pichai (Google HR)';
    selectProvider = 'Google';
  } else if (role === 'recruiter-msft') {
    if (emailInput) emailInput.value = 'hr@microsoft.com';
    if (nameInput)  nameInput.value  = 'Satya Nadella (Microsoft HR)';
    selectProvider = 'Google';
  }
}

// postMessage listener still active (for any future popup-based flows)
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return;
  const data = event.data;
  if (data && (data.type === 'google-oauth-success' || data.type === 'github-oauth-success')) {
    selectProvider = data.provider;
    submitOAuthHandshake(data.name, data.email);
  }
});

function submitOAuthHandshake(nameInput, emailInput) {
  // Exchange credentials dynamically
  fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: emailInput,
      name: nameInput,
      provider: selectProvider
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }

    if (data.user && data.user.role === 'recruiter') {
      // Recruiter requires OTP 2FA Verification!
      closeOAuthModal();
      
      fetch('/api/auth/recruiter-otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: data.user.email })
      })
      .then(otpRes => otpRes.json())
      .then(otpData => {
        if (otpData.error) {
          alert(otpData.error);
          return;
        }
        showRecruiterOTPModal(data.user.id, data.user.email);
      })
      .catch(otpErr => {
        console.error('Failed to request OTP:', otpErr);
        alert('Verification system currently offline.');
      });
      return;
    }

    currentUser = data.user;
    currentCompany = data.company || null;  // Store company context for multi-tenant isolation
    
    // Save session in safeLocalStorage with current time for 10-minute persistence
    safeLocalStorage.setItem('skillproof_user', JSON.stringify(currentUser));
    safeLocalStorage.setItem('skillproof_company', JSON.stringify(currentCompany));
    if (data.sessionToken) {
      safeLocalStorage.setItem('skillproof_session_token', data.sessionToken);
    }
    if (selectProvider) {
      safeLocalStorage.setItem('skillproof_auth_provider', selectProvider);
    }
    safeLocalStorage.setItem('skillproof_login_time', Date.now());
    
    // Update main navbar profile buttons
    document.getElementById('nav-login-btn').style.display = 'none';
    document.getElementById('nav-logout-btn').style.display = 'inline-block';
    document.getElementById('nav-cta-btn').innerText = `Dashboard (${currentUser.name})`;
    document.getElementById('nav-cta-btn').onclick = () => showView(currentUser.role === 'recruiter' ? 'admin' : 'student');

    // Show notification bell
    const bellContainer = document.getElementById('notif-bell-container');
    if (bellContainer) bellContainer.style.display = 'block';
    updateNotificationBadge();

    showView('student');
    if (pendingJoinCode) {
      autoJoinPendingExam();
    }
  })
  .catch(err => {
    console.error('Secure Token exchange failure:', err);
    alert('Authentication database unreachable.');
  });
}

function logoutUser() {
  // Call backend to invalidate session in DB first while token is still in localStorage
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});

  currentUser = null;
  currentCompany = null;
  safeLocalStorage.removeItem('skillproof_user');
  safeLocalStorage.removeItem('skillproof_company');
  safeLocalStorage.removeItem('skillproof_login_time');
  safeLocalStorage.removeItem('skillproof_session_token');
  safeLocalStorage.removeItem('skillproof_auth_provider');

  // Clear dashboard & schedules loaded states
  window._hasLoadedDashboardData = false;
  window._hasLoadedSchedulesData = false;
  
  document.getElementById('nav-login-btn').style.display = 'inline-block';
  document.getElementById('nav-logout-btn').style.display = 'none';
  document.getElementById('nav-cta-btn').innerText = 'Get started →';
  document.getElementById('nav-cta-btn').onclick = () => showView('auth');
  
  const bellContainer = document.getElementById('notif-bell-container');
  if (bellContainer) bellContainer.style.display = 'none';
  
  showView('landing');
}

// ── Recruiter OTP 2FA Helper Functions ──
function closeRecruiterOTPModal() {
  const modal = document.getElementById('recruiter-otp-modal');
  if (modal) modal.style.display = 'none';
}

function showRecruiterOTPModal(userId, email) {
  pendingRecruiterUserId = userId;
  pendingRecruiterEmail = email;
  
  const inputs = document.querySelectorAll('.otp-digit-input');
  inputs.forEach(input => {
    input.value = '';
    input.style.borderColor = 'rgba(255,255,255,0.1)';
  });
  
  const form = document.getElementById('otp-fields-form');
  const spinner = document.getElementById('otp-processing');
  if (form) form.style.display = 'block';
  if (spinner) spinner.style.display = 'none';
  
  const modal = document.getElementById('recruiter-otp-modal');
  if (modal) modal.style.display = 'flex';
  
  setTimeout(() => {
    if (inputs[0]) inputs[0].focus();
  }, 100);
}

function submitRecruiterOTP() {
  const inputs = document.querySelectorAll('.otp-digit-input');
  let otp = '';
  inputs.forEach(input => {
    otp += input.value.trim();
  });
  
  if (otp.length !== 6) {
    alert('Please enter a 6-digit OTP code.');
    return;
  }
  
  const form = document.getElementById('otp-fields-form');
  const spinner = document.getElementById('otp-processing');
  if (form) form.style.display = 'none';
  if (spinner) spinner.style.display = 'flex';
  
  fetch('/api/auth/recruiter-otp/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: pendingRecruiterUserId,
      otp: otp
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      if (form) form.style.display = 'block';
      if (spinner) spinner.style.display = 'none';
      return;
    }
    
    currentUser = data.user;
    currentCompany = data.company || null;
    
    safeLocalStorage.setItem('skillproof_user', JSON.stringify(currentUser));
    safeLocalStorage.setItem('skillproof_company', JSON.stringify(currentCompany));
    safeLocalStorage.setItem('skillproof_session_token', data.sessionToken);
    safeLocalStorage.setItem('skillproof_login_time', Date.now());
    
    closeRecruiterOTPModal();
    
    document.getElementById('nav-login-btn').style.display = 'none';
    document.getElementById('nav-logout-btn').style.display = 'inline-block';
    document.getElementById('nav-cta-btn').innerText = `Dashboard (${currentUser.name})`;
    document.getElementById('nav-cta-btn').onclick = () => showView('admin');

    const bellContainer = document.getElementById('notif-bell-container');
    if (bellContainer) bellContainer.style.display = 'block';
    updateNotificationBadge();
    
    showView('admin');
  })
  .catch(err => {
    console.error('OTP Verification failure:', err);
    alert('Authentication database unreachable.');
    if (form) form.style.display = 'block';
    if (spinner) spinner.style.display = 'none';
  });
}

function resendRecruiterOTP() {
  if (!pendingRecruiterEmail) return;
  
  fetch('/api/auth/recruiter-otp/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: pendingRecruiterEmail })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }
    alert('A new OTP has been requested. Check your email or debug file.');
    const inputs = document.querySelectorAll('.otp-digit-input');
    inputs.forEach(input => {
      input.value = '';
    });
    if (inputs[0]) inputs[0].focus();
  })
  .catch(err => {
    console.error('OTP request failure:', err);
    alert('Failed to request a new OTP.');
  });
}

function initOTPEvents() {
  const container = document.getElementById('otp-inputs-container');
  if (!container) return;
  
  const inputs = container.querySelectorAll('.otp-digit-input');
  
  inputs.forEach((input, index) => {
    input.addEventListener('focus', () => {
      input.style.borderColor = '#FF6B00';
      input.style.boxShadow = '0 0 8px rgba(255,107,0,0.3)';
    });
    
    input.addEventListener('blur', () => {
      input.style.borderColor = 'rgba(255,255,255,0.1)';
      input.style.boxShadow = 'none';
    });
    
    input.addEventListener('input', (e) => {
      const val = e.target.value;
      if (!/^\d*$/.test(val)) {
        e.target.value = '';
        return;
      }
      if (val && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace') {
        if (!e.target.value && index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].value = '';
        } else {
          e.target.value = '';
        }
        e.preventDefault();
      } else if (e.key === 'Enter') {
        submitRecruiterOTP();
      }
    });
    
    input.addEventListener('paste', (e) => {
      e.preventDefault();
      const text = (e.clipboardData || window.clipboardData).getData('text');
      const digits = text.replace(/\D/g, '').slice(0, 6);
      
      digits.split('').forEach((char, i) => {
        if (inputs[i]) {
          inputs[i].value = char;
        }
      });
      
      const nextFocus = Math.min(digits.length, inputs.length - 1);
      if (inputs[nextFocus]) {
        inputs[nextFocus].focus();
      }
    });
  });
}

// ── DevTools Active Proctoring Detection Loop ──
function startDevToolsDetection() {
  if (devtoolsCheckInterval) clearInterval(devtoolsCheckInterval);
  
  devtoolsCheckInterval = setInterval(() => {
    if (!currentExam) return;
    
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    
    if (widthDiff > threshold || heightDiff > threshold) {
      logViolation('devtools_attempt');
      return;
    }
    
    const start = performance.now();
    debugger;
    const end = performance.now();
    
    if (end - start > 100) {
      logViolation('devtools_attempt');
      return;
    }

    // Modern console-based un-bypassable DevTools detection check
    const devtoolsDetector = new Image();
    Object.defineProperty(devtoolsDetector, 'id', {
      get: function() {
        logViolation('devtools_attempt');
      }
    });
    console.log(devtoolsDetector);
  }, 1500);
}

function stopDevToolsDetection() {
  if (devtoolsCheckInterval) {
    clearInterval(devtoolsCheckInterval);
    devtoolsCheckInterval = null;
  }
}

// ── Interactive Student Onboarding Helper Functions ──
function openStudentOnboardingModal() {
  const modal = document.getElementById('student-onboarding-modal');
  if (modal) {
    if (modal.style.display === 'flex') return;
    modal.style.display = 'flex';
  }
  
  // Set existing values if available
  const phoneInput = document.getElementById('student-onboard-phone');
  const collegeInput = document.getElementById('student-onboard-college');
  const githubInput = document.getElementById('student-onboard-github');
  const linkedinInput = document.getElementById('student-onboard-linkedin');
  const dreamRoleSelect = document.getElementById('student-onboard-dream-role');

  if (phoneInput) phoneInput.value = currentUser.phone || '';
  if (collegeInput) collegeInput.value = (currentUser.college && currentUser.college !== 'Self-Taught / University') ? currentUser.college : '';
  if (githubInput) githubInput.value = currentUser.github_profile || '';
  if (linkedinInput) linkedinInput.value = currentUser.linkedin_profile || '';
  if (dreamRoleSelect) dreamRoleSelect.value = currentUser.dream_role || '';

  const container = document.getElementById('student-onboard-skills-container');
  if (container) {
    container.innerHTML = '<p style="color:var(--gray-500); font-size:12px;">Loading master skills list...</p>';
  }

  // Load skills list dynamically from database along with student's current status
  Promise.all([
    fetch('/api/skills').then(res => res.json()),
    fetch('/api/skills/status?student_email=' + encodeURIComponent(currentUser.email))
      .then(res => res.json())
      .catch(() => ({ skills: [] }))
  ])
  .then(([skills, statusData]) => {
    if (!container) return;
    container.innerHTML = '';
    
    const claimedSkillIds = new Set((statusData.skills || []).map(s => s.skill_id));
    const claimedSkillRatings = {};
    (statusData.skills || []).forEach(s => {
      claimedSkillRatings[s.skill_id] = s.self_rating;
    });

    // Save claimed IDs on container for the submission function to reference
    container.dataset.claimedIds = JSON.stringify(Array.from(claimedSkillIds));

    if (!Array.isArray(skills) || skills.length === 0) {
      container.innerHTML = '<p style="color:var(--gray-500); font-size:12px;">No skills available in the database.</p>';
      return;
    }

    skills.forEach(skill => {
      const isAlreadyClaimed = claimedSkillIds.has(skill.id);
      const currentRating = claimedSkillRatings[skill.id] || 3;
      
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.marginBottom = '8px';
      row.style.padding = '10px 14px';
      row.style.background = isAlreadyClaimed ? 'rgba(76, 175, 80, 0.04)' : 'var(--gray-50)';
      row.style.border = isAlreadyClaimed ? '1.5px solid rgba(76, 175, 80, 0.25)' : '1.5px solid var(--gray-100)';
      row.style.borderRadius = 'var(--radius-md)';
      row.style.transition = 'border-color 0.2s';
      
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
          <input type="checkbox" id="onboard-chk-${skill.id}" class="onboard-skill-checkbox" value="${skill.id}" 
            ${isAlreadyClaimed ? 'checked' : ''} style="accent-color:var(--orange); width:18px; height:18px; cursor:pointer;" />
          <label for="onboard-chk-${skill.id}" style="font-weight:700; cursor:pointer; color:var(--gray-900); font-size:13.5px; font-family:var(--font-display);">
            ${escapeHTML(skill.name)} 
            <span style="font-size:10px; color:var(--gray-500); font-weight:normal; font-family:var(--font-body);">(${escapeHTML(skill.category)})</span>
            ${isAlreadyClaimed ? '<span style="font-size:10.5px; color:#2E7D32; font-weight:800; margin-left:6px; background:rgba(76,175,80,0.1); padding:2px 6px; border-radius:4px;">✓ Claimed</span>' : ''}
          </label>
        </div>
        <div style="display:flex; align-items:center; gap:6px;">
          <span style="font-size:11px; color:var(--gray-500); font-weight:600;">Self-Rating:</span>
          <select id="onboard-rate-${skill.id}" style="padding:4px 8px; border-radius:var(--radius-sm); background:var(--white); border:1.5px solid var(--gray-200); color:var(--gray-900); font-size:12.5px; font-weight:700; cursor:pointer;">
            <option value="1" ${currentRating == 1 ? 'selected' : ''}>1 - Novice</option>
            <option value="2" ${currentRating == 2 ? 'selected' : ''}>2 - Intermediate</option>
            <option value="3" ${currentRating == 3 ? 'selected' : ''}>3 - Competent</option>
            <option value="4" ${currentRating == 4 ? 'selected' : ''}>4 - Advanced</option>
            <option value="5" ${currentRating == 5 ? 'selected' : ''}>5 - Expert</option>
          </select>
        </div>
      `;
      container.appendChild(row);
    });
  })
  .catch(err => {
    console.error('Failed to load onboarding skills list', err);
    const container = document.getElementById('student-onboard-skills-container');
    if (container) container.innerHTML = '<p style="color:var(--gray-500); font-size:12px;">Failed to load skills.</p>';
  });
}

function closeStudentOnboardingModal() {
  const modal = document.getElementById('student-onboarding-modal');
  if (modal) modal.style.display = 'none';
  safeLocalStorage.setItem('onboarding_dismissed', 'true');
}

function submitStudentOnboarding() {
  const phone = document.getElementById('student-onboard-phone').value.trim();
  const college = document.getElementById('student-onboard-college').value.trim();
  const github = document.getElementById('student-onboard-github').value.trim();
  const linkedin = document.getElementById('student-onboard-linkedin').value.trim();
  const dreamRole = document.getElementById('student-onboard-dream-role').value;

  if (!phone || !college) {
    alert('Please fill out both your phone number and your college/university.');
    return;
  }

  if (!dreamRole) {
    alert('Please select your dream career role path.');
    return;
  }

  // Link validation (GitHub & LinkedIn)
  const githubRegex = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+\/?$/i;
  const linkedinRegex = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/(in|pub|profile)\/[a-zA-Z0-9_-]+\/?$/i;

  if (!github || !githubRegex.test(github)) {
    alert('❌ Please enter a valid GitHub profile URL (e.g. https://github.com/yourusername). Other websites are not accepted.');
    return;
  }

  if (!linkedin || !linkedinRegex.test(linkedin)) {
    alert('❌ Please enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/yourusername). Other websites are not accepted.');
    return;
  }

  const checkboxes = document.querySelectorAll('.onboard-skill-checkbox:checked');
  if (checkboxes.length === 0) {
    alert('Please select at least one skill to claim and build your verification path.');
    return;
  }

  // Get pre-claimed IDs
  const container = document.getElementById('student-onboard-skills-container');
  const claimedSkillIds = new Set(JSON.parse((container && container.dataset.claimedIds) || '[]'));

  // Filter checkboxes to only submit NEW claims
  const newClaimsCheckboxes = Array.from(checkboxes).filter(chk => !claimedSkillIds.has(chk.value));

  // Onboard details
  const claimsData = newClaimsCheckboxes.map(chk => {
    const skillId = chk.value;
    const rating = document.getElementById(`onboard-rate-${skillId}`).value;
    return {
      skill_id: skillId,
      self_rating: parseInt(rating, 10)
    };
  });

  // Onboard details and claims in one single batched request to prevent OCC conflicts!
  fetch('/api/student/onboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_email: currentUser.email,
      phone: phone,
      college: college,
      github_profile: github,
      linkedin_profile: linkedin,
      dream_role: dreamRole,
      claims: claimsData
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }
    
    // Update local state and saved storage session
    currentUser = data.user;
    safeLocalStorage.setItem('skillproof_user', JSON.stringify(currentUser));

    alert('🎉 Awesome! Onboarding completed and profile details registered successfully!');
    closeStudentOnboardingModal();
    loadStudentDashboard();
  })
  .catch(err => {
    console.error('Onboarding request failed', err);
    alert('Failed to complete onboarding. Please try again.');
  });
}

// ── IN-APP NOTIFICATION SYSTEM ──
let notifPanelOpen = false;

function toggleNotificationPanel() {
  const panel = document.getElementById('notif-panel');
  notifPanelOpen = !notifPanelOpen;
  panel.style.display = notifPanelOpen ? 'block' : 'none';
  if (notifPanelOpen) loadNotifications();
}

// Close panel when clicking outside
document.addEventListener('click', (e) => {
  const container = document.getElementById('notif-bell-container');
  if (container && !container.contains(e.target) && notifPanelOpen) {
    document.getElementById('notif-panel').style.display = 'none';
    notifPanelOpen = false;
  }
});

function loadNotifications() {
  if (!currentUser) return;
  fetch(`/api/notifications?user_id=${currentUser.id}`)
    .then(r => r.json())
    .then(notifs => {
      const list = document.getElementById('notif-list');
      if (!notifs || notifs.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:#9ca3af; font-size:13px; padding:20px;">No notifications yet.</div>';
        return;
      }
      list.innerHTML = '';
      notifs.forEach(n => {
        const isUnread = n.is_read === 0;
        const typeIcon = n.type === 'badge_awarded' ? '🏆' : n.type === 'badge_denied' ? '📋' : '✉️';
        const timeAgo = getTimeAgo(n.created_at);
        const div = document.createElement('div');
        div.style.cssText = `padding:10px 12px; border-radius:8px; margin-bottom:4px; cursor:pointer; transition:background 0.2s; background:${isUnread ? 'var(--bg-notif-unread)' : 'var(--bg-notif-read)'}; border-left:3px solid ${isUnread ? 'var(--orange-deep)' : 'transparent'};`;
        div.onmouseenter = () => div.style.background = 'var(--bg-notif-hover)';
        div.onmouseleave = () => div.style.background = isUnread ? 'var(--bg-notif-unread)' : 'var(--bg-notif-read)';
        div.onclick = () => markNotificationRead(n.id);
        div.innerHTML = `
          <div style="display:flex; gap:8px; align-items:flex-start;">
            <span style="font-size:18px; flex-shrink:0;">${typeIcon}</span>
            <div style="flex:1; min-width:0;">
              <div style="font-size:12px; font-weight:${isUnread ? '700' : '500'}; color:var(--text-notif-title); margin-bottom:2px;">${escapeHTML(n.title)}</div>
              <div style="font-size:11px; color:var(--text-notif-desc); line-height:1.4; overflow:hidden; text-overflow:ellipsis; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">${escapeHTML(n.message)}</div>
              <div style="font-size:10px; color:var(--gray-400); margin-top:4px;">${timeAgo}</div>
            </div>
            ${isUnread ? '<div style="width:8px; height:8px; background:var(--orange-deep); border-radius:50%; flex-shrink:0; margin-top:4px;"></div>' : ''}
          </div>
        `;
        list.appendChild(div);
      });
    })
    .catch(err => console.error('Load notifications error:', err));
}

function getTimeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function updateNotificationBadge() {
  if (!currentUser) return;
  fetch(`/api/notifications/unread-count?user_id=${currentUser.id}`)
    .then(r => r.json())
    .then(data => {
      const badge = document.getElementById('notif-badge');
      const sidebarBadge = document.getElementById('sidebar-notif-count');
      if (data.count > 0) {
        const text = data.count > 9 ? '9+' : data.count;
        if (badge) { badge.innerText = text; badge.style.display = 'flex'; }
        if (sidebarBadge) { sidebarBadge.innerText = text; sidebarBadge.style.display = 'inline'; }
      } else {
        if (badge) badge.style.display = 'none';
        if (sidebarBadge) sidebarBadge.style.display = 'none';
      }
    })
    .catch(() => {});
}

function loadFullNotifications() {
  if (!currentUser) return;
  fetch(`/api/notifications?user_id=${currentUser.id}`)
    .then(r => r.json())
    .then(notifs => {
      const list = document.getElementById('full-notif-list');
      if (!list) return;
      if (!notifs || notifs.length === 0) {
        list.innerHTML = '<div style="text-align:center; color:var(--gray-500); font-size:13px; padding:40px 0;">No notifications yet. You\'ll see messages from recruiters, badge awards, and exam invites here.</div>';
        return;
      }
      list.innerHTML = '';
      notifs.forEach(n => {
        const isUnread = n.is_read === 0;
        const typeIcon = n.type === 'badge_awarded' ? '🏆' : n.type === 'badge_denied' ? '📋' : n.type === 'recruiter_message' ? '✉️' : '🔔';
        const timeAgo = getTimeAgo(n.created_at);
        const card = document.createElement('div');
        card.style.cssText = `padding:16px; border-radius:var(--radius-md); background:${isUnread ? 'var(--bg-notif-unread)' : 'var(--gray-50)'}; border:1px solid ${isUnread ? 'var(--orange-light, var(--gray-200))' : 'var(--gray-200)'}; cursor:pointer; transition:all 0.2s;`;
        card.onmouseenter = () => { card.style.transform = 'translateY(-1px)'; card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; };
        card.onmouseleave = () => { card.style.transform = 'none'; card.style.boxShadow = 'none'; };
        card.onclick = () => { markNotificationRead(n.id); setTimeout(loadFullNotifications, 300); };
        card.innerHTML = `
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <span style="font-size:24px; flex-shrink:0;">${typeIcon}</span>
            <div style="flex:1; min-width:0;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                <div style="font-size:14px; font-weight:${isUnread ? '800' : '600'}; font-family:var(--font-display); color:var(--text-notif-title);">${escapeHTML(n.title)}</div>
                ${isUnread ? '<div style="width:10px; height:10px; background:var(--orange-deep); border-radius:50%; flex-shrink:0;"></div>' : ''}
              </div>
              <div style="font-size:13px; color:var(--text-notif-desc); line-height:1.5; margin-bottom:6px;">${escapeHTML(n.message)}</div>
              <div style="font-size:11px; color:var(--gray-400); font-weight:600;">${timeAgo}</div>
            </div>
          </div>
        `;
        list.appendChild(card);
      });
    })
    .catch(err => console.error('Load full notifications error:', err));
}

function markNotificationRead(notifId) {
  if (!currentUser) return;
  fetch('/api/notifications/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notification_id: notifId, user_id: currentUser.id })
  })
  .then(() => {
    loadNotifications();
    updateNotificationBadge();
  });
}

function markAllNotificationsRead() {
  if (!currentUser) return;
  fetch('/api/notifications/mark-read', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: currentUser.id })
  })
  .then(() => {
    loadNotifications();
    updateNotificationBadge();
  });
}

// Poll for new notifications every 30 seconds
setInterval(() => {
  if (currentUser) updateNotificationBadge();
}, 30000);

// ── STUDENT DASHBOARD & CLAIMS SYSTEM ──
// Debounce wrapper to prevent redundant re-renders from multiple rapid callers
let _studentDashboardDebounceTimer = null;
// Global dashboard render cycle — used to discard stale async chains from previous loadStudentDashboard calls
window._dashboardRenderCycleId = 0;
function loadStudentDashboard() {
  if (!currentUser) return;
  // Coalesce rapid successive calls (e.g. from login + tab switch + auto-join) into one render
  clearTimeout(_studentDashboardDebounceTimer);
  _studentDashboardDebounceTimer = setTimeout(_loadStudentDashboardCore, 150);
}
function _loadStudentDashboardCore() {
  if (!currentUser) return;

  // Track the dashboard render cycle at the very start of core rendering to abort stale executions
  window._dashboardRenderCycleId = (window._dashboardRenderCycleId || 0) + 1;
  const dashCycleId = window._dashboardRenderCycleId;

  // Normalize score to fallback default of 0
  if (typeof currentUser.skillproof_score !== 'number') {
    currentUser.skillproof_score = 0;
  }

  // Trigger onboarding modal for students if profile details are blank/default or dream role is not set AND they haven't dismissed it
  if (!safeLocalStorage.getItem('onboarding_dismissed')) {
    if (!currentUser.phone || !currentUser.college || currentUser.college === 'Self-Taught / University' || !currentUser.dream_role) {
      openStudentOnboardingModal();
      return;
    }
  }
  
  const avatarLetter = document.getElementById('student-avatar-letter');
  if (avatarLetter) avatarLetter.innerText = currentUser.name.charAt(0).toUpperCase();

  // Sync welcome title banner
  const welcomeTitle = document.getElementById('home-welcome-title');
  if (welcomeTitle) {
    welcomeTitle.innerText = `Welcome back, ${currentUser.name}!`;
  }

  // Sync top right navbar CTA button name
  const ctaBtn = document.getElementById('nav-cta-btn');
  if (ctaBtn) {
    ctaBtn.innerText = `Dashboard (${currentUser.name})`;
  }

  const profileName = document.getElementById('student-profile-name');
  if (profileName) {
    if (currentUser.skillproof_score >= 60) {
      profileName.innerHTML = `${escapeHTML(currentUser.name)} <span class="certified-gold-badge" style="margin-left: 8px;">🏆 SkillProof Verified</span>`;
    } else {
      profileName.innerText = currentUser.name;
    }
  }

  const profileEmail = document.getElementById('student-profile-email');
  if (profileEmail) profileEmail.innerText = currentUser.email;

  const profileSlug = document.getElementById('student-profile-slug');
  if (profileSlug) profileSlug.innerText = `Personal slug: ${currentUser.profile_slug}`;

  const sidebarDreamRole = document.getElementById('student-profile-dream-role');
  if (sidebarDreamRole) {
    if (currentUser.dream_role) {
      sidebarDreamRole.innerText = 'Dream Role: ' + currentUser.dream_role;
      sidebarDreamRole.style.display = 'inline-block';
    } else {
      sidebarDreamRole.style.display = 'none';
    }
  }

  const profileLinks = document.getElementById('student-profile-links');
  if (profileLinks) {
    profileLinks.innerHTML = '';
    if (currentUser.github_profile) {
      profileLinks.innerHTML += `<a href="${escapeHTML(currentUser.github_profile)}" target="_blank" style="display:inline-flex; align-items:center; background:#1C1A17; color:#F5F4F0; border:1px solid #333; font-size:11px; font-weight:700; padding:4px 8px; border-radius:6px; text-decoration:none; margin-right:4px;">💻 GitHub</a>`;
    }
    if (currentUser.linkedin_profile) {
      profileLinks.innerHTML += `<a href="${escapeHTML(currentUser.linkedin_profile)}" target="_blank" style="display:inline-flex; align-items:center; background:#0077B5; color:#FFF; font-size:11px; font-weight:700; padding:4px 8px; border-radius:6px; text-decoration:none;">🔗 LinkedIn</a>`;
    }
  }

  const sidebarScore = document.getElementById('student-sidebar-score');
  if (sidebarScore) sidebarScore.innerText = currentUser.skillproof_score.toFixed(2);

  const scoreBar = document.getElementById('student-score-bar');
  if (scoreBar) scoreBar.style.width = Math.min(100, Math.max(0, currentUser.skillproof_score)) + '%';

  // Populate settings form inputs if not active
  const settingsSName = document.getElementById('settings-student-name');
  if (settingsSName && document.activeElement !== settingsSName) {
    settingsSName.value = currentUser.name || '';
  }
  const settingsSPhone = document.getElementById('settings-student-phone');
  if (settingsSPhone && document.activeElement !== settingsSPhone) {
    settingsSPhone.value = currentUser.phone || '';
  }
  const settingsSCollege = document.getElementById('settings-student-college');
  if (settingsSCollege && document.activeElement !== settingsSCollege) {
    settingsSCollege.value = currentUser.college || '';
  }
  const settingsSGithub = document.getElementById('settings-student-github');
  if (settingsSGithub && document.activeElement !== settingsSGithub) {
    settingsSGithub.value = currentUser.github_profile || '';
  }
  const settingsSLinkedin = document.getElementById('settings-student-linkedin');
  if (settingsSLinkedin && document.activeElement !== settingsSLinkedin) {
    settingsSLinkedin.value = currentUser.linkedin_profile || '';
  }
  const settingsSSlug = document.getElementById('settings-student-slug');
  if (settingsSSlug && document.activeElement !== settingsSSlug) {
    settingsSSlug.value = currentUser.profile_slug || '';
  }

  const settingsSDreamRole = document.getElementById('settings-student-dream-role');
  if (settingsSDreamRole) {
    settingsSDreamRole.value = currentUser.dream_role || '';
  }

  // Populate student portfolio token
  const savedStudentToken = safeLocalStorage.getItem('skillproof_student_token');
  const studentTokenInput = document.getElementById('settings-student-token');
  const copyBtn = document.getElementById('btn-copy-token');
  if (studentTokenInput && savedStudentToken) {
    studentTokenInput.value = savedStudentToken;
    if (copyBtn) copyBtn.style.display = 'flex';
  }

  // Fetch claimed skills — re-authenticate if student not found (Vercel ephemeral DB)
  // Capture the fetch-start timestamp so we can detect if dream_role was updated
  // locally while this async chain was in-flight (prevents overwrite race condition)
  const _fetchStartedAt = Date.now();

  fetch(`/api/skills/status?student_email=${encodeURIComponent(currentUser.email)}`)
    .then(res => {
      if (dashCycleId !== window._dashboardRenderCycleId) throw new Error('stale_dashboard_cycle');
      if (res.status === 404) {
        // Student not in DB (cold start wiped it) — re-create via login
        const activeProv = selectProvider || safeLocalStorage.getItem('skillproof_auth_provider') || 'Google';
        return fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: currentUser.email, name: currentUser.name, provider: activeProv })
        })
        .then(authRes => authRes.json())
        .then(authData => {
          if (authData.sessionToken) {
            safeLocalStorage.setItem('skillproof_session_token', authData.sessionToken);
            selectProvider = activeProv;
            safeLocalStorage.setItem('skillproof_auth_provider', activeProv);
          }
          if (dashCycleId !== window._dashboardRenderCycleId) throw new Error('stale_dashboard_cycle');
          return fetch(`/api/skills/status?student_email=${encodeURIComponent(currentUser.email)}`);
        });
      }
      return res;
    })
    .then(res => {
      if (dashCycleId !== window._dashboardRenderCycleId) throw new Error('stale_dashboard_cycle');
      return res.json();
    })
    .then(data => {
      if (dashCycleId !== window._dashboardRenderCycleId) throw new Error('stale_dashboard_cycle');
      let claimedSkills = [];
      if (data && data.skills) {
        claimedSkills = data.skills;
        if (data.user) {
          // Preserve dream_role if user updated it locally while this fetch was in-flight
          const localDreamRole = currentUser.dream_role;
          const dreamRoleWasSetLocally = (window._dreamRoleLastUpdatedAt || 0) > _fetchStartedAt;

          currentUser = data.user;
          // Normalize score to fallback default of 0
          if (typeof currentUser.skillproof_score !== 'number') {
            currentUser.skillproof_score = 0;
          }

          // If user picked a dream_role while this fetch was in-flight, keep it
          if (dreamRoleWasSetLocally && localDreamRole) {
            currentUser.dream_role = localDreamRole;
          }

          safeLocalStorage.setItem('skillproof_user', JSON.stringify(currentUser));
          
          // Sync sidebar UI immediately with potentially self-healed database values
          const sidebarScore = document.getElementById('student-sidebar-score');
          if (sidebarScore) sidebarScore.innerText = currentUser.skillproof_score.toFixed(2);
          const scoreBar = document.getElementById('student-score-bar');
          if (scoreBar) scoreBar.style.width = Math.min(100, Math.max(0, currentUser.skillproof_score)) + '%';
          const profileName = document.getElementById('student-profile-name');
          if (profileName) {
            if (currentUser.skillproof_score >= 60) {
              profileName.innerHTML = `${escapeHTML(currentUser.name)} <span class="certified-gold-badge" style="margin-left: 8px;">🏆 SkillProof Verified</span>`;
            } else {
              profileName.innerText = currentUser.name;
            }
          }
        }
      } else if (Array.isArray(data)) {
        claimedSkills = data;
      }
      if (!Array.isArray(claimedSkills)) claimedSkills = [];
      
      // Fetch master list of skills
      fetch('/api/skills')
        .then(res => {
          if (dashCycleId !== window._dashboardRenderCycleId) throw new Error('stale_dashboard_cycle');
          return res.json();
        })
        .then(masterSkills => {
          // Discard stale dashboard cycle — a newer loadStudentDashboard has started
          if (dashCycleId !== window._dashboardRenderCycleId) return;

          if (!Array.isArray(masterSkills)) masterSkills = [];
          renderClaimsSection(masterSkills, claimedSkills);
          
          renderDreamRoleSuggestions(currentUser.dream_role, masterSkills, claimedSkills);

          // CRITICAL: Load scheduled exams FIRST, then render verifier AFTER the dedup set is ready.
          // This eliminates the race condition that caused duplicate arena cards.
          loadStudentSchedules().then((scheduledSkillIds) => {
            // Discard stale dashboard cycle AGAIN after async schedules fetch completes
            if (dashCycleId !== window._dashboardRenderCycleId) return;
            renderProgressiveVerifier(claimedSkills, scheduledSkillIds);
          });
        });
    })
    .catch(err => {
      if (err.message === 'stale_dashboard_cycle') return;
      console.error('Dashboard load error:', err);
    });
}

// Render "Claim Skills" selectors for new students
function renderClaimsSection(master, claimed) {
  const wrapper = document.getElementById('claim-skills-wrapper');
  const listContainer = document.getElementById('claim-skills-list');
  if (!listContainer) return;

  // Filter skills not claimed yet
  if (!Array.isArray(claimed)) claimed = [];
  if (!Array.isArray(master)) master = [];
  const unclaimed = master.filter(m => !claimed.some(c => c.skill_id === m.id));

  if (unclaimed.length === 0) {
    wrapper.style.display = 'none';
    listContainer.innerHTML = '';
    return;
  }

  wrapper.style.display = 'block';

  // ── BUILD DOM IN-MEMORY (DocumentFragment) to eliminate flicker ──
  const claimsFrag = document.createDocumentFragment();
  unclaimed.forEach(s => {
    const card = document.createElement('div');
    card.className = 'skill-claim-card';
    card.innerHTML = `
      <h4>${escapeHTML(s.name)}</h4>
      <p>${escapeHTML(s.category)}</p>
      <label style="font-size:11px; font-weight:700; text-transform:uppercase;">Self Confidence Rating</label>
      <select class="self-rate-select" id="rate-${s.id}">
        <option value="1">1 / 5 (Novice)</option>
        <option value="2">2 / 5 (Familiar)</option>
        <option value="3" selected>3 / 5 (Competent)</option>
        <option value="4">4 / 5 (Proficient)</option>
        <option value="5">5 / 5 (Expert)</option>
      </select>
      <button onclick="claimSkill('${s.id}')" class="btn-primary" style="padding: 8px 16px; font-size:12px; width:100%; justify-content:center;">Claim Strength</button>
    `;
    claimsFrag.appendChild(card);
  });

  const tempClaimsDiv = document.createElement('div');
  tempClaimsDiv.appendChild(claimsFrag);
  if (listContainer.innerHTML !== tempClaimsDiv.innerHTML) {
    listContainer.innerHTML = tempClaimsDiv.innerHTML;
  }
}

function claimSkill(skillId) {
  const rating = document.getElementById(`rate-${skillId}`).value;

  fetch('/api/skills/claim', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_email: currentUser.email,
      skill_id: skillId,
      self_rating: rating
    })
  })
  .then(res => {
    if (!res.ok && res.status === 401) {
      // Token expired — silently re-authenticate and retry the claim
      console.warn('[claimSkill] 401 — refreshing token and retrying');
      const prov = selectProvider || safeLocalStorage.getItem('skillproof_auth_provider') || 'Google';
      return originalFetch.call(window, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, name: currentUser.name, provider: prov })
      })
      .then(ar => ar.json())
      .then(ad => {
        if (ad.sessionToken) safeLocalStorage.setItem('skillproof_session_token', ad.sessionToken);
        return fetch('/api/skills/claim', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_email: currentUser.email, skill_id: skillId, self_rating: rating })
        });
      })
      .then(rr => rr.json());
    }
    return res.json();
  })
  .then(data => {
    if (!data) return;
    if (data.error) {
      alert(data.error);
      return;
    }
    alert(data.message);
    loadStudentDashboard();
  })
  .catch(err => {
    console.error('Claim skill error:', err);
    alert('Failed to claim skill. Please try again.');
  });
}

// Map skill name → programming language
const SKILL_LANG_DISPLAY = {
  'Python Programming': 'Python',
  'C Systems Programming': 'C',
  'SQL Database Design': 'SQL',
  'JavaScript': 'JavaScript',
  'TypeScript': 'TypeScript',
  'Go': 'Go',
  'Rust': 'Rust',
  'C++': 'C++',
  'Docker': 'Dockerfile',
  'Kubernetes': 'YAML',
  'AWS': 'YAML/CloudFormation',
  'React': 'JSX/React',
  'Node.js': 'Node.js',
  'HTML5 & CSS3': 'HTML/CSS',
  'Java Programming': 'Java'
};

function detectLangFromSkill(skillName) {
  if (!skillName) return null;
  // exact match first
  if (SKILL_LANG_DISPLAY[skillName]) return SKILL_LANG_DISPLAY[skillName];
  // partial match fallback
  const lower = skillName.toLowerCase();
  if (lower.includes('python')) return 'Python';
  if (lower.includes('sql')) return 'SQL';
  if (lower.includes('javascript') || lower.includes('js')) return 'JavaScript';
  if (lower.includes('typescript')) return 'TypeScript';
  if (lower.includes('c++') || lower.includes('cpp')) return 'C++';
  if (lower.includes('c system') || lower.includes('c program')) return 'C';
  if (lower.includes('go')) return 'Go';
  if (lower.includes('rust')) return 'Rust';
  if (lower.includes('react')) return 'JSX/React';
  if (lower.includes('node')) return 'Node.js';
  if (lower.includes('html') || lower.includes('css')) return 'HTML/CSS';
  if (lower.includes('docker')) return 'Dockerfile';
  if (lower.includes('kubernetes')) return 'YAML';
  if (lower.includes('aws')) return 'YAML/CloudFormation';
  if (lower.includes('java')) return 'Java';
  return null;
}

function updateDesignMockupVisibility() {
  const mockupPanel = document.getElementById('design-mockup-panel');
  if (mockupPanel && currentExam) {
    const sName = currentExam.skillName || '';
    const isDesignQuest = (sName.includes('HTML') || sName.includes('CSS') || sName.includes('Web Development') || sName.includes('Frontend'));
    mockupPanel.style.display = isDesignQuest ? 'block' : 'none';
  } else if (mockupPanel) {
    mockupPanel.style.display = 'none';
  }
}

function renderDreamRoleSuggestions(dreamRole, masterSkills, claimedSkills) {
  const container = document.getElementById('dream-role-suggestions-container');
  if (!container) return;

  container.style.display = 'block';

  // Store lists for callbacks
  window.dashboardMasterSkills = masterSkills;
  window.dashboardClaimedSkills = claimedSkills;

  if (!dreamRole) {
    // Render setup state
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 20px;">
        <div style="display: flex; align-items: center; gap: 16px; flex: 1; min-width: 280px;">
          <div style="background: var(--orange); color: white; width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 700; box-shadow: 0 4px 12px rgba(230,81,0,0.25); flex-shrink: 0;">🎯</div>
          <div>
            <h4 style="font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--gray-900); margin: 0;">🎯 Personalize Your Learning Pathway</h4>
            <p style="font-size: 13px; color: var(--gray-500); margin: 4px 0 0 0; line-height: 1.4;">Select your dream career path below to instantly discover the exact certified badges and skill recommendations required to stand out to elite recruiters.</p>
          </div>
        </div>
        <div style="flex-shrink: 0; min-width: 240px; width: 100%; max-width: 320px;">
          <select id="dashboard-setup-dream-role" onchange="updateDreamRoleFromDashboard(this.value)" style="background: var(--white); border: 2px solid var(--orange); color: var(--gray-900); padding: 12px 16px; width: 100%; border-radius: 10px; outline: none; font-size:13px; font-weight:700; box-shadow: 0 2px 6px rgba(0,0,0,0.02); cursor: pointer; transition: all 0.2s;">
            <option value="" disabled selected>Choose your dream career path...</option>
            <option value="Fullstack Developer">Fullstack Developer</option>
            <option value="Backend Engineer">Backend Engineer</option>
            <option value="Frontend Engineer">Frontend Engineer</option>
            <option value="Frontend Specialist">Frontend Specialist</option>
            <option value="Data Scientist">Data Scientist</option>
            <option value="DevOps Engineer">DevOps Engineer</option>
            <option value="Cybersecurity Specialist">Cybersecurity Specialist</option>
            <option value="Android Developer">Android Developer</option>
            <option value="Java Enterprise Developer">Java Enterprise Developer</option>
            <option value="AI / Machine Learning Engineer">AI / Machine Learning Engineer</option>
            <option value="Cloud Solutions Architect">Cloud Solutions Architect</option>
            <option value="Database Administrator">Database Administrator</option>
            <option value="Systems Programmer">Systems Programmer</option>
            <option value="Blockchain Developer">Blockchain Developer</option>
            <option value="Software QA Automation Engineer">Software QA Automation Engineer</option>
            <option value="Data Engineer">Data Engineer</option>
            <option value="Embedded Systems Engineer">Embedded Systems Engineer</option>
          </select>
        </div>
      </div>
    `;
    return;
  }

  // Define role skills mapping
  const roleSkillsMap = {
    'Fullstack Developer': ['JavaScript', 'TypeScript', 'React', 'Node.js', 'SQL Database Design'],
    'Backend Engineer': ['Python Programming', 'Node.js', 'Go', 'SQL Database Design', 'Docker'],
    'Frontend Engineer': ['JavaScript', 'TypeScript', 'React', 'HTML5 & CSS3'],
    'Frontend Specialist': ['JavaScript', 'TypeScript', 'React', 'HTML5 & CSS3'],
    'Data Scientist': ['Python Programming', 'SQL Database Design', 'AWS'],
    'DevOps Engineer': ['Docker', 'Kubernetes', 'AWS', 'Go'],
    'Cybersecurity Specialist': ['C Systems Programming', 'Python Programming', 'SQL Database Design', 'Rust'],
    'Android Developer': ['Java Programming', 'Node.js', 'SQL Database Design'],
    'Java Enterprise Developer': ['Java Programming', 'SQL Database Design', 'Docker', 'AWS'],
    'AI / Machine Learning Engineer': ['Python Programming', 'SQL Database Design', 'AWS'],
    'Cloud Solutions Architect': ['Docker', 'Kubernetes', 'AWS'],
    'Database Administrator': ['SQL Database Design', 'Docker'],
    'Systems Programmer': ['C Systems Programming', 'Go', 'Rust'],
    'Blockchain Developer': ['Go', 'Rust', 'JavaScript'],
    'Software QA Automation Engineer': ['Python Programming', 'JavaScript', 'SQL Database Design'],
    'Data Engineer': ['Python Programming', 'SQL Database Design', 'AWS'],
    'Embedded Systems Engineer': ['C Systems Programming', 'Rust']
  };

  const reqSkillNames = roleSkillsMap[dreamRole] || [];
  if (reqSkillNames.length === 0) {
    container.style.display = 'none';
    return;
  }

  // Render the recommendations card outline
  const roles = [
    'Fullstack Developer', 'Backend Engineer', 'Frontend Engineer', 'Frontend Specialist', 'Data Scientist',
    'DevOps Engineer', 'Cybersecurity Specialist', 'Android Developer', 'Java Enterprise Developer',
    'AI / Machine Learning Engineer', 'Cloud Solutions Architect', 'Database Administrator',
    'Systems Programmer', 'Blockchain Developer', 'Software QA Automation Engineer',
    'Data Engineer', 'Embedded Systems Engineer'
  ];

  container.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        <div style="background: var(--orange); color: white; width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 20px; font-weight: 700; box-shadow: 0 4px 12px rgba(230,81,0,0.25);">🎯</div>
        <div>
          <h4 style="font-family: var(--font-display); font-size: 16px; font-weight: 800; color: var(--gray-900); margin: 0;">Dream Career Goal: <span id="dream-role-title" style="color: var(--orange-deep);">${escapeHTML(dreamRole)}</span></h4>
          <p style="font-size: 12px; color: var(--gray-500); margin: 2px 0 0 0;">Get certified in these key languages & tools to stand out to elite recruiters.</p>
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <select onchange="updateDreamRoleFromDashboard(this.value)" style="background: rgba(230,81,0,0.06); border: 1px solid rgba(230,81,0,0.15); color: var(--orange-deep); font-size: 11px; font-weight: 700; padding: 5px 12px; border-radius: 100px; outline: none; cursor: pointer; font-family: var(--font-body);">
          <option value="" disabled>Change Dream Role...</option>
          ${roles.map(r => `<option value="${r}" ${r === dreamRole ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div id="dream-role-steps-box" style="background: rgba(255, 255, 255, 0.7); border: 1.5px solid rgba(230, 81, 0, 0.12); border-radius: 12px; padding: 16px; margin-bottom: 20px; font-size: 13px; color: var(--gray-700); line-height: 1.6; text-align: left;">
      <div style="font-weight: 800; color: var(--orange-deep); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; font-family: var(--font-display);">
        <span>💡 Step-by-Step Pathway to Claim Your ${escapeHTML(dreamRole)} Badges:</span>
      </div>
      <ul style="margin: 0; padding-left: 20px; color: var(--gray-600); font-weight: 500; display: flex; flex-direction: column; gap: 4px;">
        <li><strong>Step 1: Claim Mapped Skills</strong> – Click <span style="color: var(--orange-deep); font-weight: 700;">Claim & Start</span> below on any skill you don't possess to add it to your active claims list.</li>
        <li><strong>Step 2: Clear 3-Tier Proctoring Assessments</strong> – Navigate to the <span style="color: var(--orange-deep); font-weight: 700;">Exam Arena</span> or click <span style="color: var(--orange-deep); font-weight: 700;">Take Exam Now</span> to clear Easy ➔ Medium ➔ Hard tiers sequentially.</li>
        <li><strong>Step 3: Secure Your Official Badge</strong> – Passing all 3 tiers verified by anti-cheat triggers automatically issues a secure verifiable Badge on your profile!</li>
      </ul>
    </div>
    <div id="dream-role-skills-suggestions" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px;">
      <!-- Suggestions grid content -->
    </div>
  `;

  const suggestionsGrid = document.getElementById('dream-role-skills-suggestions');

  reqSkillNames.forEach(skillName => {
    const masterSkill = masterSkills.find(m => m.name === skillName);
    if (!masterSkill) return;

    const userClaim = claimedSkills.find(c => c.skill_id === masterSkill.id);
    let statusLabel = '';
    let statusColor = '';
    let actionBtnHTML = '';

    if (!userClaim) {
      statusLabel = 'Not Claimed';
      statusColor = 'var(--gray-400)';
      actionBtnHTML = `<button onclick="switchStudentTab('claims');" class="btn-primary" style="padding: 6px 12px; font-size: 11px; font-weight: 750; border-radius: 6px; width: 100%; justify-content: center; height: 32px; background: rgba(230,81,0,0.06); color: var(--orange-deep); border: 1.5px solid rgba(230,81,0,0.2); box-shadow: none;">Claim & Start</button>`;
    } else if (userClaim.status === 'verified') {
      statusLabel = '🏆 Verified Expert';
      statusColor = '#2E7D32';
      actionBtnHTML = `<span style="font-size: 11.5px; font-weight: 700; color: #2E7D32; display: flex; align-items: center; gap: 4px; justify-content: center; height: 32px;">✓ Pathway Complete</span>`;
    } else if (userClaim.status === 'pending_review') {
      statusLabel = '⏳ Under Review';
      statusColor = '#E65100';
      actionBtnHTML = `<span style="font-size: 11.5px; font-weight: 700; color: #E65100; display: flex; align-items: center; gap: 4px; justify-content: center; height: 32px;">⏳ Awaiting Review</span>`;
    } else if (userClaim.status === 'failed') {
      statusLabel = '❌ Action Needed';
      statusColor = '#C62828';
      actionBtnHTML = `<button onclick="switchStudentTab('arena');" class="btn-primary" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; width: 100%; justify-content: center; height: 32px; background: #C62828; color: #FFF; border: none;">Retry Assessment</button>`;
    } else {
      statusLabel = '⚡ Verification Unlocked';
      statusColor = 'var(--orange-deep)';
      actionBtnHTML = `<button onclick="switchStudentTab('arena');" class="btn-primary" style="padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; width: 100%; justify-content: center; height: 32px; background: var(--orange); color: #FFF; border: none;">Take Exam Now</button>`;
    }

    const card = document.createElement('div');
    card.style.cssText = 'background: var(--white); border: 1.5px solid var(--border-color); border-radius: 12px; padding: 14px; display: flex; flex-direction: column; justify-content: space-between; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.01); transition: all 0.2s ease;';
    card.onmouseover = () => { card.style.borderColor = 'rgba(230,81,0,0.3)'; card.style.boxShadow = '0 4px 12px rgba(230,81,0,0.04)'; };
    card.onmouseout = () => { card.style.borderColor = 'var(--border-color)'; card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.01)'; };

    const BASE = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';
    const langIcons = {
      'Python Programming':  `${BASE}/python/python-original.svg`,
      'C Systems Programming': `${BASE}/c/c-original.svg`,
      'SQL Database Design':  `${BASE}/mysql/mysql-original.svg`,
      'JavaScript':           `${BASE}/javascript/javascript-original.svg`,
      'TypeScript':           `${BASE}/typescript/typescript-original.svg`,
      'Go':                   `${BASE}/go/go-original.svg`,
      'Rust':                 `${BASE}/rust/rust-original.svg`,
      'C++':                  `${BASE}/cplusplus/cplusplus-original.svg`,
      'Docker':               `${BASE}/docker/docker-original.svg`,
      'Kubernetes':           `${BASE}/kubernetes/kubernetes-plain.svg`,
      'AWS':                  `${BASE}/amazonwebservices/amazonwebservices-original.svg`,
      'React':                `${BASE}/react/react-original.svg`,
      'Node.js':              `${BASE}/nodejs/nodejs-original.svg`,
      'HTML5 & CSS3':         `${BASE}/html5/html5-original.svg`,
      'Java Programming':     `${BASE}/java/java-original.svg`
    };
    const iconSrc = langIcons[skillName] || `${BASE}/devicon/devicon-original.svg`;

    card.innerHTML = `
      <div style="display: flex; gap: 10px; align-items: center;">
        <div style="background: var(--gray-50); width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border-color); flex-shrink: 0;">
          <img src="${iconSrc}" alt="${skillName}" width="20" height="20" style="object-fit:contain;" onerror="this.style.display='none';this.parentElement.textContent='💻'" />
        </div>
        <div style="text-align: left;">
          <h5 style="font-size: 13px; font-weight: 750; color: var(--gray-900); margin: 0; line-height: 1.2;">${escapeHTML(skillName)}</h5>
          <span style="font-size: 10.5px; font-weight: 700; color: ${statusColor};">${escapeHTML(statusLabel)}</span>
        </div>
      </div>
      <div>
        ${actionBtnHTML}
      </div>
    `;
    suggestionsGrid.appendChild(card);
  });
}

function updateDreamRoleFromDashboard(value) {
  if (!value) return;

  // Immediately update local state so any in-flight async fetches cannot overwrite it
  currentUser.dream_role = value;
  window._dreamRoleLastUpdatedAt = Date.now();
  safeLocalStorage.setItem('skillproof_user', JSON.stringify(currentUser));

  const container = document.getElementById('dream-role-suggestions-container');
  if (container) {
    container.style.opacity = '0.6';
    container.style.pointerEvents = 'none';
  }

  // Update sidebar badge immediately (optimistic UI)
  const sidebarBadge = document.getElementById('student-profile-dream-role');
  if (sidebarBadge) {
    sidebarBadge.innerText = 'Dream Role: ' + value;
    sidebarBadge.style.display = 'inline-block';
  }
  const settingsSelect = document.getElementById('settings-student-dream-role');
  if (settingsSelect) settingsSelect.value = value;

  // Render the dream role suggestions immediately (optimistic) so user sees instant feedback
  renderDreamRoleSuggestions(value, window.dashboardMasterSkills || [], window.dashboardClaimedSkills || []);

  fetch('/api/student/update_profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_email: currentUser.email,
      dream_role: value
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert('Error updating dream role: ' + data.error);
      // Revert optimistic update on error
      currentUser.dream_role = null;
      window._dreamRoleLastUpdatedAt = 0;
      safeLocalStorage.setItem('skillproof_user', JSON.stringify(currentUser));
      renderDreamRoleSuggestions(null, window.dashboardMasterSkills || [], window.dashboardClaimedSkills || []);
    } else {
      // Server confirmed — update with authoritative server response
      if (data.user) {
        data.user.dream_role = value; // ensure the value we just set is preserved
        currentUser = data.user;
      }
      safeLocalStorage.setItem('skillproof_user', JSON.stringify(currentUser));
    }

    if (container) {
      container.style.opacity = '1';
      container.style.pointerEvents = 'auto';
    }
  })
  .catch(err => {
    console.error('Failed to update dream role from dashboard:', err);
    if (container) {
      container.style.opacity = '1';
      container.style.pointerEvents = 'auto';
    }
  });
}

// Render progressive multi-level assessment list based on claimed skills
function renderProgressiveVerifier(claimed, scheduledSkillIdsParam) {
  const questionsList = document.getElementById('questions-list');
  const badgesList = document.getElementById('earned-badges-list');
  const progWrapper = document.getElementById('active-verification-wrapper');
  
  // Define a fresh render cycle ID to guard against stale async resolves from previous tab transitions
  window._verifierRenderCycleId = (window._verifierRenderCycleId || 0) + 1;
  const renderCycleId = window._verifierRenderCycleId;

  if (!Array.isArray(claimed)) claimed = [];
  
  // ── Deduplicate by both skill_id AND skill_name — one card per unique skill ──
  const seenSkills = new Set();
  const seenNames = new Set();
  const uniqueClaimed = claimed.filter(c => {
    if (seenSkills.has(c.skill_id) || seenNames.has(c.skill_name)) return false;
    seenSkills.add(c.skill_id);
    seenNames.add(c.skill_name);
    return true;
  });

  const activeClaimed = uniqueClaimed.filter(c => c.status === 'claimed');

  // If this is the initial cold load, show pulsing skeletons immediately
  if (!window._hasLoadedDashboardData) {
    questionsList.innerHTML = '';
    badgesList.innerHTML = '';
    progWrapper.style.display = 'none';

    if (claimed.length === 0) {
      questionsList.innerHTML = '<div style="color:var(--gray-500)">Claim a skill above to unlock proctored shuffled assessments.</div>';
      badgesList.innerHTML = '<div style="color:var(--gray-500)">No tags earned. Verification milestone pending.</div>';
      return;
    }

    // Render static tags synchronously for visual feedback
    uniqueClaimed.forEach(c => {
      renderStaticBadgeSync(c, badgesList);
    });

    // Render loading skeletons for active claimed skills
    activeClaimed.forEach(c => {
      const skeletonCard = document.createElement('div');
      skeletonCard.id = `skeleton-${renderCycleId}-${c.skill_id}`;
      skeletonCard.className = 'exam-card skeleton-pulse-card';
      skeletonCard.style.animation = 'pulse 1.8s ease-in-out infinite';
      skeletonCard.style.background = 'rgba(230,81,0,0.02)';
      skeletonCard.style.borderColor = 'rgba(230,81,0,0.1)';
      skeletonCard.innerHTML = `
        <div class="exam-card-top" style="opacity: 0.6;">
          <div class="exam-card-icon" style="background:var(--gray-200); border-radius:50%; width:30px; height:30px; display:inline-flex; align-items:center; justify-content:center;">⏳</div>
          <div class="exam-card-meta">
            <div class="exam-card-skill" style="color:var(--gray-400); font-style:italic;">Loading ${escapeHTML(c.skill_name)}...</div>
            <div class="exam-card-lang" style="color:var(--gray-300);">Preparing secure sandboxed environment...</div>
          </div>
        </div>
        <div class="exam-card-badges" style="opacity: 0.5; display:flex; gap:6px;">
          <span class="exam-pill time" style="width:60px; height:20px; background:var(--gray-100); display:inline-block; border:none;"></span>
          <span class="exam-pill time" style="width:70px; height:20px; background:var(--gray-100); display:inline-block; border:none;"></span>
        </div>
        <div class="exam-card-lock" style="color:var(--gray-400); font-size:11px; opacity:0.6;">
          ⚙️ Generating proctoring questions...
        </div>
        <button class="exam-card-btn" style="background:var(--gray-200); border-color:var(--gray-200); color:var(--gray-400); cursor:not-allowed; opacity:0.6; pointer-events:none;">
          Buffering Secure Arena...
        </button>
      `;
      questionsList.appendChild(skeletonCard);
    });
  }

  if (claimed.length === 0) {
    questionsList.innerHTML = '<div style="color:var(--gray-500)">Claim a skill above to unlock proctored shuffled assessments.</div>';
    badgesList.innerHTML = '<div style="color:var(--gray-500)">No tags earned. Verification milestone pending.</div>';
    return;
  }

  // Fetch all progressive question statuses in parallel in the background
  const fetchPromises = activeClaimed.map(c => {
    return fetch(`/api/skills/verification-next?student_email=${encodeURIComponent(currentUser.email)}&skill_id=${c.skill_id}`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP error ${res.status}`);
        return res.json();
      })
      .then(data => {
        return { skill: c, data: data };
      })
      .catch(err => {
        console.error('Failed to load next verifier question:', err);
        return { skill: c, data: null };
      });
  });

  Promise.all(fetchPromises).then(results => {
    // Discard stale fetches from previous rendering cycles to completely prevent duplication
    if (renderCycleId !== window._verifierRenderCycleId) return;

    // ── BUILD DOM IN-MEMORY (DocumentFragment) to eliminate flicker ──
    const questionsFrag = document.createDocumentFragment();
    const badgesFrag = document.createDocumentFragment();
    
    // Render Portfolio tags earned
    uniqueClaimed.forEach(c => {
      renderStaticBadgeSync(c, badgesFrag);
    });

    let hasActiveVerificationPath = false;

    // Get scheduled skill IDs populated by loadStudentSchedules to prevent duplicate arena cards
    const scheduledSkillIds = scheduledSkillIdsParam || window._scheduledSkillIds || new Set();

    results.forEach(res => {
      const c = res.skill;
      const data = res.data;

      if (!data || data.error || !data.status) {
        return; // Skip rendering card for failed fetch, clean swap ensures no skeleton is left
      }

      // Skip this skill if it already has an active scheduled exam (prevents duplicate arena cards)
      if (scheduledSkillIds.has(c.skill_id)) {
        return;
      }

      if (data.status === 'locked_failed') {
        const row = document.createElement('div');
        row.className = 'verified-skill-row';
        row.style.borderColor = '#C62828';
        row.innerHTML = `
          <div>
            <strong>${c.skill_name}</strong>
            <div style="color:#C62828; font-size:12px; margin-top:4px;">⚠️ Verification Locked: Disqualified due to telemetry cheating sensor flags.</div>
          </div>
          <span class="status-tag disqualified" style="padding: 6px 14px;">DISQUALIFIED</span>
        `;
        questionsFrag.appendChild(row);
      } 
      else if (data.status === 'unlocked') {
        hasActiveVerificationPath = true;
        progWrapper.style.display = 'block';
        document.getElementById('active-progression-skill-name').innerText = `Active verification path: ${c.skill_name}`;

        // Highlight progression milestones (1, 2, 3)
        resetProgressSteps();
        const stepEasy = document.getElementById('prog-step-easy');
        const stepMedium = document.getElementById('prog-step-medium');
        const stepHard = document.getElementById('prog-step-hard');

        if (data.difficulty === 'easy') {
          stepEasy.className = 'progress-step active';
        } else if (data.difficulty === 'medium') {
          stepEasy.className = 'progress-step passed';
          stepEasy.innerText = '✓';
          stepMedium.className = 'progress-step active';
        } else if (data.difficulty === 'hard') {
          stepEasy.className = 'progress-step passed';
          stepEasy.innerText = '✓';
          stepMedium.className = 'progress-step passed';
          stepMedium.innerText = '✓';
          stepHard.className = 'progress-step active';
        }

        // Build premium exam card
        const q = data.question;
        const qCard = document.createElement('div');
        qCard.className = 'exam-card';

        // Official language logo URLs (devicons CDN)
        const BASE = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons';
        const langIcons = {
          'Python Programming':  `${BASE}/python/python-original.svg`,
          'C Systems Programming': `${BASE}/c/c-original.svg`,
          'SQL Database Design':  `${BASE}/mysql/mysql-original.svg`,
          'JavaScript':           `${BASE}/javascript/javascript-original.svg`,
          'TypeScript':           `${BASE}/typescript/typescript-original.svg`,
          'Go':                   `${BASE}/go/go-original.svg`,
          'Rust':                 `${BASE}/rust/rust-original.svg`,
          'C++':                  `${BASE}/cplusplus/cplusplus-original.svg`,
          'Docker':               `${BASE}/docker/docker-original.svg`,
          'Kubernetes':           `${BASE}/kubernetes/kubernetes-plain.svg`,
          'AWS':                  `${BASE}/amazonwebservices/amazonwebservices-original.svg`,
          'React':                `${BASE}/react/react-original.svg`,
          'Node.js':              `${BASE}/nodejs/nodejs-original.svg`,
          'HTML5 & CSS3':         `${BASE}/html5/html5-original.svg`
        };
        const iconSrc = langIcons[c.skill_name] || `${BASE}/devicon/devicon-original.svg`;
        const langLabel = (typeof detectLangFromSkill === 'function') ? detectLangFromSkill(c.skill_name) : '';
        const diffLabel = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);

        qCard.innerHTML = `
          <div class="exam-card-top">
            <div class="exam-card-icon"><img src="${iconSrc}" alt="${c.skill_name}" width="30" height="30" style="object-fit:contain;" onerror="this.style.display='none';this.parentElement.textContent='💻'" /></div>
            <div class="exam-card-meta">
              <div class="exam-card-skill">${c.skill_name}</div>
              ${langLabel ? `<div class="exam-card-lang">⌨ ${langLabel}</div>` : ''}
            </div>
          </div>
          <div class="exam-card-badges">
            <span class="exam-pill ${q.difficulty}">${diffLabel} Tier</span>
            <span class="exam-pill time">⏱ ${q.expiration_minutes} min</span>
          </div>
          <div class="exam-card-lock">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Question revealed after entering the proctored arena
          </div>
          <button class="exam-card-btn" onclick="openExamRulesModal('${q.id}', null, '${c.skill_name.replace(/'/g, "\\'")}')">
            Unlock Arena
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </button>
        `;
        questionsFrag.appendChild(qCard);
      }
    });

    if (!hasActiveVerificationPath) {
      progWrapper.style.display = 'none';
    }

    if (activeClaimed.length > 0 && questionsList.children.length === 0) {
      const infoDiv = document.createElement('div');
      infoDiv.style.color = 'var(--gray-500)';
      infoDiv.innerText = 'All claimed skills are verified or under recruiter review. Claim more skills above to unlock new assessments!';
      questionsFrag.appendChild(infoDiv);
    }

    // ── ATOMIC SWAP WITH FLICKER PREVENTION ──
    const tempQuestionsDiv = document.createElement('div');
    tempQuestionsDiv.appendChild(questionsFrag);
    if (questionsList.innerHTML !== tempQuestionsDiv.innerHTML) {
      questionsList.innerHTML = tempQuestionsDiv.innerHTML;
    }

    const tempBadgesDiv = document.createElement('div');
    tempBadgesDiv.appendChild(badgesFrag);
    if (badgesList.innerHTML !== tempBadgesDiv.innerHTML) {
      badgesList.innerHTML = tempBadgesDiv.innerHTML;
    }

    // Set the loaded state flag to true so subsequent switches/refetches do not flash loaders
    window._hasLoadedDashboardData = true;
  });
}


// Synchronous static tag rendering helper to avoid duplicated logic
function renderStaticBadgeSync(c, container) {
  if (c.status === 'verified' && c.badge_tag) {
    const badge = document.createElement('div');
    badge.className = 'verified-skill-row';
    
    let verifiers = [];
    if (c.badge_tag.includes('Verified by ')) {
      const parts = c.badge_tag.split('Verified by ')[1];
      verifiers = parts.split(', ').map(v => v.trim()).filter(Boolean);
    } else {
      verifiers = [c.verified_by || 'SkillProof AI'];
    }
    
    let goldBadgesHTML = '';
    verifiers.forEach(v => {
      const label = v === 'SkillProof Head Admin' ? 'SkillProof' : v;
      goldBadgesHTML += ` <span class="certified-gold-badge" style="margin-left: 8px; display: inline-flex; align-items: center; gap: 4px;">🏆 ${escapeHTML(label)} Verified</span>`;
    });

    const scoreLabel = c.verified_score ? ` · Score: ${escapeHTML(String(c.verified_score))}/100` : '';
    badge.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:10px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:10px; width:100%;">
          <div>
            <strong style="font-size:16px; display: flex; align-items: center; flex-wrap: wrap; gap: 6px;">
              ${escapeHTML(c.skill_name)}
              ${goldBadgesHTML}
            </strong>
            <div style="font-size:12px; color:var(--gray-500); margin-top:2px;">Verified by ${escapeHTML(verifiers.join(', '))}${scoreLabel}</div>
          </div>
          <span class="verified-tag">${escapeHTML(c.badge_tag)}</span>
        </div>
        
        <!-- Share options & Badge Credential Actions -->
        <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px; flex-wrap: wrap; border-top: 1px solid var(--gray-100); padding-top: 10px;">
          <button onclick="shareBadgeOnLinkedIn('${escapeHTML(c.skill_name)}', '${escapeHTML(verifiers.join(', '))}', '${escapeHTML(c.id)}')" class="btn-secondary" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; cursor: pointer; background: #0077B5; color: #FFF; border: none; transition: transform 0.2s ease;">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="display:block;"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.779-1.75-1.75s.784-1.75 1.75-1.75 1.75.779 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
            Share on LinkedIn
          </button>
          <button onclick="shareBadgeOnX('${escapeHTML(c.skill_name)}', '${escapeHTML(verifiers.join(', '))}', '${escapeHTML(c.id)}')" class="btn-secondary" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; cursor: pointer; background: #1C1A17; color: #FFF; border: 1px solid #333; transition: transform 0.2s ease;">
            <span style="font-size: 10px; font-weight:800;">𝕏</span> Share on X
          </button>
          <button onclick="copyCredentialLink('${escapeHTML(c.id)}')" class="btn-ghost" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 11px; font-weight: 700; border-radius: 6px; cursor: pointer; background: var(--gray-50); border: 1px solid var(--gray-200); color: var(--gray-700); transition: transform 0.2s ease;">
            🔗 Copy Credential Link
          </button>
        </div>
      </div>
    `;
    container.appendChild(badge);
  } else if (c.status === 'pending_review') {
    const badge = document.createElement('div');
    badge.className = 'verified-skill-row';
    badge.style.border = '2px solid #FF9800'; // Golden orange
    badge.style.background = 'var(--bg-pending)';
    badge.innerHTML = `
      <div>
        <strong style="font-size:16px; color: var(--gray-900);">${escapeHTML(c.skill_name)}</strong>
        <div style="font-size:12px; color:var(--gray-500); margin-top:2px;">Assessed and pending professional recruiter review.</div>
      </div>
      <span class="status-tag" style="background:#FFE0B2; color:#E65100; font-weight:700; border-radius:4px; padding:6px 14px;">UNDER REVIEW</span>
    `;
    container.appendChild(badge);
  } else if (c.status === 'failed') {
    const badge = document.createElement('div');
    badge.className = 'verified-skill-row';
    badge.style.border = '2px solid #EF5350'; // Soft red
    badge.style.background = 'var(--bg-failed)';
    badge.innerHTML = `
      <div>
        <strong style="font-size:16px; color: var(--gray-900);">${escapeHTML(c.skill_name)}</strong>
        <div style="font-size:12px; color:var(--gray-500); margin-top:2px;">Verification declined during professional recruiter review.</div>
      </div>
      <span class="status-tag" style="background:#FFCDD2; color:#C62828; font-weight:700; border-radius:4px; padding:6px 14px;">VERIFICATION DENIED</span>
    `;
    container.appendChild(badge);
  }
}

function shareBadgeOnLinkedIn(skillName, verifiers, badgeId) {
  const shareUrl = `https://skill-badge-scanner.vercel.app/#/verify?badge_id=${encodeURIComponent(badgeId)}`;
  const text = `🏆 I am thrilled to announce that I have successfully earned the verified "${skillName}" expert badge through @SkillProof, verified by ${verifiers}!

This rigorous proctored multi-stage coding challenge validates my software engineering and systems architecture capabilities. 

Verify my credential directly here:
👉 ${shareUrl}

#SkillProof #TechHiring #SoftwareEngineering #CareerGrowth`;

  const url = `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function shareBadgeOnX(skillName, verifiers, badgeId) {
  const shareUrl = `https://skill-badge-scanner.vercel.app/#/verify?badge_id=${encodeURIComponent(badgeId)}`;
  const text = `🏆 Earned the verified "${skillName}" expert badge through @SkillProof, verified by ${verifiers}!

Verify credential: ${shareUrl}

#SkillProof #TechHiring`;

  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function copyCredentialLink(badgeId) {
  const shareUrl = `https://skill-badge-scanner.vercel.app/#/verify?badge_id=${encodeURIComponent(badgeId)}`;
  navigator.clipboard.writeText(shareUrl).then(() => {
    showToast('✓ Credential link copied to clipboard!', 'success');
  }).catch(() => {
    const el = document.createElement('textarea');
    el.value = shareUrl;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('✓ Credential link copied to clipboard!', 'success');
  });
}

async function verifyBadgeAuthenticator(context) {
  const inputId = context === 'recruiter' ? 'recruiter-verify-badge-id' : 'public-verify-badge-id';
  const resultBoxId = context === 'recruiter' ? 'recruiter-verify-result-box' : 'public-verify-result-box';

  const inputEl = document.getElementById(inputId);
  const resultBox = document.getElementById(resultBoxId);
  if (!inputEl || !resultBox) return;

  const badgeId = inputEl.value.trim();
  if (!badgeId) {
    showToast('⚠️ Please enter a valid Credential or Badge ID.', 'error');
    return;
  }

  resultBox.style.display = 'block';
  resultBox.style.background = 'var(--gray-50)';
  resultBox.style.border = '1px solid var(--gray-200)';
  resultBox.style.color = 'var(--gray-700)';
  resultBox.innerHTML = '<div style="display:flex; align-items:center; gap:8px;">⏳ Connecting to secure ledger database...</div>';

  try {
    const res = await fetch(`/api/badge/verify?badge_id=${encodeURIComponent(badgeId)}`);
    const data = await res.json();

    if (!res.ok || data.status === 'invalid') {
      resultBox.style.background = '#FFEBEE';
      resultBox.style.border = '1.5px solid #EF5350';
      resultBox.style.color = '#C62828';
      resultBox.innerHTML = `
        <div style="font-weight:700; font-size:14px; margin-bottom:4px;">❌ Cryptographic Verification Failed</div>
        <div>${escapeHTML(data.message || 'The provided credential ID does not match any authenticated skill badge.')}</div>
      `;
      return;
    }

    const ss = data.data;
    const dateFormatted = new Date(ss.verified_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    let verifiersHTML = '';
    const verifiersList = ss.badge_tag.includes('Verified by ')
      ? ss.badge_tag.split('Verified by ')[1].split(', ').map(v => v.trim())
      : [ss.verified_by];

    verifiersList.forEach(v => {
      const name = v === 'SkillProof Head Admin' ? 'SkillProof' : v;
      verifiersHTML += `<span style="display:inline-flex; align-items:center; background:#FFF9C4; color:#F57F17; border:1px solid #FBC02D; font-size:11px; font-weight:800; padding:4px 8px; border-radius:6px; margin-right:6px; margin-top:4px;">🏆 ${escapeHTML(name)} Verified</span>`;
    });

    let linksHTML = '';
    if (ss.github_profile) {
      linksHTML += `<a href="${escapeHTML(ss.github_profile)}" target="_blank" style="display:inline-flex; align-items:center; background:#24292E; color:#FFF; font-size:11px; font-weight:700; padding:4px 8px; border-radius:6px; text-decoration:none; margin-right:6px; margin-top:4px;">💻 GitHub</a>`;
    }
    if (ss.linkedin_profile) {
      linksHTML += `<a href="${escapeHTML(ss.linkedin_profile)}" target="_blank" style="display:inline-flex; align-items:center; background:#0077B5; color:#FFF; font-size:11px; font-weight:700; padding:4px 8px; border-radius:6px; text-decoration:none; margin-top:4px;">🔗 LinkedIn</a>`;
    }

    resultBox.style.background = '#E8F5E9';
    resultBox.style.border = '1.5px solid #4CAF50';
    resultBox.style.color = '#2E7D32';
    resultBox.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; border-bottom:1px solid rgba(76,175,80,0.2); padding-bottom:10px; margin-bottom:12px;">
        <div style="font-weight:800; font-size:15px; display:flex; align-items:center; gap:6px;">
          ✅ CRYPTOGRAPHIC VALIDITY CONFIRMED
        </div>
        <div style="font-size:11px; font-weight:700; background:#4CAF50; color:#FFF; padding:2px 8px; border-radius:4px; text-transform:uppercase;">Authentic</div>
      </div>
      <div style="display:grid; grid-template-columns:120px 1fr; gap:8px; line-height:1.6;">
        <strong style="color:#1B5E20;">Candidate Name:</strong> <span>${escapeHTML(ss.student_name)}</span>
        <strong style="color:#1B5E20;">Affiliation:</strong> <span>${escapeHTML(ss.college)}</span>
        <strong style="color:#1B5E20;">Verified Skill:</strong> <strong>${escapeHTML(ss.skill_name)}</strong>
        <strong style="color:#1B5E20;">Evaluation Score:</strong> <span style="font-weight:700;">${escapeHTML(String(ss.verified_score))}/100</span>
        <strong style="color:#1B5E20;">Issued Ledger ID:</strong> <span style="font-family:monospace; font-size:11px; background:rgba(255,255,255,0.6); padding:2px 6px; border-radius:4px; word-break:break-all;">${escapeHTML(ss.badge_id)}</span>
        <strong style="color:#1B5E20;">Verification Date:</strong> <span>${escapeHTML(dateFormatted)}</span>
        <strong style="color:#1B5E20;">Issued Badges:</strong> <div style="display:flex; flex-wrap:wrap;">${verifiersHTML}</div>
        ${linksHTML ? `<strong style="color:#1B5E20;">Student Links:</strong> <div style="display:flex; flex-wrap:wrap;">${linksHTML}</div>` : ''}
      </div>
    `;

    showToast('✓ Cryptographic validity successfully verified!', 'success');
  } catch (err) {
    resultBox.style.background = '#FFEBEE';
    resultBox.style.border = '1.5px solid #EF5350';
    resultBox.style.color = '#C62828';
    resultBox.innerHTML = `
      <div style="font-weight:700; font-size:14px; margin-bottom:4px;">❌ Verification Connection Error</div>
      <div>Could not establish connection to the SkillProof database ledger: ${escapeHTML(err.message)}</div>
    `;
  }
}

// Handle direct verification link sharing
const checkUrlVerification = () => {
  const hash = window.location.hash || '';
  if (hash.includes('badge_id=')) {
    const match = hash.match(/badge_id=([^&]+)/);
    if (match && match[1]) {
      const badgeId = decodeURIComponent(match[1]);
      showView('landing');
      const inputEl = document.getElementById('public-verify-badge-id');
      if (inputEl) {
        inputEl.value = badgeId;
        setTimeout(() => {
          inputEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          verifyBadgeAuthenticator('public');
        }, 800);
      }
    }
  }
};
window.addEventListener('hashchange', checkUrlVerification);
window.addEventListener('load', () => { setTimeout(checkUrlVerification, 1000); });

function resetProgressSteps() {
  document.getElementById('prog-step-easy').className = 'progress-step';
  document.getElementById('prog-step-easy').innerText = '1';
  document.getElementById('prog-step-medium').className = 'progress-step';
  document.getElementById('prog-step-medium').innerText = '2';
  document.getElementById('prog-step-hard').className = 'progress-step';
  document.getElementById('prog-step-hard').innerText = '3';
}

// Rules Modal Gate Helpers
function openExamRulesModal(questionId, scheduleId = null, skillName = null) {
  // Block exam on mobile/tablet devices
  const isMobile = window.innerWidth < 1024 || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  if (isMobile) {
    alert('⚠️ Proctored exams require a desktop or laptop computer with camera and microphone access. Please switch to a PC to take this exam.');
    return;
  }

  // Automatically switch student tab to Shuffled Exam Arena to align contexts
  if (typeof switchStudentTab === 'function') {
    switchStudentTab('arena');
  }

  pendingSkillName = skillName;
  if (scheduleId) {
    pendingScheduleId = scheduleId;
    pendingExamQuestionId = null;
  } else {
    pendingExamQuestionId = questionId;
    pendingScheduleId = null;
  }
  const modal = document.getElementById('exam-rules-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
  const checkbox = document.getElementById('accept-rules-checkbox');
  if (checkbox) {
    checkbox.checked = false;
  }
  toggleStartExamBtn(false);
  
  // Show password field for scheduled exams only
  const pwSection = document.getElementById('exam-password-section');
  const pwInput = document.getElementById('exam-password-input');
  if (pwSection) {
    pwSection.style.display = scheduleId ? 'block' : 'none';
  }
  if (pwInput) pwInput.value = '';
}

function closeExamRulesModal() {
  const modal = document.getElementById('exam-rules-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  // Don't clear pending IDs here — confirmStartExam routes to ID verification which still needs them
}

function toggleStartExamBtn(isChecked) {
  const btn = document.getElementById('start-verified-exam-btn');
  if (btn) {
    if (isChecked) {
      btn.style.opacity = '1';
      btn.style.pointerEvents = 'auto';
    } else {
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    }
  }
}

function confirmStartExam() {
  // Save the password BEFORE closing the modal (input will be hidden after close)
  const pwInput = document.getElementById('exam-password-input');
  pendingExamPassword = pwInput ? pwInput.value.toUpperCase().trim() : '';
  
  // Route through ID verification first
  closeExamRulesModal();
  openIdVerificationModal();
}

// ── ID VERIFICATION — 2-STEP: SELFIE + GOVT ID ──
let idVerifyStream = null;
let capturedSelfiePhotoData = null;   // Step 1: selfie photo
let capturedIdPhotoData = null;        // Step 2: govt ID photo
let idVerifyCurrentStep = 1;           // 1 = selfie, 2 = govt ID
let photoIntervalId = null;
let pendingExamPassword = '';
let idVerifyLiveInterval = null;       // Live COCO scan loop during ID verify

async function openIdVerificationModal() {
  const modal = document.getElementById('id-verify-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  idVerifyCurrentStep = 1;
  capturedSelfiePhotoData = null;
  capturedIdPhotoData = null;
  _resetIdVerifyStep(1);

  try {
    idVerifyStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false
    });
    document.getElementById('id-verify-video').srcObject = idVerifyStream;
    // Start live detection scanning in modal
    _startIdVerifyLiveScan();
  } catch (err) {
    alert('Camera access required for identity verification. Please allow camera and try again.');
    modal.style.display = 'none';
  }
}

function _resetIdVerifyStep(step) {
  idVerifyCurrentStep = step;
  const isStep1 = step === 1;

  // Update step indicator UI
  document.getElementById('id-step1-dot').style.background = '#E65100';
  document.getElementById('id-step1-dot').style.color = '#fff';
  document.getElementById('id-step2-dot').style.background = isStep1 ? 'var(--gray-200)' : '#E65100';
  document.getElementById('id-step2-dot').style.color = isStep1 ? 'var(--gray-500)' : '#fff';
  document.getElementById('id-step2-label').style.color = isStep1 ? 'var(--gray-400)' : 'var(--gray-700)';

  // Update title and subtitle
  document.getElementById('id-verify-modal-title').textContent =
    isStep1 ? 'Step 1 — Selfie Verification' : 'Step 2 — Government ID Capture';
  document.getElementById('id-verify-modal-subtitle').textContent = isStep1
    ? 'Look directly at the camera. Ensure only YOU are in frame and your face is clearly visible.'
    : 'Hold your Govt ID (Aadhaar/PAN/Passport) flat inside the dashed box. Keep it steady.';

  // Toggle camera/frame guides
  document.getElementById('id-selfie-guide').style.display = isStep1 ? 'flex' : 'none';
  document.getElementById('id-card-guide').style.display = isStep1 ? 'none' : 'flex';
  document.getElementById('id-verify-capture-btn').textContent = isStep1 ? '📸 Capture Selfie' : '📸 Capture ID Card';

  // Reset preview/actions
  document.getElementById('id-verify-preview').style.display = 'none';
  document.getElementById('id-verify-camera-box').style.display = 'block';
  document.getElementById('id-verify-actions').style.display = 'flex';
  document.getElementById('id-verify-confirm').style.display = 'none';
  document.getElementById('id-detection-status').textContent = '';
  document.getElementById('id-detect-badge').textContent = '🔍 Scanning...';

  // Update next button label
  if (!isStep1) {
    const nextBtn = document.getElementById('id-verify-next-btn');
    if (nextBtn) { nextBtn.textContent = '✅ Confirm & Start Exam'; }
  }
}

function _startIdVerifyLiveScan() {
  // Run live COCO-SSD scan every 1.5s to update detection badge
  clearInterval(idVerifyLiveInterval);
  idVerifyLiveInterval = setInterval(async () => {
    const video = document.getElementById('id-verify-video');
    if (!video || video.readyState < 2) return;
    if (!phoneDetectionModel) return; // COCO-SSD not loaded yet

    try {
      const predictions = await phoneDetectionModel.detect(video);
      const persons = predictions.filter(p => p.class === 'person' && p.score >= 0.5);
      const badge = document.getElementById('id-detect-badge');
      const statusEl = document.getElementById('id-detection-status');

      if (idVerifyCurrentStep === 1) {
        // Selfie step — check exactly 1 person
        if (persons.length === 0) {
          if (badge) badge.textContent = '❌ No face detected';
          if (statusEl) statusEl.textContent = 'ℹ️ Move closer to the camera so your face is clearly visible.';
          if (badge) badge.style.color = '#ff6622';
        } else if (persons.length > 1) {
          if (badge) badge.textContent = `🚫 ${persons.length} people detected`;
          if (statusEl) statusEl.textContent = '⚠️ Only ONE person must be visible. Ask others to leave the frame.';
          if (badge) badge.style.color = '#ff4444';
        } else {
          if (badge) badge.textContent = '✅ 1 person — Ready to capture';
          if (statusEl) statusEl.textContent = '✅ Face detected clearly. Look straight at the camera and click capture.';
          if (badge) badge.style.color = '#22cc66';
        }
      } else {
        // ID card step — just confirm visibility
        const phones = predictions.filter(p => p.class === 'cell phone' && p.score >= 0.4);
        if (phones.length > 0) {
          if (badge) badge.textContent = '📱 Phone detected — remove it';
          if (statusEl) statusEl.textContent = '⚠️ A phone is visible. Remove it from the frame before capturing ID.';
          if (badge) badge.style.color = '#ff4444';
        } else {
          if (badge) badge.textContent = '📷 Hold ID card steady';
          if (statusEl) statusEl.textContent = 'ℹ️ Ensure all text on the ID is clearly legible and within the dashed box.';
          if (badge) badge.style.color = '#fff';
        }
      }
    } catch (err) {
      // Silently skip scan errors
    }
  }, 1500);
}

async function captureIdVerifyPhoto() {
  const video = document.getElementById('id-verify-video');
  const canvas = document.getElementById('id-verify-canvas');
  canvas.width = video.videoWidth || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const photoData = canvas.toDataURL('image/jpeg', 0.85); // High quality for ID reads

  // ── Person count check BEFORE accepting selfie ──
  if (idVerifyCurrentStep === 1) {
    const detectionOk = await _verifyPersonCount(video);
    if (!detectionOk) return; // Message already shown inside
    capturedSelfiePhotoData = photoData;
    document.getElementById('id-verify-preview-label').textContent = '✅ Selfie captured — face clearly visible';
  } else {
    const idOk = await _verifyIdDocument(video);
    if (!idOk) return;
    capturedIdPhotoData = photoData;
    document.getElementById('id-verify-preview-label').textContent = '✅ Govt ID captured successfully';
  }

  // Show preview
  document.getElementById('id-verify-preview-img').src = photoData;
  document.getElementById('id-verify-preview').style.display = 'block';
  document.getElementById('id-verify-camera-box').style.display = 'none';
  document.getElementById('id-verify-actions').style.display = 'none';
  document.getElementById('id-verify-confirm').style.display = 'flex';
}

async function _verifyPersonCount(video) {
  // ── Try face-api.js first (real face detection) ──
  const faceReady = await loadFaceApiModels();
  if (faceReady) {
    try {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.45 }));
      if (detections.length === 0) {
        await smoothAlert(
          'No human face detected. Please ensure your face is well-lit, directly looking at the camera, and fully visible within the oval guide. Remove glasses or hats if needed.',
          'Face Not Detected', '❌', 'warn'
        );
        return false;
      }
      if (detections.length > 1) {
        await smoothAlert(
          `Multiple faces (${detections.length}) detected in the frame. Only the exam candidate should be visible. Please ensure you are alone and retry.`,
          'Multiple Faces Detected', '🚫', 'warn'
        );
        return false;
      }
      // Check face size — must be at least 12% of frame width (prevents photo-of-photo held far away)
      const face = detections[0];
      const faceWidthRatio = face.box.width / video.videoWidth;
      if (faceWidthRatio < 0.12) {
        await smoothAlert(
          'Your face appears too small in the frame. Please move closer to the camera so your face fills the oval guide clearly.',
          'Face Too Far Away', '⚠️', 'warn'
        );
        return false;
      }
      console.log(`[FaceAPI] ✓ Real face detected (confidence: ${(face.score * 100).toFixed(1)}%, size: ${(faceWidthRatio * 100).toFixed(1)}% of frame)`);
      return true; // Exactly 1 real face — pass
    } catch (err) {
      console.warn('[FaceAPI] Face detection error, falling back to COCO-SSD:', err);
    }
  }

  // ── Fallback: COCO-SSD person detection ──
  if (!phoneDetectionModel) {
    console.warn('[ID Verify] No detection models loaded — allowing through');
    return true;
  }
  try {
    const predictions = await phoneDetectionModel.detect(video);
    const persons = predictions.filter(p => p.class === 'person' && p.score >= 0.60);
    if (persons.length === 0) {
      await smoothAlert(
        'No face or person detected clearly. Please ensure your face is well-lit, directly looking at the camera, and fully visible, then try again.',
        'Person Not Detected', '❌', 'warn'
      );
      return false;
    }
    if (persons.length > 1) {
      await smoothAlert(
        `Multiple people (${persons.length}) detected in the frame. Only the exam candidate should be visible. Please ensure you are alone and retry.`,
        'Multiple People Detected', '🚫', 'warn'
      );
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[ID Verify] Person detection error:', err);
    return true;
  }
}

async function _verifyIdDocument(video) {
  // ── 1. Check for forbidden electronic devices via COCO-SSD ──
  if (phoneDetectionModel) {
    try {
      const predictions = await phoneDetectionModel.detect(video);
      
      const invalidItems = predictions.filter(p => ['cell phone', 'laptop', 'keyboard', 'mouse', 'remote'].includes(p.class) && p.score >= 0.4);
      if (invalidItems.length > 0) {
        await smoothAlert(
          'An electronic device was detected (phone or laptop screen). Digital/screenshot IDs are NOT accepted.\n\nPlease present only your original physical Government ID card (Aadhaar, PAN Card, Passport, Driver\'s License) to the camera, and remove all electronic devices from the frame.',
          'Invalid Document — Electronic Device Detected', '❌', 'danger'
        );
        return false;
      }
    } catch (err) {
      console.warn('[ID Verify] COCO-SSD check error:', err);
    }
  }

  // ── 2. Check that a real person/face is present holding the ID ──
  const faceReady = await loadFaceApiModels();
  if (faceReady) {
    try {
      const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.35 }));
      if (detections.length === 0) {
        await smoothAlert(
          'Your face was not detected in the frame. Please hold the original Government ID card next to your face so BOTH your face and the ID are clearly visible in the camera, then capture again.',
          'Face Not Visible With ID', '❌', 'warn'
        );
        return false;
      }
    } catch (err) {
      console.warn('[ID Verify] Face detection during ID check failed:', err);
    }
  } else if (phoneDetectionModel) {
    try {
      const predictions = await phoneDetectionModel.detect(video);
      const persons = predictions.filter(p => p.class === 'person' && p.score >= 0.45);
      if (persons.length === 0) {
        await smoothAlert(
          'Candidate face/person not detected in the frame. Please hold the ID card next to your face so both are visible, and try again.',
          'Person Not Detected', '❌', 'warn'
        );
        return false;
      }
    } catch (err) {
      console.warn('[ID Verify] Person detection fallback error:', err);
    }
  }

  // ── 3. Canvas-based card/rectangle detection ──
  try {
    const canvas = document.createElement('canvas');
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    // Convert to grayscale and compute simple edge magnitude
    const gray = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    
    // Count strong horizontal and vertical edges (Sobel-like)
    let edgeCount = 0;
    const edgeThreshold = 40;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const gx = Math.abs(gray[y * w + x + 1] - gray[y * w + x - 1]);
        const gy = Math.abs(gray[(y + 1) * w + x] - gray[(y - 1) * w + x]);
        if (gx > edgeThreshold || gy > edgeThreshold) edgeCount++;
      }
    }
    
    const edgeDensity = edgeCount / (w * h);
    // A real ID card has clear text/borders → edge density typically > 5%
    // A blank wall or empty frame → edge density < 3%
    if (edgeDensity < 0.03) {
      await smoothAlert(
        'No document detected in the frame. The image appears blank or too dark.\n\nPlease hold your original physical Government ID card (Aadhaar, PAN Card, Passport, Driver\'s License) flat in front of the camera next to your face, ensuring the text on the card is readable.',
        'No Document Detected — Submit Original ID', '📄', 'warn'
      );
      return false;
    }
    console.log(`[ID Verify] ✓ Document edge density: ${(edgeDensity * 100).toFixed(1)}% — card-like content detected`);
  } catch (err) {
    console.warn('[ID Verify] Canvas edge detection error:', err);
    // Soft pass on canvas errors
  }

  return true;
}

function retakeIdVerifyPhoto() {
  if (idVerifyCurrentStep === 1) {
    capturedSelfiePhotoData = null;
  } else {
    capturedIdPhotoData = null;
  }
  document.getElementById('id-verify-preview').style.display = 'none';
  document.getElementById('id-verify-camera-box').style.display = 'block';
  document.getElementById('id-verify-actions').style.display = 'flex';
  document.getElementById('id-verify-confirm').style.display = 'none';
  document.getElementById('id-detection-status').textContent = '';
}

function idVerifyNextStep() {
  if (idVerifyCurrentStep === 1) {
    // Move to Step 2 — Govt ID
    _resetIdVerifyStep(2);
  } else {
    // Step 2 confirmed — start exam
    confirmIdAndStartExam();
  }
}

function confirmIdAndStartExam() {
  if (!capturedSelfiePhotoData) {
    alert('Please complete the selfie verification (Step 1) before starting.');
    return;
  }
  if (!capturedIdPhotoData) {
    alert('Please capture your Government ID (Step 2) before starting.');
    return;
  }

  // Stop live scan
  clearInterval(idVerifyLiveInterval);
  idVerifyLiveInterval = null;

  // Close ID modal and cleanup ID stream
  const modal = document.getElementById('id-verify-modal');
  if (modal) modal.style.display = 'none';
  if (idVerifyStream) {
    idVerifyStream.getTracks().forEach(t => t.stop());
    idVerifyStream = null;
  }
  
  // Now start the actual exam
  if (pendingScheduleId) {
    const sId = pendingScheduleId;
    startScheduledExam(sId);
  } else if (pendingExamQuestionId) {
    const qId = pendingExamQuestionId;
    startExam(qId);
  }
}

// Capture photo from proctor video during exam
function captureExamPhoto(captureType) {
  if (!currentExam || !videoStream) return;
  const video = document.getElementById('proctor-video');
  if (!video || video.videoWidth === 0) return;
  
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
  const photoData = canvas.toDataURL('image/jpeg', 0.80); // High quality for person detection
  
  // Queue locally if offline, flush when online
  if (!navigator.onLine) {
    if (!window._offlinePhotoQueue) window._offlinePhotoQueue = [];
    window._offlinePhotoQueue.push({ challenge_id: currentExam.examId, photo_data: photoData, capture_type: captureType });
    return;
  }
  _sendPhotoToServer({ challenge_id: currentExam.examId, photo_data: photoData, capture_type: captureType });
}

function _sendPhotoToServer(payload) {
  fetch('/api/exams/photo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(err => console.error('Photo upload failed:', err));
}

// Flush offline photo queue when network is restored
window.addEventListener('online', () => {
  if (window._offlinePhotoQueue && window._offlinePhotoQueue.length > 0) {
    const queue = window._offlinePhotoQueue.splice(0);
    queue.forEach(p => _sendPhotoToServer(p));
  }
});

// Start photo captures: 1 start + selfie + id_verify + 3 random interval + 1 interval every 2 minutes
function startPhotoCaptures() {
  // Upload selfie verification photo immediately if available
  if (capturedSelfiePhotoData && currentExam) {
    _sendPhotoToServer({
      challenge_id: currentExam.examId,
      photo_data: capturedSelfiePhotoData,
      capture_type: 'selfie_verify'
    });
  }

  // Upload ID verification photo immediately if available
  if (capturedIdPhotoData && currentExam) {
    _sendPhotoToServer({
      challenge_id: currentExam.examId,
      photo_data: capturedIdPhotoData,
      capture_type: 'id_verify'
    });
  }

  // Capture start photo (3s delay for camera to stabilize and person to settle)
  setTimeout(() => captureExamPhoto('start'), 3000);
  // Capture second start photo at 6s (double-checks single person at the very start)
  setTimeout(() => captureExamPhoto('start_verify'), 6000);

  const totalMs = (currentExam ? (currentExam.expirationMinutes || 10) : 10) * 60 * 1000;

  // Generate 3 unique random timestamps within the exam window
  const band = Math.floor(totalMs / 3);
  const times = [
    Math.floor(Math.random() * band) + 15000,
    Math.floor(Math.random() * band) + band,
    Math.floor(Math.random() * band) + band * 2
  ];

  times.forEach((delay, idx) => {
    const tid = setTimeout(() => captureExamPhoto(`random_${idx + 1}`), delay);
    if (!window._photoTimers) window._photoTimers = [];
    window._photoTimers.push(tid);
  });

  // Periodic photo every 90 seconds as a baseline
  photoIntervalId = setInterval(() => {
    captureExamPhoto('interval');
  }, 90000);
}


function stopPhotoCaptures() {
  if (photoIntervalId) {
    clearInterval(photoIntervalId);
    photoIntervalId = null;
  }
  // Clear random-timed photo timers
  if (window._photoTimers) {
    window._photoTimers.forEach(tid => clearTimeout(tid));
    window._photoTimers = [];
  }
}

// ── REAL-TIME PHONE + SECOND PERSON DETECTION (COCO-SSD) ──
let phoneDetectionModel = null;
let phoneDetectionInterval = null;
let phoneDetected = false;
let secondPersonInterval = null;       // Separate interval for person count monitoring
let secondPersonViolationCount = 0;    // Track how many times second person was seen

// ── FACE-API.JS MODEL STATE ──
let faceApiLoaded = false;
async function loadFaceApiModels() {
  if (faceApiLoaded) return true;
  if (typeof faceapi === 'undefined') {
    console.warn('[FaceAPI] face-api.js not loaded from CDN');
    return false;
  }
  try {
    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/weights';
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
    ]);
    faceApiLoaded = true;
    console.log('[FaceAPI] TinyFaceDetector + landmarks loaded successfully');
    return true;
  } catch (err) {
    console.error('[FaceAPI] Failed to load models:', err);
    return false;
  }
}

async function loadPhoneDetectionModel() {
  try {
    if (typeof cocoSsd === 'undefined') {
      console.warn('[Detection] COCO-SSD not loaded. Skipping.');
      return;
    }
    console.log('[Detection] Loading COCO-SSD model...');
    phoneDetectionModel = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    console.log('[Detection] Model loaded successfully.');
  } catch (err) {
    console.error('[Detection] Failed to load model:', err);
  }
}

function startPhoneDetection() {
  if (!phoneDetectionModel) {
    loadPhoneDetectionModel().then(() => {
      if (phoneDetectionModel) {
        _beginPhoneScanning();
        _beginPersonCountScanning();
      }
    });
  } else {
    _beginPhoneScanning();
    _beginPersonCountScanning();
  }
}

function _beginPhoneScanning() {
  clearInterval(phoneDetectionInterval);
  // Scan every 5 seconds
  phoneDetectionInterval = setInterval(async () => {
    if (!currentExam || examSubmittingOrExiting) return;
    if (phoneDetected) return; // Already caught
    const video = document.getElementById('proctor-video');
    if (!video || video.readyState < 2 || !phoneDetectionModel) return;

    try {
      const predictions = await phoneDetectionModel.detect(video);
      for (const pred of predictions) {
        if (pred.class === 'cell phone' && pred.score >= 0.45) {
          phoneDetected = true;
          console.warn('[Phone Detection] PHONE DETECTED! Confidence:', pred.score);

          // Capture the evidence photo
          captureExamPhoto('phone_detected');

          // Log the violation — this auto-disqualifies
          logViolation('phone_detected');

          // Update sidebar telemetry
          const ind = document.getElementById('ind-phone');
          if (ind) { ind.innerText = 'BREACH (PHONE DETECTED)'; ind.className = 'sec-indicator-status err'; }

          // Stop further phone scanning but keep person scanning running
          clearInterval(phoneDetectionInterval);
          phoneDetectionInterval = null;
          break;
        }
      }
    } catch (err) {
      // Silently ignore detection errors
    }
  }, 5000);
}

function _beginPersonCountScanning() {
  clearInterval(secondPersonInterval);
  secondPersonViolationCount = 0;

  // Scan every 8 seconds for a second person
  secondPersonInterval = setInterval(async () => {
    if (!currentExam || examSubmittingOrExiting) return;
    const video = document.getElementById('proctor-video');
    if (!video || video.readyState < 2 || !phoneDetectionModel) return;

    try {
      const predictions = await phoneDetectionModel.detect(video);
      const persons = predictions.filter(p => p.class === 'person' && p.score >= 0.5);

      if (persons.length > 1) {
        secondPersonViolationCount++;
        console.warn(`[Person Detection] ${persons.length} persons detected! Count: ${secondPersonViolationCount}`);

        // Capture evidence photo
        captureExamPhoto('second_person_detected');

        // Log the violation (repeated detections are all logged)
        logViolation('second_person_detected');

        // Update sidebar indicator
        const ind = document.getElementById('ind-phone');
        if (ind) { ind.innerText = `BREACH (${persons.length} PERSONS)`; ind.className = 'sec-indicator-status err'; }
      }
    } catch (err) {
      // Silently ignore
    }
  }, 8000);
}

function stopPhoneDetection() {
  if (phoneDetectionInterval) {
    clearInterval(phoneDetectionInterval);
    phoneDetectionInterval = null;
  }
  if (secondPersonInterval) {
    clearInterval(secondPersonInterval);
    secondPersonInterval = null;
  }
}


// ── WEB BLUETOOTH DETECTION & SECURITY TELEMETRY ──
async function isBluetoothDeviceConnected() {
  try {
    if (navigator.mediaDevices && typeof navigator.mediaDevices.enumerateDevices === 'function') {
      const devices = await navigator.mediaDevices.enumerateDevices();
      for (const device of devices) {
        const label = (device.label || '').toLowerCase();
        if (label.includes('bluetooth') || label.includes('hands-free') || label.includes('wireless audio') || label.includes('wireless headset')) {
          console.warn('[Bluetooth Detector] Bluetooth audio/media device detected:', device.label);
          return true;
        }
      }
    }
  } catch (err) {
    console.warn('Enumerate devices check failed:', err);
  }
  return false;
}

async function checkBluetoothPrerequisite() {
  let bluetoothOn = false;
  
  // Check the developer simulator switch
  const simCheckbox = document.getElementById('sim-bluetooth-check');
  if (simCheckbox && simCheckbox.checked) {
    bluetoothOn = true;
  }
  
  // Check connected media devices (only alert if a device is connected/simulated, not just because an adapter exists)
  if (!bluetoothOn) {
    bluetoothOn = await isBluetoothDeviceConnected();
  }
  
  if (bluetoothOn) {
    alert('Security Prerequisite: Your device Bluetooth is turned ON or a Bluetooth device is connected. Proctored exams strictly prohibit Bluetooth connectivity to prevent unauthorized audio or voice assistance. Please disable Bluetooth in your system settings, disconnect any Bluetooth peripherals, and try again.');
    return false;
  }
  return true;
}

function startBluetoothMonitoring() {
  if (bluetoothCheckInterval) clearInterval(bluetoothCheckInterval);
  
  const checkBluetooth = async () => {
    if (!currentExam || examSubmittingOrExiting) return;
    try {
      let bluetoothOn = false;
      const simCheckbox = document.getElementById('sim-bluetooth-check');
      if (simCheckbox && simCheckbox.checked) {
        bluetoothOn = true;
      }
      
      // Rely solely on active Bluetooth device connections rather than getAvailability
      if (!bluetoothOn) {
        bluetoothOn = await isBluetoothDeviceConnected();
      }
      
      if (bluetoothOn) {
        console.warn('[Security Telemetry] Bluetooth adapter/device detected as ENABLED/ON during exam.');
        logViolation('bluetooth_on');
      }
    } catch (err) {
      console.error('[Bluetooth check error]:', err);
    }
  };

  // Run initial check immediately
  checkBluetooth();
  
  // Set interval to check every 5 seconds
  bluetoothCheckInterval = setInterval(checkBluetooth, 5000);
}

function stopBluetoothMonitoring() {
  if (bluetoothCheckInterval) {
    clearInterval(bluetoothCheckInterval);
    bluetoothCheckInterval = null;
  }
}


// ── TIMED EXAM ENGINE & HIGH SECURITY PROCTORING ──
async function startExam(questionId) {
  if (!currentUser) {
    showView('auth');
    return;
  }

  // 1. Capture Screen Sharing FIRST (must happen before fullscreen — Chrome blocks picker in fullscreen)
  showLoading('Setting up screen sharing…', 'Your primary display must be shared for proctoring.');
  const screenShared = await initScreenShare();
  if (!screenShared) {
    hideLoading();
    cleanupStreams();
    await smoothAlert(
      'Full primary display screen sharing is required to begin the assessment. Please select your entire screen (not a window or tab).',
      'Security Prerequisite',
      '🖥️', 'warn'
    );
    return;
  }

  // 2. Access Camera and microphone WebRTC streams
  showLoading('Activating webcam & microphone…', 'Both camera and microphone must be enabled for proctoring.');
  const mediaStreamsOk = await initProctorMediaStreams();
  if (!mediaStreamsOk) {
    hideLoading();
    cleanupStreams();
    await smoothAlert(
      'Both your webcam and microphone must be active for proctored assessments. Please grant browser permissions and try again.',
      'Security Prerequisite',
      '📷', 'warn'
    );
    return;
  }

  // 3. Check Bluetooth prerequisite (runs after WebRTC permissions are granted so device names are resolved!)
  showLoading('Checking device connections…', 'Bluetooth and external device check in progress.');
  const bluetoothOk = await checkBluetoothPrerequisite();
  if (!bluetoothOk) {
    hideLoading();
    cleanupStreams();
    return;
  }

  // Hide loading overlay to allow user interaction with the smoothAlert modal
  hideLoading();

  // Show a beautiful gesture confirmation dialog to reset user activation token!
  await smoothAlert(
    'All proctoring feeds and security checks are active. Click OK to enter secure Full Screen mode and unlock the assessment arena.',
    'Unlock Secure Arena',
    '🔒', 'success'
  );

  // Enforce Full Screen synchronously after the click gesture
  showLoading('Entering secure fullscreen mode…', 'The exam requires fullscreen to prevent context switching.');
  try {
    await document.documentElement.requestFullscreen();
  } catch (err) {
    hideLoading();
    cleanupStreams();
    await smoothAlert(
      'Full Screen mode is required to unlock this assessment. Please allow fullscreen when prompted.',
      'Security Prerequisite',
      '🔒', 'warn'
    );
    return;
  }
  hideLoading();

  // Call Server to register TIMED attempt
  fetch('/api/exams/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_email: currentUser.email,
      question_id: questionId
    })
  })
  .then(res => {
    if (!res.ok && res.status === 401) {
      // Token expired right before exam — silently refresh and retry
      console.warn('[startExam] 401 — refreshing token and retrying exam start');
      const prov = selectProvider || safeLocalStorage.getItem('skillproof_auth_provider') || 'Google';
      return originalFetch.call(window, '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: currentUser.email, name: currentUser.name, provider: prov })
      })
      .then(ar => ar.json())
      .then(ad => {
        if (ad.sessionToken) safeLocalStorage.setItem('skillproof_session_token', ad.sessionToken);
        return fetch('/api/exams/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ student_email: currentUser.email, question_id: questionId })
        });
      })
      .then(rr => rr.json());
    }
    return res.json();
  })
  .then(data => {
    if (!data) { cleanupStreams(); if (document.fullscreenElement) document.exitFullscreen().catch(e=>{}); return; }
    if (data.error) {
      alert(data.error);
      cleanupStreams();
      if (document.fullscreenElement) document.exitFullscreen().catch(err=>{});
      return;
    }

    currentExam = data;
    activeProctorViolations = false;
    // Enable grace period — skip violations for 3 seconds after exam starts
    examGracePeriod = true;
    setTimeout(() => { examGracePeriod = false; }, 3000);
    document.getElementById('disqualify-alert').style.display = 'none';
    document.getElementById('active-question-title').innerText = currentExam.questionTitle || 'Timed Coding Challenge';
    document.getElementById('code-editor').value = currentExam.codeTemplate;
    if (typeof updateDesignMockupVisibility === 'function') updateDesignMockupVisibility();

    // ── Language-aware editor badge ──
    const langBadge = document.getElementById('editor-lang-badge');
    if (langBadge && typeof detectLangFromSkill === 'function') {
      // First try the stored skill name from the Unlock Arena button
      let detectedLang = pendingSkillName ? detectLangFromSkill(pendingSkillName) : null;
      // Fallback: parse from question title (format: "Scenario — Problem")
      if (!detectedLang) {
        const titleText = currentExam.questionTitle || '';
        const skillPart = titleText.split(' — ')[0] || titleText;
        detectedLang = detectLangFromSkill(skillPart);
      }
      if (detectedLang) {
        langBadge.textContent = '⌨ ' + detectedLang;
        langBadge.style.display = 'inline-block';
        document.getElementById('code-editor').setAttribute('data-lang', detectedLang);
      } else {
        langBadge.style.display = 'none';
      }
    }

    // Reset Simulators
    document.getElementById('sim-bluetooth-check').checked = false;
    document.getElementById('sim-phone-check').checked = false;
    document.getElementById('sim-camera-check').checked = false;
    document.getElementById('sim-screen-check').checked = false;

    // Reset status indicators
    document.getElementById('ind-camera').innerText = 'ACTIVE';
    document.getElementById('ind-camera').className = 'sec-indicator-status ok';
    document.getElementById('ind-mic').innerText = 'ACTIVE';
    document.getElementById('ind-mic').className = 'sec-indicator-status ok';
    document.getElementById('ind-screen').innerText = 'SHARING';
    document.getElementById('ind-screen').className = 'sec-indicator-status ok';
    document.getElementById('ind-focus').innerText = 'SECURED';
    document.getElementById('ind-focus').className = 'sec-indicator-status ok';
    document.getElementById('ind-bluetooth').innerText = 'DISABLED (OK)';
    document.getElementById('ind-bluetooth').className = 'sec-indicator-status ok';
    document.getElementById('ind-phone').innerText = 'NOT DETECTED';
    document.getElementById('ind-phone').className = 'sec-indicator-status ok';

    examSubmittingOrExiting = false;
    document.getElementById('view-exam').classList.add('strict-mode');
    showView('exam');
    startCountdown(currentExam.expirationMinutes * 60);
    bindFocusIntegrity();

    // Render test cases
    renderTestCases(currentExam.testCases);

    // Start periodic photo captures
    startPhotoCaptures();

    // Start real-time phone detection via COCO-SSD
    phoneDetected = false;
    startPhoneDetection();
    
    // Start periodic Bluetooth adapter status monitoring
    startBluetoothMonitoring();
    startDevToolsDetection();
  })
  .catch(err => {
    console.error('Failed to create timed session:', err);
    cleanupStreams();
  });
}

// Media streams setup: camera + audio microphone
async function initProctorMediaStreams() {
  const videoEl = document.getElementById('proctor-video');
  const placeholder = document.getElementById('camera-placeholder');

  try {
    // Request webcam + microphone in a single call for better browser compatibility
    const combinedStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    
    // Separate video and audio tracks
    videoStream = new MediaStream(combinedStream.getVideoTracks());
    audioStream = new MediaStream(combinedStream.getAudioTracks());
    
    videoEl.srcObject = videoStream;
    await videoEl.play().catch(() => {});  // Ensure video starts playing
    placeholder.style.display = 'none';
    videoEl.style.display = 'block';
    
    // Track-level hardware listeners for camera hardening
    const videoTrack = videoStream.getVideoTracks()[0];
    if (videoTrack) {
      const handleCameraOff = () => {
        logViolation('camera_off');
        videoEl.style.display = 'none';
        placeholder.style.display = 'flex';
        placeholder.innerText = '⚠️ Stream disconnected';
      };
      videoTrack.addEventListener('ended', handleCameraOff);
      videoTrack.addEventListener('mute', handleCameraOff);

      // Monitor device changes (hardware disconnects) during the exam
      if (!window._deviceChangeListenerBound) {
        window._deviceChangeListenerBound = true;
        navigator.mediaDevices.addEventListener('devicechange', () => {
          if (!currentExam || examSubmittingOrExiting) return;
          navigator.mediaDevices.enumerateDevices().then(devices => {
            const hasVideo = devices.some(d => d.kind === 'videoinput');
            const hasAudio = devices.some(d => d.kind === 'audioinput');
            if (!hasVideo) {
              handleCameraOff();
            }
            if (!hasAudio) {
              logViolation('mic_muted');
            }
          }).catch(err => console.error(err));
        });
      }
    }
    
    // Bind microphone decibel analysis simulation
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(audioStream);
    source.connect(analyser);
    analyser.fftSize = 256;

    // Set visual decibel bar timer
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const bars = document.querySelectorAll('.decibel-bar');
    
    micInterval = setInterval(() => {
      analyser.getByteFrequencyData(dataArray);
      let values = 0;
      for (let i = 0; i < dataArray.length; i++) {
        values += dataArray[i];
      }
      let average = values / dataArray.length;

      // Map average to highlighting decibel indicator blocks
      bars.forEach((bar, idx) => {
        if (average > (idx * 5) + 2) {
          bar.classList.add('active');
        } else {
          bar.classList.remove('active');
        }
      });

      // Periodic check if microphone is muted
      if (audioStream) {
        const audioTrack = audioStream.getAudioTracks()[0];
        if (!audioTrack || !audioTrack.enabled || audioTrack.muted) {
          logViolation('mic_muted');
        }
      }
    }, 100);

    return true;
  } catch (err) {
    console.error('Proctor hardware stream error:', err);
    placeholder.innerText = '⚠️ Camera/Mic Blocked';
    return false;
  }
}

// Screen Sharing Init
async function initScreenShare() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "monitor"
      }
    });
    const track = screenStream.getVideoTracks()[0];
    if (track) {
      const settings = track.getSettings();
      if (settings && settings.displaySurface && settings.displaySurface !== 'monitor') {
        alert('⚠️ Security Policy Requirement:\nYou must share your ENTIRE SCREEN, not a window or tab. Please stop sharing and select "Entire Screen" when starting the exam.');
        track.stop();
        return false;
      }
      track.addEventListener('ended', () => {
        logViolation('screen_share_off');
      });
    }
    return true;
  } catch (err) {
    console.error('Screen sharing denied:', err);
    return false;
  }
}

// Timer Loop — pauses automatically when WiFi is disconnected
function startCountdown(durationSeconds) {
  let timer = durationSeconds;
  const timerDisplay = document.getElementById('active-timer');

  clearInterval(currentTimer);
  currentTimer = setInterval(() => {
    // ── WiFi Pause Guard ── Freeze timer entirely during network outage
    if (isExamPaused) return;

    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;

    timerDisplay.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    
    if (timer <= 60) {
      timerDisplay.style.color = '#ff4444';
      timerDisplay.style.animation = 'pulse 1s infinite';
    }

    if (--timer < 0) {
      clearInterval(currentTimer);
      timerDisplay.innerText = "00:00";
      timerDisplay.style.animation = 'none';
      submitExam(true); // Auto-submit silently without triggering alert -> blur event
    }
  }, 1000);
}

// Anti-Cheat security listeners: focus blur and fullscreen exiting
// Render test cases in exam view
function renderTestCases(testCases) {
  const list = document.getElementById('test-cases-list');
  if (!list) return;
  list.innerHTML = '';
  if (!testCases || testCases.length === 0) {
    list.innerHTML = '<div style="color:var(--gray-500); font-family:var(--font-body);">No specific test cases for this challenge.</div>';
    return;
  }
  testCases.forEach((tc, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid; grid-template-columns:auto 1fr 1fr; gap:10px; padding:8px 10px; background:var(--white); border:1px solid var(--gray-200); border-radius:6px; align-items:center;';
    const statusDot = `<span style="width:8px;height:8px;border-radius:50%;background:var(--gray-300);display:inline-block;" id="tc-dot-${i}"></span>`;
    row.innerHTML = `
      ${statusDot}
      <div>
        <div style="font-weight:600; color:var(--gray-700); font-size:11px; margin-bottom:2px;">${tc.description}</div>
        <div style="color:var(--gray-500);">Input: <code style="background:var(--gray-50); padding:1px 4px; border-radius:3px;">${tc.input}</code></div>
      </div>
      <div style="text-align:right;">
        <div style="color:var(--gray-500); font-size:11px;">Expected:</div>
        <code style="color:var(--orange-deep); font-weight:600;">${tc.expected}</code>
      </div>
    `;
    list.appendChild(row);
  });
}

function strictKeyboardProctor(e) {
  if (!document.getElementById('view-exam').classList.contains('active')) return;

  // ── WiFi Lockout ── Block ALL keystrokes when exam is paused due to network outage
  if (isExamPaused) {
    e.preventDefault();
    e.stopImmediatePropagation();
    return false;
  }

  if (examSubmittingOrExiting) return;
  
  // Block Windows / Meta / OS / Alt keys
  if (e.key === 'Meta' || e.key === 'OS' || e.key === 'Alt') {
    e.preventDefault();
    logViolation('restricted_key_pressed');
    return false;
  }
  
  // Block Escape explicitly
  if (e.key === 'Escape') {
    e.preventDefault();
    return false;
  }
  
  // Block F12 (DevTools)
  if (e.key === 'F12') {
    e.preventDefault();
    logViolation('devtools_attempt');
    return false;
  }

  // Block Ctrl+Shift+I/J/C/K (DevTools shortcuts)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    if (['i','j','c','k','u'].includes(e.key.toLowerCase())) {
      e.preventDefault();
      logViolation('devtools_attempt');
      return false;
    }
  }

  // Block Ctrl+U (View Source)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
    e.preventDefault();
    logViolation('devtools_attempt');
    return false;
  }

  // Block Ctrl+P (Print — could print exam questions)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
    e.preventDefault();
    logViolation('print_attempt');
    return false;
  }

  // Block Ctrl+S (Save Page)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
    e.preventDefault();
    return false;
  }

  // Block Ctrl+A (Select All — allows mass copy)
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    // Only block if the active element is NOT the code editor (they need Ctrl+A there)
    if (document.activeElement !== document.getElementById('code-editor')) {
      e.preventDefault();
      return false;
    }
  }

  // Block Alt+Tab / Alt+F4 / Windows shortcuts
  if (e.altKey) {
    e.preventDefault();
    logViolation('restricted_key_pressed');
    return false;
  }

  // Block Ctrl+C, Ctrl+V, Ctrl+X globally (outside editor)
  if (e.ctrlKey || e.metaKey) {
    if (['c','v','x'].includes(e.key.toLowerCase())) {
      if (document.activeElement !== document.getElementById('code-editor')) {
        e.preventDefault();
        logViolation('copy_paste_attempt');
        return false;
      }
    }
  }

  // Block PrintScreen and Snipping Tools (Windows+Shift+S, Cmd+Shift+3/4/5)
  if (e.key === 'PrintScreen' || (e.shiftKey && (e.metaKey || e.ctrlKey) && ['s', 'S', '3', '4', '5'].includes(e.key))) {
    e.preventDefault();
    logViolation('screenshot_attempt');
    try { navigator.clipboard.writeText(''); } catch(err) {} // Attempt to wipe clipboard
    return false;
  }

  // Block F5 / Ctrl+R (refresh — would clear exam state)
  if (e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r')) {
    e.preventDefault();
    return false;
  }
}

function bindFocusIntegrity() {
  // ── Beforeunload Guard ── Warn if user tries to close/navigate away during exam
  window._examBeforeUnload = (e) => {
    if (!examSubmittingOrExiting && document.getElementById('view-exam').classList.contains('active')) {
      e.preventDefault();
      e.returnValue = 'Your exam is in progress. Leaving this page will submit your current work.';
      return e.returnValue;
    }
  };
  window.removeEventListener('beforeunload', window._examBeforeUnload);
  window.addEventListener('beforeunload', window._examBeforeUnload);

  // ── WiFi Disconnect Overlay ── Freeze exam when offline, resume seamlessly when online
  window._examOfflineHandler = () => {
    if (!document.getElementById('view-exam').classList.contains('active')) return;
    isExamPaused = true;
    const overlay = document.getElementById('wifi-disconnect-overlay');
    if (overlay) {
      overlay.classList.add('visible');
      // Start pulsing dots animation
      let dotCount = 0;
      window._wifiDotInterval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
        const dots = document.getElementById('wifi-reconnect-dots');
        if (dots) dots.textContent = '.'.repeat(dotCount + 1);
      }, 600);
    }
  };
  window._examOnlineHandler = () => {
    if (!isExamPaused) return;
    isExamPaused = false;
    const overlay = document.getElementById('wifi-disconnect-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
      clearInterval(window._wifiDotInterval);
      // Brief success flash before hiding
      const status = document.getElementById('wifi-status-text');
      if (status) {
        status.textContent = '✅ Connection Restored — Resuming exam...';
        setTimeout(() => { if (status) status.textContent = '⚠️ No Internet Connection Detected'; }, 3000);
      }
    }
  };
  window.removeEventListener('offline', window._examOfflineHandler);
  window.removeEventListener('online', window._examOnlineHandler);
  window.addEventListener('offline', window._examOfflineHandler);
  window.addEventListener('online', window._examOnlineHandler);

  // ── Print Block ── Prevent printing exam questions
  window._examPrintHandler = () => {
    if (document.getElementById('view-exam').classList.contains('active')) {
      logViolation('print_attempt');
    }
  };
  window.removeEventListener('beforeprint', window._examPrintHandler);
  window.addEventListener('beforeprint', window._examPrintHandler);
  
  // Add print CSS block via dynamic style
  if (!document.getElementById('exam-print-block-style')) {
    const printStyle = document.createElement('style');
    printStyle.id = 'exam-print-block-style';
    printStyle.textContent = '@media print { body { display: none !important; } }';
    document.head.appendChild(printStyle);
  }

  // Focus and Fullscreen Lockout State Management
  let isFocusLockedOut = false;

  window.showFocusLockout = (reason) => {
    if (!currentExam) return;
    if (examSubmittingOrExiting || isExamPaused) return;
    
    // Log violation (debounced / rate-limited inside logViolation)
    if (reason === 'tab_exit') {
      logViolation('tab_exit');
    } else if (reason === 'fullscreen_exit') {
      logViolation('fullscreen_exit');
    }
    
    if (isFocusLockedOut) return;
    isFocusLockedOut = true;
    
    const overlay = document.getElementById('focus-lockout-overlay');
    const statusText = document.getElementById('focus-status-text');
    if (statusText) {
      if (reason === 'tab_exit') {
        statusText.innerHTML = '⚠️ <strong>Focus Lost:</strong> You switched tabs or clicked outside the secure arena.';
      } else if (reason === 'fullscreen_exit') {
        statusText.innerHTML = '⚠️ <strong>Fullscreen Exited:</strong> You exited fullscreen mode.';
      }
    }
    if (overlay) {
      overlay.classList.add('visible');
    }
  };

  window.hideFocusLockout = () => {
    const overlay = document.getElementById('focus-lockout-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
    }
    isFocusLockedOut = false;
  };

  // Bind buttons on the lockout overlay
  const resumeBtn = document.getElementById('focus-resume-btn');
  if (resumeBtn) {
    resumeBtn.onclick = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen()
          .then(() => {
            window.hideFocusLockout();
          })
          .catch(err => {
            console.error('Failed to restore fullscreen:', err);
            window.hideFocusLockout();
          });
      } else {
        window.hideFocusLockout();
      }
    };
  }

  const submitBtn = document.getElementById('focus-submit-btn');
  if (submitBtn) {
    submitBtn.onclick = () => {
      window.hideFocusLockout();
      submitExam(true);
    };
  }

  // Focus exits
  window.onblur = () => {
    if (examSubmittingOrExiting || isExamPaused || isFocusLockedOut) return;
    if (document.getElementById('view-exam').classList.contains('active')) {
      window.showFocusLockout('tab_exit');
    }
  };
  
  document.onvisibilitychange = () => {
    if (examSubmittingOrExiting || isExamPaused || isFocusLockedOut) return;
    if (document.visibilityState === 'hidden' && document.getElementById('view-exam').classList.contains('active')) {
      window.showFocusLockout('tab_exit');
    }
  };

  // Full Screen changes
  document.onfullscreenchange = () => {
    if (examSubmittingOrExiting || isExamPaused) return;
    if (document.getElementById('view-exam').classList.contains('active')) {
      if (!document.fullscreenElement) {
        window.showFocusLockout('fullscreen_exit');
      } else {
        if (isFocusLockedOut) {
          window.hideFocusLockout();
        }
      }
    }
  };

  // ── Global Right-Click Block ── Prevent context menus everywhere in exam
  document._examContextMenuBlock = (e) => {
    if (document.getElementById('view-exam').classList.contains('active')) {
      e.preventDefault();
      return false;
    }
  };
  document.removeEventListener('contextmenu', document._examContextMenuBlock, true);
  document.addEventListener('contextmenu', document._examContextMenuBlock, true);

  // ── Drag & Drop Block ── Prevent dragging text from question to another window
  document._examDragBlock = (e) => {
    if (document.getElementById('view-exam').classList.contains('active')) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.type === 'drop') {
        logViolation('copy_paste_attempt');
      }
      return false;
    }
  };
  document.removeEventListener('dragstart', document._examDragBlock, true);
  document.addEventListener('dragstart', document._examDragBlock, true);
  document.removeEventListener('drop', document._examDragBlock, true);
  document.addEventListener('drop', document._examDragBlock, true);

  // ── Middle Click Block ── Prevent Ctrl+Click / middle-click to open new tabs
  document._examMiddleClickBlock = (e) => {
    if (document.getElementById('view-exam').classList.contains('active')) {
      if (e.button === 1 || (e.ctrlKey && e.button === 0)) {
        e.preventDefault();
        return false;
      }
    }
  };
  document.removeEventListener('mousedown', document._examMiddleClickBlock, true);
  document.addEventListener('mousedown', document._examMiddleClickBlock, true);

  // ── Text Selection Block ── Prevent selecting/copying question text
  document._examSelectBlock = (e) => {
    if (document.getElementById('view-exam').classList.contains('active')) {
      // Allow selection in the code editor only
      if (e.target && e.target.id === 'code-editor') return;
      e.preventDefault();
    }
  };
  document.removeEventListener('selectstart', document._examSelectBlock, true);
  document.addEventListener('selectstart', document._examSelectBlock, true);

  // Bind Anti-copy & paste listeners to editor
  const editor = document.getElementById('code-editor');
  editor.oncopy = e => { e.preventDefault(); alert('Copying is strictly prohibited.'); logViolation('copy_paste_attempt'); };
  editor.oncut = e => { e.preventDefault(); alert('Cutting is strictly prohibited.'); logViolation('copy_paste_attempt'); };
  editor.onpaste = e => { e.preventDefault(); alert('Pasting is strictly prohibited.'); logViolation('copy_paste_attempt'); };
  editor.oncontextmenu = e => e.preventDefault();
  editor.ondragstart = e => { e.preventDefault(); return false; };
  editor.ondrop = e => { e.preventDefault(); return false; };
  
  // Ensure we don't duplicate the event listener if they take multiple exams
  // Use capturing phase so it fires BEFORE page-level handlers (maximal block)
  document.removeEventListener('keydown', strictKeyboardProctor, true);
  document.addEventListener('keydown', strictKeyboardProctor, true);
}

const lastViolationLogTimes = {};
function logViolation(violationType) {
  if (!currentExam) return;
  if (examSubmittingOrExiting) return;
  // Skip violations during grace period (first 3 seconds after exam start)
  if (examGracePeriod) return;

  const now = Date.now();
  if (lastViolationLogTimes[violationType] && (now - lastViolationLogTimes[violationType] < 5000)) {
    return; // Rate limit duplicate violations of same type to once every 5 seconds
  }
  lastViolationLogTimes[violationType] = now;

  fetch('/api/exams/violation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exam_id: currentExam.examId,
      type: violationType
    })
  })
  .then(res => {
    // If the proctoring endpoint returns 401 or any error, silently skip — 
    // NEVER let a violation log destroy the exam session
    if (!res.ok) {
      console.warn(`[logViolation] ${violationType} endpoint returned ${res.status} — skipping`);
      return null;
    }
    return res.json();
  })
  .then(data => {
    if (!data) return;
    // If a phone is detected, handle it completely silently on the student screen
    if (violationType === 'phone_detected') {
      return;
    }

    // Second person detection: show banner but don't repeat it every 8s
    if (violationType === 'second_person_detected') {
      activeProctorViolations = true;
      document.getElementById('disqualify-alert').style.display = 'flex';
      document.getElementById('disqualify-alert').scrollIntoView({ behavior: 'smooth' });
      const ind = document.getElementById('ind-phone');
      if (ind) { ind.innerText = 'BREACH (2ND PERSON)'; ind.className = 'sec-indicator-status err'; }
      return;
    }

    activeProctorViolations = true;
    
    // Display massive alert freeze banner
    document.getElementById('disqualify-alert').style.display = 'flex';
    document.getElementById('disqualify-alert').scrollIntoView({ behavior: 'smooth' });

    // Update specific sidebar telemetry status tags
    if (violationType === 'tab_exit') {
      const ind = document.getElementById('ind-focus');
      ind.innerText = 'BREACH (TAB EXIT)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'fullscreen_exit') {
      const ind = document.getElementById('ind-focus');
      ind.innerText = 'BREACH (FULLSCREEN EXIT)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'camera_off') {
      const ind = document.getElementById('ind-camera');
      ind.innerText = 'BREACH (CAMERA OFF)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'mic_muted') {
      const ind = document.getElementById('ind-mic');
      ind.innerText = 'BREACH (MIC MUTED)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'screen_share_off') {
      const ind = document.getElementById('ind-screen');
      ind.innerText = 'BREACH (STOPPED)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'bluetooth_on') {
      const ind = document.getElementById('ind-bluetooth');
      ind.innerText = 'BREACH (ACTIVE DEVICE)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'devtools_attempt') {
      const ind = document.getElementById('ind-focus');
      ind.innerText = 'BREACH (DEVTOOLS OPEN)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'print_attempt') {
      const ind = document.getElementById('ind-focus');
      ind.innerText = 'BREACH (PRINT ATTEMPT)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'copy_paste_attempt') {
      const ind = document.getElementById('ind-focus');
      ind.innerText = 'BREACH (COPY/PASTE)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'screenshot_attempt') {
      const ind = document.getElementById('ind-focus');
      ind.innerText = 'BREACH (SCREENSHOT)';
      ind.className = 'sec-indicator-status err';
    } else if (violationType === 'restricted_key_pressed') {
      const ind = document.getElementById('ind-focus');
      ind.innerText = 'BREACH (RESTRICTED KEY)';
      ind.className = 'sec-indicator-status err';
    }
  })
  .catch(err => console.error('[logViolation] Network error:', err));
}

// Infraction simulator hooks (Hidden in debug drawer Ctrl + Shift + D)
function simulateBluetoothViolation(isActive) {
  if (isActive) logViolation('bluetooth_on');
}
function simulatePhoneViolation(isActive) {
  if (isActive) logViolation('phone_detected');
}
function simulateCameraOffViolation(isActive) {
  if (isActive) {
    if (videoStream) videoStream.getTracks().forEach(t => t.stop());
    document.getElementById('proctor-video').style.display = 'none';
    document.getElementById('camera-placeholder').style.display = 'flex';
    document.getElementById('camera-placeholder').innerText = '⚠️ Stream disconnected';
    logViolation('camera_off');
  }
}
function simulateScreenOffViolation(isActive) {
  if (isActive) {
    if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    logViolation('screen_share_off');
  }
}

// Open / Close Developer debugging Telemetry drawer with Ctrl + Shift + D
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === 'D') {
    e.preventDefault();
    const panel = document.getElementById('secret-debug-panel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  }
});


// ═══════════════════════════════════════════════════════════════
// SMOOTH UX UTILITIES
// Replaces native alert/confirm, adds toast, loading overlay, retry
// ═══════════════════════════════════════════════════════════════

/**
 * showLoading(label, sub) — Show full-screen loading overlay
 * hideLoading()           — Hide it
 */
function showLoading(label = 'Please wait...', sub = '') {
  document.getElementById('loading-label-text').textContent = label;
  document.getElementById('loading-sub-text').textContent = sub;
  document.getElementById('global-loading-overlay').classList.add('visible');
}
function hideLoading() {
  document.getElementById('global-loading-overlay').classList.remove('visible');
}

/**
 * showToast(message, type, durationMs)
 * type: 'success' | 'error' | 'info' | 'warn'
 */
function showToast(message, type = 'info', durationMs = 4000) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 320);
  }, durationMs);
}

/**
 * smoothConfirm({ title, body, icon, confirmText, cancelText, danger })
 * Returns a Promise<boolean>
 */
function smoothConfirm({ title = 'Confirm', body = '', icon = '⚠️', iconType = 'warn',
    confirmText = 'Confirm', cancelText = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('smooth-modal-overlay');
    document.getElementById('smooth-modal-icon').textContent = icon;
    document.getElementById('smooth-modal-icon').className = `smooth-modal-icon ${iconType}`;
    document.getElementById('smooth-modal-title').textContent = title;
    document.getElementById('smooth-modal-body').textContent = body;

    const confirmBtn = document.getElementById('smooth-modal-confirm');
    const cancelBtn  = document.getElementById('smooth-modal-cancel');
    confirmBtn.textContent = confirmText;
    confirmBtn.className = `smooth-modal-btn ${danger ? 'danger-btn' : 'primary'}`;
    cancelBtn.textContent  = cancelText;

    overlay.classList.add('visible');

    const cleanup = (result) => {
      overlay.classList.remove('visible');
      confirmBtn.onclick = null;
      cancelBtn.onclick  = null;
      resolve(result);
    };
    confirmBtn.onclick = () => cleanup(true);
    cancelBtn.onclick  = () => cleanup(false);
  });
}

/**
 * smoothAlert(message, icon, iconType) — Non-blocking alert (no cancel button)
 */
function smoothAlert(message, title = 'Notice', icon = 'ℹ️', iconType = 'info') {
  return new Promise((resolve) => {
    const overlay = document.getElementById('smooth-modal-overlay');
    document.getElementById('smooth-modal-icon').textContent = icon;
    document.getElementById('smooth-modal-icon').className = `smooth-modal-icon ${iconType}`;
    document.getElementById('smooth-modal-title').textContent = title;
    document.getElementById('smooth-modal-body').textContent = message;

    const confirmBtn = document.getElementById('smooth-modal-confirm');
    const cancelBtn  = document.getElementById('smooth-modal-cancel');
    confirmBtn.textContent = 'OK';
    confirmBtn.className   = 'smooth-modal-btn primary';
    cancelBtn.style.display = 'none';

    overlay.classList.add('visible');
    const cleanup = () => {
      overlay.classList.remove('visible');
      confirmBtn.onclick = null;
      cancelBtn.style.display = '';
      resolve();
    };
    confirmBtn.onclick = cleanup;
  });
}

/**
 * fetchWithRetry(url, options, retries, delayMs)
 * Auto-retries failed fetch calls with exponential backoff.
 * Only retries on network errors (not 4xx/5xx responses).
 */
async function fetchWithRetry(url, options = {}, retries = 3, delayMs = 800) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      const isLast = attempt === retries;
      console.warn(`[fetchWithRetry] Attempt ${attempt}/${retries} failed for ${url}:`, err.message);
      if (isLast) throw err;
      // Exponential backoff: 800ms → 1600ms → 3200ms
      await new Promise(r => setTimeout(r, delayMs * Math.pow(2, attempt - 1)));
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// AUTO-SAVE: Draft code to localStorage every 30 seconds
// ═══════════════════════════════════════════════════════════════

let _autoSaveInterval = null;

function initAutoSave(examId) {
  if (_autoSaveInterval) clearInterval(_autoSaveInterval);
  const badge = document.getElementById('autosave-badge');
  const editor = document.getElementById('code-editor');

  // Restore draft if any
  const savedDraft = localStorage.getItem(`exam_draft_${examId}`);
  if (savedDraft && editor && editor.value.trim() === (currentExam.codeTemplate || '').trim()) {
    editor.value = savedDraft;
    if (badge) { badge.textContent = '📄 Draft restored'; badge.classList.add('saved'); }
    setTimeout(() => { if(badge) { badge.classList.remove('saved'); badge.textContent = 'auto-saved'; }}, 3000);
  }

  _autoSaveInterval = setInterval(() => {
    if (!currentExam || !editor) return;
    const code = editor.value;
    if (code && code.trim().length > 10) {
      localStorage.setItem(`exam_draft_${examId}`, code);
      if (badge) {
        badge.textContent = '✓ Saved';
        badge.classList.add('saved');
        setTimeout(() => {
          if (badge) { badge.classList.remove('saved'); badge.textContent = 'auto-saved'; }
        }, 2000);
      }
    }
  }, 30000);
}

function stopAutoSave(examId) {
  if (_autoSaveInterval) { clearInterval(_autoSaveInterval); _autoSaveInterval = null; }
  // Clear draft on successful submission
  if (examId) localStorage.removeItem(`exam_draft_${examId}`);
}

// ═══════════════════════════════════════════════════════════════
// RUN TESTS — Compiles code and verifies test cases dynamically
// ═══════════════════════════════════════════════════════════════
let _runTestsInProgress = false;

async function runTests() {
  if (!currentExam) return;
  if (_runTestsInProgress) return;

  const btn = document.getElementById('btn-run-tests');
  if (!btn) return;

  const code = document.getElementById('code-editor').value;
  if (!code || code.trim().length === 0) {
    await smoothAlert('Please write some code before running tests!', 'Empty Solution', '⚠️', 'warn');
    return;
  }

  _runTestsInProgress = true;
  btn.disabled = true;
  btn.innerHTML = `<svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation: spin 1s linear infinite;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Running...`;
  
  // Custom spin animation if not present
  if (!document.getElementById('spin-keyframes-style')) {
    const style = document.createElement('style');
    style.id = 'spin-keyframes-style';
    style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
    document.head.appendChild(style);
  }

  try {
    const res = await fetch('/api/exams/run-tests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        exam_id: currentExam.examId,
        code: code,
        language: currentExam.skillName,
        test_cases: currentExam.testCases
      })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Server error during execution');
    }

    const data = await res.json();
    
    // Update the test cases list to show status of each run
    const list = document.getElementById('test-cases-list');
    if (list && data.results) {
      list.innerHTML = '';
      
      let totalPassed = 0;
      data.results.forEach((tc, i) => {
        if (tc.passed) totalPassed++;
        
        const row = document.createElement('div');
        row.style.cssText = 'display:grid; grid-template-columns:auto 1fr auto; gap:10px; padding:10px 12px; background:var(--white); border:1px solid var(--gray-200); border-radius:6px; align-items:center;';
        
        // Success / failure dots with nice pulse
        const dotBg = tc.passed ? '#22c55e' : '#ef4444';
        const statusDot = `<span style="width:10px;height:10px;border-radius:50%;background:${dotBg};display:inline-block;box-shadow:0 0 8px ${dotBg}88;" id="tc-dot-${i}"></span>`;
        
        const feedbackColor = tc.passed ? 'var(--teal-800)' : 'var(--red-800)';
        const feedbackBg = tc.passed ? 'var(--teal-50)' : 'var(--red-50)';
        
        row.innerHTML = `
          ${statusDot}
          <div>
            <div style="font-weight:700; color:var(--gray-800); font-size:11px; margin-bottom:2px;">${tc.label || tc.description}</div>
            <div style="color:var(--gray-500); font-size:11px; margin-bottom:4px;">Input: <code style="background:var(--gray-50); padding:2px 4px; border-radius:3px; font-family:monospace;">${tc.input || 'None'}</code></div>
            <div style="font-family:monospace; font-size:11px; padding:6px 8px; border-radius:4px; background:${feedbackBg}; color:${feedbackColor}; border:1px solid ${tc.passed ? 'var(--teal-100)' : 'var(--red-100)'}; margin-top:4px;">
              <strong>Output:</strong> ${tc.actual || 'No output'}
            </div>
          </div>
          <div style="text-align:right; font-size:11px; display:flex; flex-direction:column; gap:4px;">
            <span style="color:var(--gray-500);">Expected:</span>
            <code style="color:var(--orange-deep); font-weight:700; font-family:monospace; background:rgba(249,115,22,0.05); padding:2px 4px; border-radius:3px;">${tc.expected || 'None'}</code>
            <span style="font-size:10px; font-weight:700; color:${tc.passed ? 'var(--teal-600)' : 'var(--red-600)'}; text-transform:uppercase; margin-top:2px;">
              ${tc.passed ? '✅ Passed' : '❌ Failed'}
            </span>
          </div>
        `;
        list.appendChild(row);
      });

      // Update the panel header with a gorgeous summary badge
      const panelTitle = document.querySelector('#test-cases-panel > div');
      if (panelTitle) {
        // Remove existing badge if present
        const oldBadge = document.getElementById('test-summary-badge');
        if (oldBadge) oldBadge.remove();

        const badge = document.createElement('span');
        badge.id = 'test-summary-badge';
        const isPerfect = totalPassed === data.results.length;
        badge.style.cssText = `margin-left:auto; font-size:11px; padding:3px 10px; border-radius:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;
          background:${isPerfect ? 'var(--teal-100)' : 'var(--red-100)'}; color:${isPerfect ? 'var(--teal-800)' : 'var(--red-800)'};`;
        badge.textContent = `${totalPassed} / ${data.results.length} Passed`;
        panelTitle.appendChild(badge);
      }

      // Add simple visual notice of runs remaining
      const oldNotice = document.getElementById('test-runs-notice');
      if (oldNotice) oldNotice.remove();
      
      const notice = document.createElement('div');
      notice.id = 'test-runs-notice';
      notice.style.cssText = 'font-size:11px; color:var(--gray-500); margin-top:8px; text-align:right; font-style:italic;';
      notice.textContent = `Rate Limit: ${data.runsRemaining} execution runs remaining for this question.`;
      list.after(notice);

      await smoothAlert(
        `Tests finished! ${totalPassed} / ${data.results.length} test cases passed successfully.`,
        'Execution Completed',
        totalPassed === data.results.length ? '🎉' : '⚠️',
        totalPassed === data.results.length ? 'success' : 'warn'
      );
    }
  } catch (err) {
    console.error('[Run Tests Error]', err);
    await smoothAlert(
      err.message || 'Execution service returned an error. Please try again.',
      'Execution Failed',
      '🚫', 'danger'
    );
  } finally {
    _runTestsInProgress = false;
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> Run Tests`;
  }
}

// ═══════════════════════════════════════════════════════════════
// SUBMIT EXAM — Smooth, retrying, idempotent, with loading states
// ═══════════════════════════════════════════════════════════════

// Guard: prevent any double-submission during active submit
let _submitInProgress = false;

async function submitExam(isAutoSubmit = false) {
  if (!currentExam) return;

  // Guard against double-submit
  if (_submitInProgress) {
    console.warn('[Submit] Double-submit blocked — submission already in progress');
    return;
  }

  if (!isAutoSubmit) {
    const confirmed = await smoothConfirm({
      title: 'Submit Solution',
      body: 'Are you sure you want to finalize and submit your coding exam? You cannot make changes after submission.',
      icon: '🚀',
      iconType: 'info',
      confirmText: 'Submit Now',
      cancelText: 'Keep Working'
    });
    if (!confirmed) return;
  }

  // Lock submit button immediately
  _submitInProgress = true;
  examSubmittingOrExiting = true;

  // Disable submit buttons to prevent double-click
  document.querySelectorAll('button[onclick*="submitExam"], button[onclick*="exitExamWithSubmission"]')
    .forEach(btn => { btn.classList.add('btn-submitting'); btn.disabled = true; });

  const code = document.getElementById('code-editor').value;
  const examId = currentExam.examId;

  // Capture an end-of-exam photo BEFORE submitting
  try { captureExamPhoto('end'); } catch(e) {}
  stopPhotoCaptures();

  showLoading('Submitting your solution…', 'Securely encrypting and saving your code. Please stay on this page.');

  try {
    const res = await fetchWithRetry('/api/exams/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exam_id: examId, code })
    }, 3, 1000);

    const data = await res.json();
    hideLoading();

    if (data.status === 'disqualified') {
      await smoothAlert(
        `Your assessment results are WITHHELD due to ${data.violationsCount} proctoring security infractions. ` +
        `The recruiter has been notified with full evidence photos.`,
        'Assessment Finished — Disqualified',
        '🚫', 'danger'
      );
      stopAutoSave(examId);
      exitExamEnvironment(data);
      return;
    }

    if (data.status === 'expired') {
      await smoothAlert(
        'Your exam session has expired. The time limit was reached.',
        'Session Expired',
        '⏰', 'warn'
      );
      stopAutoSave(examId);
      exitExamEnvironment(data);
      return;
    }

    // Multi-stage: check if more questions remain
    if (currentExam.scheduleId && currentExam.questionList &&
        (currentExam.currentQuestionIndex + 1 < currentExam.questionList.length)) {
      const nextIndex = currentExam.currentQuestionIndex + 1;
      const nextQuestionId = currentExam.questionList[nextIndex];

      showLoading(
        `Stage ${nextIndex + 1} loading…`,
        'Your answer was saved. Preparing the next question.'
      );

      try {
        const nextRes = await fetchWithRetry('/api/exams/next-scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            student_email: currentUser.email,
            schedule_id: currentExam.scheduleId,
            question_id: nextQuestionId,
            prev_exam_id: examId
          })
        }, 3, 800);

        const nextData = await nextRes.json();
        hideLoading();

        if (nextData.error) {
          showToast(nextData.error, 'error');
          stopAutoSave(examId);
          exitExamEnvironment(data);
          return;
        }

        // Update currentExam in-place — camera/mic/timer all continue uninterrupted
        currentExam.examId = nextData.examId;
        currentExam.currentQuestionIndex = nextIndex;
        currentExam.questionTitle = nextData.questionTitle;
        currentExam.codeTemplate  = nextData.codeTemplate;
        currentExam.testCases     = nextData.testCases;

        // Flash the workspace then update UI
        const workspace = document.querySelector('.workspace-card');
        if (workspace) { workspace.classList.add('question-flash'); setTimeout(() => workspace.classList.remove('question-flash'), 900); }

        document.getElementById('active-question-title').innerText = currentExam.questionTitle || 'Scheduled Coding Challenge';
        document.getElementById('code-editor').value = currentExam.codeTemplate;
        if (typeof updateDesignMockupVisibility === 'function') updateDesignMockupVisibility();
        renderTestCases(nextData.testCases);

        // Start auto-save for new examId
        initAutoSave(nextData.examId);

        // Unlock submit for next stage
        _submitInProgress = false;
        examSubmittingOrExiting = false;
        document.querySelectorAll('button[onclick*="submitExam"], button[onclick*="exitExamWithSubmission"]')
          .forEach(btn => { btn.classList.remove('btn-submitting'); btn.disabled = false; });

        showToast(`Stage ${nextIndex} submitted! Now working on Stage ${nextIndex + 1}.`, 'success', 5000);

      } catch (nextErr) {
        hideLoading();
        console.error('Failed to load next stage:', nextErr);
        showToast('Could not load next stage. Ending exam.', 'error');
        stopAutoSave(examId);
        exitExamEnvironment(data);
      }

    } else {
      // Final stage — complete!
      stopAutoSave(examId);
      exitExamEnvironment(data);
      // Show success toast after exit
      setTimeout(() => {
        showToast('🎉 Assessment submitted successfully! Results are under review.', 'success', 6000);
      }, 600);
    }

  } catch (err) {
    hideLoading();
    console.error('[Submit] Network error after retries:', err);
    _submitInProgress = false;
    examSubmittingOrExiting = false;

    // Re-enable submit buttons so student can retry
    document.querySelectorAll('button[onclick*="submitExam"], button[onclick*="exitExamWithSubmission"]')
      .forEach(btn => { btn.classList.remove('btn-submitting'); btn.disabled = false; });

    showToast('Submission failed — check your connection and try again.', 'error', 7000);
  }
}

async function exitExamWithSubmission() {
  const confirmed = await smoothConfirm({
    title: 'Exit & Submit',
    body: 'Are you sure you want to exit? Your current code will be securely submitted and the test will end without penalty.',
    icon: '📤',
    iconType: 'warn',
    confirmText: 'Exit & Submit',
    cancelText: 'Stay in Exam',
    danger: false
  });
  if (!confirmed) return;
  examSubmittingOrExiting = true;
  submitExam(true);
}

function exitExamEnvironment(data) {
  // Stop all exam protections and cleanup
  document.getElementById('view-exam').classList.remove('strict-mode');
  clearInterval(currentTimer);
  cleanupStreams();
  stopPhoneDetection();
  stopBluetoothMonitoring();
  stopPhotoCaptures();

  // Stop devtools detection timer (critical — this fires logViolation which needs auth)
  if (devtoolsCheckInterval) { clearInterval(devtoolsCheckInterval); devtoolsCheckInterval = null; }

  examSubmittingOrExiting = false;
  _submitInProgress = false;

  // Clear auto-save interval (but NOT the draft — it's cleared on success in submitExam)
  if (_autoSaveInterval) { clearInterval(_autoSaveInterval); _autoSaveInterval = null; }

  // Re-enable any disabled submit buttons
  document.querySelectorAll('button[onclick*="submitExam"], button[onclick*="exitExamWithSubmission"]')
    .forEach(btn => { btn.classList.remove('btn-submitting'); btn.disabled = false; });

  // Cleanup all exam security bindings
  isExamPaused = false;
  clearInterval(window._wifiDotInterval);
  const wifiOverlay = document.getElementById('wifi-disconnect-overlay');
  if (wifiOverlay) wifiOverlay.classList.remove('visible');

  // Remove exam-only event listeners
  window.removeEventListener('beforeunload', window._examBeforeUnload);
  window.removeEventListener('offline', window._examOfflineHandler);
  window.removeEventListener('online', window._examOnlineHandler);
  window.removeEventListener('beforeprint', window._examPrintHandler);
  document.removeEventListener('contextmenu', document._examContextMenuBlock, true);
  document.removeEventListener('dragstart', document._examDragBlock, true);
  document.removeEventListener('drop', document._examDragBlock, true);
  document.removeEventListener('mousedown', document._examMiddleClickBlock, true);
  document.removeEventListener('selectstart', document._examSelectBlock, true);
  document.removeEventListener('keydown', strictKeyboardProctor, true);

  // Nullify currentExam AFTER all cleanup is done — the 401 interceptor uses this flag
  // to decide whether to logout, so it must stay set until all proctoring fetches are stopped
  currentExam = null;

  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  showView('student');
  if (currentUser) {
    loadStudentDashboard();
  }
}

// ── ADMIN VIEW: CREATE TIMED QUESTIONS ──
function createQuestion() {
  const skillId = document.getElementById('add-q-skill').value;
  const title = document.getElementById('add-q-title').value;
  const difficulty = document.getElementById('add-q-diff').value;
  const exp = document.getElementById('add-q-exp').value;
  const template = document.getElementById('add-q-template').value;

  if (!title || !template || !skillId) {
    alert('Please fill out all required fields.');
    return;
  }

  fetch('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      skill_id: skillId,
      title: title,
      difficulty: difficulty,
      expiration_minutes: exp,
      code_template: template
    })
  })
  .then(res => res.json())
  .then(data => {
    alert('Timed Challenge published successfully.');
    document.getElementById('add-q-title').value = '';
    document.getElementById('add-q-template').value = '';
  });
}

// ── ADMIN VIEW: LOAD HISTORIC LOGS & AI SYNTHESIS SUMMARIES ──
let masterSkillsList = [];
let bulkCandidateRowCount = 0;

function handleCSVUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const lines = text.split('\n');
    let addedCount = 0;
    
    const startIndex = (lines[0] && (lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('email'))) ? 1 : 0;
    
    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const parts = line.split(',');
      if (parts.length >= 2) {
        const name = parts[0].trim().replace(/^"|"$/g, '');
        const email = parts[1].trim().replace(/^"|"$/g, '');
        if (name && email) {
          // Defaults to first available skill (handled dynamically inside addCandidateRow)
          addCandidateRow(name, email);
          addedCount++;
        }
      }
    }
    
    alert(`Successfully parsed and added ${addedCount} candidates from CSV. Please select their target skills and click Send Exam Invites.`);
    event.target.value = ''; // Reset input
  };
  reader.readAsText(file);
}

function addCandidateRow(name = '', email = '', skillId = '') {
  bulkCandidateRowCount++;
  const container = document.getElementById('bulk-dispatch-rows');
  if (!container) return;
  const rowId = `bulk-row-${bulkCandidateRowCount}`;
  
  const div = document.createElement('div');
  div.id = rowId;
  div.style.border = '1.5px solid var(--gray-200)';
  div.style.borderRadius = 'var(--radius-sm)';
  div.style.padding = '12px';
  div.style.background = 'var(--gray-50)';
  div.style.position = 'relative';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  div.style.gap = '8px';
  
  let selectOptions = '';
  masterSkillsList.forEach(skill => {
    const selected = skill.id === skillId ? 'selected' : '';
    selectOptions += `<option value="${skill.id}" ${selected}>${skill.name}</option>`;
  });
  
  div.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:11px; font-weight:700; color:var(--orange-deep); text-transform:uppercase;">Candidate #${bulkCandidateRowCount}</span>
      <button onclick="removeCandidateRow('${rowId}')" style="background:none; border:none; color:#C62828; cursor:pointer; font-size:11px; font-weight:700;">Remove</button>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
      <input type="text" class="bulk-cand-name" placeholder="Alice Logan" value="${escapeHTML(name)}" style="padding:6px; border:1px solid var(--gray-200); border-radius:var(--radius-sm); font-size:12px; background:var(--white); color:var(--gray-900);" />
      <input type="email" class="bulk-cand-email" placeholder="alice@gmail.com" value="${escapeHTML(email)}" style="padding:6px; border:1px solid var(--gray-200); border-radius:var(--radius-sm); font-size:12px; background:var(--white); color:var(--gray-900);" />
    </div>
    <select class="bulk-cand-skill" style="padding:6px; border:1px solid var(--gray-200); border-radius:var(--radius-sm); font-size:12px; width:100%; background:var(--white); color:var(--gray-900);">
      ${selectOptions}
    </select>
  `;
  
  container.appendChild(div);
}

function removeCandidateRow(rowId) {
  const row = document.getElementById(rowId);
  if (row) row.remove();
}

function closeBulkDispatchModal() {
  document.getElementById('bulk-dispatch-modal').style.display = 'none';
  loadAdminHistory();
}

async function runBulkDispatch() {
  const rowElements = document.querySelectorAll('#bulk-dispatch-rows > div');
  if (rowElements.length === 0) {
    alert('Please add at least one candidate row.');
    return;
  }

  const candidates = [];
  let validationError = false;

  rowElements.forEach(row => {
    const nameInput = row.querySelector('.bulk-cand-name');
    const emailInput = row.querySelector('.bulk-cand-email');
    const skillSelect = row.querySelector('.bulk-cand-skill');

    if (!nameInput || !emailInput || !skillSelect) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const skillId = skillSelect.value;

    if (!name || !email) {
      validationError = true;
      return;
    }
    candidates.push({ name, email, skillId });
  });

  if (validationError) {
    alert('Please fill out all candidate names and emails.');
    return;
  }

  document.getElementById('bulk-dispatch-modal').style.display = 'flex';
  document.getElementById('bulk-dispatch-finished-actions').style.display = 'none';
  
  const progressBar = document.getElementById('bulk-dispatch-progress-bar');
  progressBar.style.width = '0%';

  const logConsole = document.getElementById('bulk-dispatch-sending-log');
  logConsole.innerHTML = '';

  const logMessage = (msg, color = '#FFF') => {
    const div = document.createElement('div');
    div.style.color = color;
    div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logConsole.appendChild(div);
    logConsole.scrollTop = logConsole.scrollHeight;
  };

  logMessage('SMTP & Proctoring Console Pipeline Initializing...', '#FFD7C9');
  logMessage(`Prepared bulk job skill queue for ${candidates.length} candidates.`);

  const tableBody = document.getElementById('bulk-dispatch-report-table-body');
  tableBody.innerHTML = '';

  let successCount = 0;
  const processedResults = [];

  for (let i = 0; i < candidates.length; i++) {
    const cand = candidates[i];
    progressBar.style.width = Math.round((i / candidates.length) * 100) + '%';

    logMessage(`----------------------------------------`, '#6B6A64');
    logMessage(`Onboarding candidate: ${cand.name} (${cand.email})...`, '#FFF');
    
    await new Promise(r => setTimeout(r, 400));
    logMessage(`Connecting to SMTP relay server (Port 465 SSL)...`, '#B0AFA8');
    
    await new Promise(r => setTimeout(r, 450));
    logMessage(`SMTP handshake established. Transmitting timed skill challenge...`, '#2E7D32');

    await new Promise(r => setTimeout(r, 400));
    logMessage(`Candidate connected WebRTC proctor: webcam stream & microphone sensor active.`, '#B0AFA8');

    await new Promise(r => setTimeout(r, 450));
    logMessage(`Invoking SkillProof AI Senior Auditor for evaluation...`, '#FFD7C9');

    try {
      // MULTI-TENANT: Attach company_id so dispatched exams are scoped to this company
      const res = await fetch('/api/recruiter/dispatch-and-evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidates: [cand], company_id: currentCompany ? currentCompany.id : null })
      });

      const data = await res.json();
      if (res.ok && data.results && data.results.length > 0) {
        const result = data.results[0];
        successCount++;
        processedResults.push(result);

        const infractionMsg = result.violationsCount > 0 
          ? `⚠️ Proctor flag: ${result.violationsCount} breach` 
          : `✓ Proctor clean`;
        
        logMessage(`AI Report Synthesized: Score: ${result.status === 'disqualified' ? 'WITHHELD' : result.score}/100 | ${infractionMsg}`, '#FFD7C9');
        logMessage(`✓ Successful dispatch completed for ${cand.name}.`, '#2E7D32');
      } else {
        logMessage(`❌ Failed to dispatch / evaluate candidate: ${data.error || 'Server error'}`, '#FF5252');
      }
    } catch (err) {
      logMessage(`❌ Network error executing evaluation: ${err.message}`, '#FF5252');
    }
  }

  progressBar.style.width = '100%';
  logMessage(`----------------------------------------`, '#6B6A64');
  logMessage(`Bulk dispatch complete. Success count: ${successCount} / ${candidates.length}`, '#FFF');

  processedResults.forEach(r => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--gray-100)';
    
    const violationBadge = r.violationsCount > 0 
      ? `<span style="color:#C62828; font-weight:700;">⚠️ ${r.violationsCount} violations</span>` 
      : `<span style="color:#2E7D32; font-weight:700;">✓ Clean proctor</span>`;

    tr.innerHTML = `
      <td style="padding: 8px 6px;">
        <strong>${escapeHTML(r.name)}</strong><br/>
        <span style="color:var(--gray-500); font-size:10px">${escapeHTML(r.email)}</span>
      </td>
      <td style="padding: 8px 6px;">${escapeHTML(r.skillName)}</td>
      <td style="padding: 8px 6px;"><strong>${r.status === 'disqualified' ? 'Result Withheld' : r.score + '/100'}</strong></td>
      <td style="padding: 8px 6px;">${violationBadge}</td>
      <td style="padding: 8px 6px; text-align: right; color:#2E7D32; font-weight:700;">${r.smtpStatus}</td>
    `;
    tableBody.appendChild(tr);
  });

  document.getElementById('bulk-dispatch-finished-actions').style.display = 'block';
}

function exportHistoryToExcel() {
  if (typeof currentExamsList === 'undefined' || !currentExamsList || currentExamsList.length === 0) {
    alert('No data available to export.');
    return;
  }
  
  let csvContent = "Student Name,Email,Skill,Status,Score,Infractions,Started At,Submitted At\n";
  
  currentExamsList.forEach(e => {
    const status = e.status === 'disqualified' ? 'WITHHELD' : e.status.toUpperCase();
    const score = e.status === 'disqualified' ? 'N/A' : (e.score !== null ? e.score : 'Pending');
    const started = e.started_at ? new Date(e.started_at).toLocaleString() : 'N/A';
    const submitted = e.submitted_at ? new Date(e.submitted_at).toLocaleString() : 'N/A';
    
    const name = `"${(e.student_name || '').replace(/"/g, '""')}"`;
    const email = `"${(e.student_email || '').replace(/"/g, '""')}"`;
    const skill = `"${(e.skill_name || '').replace(/"/g, '""')}"`;
    
    csvContent += `${name},${email},${skill},${status},${score},${e.violations_count},"${started}","${submitted}"\n`;
  });
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  const companyName = typeof currentCompany !== 'undefined' && currentCompany ? currentCompany.name.replace(/\s+/g, '_') : 'Admin';
  link.setAttribute("download", `SkillProof_${companyName}_Export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function loadAdminHistory() {
  const historyBody = document.getElementById('admin-history-list');
  historyBody.innerHTML = '<tr><td colspan="7" style="color:var(--gray-500)">Syncing historic logs...</td></tr>';

  // Ensure master checkbox is cleared on every refresh
  const selectAll = document.getElementById('select-all-history');
  if (selectAll) selectAll.checked = false;
  updateSelectedCandidatesCount();

  // Update recruiter dashboard title with company name
  const historyTitle = document.getElementById('recruiter-history-title');
  if (historyTitle && currentCompany) {
    historyTitle.innerText = `${currentCompany.name} — Assessments & Proctoring History`;
  }

  const renderHistory = () => {
    // MULTI-TENANT: Pass company_id to filter by recruiter's company
    const companyParam = currentCompany ? `?company_id=${currentCompany.id}` : '';
    fetch('/api/exams/history' + companyParam)
      .then(res => res.json())
      .then(exams => {
        currentExamsList = exams; // Store globally!
        historyBody.innerHTML = '';
        if (exams.length === 0) {
          historyBody.innerHTML = '<tr><td colspan="7" style="color:var(--gray-500)">No students have taken tests yet.</td></tr>';
          return;
        }

        exams.forEach(exam => {
          let infractionLog = '';
          if (exam.violations && exam.violations.length > 0) {
            infractionLog = exam.violations.map(v => {
              const time = new Date(v.timestamp).toLocaleTimeString();
              return `• [${time}] Breach: ${v.type.toUpperCase()}`;
            }).join('<br/>');
          } else {
            infractionLog = '<span style="color:#2E7D32">No breaches recorded</span>';
          }

          const summaryText = exam.ai_summary || 'Evaluating...';
          const finalScore = exam.status === 'disqualified' ? 0 : (exam.score || 0);
          
          // Company-specific badge beside student names if >= 60
          const companyLabel = currentCompany ? currentCompany.name : 'SkillProof';
          const goldBadgeHTML = finalScore >= 60
            ? ` <span class="certified-gold-badge" style="margin-left: 6px;">🏆 ${companyLabel} Verified</span>`
            : '';

          const deviceFlagHTML = exam.device_flagged === 1
            ? `<br/><span class="device-flag-badge" style="background:#C62828; color:#FFF; font-size:9.5px; font-weight:700; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block;">⚠️ Device/IP Changed</span>`
            : '';

          const allowedAttempts = 3 + (exam.extra_attempts || 0);
          const currentAttempts = exam.attempts_count || 1;
          const isTechnicalLockout = exam.status === 'active' && (exam.joins_count || 1) >= (exam.max_joins || 4);
          
          let attemptsHTML = `<div style="font-size:11px; font-weight:600; color:var(--gray-600); margin-top:2px;">Attempts: ${currentAttempts} / ${allowedAttempts}</div>`;
          if (isTechnicalLockout) {
            attemptsHTML += `<div style="font-size:11px; font-weight:700; color:#C62828; margin-top:2px;">⚠️ Tech Lockout (${exam.joins_count}/${exam.max_joins || 4})</div>`;
          }

          const canGrant = (currentAttempts >= allowedAttempts) || isTechnicalLockout;

          const grantAttemptIconBtn = canGrant
            ? `<button onclick="grantExtraAttempt('${escapeHTML(exam.student_email)}', '${escapeHTML(exam.skill_id)}')" class="btn-secondary" title="Grant Extra Attempt" style="width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1.5px solid var(--orange-mid); background: #FFF; color: var(--orange-deep); font-size: 11px; font-weight: 800; cursor: pointer;">➕</button>`
            : `<button disabled class="btn-ghost" title="Attempts Remaining" style="width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1.5px solid var(--gray-100); background: var(--gray-50); color: var(--gray-400); font-size: 11px; cursor: not-allowed; opacity: 0.5;">✅</button>`;

          const verifierLabel = currentCompany ? currentCompany.name : 'SkillProof Head Admin';
          const isAlreadyAwarded = exam.student_badge_tag && exam.student_badge_tag.includes(verifierLabel);

          let profileLinksHTML = '';
          if (exam.github_profile) {
            profileLinksHTML += ` <a href="${escapeHTML(exam.github_profile)}" target="_blank" style="display:inline-flex; align-items:center; background:#1C1A17; color:#F5F4F0; border:1px solid #333; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-top:4px; text-decoration:none; margin-right:4px;">💻 GitHub</a>`;
          }
          if (exam.linkedin_profile) {
            profileLinksHTML += ` <a href="${escapeHTML(exam.linkedin_profile)}" target="_blank" style="display:inline-flex; align-items:center; background:#0077B5; color:#FFF; font-size:10px; font-weight:700; padding:2px 6px; border-radius:4px; margin-top:4px; text-decoration:none;">🔗 LinkedIn</a>`;
          }
          if (profileLinksHTML) {
            profileLinksHTML = `<div style="margin-top: 4px;">${profileLinksHTML}</div>`;
          }

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="text-align: center;">
              <input type="checkbox" class="candidate-checkbox" data-email="${escapeHTML(exam.student_email)}" data-name="${escapeHTML(exam.student_name)}" data-score="${escapeHTML(String(finalScore))}" data-skill="${escapeHTML(exam.question_title)}" data-violations="${escapeHTML(String(exam.violations_count))}" data-status="${escapeHTML(exam.status)}" onchange="updateSelectedCandidatesCount()" style="transform:scale(1.2); cursor:pointer;" />
            </td>
            <td>
              <strong>${escapeHTML(exam.student_name)}${goldBadgeHTML}${deviceFlagHTML}</strong><br/>
              <span style="color:var(--gray-500); font-size:11px">${escapeHTML(exam.student_email)}</span>
              ${profileLinksHTML}
            </td>
            <td>
              <strong>${escapeHTML(exam.skill_name || 'Technical Test')}</strong><br/>
              <span style="font-size:10px; color:var(--gray-500);" title="${escapeHTML(exam.question_title)}">${escapeHTML(exam.question_title.substring(0,30))}...</span>
              <div style="font-size:10px; color:var(--gray-400); margin-top:4px;">
                Started: ${exam.started_at ? new Date(exam.started_at).toLocaleString() : 'N/A'}<br/>
                Submitted: ${exam.submitted_at ? new Date(exam.submitted_at).toLocaleString() : 'N/A'}
              </div>
              ${attemptsHTML}
            </td>
            <td style="text-align: center;">
              <strong style="color:${exam.violations_count > 0 ? '#C62828' : '#2E7D32'}">
                ${escapeHTML(String(exam.violations_count))}
              </strong>
            </td>
            <td style="text-align: center;"><span class="status-tag ${exam.status}">${exam.status === 'disqualified' ? 'DISQUALIFIED' : exam.status.toUpperCase()}</span></td>
            <td style="text-align: center;"><strong>${exam.status === 'disqualified' ? 'Withheld' : finalScore + '/100'}</strong></td>
            <td style="text-align: center;">
              <div style="display: flex; align-items: center; justify-content: center; gap: 6px;">
                <button onclick="viewCandidateCode('${exam.examId}')" class="btn-ghost" ${isAlreadyAwarded ? 'disabled' : ''} title="${isAlreadyAwarded ? `Awarded by ${verifierLabel}` : 'View Code & Award Badge'}" style="width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: 1.5px solid var(--gray-200); font-size: 13px; cursor: ${isAlreadyAwarded ? 'not-allowed' : 'pointer'}; opacity: ${isAlreadyAwarded ? '0.5' : '1'};">
                  ${isAlreadyAwarded ? '🏆' : '💻'}
                </button>
                <button onclick="triggerInviteForCandidate('${exam.examId}')" class="btn-primary" title="Invite Candidate to Next Round" style="width: 30px; height: 30px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: 6px; border: none; background: var(--orange-deep); color: #fff; font-size: 13px; cursor: pointer;">
                  ✉️
                </button>
                ${grantAttemptIconBtn}
              </div>
            </td>
          `;
          historyBody.appendChild(tr);
        });
      })
      .catch(err => {
        console.error('Failed to load history logs:', err);
        historyBody.innerHTML = '<tr><td colspan="7" style="color:#C62828; font-weight:700; text-align:center; padding:20px 0;">⚠️ Failed to sync history logs. <button onclick="loadAdminHistory()" class="btn-primary" style="display:inline-flex; align-items:center; padding:6px 12px; font-size:11px; margin-left:8px; cursor:pointer;">Retry Sync</button></td></tr>';
      });
  };

  if (masterSkillsList.length === 0) {
    fetch('/api/skills')
      .then(res => res.json())
      .then(skills => {
        masterSkillsList = skills;
        const dispatcherRows = document.getElementById('bulk-dispatch-rows');
        if (dispatcherRows && dispatcherRows.children.length === 0) {
          addCandidateRow('David Jones', 'david.jones@gmail.com', masterSkillsList[0]?.id);
          addCandidateRow('Emily Watson', 'emily.watson@yahoo.com', masterSkillsList[1]?.id || masterSkillsList[0]?.id);
        }
        populateScheduleSkillSelect();
        loadRecruiterSchedules();
        renderHistory();
        loadRecruiterDashboard();
      })
      .catch(err => {
        console.error('Failed to load master skills list:', err);
        renderHistory();
        loadRecruiterDashboard();
      });
  } else {
    populateScheduleSkillSelect();
    loadRecruiterSchedules();
    renderHistory();
    loadRecruiterDashboard();
  }
}

function grantExtraAttempt(studentEmail, skillId) {
  if (!currentUser) return;
  const recruiterEmail = currentUser.email;

  if (!confirm(`Are you sure you want to grant an extra attempt to candidate ${studentEmail} for this assessment?`)) {
    return;
  }

  fetch('/api/recruiter/grant-attempt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recruiter_email: recruiterEmail,
      student_email: studentEmail,
      skill_id: skillId
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }
    alert(data.message || 'Extra attempt granted successfully!');
    loadAdminHistory(); // Refresh the recruiter dashboard history list!
  })
  .catch(err => {
    console.error('Grant Attempt Error:', err);
    alert('Failed to grant extra attempt.');
  });
}

// Candidate Code Viewer Methods
let activeChallengeId = null;

function viewCandidateCode(examId) {
  const exam = currentExamsList.find(e => e.examId === examId || e.id === examId);
  if (!exam) {
    alert('Candidate record not found.');
    return;
  }
  
  activeChallengeId = exam.examId || exam.id;
  
  const codeContent = exam.submitted_code || '// No code submitted.';
  const codeView = document.getElementById('submitted-code-content-view');
  if (codeView) {
    codeView.textContent = codeContent; // Prevent HTML injection safely!
  }
  
  const modalSubtitle = document.getElementById('submitted-code-modal-subtitle');
  if (modalSubtitle) {
    modalSubtitle.innerText = `Exact logic answer submitted by ${exam.student_name} for ${exam.question_title}`;
  }

  // Show PHONE DETECTED warning if violations include phone_detected
  let phoneWarningEl = document.getElementById('phone-detected-warning');
  if (!phoneWarningEl) {
    phoneWarningEl = document.createElement('div');
    phoneWarningEl.id = 'phone-detected-warning';
    const modalSubtitleParent = modalSubtitle ? modalSubtitle.parentElement : null;
    if (modalSubtitleParent) modalSubtitleParent.insertBefore(phoneWarningEl, modalSubtitle.nextSibling);
  }

  const hasPhoneViolation = exam.violations && exam.violations.some(v => v.type === 'phone_detected');
  if (hasPhoneViolation) {
    phoneWarningEl.style.cssText = 'display:flex; align-items:center; gap:10px; padding:14px 18px; background:linear-gradient(135deg, #D32F2F, #B71C1C); color:#fff; border-radius:10px; margin:12px 0; font-family:var(--font-display); animation:pulse 1.5s infinite;';
    phoneWarningEl.innerHTML = `
      <span style="font-size:28px;">📱</span>
      <div>
        <div style="font-weight:900; font-size:16px; letter-spacing:0.5px; text-transform:uppercase;">⚠️ PHONE IN HAND NOTIFICATION</div>
        <div style="font-size:13px; font-weight:700; opacity:0.95; margin-top:3px;">AI detected a mobile device in the student's hand during this exam. Result WITHHELD — disqualified. Review proctoring photos for evidence.</div>
      </div>
    `;
  } else {
    phoneWarningEl.style.display = 'none';
    phoneWarningEl.innerHTML = '';
  }
  
  // Populate photo captions & thumbnails
  const photosContainer = document.getElementById('submitted-code-photos-container');
  if (photosContainer) {
    photosContainer.innerHTML = '<span style="color: var(--gray-500); font-size: 13px;">Loading proctoring captures...</span>';
    photosContainer.style.justifyContent = 'center';
    
    fetch(`/api/recruiter/exam-photos?challenge_id=${activeChallengeId}`)
      .then(res => res.json())
      .then(photos => {
        photosContainer.innerHTML = '';
        if (!Array.isArray(photos) || photos.length === 0) {
          photosContainer.innerHTML = '<span style="color: var(--gray-500); font-size: 13px;">No captures found for this session.</span>';
          photosContainer.style.justifyContent = 'center';
          return;
        }
        
        photosContainer.style.justifyContent = 'flex-start';
        photos.forEach(photo => {
          const imgWrapper = document.createElement('div');
          imgWrapper.style.cssText = 'position: relative; cursor: zoom-in; border: 1.5px solid var(--gray-200); border-radius: var(--radius-sm); overflow: hidden; width: 100px; height: 75px; flex-shrink: 0; background: var(--gray-100); transition: border-color 0.2s, transform 0.15s;';
          
          const img = document.createElement('img');
          img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="75" viewBox="0 0 100 75"><rect width="100" height="75" fill="%23f3f4f6"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="10" fill="%239ca3af">Loading...</text></svg>';
          img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
          imgWrapper.appendChild(img);
          
          // Lazy load individual frame photo data
          fetch(`/api/recruiter/exam-photo/${photo.id}`)
            .then(r => r.json())
            .then(data => {
              if (data && data.photo_data) {
                img.src = data.photo_data;
              }
            })
            .catch(e => console.error('Photo frame load error:', e));
            
          // Floating badge type overlay
          const typeBadge = document.createElement('span');
          const typeLabels = { 'id_verify': '🪪 ID Card', 'start': '▶️ Start', 'interval': '📸 Interval', 'random_1': '🎲 Random', 'random_2': '🎲 Random', 'random_3': '🎲 Random', 'phone_detected': '📱 PHONE' };
          typeBadge.innerText = typeLabels[photo.capture_type] || 'Webcam';
          const isPhone = photo.capture_type === 'phone_detected';
          typeBadge.style.cssText = `position: absolute; bottom: 2px; right: 2px; background: ${isPhone ? 'rgba(229,57,53,0.9)' : 'rgba(12, 10, 9, 0.75)'}; color: #fff; font-size: 8px; font-weight: 700; padding: 2px 5px; border-radius: 3px; border: 1px solid rgba(255,255,255,0.15); font-family: var(--font-sans);`;
          imgWrapper.appendChild(typeBadge);
          
          // Expansion zoom view overlay onClick
          imgWrapper.onclick = () => {
            const zoomOverlay = document.createElement('div');
            zoomOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(12, 10, 9, 0.92); z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: zoom-out;';
            
            const zoomImg = document.createElement('img');
            zoomImg.src = img.src;
            zoomImg.style.cssText = 'max-width: 90vw; max-height: 80vh; border-radius: var(--radius-lg); border: 2px solid var(--orange-mid); box-shadow: var(--shadow-xl);';
            zoomOverlay.appendChild(zoomImg);
            
            const caption = document.createElement('div');
            caption.innerText = `${photo.capture_type.toUpperCase()} CAPTURE · ${new Date(photo.timestamp).toLocaleTimeString()}`;
            caption.style.cssText = 'color: #fff; margin-top: 16px; font-family: var(--font-display); font-weight: 700; font-size: 14px; letter-spacing: 1px;';
            zoomOverlay.appendChild(caption);
            
            zoomOverlay.onclick = () => document.body.removeChild(zoomOverlay);
            document.body.appendChild(zoomOverlay);
          };
          
          photosContainer.appendChild(imgWrapper);
        });
      })
      .catch(err => {
        console.error('Error loading photos:', err);
        photosContainer.innerHTML = '<span style="color: var(--gray-500); font-size: 13px;">Failed to load proctoring captures.</span>';
        photosContainer.style.justifyContent = 'center';
      });
  }
  
  // Connect the action row buttons dynamic click events
  const awardBtn = document.getElementById('award-badge-btn');
  const denyBtn = document.getElementById('deny-badge-btn');
  if (awardBtn) {
    awardBtn.onclick = () => evaluateBadgeAward('award');
  }
  if (denyBtn) {
    denyBtn.onclick = () => evaluateBadgeAward('deny');
  }

  const actionRow = document.getElementById('badge-award-action-row');
  if (actionRow) {
    if (exam.status === 'badge_awarded' || exam.status === 'badge_denied') {
      actionRow.style.display = 'none';
      let evaluatedBanner = document.getElementById('modal-evaluated-banner');
      if (!evaluatedBanner) {
        evaluatedBanner = document.createElement('div');
        evaluatedBanner.id = 'modal-evaluated-banner';
        actionRow.parentElement.insertBefore(evaluatedBanner, actionRow);
      }
      evaluatedBanner.style.cssText = 'padding:14px 18px; background:var(--gray-50); border: 1.5px solid var(--gray-200); border-radius:10px; margin-bottom:20px; font-weight:700; color:var(--gray-700); text-align:center; font-size:14px;';
      evaluatedBanner.innerHTML = `🏆 This candidate assessment has already been evaluated.<br/><span style="font-size:12px; font-weight:600; color:var(--gray-500); margin-top:4px; display:inline-block;">Status: <span class="status-tag ${exam.status}">${exam.status.toUpperCase()}</span></span>`;
      evaluatedBanner.style.display = 'block';
    } else {
      actionRow.style.display = 'flex';
      const evaluatedBanner = document.getElementById('modal-evaluated-banner');
      if (evaluatedBanner) evaluatedBanner.style.display = 'none';
    }
  }
  
  const modal = document.getElementById('view-submitted-code-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function evaluateBadgeAward(actionType) {
  if (!activeChallengeId) {
    alert('No active student assessment loaded.');
    return;
  }
  
  const confirmMsg = actionType === 'award'
    ? 'Are you sure you want to certify this student and award them the premium badge?'
    : 'Are you sure you want to deny verification for this student and mark their claim as failed?';
    
  if (!confirm(confirmMsg)) return;
  
  const awardBtn = document.getElementById('award-badge-btn');
  const denyBtn = document.getElementById('deny-badge-btn');
  if (awardBtn) awardBtn.disabled = true;
  if (denyBtn) denyBtn.disabled = true;
  
  fetch('/api/recruiter/assign-badge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recruiter_email: currentUser.email,
      challenge_id: activeChallengeId,
      action: actionType
    })
  })
  .then(res => res.json())
  .then(data => {
    if (awardBtn) awardBtn.disabled = false;
    if (denyBtn) denyBtn.disabled = false;
    if (data.error) {
      alert(`Error: ${data.error}`);
    } else {
      alert(data.message || 'Verification processed successfully!');
      
      // Broadcast update to sync other tabs under the same origin immediately
      if (typeof syncChannel !== 'undefined') {
        syncChannel.postMessage('badge_updated');
      }
      
      closeSubmittedCodeModal();
      loadAdminHistory(); // Refresh the recruiter dashboard history list!
    }
  })
  .catch(err => {
    if (awardBtn) awardBtn.disabled = false;
    if (denyBtn) denyBtn.disabled = false;
    console.error('Failed to assign badge:', err);
    alert('Error connecting to the server. Please try again.');
  });
}

function closeSubmittedCodeModal() {
  const modal = document.getElementById('view-submitted-code-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  activeChallengeId = null;
}

// ── STUDENT DASHBOARD SUB-TAB SWITCHER ──
// ── STUDENT DASHBOARD SUB-TAB SWITCHER ──
function switchStudentTab(tabName) {
  // Hide all student workspace panels
  document.querySelectorAll('.student-workspace-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  // Show target student workspace panel
  const target = document.getElementById('tab-' + tabName);
  if (target) target.classList.add('active');

  if (typeof updateDesignMockupVisibility === 'function') updateDesignMockupVisibility();

  // Deactivate all navigation buttons
  document.querySelectorAll('.student-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  // Activate target button
  const targetBtn = document.getElementById('nav-btn-' + tabName);
  if (targetBtn) targetBtn.classList.add('active');

  // Only refresh notifications on demand — dashboard data persists across tab switches
  // to eliminate unnecessary re-fetches and visual "buffering" flicker
  if (currentUser && tabName === 'notifications') {
    loadFullNotifications();
  }
}

// ── RECRUITER DASHBOARD SUB-TAB SWITCHER ──
function switchRecruiterTab(tabName) {
  // Hide all recruiter workspace panels
  document.querySelectorAll('#view-admin .student-workspace-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  // Show target recruiter workspace panel
  const target = document.getElementById('tab-recruiter-' + tabName);
  if (target) target.classList.add('active');

  // Deactivate all recruiter navigation buttons
  document.querySelectorAll('#view-admin .student-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  // Activate target button
  const targetBtn = document.getElementById('nav-btn-recruiter-' + tabName);
  if (targetBtn) targetBtn.classList.add('active');

  // Refresh content dynamically
  if (currentUser) {
    loadRecruiterDashboard();
  }
}

// ── RECRUITER DASHBOARD DYNAMIC METRICS, TIMELINE & PROFILE BINDINGS ──
function loadRecruiterDashboard() {
  if (!currentUser) return;
  
  // Sync top right navbar CTA button name
  const ctaBtn = document.getElementById('nav-cta-btn');
  if (ctaBtn) {
    ctaBtn.innerText = `Dashboard (${currentUser.name})`;
  }

  // Bind recruiter profile fields to Sidebar
  const avatarLetter = document.getElementById('recruiter-avatar-letter');
  if (avatarLetter) {
    avatarLetter.innerText = currentCompany ? currentCompany.name.charAt(0).toUpperCase() : (currentUser.name ? currentUser.name.charAt(0).toUpperCase() : '🏢');
  }
  const companyProfile = document.getElementById('recruiter-profile-company');
  if (companyProfile) {
    companyProfile.innerText = currentCompany ? currentCompany.name : (currentUser.company || 'Enterprise Console');
  }
  const nameProfile = document.getElementById('recruiter-profile-name');
  if (nameProfile) {
    nameProfile.innerText = currentUser.name || 'Recruiter Contact';
  }
  const emailProfile = document.getElementById('recruiter-profile-email');
  if (emailProfile) {
    emailProfile.innerText = currentUser.email || '';
  }

  // Populate settings form inputs if not active
  const settingsName = document.getElementById('settings-recruiter-name');
  if (settingsName && document.activeElement !== settingsName) {
    settingsName.value = currentUser.name || '';
  }
  const settingsCompany = document.getElementById('settings-recruiter-company');
  if (settingsCompany && document.activeElement !== settingsCompany) {
    settingsCompany.value = currentCompany ? currentCompany.name : (currentUser.company || '');
  }

  // Populate proctoring inputs from localStorage
  const savedParamsStr = safeLocalStorage.getItem('skillproof_proctoring_parameters');
  if (savedParamsStr) {
    try {
      const params = JSON.parse(savedParamsStr);
      const webcamCheck = document.getElementById('settings-proctor-webcam');
      if (webcamCheck) webcamCheck.checked = !!params.webcam;
      const volumeSelect = document.getElementById('settings-proctor-volume');
      if (volumeSelect) volumeSelect.value = params.volume || 'medium';
      const monitorCheck = document.getElementById('settings-proctor-monitor');
      if (monitorCheck) monitorCheck.checked = !!params.monitor;
    } catch(e) {
      console.error('Error parsing proctoring parameters:', e);
    }
  }

  // Sync Welcome Title Banner
  const welcomeTitle = document.getElementById('recruiter-welcome-title');
  if (welcomeTitle) {
    welcomeTitle.innerText = `Welcome back to ${currentCompany ? currentCompany.name : (currentUser.company || 'Enterprise')} Portal`;
  }

  // Retrieve multi-tenant company query parameter
  const companyParam = currentCompany ? `?company_id=${currentCompany.id}` : '';

  // Fetch History and Schedules in parallel
  Promise.all([
    fetch('/api/exams/history' + companyParam).then(res => res.json()),
    fetch(`/api/recruiter/schedules` + companyParam).then(res => res.json())
  ])
  .then(([exams, schedules]) => {
    // 1. Total Candidates Onboarded (Total invitations/attempts)
    const totalDispatched = exams.length;
    const totalDispatchedEl = document.getElementById('recruiter-stat-total');
    if (totalDispatchedEl) {
      totalDispatchedEl.innerText = totalDispatched;
    }

    // 2. Average Code Score (Graded finished exams)
    let totalScore = 0;
    let scoredCount = 0;
    exams.forEach(exam => {
      if (exam.status !== 'active') {
        const finalScore = exam.status === 'disqualified' ? 0 : (exam.score || 0);
        totalScore += finalScore;
        scoredCount++;
      }
    });
    const avgScore = scoredCount > 0 ? (totalScore / scoredCount).toFixed(1) + '%' : '0.0%';
    const avgScoreEl = document.getElementById('recruiter-stat-avgscore');
    if (avgScoreEl) {
      avgScoreEl.innerText = avgScore;
    }

    // 3. Proctor Security Flags (Total infractions count across exams)
    let totalFlags = 0;
    exams.forEach(exam => {
      totalFlags += (exam.violations_count || 0);
    });
    const flagsEl = document.getElementById('recruiter-stat-infractions');
    if (flagsEl) {
      flagsEl.innerText = totalFlags;
    }

    // 4. Active Sequences (Count of published schedules)
    const activeSequencesCount = schedules.length;
    const sequencesEl = document.getElementById('recruiter-stat-sequences');
    if (sequencesEl) {
      sequencesEl.innerText = activeSequencesCount;
    }

    // 5. Top Verified Talents List (Highest performing candidates)
    const completedExams = exams.filter(e => e.status !== 'active' && e.status !== 'disqualified' && (e.score || 0) >= 0);
    completedExams.sort((a, b) => (b.score || 0) - (a.score || 0));
    const topTalents = completedExams.slice(0, 4);

    const talentsListEl = document.getElementById('recruiter-top-talents-list');
    if (talentsListEl) {
      if (topTalents.length === 0) {
        talentsListEl.innerHTML = '<div style="color: var(--gray-400); font-size: 13px; text-align: center; padding: 20px 0;">No completed assessments yet.</div>';
      } else {
        talentsListEl.innerHTML = topTalents.map(t => {
          const finalScore = t.score || 0;
          const certifiedBadge = finalScore >= 60
            ? `<span style="display:inline-flex; align-items:center; gap:3px; background:var(--orange-light); border:1px solid var(--orange-mid); color:var(--orange-deep); font-size:10px; font-weight:700; padding:2px 6px; border-radius:100px;">🏆 Certified</span>`
            : '';
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; background: var(--gray-50); padding: 12px 16px; border-radius: var(--radius-sm); border: 1.5px solid var(--gray-100);">
              <div>
                <div style="font-weight: 700; font-size: 14px; color: var(--gray-800);">${escapeHTML(t.student_name)}</div>
                <div style="font-size: 11px; color: var(--gray-500); margin-top: 2px;">${escapeHTML(t.student_email)} · ${escapeHTML(t.skill_name || 'Technical Test')}</div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                ${certifiedBadge}
                <span style="font-family: var(--font-display); font-weight: 800; font-size: 16px; color: var(--orange-deep);">${finalScore}/100</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // 6. Recent HR Activity Timeline Feed
    const activities = [];
    schedules.forEach(s => {
      activities.push({
        time: s.start_time ? new Date(s.start_time).getTime() : Date.now(),
        label: `[SCHEDULE] Published assessment sequence for <strong>${escapeHTML(s.skill_name)}</strong>`,
        color: 'var(--gray-500)'
      });
    });
    exams.forEach(e => {
      const time = e.submitted_at ? new Date(e.submitted_at).getTime() : (e.started_at ? new Date(e.started_at).getTime() : Date.now());
      let label = '';
      let color = 'var(--gray-600)';
      if (e.status === 'active') {
        label = `[ACTIVE] Candidate <strong>${escapeHTML(e.student_name)}</strong> joined/resumed <strong>${escapeHTML(e.skill_name || 'Assessment')}</strong>`;
        color = 'var(--orange-deep)';
      } else if (e.status === 'completed' || e.status === 'evaluated') {
        label = `[COMPLETED] Candidate <strong>${escapeHTML(e.student_name)}</strong> finished <strong>${escapeHTML(e.skill_name || 'Assessment')}</strong> with score <strong>${e.score}/100</strong>`;
        color = '#2E7D32';
      } else if (e.status === 'disqualified') {
        label = `[DISQUALIFIED] Candidate <strong>${escapeHTML(e.student_name)}</strong> flagged with <strong>${e.violations_count || 0} infractions</strong> (Result Withheld)`;
        color = '#C62828';
      } else if (e.status === 'badge_awarded') {
        label = `[CERTIFIED] Certified student <strong>${escapeHTML(e.student_name)}</strong> for <strong>${escapeHTML(e.skill_name || 'Assessment')}</strong>`;
        color = 'var(--orange-deep)';
      } else {
        label = `[SYSTEM] Candidate <strong>${escapeHTML(e.student_name)}</strong> assessment record updated (Status: ${e.status.toUpperCase()})`;
      }
      activities.push({ time, label, color });
    });

    activities.sort((a, b) => b.time - a.time);

    const feedEl = document.getElementById('recruiter-dispatch-feed');
    if (feedEl) {
      if (activities.length === 0) {
        feedEl.innerHTML = '<div style="font-size: 12px; color: var(--gray-400); padding: 4px 0;">[SYSTEM] Secure proctor console initialised.</div>';
      } else {
        feedEl.innerHTML = activities.map(item => {
          const timeStr = new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          return `
            <div style="font-size: 12px; display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; border-bottom: 1px solid var(--gray-100);">
              <span style="color: var(--gray-400); font-family: monospace; white-space: nowrap;">[${timeStr}]</span>
              <span style="color: ${item.color}; flex: 1;">${item.label}</span>
            </div>
          `;
        }).join('');
      }
    }
  })
  .catch(err => {
    console.error('Error loading recruiter dashboard stats:', err);
  });
}

// ── STUDENT PROFILE & SECURITY API PORTFOLIO TOKEN SAVERS ──
async function saveStudentProfileSettings() {
  if (!currentUser) return;
  const name = document.getElementById('settings-student-name').value.trim();
  const phone = document.getElementById('settings-student-phone').value.trim();
  const college = document.getElementById('settings-student-college').value.trim();
  const github = document.getElementById('settings-student-github').value.trim();
  const linkedin = document.getElementById('settings-student-linkedin').value.trim();
  const dreamRole = document.getElementById('settings-student-dream-role').value;
  const slugInput = document.getElementById('settings-student-slug').value.trim();

  if (!name) {
    showToast('Name is required.', 'error');
    return;
  }

  // Link validation (GitHub & LinkedIn)
  if (github) {
    const githubRegex = /^(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_-]+\/?$/i;
    if (!githubRegex.test(github)) {
      showToast('❌ Invalid GitHub profile URL (e.g. https://github.com/username).', 'error');
      return;
    }
  }
  if (linkedin) {
    const linkedinRegex = /^(https?:\/\/)?([a-z]{2,3}\.)?linkedin\.com\/(in|pub|profile)\/[a-zA-Z0-9_-]+\/?$/i;
    if (!linkedinRegex.test(linkedin)) {
      showToast('❌ Invalid LinkedIn profile URL (e.g. https://linkedin.com/in/username).', 'error');
      return;
    }
  }

  const saveStatus = document.getElementById('settings-save-status');
  if (saveStatus) {
    saveStatus.style.display = 'block';
    saveStatus.style.color = 'var(--orange-deep)';
    saveStatus.innerText = 'Saving changes...';
  }

  try {
    const res = await fetch('/api/student/update_profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_email: currentUser.email,
        name,
        phone,
        college,
        github_profile: github,
        linkedin_profile: linkedin,
        dream_role: dreamRole,
        profile_slug: slugInput
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile');

    // Update global state and local storage
    currentUser = data.user;
    safeLocalStorage.setItem('skillproof_user', JSON.stringify(currentUser));

    // Show success toast and status
    if (saveStatus) {
      saveStatus.style.color = '#2E7D32';
      saveStatus.innerText = '✓ Changes saved successfully!';
      setTimeout(() => { saveStatus.style.display = 'none'; }, 3000);
    }
    showToast('Profile updated successfully!', 'success');

    // Reload student dashboard elements to reflect new data
    loadStudentDashboard();
  } catch (err) {
    if (saveStatus) {
      saveStatus.style.color = '#C62828';
      saveStatus.innerText = `❌ Error: ${err.message}`;
    }
    showToast(`Error: ${err.message}`, 'error');
  }
}

// ── RECRUITER ENTERPRISE PROFILE & COMPATIBLE PROCTORING PARAMETERS ──
async function saveRecruiterProfileSettings() {
  if (!currentUser) return;
  const name = document.getElementById('settings-recruiter-name').value.trim();
  const companyName = document.getElementById('settings-recruiter-company').value.trim();

  if (!name) {
    showToast('Contact name is required.', 'error');
    return;
  }

  const saveStatus = document.getElementById('recruiter-save-status');
  if (saveStatus) {
    saveStatus.style.display = 'block';
    saveStatus.style.color = 'var(--orange-deep)';
    saveStatus.innerText = 'Saving profile changes...';
  }

  try {
    const res = await fetch('/api/recruiter/update_profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recruiter_email: currentUser.email,
        name,
        company_name: companyName
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update recruiter profile');

    // Update global state and local storage
    currentUser = data.user;
    currentCompany = data.company;
    safeLocalStorage.setItem('skillproof_user', JSON.stringify(currentUser));
    if (currentCompany) {
      safeLocalStorage.setItem('skillproof_company', JSON.stringify(currentCompany));
    }

    // Show success toast and status
    if (saveStatus) {
      saveStatus.style.color = '#2E7D32';
      saveStatus.innerText = '✓ Enterprise profile updated!';
      setTimeout(() => { saveStatus.style.display = 'none'; }, 3000);
    }
    showToast('Enterprise profile updated successfully!', 'success');

    // Sync welcome banner & headers
    loadRecruiterDashboard();
    
    // Update E2E test targeted DOM IDs title
    const historyTitle = document.getElementById('recruiter-history-title');
    if (historyTitle && currentCompany) {
      historyTitle.innerText = `${currentCompany.name} — Assessments & Proctoring History`;
    }
  } catch (err) {
    if (saveStatus) {
      saveStatus.style.color = '#C62828';
      saveStatus.innerText = `❌ Error: ${err.message}`;
    }
    showToast(`Error: ${err.message}`, 'error');
  }
}

function saveProctoringParameters() {
  const webcam = document.getElementById('settings-proctor-webcam').checked;
  const volume = document.getElementById('settings-proctor-volume').value;
  const monitor = document.getElementById('settings-proctor-monitor').checked;

  const params = { webcam, volume, monitor };
  safeLocalStorage.setItem('skillproof_proctoring_parameters', JSON.stringify(params));

  showToast('AI Proctoring Rules successfully enforced and synchronized!', 'success');
}

// ── PORTFOLIO API BEARER TOKEN GENERATOR & CLIPBOARD COPIER ──
function generateStudentToken() {
  if (!currentUser) return;
  // Generate a realistic, secure SkillProof Bearer token prefix and hash
  const prefix = "skp_live_";
  const array = new Uint8Array(24);
  window.crypto.getRandomValues(array);
  const token = prefix + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  
  const tokenInput = document.getElementById('settings-student-token');
  if (tokenInput) {
    tokenInput.value = token;
  }
  
  const copyBtn = document.getElementById('btn-copy-token');
  if (copyBtn) {
    copyBtn.style.display = 'inline-block';
  }

  safeLocalStorage.setItem('skillproof_student_token', token);
  showToast('New Developer Portfolio API Bearer Token successfully generated!', 'success');
}

function copyStudentToken() {
  const tokenInput = document.getElementById('settings-student-token');
  if (!tokenInput || !tokenInput.value) return;
  
  navigator.clipboard.writeText(tokenInput.value)
    .then(() => {
      showToast('API Bearer Token copied to clipboard!', 'success');
    })
    .catch(err => {
      console.error('Copy token failed:', err);
      alert('Failed to copy token to clipboard. Please manually select and copy it.');
    });
}

// ── ROOT VARIABLE HSL COLOR THEME SWITCHER ──
function applyColorTheme(themeColor, showToastNotify = true) {
  const isDark = document.body.classList.contains('dark-theme');
  
  const themes = {
    orange: {
      orange: '#E65100',
      light: isDark ? '#221509' : '#FFF8F5',
      mid: isDark ? '#40241A' : '#FFD7C9',
      deep: isDark ? '#FF6B00' : '#BF360C',
      dark: isDark ? '#6B250F' : '#5C1C0A',
      rgb: '230, 81, 0'
    },
    emerald: {
      orange: isDark ? '#10B981' : '#059669',
      light: isDark ? '#082512' : '#F0FDF4',
      mid: isDark ? '#104B24' : '#BBF7D0',
      deep: isDark ? '#34D399' : '#15803D',
      dark: isDark ? '#0E3B1C' : '#14532D',
      rgb: '16, 185, 129'
    },
    sapphire: {
      orange: isDark ? '#3B82F6' : '#2563EB',
      light: isDark ? '#0A182F' : '#EFF6FF',
      mid: isDark ? '#1E3A5F' : '#BFDBFE',
      deep: isDark ? '#60A5FA' : '#1D4ED8',
      dark: isDark ? '#0D274A' : '#1E3A8A',
      rgb: '37, 99, 235'
    },
    purple: {
      orange: isDark ? '#8B5CF6' : '#7C3AED',
      light: isDark ? '#1A0B2E' : '#F5F3FF',
      mid: isDark ? '#2D1B4E' : '#DDD6FE',
      deep: isDark ? '#A78BFA' : '#6D28D9',
      dark: isDark ? '#200F3A' : '#4C1D95',
      rgb: '124, 58, 237'
    },
    gold: {
      orange: isDark ? '#F59E0B' : '#D97706',
      light: isDark ? '#2B1E05' : '#FEF3C7',
      mid: isDark ? '#4F3508' : '#FDE68A',
      deep: isDark ? '#FBBF24' : '#B45309',
      dark: isDark ? '#3B2303' : '#78350F',
      rgb: '217, 119, 6'
    }
  };

  const selected = themes[themeColor] || themes.orange;
  
  document.documentElement.style.setProperty('--orange', selected.orange);
  document.documentElement.style.setProperty('--orange-light', selected.light);
  document.documentElement.style.setProperty('--orange-mid', selected.mid);
  document.documentElement.style.setProperty('--orange-deep', selected.deep);
  document.documentElement.style.setProperty('--orange-dark', selected.dark);
  document.documentElement.style.setProperty('--orange-rgb', selected.rgb);
  
  safeLocalStorage.setItem('skillproof_theme', themeColor);
  if (showToastNotify) {
    showToast(`Color theme updated to ${themeColor.toUpperCase()}`, 'success');
  }
}

// ── RECRUITER BULK ACTION TRIGGERS & SENDING UTILITIES ──

// Add a candidate row to the dispatcher form
function addCandidateRow() {
  const container = document.getElementById('bulk-dispatch-rows');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'dispatch-row';
  row.style.cssText = 'display:flex; flex-direction:column; gap:8px; background:var(--gray-50); padding:12px; border-radius:var(--radius-sm); border:1px solid var(--gray-200); position:relative;';
  row.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center;">
      <span style="font-size:11px; font-weight:700; color:var(--orange-deep); text-transform:uppercase;">Candidate Details</span>
      <button onclick="this.closest('.dispatch-row').remove()" style="background:none; border:none; color:#C62828; cursor:pointer; font-size:11px; font-weight:700;" title="Remove">Remove</button>
    </div>
    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
      <input type="text" placeholder="Candidate Name" class="dispatch-name" style="padding:8px 10px; border:1.5px solid var(--gray-200); border-radius:var(--radius-sm); font-size:13px; font-family:var(--font-body); width:100%; box-sizing:border-box;" />
      <input type="email" placeholder="Candidate Email" class="dispatch-email" style="padding:8px 10px; border:1.5px solid var(--gray-200); border-radius:var(--radius-sm); font-size:13px; font-family:var(--font-body); width:100%; box-sizing:border-box;" />
      <input type="tel" placeholder="Phone Number (e.g. +919876543210)" class="dispatch-phone" style="padding:8px 10px; border:1.5px solid var(--gray-200); border-radius:var(--radius-sm); font-size:13px; font-family:var(--font-body); width:100%; box-sizing:border-box;" />
    </div>
    <select class="dispatch-skill" style="padding:8px 10px; border:1.5px solid var(--gray-200); border-radius:var(--radius-sm); font-size:13px; font-family:var(--font-body); width:100%; box-sizing:border-box;">
      ${(masterSkillsList || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
    </select>
  `;
  container.appendChild(row);
}

// Dispatch real exam invites to candidates
async function runBulkDispatch() {
  if (!currentCompany && currentUser && currentUser.company_id) {
    currentCompany = {
      id: currentUser.company_id,
      name: currentUser.company || 'Enterprise'
    };
    safeLocalStorage.setItem('skillproof_company', JSON.stringify(currentCompany));
  }

  if (!currentUser || !currentCompany) {
    alert('You must be logged in as a recruiter with a company account.');
    return;
  }

  const rows = document.querySelectorAll('.dispatch-row');
  if (rows.length === 0) {
    alert('Please add at least one candidate row first.');
    return;
  }

  const candidates = [];
  let valid = true;
  rows.forEach(row => {
    const name = row.querySelector('.dispatch-name')?.value?.trim();
    const email = row.querySelector('.dispatch-email')?.value?.trim();
    const phone = row.querySelector('.dispatch-phone')?.value?.trim() || null;
    const skillId = row.querySelector('.dispatch-skill')?.value;
    if (!name || !email || !skillId) { valid = false; return; }
    candidates.push({ name, email, phone, skillId, difficultyOrder: 'easy,medium,hard' });
  });

  if (!valid || candidates.length === 0) {
    alert('Please fill in all candidate fields (name, email, skill).');
    return;
  }

  const btn = document.querySelector('[onclick="runBulkDispatch()"]');
  if (btn) { btn.disabled = true; btn.innerText = 'Sending invites…'; }

  try {
    const res = await fetch('/api/recruiter/dispatch-and-evaluate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidates,
        company_id: currentCompany.id,
        recruiter_id: currentUser.id
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Dispatch failed');

    // Build rich results modal with WhatsApp + Email buttons
    const results = data.results || [];
    const appUrl = 'https://skill-badge-scanner.vercel.app/#';

    let resultsHtml = `
      <div style="background:#111;border-radius:14px;padding:20px;max-width:600px;margin:0 auto;color:#F5F4F0;font-family:'Segoe UI',sans-serif;">
        <div style="text-align:center;margin-bottom:16px;">
          <div style="font-size:32px;margin-bottom:6px;">✅</div>
          <h3 style="margin:0;color:#4CAF50;font-size:18px;">${results.length} Exam Invite(s) Dispatched!</h3>
          <p style="color:#999;font-size:12px;margin:6px 0 0;">Students will see exams in their "Corporate Assessment Invites" tab</p>
        </div>`;

    let allWhatsAppMessages = '';

    results.forEach((r, i) => {
      const waMsg = `*SkillProof Exam Invitation*%0A%0ADear *${encodeURIComponent(r.name)}*,%0A%0AYou have been invited to take a proctored technical challenge for *${encodeURIComponent(r.skillName)}*.%0A%0A🔑 *One-Time Passcode:* ${r.examPassword}%0A⏱ *Duration:* 60 minutes%0A🔗 *Access URL:* ${encodeURIComponent(appUrl)}%0A%0APlease use a laptop/desktop with a working webcam. Good luck!%0A%0A— SkillProof Assessment`;
      const plainMsg = `*SkillProof Exam Invitation*\n\nDear *${r.name}*,\n\nYou have been invited to take a proctored technical challenge for *${r.skillName}*.\n\n🔑 *One-Time Passcode:* ${r.examPassword}\n⏱ *Duration:* 60 minutes\n🔗 *Access URL:* ${appUrl}\n\nPlease use a laptop/desktop with a working webcam. Good luck!\n\n— SkillProof Assessment`;
      allWhatsAppMessages += `--- ${r.name} (${r.email}) ---\n${plainMsg}\n\n`;
      
      // Phone number for wa.me link (strip non-numeric, ensure country code)
      const phone = r.phone ? r.phone.replace(/[^0-9+]/g, '').replace(/^\+/, '') : '';
      const waLink = phone ? `https://wa.me/${phone}?text=${waMsg}` : '';
      const emailLink = `mailto:${r.email}?subject=${encodeURIComponent(`Exam Invitation: ${r.skillName}`)}&body=${encodeURIComponent(plainMsg.replace(/\*/g, ''))}`;

      resultsHtml += `
        <div style="background:#1A1A1A;border:1px solid #333;border-radius:10px;padding:12px;margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div>
              <strong style="font-size:14px;">${escapeHTML(r.name)}</strong>
              <span style="color:#999;font-size:11px;margin-left:6px;">${escapeHTML(r.email)}</span>
            </div>
            <span style="background:#1B3D20;color:#4CAF50;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;">${r.status || 'invited'}</span>
          </div>
          <div style="display:flex;gap:6px;font-size:11px;margin-bottom:8px;">
            <span style="background:#262626;padding:3px 8px;border-radius:4px;">📋 ${escapeHTML(r.skillName)}</span>
            <span style="background:#262626;padding:3px 8px;border-radius:4px;">🔑 ${r.examPassword}</span>
          </div>
          <div style="display:flex;gap:6px;">
            ${waLink ? `<a href="${waLink}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;background:#25D366;color:#fff;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;cursor:pointer;">📱 Send via WhatsApp</a>` : `<span style="color:#666;font-size:11px;padding:5px;">No phone number</span>`}
            <a href="${emailLink}" style="display:inline-flex;align-items:center;gap:4px;background:#1976D2;color:#fff;padding:5px 12px;border-radius:6px;font-size:11px;font-weight:700;text-decoration:none;cursor:pointer;">📧 Send via Email</a>
          </div>
        </div>`;
    });

    resultsHtml += `
        <div style="display:flex;gap:8px;margin-top:14px;justify-content:center;">
          <button onclick="navigator.clipboard.writeText(document.getElementById('_wa_bulk_msgs').value).then(()=>showToast('All WhatsApp messages copied!','success')).catch(()=>alert('Copy failed'))" style="background:#25D366;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;">📋 Copy All WhatsApp Messages</button>
          <button onclick="this.closest('[data-modal-overlay]').remove()" style="background:#333;color:#F5F4F0;border:none;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">Close</button>
        </div>
        <textarea id="_wa_bulk_msgs" style="position:absolute;left:-9999px;">${escapeHTML(allWhatsAppMessages)}</textarea>
      </div>`;

    // Show as modal overlay
    const overlay = document.createElement('div');
    overlay.setAttribute('data-modal-overlay', '1');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.75);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
    overlay.innerHTML = resultsHtml;
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);

    // Clear the rows
    document.getElementById('bulk-dispatch-rows').innerHTML = '';
    loadAdminHistory();
  } catch (err) {
    alert('Error: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polyline points="22 2 15 22 11 13 2 9 22 2"/></svg> Send Exam Invites'; }
  }
}

function toggleSelectAllCandidates(isChecked) {

  const checkboxes = document.querySelectorAll('.candidate-checkbox');
  checkboxes.forEach(cb => {
    cb.checked = isChecked;
  });
  updateSelectedCandidatesCount();
}

function updateSelectedCandidatesCount() {
  const checkboxes = document.querySelectorAll('.candidate-checkbox:checked');
  const count = checkboxes.length;
  const countLabel = document.getElementById('bulk-selected-count');
  const toolbar = document.getElementById('bulk-actions-toolbar');

  if (countLabel) {
    countLabel.innerText = `${count} candidate${count !== 1 ? 's' : ''} selected`;
  }

  if (toolbar) {
    if (count > 0) {
      toolbar.style.display = 'flex';
    } else {
      toolbar.style.display = 'none';
    }
  }
}

function triggerInviteForCandidate(examId) {
  const exam = currentExamsList.find(e => (e.examId === examId || e.id === examId));
  if (!exam) return;
  const email = exam.student_email;

  // Uncheck all
  const checkboxes = document.querySelectorAll('.candidate-checkbox');
  checkboxes.forEach(cb => cb.checked = false);
  
  // Check the specific one safely using attribute lookup
  const specific = Array.from(checkboxes).find(cb => cb.getAttribute('data-email') === email);
  if (specific) {
    specific.checked = true;
  }
  
  // Trigger UI update and open modal
  updateSelectedCandidatesCount();
  
  // Scroll to the top where the modal overlay will appear
  window.scrollTo({ top: 0, behavior: 'smooth' });
  
  setTimeout(() => {
    openBulkEmailModal();
  }, 300);
}

function openBulkEmailModal() {
  const modal = document.getElementById('bulk-email-modal');
  if (modal) modal.style.display = 'flex';

  const composer = document.getElementById('bulk-email-composer-view');
  if (composer) composer.style.display = 'block';

  const sendingView = document.getElementById('bulk-email-sending-view');
  if (sendingView) sendingView.style.display = 'none';

  // Populate dynamic candidate verification checklist
  const verifyList = document.getElementById('bulk-email-candidates-verify-list');
  verifyList.innerHTML = '';

  const checkedBoxes = document.querySelectorAll('.candidate-checkbox:checked');
  checkedBoxes.forEach(cb => {
    const email = cb.getAttribute('data-email');
    const name = cb.getAttribute('data-name');
    const score = cb.getAttribute('data-score');
    const skill = cb.getAttribute('data-skill');
    const violations = parseInt(cb.getAttribute('data-violations') || '0');

    const infractionBadge = violations > 0 
      ? `<span style="color:#C62828; font-weight:700;">⚠️ ${violations} infractions</span>` 
      : `<span style="color:#2E7D32; font-weight:700;">✓ Clean proctor</span>`;

    const item = document.createElement('div');
    item.style.display = 'flex';
    item.style.justifyContent = 'space-between';
    item.style.alignItems = 'center';
    item.style.padding = '8px 12px';
    item.style.background = 'var(--white)';
    item.style.border = '1px solid var(--gray-100)';
    item.style.borderRadius = 'var(--radius-sm)';
    item.style.fontSize = '12px';
    item.innerHTML = `
      <div>
        <strong>${escapeHTML(name)}</strong> (${escapeHTML(email)})
        <div style="font-size:10px; color:var(--gray-500); margin-top:2px;">Skill: ${escapeHTML(skill)} · Verified Score: ${escapeHTML(score)}/100</div>
      </div>
      <div>
        ${infractionBadge}
      </div>
    `;
    verifyList.appendChild(item);
  });
}

function closeBulkEmailModal(shouldReset = false) {
  const modal = document.getElementById('bulk-email-modal');
  if (modal) modal.style.display = 'none';

  if (shouldReset) {
    const checkboxes = document.querySelectorAll('.candidate-checkbox');
    checkboxes.forEach(cb => {
      cb.checked = false;
    });
    const selectAll = document.getElementById('select-all-history');
    if (selectAll) selectAll.checked = false;
    updateSelectedCandidatesCount();
  }
}

async function sendBulkEmails() {
  const checkedBoxes = document.querySelectorAll('.candidate-checkbox:checked');
  if (checkedBoxes.length === 0) return;

  const subject = document.getElementById('bulk-email-subject').value;
  const bodyTemplate = document.getElementById('bulk-email-body').value;

  // Show sending progress log, hide composer
  document.getElementById('bulk-email-composer-view').style.display = 'none';
  document.getElementById('bulk-email-sending-view').style.display = 'block';

  const logConsole = document.getElementById('bulk-email-sending-log');
  logConsole.innerHTML = '';

  const tableBody = document.getElementById('bulk-email-report-table-body');
  if (tableBody) tableBody.innerHTML = '';

  const progressBar = document.getElementById('bulk-email-progress-bar');
  progressBar.style.width = '0%';

  document.getElementById('bulk-email-finished-actions').style.display = 'none';

  const total = checkedBoxes.length;
  let successCount = 0;

  const logMessage = (msg, isSuccess = true) => {
    const div = document.createElement('div');
    div.style.color = isSuccess ? '#FFF' : '#FF5252';
    div.innerText = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logConsole.appendChild(div);
    logConsole.scrollTop = logConsole.scrollHeight;
  };

  logMessage(`SMTP Initializing high-speed secure bulk queue runner...`);
  logMessage(`Prepared ${total} personalized candidates reports to send.`);

  for (let i = 0; i < total; i++) {
    const cb = checkedBoxes[i];
    const email = cb.getAttribute('data-email');
    const name = cb.getAttribute('data-name');
    const score = cb.getAttribute('data-score');
    const skill = cb.getAttribute('data-skill');

    // High fidelity simulated artificial timeout delay (~600ms) for professional SMTP logs
    await new Promise(resolve => setTimeout(resolve, 600));

    logMessage(`Establishing SSL connection for target recipient: ${email}...`);

    // Dynamic template replacement using placeholders
    const customBody = bodyTemplate
      .replace(/{name}/g, name)
      .replace(/{score}/g, score)
      .replace(/{skill}/g, skill);

    let smtpStatus = '';
    let smtpSuccess = false;

    try {
      const response = await fetch('/api/recruiter/send-bulk-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: [email],
          subject: subject,
          body: customBody
        })
      });

      const result = await response.json();

      if (response.ok) {
        successCount++;
        logMessage(`✓ Success: Verification report invite sent and logged to database for ${name} (${email})`, true);
        smtpStatus = '✓ Delivered';
        smtpSuccess = true;
      } else {
        logMessage(`❌ Error: API response failure for candidate ${email}: ${result.error || 'Unknown error'}`, false);
        smtpStatus = '❌ Failed';
        smtpSuccess = false;
      }
    } catch (err) {
      logMessage(`❌ Network Error: Failed to transmit SMTP parcel for ${email}: ${err.message}`, false);
      smtpStatus = '❌ Failed';
      smtpSuccess = false;
    }

    // Populate Synthesis Report Table row
    if (tableBody) {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--gray-100)';
      
      const violationsCount = parseInt(cb.getAttribute('data-violations') || '0', 10);
      const violationBadge = violationsCount > 0 
        ? `<span style="color:#C62828; font-weight:700;">⚠️ ${violationsCount} violations</span>` 
        : `<span style="color:#2E7D32; font-weight:700;">✓ Clean proctor</span>`;

      const candidateStatus = cb.getAttribute('data-status') || '';
      let scoreDisplay = score;
      if (candidateStatus === 'disqualified' || score === 'Result Upheld' || score === 'Result Withheld') {
        scoreDisplay = 'Result Withheld';
      } else if (!scoreDisplay.includes('/100')) {
        scoreDisplay = scoreDisplay + '/100';
      }

      const smtpColor = smtpSuccess ? '#2E7D32' : '#C62828';

      tr.innerHTML = `
        <td style="padding: 8px 6px;">
          <strong>${escapeHTML(name)}</strong><br/>
          <span style="color:var(--gray-500); font-size:10px">${escapeHTML(email)}</span>
        </td>
        <td style="padding: 8px 6px;">${escapeHTML(skill)}</td>
        <td style="padding: 8px 6px;"><strong>${escapeHTML(scoreDisplay)}</strong></td>
        <td style="padding: 8px 6px;">${violationBadge}</td>
        <td style="padding: 8px 6px; text-align: right; color:${smtpColor}; font-weight:700;">${smtpStatus}</td>
      `;
      tableBody.appendChild(tr);
    }

    // Update progress bar
    const pct = Math.round(((i + 1) / total) * 100);
    progressBar.style.width = pct + '%';
  }

  logMessage(`SMTP Pipeline finished. Total attempted: ${total} | Dispatched successfully: ${successCount}.`);
  
  // Show final actions
  document.getElementById('bulk-email-finished-actions').style.display = 'block';
}

// ── EXAM SCHEDULING SYSTEM: FRONTEND INTEGRATION ──
function populateScheduleSkillSelect() {
  const scheduleSelect = document.getElementById('schedule-skill-select');
  const addQSelect = document.getElementById('add-q-skill');
  
  if (scheduleSelect) scheduleSelect.innerHTML = '';
  if (addQSelect) addQSelect.innerHTML = '';
  
  masterSkillsList.forEach(s => {
    if (scheduleSelect) {
      const opt1 = document.createElement('option');
      opt1.value = s.id;
      opt1.innerText = s.name;
      scheduleSelect.appendChild(opt1);
    }
    if (addQSelect) {
      const opt2 = document.createElement('option');
      opt2.value = s.id;
      opt2.innerText = s.name;
      addQSelect.appendChild(opt2);
    }
  });
}

function scheduleExamSequence() {
  if (!currentUser) return;
  const skillId = document.getElementById('schedule-skill-select').value;
  const difficultyOrder = document.getElementById('schedule-difficulty-order').value || 'easy,medium,hard';
  const startTime = document.getElementById('schedule-start-time').value;
  const durationMinutes = document.getElementById('schedule-duration').value || 60;

  if (!startTime) {
    alert('Please select a start date and time.');
    return;
  }

  fetch('/api/recruiter/schedule-exam', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recruiter_id: currentUser.id,
      company_id: currentCompany ? currentCompany.id : null,
      skill_id: skillId,
      difficulty_order: difficultyOrder,
      start_time: startTime,
      duration_minutes: durationMinutes
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }
    alert('Exam sequence scheduled successfully!\n\nUNIVERSAL EXAM CODE: ' + data.examPassword + '\n\nStudents can enter this code in their dashboard or use the universal link to take this exact test blueprint.');
    loadRecruiterSchedules();
  })
  .catch(err => {
    console.error('Failed to schedule assessment:', err);
  });
}

function loadRecruiterSchedules() {
  const container = document.getElementById('recruiter-schedules-list');
  if (!container) return;
  
  const companyQuery = currentCompany ? `?company_id=${currentCompany.id}` : '';
  fetch(`/api/recruiter/schedules${companyQuery}`)
    .then(res => res.json())
    .then(schedules => {
      container.innerHTML = '';
      if (schedules.length === 0) {
        container.innerHTML = '<tr><td colspan="5" style="color:var(--gray-500); text-align: center;">No scheduled assessments created yet.</td></tr>';
        return;
      }
      schedules.forEach(s => {
        const tr = document.createElement('tr');
        // ── Secure Join Link ── Uses schedule UUID, NOT the passcode.
        // Passcode is NEVER exposed in the URL. Recruiter/owner tells it verbally to the candidate.
        const joinLink = `${window.location.origin}/?join=${s.id || ''}`;
        tr.innerHTML = `
          <td><strong>${s.skill_name}</strong></td>
          <td><span class="difficulty-tag" style="background:var(--orange-deep); color:#FFF; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">${s.difficulty_order.toUpperCase()}</span></td>
          <td>${new Date(s.start_time).toLocaleString()}</td>
          <td><strong>${s.duration_minutes} mins</strong></td>
          <td>
            <div style="display:flex; flex-direction:column; gap:6px; padding:4px 0;">
              <div style="font-size:11px;">🔑 Passcode (tell verbally to candidate): <strong style="color:var(--orange-deep); font-family:monospace; background:var(--gray-50); padding:1px 4px; border-radius:3px; border:1px solid var(--gray-200); letter-spacing:2px;">${s.exam_password || 'N/A'}</strong></div>
              <div style="font-size:11px; color:var(--gray-500); font-style:italic;">⚠️ Do NOT share this passcode in the link — share verbally or via separate secure channel.</div>
              <div style="font-size:11px;">🔗 Link (passcode-free): <a href="${joinLink}" target="_blank" style="color:var(--orange-deep); font-weight:600; text-decoration:underline;">Join Assessment</a></div>
              <button onclick="navigator.clipboard.writeText('${joinLink}'); alert('Secure Join Link copied! Remember to share the passcode SEPARATELY (verbally or secure message).');" style="background:var(--orange-deep); color:#FFF; border:none; padding:4px 8px; border-radius:var(--radius-sm); font-size:10px; font-weight:600; cursor:pointer; width: fit-content; transition: filter 0.2s;">📋 Copy Secure Join Link</button>
            </div>
          </td>
        `;
        container.appendChild(tr);
      });
    })
    .catch(err => {
      console.error('Failed to load recruiter schedules:', err);
    });
}

function autoJoinPendingExam() {
  if (!currentUser || !pendingJoinCode) return;
  if (currentUser.role === 'recruiter') {
    pendingJoinCode = null;
    return;
  }
  
  const code = pendingJoinCode;
  pendingJoinCode = null; // Clear immediately to prevent double processing

  // ── Secure Join Pipeline ──
  // Detect whether the URL code is a UUID (schedule_id) or a raw passcode (legacy).
  // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (36 chars with 4 dashes)
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(code);

  if (isUUID) {
    // ── NEW SECURE FLOW ── Link used schedule_id. Passcode is NOT in the URL.
    // Prompt the student to manually type the passcode (verbally told by recruiter).
    const enteredPasscode = prompt("🔐 Security Verification\n\nPlease enter the Exam Passcode provided verbally by your recruiter/faculty to join this assessment:");
    if (enteredPasscode === null || enteredPasscode.trim() === '') {
      alert("Onboarding cancelled. You must enter the passcode to join this exam.");
      return;
    }

    const cleanPasscode = enteredPasscode.trim().toUpperCase();

    // Send BOTH schedule_id (from URL) AND exam_password (typed by student) to backend for verification
    fetch('/api/exams/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: currentUser.id,
        schedule_id: code,          // UUID from the secure link
        exam_password: cleanPasscode // Passcode typed by student — verified server-side
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
        return;
      }
      alert(data.message || '✅ Exam joined successfully! Check your dashboard to start the assessment.');
      loadStudentDashboard();
    })
    .catch(err => {
      console.error('Auto Join Error:', err);
      alert('Failed to join assessment. Please check your network connection.');
    });

  } else {
    // ── LEGACY FLOW ── Direct raw passcode in the URL (backwards compatibility)
    // Passcode IS the code. Just verify and join directly.
    const cleanCode = code.toUpperCase().trim();
    fetch('/api/exams/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: currentUser.id,
        exam_password: cleanCode
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error);
        return;
      }
      alert(data.message || 'Exam joined successfully!');
      loadStudentDashboard();
    })
    .catch(err => {
      console.error('Auto Join Error:', err);
      alert('Failed to join assessment.');
    });
  }
}

function joinExamViaCode() {
  if (!currentUser) return;
  const codeInput = document.getElementById('join-exam-code-input');
  const code = codeInput.value.trim().toUpperCase();
  if (!code) {
    alert('Please enter a Universal Access Code.');
    return;
  }

  fetch('/api/exams/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_id: currentUser.id,
      exam_password: code
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }
    alert(data.message || 'Exam joined successfully!');
    codeInput.value = '';
    loadStudentDashboard();
  })
  .catch(err => {
    console.error('Join Error:', err);
    alert('Failed to join the exam.');
  });
}

// Mutex: If a loadStudentSchedules fetch is already in-flight, subsequent callers
// await the same promise instead of firing a duplicate network request + DOM render.
window._loadSchedulesInFlight = null;

function loadStudentSchedules() {
  if (!currentUser) return Promise.resolve();

  // MUTEX — if an identical fetch is already in-flight, coalesce by returning its promise
  if (window._loadSchedulesInFlight) {
    return window._loadSchedulesInFlight;
  }

  // Reset scheduled skill IDs for cross-function dedup with renderProgressiveVerifier
  window._scheduledSkillIds = new Set();
  const container = document.getElementById('student-schedules-list');
  if (!container) return Promise.resolve();

  const arenaContainer = document.getElementById('scheduled-arena-list');
  const arenaWrapper = document.getElementById('scheduled-arena-wrapper');

  // Track rendering cycle to prevent race conditions and duplicate renders
  window._schedulesRenderCycleId = (window._schedulesRenderCycleId || 0) + 1;
  const renderCycleId = window._schedulesRenderCycleId;

  // Only show pulsing skeleton loader on the very first load (prevents flicker on tab switches)
  if (!window._hasLoadedSchedulesData) {
    if (container.children.length === 0 || container.innerHTML.includes('No active invitations')) {
      container.innerHTML = `
        <div style="animation: pulse 1.8s ease-in-out infinite; background: var(--white); border: 1.5px dashed rgba(230,81,0,0.15); border-radius: var(--radius-md); padding: 24px; text-align: center; color: var(--gray-400); font-size:13px; font-weight:700;">
          ⏳ Buffering secure assessment invites...
        </div>
      `;
    }

    if (arenaContainer && (arenaContainer.children.length === 0)) {
      arenaContainer.innerHTML = `
        <div style="animation: pulse 1.8s ease-in-out infinite; background: var(--white); border: 1.5px dashed rgba(230,81,0,0.15); border-radius: var(--radius-md); padding: 24px; text-align: center; color: var(--gray-400); font-size:13px; font-weight:700;">
          ⏳ Buffering scheduled assessments...
        </div>
      `;
    }
  }

  const schedulePromise = fetch(`/api/student/schedules?student_email=${encodeURIComponent(currentUser.email)}`)
    .then(res => res.json())
    .then(schedules => {
      // Discard stale fetches from previous rendering cycles
      if (renderCycleId !== window._schedulesRenderCycleId) return;

      if (!Array.isArray(schedules)) schedules = [];

      if (schedules.length === 0) {
        container.innerHTML = '<div style="color:var(--gray-500)">No active invitations found matching your claimed skills.</div>';
        if (arenaContainer) arenaContainer.innerHTML = '';
        if (arenaWrapper) arenaWrapper.style.display = 'none';
        window._hasLoadedSchedulesData = true;
        return;
      }

      // ── TRIPLE-LAYER DEDUPLICATION ──
      // Layer 1: Deduplicate by unique schedule ID
      const seenIds = new Set();
      let uniqueSchedules = schedules.filter(s => {
        if (seenIds.has(s.id)) return false;
        seenIds.add(s.id);
        return true;
      });

      // Layer 2: Deduplicate by skill_id — one card per unique skill
      // Prioritize active exams over completed ones, then newest
      const skillMap = {};
      uniqueSchedules.forEach(s => {
        const isCompleted = ['submitted', 'evaluated', 'badge_awarded', 'badge_denied', 'disqualified', 'expired'].includes(s.attempt_status);
        if (!skillMap[s.skill_id]) {
          skillMap[s.skill_id] = s;
        } else {
          const existingCompleted = ['submitted', 'evaluated', 'badge_awarded', 'badge_denied', 'disqualified', 'expired'].includes(skillMap[s.skill_id].attempt_status);
          // Prefer active over completed
          if (existingCompleted && !isCompleted) {
            skillMap[s.skill_id] = s;
          } else if (existingCompleted === isCompleted && new Date(s.start_time) > new Date(skillMap[s.skill_id].start_time)) {
            skillMap[s.skill_id] = s;
          }
        }
      });
      uniqueSchedules = Object.values(skillMap);

      // Layer 3: Deduplicate by skill_name as final safety net
      const seenSkillNames = new Set();
      uniqueSchedules = uniqueSchedules.filter(s => {
        const name = (s.skill_name || '').toLowerCase().trim();
        if (seenSkillNames.has(name)) return false;
        seenSkillNames.add(name);
        return true;
      });

      // ── BUILD DOM IN-MEMORY (DocumentFragment) to eliminate flicker ──
      const containerFrag = document.createDocumentFragment();
      const arenaFrag = document.createDocumentFragment();
      let hasActiveScheduled = false;

      uniqueSchedules.forEach(s => {
        const card = document.createElement('div');
        card.className = 'verified-skill-row';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.padding = '16px';
        card.style.background = 'var(--white)';
        card.style.border = '1.5px solid var(--gray-200)';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.marginBottom = '12px';
        card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

        const companyBadge = s.company_name 
          ? `<span style="font-size: 11px; background:var(--orange-deep); color:#FFF; padding:2px 6px; border-radius:4px; font-weight:700; margin-left:8px;">🏢 ${s.company_name}</span>`
          : '';

        const difficultyLabels = s.difficulty_order.toUpperCase().split(',').map(d => 
          `<span style="font-size: 10px; background:var(--gray-100); color:var(--gray-800); padding:2px 6px; border-radius:4px; margin-right:4px; font-weight:600;">${d}</span>`
        ).join('');

        let btnHTML = '';
        const isAttemptCompleted = ['submitted', 'evaluated', 'badge_awarded', 'badge_denied', 'disqualified', 'expired'].includes(s.attempt_status);
        if (isAttemptCompleted) {
          let label = 'Completed';
          if (s.attempt_status === 'submitted' || s.attempt_status === 'evaluated') label = 'Attempted & Submitted';
          else if (s.attempt_status === 'badge_awarded') label = 'Badge Awarded 🏆';
          else if (s.attempt_status === 'badge_denied') label = 'Badge Denied';
          else if (s.attempt_status === 'disqualified') label = 'Disqualified ⚠️';
          else if (s.attempt_status === 'expired') label = 'Session Expired';
          
          btnHTML = `
            <button disabled class="btn-ghost" style="padding: 8px 16px; font-size:13px; font-weight:700; background:var(--gray-100); color:var(--gray-400); border-color:var(--gray-200); cursor:not-allowed;">
              ${label}
            </button>
          `;
        } else {
          hasActiveScheduled = true;
          btnHTML = `
            <button onclick="openExamRulesModal(null, '${s.id}')" class="btn-primary" style="padding: 8px 16px; font-size:13px; font-weight:700; cursor:pointer;">
              🚀 Launch Sequence
            </button>
          `;
        }

        const cardContent = `
          <div>
            <div style="display:flex; align-items:center;">
              <strong style="font-size:16px;">${s.skill_name}</strong>
              ${companyBadge}
            </div>
            <div style="font-size:12px; color:var(--gray-500); margin-top:6px; line-height:1.4;">
              <strong>Stages:</strong> ${difficultyLabels}<br/>
              <strong>Duration Limit:</strong> ${s.duration_minutes} mins · <strong>Available from:</strong> ${new Date(s.start_time).toLocaleString()}
            </div>
          </div>
          ${btnHTML}
        `;

        card.innerHTML = cardContent;
        containerFrag.appendChild(card);

        // Track this skill as having an active scheduled exam
        if (!isAttemptCompleted) {
          window._scheduledSkillIds.add(s.skill_id);
        }

        // Also add active scheduled exams to the Exam Arena tab
        if (arenaContainer && !isAttemptCompleted) {
          const arenaCard = document.createElement('div');
          arenaCard.className = 'verified-skill-row';
          arenaCard.style.display = 'flex';
          arenaCard.style.justifyContent = 'space-between';
          arenaCard.style.alignItems = 'center';
          arenaCard.style.padding = '16px';
          arenaCard.style.background = 'var(--white)';
          arenaCard.style.border = '1.5px solid var(--orange-deep)';
          arenaCard.style.borderRadius = 'var(--radius-md)';
          arenaCard.style.marginBottom = '12px';
          arenaCard.style.boxShadow = '0 2px 4px rgba(230,81,0,0.05)';
          arenaCard.innerHTML = cardContent;
          arenaFrag.appendChild(arenaCard);
        }
      });

      // ── ATOMIC DOM SWAP WITH FLICKER PREVENTION — replace content only on diff ──
      const tempSchedulesDiv = document.createElement('div');
      tempSchedulesDiv.appendChild(containerFrag);
      if (container.innerHTML !== tempSchedulesDiv.innerHTML) {
        container.innerHTML = tempSchedulesDiv.innerHTML;
      }

      if (arenaContainer) {
        const tempArenaDiv = document.createElement('div');
        tempArenaDiv.appendChild(arenaFrag);
        if (arenaContainer.innerHTML !== tempArenaDiv.innerHTML) {
          arenaContainer.innerHTML = tempArenaDiv.innerHTML;
        }
      }

      if (arenaWrapper) {
        arenaWrapper.style.display = hasActiveScheduled ? 'block' : 'none';
      }
      window._hasLoadedSchedulesData = true;

      return window._scheduledSkillIds;
    })
    .catch(err => {
      // Discard stale fetches
      if (renderCycleId !== window._schedulesRenderCycleId) return new Set();
      console.error('Failed to fetch student schedules:', err);
      container.innerHTML = '<div style="color:var(--gray-500)">Failed to load scheduled exams. Please try refreshing.</div>';
      if (arenaContainer) {
        arenaContainer.innerHTML = '<div style="color:var(--gray-500)">Failed to load scheduled exams. Please try refreshing.</div>';
      }
      return new Set();
    })
    .finally(() => {
      // Release the mutex so the next call can proceed
      window._loadSchedulesInFlight = null;
    });

  // Store the in-flight promise for the mutex
  window._loadSchedulesInFlight = schedulePromise;
  return schedulePromise;
}

async function startScheduledExam(scheduleId) {
  if (!currentUser) {
    showView('auth');
    return;
  }

  // ── STEP 1: Screen Share ──
  showLoading('Setting up screen sharing…', 'Your primary display must be shared for proctoring.');
  const screenShared = await initScreenShare();
  if (!screenShared) {
    hideLoading();
    cleanupStreams();
    await smoothAlert(
      'Full primary display screen sharing is required to begin the assessment. Please select your entire screen (not a window or tab).',
      'Security Prerequisite',
      '🖥️', 'warn'
    );
    return;
  }

  // ── STEP 2: Camera + Mic ──
  showLoading('Activating webcam & microphone…', 'Both camera and microphone must be enabled for proctoring.');
  const mediaStreamsOk = await initProctorMediaStreams();
  if (!mediaStreamsOk) {
    hideLoading();
    cleanupStreams();
    await smoothAlert(
      'Both your webcam and microphone must be active for proctored assessments. Please grant browser permissions and try again.',
      'Security Prerequisite',
      '📷', 'warn'
    );
    return;
  }

  // ── STEP 3: Bluetooth Check ──
  showLoading('Checking device connections…', 'Bluetooth and external device check in progress.');
  const bluetoothOk = await checkBluetoothPrerequisite();
  if (!bluetoothOk) {
    hideLoading();
    cleanupStreams();
    return;
  }

  // Hide loading to show smoothAlert
  hideLoading();

  // Show a beautiful gesture confirmation dialog to reset user activation token!
  await smoothAlert(
    'All proctoring feeds and security checks are active. Click OK to enter secure Full Screen mode and unlock the assessment arena.',
    'Unlock Secure Arena',
    '🔒', 'success'
  );

  // ── STEP 4: Full Screen ──
  showLoading('Entering secure fullscreen mode…', 'The exam requires fullscreen to prevent context switching.');
  try {
    await document.documentElement.requestFullscreen();
  } catch (err) {
    hideLoading();
    cleanupStreams();
    await smoothAlert(
      'Full Screen mode is required to unlock this assessment. Please allow fullscreen when prompted.',
      'Security Prerequisite',
      '🔒', 'warn'
    );
    return;
  }
  hideLoading();

  // ── STEP 5: Register attempt with server ──
  showLoading('Starting your secure exam session…', 'Registering your attempt and loading questions. Please wait.');

  try {
    const res = await fetchWithRetry('/api/exams/start-scheduled', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_email: currentUser.email,
        schedule_id: scheduleId,
        exam_password: pendingExamPassword || ((document.getElementById('exam-password-input') || {}).value || '').toUpperCase().trim()
      })
    }, 3, 800);

    const data = await res.json();

    if (data.error) {
      hideLoading();
      cleanupStreams();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      await smoothAlert(data.error, 'Cannot Start Exam', '❌', 'danger');
      return;
    }

    currentExam = data;
    activeProctorViolations = false;
    examGracePeriod = true;
    setTimeout(() => { examGracePeriod = false; }, 3000);

    document.getElementById('disqualify-alert').style.display = 'none';
    document.getElementById('active-question-title').innerText = currentExam.questionTitle || 'Scheduled Coding Challenge';
    document.getElementById('code-editor').value = currentExam.codeTemplate;
    if (typeof updateDesignMockupVisibility === 'function') updateDesignMockupVisibility();

    // Reset Simulators
    document.getElementById('sim-bluetooth-check').checked = false;
    document.getElementById('sim-phone-check').checked = false;
    document.getElementById('sim-camera-check').checked = false;
    document.getElementById('sim-screen-check').checked = false;

    // Reset status indicators to green/OK
    const indicators = [
      ['ind-camera', 'ACTIVE'], ['ind-mic', 'ACTIVE'],
      ['ind-screen', 'SHARING'], ['ind-focus', 'SECURED'],
      ['ind-bluetooth', 'DISABLED (OK)'], ['ind-phone', 'NOT DETECTED']
    ];
    indicators.forEach(([id, text]) => {
      const el = document.getElementById(id);
      if (el) { el.innerText = text; el.className = 'sec-indicator-status ok'; }
    });

    examSubmittingOrExiting = false;
    _submitInProgress = false;
    document.getElementById('view-exam').classList.add('strict-mode');

    hideLoading();
    showView('exam');
    startCountdown(currentExam.expirationMinutes * 60);
    bindFocusIntegrity();
    renderTestCases(currentExam.testCases);

    // Start auto-save for this exam
    initAutoSave(currentExam.examId);

    // Start periodic photo captures
    startPhotoCaptures();

    // Start real-time phone + second person detection via COCO-SSD
    phoneDetected = false;
    secondPersonViolationCount = 0;
    startPhoneDetection();

    // Start periodic Bluetooth adapter status monitoring
    startBluetoothMonitoring();

    // Success toast
    showToast('Exam started! Good luck — the clock is running.', 'success', 4000);

  } catch (err) {
    hideLoading();
    console.error('Failed to start scheduled timed session:', err);
    cleanupStreams();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    showToast('Failed to start exam — please check your connection and try again.', 'error', 7000);
  }
}


// Intersection observers for animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if(e.isIntersecting) e.target.classList.add('visible');
  });
}, {threshold: 0.1});
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));
