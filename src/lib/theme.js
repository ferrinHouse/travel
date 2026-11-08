// Light/dark theme preference. The inline script runs in <head> before the
// first paint so a saved choice never flashes the wrong theme.

export const THEME_STORAGE_KEY = 'travel-theme';
export const THEME_PREFS = ['system', 'light', 'dark'];

/** Browser chrome colour per theme; matches --bg in src/styles/tokens.css. */
export const THEME_COLORS = { light: '#f4f6f8', dark: '#0d1117' };

export function parseThemePreference(value) {
  return THEME_PREFS.includes(value) ? value : 'system';
}

export function resolveTheme(pref, systemPrefersDark) {
  if (pref === 'light' || pref === 'dark') return pref;
  return systemPrefersDark ? 'dark' : 'light';
}

/** Sets data-theme (resolved), data-theme-pref and color-scheme on <html>. */
export const themeInitScript =
  `(function(){var r=document.documentElement,p='system',d=false;` +
  `try{var s=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(s==='light'||s==='dark')p=s;` +
  `d=p==='dark'||(p==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){}` +
  `var t=d?'dark':'light';r.dataset.theme=t;r.dataset.themePref=p;r.style.colorScheme=t})()`;
