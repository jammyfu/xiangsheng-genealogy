import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { readTimelineState, updateTimelineSearch } from "../lib/timeline-state";
import type { TimelineState } from "../lib/timeline-state";
import type { Person } from "../types";
import type { LifeEvent } from "../event-types";
import {
  events,
  eventsForPerson,
  sortEvents,
  EVENT_KIND_LABELS,
} from "../lib/events";
import { EventList } from "./EventList";
import { TimelineJourney } from "./TimelineJourney";

export function TimelineView({
  person,
  onSelect,
}: {
  person: Person;
  onSelect: (id: string) => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { scope, kind, presentation, event } = readTimelineState(
    location.search,
  );
  const change = (patch: Partial<TimelineState>, replace = false) =>
    navigate(
      {
        pathname: location.pathname,
        search: updateTimelineSearch(location.search, patch),
      },
      { replace },
    );
  const kindRef = useRef<HTMLSelectElement>(null);
  const list = useMemo(() => {
    let result = scope === "all" ? events : eventsForPerson(person.id);
    if (scope === "person") {
      const life: LifeEvent[] = [];
      if (person.birthYear && !result.some((event) => event.kind === "birth"))
        life.push({
          id: `${person.id}-birth`,
          title: `${person.name}出生`,
          date: String(person.birthYear),
          datePrecision: "year",
          kind: "birth",
          people: [person.id],
          summary: "生年据已收录人物资料。原始记载和精确日期可继续核对。",
          status: "unverified",
          sources: person.sources,
          verifiedAt: "2026-09-10",
        });
      if (person.deathYear && !result.some((event) => event.kind === "death"))
        life.push({
          id: `${person.id}-death`,
          title: `${person.name}逝世`,
          date: String(person.deathYear),
          datePrecision: "year",
          kind: "death",
          people: [person.id],
          summary: "卒年据已收录人物资料。原始记载和精确日期可继续核对。",
          status: "unverified",
          sources: person.sources,
          verifiedAt: "2026-09-10",
        });
      result = [...life, ...result];
    }
    return sortEvents(result.filter((e) => !kind || e.kind === kind));
  }, [person, scope, kind]);
  const selectedEvent =
    list.find((item) => item.id === event)?.id ?? list[0]?.id ?? "";
  useEffect(() => {
    // Canonicalize stale/shared IDs against the actual filtered records.
    if (event !== selectedEvent) {
      navigate(
        {
          pathname: location.pathname,
          search: updateTimelineSearch(location.search, {
            event: selectedEvent,
          }),
        },
        { replace: true },
      );
    }
  }, [event, selectedEvent, location.pathname, location.search, navigate]);
  return (
    <section className="timeline-scene">
      <header className="section-heading">
        <div>
          <p className="eyebrow">循岁月 · 知来路</p>
          <h1>
            {scope === "person" ? `${person.name} · 生平年表` : "相声纪事"}
          </h1>
          <p className="muted">
            师承之外，也记聚散、作品与时代。每条事件均可展开核对出处。
          </p>
        </div>
        <div className="timeline-filters">
          <div className="text-switch">
            <button
              className={scope === "person" ? "active" : ""}
              aria-pressed={scope === "person"}
              onClick={() => change({ scope: "person", event: "" })}
            >
              当前人物
            </button>
            <button
              className={scope === "all" ? "active" : ""}
              aria-pressed={scope === "all"}
              onClick={() => change({ scope: "all", event: "" })}
            >
              全部纪事
            </button>
          </div>
          <select
            ref={kindRef}
            aria-label="筛选事件类型"
            value={kind}
            onChange={(e) => change({ kind: e.target.value, event: "" })}
          >
            <option value="">所有事件</option>
            {Object.entries(EVENT_KIND_LABELS).map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </header>
      <div className="text-switch" role="group" aria-label="年表阅法">
        <button
          aria-pressed={presentation === "journey"}
          className={presentation === "journey" ? "active" : ""}
          onClick={() => change({ presentation: "journey" })}
        >
          立体回廊
        </button>
        <button
          aria-pressed={presentation === "list"}
          className={presentation === "list" ? "active" : ""}
          onClick={() => change({ presentation: "list" })}
        >
          纪事列表
        </button>
      </div>
      {presentation === "journey" && list.length > 0 ? (
        <TimelineJourney
          selectedId={selectedEvent}
          onEventSelect={(id) => change({ event: id })}
          items={list}
          onSelect={scope === "all" ? onSelect : undefined}
        />
      ) : (
        <EventList
          selectedId={selectedEvent}
          onEventSelect={(id) => change({ event: id, presentation: "journey" })}
          items={list}
          onSelect={scope === "all" ? onSelect : undefined}
          emptyTitle={kind ? "没有匹配的事件" : undefined}
          emptyMessage={
            kind
              ? `${scope === "all" ? "全部纪事" : `${person.name}的年表`}中尚未收录此类事件。可清除筛选查看其他记录。`
              : scope === "all"
                ? "事件资料尚待补充，可先在人物书笺中查阅已收录的小传与师承。"
                : undefined
          }
          onResetFilter={
            kind
              ? () => {
                  change({ kind: "", event: "" });
                  kindRef.current?.focus();
                }
              : undefined
          }
        />
      )}
    </section>
  );
}
