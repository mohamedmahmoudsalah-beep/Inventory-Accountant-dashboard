import type { DataRow } from "../types";

// Client-side cache for page_row_chunks reads, using IndexedDB (not
// localStorage — a single big sheet's rows can easily exceed localStorage's
// ~5-10MB per-origin limit, where IndexedDB comfortably handles much more).
//
// Why this exists: the shared data only actually changes once a day (the
// 3 AM sync — see README's "Setting up shared storage" / "server-side data
// refresh"), but without a cache, every page load / browser reload / tab
// re-open re-downloads every visited page's full row data from Supabase
// again, even though it's identical to what was already fetched a minute
// ago. That repeated, unnecessary egress is what actually shows up as high
// Supabase bandwidth usage over a full day with several people's browsers
// open. A 24-hour cache means: browse/reload as much as you want, and it
// only ever re-hits Supabase once that page's cached copy turns a day old
// — or immediately, for anyone who gets a live update via the realtime
// subscription or an explicit "Refresh data" click, both of which write
// fresh data straight into this cache instead of waiting for the TTL.

const DB_NAME = "breadfast-dashboard-cache";
const DB_VERSION = 1;
const STORE_NAME = "pageRows";
const TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry {
  pageId: string;
  rows: DataRow[];
  cachedAt: number;
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

/** Returns a page's cached rows if present AND still under the 24h TTL,
 *  otherwise null (meaning: go fetch it from Supabase). */
export async function getCachedPageRows(pageId: string): Promise<DataRow[] | null> {
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
        resolve(entry.rows);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Writes (or overwrites) a page's cached rows with a fresh timestamp.
 *  Called after every successful Supabase fetch, every realtime-pushed
 *  update, and every manual "Refresh data" — so the cache is always
 *  write-through, never the thing standing between a person and data they
 *  just explicitly asked to see fresh. */
export async function setCachedPageRows(pageId: string, rows: DataRow[]): Promise<void> {
  const db = await openDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ pageId, rows, cachedAt: Date.now() } satisfies CacheEntry);
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
