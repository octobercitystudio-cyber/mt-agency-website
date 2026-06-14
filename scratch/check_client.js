import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const rawData = fs.readFileSync('e:/VScode/موقع الشركة/src/supabaseClient.js', 'utf-8');
const urlMatch = rawData.match(/supabaseUrl\s*=\s*['"]([^'"]+)['"]/);
const keyMatch = rawData.match(/supabaseAnonKey\s*=\s*['"]([^'"]+)['"]/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find supabase credentials");
    process.exit(1);
}

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function check() {
    console.log("Checking phone 01110702225...");
    
    const { data: client, error } = await supabase
        .from('clients')
        .select('*')
        .or('phone1.eq.01110702225,phone2.eq.01110702225');
        
    console.log("Client query result:", { client, error });

    if (client && client.length > 0) {
        const clientName = client[0].name;
        console.log("Found client name:", clientName);
        
        const { data: bookings, error: bError } = await supabase
            .from('bookings')
            .select('*')
            .eq('client_name', clientName);
            
        console.log("Bookings:", bookings?.length, "Error:", bError);
    }
}

check();
