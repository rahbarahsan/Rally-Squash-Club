import { test, expect } from '@playwright/test';
test('asset failure preserves a playable fallback', async ({ page }) => {
  await page.route('**/models/athlete.glb*', (route) => route.abort());
  await page.goto('/');
  await page.locator('#start').click();
  await expect(page.locator('#error')).toBeHidden();
  await page.evaluate(() => document.querySelector('#touch-hit').click());
  await expect(page.locator('#rally-count')).not.toHaveText('00');
});
test('joystick cancellation clears movement and ignores another pointer', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Desktop uses keyboard movement.');
  await page.goto('/');
  await page.locator('summary').first().click();
  await page.locator('#movement').selectOption('manual');
  await page.locator('#start').click();
  await page.evaluate(() => {
    const j = document.querySelector('#joystick');
    j.setPointerCapture = () => {};
    j.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        clientX: 100,
        clientY: 200,
      }),
    );
    j.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 2 }));
  });
  await expect(page.locator('#joystick-knob')).not.toHaveAttribute('style', '');
  await page.evaluate(() =>
    document
      .querySelector('#joystick')
      .dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 })),
  );
  await expect(page.locator('#joystick-knob')).toHaveAttribute('style', '');
});
test('start, select without serving, serve, pause and restart', async ({
  page,
  isMobile,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('#loading')).toHaveCount(0);
  await page.locator('#start').click();
  await page.locator('[data-shot="drop"]').click();
  await expect(page.locator('#status-title')).toHaveText('Your serve');
  await expect(page.locator('[data-shot="drop"]')).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  if (isMobile) await page.locator('#touch-hit').tap();
  else await page.keyboard.press('Space');
  await expect(page.locator('#rally-count')).not.toHaveText('00');
  await page.locator('#pause').click();
  await expect(page.locator('#pause-dialog')).toBeVisible();
  await page.locator('#restart').click();
  await expect(page.locator('#status-title')).toHaveText('Your serve');
  expect(errors).toEqual([]);
});
test('preferences persist and guide can be skipped', async ({ page }) => {
  await page.goto('/');
  await page.locator('summary').first().click();
  await page.locator('#left-handed').check();
  await page.locator('#movement').selectOption('manual');
  await page.reload();
  await expect(page.locator('#app')).toHaveClass(/left-handed/);
  await page.locator('summary').first().click();
  await page.locator('#tutorial').click();
  await expect(page.locator('#tutorial-card')).toBeVisible();
  await page.locator('#tutorial-skip').click();
  await expect(page.locator('#tutorial-card')).toBeHidden();
});
