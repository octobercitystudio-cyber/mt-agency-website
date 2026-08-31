import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractLegacyOperationalData } from '../src/lib/legacyOperationalImport.js';
import { legacyBusinessImportPayload, matchLegacyBusinessData } from '../src/lib/legacyPackageMatching.js';

const load = path => readFile(new URL(`../${path}`, import.meta.url),'utf8');
const client = { id:1,name:'الاسم الحالي',phone1:'01000000000',phone2:null };
const service = { id:1,name:'باقة ساعتين',type:'package',price:500,deposit:200,validity_days:15,description:'',total_hours:2,payment_due_hours:1,total_reels:0,category:'تصوير' };

test('payment and package-creation rows are not duplicated as calendar appointments', () => {
  const data=extractLegacyOperationalData({ clients:[{ ...client,points:25,debt:0,credit:0 }],services:[service],bookings:[
    { id:1,client_name:client.name,service:service.name,date:'2026-08-01',status:'نشط',start_time:'',end_time:'',actual_hours:0,payment:0,custom_price:0,custom_expiry:'',discount:0,actual_reels:0 },
    { id:2,client_name:client.name,service:service.name,date:'2026-08-01',status:'دفعة',start_time:'',end_time:'',actual_hours:0,payment:250,custom_price:0,custom_expiry:'',discount:0,actual_reels:0 },
    { id:3,client_name:client.name,service:service.name,date:'2026-08-03',status:'منتهي',start_time:'1:00 م',end_time:'2:30 م',actual_hours:1.5,payment:0,custom_price:0,custom_expiry:'',discount:0,actual_reels:0 },
  ],finance:[],reminders:[],app_config:[],sourceFingerprint:'a'.repeat(64),asOfDate:'2026-08-10' });
  assert.equal(data.packages.length,1);assert.equal(data.packages[0].paid_amount,250);assert.equal(data.appointments.length,1);assert.equal(data.appointments[0].start_time,'13:00');assert.equal(data.appointments[0].status,'completed');
});

test('comprehensive matching uses phone only and can create a missing legacy service template', () => {
  const manifest={ service_catalog:[{ legacy_reference:'sqlite-service-1',name:'باقة ساعتين',billing_unit:'hour' }],packages:[{ legacy_reference:'sqlite-pkg-1',source_client_name:'اسم قديم',source_phone:'01000000000',source_service_name:'باقة ساعتين',service_match_name:'باقة ساعتين',billing_unit:'hour',purchased_quantity:2,consumed_quantity:1,payment_due_quantity:1,total_price:500,paid_amount:250,starts_at:'2026-08-01',expires_at:'2026-08-15',validity_days_snapshot:15,status:'active',issues:[] }],projects:[],appointments:[],finance_entries:[],client_balances:[],reminders:[],business_config:[] };
  const matched=matchLegacyBusinessData({ manifest,clients:[client],services:[],resources:[] });assert.equal(matched.blocked,0);assert.equal(matched.packages[0].create_service,true);assert.equal(matched.packages[0].target_client_name,'الاسم الحالي');
  const payload=legacyBusinessImportPayload({ matched,source:{ sha256:'b'.repeat(64) },sourceArchive:{ clients:[] } });assert.equal(payload.packages[0].client_id,1);assert.equal(payload.packages[0].service_id,null);assert.equal(payload.source_archive.clients.length,0);
});

test('server import is owner-only, atomic, idempotent and archives only allow-listed business rows', async () => {
  const api=await load('api/legacy_import.php');
  assert.match(api,/requireRole\(\$user,\['owner'\]\)/);assert.match(api,/beginTransaction/);assert.match(api,/rollBack/);assert.match(api,/legacy_import_batches/);assert.match(api,/source_sha256/);assert.match(api,/legacy_import_records/);
  assert.match(api,/\['clients','services','bookings','finance','reminders','app_config'\]/);assert.doesNotMatch(api,/INSERT INTO users/);assert.doesNotMatch(api,/password_hash/);
  assert.match(api,/reserveBookingSlots/);assert.match(api,/legacy_booking_conflict/);assert.match(api,/mutateLockedPackageQuantities/);assert.match(api,/حجز قادم من البرنامج القديم/);
  assert.match(api,/function legacyImportAudit/);assert.match(api,/legacyImportPublishChanges/);assert.match(api,/finance_periods_refreshed/);
});
