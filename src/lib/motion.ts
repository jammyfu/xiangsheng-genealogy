import { gsap } from "gsap";

export const MOTION = { reveal: 1.1, view: 0.42, detail: 0.28 } as const;

/** Animate the actual geometry input, with R3F rendering only on updates. */
export function revealScroll(
  state: { open: number; invalidate: () => void },
  animate: boolean,
) {
  gsap.killTweensOf(state);
  if (!animate || state.open >= 0.999) {
    state.open = 1;
    state.invalidate();
    return null;
  }
  return gsap.to(state, {
    open: 1,
    duration: MOTION.reveal,
    ease: "power3.out",
    overwrite: "auto",
    onUpdate: () => state.invalidate(),
  });
}

export function viewDirection(previous: string, next: string) {
  const order = ["scroll", "tree", "book", "timeline"];
  return Math.sign(order.indexOf(next) - order.indexOf(previous));
}
