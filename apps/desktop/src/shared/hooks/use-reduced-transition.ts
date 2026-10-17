import { useReducedMotion, type Transition } from "motion/react";

const INSTANT: Transition = { duration: 0 };

export function useReducedTransition(transition: Transition): Transition {
  return useReducedMotion() ? INSTANT : transition;
}
