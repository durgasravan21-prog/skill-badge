const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'app.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening DB:', err);
    process.exit(1);
  }
});

db.serialize(() => {
  db.run('PRAGMA wal_checkpoint(TRUNCATE);', (err) => {
    if (err) {
      console.error('Error during WAL checkpoint:', err);
    } else {
      console.log('WAL checkpoint completed successfully. All changes are merged.');
    }
    db.close(() => {
      console.log('Database connection closed.');
    });
  });
});
