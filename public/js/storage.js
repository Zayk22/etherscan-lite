// localStorage helpers. Every call is wrapped in try/catch because:
//   1. Private browsing (Safari) throws on localStorage access.
//   2. Quota-exceeded errors happen.
// Failing to save the theme is not worth crashing the app over.

const THEME_KEY = 'theme';

export function getSavedTheme() {
  try {
    const value = localStorage.getItem(THEME_KEY);
    return value === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore — the toggle still works for this session.
  }
}