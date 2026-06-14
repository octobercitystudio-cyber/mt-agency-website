import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = 'e:/VScode/موقع الشركة/public';
const filesToResize = [
  'hero-service-1.webp',
  'hero-service-2.webp',
  'hero-service-3.webp',
  'hero-service-4.webp'
];

async function resizeImages() {
  for (const file of filesToResize) {
    const filePath = path.join(publicDir, file);
    const newName = file.replace('.webp', '-small.webp');
    const destPath = path.join(publicDir, newName);
    
    if (fs.existsSync(filePath)) {
      console.log(`Resizing ${file} to ${newName}...`);
      await sharp(filePath)
        .resize(600, 600, {
          fit: 'cover',
          position: 'center'
        })
        .webp({ quality: 85 })
        .toFile(destPath);
        
      console.log(`Successfully created ${newName}`);
    } else {
      console.log(`File not found: ${file}`);
    }
  }
}

resizeImages().catch(console.error);
