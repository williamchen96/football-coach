// Checks football-coach/data for legal formations and consistent references.
// Usage: node football-coach/tools/validate-data.mjs
// The rules mirror football-coach/knowledge/12-simulator-data-model.md.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const load = (name) => JSON.parse(readFileSync(join(dataDir, name), 'utf8'));

const SIDELINE = 26.67;
const LINEMEN = ['LT', 'LG', 'C', 'RG', 'RT'];
const ELIGIBLES = ['X', 'Z', 'Y', 'H', 'RB', 'FB', 'U'];
const OFFENSE_IDS = ['QB', ...LINEMEN, ...ELIGIBLES];
const DEFENSE_IDS = ['E1', 'T1', 'T2', 'E2', 'M', 'W', 'N', 'C1', 'C2', 'FS', 'SS'];
const QB_SETS = ['under-center', 'shotgun', 'pistol'];
const PLAY_TYPES = ['run', 'pass', 'play-action', 'rpo', 'screen'];
const BLOCKS = [
  'zone', 'reach', 'base', 'down', 'double', 'cutoff', 'hinge',
  'pull-kick', 'pull-wrap', 'kick-out', 'lead', 'stalk', 'pass-set',
];
const DROPS = ['none', 'quick', 'three-step', 'five-step', 'seven-step', 'play-action', 'boot'];
const MESHES = ['none', 'handoff', 'fake', 'read'];
const TAGS = [
  'cover-0', 'cover-1', 'cover-2', 'tampa-2', '2-man', 'cover-3', 'cover-4', 'cover-6',
  'pressure', 'light-box', 'loaded-box',
];
const GAPS = [
  'A-left', 'A-right', 'B-left', 'B-right', 'C-left', 'C-right', 'contain-left', 'contain-right',
];
const SHELLS = ['MOFC', 'MOFO'];

const errors = [];
const fail = (where, message) => errors.push(`${where}: ${message}`);
const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);
const isPoint = (p) => Array.isArray(p) && p.length === 2 && p.every(isNumber);
const duplicates = (ids) => ids.filter((id, i) => ids.indexOf(id) !== i);

function checkUniqueIds(where, items) {
  for (const id of new Set(duplicates(items.map((item) => item.id)))) {
    fail(where, `duplicate id "${id}"`);
  }
}

function checkFormation(formation) {
  const where = `formation ${formation.id}`;
  const players = formation.players ?? [];
  if (!QB_SETS.includes(formation.qb)) fail(where, `qb must be one of ${QB_SETS.join(', ')}`);
  if (!/^\d\d$/.test(formation.personnel ?? '')) fail(where, 'personnel must be two digits, such as "11"');
  if (players.length !== 11) fail(where, `has ${players.length} players, needs 11`);
  checkUniqueIds(where, players);

  for (const player of players) {
    if (!OFFENSE_IDS.includes(player.id)) fail(where, `unknown player id "${player.id}"`);
    if (!isNumber(player.x) || !isNumber(player.y)) {
      fail(where, `${player.id} needs numeric x and y`);
      continue;
    }
    if (Math.abs(player.x) > SIDELINE) fail(where, `${player.id} is out of bounds at x=${player.x}`);
    if (player.y > 0) fail(where, `${player.id} is beyond the line of scrimmage at y=${player.y}`);
  }

  const ids = players.map((player) => player.id);
  for (const id of ['QB', ...LINEMEN]) {
    if (!ids.includes(id)) fail(where, `missing ${id}`);
  }
  const onLine = players.filter((player) => player.y === 0);
  if (onLine.length !== 7) {
    fail(where, `has ${onLine.length} players on the line (y = 0), needs exactly 7`);
  }
  for (const id of LINEMEN) {
    const lineman = players.find((player) => player.id === id);
    if (lineman && lineman.y !== 0) fail(where, `${id} must be on the line`);
  }

  // The personnel code must match who is on the field.
  if (/^\d\d$/.test(formation.personnel ?? '')) {
    const backs = ids.filter((id) => id === 'RB' || id === 'FB').length;
    const tightEnds = ids.filter((id) => id === 'Y' || id === 'U').length;
    const expected = `${backs}${tightEnds}`;
    if (formation.personnel !== expected) {
      fail(where, `personnel is "${formation.personnel}" but the players make "${expected}"`);
    }
  }
}

function checkPath(where, start, path) {
  if (!Array.isArray(path) || path.length === 0 || !path.every(isPoint)) {
    fail(where, 'path must be a non-empty list of [x, y] offsets');
    return;
  }
  for (const [dx, dy] of path) {
    const x = start.x + dx;
    const y = start.y + dy;
    if (Math.abs(x) > SIDELINE) fail(where, `path leaves the field at x=${x.toFixed(2)}`);
    if (y > 50 || y < -15) fail(where, `path reaches an unrealistic depth, y=${y.toFixed(2)}`);
  }
}

function checkAssignment(where, start, assignment, defenderIds) {
  switch (assignment.action) {
    case 'route':
      if (!ELIGIBLES.includes(start.id)) fail(where, 'only eligible receivers run routes');
      if (typeof assignment.route !== 'string') fail(where, 'route needs a route name');
      checkPath(where, start, assignment.path);
      break;
    case 'block':
      if (!BLOCKS.includes(assignment.block)) fail(where, `unknown block "${assignment.block}"`);
      if (assignment.direction && !['left', 'right'].includes(assignment.direction)) {
        fail(where, 'direction must be left or right');
      }
      if (assignment.path) checkPath(where, start, assignment.path);
      if (assignment.block?.startsWith('pull') && !assignment.path) fail(where, 'a puller needs a path');
      break;
    case 'carry':
    case 'fake':
      checkPath(where, start, assignment.path);
      break;
    case 'qb':
      if (start.id !== 'QB') fail(where, 'only the quarterback takes the qb action');
      if (!DROPS.includes(assignment.drop)) fail(where, `unknown drop "${assignment.drop}"`);
      if (!MESHES.includes(assignment.mesh)) fail(where, `unknown mesh "${assignment.mesh}"`);
      if (assignment.mesh === 'read' && !defenderIds.includes(assignment.readKey)) {
        fail(where, 'a read mesh needs a readKey naming a defender id');
      }
      if (assignment.path) checkPath(where, start, assignment.path);
      break;
    default:
      fail(where, `unknown action "${assignment.action}"`);
  }
}

function checkPlay(play, formationsById) {
  const where = `play ${play.id}`;
  if (!PLAY_TYPES.includes(play.type)) fail(where, `unknown type "${play.type}"`);
  const formation = formationsById.get(play.formation);
  if (!formation) {
    fail(where, `unknown formation "${play.formation}"`);
    return;
  }

  const assignments = play.assignments ?? {};
  for (const player of formation.players) {
    const assignment = assignments[player.id];
    if (!assignment) {
      fail(where, `no assignment for ${player.id}`);
      continue;
    }
    checkAssignment(`${where}, ${player.id}`, player, assignment, DEFENSE_IDS);
  }
  for (const id of Object.keys(assignments)) {
    if (!formation.players.some((player) => player.id === id)) {
      fail(where, `assignment for ${id}, who is not in ${formation.id}`);
    }
  }

  const actions = Object.values(assignments).map((assignment) => assignment.action);
  const carriers = actions.filter((action) => action === 'carry').length;
  const routes = actions.filter((action) => action === 'route').length;
  const mesh = assignments.QB?.mesh;
  if (play.type === 'run' && carriers !== 1) fail(where, 'a run needs exactly one ball carrier');
  if (play.type === 'run' && routes > 0) fail(where, 'a run has no routes; use type rpo');
  if (play.type === 'pass' && (carriers > 0 || routes === 0)) fail(where, 'a pass needs routes and no carrier');
  if (play.type === 'play-action' && mesh !== 'fake') fail(where, 'play-action needs a fake mesh');
  if (play.type === 'rpo' && (carriers !== 1 || routes === 0 || mesh !== 'read')) {
    fail(where, 'an rpo needs a carrier, at least one route, and a read mesh');
  }
  if (carriers === 1 && !['handoff', 'read'].includes(mesh)) fail(where, 'a carry needs a handoff or read mesh');

  for (const field of ['bestVs', 'struggleVs']) {
    for (const tag of play[field] ?? []) {
      if (!TAGS.includes(tag)) fail(where, `unknown ${field} tag "${tag}"`);
    }
  }
  for (const field of ['name', 'concept', 'read']) {
    if (typeof play[field] !== 'string' || play[field].length === 0) fail(where, `missing ${field}`);
  }
}

function checkZones(zones) {
  for (const [name, zone] of Object.entries(zones)) {
    for (const axis of ['x', 'y']) {
      if (!isPoint(zone[axis]) || zone[axis][0] >= zone[axis][1]) {
        fail(`zone ${name}`, `${axis} must be [min, max] with min below max`);
      }
    }
  }
}

function checkDefense(defense, zones) {
  const where = `defense ${defense.id}`;
  const players = defense.players ?? [];
  if (!SHELLS.includes(defense.shell)) fail(where, `shell must be one of ${SHELLS.join(', ')}`);
  if (!TAGS.includes(defense.coverage)) fail(where, `unknown coverage "${defense.coverage}"`);
  if (players.length !== 11) fail(where, `has ${players.length} players, needs 11`);
  checkUniqueIds(where, players);

  const manTargets = [];
  let rushers = 0;
  for (const player of players) {
    const who = `${where}, ${player.id}`;
    if (!DEFENSE_IDS.includes(player.id)) fail(where, `unknown player id "${player.id}"`);
    if (!isNumber(player.x) || !isNumber(player.y)) {
      fail(who, 'needs numeric x and y');
    } else {
      if (Math.abs(player.x) > SIDELINE) fail(who, `out of bounds at x=${player.x}`);
      if (player.y <= 0) fail(who, `offside at y=${player.y}`);
    }

    const assignment = player.assignment ?? {};
    if (assignment.type === 'rush') {
      rushers += 1;
      if (!GAPS.includes(assignment.gap)) fail(who, `unknown gap "${assignment.gap}"`);
    } else if (assignment.type === 'zone') {
      if (!Array.isArray(assignment.zones) || assignment.zones.length === 0) fail(who, 'zone needs a zones list');
      for (const zone of assignment.zones ?? []) {
        if (!(zone in zones)) fail(who, `unknown zone "${zone}"`);
      }
    } else if (assignment.type === 'man') {
      if (!ELIGIBLES.includes(assignment.target)) fail(who, `man target "${assignment.target}" is not an eligible`);
      manTargets.push(assignment.target);
    } else {
      fail(who, `unknown assignment type "${assignment.type}"`);
    }
  }

  if (rushers < 3) fail(where, `only ${rushers} rushers`);
  for (const target of new Set(duplicates(manTargets))) {
    fail(where, `two defenders are in man on ${target}`);
  }
  const rushGaps = players
    .filter((player) => player.assignment?.type === 'rush')
    .map((player) => player.assignment.gap);
  for (const gap of new Set(duplicates(rushGaps))) fail(where, `two rushers share ${gap}`);
}

const { formations } = load('formations.json');
const { plays } = load('plays.json');
const { zones, defenses } = load('defenses.json');

checkUniqueIds('formations.json', formations);
checkUniqueIds('plays.json', plays);
checkUniqueIds('defenses.json', defenses);

const formationsById = new Map(formations.map((formation) => [formation.id, formation]));
formations.forEach(checkFormation);
plays.forEach((play) => checkPlay(play, formationsById));
checkZones(zones);
defenses.forEach((defense) => checkDefense(defense, zones));

if (errors.length > 0) {
  console.error(`${errors.length} problem(s) found:\n`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`OK: ${formations.length} formations, ${plays.length} plays, ${defenses.length} defenses.`);
