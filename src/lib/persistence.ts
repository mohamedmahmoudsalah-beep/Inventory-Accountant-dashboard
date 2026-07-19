import type { Department } from "../types";

const STORAGE_KEY = "breadfast-dashboard-state-v1";

export interface PersistedState {
  departments: Department[];
  activeDeptId: string;
  activePageId: string;
  _writerId?: string;
}

export function loadPersistedState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedState;
  } catch {
    return null;
  }
}

export function savePersistedState(state: PersistedState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable (e.g. private browsing) - fail silently,
    // the app still works, it just won't persist across reloads.
  }
}
