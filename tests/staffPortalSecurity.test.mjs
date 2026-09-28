import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAFF_BASE, STAFF_LOGIN_PATH, staffPath, legacyStaffDestination, isStaffPortalPath } from '../src/lib/staffRoutes.js';
import { isStaffPushPage } from '../src/lib/pushScope.js';
import { hostingerClient } from '../src/lib/hostingerClient.js';
const read = path => readFileSync(new URL('../'+path, import.meta.url), 'utf8');

test('opaque portal has one route contract across browser, web server, push and Android', () => {
  assert.match(STAFF_BASE, /^\/p-[a-f0-9]{16}$/);
  assert.equal(STAFF_LOGIN_PATH, STAFF_BASE+'/login');
  for (const file of ['.htaccess', 'public/sw.js', 'android-twa/staff/build.gradle', 'android-twa/staff/src/main/AndroidManifest.xml', 'android-twa/staff/src/main/res/xml/shortcuts.xml']) assert.ok(read(file).includes(STAFF_BASE.replace(/^\//,'')), file);
  for (const path of [STAFF_BASE, staffPath('/settings'), STAFF_LOGIN_PATH]) { assert.equal(isStaffPortalPath(path), true); assert.equal(isStaffPushPage(path), true); }
  for (const path of ['/dashboard','/login',STAFF_BASE+'-wrong']) assert.equal(isStaffPortalPath(path), false);
  assert.equal(legacyStaffDestination('/erp/bookings'),staffPath('/bookings'));
  assert.equal(legacyStaffDestination('/adminmt/login'),STAFF_LOGIN_PATH);
  assert.equal(legacyStaffDestination('/adminmt/hero'),staffPath('/site/hero'));
  assert.equal(legacyStaffDestination('/erperson'),null);
  assert.ok(!read('dist/sitemap.xml').includes(STAFF_BASE));
  assert.ok(!read('dist/robots.txt').includes(STAFF_BASE));
});

test('MFA challenge never hydrates a session and the verified retry includes the code', async t => {
  const oldFetch=globalThis.fetch, oldDocument=globalThis.document, events=[],requests=[];
  globalThis.document={cookie:'__Host-mt_csrf=csrf-fixture'};
  const responses=[{ok:false,status:401,payload:{error:{code:'mfa_required',message:'Code required'}}},{ok:true,status:200,payload:{data:{session:{active:true},user:{id:1,role:'owner'}}}}];
  globalThis.fetch=async(url,options)=>{requests.push({url,options});const result=responses.shift();return {...result,headers:{get:()=>null},json:async()=>result.payload};};
  const sub=hostingerClient.auth.onAuthStateChange((event,session)=>events.push({event,session}));
  t.after(()=>{globalThis.fetch=oldFetch;globalThis.document=oldDocument;sub.data.subscription.unsubscribe();});
  const input={identifier:'owner@example.test',password:'fixture'};
  assert.equal((await hostingerClient.auth.signInStaffWithPassword(input)).error.code,'mfa_required');assert.equal(events.length,0);
  assert.equal((await hostingerClient.auth.signInStaffWithPassword({...input,code:'123456'})).data.user.role,'owner');assert.equal(events.length,1);
  assert.equal(JSON.parse(requests[1].options.body).code,'123456');
  assert.equal(requests[1].options.headers['X-CSRF-Token'],'csrf-fixture');
});

test('staff password login cannot bypass CSRF or issue a session before the second factor', () => {
  const api=read('api/index.php');
  const csrf=api.match(/function requireCsrf[\s\S]*?\n\}/)[0];
  assert.ok(!csrf.includes("'/auth/staff/login'"));
  const login=api.match(/if \(\$path === '\/auth\/staff\/login'[\s\S]*?\n\}/)[0];
  assert.ok(login.indexOf('authenticateStaffPassword')<login.indexOf('verifyOwnerMfa'));
  assert.ok(login.indexOf('verifyOwnerMfa')<login.indexOf('issueLoginSession'));
  assert.match(read('api/auth_identity.php'), /enforceLoginRateLimit\(\$pdo, 'user:'\.\$found\['id'\]\)/);
  assert.match(api, /authLimitKey\('account', 'user:'\.\$user\['id'\]\)/);
});
