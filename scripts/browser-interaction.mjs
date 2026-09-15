// CDP pointer actions must use settled viewport coordinates, not coordinates
// sampled before a scroll/layout update. This does not change application code.
export async function clickStableTarget(client, selector, { scroll = true } = {}) {
  const point = await client.evaluate(`(async () => {
    const selector = ${JSON.stringify(selector)};
    const element = document.querySelector(selector);
    if (!element) throw new Error('Pointer target not found: ' + selector);
    if (${scroll}) element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
    let previous = null, stableFrames = 0;
    for (let frame = 0; frame < 90; frame++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const rect = element.getBoundingClientRect();
      const point = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      const hit = document.elementFromPoint(point.x, point.y);
      const visible = element.isConnected && !element.disabled && rect.width > 0 && rect.height > 0
        && point.x >= 0 && point.x < innerWidth && point.y >= 0 && point.y < innerHeight
        && hit && element.contains(hit);
      const stable = previous && Math.abs(point.x - previous.x) < 0.25
        && Math.abs(point.y - previous.y) < 0.25;
      stableFrames = visible && stable ? stableFrames + 1 : 0;
      if (stableFrames >= 3) return point;
      previous = point;
    }
    throw new Error('Pointer target is not stable and hit-testable: ' + selector);
  })()`, true);
  await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
  await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', buttons: 1, clickCount: 1, ...point });
  await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', buttons: 0, clickCount: 1, ...point });
}
