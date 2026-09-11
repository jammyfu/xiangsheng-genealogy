import { afterEach, describe, expect, it } from 'vitest';
import Ajv from 'ajv/dist/2020.js';
import eventSchema from '../../data/schemas/events.schema.json';
import eventFile from '../../data/events.json';
import type { LifeEvent } from '../event-types';
import { edges, people, sources } from './catalog';
import {
  events,
  eventsForPerson,
  formatEventDate,
  sortEvents,
  validateEventReferences,
} from './events';

const fixture = (overrides: Partial<LifeEvent> = {}): LifeEvent => ({
  id: 'test-milestone',
  title: '公开演出',
  date: '2000-02-29',
  datePrecision: 'day',
  kind: 'milestone',
  people: ['person-a'],
  summary: '在公开资料中记录的演出。',
  status: 'documented',
  sources: ['source-a'],
  verifiedAt: '2026-09-10',
  ...overrides,
});

const referenceErrors = (list: LifeEvent[]) =>
  validateEventReferences(list, ['person-a', 'person-b'], ['source-a', 'source-b']);

describe('life-event schema and catalog', () => {
  const validate = new Ajv({ allErrors: true }).compile(eventSchema);

  it('accepts the event catalog and resolves its actual references', () => {
    expect(validate(eventFile), JSON.stringify(validate.errors)).toBe(true);
    expect(validateEventReferences(
      events, people.map((person) => person.id), sources.map((source) => source.id),
    )).toEqual([]);
  });

  it('accepts each supported time precision without inventing a day', () => {
    for (const event of [fixture(), fixture({ date: '2000-02', datePrecision: 'month' }),
      fixture({ date: '2000', datePrecision: 'year' })]) {
      expect(validate({ events: [event] }), JSON.stringify(validate.errors)).toBe(true);
    }
  });

  it.each([
    { sources: [] }, { people: [] }, { summary: '  ' }, { verifiedAt: '2026' },
    { date: '2000-02-29', datePrecision: 'year' },
    { date: '2000-13', datePrecision: 'month' },
    { kind: 'unknown' }, { status: 'unknown' },
    { status: 'attributed' }, { status: 'disputed', perspectives: [] },
    { status: 'disputed', perspectives: [{ speaker: ' ', summary: '说法', sources: ['source-a'] }] },
    { status: 'attributed', perspectives: [{ speaker: '当事人甲', summary: '说法', sources: [] }] },
  ])('rejects structurally incomplete evidence: %j', (overrides) => {
    expect(validate({ events: [{ ...fixture(), ...overrides }] })).toBe(false);
  });

  it('accepts a disputed event with a named, sourced perspective', () => {
    const event = fixture({ status: 'disputed', perspectives: [
      { speaker: '当事人甲', summary: '甲对该事件的公开说法。', sources: ['source-a'] },
    ] });
    expect(validate({ events: [event] }), JSON.stringify(validate.errors)).toBe(true);
  });

  it('rejects edge mutation instructions on an organization departure', () => {
    expect(validate({ events: [{ ...fixture({ kind: 'departure' }), removeEdges: ['mentor-edge'] }] }))
      .toBe(false);
  });
});

describe('event reference and date validation', () => {
  it('accepts valid source and participant references, including Sets', () => {
    expect(validateEventReferences([fixture()], new Set(['person-a']), new Set(['source-a'])))
      .toEqual([]);
  });

  it('rejects duplicate event IDs', () => {
    expect(referenceErrors([fixture(), fixture()]).join(' ')).toMatch(/duplicate.*test-milestone/i);
  });

  it('reports unresolved participants and every source, including perspective sources', () => {
    const errors = referenceErrors([fixture({ people: ['missing-person'], sources: ['missing-source'],
      perspectives: [{ speaker: '当事人甲', summary: '公开说法。', sources: ['missing-perspective-source'] }],
    })]).join(' ');
    expect(errors).toContain('missing-person');
    expect(errors).toContain('missing-source');
    expect(errors).toContain('missing-perspective-source');
  });

  it.each([
    ['1900-02-29', 'day'], ['2001-02-29', 'day'], ['2000-04-31', 'day'],
    ['2000-00-10', 'day'], ['2000-01-00', 'day'], ['2000-13', 'month'],
    ['0000', 'year'], ['2000-2', 'month'], ['2000-02', 'day'], ['2000-01-01', 'year'],
  ] as const)('rejects invalid date or precision %s (%s)', (date, datePrecision) => {
    expect(referenceErrors([fixture({ date, datePrecision })]).join(' ')).toMatch(/date/i);
  });

  it.each([
    ['2000-02-29', 'day'], ['2024-02-29', 'day'], ['2000-02', 'month'],
    ['2026', 'year'], ['2026-09', 'month'], ['2026-09-10', 'day'],
  ] as const)('accepts valid historical date %s (%s)', (date, datePrecision) => {
    expect(referenceErrors([fixture({ date, datePrecision })])).toEqual([]);
  });

  it.each(['2026-09-11', '2027-01-01'])('rejects events dated after verification: %s', (date) => {
    expect(referenceErrors([fixture({ date })]).join(' ')).toMatch(/verifiedAt/i);
  });

  it.each(['2027', '2026-10'])('rejects coarse dates wholly after verification: %s', (date) => {
    const datePrecision = date.length === 4 ? 'year' : 'month';
    expect(referenceErrors([fixture({ date, datePrecision })]).join(' ')).toMatch(/verifiedAt/i);
  });

  it.each(['2026-02-30', '2026-09', 'not-a-date'])('rejects invalid verification dates: %s', (verifiedAt) => {
    expect(referenceErrors([fixture({ verifiedAt })]).join(' ')).toMatch(/verifiedAt/i);
  });

  it('rejects missing sources, participants and blank summaries', () => {
    const errors = referenceErrors([fixture({ sources: [], people: [], summary: '  ' })]).join(' ');
    expect(errors).toMatch(/source/i);
    expect(errors).toMatch(/people|participant/i);
    expect(errors).toMatch(/summary/i);
  });

  it.each(['attributed', 'disputed'] as const)('requires a named sourced perspective for %s', (status) => {
    expect(referenceErrors([fixture({ status })]).join(' ')).toMatch(/perspective/i);
    expect(referenceErrors([fixture({ status, perspectives: [
      { speaker: ' ', summary: '说法', sources: ['source-a'] },
    ] })]).join(' ')).toMatch(/speaker|perspective/i);
    expect(referenceErrors([fixture({ status, perspectives: [
      { speaker: '当事人甲', summary: '公开说法。', sources: ['source-a'] },
    ] })])).toEqual([]);
  });

  it('rejects empty perspective evidence even when another perspective is valid', () => {
    const errors = referenceErrors([fixture({ status: 'disputed', perspectives: [
      { speaker: '当事人甲', summary: '公开说法。', sources: ['source-a'] },
      { speaker: '当事人乙', summary: ' ', sources: [] },
    ] })]).join(' ');
    expect(errors).toMatch(/summary/i);
    expect(errors).toMatch(/source/i);
  });
});

describe('event reading helpers', () => {
  const originalEvents = [...events];
  afterEach(() => events.splice(0, events.length, ...originalEvents));

  it('sorts chronologically without mutating the caller and preserves equal-date input order', () => {
    const list = [
      fixture({ id: 'last', date: '2001', datePrecision: 'year' }),
      fixture({ id: 'same-first', date: '2000-01-01' }),
      fixture({ id: 'first', date: '1999-12', datePrecision: 'month' }),
      fixture({ id: 'same-second', date: '2000-01-01' }),
    ];
    expect(sortEvents(list).map((event) => event.id)).toEqual(['first', 'same-first', 'same-second', 'last']);
    expect(list.map((event) => event.id)).toEqual(['last', 'same-first', 'first', 'same-second']);
  });

  it.each([
    ['2000', 'year', '2000年'], ['2000-02', 'month', '2000年2月'],
    ['2000-02-29', 'day', '2000年2月29日'],
  ] as const)('formats %s without filling unknown precision', (date, datePrecision, label) => {
    expect(formatEventDate(fixture({ date, datePrecision }))).toBe(label);
  });

  it('returns only linked events in chronological order, including shared participants', () => {
    events.splice(0, events.length,
      fixture({ id: 'later', date: '2001', datePrecision: 'year' }),
      fixture({ id: 'unrelated', people: ['person-b'] }),
      fixture({ id: 'shared', people: ['person-a', 'person-b'] }),
    );
    expect(eventsForPerson('person-a').map((event) => event.id)).toEqual(['shared', 'later']);
    expect(eventsForPerson('absent-person')).toEqual([]);
  });

  it('keeps historical mentorship available when recording an organization departure', () => {
    const historicalEdge = edges[0];
    const before = structuredClone(edges);
    events.push(fixture({ id: 'departure-test', kind: 'departure', people: [historicalEdge.to] }));
    expect(eventsForPerson(historicalEdge.to).some((event) => event.id === 'departure-test')).toBe(true);
    expect(edges).toEqual(before);
  });
});
