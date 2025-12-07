// Central configuration for the frontend application.
// Edit BASE_URL here to change the API host used by `services/Services.ts`.
// If you later prefer runtime configuration, replace this with a fetch of /config.json
// from the `public/` folder or inject values into `window` from index.html.

export const BASE_URL = 'www.first-systems.com'//'localhost';
//export const BASE_URL = 'www.first-systems.com';
export const DEFAULT_API_PORT = '909';

// Type for globalThis with our custom properties
interface GlobalThisWithOverrides {
  __BASE_URL_OVERRIDE?: string;
  __BASE_PORT_OVERRIDE?: string;
  __PROTOCOL_OVERRIDE?: string;
}

// optional setter for runtime changes (useful in tests)
export function setBaseUrl(v: string) {
  (globalThis as GlobalThisWithOverrides).__BASE_URL_OVERRIDE = v;
}

export function getBaseUrl(): string {
  return (globalThis as GlobalThisWithOverrides).__BASE_URL_OVERRIDE ?? BASE_URL;
}

export function setApiPort(v: string) {
  (globalThis as GlobalThisWithOverrides).__BASE_PORT_OVERRIDE = v;
}

export function getApiPort(): string {
  return (globalThis as GlobalThisWithOverrides).__BASE_PORT_OVERRIDE ?? DEFAULT_API_PORT;
}

export function getApiBase(): string {
  const base = getBaseUrl();
  // if base already contains a port (simple check for :digits at end) don't append
  if (/:[0-9]+$/.test(base)) return base;
  const port = getApiPort();
  return `${base}:${port}`;
}

// Protocol getter/setter functions
export function setProtocol(v: string) {
  (globalThis as GlobalThisWithOverrides).__PROTOCOL_OVERRIDE = v;
}

export function getProtocol(): string {
  const override = (globalThis as GlobalThisWithOverrides).__PROTOCOL_OVERRIDE;
  if (override) return override;
  
  // Default to window.location.protocol if available (removes trailing colon)
  if (typeof window !== 'undefined' && window.location) {
    return window.location.protocol.replace(':', '');
  }
  
  // Fallback to http
  return 'http';
}

// Load runtime config from /config.json (placed in the `public/` folder of the built app).
// This fetch happens at runtime (in the browser) and allows changing the API host
// without rebuilding the app. Example `public/config.json`:
// { "BASE_URL": "api.example.com" }
interface RuntimeConfig {
  BASE_URL?: string;
  PORT?: string | number;
  API_PORT?: string | number;
  BASE_API_PORT?: string | number;
  BASE_PORT?: string | number;
  base_api_port?: string | number;
  port?: string | number;
  PROTOCOL?: string;
  protocol?: string;
  [key: string]: unknown;
}

export async function loadRuntimeConfig(): Promise<void> {
  try {
    // Use Vite base URL so it works under /shorttrips in dev and build
    // Vite's import.meta.env is typed, but we need to handle it safely
    const viteEnv = (import.meta as { env?: { BASE_URL?: string } }).env;
    const baseUrl = viteEnv?.BASE_URL || '/';
    const resp = await fetch(`${baseUrl}config.json`, { cache: 'no-cache' });
    if (!resp.ok) return;
    const cfg = await resp.json() as RuntimeConfig;
    if (cfg && typeof cfg.BASE_URL === 'string' && cfg.BASE_URL.trim() !== '') {
      (globalThis as GlobalThisWithOverrides).__BASE_URL_OVERRIDE = cfg.BASE_URL.trim();
    }
    // Accept multiple possible keys for backward-compatibility / different naming
    const possiblePortKeys: Array<keyof RuntimeConfig> = ['PORT', 'API_PORT', 'BASE_API_PORT', 'BASE_PORT', 'base_api_port', 'port'];
    for (const k of possiblePortKeys) {
      if (Object.prototype.hasOwnProperty.call(cfg, k)) {
        const raw = cfg[k];
        if (raw !== null && raw !== undefined) {
          const portStr = String(raw).trim();
          if (portStr !== '') {
            (globalThis as GlobalThisWithOverrides).__BASE_PORT_OVERRIDE = portStr;
            console.info('[config] runtime PORT override set to', portStr, `from key ${k}`);
            break;
          }
        }
      }
    }
    
    // Support PROTOCOL from config.json
    const possibleProtocolKeys: Array<keyof RuntimeConfig> = ['PROTOCOL', 'protocol'];
    for (const k of possibleProtocolKeys) {
      if (Object.prototype.hasOwnProperty.call(cfg, k)) {
        const raw = cfg[k];
        if (raw !== null && raw !== undefined) {
          const protocolStr = String(raw).trim().toLowerCase();
          if (protocolStr === 'http' || protocolStr === 'https') {
            setProtocol(protocolStr);
            console.info('[config] runtime PROTOCOL override set to', protocolStr, `from key ${k}`);
            break;
          }
        }
      }
    }
  } catch {
    // ignore errors; runtime config is optional
    // console.debug('No runtime config loaded');
  }
}
