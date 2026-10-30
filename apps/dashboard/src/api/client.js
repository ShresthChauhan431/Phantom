/**
 * Phantom API client.
 *
 * The only place the UI talks to the engine. Every call goes through `request()`,
 * which announces itself on `window` as a `phantom:api` event — that is what lets
 * the inspector show, live, which endpoint a click hit and what came back.
 *
 * Calls are same-origin (`/api/...`) and the dev server proxies them to the engine,
 * so the browser never makes a cross-origin request and the engine needs no CORS
 * configuration.
 */

import { ENDPOINTS } from './endpoints.js';

/** Dispatch a call record so the inspector (or anything else) can observe it. */
function announce(detail) {
  window.dispatchEvent(new CustomEvent('phantom:api', { detail }));
}

/**
 * Perform one endpoint call.
 * @param {string} id   key in ENDPOINTS
 * @param {...any} args arguments for that endpoint's build()
 */
async function request(id, ...args) {
  const endpoint = ENDPOINTS[id];
  if (!endpoint) throw new Error(`unknown endpoint: ${id}`);

  const url = endpoint.build(...args);
  const started = performance.now();
  const record = { id, method: endpoint.method, url, label: endpoint.label };

  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' } });
    const ms = Math.round(performance.now() - started);

    if (!response.ok) {
      // 404 is routine here (unknown object, or a frame already evicted from the
      // RAM buffer), so surface it as data rather than throwing.
      announce({ ...record, status: response.status, ms, ok: false });
      return { ok: false, status: response.status, data: null, url };
    }

    const type = response.headers.get('content-type') || '';
    const data = type.includes('application/json')
      ? await response.json()
      : await response.blob();

    announce({ ...record, status: response.status, ms, ok: true });
    return { ok: true, status: response.status, data, url };
  } catch (error) {
    const ms = Math.round(performance.now() - started);
    // Almost always "engine not running" — report it as such instead of a bare
    // network error, since that is the actual cause the user can act on.
    announce({ ...record, status: 0, ms, ok: false, error: String(error) });
    return { ok: false, status: 0, data: null, url, error: String(error) };
  }
}

export const PhantomAPI = {
  endpoints: ENDPOINTS,
  request,

  health: () => request('health'),
  objects: () => request('objects'),
  query: (text) => request('query', text),
  history: (key) => request('history', key),
  reveal: (key) => request('reveal', key),

  /** URL for an <img src>; the browser fetches this one directly. */
  frameUrl: (frameRef) => ENDPOINTS.frame.build(frameRef),

  /** True when the engine answers /api/health. */
  async isEngineUp() {
    const { ok } = await request('health');
    return ok;
  },
};

// Expose for the non-module scripts that make up most of this UI.
window.PhantomAPI = PhantomAPI;

export default PhantomAPI;
