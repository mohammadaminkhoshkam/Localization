// Renders docs/ris-localization-fa.html to PDF with headless Chromium.
// Usage: NODE_PATH=<dir with mathjax-full, playwright-core, vazirmatn> node docs/build-pdf.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

const modules = process.env.NODE_PATH.split(path.delimiter)[0];
const src = path.join(__dirname, 'ris-localization-fa.html');
const out = path.join(__dirname, 'ris-localization-fa.pdf');
const tmp = path.join(require('os').tmpdir(), 'ris-localization-fa.build.html');

const html = fs.readFileSync(src, 'utf8')
  .replace('{{MATHJAX}}', 'file://' + path.join(modules, 'mathjax-full/es5/tex-svg-full.js'))
  .replace(/\{\{FONTDIR\}\}/g, 'file://' + path.join(modules, 'vazirmatn/fonts/ttf'));
fs.writeFileSync(tmp, html);

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  // A4 width minus the 17mm side margins, in CSS px, so layout matches the printed column.
  const page = await browser.newPage({ viewport: { width: 665, height: 1000 } });
  await page.emulateMedia({ media: 'print' });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file://' + tmp, { waitUntil: 'load' });
  await page.waitForFunction(() => window.MathJax && MathJax.startup && MathJax.startup.promise);
  await page.evaluate(() => MathJax.startup.promise);
  await page.evaluate(() => document.fonts.ready);
  // Shrink any display equation that is still wider than its column.
  const scaled = await page.evaluate(() => {
    let n = 0;
    for (const c of document.querySelectorAll('mjx-container[display="true"]')) {
      const avail = c.parentElement.clientWidth;
      const svg = c.querySelector('svg');
      const need = Math.max(c.scrollWidth, c.offsetWidth, svg.getBoundingClientRect().width);
      if (need > avail) { c.style.zoom = (avail / need * 0.98).toFixed(3); n++; }
    }
    return { n, pageWidth: document.documentElement.scrollWidth };
  });
  console.log('scaled equations:', scaled);
  const texErrors =await page.$$eval('mjx-merror, [data-mjx-error]', els => els.map(e => e.getAttribute('data-mjx-error') || e.textContent));
  await page.pdf({
    path: out,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: '<div style="width:100%;font-size:8px;color:#5a6476;text-align:center;font-family:sans-serif"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margin: { top: '18mm', bottom: '18mm', left: '17mm', right: '17mm' },
  });
  await browser.close();
  console.log('pdf:', out);
  console.log('page errors:', errors.length ? errors : 'none');
  console.log('tex errors:', texErrors.length ? texErrors : 'none');
})();
