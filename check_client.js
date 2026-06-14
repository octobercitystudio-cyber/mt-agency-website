import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkClient() {
  const { data } = await supabase.from('clients').select('*').eq('name', 'شريف عثمان');
  console.log(data);
}
checkClient();
