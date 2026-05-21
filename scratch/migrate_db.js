const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const dbSync = require('../dbSync');

(async () => {
  try {
    console.log('1. Pulling latest DB from Supabase to ensure sync...');
    await dbSync.pullLatestDb();
    console.log('Latest DB successfully pulled from Supabase.');

    const dbPath = dbSync.DB_PATH;
    console.log('Local DB path:', dbPath);

    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Failed to open database:', err);
        process.exit(1);
      }
    });

    console.log('2. Running ALTER TABLE statement...');
    db.serialize(() => {
      db.run("ALTER TABLE users ADD COLUMN phone TEXT;", (err) => {
        if (err) {
          if (err.message.includes('duplicate column name') || err.message.includes('already exists')) {
            console.log('Column "phone" already exists. Safe to skip!');
          } else {
            console.error('Failed to alter users table:', err.message);
          }
        } else {
          console.log('Successfully added "phone" column to users table!');
        }

        // Verify columns inside users table
        db.all("PRAGMA table_info(users);", [], (err2, rows) => {
          if (err2) {
            console.error('Failed to query users table schema:', err2);
          } else {
            console.log('--- Current USERS columns ---');
            rows.forEach(r => console.log(` - ${r.name} (${r.type})`));
          }

          // Close DB before pushing
          db.close(async (err3) => {
            if (err3) {
              console.error('Failed to close DB:', err3);
              process.exit(1);
            }
            console.log('3. Pushing modified database to Supabase...');
            const success = await dbSync.pushLatestDb();
            if (success) {
              console.log('🎉 DB migration pushed successfully to Supabase!');
            } else {
              console.error('❌ Failed to push updated DB to Supabase!');
            }
          });
        });
      });
    });
  } catch (err) {
    console.error('Migration runtime error:', err);
  }
})();
