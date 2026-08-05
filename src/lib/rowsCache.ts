import type { DataRow } from "../types";

// Client-side cache for page_row_chunks reads, using IndexedDB (not
// localStorage — a single big sheet's rows can easily exceed localStorage's
// ~5-10MB per-origin limit, where IndexedDB comfortably handles much more).
//
// Why this exists: the shared data only actually changes once a week (the
// Sunday-noon sync — see README's "Setting up shared storage" / "server-side
// data refresh"), plus whenever the Admin does a manual "Refresh data".
// Without a cache, every page load / browser reload / tab re-open
// re-downloads every visited page's full row data from Supabase again,
// even though it's identical to what was already fetched a minute ago.
// That repeated, unnecessary egress is what actually shows up as high
// Supabase bandwidth usage. A ~6.5-day cache means: browse/reload as much
// as you want, and it only ever re-hits Supabase once that page's cached
// copy is about to go a week stale — or immediately, for anyone who gets a
// live update via the realtime subscription or an explicit "Refresh data"
// click, both of which write fresh data straight into this cache instead
// of waiting for the TTL.

const DB_NAME = "breadfast-dashboard-cache";
const DB_VERSION = 1;
const STORE_NAME = "pageRows";
// Matches the sync cadence (weekly, Sunday noon — see App.tsx), minus a
// small buffer, so a cache entry never looks "fresh" past the point the
// next scheduled sync was supposed to have already refreshed it.
const TTL_MS = 6.5 * 24 * 60 * 60 * 1000;

interface CacheEntry {
  pageId: string;
  rows: DataRow[];
  cachedAt: number;
  // The page's `lastUpdated` value this cache entry was written for. Lets a
  // cache read detect "this page was refreshed while I wasn't looking"
  // even before the ~6.5-day TTL — see the doc comment on
  // getCachedPageRows below for why this matters.
  lastUpdated: string | null;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null); // SSR/unsupported-browser guard
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME, { keyPath: "pageId" });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn("Row cache: couldn't open IndexedDB — falling back to always fetching from Supabase.", req.error);
          resolve(null);
        };
      } catch (e) {
        console.warn("Row cache: IndexedDB unavailable — falling back to always fetching from Supabase.", e);
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/** Returns a page's cached rows if present, still under the ~6.5-day TTL,
 *  AND (when `expectedLastUpdated` is passed) written for the same version
 *  of the page as `expectedLastUpdated` — otherwise null (meaning: go fetch
 *  it from Supabase).
 *
 *  The `expectedLastUpdated` check matters for a specific case the TTL
 *  alone can't catch: the realtime subscription (see remoteDb.ts's
 *  subscribeToTeamsChanges) intentionally skips re-fetching rows for pages
 *  nobody in this browser session has opened yet — otherwise every idle
 *  browser would re-download every page touched by e.g. the weekly sync,
 *  which is worse for egress than the problem it'd solve. That means
 *  someone (typically an Employee/Viewer who wasn't looking at that page
 *  during a refresh) can still be sitting on an IndexedDB cache entry from
 *  *before* the refresh, well within the TTL, the first time they actually
 *  open that page afterwards. Comparing against the page's current
 *  `lastUpdated` (already fresh in memory by then — metadata changes are
 *  never skipped the way row changes are) catches exactly that case: a
 *  mismatch means "this cache predates the last refresh", so it's treated
 *  as a miss even though the TTL clock hasn't run out.
 *
 *  Pass `undefined` (not `null`) for `expectedLastUpdated` to skip this
 *  check entirely and rely on the TTL alone. */
export async function getCachedPageRows(
  pageId: string,
  expectedLastUpdated?: string | null
): Promise<DataRow[] | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(pageId);
      req.onsuccess = () => {
        const entry = req.result as CacheEntry | undefined;
        if (!entry) return resolve(null);
        if (Date.now() - entry.cachedAt > TTL_MS) return resolve(null); // stale — treat as a miss
        if (expectedLastUpdated !== undefined && entry.lastUpdated !== expectedLastUpdated) return resolve(null); // refreshed since this was cached
        resolve(entry.rows);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Writes (or overwrites) a page's cached rows with a fresh timestamp,
 *  tagged with the page's `lastUpdated` value at the time of writing (see
 *  getCachedPageRows for why). Called after every successful Supabase
 *  fetch, every realtime-pushed update, and every manual "Refresh data" —
 *  so the cache is always write-through, never the thing standing between
 *  a person and data they just explicitly asked to see fresh. */
export async function setCachedPageRows(pageId: string, rows: DataRow[], lastUpdated: string | null = null): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ pageId, rows, cachedAt: Date.now(), lastUpdated } satisfies CacheEntry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

/** Removes a page's cached entry outright — used when a page is deleted,
 *  so a stale cache entry can never resurface old data under a reused id. */
export async function invalidateCachedPageRows(pageId: string): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(pageId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
