// Where every player is at time t. Pure functions, no React.
import type { Assignment, Defender, Formation, Play, Pt, Zone } from './types.ts';

const LINEMEN = ['LT', 'LG', 'C', 'RG', 'RT'];

// Quarterback drop depth in yards, from the data model's timing notes.
const DROP_UNDER_CENTER: Record<string, number> = { quick: 2, 'three-step': 3, 'five-step': 6, 'seven-step': 8 };
const DROP_SHOTGUN: Record<string, number> = { quick: 0, 'three-step': 1.5, 'five-step': 3, 'seven-step': 4.5 };

// shortcut: players with no path in the data get a short default step, add real paths to the data when blocking is simulated.
function defaultStep(id: string, a: Assignment, start: Pt, shotgun: boolean): Pt {
  if (a.action === 'qb') {
    const depth = (shotgun ? DROP_SHOTGUN : DROP_UNDER_CENTER)[a.drop ?? ''] ?? 0;
    return [0, -depth];
  }
  if (a.action !== 'block') return [0, 0];
  const dir = a.direction === 'left' ? -1 : a.direction === 'right' ? 1 : 0;
  if (!LINEMEN.includes(id) && Math.abs(start[0]) > 6) {
    // A receiver blocking downfield: stalk straight ahead, cutoff works toward the middle.
    return a.block === 'cutoff' ? [-Math.sign(start[0]) * 3, 4] : [0, 3];
  }
  switch (a.block) {
    case 'pass-set': return [0, -1.5];
    case 'hinge': return [0, -1];
    case 'reach': return [2 * dir, 1];
    case 'zone': return [dir, 1.5];
    case 'cutoff': return [1.5 * dir, 1.5];
    default: return [0, 1.5];
  }
}

/** Absolute waypoints for one offensive player, starting with where he lines up. */
export function pathFor(id: string, a: Assignment, start: Pt, shotgun: boolean): Pt[] {
  const offsets = a.path ?? [defaultStep(id, a, start, shotgun)];
  const points = offsets.map(([dx, dy]): Pt => [start[0] + dx, start[1] + dy]);
  return [start, ...points.filter(([x, y]) => x !== start[0] || y !== start[1])];
}

export function pathLength(path: Pt[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  return total;
}

/** Position after moving along the path for t seconds at a constant speed. Stops at the end. */
export function positionAt(path: Pt[], speed: number, t: number): Pt {
  let left = Math.max(0, t) * speed;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const seg = Math.hypot(bx - ax, by - ay);
    if (left <= seg) return seg === 0 ? [ax, ay] : [ax + ((bx - ax) * left) / seg, ay + ((by - ay) * left) / seg];
    left -= seg;
  }
  return path[path.length - 1];
}

function toward(from: Pt, to: Pt, distance: number): Pt {
  const gap = Math.hypot(to[0] - from[0], to[1] - from[1]);
  if (gap === 0 || distance <= 0) return from;
  const f = Math.min(distance, gap) / gap;
  return [from[0] + (to[0] - from[0]) * f, from[1] + (to[1] - from[1]) * f];
}

export interface PlayModel {
  paths: Record<string, Pt[]>;
  duration: number;
  /** Position of an offensive player, or undefined if he is not in the formation. */
  at(id: string, t: number): Pt | undefined;
  ball(t: number): Pt;
}

// Yards per second: receivers and backs at speed, everyone else working through contact.
const speedOf = (a: Assignment | undefined) => (a && ['route', 'carry', 'fake'].includes(a.action) ? 7 : 5);

const SNAP = 0.25; // seconds for the ball to reach the quarterback
const MESH = 0.7; // seconds until the handoff

export function buildPlay(formation: Formation, play?: Play): PlayModel {
  const shotgun = formation.qb !== 'under-center';
  const paths: Record<string, Pt[]> = {};
  const speeds: Record<string, number> = {};
  for (const p of formation.players) {
    const a = play?.assignments[p.id];
    paths[p.id] = a ? pathFor(p.id, a, [p.x, p.y], shotgun) : [[p.x, p.y]];
    speeds[p.id] = speedOf(a);
  }
  const at = (id: string, t: number) => (paths[id] ? positionAt(paths[id], speeds[id], t) : undefined);

  const mesh = play?.assignments.QB?.mesh;
  const carrier =
    play && (mesh === 'handoff' || mesh === 'read')
      ? Object.keys(play.assignments).find((id) => play.assignments[id].action === 'carry')
      : undefined;
  const ball = (t: number): Pt => {
    const qb = at('QB', t) ?? [0, 0];
    if (t <= 0) return [0, 0];
    if (t < SNAP) return toward([0, 0], qb, (Math.hypot(qb[0], qb[1]) * t) / SNAP);
    if (carrier && t >= MESH) return at(carrier, t)!;
    return qb;
  };

  const longest = Math.max(0, ...formation.players.map((p) => pathLength(paths[p.id]) / speeds[p.id]));
  return { paths, duration: play ? Math.max(2, longest) : 0, at, ball };
}

/** Where a zone defender is heading: the middle of the zone, but no more than 4 yards past its front edge. */
export function landmark(zone: Zone): Pt {
  return [(zone.x[0] + zone.x[1]) / 2, zone.y[0] + Math.min((zone.y[1] - zone.y[0]) / 2, 4)];
}

// Where the receivers sit in the 2x2 reference set that every call in the data is aligned to.
const BASE_X: Record<string, number> = { X: -18, H: -10, Y: 4.5, Z: 18 };

// shortcut: only corners and man defenders move; zone players, the front and personnel stay put. See ROADMAP.md.
/** Line a defensive call up against a formation: corners on the widest receiver, man defenders over their man. */
export function alignDefense(players: Defender[], formation: Formation): Defender[] {
  const xs = formation.players.map((p) => p.x);
  const covered = new Set(players.map((d) => d.assignment.target));
  // Eligibles nobody has in man, for a defender whose own man is not in this formation.
  const free = formation.players.filter((p) => !['QB', ...LINEMEN].includes(p.id) && !covered.has(p.id));
  return players.map((d) => {
    const a = d.assignment;
    if (a.type !== 'man') {
      if (d.id === 'C1') return { ...d, x: d.x + Math.min(...xs) + 18 };
      if (d.id === 'C2') return { ...d, x: d.x + Math.max(...xs) - 18 };
      return d;
    }
    const man = formation.players.find((p) => p.id === a.target) ?? free.shift();
    if (!man) return d;
    const next = { ...d, assignment: { ...a, target: man.id } };
    // A man in the backfield is covered from the box: a detached defender comes in to its edge.
    if (Math.abs(man.x) < 5 && man.y < -2) return { ...next, x: Math.max(-6, Math.min(6, d.x)) };
    // Keep the inside or outside shade the call gave him on his original man.
    const base = BASE_X[a.target ?? ''];
    const inside = base === undefined ? 0.5 : (base - d.x) * Math.sign(base);
    return { ...next, x: man.x - Math.sign(man.x) * inside };
  });
}

// shortcut: defenders follow their assignment only (no run fits, no reacting to routes), replace with the stage-2 matchup rules.
export function defenderAt(
  d: Defender,
  t: number,
  model: PlayModel,
  zones: Record<string, Zone>,
  dropping: boolean, // false on a run: coverage players hold their ground instead of dropping
): Pt {
  const start: Pt = [d.x, d.y];
  const a = d.assignment;
  if (t <= 0) return start;
  if (a.type === 'rush') {
    const ball = model.ball(t);
    const gap = Math.hypot(ball[0] - d.x, ball[1] - d.y);
    return toward(start, ball, Math.min(2.2 * t, gap - 1.2));
  }
  if (!dropping) return start;
  if (a.type === 'zone') {
    const zone = zones[a.zones?.[0] ?? ''];
    return zone ? toward(start, landmark(zone), 5 * t) : start;
  }
  // Man: mirror the receiver's movement a beat late.
  const from = model.at(a.target ?? '', 0);
  const now = model.at(a.target ?? '', t - 0.25);
  return from && now ? [d.x + now[0] - from[0], d.y + now[1] - from[1]] : start;
}
