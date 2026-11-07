import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({
  args: [
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const report = [];
for (const [name, width, height] of [
  ['desktop', 1440, 900],
  ['portrait', 390, 844],
  ['landscape', 844, 390],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    isMobile: name !== 'desktop',
    hasTouch: name !== 'desktop',
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://127.0.0.1:8000');
  await page.locator('#start').waitFor();
  await page.screenshot({ path: `artifacts/${name}-menu.png` });
  await page.locator('#start').click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `artifacts/${name}-court.png` });
  if (name === 'desktop') await page.keyboard.press('Space');
  else await page.locator('#touch-hit').tap();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `artifacts/${name}-rally.png` });
  const frameTimes = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const samples = [];
        let previous;
        function sample(now) {
          if (previous !== undefined) samples.push(now - previous);
          previous = now;
          if (samples.length < 60) requestAnimationFrame(sample);
          else {
            samples.sort((a, b) => a - b);
            resolve({
              medianMs: samples[30],
              p95Ms: samples[57],
              renderer: 'headless SwiftShader',
            });
          }
        }
        requestAnimationFrame(sample);
      }),
  );
  report.push({
    name,
    errors,
    frameTimes,
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  });
  await page.close();
}
await browser.close();
await writeFile(
  'artifacts/visual-report.json',
  JSON.stringify(report, null, 2),
);
console.log(report);
