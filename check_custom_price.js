import sqlite3 from 'sqlite3';

const dbFile = 'company_ultra_v3.db';
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);

db.all("SELECT custom_price, service FROM bookings WHERE client_name = 'محمد حمدى '", (err, rows) => {
  console.log("Mohamed Hamdy Custom Prices:");
  console.log(rows.filter(r => r.custom_price > 0));
});

db.all("SELECT custom_price, service FROM bookings WHERE client_name = 'عمر محمد'", (err, rows) => {
  console.log("\nOmar Mohamed Custom Prices:");
  console.log(rows.filter(r => r.custom_price > 0));
});
