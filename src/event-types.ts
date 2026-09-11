export type EventDatePrecision = 'year' | 'month' | 'day';
export type EventKind =
  | 'birth' | 'death' | 'apprenticeship' | 'departure' | 'expulsion'
  | 'discipline' | 'dispute' | 'work' | 'milestone';
export type EventStatus = 'documented' | 'attributed' | 'disputed' | 'unverified';

export interface EventPerspective {
  speaker: string;
  summary: string;
  sources: string[];
}

/** Public professional history. Departure/expulsion events never modify mentor edges. */
export interface LifeEvent {
  id: string;
  title: string;
  /** Actual event date; never substitute a source's publication date. */
  date: string;
  datePrecision: EventDatePrecision;
  kind: EventKind;
  people: string[];
  summary: string;
  status: EventStatus;
  sources: string[];
  perspectives?: EventPerspective[];
  verifiedAt: string;
  notes?: string;
}
