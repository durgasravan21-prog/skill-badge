const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'app.db');
const db = new sqlite3.Database(dbPath);

db.all(`
  SELECT * FROM companies
`, [], (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows, null, 2));
  db.close();
});
