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
    const email = 'student@gmail.com';
    const skills = await dbAll('SELECT ss.skill_id, s.name FROM student_skills ss JOIN skills s ON ss.skill_id = s.id WHERE ss.student_id = ?', [studentId]);
    
    for (const skill of skills) {
      console.log(`\n--- Skill: ${skill.name} (${skill.skill_id}) ---`);
      const challenges = await dbAll(
        `SELECT c.difficulty, c.status
         FROM challenges c
         WHERE c.student_id = ? AND c.skill_id = ?`,
        [studentId, skill.skill_id]
      );
      console.log('Challenges:', challenges);

      const hasPassed = (diff) => challenges.some(c => c.difficulty === diff && c.status === 'evaluated');
      const hasDisqualified = challenges.some(c => c.status === 'disqualified');

      console.log('hasPassed("easy"):', hasPassed('easy'));
      console.log('hasPassed("medium"):', hasPassed('medium'));
      console.log('hasPassed("hard"):', hasPassed('hard'));
      console.log('hasDisqualified:', hasDisqualified);

      let targetDifficulty = 'easy';
      if (hasPassed('easy')) targetDifficulty = 'medium';
      if (hasPassed('medium')) targetDifficulty = 'hard';
      
      console.log('targetDifficulty:', targetDifficulty);

      const questions = await dbAll(
        'SELECT * FROM questions WHERE skill_id = ? AND difficulty = ?',
        [skill.skill_id, targetDifficulty]
      );
      console.log('Questions found count:', questions.length);
    }
  } catch (err) {
    console.error(err);
  } finally {
    db.close();
  }
}

test();
