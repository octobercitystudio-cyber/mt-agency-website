import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const theme = await readFile(new URL('../src/components/GoldenTicketTheme.css', import.meta.url), 'utf8');
const componentTheme = await readFile(new URL('../src/components/PublicPromotions.css', import.meta.url), 'utf8');
const promotions = await readFile(new URL('../src/components/PublicPromotions.jsx', import.meta.url), 'utf8');

test('public offer banner keeps its explicit exclusive-offer cue', () => {
  assert.match(promotions, /bannerBadge: 'عرض حصري'/);
  assert.match(promotions, /bannerBadge: 'Exclusive offer'/);
  assert.match(promotions, /public-promo-banner__badge[^>]*><Sparkles/);
  assert.match(theme, /\.public-promo-banner__badge \{[^}]*color: #fff;[^}]*border: 1px dashed rgba\(255,255,255,\.76\);/s);
});

test('every readable banner element uses crisp white text', () => {
  const whiteSelectors = [
    'public-promo-banner__badge',
    'public-promo-banner__copy strong',
    'public-promo-banner__copy span',
    'public-promo-banner__timer-label',
    'public-promo-countdown.compact strong',
    'public-promo-countdown.compact small',
    'public-promo-banner__cta',
    'public-promo-banner__close',
  ];

  for (const selector of whiteSelectors) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(theme, new RegExp(`\\.app-container \\.${escaped} \\{[^}]*color: #fff;`, 's'));
  }
});

test('offer banner keeps accessible mobile actions and reduced motion', () => {
  assert.match(theme, /public-promo-banner__close \{[^}]*width: 44px;[^}]*height: 44px;/s);
  assert.match(theme, /public-promo-banner__cta \{[^}]*min-height: 48px;/s);
  assert.match(theme, /prefers-reduced-motion: reduce[\s\S]*public-promo-banner::after \{ animation: none; \}/);
});

test('offer popup and every foreground icon use the pure-white offer tokens', () => {
  assert.match(componentTheme, /\.public-promo-dialog \{[\s\S]*?--offer-text: #fff;[\s\S]*?--offer-icon: #fff;/);
  assert.match(componentTheme, /\.public-promo-banner \{[\s\S]*?--offer-text: #fff;[\s\S]*?--offer-icon: #fff;/);

  const popupWhiteSelectors = [
    'public-promo-foil-label',
    'public-promo-seal',
    'public-promo-dialog h2',
    'public-promo-dialog__content > p',
    'public-promo-value small',
    'public-promo-value strong',
    'public-promo-value del',
    'public-promo-countdown strong',
    'public-promo-countdown small',
    'public-promo-dialog__note',
  ];
  for (const selector of popupWhiteSelectors) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(componentTheme, new RegExp(`\\.${escaped} \\{[^}]*color: var\\(--offer-text\\);`, 's'));
  }

  for (const selector of ['public-promo-close svg', 'public-promo-gift-sparkle', 'public-promo-kicker svg', 'public-promo-cta svg', 'public-promo-banner__badge svg', 'public-promo-banner__timer-label svg', 'public-promo-banner__cta svg', 'public-promo-banner__close svg']) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.match(componentTheme, new RegExp(`\\.${escaped} \\{[^}]*stroke: var\\(--offer-icon\\);`, 's'));
  }

  assert.match(componentTheme, /\.public-promo-foil-label \{[^}]*opacity: 1;/s);
  assert.match(theme, /\.public-promo-cta:is\(:hover,:focus,:active,:visited\) \{[^}]*color: #fff;/s);
});
