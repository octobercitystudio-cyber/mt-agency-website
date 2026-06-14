import sqlite3 from 'sqlite3';

const dbFile = 'company_ultra_v3.db';
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
    if (err) return console.error(err);
    console.log("Tables:", tables.map(t => t.name));
    
    // Check bookings schema and data
    db.all("PRAGMA table_info(bookings)", (err, columns) => {
      console.log("\nBookings Schema:");
      console.log(columns);
    });

    db.all("SELECT * FROM bookings ORDER BY id DESC LIMIT 10", (err, rows) => {
      console.log("\nRecent Bookings:");
      console.log(rows);
    });
  });
});
