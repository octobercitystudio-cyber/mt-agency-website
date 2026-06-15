import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

async function runTest() {
  console.log('Starting preview server...');
  const server = spawn('npm', ['run', 'preview'], {
    cwd: 'e:/VScode/موقع الشركة',
    shell: true,
  });

  // Wait 3 seconds for server to start
  await new Promise(resolve => setTimeout(resolve, 3000));

  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('PAGE ERROR:', msg.text());
    }
  });
  
  page.on('pageerror', err => {
    console.log('PAGE UNHANDLED EXCEPTION:', err.message);
  });

  try {
    console.log('Navigating to http://localhost:4173 ...');
    await page.goto('http://localhost:4173', { waitUntil: 'networkidle0' });
    
    // Check if ErrorBoundary is visible
    const content = await page.content();
    if (content.includes('حدث خطأ مؤقت')) {
      console.log('ERROR BOUNDARY TRIGGERED!');
    } else if (content.includes('MT Agency')) {
      console.log('SITE LOADED SUCCESSFULLY!');
    } else {
      console.log('UNKNOWN STATE (WHITE SCREEN?)');
    }
  } catch (err) {
    console.log('NAVIGATION ERROR:', err);
  }

  await browser.close();
  server.kill();
}

runTest().catch(console.error);
