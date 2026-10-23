import { useSyncExternalStore } from "react";

const subscribeToNothing = () => () => {};

/**
 * False on the server and while hydrating, true once the component runs in the browser.
 * Use it to read browser-only values (storage, window, current time) without setting
 * state in an effect.
 */
export const useIsClient = (): boolean =>
  useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );

const subscribeToStorage = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

/**
 * Reads a localStorage or sessionStorage item during render.
 * Returns undefined on the server and while hydrating, then the stored string or null.
 */
export const useStorageItem = (area: "local" | "session", key: string): string | null | undefined =>
  useSyncExternalStore(
    subscribeToStorage,
    () => (area === "local" ? localStorage : sessionStorage).getItem(key),
    () => undefined,
  );
