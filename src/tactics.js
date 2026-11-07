export const OPPONENTS = {
  balanced: {
    name: 'All-rounder',
    description: 'Mixes length with attacking opportunities.',
    drop: 0.64,
    boast: 0.13,
    cross: 0.65,
    variation: 0.17,
    volley: 1,
  },
  patient: {
    name: 'Length specialist',
    description: 'Builds pressure with deep, patient returns.',
    drop: 0.2,
    boast: 0.04,
    cross: 0.35,
    variation: 0.08,
    volley: 0.55,
  },
  attacker: {
    name: 'Volley attacker',
    description: 'Takes the ball early and looks for short finishes.',
    drop: 0.85,
    boast: 0.24,
    cross: 0.78,
    variation: 0.3,
    volley: 1.65,
  },
};
export function chooseTacticalShot(
  style,
  me,
  other,
  ball,
  roll,
  difficulty = 'club',
  history = {},
) {
  const profile = OPPONENTS[style] || OPPONENTS.balanced;
  const stretched = Math.hypot(ball.x - me.x, ball.z - me.z) > 0.95;
  if (ball.z > 7.8 && (stretched || ball.y < 0.4) && roll < 0.88) return 'lob';
  if (ball.z < 4.8 && other.z > 6.3 && ball.y > 0.45 && roll < profile.drop)
    return 'drop';
  const variation = { rookie: 0.7, club: 1, pro: 1.3 }[difficulty] || 1;
  const weights = {
    drive: style === 'patient' ? 0.9 : 0.5,
    cross: (0.25 + profile.variation * 0.4) * variation,
    drop: 0.09 * (style === 'attacker' ? 1.8 : 0.8) * variation,
    lob: stretched ? 0.45 : 0.07,
    boast: profile.boast * variation,
  };
  if (Math.sign(other.x) === Math.sign(ball.x) && Math.abs(other.x) > 1.1)
    weights.cross *= 2;
  if (other.z > 6.5 && ball.z < 6) weights.drop *= 2;
  if (ball.z < 3) weights.boast *= 0.2;
  if (history.count >= 2 && history.shot in weights)
    weights[history.shot] *= 0.22;
  let pick =
    Math.max(0, Math.min(0.999999, roll)) *
    Object.values(weights).reduce((sum, value) => sum + value, 0);
  for (const [shot, weight] of Object.entries(weights)) {
    pick -= weight;
    if (pick < 0) return shot;
  }
  return 'cross';
}
