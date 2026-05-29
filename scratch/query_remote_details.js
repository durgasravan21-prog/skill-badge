const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'remote_app.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all(`
    SELECT c.*, s.name as skill_name
    FROM challenges c
    JOIN users u ON c.student_id = u.id
    JOIN skills s ON c.skill_id = s.id
    WHERE u.email = 'student@gmail.com'
  `, [], (err, rows) => {
    if (err) console.error(err);
    else console.log("=== REMOTE CHALLENGES ===", JSON.stringify(rows, null, 2));
  });

  db.all(`
    SELECT ss.*, s.name as skill_name
    FROM student_skills ss
    JOIN users u ON ss.student_id = u.id
    JOIN skills s ON ss.skill_id = s.id
    WHERE u.email = 'student@gmail.com'
  `, [], (err, rows) => {
    if (err) console.error(err);
    else console.log("=== REMOTE STUDENT SKILLS ===", JSON.stringify(rows, null, 2));
  });

  db.all(`
    SELECT * FROM users WHERE email = 'student@gmail.com'
  `, [], (err, users) => {
    if (err) console.error(err);
    else console.log("=== REMOTE USER ===", JSON.stringify(users, null, 2));
    db.close();
  });
});

