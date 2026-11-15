import { useEffect, useMemo, useState } from 'react';
import formationsJson from '../data/formations.json';
import playsJson from '../data/plays.json';
import defensesJson from '../data/defenses.json';
import type { Defense, Formation, Play, Zone } from './types.ts';
import { alignDefense, buildPlay } from './sim.ts';
import { matchup } from './matchup.ts';
import { describeDefense, describeLook, describeOffense, label, POSITIONS } from './describe.ts';
import { Field, type Layer, type Selection } from './Field.tsx';

const formations = formationsJson.formations as Formation[];
const plays = playsJson.plays as unknown as Play[];
const defenses = defensesJson.defenses as Defense[];
const zones = defensesJson.zones as unknown as Record<string, Zone>;

const TYPES = ['all', ...new Set(plays.map((p) => p.type))];
const LAYERS: [Layer, string][] = [
  ['routes', 'Routes & runs'],
  ['blocking', 'Blocking'],
  ['zones', 'Zones'],
  ['coverage', 'Man & rush'],
  ['labels', 'Labels'],
];
const EDGES = { offense: 'Edge: offense', defense: 'Edge: defense', even: 'Even matchup' };
const aligned = (d: Defense, f: Formation): Defense => ({ ...d, players: alignDefense(d.players, f) });
const SHELLS: Record<string, string> = {
  MOFC: 'One deep safety before the snap (middle of the field closed).',
  MOFO: 'Two deep safeties before the snap (middle of the field open).',
};

function Chip(props: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="chip" aria-pressed={props.on} onClick={props.onClick}>
      {props.children}
    </button>
  );
}

export function App() {
  const params = new URLSearchParams(location.search);
  const firstPlay = plays.find((p) => p.id === params.get('play')) ?? (params.has('form') ? undefined : plays[0]);
  const [playId, setPlayId] = useState(firstPlay?.id);
  const [formationId, setFormationId] = useState(
    firstPlay?.formation ?? formations.find((f) => f.id === params.get('form'))?.id ?? formations[0].id,
  );
  const [defenseId, setDefenseId] = useState(defenses.find((d) => d.id === params.get('def'))?.id);
  const [type, setType] = useState('all');
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    routes: true, blocking: true, zones: false, coverage: true, labels: true,
  });
  const [selected, setSelected] = useState<Selection | null>(null);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);

  const formation = formations.find((f) => f.id === formationId)!;
  const play = plays.find((p) => p.id === playId);
  const call = defenses.find((d) => d.id === defenseId);
  const defense = useMemo(() => call && aligned(call, formation), [call, formation]);
  const result = play && defense ? matchup(play, formation, defense) : undefined;
  // Plays that attack a zone ring that zone's defender on this call; other read plays ring the named key.
  const keyId = defense && (play?.conflict ? result?.conflict?.id : play?.assignments.QB?.readKey);
  const stoppers = play ? defenses.filter((d) => matchup(play, formation, aligned(d, formation)).edge === 'defense') : [];
  const nextStopper = stoppers[(stoppers.findIndex((d) => d.id === defenseId) + 1) % stoppers.length];
  // Coaching points that talk about a look this defense shows.
  const looks = result
    ? [...result.good, ...result.bad].flatMap((x) => [label(x).toLowerCase(), ...(x === 'cover-4' ? ['quarters'] : [])])
    : [];
  const points = play?.coachingPoints.filter((c) => looks.some((x) => c.toLowerCase().includes(x))) ?? [];
  const model = useMemo(() => buildPlay(formation, play), [formation, play]);
  const onField = (id?: string) => formation.players.some((p) => p.id === id);
  // Only corners and man defenders re-align; everything else is set for a 2x2 with the tight end right and a slot left.
  const misaligned = defense && (formation.distribution !== '2x2' || !onField('H'));

  useEffect(() => {
    const q = new URLSearchParams();
    if (playId) q.set('play', playId);
    else q.set('form', formationId);
    if (defenseId) q.set('def', defenseId);
    history.replaceState(null, '', `?${q}`);
  }, [playId, formationId, defenseId]);

  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      const dt = (now - last) / 1000;
      last = now;
      setT((prev) => Math.min(model.duration, prev + dt * speed));
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, model]);
  useEffect(() => {
    if (playing && t >= model.duration) setPlaying(false);
  }, [playing, t, model]);

  const reset = () => {
    setT(0);
    setPlaying(false);
    setSelected(null);
  };
  const choosePlay = (p: Play) => {
    setPlayId(p.id);
    setFormationId(p.formation);
    reset();
  };
  const chooseFormation = (f: Formation) => {
    setFormationId(f.id);
    if (play?.formation !== f.id) setPlayId(undefined);
    reset();
  };

  const selectedOffense = selected?.side === 'offense' ? play?.assignments[selected.id] : undefined;
  const selectedDefender = selected?.side === 'defense' ? defense?.players.find((d) => d.id === selected.id) : undefined;

  return (
    <div className="app">
      <header>
        <h1>Football Coach</h1>
        <p>Pick a play and a defense, press play, and tap any player to see his job.</p>
      </header>

      <nav aria-label="Playbook">
        <h2>Formation</h2>
        <div className="chips">
          {formations.map((f) => (
            <Chip key={f.id} on={f.id === formationId} onClick={() => chooseFormation(f)}>{f.name}</Chip>
          ))}
        </div>

        <h2>Play</h2>
        <div className="chips">
          {TYPES.map((x) => (
            <Chip key={x} on={x === type} onClick={() => setType(x)}>{label(x)}</Chip>
          ))}
        </div>
        <ul className="plays">
          {plays.filter((p) => type === 'all' || p.type === type).map((p) => (
            <li key={p.id}>
              <button type="button" aria-pressed={p.id === playId} onClick={() => choosePlay(p)}>
                <strong>{p.name}</strong>
                <span>{label(p.type)} · {formations.find((f) => f.id === p.formation)?.name}</span>
              </button>
            </li>
          ))}
        </ul>

        <h2>Defense</h2>
        <div className="chips">
          <Chip on={!defense} onClick={() => { setDefenseId(undefined); setSelected(null); }}>None</Chip>
          {defenses.map((d) => (
            <Chip key={d.id} on={d.id === defenseId} onClick={() => { setDefenseId(d.id); setSelected(null); }}>
              {d.name}
            </Chip>
          ))}
        </div>
      </nav>

      <main>
        <div className="chips" role="group" aria-label="Layers">
          {LAYERS.map(([key, name]) => (
            <Chip key={key} on={layers[key]} onClick={() => setLayers({ ...layers, [key]: !layers[key] })}>{name}</Chip>
          ))}
        </div>
        <Field
          formation={formation}
          play={play}
          model={model}
          defense={defense}
          keyId={keyId}
          zones={zones}
          t={t}
          layers={layers}
          selected={selected}
          onSelect={setSelected}
        />
        {play && (
          <div className="controls">
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (!playing && t >= model.duration) setT(0);
                setPlaying(!playing);
              }}
            >
              {playing ? 'Pause' : t >= model.duration ? 'Replay' : 'Play'}
            </button>
            <button type="button" onClick={() => { setT(0); setPlaying(false); }}>Reset</button>
            <button
              type="button"
              disabled={!nextStopper || nextStopper.id === defenseId}
              onClick={() => {
                setDefenseId(nextStopper.id);
                setSelected(null);
                setT(0);
                setPlaying(true);
              }}
            >
              What stops this?
            </button>
            <input
              type="range"
              aria-label="Scrub through the play"
              min={0}
              max={model.duration}
              step={0.01}
              value={t}
              onChange={(e) => { setPlaying(false); setT(Number(e.target.value)); }}
            />
            <label>
              Speed{' '}
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
              </select>
            </label>
          </div>
        )}
        {misaligned && (
          <p className="note">
            Corners and man-coverage defenders have lined up on their receivers. The zone defenders and the front are
            in their default spots, set for a 2x2 formation with the tight end on the right. Against {formation.name}{' '}
            a real defense would shift those too
            {formation.personnel !== '11' && ', and would likely swap the nickel for a third linebacker'}.
          </p>
        )}
      </main>

      <aside aria-live="polite">
        {selected && (selectedOffense || selectedDefender || selected.side === 'offense') ? (
          <section>
            <h2>{selected.id.replace(/\d/, '')}: {POSITIONS[selected.id] ?? selected.id}</h2>
            <p>
              {selectedDefender
                ? describeDefense(selectedDefender.assignment, onField(selectedDefender.assignment.target))
                : selectedOffense
                  ? describeOffense(selectedOffense, keyId)
                  : 'Pick a play to see his job.'}
            </p>
            <button type="button" onClick={() => setSelected(null)}>Back to the play</button>
          </section>
        ) : play ? (
          <>
            {result && (
              <section>
                <h2>Matchup</h2>
                <p className={`verdict ${result.edge}`}>{EDGES[result.edge]}</p>
                <ul>
                  {result.good.map((x) => <li key={x}>Built to beat {label(x)}: {describeLook(x, result)}.</li>)}
                  {result.bad.map((x) => <li key={x}>Struggles against {label(x)}: {describeLook(x, result)}.</li>)}
                  {!looks.length && <li>Nothing this defense shows is a particular strength or weakness of the play.</li>}
                </ul>
                {result.conflict ? (
                  <p>
                    Watch the {POSITIONS[result.conflict.id].toLowerCase()} ({result.conflict.id.replace(/\d/, '')}),
                    ringed in yellow. He is the defender this play puts in conflict: he has two jobs at once, and the
                    ball goes wherever he does not.
                  </p>
                ) : play.conflict && (
                  <p>Nobody on this call plays the zone this play attacks, so no defender is put in conflict.</p>
                )}
                {points.map((c) => <p key={c}>{c}</p>)}
                <p className="meta">A rule-of-thumb verdict from what the play is built to beat, not a simulated result.</p>
              </section>
            )}
          <section>
            <h2>{play.name}</h2>
            <p className="meta">{label(play.type)} · {formation.name} · {formation.personnel} personnel</p>
            <p>{play.concept}</p>
            <h3>The read</h3>
            <p>{play.read}</p>
            <h3>Coaching points</h3>
            <ul>{play.coachingPoints.map((c) => <li key={c}>{c}</li>)}</ul>
            <h3>Good against</h3>
            <p className="tags">{play.bestVs.map((x) => <span key={x} className="good">{label(x)}</span>)}</p>
            <h3>Struggles against</h3>
            <p className="tags">{play.struggleVs.map((x) => <span key={x} className="bad">{label(x)}</span>)}</p>
          </section>
          </>
        ) : (
          <section>
            <h2>{formation.name}</h2>
            <p className="meta">{formation.personnel} personnel · {label(formation.qb)} · {formation.distribution}</p>
            <p>{formation.notes}</p>
            <p>No play is selected. Pick one from the list to see it run.</p>
          </section>
        )}
        {defense && !selected && (
          <section>
            <h2>{defense.name}</h2>
            <p className="meta">{label(defense.personnel)} · {label(defense.front)} front · {label(defense.coverage)}</p>
            <p>{defense.notes}</p>
            <p>{SHELLS[defense.shell]}</p>
          </section>
        )}
      </aside>
    </div>
  );
}
