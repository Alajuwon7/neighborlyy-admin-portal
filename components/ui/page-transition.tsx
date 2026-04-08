"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Top-of-page loading bar that shows during route transitions.
 * Uses the CSS classes .nly-top-loader and .nly-top-loader.complete from globals.css.
 *
 * Detects navigation start by monkey-patching history.pushState/replaceState
 * (which Next.js Link uses internally), and detects completion via usePathname().
 */
export function PageTransitionLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const prevPathRef = useRef(pathname);

  // Detect route completion via pathname change
  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      setCompleting(true);
      const timer = setTimeout(() => {
        setLoading(false);
        setCompleting(false);
      }, 350);
      prevPathRef.current = pathname;
      return () => clearTimeout(timer);
    }
  }, [pathname]);

  // Detect navigation start by intercepting history methods
  useEffect(() => {
    const currentPath = prevPathRef.current;

    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);

    const handleNavigation = (url: string | URL | null | undefined) => {
      if (!url) return;
      try {
        const nextPath = new URL(String(url), location.origin).pathname;
        if (nextPath !== prevPathRef.current) {
          // Defer state update — pushState may be called inside useInsertionEffect
          // (by Next.js internals), where scheduling updates is not allowed.
          queueMicrotask(() => {
            setLoading(true);
            setCompleting(false);
          });
        }
      } catch {
        // Invalid URL — ignore
      }
    };

    history.pushState = function (state: unknown, unused: string, url?: string | URL | null) {
      handleNavigation(url);
      return origPushState(state, unused, url);
    };

    history.replaceState = function (state: unknown, unused: string, url?: string | URL | null) {
      handleNavigation(url);
      return origReplaceState(state, unused, url);
    };

    // Handle browser back/forward
    const handlePopState = () => {
      if (location.pathname !== prevPathRef.current) {
        setLoading(true);
        setCompleting(false);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
      window.removeEventListener("popstate", handlePopState);
    };
  }, []); // Only mount once — no deps needed

  if (!loading && !completing) return null;

  return (
    <div
      className={`nly-top-loader ${completing ? "complete" : ""}`}
      role="progressbar"
      aria-label="Loading page"
    />
  );
}

/**
 * Hook to trigger loading state programmatically (e.g., for button clicks that push routes).
 */
export function usePageLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const prevPathRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevPathRef.current) {
      setIsLoading(false);
      prevPathRef.current = pathname;
    }
  }, [pathname]);

  const startLoading = useCallback(() => {
    setIsLoading(true);
  }, []);

  return { isLoading, startLoading };
}
