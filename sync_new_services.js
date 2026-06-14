import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('e:/VScode/موقع الشركة/.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/['"]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

const services_data = [
    {name: 'تصوير ساعة', price: 300.0, category: 'تصوير بالساعة', total_hours: 1, payment_due_hours: 0, validity_days: 0, total_reels: 0},
    {name: 'باقة 2 ساعة', price: 400.0, category: 'باقة يومية', total_hours: 2, payment_due_hours: 0, validity_days: 1, total_reels: 0},
    {name: 'باقة 3 ساعات', price: 600.0, category: 'باقة يومية', total_hours: 3, payment_due_hours: 0, validity_days: 0, total_reels: 0},
    {name: 'باقة 4 ساعات', price: 700.0, category: 'باقة يومية', total_hours: 4, payment_due_hours: 0, validity_days: 0, total_reels: 0},
    {name: 'باقة 5 ساعات', price: 800.0, category: 'باقة يومية', total_hours: 5, payment_due_hours: 0, validity_days: 0, total_reels: 0},
    {name: 'باقة 50 ساعة', price: 7000.0, category: 'باقة شهرية', total_hours: 50, payment_due_hours: 15, validity_days: 75, total_reels: 0},
    {name: 'باقة 10 ساعات', price: 1800.0, category: 'باقة شهرية', total_hours: 10, payment_due_hours: 4, validity_days: 15, total_reels: 0},
    {name: 'باقة 20 ساعة', price: 3400.0, category: 'باقة شهرية', total_hours: 20, payment_due_hours: 7, validity_days: 30, total_reels: 0},
    {name: 'باقة 30 ساعة', price: 4800.0, category: 'باقة شهرية', total_hours: 30, payment_due_hours: 10, validity_days: 45, total_reels: 0},
    {name: 'باقة 40 ساعة', price: 6000.0, category: 'باقة شهرية', total_hours: 40, payment_due_hours: 10, validity_days: 60, total_reels: 0},
    {name: 'باقة 5 ريل مميز', price: 1250.0, category: 'باقة ريلز', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 5},
    {name: 'تصميم لوجو', price: 500.0, category: 'خدمة إضافية', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0},
    {name: 'باقة 10 ريل مميز', price: 2250.0, category: 'باقة ريلز', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 10},
    {name: 'باقة 20 ريل مميز', price: 4000.0, category: 'باقة ريلز', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 20},
    {name: 'ريل مميز ( سعر الدقيقة )', price: 300.0, category: 'باقة ريلز', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 1},
    {name: 'ريل برومو ( سعر الدقيقة )', price: 1000.0, category: 'باقة ريلز', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 1},
    {name: 'برومو مميز', price: 1000.0, category: 'خدمة إضافية', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0},
    {name: 'برومو سينمائي', price: 2000.0, category: 'خدمة إضافية', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0},
    {name: 'برومو اسبيشيال ( تحدد التكلفة على حسب الاحتياجات )', price: 0.0, category: 'خدمة إضافية', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0},
    {name: 'انترو', price: 500.0, category: 'خدمة إضافية', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0},
    {name: 'اوترو', price: 500.0, category: 'خدمة إضافية', total_hours: 0, payment_due_hours: 0, validity_days: 0, total_reels: 0}
];

async function sync() {
    // 1. Fetch existing services
    const { data: existing, error: fetchError } = await supabase.from('services').select('id');
    if (fetchError) {
        console.error('Fetch error:', fetchError);
        return;
    }

    // 2. Delete all existing services
    for (const s of existing) {
        await supabase.from('services').delete().eq('id', s.id);
    }
    console.log('Deleted all existing services.');

    // 3. Insert new services
    for (const s of services_data) {
        const { error } = await supabase.from('services').insert([s]);
        if (error) {
            console.error(`Failed ${s.name}:`, error.message);
        } else {
            console.log(`Success ${s.name}`);
        }
    }
}
sync();
