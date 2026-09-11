import { useState } from "react";
import { CaretDown, ArrowUpRight } from "@phosphor-icons/react";
import type { LifeEvent } from "../event-types";
import {
  EVENT_KIND_LABELS,
  STATUS_LABELS,
  formatEventDate,
} from "../lib/events";
import { peopleById } from "../lib/catalog";
import { SourceLinks } from "./SourceLinks";

export function EventList({
  items,
  onSelect,
  emptyTitle = "此处尚待补笺",
  emptyMessage = "尚未收录该人物的事件。已收录的小传与师承可在人物书笺中查阅。",
  onResetFilter,
}: {
  items: LifeEvent[];
  onSelect?: (id: string) => void;
  emptyTitle?: string;
  emptyMessage?: string;
  onResetFilter?: () => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (!items.length)
    return (
      <div className="empty-state">
        <h3>{emptyTitle}</h3>
        <p>{emptyMessage}</p>
        {onResetFilter && (
          <button className="inline-link" onClick={onResetFilter}>
            清除事件筛选
          </button>
        )}
      </div>
    );
  return (
    <ol className="event-list">
      {items.map((event) => (
        <li key={event.id} className={`event-item status-${event.status}`}>
          <div className="event-date">
            <time dateTime={event.date}>{formatEventDate(event)}</time>
            <span>{EVENT_KIND_LABELS[event.kind]}</span>
          </div>
          <article>
            <div className="event-heading">
              <h3>{event.title}</h3>
              <span className="evidence-label">
                {STATUS_LABELS[event.status]}
              </span>
            </div>
            <p>{event.summary}</p>
            {onSelect && (
              <div className="event-people">
                {event.people.map(
                  (id) =>
                    peopleById[id] && (
                      <button key={id} onClick={() => onSelect(id)}>
                        {peopleById[id].name}
                        <ArrowUpRight size={13} />
                      </button>
                    ),
                )}
              </div>
            )}
            <button
              className="event-expand"
              aria-expanded={open === event.id}
              onClick={() => setOpen(open === event.id ? null : event.id)}
            >
              查看依据与不同说法
              <CaretDown
                size={14}
                className={open === event.id ? "rotate" : ""}
              />
            </button>
            {open === event.id && (
              <div className="event-evidence">
                {event.perspectives?.map((p, i) => (
                  <section key={i}>
                    <h4>{p.speaker}的说法</h4>
                    <p>{p.summary}</p>
                    <SourceLinks ids={p.sources} />
                  </section>
                ))}
                {event.notes && (
                  <p className="editor-note">编者注：{event.notes}</p>
                )}
                <SourceLinks ids={event.sources} />
                <small>核验记录：{event.verifiedAt}</small>
              </div>
            )}
          </article>
        </li>
      ))}
    </ol>
  );
}
