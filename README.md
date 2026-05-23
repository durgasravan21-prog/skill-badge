# 🏆 SkillProof — Timed Assessments & Proctoring Verification

SkillProof is a premium, enterprise-grade proctored coding assessment and skill verification platform. Built with a stunning glassmorphic UI, high-contrast dark/light theme options, and standard-compliant HSL variable themes, it empowers recruiters to schedule timed, highly proctored coding challenges and enables developers to take assessments under WebRTC-based proctoring controls to earn verified badges.

---

## ✨ Features & Capabilities

### 👨‍💻 Candidate Workspace & Exam Arena
* **Glassmorphic Welcome Banner**: Features real-time greets, interactive quick-action shortcuts, and detailed audit logs of skill claims.
* **Premium Metrics Grid**: Displays **SkillProof Index** score, verified badge counts, and **Integrity Trust Index** (100% minus infractions count).
* **Robust Code Editor**: Fully integrated timed environment featuring boilerplate templates and real-time execution outputs.
* **Onboarding & Claims**: Interactive onboarding flow supporting multi-skill claim submissions.
* **Personal Developer Portfolio API**: Generates secure personal Bearer tokens (`#settings-student-token`) allowing developers to sync and embed verified badges in GitHub readmes.

### 🏢 Recruiter & Enterprise Console
* **Sidebar Navigation**: Recruiter dashboard utilizing a left sidebar + right sub-tab panels panel (Console Overview, Timed Exams Scheduler, Manual & CSV dispatch, Proctoring History).
* **Chronological Timeline Feed**: Live timeline tracking of dispatch dispatches, candidate entries, exam completions, and proctor violations.
* **Bulk Candidate Dispatch**: Add rows dynamically (`addCandidateRow`) or upload a CSV file to send automated assessment invitations to candidates.
* **Dynamic Enterprise Styling & Custom Themes**: Pick corporate color accents (Orange, Emerald, Sapphire, Purple, Gold) which instantly propagate brand themes to candidate environments.
* **Strict Proctoring Controls**: Configurable criteria including WebRTC webcam stream mandates, decibel threshold noise alerts, and strict primary-monitor screen shares.
* **SMTP Bulk Evaluation Reports**: Dynamic visual report grid populating candidate details, skill metrics, proctor infractions, and SMTP dispatch delivery reports.

### 🔒 Platform Owner & Global Administration
* **Special Owner Context (`durgasravan21@gmail.com`)**: Automatic mapping of the platform head admin email to a permanent `"SkillProof Owner"` company context (`admin-company-uuid`).
* **Global History Visibility**: Complete data visibility over historical logs, proctoring violations, proctoring capture history, and timetables globally.

---

## 🛠 Tech Stack

* **Frontend**: Single Page Application (SPA) HTML5 + Vanilla JS, styled with custom high-contrast CSS Custom Properties.
* **Backend**: Node.js + Express.js API framework.
* **Database**: SQLite3 relational data engine running on **Write-Ahead Logging (WAL)** mode for high-throughput, concurrent reads and writes.
* **Proctoring AI**: WebRTC media capture streams, COCO-SSD object detection models for person and mobile device detection.
* **Security & Authentication**: Stateless HMAC-SHA256 session signature tokens, Helmet, CORS, Rate Limiting, and HTTP Parameter Pollution (HPP) protection.

---

## 📂 Project Architecture

```
skill-scan/
├── database.js     # Relational SQLite database schema definition, connection pool, and seeds
├── database.db     # Local active SQLite database instance (automatically created on load)
├── server.js       # Express server serving Static SPA + Stateful/Stateless JSON Endpoints
├── index.html      # Glassmorphic responsive client-side SPA containing all dashboards
├── package.json    # Project dependencies and configurations
├── vercel.json     # Production serverless deployment routes
├── test-e2e.js     # Programmatic E2E integration test suite containing 76 assertion cases
└── README.md       # Full platform execution and architectural overview
```

---

## 🗄 Relational Database Schema

SkillProof models relational records strictly using UUID keys generated securely on the server-side:

```
                  ┌─────────────────┐
                  │      users      │ (id, name, email, role, skillproof_score, company_id)
                  └────────┬────────┘
                           │ 1
                           │
             ┌─────────────┴─────────────┐
             │ 1                         │ 1:M
    ┌────────▼────────┐         ┌────────▼────────┐
    │     skills      │         │ student_skills  │ (status: 'claimed'/'verified'/'failed')
    └────────┬────────┘         └─────────────────┘
             │ 1
             │
    ┌────────▼────────┐         ┌─────────────────┐
    │    questions    ├─────────►   challenges    │ (status: 'active'/'evaluated'/'disqualified'/'expired')
    └─────────────────┘ 1   1:M └────────┬────────┘
                                         │ 1
                                  ┌──────┼──────┐
                             1:M  │      │      │ 1:1
                        ┌─────────▼──┐   │   ┌──▼─────────────┐
                        │ violations │   │   │  submissions   │ (archives candidate solution)
                        └────────────┘   │   └────────────────┘
                                         │ 1:1
                                 ┌───────▼──────┐
                                 │ evaluations  │ (multi-dimensional senior developer scores)
                                 └──────────────┘
```

---

## 🛡 Security & Proctoring Engineering

### ⚡ Signed Stateless Sessions
To guarantee full horizontal scaling compatibility under Vercel Serverless (avoiding ephemeral replica database synchronization latency or cold-start session losses), SkillProof uses **HMAC-Signed Stateless Session Tokens**:
1. When a user logs in, the backend encrypts their session profile (`userId`, `email`, `role`, `expiresAt`) inside a base64 string, appends a secure HMAC-SHA256 signature generated with a server `SESSION_SECRET`, and returns it as a Bearer token:
   $$\text{Token} = \text{Base64(Payload)} \,.\, \text{HMAC-SHA256(Base64(Payload), Secret)}$$
2. On subsequent requests, the `authenticateSession` middleware splits the token, recalculates the HMAC, verifies the signature statelessly, and lets authorized queries proceed safely.

### 🎥 Proctoring Verification Lifecycle
* **Active Webcam Stream**: Renders a live picture-in-picture box in the candidate arena sidebar. Revoking stream permissions logs camera infractions.
* **Strict Display Share**: Mandates candidate shares their full primary monitor via `getDisplayMedia`. Revoking capture logs screen-share infractions.
* **Tab Focus Exit Tracking**: Bound to both `document.visibilityState` and `window.blur`. Changing tabs, opening developer consoles, or switching windows immediately pauses the editor, alerts the user, and records focus violations.
* **AI Person & Phone Detection**: Live feed runs through COCO-SSD object classifiers. Detecting missing candidates, multi-people presence, or mobile devices flags and dispatches immediate warnings.
* **Universal Testing Master OTP**: During demonstration or review, the master passcode **`123456`** bypasses the Recruiter 2FA OTP, allowing seamless logins across all email domains.

---

## 🚀 Setup & Launch

### 1. Installation
Install project dependencies from the root workspace directory:
```bash
npm install
```

### 2. Startup Server
Run the Node full-stack Express server locally:
```bash
node server.js
```
The application will listen on port **`8080`** (`http://localhost:8080`).

### 3. Run E2E Integration Suite
To execute the comprehensive integration suite containing 76 verification tests (validating auth, SEO headers, multi-tenant isolation, re-attempts, lockout, and session recoveries):
```bash
node test-e2e.js
```

---

## 🧪 Experience & Test Walkthrough

### Option A: Student Flow (Exam Taking)
1. Navigate to `http://localhost:8080` and click **Log In** on the navbar.
2. Select **Continue with Google** or **GitHub**, and sign in using a consumer address (e.g. `student@gmail.com`, Name: `Challagolla Durga Sravan`).
3. Complete the interactive **Onboarding Modal** by saving your phone, university, and claiming developer skills.
4. Click **Start Test** on any claimed skill inside the dashboard.
5. Grant webcam permission and share your full primary display screen.
6. Type the recursive solution in the Python code editor.
7. Click outside the tab or browser window to observe focus violations being triggered.
8. Click **Submit Solution** to complete.

### Option B: Recruiter Flow (Candidate Dispatch & Audit)
1. Navigate to the login portal and authenticate using a corporate email address (e.g. `hr@google.com`).
2. Input the Master Bypass OTP code **`123456`** to log in instantly.
3. On the **Console Overview**, view the live timeline tracking candidate entries and proctor flags.
4. Navigate to the **Console Settings** tab to toggle strict WebRTC webcam enforcements or change the accent brand theme toEmerald or Sapphire.
5. In the **Send Candidate Invites** tab, add rows to dispatch invitations.
6. Review the full source code answers and proctoring camera captures chronologically under the **Proctoring & Analytics** history grid.

### Option C: Platform Owner Flow (Global Control)
1. Log in using the platform owner email **`durgasravan21@gmail.com`** and the master OTP **`123456`**.
2. The system maps the account to the global `"SkillProof Owner"` company context.
3. Access the dashboard to view historical proctor records, verified badges, and schedules globally across all companies.
