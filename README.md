# Football Coach

A Claude Code agent with NFL-coordinator-level football knowledge. It answers football questions, teaches the
game, and helps build an interactive play simulator.

```
.claude/agents/football-coach.md   the agent definition (role, working modes, how it uses the library)
knowledge/                         the reference library the agent reads from. Start at knowledge/README.md
data/                              machine-readable formations, plays and defensive calls for the simulator
tools/validate-data.mjs            checks the data for legal formations and consistent references
src/                               the simulator app (React, Vite, TypeScript)
```

## Running the simulator

Needs Node 24 or newer.

```bash
npm install
npm run dev        # open the URL it prints
npm test           # checks the movement logic against every play in data/
npm run build      # type-check and build to dist/
```

Pick a formation, a play and a defense, press Play, and tap any player to read his job. The link in the
address bar keeps the selection, so it can be shared.

With a play and a defense chosen, the Matchup panel says which side has the edge and why, the defender the
play puts in conflict is ringed in yellow, and "What stops this?" swaps in a defense that beats the play.

The edge is a rule of thumb from what each play is built to beat, not a simulated result: there is no throw
or tackle yet. Corners and man defenders line up on the formation; zone defenders and the front do not yet.
`ROADMAP.md` lists what is built and what is next.

## Using the agent

From a Claude Code session opened in this folder:

- Ask for it by name: "use the football-coach agent to explain Cover 3 match", or type `@football-coach`.
- Make it the whole session, which suits teaching: `claude --agent football-coach`.

Agent definitions are loaded when a session starts, so restart Claude Code after the file is first created or edited.

## The library

Thirteen topic files plus a glossary. They are plain Markdown and meant to be edited: add your own notes,
terminology from a team you follow, or plays you want to study. The agent treats these files as the project's
vocabulary, so a change here changes how it talks.

## The data

`data/formations.json`, `data/plays.json` and `data/defenses.json` are a starter set (6 formations, 12 plays,
6 defensive calls) that shares one coordinate system, described in `knowledge/12-simulator-data-model.md`.
Check them after any edit:

```bash
npm run validate
```
