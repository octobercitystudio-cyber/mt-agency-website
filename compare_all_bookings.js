import { createClient } from '@supabase/supabase-js';
import sqlite3 from 'sqlite3';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const dbFile = 'company_ultra_v3.db';
const db = new sqlite3.Database(dbFile, sqlite3.OPEN_READONLY);

async function compare() {
  const { data: supaBookings } = await supabase.from('bookings').select('*');
  
  db.all("SELECT * FROM bookings", (err, oldBookings) => {
    let diffs = [];
    oldBookings.forEach(oldB => {
      const newB = supaBookings.find(b => b.id === oldB.id);
      if (!newB) {
        diffs.push(`Missing in Supabase: ID ${oldB.id}`);
        return;
      }
      
      const fieldsToCompare = ['client_name', 'status', 'actual_hours', 'actual_reels', 'payment', 'custom_price', 'discount'];
      let rowDiffs = [];
      fieldsToCompare.forEach(f => {
        // Handle float comparison and nulls
        const oldVal = oldB[f] === null ? '' : oldB[f].toString();
        const newVal = newB[f] === null ? '' : newB[f].toString();
        if (oldVal !== newVal) {
          rowDiffs.push(`${f}: SQLite[${oldVal}] vs Supabase[${newVal}]`);
        }
      });
      
      // Compare service name ignoring "(مؤرشف)"
      const oldSrv = oldB.service || '';
      const newSrv = newB.service || '';
      if (oldSrv.replace('(مؤرشف)', '').trim() !== newSrv.replace('(مؤرشف)', '').trim()) {
         rowDiffs.push(`service: SQLite[${oldSrv}] vs Supabase[${newSrv}]`);
      }
      // Check if one has archived but the other doesn't
      if (oldSrv !== newSrv) {
         rowDiffs.push(`service_archived: SQLite[${oldSrv}] vs Supabase[${newSrv}]`);
      }

      if (rowDiffs.length > 0) {
        diffs.push(`ID ${oldB.id} (${oldB.client_name}):\n  ` + rowDiffs.join('\n  '));
      }
    });

    console.log("Differences:");
    console.log(diffs.join('\n\n'));
  });
}
compare();
