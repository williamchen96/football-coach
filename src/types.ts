// Shapes of the files in data/, as described in knowledge/12-simulator-data-model.md.

export type Pt = [number, number];

export interface Spot {
  id: string;
  x: number;
  y: number;
}

export interface Formation {
  id: string;
  name: string;
  personnel: string;
  qb: string;
  distribution: string;
  notes?: string;
  players: Spot[];
}

export interface Assignment {
  action: string; // route | block | carry | fake | qb
  route?: string;
  block?: string;
  direction?: string;
  target?: string;
  path?: Pt[];
  aim?: string;
  read?: string;
  drop?: string;
  mesh?: string;
  readKey?: string;
}

export interface Play {
  id: string;
  name: string;
  type: string;
  formation: string;
  concept: string;
  assignments: Record<string, Assignment>;
  read: string;
  /** Zones whose defender the play puts in conflict, most likely first. */
  conflict?: string[];
  bestVs: string[];
  struggleVs: string[];
  coachingPoints: string[];
}

export interface DefAssignment {
  type: string; // rush | zone | man
  gap?: string;
  zones?: string[];
  target?: string;
}

export interface Defender extends Spot {
  assignment: DefAssignment;
}

export interface Defense {
  id: string;
  name: string;
  personnel: string;
  front: string;
  coverage: string;
  shell: string;
  notes?: string;
  players: Defender[];
}

export interface Zone {
  x: Pt;
  y: Pt;
}
