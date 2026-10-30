/**
 * Endpoint inspector — makes the UI → backend contract visible.
 *
 * Two jobs:
 *   1. Any element carrying `data-endpoint="<id>"` gets a visible badge showing the
 *      method and path it talks to, so a button's backend route is readable from
 *      the page itself rather than only from the source.
 *   2. A panel lists every endpoint the engine exposes and logs calls live
 *      (status + latency) as they happen.
 *
 * Toggle the panel with the `~` key, or the button bottom-right. It is inert until
 * opened and never interferes with the 3D experience.
 */

import { ENDPOINT_LIST, ENDPOINTS } from './endpoints.js';
import { PhantomAPI } from './client.js';

const PANEL_ID = 'phantom-endpoint-inspector';
const MAX_LOG = 40;

const styles = `
#${PANEL_ID} {
  position: fixed; right: 16px; bottom: 16px; z-index: 99999;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; line-height: 1.5; color: #e8ecf4;
}
#${PANEL_ID} .insp-toggle {
  display: flex; align-items: center; gap: 7px; margin-left: auto;
  padding: 7px 12px; border-radius: 999px; cursor: pointer;
  background: rgba(10,12,16,.82); border: 1px solid rgba(255,255,255,.14);
  backdrop-filter: blur(12px); color: #e8ecf4; letter-spacing: .04em;
}
#${PANEL_ID} .insp-toggle:hover { border-color: rgba(255,255,255,.3); }
#${PANEL_ID} .insp-dot {
  width: 7px; height: 7px; border-radius: 50%; background: #566; flex: none;
}
#${PANEL_ID} .insp-dot[data-up="true"]  { background: #3ddc97; box-shadow: 0 0 8px #3ddc97aa; }
#${PANEL_ID} .insp-dot[data-up="false"] { background: #ff5c5c; box-shadow: 0 0 8px #ff5c5caa; }
#${PANEL_ID} .insp-panel {
  display: none; width: min(460px, calc(100vw - 32px)); margin-top: 10px;
  max-height: min(60vh, 520px); overflow: auto;
  background: rgba(8,10,14,.93); border: 1px solid rgba(255,255,255,.14);
  border-radius: 12px; padding: 14px; backdrop-filter: blur(16px);
}
#${PANEL_ID}[data-open="true"] .insp-panel { display: block; }
#${PANEL_ID} h4 {
  margin: 0 0 4px; font-size: 10px; letter-spacing: .14em; text-transform: uppercase;
  color: #8b94a7; font-weight: 500;
}
#${PANEL_ID} .insp-hint { color: #6f7889; margin: 0 0 12px; font-size: 10px; }
#${PANEL_ID} .insp-row {
  display: grid; grid-template-columns: 34px 1fr auto; gap: 8px;
  padding: 6px 0; border-top: 1px solid rgba(255,255,255,.07); align-items: baseline;
}
#${PANEL_ID} .insp-m { color: #7ee0b8; }
#${PANEL_ID} .insp-p { color: #cfd6e4; word-break: break-all; }
#${PANEL_ID} .insp-d { color: #6f7889; font-size: 10px; display: block; margin-top: 2px; }
#${PANEL_ID} .insp-s { font-variant-numeric: tabular-nums; }
#${PANEL_ID} .insp-s[data-ok="true"]  { color: #3ddc97; }
#${PANEL_ID} .insp-s[data-ok="false"] { color: #ff7a7a; }
#${PANEL_ID} .insp-empty { color: #6f7889; padding: 8px 0; }
.phantom-endpoint-badge {
  display: inline-block; margin-left: 6px; padding: 1px 6px; border-radius: 4px;
  font-family: 'JetBrains Mono', ui-monospace, monospace; font-size: 9px;
  letter-spacing: .03em; white-space: nowrap; vertical-align: middle;
  background: rgba(125,224,184,.12); border: 1px solid rgba(125,224,184,.3);
  color: #7ee0b8; pointer-events: none;
}
`;

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  return node;
}

function buildPanel() {
  const sheet = el('style');
  sheet.textContent = styles;
  document.head.appendChild(sheet);

  const root = el('div');
  root.id = PANEL_ID;
  root.dataset.open = 'false';

  const toggle = el('button', 'insp-toggle');
  const dot = el('span', 'insp-dot');
  toggle.append(dot, el('span', null, 'endpoints'));
  toggle.addEventListener('click', () => {
    root.dataset.open = root.dataset.open === 'true' ? 'false' : 'true';
  });

  const panel = el('div', 'insp-panel');

  panel.appendChild(el('h4', null, 'Engine endpoints'));
  panel.appendChild(
    el('p', 'insp-hint', 'Read-only. Commits happen in-process, never over HTTP.')
  );
  for (const e of ENDPOINT_LIST) {
    const row = el('div', 'insp-row');
    row.append(el('span', 'insp-m', e.method), (() => {
      const wrap = el('span');
      wrap.appendChild(el('span', 'insp-p', e.path));
      wrap.appendChild(el('span', 'insp-d', e.describes));
      return wrap;
    })(), el('span'));
    panel.appendChild(row);
  }

  panel.appendChild(el('h4', null, 'Live calls'));
  const log = el('div');
  log.appendChild(el('div', 'insp-empty', 'No calls yet — interact with the UI.'));
  panel.appendChild(log);

  root.append(toggle, panel);
  document.body.appendChild(root);
  return { root, dot, log };
}

/** Label any element that declares `data-endpoint` with the route it calls. */
function badgeDeclaredElements() {
  for (const node of document.querySelectorAll('[data-endpoint]')) {
    const endpoint = ENDPOINTS[node.dataset.endpoint];
    if (!endpoint || node.querySelector('.phantom-endpoint-badge')) continue;
    const badge = el('span', 'phantom-endpoint-badge', `${endpoint.method} ${endpoint.path}`);
    badge.title = endpoint.describes;
    node.appendChild(badge);
    if (!node.title) node.title = `${endpoint.method} ${endpoint.path} — ${endpoint.describes}`;
  }
}

export function initInspector() {
  if (document.getElementById(PANEL_ID)) return;
  const { root, dot, log } = buildPanel();

  window.addEventListener('phantom:api', (event) => {
    const { method, url, status, ms, ok } = event.detail;
    if (log.firstChild?.classList?.contains('insp-empty')) log.firstChild.remove();

    const row = el('div', 'insp-row');
    const code = status === 0 ? 'ERR' : String(status);
    row.append(
      el('span', 'insp-m', method),
      el('span', 'insp-p', url),
      (() => {
        const s = el('span', 'insp-s', `${code} · ${ms}ms`);
        s.dataset.ok = String(Boolean(ok));
        return s;
      })()
    );
    log.prepend(row);
    while (log.childElementCount > MAX_LOG) log.lastElementChild.remove();

    // Any successful answer proves the engine is reachable.
    if (ok) dot.dataset.up = 'true';
    else if (status === 0) dot.dataset.up = 'false';
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === '~' || (e.key === '`' && e.shiftKey)) {
      root.dataset.open = root.dataset.open === 'true' ? 'false' : 'true';
    }
  });

  badgeDeclaredElements();
  new MutationObserver(badgeDeclaredElements).observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Probe once so the status dot is meaningful before any interaction.
  PhantomAPI.isEngineUp().then((up) => {
    dot.dataset.up = String(up);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initInspector);
} else {
  initInspector();
}

export default initInspector;
