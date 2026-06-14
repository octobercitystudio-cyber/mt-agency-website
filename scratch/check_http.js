import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data } = await supabase.from('app_config').select('value').eq('key', 'website_data').single();
  if (data) {
    const jsonStr = JSON.stringify(data.value);
    const matches = jsonStr.match(/http:\/\/[^\s"]+/g);
    console.log('HTTP URLs found in database:', matches);
  }
}
check();
