import puppeteer from 'puppeteer-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function testResponsiveIframe() {
  console.log('Testing Twitter Card iframe dimensions (480x270)...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-webgl',
      '--window-size=480,270'
    ]
  });

  const page = await browser.newPage();
  // Exact 16:9 Twitter mobile/timeline player card iframe size
  await page.setViewport({ width: 480, height: 270, deviceScaleFactor: 1 });

  await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 2000));

  // Toggle UI visible so we inspect all menu items
  await page.keyboard.press('KeyH');
  await new Promise(r => setTimeout(r, 1000));

  const outPath = 'C:\\Users\\manic\\.gemini\\antigravity-cli\\brain\\cd088307-b86b-47b2-b13e-7bfdadedfa43\\twitter_iframe_480x270.jpg';
  await page.screenshot({ path: outPath, type: 'jpeg', quality: 90 });
  console.log('Saved 480x270 screenshot to:', outPath);

  await browser.close();
}

testResponsiveIframe().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
