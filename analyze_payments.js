import sqlite3 from 'sqlite3';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const dbFile = 'company_ultra_v3.db';
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  db.all("SELECT * FROM bookings WHERE status = 'دفعة'", async (err, oldPayments) => {
    if (err) return console.error(err);

    // Disable RLS might be needed if using anon key, but we already disabled RLS for finance!
    const { data: financeData } = await supabase.from('finance').select('*').eq('type', 'إيراد');
    const { data: newBookingsData } = await supabase.from('bookings').select('*').eq('status', 'دفعة');

    console.log(`Old DB Payments ('دفعة' in bookings): ${oldPayments.length}`);
    console.log(oldPayments.map(p => `${p.client_name} - ${p.service} - ${p.payment} EGP - ${p.date}`));

    console.log(`\nNew DB Payments ('دفعة' in bookings): ${newBookingsData ? newBookingsData.length : 0}`);
    
    console.log(`\nFinance Revenues (from Supabase): ${financeData ? financeData.length : 0}`);
    financeData?.forEach(f => {
      console.log(`${f.amount} EGP - ${f.detail} - ${f.date}`);
    });
  });
}

analyze();
