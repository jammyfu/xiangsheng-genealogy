import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { LifeEvent } from "../event-types";
import { formatEventDate, STATUS_LABELS } from "../lib/events";
import { eventPoint } from "../lib/immersive-space";
import { EventList } from "./EventList";
import type { InkItem } from "./InkWorld";
import "./timeline-journey.css";
const InkWorld = lazy(() => import("./InkWorld"));

export function TimelineJourney({
  items,
  onSelect,
}: {
  items: LifeEvent[];
  onSelect?: (id: string) => void;
}) {
  const [selected, setSelected] = useState(items[0]?.id ?? "");
  const index = Math.max(
    0,
    items.findIndex((event) => event.id === selected),
  );
  const current = items[index];
  const spatialItems = useMemo<InkItem[]>(
    () =>
      items.map((event, i) => ({
        id: event.id,
        title: event.title,
        subtitle: formatEventDate(event),
        status: STATUS_LABELS[event.status],
        position: eventPoint(i).toArray() as [number, number, number],
      })),
    [items],
  );
  if (!current) return null;
  const go = (next: number) =>
    setSelected(items[Math.max(0, Math.min(items.length - 1, next))].id);
  return (
    <div className="timeline-journey">
      <div className="journey-layout">
        <Suspense
          fallback={<div className="ink-world-loading">山水正在舒展…</div>}
        >
          <InkWorld
            mode="timeline"
            items={spatialItems}
            selectedId={current.id}
            index={index}
            onSelect={setSelected}
          />
        </Suspense>
        <aside className="journey-detail" aria-label="事件详情">
          <h2>事件详情</h2>
          <EventList key={current.id} items={[current]} onSelect={onSelect} />
        </aside>
      </div>
      <div className="journey-controls" role="group" aria-label="时间轴导航">
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="上一事件"
        >
          <ArrowLeft size={18} />
          上一段
        </button>
        <div className="journey-slider">
          <input
            type="range"
            min={0}
            max={Math.max(0, items.length - 1)}
            value={index}
            disabled={items.length < 2}
            aria-label="按顺序浏览事件"
            aria-valuetext={`${formatEventDate(current)}，${current.title}`}
            onChange={(event) => go(Number(event.target.value))}
          />
          <div>
            <span>{formatEventDate(items[0])}</span>
            <span role="status">
              {formatEventDate(current)} · {index + 1} / {items.length}
            </span>
            <span>{formatEventDate(items[items.length - 1])}</span>
          </div>
        </div>
        <button
          onClick={() => go(index + 1)}
          disabled={index === items.length - 1}
          aria-label="下一事件"
        >
          下一段
          <ArrowRight size={18} />
        </button>
      </div>
      <p className="journey-hint">
        沿卷移步 ·
        点选纪事。按事件顺序排列，间距不代表时长；可切换纪事列表阅读全部记录。
      </p>
    </div>
  );
}
