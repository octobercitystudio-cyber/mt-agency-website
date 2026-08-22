import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createReadRequestScheduler } from '../src/lib/readRequestScheduler.js';

const load = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('dashboard read scheduler limits simultaneous Hostinger database requests', async () => {
  const scheduler = createReadRequestScheduler({ maxConcurrent: 3, retries: 0 });
  let active = 0;
  let maximum = 0;
  const requests = Array.from({ length: 11 }, (_, index) => scheduler.run(async () => {
    active += 1;
    maximum = Math.max(maximum, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active -= 1;
    return index;
  }));

  assert.deepEqual(await Promise.all(requests), Array.from({ length: 11 }, (_, index) => index));
  assert.equal(maximum, 3);
});

test('dashboard read scheduler retries one transient failure but not validation failures', async () => {
  const scheduler = createReadRequestScheduler({ maxConcurrent: 2, retries: 1, wait: async () => {} });
  let transientAttempts = 0;
  const recovered = await scheduler.run(async () => {
    transientAttempts += 1;
    if (transientAttempts === 1) throw Object.assign(new Error('temporary'), { status: 500 });
    return 'ok';
  });
  assert.equal(recovered, 'ok');
  assert.equal(transientAttempts, 2);

  let validationAttempts = 0;
  await assert.rejects(scheduler.run(async () => {
    validationAttempts += 1;
    throw Object.assign(new Error('invalid'), { status: 422 });
  }));
  assert.equal(validationAttempts, 1);
});

test('Hostinger client retries safe reads only and exposes the server request reference', async () => {
  const originalFetch = globalThis.fetch;
  const originalDocument = globalThis.document;
  globalThis.document = { cookie: '' };
  let getAttempts = 0;
  let postAttempts = 0;
  globalThis.fetch = async (_url, options = {}) => {
    const method = String(options.method || 'GET').toUpperCase();
    if (method === 'GET') {
      getAttempts += 1;
      if (getAttempts === 1) return {
        ok: false,
        status: 500,
        headers: { get: name => name === 'X-Request-Id' ? 'read-ref-1' : '' },
        json: async () => ({ data: null, error: { code: 'server_error', message: 'temporary', request_id: 'read-ref-1' } }),
      };
      return { ok: true, status: 200, headers: { get: () => '' }, json: async () => ({ data: { ready: true }, error: null }) };
    }
    postAttempts += 1;
    return {
      ok: false,
      status: 500,
      headers: { get: () => 'write-ref-1' },
      json: async () => ({ data: null, error: { code: 'server_error', message: 'failed', request_id: 'write-ref-1' } }),
    };
  };

  try {
    const moduleUrl = new URL('../src/lib/hostingerClient.js', import.meta.url);
    moduleUrl.searchParams.set('resilience', String(Date.now()));
    const { hostingerClient } = await import(moduleUrl.href);
    const read = await hostingerClient.request('/dashboard/kpis', { method: 'GET' });
    assert.deepEqual(read.data, { ready: true });
    assert.equal(read.error, null);
    assert.equal(getAttempts, 2);

    const write = await hostingerClient.request('/finance/manual', { method: 'POST', body: '{}' });
    assert.equal(write.data, null);
    assert.equal(write.error.requestId, 'write-ref-1');
    assert.match(write.error.message, /رقم المتابعة: write-ref-1/);
    assert.equal(postAttempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.document = originalDocument;
  }
});

test('successful client refresh clears a stale banner and API failures carry a safe reference', async () => {
  const [dashboard, api] = await Promise.all([
    load('src/pages/ClientDashboard.jsx'),
    load('api/index.php'),
  ]);
  assert.match(dashboard, /const fetchClientData[\s\S]*?setLoadError\(''\);[\s\S]*?if \(isLocalPreview\)/);
  assert.match(dashboard, /setProjects\(projectsResult\.data\?\.projects \|\| \[\]\);\s*setLoadError\(''\);/);
  assert.match(api, /X-Request-Id/);
  assert.match(api, /\['request_id' => \$requestId\]/);
});
