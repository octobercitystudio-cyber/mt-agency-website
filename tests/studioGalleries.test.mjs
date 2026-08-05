import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  getStudioFallback,
  STUDIO_CATEGORIES,
  STUDIO_GALLERIES,
} from '../src/data/studioGalleries.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('studio categories keep their required order and gallery sizes', () => {
  assert.deepEqual(STUDIO_CATEGORIES.map(({ id }) => id), ['october', 'lebanon', 'newCairo']);
  assert.equal(STUDIO_GALLERIES.october.length, 6);
  assert.equal(STUDIO_GALLERIES.lebanon.length, 9);
  assert.equal(STUDIO_GALLERIES.newCairo.length, 8);
});

test('all default studio images are local, present, and valid JPEG files', async () => {
  for (const gallery of Object.values(STUDIO_GALLERIES)) {
    for (const image of gallery) {
      assert.match(image.url, /^\/studios\//);
      assert.ok(image.alt);
      assert.ok(image.altEn);

      const filePath = path.join(projectRoot, 'public', image.url.replace(/^\/+/, ''));
      await access(filePath);
      assert.ok((await stat(filePath)).size > 10_000);

      const signature = (await readFile(filePath)).subarray(0, 3);
      assert.deepEqual([...signature], [0xff, 0xd8, 0xff]);
    }
  }
});

test('fallbacks remain category-aware and preserve image order', () => {
  assert.equal(getStudioFallback('october', 0), STUDIO_GALLERIES.october[0].url);
  assert.equal(getStudioFallback('lebanon', 8), STUDIO_GALLERIES.lebanon[8].url);
  assert.equal(getStudioFallback('newCairo', 7), STUDIO_GALLERIES.newCairo[7].url);
  assert.equal(getStudioFallback('custom-studio', 0), '');
});
