import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
  const { data, error } = await supabase.from('app_config').select('*');

  if (error) {
    console.error("Error querying app_config:", error.message);
  } else {
    console.log(`Anon Key - Found ${data.length} records in app_config.`);
    console.log(data);
  }
}

checkConfig();
