'use client';

// The page side of the service worker (public/sw.js): registering it, asking it
// to save or forget things, and the list of trips saved on this device.
import { parseSavedTrips, tripSaveRequest } from '@/lib/offline/state';

const SAVED_KEY = 'travel-offline-trips';
const USER_KEY = 'travel-offline-user';
const SAVED_EVENT = 'travel-offline-saved';

/** Offline support runs only in production builds (dev's hot reload and a worker don't mix). */
export const offlineSupported = () =>
  process.env.NODE_ENV === 'production' && typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'caches' in window;

/** Whether this is the offline page (shown in place of any page that wasn't saved). */
export const isOfflinePage = () => !!document.querySelector('[data-offline-page]');

export async function registerWorker() {
  if (!offlineSupported()) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  } catch (err) {
    console.warn('Offline support is unavailable:', err);
    return null;
  }
}

/** Sends `message` to the active worker and waits for its reply. */
async function askWorker(message, timeoutMs = 60_000) {
  if (!offlineSupported()) throw new Error('Offline saving isn’t available in this browser.');
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise((_, reject) => setTimeout(() => reject(new Error('The offline helper didn’t start.')), 10_000)),
  ]);
  const worker = registration.active;
  if (!worker) throw new Error('The offline helper isn’t running yet.');
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => reject(new Error('Saving took too long.')), timeoutMs);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    worker.postMessage(message, [channel.port2]);
  });
}

function readStorage(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Private browsing or storage turned off: offline saving just won't stick.
  }
}

export const savedTrips = () => parseSavedTrips(readStorage(SAVED_KEY));

/** For useSyncExternalStore: the raw saved-trips text (stable between changes). */
export const savedTripsSnapshot = () => readStorage(SAVED_KEY);
export function subscribeSavedTrips(callback) {
  window.addEventListener(SAVED_EVENT, callback);
  window.addEventListener('storage', callback);
  return () => {
    window.removeEventListener(SAVED_EVENT, callback);
    window.removeEventListener('storage', callback);
  };
}

function setSavedTrips(trips) {
  writeStorage(SAVED_KEY, Object.keys(trips).length ? JSON.stringify(trips) : null);
  window.dispatchEvent(new Event(SAVED_EVENT));
}

export const storedUserKey = () => readStorage(USER_KEY);
export const setStoredUserKey = (key) => writeStorage(USER_KEY, key);

/** Saves a trip's page for offline use. `trip` = { id, name, dates }. */
export async function saveTripOffline(trip) {
  const result = await askWorker({ type: 'save', ...tripSaveRequest(trip.id) });
  if (!result?.ok) throw new Error(result?.error || 'The trip couldn’t be saved. Are you online?');
  setSavedTrips({ ...savedTrips(), [trip.id]: { name: trip.name, dates: trip.dates ?? '', savedAt: Date.now() } });
  return result;
}

/**
 * The first page of a first visit loads before the worker runs, so nothing
 * saved it. Once the worker is up, save it (the worker ignores pages that
 * aren't kept offline, like account or sign-in pages).
 */
export async function saveFirstPage() {
  if (!offlineSupported() || navigator.serviceWorker.controller) return;
  try {
    await askWorker({ type: 'save', pages: [window.location.pathname] });
  } catch {
    // It will be saved on the next visit instead.
  }
}

/** Forgets this person's saved pages and saved-trip list. */
export async function forgetSavedPages() {
  setSavedTrips({});
  if (!offlineSupported()) return;
  try {
    await askWorker({ type: 'clear' }, 10_000);
  } catch {
    // No worker yet: fall back to deleting the caches from the page.
    const names = await caches.keys();
    await Promise.all(names.filter((n) => /^travel-(pages|photos)-/.test(n)).map((n) => caches.delete(n)));
  }
}
