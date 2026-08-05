import { getProjectStageTemplate } from './projectStageTemplates.js';
import { allocateFormationExpense, summarizeFormationFund, toCents } from './formationFundMath.js';
import { socialAmountToCents, socialCentsToAmount, summarizeSocialProfits } from './socialProfitMath.js';
import { cairoDateKey, centsToMoney, moneyToCents, packageFinancialSummary, packageQuantitySummary, remainingBusinessDays } from './businessFormat.js';

const STORAGE_KEY = 'mt_agency_erp_demo_v12';

let demoMode = false;
let demoRole = 'owner';

const pad = value => String(value).padStart(2, '0');
const dateOnly = (offset = 0) => {
  const value = new Date();
  value.setHours(12, 0, 0, 0);
  value.setDate(value.getDate() + offset);
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};
const dateTime = (offset = 0, time = '12:00:00') => `${dateOnly(offset)} ${time}`;
const nowText = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
const clone = value => JSON.parse(JSON.stringify(value));

const createDemoDatabase = () => ({
  clients: [
    { id: 1, name: 'سارة أحمد', company_name: 'سارة بيوتي', contact_person: 'سارة أحمد', phone1: '01012345678', phone2: '01124567890', email: 'sara@example.com', job: 'صاحبة علامة تجارية', address: 'الشيخ زايد', city: 'الجيزة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#2563eb', notes: 'تفضل مواعيد بعد الساعة 4 مساءً', debt: 0, credit: 500, points: 180, points_updated_at: dateOnly(-12), status: 'active', created_at: dateTime(-120) },
    { id: 2, name: 'د. محمد عادل', company_name: 'أكاديمية عادل', contact_person: 'محمد عادل', phone1: '01023456789', email: 'adel@example.com', job: 'مدرب أعمال', address: 'المهندسين', city: 'الجيزة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#7c3aed', notes: 'تصوير كورسات تعليمية طويلة', debt: 2500, credit: 0, points: 95, points_updated_at: dateOnly(-25), status: 'active', created_at: dateTime(-95) },
    { id: 3, name: 'محمود سامي', company_name: 'Fit House', contact_person: 'محمود سامي', phone1: '01034567890', email: 'fit@example.com', job: 'مدير تسويق', address: '6 أكتوبر', city: 'الجيزة', preferred_contact: 'phone', whatsapp_opt_in: 1, color: '#059669', notes: 'عميل باقة ريلز شهرية', debt: 0, credit: 0, points: 210, points_updated_at: dateOnly(-5), status: 'active', created_at: dateTime(-80) },
    { id: 4, name: 'نور خالد', company_name: 'Noura Home', contact_person: 'نور خالد', phone1: '01045678901', email: 'noura@example.com', job: 'صاحبة متجر', address: 'التجمع الخامس', city: 'القاهرة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#db2777', notes: 'تحتاج اعتماد المحتوى قبل النشر', debt: 0, credit: 1200, points: 70, points_updated_at: dateOnly(-30), status: 'active', created_at: dateTime(-62) },
    { id: 5, name: 'أحمد يوسف', company_name: 'Youssef Dental', contact_person: 'أحمد يوسف', phone1: '01056789012', email: 'dental@example.com', job: 'طبيب أسنان', address: 'الدقي', city: 'الجيزة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#ea580c', notes: '', debt: 1500, credit: 0, points: 40, points_updated_at: dateOnly(-18), status: 'active', created_at: dateTime(-48) },
    { id: 6, name: 'ريم مصطفى', company_name: 'Reem Fashion', contact_person: 'ريم مصطفى', phone1: '01067890123', email: 'reem@example.com', job: 'مصممة أزياء', address: 'مدينة نصر', city: 'القاهرة', preferred_contact: 'whatsapp', whatsapp_opt_in: 1, color: '#0891b2', notes: 'عميلة جديدة', debt: 0, credit: 0, points: 0, points_updated_at: dateOnly(-3), status: 'active', created_at: dateTime(-15) },
  ],
  users: [
    { id: 1, full_name: 'أشرف محمد', email: 'ashraf@demo.local', phone: '01000000001', role: 'owner', is_active: 1, created_at: dateTime(-365) },
    { id: 2, full_name: 'مروة علي', email: 'marwa@demo.local', phone: '01000000002', role: 'owner', is_active: 1, created_at: dateTime(-365) },
    { id: 3, full_name: 'كريم حسن', email: 'karim@demo.local', phone: '01000000003', role: 'operations', is_active: 1, created_at: dateTime(-40) },
    { id: 4, full_name: 'ليلى عمر', email: 'layla@demo.local', phone: '01000000004', role: 'staff', is_active: 1, created_at: dateTime(-25) },
  ],
  services: [
    { id: 101, name: 'باقة تصوير محتوى 10 ساعات', category: 'باقة شهرية', billing_unit: 'hour', price: 12000, total_hours: 10, payment_due_hours: 5, total_reels: 0, validity_days: 90, deposit_percent: 30, overage_price: 1400, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 1, is_active: 1 },
    { id: 102, name: 'باقة 8 ريلز', category: 'باقة ريلز', billing_unit: 'reel', price: 8000, total_hours: 0, payment_due_hours: 0, total_reels: 8, validity_days: 60, deposit_percent: 50, overage_price: 1200, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 1, is_active: 1 },
    { id: 103, name: 'يوم تصوير استديو', category: 'باقة يومية', billing_unit: 'hour', price: 6500, total_hours: 6, payment_due_hours: 3, total_reels: 0, validity_days: 30, deposit_percent: 50, overage_price: 1300, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 1, is_active: 1 },
    { id: 104, name: 'إدارة سوشيال ميديا شهرية', category: 'خدمة إضافية', billing_unit: 'month', price: 18000, total_hours: 0, payment_due_hours: 0, total_reels: 0, validity_days: 30, deposit_percent: 100, overage_price: 0, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 0, is_active: 1 },
    { id: 105, name: 'تصوير ريل واحد', category: 'باقة ريلز', billing_unit: 'reel', price: 1800, total_hours: 0, payment_due_hours: 0, total_reels: 1, validity_days: 14, deposit_percent: 100, overage_price: 1800, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 1, is_active: 1 },
    { id: 106, name: 'إنتاج إعلان تجاري', category: 'خدمة إضافية', billing_unit: 'project', price: 35000, total_hours: 0, payment_due_hours: 0, total_reels: 0, validity_days: 90, deposit_percent: 50, overage_price: 0, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 0, is_active: 1 },
  ],
  resources: [{ id: 1, name: 'الاستديو الرئيسي', type: 'studio', is_active: 1 }],
  client_packages: [
    { id: 201, client_id: 1, service_id: 101, name: 'باقة صناعة المحتوى', billing_unit: 'hour', purchased_quantity: 10, held_quantity: 2, consumed_quantity: 5.5, payment_due_quantity: 5, deposit_percent_snapshot: 30, overage_price_snapshot: 1400, total_price: 12000, overage_amount: 0, paid_amount: 6000, starts_at: dateOnly(-35), expires_at: dateOnly(55), status: 'active', created_at: dateTime(-35) },
    { id: 202, client_id: 1, service_id: 102, name: 'ريلز إطلاق المنتج', billing_unit: 'reel', purchased_quantity: 8, held_quantity: 1, consumed_quantity: 3, payment_due_quantity: 4, deposit_percent_snapshot: 50, overage_price_snapshot: 1200, total_price: 8000, overage_amount: 0, paid_amount: 8000, starts_at: dateOnly(-20), expires_at: dateOnly(40), status: 'active', source_invoice_id: 701, created_at: dateTime(-20) },
    { id: 203, client_id: 2, service_id: 101, name: 'تصوير الكورس المتقدم', billing_unit: 'hour', purchased_quantity: 20, held_quantity: 3, consumed_quantity: 12.25, payment_due_quantity: 10, deposit_percent_snapshot: 30, overage_price_snapshot: 1300, total_price: 22000, overage_amount: 325, paid_amount: 10000, starts_at: dateOnly(-50), expires_at: dateOnly(18), status: 'active', created_at: dateTime(-50) },
    { id: 204, client_id: 3, service_id: 102, name: 'ريلز Fit House', billing_unit: 'reel', purchased_quantity: 12, held_quantity: 2, consumed_quantity: 7, payment_due_quantity: 6, deposit_percent_snapshot: 50, overage_price_snapshot: 1100, total_price: 11000, overage_amount: 0, paid_amount: 5500, starts_at: dateOnly(-28), expires_at: dateOnly(32), status: 'active', created_at: dateTime(-28) },
    { id: 205, client_id: 4, service_id: 104, name: 'إدارة حسابات أغسطس', billing_unit: 'month', purchased_quantity: 1, held_quantity: 0, consumed_quantity: 0, payment_due_quantity: 0, deposit_percent_snapshot: 100, overage_price_snapshot: 0, total_price: 18000, overage_amount: 0, paid_amount: 18000, starts_at: dateOnly(-4), expires_at: dateOnly(26), status: 'active', source_invoice_id: 702, created_at: dateTime(-4) },
    { id: 206, client_id: 5, service_id: 103, name: 'يوم تصوير العيادة', billing_unit: 'hour', purchased_quantity: 6, held_quantity: 1.5, consumed_quantity: 4.5, payment_due_quantity: 3, deposit_percent_snapshot: 50, overage_price_snapshot: 1300, total_price: 6500, overage_amount: 0, paid_amount: 3250, starts_at: dateOnly(-22), expires_at: dateOnly(8), status: 'active', created_at: dateTime(-22) },
    { id: 207, client_id: 6, service_id: 105, name: 'ريل تجريبي', billing_unit: 'reel', purchased_quantity: 1, held_quantity: 0, consumed_quantity: 1, payment_due_quantity: 1, deposit_percent_snapshot: 100, overage_price_snapshot: 1800, total_price: 1800, overage_amount: 0, paid_amount: 1800, starts_at: dateOnly(-12), expires_at: dateOnly(2), status: 'completed', created_at: dateTime(-12) },
  ],
  bookings: [
    { id: 301, client_id: 1, client_name: 'سارة أحمد', client_package_id: 201, service_id: 101, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير محتوى منتجات', date: dateOnly(0), start_time: '13:00:00', end_time: '15:00:00', status: 'confirmed', requested_quantity: 2, notes: 'تصوير الحملة الصيفية', payment: 0, created_at: dateTime(-5) },
    { id: 302, client_id: 2, client_name: 'د. محمد عادل', client_package_id: 203, service_id: 101, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير كورس تعليمي', date: dateOnly(0), start_time: '16:00:00', end_time: '19:00:00', status: 'confirmed', requested_quantity: 3, notes: 'الوحدات 5 إلى 7', payment: 0, created_at: dateTime(-7) },
    { id: 303, client_id: 3, client_name: 'محمود سامي', client_package_id: 204, service_id: 102, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير ريلز', date: dateOnly(2), start_time: '18:00:00', end_time: '20:00:00', status: 'pending', requested_quantity: 2, requested_reels: 2, notes: 'ريلز تمارين قصيرة', payment: 0, created_at: dateTime(-1, '19:10:00') },
    { id: 304, client_id: 4, client_name: 'نور خالد', client_package_id: 205, service_id: 104, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'جلسة خطة محتوى', date: dateOnly(4), start_time: '14:00:00', end_time: '15:00:00', status: 'confirmed', requested_quantity: 1, notes: 'مراجعة تقويم الشهر', payment: 0, created_at: dateTime(-8) },
    { id: 305, client_id: 5, client_name: 'أحمد يوسف', client_package_id: 206, service_id: 103, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير العيادة', date: dateOnly(6), start_time: '17:30:00', end_time: '19:00:00', status: 'cancel_requested', requested_quantity: 1.5, notes: 'طلب إلغاء لظرف طارئ', payment: 0, created_at: dateTime(-9) },
    { id: 306, client_id: 1, client_name: 'سارة أحمد', client_package_id: 202, service_id: 102, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير ريلز', date: dateOnly(9), start_time: '19:00:00', end_time: '20:30:00', status: 'alternative_proposed', requested_quantity: 1, requested_reels: 1, notes: 'تم اقتراح موعد بديل', payment: 0, created_at: dateTime(-2) },
    { id: 307, client_id: 1, client_name: 'سارة أحمد', client_package_id: 201, service_id: 101, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'جلسة تصوير سابقة', date: dateOnly(-10), start_time: '15:00:00', end_time: '16:45:00', status: 'completed', requested_quantity: 2, billable_quantity: 1.75, actual_seconds: 6300, payment: 0, created_at: dateTime(-15) },
    { id: 308, client_id: 2, client_name: 'د. محمد عادل', client_package_id: 203, service_id: 101, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير كورس سابق', date: dateOnly(-18), start_time: '12:30:00', end_time: '16:00:00', status: 'completed', requested_quantity: 3.5, billable_quantity: 3.25, actual_seconds: 11700, payment: 0, created_at: dateTime(-23) },
    { id: 309, client_id: 1, client_name: 'سارة أحمد', client_package_id: null, project_id: 1111, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير 8 ريلز', date: dateOnly(3), start_time: '17:00:00', end_time: '20:00:00', status: 'confirmed', requested_quantity: 8, notes: 'وقت التصوير فقط؛ التكلفة محسوبة بعدد الريلز.', payment: 0, created_at: dateTime(-4) },
    { id: 310, client_id: 2, client_name: 'د. محمد عادل', client_package_id: null, project_id: 1115, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: 'تصوير بودكاست', date: dateOnly(5), start_time: '15:00:00', end_time: '18:00:00', status: 'pending', requested_quantity: 3, notes: 'تصوير حلقتين مع المونتاج.', payment: 0, created_at: dateTime(-2) },
    { id: 311, client_id: 3, client_name: 'محمود سامي', client_package_id: null, project_id: 1117, resource_id: 1, resource_name: 'موقع الإيفنت', service: 'تغطية بطولة Fit House', date: dateOnly(4), start_time: '14:00:00', end_time: '20:00:00', status: 'confirmed', requested_quantity: 6, notes: 'تغطية خارجية بفريق تصوير ثنائي.', payment: 0, created_at: dateTime(-1) },
  ],
  reschedule_requests: [{ id: 401, booking_id: 304, client_id: 4, old_date: dateOnly(4), old_start_time: '14:00:00', proposed_date: dateOnly(5), proposed_start_time: '16:00:00', proposed_end_time: '17:00:00', reason: 'ارتباط بموعد شحن المنتجات', status: 'pending', created_at: dateTime(-1, '10:30:00') }],
  payment_proofs: [
    { id: 501, client_id: 2, client_package_id: 203, invoice_id: null, amount: 5000, original_name: 'instapay-mohamed.jpg', mime_type: 'image/jpeg', status: 'pending', admin_note: '', created_at: dateTime(-1, '18:20:00') },
    { id: 502, client_id: 5, client_package_id: 206, invoice_id: null, amount: 3250, original_name: 'transfer-dental.jpg', mime_type: 'image/jpeg', status: 'pending', admin_note: '', created_at: dateTime(0, '11:15:00') },
    { id: 503, client_id: 1, client_package_id: 202, invoice_id: 701, amount: 4000, original_name: 'approved-sara.jpg', mime_type: 'image/jpeg', status: 'approved', admin_note: 'تمت المطابقة', payment_id: 601, created_at: dateTime(-18) },
  ],
  payments: [
    { id: 601, client_id: 1, amount: 4000, method: 'إنستاباي', status: 'approved', reference: 'DEMO-503', created_at: dateTime(-18), reviewed_at: dateTime(-17) },
    { id: 602, client_id: 4, amount: 18000, method: 'تحويل بنكي', status: 'approved', reference: 'INV-702', created_at: dateTime(-4), reviewed_at: dateTime(-4, '18:00:00') },
    { id: 603, client_id: 1, amount: 4000, method: 'bank_transfer', status: 'approved', reference: 'PKG-201-A', created_at: dateTime(-34), reviewed_at: dateTime(-34, '14:00:00') },
    { id: 604, client_id: 1, amount: 2000, method: 'cash', status: 'approved', reference: 'PKG-201-B', created_at: dateTime(-12), reviewed_at: dateTime(-12, '17:30:00') },
    { id: 605, client_id: 1, amount: 4000, method: 'bank_transfer', status: 'approved', reference: 'INV-701-LEGACY', created_at: dateTime(-19), reviewed_at: dateTime(-19, '16:00:00') },
    { id: 606, client_id: 3, amount: 5500, method: 'instapay', status: 'approved', reference: 'PKG-204-A', created_at: dateTime(0), reviewed_at: dateTime(0, '13:00:00') },
    { id: 607, client_id: 1, amount: 6000, method: 'vodafone_cash', status: 'approved', reference: 'PRJ-1111-A', created_at: dateTime(-10), reviewed_at: dateTime(-10, '19:00:00') },
    { id: 608, client_id: 1, amount: 1000, method: 'bank_transfer', status: 'approved', reference: 'MULTI-201-202', created_at: dateTime(-6), reviewed_at: dateTime(-6, '16:00:00') },
  ],
  payment_allocations: [
    { id: 6101, client_id: 1, payment_id: 603, payment_proof_id: null, client_package_id: 201, invoice_id: null, amount: 4000, created_at: dateTime(-34, '14:00:00') },
    { id: 6102, client_id: 1, payment_id: 604, payment_proof_id: null, client_package_id: 201, invoice_id: null, amount: 2000, created_at: dateTime(-12, '17:30:00') },
    { id: 6103, client_id: 1, payment_id: 601, payment_proof_id: 503, client_package_id: 202, invoice_id: 701, amount: 4000, created_at: dateTime(-17) },
    { id: 6104, client_id: 1, payment_id: 605, payment_proof_id: null, client_package_id: null, invoice_id: 701, amount: 4000, created_at: dateTime(-19, '16:00:00') },
    { id: 6105, client_id: 4, payment_id: 602, payment_proof_id: null, client_package_id: 205, invoice_id: 702, amount: 18000, created_at: dateTime(-4, '18:00:00') },
    { id: 6106, client_id: 3, payment_id: 606, payment_proof_id: null, client_package_id: 204, invoice_id: null, amount: 5500, created_at: dateTime(0, '13:00:00') },
    { id: 6107, client_id: 1, payment_id: 607, payment_proof_id: null, client_package_id: null, invoice_id: 711, amount: 6000, created_at: dateTime(-10, '19:00:00') },
    { id: 6108, client_id: 1, payment_id: 608, payment_proof_id: null, client_package_id: 201, invoice_id: null, amount: 500, created_at: dateTime(-6, '16:00:00') },
    { id: 6109, client_id: 1, payment_id: 608, payment_proof_id: null, client_package_id: 202, invoice_id: 701, amount: 500, created_at: dateTime(-6, '16:00:00') },
  ],
  invoices: [
    { id: 701, client_id: 1, offer_id: 801, invoice_number: 'INV-DEMO-001', subtotal: 8500, discount: 500, total: 8000, paid_amount: 8000, issued_at: dateOnly(-20), due_at: dateOnly(-10), status: 'paid', created_at: dateTime(-20) },
    { id: 702, client_id: 4, offer_id: 803, invoice_number: 'INV-DEMO-002', subtotal: 18000, discount: 0, total: 18000, paid_amount: 18000, issued_at: dateOnly(-4), due_at: dateOnly(3), status: 'paid', created_at: dateTime(-4) },
    { id: 703, client_id: 2, offer_id: null, invoice_number: 'INV-DEMO-003', subtotal: 22000, discount: 0, total: 22000, paid_amount: 10000, issued_at: dateOnly(-50), due_at: dateOnly(1), status: 'issued', created_at: dateTime(-50) },
    { id: 711, client_id: 1, project_id: 1111, invoice_number: 'INV-PRJ-1111', subtotal: 12000, discount: 0, total: 12000, paid_amount: 6000, issued_at: dateOnly(-10), due_at: dateOnly(5), status: 'issued', created_at: dateTime(-10) },
    { id: 712, client_id: 5, project_id: 1112, invoice_number: 'INV-PRJ-1112', subtotal: 38000, discount: 0, total: 38000, paid_amount: 12000, issued_at: dateOnly(-6), due_at: dateOnly(8), status: 'issued', created_at: dateTime(-6) },
    { id: 713, client_id: 1, project_id: 1113, invoice_number: 'INV-PRJ-1113', subtotal: 42000, discount: 0, total: 42000, paid_amount: 21000, issued_at: dateOnly(-24), due_at: dateOnly(7), status: 'issued', created_at: dateTime(-24) },
    { id: 714, client_id: 2, project_id: 1114, invoice_number: 'INV-PRJ-1114', subtotal: 65000, discount: 0, total: 65000, paid_amount: 20000, issued_at: dateOnly(-15), due_at: dateOnly(15), status: 'issued', created_at: dateTime(-15) },
    { id: 715, client_id: 2, project_id: 1115, invoice_number: 'INV-PRJ-1115', subtotal: 16000, discount: 0, total: 16000, paid_amount: 8000, issued_at: dateOnly(-8), due_at: dateOnly(4), status: 'issued', created_at: dateTime(-8) },
    { id: 716, client_id: 4, project_id: 1116, invoice_number: 'INV-PRJ-1116', subtotal: 18000, discount: 0, total: 18000, paid_amount: 18000, issued_at: dateOnly(-12), due_at: dateOnly(-2), status: 'paid', created_at: dateTime(-12) },
    { id: 717, client_id: 3, project_id: 1117, invoice_number: 'INV-PRJ-1117', subtotal: 28000, discount: 0, total: 28000, paid_amount: 8000, issued_at: dateOnly(-2), due_at: dateOnly(3), status: 'issued', created_at: dateTime(-2) },
    { id: 718, client_id: 6, project_id: 1118, invoice_number: 'INV-PRJ-1118', subtotal: 15000, discount: 0, total: 15000, paid_amount: 7500, issued_at: dateOnly(-5), due_at: dateOnly(6), status: 'issued', created_at: dateTime(-5) },
  ],
  offers: [
    { id: 801, client_id: 1, offer_number: 'OFF-DEMO-001', title: 'حملة إطلاق منتج جديد', subtotal: 18000, discount: 1500, total: 16500, valid_until: dateOnly(10), status: 'sent', notes: 'يشمل التصوير والمونتاج والتسليم الرقمي.', created_by_role: 'owner', created_at: dateTime(-3) },
    { id: 802, client_id: 3, offer_number: 'OFF-DEMO-002', title: 'باقة محتوى لياقة شهرية', subtotal: 14000, discount: 1000, total: 13000, valid_until: dateOnly(6), status: 'draft', notes: '12 ريل مع نسخ إعلانية.', created_by_role: 'owner', created_at: dateTime(-1) },
    { id: 803, client_id: 4, offer_number: 'OFF-DEMO-003', title: 'إدارة وتسويق المتجر', subtotal: 18000, discount: 0, total: 18000, valid_until: dateOnly(20), status: 'accepted', notes: 'خطة شهر كامل.', created_by_role: 'owner', created_at: dateTime(-8) },
  ],
  offer_items: [
    { id: 1, offer_id: 801, service_id: 102, description: 'إنتاج 8 فيديوهات قصيرة', quantity: 8, unit: 'reel', unit_price: 1500, total: 12000 },
    { id: 2, offer_id: 801, service_id: 101, description: 'جلسة تصوير منتجات', quantity: 5, unit: 'hour', unit_price: 1200, total: 6000 },
    { id: 3, offer_id: 802, service_id: 102, description: 'إنتاج 12 ريل رياضي', quantity: 12, unit: 'reel', unit_price: 1000, total: 12000 },
    { id: 4, offer_id: 802, service_id: 104, description: 'خطة نشر ونسخ إعلانية', quantity: 1, unit: 'month', unit_price: 2000, total: 2000 },
    { id: 5, offer_id: 803, service_id: 104, description: 'إدارة سوشيال ميديا شهرية', quantity: 1, unit: 'month', unit_price: 18000, total: 18000 },
  ],
  finance: [
    { id: 901, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 1, amount: 4000, method: 'bank_transfer', detail: 'دفعة باقة صناعة المحتوى', date: dateOnly(-4), entity: 'الشركة', source_type: 'payment', source_id: 603, correlation_id: 'payment:603', is_system: 1 },
    { id: 902, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 4, amount: 18000, method: 'تحويل بنكي', detail: 'سداد إدارة حسابات أغسطس', date: dateOnly(-4), entity: 'الشركة', source_type: 'payment', source_id: 602, correlation_id: 'payment:602', is_system: 1 },
    { id: 903, type: 'مصروف', entry_kind: 'expense', category: 'rent', amount: 6500, method: 'كاش', detail: 'إيجار الاستديو', date: dateOnly(-3), entity: 'الشركة' },
    { id: 904, type: 'مصروف', entry_kind: 'expense', category: 'equipment', amount: 3200, method: 'إنستاباي', detail: 'صيانة إضاءة وكابلات', date: dateOnly(-2), entity: 'الشركة' },
    { id: 905, type: 'مصروف', entry_kind: 'expense', category: 'marketing', amount: 1750, method: 'فودافون كاش', detail: 'ميزانية إعلان ممول', date: dateOnly(-1), entity: 'الشركة' },
    { id: 906, type: 'مصروف', entry_kind: 'expense', category: 'partner_expense', amount: 900, method: 'كاش', detail: 'مشتريات تشغيل - أشرف', date: dateOnly(-6), entity: 'أشرف' },
    { id: 907, type: 'مصروف', entry_kind: 'expense', category: 'partner_expense', amount: 650, method: 'كاش', detail: 'انتقالات تصوير - مروة', date: dateOnly(-5), entity: 'مروة' },
    { id: 908, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 3, amount: 5500, method: 'instapay', detail: 'دفعة باقة ريلز Fit House', date: dateOnly(0), entity: 'الشركة', source_type: 'payment', source_id: 606, correlation_id: 'payment:606', is_system: 1 },
    { id: 909, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 1, amount: 2000, method: 'cash', detail: 'دفعة تكميلية لباقة صناعة المحتوى', date: dateOnly(-12), entity: 'الشركة', source_type: 'payment', source_id: 604, correlation_id: 'payment:604', is_system: 1 },
    { id: 910, type: 'إيراد', entry_kind: 'income', category: 'client_payment', client_id: 1, amount: 4000, method: 'إنستاباي (InstaPay)', detail: 'اعتماد إثبات تحويل', date: dateOnly(-3), entity: 'الشركة', source_type: 'payment_proof', source_id: 503, correlation_id: 'proof:503', is_system: 1 },
    { id: 911, type: 'إيراد', entry_kind: 'income', category: 'other_income', client_id: null, amount: 1250, method: 'كاش', detail: 'بيع معدات تصوير قديمة', date: dateOnly(-2), entity: 'الشركة', source_type: null, source_id: null, is_system: 0 },
    { id: 912, type: 'إيراد', entry_kind: 'income', category: 'project_payment', client_id: 1, amount: 6000, method: 'vodafone_cash', detail: 'دفعة مشروع إنتاج ريلز', date: dateOnly(-2), entity: 'الشركة', source_type: 'payment', source_id: 607, correlation_id: 'payment:607', is_system: 1 },
    { id: 913, type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: 1, amount: 1000, method: 'bank_transfer', detail: 'دفعة موزعة على باقتين', date: dateOnly(-1), entity: 'الشركة', source_type: 'payment', source_id: 608, correlation_id: 'payment:608', is_system: 1 },
    { id: 914, type: 'إيراد', entry_kind: 'income', category: 'client_revenue', client_id: 4, amount: 2750, method: 'cash', detail: 'استشارة خطة محتوى', date: dateOnly(-1), entity: 'الشركة', source_type: 'service', source_id: 104, is_system: 0 },
    { id: 915, type: 'تحويل صادر', entry_kind: 'transfer_out', category: 'internal_transfer', client_id: null, amount: 3000, method: 'cash', detail: 'تحويل داخلي من الكاش إلى إنستاباي', date: dateOnly(0), entity: 'الشركة', source_type: 'internal_transfer', source_id: null, correlation_id: 'demo-transfer-01', is_system: 1 },
    { id: 916, type: 'تحويل وارد', entry_kind: 'transfer_in', category: 'internal_transfer', client_id: null, amount: 3000, method: 'instapay', detail: 'تحويل داخلي إلى إنستاباي من الكاش', date: dateOnly(0), entity: 'الشركة', source_type: 'internal_transfer', source_id: null, correlation_id: 'demo-transfer-01', is_system: 1 },
  ],
  reminders: [
    { id: 1001, title: 'تسليم مونتاج ريلز سارة', due_date: dateTime(1, '18:00:00'), type: 'تسليم', status: 'pending', priority: 'high', amount: 0, notes: 'إرسال النسخة الأولى للمراجعة' },
    { id: 1002, title: 'متابعة دفعة أكاديمية عادل', due_date: dateTime(2, '13:00:00'), type: 'تحصيل', status: 'pending', priority: 'high', amount: 5000, notes: 'تجاوزت الباقة ساعات الدفع' },
    { id: 1003, title: 'تجهيز ديكور تصوير العيادة', due_date: dateTime(4, '15:00:00'), type: 'تجهيز', status: 'pending', priority: 'normal', amount: 0, notes: '' },
    { id: 1004, title: 'تجديد اشتراك أداة الجدولة', due_date: dateTime(8, '12:00:00'), type: 'مصروف دوري', status: 'pending', priority: 'normal', amount: 750, is_recurring: 1, recurrence: 'monthly', notes: '' },
    { id: 1005, title: 'اعتماد خطة محتوى Noura Home', due_date: dateTime(-1, '17:00:00'), type: 'اعتماد', status: 'pending', priority: 'high', amount: 0, notes: 'متأخرة يومًا' },
  ],
  projects: [
    { id: 1101, client_id: 1, client_package_id: null, name: 'إطلاق مجموعة الصيف — 8 ريلز', category: 'reels', service_type: 'reels', pricing_model: 'per_reel', quantity: 8, unit_label: 'reel', agreed_price: 12000, requires_booking: 1, progress_percent: 70, status: 'active', starts_at: dateOnly(-12), due_at: dateOnly(18), notes: 'حملة ريلز وصور منتجات', created_by: 1, created_at: dateTime(-12), updated_at: dateTime(-1) },
    { id: 1102, client_id: 2, client_package_id: null, name: 'منصة الكورس المتقدم في الإدارة', category: 'software', service_type: 'software', pricing_model: 'custom', quantity: 1, unit_label: 'project', agreed_price: 45000, requires_booking: 0, progress_percent: 58, status: 'active', starts_at: dateOnly(-30), due_at: dateOnly(25), notes: 'منصة ويب لعرض 12 وحدة تعليمية وإدارة المشتركين', created_by: 2, created_at: dateTime(-30), updated_at: dateTime(-2) },
    { id: 1103, client_id: 4, client_package_id: null, name: 'إدارة Noura Home — أغسطس', category: 'social_media', service_type: 'social_media', pricing_model: 'monthly', quantity: 1, unit_label: 'month', agreed_price: 18000, requires_booking: 0, progress_percent: 35, status: 'planning', starts_at: dateOnly(-4), due_at: dateOnly(26), monthly_cycle_day: 1, notes: 'تقويم شهري ومنشورات المتجر', created_by: 1, created_at: dateTime(-4), updated_at: dateTime(0) },
    { id: 1104, client_id: 3, client_package_id: null, name: 'حملة تحدي Fit House', category: 'event_coverage', service_type: 'event_coverage', pricing_model: 'custom', quantity: 1, unit_label: 'event', agreed_price: 24000, requires_booking: 1, progress_percent: 20, status: 'on_hold', starts_at: dateOnly(-15), due_at: dateOnly(15), notes: 'بانتظار اعتماد عروض الاشتراك ومتطلبات يوم التغطية', created_by: 2, created_at: dateTime(-15), updated_at: dateTime(-3) },
    { id: 1111, client_id: 1, invoice_id: 711, name: 'حملة 8 ريلز لإطلاق الصيف', category: 'reels', service_type: 'reels', pricing_model: 'per_reel', quantity: 8, unit_label: 'reel', agreed_price: 12000, requires_booking: 1, progress_percent: 65, status: 'active', starts_at: dateOnly(-10), due_at: dateOnly(12), notes: 'السعر محسوب بعدد الريلز، والموعد مخصص للتصوير فقط.', created_by: 1, created_at: dateTime(-10), updated_at: dateTime(-1) },
    { id: 1112, client_id: 5, invoice_id: 712, name: 'إعلان افتتاح فرع العيادة', category: 'advertising', service_type: 'advertising', pricing_model: 'equipment', quantity: 1, unit_label: 'project', agreed_price: 38000, requires_booking: 0, progress_percent: 30, status: 'active', starts_at: dateOnly(-6), due_at: dateOnly(21), notes: 'كاميرتان وإضاءة وممثل صوتي.', created_by: 1, created_at: dateTime(-6), updated_at: dateTime(0) },
    { id: 1113, client_id: 1, invoice_id: 713, name: 'متجر سارة بيوتي الإلكتروني', category: 'website', service_type: 'website', pricing_model: 'project', quantity: 1, unit_label: 'project', agreed_price: 42000, requires_booking: 0, progress_percent: 48, status: 'active', starts_at: dateOnly(-24), due_at: dateOnly(30), notes: 'متجر متجاوب ولوحة إدارة وربط طلبات واتساب.', created_by: 2, created_at: dateTime(-24), updated_at: dateTime(-2) },
    { id: 1114, client_id: 2, invoice_id: 714, name: 'منصة إدارة الكورسات', category: 'software', service_type: 'software', pricing_model: 'custom', quantity: 1, unit_label: 'project', agreed_price: 65000, requires_booking: 0, progress_percent: 22, status: 'active', starts_at: dateOnly(-15), due_at: dateOnly(45), notes: 'ويب وموبايل ولوحة تحكم للمدرب.', created_by: 1, created_at: dateTime(-15), updated_at: dateTime(-1) },
    { id: 1115, client_id: 2, invoice_id: 715, name: 'بودكاست أسرار الإدارة — 4 حلقات', category: 'podcast', service_type: 'podcast', pricing_model: 'hourly', quantity: 8, unit_label: 'hour', agreed_price: 16000, requires_booking: 1, progress_percent: 55, status: 'active', starts_at: dateOnly(-8), due_at: dateOnly(18), notes: 'يشمل تصوير 8 ساعات ومونتاج الحلقات.', created_by: 2, created_at: dateTime(-8), updated_at: dateTime(0) },
    { id: 1116, client_id: 4, invoice_id: 716, name: 'إدارة Noura Home — أغسطس', category: 'social_media', service_type: 'social_media', pricing_model: 'monthly', quantity: 1, unit_label: 'month', agreed_price: 18000, requires_booking: 0, progress_percent: 72, status: 'active', starts_at: dateOnly(-12), due_at: dateOnly(19), notes: '3 منصات، 12 بوست، 8 فيديوهات، وإدارة إعلانين ممولين.', created_by: 1, created_at: dateTime(-12), updated_at: dateTime(0) },
    { id: 1117, client_id: 3, invoice_id: 717, name: 'تغطية بطولة Fit House', category: 'event_coverage', service_type: 'event_coverage', pricing_model: 'project', quantity: 1, unit_label: 'event', agreed_price: 28000, requires_booking: 1, progress_percent: 15, status: 'planning', starts_at: dateOnly(3), due_at: dateOnly(10), notes: 'فريق تصوير ثنائي وتسليم ملخص و30 صورة.', created_by: 2, created_at: dateTime(-2), updated_at: dateTime(0) },
    { id: 1118, client_id: 6, invoice_id: 718, name: 'فيديوهات أزياء بالذكاء الاصطناعي', category: 'ai_video', service_type: 'ai_video', pricing_model: 'per_video', quantity: 5, unit_label: 'video', agreed_price: 15000, requires_booking: 0, progress_percent: 40, status: 'active', starts_at: dateOnly(-5), due_at: dateOnly(14), notes: '5 فيديوهات بهوية Reem Fashion ومقاسات السوشيال.', created_by: 1, created_at: dateTime(-5), updated_at: dateTime(-1) },
  ],
  project_items: [
    { id: 2101, project_id: 1111, client_id: 1, item_type: 'service', description: 'إنتاج 8 ريلز', quantity: 8, unit: 'reel', unit_price: 1500, total_price: 12000, internal_cost: 4200, is_client_visible: 1, sort_order: 0 },
    { id: 2102, project_id: 1112, client_id: 5, item_type: 'equipment', description: 'إنتاج الإعلان والمعدات', quantity: 1, unit: 'project', unit_price: 38000, total_price: 38000, internal_cost: 12500, is_client_visible: 1, sort_order: 0 },
    { id: 2103, project_id: 1113, client_id: 1, item_type: 'service', description: 'تصميم وتطوير المتجر', quantity: 1, unit: 'project', unit_price: 42000, total_price: 42000, internal_cost: 9000, is_client_visible: 1, sort_order: 0 },
    { id: 2104, project_id: 1114, client_id: 2, item_type: 'service', description: 'منصة ويب وتطبيق موبايل', quantity: 1, unit: 'project', unit_price: 65000, total_price: 65000, internal_cost: 18000, is_client_visible: 1, sort_order: 0 },
    { id: 2105, project_id: 1115, client_id: 2, item_type: 'shooting', description: 'تصوير البودكاست', quantity: 8, unit: 'hour', unit_price: 1500, total_price: 12000, internal_cost: 3000, is_client_visible: 1, sort_order: 0 },
    { id: 2106, project_id: 1115, client_id: 2, item_type: 'editing', description: 'مونتاج 4 حلقات', quantity: 4, unit: 'episode', unit_price: 1000, total_price: 4000, internal_cost: 1600, is_client_visible: 1, sort_order: 1 },
    { id: 2107, project_id: 1116, client_id: 4, item_type: 'monthly_plan', description: 'إدارة 3 منصات ومحتوى الشهر', quantity: 1, unit: 'month', unit_price: 18000, total_price: 18000, internal_cost: 5000, is_client_visible: 1, sort_order: 0 },
    { id: 2108, project_id: 1117, client_id: 3, item_type: 'event', description: 'تغطية البطولة وتسليم المحتوى', quantity: 1, unit: 'event', unit_price: 28000, total_price: 28000, internal_cost: 7500, is_client_visible: 1, sort_order: 0 },
    { id: 2109, project_id: 1118, client_id: 6, item_type: 'ai_video', description: 'إنتاج 5 فيديوهات AI', quantity: 5, unit: 'video', unit_price: 3000, total_price: 15000, internal_cost: 2500, is_client_visible: 1, sort_order: 0 },
  ],
  project_milestones: [
    ...[
      [1101,1,'reels'],[1102,2,'software'],[1103,4,'social_media'],[1104,3,'event_coverage'],
      [1111,1,'reels'],[1112,5,'advertising'],[1113,1,'website'],[1114,2,'software'],
      [1115,2,'podcast'],[1116,4,'social_media'],[1117,3,'event_coverage'],[1118,6,'ai_video'],
    ].flatMap(([projectId,clientId,serviceType], projectIndex) => getProjectStageTemplate(serviceType).map(({ title }, index) => ({ id: 2200 + projectIndex * 10 + index, project_id: projectId, client_id: clientId, title, status: index < (projectIndex % 3 + 1) ? 'completed' : index === (projectIndex % 3 + 1) ? 'in_progress' : 'pending', progress_percent: index < (projectIndex % 3 + 1) ? 100 : index === (projectIndex % 3 + 1) ? 50 : 0, client_note: index === 1 ? 'جاري العمل عليها حاليًا.' : '', is_client_visible: 1, sort_order: index }))),
  ],
  project_tasks: [
    { id: 1201, project_id: 1101, title: 'كتابة أفكار 8 ريلز', description: 'أفكار متنوعة للمنتجات الجديدة', status: 'done', priority: 'high', assigned_to: 3, due_at: dateTime(-3, '18:00:00'), completed_at: dateTime(-3, '16:20:00') },
    { id: 1202, project_id: 1101, title: 'مونتاج النسخة الأولى', description: 'إضافة الهوية والنصوص', status: 'in_progress', priority: 'high', assigned_to: 4, due_at: dateTime(2, '19:00:00') },
    { id: 1203, project_id: 1101, title: 'إرسال المحتوى للاعتماد', description: '', status: 'todo', priority: 'normal', assigned_to: 3, due_at: dateTime(4, '16:00:00') },
    { id: 1204, project_id: 1102, title: 'تنقية صوت الوحدة الخامسة', description: '', status: 'in_progress', priority: 'normal', assigned_to: 4, due_at: dateTime(1, '17:00:00') },
    { id: 1205, project_id: 1102, title: 'تصميم غلاف الكورس', description: '', status: 'review', priority: 'normal', assigned_to: 3, due_at: dateTime(3, '14:00:00') },
    { id: 1206, project_id: 1103, title: 'اعتماد تقويم أغسطس', description: 'مراجعة العميل مطلوبة', status: 'todo', priority: 'high', assigned_to: 3, due_at: dateTime(-1, '17:00:00') },
    { id: 1207, project_id: 1103, title: 'تصميم منشورات الأسبوع الأول', description: '', status: 'todo', priority: 'normal', assigned_to: 4, due_at: dateTime(5, '20:00:00') },
  ],
  content_items: [
    { id: 1301, project_id: 1101, client_id: 1, title: 'ريل فتح صندوق المجموعة', content_type: 'reel', platform: 'instagram', status: 'in_review', scheduled_at: dateTime(2, '20:00:00'), caption: 'اكتشفي تفاصيل مجموعتنا الجديدة', created_at: dateTime(-4) },
    { id: 1302, project_id: 1101, client_id: 1, title: 'ريل قبل وبعد الاستخدام', content_type: 'reel', platform: 'tiktok', status: 'scheduled', scheduled_at: dateTime(5, '19:30:00'), caption: '', created_at: dateTime(-3) },
    { id: 1303, project_id: 1102, client_id: 2, title: 'مقتطف من الوحدة الخامسة', content_type: 'reel', platform: 'facebook', status: 'editing', scheduled_at: dateTime(3, '18:00:00'), caption: '', created_at: dateTime(-5) },
    { id: 1304, project_id: 1103, client_id: 4, title: 'كاروسيل اختيار ألوان المنزل', content_type: 'carousel', platform: 'instagram', status: 'idea', scheduled_at: dateTime(6, '21:00:00'), caption: '', created_at: dateTime(-1) },
    { id: 1305, project_id: 1103, client_id: 4, title: 'صورة عرض نهاية الأسبوع', content_type: 'post', platform: 'facebook', status: 'approved', scheduled_at: dateTime(8, '17:00:00'), caption: 'خصم خاص لفترة محدودة', created_at: dateTime(-1) },
    { id: 1306, project_id: 1104, client_id: 3, title: 'تمرين الدقيقة الواحدة', content_type: 'reel', platform: 'instagram', status: 'published', scheduled_at: dateTime(-2, '20:00:00'), published_at: dateTime(-2, '20:05:00'), published_url: '#demo', created_at: dateTime(-7) },
  ],
  package_usage_ledger: [
    { id: 1401, client_package_id: 201, booking_id: 307, movement_type: 'consume', quantity: 1.75, reason: 'جلسة تصوير مكتملة', created_at: dateTime(-10) },
    { id: 1402, client_package_id: 203, booking_id: 308, movement_type: 'consume', quantity: 3.25, reason: 'جلسة تصوير مكتملة', created_at: dateTime(-18) },
  ],
  social_profit_entries: [
    { id: 3201, platform: 'youtube', amount: '12345.67', receipt_date: dateOnly(-180), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 1, channel_name: 'MT Agency Studio', payout_reference: 'YT-JAN-2401', note: 'دفعة أرباح المحتوى الطويل.', status: 'active', created_by: 1, created_at: dateTime(-180) },
    { id: 3202, platform: 'facebook', amount: '4820.35', receipt_date: dateOnly(-150), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 2, channel_name: 'MT Agency', payout_reference: 'FB-FEB-2402', note: '', status: 'active', created_by: 2, created_at: dateTime(-150) },
    { id: 3203, platform: 'youtube', amount: '9360.10', receipt_date: dateOnly(-120), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 3, channel_name: 'MT Agency Studio', payout_reference: 'YT-MAR-2403', note: '', status: 'active', created_by: 1, created_at: dateTime(-120) },
    { id: 3204, platform: 'facebook', amount: '0.20', receipt_date: dateOnly(-90), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 4, channel_name: 'MT Agency Reels', payout_reference: 'FB-ROUND-02', note: 'قيد يثبت دقة القروش.', status: 'active', created_by: 2, created_at: dateTime(-90) },
    { id: 3205, platform: 'youtube', amount: '0.10', receipt_date: dateOnly(-89), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 4, channel_name: 'MT Agency Shorts', payout_reference: 'YT-ROUND-01', note: 'مع 0.20 يساوي 0.30 بالضبط.', status: 'active', created_by: 1, created_at: dateTime(-89) },
    { id: 3206, platform: 'facebook', amount: '7150.50', receipt_date: dateOnly(-60), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 5, channel_name: 'MT Agency', payout_reference: 'FB-MAY-2405', note: '', status: 'active', created_by: 1, created_at: dateTime(-60) },
    { id: 3207, platform: 'youtube', amount: '8800.00', receipt_date: dateOnly(-30), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 6, channel_name: 'MT Agency Studio', payout_reference: 'YT-JUN-2406', note: '', status: 'active', created_by: 2, created_at: dateTime(-30) },
    { id: 3208, platform: 'facebook', amount: '1999.99', receipt_date: dateOnly(-25), earning_year: Number(dateOnly().slice(0, 4)), earning_month: 6, channel_name: 'MT Agency Reels', payout_reference: 'FB-VOID-01', note: '', status: 'voided', void_reason: 'إشعار دفع مكرر', voided_by: 1, voided_at: dateTime(-24), created_by: 2, created_at: dateTime(-25) },
  ],
  formation_founders: [
    { id: 1, founder_key: 'ashraf', name_ar: 'أشرف', is_active: 1, sort_order: 1 },
    { id: 2, founder_key: 'marwa', name_ar: 'مروة', is_active: 1, sort_order: 2 },
    { id: 3, founder_key: 'mohamed', name_ar: 'محمد', is_active: 1, sort_order: 3 },
  ],
  formation_fund_entries: [
    { id: 3001, entry_type: 'contribution', founder_id: 1, amount: 150000, title: 'مساهمة رأس المال الأولية — أشرف', category: 'capital', payment_method: 'تحويل بنكي', reference: 'CAP-ASH-01', entry_date: dateOnly(-120), note: '', allocation_mode: null, status: 'active', created_by: 1, created_at: dateTime(-120) },
    { id: 3002, entry_type: 'contribution', founder_id: 2, amount: 120000, title: 'مساهمة رأس المال الأولية — مروة', category: 'capital', payment_method: 'تحويل بنكي', reference: 'CAP-MAR-01', entry_date: dateOnly(-118), note: '', allocation_mode: null, status: 'active', created_by: 2, created_at: dateTime(-118) },
    { id: 3003, entry_type: 'contribution', founder_id: 3, amount: 90000, title: 'مساهمة رأس المال الأولية — محمد', category: 'capital', payment_method: 'تحويل بنكي', reference: 'CAP-MOH-01', entry_date: dateOnly(-115), note: '', allocation_mode: null, status: 'active', created_by: 1, created_at: dateTime(-115) },
    { id: 3004, entry_type: 'expense', founder_id: null, amount: 60000, title: 'تأمين ومقدم الاستديو', category: 'studio', payment_method: 'تحويل بنكي', reference: 'LEASE-01', entry_date: dateOnly(-105), note: 'تأمين شهرين ومقدم التعاقد.', allocation_mode: 'proportional', status: 'active', created_by: 1, created_at: dateTime(-105) },
    { id: 3005, entry_type: 'expense', founder_id: null, amount: 80500, title: 'معدات التصوير والإضاءة', category: 'equipment', payment_method: 'تحويل بنكي', reference: 'EQUIP-01', entry_date: dateOnly(-90), note: '', allocation_mode: 'proportional', status: 'active', created_by: 2, created_at: dateTime(-90) },
    { id: 3006, entry_type: 'expense', founder_id: null, amount: 42500, title: 'الأثاث وتجهيز مساحة العمل', category: 'furniture', payment_method: 'كاش', reference: 'FITOUT-01', entry_date: dateOnly(-72), note: '', allocation_mode: 'proportional', status: 'active', created_by: 1, created_at: dateTime(-72) },
    { id: 3007, entry_type: 'expense', founder_id: null, amount: 8750, title: 'التراخيص والتسجيل', category: 'licenses', payment_method: 'بطاقة', reference: 'LEGAL-01', entry_date: dateOnly(-60), note: '', allocation_mode: 'proportional', status: 'active', created_by: 1, created_at: dateTime(-60) },
  ],
  formation_expense_allocations: [
    { id: 3101, expense_entry_id: 3004, founder_id: 1, amount: 25000 }, { id: 3102, expense_entry_id: 3004, founder_id: 2, amount: 20000 }, { id: 3103, expense_entry_id: 3004, founder_id: 3, amount: 15000 },
    { id: 3104, expense_entry_id: 3005, founder_id: 1, amount: 33541.67 }, { id: 3105, expense_entry_id: 3005, founder_id: 2, amount: 26833.33 }, { id: 3106, expense_entry_id: 3005, founder_id: 3, amount: 20125 },
    { id: 3107, expense_entry_id: 3006, founder_id: 1, amount: 17708.33 }, { id: 3108, expense_entry_id: 3006, founder_id: 2, amount: 14166.67 }, { id: 3109, expense_entry_id: 3006, founder_id: 3, amount: 10625 },
    { id: 3110, expense_entry_id: 3007, founder_id: 1, amount: 3645.83 }, { id: 3111, expense_entry_id: 3007, founder_id: 2, amount: 2916.67 }, { id: 3112, expense_entry_id: 3007, founder_id: 3, amount: 2187.5 },
  ],
  app_config: [
    { id: 1, key: 'business_start_time', value: '12:00' },
    { id: 2, key: 'business_end_time', value: '24:00' },
    { id: 3, key: 'currency', value: 'EGP' },
    { id: 4, key: 'points_validity_months', value: '3' },
    { id: 5, key: 'backup_freq', value: 'weekly' },
  ],
  app_notifications: [
    { id: 1501, client_id: 2, audience: 'staff', type: 'payment_due', title: 'عميل تجاوز ساعات الدفع', message: 'د. محمد عادل استهلك 12.25 ساعة والمبلغ المتبقي 12,325 ج.م.', severity: 'warning', read_at: null, created_at: dateTime(-1) },
    { id: 1502, client_id: 5, audience: 'staff', type: 'package_expiry', title: 'باقة تنتهي قريبًا', message: 'باقة أحمد يوسف تنتهي خلال 8 أيام.', severity: 'info', read_at: null, created_at: dateTime(0) },
  ],
  booking_sessions: [
    { id: 1601, booking_id: 307, client_id: 1, scheduled_start_at: `${dateOnly(-10)} 15:00:00`, started_at: `${dateOnly(-10)} 15:03:00`, ended_at: `${dateOnly(-10)} 16:48:00`, actual_seconds: 6300, billable_quantity: 1.75, status: 'completed', start_source: 'manual', started_by: 3, ended_by: 3, adjustment_reason: 'تم اعتماد المدة الفعلية بعد انتهاء الجلسة', created_at: dateTime(-10, '15:03:00') },
    { id: 1602, booking_id: 308, client_id: 2, scheduled_start_at: `${dateOnly(-18)} 12:30:00`, started_at: `${dateOnly(-18)} 12:34:00`, ended_at: `${dateOnly(-18)} 15:49:00`, actual_seconds: 11700, billable_quantity: 3.25, status: 'completed', start_source: 'manual', started_by: 3, ended_by: 4, adjustment_reason: '', created_at: dateTime(-18, '12:34:00') },
  ],
});

const upgradeFinanceDemoCoverage = database => {
  const seed = createDemoDatabase();
  let changed = false;
  const referenceTables = ['clients', 'services', 'client_packages', 'payment_proofs', 'payments', 'payment_allocations', 'invoices', 'projects', 'offer_items'];
  referenceTables.forEach(table => {
    if (!Array.isArray(database[table])) { database[table] = []; changed = true; }
    seed[table].forEach(row => {
      if (!database[table].some(existing => Number(existing.id) === Number(row.id))) { database[table].push(clone(row)); changed = true; }
    });
  });
  if (!Array.isArray(database.finance)) { database.finance = []; changed = true; }
  const coverageIds = new Set([901, 902, 908, 910, 911, 912, 913, 914, 915, 916]);
  seed.finance.filter(row => coverageIds.has(Number(row.id))).forEach(row => {
    const existing = database.finance.find(item => Number(item.id) === Number(row.id));
    if (existing) { const before = JSON.stringify(existing); Object.assign(existing, clone(row)); if (JSON.stringify(existing) !== before) changed = true; }
    else { database.finance.push(clone(row)); changed = true; }
  });
  return changed;
};

const upgradeOwnerControlsDemo = database => {
  let changed = false;
  ['owner_adjustments', 'audit_logs'].forEach(table => { if (!Array.isArray(database[table])) { database[table] = []; changed = true; } });
  const draftService = { id: 107, name: 'خدمة تجريبية غير مستخدمة', category: 'خدمة إضافية', billing_unit: 'project', price: 0, total_hours: 0, payment_due_hours: 0, total_reels: 0, validity_days: 30, deposit_percent: 0, overage_price: 0, minimum_booking_minutes: 60, booking_increment_minutes: 15, auto_start_timer: 0, is_active: 0, is_draft: 1, version: 1 };
  const draftPackage = { id: 208, client_id: 6, service_id: 103, name: 'مسودة باقة غير مستخدمة', notes: 'حالة توضيحية للحذف الآمن', billing_unit: 'hour', purchased_quantity: 2, held_quantity: 0, consumed_quantity: 0, payment_due_quantity: 0, total_price: 0, overage_amount: 0, paid_amount: 0, starts_at: dateOnly(), expires_at: dateOnly(30), status: 'draft', version: 1, created_at: dateTime(0) };
  if (!database.services.some(row => Number(row.id) === draftService.id)) { database.services.push(draftService); changed = true; }
  if (!database.client_packages.some(row => Number(row.id) === draftPackage.id)) { database.client_packages.push(draftPackage); changed = true; }
  if (!database.audit_logs.some(row => row.entity_type === 'client_packages' && Number(row.entity_id) === 201)) { database.audit_logs.push({ id: 1, action: 'commercial_adjustment', entity_type: 'client_packages', entity_id: 201, actor_name: 'مالك النظام', before_data: { total_price: '12000.00', paid_amount: '5000.00' }, after_data: { total_price: '12000.00', paid_amount: '6000.00', reason: 'إثبات دفعة تكميلية ومراجعتها' }, created_at: dateTime(-2) }); changed = true; }
  const demoServiceCategories = new Map([[101, 'باقة شهرية'], [102, 'باقة ريلز'], [103, 'باقة يومية'], [104, 'خدمة إضافية'], [105, 'باقة ريلز'], [106, 'خدمة إضافية']]);
  database.services.forEach(row => { const category = demoServiceCategories.get(Number(row.id)); if (category && row.category !== category) { row.category = category; changed = true; } });
  database.services.forEach(row => { if (row.version === undefined) { row.version = 1; changed = true; } if (row.is_draft === undefined) { row.is_draft = 0; changed = true; } });
  database.client_packages.forEach(row => { if (row.version === undefined) { row.version = 1; changed = true; } });
  database.payments.forEach(row => { if (row.version === undefined) { row.version = 1; changed = true; } });
  database.finance.forEach(row => { if (row.version === undefined) { row.version = 1; changed = true; } });
  return changed;
};

const readDatabase = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const database = JSON.parse(stored);
      const financeChanged = upgradeFinanceDemoCoverage(database);
      const ownerChanged = upgradeOwnerControlsDemo(database);
      if (financeChanged || ownerChanged) localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
      return database;
    }
  } catch { /* reset below */ }
  const database = createDemoDatabase();
  upgradeOwnerControlsDemo(database);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  return database;
};

const writeDatabase = database => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(database));
  window.dispatchEvent(new CustomEvent('demoDataChanged'));
};

const tableRows = (database, table) => {
  if (!Array.isArray(database[table])) database[table] = [];
  return database[table];
};

const compare = (left, op, right) => {
  const l = left ?? '';
  if (op === 'eq') return String(l) === String(right);
  if (op === 'neq') return String(l) !== String(right);
  if (op === 'in') return (Array.isArray(right) ? right : []).some(value => String(value) === String(l));
  if (['gt', 'gte', 'lt', 'lte'].includes(op)) {
    const a = Number.isNaN(Number(l)) ? String(l) : Number(l);
    const b = Number.isNaN(Number(right)) ? String(right) : Number(right);
    return op === 'gt' ? a > b : op === 'gte' ? a >= b : op === 'lt' ? a < b : a <= b;
  }
  if (['like', 'ilike', 'not_like'].includes(op)) {
    const source = String(l);
    const target = String(right).replaceAll('%', '');
    const match = op === 'ilike' ? source.toLowerCase().includes(target.toLowerCase()) : source.includes(target);
    return op === 'not_like' ? !match : match;
  }
  return true;
};

class DemoQueryBuilder {
  constructor(table) {
    this.table = table;
    this.method = 'GET';
    this.filters = [];
    this.orders = [];
    this.limitCount = 0;
    this.singleMode = '';
    this.payload = null;
  }

  select() { return this; }
  insert(rows) { this.method = 'POST'; this.payload = Array.isArray(rows) ? rows : [rows]; return this; }
  update(values) { this.method = 'PATCH'; this.payload = values; return this; }
  delete() { this.method = 'DELETE'; return this; }
  eq(column, value) { return this.filter(column, 'eq', value); }
  neq(column, value) { return this.filter(column, 'neq', value); }
  gt(column, value) { return this.filter(column, 'gt', value); }
  gte(column, value) { return this.filter(column, 'gte', value); }
  lt(column, value) { return this.filter(column, 'lt', value); }
  lte(column, value) { return this.filter(column, 'lte', value); }
  like(column, value) { return this.filter(column, 'like', value); }
  ilike(column, value) { return this.filter(column, 'ilike', value); }
  in(column, value) { return this.filter(column, 'in', value); }
  not(column, operator, value) { return this.filter(column, operator === 'like' ? 'not_like' : 'neq', value); }
  order(column, options = {}) { this.orders.push({ column, ascending: options.ascending !== false }); return this; }
  limit(value) { this.limitCount = Number(value) || 0; return this; }
  single() { this.singleMode = 'required'; return this; }
  maybeSingle() { this.singleMode = 'optional'; return this; }
  or() { return this; }
  filter(column, op, value) { this.filters.push({ column, op, value }); return this; }

  async execute() {
    const database = readDatabase();
    const rows = tableRows(database, this.table);
    const matches = row => this.filters.every(({ column, op, value }) => compare(row[column], op, value));
    let result = [];

    if (this.method !== 'GET' && ['services', 'finance', 'payments', 'invoices', 'client_packages'].includes(this.table)) {
      throw formationDemoError('هذا السجل حساس ويجب تعديله من مسار العمل الموثق المخصص له.', 'forbidden');
    }

    if (this.method === 'POST') {
      const nextId = () => Math.max(0, ...rows.map(row => Number(row.id) || 0)) + 1;
      result = this.payload.map(values => {
        const row = { id: values.id ?? nextId(), ...clone(values), created_at: values.created_at || nowText(), updated_at: nowText() };
        if (this.table === 'content_items' && !row.client_id) row.client_id = database.projects.find(project => Number(project.id) === Number(row.project_id))?.client_id;
        rows.push(row);
        return row;
      });
      writeDatabase(database);
    } else if (this.method === 'PATCH') {
      rows.forEach((row, index) => {
        if (matches(row)) rows[index] = { ...row, ...clone(this.payload), updated_at: nowText() };
      });
      result = rows.filter(matches);
      writeDatabase(database);
    } else if (this.method === 'DELETE') {
      result = rows.filter(matches);
      database[this.table] = rows.filter(row => !matches(row));
      writeDatabase(database);
    } else {
      result = rows.filter(matches).map(clone);
    }

    this.orders.slice().reverse().forEach(({ column, ascending }) => {
      result.sort((a, b) => String(a[column] ?? '').localeCompare(String(b[column] ?? ''), 'ar', { numeric: true }) * (ascending ? 1 : -1));
    });
    if (this.limitCount) result = result.slice(0, this.limitCount);
    if (this.singleMode) {
      if (!result.length) return { data: null, error: this.singleMode === 'required' ? new Error('السجل غير موجود في بيانات التجربة.') : null };
      return { data: result[0], error: null };
    }
    return { data: result, error: null, count: result.length };
  }

  then(resolve, reject) { return this.execute().then(resolve, reject); }
}

const bodyOf = options => {
  try { return typeof options?.body === 'string' ? JSON.parse(options.body || '{}') : (options?.body || {}); }
  catch { return {}; }
};
const nextId = rows => Math.max(0, ...rows.map(row => Number(row.id) || 0)) + 1;
const addRow = (database, table, values) => {
  const rows = tableRows(database, table);
  const row = { id: nextId(rows), ...values, created_at: values.created_at || nowText(), updated_at: nowText() };
  rows.push(row);
  return row;
};
const findById = (database, table, id) => tableRows(database, table).find(row => Number(row.id) === Number(id));
const recalculateDemoProjectProgress = (database, projectId) => {
  const siblings = database.project_milestones.filter(item => Number(item.project_id) === Number(projectId) && Number(item.is_client_visible ?? 1) === 1);
  const project = findById(database, 'projects', projectId);
  const progress = siblings.length ? Math.round(siblings.reduce((sum, item) => sum + Number(item.progress_percent || 0), 0) / siblings.length) : 0;
  if (project) { project.progress_percent = progress; if (!['cancelled', 'on_hold'].includes(project.status)) project.status = progress >= 100 ? 'completed' : progress > 0 ? 'active' : 'planning'; project.updated_at = nowText(); }
  return progress;
};

const formationDemoError = (message, code = 'validation_error') => {
  const error = new Error(message);
  error.code = code;
  error.status = code === 'forbidden' ? 403 : 422;
  return error;
};

const requireDemoOwner = () => {
  if (demoRole !== 'owner') throw formationDemoError('هذا الإجراء متاح للمالك فقط.', 'forbidden');
};

const demoReason = body => {
  const reason = String(body.reason || body.correction_reason || '').trim();
  if (reason.length < 5) throw formationDemoError('سبب التصحيح مطلوب ويجب أن يكون واضحًا.', 'correction_reason_required');
  return reason;
};

const demoAudit = (database, action, entityType, entityId, before, after) => addRow(database, 'audit_logs', { action, entity_type: entityType, entity_id: Number(entityId), before_data: clone(before), after_data: clone(after), actor_name: 'مالك النظام' });

const demoReverseFinance = (database, entry, reason) => {
  if (entry.voided_at || database.finance.some(row => Number(row.reversed_entry_id) === Number(entry.id))) throw formationDemoError('تم إلغاء هذه الحركة سابقًا.', 'already_voided');
  const reversal = addRow(database, 'finance', { type: 'قيد عكسي', entry_kind: 'reversal', category: `reversal_${entry.entry_kind || 'expense'}`, amount: Number(entry.amount), method: entry.method, detail: `عكس: ${entry.detail}`, date: dateOnly(), entity: entry.entity, source_type: entry.source_type, source_id: entry.source_id, reversed_entry_id: entry.id, reversal_reason: reason, is_system: 1, correlation_id: `reversal:${entry.id}`, version: 1 });
  Object.assign(entry, { voided_at: nowText(), voided_by: 1, reversal_reason: reason, version: Number(entry.version || 1) + 1 });
  return reversal;
};

const demoVoidPayment = (database, paymentId, body) => {
  requireDemoOwner(); const reason = demoReason(body); const payment = findById(database, 'payments', paymentId);
  if (!payment) throw formationDemoError('الدفعة غير موجودة.', 'payment_not_found');
  if (payment.voided_at || payment.status === 'voided') throw formationDemoError('تم إلغاء هذه الدفعة سابقًا.', 'already_voided');
  let allocations = database.payment_allocations.filter(row => Number(row.payment_id) === Number(payment.id));
  const ambiguousRows = allocations.filter(allocation => !allocation.client_package_id && allocation.invoice_id && database.client_packages.filter(pkg => Number(pkg.source_invoice_id) === Number(allocation.invoice_id)).length > 1);
  if (ambiguousRows.length) {
    const distribution = Array.isArray(body.allocation_distribution) ? body.allocation_distribution : [];
    if (ambiguousRows.length !== 1 || distribution.length < 2) throw formationDemoError('هذه دفعة قديمة موزعة على أكثر من باقة. أدخل توزيعًا دقيقًا قبل الإلغاء.', 'ambiguous_legacy_allocation');
    const ambiguous = ambiguousRows[0]; const seen = new Set(); let totalCents = 0;
    distribution.forEach(row => { const packageId = Number(row.package_id); const cents = moneyToCents(row.amount); const pkg = findById(database, 'client_packages', packageId); if (!pkg || Number(pkg.source_invoice_id) !== Number(ambiguous.invoice_id) || Number(pkg.client_id) !== Number(payment.client_id) || cents < 0 || seen.has(packageId)) throw formationDemoError('توزيع الدفعة يحتوي بيانات غير صحيحة.', 'invalid_allocation_distribution'); seen.add(packageId); totalCents += cents; });
    if (totalCents !== moneyToCents(ambiguous.amount)) throw formationDemoError('يجب أن يساوي مجموع توزيع الباقات قيمة الدفعة بالقرش.', 'allocation_total_mismatch');
    const [first, ...rest] = distribution; Object.assign(ambiguous, { client_package_id: Number(first.package_id), amount: centsToMoney(moneyToCents(first.amount)) }); rest.forEach(row => addRow(database, 'payment_allocations', { client_id: ambiguous.client_id, payment_id: ambiguous.payment_id, payment_proof_id: ambiguous.payment_proof_id, invoice_id: ambiguous.invoice_id, client_package_id: Number(row.package_id), amount: centsToMoney(moneyToCents(row.amount)) })); allocations = database.payment_allocations.filter(row => Number(row.payment_id) === Number(payment.id)); demoAudit(database, 'allocate_legacy_payment', 'payments', payment.id, null, { distribution: clone(distribution) });
  }
  allocations.forEach(allocation => {
    const pkg = findById(database, 'client_packages', allocation.client_package_id); if (pkg) { pkg.paid_amount = Math.max(0, centsToMoney(moneyToCents(pkg.paid_amount) - moneyToCents(allocation.amount))); pkg.version = Number(pkg.version || 1) + 1; }
    const invoice = findById(database, 'invoices', allocation.invoice_id); if (invoice) { invoice.paid_amount = Math.max(0, centsToMoney(moneyToCents(invoice.paid_amount) - moneyToCents(allocation.amount))); invoice.status = invoice.paid_amount <= 0 ? 'issued' : invoice.paid_amount >= Number(invoice.total) ? 'paid' : 'partial'; }
  });
  const reversalIds = database.finance.filter(entry => entry.source_type === 'payment' && Number(entry.source_id) === Number(payment.id)).map(entry => demoReverseFinance(database, entry, reason).id);
  Object.assign(payment, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText(), version: Number(payment.version || 1) + 1 });
  database.payment_proofs.filter(proof => Number(proof.payment_id) === Number(payment.id)).forEach(proof => Object.assign(proof, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText() }));
  demoAudit(database, 'void_payment', 'payments', payment.id, { ...payment, status: 'approved', voided_at: null }, { status: 'voided', reason, reversal_ids: reversalIds });
  return { id: payment.id, status: 'voided', reversal_ids: reversalIds };
};

const formationDemoResponse = database => {
  const snapshot = summarizeFormationFund(database);
  const entries = database.formation_fund_entries.slice().sort((a, b) => String(b.entry_date).localeCompare(String(a.entry_date)) || Number(b.id) - Number(a.id)).map(entry => ({
    ...clone(entry),
    founder_name: database.formation_founders.find(founder => Number(founder.id) === Number(entry.founder_id))?.name_ar || null,
    creator_name: database.users.find(user => Number(user.id) === Number(entry.created_by))?.full_name || 'مالك النظام',
    voided_by_name: database.users.find(user => Number(user.id) === Number(entry.voided_by))?.full_name || null,
    allocations: database.formation_expense_allocations.filter(row => Number(row.expense_entry_id) === Number(entry.id)).map(row => ({ ...clone(row), founder_name: database.formation_founders.find(founder => Number(founder.id) === Number(row.founder_id))?.name_ar })),
  }));
  const categories = Object.entries(database.formation_fund_entries.filter(entry => entry.entry_type === 'expense' && entry.status === 'active').reduce((totals, entry) => ({ ...totals, [entry.category || 'other']: Number(totals[entry.category || 'other'] || 0) + Number(entry.amount) }), {})).map(([category, total]) => ({ category, total })).sort((a, b) => b.total - a.total);
  return { ...snapshot, entries, categories };
};

const packageDemoDetails = (database, packageId) => {
  const pkg = findById(database, 'client_packages', packageId);
  if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found');
  const client = findById(database, 'clients', pkg.client_id);
  const service = findById(database, 'services', pkg.service_id);
  const invoice = pkg.source_invoice_id ? findById(database, 'invoices', pkg.source_invoice_id) : null;
  const direct = database.payment_allocations.filter(row => Number(row.client_package_id) === Number(pkg.id));
  const legacy = pkg.source_invoice_id ? database.payment_allocations.filter(row => !row.client_package_id && Number(row.invoice_id) === Number(pkg.source_invoice_id)) : [];
  const invoicePackageCount = pkg.source_invoice_id ? database.client_packages.filter(row => Number(row.source_invoice_id) === Number(pkg.source_invoice_id)).length : 0;
  const paymentRow = (allocation, exact) => {
    const payment = findById(database, 'payments', allocation.payment_id) || {};
    const proof = allocation.payment_proof_id ? findById(database, 'payment_proofs', allocation.payment_proof_id) : null;
    return {
      allocation_id: allocation.id, amount: Number(allocation.amount).toFixed(2), client_package_id: allocation.client_package_id || null,
      invoice_id: allocation.invoice_id || null, allocated_at: allocation.created_at, payment_id: payment.id || null,
      method: payment.method || 'غير محدد', status: payment.status || 'approved', reference: payment.reference || null,
      created_at: payment.created_at || allocation.created_at, reviewed_at: payment.reviewed_at || null,
      proof_id: proof?.id || null, proof_name: proof?.original_name || null, proof_mime: proof?.mime_type || null, proof_status: proof?.status || null,
      invoice_number: allocation.invoice_id ? findById(database, 'invoices', allocation.invoice_id)?.invoice_number || null : null,
      allocation_source: exact ? 'direct_package' : 'legacy_invoice', is_exact_package_amount: exact,
      allocation_note: exact ? 'تخصيص مباشر وموثق لهذه الباقة.' : invoicePackageCount > 1 ? 'دفعة قديمة على فاتورة تضم أكثر من باقة؛ لا تتوفر حصة تاريخية موثقة لهذه الباقة.' : 'دفعة قديمة مرتبطة بالفاتورة؛ يعرض مبلغ الفاتورة للمراجعة ولا يُعامل كتخصيص مستقل للباقة.',
    };
  };
  const payments = [...direct.map(row => paymentRow(row, true)), ...legacy.map(row => paymentRow(row, false))]
    .sort((a, b) => String(b.reviewed_at || b.created_at).localeCompare(String(a.reviewed_at || a.created_at)));
  const directCents = direct.reduce((sum, row) => sum + moneyToCents(row.amount), 0);
  const finances = packageFinancialSummary(pkg);
  const quantities = packageQuantitySummary(pkg);
  const today = cairoDateKey();
  const effectiveStatus = pkg.status === 'active' && String(pkg.expires_at).slice(0, 10) < today ? 'expired' : pkg.status;
  const usedBookings = database.bookings.filter(booking => Number(booking.client_package_id) === Number(pkg.id)).map(booking => {
    const session = database.booking_sessions.find(row => Number(row.booking_id) === Number(booking.id));
    const ledgerRows = database.package_usage_ledger.filter(row => Number(row.client_package_id) === Number(pkg.id) && Number(row.booking_id) === Number(booking.id));
    const consumed = ledgerRows.filter(row => row.movement_type === 'consume').reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const overage = ledgerRows.filter(row => row.movement_type === 'overage').reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    if (booking.status !== 'completed' && session?.status !== 'completed' && consumed <= 0) return null;
    return { ...clone(booking), session_id: session?.id || null, started_at: session?.started_at || null, ended_at: session?.ended_at || null, actual_seconds: Number(session?.actual_seconds || booking.actual_seconds || 0), actual_quantity: Number(session?.billable_quantity || booking.billable_quantity || consumed), consumed_quantity: consumed, ledger_overage_quantity: overage, start_source: session?.start_source || null, adjustment_reason: session?.adjustment_reason || null, started_by_name: findById(database, 'users', session?.started_by)?.full_name || null, ended_by_name: findById(database, 'users', session?.ended_by)?.full_name || null, usage_source: consumed > 0 ? 'ledger' : 'session' };
  }).filter(Boolean).sort((a, b) => `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`));
  const detailedUsed = usedBookings.reduce((sum, booking) => sum + Number(booking.consumed_quantity || 0), 0);
  const legacyUsed = Math.max(0, Number((quantities.consumed - detailedUsed).toFixed(6)));
  if (legacyUsed > 0.000001) {
    usedBookings.push({
      id: `legacy-consumption-${pkg.id}`,
      record_type: 'legacy_consumption',
      service: 'استهلاك سابق مُرحّل',
      date: pkg.starts_at,
      consumed_quantity: legacyUsed,
      usage_source: 'legacy_reconciliation',
      reconciliation_note: 'هذا الجزء محفوظ في إجمالي استهلاك الباقة، لكن لا يتوفر له حجز أو جلسة تفصيلية في السجل القديم.',
    });
  }
  const upcomingStatuses = new Set(['pending','confirmed','alternative_proposed','cancel_requested','late_cancel_requested','in_progress']);
  const upcomingBookings = database.bookings.filter(booking => Number(booking.client_package_id) === Number(pkg.id) && String(booking.date) >= today && upcomingStatuses.has(booking.status)).sort((a, b) => `${a.date}${a.start_time}`.localeCompare(`${b.date}${b.start_time}`));
  const workingDays = remainingBusinessDays(pkg.expires_at, today);
  const legacyReconciliation = Math.max(0, finances.paidCents - directCents);
  return {
    package: { id: Number(pkg.id), name: pkg.name, billing_unit: pkg.billing_unit, status: pkg.status, effective_status: effectiveStatus, source_invoice_id: pkg.source_invoice_id || null, invoice_number: invoice?.invoice_number || null, client: { id: Number(pkg.client_id), name: client?.name || 'عميل', phone: client?.phone1 || null }, service: { id: Number(pkg.service_id), name: service?.name || pkg.name } },
    financial: { total_price: centsToMoney(finances.totalCents), paid_amount: centsToMoney(finances.paidCents), overage_amount: centsToMoney(finances.overageCents), outstanding: centsToMoney(finances.outstandingCents), customer_credit: centsToMoney(Math.max(0, finances.paidCents - finances.totalCents - finances.overageCents)), payment_progress_percent: finances.totalCents + finances.overageCents ? Math.min(100, Number(((finances.paidCents / (finances.totalCents + finances.overageCents)) * 100).toFixed(1))) : 100, exact_allocated_total: centsToMoney(directCents), legacy_reconciliation_amount: centsToMoney(legacyReconciliation), has_legacy_reconciliation: legacyReconciliation > 0, invoice_package_count: invoicePackageCount },
    quantities: { purchased: quantities.purchased, used: quantities.consumed, upcoming_held: quantities.held, remaining: quantities.remaining, available: quantities.available },
    validity: { starts_at: pkg.starts_at, expires_at: pkg.expires_at, today, remaining_business_days: workingDays, friday_excluded: true, state: effectiveStatus === 'expired' ? 'expired' : workingDays <= 14 ? 'near_expiry' : 'active' },
    payments, used_bookings: usedBookings, upcoming_bookings: clone(upcomingBookings), usage_ledger: clone(database.package_usage_ledger.filter(row => Number(row.client_package_id) === Number(pkg.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))), audit_timeline: clone(database.audit_logs.filter(row => row.entity_type === 'client_packages' && Number(row.entity_id) === Number(pkg.id)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))),
    usage_reconciliation: { authoritative_used: quantities.consumed, detailed_used: detailedUsed, legacy_used: legacyUsed, reconciled: Math.abs((detailedUsed + legacyUsed) - quantities.consumed) < 0.000001 },
    reconciliation: { authoritative_paid_amount: centsToMoney(finances.paidCents), exact_package_allocations: centsToMoney(directCents), legacy_unallocated_amount: centsToMoney(legacyReconciliation), legacy_invoice_records: legacy.length, disclosure: legacyReconciliation > 0 ? 'جزء من المدفوع المعتمد يسبق التخصيص الدقيق على مستوى الباقة؛ يعتمد الإجمالي على رصيد الباقة المحفوظ ولا تُفبرك حصة تاريخية.' : null },
  };
};

const financeDemoEntries = database => database.finance.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || Number(b.id) - Number(a.id)).map(entry => {
  const clients = new Map(); const packages = new Map(); const services = new Map(); const invoices = new Map(); const projects = new Map(); const payments = new Map(); const proofs = new Map();
  const addClient = id => { const row = findById(database, 'clients', id); if (row) clients.set(Number(row.id), row.name); };
  const addService = id => { const row = findById(database, 'services', id); if (row) services.set(Number(row.id), row.name); };
  const addPackage = id => { const row = findById(database, 'client_packages', id); if (!row) return; packages.set(Number(row.id), row.name); addClient(row.client_id); addService(row.service_id); };
  const addInvoice = id => {
    const row = findById(database, 'invoices', id); if (!row) return;
    invoices.set(Number(row.id), row.invoice_number); addClient(row.client_id);
    const project = row.project_id ? findById(database, 'projects', row.project_id) : null;
    if (project) projects.set(Number(project.id), project.name);
    database.client_packages.filter(pkg => Number(pkg.source_invoice_id) === Number(row.id)).forEach(pkg => addPackage(pkg.id));
    database.offer_items.filter(item => Number(item.offer_id) === Number(row.offer_id) && item.service_id).forEach(item => addService(item.service_id));
  };
  addClient(entry.client_id);
  if (entry.source_type === 'client_package') addPackage(entry.source_id);
  if (entry.source_type === 'service') addService(entry.source_id);
  if (entry.source_type === 'payment') {
    const payment = findById(database, 'payments', entry.source_id);
    if (payment) { payments.set(Number(payment.id), payment.reference || `دفعة #${payment.id}`); addClient(payment.client_id); }
    database.payment_allocations.filter(row => Number(row.payment_id) === Number(entry.source_id)).forEach(row => { addPackage(row.client_package_id); addInvoice(row.invoice_id); });
  }
  if (entry.source_type === 'payment_proof') {
    const proof = findById(database, 'payment_proofs', entry.source_id);
    if (proof) { proofs.set(Number(proof.id), proof.original_name || `إثبات #${proof.id}`); addClient(proof.client_id); addPackage(proof.client_package_id); addInvoice(proof.invoice_id); if (proof.payment_id) payments.set(Number(proof.payment_id), `دفعة #${proof.payment_id}`); }
    database.payment_allocations.filter(row => Number(row.payment_proof_id) === Number(entry.source_id)).forEach(row => { addPackage(row.client_package_id); addInvoice(row.invoice_id); });
  }
  const packageNames = [...packages.values()]; const serviceNames = [...services.values()]; const projectNames = [...projects.values()]; const invoiceNumbers = [...invoices.values()];
  const sourceLabels = packageNames.length ? packageNames : projectNames.length ? projectNames : serviceNames.length ? serviceNames : invoiceNumbers;
  const clientId = entry.client_id ? Number(entry.client_id) : [...clients.keys()][0] || null;
  return {
    ...clone(entry), client_id: clientId, client_name: clients.get(clientId) || [...clients.values()][0] || null,
    package_ids: [...packages.keys()], package_names: packageNames, service_ids: [...services.keys()], service_names: serviceNames,
    invoice_ids: [...invoices.keys()], invoice_numbers: invoiceNumbers, project_ids: [...projects.keys()], project_names: projectNames,
    payment_ids: [...payments.keys()], payment_references: [...payments.values()], payment_proof_ids: [...proofs.keys()], payment_proof_references: [...proofs.values()],
    source_labels: sourceLabels, source_label: sourceLabels[0] || null, source_extra_count: Math.max(0, sourceLabels.length - 1),
  };
});

const demoRequest = async (path, options = {}) => {
  const database = readDatabase();
  const body = bodyOf(options);
  const url = new URL(path, 'https://demo.local');
  const route = url.pathname;
  let match;

  if ((match = route.match(/^\/client-packages\/(\d+)\/details$/)) && (options.method || 'GET') === 'GET') {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لعرض تفاصيل الباقة.', 'forbidden');
    return packageDemoDetails(database, match[1]);
  }

  if (route.startsWith('/social-profits')) {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية للوصول إلى أرباح السوشيال.', 'forbidden');
    if (route === '/social-profits' && (options.method || 'GET') === 'GET') {
      const year = Number(url.searchParams.get('year') || dateOnly().slice(0, 4)); const platform = url.searchParams.get('platform') || 'all'; const status = url.searchParams.get('status') || 'all'; const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      if (!['all', 'youtube', 'facebook'].includes(platform) || !['all', 'active', 'voided'].includes(status)) throw formationDemoError('مرشح التقرير غير صحيح.');
      const entries = database.social_profit_entries.filter(entry => Number(entry.earning_year) === year && (platform === 'all' || entry.platform === platform) && (status === 'all' || entry.status === status) && (!q || [entry.channel_name, entry.payout_reference, entry.note].some(value => String(value || '').toLowerCase().includes(q)))).sort((a, b) => String(b.receipt_date).localeCompare(String(a.receipt_date)) || Number(b.id) - Number(a.id)).map(entry => ({ ...clone(entry), creator_name: database.users.find(user => Number(user.id) === Number(entry.created_by))?.full_name || 'مالك النظام', voided_by_name: database.users.find(user => Number(user.id) === Number(entry.voided_by))?.full_name || null }));
      const report = summarizeSocialProfits(entries); const availableYears = [...new Set(database.social_profit_entries.map(entry => Number(entry.earning_year)).concat(year))].sort((a, b) => b - a);
      return { year, ...report, entries, available_years: availableYears, filters: { platform, status, q } };
    }
    if (route === '/social-profits' && options.method === 'POST') {
      const cents = socialAmountToCents(body.amount); if (cents === null) throw formationDemoError('أدخل مبلغًا صحيحًا بدقة قرشين كحد أقصى.', 'invalid_social_profit_amount');
      if (!['youtube', 'facebook'].includes(body.platform)) throw formationDemoError('المنصة غير مدعومة.', 'invalid_social_profit_platform');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.receipt_date || '')) || Number(body.earning_year) < 2000 || Number(body.earning_year) > 2100 || Number(body.earning_month) < 1 || Number(body.earning_month) > 12 || !String(body.channel_name || '').trim()) throw formationDemoError('بيانات الإيراد غير مكتملة.');
      const entry = addRow(database, 'social_profit_entries', { platform: body.platform, amount: socialCentsToAmount(cents), receipt_date: body.receipt_date, earning_year: Number(body.earning_year), earning_month: Number(body.earning_month), channel_name: String(body.channel_name).trim(), payout_reference: String(body.payout_reference || '').trim(), note: String(body.note || '').trim(), status: 'active', created_by: 1 }); writeDatabase(database); return { id: entry.id };
    }
    if ((match = route.match(/^\/social-profits\/(\d+)\/void$/)) && options.method === 'POST') {
      const entry = findById(database, 'social_profit_entries', match[1]); const reason = String(body.reason || '').trim(); if (!entry) throw formationDemoError('قيد الإيراد غير موجود.', 'social_profit_not_found'); if (entry.status !== 'active') throw formationDemoError('تم إبطال هذا القيد بالفعل.', 'social_profit_already_voided'); if (reason.length < 3) throw formationDemoError('اكتب سبب الإبطال بوضوح.', 'void_reason_required'); Object.assign(entry, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText(), updated_at: nowText() }); writeDatabase(database); return { id: entry.id, voided: true };
    }
  }

  if (route.startsWith('/formation-fund')) {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية للوصول إلى صندوق التأسيس.', 'forbidden');
    if (route === '/formation-fund' && (options.method || 'GET') === 'GET') return formationDemoResponse(database);
    if (route === '/formation-fund/contributions' && options.method === 'POST') {
      const founder = findById(database, 'formation_founders', body.founder_id);
      const amount = Number(body.amount || 0);
      if (!founder || founder.is_active === 0) throw formationDemoError('حساب المؤسس غير موجود.', 'invalid_formation_founder');
      if (toCents(amount) <= 0) throw formationDemoError('أدخل مبلغًا أكبر من صفر.', 'invalid_formation_amount');
      if (!String(body.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.entry_date || ''))) throw formationDemoError('بيانات المساهمة غير مكتملة.');
      const entry = addRow(database, 'formation_fund_entries', { entry_type: 'contribution', founder_id: founder.id, amount: Number(amount.toFixed(2)), title: String(body.title).trim(), category: 'capital', payment_method: body.payment_method || '', reference: body.reference || '', entry_date: body.entry_date, note: body.note || '', allocation_mode: null, status: 'active', created_by: 1 });
      writeDatabase(database); return { id: entry.id, summary: summarizeFormationFund(database) };
    }
    if (route === '/formation-fund/expenses' && options.method === 'POST') {
      const amount = Number(body.amount || 0); const mode = body.allocation_mode || 'proportional'; const snapshot = summarizeFormationFund(database);
      if (toCents(amount) <= 0 || !String(body.title || '').trim() || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.entry_date || ''))) throw formationDemoError('بيانات المصروف غير مكتملة.');
      if (toCents(amount) > toCents(snapshot.summary.pooled_available)) throw formationDemoError('المصروف أكبر من الرصيد المتاح في صندوق التأسيس.', 'insufficient_formation_funds');
      let allocations;
      if (mode === 'proportional') allocations = allocateFormationExpense(amount, snapshot.founders);
      else if (mode === 'manual') {
        allocations = snapshot.founders.map(founder => ({ founder_id: founder.id, amount: Number((body.allocations || []).find(row => Number(row.founder_id) === Number(founder.id))?.amount || 0) }));
        if (allocations.some(row => toCents(row.amount) > toCents(snapshot.founders.find(founder => founder.id === row.founder_id)?.available))) throw formationDemoError('توزيع المصروف اليدوي يتجاوز رصيد أحد المؤسسين.', 'founder_balance_exceeded');
        if (allocations.reduce((sum, row) => sum + toCents(row.amount), 0) !== toCents(amount)) throw formationDemoError('يجب أن يساوي مجموع توزيع المؤسسين قيمة المصروف تمامًا.', 'manual_allocation_mismatch');
      } else throw formationDemoError('طريقة توزيع المصروف غير صحيحة.', 'invalid_allocation_mode');
      const entry = addRow(database, 'formation_fund_entries', { entry_type: 'expense', founder_id: null, amount: Number(amount.toFixed(2)), title: String(body.title).trim(), category: body.category || 'other', payment_method: body.payment_method || '', reference: body.reference || '', entry_date: body.entry_date, note: body.note || '', allocation_mode: mode, status: 'active', created_by: 1 });
      allocations.forEach(allocation => addRow(database, 'formation_expense_allocations', { expense_entry_id: entry.id, founder_id: allocation.founder_id, amount: Number(allocation.amount) }));
      writeDatabase(database); return { id: entry.id, summary: summarizeFormationFund(database) };
    }
    if ((match = route.match(/^\/formation-fund\/entries\/(\d+)\/void$/)) && options.method === 'POST') {
      const entry = findById(database, 'formation_fund_entries', match[1]); const reason = String(body.reason || '').trim();
      if (!entry) throw formationDemoError('حركة صندوق التأسيس غير موجودة.', 'formation_entry_not_found');
      if (entry.status !== 'active') throw formationDemoError('تم إبطال هذه الحركة بالفعل.', 'formation_entry_already_voided');
      if (reason.length < 3) throw formationDemoError('اكتب سبب الإبطال بوضوح.', 'void_reason_required');
      if (entry.entry_type === 'contribution') { const founder = summarizeFormationFund(database).founders.find(item => Number(item.id) === Number(entry.founder_id)); if (toCents(founder?.available) < toCents(entry.amount)) throw formationDemoError('لا يمكن إبطال المساهمة لأنها ممولة بالفعل في مصروفات تأسيس قائمة.', 'contribution_void_would_overdraw'); }
      Object.assign(entry, { status: 'voided', void_reason: reason, voided_by: 1, voided_at: nowText(), updated_at: nowText() }); writeDatabase(database); return { id: entry.id, voided: true, summary: summarizeFormationFund(database) };
    }
  }

  if (route === '/users/assignees') return clone(database.users.filter(user => user.role !== 'client'));
  if (route === '/users' && (options.method || 'GET') === 'GET') return clone(database.users);
  if (route === '/users' && options.method === 'POST') { const row = addRow(database, 'users', { ...body, is_active: 1 }); writeDatabase(database); return row; }
  if ((match = route.match(/^\/users\/(\d+)$/)) && options.method === 'PATCH') { Object.assign(findById(database, 'users', match[1]) || {}, body, { updated_at: nowText() }); writeDatabase(database); return { id: Number(match[1]) }; }

  if (route === '/clients' && options.method === 'POST') { const row = addRow(database, 'clients', { ...body, status: 'active', color: body.color || '#2563eb', points: 0, debt: 0, credit: 0 }); writeDatabase(database); return row; }
  if ((match = route.match(/^\/clients\/(\d+)\/access$/))) return { client_id: Number(match[1]), demo: true };

  if (route === '/services' && options.method === 'POST') {
    requireDemoOwner(); const reason = demoReason(body); const row = addRow(database, 'services', { ...body, price: centsToMoney(moneyToCents(body.price)), overage_price: centsToMoney(moneyToCents(body.overage_price || 0)), is_active: body.is_active === false ? 0 : 1, is_draft: body.is_draft ? 1 : 0, version: 1 }); demoAudit(database, 'owner_create_service', 'services', row.id, null, { ...row, reason }); writeDatabase(database); return row;
  }
  if ((match = route.match(/^\/services\/(\d+)$/)) && options.method === 'PATCH') {
    requireDemoOwner(); const reason = demoReason(body); const service = findById(database, 'services', match[1]); if (!service) throw formationDemoError('الخدمة غير موجودة.', 'service_not_found'); const before = clone(service); Object.assign(service, body, { price: centsToMoney(moneyToCents(body.price ?? service.price)), overage_price: centsToMoney(moneyToCents(body.overage_price ?? service.overage_price)), version: Number(service.version || 1) + 1, updated_at: nowText() }); demoAudit(database, 'owner_update_service', 'services', service.id, before, { ...clone(service), reason }); writeDatabase(database); return clone(service);
  }
  if ((match = route.match(/^\/services\/(\d+)\/archive$/)) && options.method === 'POST') {
    requireDemoOwner(); const reason = demoReason(body); const service = findById(database, 'services', match[1]); if (!service) throw formationDemoError('الخدمة غير موجودة.', 'service_not_found'); const refs = database.client_packages.filter(row => Number(row.service_id) === Number(service.id)).length + database.bookings.filter(row => Number(row.service_id) === Number(service.id)).length; const before = clone(service); if (body.hard_delete && !refs && service.is_draft && body.confirmation === 'DELETE') { database.services = database.services.filter(row => Number(row.id) !== Number(service.id)); demoAudit(database, 'hard_delete_unused_service', 'services', service.id, before, { reason }); writeDatabase(database); return { id: service.id, deleted: true, archived: false }; } Object.assign(service, { is_active: 0, archive_reason: reason, archived_by: 1, archived_at: nowText(), version: Number(service.version || 1) + 1 }); demoAudit(database, 'archive_service', 'services', service.id, before, clone(service)); writeDatabase(database); return { id: service.id, deleted: false, archived: true, references: refs };
  }
  if (route === '/audit-logs' && (options.method || 'GET') === 'GET') { requireDemoOwner(); const entityType = url.searchParams.get('entity_type'); const entityId = Number(url.searchParams.get('entity_id') || 0); return clone(database.audit_logs.filter(row => (!entityType || row.entity_type === entityType) && (!entityId || Number(row.entity_id) === entityId)).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))); }

  if (route === '/client-packages' && options.method === 'POST') {
    const service = findById(database, 'services', body.service_id);
    const expires = new Date(`${body.starts_at}T12:00:00`); expires.setDate(expires.getDate() + Number(body.validity_days || service?.validity_days || 90));
    const row = addRow(database, 'client_packages', { client_id: body.client_id, service_id: body.service_id, name: body.name || service?.name, billing_unit: body.billing_unit || service?.billing_unit || 'hour', purchased_quantity: Number(body.quantity), held_quantity: 0, consumed_quantity: 0, payment_due_quantity: Number(service?.payment_due_hours || 0), deposit_percent_snapshot: Number(service?.deposit_percent || 0), overage_price_snapshot: Number(service?.overage_price || 0), total_price: Number(body.total_price), overage_amount: 0, paid_amount: Number(body.paid_amount || 0), starts_at: body.starts_at, expires_at: `${expires.getFullYear()}-${pad(expires.getMonth() + 1)}-${pad(expires.getDate())}`, status: 'active' });
    if (Number(body.paid_amount) > 0) addRow(database, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: body.client_id, amount: Number(body.paid_amount), method: body.payment_method || 'كاش', detail: `دفعة ${row.name}`, date: dateOnly(), entity: 'الشركة' });
    writeDatabase(database); return row;
  }
  if ((match = route.match(/^\/client-packages\/(\d+)$/)) && options.method === 'PATCH') { requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); const before = clone(pkg); ['name','notes','starts_at','expires_at','status'].forEach(field => { if (Object.prototype.hasOwnProperty.call(body, field)) pkg[field] = body[field]; }); pkg.version = Number(pkg.version || 1) + 1; pkg.updated_at = nowText(); demoAudit(database, 'owner_update_package', 'client_packages', pkg.id, before, { ...clone(pkg), reason }); writeDatabase(database); return clone(pkg); }
  if ((match = route.match(/^\/client-packages\/(\d+)\/adjust$/))) {
    requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); const target = Number(body.target_quantity ?? (Number(pkg.purchased_quantity) + Number(body.delta || 0))); const minimum = Number(pkg.consumed_quantity || 0) + Number(pkg.held_quantity || 0); if (target < minimum - 0.000001) throw formationDemoError('لا يمكن خفض الإجمالي عن المستهلك والمحجوز.', 'quantity_below_committed'); const before = clone(pkg); const delta = Number((target - Number(pkg.purchased_quantity)).toFixed(4)); pkg.purchased_quantity = target; pkg.version = Number(pkg.version || 1) + 1; addRow(database, 'package_usage_ledger', { client_package_id: pkg.id, movement_type: 'adjustment', quantity: delta, reason, event_key: `owner-adjustment:${pkg.id}:${Date.now()}` }); addRow(database, 'owner_adjustments', { entity_type: 'client_packages', entity_id: pkg.id, adjustment_type: 'quantity', amount_delta_cents: 0, quantity_delta: delta, reason, before_data: before, after_data: clone(pkg) }); demoAudit(database, 'adjust_balance', 'client_packages', pkg.id, before, { ...clone(pkg), reason }); writeDatabase(database); return { id: pkg.id, purchased_quantity: target, minimum_quantity: minimum };
  }
  if ((match = route.match(/^\/client-packages\/(\d+)\/commercial-adjustment$/))) {
    requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); const oldTotal = moneyToCents(pkg.total_price); const oldPaid = moneyToCents(pkg.paid_amount); const newTotal = moneyToCents(body.target_total_price ?? pkg.total_price); const newPaid = moneyToCents(body.target_paid_amount ?? pkg.paid_amount); const paidDelta = newPaid - oldPaid; const ambiguous = pkg.source_invoice_id && database.client_packages.filter(row => Number(row.source_invoice_id) === Number(pkg.source_invoice_id)).length > 1 && database.payment_allocations.some(row => Number(row.invoice_id) === Number(pkg.source_invoice_id) && !row.client_package_id); if (paidDelta && ambiguous) throw formationDemoError('الفاتورة القديمة تضم أكثر من باقة ولا تحتوي توزيعًا دقيقًا.', 'ambiguous_legacy_allocation'); const before = clone(pkg); pkg.total_price = centsToMoney(newTotal); pkg.paid_amount = centsToMoney(newPaid); pkg.version = Number(pkg.version || 1) + 1; const adjustment = addRow(database, 'owner_adjustments', { entity_type: 'client_packages', entity_id: pkg.id, adjustment_type: 'commercial', amount_delta_cents: paidDelta, quantity_delta: newTotal - oldTotal, reason, before_data: before, after_data: clone(pkg) }); if (paidDelta > 0) { const payment = addRow(database, 'payments', { client_id: pkg.client_id, amount: centsToMoney(paidDelta), method: body.method || 'cash', status: 'approved', reference: `OWNER-ADJ-${adjustment.id}`, version: 1 }); addRow(database, 'payment_allocations', { client_id: pkg.client_id, payment_id: payment.id, client_package_id: pkg.id, invoice_id: pkg.source_invoice_id || null, amount: centsToMoney(paidDelta) }); addRow(database, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'package_paid_correction', client_id: pkg.client_id, amount: centsToMoney(paidDelta), method: body.method || 'cash', detail: `تصحيح مدفوع الباقة: ${pkg.name}`, date: dateOnly(), entity: 'الشركة', source_type: 'payment', source_id: payment.id, is_system: 1, version: 1 }); } else if (paidDelta < 0) addRow(database, 'finance', { type: 'قيد عكسي', entry_kind: 'reversal', category: 'package_paid_correction', client_id: pkg.client_id, amount: centsToMoney(Math.abs(paidDelta)), method: body.method || 'cash', detail: `خفض مدفوع الباقة: ${pkg.name}`, date: dateOnly(), entity: 'الشركة', source_type: 'owner_adjustment', source_id: adjustment.id, reversal_reason: reason, is_system: 1, version: 1 }); demoAudit(database, 'commercial_adjustment', 'client_packages', pkg.id, before, { ...clone(pkg), reason, adjustment_id: adjustment.id }); writeDatabase(database); const financial = packageFinancialSummary(pkg); return { id: pkg.id, adjustment_id: adjustment.id, financial: { total_price: pkg.total_price, paid_amount: pkg.paid_amount, remaining: centsToMoney(financial.outstandingCents), credit: centsToMoney(Math.max(0, financial.paidCents - financial.totalCents - financial.overageCents)) } };
  }
  if ((match = route.match(/^\/client-packages\/(\d+)\/archive$/))) { requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); const refs = database.bookings.filter(row => Number(row.client_package_id) === Number(pkg.id)).length + database.payment_allocations.filter(row => Number(row.client_package_id) === Number(pkg.id)).length + Math.max(0, database.package_usage_ledger.filter(row => Number(row.client_package_id) === Number(pkg.id)).length - 1); const before = clone(pkg); if (body.hard_delete && !refs && pkg.status === 'draft' && body.confirmation === 'DELETE') { database.package_usage_ledger = database.package_usage_ledger.filter(row => Number(row.client_package_id) !== Number(pkg.id)); database.client_packages = database.client_packages.filter(row => Number(row.id) !== Number(pkg.id)); demoAudit(database, 'hard_delete_unused_package', 'client_packages', pkg.id, before, { reason }); writeDatabase(database); return { id: pkg.id, deleted: true, archived: false }; } Object.assign(pkg, { status: 'archived', archive_reason: reason, archived_by: 1, archived_at: nowText(), version: Number(pkg.version || 1) + 1 }); demoAudit(database, 'archive_package', 'client_packages', pkg.id, before, clone(pkg)); writeDatabase(database); return { id: pkg.id, deleted: false, archived: true, references: refs }; }
  if ((match = route.match(/^\/client-packages\/(\d+)\/(extend|status)$/))) { requireDemoOwner(); const reason = demoReason(body); const pkg = findById(database, 'client_packages', match[1]); if (!pkg) throw formationDemoError('الباقة غير موجودة.', 'package_not_found'); const before = clone(pkg); if (match[2] === 'extend') pkg.expires_at = body.expires_at; if (match[2] === 'status') pkg.status = body.status; pkg.version = Number(pkg.version || 1) + 1; pkg.updated_at = nowText(); demoAudit(database, match[2] === 'extend' ? 'extend' : 'status_change', 'client_packages', pkg.id, before, { ...clone(pkg), reason }); writeDatabase(database); return clone(pkg); }

  if (route === '/projects/custom-service' && options.method === 'POST') {
    const labels = { reels: 'تصوير الريلز', advertising: 'تصوير الإعلانات', website: 'تصميم المواقع الإلكترونية', software: 'برامج الكمبيوتر والموبايل والويب', podcast: 'تصوير البودكاست', social_media: 'إدارة السوشيال ميديا', event_coverage: 'تغطية الإيفنتات', ai_video: 'فيديوهات الذكاء الاصطناعي' };
    const project = addRow(database, 'projects', { client_id: Number(body.client_id), name: body.name, category: body.service_type, service_type: body.service_type, pricing_model: body.pricing_model, quantity: Number(body.quantity || 1), unit_label: body.unit_label || 'project', agreed_price: Number(body.agreed_price || 0), requires_booking: body.requires_booking ? 1 : 0, requirements_json: body.requirements_json || {}, progress_percent: 0, status: body.status || 'planning', starts_at: body.starts_at || dateOnly(), due_at: body.due_at || null, notes: body.notes || '', created_by: 1 });
    (body.items?.length ? body.items : [{ description: labels[body.service_type] || project.name, quantity: project.quantity, unit: project.unit_label, unit_price: project.quantity ? project.agreed_price / project.quantity : project.agreed_price, total_price: project.agreed_price }]).forEach((item, index) => addRow(database, 'project_items', { project_id: project.id, client_id: project.client_id, item_type: item.item_type || 'service', description: item.description || item.title, quantity: Number(item.quantity || 1), unit: item.unit || item.unit_label || project.unit_label, unit_price: Number(item.unit_price ?? (project.agreed_price / Math.max(1, Number(item.quantity || 1)))), total_price: Number(item.total_price ?? project.agreed_price), internal_cost: Number(item.internal_cost || 0), is_client_visible: item.is_client_visible === false ? 0 : 1, sort_order: index }));
    const milestones = (body.milestones?.length ? body.milestones : getProjectStageTemplate(project.service_type)).map(item => typeof item === 'string' ? { title: item } : item).filter(item => String(item.title || '').trim());
    if (milestones.length < 2) throw new Error('يجب أن يحتوي المشروع على مرحلتين إنتاج على الأقل.');
    milestones.forEach((item, index) => addRow(database, 'project_milestones', { project_id: project.id, client_id: project.client_id, title: String(item.title).trim(), status: item.status || 'pending', progress_percent: Number(item.progress_percent || 0), client_note: item.client_note || '', is_client_visible: item.is_client_visible === false ? 0 : 1, sort_order: index }));
    let invoice = null;
    if (project.agreed_price > 0) { invoice = addRow(database, 'invoices', { client_id: project.client_id, project_id: project.id, invoice_number: `INV-DEMO-${String(nextId(database.invoices)).padStart(3, '0')}`, subtotal: project.agreed_price, discount: 0, total: project.agreed_price, paid_amount: Number(body.paid_amount || 0), issued_at: dateOnly(), due_at: body.invoice_due_at || body.due_at || dateOnly(7), status: Number(body.paid_amount || 0) >= project.agreed_price ? 'paid' : 'issued' }); project.invoice_id = invoice.id; }
    let booking = null;
    if (body.booking?.date) { const client = findById(database, 'clients', project.client_id); booking = addRow(database, 'bookings', { client_id: project.client_id, project_id: project.id, client_package_id: null, client_name: client?.name || 'عميل تجريبي', resource_id: Number(body.booking.resource_id || 1), resource_name: 'الاستديو الرئيسي', service: labels[project.service_type] || project.name, date: body.booking.date, start_time: body.booking.start_time, end_time: body.booking.end_time, status: body.booking.status || 'pending', requested_quantity: project.service_type === 'reels' ? project.quantity : 1, notes: body.booking.notes || '' }); }
    writeDatabase(database); return { id: project.id, invoice_id: invoice?.id || null, booking_id: booking?.id || null };
  }
  if (route === '/client/projects' && (options.method || 'GET') === 'GET') {
    const clientId = demoRole === 'client' ? 1 : 1;
    const projects = database.projects.filter(project => Number(project.client_id) === clientId).map(project => {
      const invoice = project.invoice_id ? findById(database, 'invoices', project.invoice_id) : database.invoices.find(item => Number(item.project_id) === Number(project.id));
      const total = Number(invoice?.total ?? project.agreed_price ?? 0); const paid = Number(invoice?.paid_amount || 0);
      const visibleItems = database.project_items.filter(item => Number(item.project_id) === Number(project.id) && Number(item.is_client_visible ?? 1) === 1).map(item => { const visible = { ...item }; delete visible.internal_cost; return visible; });
      const visibleMilestones = database.project_milestones.filter(item => Number(item.project_id) === Number(project.id) && Number(item.is_client_visible ?? 1) === 1).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)||Number(a.id)-Number(b.id)).map(item => { const visible = { ...item }; delete visible.internal_note; return visible; });
      return { ...clone(project), requirements: typeof project.requirements_json === 'object' ? clone(project.requirements_json) : {}, items: clone(visibleItems), milestones: clone(visibleMilestones), bookings: clone(database.bookings.filter(item => Number(item.project_id) === Number(project.id))), financial: { invoice_id: invoice?.id || null, invoice_number: invoice?.invoice_number || null, total, paid, remaining: Math.max(0, total - paid), status: total <= paid && total > 0 ? 'paid' : paid > 0 ? 'partial' : total > 0 ? 'unpaid' : 'not_required', due_at: invoice?.due_at || null } };
    });
    return { projects };
  }
  if ((match = route.match(/^\/projects\/(\d+)\/milestones$/)) && options.method === 'POST') {
    const project = findById(database, 'projects', match[1]); if (!project) throw new Error('المشروع غير موجود.');
    const title = String(body.title || '').trim(); if (!title || title.length > 160) throw new Error('اكتب اسم مرحلة واضحًا لا يزيد عن 160 حرفًا.');
    const siblings = database.project_milestones.filter(item => Number(item.project_id) === Number(project.id));
    const milestone = addRow(database, 'project_milestones', { project_id: project.id, client_id: project.client_id, title, status: 'pending', progress_percent: 0, client_note: body.client_note || '', is_client_visible: body.is_client_visible === false ? 0 : 1, sort_order: siblings.length });
    const progress = recalculateDemoProjectProgress(database, project.id); writeDatabase(database); return { ...clone(milestone), project_progress_percent: progress };
  }
  if ((match = route.match(/^\/project-milestones\/(\d+)$/)) && options.method === 'PATCH') {
    const milestone = findById(database, 'project_milestones', match[1]); if (!milestone) throw new Error('مرحلة المشروع غير موجودة.');
    const title = String(body.title || '').trim(); if (!title || title.length > 160) throw new Error('اكتب اسم مرحلة واضحًا لا يزيد عن 160 حرفًا.');
    milestone.title = title; if (Object.prototype.hasOwnProperty.call(body, 'client_note')) milestone.client_note = body.client_note || ''; if (Object.prototype.hasOwnProperty.call(body, 'is_client_visible')) milestone.is_client_visible = body.is_client_visible ? 1 : 0; milestone.updated_at = nowText();
    const progress = recalculateDemoProjectProgress(database, milestone.project_id); writeDatabase(database); return { ...clone(milestone), project_progress_percent: progress };
  }
  if ((match = route.match(/^\/project-milestones\/(\d+)$/)) && options.method === 'DELETE') {
    const milestone = findById(database, 'project_milestones', match[1]); if (!milestone) throw new Error('مرحلة المشروع غير موجودة.');
    const siblings = database.project_milestones.filter(item => Number(item.project_id) === Number(milestone.project_id)); if (siblings.length <= 2) throw new Error('يجب أن يبقى في المشروع مرحلتان على الأقل.'); if (milestone.status === 'completed') throw new Error('لا يمكن حذف مرحلة مكتملة حفاظًا على سجل العمل.');
    database.project_milestones = database.project_milestones.filter(item => Number(item.id) !== Number(milestone.id)); database.project_milestones.filter(item => Number(item.project_id) === Number(milestone.project_id)).sort((a,b)=>Number(a.sort_order||0)-Number(b.sort_order||0)).forEach((item,index)=>{item.sort_order=index});
    const progress = recalculateDemoProjectProgress(database, milestone.project_id); writeDatabase(database); return { id: milestone.id, deleted: true, project_progress_percent: progress };
  }
  if ((match = route.match(/^\/projects\/(\d+)\/milestones\/reorder$/)) && options.method === 'POST') {
    const project = findById(database, 'projects', match[1]); if (!project) throw new Error('المشروع غير موجود.');
    const siblings = database.project_milestones.filter(item => Number(item.project_id) === Number(project.id)); const ids = [...new Set((body.milestone_ids || []).map(Number))]; const existing = siblings.map(item => Number(item.id)).sort((a,b)=>a-b); const submitted = [...ids].sort((a,b)=>a-b); if (ids.length < 2 || JSON.stringify(existing) !== JSON.stringify(submitted)) throw new Error('أرسل كل مراحل المشروع مرة واحدة بترتيب صحيح.');
    ids.forEach((id,index)=>{findById(database,'project_milestones',id).sort_order=index}); const progress = recalculateDemoProjectProgress(database, project.id); writeDatabase(database); return { project_id: project.id, milestone_ids: ids, project_progress_percent: progress };
  }
  if ((match = route.match(/^\/project-milestones\/(\d+)\/status$/)) && options.method === 'POST') {
    const milestone = findById(database, 'project_milestones', match[1]); if (!milestone) throw new Error('مرحلة المشروع غير موجودة.');
    milestone.status = body.status; milestone.progress_percent = Number(body.progress_percent ?? (body.status === 'completed' ? 100 : body.status === 'in_progress' ? 50 : 0)); milestone.client_note = body.client_note ?? milestone.client_note; milestone.updated_at = nowText();
    const progress = recalculateDemoProjectProgress(database, milestone.project_id); writeDatabase(database); return { id: milestone.id, status: milestone.status, progress_percent: milestone.progress_percent, project_progress_percent: progress };
  }

  if (route === '/bookings/request' && options.method === 'POST') {
    const client = findById(database, 'clients', body.client_id);
    const service = findById(database, 'services', body.service_id);
    const pkg = database.client_packages.find(item => Number(item.client_id) === Number(body.client_id) && Number(item.service_id) === Number(body.service_id) && item.status === 'active');
    const start = Number(String(body.start_time).slice(0, 2)) * 60 + Number(String(body.start_time).slice(3, 5));
    let end = Number(String(body.end_time).slice(0, 2)) * 60 + Number(String(body.end_time).slice(3, 5)); if (end === 0) end = 1440;
    const quantity = body.requested_reels || ((end - start) / 60);
    const status = body.status === 'confirmed' ? 'confirmed' : 'pending';
    const row = addRow(database, 'bookings', { client_id: body.client_id, client_name: client?.name || 'عميل تجريبي', client_package_id: pkg?.id || null, service_id: body.service_id, resource_id: 1, resource_name: 'الاستديو الرئيسي', service: body.service || service?.name || 'جلسة تصوير', date: body.date, start_time: body.start_time, end_time: body.end_time, status, requested_quantity: quantity, requested_reels: body.requested_reels || 0, notes: body.notes || '', payment: 0 });
    if (pkg && status === 'confirmed') pkg.held_quantity = Number(pkg.held_quantity || 0) + Number(quantity || 0);
    writeDatabase(database); return row;
  }
  if ((match = route.match(/^\/bookings\/(\d+)\/decision$/))) { const booking = findById(database, 'bookings', match[1]); booking.status = body.action === 'confirm' ? 'confirmed' : body.action === 'reject' ? 'cancelled' : 'alternative_proposed'; writeDatabase(database); return booking; }
  if ((match = route.match(/^\/bookings\/(\d+)\/(admin-cancel|cancel-decision)$/))) { const booking = findById(database, 'bookings', match[1]); booking.status = route.endsWith('cancel-decision') && body.approve === false ? 'confirmed' : 'cancelled'; writeDatabase(database); return booking; }
  if ((match = route.match(/^\/bookings\/(\d+)\/cancel-request$/))) { const booking = findById(database, 'bookings', match[1]); booking.status = 'cancel_requested'; booking.notes = body.reason || booking.notes; writeDatabase(database); return booking; }
  if ((match = route.match(/^\/bookings\/(\d+)\/admin-reschedule$/))) { const booking = findById(database, 'bookings', match[1]); Object.assign(booking, { date: body.date, start_time: body.start_time, end_time: body.end_time }); writeDatabase(database); return booking; }
  if ((match = route.match(/^\/bookings\/(\d+)\/alternative-decision$/))) { const booking = findById(database, 'bookings', match[1]); booking.status = body.action === 'accept' ? 'confirmed' : 'pending'; writeDatabase(database); return booking; }
  if ((match = route.match(/^\/bookings\/(\d+)\/session\/start$/))) {
    const booking = findById(database, 'bookings', match[1]); booking.status = 'in_progress'; booking.timer_started_at = nowText();
    let session = database.booking_sessions.find(item => Number(item.booking_id) === Number(booking.id));
    if (!session) session = addRow(database, 'booking_sessions', { booking_id: booking.id, client_id: booking.client_id, client_package_id: booking.client_package_id, client_name: booking.client_name, service: booking.service, package_name: findById(database, 'client_packages', booking.client_package_id)?.name, billing_unit: findById(database, 'client_packages', booking.client_package_id)?.billing_unit || 'hour', scheduled_start_at: `${booking.date} ${booking.start_time}`, started_at: nowText(), status: 'active', requested_quantity: booking.requested_quantity, purchased_quantity: findById(database, 'client_packages', booking.client_package_id)?.purchased_quantity, consumed_quantity: findById(database, 'client_packages', booking.client_package_id)?.consumed_quantity, held_quantity: findById(database, 'client_packages', booking.client_package_id)?.held_quantity });
    writeDatabase(database); return session;
  }
  if ((match = route.match(/^\/bookings\/(\d+)\/session\/complete$/))) {
    const booking = findById(database, 'bookings', match[1]); const session = database.booking_sessions.find(item => Number(item.booking_id) === Number(booking.id)); const minutes = Number(body.actual_minutes || 1); const quantity = body.actual_reels ? Number(body.actual_reels) : minutes / 60;
    Object.assign(booking, { status: 'completed', timer_ended_at: nowText(), actual_seconds: minutes * 60, billable_quantity: quantity, actual_reels: Number(body.actual_reels || 0) });
    if (session) Object.assign(session, { status: 'completed', ended_at: nowText(), actual_seconds: minutes * 60, billable_quantity: quantity });
    const pkg = findById(database, 'client_packages', booking.client_package_id); if (pkg) { pkg.held_quantity = Math.max(0, Number(pkg.held_quantity || 0) - Number(booking.requested_quantity || 0)); pkg.consumed_quantity = Number(pkg.consumed_quantity || 0) + quantity; }
    writeDatabase(database); return booking;
  }
  if (route === '/studio-sessions/active') return clone(database.booking_sessions.filter(item => item.status === 'active'));

  if (route === '/reschedule-requests' && options.method === 'POST') { const row = addRow(database, 'reschedule_requests', { ...body, status: 'pending' }); writeDatabase(database); return row; }
  if ((match = route.match(/^\/reschedule-requests\/(\d+)\/decision$/))) { const request = findById(database, 'reschedule_requests', match[1]); request.status = body.action === 'approve' ? 'approved' : 'rejected'; if (body.action === 'approve') { const booking = findById(database, 'bookings', request.booking_id); Object.assign(booking, { date: request.proposed_date, start_time: request.proposed_start_time, end_time: request.proposed_end_time }); } writeDatabase(database); return request; }

  if ((match = route.match(/^\/payment-proofs\/(\d+)\/decision$/))) {
    const proof = findById(database, 'payment_proofs', match[1]); proof.status = body.action === 'approve' ? 'approved' : 'rejected'; proof.admin_note = body.note || '';
    if (proof.status === 'approved') {
      const amount = Number(proof.amount || 0); const allocations = [];
      const payment = addRow(database, 'payments', { client_id: proof.client_id, amount, method: 'bank_transfer', status: 'approved', reference: `DEMO-${proof.id}`, reviewed_at: nowText() });
      proof.payment_id = payment.id;
      const pkg = findById(database, 'client_packages', proof.client_package_id);
      if (pkg) {
        pkg.paid_amount = Number(pkg.paid_amount || 0) + amount;
        const linkedInvoice = pkg.source_invoice_id ? findById(database, 'invoices', pkg.source_invoice_id) : null;
        if (linkedInvoice) { linkedInvoice.paid_amount = Math.min(Number(linkedInvoice.total || 0), Number(linkedInvoice.paid_amount || 0) + amount); linkedInvoice.status = linkedInvoice.paid_amount >= Number(linkedInvoice.total || 0) ? 'paid' : 'partial'; }
        allocations.push({ client_package_id: pkg.id, invoice_id: linkedInvoice?.id || null, amount });
      } else {
        const invoice = findById(database, 'invoices', proof.invoice_id);
        if (invoice) {
          invoice.paid_amount = Math.min(Number(invoice.total || 0), Number(invoice.paid_amount || 0) + amount); invoice.status = invoice.paid_amount >= Number(invoice.total || 0) ? 'paid' : 'partial';
          let remaining = amount;
          database.client_packages.filter(row => Number(row.source_invoice_id) === Number(invoice.id)).sort((a, b) => Number(a.id) - Number(b.id)).forEach(linkedPackage => {
            if (remaining <= 0) return; const outstanding = Math.max(0, Number(linkedPackage.total_price || 0) - Number(linkedPackage.paid_amount || 0)); const allocated = Math.min(remaining, outstanding);
            if (allocated > 0) { linkedPackage.paid_amount = Number(linkedPackage.paid_amount || 0) + allocated; allocations.push({ client_package_id: linkedPackage.id, invoice_id: invoice.id, amount: allocated }); remaining -= allocated; }
          });
          if (remaining > 0) allocations.push({ client_package_id: null, invoice_id: invoice.id, amount: remaining });
        }
      }
      allocations.forEach(allocation => addRow(database, 'payment_allocations', { client_id: proof.client_id, payment_id: payment.id, payment_proof_id: proof.id, ...allocation }));
      addRow(database, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'package_payment', client_id: proof.client_id, amount, method: 'تحويل بنكي', detail: 'تحويل عميل تم اعتماده', date: dateOnly(), entity: 'الشركة' });
    }
    writeDatabase(database); return proof;
  }
  if (route === '/payment-proofs' && options.method === 'POST') { const row = addRow(database, 'payment_proofs', { ...body, status: 'pending', original_name: 'demo-transfer.jpg', mime_type: 'image/jpeg' }); writeDatabase(database); return row; }

  if ((match = route.match(/^\/payments\/(\d+)\/void$/)) && options.method === 'POST') { const result = demoVoidPayment(database, match[1], body); writeDatabase(database); return result; }
  if ((match = route.match(/^\/payments\/(\d+)\/correct$/)) && options.method === 'POST') {
    requireDemoOwner(); const oldPayment = findById(database, 'payments', match[1]); if (!oldPayment) throw formationDemoError('الدفعة غير موجودة.', 'payment_not_found'); const before = clone(oldPayment); const newCents = moneyToCents(body.amount); if (newCents <= 0) throw formationDemoError('مبلغ الدفعة البديلة يجب أن يكون أكبر من صفر.', 'invalid_payment_amount'); demoVoidPayment(database, oldPayment.id, body); const oldAllocations = database.payment_allocations.filter(row => Number(row.payment_id) === Number(oldPayment.id)); let targets;
    if (oldAllocations.length === 1 && !body.replacement_distribution?.length) targets = [{ package_id: oldAllocations[0].client_package_id || null, invoice_id: oldAllocations[0].invoice_id || null, amount: centsToMoney(newCents) }];
    else { const replacement = Array.isArray(body.replacement_distribution) ? body.replacement_distribution : []; if (!replacement.length || replacement.reduce((sum,row)=>sum+moneyToCents(row.amount),0)!==newCents) throw formationDemoError('يجب أن يساوي مجموع التوزيع البديل مبلغ الدفعة الجديدة بالقرش.', 'replacement_total_mismatch'); targets = replacement.map(row => { const pkg = findById(database, 'client_packages', row.package_id); if (!pkg || Number(pkg.client_id) !== Number(before.client_id)) throw formationDemoError('إحدى باقات التوزيع البديل لا تخص العميل.', 'invalid_allocation_package'); return { package_id: pkg.id, invoice_id: pkg.source_invoice_id || null, amount: centsToMoney(moneyToCents(row.amount)) }; }); }
    const replacementPayment = addRow(database, 'payments', { client_id: before.client_id, client_name: before.client_name, amount: centsToMoney(newCents), method: body.method || before.method, status: 'approved', reference: body.reference || `CORR-${oldPayment.id}`, corrected_from_id: oldPayment.id, version: 1 }); targets.forEach(target => { addRow(database, 'payment_allocations', { client_id: before.client_id, payment_id: replacementPayment.id, client_package_id: target.package_id, invoice_id: target.invoice_id, amount: target.amount }); const pkg = findById(database, 'client_packages', target.package_id); if (pkg) pkg.paid_amount = centsToMoney(moneyToCents(pkg.paid_amount) + moneyToCents(target.amount)); const invoice = findById(database, 'invoices', target.invoice_id); if (invoice) { invoice.paid_amount = centsToMoney(moneyToCents(invoice.paid_amount) + moneyToCents(target.amount)); invoice.status = Number(invoice.paid_amount) >= Number(invoice.total) ? 'paid' : 'partial'; } }); addRow(database, 'finance', { type: 'إيراد', entry_kind: 'income', category: 'payment_correction', client_id: before.client_id, amount: centsToMoney(newCents), method: replacementPayment.method, detail: body.detail || 'دفعة بديلة بعد تصحيح موثق', date: body.date || dateOnly(), entity: 'الشركة', source_type: 'payment', source_id: replacementPayment.id, is_system: 1, version: 1 }); demoAudit(database, 'correct_payment', 'payments', oldPayment.id, before, { replacement_payment_id: replacementPayment.id, reason: body.reason, distribution: clone(targets) }); writeDatabase(database); return { id: oldPayment.id, voided: true, replacement_payment_id: replacementPayment.id };
  }
  if ((match = route.match(/^\/finance\/(\d+)\/void$/)) && options.method === 'POST') {
    requireDemoOwner(); const reason = demoReason(body); const entry = findById(database, 'finance', match[1]); if (!entry) throw formationDemoError('الحركة المالية غير موجودة.', 'finance_not_found'); if (entry.source_type === 'payment' && entry.source_id) { const result = demoVoidPayment(database, entry.source_id, body); writeDatabase(database); return { ...result, routed_to: 'payment' }; } if (['transfer_in','transfer_out'].includes(entry.entry_kind)) throw formationDemoError('يجب إلغاء التحويل من مسار التحويل المترابط.', 'use_transfer_void'); const reversal = demoReverseFinance(database, entry, reason); demoAudit(database, 'void_finance', 'finance', entry.id, entry, { reversal_id: reversal.id, reason }); writeDatabase(database); return { id: entry.id, voided: true, reversal_id: reversal.id };
  }
  if ((match = route.match(/^\/finance\/(\d+)\/correct$/)) && options.method === 'POST') {
    requireDemoOwner(); const reason = demoReason(body); const entry = findById(database, 'finance', match[1]); if (!entry) throw formationDemoError('الحركة المالية غير موجودة.', 'finance_not_found'); if (entry.is_system || entry.source_type) throw formationDemoError('هذه حركة نظامية؛ يجب تصحيحها من مصدرها الأصلي.', 'correct_at_source'); const before = clone(entry); const reversal = demoReverseFinance(database, entry, reason); const replacement = addRow(database, 'finance', { type: body.entry_kind === 'expense' ? 'مصروف' : 'إيراد', entry_kind: body.entry_kind || entry.entry_kind, category: body.category || entry.category, amount: centsToMoney(moneyToCents(body.amount ?? entry.amount)), method: body.method || entry.method, detail: body.detail || entry.detail, date: body.date || entry.date, entity: body.entry_kind === 'income' ? 'الشركة' : body.entity || entry.entity, corrected_from_id: entry.id, is_system: 0, version: 1 }); demoAudit(database, 'correct_finance', 'finance', entry.id, before, { reversal_id: reversal.id, replacement_id: replacement.id, reason }); writeDatabase(database); return { id: entry.id, voided: true, reversal_id: reversal.id, replacement_id: replacement.id };
  }
  if ((match = route.match(/^\/finance\/transfers\/([^/]+)\/void$/)) && options.method === 'POST') {
    requireDemoOwner(); const reason = demoReason(body); const correlation = decodeURIComponent(match[1]).replace(/:(out|in)$/,''); const entries = database.finance.filter(entry => String(entry.correlation_id || '').replace(/:(out|in)$/,'') === correlation && ['transfer_in','transfer_out'].includes(entry.entry_kind)); if (entries.length !== 2) throw formationDemoError('لم يتم العثور على طرفي التحويل المترابطين.', 'transfer_pair_missing'); const reversalIds = entries.map(entry => demoReverseFinance(database, entry, reason).id); demoAudit(database, 'void_transfer', 'finance', entries[0].id, entries, { reversal_ids: reversalIds, reason }); writeDatabase(database); return { voided: true, reversal_ids: reversalIds };
  }

  if (route === '/finance/entries') {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لعرض دفتر الإيرادات.', 'forbidden');
    return financeDemoEntries(database);
  }
  if (route === '/finance/manual') {
    if (!['owner', 'admin'].includes(demoRole)) throw formationDemoError('ليس لديك صلاحية لتسجيل حركة مالية.', 'forbidden');
    const kind = body.entry_kind; const amount = Number(body.amount || 0); const category = body.category || (kind === 'income' ? 'other_income' : 'general_expense');
    const clientId = body.client_id ? Number(body.client_id) : null; const sourceType = body.source_type || null; const sourceId = body.source_id ? Number(body.source_id) : null;
    if (!['income', 'expense', 'advance_in', 'advance_out', 'settlement_out'].includes(kind) || amount <= 0) throw formationDemoError('بيانات الحركة المالية غير صحيحة.', 'invalid_finance_entry');
    if (!body.method || !body.detail || !/^\d{4}-\d{2}-\d{2}$/.test(String(body.date || ''))) throw formationDemoError('طريقة الدفع والبيان والتاريخ مطلوبة.', 'invalid_finance_entry');
    if (kind !== 'income' && (clientId || sourceType || sourceId)) throw formationDemoError('الحركة غير الإيرادية لا تقبل ربط عميل أو باقة أو خدمة.', 'invalid_expense_relation');
    if ((sourceType && !sourceId) || (!sourceType && sourceId)) throw formationDemoError('بيانات الربط المالي غير مكتملة.', 'invalid_finance_relation');
    if (category === 'client_revenue' && !clientId) throw formationDemoError('اختيار العميل مطلوب لإيراد العميل.', 'missing_finance_client');
    if (clientId && !findById(database, 'clients', clientId)) throw formationDemoError('العميل المحدد غير موجود.', 'invalid_finance_client');
    if (sourceType === 'client_package') { const pkg = findById(database, 'client_packages', sourceId); if (!pkg || Number(pkg.client_id) !== clientId) throw formationDemoError('الباقة المحددة لا تخص العميل.', 'invalid_finance_package'); }
    if (sourceType === 'service' && !findById(database, 'services', sourceId)) throw formationDemoError('الخدمة المحددة غير موجودة.', 'invalid_finance_service');
    if (sourceType && !['client_package', 'service'].includes(sourceType)) throw formationDemoError('نوع الربط المالي غير صحيح.', 'invalid_finance_relation');
    const type = { income: 'إيراد', expense: 'مصروف', advance_in: 'سداد سلفة', advance_out: 'سحب سلفة', settlement_out: 'سداد مستحقات' }[kind];
    const row = addRow(database, 'finance', { client_id: clientId, type, entry_kind: kind, category, amount: centsToMoney(moneyToCents(amount)), method: body.method, detail: body.detail, date: body.date, entity: kind === 'income' ? 'الشركة' : body.entity || 'الشركة', source_type: sourceType, source_id: sourceId, is_system: 0, version: 1 });
    writeDatabase(database); return financeDemoEntries(database).find(entry => Number(entry.id) === Number(row.id));
  }
  if (route === '/finance/transfer') { const correlation = `DEMO-${Date.now()}`; addRow(database, 'finance', { type: 'تحويل صادر', entry_kind: 'transfer_out', category: 'internal_transfer', amount: Number(body.amount), method: body.from_method, detail: body.note || `تحويل إلى ${body.to_method}`, date: body.date, entity: 'الشركة', correlation_id: correlation }); addRow(database, 'finance', { type: 'تحويل وارد', entry_kind: 'transfer_in', category: 'internal_transfer', amount: Number(body.amount), method: body.to_method, detail: body.note || `تحويل من ${body.from_method}`, date: body.date, entity: 'الشركة', correlation_id: `${correlation}-IN` }); writeDatabase(database); return { correlation_id: correlation }; }

  if (route === '/offers' && options.method === 'POST') { const subtotal = (body.items || []).reduce((sum, item) => sum + Number(item.quantity) * Number(item.unit_price), 0); const offer = addRow(database, 'offers', { client_id: body.client_id, offer_number: `OFF-DEMO-${String(nextId(database.offers)).padStart(3, '0')}`, title: body.title, subtotal, discount: Number(body.discount || 0), total: subtotal - Number(body.discount || 0), valid_until: body.valid_until, status: 'draft', notes: body.notes || '', created_by_role: demoRole }); (body.items || []).forEach(item => addRow(database, 'offer_items', { ...item, offer_id: offer.id, total: Number(item.quantity) * Number(item.unit_price) })); writeDatabase(database); return offer; }
  if ((match = route.match(/^\/offers\/(\d+)$/)) && (options.method || 'GET') === 'GET') { const offer = findById(database, 'offers', match[1]); return { ...clone(offer), items: clone(database.offer_items.filter(item => Number(item.offer_id) === Number(match[1]))) }; }
  if ((match = route.match(/^\/offers\/(\d+)\/send$/))) { const offer = findById(database, 'offers', match[1]); offer.status = 'sent'; writeDatabase(database); return offer; }
  if ((match = route.match(/^\/offers\/(\d+)\/accept$/))) { const offer = findById(database, 'offers', match[1]); offer.status = 'accepted'; const invoice = addRow(database, 'invoices', { client_id: offer.client_id, offer_id: offer.id, invoice_number: `INV-DEMO-${String(nextId(database.invoices)).padStart(3, '0')}`, subtotal: offer.subtotal, discount: offer.discount, total: offer.total, paid_amount: 0, issued_at: dateOnly(), due_at: dateOnly(7), status: 'issued' }); writeDatabase(database); return invoice; }
  if (route === '/client/offers') return clone(database.offers.filter(offer => offer.status === 'sent' && offer.created_by_role === 'owner'));

  if (route === '/app-notifications') return clone(database.app_notifications.filter(item => !item.dismissed_at));
  if ((match = route.match(/^\/app-notifications\/(\d+)\/read$/))) { const item = findById(database, 'app_notifications', match[1]); if (item) item.read_at = nowText(); writeDatabase(database); return item; }

  return { demo: true };
};

export const activateDemoMode = (role = 'owner') => { demoMode = true; demoRole = role; readDatabase(); };
export const deactivateDemoMode = () => { demoMode = false; demoRole = 'owner'; };
export const isDemoModeActive = () => demoMode;
export const resetDemoDatabase = () => { const database = createDemoDatabase(); writeDatabase(database); return database; };

const listeners = new Set();
export const demoClient = {
  from(table) { return new DemoQueryBuilder(table); },
  auth: {
    async getSession() { return { data: { session: null }, error: null }; },
    async getUser() { return { data: { user: null }, error: null }; },
    onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; },
    async signOut() { deactivateDemoMode(); return { error: null }; },
  },
  channel() { return { on() { return this; }, subscribe() { return this; }, unsubscribe() {} }; },
  removeChannel() {},
  async rpc() { return { data: null, error: null }; },
  async request(path, options) { try { return { data: await demoRequest(path, options), error: null }; } catch (error) { return { data: null, error }; } },
};
