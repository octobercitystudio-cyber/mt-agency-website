import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = 'e:/VScode/موقع الشركة/public';
const filesToConvert = [
  'hero-service-1.png',
  'hero-service-2.png',
  'hero-service-3.png',
  'hero-service-4.png',
  'logo.png',
  'qpshoes_mockup.png'
];

async function convertImages() {
  for (const file of filesToConvert) {
    const inputPath = path.join(publicDir, file);
    if (!fs.existsSync(inputPath)) {
      console.log(`Skipping ${file}, not found.`);
      continue;
    }
    
    const baseName = path.parse(file).name;
    const outputPath = path.join(publicDir, `${baseName}.webp`);
    
    try {
      await sharp(inputPath)
        .webp({ quality: 80 })
        .toFile(outputPath);
      console.log(`Successfully converted ${file} to ${baseName}.webp`);
    } catch (error) {
      console.error(`Error converting ${file}:`, error);
    }
  }
}

convertImages();
