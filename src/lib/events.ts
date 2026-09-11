import eventFile from '../../data/events.json';
import type { EventDatePrecision, EventKind, EventStatus, LifeEvent } from '../event-types';

export const events: LifeEvent[] = (eventFile as { events: LifeEvent[] }).events;

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  birth: '出生',
  death: '逝世',
  apprenticeship: '拜师',
  departure: '组织退出',
  expulsion: '除名',
  discipline: '演出与管理措施',
  dispute: '公开争议',
  work: '作品',
  milestone: '艺事',
};

export const STATUS_LABELS: Record<EventStatus, string> = {
  documented: '已报道事实',
  attributed: '当事人说法',
  disputed: '存在分歧',
  unverified: '待核实',
};

export function eventsForPerson(id: string): LifeEvent[] {
  return sortEvents(events.filter((event) => event.people.includes(id)));
}

/** Stable ascending order; partial dates use their earliest possible day only for ordering. */
export function sortEvents(list: readonly LifeEvent[]): LifeEvent[] {
  return [...list].sort((a, b) => dateOrder(a.date) - dateOrder(b.date));
}

export function formatEventDate(event: LifeEvent): string {
  const [year, month, day] = event.date.split('-').map(Number);
  if (event.datePrecision === 'year') return `${year}年`;
  if (event.datePrecision === 'month') return `${year}年${month}月`;
  return `${year}年${month}月${day}日`;
}

function dateOrder(date: string): number {
  const [year, month = 1, day = 1] = date.split('-').map(Number);
  return year * 10000 + month * 100 + day;
}

function isCalendarDate(date: string, precision: EventDatePrecision): boolean {
  const patterns = { year: /^\d{4}$/, month: /^\d{4}-\d{2}$/, day: /^\d{4}-\d{2}-\d{2}$/ };
  if (!patterns[precision]?.test(date)) return false;
  const [year, month = 1, day = 1] = date.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= monthDays[month - 1];
}

/** Complements JSON Schema with cross-file references and real Gregorian calendar checks. */
export function validateEventReferences(
  list: readonly LifeEvent[], peopleIds: Iterable<string>, sourceIds: Iterable<string>,
): string[] {
  const errors: string[] = [];
  const knownPeople = new Set(peopleIds);
  const knownSources = new Set(sourceIds);
  const eventIds = new Set<string>();

  const checkSources = (ids: string[], context: string) => {
    if (ids.length === 0) errors.push(`${context}: sources must not be empty`);
    for (const id of ids) {
      if (!knownSources.has(id)) errors.push(`${context}: unknown source ${id}`);
    }
  };

  for (const event of list) {
    if (eventIds.has(event.id)) errors.push(`Duplicate event id: ${event.id}`);
    eventIds.add(event.id);
    if (!event.summary.trim()) errors.push(`${event.id}: summary must not be empty`);
    if (event.people.length === 0) errors.push(`${event.id}: people must not be empty`);
    for (const id of event.people) {
      if (!knownPeople.has(id)) errors.push(`${event.id}: unknown person ${id}`);
    }
    checkSources(event.sources, event.id);

    const eventDateValid = isCalendarDate(event.date, event.datePrecision);
    const verifiedDateValid = isCalendarDate(event.verifiedAt, 'day');
    if (!eventDateValid) errors.push(`${event.id}: invalid date or datePrecision (${event.date})`);
    if (!verifiedDateValid) errors.push(`${event.id}: invalid verifiedAt (${event.verifiedAt})`);
    if (eventDateValid && verifiedDateValid && dateOrder(event.date) > dateOrder(event.verifiedAt)) {
      errors.push(`${event.id}: historical event date is after verifiedAt`);
    }

    const perspectives = event.perspectives ?? [];
    if ((event.status === 'attributed' || event.status === 'disputed') && perspectives.length === 0) {
      errors.push(`${event.id}: ${event.status} event needs a named, sourced perspective`);
    }
    for (const [index, perspective] of perspectives.entries()) {
      const context = `${event.id} perspective ${index + 1}`;
      if (!perspective.speaker.trim()) errors.push(`${context}: speaker must be named`);
      if (!perspective.summary.trim()) errors.push(`${context}: summary must not be empty`);
      checkSources(perspective.sources, context);
    }
  }
  return errors;
}
