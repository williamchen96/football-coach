// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { alignDefense, buildPlay, defenderAt, pathFor, positionAt } from './sim.ts';
import { matchup } from './matchup.ts';

const load = (name: string) => JSON.parse(readFileSync(new URL(`../data/${name}.json`, import.meta.url), 'utf8'));
const { formations } = load('formations');
const { plays } = load('plays');
const { defenses, zones } = load('defenses');

test('positionAt walks the path at constant speed and stops at the end', () => {
  const path: [number, number][] = [[0, 0], [0, 10], [10, 10]];
  assert.deepEqual(positionAt(path, 5, 0), [0, 0]);
  assert.deepEqual(positionAt(path, 5, 1), [0, 5]);
  assert.deepEqual(positionAt(path, 5, 3), [5, 10]);
  assert.deepEqual(positionAt(path, 5, 99), [10, 10]);
  assert.deepEqual(positionAt([[2, 3]], 5, 1), [2, 3]);
});

test('pathFor turns data offsets into field positions', () => {
  const hitch = { action: 'route', route: 'hitch', path: [[0, 6], [0.5, 5]] as [number, number][] };
  assert.deepEqual(pathFor('X', hitch, [-18, 0], true), [[-18, 0], [-18, 6], [-17.5, 5]]);
});

test('pathFor gives players without a path a sensible default', () => {
  assert.deepEqual(pathFor('LT', { action: 'block', block: 'pass-set' }, [-3, 0], true), [[-3, 0], [-3, -1.5]]);
  assert.deepEqual(pathFor('QB', { action: 'qb', drop: 'five-step' }, [0, -1], false), [[0, -1], [0, -7]]);
  assert.deepEqual(pathFor('QB', { action: 'qb', drop: 'none' }, [0, -5], true), [[0, -5]]);
});

test('every play in the data animates, against every defense', () => {
  for (const play of plays) {
    const formation = formations.find((f: { id: string }) => f.id === play.formation);
    const model = buildPlay(formation, play);
    assert.ok(model.duration >= 2 && model.duration < 6, `${play.id} duration ${model.duration}`);
    for (const t of [0, 0.5, model.duration]) {
      const spots = [
        model.ball(t),
        ...formation.players.map((p: { id: string }) => model.at(p.id, t)),
        ...defenses.flatMap((d: { players: never[] }) =>
          d.players.map((p) => defenderAt(p, t, model, zones, play.type !== 'run')),
        ),
      ];
      for (const [x, y] of spots) assert.ok(Number.isFinite(x) && Number.isFinite(y), `${play.id} at ${t}`);
    }
  }
});

test('on a handoff the ball ends up with the runner', () => {
  const play = plays.find((p: { id: string }) => p.id === 'power');
  const model = buildPlay(formations.find((f: { id: string }) => f.id === play.formation), play);
  assert.deepEqual(model.ball(0), [0, 0]);
  assert.deepEqual(model.ball(model.duration), model.at('RB', model.duration));
});

const formationOf = (id: string) => formations.find((f: { id: string }) => f.id === id);
const defenseOf = (id: string, formation: unknown) => {
  const d = defenses.find((x: { id: string }) => x.id === id);
  return { ...d, players: alignDefense(d.players, formation as never) };
};

test('alignDefense leaves every call alone against the 2x2 reference set', () => {
  for (const d of defenses) assert.deepEqual(alignDefense(d.players, formationOf('gun-doubles')), d.players);
});

test('alignDefense puts man defenders over their man, and gives a missing man a new one', () => {
  const spot = (formation: string, id: string) =>
    defenseOf('nickel-cover-1-rat', formationOf(formation)).players.find((p: { id: string }) => p.id === id);
  assert.equal(spot('gun-trey-right', 'N').x, 9.5); // follows the slot across the formation
  assert.equal(spot('gun-empty', 'W').x, -9.5); // walks out on the back
  assert.equal(spot('i-pro-right', 'N').assignment.target, 'FB'); // no slot, so he takes the fullback
  assert.equal(spot('i-pro-right', 'N').x, -6);
});

test('matchup reads the edge, the box and the conflict defender', () => {
  const play = (id: string) => plays.find((p: { id: string }) => p.id === id);
  const run = (playId: string, defenseId: string) => {
    const formation = formationOf(play(playId).formation);
    return matchup(play(playId), formation, defenseOf(defenseId, formation));
  };
  const smash = run('smash', 'nickel-tampa-2');
  assert.equal(smash.edge, 'offense');
  assert.equal(smash.conflict?.id, 'C1'); // the squat corner
  assert.equal(run('smash', 'nickel-quarters').edge, 'defense');
  assert.equal(run('rpo-glance', 'nickel-cover-1-rat').conflict, undefined); // no conflict defender in man
  const zone = run('inside-zone', 'nickel-cover-3-sky');
  assert.deepEqual([zone.box, zone.blockers, zone.edge], [7, 6, 'defense']);
  // "What stops this?" needs an answer for every play.
  for (const p of plays) assert.ok(defenses.some((d: { id: string }) => run(p.id, d.id).edge === 'defense'), p.id);
});
