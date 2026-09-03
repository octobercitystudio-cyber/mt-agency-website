import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const appSource = await readFile(new URL('../src/App.jsx', import.meta.url), 'utf8');
const actionSource = await readFile(new URL('../src/components/GlobalContactActions.jsx', import.meta.url), 'utf8');
const actionStyles = await readFile(new URL('../src/components/GlobalContactActions.css', import.meta.url), 'utf8');
const contactSource = await readFile(new URL('../src/components/Contact.jsx', import.meta.url), 'utf8');
const contactStyles = await readFile(new URL('../src/components/Contact.css', import.meta.url), 'utf8');
const footerStyles = await readFile(new URL('../src/components/Footer.css', import.meta.url), 'utf8');

test('the reusable contact dock is mounted globally before application routes', () => {
  assert.match(appSource, /import GlobalContactActions from ['"]\.\/components\/GlobalContactActions['"]/);
  const bridgeIndex = appSource.indexOf('<PushNotificationsBridge />');
  const actionsIndex = appSource.indexOf('<GlobalContactActions />');
  const routesIndex = appSource.indexOf('<Routes>');
  assert.ok(bridgeIndex > -1 && bridgeIndex < actionsIndex && actionsIndex < routesIndex);
});

test('WhatsApp and direct-call actions use the exact company number and accessible Arabic labels', () => {
  assert.match(actionSource, /companyPhoneWhatsApp\('01114466646'\)/);
  assert.match(actionSource, /tel:\$\{companyPhoneTel\(CONTACT_NUMBER\)\}/);
  assert.match(actionSource, /const CONTACT_NUMBER = normalizeCompanyPhone\('01114466646'\)/);
  assert.match(actionSource, /aria-label=\{isEnglish \? 'Quick contact options' : 'خيارات التواصل السريع'\}/);
  assert.match(actionSource, /تواصل معنا عبر واتساب/);
  assert.match(actionSource, /اتصل بنا على الرقم/);
  assert.match(actionSource, /Contact us on WhatsApp at/);
  assert.match(actionSource, /Call us at/);
  assert.match(actionSource, /target="_blank"/);
  assert.match(actionSource, /rel="noopener noreferrer"/);
  assert.doesNotMatch(actionSource, /MessageCircle/);
  assert.match(actionSource, /<svg aria-hidden="true" data-icon="whatsapp" viewBox="0 0 24 24" fill="currentColor">/);
  assert.match(actionSource, /<Phone aria-hidden="true" \/>/);
});

test('the contact dock is not rendered anywhere inside the owner ERP dashboard', () => {
  assert.match(actionSource, /const isErpDashboard = pathname\.startsWith\('\/erp'\)/);
  assert.match(actionSource, /if \(isErpDashboard\) return null/);
  assert.doesNotMatch(actionSource, /global-contact-actions--erp/);
});

test('the homepage duplicate is removed without affecting regular contact content', () => {
  assert.doesNotMatch(contactSource, /whatsapp-float|Floating WhatsApp Button|wa\.me/);
  assert.doesNotMatch(contactStyles, /\.whatsapp-float/);
  assert.match(contactSource, /contact-section/);
  assert.match(contactSource, /public-preview-link/);
});

test('the dock remains tappable, focus-visible, modal-safe, and clear of mobile navigation', () => {
  assert.match(actionStyles, /min-width:\s*48px/);
  assert.match(actionStyles, /min-height:\s*48px/);
  assert.match(actionStyles, /z-index:\s*90/);
  assert.match(actionStyles, /:focus-visible/);
  assert.match(actionStyles, /env\(safe-area-inset-bottom/);
  assert.match(actionStyles, /html\[dir="ltr"\] \.global-contact-actions\s*\{[\s\S]*?left:\s*auto;[\s\S]*?right:\s*max\(18px/);
  assert.match(actionStyles, /html\[dir="ltr"\] \.global-contact-actions__button::after/);
  assert.match(actionStyles, /\.global-contact-actions--client[\s\S]*?bottom:\s*calc\(88px/);
  assert.match(footerStyles, /html\[dir="rtl"\] \.app-container \.footer-section \.container\s*\{[\s\S]*?margin-left:\s*72px/);
  assert.match(footerStyles, /html\[lang="en"\]\[dir="ltr"\] \.app-container \.footer-section \.container\s*\{[\s\S]*?margin-right:\s*72px/);
});

test('client dashboard labels never cover working cards', () => {
  assert.match(actionStyles, /\.global-contact-actions--client \.global-contact-actions__button::after/);
  assert.doesNotMatch(actionStyles, /global-contact-actions--erp/);
  assert.match(actionStyles, /bottom:\s*max\(26px,\s*calc\(env\(safe-area-inset-bottom/);
});

test('the login dock alone rises above the login surface while staying below notification prompts', () => {
  const loginLayer = actionStyles.match(/body:has\(\.unified-login-container\) \.global-contact-actions\s*\{\s*z-index:\s*(\d+)/);
  assert.ok(loginLayer, 'expected a login-only contact layer rule');
  assert.equal(Number(loginLayer[1]), 1010);
  assert.ok(Number(loginLayer[1]) > 1000);
  assert.ok(Number(loginLayer[1]) < 1040);
  assert.match(actionStyles, /\.global-contact-actions\s*\{[\s\S]*?z-index:\s*90/);
});
