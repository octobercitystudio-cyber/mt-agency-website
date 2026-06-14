import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qnrndgkiyyytegkaknti.supabase.co';
const supabaseAnonKey = 'sb_publishable_SbmE_zaDXArOJW8HMHmqHw_e7qB1uf2';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function clean() {
  const { error } = await supabase.from('bookings').delete().eq('status', 'active_timer');
  if (error) console.error("Error:", error);
  else console.log("Cleaned up duplicate timers.");
}

clean();
