import { createContext, useContext, useEffect, useState, useCallback } from 'react';

// Favourites live in localStorage so they work for everyone, no sign-up — in
// keeping with the app's "gratis y sin registro" promise. Same storage pattern
// as ThemeContext.
const STORAGE_KEY = 'randomtrip:saved';
const SavedContext = createContext(null);

// Stable identity for a saved item. Restaurants prefer their Google placeId;
// everything else falls back to name + coordinates.
export function savedKey(item) {
  if (item.placeId) return `r:${item.placeId}`;
  const prefix = item.kind === 'restaurant' ? 'r' : 'p';
  return `${prefix}:${item.name}|${item.lat}|${item.lng}`;
}

function loadSaved() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch (_) {
    return [];
  }
}

export function SavedProvider({ children }) {
  const [saved, setSaved] = useState(loadSaved);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch (_) { /* quota / private mode — ignore */ }
  }, [saved]);

  const isSaved = useCallback((key) => saved.some((s) => s.key === key), [saved]);

  const toggleSaved = useCallback((item) => {
    const key = item.key || savedKey(item);
    setSaved((prev) =>
      prev.some((s) => s.key === key)
        ? prev.filter((s) => s.key !== key)
        : [{ ...item, key, savedAt: Date.now() }, ...prev]
    );
  }, []);

  const removeSaved = useCallback((key) => {
    setSaved((prev) => prev.filter((s) => s.key !== key));
  }, []);

  return (
    <SavedContext.Provider value={{ saved, isSaved, toggleSaved, removeSaved }}>
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used within SavedProvider');
  return ctx;
}
