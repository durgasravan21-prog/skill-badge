const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const SUPABASE_URL = 'https://czshrousjjmhqonynwcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6c2hyb3VzamptaHFvbnlud2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTQwNDcsImV4cCI6MjA5MzI5MDA0N30.-HLul4biScmb3y097fYQVp5-9X2vChWgvSUvidvlTqU';
const REST_URL = `${SUPABASE_URL}/rest/v1/skillproof_state`;

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function main() {
  const dbPath = path.join(__dirname, 'remote_app.db');
  if (!fs.existsSync(dbPath)) {
    console.error('File remote_app.db does not exist. Run migrate_remote.js first.');
    return;
  }

  console.log('[DB Push] Reading remote_app.db...');
  const dbBuffer = fs.readFileSync(dbPath);
  console.log(`[DB Push] Gzipping database... size: ${dbBuffer.length} bytes`);
  const compressed = zlib.gzipSync(dbBuffer);
  const base64 = compressed.toString('base64');
  const newTS = Date.now().toString();

  console.log(`[DB Push] Uploading database payload (base64 length: ${base64.length})...`);
  
  // 1. Upsert database payload
  const dbRes = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ key: 'app_db', value: base64 })
  });

  if (!dbRes.ok) {
    console.error('[DB Push] Failed to upload database payload:', dbRes.status, await dbRes.text());
    return;
  }
  console.log('[DB Push] Database payload uploaded successfully!');

  // 2. Upsert timestamp payload
  const tsRes = await fetch(REST_URL, {
    method: 'POST',
    headers: {
      ...HEADERS,
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify({ key: 'db_timestamp', value: newTS })
  });

  if (!tsRes.ok) {
    console.error('[DB Push] Failed to upload timestamp:', tsRes.status, await tsRes.text());
    return;
  }
  
  console.log(`[DB Push] Successfully updated db_timestamp to: ${newTS}`);
  console.log('[DB Push] Database push complete!');
}

main();
