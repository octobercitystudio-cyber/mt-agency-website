import sqlite3 from 'sqlite3';

const dbFile = 'company_ultra_v3.db';
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);

db.all("SELECT * FROM bookings WHERE client_name = 'شريف عثمان'", (err, rows) => {
  console.log(rows.filter(r => r.service.includes('50')));
});
