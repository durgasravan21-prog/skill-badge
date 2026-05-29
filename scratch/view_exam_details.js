const db = require('../database');

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
});

async function check() {
  try {
    const student = await dbGet("SELECT * FROM users WHERE email='student@gmail.com' COLLATE NOCASE");
    console.log("Student:", student);

    const claimedSkills = await dbAll('SELECT skill_id FROM student_skills WHERE student_id = ?', [student.id]);
    const skillIds = claimedSkills.map(cs => cs.skill_id);

    let schedules;
    if (skillIds.length === 0) {
      schedules = await dbAll(
        `SELECT es.*, s.name as skill_name, c.name as company_name, c.domain as company_domain,
                (SELECT status FROM challenges WHERE student_id = ? AND skill_id = es.skill_id AND recruiter_id = es.recruiter_id LIMIT 1) as attempt_status,
                (SELECT id FROM challenges WHERE student_id = ? AND skill_id = es.skill_id AND recruiter_id = es.recruiter_id LIMIT 1) as attempt_id
         FROM exam_schedules es
         JOIN skills s ON es.skill_id = s.id
         LEFT JOIN companies c ON es.company_id = c.id
         ORDER BY es.start_time DESC`,
        [student.id, student.id]
      );
    } else {
      const placeholders = skillIds.map(() => '?').join(',');
      schedules = await dbAll(
        `SELECT es.*, s.name as skill_name, c.name as company_name, c.domain as company_domain,
                (SELECT status FROM challenges WHERE student_id = ? AND skill_id = es.skill_id AND recruiter_id = es.recruiter_id LIMIT 1) as attempt_status,
                (SELECT id FROM challenges WHERE student_id = ? AND skill_id = es.skill_id AND recruiter_id = es.recruiter_id LIMIT 1) as attempt_id
         FROM exam_schedules es
         JOIN skills s ON es.skill_id = s.id
         LEFT JOIN companies c ON es.company_id = c.id
         WHERE es.skill_id IN (${placeholders}) OR es.company_id IS NOT NULL
         ORDER BY es.start_time DESC`,
        [student.id, student.id, ...skillIds]
      );
    }

    console.log("\nSchedules list:");
    schedules.forEach(s => {
      if (s.attempt_status !== null || s.skill_name.includes('SQL') || s.skill_name.includes('Database')) {
        console.log("Found schedule:", s);
      }
    });

  } catch (err) {
    console.error(err);
  }
}

check();
