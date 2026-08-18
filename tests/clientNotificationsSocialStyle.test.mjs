import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readSource = path => readFile(new URL(path, import.meta.url), 'utf8');

test('the same circular notification trigger is used across every client page', async () => {
  const [dashboard, css] = await Promise.all([
    readSource('../src/pages/ClientDashboard.jsx'),
    readSource('../src/pages/ClientNotifications.css'),
  ]);

  assert.equal((dashboard.match(/<ClientNotifications/g) || []).length, 1);
  assert.match(dashboard, /client-app--calm-\$\{activeTab\}/);
  assert.match(css, /\.client-notifications__bell,\.client-app--calm \.client-notifications__bell\{[^}]*border-radius:50%/);
  assert.match(css, /\.client-notifications__bell\.has-unread::after\{/);
});

test('notification panel follows a familiar social feed hierarchy without changing its data contract', async () => {
  const [view, css] = await Promise.all([
    readSource('../src/pages/ClientNotifications.jsx'),
    readSource('../src/pages/ClientNotifications.css'),
  ]);

  assert.match(view, /useState\('all'\)/);
  assert.match(view, /إشعار جديد/);
  assert.match(view, /role="tab" aria-selected=\{filter === 'all'\}/);
  assert.match(view, /غير المقروء\{unreadCount > 0/);
  assert.match(view, /client-notification-item__icon/);
  assert.match(view, /client-notification-item__dot/);
  assert.match(view, /timeLabel\(item\.created_at\)/);
  assert.doesNotMatch(view, /Trash2/);
  assert.match(css, /\.client-notifications__panel,\.client-app--calm \.client-notifications__panel\{[^}]*width:min\(430px/);
  assert.match(css, /\.client-notifications__tabs button\{[^}]*border-radius:999px/);
  assert.match(css, /\.client-notification-item\.is-unread,\.client-app--calm \.client-notification-item\.is-unread\{[^}]*background:#f4eeff/);
  assert.match(css, /\.client-notification-item__icon\{[^}]*width:50px[^}]*border-radius:50%/);
  assert.match(css, /@media\(max-width:800px\)[\s\S]*max-height:min\(82dvh,760px\)/);
});
