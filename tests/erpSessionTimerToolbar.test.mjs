import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('ERP live session timer shares the top toolbar with owner notifications', async () => {
  const layout = await load('src/erp/ERPLayout.jsx');
  const toolbarStart = layout.indexOf('<header className="erp-global-toolbar"');
  const notifications = layout.indexOf('<OwnerNotifications', toolbarStart);
  const timer = layout.indexOf('<ERPSessionTimer role={role} />', toolbarStart);
  const toolbarEnd = layout.indexOf('</header>', toolbarStart);

  assert.ok(toolbarStart >= 0, 'the ERP top toolbar must exist');
  assert.ok(notifications > toolbarStart && notifications < toolbarEnd, 'owner notifications must be inside the top toolbar');
  assert.ok(timer > toolbarStart && timer < toolbarEnd, 'the session timer must be inside the top toolbar');
  assert.equal(layout.match(/<ERPSessionTimer role=\{role\} \/>/g)?.length, 1, 'the timer must have a single mount point');
  assert.ok(toolbarEnd < layout.indexOf('<Outlet key={demoDataVersion} />'), 'the toolbar must precede routed page content');
});

test('ERP live session timer participates in layout and cannot cover page content', async () => {
  const css = await load('src/erp/ERPLayout.css');
  const timerRule = css.match(/\.erp-live-session\{([^}]*)\}/)?.[1] || '';
  const mobileRule = css.match(/@media\(max-width:700px\)\{\.erp-live-session\{([^}]*)\}/)?.[1] || '';

  assert.match(css, /\.erp-global-toolbar\{[^}]*display:flex/);
  assert.match(css, /\.erp-global-toolbar:empty\{[^}]*display:none/);
  assert.match(css, /@media\(max-width:768px\)\{\.erp-global-toolbar\{[^}]*flex-wrap:wrap/);
  assert.match(css, /\.erp-global-toolbar>\.erp-live-session\{[^}]*flex:0 1 auto/);
  assert.doesNotMatch(timerRule, /position:fixed|(?:left|right|bottom):/);
  assert.doesNotMatch(mobileRule, /position:fixed|(?:left|right|bottom):/);
});

test('phone timer wins the enterprise typography cascade and preserves readable controls', async () => {
  const [timer, css, enterprise] = await Promise.all([
    load('src/erp/ERPSessionTimer.jsx'),
    load('src/erp/ERPLayout.css'),
    load('src/erp/ERPEnterpriseTheme.css'),
  ]);

  assert.match(enterprise, /\.erp-layout \.erp-main :where\([\s\S]*button[\s\S]*font-size: var\(--erp-font-size-control\) !important/);
  assert.match(timer, /aria-label="ترقية الباقة"/);
  assert.match(timer, /aria-label="إيقاف التصوير"/);
  assert.match(timer, /erp-live-session__action-label/);
  assert.match(css, /\.erp-layout \.erp-main \.erp-live-session>time\{[^}]*font-family:[^;}]*monospace!important;[^}]*font-size:1\.18rem!important;[^}]*font-weight:800!important;[^}]*font-variant-numeric:tabular-nums/);
  const phoneBreakpoint = css.indexOf('@media(max-width:700px)');
  const hiddenActionLabel = css.indexOf('.erp-live-session__action-label{display:none!important}', phoneBreakpoint);
  assert.ok(phoneBreakpoint >= 0 && hiddenActionLabel > phoneBreakpoint, 'phone action labels must be hidden after the phone breakpoint');
  assert.match(css, /\.erp-live-session__actions>\.erp-live-session__upgrade,[^{]+\{[^}]*width:44px;[^}]*height:44px;[^}]*min-width:44px!important/);
  assert.match(css, /@media\(max-width:480px\)\{\.erp-live-session\{[^}]*grid-template-columns:11px minmax\(0,1fr\) max-content auto;[^}]*grid-template-areas:"pulse identity clock count";[^}]*column-gap:8px/);
  assert.match(css, /\.erp-layout \.erp-main \.erp-live-session>time\{[^}]*width:8\.5ch;[^}]*white-space:nowrap/);
  assert.match(css, /\.erp-live-session__count\{[^}]*flex:0 0 26px;[^}]*min-width:26px/);
  assert.match(css, /\.erp-live-session--has-actions\{grid-template-areas:"pulse identity clock count" "actions actions actions actions"\}/);
});
