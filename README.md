# Football Coach

A Claude Code agent with NFL-coordinator-level football knowledge. It answers football questions, teaches the
game, and helps build an interactive play simulator.

```
../.claude/agents/football-coach.md   the agent definition (role, working modes, how it uses the library)
knowledge/                            the reference library the agent reads from. Start at knowledge/README.md
data/                                 machine-readable formations, plays and defensive calls for the simulator
tools/validate-data.mjs               checks the data for legal formations and consistent references
```

## Using the agent

From a Claude Code session opened in the `ai projects` folder:

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
node football-coach/tools/validate-data.mjs
```

The simulator app itself is not built yet.
