import { useEffect, useRef } from 'react';

/** Like useEffect, but skips the trailing invocation if the deps change again
 *  within `delay` ms. Used to debounce note persistence. */
export function useDebouncedEffect(
  effect: () => void | (() => void),
  deps: ReadonlyArray<unknown>,
  delay = 600,
): void {
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  useEffect(() => {
    const id = window.setTimeout(() => {
      const ret = effect();
      cleanupRef.current = typeof ret === 'function' ? ret : undefined;
    }, delay);
    return () => {
      window.clearTimeout(id);
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
