import { create } from "zustand";
import { RefreshInterval } from "@/lib/types";
import { isValidCollectionSlug } from "@/lib/utils";

interface ScannerState {
  collections: string[];
  threshold: number;
  refreshInterval: RefreshInterval;
  autoRefresh: boolean;

  hydratePrefs: () => void;
  setCollections: (cols: string[]) => void;
  addCollection: (slug: string) => boolean;
  removeCollection: (slug: string) => void;
  setThreshold: (t: number) => void;
  setRefreshInterval: (i: RefreshInterval) => void;
  setAutoRefresh: (v: boolean) => void;
}

interface PersistedPrefs {
  collections?: string[];
  threshold?: number;
  refreshInterval?: RefreshInterval;
  autoRefresh?: boolean;
}

const PREFS_KEY = "opensea_scanner_prefs";

function loadPrefs(): PersistedPrefs {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePrefs(prefs: PersistedPrefs) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore quota errors
  }
}

function persistFromState(state: ScannerState) {
  savePrefs({
    collections: state.collections,
    threshold: state.threshold,
    refreshInterval: state.refreshInterval,
    autoRefresh: state.autoRefresh,
  });
}

export const useScannerStore = create<ScannerState>((set, get) => ({
  collections: [],
  threshold: 0.9,
  refreshInterval: "60s",
  autoRefresh: false,

  hydratePrefs: () => {
    const saved = loadPrefs();
    set({
      collections: (saved.collections || []).filter((s) =>
        isValidCollectionSlug(s)
      ),
      threshold:
        typeof saved.threshold === "number"
          ? Math.max(0.7, Math.min(1, saved.threshold))
          : 0.9,
      refreshInterval: saved.refreshInterval || "60s",
      autoRefresh: saved.autoRefresh ?? false,
    });
  },

  setCollections: (cols) => {
    const cleaned = cols.filter((s) => isValidCollectionSlug(s));
    set({ collections: cleaned });
    persistFromState({ ...get(), collections: cleaned });
  },

  addCollection: (slug) => {
    const cleaned = slug.trim().toLowerCase();
    if (!isValidCollectionSlug(cleaned)) return false;
    const current = get().collections;
    if (current.includes(cleaned)) return true;
    const next = [...current, cleaned];
    set({ collections: next });
    persistFromState({ ...get(), collections: next });
    return true;
  },

  removeCollection: (slug) => {
    const next = get().collections.filter((c) => c !== slug);
    set({ collections: next });
    persistFromState({ ...get(), collections: next });
  },

  setThreshold: (t) => {
    const clamped = Math.max(0.7, Math.min(1, t));
    set({ threshold: clamped });
    persistFromState({ ...get(), threshold: clamped });
  },

  setRefreshInterval: (i) => {
    const autoRefresh = i === "manual" ? false : get().autoRefresh;
    set({ refreshInterval: i, autoRefresh });
    persistFromState({ ...get(), refreshInterval: i, autoRefresh });
  },

  setAutoRefresh: (v) => {
    const enabled = v && get().refreshInterval !== "manual";
    set({ autoRefresh: enabled });
    persistFromState({ ...get(), autoRefresh: enabled });
  },
}));