export function contactFeedback(event) {
  if (event.type === 'swing-feedback') {
    return {
      title:
        {
          queued: 'Swing queued',
          early: 'Too early',
          late: 'Too late',
          reach: 'Out of reach',
        }[event.reason] || 'Find your position',
      detail:
        {
          queued: 'Move beside the ball — your swing is ready.',
          early: 'Wait for the front-wall return.',
          late: 'Recover sooner for the next ball.',
          reach: 'Step closer before swinging.',
        }[event.reason] || '',
      tone: 'timing',
    };
  }
  if (event.type !== 'hit' || event.id !== 0) return null;
  if (event.serve)
    return {
      title: 'Serve away',
      detail: 'Recover towards the T.',
      tone: 'clean',
    };
  if (event.quality < 0.9)
    return {
      title: event.timing < 0.9 ? 'Late contact' : 'Stretched return',
      detail:
        event.timing < 0.9
          ? 'Release nearer contact for tighter placement.'
          : 'Recover early for a tighter shot.',
      tone: 'stretch',
    };
  return {
    title: event.volley ? 'Clean volley' : 'Clean contact',
    detail: 'Balanced strike · find the T.',
    tone: 'clean',
  };
}
