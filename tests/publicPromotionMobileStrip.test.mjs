import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/components/PublicPromotions.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/components/PublicPromotions.css', import.meta.url), 'utf8');
const theme = await readFile(new URL('../src/components/GoldenTicketTheme.css', import.meta.url), 'utf8');
const pages = await readFile(new URL('../src/pages/PublicPages.css', import.meta.url), 'utf8');

test('mobile promotion is one concise accessible button with a four-part live countdown', () => {
  assert.match(component, /mobileStrip: 'عرض حصري لفترة محدودة'/);
  assert.match(component, /mobileStrip: 'Exclusive limited-time offer'/);
  assert.match(component, /if \(isMobile\) \{[\s\S]*return <button ref=\{bannerRef\} type="button"/);
  assert.match(component, /public-promo-banner--mobile/);
  assert.match(component, /aria-label=\{offerContext\}[^\n]*onClick=\{onOpen\}/);
  assert.match(component, /public-promo-banner__mobile-copy[\s\S]*<PromotionCountdown[^>]*compact[^>]*isEnglish=\{isEnglish\}/);
  assert.match(styles, /public-promo-banner--mobile \.public-promo-countdown\.compact \{[^}]*grid-template-columns: repeat\(4,/s);
});

test('collapsed mobile strip omits rich banner controls while retaining full-dialog arrows', () => {
  const mobileBranch = component.match(/if \(isMobile\) \{([\s\S]*?)\n  \}\n  return <aside/)?.[1] || '';
  assert.doesNotMatch(mobileBranch, /PromotionLink|CarouselSideControls|public-promo-banner__close|public-promo-banner__cta|public-promo-banner__copy/);
  assert.match(component, /function PromotionDialog[\s\S]*<CarouselSideControls promotions=\{promotions\}/);
  assert.match(component, /function PromotionBanner[\s\S]*return <aside[\s\S]*<CarouselSideControls promotions=\{promotions\}/);
});

test('tapping the strip opens the existing dialog and closing it does not arm auto-popup again', () => {
  assert.match(component, /const \[manualDialogOpen, setManualDialogOpen\] = useState\(false\)/);
  assert.match(component, /const popupOpen = manualDialogOpen \|\| \(!popupSuppressed && popupItems\.length > 0\)/);
  assert.match(component, /const openBannerDialog = useCallback\(\(\) => \{[\s\S]*setPopupSuppressed\(true\);[\s\S]*setManualDialogOpen\(true\)/);
  assert.match(component, /if \(manualDialogOpen\) \{[\s\S]*setManualDialogOpen\(false\);[\s\S]*return;/);
});

test('dialog preserves backdrop, Escape and focus-return behavior for the strip trigger', () => {
  assert.match(component, /onMouseDown=\{event => event\.target === event\.currentTarget && close\(\)\}/);
  assert.match(component, /if \(event\.key === 'Escape'\) \{ event\.preventDefault\(\); closePopupRef\.current\(\); return; \}/);
  assert.match(component, /const previous = document\.activeElement;/);
  assert.match(component, /if \(previous instanceof HTMLElement\) previous\.focus\(\);/);
  assert.match(component, /visibleBanner = \(!popupOpen \|\| manualDialogOpen\)/, 'manual dialog keeps its trigger mounted for focus return');
});

test('responsive ticket height is exactly 72px down to 320px and publishes its rendered height', () => {
  assert.match(styles, /\.public-promo-banner--mobile \{[\s\S]*?height: 72px;[\s\S]*?min-height: 72px;/);
  assert.match(theme, /@media \(max-width: 680px\)[\s\S]*?\.public-promo-banner--mobile \{[^}]*height: 72px;[^}]*min-height: 72px;/s);
  assert.match(theme, /@media \(max-width: 350px\)[\s\S]*?public-promo-banner--mobile\.has-stack \{[^}]*height: 72px;[^}]*min-height: 72px;/s);
  assert.match(component, /Math\.ceil\(element\.getBoundingClientRect\(\)\.height\)/);
  assert.match(component, /setProperty\('--public-promo-height'/);
  assert.match(component, /\}, \[isMobile, visibleBanner\]\);/, 'height observer is rebound when the responsive DOM element changes');
});

test('one public main offset owns header plus promotion spacing without hero double counting', () => {
  assert.match(styles, /\.public-site-shell > main#main-content \{[^}]*padding-block-start: calc\(var\(--public-header-height, 90px\) \+ var\(--public-promo-height, 0px\)\)/s);
  assert.doesNotMatch(styles, /main\.app-container/);
  assert.match(pages, /public-site-shell > main#main-content \.public-editorial-hero\{padding-top:88px\}/);
  assert.match(pages, /public-site-shell > main#main-content \.public-breadcrumb\{padding-top:28px\}/);
  assert.match(pages, /@media\(max-width:600px\)[\s\S]*public-editorial-hero\{padding-top:48px\}/);
});
