import type { Defense, Formation, Play, Pt, Zone } from './types.ts';
import { defenderAt, type PlayModel } from './sim.ts';
import { POSITIONS } from './describe.ts';

export type Layer = 'routes' | 'blocking' | 'zones' | 'coverage' | 'labels';
export interface Selection {
  side: 'offense' | 'defense';
  id: string;
}

const HALF = 26.67; // sideline, yards from the middle of the field
const BACK = -10; // how far behind the line of scrimmage the view starts
const DEEP = 32; // how far downfield it shows
const GAP_X: Record<string, number> = { A: 0.75, B: 2.25, C: 3.75, contain: 6 };

// Field y grows upfield; SVG y grows down the screen.
const pts = (path: Pt[]) => path.map(([x, y]) => `${x},${-y}`).join(' ');

interface Props {
  formation: Formation;
  play?: Play;
  model: PlayModel;
  defense?: Defense;
  /** The defender to ring: the one the play reads or puts in conflict. */
  keyId?: string;
  zones: Record<string, Zone>;
  t: number;
  layers: Record<Layer, boolean>;
  selected: Selection | null;
  onSelect: (s: Selection | null) => void;
}

export function Field({ formation, play, model, defense, keyId, zones, t, layers, selected, onSelect }: Props) {
  const dropping = !!play && play.type !== 'run';
  const isSelected = (side: Selection['side'], id: string) => selected?.side === side && selected.id === id;
  const pick = (s: Selection) => ({
    role: 'button',
    tabIndex: 0,
    'aria-label': `${POSITIONS[s.id] ?? s.id}, ${s.side}`,
    'aria-pressed': isSelected(s.side, s.id),
    onClick: () => onSelect(isSelected(s.side, s.id) ? null : s),
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(isSelected(s.side, s.id) ? null : s);
      }
    },
  });

  const yardLines = [];
  for (let y = BACK; y <= DEEP; y += 5) yardLines.push(y);
  const hashes = [];
  for (let y = BACK; y <= DEEP; y++) hashes.push(y);
  const ball = model.ball(t);

  return (
    <svg
      className="field"
      viewBox={`${-HALF} ${-DEEP} ${2 * HALF} ${DEEP - BACK}`}
      role="group"
      aria-label={`${play?.name ?? formation.name}${defense ? ` against ${defense.name}` : ''}`}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
        </marker>
        <marker id="bar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M5,0 L5,10" stroke="context-stroke" strokeWidth="2.5" />
        </marker>
      </defs>

      <rect className="grass" x={-HALF} y={-DEEP} width={2 * HALF} height={DEEP - BACK} />
      {yardLines.map((y) => (
        <line key={y} className={y === 0 ? 'los' : 'yard'} x1={-HALF} x2={HALF} y1={-y} y2={-y} />
      ))}
      {hashes.map((y) =>
        [-3.1, 3.1].map((x) => <line key={`${x}${y}`} className="yard" x1={x - 0.3} x2={x + 0.3} y1={-y} y2={-y} />),
      )}

      {layers.zones &&
        defense?.players.flatMap((d) =>
          (d.assignment.zones ?? []).map((name) => {
            const z = zones[name];
            const top = Math.min(z.y[1], DEEP);
            return (
              <rect
                key={d.id + name}
                className={`zone ${z.y[0] >= 12 ? 'deep' : 'under'} ${isSelected('defense', d.id) ? 'on' : ''}`}
                x={z.x[0]}
                y={-top}
                width={z.x[1] - z.x[0]}
                height={top - z.y[0]}
              />
            );
          }),
        )}

      {play &&
        formation.players.map((p) => {
          const a = play.assignments[p.id];
          const path = model.paths[p.id];
          const blocking = a?.action === 'block';
          if (!a || path.length < 2 || !layers[blocking ? 'blocking' : 'routes']) return null;
          return (
            <polyline
              key={p.id}
              className={`path ${a.action}`}
              points={pts(path)}
              markerEnd={blocking ? 'url(#bar)' : 'url(#arrow)'}
            />
          );
        })}

      {layers.coverage &&
        defense?.players.map((d) => {
          const a = d.assignment;
          const from = defenderAt(d, t, model, zones, dropping);
          if (a.type === 'man') {
            const to = model.at(a.target ?? '', t);
            return to && <polyline key={d.id} className="path man" points={pts([from, to])} />;
          }
          if (a.type !== 'rush' || t > 0) return null;
          const [gap, side] = (a.gap ?? '').split('-');
          const to: Pt = [(side === 'left' ? -1 : 1) * (GAP_X[gap] ?? 0), -1.5];
          return <polyline key={d.id} className="path rush" points={pts([from, to])} markerEnd="url(#arrow)" />;
        })}

      {formation.players.map((p) => {
        const [x, y] = model.at(p.id, t)!;
        return (
          <g key={p.id} className={`player offense ${isSelected('offense', p.id) ? 'on' : ''}`} {...pick({ side: 'offense', id: p.id })}>
            <circle cx={x} cy={-y} r={0.62} />
            {layers.labels && <text x={x} y={-y}>{p.id}</text>}
          </g>
        );
      })}

      {defense?.players.map((d) => {
        const [x, y] = defenderAt(d, t, model, zones, dropping);
        return (
          <g
            key={d.id}
            className={`player defense ${isSelected('defense', d.id) ? 'on' : ''} ${d.id === keyId ? 'key' : ''}`}
            {...pick({ side: 'defense', id: d.id })}
          >
            <rect x={x - 0.58} y={-y - 0.58} width={1.16} height={1.16} rx={0.15} />
            {layers.labels && <text x={x} y={-y}>{d.id.replace(/\d/, '')}</text>}
          </g>
        );
      })}

      <ellipse className="ball" cx={ball[0]} cy={-ball[1] - 0.75} rx={0.28} ry={0.42} />
    </svg>
  );
}
