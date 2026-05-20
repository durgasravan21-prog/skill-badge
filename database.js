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

const fs = require('fs');
let DB_PATH = path.join(__dirname, 'app.db');
if (!fs.existsSync(DB_PATH) && fs.existsSync(path.join(process.cwd(), 'app.db'))) {
  DB_PATH = path.join(process.cwd(), 'app.db');
}

if (process.env.VERCEL) {
  const tmpPath = '/tmp/app.db';
  if (!fs.existsSync(tmpPath)) {
    try {
      let srcPath = path.join(__dirname, 'app.db');
      if (!fs.existsSync(srcPath) && fs.existsSync(path.join(process.cwd(), 'app.db'))) {
        srcPath = path.join(process.cwd(), 'app.db');
      }
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, tmpPath);
        console.log('[DB] Copied pre-seeded SQLite database to write-safe Vercel /tmp path.');
      } else {
        console.log('[DB] Pre-seeded app.db not found at ' + srcPath + ', creating empty database in /tmp.');
      }
    } catch (err) {
      console.error('[DB] Failed to copy seed SQLite file to /tmp:', err.message);
    }
  }
  DB_PATH = tmpPath;
}

// Open (or create) the database — always open, never closed while server is running
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Failed to open database:', err.message);
  }
});

// Enable WAL for better concurrency and FK enforcement
db.serialize(() => {
  db.run('PRAGMA journal_mode = WAL;');
  db.run('PRAGMA foreign_keys = ON;');
});

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
    email            TEXT UNIQUE NOT NULL,
    role             TEXT NOT NULL,
    college          TEXT,
    company          TEXT,
    company_id       TEXT,
    profile_slug     TEXT,
    skillproof_score REAL DEFAULT 0.0,
    created_at       TEXT NOT NULL,
    FOREIGN KEY (company_id) REFERENCES companies(id)
  );`);

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
    FOREIGN KEY (recruiter_id) REFERENCES users(id),
    FOREIGN KEY (company_id)   REFERENCES companies(id),
    FOREIGN KEY (skill_id)     REFERENCES skills(id)
  );`);

  // Indexes for multi-tenant isolation performance
  await runAsync('CREATE INDEX IF NOT EXISTS idx_challenges_company ON challenges(company_id);');
  await runAsync('CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);');
  await runAsync('CREATE INDEX IF NOT EXISTS idx_questions_skill    ON questions(skill_id, difficulty);');

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
  { name: 'HTML5 & CSS3',        category: 'Web Development' }
];

async function seedSkills() {
  const { cnt } = await getAsync('SELECT COUNT(*) as cnt FROM skills');
  if (cnt > 0) { console.log('[DB] Skills already seeded.'); return; }

  const stmt = db.prepare('INSERT INTO skills (id, name, category) VALUES (?, ?, ?)');
  for (const s of MASTER_SKILLS) stmt.run(crypto.randomUUID(), s.name, s.category);
  await new Promise((res, rej) => stmt.finalize(err => err ? rej(err) : res()));
  console.log(`[DB] Seeded ${MASTER_SKILLS.length} skills.`);
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
        c: 'import csv\ndef sum_column(filepath, col):\n    with open(filepath) as f:\n        return sum(int(row[col]) for row in csv.DictReader(f))\n' },
      { s: 'write a function to reverse a string without using slice syntax',
        c: 'def reverse_str(s):\n    result = []\n    for ch in reversed(s):\n        result.append(ch)\n    return "".join(result)\n' },
      { s: 'compute the factorial of n using recursion',
        c: 'def factorial(n):\n    return 1 if n <= 1 else n * factorial(n - 1)\n' },
      { s: 'check if a given integer is a prime number',
        c: 'def is_prime(n):\n    if n < 2: return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0: return False\n    return True\n' },
      { s: 'merge two sorted lists into a single sorted list',
        c: 'def merge_sorted(a, b):\n    i = j = 0; out = []\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]: out.append(a[i]); i += 1\n        else: out.append(b[j]); j += 1\n    return out + a[i:] + b[j:]\n' },
      { s: 'flatten a nested list of arbitrary depth',
        c: 'def flatten(lst):\n    for item in lst:\n        if isinstance(item, list): yield from flatten(item)\n        else: yield item\n' },
      { s: 'count the frequency of each word in a string',
        c: 'from collections import Counter\ndef word_freq(text):\n    return Counter(text.lower().split())\n' },
    ],
    medium: [
      { s: 'implement a queue using two stacks',
        c: 'class Queue:\n    def __init__(self): self.s1=[]; self.s2=[]\n    def enqueue(self,x): self.s1.append(x)\n    def dequeue(self):\n        if not self.s2:\n            while self.s1: self.s2.append(self.s1.pop())\n        return self.s2.pop()\n' },
      { s: 'find the longest palindrome substring in a string',
        c: 'def longest_palindrome(s):\n    best = ""\n    for i in range(len(s)):\n        for j in range(i+1, len(s)+1):\n            sub = s[i:j]\n            if sub == sub[::-1] and len(sub) > len(best): best = sub\n    return best\n' },
      { s: 'solve the 0/1 knapsack problem with dynamic programming',
        c: 'def knapsack(weights, values, cap):\n    n = len(weights); dp = [[0]*(cap+1) for _ in range(n+1)]\n    for i in range(1,n+1):\n        for w in range(cap+1):\n            dp[i][w] = dp[i-1][w]\n            if weights[i-1] <= w:\n                dp[i][w] = max(dp[i][w], dp[i-1][w-weights[i-1]]+values[i-1])\n    return dp[n][cap]\n' },
      { s: 'implement a basic LRU cache with O(1) operations',
        c: 'from collections import OrderedDict\nclass LRUCache:\n    def __init__(self, cap): self.cap=cap; self.cache=OrderedDict()\n    def get(self,key):\n        if key not in self.cache: return -1\n        self.cache.move_to_end(key); return self.cache[key]\n    def put(self,key,val):\n        self.cache[key]=val; self.cache.move_to_end(key)\n        if len(self.cache)>self.cap: self.cache.popitem(last=False)\n' },
      { s: 'implement BFS on a graph given as an adjacency list',
        c: 'from collections import deque\ndef bfs(graph, start):\n    visited={start}; q=deque([start]); order=[]\n    while q:\n        v=q.popleft(); order.append(v)\n        for n in graph.get(v,[]):\n            if n not in visited: visited.add(n); q.append(n)\n    return order\n' },
      { s: 'detect if a linked list has a cycle using Floyd\'s algorithm',
        c: 'def has_cycle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow = slow.next; fast = fast.next.next\n        if slow is fast: return True\n    return False\n' },
      { s: 'implement merge sort on a list',
        c: 'def merge_sort(arr):\n    if len(arr) <= 1: return arr\n    mid = len(arr)//2\n    L = merge_sort(arr[:mid]); R = merge_sort(arr[mid:])\n    i=j=0; out=[]\n    while i<len(L) and j<len(R):\n        if L[i]<=R[j]: out.append(L[i]); i+=1\n        else: out.append(R[j]); j+=1\n    return out+L[i:]+R[j:]\n' },
    ],
    hard: [
      { s: 'design a thread-safe priority queue using heapq and threading.Lock',
        c: 'import heapq, threading\nclass SafePQ:\n    def __init__(self): self._h=[]; self._lock=threading.Lock()\n    def push(self,item):\n        with self._lock: heapq.heappush(self._h, item)\n    def pop(self):\n        with self._lock: return heapq.heappop(self._h)\n' },
      { s: 'implement a rate-limiter using the token bucket algorithm',
        c: 'import time, threading\nclass TokenBucket:\n    def __init__(self,rate,cap): self.rate=rate;self.cap=cap;self.tokens=cap;self.last=time.time();self.lock=threading.Lock()\n    def consume(self,n=1):\n        with self.lock:\n            now=time.time(); self.tokens=min(self.cap,self.tokens+(now-self.last)*self.rate); self.last=now\n            if self.tokens>=n: self.tokens-=n; return True\n            return False\n' },
      { s: 'build a miniature ORM that maps a Python class to a SQLite table',
        c: 'import sqlite3\nclass Model:\n    TABLE=""; FIELDS=[]\n    @classmethod\n    def create_table(cls, conn): conn.execute(f"CREATE TABLE IF NOT EXISTS {cls.TABLE} (id TEXT PRIMARY KEY, {chr(44).join(f+chr(32)+chr(84)+chr(69)+chr(88)+chr(84) for f in cls.FIELDS)})")\n    def save(self, conn): conn.execute(f"INSERT INTO {self.TABLE} VALUES ({chr(44).join([chr(63)]*(len(self.FIELDS)+1))})", [self.id]+[getattr(self,f) for f in self.FIELDS])\n' },
      { s: 'implement Dijkstra\'s algorithm for shortest paths',
        c: 'import heapq\ndef dijkstra(graph, src):\n    dist={src:0}; heap=[(0,src)]\n    while heap:\n        d,u=heapq.heappop(heap)\n        if d>dist.get(u,float("inf")): continue\n        for v,w in graph.get(u,{}).items():\n            nd=d+w\n            if nd<dist.get(v,float("inf")):\n                dist[v]=nd; heapq.heappush(heap,(nd,v))\n    return dist\n' },
      { s: 'implement a consistent-hashing ring for distributed caching',
        c: 'import hashlib, bisect\nclass ConsistentHash:\n    def __init__(self, nodes, replicas=100):\n        self.ring={}; self.keys=[]; self.replicas=replicas\n        for n in nodes: self.add(n)\n    def _hash(self,k): return int(hashlib.md5(k.encode()).hexdigest(),16)\n    def add(self,node):\n        for i in range(self.replicas):\n            k=self._hash(f"{node}:{i}"); self.ring[k]=node; bisect.insort(self.keys,k)\n    def get(self,key):\n        if not self.ring: return None\n        h=self._hash(key); i=bisect.bisect(self.keys,h)%len(self.keys)\n        return self.ring[self.keys[i]]\n' },
      { s: 'design a circuit-breaker pattern for HTTP clients',
        c: 'import time\nclass CircuitBreaker:\n    def __init__(self,threshold=5,timeout=30): self.failures=0;self.threshold=threshold;self.timeout=timeout;self.opened_at=None;self.state="closed"\n    def call(self,fn,*args,**kwargs):\n        if self.state=="open":\n            if time.time()-self.opened_at>self.timeout: self.state="half-open"\n            else: raise Exception("Circuit open")\n        try:\n            result=fn(*args,**kwargs)\n            if self.state=="half-open": self.state="closed";self.failures=0\n            return result\n        except Exception as e:\n            self.failures+=1\n            if self.failures>=self.threshold: self.state="open";self.opened_at=time.time()\n            raise\n' },
    ]
  },
  JavaScript: {
    easy: [
      { s: 'write a function to check if a string is a palindrome',
        c: 'function isPalindrome(str) {\n  const s = str.toLowerCase().replace(/[^a-z0-9]/g,"");\n  return s === s.split("").reverse().join("");\n}\n' },
      { s: 'implement a debounce utility function',
        c: 'function debounce(fn, delay) {\n  let timer;\n  return function(...args) {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn.apply(this, args), delay);\n  };\n}\n' },
      { s: 'flatten a nested array using recursion',
        c: 'function flatten(arr) {\n  return arr.reduce((acc, val) =>\n    Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);\n}\n' },
      { s: 'implement deep clone for a plain object',
        c: 'function deepClone(obj) {\n  return JSON.parse(JSON.stringify(obj));\n}\n' },
      { s: 'group an array of objects by a given key',
        c: 'function groupBy(arr, key) {\n  return arr.reduce((acc, item) => {\n    (acc[item[key]] = acc[item[key]] || []).push(item);\n    return acc;\n  }, {});\n}\n' },
    ],
    medium: [
      { s: 'implement a publish-subscribe event system',
        c: 'class EventEmitter {\n  constructor() { this._events = {}; }\n  on(evt, fn) { (this._events[evt] = this._events[evt]||[]).push(fn); }\n  off(evt, fn) { this._events[evt] = (this._events[evt]||[]).filter(f=>f!==fn); }\n  emit(evt, ...args) { (this._events[evt]||[]).forEach(fn=>fn(...args)); }\n}\n' },
      { s: 'implement a Promise.all polyfill from scratch',
        c: 'function promiseAll(promises) {\n  return new Promise((resolve, reject) => {\n    const results = []; let count = 0;\n    promises.forEach((p, i) => {\n      Promise.resolve(p).then(val => {\n        results[i] = val;\n        if (++count === promises.length) resolve(results);\n      }).catch(reject);\n    });\n    if (promises.length === 0) resolve([]);\n  });\n}\n' },
      { s: 'build a simple Observable/Observer pattern',
        c: 'class Observable {\n  constructor(fn) { this._fn = fn; }\n  subscribe(observer) { this._fn(observer); }\n  static of(...values) {\n    return new Observable(obs => {\n      values.forEach(v => obs.next(v));\n      obs.complete();\n    });\n  }\n}\n' },
      { s: 'implement a memoize function with a Map cache',
        c: 'function memoize(fn) {\n  const cache = new Map();\n  return function(...args) {\n    const key = JSON.stringify(args);\n    if (cache.has(key)) return cache.get(key);\n    const result = fn.apply(this, args);\n    cache.set(key, result);\n    return result;\n  };\n}\n' },
      { s: 'create a linked list with insert, delete, and search',
        c: 'class Node { constructor(v) { this.val=v; this.next=null; } }\nclass LinkedList {\n  constructor() { this.head=null; }\n  insert(v) { const n=new Node(v); if(!this.head){this.head=n;return;} let c=this.head; while(c.next) c=c.next; c.next=n; }\n  search(v) { let c=this.head; while(c){ if(c.val===v) return true; c=c.next;} return false; }\n}\n' },
    ],
    hard: [
      { s: 'implement a virtual DOM diff algorithm',
        c: '// Simplified vDOM diff\nfunction diff(oldNode, newNode) {\n  if (!oldNode) return { type: "CREATE", node: newNode };\n  if (!newNode) return { type: "REMOVE" };\n  if (typeof oldNode !== typeof newNode || (typeof oldNode === "string" && oldNode !== newNode)) return { type: "REPLACE", node: newNode };\n  if (oldNode.tag !== newNode.tag) return { type: "REPLACE", node: newNode };\n  return { type: "UPDATE", props: diffProps(oldNode.props, newNode.props), children: diffChildren(oldNode.children, newNode.children) };\n}\nfunction diffProps(o={}, n={}) { /* ... */ return {}; }\nfunction diffChildren(o=[], n=[]) { return n.map((c,i)=>diff(o[i],c)); }\n' },
      { s: 'build a retry-with-exponential-backoff utility',
        c: 'async function retryWithBackoff(fn, retries=3, baseDelay=100) {\n  for (let attempt = 0; attempt <= retries; attempt++) {\n    try { return await fn(); }\n    catch (err) {\n      if (attempt === retries) throw err;\n      const delay = baseDelay * Math.pow(2, attempt) + Math.random()*100;\n      await new Promise(r => setTimeout(r, delay));\n    }\n  }\n}\n' },
      { s: 'implement a lazy evaluation system using generators',
        c: 'function* lazyMap(iter, fn) { for (const x of iter) yield fn(x); }\nfunction* lazyFilter(iter, pred) { for (const x of iter) if (pred(x)) yield x; }\nfunction* lazyTake(iter, n) { let i=0; for (const x of iter) { if(i++>=n) break; yield x; } }\nfunction collect(iter) { return [...iter]; }\n' },
    ]
  },
  SQL: {
    easy: [
      { s: 'write a query to find all active users sorted by registration date',
        c: 'SELECT id, name, email, created_at\nFROM users\nWHERE active = 1\nORDER BY created_at DESC;\n' },
      { s: 'count the number of orders per customer',
        c: 'SELECT customer_id, COUNT(*) AS order_count\nFROM orders\nGROUP BY customer_id\nORDER BY order_count DESC;\n' },
      { s: 'find the top 5 products by revenue',
        c: 'SELECT p.name, SUM(oi.quantity * oi.unit_price) AS revenue\nFROM order_items oi\nJOIN products p ON oi.product_id = p.id\nGROUP BY p.id, p.name\nORDER BY revenue DESC\nLIMIT 5;\n' },
      { s: 'retrieve employees who earn more than their department average',
        c: 'SELECT e.name, e.salary, d.avg_salary\nFROM employees e\nJOIN (\n  SELECT department_id, AVG(salary) AS avg_salary FROM employees GROUP BY department_id\n) d ON e.department_id = d.department_id\nWHERE e.salary > d.avg_salary;\n' },
      { s: 'find duplicate email addresses in the users table',
        c: 'SELECT email, COUNT(*) AS cnt\nFROM users\nGROUP BY email\nHAVING cnt > 1;\n' },
    ],
    medium: [
      { s: 'design a schema for a multi-tenant SaaS with row-level security',
        c: '-- Tenants table\nCREATE TABLE tenants (id UUID PRIMARY KEY, name TEXT NOT NULL);\n-- Ensure every table has tenant_id\nCREATE TABLE resources (\n  id UUID PRIMARY KEY,\n  tenant_id UUID NOT NULL REFERENCES tenants(id),\n  data JSONB,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE INDEX ON resources(tenant_id);\n-- Row-level security\nALTER TABLE resources ENABLE ROW LEVEL SECURITY;\nCREATE POLICY tenant_isolation ON resources USING (tenant_id = current_setting(\'app.tenant_id\')::uuid);\n' },
      { s: 'write a recursive CTE to traverse an employee hierarchy',
        c: 'WITH RECURSIVE org AS (\n  SELECT id, name, manager_id, 0 AS depth\n  FROM employees WHERE manager_id IS NULL\n  UNION ALL\n  SELECT e.id, e.name, e.manager_id, o.depth+1\n  FROM employees e\n  JOIN org o ON e.manager_id = o.id\n)\nSELECT * FROM org ORDER BY depth, name;\n' },
      { s: 'implement a sliding-window query to compute a 7-day rolling average',
        c: 'SELECT date,\n  AVG(sales) OVER (\n    ORDER BY date\n    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW\n  ) AS rolling_avg_7d\nFROM daily_sales\nORDER BY date;\n' },
      { s: 'create a materialized view that refreshes on a schedule',
        c: 'CREATE MATERIALIZED VIEW monthly_revenue AS\nSELECT DATE_TRUNC(\'month\', order_date) AS month,\n       SUM(amount) AS total\nFROM orders\nGROUP BY 1;\nCREATE UNIQUE INDEX ON monthly_revenue(month);\n-- Refresh concurrently (pg_cron job would call this)\n-- REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_revenue;\n' },
    ],
    hard: [
      { s: 'design an event-sourcing database schema and write a projection query',
        c: '-- Events store (append-only)\nCREATE TABLE events (\n  id BIGSERIAL PRIMARY KEY,\n  aggregate_id UUID NOT NULL,\n  event_type TEXT NOT NULL,\n  payload JSONB NOT NULL,\n  created_at TIMESTAMPTZ DEFAULT now()\n);\nCREATE INDEX ON events(aggregate_id, created_at);\n-- Projection: current account balance\nSELECT aggregate_id,\n  SUM(CASE event_type WHEN \'deposit\' THEN (payload->>\'amount\')::numeric\n                      WHEN \'withdraw\' THEN -(payload->>\'amount\')::numeric\n                      ELSE 0 END) AS balance\nFROM events\nGROUP BY aggregate_id;\n' },
      { s: 'implement optimistic locking with version columns to prevent lost updates',
        c: '-- Schema\nCREATE TABLE inventory (id UUID PRIMARY KEY, quantity INT, version INT DEFAULT 0);\n-- Optimistic update – fails if another transaction changed the row\nUPDATE inventory\nSET quantity = quantity - :amount, version = version + 1\nWHERE id = :id AND version = :expected_version;\n-- Application checks affected rows; if 0 → retry with fresh read\n' },
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
};

async function generateQuestions() {
  const { cnt } = await getAsync('SELECT COUNT(*) as cnt FROM questions');
  if (cnt > 0) { console.log(`[DB] Questions already generated (${cnt} found).`); return; }

  const skills = await allAsync('SELECT id, name FROM skills');
  const stmt = db.prepare(
    'INSERT INTO questions (id, skill_id, title, difficulty, expiration_minutes, code_template) VALUES (?,?,?,?,?,?)'
  );

  let total = 0;
  for (const skill of skills) {
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
  console.log(`[DB] Generated ${total} questions across ${skills.length} skills.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTS — used by server.js
// ─────────────────────────────────────────────────────────────────────────────
module.exports = db;

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
