import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { millisecondsToNextSecond, promotionCountdownParts, promotionIsVisibleAt } from '../src/lib/promotionCountdown.js';

const labels = { day: 'Days', hour: 'Hours', minute: 'Minutes', second: 'Seconds' };
const values = milliseconds => promotionCountdownParts(milliseconds, labels)?.map(part => part.value);

test('offer countdown always exposes synchronized days, hours, minutes and seconds', () => {
  assert.deepEqual(values(59_000), ['00', '00', '00', '59']);
  assert.deepEqual(values(58_000), ['00', '00', '00', '58']);
  assert.deepEqual(values(60_000), ['00', '00', '01', '00']);
  assert.deepEqual(values(59_999), ['00', '00', '00', '59']);
  assert.deepEqual(values(3_600_000), ['00', '01', '00', '00']);
  assert.deepEqual(values(86_400_000), ['01', '00', '00', '00']);
  assert.deepEqual(values(900_610_000), ['10', '10', '10', '10']);
});

test('offer countdown clamps expired values and rejects invalid expiry math', () => {
  assert.deepEqual(values(0), ['00', '00', '00', '00']);
  assert.deepEqual(values(-5_000), ['00', '00', '00', '00']);
  assert.equal(promotionCountdownParts(Number.NaN, labels), null);
  assert.equal(promotionCountdownParts(Number.POSITIVE_INFINITY, labels), null);
});

test('visibility gives expiry one zero frame and rejects malformed dates', () => {
  const toEpoch = value => Number(value);
  const promotion = { starts_at: 1_000, ends_at: 5_000 };
  assert.equal(promotionIsVisibleAt(promotion, 5_000, toEpoch), true);
  assert.equal(promotionIsVisibleAt(promotion, 5_999, toEpoch), true);
  assert.equal(promotionIsVisibleAt(promotion, 6_000, toEpoch), false);
  assert.equal(promotionIsVisibleAt({ starts_at: 'bad', ends_at: 5_000 }, 5_000, toEpoch), false);
});

test('second-boundary scheduler aligns once and clock jumps remain derived from current time', () => {
  assert.equal(millisecondsToNextSecond(10_000), 1_000);
  assert.equal(millisecondsToNextSecond(10_001), 999);
  assert.equal(millisecondsToNextSecond(10_999), 1);
  assert.deepEqual(values(120_000 - 61_000), ['00', '00', '00', '59']);
});

test('popup and compact banner use the same four-part countdown component', async () => {
  const source = await readFile(new URL('../src/components/PublicPromotions.jsx', import.meta.url), 'utf8');
  assert.match(source, /promotionCountdownParts\(cairoDateTimeToEpoch\(promotion\.ends_at\) - now, labels\)/);
  assert.match(source, /<PromotionCountdown promotion=\{promotion\} now=\{now\} isEnglish=\{isEnglish\}/);
  assert.match(source, /<PromotionCountdown promotion=\{promotion\} now=\{now\} compact isEnglish=\{isEnglish\}/);
  assert.match(source, /data-unit=\{part\.unit\}/);
  assert.match(source, /Date\.now\(\) \+ clockOffset\.current/);
});

test('four countdown cells stay white and responsive in popup and compact banner', async () => {
  const css = await readFile(new URL('../src/components/PublicPromotions.css', import.meta.url), 'utf8');
  assert.match(css, /public-promo-countdown \{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\);/s);
  assert.match(css, /public-promo-countdown span \{[^}]*color: var\(--offer-text\);/s);
  assert.match(css, /public-promo-countdown strong \{[^}]*color: var\(--offer-text\);[^}]*font-variant-numeric: tabular-nums;/s);
  assert.match(css, /public-promo-countdown small \{[^}]*color: var\(--offer-text\);/s);
  assert.match(css, /public-promo-countdown\.compact span small \{ display: block;/);
});

test('tablet and mobile offer layouts keep four compact units inside the ticket', async () => {
  const source = await readFile(new URL('../src/components/PublicPromotions.jsx', import.meta.url), 'utf8');
  const theme = await readFile(new URL('../src/components/GoldenTicketTheme.css', import.meta.url), 'utf8');
  assert.match(source, /dayShort: 'Day'.*hourShort: 'Hr'.*minuteShort: 'Min'.*secondShort: 'Sec'/s);
  assert.match(source, /dayShort: 'يوم'.*hourShort: 'س'.*minuteShort: 'د'.*secondShort: 'ث'/s);
  assert.match(theme, /@media \(min-width: 681px\) and \(max-width: 1100px\)[\s\S]*?public-promo-banner__timer \{ grid-column: 1 \/ 3;/);
  assert.match(theme, /@media \(max-width: 680px\)[\s\S]*?public-promo-banner--mobile \.public-promo-countdown\.compact span \{ min-width: 25px; \}/);
});
