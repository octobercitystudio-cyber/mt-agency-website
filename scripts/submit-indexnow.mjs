import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const key = '7c3a5a5521fc4c348a97dcbe4aa2d6f8';
const host = 'multitaskagency.com';
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sitemap = await fs.readFile(path.join(projectRoot, 'dist', 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]);

if (!urlList.length) throw new Error('The production sitemap has no URLs. Run npm run build first.');

const keyLocation = `https://${host}/${key}.txt`;
const keyResponse = await fetch(keyLocation, { redirect: 'follow' });
if (!keyResponse.ok || (await keyResponse.text()).trim() !== key) throw new Error(`IndexNow key is not live at ${keyLocation}. Deploy the build before submitting.`);

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation, urlList }),
});

if (!response.ok && response.status !== 202) throw new Error(`IndexNow rejected the submission with HTTP ${response.status}.`);
console.log(`IndexNow accepted ${urlList.length} canonical URLs with HTTP ${response.status}.`);

