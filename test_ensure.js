const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

const db = new sqlite3.Database('app.db');

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) { err ? reject(err) : resolve(this); });
});

function sanitizeString(str, maxLength = 500) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, '');
}

function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email) && email.length <= 254;
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

async function run() {
  try {
    const res1 = await ensureStudentExists('durgasravan21@gmail.com');
    console.log('Result 1:', res1);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    db.close();
  }
}

run();
