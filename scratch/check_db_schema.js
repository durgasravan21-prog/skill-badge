const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'app.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to open database:', err);
    process.exit(1);
  }
});

db.all("PRAGMA table_info(users);", [], (err, rows) => {
  if (err) {
    console.error('Failed to get table info:', err);
    process.exit(1);
  }
  console.log('--- USERS TABLE COLUMNS ---');
  rows.forEach(row => {
    console.log(`Column: ${row.name} (${row.type})`);
  });
  db.close();
});
