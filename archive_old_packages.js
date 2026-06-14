import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('e:/VScode/موقع الشركة/.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/['"]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

async function archiveOld() {
    const { data: bookings, error } = await supabase.from('bookings').select('*').not('service', 'like', '%(مؤرشف)%');
    if (error) {
        console.error(error);
        return;
    }

    let count = 0;
    for (const b of bookings) {
        if (b.client_name !== 'شريف عثمان') {
            const newService = b.service + ' (مؤرشف)';
            await supabase.from('bookings').update({ service: newService, status: 'منتهي' }).eq('id', b.id);
            count++;
            console.log(`Archived booking ${b.id} for ${b.client_name}`);
        }
    }
    
    // Also reset debts to 0 for all other clients to be completely clean
    const { data: clients } = await supabase.from('clients').select('*');
    for (const c of clients) {
        if (c.name !== 'شريف عثمان') {
            await supabase.from('clients').update({ debt: 0, dismissed_alerts: '' }).eq('id', c.id);
        }
    }

    console.log(`Archived ${count} bookings and reset debts.`);
}

archiveOld();
