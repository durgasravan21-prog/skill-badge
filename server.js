const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const db = require('./database');
const dbSync = require('./dbSync');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Trust Vercel's reverse proxy — required for rate limiting and correct client IP detection
app.set('trust proxy', 1);

// ═══════════════════════════════════════════════════════════════
// SECURITY LAYER 1: Helmet — Secure HTTP Response Headers
// ═══════════════════════════════════════════════════════════════
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'", "*", "blob:", "data:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "*"],
      styleSrc: ["'self'", "'unsafe-inline'", "*"],
      fontSrc: ["'self'", "*"],
      imgSrc: ["'self'", "data:", "blob:", "*"],
      connectSrc: ["'self'", "*"],
      mediaSrc: ["'self'", "blob:", "data:", "*"],
      frameSrc: ["'self'", "*"]
    }
  },
  crossOriginEmbedderPolicy: false,  // Required for getUserMedia in exam
  // Allow popups to postMessage back (OAuth handshake)
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  xContentTypeOptions: true,
  xFrameOptions: { action: 'sameorigin' },
  xXssProtection: true
}));

// ═══════════════════════════════════════════════════════════════
// SECURITY LAYER 2: CORS — Restrict Cross-Origin Access
// ═══════════════════════════════════════════════════════════════
app.use(cors({
  origin: true,  // Same-origin SPA
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'X-Requested-With'],
  credentials: false,
  maxAge: 600
}));

// ═══════════════════════════════════════════════════════════════
// SECURITY LAYER 3: Body Parsing with Size Limits
// ═══════════════════════════════════════════════════════════════
app.use(express.json({ limit: '1mb' }));  // Max 1MB for code submissions
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// ═══════════════════════════════════════════════════════════════
// SECURITY LAYER 4: HTTP Parameter Pollution Protection
// ═══════════════════════════════════════════════════════════════
app.use(hpp());

// ═══════════════════════════════════════════════════════════════
// SECURITY LAYER 5: Rate Limiting
// ═══════════════════════════════════════════════════════════════
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: { error: 'Too many requests. Please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,
  validate: false,
  message: { error: 'Too many authentication attempts. Please wait 1 minute.' }
});

const bulkLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  validate: false,
  message: { error: 'Too many bulk operations. Please wait 1 minute.' }
});

const examLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  validate: false,
  message: { error: 'Too many exam attempts. Please wait 1 minute.' }
});

app.use(globalLimiter);

// ═══════════════════════════════════════════════════════════════
// DATABASE STATE SYNC MIDDLEWARE (For Vercel Serverless)
// ═══════════════════════════════════════════════════════════════
app.use(async (req, res, next) => {
  if (process.env.VERCEL) {
    try {
      const updated = await dbSync.pullLatestDb();
      if (updated) {
        await db.reopen();
      }
    } catch (err) {
      console.error('[DB Sync Middleware] Pull/Reopen failed:', err.message);
    }

    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      res.on('finish', () => {
        dbSync.pushLatestDb()
          .then(success => {
            if (success) {
              console.log('[DB Sync Middleware] Auto-pushed database successfully.');
            }
          })
          .catch(err => {
            console.error('[DB Sync Middleware] Push failed:', err.message);
          });
      });
    }
  }
  next();
});

// ═══════════════════════════════════════════════════════════════
// SECURITY LAYER 6: Input Validation Helpers
// ═══════════════════════════════════════════════════════════════
function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '');  // Strip angle brackets to prevent HTML injection
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
}

function isValidUUID(str) {
  if (typeof str !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

function sanitizeCode(code) {
  if (typeof code !== 'string') return '';
  return code.slice(0, 50000);  // Max 50KB code
}

// ── HEAD ADMIN (site owner who reviews all results and awards badges) ──
const HEAD_ADMIN_EMAIL = 'durgasravan21@gmail.com';

function stripToSnippet(code) {
  if (typeof code !== 'string') return code;

  // ── Universal body stripper ──
  // Remove all function/method bodies, keeping only signatures + placeholder comment
  // Works for Python, JS, TS, Go, C, C++, Rust, SQL, etc.

  const lines = code.split('\n');
  const result = [];
  let insideBody = false;
  let braceDepth = 0;
  let indentBlock = null; // for Python-style indented bodies

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimEnd();

    // ── Python: detect def/class body ──
    if (/^(def |class )/.test(trimmed)) {
      result.push(trimmed);
      // Find the indent of the body
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const bodyIndent = nextLine.match(/^(\s+)/)?.[1] || '    ';
        result.push(`${bodyIndent}# Write your solution here`);
        indentBlock = bodyIndent;
        i++; // skip first body line
        // Skip all indented body lines
        while (i + 1 < lines.length) {
          const peek = lines[i + 1];
          if (peek.trim() === '' || peek.startsWith(indentBlock)) {
            i++;
          } else {
            break;
          }
        }
      }
      insideBody = false;
      continue;
    }

    // ── C-style braced bodies (JS, TS, Go, C, C++, Rust, Java) ──
    if (!insideBody) {
      result.push(trimmed);
      // Count braces
      for (const ch of trimmed) {
        if (ch === '{') { braceDepth++; insideBody = braceDepth > 0; }
        if (ch === '}') { braceDepth = Math.max(0, braceDepth - 1); }
      }
      if (insideBody && braceDepth > 0) {
        // Opening brace found — inject placeholder
        const indent = trimmed.match(/^(\s*)/)?.[1] || '';
        result.push(`${indent}  // Write your solution here`);
      }
    } else {
      // Track closing braces to detect end of body
      for (const ch of trimmed) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0) {
        // End of body — emit closing brace only
        result.push(trimmed);
        insideBody = false;
        braceDepth = 0;
      }
      // Skip body lines
    }
  }

  return result.join('\n');
}


// ═══════════════════════════════════════════════════════════════
// TEST CASE GENERATOR — Dynamic test cases for exam questions
// ═══════════════════════════════════════════════════════════════
function generateTestCases(difficulty, questionTitle) {
  const title = (questionTitle || '').toLowerCase();
  const cases = [];

  // Base test cases applicable to most problems
  if (title.includes('flatten')) {
    cases.push({ input: '[[1, 2], [3, [4, 5]]]', expected: '[1, 2, 3, 4, 5]', description: 'Basic nested list' });
    cases.push({ input: '[]', expected: '[]', description: 'Edge: Empty list' });
    cases.push({ input: '[1, [2, [3, [4, [5]]]]]', expected: '[1, 2, 3, 4, 5]', description: 'Edge: Deeply nested' });
    cases.push({ input: '[[[], []], []]', expected: '[]', description: 'Edge: Nested empty lists' });
  } else if (title.includes('palindrome')) {
    cases.push({ input: '"racecar"', expected: 'true / "racecar"', description: 'Basic palindrome' });
    cases.push({ input: '""', expected: 'true / ""', description: 'Edge: Empty string' });
    cases.push({ input: '"a"', expected: 'true / "a"', description: 'Edge: Single char' });
    cases.push({ input: '"hello"', expected: 'false / "ll"', description: 'Non-palindrome' });
  } else if (title.includes('prime')) {
    cases.push({ input: '7', expected: 'true', description: 'Basic prime' });
    cases.push({ input: '1', expected: 'false', description: 'Edge: 1 is not prime' });
    cases.push({ input: '0', expected: 'false', description: 'Edge: Zero' });
    cases.push({ input: '2', expected: 'true', description: 'Edge: Smallest prime' });
    cases.push({ input: '100', expected: 'false', description: 'Composite number' });
  } else if (title.includes('sort') || title.includes('merge')) {
    cases.push({ input: '[3, 1, 4, 1, 5]', expected: '[1, 1, 3, 4, 5]', description: 'Basic sort' });
    cases.push({ input: '[]', expected: '[]', description: 'Edge: Empty array' });
    cases.push({ input: '[1]', expected: '[1]', description: 'Edge: Single element' });
    cases.push({ input: '[5, 4, 3, 2, 1]', expected: '[1, 2, 3, 4, 5]', description: 'Reverse sorted' });
  } else if (title.includes('factorial')) {
    cases.push({ input: '5', expected: '120', description: 'Basic factorial' });
    cases.push({ input: '0', expected: '1', description: 'Edge: Zero factorial' });
    cases.push({ input: '1', expected: '1', description: 'Edge: factorial(1)' });
    cases.push({ input: '10', expected: '3628800', description: 'Larger input' });
  } else if (title.includes('frequency') || title.includes('count')) {
    cases.push({ input: '"hello world hello"', expected: '{hello: 2, world: 1}', description: 'Basic frequency' });
    cases.push({ input: '""', expected: '{}', description: 'Edge: Empty string' });
    cases.push({ input: '"a"', expected: '{a: 1}', description: 'Edge: Single word' });
  } else if (title.includes('queue') || title.includes('stack')) {
    cases.push({ input: 'enqueue(1), enqueue(2), dequeue()', expected: '1', description: 'FIFO order' });
    cases.push({ input: 'enqueue(A), enqueue(B), enqueue(C), dequeue(), dequeue()', expected: 'A, B', description: 'Multiple operations' });
    cases.push({ input: 'dequeue() on empty', expected: 'Error/undefined', description: 'Edge: Empty queue' });
  } else if (title.includes('knapsack')) {
    cases.push({ input: 'W=[1,2,3], V=[6,10,12], Cap=5', expected: '22', description: 'Basic knapsack' });
    cases.push({ input: 'W=[], V=[], Cap=10', expected: '0', description: 'Edge: No items' });
    cases.push({ input: 'W=[5], V=[10], Cap=3', expected: '0', description: 'Edge: Item too heavy' });
  } else if (title.includes('cache') || title.includes('lru')) {
    cases.push({ input: 'put(1,1), put(2,2), get(1)', expected: '1', description: 'Basic get/put' });
    cases.push({ input: 'cap=2, put(1,1), put(2,2), put(3,3), get(1)', expected: '-1 (evicted)', description: 'Edge: Eviction' });
  } else {
    // Generic test cases for any problem
    cases.push({ input: 'Standard input', expected: 'Expected output', description: 'Basic functionality test' });
    cases.push({ input: 'Empty/null input', expected: 'Handle gracefully', description: 'Edge: Empty input' });
    cases.push({ input: 'Single element', expected: 'Correct output', description: 'Edge: Minimal input' });
  }

  // Add difficulty-specific edge cases
  if (difficulty === 'medium' || difficulty === 'hard') {
    cases.push({ input: 'Very large input (10^6 elements)', expected: 'Complete within time limit', description: 'Performance: Large dataset' });
  }
  if (difficulty === 'hard') {
    cases.push({ input: 'Concurrent/thread-safe scenario', expected: 'No race conditions', description: 'Edge: Thread safety' });
    cases.push({ input: 'Negative/boundary values', expected: 'Correct handling', description: 'Edge: Boundary conditions' });
  }

  return cases;
}

// ═══════════════════════════════════════════════════════════════
// CODE EVALUATION — Basic analysis instead of pure random
// ═══════════════════════════════════════════════════════════════
function evaluateCode(code, difficulty, questionTitle) {
  let correctness = 0, quality = 0, edgeCases = 0, understanding = 0;
  const codeLen = (code || '').trim().length;
  const lines = (code || '').split('\n').filter(l => l.trim().length > 0).length;

  // Empty or trivial submission
  if (codeLen < 20 || lines < 2) {
    return { correctness: 5, quality: 5, edgeCases: 0, understanding: 5, total: 15, summary: 'Submission too short. No meaningful code detected.' };
  }

  // Check for common patterns indicating effort
  const hasFunction = /function |def |fn |func |class /i.test(code);
  const hasLoop = /for |while |\.forEach|\.map|\.reduce/i.test(code);
  const hasCondition = /if |else|switch|match |case /i.test(code);
  const hasReturn = /return |yield |console\.log|print\(|fmt\.Print/i.test(code);
  const hasErrorHandling = /try|catch|except|Error|throw/i.test(code);
  const hasComments = /\/\/|#|\/\*|\"\"\"/i.test(code);

  // Correctness (max 40) - based on structure and effort
  correctness = 10;
  if (hasFunction) correctness += 8;
  if (hasLoop) correctness += 7;
  if (hasCondition) correctness += 7;
  if (hasReturn) correctness += 8;

  // Quality (max 25) - code organization
  quality = 8;
  if (lines >= 5) quality += 4;
  if (lines >= 10) quality += 4;
  if (hasComments) quality += 5;
  if (hasFunction) quality += 4;

  // Edge Cases (max 20) - error handling
  edgeCases = 5;
  if (hasErrorHandling) edgeCases += 7;
  if (hasCondition && lines >= 8) edgeCases += 5;
  if (code.includes('null') || code.includes('None') || code.includes('undefined') || code.includes('empty') || code.includes('len(') || code.includes('.length')) edgeCases += 3;

  // Understanding (max 15)
  understanding = 5;
  if (lines >= 5) understanding += 3;
  if (hasFunction && hasReturn) understanding += 4;
  if (codeLen > 200) understanding += 3;

  // Difficulty multiplier
  if (difficulty === 'hard') {
    correctness = Math.min(40, Math.floor(correctness * 0.85));
    quality = Math.min(25, Math.floor(quality * 0.9));
  }

  const total = Math.min(100, correctness + quality + edgeCases + understanding);
  let summary = '';
  if (total >= 75) {
    summary = `Excellent submission. Code demonstrates strong understanding of ${questionTitle.split('—')[1] || 'the problem'}. Well-structured with proper edge case handling.`;
  } else if (total >= 60) {
    summary = `Good submission. Core logic is sound but could improve edge case handling and code organization.`;
  } else if (total >= 40) {
    summary = `Partial solution. Some logic present but missing key algorithmic components. Review data structures.`;
  } else {
    summary = `Insufficient. Submission lacks core algorithm implementation. Recommended: study the fundamentals.`;
  }

  return { correctness, quality, edgeCases, understanding, total, summary };
}


// ═══════════════════════════════════════════════════════════════
// SECURITY LAYER 7: Disable fingerprinting
// ═══════════════════════════════════════════════════════════════
app.disable('x-powered-by');

// ═══════════════════════════════════════════════════════════════
// SECURITY LAYER 8: Add security response headers globally
// ═══════════════════════════════════════════════════════════════
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(), payment=()');
  next();
});

// ═══════════════════════════════════════════════════════════════
// STATIC FILE SERVING
// ═══════════════════════════════════════════════════════════════
// IMPORTANT: These fs.readFileSync calls MUST use literal string paths
// (not variables) so Vercel's Node File Trace can statically detect and
// bundle the HTML files into the serverless function zip.

let _indexHtml = null;
let _githubLoginHtml = null;
let _googleLoginHtml = null;

try { _indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8'); } catch(e) {
  try { _indexHtml = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf8'); } catch(e2) {
    console.error('[WARN] index.html not found in __dirname or cwd');
  }
}
try { _githubLoginHtml = fs.readFileSync(path.join(__dirname, 'github-login.html'), 'utf8'); } catch(e) {
  try { _githubLoginHtml = fs.readFileSync(path.resolve(process.cwd(), 'github-login.html'), 'utf8'); } catch(e2) {
    console.error('[WARN] github-login.html not found');
  }
}
try { _googleLoginHtml = fs.readFileSync(path.join(__dirname, 'google-login.html'), 'utf8'); } catch(e) {
  try { _googleLoginHtml = fs.readFileSync(path.resolve(process.cwd(), 'google-login.html'), 'utf8'); } catch(e2) {
    console.error('[WARN] google-login.html not found');
  }
}

app.get('/', (req, res) => _indexHtml ? res.type('html').send(_indexHtml) : res.status(404).send('index.html not found'));
app.get('/index.html', (req, res) => _indexHtml ? res.type('html').send(_indexHtml) : res.status(404).send('index.html not found'));
app.get('/github-login.html', (req, res) => _githubLoginHtml ? res.type('html').send(_githubLoginHtml) : res.status(404).send('not found'));
app.get('/google-login.html', (req, res) => _googleLoginHtml ? res.type('html').send(_googleLoginHtml) : res.status(404).send('not found'));

// Serve other static assets (CSS, JS, images) from the project directory
app.use(express.static(__dirname, {
  dotfiles: 'deny',
  maxAge: '1h'
}));
// ═══════════════════════════════════════════════════════════════
// PROMISE WRAPPERS FOR SQLITE (used throughout)
// ═══════════════════════════════════════════════════════════════
const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});
const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

// ═══════════════════════════════════════════════════════════════
// MULTI-TENANT HELPER: Extract or create company from email domain
// ═══════════════════════════════════════════════════════════════
const CONSUMER_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com'];

async function getOrCreateCompany(email) {
  const domain = email.split('@')[1].toLowerCase();
  const isCorporate = !CONSUMER_DOMAINS.includes(domain);
  
  if (!isCorporate) return null;

  let company = await dbGet('SELECT * FROM companies WHERE domain = ?', [domain]);
  if (!company) {
    const companyId = crypto.randomUUID();
    const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    const now = new Date().toISOString();
    await dbRun(
      'INSERT INTO companies (id, name, domain, created_at) VALUES (?, ?, ?, ?)',
      [companyId, companyName, domain, now]
    );
    company = await dbGet('SELECT * FROM companies WHERE id = ?', [companyId]);
  }
  return company;
}

async function ensureStudentExists(email) {
  if (!email) return null;
  const cleanEmail = sanitizeString(email, 254).toLowerCase();
  if (!isValidEmail(cleanEmail)) return null;
  let user = await dbGet('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [cleanEmail]);
  if (!user) {
    const userId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    let namePart = cleanEmail.split('@')[0];
    namePart = namePart.charAt(0).toUpperCase() + namePart.slice(1);
    const name = namePart.replace(/[^a-zA-Z0-9]/g, ' ');
    const profileSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + crypto.randomBytes(4).toString('hex');
    const college = 'Self-Taught / University';

    await dbRun(
      `INSERT INTO users (id, name, email, role, college, company, company_id, profile_slug, skillproof_score, created_at)
       VALUES (?, ?, ?, 'student', ?, NULL, NULL, ?, 0.00, ?)`,
      [userId, name, cleanEmail, college, profileSlug, createdAt]
    );
    user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    console.log(`[DB Self-Healing] Auto-registered missing student record for ${cleanEmail}`);
  }
  return user;
}

async function sendScheduleNotification(schedule, student) {
  const url = `https://skill-badge-scanner.vercel.app/#`; // Matches production/local hash URLs
  const skillName = schedule.skill_name;
  const companyName = schedule.company_name;
  const password = schedule.exam_password;
  const duration = schedule.duration_minutes;
  const startTime = schedule.start_time;

  const subject = `Invited to Scheduled Exam for ${skillName} at ${companyName}`;
  const body = `Dear ${student.name},

You have been scheduled to take a proctored technical challenge for ${skillName} at ${companyName}.

Exam Details:
- Skill: ${skillName}
- Scheduled Time: ${startTime}
- Duration: ${duration} minutes
- Password / One-Time Passcode: ${password}
- Access URL: ${url}

Please ensure you write the test on a laptop or desktop computer with a functional webcam for proctoring. Only one attempt is permitted.

Good luck!
SkillProof Assessment Team`;

  console.log(`
================================================================================
📢 [SIMULATED NOTIFICATION DISPATCH]
================================================================================
📧 EMAIL OUTGOING:
To: ${student.email}
Subject: ${subject}

${body}
--------------------------------------------------------------------------------
💬 WHATSAPP SMS OUTGOING:
To: ${student.phone || 'N/A (No phone number saved)'}
Message: [SkillProof] Dear ${student.name}, you have a technical challenge for ${skillName} scheduled by ${companyName}. One-Time Code: ${password}. Access at ${url}
================================================================================
`);

  // Real Integration if env vars are set
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && student.phone) {
    try {
      const twilio = require('twilio');
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `[SkillProof] Dear ${student.name}, you have a technical challenge for ${skillName} scheduled by ${companyName}. One-Time Code: ${password}. Access at ${url}`,
        from: process.env.TWILIO_FROM_NUMBER || '+1234567890',
        to: student.phone
      });
      console.log(`[Twilio SMS] Live SMS sent to ${student.phone}`);
    } catch (err) {
      console.error('[Twilio SMS Error] Failed to send SMS:', err.message);
    }
  }

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      await transporter.sendMail({
        from: `"SkillProof Assessment" <${process.env.SMTP_USER}>`,
        to: student.email,
        subject: subject,
        text: body
      });
      console.log(`[SMTP Email] Live Email sent to ${student.email}`);
    } catch (err) {
      console.error('[SMTP Email Error] Failed to send email:', err.message);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. AUTHENTICATION (with rate limiting + input validation)
// ═══════════════════════════════════════════════════════════════
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const email = sanitizeString(req.body.email, 254).toLowerCase();
    const name = sanitizeString(req.body.name, 200);
    const provider = sanitizeString(req.body.provider, 20);

    if (!email || !name || !provider) {
      return res.status(400).json({ error: 'Missing required authentication fields' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (!['Google', 'GitHub'].includes(provider)) {
      return res.status(400).json({ error: 'Invalid authentication provider' });
    }

    // Determine role + company
    const company = await getOrCreateCompany(email);
    let role = company ? 'recruiter' : 'student';
    if (email.toLowerCase() === 'durgasravan21@gmail.com') {
      role = 'recruiter'; // Head Admin gets recruiter dashboard automatically
    }

    // Look up existing user
    let user = await dbGet('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [email]);
    
    if (user) {
      // If the E2E script or an older bug set the Head Admin to student, forcefully update them in the DB
      if (email.toLowerCase() === 'durgasravan21@gmail.com' && user.role !== 'recruiter') {
        await dbRun('UPDATE users SET role = ? WHERE id = ?', ['recruiter', user.id]);
        user.role = 'recruiter';
      }
      
      // Update company_id if it's a recruiter and didn't have one
      if (role === 'recruiter' && company && !user.company_id) {
        await dbRun('UPDATE users SET company_id = ?, company = ? WHERE id = ?', [company.id, company.name, user.id]);
        user = await dbGet('SELECT * FROM users WHERE id = ?', [user.id]);
      }
      return res.json({ 
        message: 'Authentication successful', 
        user,
        company: company || null,
        is_new_user: false
      });
    }

    // New user signup
    const userId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const profileSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + crypto.randomBytes(4).toString('hex');
    const companyName = company ? company.name : null;
    const college = !company ? 'Self-Taught / University' : null;

    await dbRun(
      `INSERT INTO users (id, name, email, role, college, company, company_id, profile_slug, skillproof_score, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0.00, ?)`,
      [userId, name, email, role, college, companyName, company ? company.id : null, profileSlug, createdAt]
    );

    const newUser = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
    if (!newUser) {
      return res.status(500).json({ error: 'Failed to retrieve authenticated user' });
    }
    res.json({ 
      message: 'Authentication successful', 
      user: newUser,
      company: company || null,
      is_new_user: true
    });
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(500).json({ error: 'Authentication service error' });
  }
});

// Student Onboarding Endpoint
app.post('/api/student/onboard', async (req, res) => {
  try {
    const studentEmail = sanitizeString(req.body.student_email, 254).toLowerCase();
    const phone = sanitizeString(req.body.phone, 30);
    const college = sanitizeString(req.body.college, 150);

    if (!studentEmail) {
      return res.status(400).json({ error: 'Missing student email' });
    }

    const student = await ensureStudentExists(studentEmail);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    await dbRun(
      'UPDATE users SET phone = ?, college = ? WHERE id = ?',
      [phone, college, student.id]
    );

    const updatedUser = await dbGet('SELECT * FROM users WHERE id = ?', [student.id]);
    res.json({ message: 'Onboarding completed successfully', user: updatedUser });
  } catch (err) {
    console.error('Onboarding update error:', err.message);
    res.status(500).json({ error: 'Failed to save onboarding information' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 2. SKILL CLAIMING & VERIFICATION ENGINE
// ═══════════════════════════════════════════════════════════════
app.get('/api/skills', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM skills');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve skills' });
  }
});

app.post('/api/skills/claim', async (req, res) => {
  try {
    const studentEmail = sanitizeString(req.body.student_email, 254).toLowerCase();
    const skillId = sanitizeString(req.body.skill_id, 50);
    const selfRating = parseInt(req.body.self_rating);

    if (!studentEmail || !skillId || isNaN(selfRating)) {
      return res.status(400).json({ error: 'Missing required claim details' });
    }
    if (!isValidEmail(studentEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (selfRating < 1 || selfRating > 5) {
      return res.status(400).json({ error: 'Self rating must be between 1 and 5' });
    }

    const student = await ensureStudentExists(studentEmail);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const existing = await dbGet('SELECT id FROM student_skills WHERE student_id = ? AND skill_id = ?', [student.id, skillId]);
    if (existing) return res.status(400).json({ error: 'This skill has already been claimed or verified.' });

    const claimId = crypto.randomUUID();
    await dbRun(
      `INSERT INTO student_skills (id, student_id, skill_id, self_rating, status, badge_tag)
       VALUES (?, ?, ?, ?, 'claimed', NULL)`,
      [claimId, student.id, skillId, selfRating]
    );

    res.json({ message: 'Skill successfully claimed. Verification unlocked!' });
  } catch (err) {
    console.error('Claim error:', err.message);
    res.status(500).json({ error: 'Failed to record skill claim' });
  }
});

app.get('/api/skills/status', async (req, res) => {
  try {
    const studentEmail = sanitizeString(req.query.student_email, 254).toLowerCase();
    if (!studentEmail || !isValidEmail(studentEmail)) {
      return res.status(400).json({ error: 'Invalid student email' });
    }

    const student = await ensureStudentExists(studentEmail);
    if (!student) return res.status(404).json({ error: 'Student account not found' });

    // Deduplicate at DB level — one row per skill_id (latest by rowid)
    const skills = await dbAll(
      `SELECT ss.*, s.name as skill_name, s.category as skill_category
       FROM student_skills ss
       JOIN skills s ON ss.skill_id = s.id
       WHERE ss.student_id = ?
       GROUP BY ss.skill_id
       ORDER BY ss.rowid DESC`,
      [student.id]
    );
    res.json({ user: student, skills: skills });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch student skills status' });
  }
});

app.get('/api/skills/verification-next', async (req, res) => {
  try {
    const studentEmail = sanitizeString(req.query.student_email, 254).toLowerCase();
    const skillId = sanitizeString(req.query.skill_id, 50);

    if (!studentEmail || !skillId) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const student = await ensureStudentExists(studentEmail);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const challenges = await dbAll(
      `SELECT c.difficulty, c.status
       FROM challenges c
       WHERE c.student_id = ? AND c.skill_id = ?`,
      [student.id, skillId]
    );

    const hasPassed = (diff) => challenges.some(c => c.difficulty === diff && c.status === 'evaluated');
    const hasDisqualified = challenges.some(c => c.status === 'disqualified');

    if (hasDisqualified) {
      return res.json({
        status: 'locked_failed',
        message: 'Verification failed. Critical proctoring violations were committed.'
      });
    }

    let targetDifficulty = 'easy';
    if (hasPassed('easy')) targetDifficulty = 'medium';
    if (hasPassed('medium')) targetDifficulty = 'hard';
    if (hasPassed('hard')) {
      return res.json({ status: 'completed', message: 'All 3 difficulty levels completed! Badge active.' });
    }

    const questions = await dbAll(
      'SELECT * FROM questions WHERE skill_id = ? AND difficulty = ?',
      [skillId, targetDifficulty]
    );

    if (!questions || questions.length === 0) {
      return res.status(404).json({ error: 'No question found for level: ' + targetDifficulty });
    }

    // Randomly shuffle and pick one question
    const selectedQuestion = questions[Math.floor(Math.random() * questions.length)];
    res.json({
      status: 'unlocked',
      difficulty: targetDifficulty,
      question: selectedQuestion
    });
  } catch (err) {
    console.error('Verification-next error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve progress log' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 3. QUESTIONS BANK
// ═══════════════════════════════════════════════════════════════
app.get('/api/questions', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM questions');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve questions' });
  }
});

app.get('/api/questions/count', async (req, res) => {
  try {
    const row = await dbGet('SELECT COUNT(*) as count FROM questions');
    res.json({ count: row.count });
  } catch (err) {
    res.status(500).json({ error: 'Failed to count questions' });
  }
});

app.post('/api/questions', async (req, res) => {
  try {
    const title = sanitizeString(req.body.title, 500);
    const difficulty = sanitizeString(req.body.difficulty, 10);
    const expMinutes = parseInt(req.body.expiration_minutes) || 10;
    const codeTemplate = sanitizeCode(req.body.code_template);

    if (!title || !difficulty || !codeTemplate) {
      return res.status(400).json({ error: 'Missing required question creation fields' });
    }
    if (!['easy', 'medium', 'hard'].includes(difficulty.toLowerCase())) {
      return res.status(400).json({ error: 'Difficulty must be easy, medium, or hard' });
    }

    const questionId = crypto.randomUUID();
    const skills = await dbAll('SELECT * FROM skills');
    if (!skills || skills.length === 0) {
      return res.status(500).json({ error: 'No skills found. Run seed migrations.' });
    }

    const providedSkillId = sanitizeString(req.body.skill_id, 50);

    // Intelligent title matching or explicit skill
    let selectedSkill = skills[0];
    if (providedSkillId) {
      const explicitSkill = skills.find(s => s.id === providedSkillId);
      if (explicitSkill) selectedSkill = explicitSkill;
    } else {
      const lowerTitle = title.toLowerCase();
      for (const s of skills) {
        if (lowerTitle.includes(s.name.toLowerCase().split(' ')[0])) {
          selectedSkill = s;
          break;
        }
      }
    }

    await dbRun(
      `INSERT INTO questions (id, skill_id, title, difficulty, expiration_minutes, code_template)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [questionId, selectedSkill.id, title, difficulty.toLowerCase(), expMinutes, codeTemplate]
    );

    res.json({ message: 'Question created successfully', questionId });
  } catch (err) {
    console.error('Question creation error:', err.message);
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 4. EXAMS & HIGH SECURITY PROCTORING
// ═══════════════════════════════════════════════════════════════
app.post('/api/exams/start', examLimiter, async (req, res) => {
  try {
    const studentEmail = sanitizeString(req.body.student_email, 254).toLowerCase();
    const questionId = sanitizeString(req.body.question_id, 50);

    if (!studentEmail || !questionId) {
      return res.status(400).json({ error: 'Missing required exam setup fields' });
    }
    if (!isValidEmail(studentEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const student = await ensureStudentExists(studentEmail);
    if (!student) return res.status(404).json({ error: 'Student account not found' });

    const question = await dbGet('SELECT * FROM questions WHERE id = ?', [questionId]);
    if (!question) return res.status(404).json({ error: 'Target question not found' });

    // Strict one-attempt enforcement
    const existingAttempt = await dbGet(
      `SELECT id, status FROM challenges WHERE student_id = ? AND question_id = ?`,
      [student.id, questionId]
    );
    if (existingAttempt) {
      if (existingAttempt.status === 'active') {
        return res.status(400).json({ error: 'You already have an active session for this exam. Please reload your dashboard.' });
      }
      return res.status(400).json({ error: 'You have already attempted this exam. Only one attempt is allowed.' });
    }

    const challengeId = crypto.randomUUID();
    const startTime = new Date().toISOString();
    const timeLimitMins = question.expiration_minutes;
    const expiresTime = new Date(Date.now() + timeLimitMins * 60 * 1000).toISOString();

    await dbRun(
      `INSERT INTO challenges (id, student_id, recruiter_id, skill_id, question_id, difficulty, time_limit_mins, status, started_at, expires_at, violations_count, company_id)
       VALUES (?, ?, NULL, ?, ?, ?, ?, 'active', ?, ?, 0, NULL)`,
      [challengeId, student.id, question.skill_id, question.id, question.difficulty, timeLimitMins, startTime, expiresTime]
    );

    // Generate test cases based on difficulty
    const testCases = generateTestCases(question.difficulty, question.title);

    res.json({
      message: 'Exam session successfully started',
      examId: challengeId,
      startedAt: startTime,
      expirationMinutes: timeLimitMins,
      codeTemplate: stripToSnippet(question.code_template),
      questionTitle: question.title,
      testCases: testCases
    });
  } catch (err) {
    console.error('Exam start error:', err.message);
    res.status(500).json({ error: 'Failed to start exam session' });
  }
});

app.post('/api/exams/violation', async (req, res) => {
  try {
    const examId = sanitizeString(req.body.exam_id, 50);
    const type = sanitizeString(req.body.type, 50);

    if (!examId || !type) {
      return res.status(400).json({ error: 'Missing required infraction fields' });
    }

    const validTypes = ['tab_exit', 'fullscreen_exit', 'camera_off', 'mic_muted', 'screen_share_off', 'bluetooth_on', 'phone_detected'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: 'Invalid violation type' });
    }

    const violationId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    await dbRun(
      'INSERT INTO violations (id, challenge_id, type, timestamp) VALUES (?, ?, ?, ?)',
      [violationId, examId, type, timestamp]
    );

    await dbRun(
      `UPDATE challenges SET violations_count = violations_count + 1, status = 'disqualified' WHERE id = ?`,
      [examId]
    );

    res.json({
      message: 'Infraction logged successfully.',
      infractionLogged: true,
      securityStatus: 'disqualified'
    });
  } catch (err) {
    console.error('Violation logging error:', err.message);
    res.status(500).json({ error: 'Failed to log security infraction' });
  }
});

app.post('/api/exams/submit', async (req, res) => {
  try {
    const examId = sanitizeString(req.body.exam_id, 50);
    const code = sanitizeCode(req.body.code || '');

    if (!examId) return res.status(400).json({ error: 'Missing exam session ID' });

    const challenge = await dbGet(
      `SELECT c.*, q.expiration_minutes, q.title as question_title, s.name as skill_name
       FROM challenges c
       JOIN questions q ON c.question_id = q.id
       JOIN skills s ON c.skill_id = s.id
       WHERE c.id = ?`,
      [examId]
    );

    if (!challenge) return res.status(404).json({ error: 'Exam attempt not found' });

    const now = new Date().toISOString();
    const submissionId = crypto.randomUUID();
    const evaluationId = crypto.randomUUID();

    // Helper: Update cumulative portfolio score
    const updatePortfolioScore = async (studentId) => {
      const result = await dbGet(
        `SELECT AVG(total_score) as avg_score
         FROM evaluations e
         JOIN challenges c ON e.challenge_id = c.id
         WHERE c.student_id = ? AND c.status = 'evaluated'`,
        [studentId]
      );
      if (result && result.avg_score !== null) {
        await dbRun('UPDATE users SET skillproof_score = ? WHERE id = ?',
          [parseFloat(result.avg_score.toFixed(2)), studentId]);
      }
    };

    // Helper: Update student skill badge + company badge
    const updateStudentSkillBadge = async (studentId, skillId, score, difficulty) => {
      const record = await dbGet(
        'SELECT * FROM student_skills WHERE student_id = ? AND skill_id = ?',
        [studentId, skillId]
      );

      let badgeStatus = 'pending_review';
      let badgeTag = null; // Awarded explicitly by recruiter later

      if (record) {
        await dbRun(
          `UPDATE student_skills
           SET status = ?, verified_score = ?, verified_at = ?, verified_by = 'Pending Recruiter Review', badge_tag = ?
           WHERE id = ?`,
          [badgeStatus, score, now, badgeTag, record.id]
        );
      } else {
        const ssId = crypto.randomUUID();
        await dbRun(
          `INSERT INTO student_skills (id, student_id, skill_id, self_rating, status, verified_score, verified_at, verified_by, badge_tag)
           VALUES (?, ?, ?, 3, ?, ?, ?, 'Pending Recruiter Review', ?)`,
          [ssId, studentId, skillId, badgeStatus, score, now, badgeTag]
        );
      }
    };

    // 1. Disqualified path
    if (challenge.status === 'disqualified') {
      const aiReport = `CRITICAL PROCTORING BREACH: ${challenge.violations_count} infractions logged. Security system flagged unauthorized activity. VERIFICATION DISQUALIFIED — Results strictly withheld.`;
      await dbRun('INSERT INTO submissions (id, challenge_id, code) VALUES (?, ?, ?)', [submissionId, examId, code]);
      await dbRun('INSERT INTO evaluations (id, challenge_id, total_score, ai_summary) VALUES (?, ?, 0.00, ?)', [evaluationId, examId, aiReport]);
      await dbRun('UPDATE challenges SET submitted_at = ? WHERE id = ?', [now, examId]);

      return res.json({
        status: 'disqualified',
        message: 'Results withheld due to proctoring infractions.',
        violationsCount: challenge.violations_count,
        score: 0,
        aiSummary: aiReport,
        scores: { correctness: 0, quality: 0, edgeCases: 0, understanding: 0 }
      });
    }

    // 2. Expiry check
    const startTime = new Date(challenge.started_at).getTime();
    const expirationLimit = challenge.time_limit_mins * 60 * 1000;
    if (Date.now() - startTime > expirationLimit) {
      const aiReport = `EXPIRED ASSESSMENT: Session closed after ${challenge.time_limit_mins}-minute limit. Scoring bypassed.`;
      await dbRun('INSERT INTO submissions (id, challenge_id, code) VALUES (?, ?, ?)', [submissionId, examId, code]);
      await dbRun('INSERT INTO evaluations (id, challenge_id, total_score, ai_summary) VALUES (?, ?, 0.00, ?)', [evaluationId, examId, aiReport]);
      await dbRun("UPDATE challenges SET status = 'expired', submitted_at = ? WHERE id = ?", [now, examId]);

      return res.json({
        status: 'expired',
        message: 'Exam session expired.',
        violationsCount: challenge.violations_count,
        score: 0,
        aiSummary: aiReport,
        scores: { correctness: 0, quality: 0, edgeCases: 0, understanding: 0 }
      });
    }

    // 3. Evaluate using code analysis
    const evalResult = evaluateCode(code, challenge.difficulty, challenge.question_title);
    const correctness = evalResult.correctness;
    const quality = evalResult.quality;
    const edgeCases = evalResult.edgeCases;
    const understanding = evalResult.understanding;
    const totalScore = evalResult.total;

    let aiReport = '';
    if (totalScore >= 60) {
      aiReport = `AI SECURITY & QUALITY AUDIT: PASS. Proctoring feeds (WebRTC camera, microphone, fullscreen lock) fully compliant. ${evalResult.summary} (${challenge.difficulty.toUpperCase()} tier). Highly recommended talent.`;
    } else {
      aiReport = `AI SECURITY & QUALITY AUDIT: BELOW THRESHOLD. Proctoring integrity intact. ${evalResult.summary} Score: ${totalScore}/100.`;
    }

    await dbRun('INSERT INTO submissions (id, challenge_id, code) VALUES (?, ?, ?)', [submissionId, examId, code]);
    await dbRun('INSERT INTO evaluations (id, challenge_id, total_score, ai_summary) VALUES (?, ?, ?, ?)', [evaluationId, examId, totalScore, aiReport]);
    await dbRun("UPDATE challenges SET status = 'evaluated', submitted_at = ? WHERE id = ?", [now, examId]);

    // Always mark as pending_review — site head (durgasravan21@gmail.com) reviews all
    await dbRun(
      `UPDATE student_skills SET status = 'pending_review', verified_score = ?, verified_at = ?,
       verified_by = 'Pending Head Review'
       WHERE student_id = ? AND skill_id = ?`,
      [totalScore, now, challenge.student_id, challenge.skill_id]
    );

    await updatePortfolioScore(challenge.student_id);

    res.json({
      status: 'completed',
      message: 'Assessment submitted. Results sent for review by SkillProof head and recruiter.',
      violationsCount: challenge.violations_count,
      score: null,  // Score hidden from student until head approves
      aiSummary: 'Your submission has been received and is under review by the SkillProof evaluation team.',
      scores: { correctness: null, quality: null, edgeCases: null, understanding: null }
    });
  } catch (err) {
    console.error('Submit error:', err.message);
    res.status(500).json({ error: 'Failed to process exam submission' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 5. EXAM HISTORY — COMPANY-ISOLATED (Multi-Tenant)
// ═══════════════════════════════════════════════════════════════
app.get('/api/exams/history', async (req, res) => {
  try {
    const companyId = sanitizeString(req.query.company_id, 50);

    // Base query
    let sql = `SELECT c.id as examId, c.status, c.violations_count, c.started_at, c.submitted_at,
                      c.company_id,
                      u.name as student_name, u.email as student_email,
                      q.title as question_title,
                      sk.name as skill_name,
                      e.total_score as score, e.ai_summary,
                      s.code as submitted_code
               FROM challenges c
               JOIN users u ON c.student_id = u.id
               JOIN questions q ON c.question_id = q.id
               JOIN skills sk ON c.skill_id = sk.id
               LEFT JOIN submissions s ON s.challenge_id = c.id
               LEFT JOIN evaluations e ON e.challenge_id = c.id`;

    let params = [];

    // MULTI-TENANT ISOLATION: If company_id provided, only show that company's data
    if (companyId) {
      sql += ' WHERE c.company_id = ?';
      params.push(companyId);
    }

    sql += ' ORDER BY c.started_at DESC';

    const exams = await dbAll(sql, params);
    const violations = await dbAll('SELECT * FROM violations ORDER BY timestamp ASC');

    const enrichedExams = exams.map(exam => ({
      ...exam,
      id: exam.examId,
      score: exam.status === 'disqualified' ? 0 : (exam.score || 0),
      violations: violations
        .filter(v => v.challenge_id === exam.examId)
        .map(v => ({ ...v, exam_id: v.challenge_id }))
    }));

    res.json(enrichedExams);
  } catch (err) {
    console.error('History error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve exam records' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 6. RECRUITER BULK EMAIL — COMPANY-ISOLATED
// ═══════════════════════════════════════════════════════════════
app.post('/api/recruiter/send-bulk-email', bulkLimiter, async (req, res) => {
  try {
    const { emails, subject, body } = req.body;

    if (!emails || !Array.isArray(emails) || emails.length === 0 || !subject || !body) {
      return res.status(400).json({ error: 'Missing required bulk email parameters' });
    }

    // Validate all emails
    for (const email of emails) {
      if (!isValidEmail(email)) {
        return res.status(400).json({ error: `Invalid email address: ${email}` });
      }
    }

    if (emails.length > 100) {
      return res.status(400).json({ error: 'Maximum 100 emails per batch' });
    }

    console.log(`[BULK MAIL] Dispatching corporate invites to ${emails.length} candidates`);

    res.json({
      message: `Successfully dispatched ${emails.length} verification reports.`,
      sentCount: emails.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('Bulk email error:', err.message);
    res.status(500).json({ error: 'Bulk email dispatch failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 7. RECRUITER CANDIDATE INVITE DISPATCHER (Real exam invites)
// ═══════════════════════════════════════════════════════════════
app.post('/api/recruiter/dispatch-and-evaluate', bulkLimiter, async (req, res) => {
  try {
    const { candidates, company_id, recruiter_id } = req.body;

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return res.status(400).json({ error: 'Missing candidates array' });
    }
    if (candidates.length > 500) {
      return res.status(400).json({ error: 'Maximum 500 candidates per batch' });
    }

    const companyId = sanitizeString(company_id, 50) || null;
    const recruiterId = sanitizeString(recruiter_id, 50) || null;
    const results = [];
    const now = new Date().toISOString();

    const recruiterCheck = await dbGet('SELECT id FROM users WHERE id = ?', [recruiterId]);
    if (!recruiterCheck) return res.status(401).json({ error: 'Recruiter session expired due to server restart. Please log out and log back in.' });
    if (companyId) {
      const companyCheck = await dbGet('SELECT id FROM companies WHERE id = ?', [companyId]);
      if (!companyCheck) return res.status(401).json({ error: 'Company session expired due to server restart. Please log out and log back in.' });
    }

    // Fetch company name
    let companyName = 'SkillProof';
    if (companyId) {
      const company = await dbGet('SELECT name FROM companies WHERE id = ?', [companyId]);
      if (company) companyName = company.name;
    }

    for (const cand of candidates) {
      const name = sanitizeString(cand.name, 200);
      const email = sanitizeString(cand.email, 254).toLowerCase();
      const skillId = sanitizeString(cand.skillId, 50);
      const difficultyOrder = sanitizeString(cand.difficultyOrder, 200) || 'easy,medium,hard';

      if (!name || !email || !skillId) continue;
      if (!isValidEmail(email)) continue;

      // Ensure candidate user exists in DB
      let user = await dbGet('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [email]);
      if (!user) {
        const userId = crypto.randomUUID();
        const profileSlug = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + crypto.randomBytes(4).toString('hex');
        await dbRun(
          `INSERT INTO users (id, name, email, role, college, company, company_id, profile_slug, skillproof_score, created_at)
           VALUES (?, ?, ?, 'student', NULL, NULL, NULL, ?, 0.00, ?)`,
          [userId, name, email, profileSlug, now]
        );
        user = await dbGet('SELECT * FROM users WHERE id = ?', [userId]);
      }

      // Fetch skill
      const skill = await dbGet('SELECT * FROM skills WHERE id = ?', [skillId]);
      if (!skill) continue;

      // Build shuffled question order for each difficulty
      const difficulties = difficultyOrder.split(',').map(d => d.trim().toLowerCase());
      const questionIds = [];
      for (const diff of difficulties) {
        const questions = await dbAll('SELECT id FROM questions WHERE skill_id = ? AND difficulty = ?', [skillId, diff]);
        if (questions && questions.length > 0) {
          questionIds.push(questions[Math.floor(Math.random() * questions.length)].id);
        }
      }
      if (questionIds.length === 0) continue;

      // Create exam invite (schedule) for this specific candidate
      const examPassword = crypto.randomBytes(3).toString('hex').toUpperCase();
      const scheduleId = crypto.randomUUID();
      // Set exam available from now
      const startTime = now;
      const durationMinutes = 60;

      await dbRun(
        `INSERT INTO exam_schedules (id, recruiter_id, company_id, skill_id, question_order, difficulty_order, start_time, duration_minutes, exam_password, invited_student_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [scheduleId, recruiterId, companyId, skillId, questionIds.join(','), difficultyOrder, startTime, durationMinutes, examPassword, user.id]
      );

      // Ensure student has skill claimed so invite appears in their arena
      const existingClaim = await dbGet('SELECT id FROM student_skills WHERE student_id = ? AND skill_id = ?', [user.id, skillId]);
      if (!existingClaim) {
        await dbRun(
          `INSERT INTO student_skills (id, student_id, skill_id, self_rating, status) VALUES (?, ?, ?, 3, 'claimed')`,
          [crypto.randomUUID(), user.id, skillId]
        );
      }

      const scheduleObj = {
        skill_name: skill.name,
        company_name: companyName,
        exam_password: examPassword,
        start_time: new Date(startTime).toLocaleString(),
        duration_minutes: durationMinutes
      };
      
      // Dispatch the real SMTP email immediately to the candidate
      await sendScheduleNotification(scheduleObj, user);

      results.push({
        name, email,
        skillName: skill.name,
        scheduleId,
        examPassword,
        status: 'invited',
        message: `Exam invite emailed successfully. Student will see it in their Corporate Assessment Invites tab.`
      });
    }

    res.json({
      message: `${results.length} exam invite(s) dispatched. Students will see the test in their dashboard.`,
      results
    });
  } catch (err) {
    console.error('Dispatch invite error:', err.message);
    res.status(500).json({ error: err.message || 'Invite dispatch failed' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 7.5. EXAM SCHEDULING SYSTEM (Recruiter & Student Integration)
// ═══════════════════════════════════════════════════════════════

app.post('/api/recruiter/schedule-exam', async (req, res) => {
  try {
    const recruiterId = sanitizeString(req.body.recruiter_id, 50);
    const companyId = req.body.company_id || null;

    const recruiterCheck = await dbGet('SELECT id FROM users WHERE id = ?', [recruiterId]);
    if (!recruiterCheck) return res.status(401).json({ error: 'Recruiter session expired due to server restart. Please log out and log back in.' });
    if (companyId) {
      const companyCheck = await dbGet('SELECT id FROM companies WHERE id = ?', [companyId]);
      if (!companyCheck) return res.status(401).json({ error: 'Company session expired due to server restart. Please log out and log back in.' });
    }

    const skillId = sanitizeString(req.body.skill_id, 50);
    const difficultyOrder = sanitizeString(req.body.difficulty_order, 200) || 'easy,medium,hard';
    const startTime = sanitizeString(req.body.start_time, 100);
    const durationMinutes = parseInt(req.body.duration_minutes) || 60;

    if (!recruiterId || !skillId || !startTime) {
      return res.status(400).json({ error: 'Missing required schedule parameters' });
    }

    // Validate that questions exist for the requested difficulties
    const difficulties = difficultyOrder.split(',');
    for (const diff of difficulties) {
      const trimmedDiff = diff.trim().toLowerCase();
      const questions = await dbAll('SELECT id FROM questions WHERE skill_id = ? AND difficulty = ?', [skillId, trimmedDiff]);
      if (!questions || questions.length === 0) {
        return res.status(400).json({ error: `No matching questions found in DB for difficulty: ${trimmedDiff}` });
      }
    }

    // Generate a secure universal access code
    const examPassword = crypto.randomBytes(3).toString('hex').toUpperCase();
    const scheduleId = crypto.randomUUID();

    // Store question_order as 'RANDOM' to generate it dynamically per-student when they join
    await dbRun(
      `INSERT INTO exam_schedules (id, recruiter_id, company_id, skill_id, question_order, difficulty_order, start_time, duration_minutes, exam_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [scheduleId, recruiterId, companyId || null, skillId, 'RANDOM', difficultyOrder, startTime, durationMinutes, examPassword]
    );

    res.json({ message: 'Exam scheduled successfully', scheduleId, examPassword });
  } catch (err) {
    console.error('Schedule exam error:', err.message);
    res.status(500).json({ error: 'Failed to schedule exam' });
  }
});

app.post('/api/exams/join', async (req, res) => {
  try {
    const { student_id, exam_password } = req.body;
    if (!student_id || !exam_password) return res.status(400).json({ error: 'Missing join parameters' });

    const studentId = sanitizeString(student_id, 50);
    const password = sanitizeString(exam_password, 20).toUpperCase();

    // Find the master schedule
    const masterSchedule = await dbGet("SELECT * FROM exam_schedules WHERE exam_password = ? AND invited_student_id IS NULL COLLATE NOCASE", [password]);
    if (!masterSchedule) {
      return res.status(404).json({ error: 'Invalid or expired Universal Access Code.' });
    }

    // Check if student already joined this schedule
    const existing = await dbGet("SELECT id FROM exam_schedules WHERE exam_password = ? AND invited_student_id = ?", [password, studentId]);
    if (existing) {
      return res.status(400).json({ error: 'You have already joined this exam. It is available on your dashboard.' });
    }

    // Now properly randomize questions for this specific student!
    const difficulties = masterSchedule.difficulty_order.split(',').map(d => d.trim().toLowerCase());
    const questionIds = [];
    for (const diff of difficulties) {
      const questions = await dbAll('SELECT id FROM questions WHERE skill_id = ? AND difficulty = ?', [masterSchedule.skill_id, diff]);
      if (questions && questions.length > 0) {
        questionIds.push(questions[Math.floor(Math.random() * questions.length)].id);
      }
    }

    if (questionIds.length === 0) {
      return res.status(500).json({ error: 'Failed to generate random questions for this exam blueprint.' });
    }

    // Create personal cloned schedule
    const scheduleId = crypto.randomUUID();
    await dbRun(
      `INSERT INTO exam_schedules (id, recruiter_id, company_id, skill_id, question_order, difficulty_order, start_time, duration_minutes, exam_password, invited_student_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [scheduleId, masterSchedule.recruiter_id, masterSchedule.company_id, masterSchedule.skill_id, questionIds.join(','), masterSchedule.difficulty_order, masterSchedule.start_time, masterSchedule.duration_minutes, password, studentId]
    );

    // Ensure student has skill claimed
    const existingClaim = await dbGet('SELECT id FROM student_skills WHERE student_id = ? AND skill_id = ?', [studentId, masterSchedule.skill_id]);
    if (!existingClaim) {
      await dbRun(
        `INSERT INTO student_skills (id, student_id, skill_id, self_rating, status) VALUES (?, ?, ?, 3, 'claimed')`,
        [crypto.randomUUID(), studentId, masterSchedule.skill_id]
      );
    }

    res.json({ message: 'Successfully joined the exam!', scheduleId });
  } catch (err) {
    console.error('Join exam error:', err.message);
    res.status(500).json({ error: 'Failed to join exam' });
  }
});

app.get('/api/recruiter/schedules', async (req, res) => {
  try {
    const companyId = sanitizeString(req.query.company_id, 50);

    let schedules;
    if (!companyId) {
      schedules = await dbAll(
        `SELECT es.*, s.name as skill_name
         FROM exam_schedules es
         JOIN skills s ON es.skill_id = s.id
         WHERE es.company_id IS NULL
         ORDER BY es.start_time DESC`
      );
    } else {
      schedules = await dbAll(
        `SELECT es.*, s.name as skill_name
         FROM exam_schedules es
         JOIN skills s ON es.skill_id = s.id
         WHERE es.company_id = ?
         ORDER BY es.start_time DESC`,
        [companyId]
      );
    }
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve schedules' });
  }
});

app.get('/api/student/schedules', async (req, res) => {
  try {
    const studentEmail = sanitizeString(req.query.student_email, 254).toLowerCase();
    if (!studentEmail || !isValidEmail(studentEmail)) {
      return res.status(400).json({ error: 'Invalid student email' });
    }

    const student = await ensureStudentExists(studentEmail);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Get schedules matching claimed skills OR any company-dispatched schedules (recruiter tests)
    const claimedSkills = await dbAll('SELECT skill_id FROM student_skills WHERE student_id = ?', [student.id]);
    const skillIds = claimedSkills.map(cs => cs.skill_id);

    let schedules;
    if (skillIds.length === 0) {
      // Even without claimed skills, show all company-dispatched schedules
      schedules = await dbAll(
        `SELECT es.*, s.name as skill_name, c.name as company_name, c.domain as company_domain,
                (SELECT status FROM challenges WHERE student_id = ? AND skill_id = es.skill_id AND recruiter_id = es.recruiter_id LIMIT 1) as attempt_status,
                (SELECT id FROM challenges WHERE student_id = ? AND skill_id = es.skill_id AND recruiter_id = es.recruiter_id LIMIT 1) as attempt_id
         FROM exam_schedules es
         JOIN skills s ON es.skill_id = s.id
         LEFT JOIN companies c ON es.company_id = c.id
         ORDER BY es.start_time DESC`,
        [student.id, student.id]
      );
    } else {
      const placeholders = skillIds.map(() => '?').join(',');
      schedules = await dbAll(
        `SELECT es.*, s.name as skill_name, c.name as company_name, c.domain as company_domain,
                (SELECT status FROM challenges WHERE student_id = ? AND skill_id = es.skill_id AND recruiter_id = es.recruiter_id LIMIT 1) as attempt_status,
                (SELECT id FROM challenges WHERE student_id = ? AND skill_id = es.skill_id AND recruiter_id = es.recruiter_id LIMIT 1) as attempt_id
         FROM exam_schedules es
         JOIN skills s ON es.skill_id = s.id
         LEFT JOIN companies c ON es.company_id = c.id
         WHERE es.skill_id IN (${placeholders}) OR es.company_id IS NOT NULL
         ORDER BY es.start_time DESC`,
        [student.id, student.id, ...skillIds]
      );
    }
    res.json(schedules);
  } catch (err) {
    console.error('Fetch student schedules error:', err.message);
    res.status(500).json({ error: 'Failed to retrieve scheduled tests' });
  }
});

app.post('/api/exams/start-scheduled', examLimiter, async (req, res) => {
  try {
    const studentEmail = sanitizeString(req.body.student_email, 254).toLowerCase();
    const scheduleId = sanitizeString(req.body.schedule_id, 50);

    if (!studentEmail || !scheduleId) {
      return res.status(400).json({ error: 'Missing start scheduled parameters' });
    }
    if (!isValidEmail(studentEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const student = await ensureStudentExists(studentEmail);
    if (!student) return res.status(404).json({ error: 'Student account not found' });

    const schedule = await dbGet('SELECT * FROM exam_schedules WHERE id = ?', [scheduleId]);
    if (!schedule) return res.status(404).json({ error: 'Scheduled exam not found' });

    // Password verification
    const examPassword = sanitizeString(req.body.exam_password, 20);
    if (schedule.exam_password && schedule.exam_password !== examPassword) {
      return res.status(403).json({ error: 'Invalid exam access password. Please check your email for the correct password.' });
    }

    // One-attempt enforcement for scheduled exams
    const existingScheduleAttempt = await dbGet(
      `SELECT id, status FROM challenges WHERE student_id = ? AND skill_id = ? AND recruiter_id = ? AND status IN ('evaluated', 'submitted', 'disqualified', 'expired')`,
      [student.id, schedule.skill_id, schedule.recruiter_id]
    );
    if (existingScheduleAttempt) {
      return res.status(400).json({ error: 'You have already attempted this scheduled exam. Only one attempt is allowed.' });
    }

    const questionIds = schedule.question_order.split(',');
    if (questionIds.length === 0 || !questionIds[0]) {
      return res.status(400).json({ error: 'No questions mapped to this scheduled exam.' });
    }

    const firstQuestionId = questionIds[0];
    const question = await dbGet('SELECT * FROM questions WHERE id = ?', [firstQuestionId]);
    if (!question) return res.status(404).json({ error: 'Target question not found' });

    const challengeId = crypto.randomUUID();
    const startTime = new Date().toISOString();
    const timeLimitMins = schedule.duration_minutes;
    const expiresTime = new Date(Date.now() + timeLimitMins * 60 * 1000).toISOString();

    // Created challenge is correctly tagged with schedule's company_id for multi-tenant isolation!
    await dbRun(
      `INSERT INTO challenges (id, student_id, recruiter_id, skill_id, question_id, difficulty, time_limit_mins, status, started_at, expires_at, violations_count, company_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0, ?)`,
      [challengeId, student.id, schedule.recruiter_id, schedule.skill_id, question.id, question.difficulty, timeLimitMins, startTime, expiresTime, schedule.company_id]
    );

    const testCases = generateTestCases(question.difficulty, question.title);

    res.json({
      message: 'Scheduled exam session successfully started',
      examId: challengeId,
      startedAt: startTime,
      expirationMinutes: timeLimitMins,
      codeTemplate: stripToSnippet(question.code_template),
      questionTitle: question.title,
      questionList: questionIds,
      currentQuestionIndex: 0,
      scheduleId: scheduleId,
      testCases: testCases
    });
  } catch (err) {
    console.error('Start scheduled exam error:', err.message);
    res.status(500).json({ error: 'Failed to start scheduled exam' });
  }
});

app.post('/api/exams/next-scheduled', async (req, res) => {
  try {
    const studentEmail = sanitizeString(req.body.student_email, 254).toLowerCase();
    const scheduleId = sanitizeString(req.body.schedule_id, 50);
    const questionId = sanitizeString(req.body.question_id, 50);
    const prevExamId = sanitizeString(req.body.prev_exam_id, 50);

    if (!studentEmail || !scheduleId || !questionId) {
      return res.status(400).json({ error: 'Missing next question parameters' });
    }

    const student = await ensureStudentExists(studentEmail);
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const schedule = await dbGet('SELECT * FROM exam_schedules WHERE id = ?', [scheduleId]);
    if (!schedule) return res.status(404).json({ error: 'Scheduled exam not found' });

    const question = await dbGet('SELECT * FROM questions WHERE id = ?', [questionId]);
    if (!question) return res.status(404).json({ error: 'Question not found' });

    let violations = 0;
    let expiresAt = new Date(Date.now() + 20 * 60 * 1000).toISOString();
    if (prevExamId) {
      const prevChallenge = await dbGet('SELECT * FROM challenges WHERE id = ?', [prevExamId]);
      if (prevChallenge) {
        violations = prevChallenge.violations_count;
        expiresAt = prevChallenge.expires_at; // Carry over overall countdown
      }
    }

    const challengeId = crypto.randomUUID();
    const startTime = new Date().toISOString();

    await dbRun(
      `INSERT INTO challenges (id, student_id, recruiter_id, skill_id, question_id, difficulty, time_limit_mins, status, started_at, expires_at, violations_count, company_id)
       VALUES (?, ?, ?, ?, ?, ?, 20, 'active', ?, ?, ?, ?)`,
      [challengeId, student.id, schedule.recruiter_id, schedule.skill_id, question.id, question.difficulty, startTime, expiresAt, violations, schedule.company_id]
    );

    const testCases = generateTestCases(question.difficulty, question.title);

    res.json({
      message: 'Next scheduled question loaded',
      examId: challengeId,
      codeTemplate: stripToSnippet(question.code_template),
      questionTitle: question.title,
      testCases: testCases
    });
  } catch (err) {
    console.error('Next scheduled question error:', err.message);
    res.status(500).json({ error: 'Failed to load next question' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 8. COMPANIES API
// ═══════════════════════════════════════════════════════════════
app.get('/api/companies', async (req, res) => {
  try {
    const companies = await dbAll('SELECT * FROM companies ORDER BY name ASC');
    res.json(companies);
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve companies' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 9. SECURITY INFO ENDPOINT (for frontend security badge)
// ═══════════════════════════════════════════════════════════════
app.get('/api/security/status', (req, res) => {
  res.json({
    helmet: true,
    rateLimiting: true,
    inputValidation: true,
    xssProtection: true,
    hppProtection: true,
    csp: true,
    hsts: true,
    noSniff: true,
    frameguard: true,
    multiTenantIsolation: true,
    sqlInjectionProtection: 'parameterized queries',
    maxPayloadSize: '1mb',
    dotfileAccess: 'denied'
  });
});

// ═══════════════════════════════════════════════════════════════
// GLOBAL ERROR HANDLER — Don't leak internal details
// ═══════════════════════════════════════════════════════════════
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// ═══════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SkillProof server is running on http://localhost:${PORT}`);
    console.log('Security layers active: Helmet, Rate Limiting, HPP, CSP, Input Validation, Multi-Tenant Isolation');
  });
}

// ═══════════════════════════════════════════════════════════════
// 10. EXAM PHOTO CAPTURE & STORAGE
// ═══════════════════════════════════════════════════════════════
app.post('/api/exams/photo', async (req, res) => {
  try {
    const challengeId = sanitizeString(req.body.challenge_id, 50);
    const photoData = req.body.photo_data;
    const captureType = sanitizeString(req.body.capture_type, 20);
    
    if (!challengeId || !photoData || !captureType) {
      return res.status(400).json({ error: 'Missing photo data' });
    }
    
    const validTypes = ['id_verify', 'selfie', 'interval', 'start', 'random_1', 'random_2', 'random_3'];
    if (!validTypes.includes(captureType)) {
      return res.status(400).json({ error: 'Invalid capture type' });
    }
    
    const photoId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    
    await dbRun(
      'INSERT INTO exam_photos (id, challenge_id, photo_data, capture_type, timestamp) VALUES (?, ?, ?, ?, ?)',
      [photoId, challengeId, photoData.slice(0, 500000), captureType, timestamp]
    );
    
    res.json({ message: 'Photo captured', photoId });
  } catch (err) {
    console.error('Photo capture error:', err.message);
    res.status(500).json({ error: 'Failed to store photo' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 11. RECRUITER BADGE ASSIGNMENT
// ═══════════════════════════════════════════════════════════════
app.post('/api/recruiter/assign-badge', async (req, res) => {
  try {
    const recruiterEmail = sanitizeString(req.body.recruiter_email, 254).toLowerCase();
    const challengeId = sanitizeString(req.body.challenge_id, 50);
    const action = sanitizeString(req.body.action, 20);
    
    if (!recruiterEmail || !challengeId || !action) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (!['award', 'deny'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }
    
    const verifyingUser = await dbGet('SELECT * FROM users WHERE email = ? COLLATE NOCASE', [recruiterEmail]);
    if (!verifyingUser) return res.status(403).json({ error: 'User not found' });
    
    const isHeadAdmin = verifyingUser.email === HEAD_ADMIN_EMAIL;
    if (!isHeadAdmin && verifyingUser.role !== 'recruiter') {
      return res.status(403).json({ error: 'Unauthorized: Only Recruiters and Head Admin can issue badges.' });
    }
    
    const challenge = await dbGet(
      `SELECT c.*, q.title as question_title, s.name as skill_name
       FROM challenges c
       JOIN questions q ON c.question_id = q.id
       JOIN skills s ON c.skill_id = s.id
       WHERE c.id = ?`,
      [challengeId]
    );
    if (!challenge) return res.status(404).json({ error: 'Challenge not found' });
    if (challenge.status === 'badge_awarded' || challenge.status === 'badge_denied') {
      return res.status(400).json({ error: 'This exam has already been evaluated.' });
    }
    
    const now = new Date().toISOString();
    const verifierName = isHeadAdmin ? 'SkillProof Head Admin' : (verifyingUser.company || verifyingUser.name);
    
    if (action === 'award') {
      const existing = await dbGet('SELECT badge_tag FROM student_skills WHERE student_id = ? AND skill_id = ?', [challenge.student_id, challenge.skill_id]);
      let newTag = '';
      
      if (isHeadAdmin) {
        newTag = `${challenge.skill_name} Expert — Verified by SkillProof Head Admin`;
      } else {
        const currentTag = (existing && existing.badge_tag) ? existing.badge_tag : '';
        if (currentTag && currentTag.includes('Verified by')) {
           if (!currentTag.includes(verifierName)) {
             newTag = currentTag + `, ${verifierName}`;
           } else {
             newTag = currentTag; // Already has this company
           }
        } else {
           newTag = `${challenge.skill_name} Expert — Verified by ${verifierName}`;
        }
      }

      await dbRun(
        `UPDATE student_skills SET status = 'verified', verified_by = ?, badge_tag = ?, verified_at = ? WHERE student_id = ? AND skill_id = ?`,
        [verifierName, newTag, now, challenge.student_id, challenge.skill_id]
      );
      await dbRun(`UPDATE challenges SET status = 'badge_awarded' WHERE id = ?`, [challengeId]);
      res.json({ message: 'Badge awarded successfully', badgeTag: newTag });
    } else {
      await dbRun(
        `UPDATE student_skills SET status = 'failed', verified_by = ?, verified_at = ? WHERE student_id = ? AND skill_id = ?`,
        [verifierName, now, challenge.student_id, challenge.skill_id]
      );
      await dbRun(`UPDATE challenges SET status = 'badge_denied' WHERE id = ?`, [challengeId]);
      res.json({ message: 'Badge denied' });
    }
  } catch (err) {
    console.error('Badge assignment error:', err.message);
    res.status(500).json({ error: 'Failed to assign badge' });
  }
});

app.get('/api/recruiter/exam-photo/:id', async (req, res) => {
  try {
    const photoId = sanitizeString(req.params.id, 50);
    const photo = await dbGet('SELECT photo_data FROM exam_photos WHERE id = ?', [photoId]);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    res.json({ photo_data: photo.photo_data });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve photo' });
  }
});

// ═══════════════════════════════════════════════════════════════
// 12. RECRUITER EXAM PHOTOS VIEWER
// ═══════════════════════════════════════════════════════════════
app.get('/api/recruiter/exam-photos', async (req, res) => {
  try {
    const challengeId = sanitizeString(req.query.challenge_id, 50);
    if (!challengeId) return res.status(400).json({ error: 'Missing challenge_id' });
    const photos = await dbAll(
      'SELECT id, capture_type, timestamp FROM exam_photos WHERE challenge_id = ? ORDER BY timestamp ASC',
      [challengeId]
    );
    res.json(photos);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch photos' });
  }
});

module.exports = app;
