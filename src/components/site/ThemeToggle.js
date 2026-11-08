'use client';

import { useSyncExternalStore } from 'react';
import { THEME_STORAGE_KEY, parseThemePreference, resolveTheme } from '@/lib/theme';
import styles from './site.module.css';

const OPTIONS = [
  { value: 'system', label: 'System', icon: '💻' },
  { value: 'light', label: 'Light', icon: '☀️' },
  { value: 'dark', label: 'Dark', icon: '🌙' },
];

const CHANGE_EVENT = 'travel-theme-change';
const DARK_QUERY = '(prefers-color-scheme: dark)';

function apply(pref) {
  const root = document.documentElement;
  const theme = resolveTheme(pref, window.matchMedia(DARK_QUERY).matches);
  root.dataset.themePref = pref;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// <html data-theme-pref> (set by the inline head script) is the source of truth.
function subscribe(onChange) {
  const media = window.matchMedia(DARK_QUERY);
  const onSystemChange = () => {
    if (parseThemePreference(document.documentElement.dataset.themePref) === 'system') apply('system');
  };
  const onStorage = (e) => {
    if (e.key === THEME_STORAGE_KEY) apply(parseThemePreference(e.newValue));
  };
  media.addEventListener('change', onSystemChange);
  window.addEventListener('storage', onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    media.removeEventListener('change', onSystemChange);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

const getSnapshot = () => parseThemePreference(document.documentElement.dataset.themePref);
const getServerSnapshot = () => 'system';

export default function ThemeToggle() {
  const pref = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const choose = (value) => {
    try {
      if (value === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch {
      // Storage blocked (private mode): the choice still applies to this page.
    }
    apply(value);
  };

  return (
    <fieldset className={styles.themeToggle}>
      <legend className="visually-hidden">Theme</legend>
      {OPTIONS.map((opt) => (
        <label key={opt.value} className={styles.themeOption} title={opt.label}>
          <input
            type="radio"
            name="theme"
            value={opt.value}
            checked={pref === opt.value}
            onChange={() => choose(opt.value)}
            className={styles.themeInput}
          />
          <span aria-hidden="true">{opt.icon}</span>
          <span className="visually-hidden">{opt.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
