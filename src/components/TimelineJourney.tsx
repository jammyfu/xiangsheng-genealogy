import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react";
import type { LifeEvent } from "../event-types";
import {
  formatEventDate,
  STATUS_LABELS,
  EVENT_KIND_LABELS,
} from "../lib/events";
import { EventList } from "./EventList";
import "./timeline-journey.css";

/** Ordinal positions: gaps deliberately do not imply elapsed historical time. */
export function journeyPose(offset: number) {
  const distance = Math.abs(offset);
  return {
    xPercent: offset * 112,
    z: -distance * 260,
    rotationY: offset === 0 ? 0 : -Math.sign(offset) * 22,
    opacity: distance > 2 ? 0 : distance === 0 ? 1 : 0.56 - distance * 0.1,
  };
}

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
  const stage = useRef<HTMLDivElement>(null);
  const [moving, setMoving] = useState(false);
  const initialized = useRef(false);

  useLayoutEffect(() => {
    const cards = Array.from(
      stage.current?.querySelectorAll<HTMLElement>(".journey-card") ?? [],
    );
    const media = gsap.matchMedia();
    media.add(
      {
        animate: "(prefers-reduced-motion: no-preference)",
        still: "(prefers-reduced-motion: reduce)",
      },
      (context) => {
        const animate =
          Boolean(context.conditions?.animate) && initialized.current;
        const timeline = gsap.timeline({ onComplete: () => setMoving(false) });
        setMoving(animate);
        cards.forEach((card, i) => {
          const pose = journeyPose(i - index);
          if (animate)
            timeline.to(
              card,
              {
                ...pose,
                duration: 0.65,
                ease: "power3.inOut",
                overwrite: "auto",
              },
              0,
            );
          else gsap.set(card, pose);
        });
        const settle = () => {
          if (document.hidden) timeline.progress(1);
        };
        document.addEventListener("visibilitychange", settle);
        return () => {
          timeline.kill();
          document.removeEventListener("visibilitychange", settle);
        };
      },
    );
    initialized.current = true;
    return () => {
      // Preserve the current pose across rapid navigation; matchMedia still owns cleanup.
      const poses = cards.map((card) => ({
        transform: card.style.transform,
        opacity: card.style.opacity,
      }));
      media.revert();
      cards.forEach((card, i) => Object.assign(card.style, poses[i]));
    };
  }, [index, items]);

  if (!current) return null;
  const go = (next: number) =>
    setSelected(items[Math.max(0, Math.min(items.length - 1, next))].id);
  return (
    <div
      className="timeline-journey"
      data-motion={moving ? "moving" : "settled"}
    >
      <div className="journey-caption">
        <span className="eyebrow">岁月回廊</span>
        <span role="status" aria-live="polite">
          {moving ? "正在移步至 " : ""}
          {formatEventDate(current)} · {index + 1} / {items.length}
        </span>
      </div>
      <div className="journey-stage" ref={stage}>
        {items.map((event, i) => (
          <button
            key={event.id}
            className={`journey-card ${i === index ? "is-current" : ""}`}
            aria-label={`${formatEventDate(event)}，${event.title}`}
            aria-current={i === index ? "step" : undefined}
            aria-hidden={Math.abs(i - index) > 2 || undefined}
            tabIndex={Math.abs(i - index) > 2 ? -1 : 0}
            style={{
              pointerEvents: Math.abs(i - index) > 2 ? "none" : "auto",
              zIndex: 10 - Math.min(9, Math.abs(i - index)),
            }}
            onClick={() => go(i)}
          >
            <span className="journey-year">{event.date.slice(0, 4)}</span>
            <span className="journey-kind">
              {EVENT_KIND_LABELS[event.kind]} · {formatEventDate(event)}
            </span>
            <strong>{event.title}</strong>
            <span className="evidence-label">
              {STATUS_LABELS[event.status]}
            </span>
          </button>
        ))}
      </div>
      <div className="journey-controls" role="group" aria-label="时间轴导航">
        <button
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="上一事件"
        >
          <ArrowLeft size={18} />
        </button>
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
        <button
          onClick={() => go(index + 1)}
          disabled={index === items.length - 1}
          aria-label="下一事件"
        >
          <ArrowRight size={18} />
        </button>
      </div>
      <p className="journey-hint">
        点选前后书笺，或用滑杆与方向键移步。按事件顺序排列，间距不代表时长。
      </p>
      <EventList key={current.id} items={[current]} onSelect={onSelect} />
    </div>
  );
}
