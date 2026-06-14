import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixDb() {
  // Fix ID 143
  await supabase.from('bookings').update({
    status: 'نشط',
    service: 'باقة 10 ريل مميز'
  }).eq('id', 143);

  // Fix ID 144
  await supabase.from('bookings').update({
    service: 'باقة 10 ريل مميز'
  }).eq('id', 144);

  // Fix ID 192
  await supabase.from('bookings').update({
    status: 'دفعة',
    service: 'باقة 10 ريل مميز'
  }).eq('id', 192);

  // Fix ID 201
  await supabase.from('bookings').update({
    status: 'منتهي',
    actual_reels: 1
  }).eq('id', 201);

  console.log("Database fixes applied successfully.");
}
fixDb();
