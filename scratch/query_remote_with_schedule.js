const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'remote_app.db');
const db = new sqlite3.Database(dbPath);

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
  } else {
    console.log("=== REMOTE CHALLENGES WITH schedule_id FOR student@gmail.com ===");
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
