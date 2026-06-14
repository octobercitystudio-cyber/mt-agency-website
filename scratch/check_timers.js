import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qnrndgkiyyytegkaknti.supabase.co';
const supabaseAnonKey = 'sb_publishable_SbmE_zaDXArOJW8HMHmqHw_e7qB1uf2';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const { data, error } = await supabase.from('bookings').select('*').eq('status', 'active_timer');
  console.log(data);
}

check();
