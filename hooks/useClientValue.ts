"use client";

import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * Reads a client-only value (localStorage, current time, `window`, etc.) in a
 * hydration-safe, lint-clean way — without the `setState`-inside-`useEffect`
 * pattern that React's `react-hooks/set-state-in-effect` rule flags.
 *
 * Returns `serverValue` during SSR and the first (hydration) client render, then
 * switches to `getClientValue()` once hydrated. `getClientValue` must return a
 * primitive (or a referentially-stable value) so React's snapshot comparison
 * doesn't loop.
 */
export function useClientValue<T>(getClientValue: () => T, serverValue: T): T {
  return useSyncExternalStore(subscribeNoop, getClientValue, () => serverValue);
}
