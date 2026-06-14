import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qnrndgkiyyytegkaknti.supabase.co';
const supabaseAnonKey = 'sb_publishable_SbmE_zaDXArOJW8HMHmqHw_e7qB1uf2';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testInsert() {
  console.log("Attempting insert...");
  const { data, error } = await supabase.from('bookings').insert([{
    client_name: 'test',
    service: 'غير محدد',
    date: new Date().toISOString().split('T')[0],
    start_time: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
    end_time: '',
    actual_hours: 0,
    custom_price: 0,
    discount: 0,
    discount_reason: '',
    delivery_date: null,
    status: 'active_timer',
    notes: new Date().toISOString(),
    payment: 0
  }]);
  
  if (error) {
    console.error("INSERT ERROR:", error);
  } else {
    console.log("INSERT SUCCESS");
  }
}

testInsert();
