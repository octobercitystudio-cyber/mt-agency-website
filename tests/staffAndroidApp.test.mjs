import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { isStaffAppEntry } from '../src/lib/staffAppEntry.js';
const read = file => readFile(new URL('../'+file, import.meta.url), 'utf8');
test('team entry survives logout but ordinary customer entry stays unchanged',()=>{
 assert.equal(isStaffAppEntry('?source=android-staff-app'),true);
 assert.equal(isStaffAppEntry('?source=android-staff-shortcut'),true);
 assert.equal(isStaffAppEntry('',true),true);
 for(const input of ['', '?source=android-app','?source=android-shortcut','?returnTo=/erp']) assert.equal(isStaffAppEntry(input),false);
});
test('team Android build is separately installable with staff-only deep links and matching site association',async()=>{
 const [gradle,manifest,shortcuts,links,customer]=await Promise.all(['android-twa/staff/build.gradle','android-twa/staff/src/main/AndroidManifest.xml','android-twa/staff/src/main/res/xml/shortcuts.xml','public/.well-known/assetlinks.json','android-twa/twa-manifest.json'].map(read));
 assert.match(gradle,/applicationId 'com.multitaskagency.staff'/);assert.match(gradle,/\/adminmt\/login\?source=android-staff-app/);
 assert.match(manifest,/android:pathPrefix="\/adminmt"/);assert.match(manifest,/android:pathPrefix="\/erp"/);assert.doesNotMatch(manifest,/android:pathPrefix="\/"/);
 assert.match(shortcuts,/android:targetPackage="com.multitaskagency.staff"/);assert.match(shortcuts,/android:targetClass="com.multitaskagency.app.LauncherActivity"/);
 const association=JSON.parse(links).find(row=>row.target.package_name==='com.multitaskagency.staff');assert.equal(association.target.sha256_cert_fingerprints.length,1);
 assert.equal(JSON.parse(customer).packageId,'com.multitaskagency.app');assert.equal(JSON.parse(customer).startUrl,'/login?source=android-app');
});
