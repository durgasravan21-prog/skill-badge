const sqlite3 = require('sqlite3').verbose();
const dbSync = require('../dbSync.js');

async function main() {
  console.log('[DB Sync] Pulling latest remote database...');
  await dbSync.pullLatestDb();
  
  const db = new sqlite3.Database(dbSync.DB_PATH);
  
  db.serialize(() => {
    console.log('[DB Sync] Updating student_skills for C Systems Programming to double-badge status...');
    db.run(
      `UPDATE student_skills 
       SET badge_tag = 'C Systems Programming Expert — Verified by SkillProof, Google', 
           verified_by = 'SkillProof, Google' 
       WHERE id = '0fcdc77d-d673-46cc-9dd9-17a68682c6d5'`,
      [],
      function(err) {
        if (err) console.error('[DB Sync] Error updating remote DB:', err.message);
        else console.log(`[DB Sync] Database updated locally/temp. Changes: ${this.changes}`);
      }
    );
  });

  db.close(async () => {
    console.log('[DB Sync] Pushing updated double-badge database to Supabase...');
    await dbSync.pushLatestDb();
    console.log('[DB Sync] Double-badge update finished and synced to Supabase production!');
  });
}

main();
