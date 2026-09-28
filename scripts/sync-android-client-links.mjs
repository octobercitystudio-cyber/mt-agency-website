import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// The / service-worker scope belongs to customers, /erp/ to staff. A catch-all
// Android intent filter lets Chrome choose the wrong notification delegate.
export const clientLinkPaths = ['/', '/login', '/register', '/reset-password'];
export function isolateCustomerAppLinks(xml) {
  let changed = 0;
  const output = xml.replace(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g, filter => {
    if (!filter.includes('android.intent.action.VIEW') || !filter.includes('android:scheme="https"')) return filter;
    changed++;
    const data = clientLinkPaths.map(path => `<data android:scheme="https" android:host="@string/hostName" android:path="${path}" />`);
    data.push('<data android:scheme="https" android:host="@string/hostName" android:pathPrefix="/dashboard" />');
    return filter.replace(/<data\b[^>]*\/>/g, '').replace('</intent-filter>', `${data.join('\n                ')}\n            </intent-filter>`);
  });
  if (changed !== 1) throw new Error('Expected one customer HTTPS intent filter. Inspect the Android manifest before building.');
  return output;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = new URL('../android-twa/app/src/main/AndroidManifest.xml', import.meta.url);
  await writeFile(manifest, isolateCustomerAppLinks(await readFile(manifest, 'utf8')));
  console.log('Customer deep links exclude staff routes.');
}
