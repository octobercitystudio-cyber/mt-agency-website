import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const dbFile = 'company_ultra_v3.db';
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);

async function check() {
  const { data: newPayments } = await supabase.from('bookings').select('*').eq('status', 'دفعة');
  console.log("Supabase Payments:", newPayments.map(p => `${p.client_name} - ${p.service} - ${p.payment} EGP - ${p.date}`));

  db.all("SELECT * FROM bookings WHERE status = 'دفعة'", (err, oldPayments) => {
    console.log("\nSQLite Payments:", oldPayments.map(p => `${p.client_name} - ${p.service} - ${p.payment} EGP - ${p.date}`));
  });
}
check();
