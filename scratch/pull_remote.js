const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const sqlite3 = require('sqlite3').verbose();

const SUPABASE_URL = 'https://czshrousjjmhqonynwcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6c2hyb3VzamptaHFvbnlud2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTQwNDcsImV4cCI6MjA5MzI5MDA0N30.-HLul4biScmb3y097fYQVp5-9X2vChWgvSUvidvlTqU';
const REST_URL = `${SUPABASE_URL}/rest/v1/skillproof_state`;

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function main() {
  console.log('[DB Pull] Fetching from Supabase...');
  try {
    const res = await fetch(`${REST_URL}?key=eq.app_db`, {
      method: 'GET',
      headers: HEADERS
    });
    if (!res.ok) {
      console.error('[DB Pull] Failed:', res.status);
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0 || !data[0].value) {
      console.error('[DB Pull] Empty database row');
      return;
    }
    const base64Data = data[0].value;
    const compressedBuffer = Buffer.from(base64Data, 'base64');
    const dbBuffer = zlib.gunzipSync(compressedBuffer);
    
    const remoteDbPath = path.join(__dirname, 'remote_app.db');
    fs.writeFileSync(remoteDbPath, dbBuffer);
    console.log('[DB Pull] Saved remote DB to:', remoteDbPath);

    const db = new sqlite3.Database(remoteDbPath);
    db.all(`
      SELECT c.id, c.student_id, u.email, c.skill_id, s.name as skill_name, c.schedule_id, c.status, c.started_at, c.submitted_at,
             e.total_score, e.ai_summary
      FROM challenges c
      JOIN users u ON c.student_id = u.id
      JOIN skills s ON c.skill_id = s.id
      LEFT JOIN evaluations e ON e.challenge_id = c.id
      WHERE u.email = 'student@gmail.com'
    `, [], (err, rows) => {
      if (err) {
        console.error(err);
        db.close();
        return;
      }
      console.log("\n=== REMOTE student@gmail.com Challenges ===");
      console.log(JSON.stringify(rows, null, 2));

      db.all(`
        SELECT es.id, es.skill_id, s.name as skill_name, es.invited_student_id, es.company_id, c.name as company_name
        FROM exam_schedules es
        JOIN skills s ON es.skill_id = s.id
        LEFT JOIN companies c ON es.company_id = c.id
        WHERE es.invited_student_id = (SELECT id FROM users WHERE email = 'student@gmail.com')
      `, [], (err, schedules) => {
        if (err) {
          console.error(err);
          db.close();
          return;
        }
        console.log("\n=== REMOTE student@gmail.com Schedules ===");
        console.log(JSON.stringify(schedules, null, 2));
        db.close();
      });
    });
  } catch (err) {
    console.error('[DB Pull] Error:', err.message);
  }
}

main();
