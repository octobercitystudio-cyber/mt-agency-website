import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/components/Header.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../src/components/Header.css', import.meta.url), 'utf8');

test('tablet header breakpoints overlap safely around fractional 768px viewports', () => {
  assert.match(styles, /@media \(max-width: 769px\)/);
  assert.match(styles, /@media\(max-width:769px\)/);
  assert.match(styles, /@media\(max-width:1180px\) and \(min-width:770px\)/);
  assert.doesNotMatch(styles, /@media\s*\(max-width:\s*768px\)/);
  assert.doesNotMatch(styles, /min-width:769px/);
});

test('closed mobile drawer is inert, hidden from accessibility and restores trigger focus', () => {
  assert.match(component, /const drawerClosed = isMobileHeader && !isMenuOpen/);
  assert.match(component, /id="public-mobile-navigation"[^>]*inert=\{drawerClosed\}[^>]*aria-hidden=\{drawerClosed\}/);
  assert.match(component, /const drawerTabIndex = drawerClosed \? -1 : undefined/);
  assert.match(component, /const servicesTabIndex = drawerClosed \|\| \(isMobileHeader && !servicesOpen\) \? -1 : undefined/);
  assert.match(component, /ref=\{closeMenuRef\} tabIndex=\{isMenuOpen \? 0 : -1\}/);
  assert.match(component, /if \(isMenuOpen\)[\s\S]*closeMenuRef\.current\?\.focus\(\)/);
  assert.match(component, /else if \(menuWasOpenRef\.current\)[\s\S]*menuTriggerRef\.current\?\.focus\(\)/);
  assert.match(component, /if \(event\.key === 'Escape'\)[\s\S]*setIsMenuOpen\(false\)/);
  assert.match(styles, /\.mobile-nav-wrapper \{[\s\S]*visibility: hidden;[\s\S]*pointer-events: none;/);
  assert.match(styles, /\.mobile-nav-wrapper\.open \{[\s\S]*visibility: visible;[\s\S]*pointer-events: auto;/);
});

test('critical mobile header and drawer targets have fractional-rendering headroom', () => {
  assert.match(styles, /\.lang-btn \{[^}]*min-height: 46px;/s);
  assert.match(styles, /\.mobile-menu-btn \{[^}]*width: 46px;[^}]*height: 46px;/s);
  assert.match(styles, /\.close-menu-btn \{[^}]*width: 48px;[^}]*height: 48px;/s);
  assert.match(styles, /@media\(max-width:769px\)[^\n]*\.nav-link,\.services-menu__trigger\{[^}]*min-height:48px/);
  assert.match(styles, /services-mega-menu__groups a\{min-height:46px/);
  assert.match(styles, /\.login-btn\{width:100%;min-height:48px/);
});
