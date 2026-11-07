const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function contactPower(power, ball) {
  // Modest carry from the incoming ball; charged control remains dominant.
  return clamp(
    power + Math.min(1, Math.hypot(ball.vx, ball.vy, ball.vz) / 24) * 0.1,
    0.35,
    1,
  );
}
export function poweredTarget(target, shot, power, timing = 1) {
  const strength = clamp(Number.isFinite(power) ? power : 0.6, 0.35, 1);
  const depthScale = ['drop', 'boast'].includes(shot) ? 2.5 : 4;
  return {
    x: clamp(target.x * (0.9 + 0.1 * timing), -2.95, 2.95),
    z: clamp(
      target.z + (strength - 0.6) * depthScale - (1 - timing) * 0.9,
      0.9,
      8.9,
    ),
  };
}
