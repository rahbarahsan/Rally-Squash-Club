import { test, expect } from '@playwright/test';

test('unsupported orientation lock explains rotation and leaves the game playable', async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = async () => {
      throw new Error('Not supported');
    };
    Object.defineProperty(screen.orientation, 'lock', {
      value: async () => {
        throw new Error('Not supported');
      },
    });
  });
  await page.goto('/');
  await page.locator('#landscape').click();
  await expect(page.locator('#toast')).toContainText(
    'Turn your phone sideways',
  );
  await expect(page.locator('#landscape')).toBeEnabled();
  await expect(page.locator('#landscape')).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await page.locator('#start').click();
  await expect(page.locator('#status-title')).toHaveText('Your serve');
});

test('practice focus, recovery control and opponent selection remain separate', async ({
  page,
  isMobile,
}) => {
  await page.goto('/');
  await page.locator('#opponent').selectOption('attacker');
  await expect(page.locator('#opponent-note')).toContainText(
    'Takes the ball early',
  );
  await page.locator('[data-mode="practice"]').click();
  await expect(page.locator('#opponent')).toBeHidden();
  await page.locator('#practice-focus').selectOption('recovery');
  await page.locator('#start').click();
  await expect(page.locator('#practice-count')).toHaveText('0 / 5');
  if (isMobile) {
    await expect(page.locator('#touch-recover')).toBeVisible();
    await page.locator('#touch-hit').tap();
    await page.locator('#touch-recover').tap();
  } else await page.keyboard.press('Space');
  await page.locator('#pause').click();
  await page.locator('#exit').click();
  await page.locator('[data-mode="match"]').click();
  await page.locator('#start').click();
  await expect(page.locator('#practice-progress')).toBeHidden();
  await expect(page.locator('#touch-recover')).toBeHidden();
});

test('landscape header, shot controls and serve card leave the central court clear', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Phone layout check');
  await page.setViewportSize({ width: 667, height: 375 });
  await page.goto('/');
  await page.locator('#start').click();
  const boxes = await page.evaluate(() => {
    const rect = (id) => {
      const r = document.querySelector(id).getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        height: r.height,
      };
    };
    return {
      hud: rect('#hud'),
      header: rect('.header-actions'),
      status: rect('#status'),
      canvas: document.elementFromPoint(innerWidth * 0.5, innerHeight * 0.58)
        ?.tagName,
    };
  });
  expect(boxes.hud.right).toBeLessThanOrEqual(boxes.header.left);
  expect(boxes.status.height).toBeLessThan(80);
  expect(boxes.status.top).toBeGreaterThan(boxes.hud.bottom);
  expect(boxes.canvas).toBe('CANVAS');
  if (await page.locator('#advanced-shots').isVisible())
    await page.locator('#advanced-shots').click();
  for (const shot of ['drive', 'cross', 'drop', 'lob', 'boast']) {
    const box = await page.locator(`[data-shot="${shot}"]`).boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(667);
    await page.locator(`[data-shot="${shot}"]`).tap();
  }
  await page.locator('#touch-hit').tap();
  await expect(page.locator('#contact-title')).toHaveText('Serve away');
});
