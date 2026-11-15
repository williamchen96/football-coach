// Plain-language text for positions and assignments.
import type { Assignment, DefAssignment } from './types.ts';

export const POSITIONS: Record<string, string> = {
  QB: 'Quarterback',
  C: 'Center',
  LG: 'Left guard',
  RG: 'Right guard',
  LT: 'Left tackle',
  RT: 'Right tackle',
  X: 'Split end (wide receiver)',
  Z: 'Flanker (wide receiver)',
  Y: 'Tight end',
  H: 'Slot receiver',
  RB: 'Running back',
  FB: 'Fullback',
  U: 'Second tight end',
  E1: 'Defensive end',
  E2: 'Defensive end',
  T1: 'Defensive tackle',
  T2: 'Defensive tackle',
  M: 'Mike (middle) linebacker',
  W: 'Will (weak-side) linebacker',
  N: 'Nickel (slot cornerback)',
  C1: 'Cornerback',
  C2: 'Cornerback',
  FS: 'Free safety',
  SS: 'Strong safety',
};

/** "cover-2" -> "Cover 2" */
export const label = (s: string) =>
  s === 'rpo' ? 'RPO' : s.replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());

const BLOCKS: Record<string, string> = {
  zone: 'steps toward the play and blocks whoever shows up in his area',
  reach: 'works to get outside his defender and seal him inside',
  base: 'drives the man in front of him straight back',
  down: 'blocks the defender to his inside, away from the hole',
  double: 'teams up with the lineman next to him, then one of them climbs to a linebacker',
  cutoff: 'stops a back-side defender from chasing the play down',
  hinge: 'protects the gap the puller left, then turns back to wall off the back side',
  'pull-kick': 'leaves his spot, runs along the line and blocks the end defender outward',
  'pull-wrap': 'leaves his spot, runs along the line and turns up through the hole to a linebacker',
  'kick-out': 'blocks the end defender outward so the hole opens inside him',
  lead: 'leads the runner through the hole and blocks the first defender there',
  stalk: 'stays between his defensive back and the ball carrier',
  'pass-set': 'sets back and keeps the rushers off the quarterback',
};

const DROPS: Record<string, string> = {
  quick: 'The ball comes out almost at once.',
  'three-step': 'Takes a three-step drop and throws on rhythm.',
  'five-step': 'Takes a five-step drop to give deeper routes time.',
  'seven-step': 'Takes a seven-step drop for the deepest routes.',
  boot: 'Rolls out away from the run fake.',
};

export function describeOffense(a: Assignment, keyId?: string): string {
  switch (a.action) {
    case 'route':
      return `Runs a ${label(a.route ?? '').toLowerCase()} route.`;
    case 'block': {
      const where = a.direction ? ` to the ${a.direction}` : '';
      const who = a.target ? ` Target: the ${a.target}.` : '';
      return `${label(a.block ?? 'block')} block${where}: ${BLOCKS[a.block ?? ''] ?? 'blocks his man'}.${who}`;
    }
    case 'carry':
      return `Carries the ball.${a.aim ? ` Aiming point: ${a.aim.toLowerCase()}.` : ''}${a.read ? ` Read: ${a.read}.` : ''}`;
    case 'fake':
      return 'Carries out a run fake to pull the linebackers toward the line.';
    case 'qb': {
      const mesh =
        a.mesh === 'handoff' ? 'Hands the ball off.'
        : a.mesh === 'fake' ? 'Fakes the handoff.'
        : a.mesh === 'read' ? (keyId ? `Reads the ${POSITIONS[keyId].toLowerCase()} (${keyId.replace(/\d/, '')}, ringed in yellow)` : 'Reads a defender') + ' and decides after the snap what to do with the ball.'
        : '';
      return [mesh, DROPS[a.drop ?? '']].filter(Boolean).join(' ') || 'Takes the snap.';
    }
    default:
      return '';
  }
}

export function describeDefense(a: DefAssignment, targetOnField: boolean): string {
  if (a.type === 'rush') {
    const [gap, side] = (a.gap ?? '').split('-');
    return gap === 'contain'
      ? `Rushes off the ${side} edge and keeps the quarterback from escaping outside.`
      : `Rushes through the ${gap} gap on the ${side}.`;
  }
  if (a.type === 'zone') {
    const zones = (a.zones ?? []).map((z) => z.replace(/-/g, ' '));
    return zones.length > 1
      ? `Zone coverage: works through the ${zones[0]} to the ${zones[1]}.`
      : `Zone coverage: drops to the ${zones[0]} and plays any receiver who enters it.`;
  }
  const who = `${a.target} (${POSITIONS[a.target ?? ''] ?? 'receiver'})`;
  return targetOnField
    ? `Man coverage: follows ${who} wherever he goes.`
    : `Man coverage on ${who}, who is not in this formation. The defense would adjust.`;
}

const LOOKS: Record<string, string> = {
  'cover-0': 'man coverage on every receiver with no deep safety',
  'cover-1': 'man coverage with one deep safety',
  'cover-2': 'two deep safeties with the corners sitting in the flats',
  'tampa-2': 'the Mike running the deep middle between two deep safeties',
  '2-man': 'man coverage underneath two deep safeties',
  'cover-3': 'three deep defenders and four underneath',
  'cover-4': 'four deep defenders and three underneath',
  'cover-6': 'quarters to one side and Cover 2 to the other',
};

/** What a bestVs / struggleVs tag looks like on this call. */
export function describeLook(tag: string, m: { box: number; blockers: number; rushers: number }): string {
  if (tag === 'pressure') return `${m.rushers} rushers, so the ball has to come out fast`;
  if (tag.endsWith('-box')) return `${m.box} defenders in the box against ${m.blockers} blockers`;
  return LOOKS[tag] ?? '';
}
