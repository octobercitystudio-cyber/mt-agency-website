import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  isRetryableDashboardError,
  requestDashboardModule,
} from '../src/lib/dashboardLoad.js';

test('dashboard module retries one transient initial failure and returns the recovered data', async () => {
  let calls = 0;
  const result = await requestDashboardModule(async () => {
    calls += 1;
    return calls === 1
      ? { data: null, error: { status: 503, code: 'server_unavailable' } }
      : { data: { active_packages: { count: 4 } }, error: null };
  }, { wait: async () => {} });
  assert.equal(calls, 2);
  assert.equal(result.data.active_packages.count, 4);
});

test('dashboard KPI request retries a partial first response without retrying permanent errors', async () => {
  let partialCalls = 0;
  const recovered = await requestDashboardModule(async () => {
    partialCalls += 1;
    return partialCalls === 1
      ? { data: { partial_errors: ['receivables'] }, error: null }
      : { data: { partial_errors: [], receivables: { amount: '120.00' } }, error: null };
  }, {
    wait: async () => {},
    shouldRetryResult: (result) => Boolean(result?.error || result?.data?.partial_errors?.length),
  });
  assert.equal(partialCalls, 2);
  assert.equal(recovered.data.receivables.amount, '120.00');

  let forbiddenCalls = 0;
  await requestDashboardModule(async () => {
    forbiddenCalls += 1;
    return { data: null, error: { status: 403, code: 'forbidden' } };
  }, { wait: async () => {} });
  assert.equal(forbiddenCalls, 1);
  assert.equal(isRetryableDashboardError({ status: 500 }), true);
  assert.equal(isRetryableDashboardError({ status: 404 }), false);
});

test('private application waits for both data and authenticated session before mounting dashboard requests', async () => {
  const [context, dashboard] = await Promise.all([
    readFile(new URL('../src/store/DataContext.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../src/erp/ERPDashboard.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(context, /\(!isDataLoaded \|\| !isAuthReady\) && !isPublicSurface\(\)/);
  assert.match(dashboard, /if \(!isAuthReady \|\| !currentUser\?\.role\) return/);
  assert.match(dashboard, /loadSequence !== loadSequenceRef\.current/);
  assert.match(dashboard, /requestDashboardModule\([\s\S]*?partial_errors/);
});
