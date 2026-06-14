import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qnrndgkiyyytegkaknti.supabase.co';
const supabaseAnonKey = 'sb_publishable_SbmE_zaDXArOJW8HMHmqHw_e7qB1uf2';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
    const { data: services } = await supabase.from('services').select('*').limit(2);
    console.log("Services schema:", services);
}

check();
