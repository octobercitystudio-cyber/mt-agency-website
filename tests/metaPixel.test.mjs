import test from 'node:test';
import assert from 'node:assert/strict';
import { createMetaPixelTracker, META_PIXEL_ID, META_PIXEL_SCRIPT } from '../src/lib/metaPixel.js';

test('pixel initializes once and records visits without strict-mode or login hydration duplicates', () => {
 const win = {}; const scripts = [];
 const doc = { querySelector: () => scripts[0], createElement: () => ({ dataset: {} }), head: { appendChild: el => scripts.push(el) } };
 const tracker = createMetaPixelTracker(win, doc);
 tracker.page('/login'); tracker.page('/login', 'client'); tracker.page('/login', 'client');
 tracker.page('/dashboard'); tracker.page('/dashboard', 'client'); tracker.page('/dashboard', 'client');
 assert.equal(scripts.length, 1); assert.equal(scripts[0].src, META_PIXEL_SCRIPT);
 assert.equal(win.fbq.disablePushState, true);
 assert.equal(win.fbq.queue.filter(x => x[0] === 'init' && x[1] === META_PIXEL_ID).length, 1);
 assert.equal(win.fbq.queue.filter(x => x[1] === 'PageView').length, 2);
 tracker.page('/ar/services/commercial-video-production/'); tracker.page('/dashboard', 'client');
 assert.equal(win.fbq.queue.filter(x => x[1] === 'PageView').length, 4);
});

test('staff, recovery, unknown and unauthenticated dashboard pages never initialize tracking', () => {
 const win = {}; const doc = { querySelector: () => null, createElement: () => { throw Error('must not load'); } };
 const tracker = createMetaPixelTracker(win, doc);
 for (const path of ['/p-e2f8474bcda6b5ea/login', '/erp', '/adminmt', '/reset-password', '/change-password', '/unknown', '/dashboard']) {
  tracker.page(path, 'owner'); tracker.download(path, 'owner');
 }
 assert.equal(win.fbq, undefined);
});

test('download clicks send only MTA platform metadata and register/public pages are included', () => {
 const win = {}; const doc = { querySelector: () => true };
 const tracker = createMetaPixelTracker(win, doc);
 tracker.page('/register'); tracker.download('/register'); tracker.page('/en/');
 assert.deepEqual(win.fbq.queue.find(x => x[1] === 'AndroidAppDownload'), ['trackCustom', 'AndroidAppDownload', { app_name: 'MTA', platform: 'Android' }]);
 assert.equal(win.fbq.queue.filter(x => x[1] === 'PageView').length, 2);
});
