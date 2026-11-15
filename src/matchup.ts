// Who has the edge when a play meets a defensive call, and why. Pure functions, no React.
import type { Defender, Defense, Formation, Play } from './types.ts';

export interface Matchup {
  edge: 'offense' | 'defense' | 'even';
  /** Tags this defense shows that the play is good against, and ones it struggles against. */
  good: string[];
  bad: string[];
  box: number;
  blockers: number;
  rushers: number;
  /** The zone defender the play is designed to put in conflict, if this call has one. */
  conflict?: Defender;
}

// shortcut: the edge comes from the play's bestVs / struggleVs tags, not from leverage on the field. See ROADMAP.md.
/** `defense.players` must already be aligned to the formation. */
export function matchup(play: Play, formation: Formation, defense: Defense): Matchup {
  const inBox = (x: number) => Math.abs(x) <= 7;
  const box = defense.players.filter((d) => inBox(d.x) && d.y <= 7.5).length;
  // The run blockers the defense counts before the snap: the line, attached tight ends and a fullback.
  const blockers = formation.players.filter((p) => (p.y === 0 && Math.abs(p.x) <= 5) || p.id === 'FB').length;
  const rushers = defense.players.filter((d) => d.assignment.type === 'rush').length;
  const tags = [
    defense.coverage,
    ...(defense.coverage === 'tampa-2' ? ['cover-2'] : []), // Tampa 2 is a Cover 2 variant
    box > blockers ? 'loaded-box' : 'light-box',
    ...(rushers >= 5 ? ['pressure'] : []),
  ];
  const good = play.bestVs.filter((t) => tags.includes(t));
  const bad = play.struggleVs.filter((t) => tags.includes(t));
  const zone = play.conflict?.find((z) => defense.players.some((d) => d.assignment.zones?.includes(z)));
  return {
    edge: good.length > bad.length ? 'offense' : bad.length > good.length ? 'defense' : 'even',
    good,
    bad,
    box,
    blockers,
    rushers,
    conflict: defense.players.find((d) => zone && d.assignment.zones?.includes(zone)),
  };
}
