import sqlite3 from 'sqlite3';

const dbFile = 'company_ultra_v3.db';
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);

db.all("SELECT custom_price, service FROM bookings WHERE client_name = 'عثمان الغرباوى'", (err, rows) => {
  console.log("Othman Custom Prices:");
  console.log(rows.filter(r => r.custom_price > 0));
});

db.all("SELECT * FROM bookings WHERE client_name = 'محمد حمدى '", (err, rows) => {
  console.log("\nMohamed Hamdy Bookings:");
  console.log(rows.filter(r => r.service.includes('10')));
});
