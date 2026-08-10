import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const load = path => readFile(new URL(path, root), 'utf8');

test('website and ERP production data use Hostinger only', async () => {
  const [client, hostinger, packageJson, env, workflow] = await Promise.all([
    load('src/dataClient.js'),
    load('src/lib/hostingerClient.js'),
    load('package.json'),
    load('.env.example'),
    load('.github/workflows/deploy.yml'),
  ]);

  assert.match(client, /isDemoModeActive\(\) \? demoClient : hostingerClient/);
  assert.match(client, /dataProvider = 'hostinger'/);
  assert.match(hostinger, /VITE_API_URL \|\| '\/api'/);
  assert.doesNotMatch(client, /createClient|VITE_DATA_PROVIDER|VITE_SUPABASE/);
  assert.doesNotMatch(packageJson, /@supabase\//);
  assert.doesNotMatch(env, /VITE_DATA_PROVIDER|VITE_SUPABASE/);
  assert.doesNotMatch(workflow, /VITE_DATA_PROVIDER|VITE_SUPABASE/);

  await assert.rejects(access(new URL('src/supabaseClient.js', root)));
});
