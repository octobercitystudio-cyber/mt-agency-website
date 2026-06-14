import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findBadPayments() {
  const { data } = await supabase.from('bookings').select('*').gt('payment', 0).neq('status', 'دفعة');
  console.log("Bookings with payment > 0 but status != 'دفعة':");
  console.log(data);
}
findBadPayments();
