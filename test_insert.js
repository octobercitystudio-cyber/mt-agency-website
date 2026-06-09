import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const env = fs.readFileSync('e:/VScode/موقع الشركة/.env', 'utf-8');
const supabaseUrl = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim().replace(/['"]/g, '');
const supabaseKey = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim().replace(/['"]/g, '');

const supabase = createClient(supabaseUrl, supabaseKey);

const services_data = [
    {"name": 'تصوير خارجي', "price": 300.0, "validity_days": 1, "category": 'تصوير خارجي', "total_hours": 0, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'باقة 2 ساعة', "price": 400.0, "validity_days": 1, "category": 'باقة ساعات', "total_hours": 2, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'باقة 50 ساعة', "price": 7000.0, "validity_days": 75, "category": 'باقة ساعات', "total_hours": 50, "payment_due_hours": 15, "total_reels": 0},
    {"name": 'باقة 5 ريل تصوير', "price": 1250.0, "validity_days": 0, "category": 'باقة ريلز', "total_hours": 0, "payment_due_hours": 0, "total_reels": 5},
    {"name": 'تصوير ريلز', "price": 300.0, "validity_days": 0, "category": 'خدمات منفصلة', "total_hours": 1, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'باقة 10 ساعات', "price": 1800.0, "validity_days": 15, "category": 'باقة ساعات', "total_hours": 10, "payment_due_hours": 4, "total_reels": 0},
    {"name": 'مونتاج ريلز', "price": 500.0, "validity_days": 0, "category": 'مونتاج ديجيتال', "total_hours": 0, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'باقة 3 ساعات', "price": 600.0, "validity_days": 0, "category": 'باقة ساعات', "total_hours": 3, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'باقة 4 ساعات', "price": 700.0, "validity_days": 0, "category": 'باقة ساعات', "total_hours": 4, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'باقة 5 ساعات', "price": 800.0, "validity_days": 0, "category": 'باقة ساعات', "total_hours": 5, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'باقة 20 ساعة', "price": 3400.0, "validity_days": 30, "category": 'باقة ساعات', "total_hours": 20, "payment_due_hours": 7, "total_reels": 0},
    {"name": 'باقة 30 ساعة', "price": 4800.0, "validity_days": 45, "category": 'باقة ساعات', "total_hours": 30, "payment_due_hours": 10, "total_reels": 0},
    {"name": 'باقة 40 ساعة', "price": 6000.0, "validity_days": 60, "category": 'باقة ساعات', "total_hours": 40, "payment_due_hours": 10, "total_reels": 0},
    {"name": 'باقة 10 ريل تصوير', "price": 2250.0, "validity_days": 0, "category": 'باقة ريلز', "total_hours": 0, "payment_due_hours": 0, "total_reels": 10},
    {"name": 'باقة 20 ريل تصوير', "price": 4000.0, "validity_days": 0, "category": 'باقة ريلز', "total_hours": 0, "payment_due_hours": 0, "total_reels": 20},
    {"name": 'يوم تصوير ( داخل الاستوديو )', "price": 300.0, "validity_days": 0, "category": 'باقة ريلز', "total_hours": 0, "payment_due_hours": 0, "total_reels": 1},
    {"name": 'يوم تصوير ( خارج الاستوديو )', "price": 1000.0, "validity_days": 0, "category": 'باقة ريلز', "total_hours": 0, "payment_due_hours": 0, "total_reels": 1},
    {"name": 'يوتيوب طويل', "price": 1000.0, "validity_days": 0, "category": 'مونتاج ديجيتال', "total_hours": 0, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'يوتيوب بودكاست', "price": 2000.0, "validity_days": 0, "category": 'مونتاج ديجيتال', "total_hours": 0, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'يوتيوب بودكاست ( تصوير استوديو صوت بخصم أكتوبر )', "price": 0.0, "validity_days": 0, "category": 'مونتاج ديجيتال', "total_hours": 0, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'فويس', "price": 500.0, "validity_days": 0, "category": 'مونتاج ديجيتال', "total_hours": 0, "payment_due_hours": 0, "total_reels": 0},
    {"name": 'أغنية', "price": 500.0, "validity_days": 0, "category": 'مونتاج ديجيتال', "total_hours": 0, "payment_due_hours": 0, "total_reels": 0}
];

async function sync() {
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
