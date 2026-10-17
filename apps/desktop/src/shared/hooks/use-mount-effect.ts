import { useEffect, useRef, type EffectCallback } from "react";

export function useMountEffect(effect: EffectCallback) {
  const onMount = useRef(effect);
  useEffect(() => onMount.current(), []);
}
