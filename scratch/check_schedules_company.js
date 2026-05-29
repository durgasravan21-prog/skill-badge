const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'app.db');
const db = new sqlite3.Database(dbPath);

db.all(`
  SELECT es.id, es.recruiter_id, u.email as recruiter_email, es.company_id, c.name as company_name, es.invited_student_id, es.skill_id
  FROM exam_schedules es
  JOIN users u ON es.recruiter_id = u.id
  LEFT JOIN companies c ON es.company_id = c.id
`, [], (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows, null, 2));
  db.close();
});
