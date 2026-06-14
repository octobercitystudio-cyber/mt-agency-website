import sqlite3 from 'sqlite3';

const dbFile = 'company_ultra_v3.db';
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);

db.serialize(() => {
  db.all("SELECT * FROM app_config", (err, rows) => {
    if (err) {
      console.error(err.message);
    } else {
      console.log("APP_CONFIG Table:");
      console.log(rows);
    }
  });
});
