// Fullscreen/orientation are optional browser capabilities, always user-initiated.
export function createDisplay({
  element,
  document,
  screen,
  onMessage,
  onChange,
}) {
  let locked = false;
  let pending = false;
  function sync() {
    onChange({ fullscreen: !!document.fullscreenElement, locked, pending });
  }
  function release() {
    if (locked) {
      try {
        screen.orientation?.unlock();
      } catch {
        /* A browser may revoke the lock first. */
      }
    }
    locked = false;
    sync();
  }
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) release();
    else sync();
  });
  async function landscape() {
    if (pending) return;
    if (locked) {
      release();
      onMessage('Screen rotation unlocked');
      return;
    }
    pending = true;
    sync();
    try {
      if (!document.fullscreenElement && element.requestFullscreen) {
        try {
          await element.requestFullscreen();
        } catch {
          /* Rotation can still be available in installed apps. */
        }
      }
      if (typeof screen.orientation?.lock !== 'function')
        throw new Error('Unavailable');
      await screen.orientation.lock('landscape');
      locked = true;
      onMessage('Landscape view · tap Landscape again to unlock');
    } catch {
      onMessage(
        'Turn your phone sideways for a wider court. If it stays upright, turn off your phone’s rotation lock.',
      );
    } finally {
      pending = false;
      sync();
    }
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) {
        release();
        await document.exitFullscreen();
      } else if (element.requestFullscreen) await element.requestFullscreen();
      else onMessage('Use your browser’s fullscreen option');
    } catch {
      onMessage('Fullscreen isn’t available in this view');
    }
    sync();
  }
  sync();
  return { landscape, fullscreen, release };
}
