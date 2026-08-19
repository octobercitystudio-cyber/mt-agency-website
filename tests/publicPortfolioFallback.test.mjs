import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/store/DataContext.jsx', import.meta.url), 'utf8');

test('missing remote website configuration never exposes third-party portfolio samples', () => {
  const fallbackStart = source.indexOf('const defaultData =');
  const fallbackEnd = source.indexOf('const withOfficialContactEmail');
  const fallback = source.slice(fallbackStart, fallbackEnd);
  const portfolioStart = fallback.indexOf('portfolio:');
  const portfolioEnd = fallback.indexOf('contact:', portfolioStart);
  const portfolioFallback = fallback.slice(portfolioStart, portfolioEnd);

  assert.match(portfolioFallback, /portfolio:\s*\[\]/);
  assert.doesNotMatch(portfolioFallback, /youtube\.com\/embed|images\.unsplash\.com|qpshoes\.shop/);
});

test('the public surface still loads website_data from Hostinger before rendering owned work', () => {
  assert.match(source, /getPublicDataClient\(\)/);
  assert.match(source, /\.from\('app_config'\)/);
  assert.match(source, /\.eq\('key', 'website_data'\)/);
  assert.match(source, /setSiteData\(withOfficialContactEmail\(\{ \.\.\.defaultData, \.\.\.parsedData \}\)\)/);
});
