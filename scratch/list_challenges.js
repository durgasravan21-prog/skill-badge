const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'app.db');
const db = new sqlite3.Database(dbPath);

db.all(`
  SELECT c.id, u.name as student_name, u.email as student_email, c.status, c.started_at, c.submitted_at
  FROM challenges c
  JOIN users u ON c.student_id = u.id
`, [], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log("=== ALL REMOTE CHALLENGES ===");
    console.log(JSON.stringify(rows, null, 2));
  }
  db.close();
});
