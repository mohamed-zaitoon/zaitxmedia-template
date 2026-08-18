const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_PAGEERROR:', error.message));

  await page.goto('http://localhost:3002');
  await page.waitForTimeout(5000);
  
  await browser.close();
})();
