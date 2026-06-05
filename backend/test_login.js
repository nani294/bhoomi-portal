const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({headless: true});
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    
    await page.goto('http://127.0.0.1:5000');
    
    // Output HTML to see what's loaded
    const content = await page.content();
    console.log('CONTENT START');
    console.log(content.substring(0, 1000));
    console.log('CONTENT END');
    
    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();