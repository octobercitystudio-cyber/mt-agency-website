const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({
    defaultViewport: { width: 1440, height: 900 }
  });
  const page = await browser.newPage();
  
  // Navigate to the finance page. Make sure dev server is running, or build preview.
  // Wait, if it's protected, we might be redirected to login.
  // Let's set localStorage data to bypass auth.
  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle2' });
  
  await page.evaluate(() => {
    localStorage.setItem('isErpAuth', 'true');
    localStorage.setItem('isAdminAuth', 'true');
  });

  await page.goto('http://localhost:5173/erp/finance', { waitUntil: 'networkidle2' });
  
  // Wait for the main elements to render
  await page.waitForTimeout(2000);
  
  await page.screenshot({ path: 'C:\\Users\\octob\\.gemini\\antigravity\\brain\\aadeba23-0ad7-4bc7-bb5c-265a7b8a7737\\artifacts\\current_finance_view.png' });
  
  await browser.close();
  console.log('Screenshot saved to artifacts!');
})();
