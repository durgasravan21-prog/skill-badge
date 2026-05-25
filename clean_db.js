const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('app.db');

db.serialize(() => {
  // Delete mock users
  db.run(`DELETE FROM users WHERE email LIKE '%@test.com' OR email LIKE '%@test2.com' OR email LIKE '%@google.com' OR email LIKE '%@microsoft.com' OR name IN ('Alice Alpha', 'Bob Beta', 'Charlie Gamma', 'Alice Logan')`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} mock users.`);
  });

  // Delete mock companies
  db.run(`DELETE FROM companies WHERE domain IN ('google.com', 'microsoft.com', 'test1.com', 'test2.com') AND id != 'admin-company-uuid'`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} mock companies.`);
  });

  // Delete mock otp_sessions
  db.run(`DELETE FROM otp_sessions`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} otp_sessions.`);
  });

  // Clean up dangling challenges, submissions, evaluations, and student_skills
  db.run(`DELETE FROM challenges WHERE student_id NOT IN (SELECT id FROM users)`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} dangling challenges.`);
  });

  db.run(`DELETE FROM submissions WHERE challenge_id NOT IN (SELECT id FROM challenges)`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} dangling submissions.`);
  });

  db.run(`DELETE FROM evaluations WHERE challenge_id NOT IN (SELECT id FROM challenges)`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} dangling evaluations.`);
  });

  db.run(`DELETE FROM student_skills WHERE student_id NOT IN (SELECT id FROM users)`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} dangling student_skills.`);
  });

  // Clean up dangling exam_schedules, notifications, and exam_photos
  db.run(`DELETE FROM exam_schedules WHERE invited_student_id NOT IN (SELECT id FROM users) OR recruiter_id NOT IN (SELECT id FROM users)`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} dangling exam_schedules.`);
  });

  db.run(`DELETE FROM notifications WHERE recipient_id NOT IN (SELECT id FROM users)`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} dangling notifications.`);
  });

  db.run(`DELETE FROM exam_photos WHERE challenge_id NOT IN (SELECT id FROM challenges)`, function(err) {
    if (err) console.error(err);
    else console.log(`Deleted ${this.changes} dangling exam_photos.`);
  });
});

db.close(() => console.log('Cleanup finished.'));
