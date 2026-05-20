# SkillProof — Timed Assessments & Proctoring Verification

SkillProof is a premium, full-stack proctored coding assessment and skill verification platform. It allows recruiters to publish custom timed coding challenges and candidates to solve them live under strict WebRTC-based and window-focus-based proctoring controls. Evaluations are generated dynamically across senior engineer grading rubrics and badged onto verified public developer profiles in real time.

---

## 🛠 Tech Stack
- **Core Frontend**: Single Page Application (SPA) HTML5 + Vanilla JS, embedded CSS Custom Variables design tokens.
- **Styling**: Sleek B2B design matching terracotta dark orange (`#E65100`) accent themes with pristine high-contrast light/dark toggle.
- **Backend API**: Node.js + Express.js API routers.
- **Database**: SQLite3 relational data engine, maintaining complete UUID foreign keys.

---

## 📂 Project Architecture

```
skill-scan/
├── database.js     # Relational SQLite database schema definition, seeding, and connection pool
├── database.db     # Local database instance (created automatically on server start)
├── server.js       # Unified Node/Express server serving Static Client + JSON Endpoints
├── index.html      # Multi-view SPA client (landing page, OAuth portal, student dashboard, proctor arena, recruiter panel)
├── package.json    # Project dependencies and script triggers
└── README.md       # Platform execution, setup, and proctor testing documentation
```

---

## 🗄 Relational Database Schema

SkillProof models relational records strictly using UUID keys generated securely on the server-side:

```
                  ┌─────────────────┐
                  │      users      │ (id, name, email, role, skillproof_score, created_at)
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

1. **`users`**: Represents students and recruiter accounts. Detects corporate domains automatically to register recruiter access.
2. **`skills`**: Master table containing standard programming capabilities (Python, C, SQL).
3. **`student_skills`**: Track verification milestones and badge statuses.
4. **`questions`**: Standard library of developer questions and skeleton coding structures.
5. **`challenges`**: Manages timed assessments. Controls `expires_at` thresholds compared strictly on server-side.
6. **`submissions`**: Archives source code submissions.
7. **`evaluations`**: Senior engineer rubric: Correctness (40%), Quality (25%), Edge Cases (20%), Understanding (15%).
8. **`violations`**: Chronological log of proctor security breaches.

---

## 🛡 Proctoring Security Suite

Our proctor arena employs strict browser-level tracking to defend test integrity. If a breach is captured or simulated:
- **Immediate Disqualification**: The database commits the infraction, flags the challenge status to `'disqualified'`, and locks/withholds the scoring results from candidate dashboard view.
- **WebRTC Camera Stream**: Stream displays live in the arena sidebar. Closing, revoking, or disconnecting camera streams raises active warnings and logs breaches.
- **Focus Exit Sensor**: Queries tab active states using `document.visibilityState` and `window.blur` bindings. Navigating away to search answers immediately logs focus exits.
- **Primary Display Capture**: Requires `navigator.mediaDevices.getDisplayMedia` to bind full desktop capture. Revoking screens stops active work.
- **Infraction Simulators**: Recruiter panel features quick-toggle switches to simulate external Bluetooth activations or phone usage detections.

---

## 🚀 Step-by-Step Launch & Walkthrough

### 1. Installation
Install core project node dependencies from the root directory:
```bash
npm install
```

### 2. Start Live Server
Fire up the unified full-stack Express engine:
```bash
node server.js
```
The application will start listening on port **`8080`**.

### 3. Open Web Client
Point your web browser to:
[http://localhost:8080](http://localhost:8080)

---

## 🧪 Comprehensive Walkthrough Flow

Follow these steps to experience the complete platform integration:

1. **Mock Sign-In (Student)**:
   - Click **Log In** on the landing page navbar.
   - Select **Continue with Google** or **GitHub**.
   - Input a personal email (e.g. `alex@gmail.com`) and display name.
   - Click **Verify Identity**. The app logs you in as a **Student** and loads your timed challenge dashboard.

2. **Run a Timed Assessment**:
   - Locate the seeded `"Verify if a binary tree is symmetric"` challenge and click **Start Test**.
   - Approve browser permissions to access your **Webcam Camera Stream** and select your **Full Primary Display** to share.
   - The editor loads containing the Python tree skeleton, alongside active green status sensors in the sidebar.

3. **Simulate a Security Breach**:
   - Let's test the proctor security triggers! Click on the **"Turn Bluetooth ON"** or **"Simulate Using Phone"** toggles in the infraction simulator section.
   - Alternatively, click outside the browser window (triggering tab focus exit).
   - A red banner immediately freezes the code editor, announcing **disqualification**. The database commits the infraction.

4. **Submit Solution**:
   - Complete typing code and click **Submit Solution**.
   - Because you triggered an infraction, a prompt confirms results are **withheld**.

5. **Recruiter Review (Admin Portal)**:
   - Click **Log Out** or log in from a fresh window.
   - Authenticate with a corporate email (e.g. `hr@google.com`).
   - The system automatically grants you **Recruiter** status and opens the recruiter dashboard.
   - Under the **"Assessments & Proctoring History"** table, you will see a detailed log of the student's test. It lists the exact violations, timestamps, `'DISQUALIFIED'` status, and score showing `'WITHHELD'`.

6. **Create a Timed Challenge**:
   - Fill out the **"Create Timed Challenge"** form in the left sidebar:
     - Title: `Calculate factorial recursively in Python`
     - Difficulty: `Easy`
     - Time limit: `8`
     - Skeleton code: `def factorial(n):\n    # Write Python code here`
   - Click **Publish Question**.
   - Relog as a student, and see this new challenge appear instantly in the candidate test library!
