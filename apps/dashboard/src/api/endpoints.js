/**
 * Phantom backend endpoints — single source of truth for the UI.
 *
 * Mirrors the read-only serving surface in apps/engine/api.py. Nothing here may
 * invent a route: if an entry does not exist in the engine, it does not belong in
 * this file. The engine is read-only by design — commits happen in-process via the
 * perception loop, never over HTTP — so every endpoint below is a GET.
 *
 * Each entry carries a `label` and `describes` so the UI can show a human which
 * endpoint an action talks to (see inspector.js), rather than hiding the contract
 * inside call sites.
 */

export const API_BASE = '/api';

/** @typedef {{ id:string, method:string, path:string, label:string, describes:string, build:(...a:any)=>string }} Endpoint */

/** @type {Record<string, Endpoint>} */
export const ENDPOINTS = {
  health: {
    id: 'health',
    method: 'GET',
    path: '/api/health',
    label: 'Engine health',
    describes: 'Is the Phantom engine process up?',
    build: () => `${API_BASE}/health`,
  },

  objects: {
    id: 'objects',
    method: 'GET',
    path: '/api/objects',
    label: 'All remembered objects',
    describes: 'Every object currently in spatial memory, with status and bbox.',
    build: () => `${API_BASE}/objects`,
  },

  query: {
    id: 'query',
    method: 'GET',
    path: '/api/query?q={text}',
    label: 'Ask where something is',
    describes: 'Ranked matches for a natural-language query (exact → alias → fuzzy).',
    build: (text) => `${API_BASE}/query?q=${encodeURIComponent(text)}`,
  },

  history: {
    id: 'history',
    method: 'GET',
    path: '/api/objects/{key}/history',
    label: 'Movement lineage',
    describes: 'Every recorded location for one object, oldest first.',
    build: (key) => `${API_BASE}/objects/${encodeURIComponent(key)}/history`,
  },

  reveal: {
    id: 'reveal',
    method: 'GET',
    path: '/api/reveal/{key}',
    label: 'Reveal payload',
    describes: 'frame_ref + bbox + trust card (timestamp and confidence) for one object.',
    build: (key) => `${API_BASE}/reveal/${encodeURIComponent(key)}`,
  },

  frame: {
    id: 'frame',
    method: 'GET',
    path: '/api/frame/{frame_ref}',
    label: 'Last-seen frame',
    describes:
      'The PNG behind a transient frame_ref. Served from the engine RAM buffer, so it ' +
      'only resolves while the perception loop is running and within the retention window.',
    build: (frameRef) => `${API_BASE}/frame/${encodeURIComponent(frameRef)}`,
  },
};

/** Stable list for docs/inspector rendering. */
export const ENDPOINT_LIST = Object.values(ENDPOINTS);
