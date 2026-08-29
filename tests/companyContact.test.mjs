import assert from 'node:assert/strict';
import test from 'node:test';
import { companyPhoneTel, companyPhoneWhatsApp, normalizeCompanyPhone } from '../src/lib/companyContact.js';

test('company phone numbers normalize to Egypt international display and tel format', () => {
  assert.equal(normalizeCompanyPhone('01114466646'), '+201114466646');
  assert.equal(normalizeCompanyPhone('01094084424'), '+201094084424');
  assert.equal(normalizeCompanyPhone('+201114466646'), '+201114466646');
  assert.equal(normalizeCompanyPhone('00201114466646'), '+201114466646');
  assert.equal(normalizeCompanyPhone('0111 446-6646'), '+201114466646');
  assert.equal(companyPhoneTel('0109-408-4424'), '+201094084424');
});

test('WhatsApp format is digits-only and empty or unknown values stay safe', () => {
  assert.equal(companyPhoneWhatsApp('0020 111 446 6646'), '201114466646');
  assert.equal(companyPhoneWhatsApp('+201094084424'), '201094084424');
  assert.equal(normalizeCompanyPhone(''), '');
  assert.equal(normalizeCompanyPhone(null), '');
  assert.equal(normalizeCompanyPhone('studio extension'), 'studio extension');
  assert.equal(companyPhoneWhatsApp('studio extension'), '');
});
