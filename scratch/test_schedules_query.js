const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'remote_app.db');
const db = new sqlite3.Database(dbPath);

const studentId = 'cb748a8f-6132-4917-afcf-d0824f75a099'; // student@gmail.com
const skillIds = [
  '62192218-93ce-4dfa-a413-939e79106469', // Python Programming
  '3eb7f67f-a306-4e4d-8785-4217b86e879b', // C Systems Programming
  '2cc1ea95-38d2-4d2e-954d-27b4436f588f'  // SQL Database Design
];

const placeholders = skillIds.map(() => '?').join(',');

db.all(`
  SELECT es.*, s.name as skill_name, c.name as company_name, c.domain as company_domain,
         (SELECT status FROM challenges WHERE student_id = ? AND (schedule_id = es.id OR (es.company_id IS NULL AND es.invited_student_id IS NULL AND schedule_id IS NULL AND skill_id = es.skill_id)) LIMIT 1) as attempt_status,
         (SELECT id FROM challenges WHERE student_id = ? AND (schedule_id = es.id OR (es.company_id IS NULL AND es.invited_student_id IS NULL AND schedule_id IS NULL AND skill_id = es.skill_id)) LIMIT 1) as attempt_id
  FROM exam_schedules es
  JOIN skills s ON es.skill_id = s.id
  LEFT JOIN companies c ON es.company_id = c.id
  WHERE (es.skill_id IN (${placeholders}) OR es.company_id IS NOT NULL)
    AND (es.invited_student_id IS NULL OR es.invited_student_id = ?)
  ORDER BY es.start_time DESC
`, [studentId, studentId, ...skillIds, studentId], (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log("=== EXACT SCHEDULES QUERY RESULT FOR student@gmail.com ===");
    console.log(JSON.stringify(rows.map(r => ({
      id: r.id,
      skill_name: r.skill_name,
      company_name: r.company_name,
      attempt_status: r.attempt_status,
      attempt_id: r.attempt_id
    })), null, 2));
  }
  db.close();
});
