const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'app.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all(`
    SELECT ss.*, s.name as skill_name
    FROM student_skills ss
    JOIN users u ON ss.student_id = u.id
    JOIN skills s ON ss.skill_id = s.id
    WHERE u.email = 'student@gmail.com'
  `, [], (err, rows) => {
    if (err) console.error(err);
    else console.log("=== LOCAL STUDENT SKILLS ===", JSON.stringify(rows, null, 2));
  });

  db.all(`
    SELECT c.id, c.status, s.name as skill_name
    FROM challenges c
    JOIN users u ON c.student_id = u.id
    JOIN skills s ON c.skill_id = s.id
    WHERE u.email = 'student@gmail.com'
  `, [], (err, rows) => {
    if (err) console.error(err);
    else console.log("=== LOCAL CHALLENGES ===", JSON.stringify(rows, null, 2));
    db.close();
  });
});
