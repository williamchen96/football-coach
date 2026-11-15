# Roadmap

The simulator is built around one always-visible field, shipped in three stages.

## Features

| Feature | What it does | Status |
|---|---|---|
| **The field** | Top-down field with labelled players, drawn routes and blocks, and play / pause / scrub / speed controls | Built (stage 1) |
| **Playbook** | Pick a formation, play and defense, filtered by run / pass / play action / RPO | Built (stage 1) |
| **Player focus** | Tap any player to read their job in a sentence | Built (stage 1) |
| **Layers** | Toggle routes, blocking, zones, man and rush lines, and labels | Built (stage 1) |
| **Shareable link** | The address bar keeps the selection | Built (stage 1) |
| **Matchup** | Run a play against a defense, see the defender in conflict ringed, then read which side has the edge and why | Built (stage 2), as a rule of thumb |
| **"What stops this?"** | One click swaps in a defense that beats the play and replays. Click again for the next one | Built (stage 2) |
| **Defensive alignment** | Corners and man defenders line up on the formation; a man defender whose receiver is absent takes the uncovered eligible | Built (stage 2), man coverage only |
| **Lessons** | Short guided scenes on the field, ordered by the curriculum | Stage 3, not built |
| **Predict mode** | See the pre-snap look and answer "run or pass?", "one-high or two-high?", "where does the ball go?" | Stage 3, not built |
| **Glossary** | Tap any jargon term for a definition, and search the full list | Stage 3, not built |

## Also planned, not built

- A Fan / Coach detail switch: plain language for fans, with gap letters, technique numbers and full read progressions for coaches.
- Three tabs: Learn, Playbook and Simulator.
- Progress saved in the browser, with no accounts.

## Needed next, found while building stage 2

- **Zone and front alignment.** Zone defenders, linebackers and the line stay in their default spots, set for a 2x2 formation with the tight end on the right. They need to shift to trips, empty and tight-end strength, and mirror when the strength is left.
- **Defensive personnel.** Every call is nickel. Against two backs or two tight ends a real defense would bring in a third linebacker, so base-personnel calls are needed.
- **Leverage-based outcome.** The edge comes from the play's `bestVs` / `struggleVs` tags plus a box count and rusher count. It should come from the field: who is in conflict, numbers in the box, two receivers in one defender's zone.
- **Conflict defender reacts.** He is ringed but does not move with the read. He should pick a receiver, and the play should show the ball going to the other one.
- **A throw and a result.** Still no throw, catch, tackle or yards gained.
- **Run fits.** Coverage players still stand still on run plays.
- **Why-text per matchup.** The panel reuses coaching points that mention the coverage. Many matchups have none, so the explanation is thin there.

See the design notes in `knowledge/12-simulator-data-model.md`.

## Other known limits

- Players pass through each other, because nothing models contact.
- Blockers without a path in the data get a short default step, so those movements are approximate.
- No yard numbers on the field, because the data has no absolute field position.

## Deliberately left out

- A draw-your-own-play editor
- Accounts or a backend
- Pre-snap motion
- Match coverage
- Special teams
- Real team playbooks
- An in-app AI chat
