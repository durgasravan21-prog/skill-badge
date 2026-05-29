const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('app.db');

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

async function test() {
  try {
    const studentId = 'cb748a8f-6132-4917-afcf-d0824f75a099';
    const skills = await dbAll('SELECT ss.*, s.name FROM student_skills ss JOIN skills s ON ss.skill_id = s.id WHERE ss.student_id = ?', [studentId]);
    console.log('--- Student Skills ---');
    console.log(skills);

    const challenges = await dbAll('SELECT * FROM challenges WHERE student_id = ?', [studentId]);
    console.log('\n--- Challenges ---');
    console.log(challenges);
  } catch (err) {
    console.error(err);
  } finally {
    db.close();
  }
}

test();
