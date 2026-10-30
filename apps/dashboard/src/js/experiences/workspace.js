/**
 * ==============================================================================
 * PHANTOM WORKSPACE — LIVE CONTROLLER
 *
 * Renders only what the running engine reports, through PhantomBackendEngine:
 * the phone's live preview, engine telemetry, the objects the VLM has described,
 * the trigger log (last five minutes), search, and screenshots with bounding
 * boxes. There is no seed data, no in-browser model and no placeholder content;
 * where the engine has reported nothing yet, the page says so.
 *
 * All engine-provided text (object names, locations, relations, device labels,
 * errors) is model or system output and is escaped before it reaches the DOM.
 * ==============================================================================
 */
(function () {
  'use strict';

  let engine = null;
  let activeTab = 'overview';
  let activeCategoryFilter = 'all';
  let activeEventFilter = 'all';
  let historyFilter = '';
  let showBoundingBoxes = true;
  let selectedDeviceId = null;
  let objectsSignature = '';

  const dom = {};

  // ------------------------------------------------------------------ helpers
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ESC[c]);
  }

  function pct(confidence) {
    return `${Math.round((Number(confidence) || 0) * 100)}%`;
  }

  function timeAgo(iso) {
    if (!iso) return '—';
    const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (sec < 5) return 'just now';
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ${sec % 60}s ago`;
    const hr = Math.floor(min / 60);
    return `${hr}h ${min % 60}m ago`;
  }

  function clock(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function empty(html) {
    return `<div class="ws-empty">${html}</div>`;
  }

  const KIND_LABEL = { startup_scan: 'startup scan', scan: 'scene re-scan', change: 'change' };
  const EVENT_LABEL = { unchanged: 're-seen' };

  function eventChip(event) {
    const e = esc(event);
    return `<span class="event-type-chip ${e}">${esc(EVENT_LABEL[event] || event)}</span>`;
  }

  function relationsHtml(relations) {
    if (!relations || !relations.length) return '';
    return `<div class="ws-relations">${relations
      .map((r) => `<span class="ws-relation">${esc(r)}</span>`)
      .join('')}</div>`;
  }

  /** Screenshot with the VLM's bounding box over it; filled in by hydrateShots(). */
  function shotHtml(frameRef, bbox, label) {
    if (!frameRef) return `<div class="ws-noshot">NO SCREENSHOT RECORDED</div>`;
    const box = bbox
      ? `<div class="ws-box" style="left:${bbox.x * 100}%;top:${bbox.y * 100}%;width:${bbox.w * 100}%;height:${bbox.h * 100}%"><span class="ws-box-label">${esc(label || '')}</span></div>`
      : '';
    return `<div class="ws-shot" data-frame-ref="${esc(frameRef)}"><img alt="${esc(label || 'screenshot')}" hidden/>${box}</div>`;
  }

  /** Resolve screenshot placeholders to engine frames (cached blob URLs). */
  async function hydrateShots(container) {
    if (!container) return;
    const shots = container.querySelectorAll('[data-frame-ref]');
    await Promise.all(
      [...shots].map(async (node) => {
        const url = await engine.frameDataUrl(node.dataset.frameRef);
        if (url) {
          const img = node.querySelector('img');
          if (img) {
            img.src = url;
            img.hidden = false;
          } else if (node.tagName === 'IMG') {
            node.src = url;
          }
        } else if (node.classList.contains('ws-shot')) {
          node.outerHTML =
            '<div class="ws-noshot">SCREENSHOT NO LONGER IN ENGINE MEMORY</div>';
        } else if (node.tagName === 'IMG') {
          node.remove();
        }
      })
    );
  }

  function toast(html) {
    const node = document.createElement('div');
    node.className = 'ws-toast';
    node.innerHTML = html;
    document.body.appendChild(node);
    setTimeout(() => node.remove(), 4500);
  }

  // ---------------------------------------------------------------------- dom
  function cacheDom() {
    const ids = [
      'cameraVideo', 'overlayCanvas', 'viewfinderPlaceholder', 'btnStartMonitoring',
      'btnStartMonitoringLabel', 'btnHeaderAction', 'hudDot', 'hudText', 'hudPill',
      'engineSourceBadge', 'cameraSourceSelect', 'resolutionSelect', 'btnSyncNow',
      'btnToggleBoxes', 'cameraResolutionHud', 'overviewCameraStatusText',
      'motionMeterFill', 'motionMeterText', 'engineStatusDetail', 'runtimeModelBadge',
      'monitorSubtitle', 'sceneSummary', 'pipelineChips', 'deskSnapshotList',
      'recentEventsOverview', 'statsRecentChangesBadge', 'activeDetectionsList',
      'activeDetectionsCount', 'engineTelemetryList', 'objectsRegistryRows',
      'objectsRegistryCount', 'timelineList', 'historyFilterInput', 'historyWindowNote',
      'searchInput', 'btnSearch', 'quickSearchInput', 'btnQuickSearchTrigger',
      'searchResultContainer', 'searchSuggestions', 'engineConfigRows', 'vlmDataFlow',
      'vlmDataFlowBadge', 'memoryFactBadge', 'btnPurgeFrames', 'drawerBackdrop',
      'drawerCloseBtn', 'drawerTitle', 'drawerSubtitle', 'drawerCategory', 'drawerBody',
    ];
    for (const id of ids) dom[id] = document.getElementById(id);
    dom.video = dom.cameraVideo;
    dom.tabButtons = document.querySelectorAll('.tab-btn');
    dom.views = document.querySelectorAll('.workspace-view');
  }

  // --------------------------------------------------------------------- boot
  async function init() {
    cacheDom();
    if (!window.PhantomBackendEngine) {
      setStatusLine('Live engine client failed to load (backend-engine.js).', 'error');
      return;
    }

    engine = new window.PhantomBackendEngine({ videoElement: dom.video });
    window.PhantomActiveEngine = engine;

    engine.on('engine', ({ reachable, notJson }) => onReachability(reachable, notJson));
    engine.on('telemetry', renderTelemetry);
    engine.on('objects', onObjects);
    engine.on('triggers', onTriggers);
    engine.on('session', () => {
      objectsSignature = '';
      toast('Engine restarted — showing the new session');
    });
    engine.on('statusChange', ({ status, detail }) => onPreviewStatus(status, detail));
    engine.on('devicesDiscovered', populateCameraSelect);

    bindEvents();
    renderAllEmpty();
    await engine.init();
    renderHistory();
    renderOverviewTriggers();
    startOverlayLoop();
    // Relative times ("12s ago") and the 5-minute window need a steady refresh.
    setInterval(() => {
      renderOverviewTriggers();
      renderHistory();
      renderOverviewObjects();
    }, 5000);
  }

  function renderAllEmpty() {
    const waiting = empty('Waiting for the engine…');
    for (const el of [dom.deskSnapshotList, dom.recentEventsOverview, dom.activeDetectionsList,
      dom.engineTelemetryList, dom.objectsRegistryRows, dom.timelineList, dom.engineConfigRows]) {
      if (el) el.innerHTML = waiting;
    }
    renderSuggestions();
  }

  // ------------------------------------------------------------------- events
  function bindEvents() {
    dom.tabButtons.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    dom.btnLaunchMonitorQuick = document.getElementById('btnLaunchMonitorQuick');
    dom.btnLaunchMonitorQuick?.addEventListener('click', () => switchTab('monitor'));

    const togglePreview = async () => {
      if (engine.isMonitoring) {
        engine.stopMonitoring();
      } else {
        switchTab('monitor');
        await engine.startMonitoring(selectedDeviceId);
      }
    };
    dom.btnStartMonitoring?.addEventListener('click', togglePreview);
    dom.btnHeaderAction?.addEventListener('click', togglePreview);

    dom.cameraSourceSelect?.addEventListener('change', async (e) => {
      selectedDeviceId = e.target.value || null;
      if (engine.isMonitoring) {
        engine.stopMonitoring();
        await engine.startMonitoring(selectedDeviceId);
      }
    });

    dom.resolutionSelect?.addEventListener('change', (e) => {
      const [w, h] = e.target.value.split('x').map(Number);
      engine.setPreviewResolution(w, h);
    });

    dom.btnSyncNow?.addEventListener('click', async () => {
      dom.btnSyncNow.disabled = true;
      await engine.sync({ forceObjects: true });
      dom.btnSyncNow.disabled = false;
    });

    dom.btnToggleBoxes?.addEventListener('click', () => {
      showBoundingBoxes = !showBoundingBoxes;
      dom.btnToggleBoxes.classList.toggle('is-active', showBoundingBoxes);
    });

    document.querySelectorAll('.filter-chip[data-category]').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip[data-category]').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeCategoryFilter = chip.dataset.category;
        renderObjectsRegistry();
      });
    });

    document.querySelectorAll('.filter-chip[data-event]').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip[data-event]').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeEventFilter = chip.dataset.event;
        renderHistory();
      });
    });

    dom.historyFilterInput?.addEventListener('input', (e) => {
      historyFilter = e.target.value.trim().toLowerCase();
      renderHistory();
    });

    const runSearch = (q) => {
      if (q && q.trim()) executeSearch(q.trim());
    };
    dom.btnSearch?.addEventListener('click', () => runSearch(dom.searchInput?.value));
    dom.searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runSearch(dom.searchInput.value);
    });
    dom.quickSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') runSearch(dom.quickSearchInput.value);
    });
    dom.btnQuickSearchTrigger?.addEventListener('click', () => runSearch(dom.quickSearchInput?.value));
    dom.searchSuggestions?.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-query]');
      if (chip) runSearch(chip.dataset.query);
    });

    dom.btnPurgeFrames?.addEventListener('click', () => {
      engine.clearFrameCache();
      objectsSignature = '';
      onObjects(engine.objects);
      toast('Cleared this browser’s cached screenshots');
    });

    // Delegated: any element carrying data-object-key opens that object.
    document.addEventListener('click', (e) => {
      const target = e.target.closest('[data-object-key]');
      if (target) openObjectDrawer(target.dataset.objectKey);
    });

    dom.drawerCloseBtn?.addEventListener('click', closeDrawer);
    dom.drawerBackdrop?.addEventListener('click', (e) => {
      if (e.target === dom.drawerBackdrop) closeDrawer();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.drawerBackdrop?.classList.contains('is-open')) closeDrawer();
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (e.key === '/' && !typing) {
        e.preventDefault();
        switchTab('search');
        dom.searchInput?.focus();
      }
    });
  }

  function switchTab(tabId) {
    activeTab = tabId;
    dom.tabButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.tab === tabId));
    dom.views.forEach((view) => view.classList.toggle('is-active', view.dataset.view === tabId));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ----------------------------------------------------------- engine status
  function setStatusLine(text, level = '') {
    if (!dom.engineStatusDetail) return;
    dom.engineStatusDetail.textContent = text;
    dom.engineStatusDetail.className = `ws-status-line${level ? ` is-${level}` : ''}`;
  }

  function setHud(text, dotClass) {
    if (dom.hudText) dom.hudText.textContent = text;
    if (dom.hudDot) dom.hudDot.className = `hud-dot${dotClass ? ` ${dotClass}` : ''}`;
  }

  function onReachability(reachable, notJson) {
    if (reachable) return;
    setHud('ENGINE OFFLINE', '');
    if (dom.engineSourceBadge) {
      dom.engineSourceBadge.textContent = 'Engine not reachable';
      dom.engineSourceBadge.className = 'ws-source-badge is-down';
    }
    setStatusLine(
      notJson
        ? 'This server does not proxy /api to the engine. Start everything with: python3 scripts/run_all.py'
        : 'Engine not reachable. Start it with: python3 scripts/run_all.py',
      'error'
    );
  }

  const STATE_HUD = {
    starting: ['ENGINE STARTING', 'settling'],
    scanning: ['VLM SCANNING SCENE', 'settling'],
    watching: ['WATCHING', 'active'],
    reconnecting: ['CAMERA RECONNECTING', 'settling'],
    error: ['ENGINE ERROR', ''],
    stopped: ['ENGINE STOPPED', ''],
    disabled: ['LOOP DISABLED', ''],
  };

  function renderTelemetry(t) {
    const cam = t.camera || {};
    const gate = t.gate || {};
    const vlm = t.vlm || {};
    const scans = t.scans || {};

    // Header + HUD
    let [hudText, dot] = STATE_HUD[t.state] || [String(t.state || '').toUpperCase(), ''];
    if (t.state === 'watching' && gate.state === 'moving') [hudText, dot] = ['MOTION — SETTLING', 'settling'];
    if (t.state === 'watching' && !cam.streaming) [hudText, dot] = ['NO CAMERA FRAMES', ''];
    if (engine.isMonitoring) hudText += ' · PREVIEW LIVE';
    setHud(hudText, dot);
    if (dom.hudPill) dom.hudPill.title = t.error || `Engine state: ${t.state}`;

    if (dom.engineSourceBadge) {
      const device = cam.device || cam.source || 'camera';
      dom.engineSourceBadge.textContent = `${device} · ${vlm.provider || '?'} / ${vlm.model || '?'}`;
      dom.engineSourceBadge.className = `ws-source-badge ${cam.streaming ? 'is-live' : 'is-down'}`;
    }

    // Status line (only when the preview is not reporting its own state)
    if (t.state === 'error' || t.state === 'reconnecting') {
      setStatusLine(t.error || `Engine ${t.state}`, 'error');
    } else if (!engine.isMonitoring) {
      setStatusLine(
        cam.streaming
          ? `Engine is watching ${cam.device || cam.source} (${cam.resolution}). Press Start Monitoring for the live preview.`
          : 'Engine running, but no camera frames are arriving.',
        cam.streaming ? '' : 'warn'
      );
    }

    // Motion meter: the gate's own score against its own threshold
    const threshold = gate.motion_threshold || 0;
    const score = gate.motion_score || 0;
    if (dom.motionMeterFill && dom.motionMeterText) {
      const ratio = threshold ? Math.min(1, score / (threshold * 3)) : 0;
      dom.motionMeterFill.style.width = `${Math.round(ratio * 100)}%`;
      const moving = threshold && score > threshold;
      dom.motionMeterFill.style.background = moving ? '#ef4444' : 'var(--signal-orange)';
      dom.motionMeterText.textContent = `${moving ? 'MOTION' : 'CALM'} · ${(score * 100).toFixed(2)}% (trigger ${(threshold * 100).toFixed(1)}%)`;
    }

    if (dom.runtimeModelBadge) {
      dom.runtimeModelBadge.textContent = `VLM: ${(vlm.provider || '?').toUpperCase()} · ${(vlm.model || '?').toUpperCase()}`;
    }
    if (dom.monitorSubtitle && gate.settle_seconds != null) {
      dom.monitorSubtitle.textContent =
        `The engine compares every frame with the last (trigger above ${(threshold * 100).toFixed(1)}% of pixels changed). ` +
        `When motion stops for ${gate.settle_seconds}s and the scene stays different from before, that settled frame is sent to ${vlm.model || 'the VLM'}. ` +
        `A hand that leaves the scene as it was is discarded without a VLM call.`;
    }

    // Pipeline chips (overview)
    if (dom.pipelineChips) {
      const lastCall = vlm.last_call_at ? `${timeAgo(vlm.last_call_at)}, ${vlm.last_latency_ms}ms` : 'no calls yet';
      dom.pipelineChips.innerHTML = [
        `Camera: ${cam.streaming ? esc(cam.device || cam.source) : 'no frames'}`,
        `Gate: ${esc(gate.state || '—')}`,
        `VLM: ${esc(vlm.model || '?')} (${esc(lastCall)})`,
      ]
        .map((text) => `<span class="anchor-chip"><span class="anchor-dot"></span>${text}</span>`)
        .join('');
    }
    if (dom.sceneSummary) {
      const n = t.memory?.objects ?? engine.objects.length;
      dom.sceneSummary.textContent =
        `${n} object${n === 1 ? '' : 's'} in memory · last scene scan ${scans.last_at ? timeAgo(scans.last_at) : 'pending'}` +
        (scans.last_object_count != null ? ` (${scans.last_object_count} seen)` : '');
    }

    const rows = [
      ['Engine state', esc(t.state) + (t.error ? ` — ${esc(t.error)}` : '')],
      ['Camera', cam.streaming
        ? `<span class="is-good">streaming</span> · ${esc(cam.device || cam.source)}`
        : `<span class="is-bad">no frames</span> · ${esc(cam.device || cam.source)}`],
      ['Frames captured', `${cam.frames ?? 0} · ${esc(cam.resolution || '—')} · every ${cam.capture_interval_s}s`],
      ['Gate', `${esc(gate.state)} · score ${(score * 100).toFixed(2)}%`],
      ['Changes promoted', String(gate.promoted ?? 0)],
      ['Transients ignored', String(gate.discarded_transients ?? 0)],
      ['VLM calls', `${vlm.calls ?? 0}${vlm.failures ? ` · <span class="is-bad">${vlm.failures} failed</span>` : ''}`],
      ['Last VLM call', vlm.last_call_at ? `${esc(vlm.last_kind)} · ${timeAgo(vlm.last_call_at)} · ${vlm.last_latency_ms}ms` : '—'],
      ['Triggers committed', String(t.triggers?.count ?? 0)],
    ];
    if (vlm.last_error) rows.push(['Last VLM error', `<span class="is-bad">${esc(vlm.last_error)}</span>`]);
    if (dom.engineTelemetryList) {
      dom.engineTelemetryList.innerHTML = rows
        .map(([k, v]) => `<div class="ws-tel-row"><span>${k}</span><span>${v}</span></div>`)
        .join('');
    }

    if (dom.engineConfigRows) {
      const cfg = [
        ['Session', esc(t.session)],
        ['Uptime', `${Math.round(t.uptime_s || 0)}s`],
        ['Camera source', esc(cam.source)],
        ['Camera device (opened by engine)', esc(cam.device || '—')],
        ['Engine frame size', esc(cam.resolution || '—')],
        ['Capture interval', `${cam.capture_interval_s}s`],
        ['Motion threshold', `${(threshold * 100).toFixed(2)}% of pixels`],
        ['Persistent-change threshold', `${((gate.change_threshold || 0) * 100).toFixed(2)}% of pixels`],
        ['Settle time', `${gate.settle_seconds}s`],
        ['VLM provider', esc(vlm.provider)],
        ['VLM model', esc(vlm.model)],
        ['VLM calls / failures', `${vlm.calls ?? 0} / ${vlm.failures ?? 0}`],
        ['Scene scans', `${scans.count ?? 0}${scans.last_at ? ` · last ${timeAgo(scans.last_at)}` : ''}`],
        ['Objects in memory', String(t.memory?.objects ?? '—')],
      ];
      dom.engineConfigRows.innerHTML = cfg
        .map(([k, v]) => `<div class="ws-tel-row"><span>${k}</span><span>${v}</span></div>`)
        .join('');
    }
    if (dom.vlmDataFlowBadge) {
      const cloud = ['groq', 'nvidia'].includes(vlm.provider);
      dom.vlmDataFlowBadge.textContent = cloud ? `${String(vlm.provider).toUpperCase()} (CLOUD)` : 'LOCAL MODEL';
    }
    if (dom.memoryFactBadge) dom.memoryFactBadge.textContent = `${t.memory?.objects ?? 0} OBJECTS`;
  }

  // --------------------------------------------------------- live preview
  function onPreviewStatus(status, detail) {
    const live = status === 'monitoring-active';
    if (dom.btnStartMonitoringLabel) dom.btnStartMonitoringLabel.textContent = live ? 'Pause Monitoring' : 'Start Monitoring';
    if (dom.btnHeaderAction) {
      dom.btnHeaderAction.innerHTML = live ? '<span>❚❚ Pause Monitoring</span>' : '<span>● Start Monitoring</span>';
    }
    dom.viewfinderPlaceholder?.classList.toggle('is-hidden', live);
    const level = live || status === 'monitoring-paused' ? '' : 'warn';
    setStatusLine(detail || status, level);
    if (dom.overviewCameraStatusText) {
      dom.overviewCameraStatusText.textContent = live ? detail : `Live preview off${detail && !live ? ` — ${detail}` : ''}`;
    }
    if (dom.cameraResolutionHud) {
      const s = live ? engine.previewSettings : null;
      dom.cameraResolutionHud.textContent = s && s.width ? `${s.width} × ${s.height} PREVIEW` : 'PREVIEW OFF';
    }
    if (!live && dom.viewfinderPlaceholder) {
      dom.viewfinderPlaceholder.innerHTML = status === 'monitoring-paused' || !detail
        ? '<strong>Live preview is off</strong><span>Press <em>Start Monitoring</em> to show the iPhone camera. The engine is watching either way.</span>'
        : `<strong>Preview unavailable</strong><span>${esc(detail)}</span>`;
    }
  }

  function populateCameraSelect(devices) {
    if (!dom.cameraSourceSelect) return;
    dom.cameraSourceSelect.innerHTML = '';
    const phone = devices.find((d) => d.kind === 'continuity');
    if (!phone) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Phone camera not found';
      dom.cameraSourceSelect.appendChild(opt);
    }
    for (const dev of devices) {
      const opt = document.createElement('option');
      opt.value = dev.deviceId;
      opt.textContent = dev.kind === 'continuity' ? `${dev.label} (phone)` : `${dev.label} (not the phone)`;
      dom.cameraSourceSelect.appendChild(opt);
    }
    // Preselect the phone only. Preselecting whatever is first is how the built-in
    // webcam ends up on screen.
    selectedDeviceId = phone ? phone.deviceId : null;
    dom.cameraSourceSelect.value = selectedDeviceId || '';
  }

  // --------------------------------------------------------------- objects
  function onObjects(objects) {
    const signature = JSON.stringify(
      objects.map((o) => [o.key, o.location, o.status, o.confidence, o.frame_ref, o.last_seen, o.relations])
    );
    renderSuggestions();
    if (signature === objectsSignature) return;
    objectsSignature = signature;
    renderOverviewObjects();
    renderMonitorSidebar();
    renderObjectsRegistry();
  }

  function renderOverviewObjects() {
    if (!dom.deskSnapshotList || !engine) return;
    const objects = engine.objects.filter((o) => o.status !== 'removed').slice(0, 5);
    if (!objects.length) {
      dom.deskSnapshotList.innerHTML = empty(
        engine.reachable
          ? '<strong>Nothing detected yet.</strong> The VLM has not reported any objects in this session.'
          : 'Engine not reachable.'
      );
      return;
    }
    dom.deskSnapshotList.innerHTML = objects
      .map(
        (o) => `
        <div class="desk-snapshot-item" data-object-key="${esc(o.key)}" style="cursor:pointer">
          <div class="snapshot-name-col">
            <strong>${esc(o.name)}</strong>
            <div class="snapshot-loc">📍 ${esc(o.location || 'location not described')}</div>
          </div>
          <div class="snapshot-meta-col">
            <div class="snapshot-conf">${pct(o.confidence)} CONF · ${esc(o.status.toUpperCase())}</div>
            <div class="snapshot-time">${timeAgo(o.last_seen)}</div>
          </div>
        </div>`
      )
      .join('');
  }

  function renderMonitorSidebar() {
    if (!dom.activeDetectionsList) return;
    const visible = engine.objects.filter((o) => o.status !== 'removed');
    if (dom.activeDetectionsCount) dom.activeDetectionsCount.textContent = `${visible.length} OBJECTS`;
    if (!visible.length) {
      dom.activeDetectionsList.innerHTML = empty('No objects detected yet.');
      return;
    }
    dom.activeDetectionsList.innerHTML = visible
      .slice(0, 8)
      .map(
        (o) => `
        <div class="matrix-row" data-object-key="${esc(o.key)}" style="cursor:pointer">
          <div class="matrix-row-name">
            <strong>${esc(o.name)}</strong>
            <div class="matrix-row-loc">${esc(o.location || '—')} · ${timeAgo(o.last_seen)}</div>
          </div>
          <span class="matrix-conf-pill">${pct(o.confidence)}</span>
        </div>`
      )
      .join('');
  }

  function renderObjectsRegistry() {
    if (!dom.objectsRegistryRows) return;
    let objects = engine.objects;
    if (activeCategoryFilter !== 'all') objects = objects.filter((o) => o.category === activeCategoryFilter);
    if (dom.objectsRegistryCount) {
      dom.objectsRegistryCount.textContent = `${objects.length} OF ${engine.objects.length} OBJECTS IN MEMORY`;
    }
    if (!objects.length) {
      dom.objectsRegistryRows.innerHTML = empty(
        engine.objects.length ? 'No objects in this category.' : '<strong>Nothing detected yet.</strong> Objects appear here as the VLM describes them.'
      );
      return;
    }
    dom.objectsRegistryRows.innerHTML = objects
      .map(
        (o) => `
        <div class="registry-row-item">
          <div class="registry-col-item">
            ${o.frame_ref
              ? `<img class="registry-thumb-img" data-frame-ref="${esc(o.frame_ref)}" alt="${esc(o.name)}"/>`
              : '<div class="registry-thumb-img"></div>'}
            <div>
              <div class="registry-item-name">${esc(o.name)}</div>
              <div class="registry-item-category">${esc(o.category.toUpperCase())} · ${esc(o.status.toUpperCase())}</div>
            </div>
          </div>
          <div class="registry-col-loc">
            <div><span class="loc-pin">📍</span> <span>${esc(o.location || 'not described')}</span></div>
            ${relationsHtml(o.relations)}
          </div>
          <div class="registry-col-time">${timeAgo(o.last_seen)}<br><small>${clock(o.last_seen)}</small></div>
          <div class="registry-col-conf">
            <div class="conf-bar-mini"><div class="conf-bar-fill" style="width:${pct(o.confidence)}"></div></div>
            <span class="conf-val-num">${pct(o.confidence)}</span>
          </div>
          <div class="registry-col-action">
            <button class="btn-inspect-pill" type="button" data-object-key="${esc(o.key)}" data-endpoint="history">
              <span>History</span><span aria-hidden="true">→</span>
            </button>
          </div>
        </div>`
      )
      .join('');
    hydrateShots(dom.objectsRegistryRows);
  }

  // -------------------------------------------------------------- triggers
  function onTriggers({ added }) {
    renderOverviewTriggers();
    renderHistory();
    const changes = added.filter((e) => e.kind === 'change');
    for (const e of changes.slice(-2)) {
      const route = e.event === 'moved' && e.from ? `${esc(e.from)} → ${esc(e.to || '?')}` : esc(e.to || '');
      toast(`${eventChip(e.event)} <strong>${esc(e.name)}</strong> ${route} · ${pct(e.confidence)}`);
    }
    const scans = added.filter((e) => e.kind !== 'change');
    if (scans.length) {
      toast(`VLM scene scan: <strong>${scans.length}</strong> object${scans.length === 1 ? '' : 's'} seen`);
    }
  }

  function triggerRow(e, { thumb = true } = {}) {
    const route =
      e.event === 'moved' && e.from
        ? `<span>${esc(e.from)}</span> <span class="arrow">→</span> <strong>${esc(e.to || '?')}</strong>`
        : `<strong>${esc(e.to || (e.event === 'removed' ? 'no longer visible' : '—'))}</strong>`;
    return `
      <li class="timeline-event-entry">
        <div class="timeline-event-dot"></div>
        <div class="timeline-entry-content">
          <div class="timeline-entry-left">
            <div class="timeline-entry-title-row">
              ${eventChip(e.event)}
              <span class="timeline-obj-name" data-object-key="${esc(e.key)}" style="cursor:pointer">${esc(e.name)}</span>
              <span class="ws-kind">${esc(KIND_LABEL[e.kind] || e.kind)}</span>
            </div>
            <div class="timeline-route-desc">${route}</div>
            ${relationsHtml(e.relations)}
            <div class="timeline-entry-meta">
              ${clock(e.observed_at)} (${timeAgo(e.observed_at)}) · ${pct(e.confidence)} confidence ·
              ${esc(e.model)} answered in ${e.latency_ms}ms
            </div>
          </div>
          ${thumb && e.frame_ref ? `<img class="timeline-entry-thumb" data-frame-ref="${esc(e.frame_ref)}" alt="screenshot"/>` : ''}
        </div>
      </li>`;
  }

  function renderOverviewTriggers() {
    if (!dom.recentEventsOverview || !engine) return;
    const recent = engine.triggers.slice(-5).reverse();
    if (dom.statsRecentChangesBadge) {
      dom.statsRecentChangesBadge.textContent = `${engine.triggers.length} IN LAST 5 MIN`;
    }
    if (!recent.length) {
      dom.recentEventsOverview.innerHTML = `<li>${empty(
        engine.reachable ? 'No triggers in the last five minutes. Move an object on the desk.' : 'Engine not reachable.'
      )}</li>`;
      return;
    }
    dom.recentEventsOverview.innerHTML = recent
      .map(
        (e) => `
        <li class="recent-event-row">
          ${eventChip(e.event)}
          <div class="event-details">
            <div class="event-name" data-object-key="${esc(e.key)}" style="cursor:pointer">${esc(e.name)}</div>
            <div class="event-delta-route">
              ${e.event === 'moved' && e.from ? `<span>${esc(e.from)}</span> <span class="arrow">→</span>` : ''}
              <strong>${esc(e.to || '—')}</strong>
            </div>
            <div class="event-time-meta">${esc(KIND_LABEL[e.kind] || e.kind)} · ${timeAgo(e.observed_at)} · ${pct(e.confidence)} confidence</div>
          </div>
        </li>`
      )
      .join('');
  }

  function renderHistory() {
    if (!dom.timelineList || !engine) return;
    let events = engine.triggers.slice().reverse();
    if (activeEventFilter !== 'all') events = events.filter((e) => e.event === activeEventFilter);
    if (historyFilter) {
      events = events.filter((e) =>
        [e.key, e.name, e.from, e.to, ...(e.relations || [])].join(' ').toLowerCase().includes(historyFilter)
      );
    }
    if (dom.historyWindowNote) {
      const oldest = engine.triggers[0];
      dom.historyWindowNote.textContent =
        `${engine.triggers.length} trigger${engine.triggers.length === 1 ? '' : 's'} in the last 5 minutes` +
        (oldest ? ` · oldest ${timeAgo(oldest.observed_at)}` : '') +
        (events.length !== engine.triggers.length ? ` · ${events.length} shown` : '');
    }
    if (!events.length) {
      dom.timelineList.innerHTML = `<li>${empty(
        engine.triggers.length
          ? 'No triggers match this filter.'
          : engine.reachable
            ? 'No triggers in the last five minutes. Move an object on the desk and it appears here.'
            : 'Engine not reachable.'
      )}</li>`;
      return;
    }
    dom.timelineList.innerHTML = events.map((e) => triggerRow(e)).join('');
    hydrateShots(dom.timelineList);
  }

  // ---------------------------------------------------------------- search
  function renderSuggestions() {
    if (!dom.searchSuggestions) return;
    const names = (engine ? engine.objects : []).filter((o) => o.status !== 'removed').slice(0, 5);
    if (!names.length) {
      dom.searchSuggestions.innerHTML =
        '<span style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-gray);">Suggestions appear once the engine has detected objects.</span>';
      return;
    }
    dom.searchSuggestions.innerHTML =
      '<span style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-gray);">DETECTED:</span>' +
      names
        .map((o) => `<button class="suggestion-chip" type="button" data-query="${esc(o.name)}">${esc(o.name)}</button>`)
        .join('');
  }

  async function executeSearch(query) {
    switchTab('search');
    if (dom.searchInput) dom.searchInput.value = query;
    if (dom.searchResultContainer) {
      dom.searchResultContainer.innerHTML = `<div class="evidence-reveal-card">${empty('Searching memory…')}</div>`;
    }
    const res = await engine.search(query);
    renderSearchResult(res);
  }

  function renderSearchResult(res) {
    const box = dom.searchResultContainer;
    if (!box) return;
    if (!engine.reachable) {
      box.innerHTML = `<div class="evidence-reveal-card">${empty('Engine not reachable.')}</div>`;
      return;
    }
    if (!res.matches.length) {
      const seen = engine.objects.map((o) => esc(o.name)).join(', ');
      box.innerHTML = `<div class="evidence-reveal-card">${empty(
        `Nothing in memory matches <strong>“${esc(res.query)}”</strong>. ` +
          (seen ? `The engine has recorded: ${seen}.` : 'The engine has not recorded any objects yet.')
      )}</div>`;
      return;
    }

    const top = res.top || {};
    const o = top.object || res.matches[0];
    const card = top.card;
    const lineage = (top.history || []).slice().reverse();
    const recent = (top.triggers || []).slice().reverse();
    const weak = res.matches[0].strength === 0;

    box.innerHTML = `
      <div class="evidence-reveal-card">
        <div class="reveal-fact-header">
          <div class="reveal-eyebrow">ENGINE MEMORY · ${weak ? 'CLOSEST MATCH' : 'BEST MATCH'} FOR “${esc(res.query)}”</div>
          <h2 class="reveal-object-title">${esc(o.name)}</h2>
          <div class="reveal-location-highlight">📍 <strong>${esc(o.location || 'location not described')}</strong></div>
          <div class="reveal-meta-row">
            <span>Last observed: ${clock(o.last_seen)} (${timeAgo(o.last_seen)})</span>
            <span>Model confidence: ${pct(o.confidence)}</span>
            <span>Status: ${esc(String(card?.status || o.status).toUpperCase())}</span>
          </div>
          ${card ? `<div style="font-size: 13px; margin-top: 8px; color: var(--charcoal);">${esc(card.message)}</div>` : ''}
          ${weak ? `<div class="ws-weak" style="margin-top:6px">No object is named “${esc(res.query)}”; this is the engine’s nearest fuzzy match.</div>` : ''}
          ${relationsHtml(o.relations)}
        </div>
        <div class="reveal-evidence-layout">
          <div class="evidence-snapshot-box">${shotHtml(o.frame_ref, top.bbox || o.bbox, o.name)}</div>
          <div class="evidence-history-col">
            <h4>Movement history (memory)</h4>
            <ul class="evidence-history-list">
              ${lineage.length
                ? lineage
                    .map(
                      (h) => `<li style="padding: 8px 0; border-bottom: 1px solid var(--line-border); font-size: 13.5px;">
                        <div style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-gray);">${clock(h.at)} · ${pct(h.confidence)}</div>
                        <div><strong>${esc(h.location)}</strong></div></li>`
                    )
                    .join('')
                : '<li style="color: var(--slate-gray); font-size: 13px;">No recorded locations.</li>'}
            </ul>
            ${recent.length ? `<h4 style="margin-top:16px">Triggers in the last 5 min</h4><ul class="timeline-chronological-list">${recent.map((e) => triggerRow(e, { thumb: false })).join('')}</ul>` : ''}
            <div style="margin-top: 16px;">
              <button class="btn-pill-primary" type="button" data-object-key="${esc(o.key)}"><span>Open full detail →</span></button>
            </div>
          </div>
        </div>
        ${res.matches.length > 1
          ? `<div class="ws-matches"><h4>Other matches</h4>${res.matches
              .slice(1, 8)
              .map(
                (m) => `<button class="ws-match" type="button" data-object-key="${esc(m.key)}">
                  <span><strong>${esc(m.name)}</strong> — ${esc(m.location || '—')}</span>
                  <small>${pct(m.confidence)} · ${timeAgo(m.last_seen)}${m.strength === 0 ? ' · weak match' : ''}</small>
                </button>`
              )
              .join('')}</div>`
          : ''}
      </div>`;
    hydrateShots(box);
  }

  // ---------------------------------------------------------------- drawer
  async function openObjectDrawer(key) {
    if (!dom.drawerBackdrop || !key) return;
    const detail = await engine.objectDetail(key);
    const o = detail.object;
    if (!o) return;

    dom.drawerTitle.textContent = o.name;
    dom.drawerSubtitle.textContent = `${String(detail.card?.status || o.status).toUpperCase()} · ${o.location || 'location not described'}`;
    dom.drawerCategory.textContent = `${o.category.toUpperCase()} · KEY ${o.key}`;

    const lineage = detail.history.slice().reverse();
    dom.drawerBody.innerHTML = `
      <div style="margin-bottom: 18px;">${shotHtml(o.frame_ref, detail.bbox || o.bbox, o.name)}</div>
      ${detail.card ? `<div style="margin-bottom: 18px; font-size: 13.5px; color: var(--charcoal);">${esc(detail.card.message)}</div>` : ''}
      <div style="margin-bottom: 24px; padding: 16px; background: var(--pure-white); border: 1px solid var(--line-border); border-radius: 12px;">
        <div style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-gray); text-transform: uppercase; margin-bottom: 6px;">Spatial relations (VLM)</div>
        ${relationsHtml(o.relations) || '<div style="font-size: 13px; color: var(--slate-gray);">The VLM reported no relations.</div>'}
      </div>
      <h4 style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--slate-gray); margin: 0 0 12px;">Recorded locations</h4>
      ${lineage.length
        ? lineage
            .map(
              (h, i) => `<div style="display:flex; gap:14px; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid var(--line-border);">
                <div style="font-family: var(--font-mono); font-size: 11px; color: var(--signal-orange); font-weight:600; width:24px;">${String(lineage.length - i).padStart(2, '0')}</div>
                <div style="flex:1">
                  <div style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-gray);">${clock(h.at)} · ${timeAgo(h.at)}</div>
                  <div style="font-size: 14px; font-weight: 500;"><strong>${esc(h.location)}</strong></div>
                  <div style="font-size: 12px; color: #78716c;">${pct(h.confidence)} confidence</div>
                </div></div>`
            )
            .join('')
        : '<div style="color: var(--slate-gray); font-size: 13.5px;">No recorded locations.</div>'}
      ${detail.triggers.length
        ? `<h4 style="font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--slate-gray); margin: 20px 0 12px;">Triggers in the last 5 min</h4>
           <ul class="timeline-chronological-list">${detail.triggers.slice().reverse().map((e) => triggerRow(e)).join('')}</ul>`
        : ''}`;
    hydrateShots(dom.drawerBody);
    dom.drawerBackdrop.classList.add('is-open');
  }

  function closeDrawer() {
    dom.drawerBackdrop?.classList.remove('is-open');
  }

  // ------------------------------------------------------- live box overlay
  /**
   * Draw the VLM's bounding boxes for objects in memory over the live preview.
   *
   * Boxes are where each object was when the VLM last described it, in the
   * engine's frame (same phone camera). The canvas covers the viewfinder, which
   * shows the video with object-fit: cover, so boxes are mapped through the same
   * cover transform to stay aligned at any preview aspect ratio.
   */
  function startOverlayLoop() {
    const canvas = dom.overlayCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const v = dom.video;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(rect.width * dpr) || canvas.height !== Math.round(rect.height * dpr)) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (showBoundingBoxes && engine && engine.isMonitoring && v && v.videoWidth) {
        const scale = Math.max(rect.width / v.videoWidth, rect.height / v.videoHeight);
        const dw = v.videoWidth * scale;
        const dh = v.videoHeight * scale;
        const ox = (rect.width - dw) / 2;
        const oy = (rect.height - dh) / 2;

        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.textBaseline = 'top';
        for (const o of engine.objects) {
          if (!o.bbox || o.status === 'removed') continue;
          const x = ox + o.bbox.x * dw;
          const y = oy + o.bbox.y * dh;
          const w = o.bbox.w * dw;
          const h = o.bbox.h * dh;
          ctx.strokeStyle = o.status === 'fresh' ? '#ff5b14' : 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 2;
          ctx.strokeRect(x, y, w, h);
          const label = `${o.name} · ${pct(o.confidence)}`;
          const tw = ctx.measureText(label).width + 10;
          ctx.fillStyle = o.status === 'fresh' ? '#ff5b14' : 'rgba(20,20,19,0.75)';
          ctx.fillRect(x - 1, Math.max(0, y - 18), tw, 17);
          ctx.fillStyle = '#fff';
          ctx.fillText(label, x + 4, Math.max(0, y - 16));
        }
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
