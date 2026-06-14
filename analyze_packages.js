import sqlite3 from 'sqlite3';

const dbFile = 'company_ultra_v3.db';
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);

async function analyzePackages() {
  db.all("SELECT client_name, service, status, SUM(actual_hours) as th, SUM(actual_reels) as tr FROM bookings WHERE status != 'دفعة' GROUP BY client_name, service, status ORDER BY client_name", (err, rows) => {
    if (err) return console.error(err);
    console.log("Client Packages Usage (Old DB):");
    console.log(rows);
  });
}

analyzePackages();
