const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbSync = require('../dbSync.js');

function allAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function runAsync(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function startCleanup() {
  console.log('[Clean] Step 1: Pulling latest DB from Supabase to sync local app.db...');
  await dbSync.pullLatestDb();
  
  const db = new sqlite3.Database(dbSync.DB_PATH);
  
  try {
    // Enable WAL and Foreign Keys for safety
    await runAsync(db, 'PRAGMA foreign_keys = OFF;'); // Turn off temporarily to make cascade cleanup simple
    
    // Find fake users
    const fakeUsers = await allAsync(db, `
      SELECT id, name, email FROM users
      WHERE email LIKE 'exhausted_%'
         OR email LIKE 'tech_student_%'
         OR email = 'alice.alpha@test1.com'
         OR email = 'bob.beta@test2.com'
         OR name IN ('Alice Alpha', 'Bob Beta', 'Exhausted Candidate', 'Tech Student')
    `);
    
    console.log(`[Clean] Found ${fakeUsers.length} fake users to clean up.`);
    if (fakeUsers.length === 0) {
      console.log('[Clean] No fake users found in the database. Exiting.');
      db.close();
      return;
    }
    
    const fakeUserIds = fakeUsers.map(u => u.id);
    const placeholders = fakeUserIds.map(() => '?').join(',');
    
    console.log('[Clean] Fake users details:', fakeUsers.map(u => `${u.name} (${u.email})`).join(', '));
    
    // Find fake challenges associated with these users (as student_id)
    const fakeChallenges = await allAsync(db, `
      SELECT id FROM challenges WHERE student_id IN (${placeholders})
    `, fakeUserIds);
    const fakeChallengeIds = fakeChallenges.map(c => c.id);
    
    console.log(`[Clean] Found ${fakeChallengeIds.length} fake challenges.`);
    
    // Delete in topological order
    if (fakeChallengeIds.length > 0) {
      const chalPlaceholders = fakeChallengeIds.map(() => '?').join(',');
      
      const evalDel = await runAsync(db, `DELETE FROM evaluations WHERE challenge_id IN (${chalPlaceholders})`, fakeChallengeIds);
      console.log(`[Clean] Deleted evaluations: ${evalDel.changes} rows`);
      
      const subDel = await runAsync(db, `DELETE FROM submissions WHERE challenge_id IN (${chalPlaceholders})`, fakeChallengeIds);
      console.log(`[Clean] Deleted submissions: ${subDel.changes} rows`);
      
      const violDel = await runAsync(db, `DELETE FROM violations WHERE challenge_id IN (${chalPlaceholders})`, fakeChallengeIds);
      console.log(`[Clean] Deleted violations: ${violDel.changes} rows`);
      
      const photoDel = await runAsync(db, `DELETE FROM exam_photos WHERE challenge_id IN (${chalPlaceholders})`, fakeChallengeIds);
      console.log(`[Clean] Deleted exam_photos: ${photoDel.changes} rows`);
      
      const roomDel = await runAsync(db, `DELETE FROM challenge_rooms WHERE challenge_id IN (${chalPlaceholders})`, fakeChallengeIds);
      console.log(`[Clean] Deleted challenge_rooms: ${roomDel.changes} rows`);
      
      const chalDel = await runAsync(db, `DELETE FROM challenges WHERE id IN (${chalPlaceholders})`, fakeChallengeIds);
      console.log(`[Clean] Deleted challenges: ${chalDel.changes} rows`);
    }
    
    // Clean up dependent tables by user ID
    const skillDel = await runAsync(db, `DELETE FROM student_skills WHERE student_id IN (${placeholders})`, fakeUserIds);
    console.log(`[Clean] Deleted student_skills: ${skillDel.changes} rows`);
    
    const notifDel = await runAsync(db, `DELETE FROM notifications WHERE recipient_id IN (${placeholders}) OR sender_id IN (${placeholders})`, [...fakeUserIds, ...fakeUserIds]);
    console.log(`[Clean] Deleted notifications: ${notifDel.changes} rows`);
    
    const otpDel = await runAsync(db, `DELETE FROM otp_sessions WHERE user_id IN (${placeholders})`, fakeUserIds);
    console.log(`[Clean] Deleted otp_sessions: ${otpDel.changes} rows`);
    
    const sessDel = await runAsync(db, `DELETE FROM user_sessions WHERE user_id IN (${placeholders})`, fakeUserIds);
    console.log(`[Clean] Deleted user_sessions: ${sessDel.changes} rows`);
    
    const schedDel = await runAsync(db, `DELETE FROM exam_schedules WHERE recruiter_id IN (${placeholders}) OR invited_student_id IN (${placeholders})`, [...fakeUserIds, ...fakeUserIds]);
    console.log(`[Clean] Deleted exam_schedules: ${schedDel.changes} rows`);
    
    const userDel = await runAsync(db, `DELETE FROM users WHERE id IN (${placeholders})`, fakeUserIds);
    console.log(`[Clean] Deleted users: ${userDel.changes} rows`);
    
    // Re-enable foreign keys
    await runAsync(db, 'PRAGMA foreign_keys = ON;');
    
    // Checkpoint & Clean WAL
    await runAsync(db, 'VACUUM;');
    console.log('[Clean] Database vacuumed and optimized.');
    
  } catch (err) {
    console.error('[Clean] Error during transaction execution:', err.message);
  }
  
  db.close(async () => {
    console.log('[Clean] Connection to database closed. Pushing changes back to Supabase...');
    const pushSuccess = await dbSync.pushLatestDb();
    if (pushSuccess) {
      console.log('[Clean] SUCCESS! Cleaned database has been pushed to Supabase and is now live!');
    } else {
      console.error('[Clean] FAILURE! Could not push cleaned database to Supabase.');
    }
  });
}

startCleanup();
