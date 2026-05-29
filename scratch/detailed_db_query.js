const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'remote_app.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all(`
    SELECT c.id, u.name as student_name, u.email as student_email, c.status, c.started_at, c.submitted_at
    FROM challenges c
    JOIN users u ON c.student_id = u.id
  `, [], (err, challenges) => {
    if (err) console.error(err);
    else console.log("=== ALL REMOTE CHALLENGES ===", JSON.stringify(challenges, null, 2));
  });

  db.all(`
    SELECT es.id, u.name as recruiter_name, u.email as recruiter_email, es.invited_student_id, s.name as skill_name
    FROM exam_schedules es
    JOIN users u ON es.recruiter_id = u.id
    JOIN skills s ON es.skill_id = s.id
  `, [], (err, schedules) => {
    if (err) console.error(err);
    else console.log("=== ALL REMOTE SCHEDULES ===", JSON.stringify(schedules, null, 2));
    db.close();
  });
});
