import { useEffect, useRef, useState } from "react";

// A number that rolls up to `target` (and on to any new value) over
// `duration` ms, easing out. Shows the value straight away for anyone who
// prefers reduced motion.
export function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    let frame = 0;
    let start = 0;

    function step(time: number) {
      if (!start) start = time;
      const progress = reduced ? 1 : Math.min(1, (time - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = Math.round(from + (target - from) * eased);

      setValue(next);
      fromRef.current = next;
      if (progress < 1) frame = requestAnimationFrame(step);
    }

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);

  return value;
}
