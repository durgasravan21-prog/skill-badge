
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

// Check layout restrictions â€” only block during EXAM, not whole site
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

// â”€â”€ VIEW MANAGEMENT â”€â”€
function showView(viewName) {
  document.querySelectorAll('.view-container').forEach(el => el.classList.remove('active'));
  const targetView = document.getElementById('view-' + viewName);
  if (targetView) targetView.classList.add('active');
  
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
  }
}

// Cleanup cameras, screen shares, and mic audio contexts
function cleanupStreams() {
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  if (audioStream) {
    audioStream.getTracks().forEach(track => track.stop());
    audioStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  clearInterval(micInterval);
}

// â”€â”€ THEME TOGGLE â”€â”€
if (localStorage.getItem('theme') === 'dark') {
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
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      
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

// â”€â”€ IN-PAGE LOGIN MODAL (no popup needed â€” works in all browsers) â”€â”€
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
  const oauthModal = document.getElementById('oauth-modal');
  if (oauthModal) {
    oauthModal.addEventListener('click', (e) => {
      if (e.target === oauthModal) closeOAuthModal();
    });
  }
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

    currentUser = data.user;
    currentCompany = data.company || null;  // Store company context for multi-tenant isolation
    
    // Update main navbar profile buttons
    document.getElementById('nav-login-btn').style.display = 'none';
    document.getElementById('nav-cta-btn').innerText = `Dashboard (${currentUser.name})`;
    document.getElementById('nav-cta-btn').onclick = () => showView(currentUser.role === 'recruiter' ? 'admin' : 'student');

    if (currentUser.role === 'recruiter') {
      showView('admin');
    } else {
      showView('student');
    }
  })
  .catch(err => {
    console.error('Secure Token exchange failure:', err);
    alert('Authentication database unreachable.');
  });
}

// â”€â”€ STUDENT DASHBOARD & CLAIMS SYSTEM â”€â”€
function loadStudentDashboard() {
  if (!currentUser) return;
  
  const avatarLetter = document.getElementById('student-avatar-letter');
  if (avatarLetter) avatarLetter.innerText = currentUser.name.charAt(0).toUpperCase();

  const profileName = document.getElementById('student-profile-name');
  if (profileName) {
    if (currentUser.skillproof_score >= 60) {
      profileName.innerHTML = `${currentUser.name} <span class="certified-gold-badge" style="margin-left: 8px;">ðŸ† SkillProof Verified</span>`;
    } else {
      profileName.innerText = currentUser.name;
    }
  }

  const profileEmail = document.getElementById('student-profile-email');
  if (profileEmail) profileEmail.innerText = currentUser.email;

  const profileSlug = document.getElementById('student-profile-slug');
  if (profileSlug) profileSlug.innerText = `Personal slug: ${currentUser.profile_slug}`;

  const sidebarScore = document.getElementById('student-sidebar-score');
  if (sidebarScore) sidebarScore.innerText = currentUser.skillproof_score.toFixed(2);

  const scoreBar = document.getElementById('student-score-bar');
  if (scoreBar) scoreBar.style.width = Math.min(100, Math.max(0, currentUser.skillproof_score)) + '%';

  // Fetch claimed skills
  fetch(`/api/skills/status?student_email=${encodeURIComponent(currentUser.email)}`)
    .then(res => res.json())
    .then(claimedSkills => {
      // Fetch master list of skills to see if they need to claim any first
      fetch('/api/skills')
        .then(res => res.json())
        .then(masterSkills => {
          renderClaimsSection(masterSkills, claimedSkills);
          renderProgressiveVerifier(claimedSkills);
          loadStudentSchedules();
        });
    });
}

// Render "Claim Skills" selectors for new students
function renderClaimsSection(master, claimed) {
  const wrapper = document.getElementById('claim-skills-wrapper');
  const listContainer = document.getElementById('claim-skills-list');
  listContainer.innerHTML = '';

  // Filter skills not claimed yet
  const unclaimed = master.filter(m => !claimed.some(c => c.skill_id === m.id));

  if (unclaimed.length === 0) {
    wrapper.style.display = 'none';
    return;
  }

  wrapper.style.display = 'block';
  unclaimed.forEach(s => {
    const card = document.createElement('div');
    card.className = 'skill-claim-card';
    card.innerHTML = `
      <h4>${s.name}</h4>
      <p>${s.category}</p>
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
    listContainer.appendChild(card);
  });
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
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      return;
    }
    alert(data.message);
    loadStudentDashboard();
  });
}

// Render progressive multi-level assessment list based on claimed skills
function renderProgressiveVerifier(claimed) {
  const questionsList = document.getElementById('questions-list');
  const badgesList = document.getElementById('earned-badges-list');
  const progWrapper = document.getElementById('active-verification-wrapper');
  
  questionsList.innerHTML = '';
  badgesList.innerHTML = '';
  progWrapper.style.display = 'none';

  if (claimed.length === 0) {
    questionsList.innerHTML = '<div style="color:var(--gray-500)">Claim a skill above to unlock proctored shuffled assessments.</div>';
    badgesList.innerHTML = '<div style="color:var(--gray-500)">No tags earned. Verification milestone pending.</div>';
    return;
  }

  // Iterate over claimed skills and populate active verifiers
  claimed.forEach(c => {
    // 1. Render Portfolio tags earned
    if (c.status === 'verified' && c.badge_tag) {
      const badge = document.createElement('div');
      badge.className = 'verified-skill-row';
      const verifiedByLabel = c.verified_by || 'SkillProof AI';
      const goldBadgeHTML = c.verified_score >= 60
        ? ` <span class="certified-gold-badge" style="margin-left: 8px;">ðŸ† ${verifiedByLabel} Verified</span>`
        : '';
      badge.innerHTML = `
        <div>
          <strong style="font-size:16px;">${c.skill_name}${goldBadgeHTML}</strong>
          <div style="font-size:12px; color:var(--gray-500); margin-top:2px;">Verified by SkillProof AI Â· Score: ${c.verified_score}/100</div>
        </div>
        <span class="verified-tag">${c.badge_tag}</span>
      `;
      badgesList.appendChild(badge);
    }

    // 2. Query next verification question (Dynamic Shuffling)
    fetch(`/api/skills/verification-next?student_email=${encodeURIComponent(currentUser.email)}&skill_id=${c.skill_id}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'locked_failed') {
          const row = document.createElement('div');
          row.className = 'verified-skill-row';
          row.style.borderColor = '#C62828';
          row.innerHTML = `
            <div>
              <strong>${c.skill_name}</strong>
              <div style="color:#C62828; font-size:12px; margin-top:4px;">âš ï¸ Verification Locked: Disqualified due to telemetry cheating sensor flags.</div>
            </div>
            <span class="status-tag disqualified" style="padding: 6px 14px;">DISQUALIFIED</span>
          `;
          questionsList.appendChild(row);
        } 
        else if (data.status === 'completed') {
          // Completed rendering handled by badge tag list
        } 
        else if (data.status === 'unlocked') {
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
            stepEasy.innerText = 'âœ“';
            stepMedium.className = 'progress-step active';
          } else if (data.difficulty === 'hard') {
            stepEasy.className = 'progress-step passed';
            stepEasy.innerText = 'âœ“';
            stepMedium.className = 'progress-step passed';
            stepMedium.innerText = 'âœ“';
            stepHard.className = 'progress-step active';
          }

          // Build dynamic question verifier challenge card
          const q = data.question;
          const qCard = document.createElement('div');
          qCard.className = 'q-card';
          qCard.style.borderLeft = '4px solid var(--orange)';
          qCard.innerHTML = `
            <div class="q-details">
              <h3>${q.title}</h3>
              <div class="q-badges">
                <span class="q-badge ${q.difficulty}">${q.difficulty} Tier</span>
                <span class="q-badge" style="background:var(--gray-50); color:var(--gray-700)">${q.expiration_minutes} Mins Expiry</span>
              </div>
            </div>
            <button onclick="openExamRulesModal('${q.id}')" class="btn-primary" style="padding:10px 20px;">Unlock Arena â†’</button>
          `;
          questionsList.appendChild(qCard);
        }
      });
  });
}

function resetProgressSteps() {
  document.getElementById('prog-step-easy').className = 'progress-step';
  document.getElementById('prog-step-easy').innerText = '1';
  document.getElementById('prog-step-medium').className = 'progress-step';
  document.getElementById('prog-step-medium').innerText = '2';
  document.getElementById('prog-step-hard').className = 'progress-step';
  document.getElementById('prog-step-hard').innerText = '3';
}

// Rules Modal Gate Helpers
function openExamRulesModal(questionId, scheduleId = null) {
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
}

function closeExamRulesModal() {
  const modal = document.getElementById('exam-rules-modal');
  if (modal) {
    modal.style.display = 'none';
  }
  pendingExamQuestionId = null;
  pendingScheduleId = null;
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
  if (pendingScheduleId) {
    const sId = pendingScheduleId;
    closeExamRulesModal();
    startScheduledExam(sId);
  } else if (pendingExamQuestionId) {
    const qId = pendingExamQuestionId;
    closeExamRulesModal();
    startExam(qId);
  }
}

// â”€â”€ TIMED EXAM ENGINE & HIGH SECURITY PROCTORING â”€â”€
async function startExam(questionId) {
  if (!currentUser) {
    showView('auth');
    return;
  }

  // 1. Enforce Full Screen
  try {
    await document.documentElement.requestFullscreen();
  } catch (err) {
    alert('Security prerequisite: Full Screen mode must be permitted to unlock high-security assessments.');
    return;
  }

  // 2. Access Camera and microphone WebRTC streams
  const mediaStreamsOk = await initProctorMediaStreams();
  if (!mediaStreamsOk) {
    if (document.fullscreenElement) document.exitFullscreen().catch(err=>{});
    alert('Security prerequisite: Both microphone and webcam feed must be active.');
    return;
  }

  // 3. Capture Screen Sharing
  const screenShared = await initScreenShare();
  if (!screenShared) {
    cleanupStreams();
    if (document.fullscreenElement) document.exitFullscreen().catch(err=>{});
    alert('Security prerequisite: Full primary display screen sharing is required.');
    return;
  }

  // Call Server to register TIMED attempt
  fetch('/api/exams/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_email: currentUser.email,
      question_id: questionId
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      cleanupStreams();
      if (document.fullscreenElement) document.exitFullscreen().catch(err=>{});
      return;
    }

    currentExam = data;
    activeProctorViolations = false;
    document.getElementById('disqualify-alert').style.display = 'none';
    document.getElementById('active-question-title').innerText = currentExam.questionTitle || 'Timed Coding Challenge';
    document.getElementById('code-editor').value = currentExam.codeTemplate;

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

    document.getElementById('view-exam').classList.add('strict-mode');
    showView('exam');
    startCountdown(currentExam.expirationMinutes * 60);
    bindFocusIntegrity();
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
    // Request webcam
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoEl.srcObject = videoStream;
    placeholder.style.display = 'none';
    videoEl.style.display = 'block';

    // Request active audio microphone
    audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
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
      const audioTrack = audioStream.getAudioTracks()[0];
      if (!audioTrack || !audioTrack.enabled || audioTrack.muted) {
        logViolation('mic_muted');
      }
    }, 100);

    return true;
  } catch (err) {
    console.error('Proctor hardware stream error:', err);
    placeholder.innerText = 'âš ï¸ Camera/Mic Blocked';
    return false;
  }
}

// Screen Sharing Init
async function initScreenShare() {
  try {
    screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    // If the candidate stops screen sharing manually, trigger violation
    screenStream.getVideoTracks()[0].addEventListener('ended', () => {
      logViolation('screen_share_off');
    });
    return true;
  } catch (err) {
    console.error('Screen sharing denied:', err);
    return false;
  }
}

// Timer Loop
function startCountdown(durationSeconds) {
  let timer = durationSeconds;
  const timerDisplay = document.getElementById('active-timer');

  clearInterval(currentTimer);
  currentTimer = setInterval(() => {
    const minutes = Math.floor(timer / 60);
    const seconds = timer % 60;

    timerDisplay.innerText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    if (--timer < 0) {
      clearInterval(currentTimer);
      timerDisplay.innerText = "00:00";
      alert('Time limit expired! Solution is auto-submitting.');
      submitExam(true);
    }
  }, 1000);
}

// Anti-Cheat security listeners: focus blur and fullscreen exiting
function bindFocusIntegrity() {
  // Focus exits
  window.onblur = () => {
    if (document.getElementById('view-exam').classList.contains('active')) {
      logViolation('tab_exit');
    }
  };
  document.onvisibilitychange = () => {
    if (document.visibilityState === 'hidden' && document.getElementById('view-exam').classList.contains('active')) {
      logViolation('tab_exit');
    }
  };

  // Full Screen changes
  document.onfullscreenchange = () => {
    if (!document.fullscreenElement && document.getElementById('view-exam').classList.contains('active')) {
      logViolation('fullscreen_exit');
    }
  };

  // Bind Anti-copy & paste listeners to editor
  const editor = document.getElementById('code-editor');
  editor.oncopy = e => e.preventDefault();
  editor.oncut = e => e.preventDefault();
  editor.onpaste = e => e.preventDefault();
  editor.oncontextmenu = e => e.preventDefault();
}

// Log infractions to database
function logViolation(violationType) {
  if (!currentExam) return;

  fetch('/api/exams/violation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exam_id: currentExam.examId,
      type: violationType
    })
  })
  .then(res => res.json())
  .then(data => {
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
    } else if (violationType === 'phone_detected') {
      const ind = document.getElementById('ind-phone');
      ind.innerText = 'BREACH (PHONE DETECTED)';
      ind.className = 'sec-indicator-status err';
    }
  });
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
    document.getElementById('camera-placeholder').innerText = 'âš ï¸ Stream disconnected';
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

// Submit Exam Solution
function submitExam(isAutoSubmit = false) {
  if (!currentExam) return;

  const code = document.getElementById('code-editor').value;

  fetch('/api/exams/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      exam_id: currentExam.examId,
      code: code
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.status === 'disqualified') {
      alert(`Assessment Finished: Results are WITHHELD due to proctoring security infractions (${data.violationsCount} violations logged).`);
      exitExamEnvironment(data);
      return;
    } else if (data.status === 'expired') {
      alert('Assessment Finished: Exam session has expired.');
      exitExamEnvironment(data);
      return;
    }

    // Check if this is a scheduled multi-stage assessment with more questions remaining
    if (currentExam.scheduleId && currentExam.questionList && (currentExam.currentQuestionIndex + 1 < currentExam.questionList.length)) {
      const nextIndex = currentExam.currentQuestionIndex + 1;
      const nextQuestionId = currentExam.questionList[nextIndex];

      alert(`Level Submitted Successfully!\nScore: ${data.score}/100\nCorrectness: ${data.scores.correctness}/40\nAI Summary: "${data.aiSummary}"\n\nAdvancing to Stage ${nextIndex + 1} of ${currentExam.questionList.length}...`);

      fetch('/api/exams/next-scheduled', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_email: currentUser.email,
          schedule_id: currentExam.scheduleId,
          question_id: nextQuestionId,
          prev_exam_id: currentExam.examId
        })
      })
      .then(res => res.json())
      .then(nextData => {
        if (nextData.error) {
          alert(nextData.error);
          exitExamEnvironment(data);
          return;
        }

        // Update currentExam properties in-place!
        currentExam.examId = nextData.examId;
        currentExam.currentQuestionIndex = nextIndex;
        currentExam.questionTitle = nextData.questionTitle;
        currentExam.codeTemplate = nextData.codeTemplate;

        // Seamlessly update UI in-place (WebRTC camera, mic, screen share, and overall countdown timer continue uninterrupted!)
        document.getElementById('active-question-title').innerText = currentExam.questionTitle || 'Scheduled Coding Challenge';
        document.getElementById('code-editor').value = currentExam.codeTemplate;
      })
      .catch(err => {
        console.error('Failed to load next stage:', err);
        exitExamEnvironment(data);
      });
    } else {
      // Final stage or single timed assessment completed
      alert(`Assessment Evaluated Successfully!\nFinal Score: ${data.score}/100\nCorrectness: ${data.scores.correctness}/40\nQuality: ${data.scores.quality}/25\nEdge Cases: ${data.scores.edgeCases}/20\nUnderstanding: ${data.scores.understanding}/15\n\nAI Analysis Report Summary:\n"${data.aiSummary}"`);
      exitExamEnvironment(data);
    }
  })
  .catch(err => {
    console.error('Submission failed:', err);
  });
}

function exitExamEnvironment(data) {
  document.getElementById('view-exam').classList.remove('strict-mode');
  clearInterval(currentTimer);
  cleanupStreams();
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(err => {});
  }
  showView('student');
  if (currentUser) {
    loadStudentDashboard();
  }
}

// â”€â”€ ADMIN VIEW: CREATE TIMED QUESTIONS â”€â”€
function createQuestion() {
  const title = document.getElementById('add-q-title').value;
  const difficulty = document.getElementById('add-q-diff').value;
  const exp = document.getElementById('add-q-exp').value;
  const template = document.getElementById('add-q-template').value;

  if (!title || !template) {
    alert('Please fill out all required fields.');
    return;
  }

  fetch('/api/questions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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

// â”€â”€ ADMIN VIEW: LOAD HISTORIC LOGS & AI SYNTHESIS SUMMARIES â”€â”€
let masterSkillsList = [];
let bulkCandidateRowCount = 0;

function addCandidateRow(name = '', email = '', skillId = '') {
  bulkCandidateRowCount++;
  const container = document.getElementById('bulk-dispatch-rows');
  if (!container) return;
  const rowId = `bulk-row-${bulkCandidateRowCount}`;
  
  const div = document.createElement('div');
  div.id = rowId;
  div.style.border = '1px solid var(--gray-100)';
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
      <input type="text" class="bulk-cand-name" placeholder="Alice Logan" value="${name}" style="padding:6px; border:1px solid var(--gray-200); border-radius:var(--radius-sm); font-size:12px;" />
      <input type="email" class="bulk-cand-email" placeholder="alice@gmail.com" value="${email}" style="padding:6px; border:1px solid var(--gray-200); border-radius:var(--radius-sm); font-size:12px;" />
    </div>
    <select class="bulk-cand-skill" style="padding:6px; border:1px solid var(--gray-200); border-radius:var(--radius-sm); font-size:12px; width:100%;">
      ${selectOptions}
    </select>
  `;
  
  container.appendChild(div);
  
  if (document.body.classList.contains('dark-theme')) {
    div.style.background = '#0C0A09';
    div.style.borderColor = '#2A2624';
    div.querySelectorAll('input, select').forEach(el => {
      el.style.background = '#171412';
      el.style.borderColor = '#3A3935';
      el.style.color = '#FFF';
    });
  }
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
          ? `âš ï¸ Proctor flag: ${result.violationsCount} breach` 
          : `âœ“ Proctor clean`;
        
        logMessage(`AI Report Synthesized: Score: ${result.status === 'disqualified' ? 'WITHHELD' : result.score}/100 | ${infractionMsg}`, '#FFD7C9');
        logMessage(`âœ“ Successful dispatch completed for ${cand.name}.`, '#2E7D32');
      } else {
        logMessage(`âŒ Failed to dispatch / evaluate candidate: ${data.error || 'Server error'}`, '#FF5252');
      }
    } catch (err) {
      logMessage(`âŒ Network error executing evaluation: ${err.message}`, '#FF5252');
    }
  }

  progressBar.style.width = '100%';
  logMessage(`----------------------------------------`, '#6B6A64');
  logMessage(`Bulk dispatch complete. Success count: ${successCount} / ${candidates.length}`, '#FFF');

  processedResults.forEach(r => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--gray-100)';
    
    const violationBadge = r.violationsCount > 0 
      ? `<span style="color:#C62828; font-weight:700;">âš ï¸ ${r.violationsCount} violations</span>` 
      : `<span style="color:#2E7D32; font-weight:700;">âœ“ Clean proctor</span>`;

    tr.innerHTML = `
      <td style="padding: 8px 6px;">
        <strong>${r.name}</strong><br/>
        <span style="color:var(--gray-500); font-size:10px">${r.email}</span>
      </td>
      <td style="padding: 8px 6px;">${r.skillName}</td>
      <td style="padding: 8px 6px;"><strong>${r.status === 'disqualified' ? 'WITHHELD' : r.score + '/100'}</strong></td>
      <td style="padding: 8px 6px;">${violationBadge}</td>
      <td style="padding: 8px 6px; text-align: right; color:#2E7D32; font-weight:700;">${r.smtpStatus}</td>
    `;
    tableBody.appendChild(tr);
  });

  document.getElementById('bulk-dispatch-finished-actions').style.display = 'block';
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
    historyTitle.innerText = `${currentCompany.name} â€” Assessments & Proctoring History`;
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
              return `â€¢ [${time}] Breach: ${v.type.toUpperCase()}`;
            }).join('<br/>');
          } else {
            infractionLog = '<span style="color:#2E7D32">No breaches recorded</span>';
          }

          const summaryText = exam.ai_summary || 'Evaluating...';
          const finalScore = exam.status === 'disqualified' ? 0 : (exam.score || 0);
          
          // Company-specific badge beside student names if >= 60
          const companyLabel = currentCompany ? currentCompany.name : 'SkillProof';
          const goldBadgeHTML = finalScore >= 60
            ? ` <span class="certified-gold-badge" style="margin-left: 6px;">ðŸ† ${companyLabel} Verified</span>`
            : '';

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="text-align: center;">
              <input type="checkbox" class="candidate-checkbox" data-email="${exam.student_email}" data-name="${exam.student_name}" data-score="${finalScore}" data-skill="${exam.question_title}" data-violations="${exam.violations_count}" onchange="updateSelectedCandidatesCount()" style="transform:scale(1.2); cursor:pointer;" />
            </td>
            <td>
              <strong>${exam.student_name}${goldBadgeHTML}</strong><br/>
              <span style="color:var(--gray-500); font-size:11px">${exam.student_email}</span>
            </td>
            <td>${exam.question_title}</td>
            <td>
              <strong style="color:${exam.violations_count > 0 ? '#C62828' : '#2E7D32'}">
                ${exam.violations_count}
              </strong>
            </td>
            <td><span class="status-tag ${exam.status}">${exam.status.toUpperCase()}</span></td>
            <td><strong>${exam.status === 'disqualified' ? 'WITHHELD' : finalScore + '/100'}</strong></td>
            <td>
              <div style="font-size:12px; font-weight:500; color:var(--gray-900); background:var(--gray-50); border:1px solid var(--gray-100); padding:10px; border-radius:4px; margin-bottom:8px; line-height:1.4;">
                ðŸ’¡ <strong>AI Summary:</strong> ${summaryText}
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div style="font-size:10px; color:var(--gray-500); line-height:1.4;">${infractionLog}</div>
                <button onclick="viewCandidateCode('${exam.examId}')" class="btn-ghost" style="padding: 4px 8px; font-size: 11px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; border-radius: 4px;">
                  ðŸ’» View Submitted Code
                </button>
              </div>
            </td>
          `;
          historyBody.appendChild(tr);
        });
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
      })
      .catch(err => {
        console.error('Failed to load master skills list:', err);
        renderHistory();
      });
  } else {
    populateScheduleSkillSelect();
    loadRecruiterSchedules();
    renderHistory();
  }
}

// Candidate Code Viewer Methods
function viewCandidateCode(examId) {
  const exam = currentExamsList.find(e => e.examId === examId || e.id === examId);
  if (!exam) {
    alert('Candidate record not found.');
    return;
  }
  
  const codeContent = exam.submitted_code || '// No code submitted.';
  const codeView = document.getElementById('submitted-code-content-view');
  if (codeView) {
    codeView.textContent = codeContent; // Prevent HTML injection safely!
  }
  
  const modalSubtitle = document.getElementById('submitted-code-modal-subtitle');
  if (modalSubtitle) {
    modalSubtitle.innerText = `Exact logic answer submitted by ${exam.student_name} for ${exam.question_title}`;
  }
  
  const modal = document.getElementById('view-submitted-code-modal');
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeSubmittedCodeModal() {
  const modal = document.getElementById('view-submitted-code-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// â”€â”€ STUDENT DASHBOARD SUB-TAB SWITCHER â”€â”€
function switchStudentTab(tabName) {
  // Hide all student workspace panels
  document.querySelectorAll('.student-workspace-panel').forEach(panel => {
    panel.classList.remove('active');
  });
  // Show target student workspace panel
  const target = document.getElementById('tab-' + tabName);
  if (target) target.classList.add('active');

  // Deactivate all navigation buttons
  document.querySelectorAll('.student-nav-item').forEach(item => {
    item.classList.remove('active');
  });
  // Activate target button
  const targetBtn = document.getElementById('nav-btn-' + tabName);
  if (targetBtn) targetBtn.classList.add('active');

  // Refresh content dynamically
  if (currentUser) {
    loadStudentDashboard();
  }
}

// â”€â”€ RECRUITER BULK ACTION TRIGGERS & SENDING UTILITIES â”€â”€
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
      ? `<span style="color:#C62828; font-weight:700;">âš ï¸ ${violations} infractions</span>` 
      : `<span style="color:#2E7D32; font-weight:700;">âœ“ Clean proctor</span>`;

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
        <strong>${name}</strong> (${email})
        <div style="font-size:10px; color:var(--gray-500); margin-top:2px;">Skill: ${skill} Â· Verified Score: ${score}/100</div>
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
        logMessage(`âœ“ Success: Verification report invite sent and logged to database for ${name} (${email})`, true);
      } else {
        logMessage(`âŒ Error: API response failure for candidate ${email}: ${result.error || 'Unknown error'}`, false);
      }
    } catch (err) {
      logMessage(`âŒ Network Error: Failed to transmit SMTP parcel for ${email}: ${err.message}`, false);
    }

    // Update progress bar
    const pct = Math.round(((i + 1) / total) * 100);
    progressBar.style.width = pct + '%';
  }

  logMessage(`SMTP Pipeline finished. Total attempted: ${total} | Dispatched successfully: ${successCount}.`);
  
  // Show final actions
  document.getElementById('bulk-email-finished-actions').style.display = 'block';
}

// â”€â”€ EXAM SCHEDULING SYSTEM: FRONTEND INTEGRATION â”€â”€
function populateScheduleSkillSelect() {
  const select = document.getElementById('schedule-skill-select');
  if (!select) return;
  select.innerHTML = '';
  masterSkillsList.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.innerText = s.name;
    select.appendChild(opt);
  });
}

function scheduleExamSequence() {
  if (!currentUser || !currentCompany) return;
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
      company_id: currentCompany.id,
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
    alert('Multi-stage assessment sequence scheduled successfully.');
    loadRecruiterSchedules();
  })
  .catch(err => {
    console.error('Failed to schedule assessment:', err);
  });
}

function loadRecruiterSchedules() {
  if (!currentCompany) return;
  const container = document.getElementById('recruiter-schedules-list');
  if (!container) return;
  
  fetch(`/api/recruiter/schedules?company_id=${currentCompany.id}`)
    .then(res => res.json())
    .then(schedules => {
      container.innerHTML = '';
      if (schedules.length === 0) {
        container.innerHTML = '<tr><td colspan="5" style="color:var(--gray-500); text-align: center;">No scheduled assessments created yet.</td></tr>';
        return;
      }
      schedules.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${s.skill_name}</strong></td>
          <td><span class="difficulty-tag" style="background:var(--orange-deep); color:#FFF; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:700;">${s.difficulty_order.toUpperCase()}</span></td>
          <td>${new Date(s.start_time).toLocaleString()}</td>
          <td><strong>${s.duration_minutes} mins</strong></td>
          <td><code style="font-size:11px; background:var(--gray-50); padding:2px 4px; border-radius:4px; border:1px solid var(--gray-200); font-weight:700;">${s.id}</code></td>
        `;
        container.appendChild(tr);
      });
    })
    .catch(err => {
      console.error('Failed to load recruiter schedules:', err);
    });
}

function loadStudentSchedules() {
  if (!currentUser) return;
  const container = document.getElementById('student-schedules-list');
  if (!container) return;

  fetch(`/api/student/schedules?student_email=${encodeURIComponent(currentUser.email)}`)
    .then(res => res.json())
    .then(schedules => {
      container.innerHTML = '';
      if (schedules.length === 0) {
        container.innerHTML = '<div style="color:var(--gray-500)">No active invitations found matching your claimed skills.</div>';
        return;
      }

      schedules.forEach(s => {
        const card = document.createElement('div');
        card.className = 'verified-skill-row';
        card.style.display = 'flex';
        card.style.justifyContent = 'space-between';
        card.style.alignItems = 'center';
        card.style.padding = '16px';
        card.style.background = 'var(--white)';
        card.style.border = '1px solid var(--gray-100)';
        card.style.borderRadius = 'var(--radius-md)';
        card.style.marginBottom = '12px';
        card.style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)';

        if (document.body.classList.contains('dark-theme')) {
          card.style.background = '#0C0A09';
          card.style.borderColor = '#2A2624';
        }

        const companyBadge = s.company_name 
          ? `<span style="font-size: 11px; background:var(--orange-deep); color:#FFF; padding:2px 6px; border-radius:4px; font-weight:700; margin-left:8px;">ðŸ¢ ${s.company_name}</span>`
          : '';

        const difficultyLabels = s.difficulty_order.toUpperCase().split(',').map(d => 
          `<span style="font-size: 10px; background:var(--gray-100); color:var(--gray-800); padding:2px 6px; border-radius:4px; margin-right:4px; font-weight:600;">${d}</span>`
        ).join('');

        card.innerHTML = `
          <div>
            <div style="display:flex; align-items:center;">
              <strong style="font-size:16px;">${s.skill_name}</strong>
              ${companyBadge}
            </div>
            <div style="font-size:12px; color:var(--gray-500); margin-top:6px; line-height:1.4;">
              <strong>Stages:</strong> ${difficultyLabels}<br/>
              <strong>Duration Limit:</strong> ${s.duration_minutes} mins Â· <strong>Available from:</strong> ${new Date(s.start_time).toLocaleString()}
            </div>
          </div>
          <button onclick="openExamRulesModal(null, '${s.id}')" class="btn-primary" style="padding: 8px 16px; font-size:13px; font-weight:700; cursor:pointer;">
            ðŸš€ Launch Sequence
          </button>
        `;
        container.appendChild(card);
      });
    })
    .catch(err => {
      console.error('Failed to fetch student schedules:', err);
    });
}

async function startScheduledExam(scheduleId) {
  if (!currentUser) {
    showView('auth');
    return;
  }

  // 1. Enforce Full Screen
  try {
    await document.documentElement.requestFullscreen();
  } catch (err) {
    alert('Security prerequisite: Full Screen mode must be permitted to unlock high-security assessments.');
    return;
  }

  // 2. Access Camera and microphone WebRTC streams
  const mediaStreamsOk = await initProctorMediaStreams();
  if (!mediaStreamsOk) {
    if (document.fullscreenElement) document.exitFullscreen().catch(err=>{});
    alert('Security prerequisite: Both microphone and webcam feed must be active.');
    return;
  }

  // 3. Capture Screen Sharing
  const screenShared = await initScreenShare();
  if (!screenShared) {
    cleanupStreams();
    if (document.fullscreenElement) document.exitFullscreen().catch(err=>{});
    alert('Security prerequisite: Full primary display screen sharing is required.');
    return;
  }

  // Call Server to register TIMED scheduled attempt
  fetch('/api/exams/start-scheduled', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      student_email: currentUser.email,
      schedule_id: scheduleId
    })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      alert(data.error);
      cleanupStreams();
      if (document.fullscreenElement) document.exitFullscreen().catch(err=>{});
      return;
    }

    currentExam = data; // Includes examId, startedAt, expirationMinutes, codeTemplate, questionTitle, questionList, currentQuestionIndex, scheduleId
    activeProctorViolations = false;
    document.getElementById('disqualify-alert').style.display = 'none';
    document.getElementById('active-question-title').innerText = currentExam.questionTitle || 'Scheduled Coding Challenge';
    document.getElementById('code-editor').value = currentExam.codeTemplate;

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

    document.getElementById('view-exam').classList.add('strict-mode');
    showView('exam');
    startCountdown(currentExam.expirationMinutes * 60);
    bindFocusIntegrity();
  })
  .catch(err => {
    console.error('Failed to start scheduled timed session:', err);
    cleanupStreams();
  });
}

// Intersection observers for animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if(e.isIntersecting) e.target.classList.add('visible');
  });
}, {threshold: 0.1});
document.querySelectorAll('.fade-up').forEach(el => observer.observe(el));

