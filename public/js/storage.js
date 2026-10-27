const THEME_KEY = 'theme';
const RECENT_KEY = 'recentSearches';
const MAX_RECENT = 5;

export function getSavedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'dark' ? 'dark' : 'light';
  } catch { return 'light'; }
}

export function saveTheme(theme) {
  try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
}

export function getRecentSearches() {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const list = JSON.parse(raw || '[]');
    return Array.isArray(list) ? list.filter(s => typeof s === 'string') : [];
  } catch { return []; }
}

export function addRecentSearch(query) {
  const clean = query.toLowerCase().trim();
  let list = getRecentSearches().filter((a) => a !== clean);
  list.unshift(clean);
  list = list.slice(0, MAX_RECENT);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list)); } catch { /* ignore */ }
  return list;
}

export function clearRecentSearches() {
  try { localStorage.removeItem(RECENT_KEY); } catch { /* ignore */ }
}