export const GENERATIONS = ['德', '寿', '宝', '文', '明'] as const;
export type GenerationName = (typeof GENERATIONS)[number];

export type PortraitKind = 'placeholder' | 'public-domain' | 'external';

export interface Person {
  id: string;
  name: string;
  nameHant?: string;
  aliases?: string[];
  generation: GenerationName | null;
  generationIndex: number;
  birthYear?: number | null;
  deathYear?: number | null;
  floruit?: string;
  school?: string;
  bio: string;
  works: string[];
  sources: string[];
  portrait?: string | null;
  portraitKind: PortraitKind;
  disputed?: boolean;
  notes?: string[];
}

export type EdgeType = 'mentor';

export interface Edge {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
  disputed?: boolean;
  sources: string[];
  note?: string;
}

export interface Source {
  id: string;
  title: string;
  url: string;
  publisher: string;
  license?: string;
  accessed: string;
  note?: string;
}

export interface TourPath {
  id: string;
  title: string;
  subtitle: string;
  stops: string[];
}

export interface GraphNode {
  person: Person;
  x: number;
  y: number;
  z: number;
}
