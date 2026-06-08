import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8').split('\n').reduce((acc, line) => {
  const [key, ...val] = line.split('=');
  if (key && val) acc[key.trim()] = val.join('=').trim();
  return acc;
}, {});

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: services } = await supabase.from('services').select('*').limit(1);
  console.log('Services Columns:', services ? Object.keys(services[0] || {}) : 'No data');

  const { data: app_config } = await supabase.from('app_config').select('*').limit(1);
  console.log('App Config Columns:', app_config ? Object.keys(app_config[0] || {}) : 'No data');
  
  const { data: clients } = await supabase.from('clients').select('*').limit(1);
  console.log('Clients Columns:', clients ? Object.keys(clients[0] || {}) : 'No data');
}

test();
