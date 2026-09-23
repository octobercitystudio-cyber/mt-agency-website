import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientPackageBlocksPurchase, clientPackageOptionAllowed } from '../src/lib/clientPackageEligibility.js';
const cases = JSON.parse(readFileSync(new URL('./fixtures/clientPackageEligibility.json', import.meta.url)));
for (const item of cases) test(item.name, () => assert.equal(clientPackageBlocksPurchase(item.package, new Date(item.now)), item.blocks));
test('only custom without-editing option is retired', () => {
 assert.equal(clientPackageOptionAllowed({ name: '[مخصصة] تصوير 10 ساعات بدون مونتاج' }), false);
 assert.equal(clientPackageOptionAllowed({ name: 'باقة مُخصّصة بدون  مونتاج' }), false);
 assert.equal(clientPackageOptionAllowed({ name: 'باقة 10 ساعات' }), true);
 assert.equal(clientPackageOptionAllowed({ name: 'باقة مخصصة مع مونتاج' }), true);
});
