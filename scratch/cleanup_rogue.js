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

async function cleanup() {
  console.log('[Cleanup] Cleaning up rogue mock evaluation for student@gmail.com...');
  const challengeId = 'b1b39ed3-f7da-4d54-9329-7c5564f19835';

  try {
    // 1. Delete evaluations
    const evalDel = await runAsync('DELETE FROM evaluations WHERE challenge_id = ?', [challengeId]);
    console.log(`[Cleanup] Deleted evaluations: ${evalDel.changes} rows`);

    // 2. Delete submissions
    const subDel = await runAsync('DELETE FROM submissions WHERE challenge_id = ?', [challengeId]);
    console.log(`[Cleanup] Deleted submissions: ${subDel.changes} rows`);

    // 3. Delete challenges
    const chalDel = await runAsync('DELETE FROM challenges WHERE id = ?', [challengeId]);
    console.log(`[Cleanup] Deleted challenge: ${chalDel.changes} rows`);

    console.log('[Cleanup] Cleanup successful!');
  } catch (err) {
    console.error('[Cleanup] Error during cleanup:', err.message);
  }

  db.close(() => {
    console.log('[Cleanup] Connection closed.');
  });
}

cleanup();
