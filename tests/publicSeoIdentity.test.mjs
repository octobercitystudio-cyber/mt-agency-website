import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { organizationSchema } from '../src/seo/organizationSchema.js';
import { formatPageTitle, publicPageDescriptions, siteIdentity } from '../src/seo/siteIdentity.js';
import { officialHeaderSocialLinks } from '../src/data/publicHeader.js';

test('organization identity includes the approved logo, contact and all official company profiles', () => {
  for (const locale of ['ar', 'en']) {
    const schema = organizationSchema(locale, { phone: '01114466646', facebook: '#' });
    assert.equal(schema.telephone, siteIdentity.telephone);
    assert.equal(schema.email, siteIdentity.email);
    assert.equal(schema.logo.url, siteIdentity.logo);
    assert.equal(schema.address.addressCountry, 'EG');
    for (const url of Object.values(officialHeaderSocialLinks)) assert.ok(schema.sameAs.includes(new URL(url).href));
    assert.equal(schema.description, publicPageDescriptions['/'][locale]);
  }
});

test('public metadata does not repeat the company name in the same title', () => {
  assert.equal(formatPageTitle('About Multi Task Agency'), 'About Multi Task Agency');
  assert.equal(formatPageTitle('خدماتنا'), 'خدماتنا | Multi Task Agency');
});

test('all common pages ship the shared descriptions and complete company identity before JavaScript', async () => {
  for (const [route, copy] of Object.entries(publicPageDescriptions)) {
    for (const locale of ['ar', 'en']) {
      const html = await readFile(new URL(`../dist/${locale}${route}index.html`, import.meta.url), 'utf8');
      assert.ok(html.includes(`<meta name="description" content="${copy[locale]}">`), `${locale}${route}`);
      const graph = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
      const org = graph.find(item => Array.isArray(item['@type']) && item['@type'].includes('Organization'));
      assert.deepEqual(org, organizationSchema(locale));
      assert.doesNotMatch(html, /حدث خطأ مؤقت|قد يكون بسبب مانع إعلانات/);
    }
  }
});
