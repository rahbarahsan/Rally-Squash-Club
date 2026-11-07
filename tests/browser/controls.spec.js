import { test, expect } from '@playwright/test';

test('custom keys swap conflicts, persist, charge on hold and hit once on release', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#keyboard-settings summary').click();
  await page.locator('[data-bind-action="drive"]').click();
  await page.keyboard.press('a');
  await expect(page.locator('[data-bind-action="drive"]')).toHaveText('A');
  await expect(page.locator('[data-bind-action="left"]')).toHaveText('Z');
  await expect(page.locator('#binding-status')).toContainText(
    'Swapped with Move left',
  );
  await page.reload();
  await page.locator('#keyboard-settings summary').click();
  await expect(page.locator('[data-bind-action="drive"]')).toHaveText('A');
  // Leaving the editor mid-capture must not steal the first gameplay key.
  await page.locator('[data-bind-action="drive"]').click();
  await page.locator('#start').click();
  await page.keyboard.down('a');
  await page.waitForTimeout(450);
  await expect(page.locator('#power-meter')).not.toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  expect(
    Number(await page.locator('#power-meter').getAttribute('aria-valuenow')),
  ).toBeGreaterThan(50);
  await expect(page.locator('#rally-count')).toHaveText('00');
  await page.screenshot({
    path: `artifacts/controls-${test.info().project.name}.png`,
  });
  await page.keyboard.up('a');
  await expect(page.locator('#rally-count')).toHaveText('01');
});

test('pause and rotation cancel held power without firing a hidden shot', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#start').click();
  await page.keyboard.down('Space');
  await page.keyboard.press('p');
  await page.keyboard.up('Space');
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await expect(page.locator('#power-meter')).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await page.locator('#resume').click();
  await expect(page.locator('#rally-count')).toHaveText('00');
  await page.keyboard.down('Space');
  await page.setViewportSize({ width: 800, height: 500 });
  await expect(page.locator('#power-meter')).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await page.keyboard.up('Space');
  await expect(page.locator('#rally-count')).toHaveText('00');
});

test('arrows aim by default and can instead be used for movement', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#start').click();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('#shot-intent')).toContainText('Deep');
  await page.locator('#pause').click();
  await page.locator('#exit').click();
  await page.locator('#keyboard-settings summary').click();
  await page.locator('#arrow-mode').selectOption('move');
  await page.locator('#start').click();
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowUp');
  await expect(page.locator('#shot-intent')).toHaveText('Straight length');
});

test('4K layout exposes all shots and caps the canvas render size', async ({
  page,
  isMobile,
}) => {
  test.skip(isMobile, 'Desktop TV viewport');
  await page.setViewportSize({ width: 3840, height: 2160 });
  await page.goto('/');
  await page.locator('#start').click();
  await expect(page.locator('#advanced-shots')).toBeHidden();
  for (const shot of ['drive', 'cross', 'drop', 'lob', 'boast'])
    await expect(page.locator(`[data-shot="${shot}"]`)).toBeVisible();
  const size = await page.locator('#scene canvas').evaluate((canvas) => ({
    width: canvas.width,
    height: canvas.height,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(size.width * size.height).toBeLessThanOrEqual(3200000);
  expect(size.overflow).toBe(false);
  await page.locator('[data-shot="lob"]').click();
  await page.keyboard.press('Space');
  await expect(page.locator('#rally-count')).toHaveText('01');
});
