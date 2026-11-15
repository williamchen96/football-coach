# Simulator data model

The files in `football-coach/data/` describe football in a form a program can draw and simulate. They share one coordinate system and one set of names. Run `node football-coach/tools/validate-data.mjs` after every change.

## Coordinate system

- Units are yards.
- **x** is the lateral distance from the ball. Negative is the offense's left, positive is the offense's right. The sidelines are at -26.67 and +26.67 when the ball is in the middle of the field.
- **y** is the distance from the line of scrimmage. Negative is the offensive backfield, positive is the defense's side.
- The offense faces +y. A viewer behind the quarterback sees +x to the right and +y going up the screen.
- The data assumes the ball is in the middle of the field. A simulator places the ball on a hash by shifting everything by the ball's x and clamping wide players to the sideline.
- Reference points: NFL hashes are at about x = ±3.1; the numbers are centered about x = ±13.7.

## Player ids

Offense: `QB`, `C`, `LG`, `RG`, `LT`, `RT`, and the eligibles `X`, `Z`, `Y`, `H`, `RB`, `FB`, `U`, as defined in `01-fundamentals.md`.

Defense: `E1` and `T1` are the end and tackle on the offense's right; `T2` and `E2` are the tackle and end on the offense's left. `M` and `W` are linebackers, `N` the nickel, `C1` the corner on the offense's left, `C2` the corner on the offense's right, `FS` and `SS` the safeties.

## formations.json

```json
{
  "id": "gun-doubles",
  "name": "Gun Doubles",
  "personnel": "11",
  "qb": "shotgun",
  "distribution": "2x2",
  "players": [{ "id": "X", "x": -18, "y": 0 }]
}
```

- Exactly 11 players. A player with `y` of 0 is on the line of scrimmage; exactly seven must be.
- The five linemen sit at x = -3, -1.5, 0, 1.5, 3. An attached tight end is at ±4.5.
- Receivers off the line are at y = -1. The quarterback is at y = -1 under center and y = -5 in shotgun.
- `qb` is `under-center`, `shotgun` or `pistol`.

## plays.json

```json
{
  "id": "smash",
  "name": "Smash",
  "type": "pass",
  "formation": "gun-doubles",
  "concept": "High-low on the cornerback",
  "assignments": {
    "X": { "action": "route", "route": "hitch", "path": [[0, 6], [0.5, 5]] }
  },
  "read": "...",
  "bestVs": ["cover-2"],
  "struggleVs": ["cover-4"],
  "coachingPoints": ["..."]
}
```

- `type` is `run`, `pass`, `play-action`, `rpo` or `screen`.
- `assignments` has one entry for every player in the formation.
- `path` is a list of waypoints, each an **offset from the player's starting position**, in the order he reaches them. For a receiver on the left, a positive x offset moves him toward the middle of the field.
- `action` values:

| Action | Used for | Other fields |
|---|---|---|
| `route` | A receiver's pass route | `route` (name from `04-pass-game.md`), `path` |
| `block` | Any block | `block` (see below), optional `target`, optional `path` for pullers |
| `carry` | The ball carrier's run | `path`, optional `aim` and `read` |
| `fake` | A back carrying out a run fake | `path` |
| `qb` | The quarterback | `drop`, `mesh`, optional `path`, optional `readKey` |

- `block` values: `zone`, `reach`, `base`, `down`, `double`, `cutoff`, `hinge`, `pull-kick`, `pull-wrap`, `kick-out`, `lead`, `stalk`, `pass-set`. Run blocks may carry `direction` (`left` or `right`).
- Quarterback `drop` values: `none`, `quick`, `three-step`, `five-step`, `seven-step`, `play-action`, `boot`. Counts are shotgun steps when the formation is shotgun.
- Quarterback `mesh` values: `none`, `handoff`, `fake`, `read`. A `read` mesh needs a `readKey` naming the defender.
- `bestVs` and `struggleVs` use coverage tags: `cover-0`, `cover-1`, `cover-2`, `tampa-2`, `2-man`, `cover-3`, `cover-4`, `cover-6`, `pressure`, `light-box`, `loaded-box`.

## defenses.json

```json
{
  "zones": { "flat-left": { "x": [-26.67, -13], "y": [0, 7] } },
  "defenses": [{
    "id": "nickel-cover-3-sky",
    "name": "Nickel Over, Cover 3 Sky",
    "personnel": "nickel",
    "front": "over",
    "coverage": "cover-3",
    "shell": "MOFC",
    "players": [
      { "id": "E1", "x": 5.3, "y": 1, "assignment": { "type": "rush", "gap": "contain-right" } },
      { "id": "FS", "x": 0, "y": 13, "assignment": { "type": "zone", "zones": ["deep-third-middle"] } },
      { "id": "C1", "x": -18, "y": 1, "assignment": { "type": "man", "target": "X" } }
    ]
  }]
}
```

- Exactly 11 players per call.
- `assignment.type` is `rush` (with a `gap`: `A-left`, `A-right`, `B-left`, `B-right`, `C-left`, `C-right`, `contain-left`, `contain-right`), `zone` (with one or more named `zones`; a defender with two works through the first to the second), or `man` (with an offensive `target` id).
- `shell` is what the offense sees before the snap, `MOFC` or `MOFO`. It can differ from the coverage when the call is disguised.
- Left and right are always the offense's left and right.
- The alignments are the call's default against a 2x2 set with the tight end on the offense's right. See the design notes for adjusting to other formations.

### Zones

Each zone is a rectangle with `x` and `y` ranges in the field coordinate system. Underneath zones are `flat`, `curl` and `hook` on each side plus `hole`. Deep zones are `deep-third-*`, `deep-half-*`, `deep-quarter-*` and `tampa-middle`. The rectangles are teaching approximations: real defenders play landmarks and match routes.

## Design notes for the simulator

These are open decisions for when the app is planned.

- **Alignment rules.** A defensive call should align to the offense. The simplest workable rule set: corners align on #1 to each side, the nickel on the slot (or the passing strength), linebackers shift half a gap toward the run strength, safeties set their width from the hash and the number of receivers. Mirror the call when the tight end is on the left.
- **Man assignments by count.** Storing targets as letters works for the starter set. Counting rules (`#1 left`, `#2 strong`) generalize better to any formation.
- **Timing.** Give routes a speed so a break arrives on a clock, and tie the quarterback's drop to it. Rough values: receivers 7 to 8 yards per second at full speed, a three-step drop about 1.5 seconds, five-step about 2.0 to 2.5, a four-man rush arriving in roughly 2.5 to 3.0.
- **Outcome model.** For teaching, the result of a play should follow from leverage: which defender is in conflict, whether the offense has numbers in the box, whether a zone has two receivers and one defender. A readable rule-based model teaches more than a physics model.
- **What to show the learner.** The pre-snap picture and a prompt to predict; the conflict defender highlighted during the play; afterwards, why the play worked or failed against that call.
- **Match rules and motion** are the next modeling steps after static zone and man.
