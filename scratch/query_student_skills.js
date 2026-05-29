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
    
    // 1. Get user record
    db.get("SELECT * FROM users WHERE email = 'student@gmail.com' COLLATE NOCASE", [], (err, user) => {
      if (err) {
        console.error(err);
        db.close();
        return;
      }
      console.log("\n=== REMOTE student@gmail.com USER ===");
      console.log(JSON.stringify(user, null, 2));

      if (!user) {
        console.log("No user found.");
        db.close();
        return;
      }

      // 2. Get student_skills records
      db.all(`
        SELECT ss.*, s.name as skill_name
        FROM student_skills ss
        JOIN skills s ON ss.skill_id = s.id
        WHERE ss.student_id = ?
      `, [user.id], (err, skills) => {
        if (err) {
          console.error(err);
          db.close();
          return;
        }
        console.log("\n=== REMOTE student@gmail.com student_skills ===");
        console.log(JSON.stringify(skills, null, 2));

        // 3. Get all challenges for this student
        db.all(`
          SELECT c.*, s.name as skill_name, e.total_score, e.ai_summary
          FROM challenges c
          JOIN skills s ON c.skill_id = s.id
          LEFT JOIN evaluations e ON e.challenge_id = c.id
          WHERE c.student_id = ?
        `, [user.id], (err, challenges) => {
          if (err) {
            console.error(err);
          } else {
            console.log("\n=== REMOTE student@gmail.com challenges ===");
            console.log(JSON.stringify(challenges, null, 2));
          }
          db.close();
        });
      });
    });
  } catch (err) {
    console.error('[DB Pull] Error:', err.message);
  }
}

main();
