import { useLayoutEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { gsap } from "gsap";
import { MOTION, viewDirection } from "./motion";

/** Navigation stays live; only the newly selected content is animated. */
export function useStudioMotion(
  root: RefObject<HTMLElement | null>,
  view: string,
  person: string,
) {
  const previous = useRef(view);
  const [transitioning, setTransitioning] = useState(false);
  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const direction = viewDirection(previous.current, view);
    previous.current = view;
    const media = gsap.matchMedia();
    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const content = host.querySelector("#main-content");
        if (!content) return;
        setTransitioning(true);
        const tween = gsap.fromTo(
          content,
          {
            opacity: 0.65,
            x: view === "book" || view === "timeline" ? direction * 18 : 0,
          },
          {
            opacity: 1,
            x: 0,
            duration: MOTION.view,
            ease: "power2.out",
            clearProps: "opacity,transform",
            onComplete: () => setTransitioning(false),
          },
        );
        const finish = () => {
          if (document.hidden) tween.progress(1);
        };
        document.addEventListener("visibilitychange", finish);
        return () => {
          document.removeEventListener("visibilitychange", finish);
          setTransitioning(false);
        };
      },
      host,
    );
    return () => media.revert();
  }, [root, view]);
  useLayoutEffect(() => {
    const host = root.current;
    if (!host) return;
    const media = gsap.matchMedia();
    media.add(
      "(prefers-reduced-motion: no-preference)",
      () => {
        const details = host.querySelectorAll(
          ".summary-body, .book-spread, .timeline-scene",
        );
        if (!details.length) return;
        const tween = gsap.fromTo(
          details,
          { opacity: 0.7, y: 8 },
          {
            opacity: 1,
            y: 0,
            duration: MOTION.detail,
            ease: "power2.out",
            clearProps: "opacity,transform",
          },
        );
        const finish = () => {
          if (document.hidden) tween.progress(1);
        };
        document.addEventListener("visibilitychange", finish);
        return () => document.removeEventListener("visibilitychange", finish);
      },
      host,
    );
    return () => media.revert();
  }, [root, person]);
  return transitioning;
}

export function usePageMotion(
  root: RefObject<HTMLElement | null>,
  page: string,
) {
  const previous = useRef(page);
  useLayoutEffect(() => {
    const element = root.current;
    if (!element || previous.current === page) return;
    previous.current = page;
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const tween = gsap.fromTo(
        element,
        { opacity: 0.65, y: 6 },
        {
          opacity: 1,
          y: 0,
          duration: MOTION.detail,
          ease: "power2.out",
          clearProps: "opacity,transform",
        },
      );
      const finish = () => {
        if (document.hidden) tween.progress(1);
      };
      document.addEventListener("visibilitychange", finish);
      return () => document.removeEventListener("visibilitychange", finish);
    });
    return () => media.revert();
  }, [root, page]);
}
