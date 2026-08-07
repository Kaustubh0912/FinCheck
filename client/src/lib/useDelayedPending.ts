import { useEffect, useState } from "react";

/**
 * Returns `false` initially when `isPending` becomes `true`, and only flips to `true`
 * after `delay` milliseconds if `isPending` is still `true`.
 * Immediately resets to `false` when `isPending` becomes `false`.
 */
export function useDelayedPending(isPending: boolean, delay = 400): boolean {
  const [delayed, setDelayed] = useState(false);

  useEffect(() => {
    if (!isPending) {
      setDelayed(false);
      return;
    }

    const timer = setTimeout(() => {
      setDelayed(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [isPending, delay]);

  return delayed;
}
