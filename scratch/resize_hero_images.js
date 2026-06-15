import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = 'e:/VScode/موقع الشركة/public';
const filesToResize = [
  'hero-service-1-small.webp',
  'hero-service-2-small.webp',
  'hero-service-3-small.webp',
  'hero-service-4-small.webp'
];

async function resizeImages() {
  for (const file of filesToResize) {
    const filePath = path.join(publicDir, file);
    const newName = file.replace('-small.webp', '-tiny.webp');
    const destPath = path.join(publicDir, newName);
    
    if (fs.existsSync(filePath)) {
      console.log(`Resizing ${file} to 500x500 at 75 quality...`);
      await sharp(filePath)
        .resize(500, 500, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 75 })
        .toFile(destPath);
        
      console.log(`Successfully created ${newName}`);
    } else {
      console.log(`File not found: ${file}`);
    }
  }
}

resizeImages().catch(console.error);
