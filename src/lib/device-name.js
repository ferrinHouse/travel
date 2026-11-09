// Human labels for devices, from a user-agent string. Used for default passkey
// names and the "signed-in devices" list.

export function guessDeviceName(userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent) {
  const ua = userAgent ?? '';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) return 'Android phone';
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/CrOS/.test(ua)) return 'Chromebook';
  if (/Linux/.test(ua)) return 'Linux computer';
  return 'Passkey';
}

function browserName(ua) {
  if (/Edg\//.test(ua)) return 'Edge';
  if (/Firefox\/|FxiOS/.test(ua)) return 'Firefox';
  if (/Chrome\/|CriOS/.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return null;
}

export function describeDevice(userAgent) {
  if (!userAgent) return 'Unknown device';
  const device = guessDeviceName(userAgent);
  const browser = browserName(userAgent);
  const place = device === 'Passkey' ? 'a computer' : device;
  return browser ? `${browser} on ${place}` : place;
}
