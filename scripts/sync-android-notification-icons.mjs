import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Jimp from 'jimp';

// Android notification icons use the logo's alpha mask, not launcher artwork.
const source = await Jimp.read(fileURLToPath(new URL('../public/app-icon-monochrome.png', import.meta.url)));
let transparent = 0, visible = 0;
source.scan(0, 0, source.bitmap.width, source.bitmap.height, function (_x, _y, index) {
  const alpha = this.bitmap.data[index + 3];
  if (!alpha) transparent++; else visible++;
  if (alpha && (this.bitmap.data[index] !== 255 || this.bitmap.data[index + 1] !== 255 || this.bitmap.data[index + 2] !== 255)) throw new Error('Notification artwork must be white on transparent pixels.');
});
if (!transparent || !visible) throw new Error('Notification artwork must have a visible logo and transparent background.');
for (const [density, size] of [['mdpi', 24], ['hdpi', 36], ['xhdpi', 48], ['xxhdpi', 72], ['xxxhdpi', 96]]) {
  const target = new URL(`../android-twa/app/src/main/res/drawable-${density}/ic_notification_icon.png`, import.meta.url);
  const png = await source.clone().resize(size, size, Jimp.RESIZE_BICUBIC).getBufferAsync(Jimp.MIME_PNG);
  // Do not churn unchanged generated resources.
  const previous = await readFile(target).catch(() => null);
  if (!previous?.equals(png)) await writeFile(target, png);
}
console.log('Android notification icons synchronized with the MTA logo (5 densities).');
