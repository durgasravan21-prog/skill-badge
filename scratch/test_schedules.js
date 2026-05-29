const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('app.db');

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows || []);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

async function test() {
  try {
    // Find all students and print counts
    const students = await dbAll('SELECT id, email FROM users WHERE role = "student"');
    console.log(`Total students: ${students.length}`);
    
    let activeStudent = null;
    for (const stud of students) {
      const skills = await dbAll('SELECT skill_id FROM student_skills WHERE student_id = ?', [stud.id]);
      const schedulesCount = await dbGet('SELECT COUNT(*) as count FROM exam_schedules WHERE invited_student_id = ?', [stud.id]);
      if (skills.length > 0 || schedulesCount.count > 0) {
        activeStudent = stud;
        console.log(`Found active student: ${stud.email} (${stud.id}) with ${skills.length} skills and ${schedulesCount.count} schedules`);
        break;
      }
    }

    if (!activeStudent) {
      activeStudent = students[0];
      if (!activeStudent) {
        console.log('No students found');
        return;
      }
    }

    const student = activeStudent;

    const claimedSkills = await dbAll('SELECT skill_id FROM student_skills WHERE student_id = ?', [student.id]);
    const skillIds = claimedSkills.map(cs => cs.skill_id);
    console.log('Claimed skills:', skillIds);

    const studentChallenges = await dbAll(
      `SELECT id, status, skill_id, company_id, schedule_id 
       FROM challenges 
       WHERE student_id = ? 
       ORDER BY started_at DESC`,
      [student.id]
    );
    console.log('Student challenges count:', studentChallenges.length);

    let schedules;
    if (skillIds.length === 0) {
      schedules = await dbAll(
        `SELECT es.*, s.name as skill_name, c.name as company_name, c.domain as company_domain
         FROM exam_schedules es
         JOIN skills s ON es.skill_id = s.id
         LEFT JOIN companies c ON es.company_id = c.id
         WHERE es.invited_student_id = ?
         ORDER BY es.start_time DESC`,
        [student.id]
      );
    } else {
      const placeholders = skillIds.map(() => '?').join(',');
      schedules = await dbAll(
        `SELECT es.*, s.name as skill_name, c.name as company_name, c.domain as company_domain
         FROM exam_schedules es
         JOIN skills s ON es.skill_id = s.id
         LEFT JOIN companies c ON es.company_id = c.id
         WHERE (
           (es.company_id IS NULL AND es.invited_student_id IS NULL AND es.skill_id IN (${placeholders}))
           OR
           (es.invited_student_id = ?)
         )
         ORDER BY es.start_time DESC`,
        [...skillIds, student.id]
      );
    }

    console.log('Schedules fetched count:', schedules.length);

    const mappedSchedules = schedules.map(es => {
      const match = studentChallenges.find(ch => {
        if (ch.schedule_id === es.id) return true;
        if (es.company_id === null && ch.schedule_id === null && ch.skill_id === es.skill_id) return true;
        if (es.company_id !== null && ch.schedule_id === null && (ch.company_id === es.company_id || ch.company_id === null) && ch.skill_id === es.skill_id) return true;
        return false;
      });

      return {
        ...es,
        attempt_status: match ? match.status : null,
        attempt_id: match ? match.id : null
      };
    });

    console.log('Mapped schedules:', mappedSchedules);
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    db.close();
  }
}

test();
