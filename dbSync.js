/**
 * dbSync.js
 *
 * Real-time Supabase state sync layer for SQLite on Vercel Serverless.
 * Syncs the SQLite binary database file with a Supabase PostgreSQL KV table.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Supabase credentials for the 'smart-cradle' active project
const SUPABASE_URL = 'https://czshrousjjmhqonynwcm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6c2hyb3VzamptaHFvbnlud2NtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3MTQwNDcsImV4cCI6MjA5MzI5MDA0N30.-HLul4biScmb3y097fYQVp5-9X2vChWgvSUvidvlTqU';

const REST_URL = `${SUPABASE_URL}/rest/v1/skillproof_state`;

const HEADERS = {
  'apikey': SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

// Determine correct DB path (identical to database.js)
let DB_PATH = path.join(__dirname, 'app.db');
if (!fs.existsSync(DB_PATH) && fs.existsSync(path.join(process.cwd(), 'app.db'))) {
  DB_PATH = path.join(process.cwd(), 'app.db');
}
if (process.env.VERCEL) {
  DB_PATH = '/tmp/app.db';
}

// Local tracking of last synchronized timestamp and stale state
let lastSyncTimestamp = null;
let lastPullPromise = null;
let isLocalStale = false;

/**
 * Fetch the latest db_timestamp from Supabase
 */
async function fetchRemoteTimestamp() {
  try {
    const res = await fetch(`${REST_URL}?key=eq.db_timestamp`, {
      method: 'GET',
      headers: HEADERS
    });
    if (!res.ok) {
      console.error('[DB Sync] Failed to fetch remote timestamp status:', res.status);
      return null;
    }
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      return data[0].value;
    }
  } catch (err) {
    console.error('[DB Sync] Error fetching remote timestamp:', err.message);
  }
  return null;
}

/**
 * Pull the latest database file from Supabase if a newer one exists
 * Returns true if the database file was updated on disk, false otherwise.
 */
async function pullLatestDb() {
  // Prevent parallel overlapping pulls
  if (lastPullPromise) return lastPullPromise;

  lastPullPromise = (async () => {
    try {
      const remoteTS = await fetchRemoteTimestamp();
      if (!remoteTS) {
        console.log('[DB Sync] No remote timestamp found. Using local/seeded DB.');
        return false;
      }

      // If we already have the latest database synced, skip pull
      if (lastSyncTimestamp === remoteTS && fs.existsSync(DB_PATH)) {
        return false;
      }

      console.log(`[DB Sync] Syncing database. Local: ${lastSyncTimestamp}, Remote: ${remoteTS}`);

      // Fetch the full compressed database zlib base64
      const res = await fetch(`${REST_URL}?key=eq.app_db`, {
        method: 'GET',
        headers: HEADERS
      });
      if (!res.ok) {
        console.error('[DB Sync] Failed to fetch database file from Supabase:', res.status);
        isLocalStale = true;
        return false;
      }

      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0 || !data[0].value) {
        console.log('[DB Sync] Remote database row empty. Skipping pull.');
        return false;
      }

      const base64Data = data[0].value;
      const compressedBuffer = Buffer.from(base64Data, 'base64');
      const dbBuffer = zlib.gunzipSync(compressedBuffer);

      // Ensure directory exists
      const dir = path.dirname(DB_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write to write-safe path
      fs.writeFileSync(DB_PATH, dbBuffer);
      lastSyncTimestamp = remoteTS;
      isLocalStale = false; // Successfully synced, clear stale status
      console.log(`[DB Sync] Database successfully synced to disk. Size: ${dbBuffer.length} bytes.`);
      return true;
    } catch (err) {
      console.error('[DB Sync] Critical failure during database pull:', err.message);
      isLocalStale = true;
      return false;
    } finally {
      lastPullPromise = null;
    }
  })();

  return lastPullPromise;
}

/**
 * Push the current database file to Supabase and update remote timestamp
 */
async function pushLatestDb() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      console.error('[DB Sync] DB file does not exist at ' + DB_PATH + '. Cannot push.');
      return false;
    }

    // 1. OCC: Block push if the local container state is stale
    if (isLocalStale) {
      console.warn('[DB Sync OCC] Aborting push. Local container database is marked as stale.');
      return false;
    }

    // 2. OCC: Fetch remote timestamp immediately before pushing to ensure no other container has updated it
    const remoteTS = await fetchRemoteTimestamp();
    if (remoteTS && remoteTS !== lastSyncTimestamp) {
      console.warn(`[DB Sync OCC] Aborting push. Remote database was updated by another container. Local TS: ${lastSyncTimestamp}, Remote TS: ${remoteTS}`);
      isLocalStale = true; // Mark local container as stale to enforce next pull to sync first
      return false;
    }

    const dbBuffer = fs.readFileSync(DB_PATH);
    const compressed = zlib.gzipSync(dbBuffer);
    const base64 = compressed.toString('base64');
    const newTS = Date.now().toString();

    console.log(`[DB Sync] Pushing updated database to Supabase. Size: ${dbBuffer.length} bytes, Compressed base64 length: ${base64.length}`);

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
      console.error('[DB Sync] Failed to upsert database payload to Supabase:', dbRes.status);
      isLocalStale = true;
      return false;
    }

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
      console.error('[DB Sync] Failed to upsert timestamp status to Supabase:', tsRes.status);
      isLocalStale = true;
      return false;
    }

    lastSyncTimestamp = newTS;
    isLocalStale = false;
    console.log(`[DB Sync] Database push completed successfully. Timestamp: ${newTS}`);
    return true;
  } catch (err) {
    console.error('[DB Sync] Critical failure during database push:', err.message);
    isLocalStale = true;
    return false;
  }
}

module.exports = {
  DB_PATH,
  pullLatestDb,
  pushLatestDb,
  getLastSyncTimestamp: () => lastSyncTimestamp,
  getIsLocalStale: () => isLocalStale
};

