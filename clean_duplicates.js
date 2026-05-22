const sqlite3 = require('sqlite3').verbose();
const dbSync = require('./dbSync.js');

async function cleanDuplicates() {
  console.log('Pulling latest DB from Supabase to sync local...');
  await dbSync.pullLatestDb();
  
  const db = new sqlite3.Database('app.db');

  db.serialize(() => {
    // 1. Clean Duplicate Exam Schedules
    console.log('Cleaning duplicate exam_schedules...');
    // Keep the one with the latest start_time for each student + skill combination
    // Or just group by invited_student_id, exam_password
    db.run(`
      DELETE FROM exam_schedules 
      WHERE id NOT IN (
        SELECT MAX(id)
        FROM exam_schedules
        WHERE invited_student_id IS NOT NULL
        GROUP BY invited_student_id, skill_id, exam_password
      ) AND invited_student_id IS NOT NULL
    `);

    // 2. Clean Duplicate Challenges
    console.log('Cleaning duplicate challenges...');
    // Keep the latest challenge per student and skill_id (course), removing foreign key dependents first
    db.run(`
      DELETE FROM submissions WHERE challenge_id IN (
        SELECT id FROM challenges WHERE id NOT IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER(PARTITION BY student_id, skill_id ORDER BY started_at DESC) as rn
            FROM challenges
          ) WHERE rn = 1
        )
      )
    `);
    db.run(`
      DELETE FROM evaluations WHERE challenge_id IN (
        SELECT id FROM challenges WHERE id NOT IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER(PARTITION BY student_id, skill_id ORDER BY started_at DESC) as rn
            FROM challenges
          ) WHERE rn = 1
        )
      )
    `);
    db.run(`
      DELETE FROM violations WHERE challenge_id IN (
        SELECT id FROM challenges WHERE id NOT IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER(PARTITION BY student_id, skill_id ORDER BY started_at DESC) as rn
            FROM challenges
          ) WHERE rn = 1
        )
      )
    `);
    db.run(`
      DELETE FROM exam_photos WHERE challenge_id IN (
        SELECT id FROM challenges WHERE id NOT IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER(PARTITION BY student_id, skill_id ORDER BY started_at DESC) as rn
            FROM challenges
          ) WHERE rn = 1
        )
      )
    `);
    db.run(`
      DELETE FROM challenges WHERE id NOT IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER(PARTITION BY student_id, skill_id ORDER BY started_at DESC) as rn
          FROM challenges
        ) WHERE rn = 1
      )
    `);

    // 3. Clean Duplicate Student Skills
    console.log('Cleaning duplicate student_skills...');
    db.run(`
      DELETE FROM student_skills
      WHERE id NOT IN (
        SELECT id FROM (
          SELECT id,
                 ROW_NUMBER() OVER(PARTITION BY student_id, skill_id ORDER BY verified_score DESC, verified_at DESC) as rn
          FROM student_skills
        ) WHERE rn = 1
      )
    `);
  });

  db.close(async (err) => {
    if (err) {
      console.error(err);
      return;
    }
    console.log('Local duplicates cleaned. Pushing DB back to Supabase...');
    await dbSync.pushLatestDb();
    console.log('Done!');
  });
}

cleanDuplicates();
