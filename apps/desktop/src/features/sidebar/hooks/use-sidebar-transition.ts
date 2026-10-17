import type { Transition } from "motion/react";
import { useReducedTransition } from "../../../shared/hooks/use-reduced-transition";

const SLIDE: Transition = { duration: 0.25, ease: [0.32, 0.72, 0, 1] };

export const useSidebarTransition = () => useReducedTransition(SLIDE);
