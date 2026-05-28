/**
 * database.js  –  SkillProof SQLite layer
 *
 * RULES:
 *  • When `require`d by server.js  →  exports an open `db` handle (no side effects)
 *  • When run directly `node database.js`  →  runs the full schema + seed + question generation
 */

'use strict';

const sqlite3 = require('sqlite3').verbose();
const crypto  = require('crypto');
const path    = require('path');
const fs      = require('fs');
const dbSync  = require('./dbSync');

let DB_PATH = dbSync.DB_PATH;

// Ensure pre-seeded DB is copied to /tmp on Vercel at cold start if not pulled yet
if (process.env.VERCEL && !fs.existsSync(DB_PATH)) {
  try {
    let srcPath = path.join(__dirname, 'app.db');
    if (!fs.existsSync(srcPath) && fs.existsSync(path.join(process.cwd(), 'app.db'))) {
      srcPath = path.join(process.cwd(), 'app.db');
    }
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, DB_PATH);
      console.log('[DB Startup] Copied seed SQLite database to /tmp path.');
    }
  } catch (err) {
    console.error('[DB Startup] Failed to copy seed SQLite file to /tmp:', err.message);
  }
}

// Open active database instance
let activeDb = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  }
});

// Configure database for maximum performance and concurrency
// WAL (Write-Ahead Logging) enables concurrent readers + one writer
// This is the single biggest throughput improvement for SQLite at scale
activeDb.serialize(() => {
  // WAL mode: enables concurrent reads while writes happen — critical for 20k users
  // Safe on both Vercel serverless and traditional Node servers
  activeDb.run('PRAGMA journal_mode = WAL;');

  // Enforce FK constraints
  activeDb.run('PRAGMA foreign_keys = ON;');

  // synchronous=NORMAL: safe (no data loss on crash), much faster than FULL
  // FULL flushes to disk on every write — unnecessary for our workload
  activeDb.run('PRAGMA synchronous = NORMAL;');

  // 32MB page cache in memory — reduces disk I/O for hot tables (challenges, evaluations)
  activeDb.run('PRAGMA cache_size = -32000;');

  // Store temp tables in memory — speeds up sorts and aggregates
  activeDb.run('PRAGMA temp_store = MEMORY;');

  // 256MB memory-mapped I/O — OS maps the DB file directly, avoiding syscall overhead
  activeDb.run('PRAGMA mmap_size = 268435456;');

  // Larger page size for better I/O efficiency on modern SSDs
  // Note: only effective on new databases, ignored if DB already exists
  activeDb.run('PRAGMA page_size = 4096;');

  // 30-second busy timeout: if a write lock is taken, wait up to 30s before SQLITE_BUSY
  // Prevents transient errors during concurrent write bursts
  activeDb.run('PRAGMA busy_timeout = 30000;');
});


// Transparent proxy wrapper delegating calls to the currently active sqlite3 connection
const db = {
  get: (sql, params, cb) => activeDb.get(sql, params, cb),
  run: (sql, params, cb) => activeDb.run(sql, params, cb),
  all: (sql, params, cb) => activeDb.all(sql, params, cb),
  each: (sql, params, callback, complete) => activeDb.each(sql, params, callback, complete),
  exec: (sql, cb) => activeDb.exec(sql, cb),
  prepare: (sql, params, cb) => activeDb.prepare(sql, params, cb),
  serialize: (fn) => activeDb.serialize(fn),
  parallelize: (fn) => activeDb.parallelize(fn),
  close: (cb) => activeDb.close(cb),
  
  // Custom helper to reopen the sqlite3 connection when the database file is synced from Supabase
  reopen: () => {
    return new Promise((resolve, reject) => {
      console.log('[DB Sync] Closing active database connection to swap file...');
      activeDb.close((err) => {
        if (err) {
          console.error('[DB Sync] Error closing database connection during reopen:', err.message);
        }
        activeDb = new sqlite3.Database(DB_PATH, (err2) => {
          if (err2) {
            console.error('[DB Sync] Failed to reopen database connection:', err2.message);
            reject(err2);
          } else {
            console.log('[DB Sync] Database connection successfully swapped to fresh file.');
            activeDb.serialize(() => {
              activeDb.run('PRAGMA journal_mode = WAL;');
              activeDb.run('PRAGMA foreign_keys = ON;');
              activeDb.run('PRAGMA synchronous = NORMAL;');
              activeDb.run('PRAGMA cache_size = -32000;');
              activeDb.run('PRAGMA temp_store = MEMORY;');
              activeDb.run('PRAGMA mmap_size = 268435456;');
              activeDb.run('PRAGMA busy_timeout = 30000;');
              // Auto-ensure schema tables exist on every file sync reopen
              createSchema()
                .then(() => resolve())
                .catch(err => {
                  console.error('[DB Sync reopen] Auto-schema error:', err.message);
                  resolve(); // Resolve anyway so database flow is not blocked
                });
            });
          }
        });
      });
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Promise helpers
// ─────────────────────────────────────────────────────────────────────────────
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}
function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}
function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. CREATE SCHEMA
//    Order matters for FK: companies → users → skills → …
// ─────────────────────────────────────────────────────────────────────────────
async function createSchema() {
  // companies must exist before users (FK)
  await runAsync(`CREATE TABLE IF NOT EXISTS companies (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    domain     TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS users (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    email            TEXT UNIQUE NOT NULL COLLATE NOCASE,
        role             TEXT NOT NULL,
    college          TEXT,
    company          TEXT,
    company_id       TEXT,
    profile_slug     TEXT,
    skillproof_score REAL DEFAULT 0.0,
    phone            TEXT,
    dream_role       TEXT,
    created_at       TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );`);

  try {
    await runAsync(`ALTER TABLE users ADD COLUMN phone TEXT;`);
  } catch (err) {
    // Column already exists, safe to ignore
  }

  try {
    await runAsync(`ALTER TABLE users ADD COLUMN github_profile TEXT;`);
  } catch (err) {}

  try {
    await runAsync(`ALTER TABLE users ADD COLUMN linkedin_profile TEXT;`);
  } catch (err) {}

  try {
    await runAsync(`ALTER TABLE users ADD COLUMN dream_role TEXT;`);
  } catch (err) {}

  await runAsync(`CREATE TABLE IF NOT EXISTS skills (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    category TEXT NOT NULL
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS student_skills (
    id             TEXT PRIMARY KEY,
    student_id     TEXT NOT NULL,
    skill_id       TEXT NOT NULL,
    self_rating    INTEGER,
    status         TEXT,
    verified_score REAL,
    verified_at    TEXT,
    verified_by    TEXT,
    badge_tag      TEXT,
    extra_attempts INTEGER DEFAULT 0,
    FOREIGN KEY (student_id) REFERENCES users(id),
    FOREIGN KEY (skill_id)   REFERENCES skills(id)
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS questions (
    id                  TEXT PRIMARY KEY,
    skill_id            TEXT NOT NULL,
    title               TEXT NOT NULL,
    difficulty          TEXT NOT NULL,
    expiration_minutes  INTEGER NOT NULL,
    code_template       TEXT NOT NULL,
    FOREIGN KEY (skill_id) REFERENCES skills(id)
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS challenges (
    id               TEXT PRIMARY KEY,
    student_id       TEXT NOT NULL,
    recruiter_id     TEXT,
    skill_id         TEXT NOT NULL,
    question_id      TEXT NOT NULL,
    difficulty       TEXT NOT NULL,
    time_limit_mins  INTEGER NOT NULL,
    status           TEXT NOT NULL,
    started_at       TEXT,
    submitted_at     TEXT,
    expires_at       TEXT,
    violations_count INTEGER DEFAULT 0,
    company_id       TEXT,
    ip_address       TEXT,
    device_signature TEXT,
    device_flagged   INTEGER DEFAULT 0,
    joins_count      INTEGER DEFAULT 1,
    max_joins        INTEGER DEFAULT 4,
    schedule_id      TEXT,
    FOREIGN KEY (student_id)  REFERENCES users(id),
    FOREIGN KEY (skill_id)    REFERENCES skills(id),
    FOREIGN KEY (question_id) REFERENCES questions(id),
    FOREIGN KEY (company_id)  REFERENCES companies(id)
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS submissions (
    id           TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL,
    code         TEXT NOT NULL,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS evaluations (
    id           TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL,
    total_score  INTEGER,
    ai_summary   TEXT,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS violations (
    id           TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL,
    type         TEXT NOT NULL,
    timestamp    TEXT NOT NULL,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS exam_schedules (
    id               TEXT PRIMARY KEY,
    recruiter_id     TEXT NOT NULL,
    company_id       TEXT,
    skill_id         TEXT NOT NULL,
    question_order   TEXT NOT NULL,
    difficulty_order TEXT NOT NULL,
    start_time       TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    exam_password TEXT,
    invited_student_id TEXT,
    FOREIGN KEY (recruiter_id) REFERENCES users(id),
    FOREIGN KEY (company_id)   REFERENCES companies(id),
    FOREIGN KEY (skill_id)     REFERENCES skills(id)
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS exam_photos (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL,
    photo_data TEXT NOT NULL,
    capture_type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
  );`);

  await runAsync(`CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    recipient_id TEXT NOT NULL,
    sender_id TEXT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (recipient_id) REFERENCES users(id)
  );`);

  // OTP sessions for recruiter 2FA email verification
  await runAsync(`CREATE TABLE IF NOT EXISTS otp_sessions (
    id          TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    email       TEXT NOT NULL,
    otp_hash    TEXT NOT NULL,
    attempts    INTEGER DEFAULT 0,
    expires_at  TEXT NOT NULL,
    verified    INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );`);

  // Live challenge rooms for Socket.io real-time sync
  await runAsync(`CREATE TABLE IF NOT EXISTS challenge_rooms (
    id           TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL,
    recruiter_id TEXT,
    student_id   TEXT NOT NULL,
    room_code    TEXT UNIQUE NOT NULL,
    status       TEXT DEFAULT 'waiting',
    created_at   TEXT NOT NULL,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id)
  );`);


  // User Sessions for secure stateful authentication
  await runAsync(`CREATE TABLE IF NOT EXISTS user_sessions (
    token       TEXT PRIMARY KEY,
    user_id     TEXT NOT NULL,
    email       TEXT NOT NULL,
    role        TEXT NOT NULL,
    expires_at  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );`);

  // Migrate existing tables
  try {
    await runAsync('ALTER TABLE exam_schedules ADD COLUMN exam_password TEXT;');
  } catch (err) {
    // Ignore if column already exists
  }
  try {
    await runAsync('ALTER TABLE exam_schedules ADD COLUMN invited_student_id TEXT;');
  } catch (err) {
    // Ignore if column already exists
  }
  try {
    await runAsync('ALTER TABLE challenges ADD COLUMN ip_address TEXT;');
  } catch (err) {
    // Ignore if column already exists
  }
  try {
    await runAsync('ALTER TABLE challenges ADD COLUMN device_signature TEXT;');
  } catch (err) {
    // Ignore if column already exists
  }
  try {
    await runAsync('ALTER TABLE challenges ADD COLUMN device_flagged INTEGER DEFAULT 0;');
  } catch (err) {
    // Ignore if column already exists
  }
  try {
    await runAsync('ALTER TABLE student_skills ADD COLUMN extra_attempts INTEGER DEFAULT 0;');
  } catch (err) {
    // Ignore if column already exists
  }
  try {
    await runAsync('ALTER TABLE challenges ADD COLUMN joins_count INTEGER DEFAULT 1;');
  } catch (err) {
    // Ignore if column already exists
  }
  try {
    await runAsync('ALTER TABLE challenges ADD COLUMN max_joins INTEGER DEFAULT 4;');
  } catch (err) {
    // Ignore if column already exists
  }
  try {
    await runAsync('ALTER TABLE challenges ADD COLUMN schedule_id TEXT;');
  } catch (err) {
    // Ignore if column already exists
  }
  try {
    await runAsync('UPDATE challenges SET max_joins = 4 WHERE max_joins = 3;');
  } catch (err) {
    // Ignore
  }

  // Indexes for multi-tenant isolation performance
  await runAsync('CREATE INDEX IF NOT EXISTS idx_challenges_company ON challenges(company_id);');
  await runAsync('CREATE INDEX IF NOT EXISTS idx_challenges_student ON challenges(student_id);');
  await runAsync('CREATE INDEX IF NOT EXISTS idx_exam_schedules_invited ON exam_schedules(invited_student_id);');
  await runAsync('CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);');
  await runAsync('CREATE INDEX IF NOT EXISTS idx_questions_skill    ON questions(skill_id, difficulty);');
  await runAsync('CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);');

  console.log('[DB] Schema ready.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SEED MASTER SKILLS
// ─────────────────────────────────────────────────────────────────────────────
const MASTER_SKILLS = [
  { name: 'Python Programming',  category: 'Software Engineering' },
  { name: 'C Systems Programming', category: 'Systems Engineering' },
  { name: 'SQL Database Design', category: 'Data Systems' },
  { name: 'JavaScript',          category: 'Web Development' },
  { name: 'TypeScript',          category: 'Web Development' },
  { name: 'Go',                  category: 'Software Engineering' },
  { name: 'Rust',                category: 'Systems Engineering' },
  { name: 'C++',                 category: 'Systems Engineering' },
  { name: 'Docker',              category: 'DevOps' },
  { name: 'Kubernetes',          category: 'DevOps' },
  { name: 'AWS',                 category: 'Cloud Computing' },
  { name: 'React',               category: 'Web Development' },
  { name: 'Node.js',             category: 'Web Development' },
  { name: 'HTML5 & CSS3',        category: 'Web Development' },
  { name: 'Java Programming',    category: 'Software Engineering' }
];

async function seedSkills() {
  for (const s of MASTER_SKILLS) {
    const existing = await getAsync('SELECT id FROM skills WHERE name = ?', [s.name]);
    if (!existing) {
      await runAsync('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)', [crypto.randomUUID(), s.name, s.category]);
      console.log(`[DB] Seeded skill: ${s.name}`);
    }
  }
  console.log('[DB] Skills seeded or verified.');
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. STORY-TELLING QUESTION BANK  (~4 200 questions)
// ─────────────────────────────────────────────────────────────────────────────
const SCENARIOS = [
  'You are a backend engineer at FinTech Corp processing 10K transactions per second.',
  'Your team at HealthPlus needs to migrate patient records to a HIPAA-compliant database.',
  'A social media startup with 50M daily active users is scaling its feed algorithm.',
  'The e-commerce platform ShopSphere needs real-time inventory sync across warehouses.',
  'A gaming studio is implementing a low-latency matchmaking service for 1M concurrent players.',
  'Logistics Inc. wants to optimize route planning for a fleet of autonomous trucks.',
  'EduNext is building an adaptive learning engine for K-12 students.',
  'IoT Solutions requires secure firmware updates for millions of edge devices.',
  'CyberGuard is constructing a threat-intelligence pipeline for zero-day detection.',
  'AI Lab is training a transformer model on petabytes of text data.',
  'MediaStream needs to deliver 4K video with adaptive bitrate to a global audience.',
  'AutonomeX is creating a sensor-fusion system for self-driving cars.',
  'AeroSpaceCo is simulating orbital dynamics for satellite constellations.',
  'AgriTech wants to monitor crop health using drone imagery and ML.',
  'FinSecure must implement multi-factor authentication across legacy services.',
  'HospitalNet is integrating real-time patient vitals into an EMR system.',
  'RetailChain wants to personalize promotions using click-stream analysis.',
  'SmartHome Corp is building a unified voice-assistant across devices.',
  'EnergyGrid is balancing load in a micro-grid with renewable sources.',
  'LegalTech needs to redact sensitive information from massive document archives.',
  'CloudBank is migrating a monolith to microservices for 99.99% uptime.',
  'StartupX needs a CI/CD pipeline that deploys 50 times a day safely.',
  'GovTech is building a public API serving 200M citizens with SLA guarantees.',
  'BioInformatics Corp is processing genome sequences with parallel algorithms.',
  'SpaceLaunch needs telemetry data streaming from rockets in real time.',
  'UrbanPlanning AI uses graph algorithms for city traffic optimization.',
  'BlockChainPay processes decentralized transactions needing audit trails.',
  'InsureTech calculates actuarial risk scores from streaming sensor data.',
  'NewsAI ranks 1M articles/day based on real-time user engagement signals.',
  'TravelBot coordinates flight, hotel and itinerary APIs for travelers.'
];

// Detailed problem templates per language × difficulty
const PROBLEMS = {
  Python: {
    easy: [
      { s: 'implement a function that parses a CSV and sums a numeric column',
        c: 'import csv\ndef sum_column(filepath, col):\n    # TODO: Write your CSV processing logic here\n    pass\n' },
      { s: 'write a function to reverse a string without using slice syntax',
        c: 'def reverse_str(s):\n    # TODO: Reverse the string without using slice syntax\n    pass\n' },
      { s: 'compute the factorial of n using recursion',
        c: 'def factorial(n):\n    # TODO: Compute factorial of n recursively\n    pass\n' },
      { s: 'check if a given integer is a prime number',
        c: 'def is_prime(n):\n    # TODO: Check if integer n is a prime number\n    pass\n' },
      { s: 'merge two sorted lists into a single sorted list',
        c: 'def merge_sorted(a, b):\n    # TODO: Merge two sorted lists a and b into one sorted list\n    pass\n' },
      { s: 'flatten a nested list of arbitrary depth',
        c: 'def flatten(lst):\n    # TODO: Flatten nested list lst of arbitrary depth\n    pass\n' },
      { s: 'count the frequency of each word in a string',
        c: 'from collections import Counter\ndef word_freq(text):\n    # TODO: Count frequency of each word in text\n    pass\n' },
    ],
    medium: [
      { s: 'implement a queue using two stacks',
        c: 'class Queue:\n    def __init__(self):\n        # TODO: Initialize your stacks here\n        pass\n    def enqueue(self, x):\n        # TODO: Enqueue x\n        pass\n    def dequeue(self):\n        # TODO: Dequeue and return front element\n        pass\n' },
      { s: 'find the longest palindrome substring in a string',
        c: 'def longest_palindrome(s):\n    # TODO: Find the longest palindrome substring in s\n    pass\n' },
      { s: 'solve the 0/1 knapsack problem with dynamic programming',
        c: 'def knapsack(weights, values, cap):\n    # TODO: Solve the 0/1 knapsack problem with dynamic programming\n    pass\n' },
      { s: 'implement a basic LRU cache with O(1) operations',
        c: 'from collections import OrderedDict\nclass LRUCache:\n    def __init__(self, cap):\n        # TODO: Initialize LRU cache with capacity cap\n        pass\n    def get(self, key):\n        # TODO: Get the value of the key\n        pass\n    def put(self, key, val):\n        # TODO: Put or update the value of the key\n        pass\n' },
      { s: 'implement BFS on a graph given as an adjacency list',
        c: 'from collections import deque\ndef bfs(graph, start):\n    # TODO: Implement BFS on a graph given as an adjacency list\n    pass\n' },
      { s: 'detect if a linked list has a cycle using Floyd\'s algorithm',
        c: 'def has_cycle(head):\n    # TODO: Detect if a linked list has a cycle using Floyd\'s algorithm\n    pass\n' },
      { s: 'implement merge sort on a list',
        c: 'def merge_sort(arr):\n    # TODO: Implement merge sort on the list arr\n    pass\n' },
    ],
    hard: [
      { s: 'design a thread-safe priority queue using heapq and threading.Lock',
        c: 'import heapq, threading\nclass SafePQ:\n    def __init__(self):\n        # TODO: Initialize thread-safe priority queue\n        pass\n    def push(self, item):\n        # TODO: Push item safely\n        pass\n    def pop(self):\n        # TODO: Pop item safely\n        pass\n' },
      { s: 'implement a rate-limiter using the token bucket algorithm',
        c: 'import time, threading\nclass TokenBucket:\n    def __init__(self, rate, cap):\n        # TODO: Initialize token bucket\n        pass\n    def consume(self, n=1):\n        # TODO: Consume n tokens and return True/False\n        pass\n' },
      { s: 'build a miniature ORM that maps a Python class to a SQLite table',
        c: 'import sqlite3\nclass Model:\n    TABLE=""\n    FIELDS=[]\n    @classmethod\n    def create_table(cls, conn):\n        # TODO: Build table using cls.TABLE and cls.FIELDS\n        pass\n    def save(self, conn):\n        # TODO: Save this instance to database\n        pass\n' },
      { s: 'implement Dijkstra\'s algorithm for shortest paths',
        c: 'import heapq\ndef dijkstra(graph, src):\n    # TODO: Implement Dijkstra\'s algorithm for shortest paths\n    pass\n' },
      { s: 'implement a consistent-hashing ring for distributed caching',
        c: 'import hashlib, bisect\nclass ConsistentHash:\n    def __init__(self, nodes, replicas=100):\n        # TODO: Initialize consistent-hashing ring\n        pass\n    def add(self, node):\n        # TODO: Add a node to the ring\n        pass\n    def get(self, key):\n        # TODO: Get the node for the given key\n        pass\n' },
      { s: 'design a circuit-breaker pattern for HTTP clients',
        c: 'import time\nclass CircuitBreaker:\n    def __init__(self, threshold=5, timeout=30):\n        # TODO: Initialize circuit breaker\n        pass\n    def call(self, fn, *args, **kwargs):\n        # TODO: Implement the circuit breaker call logic\n        pass\n' },
    ]
  },
  JavaScript: {
    easy: [
      { s: 'write a function to check if a string is a palindrome',
        c: 'function isPalindrome(str) {\n  // TODO: Check if the string is a palindrome\n}\n' },
      { s: 'implement a debounce utility function',
        c: 'function debounce(fn, delay) {\n  // TODO: Implement a debounce utility function\n}\n' },
      { s: 'flatten a nested array using recursion',
        c: 'function flatten(arr) {\n  // TODO: Flatten a nested array using recursion\n}\n' },
      { s: 'implement deep clone for a plain object',
        c: 'function deepClone(obj) {\n  // TODO: Implement deep clone for a plain object\n}\n' },
      { s: 'group an array of objects by a given key',
        c: 'function groupBy(arr, key) {\n  // TODO: Group an array of objects by a given key\n}\n' },
    ],
    medium: [
      { s: 'implement a publish-subscribe event system',
        c: 'class EventEmitter {\n  constructor() {\n    // TODO: Initialize events store\n  }\n  on(evt, fn) {\n    // TODO: Register subscriber\n  }\n  off(evt, fn) {\n    // TODO: Remove subscriber\n  }\n  emit(evt, ...args) {\n    // TODO: Trigger events\n  }\n}\n' },
      { s: 'implement a Promise.all polyfill from scratch',
        c: 'function promiseAll(promises) {\n  // TODO: Implement a Promise.all polyfill from scratch\n}\n' },
      { s: 'build a simple Observable/Observer pattern',
        c: 'class Observable {\n  constructor(fn) {\n    // TODO: Initialize\n  }\n  subscribe(observer) {\n    // TODO: Subscribe\n  }\n  static of(...values) {\n    // TODO: Create observable of values\n  }\n}\n' },
      { s: 'implement a memoize function with a Map cache',
        c: 'function memoize(fn) {\n  // TODO: Implement a memoize function with a Map cache\n}\n' },
      { s: 'create a linked list with insert, delete, and search',
        c: 'class Node { constructor(v) { this.val=v; this.next=null; } }\nclass LinkedList {\n  constructor() {\n    // TODO: Initialize linked list\n  }\n  insert(v) {\n    // TODO: Insert a value into list\n  }\n  search(v) {\n    // TODO: Search for a value in list\n  }\n}\n' },
    ],
    hard: [
      { s: 'implement a virtual DOM diff algorithm',
        c: '// Simplified vDOM diff\nfunction diff(oldNode, newNode) {\n  // TODO: Implement a virtual DOM diff algorithm\n}\nfunction diffProps(o={}, n={}) {\n  // TODO: Diff properties\n}\nfunction diffChildren(o=[], n=[]) {\n  // TODO: Diff children\n}\n' },
      { s: 'build a retry-with-exponential-backoff utility',
        c: 'async function retryWithBackoff(fn, retries=3, baseDelay=100) {\n  // TODO: Build a retry-with-exponential-backoff utility\n}\n' },
      { s: 'implement a lazy evaluation system using generators',
        c: 'function* lazyMap(iter, fn) {\n  // TODO: Map lazy generator\n}\nfunction* lazyFilter(iter, pred) {\n  // TODO: Filter lazy generator\n}\nfunction* lazyTake(iter, n) {\n  // TODO: Take n items lazy generator\n}\nfunction collect(iter) {\n  // TODO: Collect items\n}\n' },
    ]
  },
  SQL: {
    easy: [
      { s: 'write a query to find all active users sorted by registration date',
        c: '-- Write your SQL query below to find active users sorted by registration date\nSELECT \n' },
      { s: 'count the number of orders per customer',
        c: '-- Write your SQL query below to count the number of orders per customer\nSELECT \n' },
      { s: 'find the top 5 products by revenue',
        c: '-- Write your SQL query below to find the top 5 products by revenue\nSELECT \n' },
      { s: 'retrieve employees who earn more than their department average',
        c: '-- Write your SQL query below to retrieve employees who earn more than average\nSELECT \n' },
      { s: 'find duplicate email addresses in the users table',
        c: '-- Write your SQL query below to find duplicate email addresses\nSELECT \n' },
    ],
    medium: [
      { s: 'design a schema for a multi-tenant SaaS with row-level security',
        c: '-- Design a schema for a multi-tenant SaaS with row-level security\n-- Write your SQL schema, table definitions, and RLS policies below\n' },
      { s: 'write a recursive CTE to traverse an employee hierarchy',
        c: '-- Write your recursive CTE query below to traverse employee manager hierarchy\nWITH RECURSIVE \n' },
      { s: 'implement a sliding-window query to compute a 7-day rolling average',
        c: '-- Write your SQL query below to compute a 7-day rolling average\nSELECT \n' },
      { s: 'create a materialized view that refreshes on a schedule',
        c: '-- Write your SQL statement below to create a materialized view monthly_revenue\nCREATE \n' },
    ],
    hard: [
      { s: 'design an event-sourcing database schema and write a projection query',
        c: '-- Design an event-sourcing database schema and write a projection query\n-- Write your SQL table structure and balance aggregate queries below\n' },
      { s: 'implement optimistic locking with version columns to prevent lost updates',
        c: '-- Implement optimistic locking with version columns to prevent lost updates\n-- Write your SQL update and verification statements below\n' },
    ]
  },
  Java: {
    easy: [
      { s: 'write a Java method to reverse a String without using StringBuilder.reverse()',
        c: 'public class Solution {\n    public static String reverseString(String s) {\n        // TODO: Write your solution here\n        return s;\n    }\n}\n' },
      { s: 'implement a Java method to check whether a given integer is a prime number',
        c: 'public class Solution {\n    public static boolean isPrime(int n) {\n        // TODO: Write your solution here\n        return false;\n    }\n}\n' },
      { s: 'write a Java method that finds and returns the maximum value in an integer array',
        c: 'public class Solution {\n    public static int findMax(int[] arr) {\n        // TODO: Write your solution here\n        return 0;\n    }\n}\n' }
    ],
    medium: [
      { s: 'implement a generic Stack<T> class in Java using a singly linked list',
        c: 'public class Stack<T> {\n    private static class Node<T> {\n        T data;\n        Node<T> next;\n        Node(T data) { this.data = data; }\n    }\n    private Node<T> top;\n    public void push(T item) {\n        // TODO: Implement push\n    }\n    public T pop() {\n        // TODO: Implement pop\n        return null;\n    }\n    public T peek() {\n        // TODO: Implement peek\n        return null;\n    }\n    public boolean isEmpty() {\n        // TODO: Implement isEmpty\n        return true;\n    }\n}\n' },
      { s: 'implement insert and search operations for a Binary Search Tree (BST) in Java',
        c: 'public class BST {\n    static class Node {\n        int val;\n        Node left, right;\n        Node(int val) { this.val = val; }\n    }\n    private Node root;\n    public void insert(int val) {\n        // TODO: Implement insert\n    }\n    public boolean search(int val) {\n        // TODO: Implement search\n        return false;\n    }\n}\n' },
      { s: 'implement the classic thread-safe Producer-Consumer pattern in Java',
        c: 'import java.util.LinkedList;\npublic class ProducerConsumer {\n    private final LinkedList<Integer> queue = new LinkedList<>();\n    private final int CAPACITY = 5;\n    public synchronized void produce(int item) throws InterruptedException {\n        // TODO: Implement produce\n    }\n    public synchronized int consume() throws InterruptedException {\n        // TODO: Implement consume\n        return -1;\n    }\n}\n' }
    ],
    hard: [
      { s: 'design and implement an LRU (Least Recently Used) Cache in Java with O(1) operations',
        c: 'import java.util.HashMap;\npublic class LRUCache {\n    private final int capacity;\n    public LRUCache(int capacity) {\n        this.capacity = capacity;\n        // TODO: Initialize data structures\n    }\n    public int get(int key) {\n        // TODO: Implement get\n        return -1;\n    }\n    public void put(int key, int value) {\n        // TODO: Implement put\n    }\n}\n' },
      { s: 'implement Breadth-First Search (BFS) to find the shortest path in an unweighted directed graph in Java',
        c: 'import java.util.*;\npublic class GraphBFS {\n    private Map<Integer, List<Integer>> adjList = new HashMap<>();\n    public void addEdge(int from, int to) {\n        adjList.computeIfAbsent(from, k -> new ArrayList<>()).add(to);\n    }\n    public List<Integer> shortestPath(int start, int end) {\n        // TODO: Implement shortestPath BFS\n        return Collections.emptyList();\n    }\n}\n' },
      { s: 'implement a custom fixed-size thread pool executor with a blocking task queue in Java',
        c: 'import java.util.concurrent.LinkedBlockingQueue;\npublic class CustomThreadPool {\n    private final int poolSize;\n    private final Thread[] workers;\n    private final LinkedBlockingQueue<Runnable> taskQueue;\n    private volatile boolean isShutdown = false;\n    public CustomThreadPool(int poolSize) {\n        this.poolSize = poolSize;\n        this.workers = new Thread[poolSize];\n        this.taskQueue = new LinkedBlockingQueue<>();\n        // TODO: Initialize and start worker threads\n    }\n    public void submit(Runnable task) {\n        // TODO: Implement submit\n    }\n    public void shutdown() {\n        // TODO: Implement shutdown\n    }\n}\n' }
    ]
  }
};

// Generic placeholder code for languages without explicit templates
function placeholderCode(lang) {
  const map = {
    TypeScript: 'function solution<T>(input: T): T { /* TODO */ return input; }\n',
    Go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("TODO")\n}\n',
    Rust: 'fn main() {\n  // TODO\n}\n',
    Cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n  // TODO\n  return 0;\n}\n',
    Docker: 'FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nCMD ["node", "server.js"]\n',
    Kubernetes: 'apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: app\nspec:\n  replicas: 3\n  selector:\n    matchLabels:\n      app: app\n  template:\n    metadata:\n      labels:\n        app: app\n    spec:\n      containers:\n      - name: app\n        image: app:latest\n        ports:\n        - containerPort: 8080\n',
    AWS: '# CloudFormation – ECS Fargate service\nResources:\n  AppTaskDef:\n    Type: AWS::ECS::TaskDefinition\n    Properties:\n      Family: app-task\n      Cpu: "256"\n      Memory: "512"\n      NetworkMode: awsvpc\n      RequiresCompatibilities: [FARGATE]\n      ContainerDefinitions:\n      - Name: app\n        Image: !Ref ImageUri\n        PortMappings:\n        - ContainerPort: 8080\n',
    React: 'import React, { useState, useEffect } from "react";\n\nexport default function App() {\n  const [data, setData] = useState(null);\n  useEffect(() => {\n    fetch("/api/data").then(r=>r.json()).then(setData);\n  }, []);\n  return <div>{data ? JSON.stringify(data) : "Loading..."}</div>;\n}\n',
    Node: 'const http = require("http");\nconst server = http.createServer((req, res) => {\n  res.writeHead(200, {"Content-Type": "application/json"});\n  res.end(JSON.stringify({ status: "ok" }));\n});\nserver.listen(3000, () => console.log("Listening on 3000"));\n',
    HTMLCSS: '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Page</title>\n  <style>\n    body { font-family: Inter, sans-serif; margin: 0; padding: 2rem; background: #f8fafc; }\n    .card { background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,.08); }\n  </style>\n</head>\n<body>\n  <div class="card"><h1>Hello World</h1></div>\n</body>\n</html>\n',
    Java: 'public class Solution {\n    public static void main(String[] args) {\n        // TODO\n    }\n}\n'
  };
  return map[lang] || `// ${lang} — implement the solution below\n`;
}

const SKILL_LANG_MAP = {
  'Python Programming':    'Python',
  'C Systems Programming': 'C',        // fallback to Python templates adapted
  'SQL Database Design':   'SQL',
  'JavaScript':            'JavaScript',
  'TypeScript':            'TypeScript',
  'Go':                    'Go',
  'Rust':                  'Rust',
  'C++':                   'Cpp',
  'Docker':                'Docker',
  'Kubernetes':            'Kubernetes',
  'AWS':                   'AWS',
  'React':                 'React',
  'Node.js':               'Node',
  'HTML5 & CSS3':          'HTMLCSS',
  'Java Programming':      'Java',
};

async function generateQuestions() {
  const skills = await allAsync('SELECT id, name FROM skills');
  const stmt = db.prepare(
    'INSERT INTO questions (id, skill_id, title, difficulty, expiration_minutes, code_template) VALUES (?,?,?,?,?,?)'
  );

  let total = 0;
  for (const skill of skills) {
    const { qCount } = await getAsync('SELECT COUNT(*) as qCount FROM questions WHERE skill_id = ?', [skill.id]);
    if (qCount > 0) continue;

    const lang = SKILL_LANG_MAP[skill.name] || 'Python';
    const templates = PROBLEMS[lang] || PROBLEMS['Python'];
    const difficulties = ['easy', 'medium', 'hard'];

    for (const diff of difficulties) {
      const problems = templates[diff] || templates['easy'];
      // Combine all 30 scenarios × each problem template → many unique questions
      for (const scenario of SCENARIOS) {
        for (const prob of problems) {
          const title = `${scenario} — ${prob.s}`;
          const code  = prob.c || placeholderCode(lang);
          const expiry = diff === 'easy' ? 10 : diff === 'medium' ? 20 : 30;
          stmt.run(crypto.randomUUID(), skill.id, title, diff, expiry, code);
          total++;
        }
      }
    }
  }

  await new Promise((res, rej) => stmt.finalize(err => err ? rej(err) : res()));
  if (total > 0) {
    console.log(`[DB] Generated ${total} new questions.`);
  } else {
    console.log('[DB] No new questions needed generation.');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS — used by server.js
// ─────────────────────────────────────────────────────────────────────────────
module.exports = db;

// Automatically ensure the database schema tables exist on cold start/import
if (require.main !== module) {
  createSchema()
    .then(() => {
      console.log('[DB Startup] Auto-schema validation completed.');
    })
    .catch(err => {
      console.error('[DB Startup] Auto-schema ensure failed:', err.message);
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// INIT — only runs when executed directly: `node database.js`
// ─────────────────────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    try {
      await createSchema();
      await seedSkills();
      await generateQuestions();
      console.log('[DB] Database initialization complete.');
    } catch (e) {
      console.error('[DB] Initialization error:', e);
      process.exit(1);
    } finally {
      db.close(() => process.exit(0));
    }
  })();
}
