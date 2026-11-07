import { test, expect } from '@playwright/test';
test('two thumbs can move and serve; rotation releases the joystick', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Touch input only');
  await page.goto('/');
  await page.locator('summary').first().click();
  await page.locator('#movement').selectOption('manual');
  await page.locator('#start').click();
  const joystick = await page.locator('#joystick').boundingBox(),
    hit = await page.locator('#touch-hit').boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const move = {
    id: 1,
    x: joystick.x + joystick.width * 0.7,
    y: joystick.y + joystick.height * 0.5,
  };
  const swing = {
    id: 2,
    x: hit.x + hit.width * 0.5,
    y: hit.y + hit.height * 0.5,
  };
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [move],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [move, swing],
  });
  await expect(page.locator('#power-meter')).not.toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  await expect(page.locator('#joystick-knob')).not.toHaveAttribute('style', '');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect(page.locator('#rally-count')).not.toHaveText('00');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [move],
  });
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.locator('#joystick-knob')).toHaveAttribute('style', '');
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await cdp.detach();
});
test('advanced shots stay visible inside the viewport', async ({ page }) => {
  await page.goto('/');
  await page.locator('#start').click();
  if (await page.locator('#advanced-shots').isVisible())
    await page.locator('#advanced-shots').click();
  for (const shot of ['drive', 'cross', 'drop', 'lob', 'boast']) {
    const b = await page.locator(`[data-shot="${shot}"]`).boundingBox();
    const v = page.viewportSize();
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(v.width);
    expect(b.y + b.height).toBeLessThanOrEqual(v.height);
    await page.locator(`[data-shot="${shot}"]`).click();
    await expect(page.locator('#status-title')).toHaveText('Your serve');
  }
});
test('tutorial advances on serving and aiming, and restart closes it', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await page.locator('summary').first().click();
  await page.locator('#tutorial').click();
  await expect(page.locator('#tutorial-text')).toContainText('Serve to start');
  if (isMobile) await page.locator('#touch-hit').tap();
  else await page.keyboard.press('Space');
  await expect(page.locator('#tutorial-text')).toContainText('landing spot');
  await page.locator('#scene canvas').click({
    position: {
      x: page.viewportSize().width * 0.5,
      y: page.viewportSize().height * 0.55,
    },
  });
  await expect(page.locator('#tutorial-text')).toContainText(
    'Select Crosscourt',
  );
  await page.locator('[data-shot="cross"]').click();
  await page.locator('#pause').click();
  await page.locator('#restart').click();
  await expect(page.locator('#tutorial-card')).toBeHidden();
});
