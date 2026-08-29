import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { VERIFIED_PORTFOLIO, VERIFIED_PORTFOLIO_CATEGORIES } from '../src/data/verifiedPortfolio.js';

const source = await readFile(new URL('../src/store/DataContext.jsx', import.meta.url), 'utf8');

test('missing remote website configuration keeps the verified company portfolio', async () => {
  assert.match(source, /portfolioCategories:\s*VERIFIED_PORTFOLIO_CATEGORIES/);
  assert.match(source, /portfolio:\s*VERIFIED_PORTFOLIO/);
  assert.equal(VERIFIED_PORTFOLIO.length, 41);
  assert.equal(VERIFIED_PORTFOLIO_CATEGORIES.length, 6);
  assert.ok(VERIFIED_PORTFOLIO.every((item) => item.embedUrl || item.imageUrl));
  assert.ok(VERIFIED_PORTFOLIO.every((item) => !String(item.imageUrl || '').includes('unsplash.com')));
  assert.ok(VERIFIED_PORTFOLIO.every((item) => !item.embedUrl || /^https:\/\/(?:youtu\.be|youtube\.com)\//.test(item.embedUrl)));

  const addedSites = VERIFIED_PORTFOLIO.filter((item) => ['https://www.afc-cpa.com/', 'https://www.almajdwoods.com/'].includes(item.projectUrl));
  assert.equal(addedSites.length, 2);
  assert.ok(addedSites.every((item) => item.category === 'web' && item.imageUrl.startsWith('/portfolio/')));
  for (const item of addedSites) {
    const image = await readFile(new URL(`../public${item.imageUrl}`, import.meta.url));
    assert.deepEqual([...image.subarray(0, 3)], [255, 216, 255]);
  }
});

test('the public surface still loads website_data from Hostinger before rendering owned work', () => {
  assert.match(source, /getPublicDataClient\(\)/);
  assert.match(source, /\.from\('app_config'\)/);
  assert.match(source, /\.eq\('key', 'website_data'\)/);
  assert.match(source, /setSiteData\(withOfficialContactEmail\(\{ \.\.\.defaultData, \.\.\.parsedData \}\)\)/);
});
