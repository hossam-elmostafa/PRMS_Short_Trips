// Central configuration for the frontend application.
// Edit BASE_URL here to change the API host used by `services/Services.ts`.
// If you later prefer runtime configuration, replace this with a fetch of /config.json
// from the `public/` folder or inject values into `window` from index.html.

export const BASE_URL = 'localhost';
//export const BASE_URL = 'www.first-systems.com';
export const DEFAULT_API_PORT = '9090';

// optional setter for runtime changes (useful in tests)
export function setBaseUrl(v: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__BASE_URL_OVERRIDE = v;
}

export function getBaseUrl(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__BASE_URL_OVERRIDE ?? BASE_URL;
}

export function setApiPort(v: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__BASE_PORT_OVERRIDE = v;
}

export function getApiPort(): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__BASE_PORT_OVERRIDE ?? DEFAULT_API_PORT;
}

export function getApiBase(): string {
  const base = getBaseUrl();
  // if base already contains a port (simple check for :digits at end) don't append
  if (/:[0-9]+$/.test(base)) return base;
  const port = getApiPort();
  return `${base}:${port}`;
}

// Load runtime config from /config.json (placed in the `public/` folder of the built app).
// This fetch happens at runtime (in the browser) and allows changing the API host
// without rebuilding the app. Example `public/config.json`:
// { "BASE_URL": "api.example.com" }
export async function loadRuntimeConfig(): Promise<void> {
  try {
    const resp = await fetch('/config.json', { cache: 'no-cache' });
    if (!resp.ok) return;
    const cfg = await resp.json();
    if (cfg && typeof cfg.BASE_URL === 'string' && cfg.BASE_URL.trim() !== '') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).__BASE_URL_OVERRIDE = cfg.BASE_URL.trim();
    }
    // Accept multiple possible keys for backward-compatibility / different naming
    const possiblePortKeys = ['PORT', 'API_PORT', 'BASE_API_PORT', 'BASE_PORT', 'base_api_port', 'port'];
    for (const k of possiblePortKeys) {
      if (Object.prototype.hasOwnProperty.call(cfg, k)) {
        const raw = (cfg as any)[k];
        if (raw !== null && raw !== undefined) {
          const portStr = String(raw).trim();
          if (portStr !== '') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globalThis as any).__BASE_PORT_OVERRIDE = portStr;
            // eslint-disable-next-line no-console
            console.info('[config] runtime PORT override set to', portStr, `from key ${k}`);
            break;
          }
        }
      }
    }
  } catch (err) {
    // ignore errors; runtime config is optional
    // console.debug('No runtime config loaded', err);
  }
}
