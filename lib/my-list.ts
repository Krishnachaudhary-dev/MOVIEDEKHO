"use client";

/**
 * My List + Likes — device-local watchlist store.
 *
 * There is no account system yet, so the watchlist lives in `localStorage`
 * under `moviedekho:` namespaced keys. Every component that shows the state
 * subscribes through the same hook, so a toggle on a card, the title page, or
 * /my-list stays in sync without a server round-trip.
 *
 * Deliberate limitation: this is per-browser data. Moving it behind accounts
 * (write-through to Supabase) is a later milestone; the stored shape
 * (`id` + `mediaType`) is exactly what such a table would key on.
 */

import { useCallback, useSyncExternalStore } from "react";

export type TitleMediaType = "movie" | "tv";

export interface MyListItem {
  id: number;
  mediaType: TitleMediaType;
}

const LIST_KEY = "moviedekho:my-list";
const LIKE_KEY = "moviedekho:likes";
const CHANGE_EVENT = "moviedekho:list-changed";

function sameEntry(a: MyListItem, b: MyListItem): boolean {
  return a.id === b.id && a.mediaType === b.mediaType;
}

const EMPTY: MyListItem[] = [];

/**
 * Snapshot cache — `useSyncExternalStore` requires `getSnapshot` to return a
 * cached value, and re-parsing localStorage on every read allocates a fresh
 * array each time (React treats that as an infinite change loop). Caching by
 * the raw stored string makes repeated reads return the identical reference
 * until storage actually changes.
 */
const snapshotCache = new Map<string, { raw: string; items: MyListItem[] }>();

function readKey(key: string): MyListItem[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY;
  }
  const cached = snapshotCache.get(key);
  if (cached && cached.raw === raw) return cached.items;

  let items: MyListItem[];
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    items =
      Array.isArray(parsed)
        ? parsed.filter(
            (entry): entry is MyListItem =>
              typeof entry === "object" &&
              entry !== null &&
              typeof (entry as MyListItem).id === "number" &&
              ((entry as MyListItem).mediaType === "movie" ||
                (entry as MyListItem).mediaType === "tv"),
          )
        : [];
  } catch {
    items = EMPTY;
  }
  snapshotCache.set(key, { raw: raw ?? "", items });
  return items;
}

function writeKey(key: string, items: MyListItem[]): void {
  if (typeof window === "undefined") return;
  // Update the snapshot cache first: the same-tick listeners re-read via
  // getSnapshot, and it must already reflect the write.
  snapshotCache.set(key, { raw: JSON.stringify(items), items });
  try {
    window.localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Storage full / private mode: ignore, state stays memory-visible for now.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE_EVENT, callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE_EVENT, callback);
  };
}

/**
 * One flag + toggle for a (storageKey, id, mediaType) triple.
 *
 * `useSyncExternalStore` re-runs the selector after every store change, so
 * cheaply-derived booleans keep dozens of mounted cards correct even when
 * another component mutates the list. `subscribe` is module-level and stable,
 * so it is passed through directly instead of through `useCallback`.
 */
export function useStoredFlag(
  storageKey: string,
  id: number,
  mediaType: TitleMediaType,
): [boolean, () => void] {
  const checked = useSyncExternalStore<boolean>(
    subscribe,
    () => readKey(storageKey).some((item) => item.id === id && item.mediaType === mediaType),
    () => false,
  );

  const toggle = useCallback(() => {
    const entry: MyListItem = { id, mediaType };
    const items = readKey(storageKey);
    const exists = items.some((item) => sameEntry(item, entry));
    writeKey(
      storageKey,
      exists ? items.filter((item) => !sameEntry(item, entry)) : [...items, entry],
    );
  }, [storageKey, id, mediaType]);

  return [checked, toggle];
}

/** My List (bookmark) state for a title. */
export function useInMyList(id: number, mediaType: TitleMediaType): [boolean, () => void] {
  return useStoredFlag(LIST_KEY, id, mediaType);
}

/** "Like" (heart) state for a title. */
export function useIsLiked(id: number, mediaType: TitleMediaType): [boolean, () => void] {
  return useStoredFlag(LIKE_KEY, id, mediaType);
}

/** Current My List contents — re-renders on every change. */
export function useMyList(): MyListItem[] {
  return useSyncExternalStore(
    subscribe,
    () => readKey(LIST_KEY),
    () => [],
  );
}

/** Remove one entry — used by the /my-list page's remove buttons. */
export function removeFromMyList(id: number, mediaType: TitleMediaType): void {
  const items = readKey(LIST_KEY).filter((item) => !sameEntry(item, { id, mediaType }));
  writeKey(LIST_KEY, items);
}
