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
  console.log('[OTP Query] Fetching from Supabase...');
  try {
    const res = await fetch(`${REST_URL}?key=eq.app_db`, {
      method: 'GET',
      headers: HEADERS
    });
    if (!res.ok) {
      console.error('[OTP Query] Failed to fetch:', res.status);
      return;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0 || !data[0].value) {
      console.error('[OTP Query] Empty database row');
      return;
    }
    const base64Data = data[0].value;
    const compressedBuffer = Buffer.from(base64Data, 'base64');
    const dbBuffer = zlib.gunzipSync(compressedBuffer);
    
    const remoteDbPath = path.join(__dirname, 'remote_app.db');
    fs.writeFileSync(remoteDbPath, dbBuffer);
    console.log('[OTP Query] Saved remote DB');

    const db = new sqlite3.Database(remoteDbPath);
    db.all(`
      SELECT * FROM otp_sessions ORDER BY created_at DESC
    `, [], (err, rows) => {
      if (err) {
        console.error(err);
      } else {
        console.log("=== REMOTE OTP SESSIONS ===");
        console.log(JSON.stringify(rows, null, 2));
      }
      db.close();
    });
  } catch (err) {
    console.error('[OTP Query] Error:', err.message);
  }
}

main();
