export function backendUrl(configuredUrl, fallback = '') {
  const url = configuredUrl || fallback;
  if (import.meta.env.DEV && (!url || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url))) {
    return url ? new URL(url).pathname.replace(/\/$/, '') : '';
  }
  return url;
}
