import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fix() {
  const { data } = await supabase.from('bookings').select('*').eq('client_name', 'محمد رمضان');
  console.log("Mohamed Ramadan Bookings:");
  console.log(data);
}
fix();
