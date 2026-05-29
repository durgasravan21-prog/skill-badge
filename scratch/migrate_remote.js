const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'remote_app.db');
const db = new sqlite3.Database(dbPath);

function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function runMigrations() {
  console.log('[Migration] Starting migrations on remote database copy...');
  
  // List of all migrations to ensure are applied
  const migrations = [
    'ALTER TABLE exam_schedules ADD COLUMN exam_password TEXT;',
    'ALTER TABLE exam_schedules ADD COLUMN invited_student_id TEXT;',
    'ALTER TABLE challenges ADD COLUMN ip_address TEXT;',
    'ALTER TABLE challenges ADD COLUMN device_signature TEXT;',
    'ALTER TABLE challenges ADD COLUMN device_flagged INTEGER DEFAULT 0;',
    'ALTER TABLE student_skills ADD COLUMN extra_attempts INTEGER DEFAULT 0;',
    'ALTER TABLE challenges ADD COLUMN joins_count INTEGER DEFAULT 1;',
    'ALTER TABLE challenges ADD COLUMN max_joins INTEGER DEFAULT 4;',
    'ALTER TABLE challenges ADD COLUMN schedule_id TEXT;',
    'UPDATE challenges SET max_joins = 4 WHERE max_joins = 3;'
  ];

  for (const sql of migrations) {
    try {
      await runAsync(sql);
      console.log(`[Migration] Success: ${sql}`);
    } catch (err) {
      console.log(`[Migration] Skipped/Already Applied (expected if column exists): ${sql} - ${err.message}`);
    }
  }

  // Ensure indexes are built
  try {
    await runAsync('CREATE INDEX IF NOT EXISTS idx_challenges_company ON challenges(company_id);');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_users_email        ON users(email);');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_questions_skill    ON questions(skill_id, difficulty);');
    await runAsync('CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id, is_read);');
    console.log('[Migration] Indexes ensured successfully.');
  } catch (err) {
    console.error('[Migration] Failed to build indexes:', err.message);
  }

  db.close(() => {
    console.log('[Migration] Migration complete.');
  });
}

runMigrations();
