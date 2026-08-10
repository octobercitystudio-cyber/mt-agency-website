import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/components/PublicPromotions.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/components/PublicPromotions.css', import.meta.url), 'utf8');
const theme = await readFile(new URL('../src/components/GoldenTicketTheme.css', import.meta.url), 'utf8');

test('multiple public offers render physical left and right arrows and no visible carousel control row', () => {
  assert.match(component, /function CarouselSideControls[\s\S]*if \(promotions\.length < 2\) return null;/);
  assert.match(component, /public-promo-carousel-arrow--left[^>]*onClick=\{\(\) => navigate\(leftStep\)\}[^>]*><ArrowLeft/);
  assert.match(component, /public-promo-carousel-arrow--right[^>]*onClick=\{\(\) => navigate\(rightStep\)\}[^>]*><ArrowRight/);
  assert.doesNotMatch(component, /CarouselIndicators|public-promo-carousel-dots|public-promo-carousel-indicators|public-promo-position/);
  assert.doesNotMatch(styles, /public-promo-carousel-dots|public-promo-carousel-indicators|public-promo-position/);
  assert.doesNotMatch(theme, /public-promo-carousel-dots|public-promo-carousel-indicators|public-promo-position/);
});

test('side arrow meaning and accessible labels follow the active reading direction', () => {
  assert.match(component, /const leftStep = isEnglish \? -1 : 1;/);
  assert.match(component, /const rightStep = leftStep \* -1;/);
  assert.match(component, /const actionLabel = step => step < 0 \? copy\.previous : copy\.next;/);
  assert.match(component, /aria-label=\{actionLabel\(leftStep\)\}/);
  assert.match(component, /aria-label=\{actionLabel\(rightStep\)\}/);
});

test('popup and desktop banner keep 44px arrows on the physical edges with reserved content space', () => {
  assert.match(styles, /\.public-promo-carousel-arrow \{[^}]*width: 44px;[^}]*height: 44px;/s);
  assert.match(styles, /\.public-promo-carousel-side-controls \{[^}]*position: absolute;[^}]*inset: 0;[^}]*pointer-events: none;/s);
  assert.match(styles, /public-promo-carousel-arrow--left \{ left: 10px; \}/);
  assert.match(styles, /public-promo-carousel-arrow--right \{ right: 10px; \}/);
  assert.match(styles, /public-promo-dialog-stack\.has-stack \.public-promo-dialog__content \{ padding-inline: 64px; \}/);
  assert.match(styles, /@media \(max-width: 680px\)[\s\S]*public-promo-dialog-stack\.has-stack \.public-promo-dialog__content \{ padding-inline: 62px; \}/);
  assert.match(component, /if \(isMobile\)[\s\S]*return <button[\s\S]*?\n  \}[\s\S]*return <aside[\s\S]*<CarouselSideControls/);
});

test('multi-offer desktop banner retains its layout while mobile uses the same 72px strip height', () => {
  assert.match(theme, /public-promo-banner\.has-stack \{[^}]*grid-template-rows: auto;[^}]*min-height: 88px;/s);
  assert.match(theme, /@media \(min-width: 681px\) and \(max-width: 1100px\)[\s\S]*public-promo-banner\.has-stack \{[^}]*grid-template-rows: auto auto;[^}]*min-height: 120px;/s);
  assert.match(theme, /@media \(max-width: 680px\)[\s\S]*public-promo-banner--mobile\.has-stack \{[^}]*min-height: 72px;/s);
  assert.match(theme, /@media \(max-width: 350px\)[\s\S]*public-promo-banner--mobile\.has-stack \{[^}]*height: 72px;[^}]*min-height: 72px;/s);
  assert.doesNotMatch(theme, /grid-template-rows:[^;}]*\s48px(?:\s|;)/);
  assert.doesNotMatch(styles, /grid-template-rows:[^;}]*\s48px(?:\s|;)/);
});

test('offer position remains available to assistive technology without a visible position badge', () => {
  assert.match(component, /public-promo-live[^>]*aria-live="polite"[^>]*aria-atomic="true"/);
  assert.match(component, /aria-label=\{`\$\{copy\.carousel\}: \$\{position\}`\}/);
  assert.match(component, /aria-label=\{`\$\{copy\.bannerLabel\}: \$\{position\}`\}/);
  assert.match(component, /aria-roledescription=\{isEnglish \? 'slide'[^>]*aria-label=\{position\}/);
});

test('header offset continues to publish the rendered compact banner height', () => {
  assert.match(component, /Math\.ceil\(element\.getBoundingClientRect\(\)\.height\)/);
  assert.match(component, /new ResizeObserver\(publishHeight\)/);
  assert.match(styles, /padding-block-start: calc\(var\(--public-header-height, 90px\) \+ var\(--public-promo-height, 0px\)\)/);
});
