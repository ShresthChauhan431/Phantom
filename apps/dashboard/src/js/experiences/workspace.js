/**
 * ==============================================================================
 * PHANTOM WORKSPACE — CONTROLLER & INTERACTION ENGINE
 * SMRITI Craftsmanship & Apple-Level Precision
 * Seamless integration of WebRTC Capture, 2-Stage Gate, Continuous Key-Value Store,
 * Precision Object Registry, Chronological Activity Ledger, and Deterministic Search.
 * ==============================================================================
 */

(function () {
  'use strict';

  let engine = null;
  let activeTab = 'overview';
  let activeCategoryFilter = 'all';
  let activeEventFilter = 'all';
  let showBoundingBoxes = true;
  let selectedDeviceId = null;

  // DOM Elements Cache
  const dom = {};

  function cacheDom() {
    dom.video = document.getElementById('cameraVideo');
    dom.overlayCanvas = document.getElementById('overlayCanvas');
    dom.btnStartMonitoring = document.getElementById('btnStartMonitoring');
    dom.btnStartMonitoringLabel = document.getElementById('btnStartMonitoringLabel');
    dom.btnHeaderAction = document.getElementById('btnHeaderAction');
    dom.hudDot = document.getElementById('hudDot');
    dom.hudText = document.getElementById('hudText');
    dom.envSelect = document.getElementById('envSelect');

    // Viewfinder & Controls
    dom.cameraSourceSelect = document.getElementById('cameraSourceSelect');
    dom.resolutionSelect = document.getElementById('resolutionSelect');
    dom.intervalSlider = document.getElementById('intervalSlider');
    dom.intervalVal = document.getElementById('intervalVal');
    dom.btnCaptureNow = document.getElementById('btnCaptureNow');
    dom.btnToggleBoxes = document.getElementById('btnToggleBoxes');
    dom.fileUploadInput = document.getElementById('fileUploadInput');
    dom.btnUploadFallback = document.getElementById('btnUploadFallback');
    dom.cameraResolutionHud = document.getElementById('cameraResolutionHud');
    dom.overviewCameraStatusText = document.getElementById('overviewCameraStatusText');

    // Motion Meter
    dom.motionMeterFill = document.getElementById('motionMeterFill');
    dom.motionMeterText = document.getElementById('motionMeterText');

    // Overview Containers
    dom.deskSnapshotList = document.getElementById('deskSnapshotList');
    dom.recentEventsOverview = document.getElementById('recentEventsOverview');
    dom.statsRecentChangesBadge = document.getElementById('statsRecentChangesBadge');

    // Monitor Containers
    dom.activeDetectionsList = document.getElementById('activeDetectionsList');

    // Objects Precision Registry Table
    dom.objectsRegistryRows = document.getElementById('objectsRegistryRows');
    dom.objectsRegistryCount = document.getElementById('objectsRegistryCount');

    // Activity Timeline
    dom.timelineList = document.getElementById('timelineList');

    // Search
    dom.searchInput = document.getElementById('searchInput');
    dom.btnSearch = document.getElementById('btnSearch');
    dom.quickSearchInput = document.getElementById('quickSearchInput');
    dom.btnQuickSearchTrigger = document.getElementById('btnQuickSearchTrigger');
    dom.searchResultContainer = document.getElementById('searchResultContainer');

    // Settings
    dom.btnPurgeFrames = document.getElementById('btnPurgeFrames');
    dom.btnResetDatabase = document.getElementById('btnResetDatabase');

    // Drawer
    dom.drawerBackdrop = document.getElementById('drawerBackdrop');
    dom.drawerCloseBtn = document.getElementById('drawerCloseBtn');
    dom.drawerTitle = document.getElementById('drawerTitle');
    dom.drawerSubtitle = document.getElementById('drawerSubtitle');
    dom.drawerCategory = document.getElementById('drawerCategory');
    dom.drawerBody = document.getElementById('drawerBody');

    // Tabs
    dom.tabButtons = document.querySelectorAll('.tab-btn');
    dom.views = document.querySelectorAll('.workspace-view');
  }

  async function init() {
    cacheDom();

    // 1. Initialize shared PhantomEngine
    engine = new PhantomEngine({
      videoElement: dom.video,
      environmentId: dom.envSelect ? dom.envSelect.value : 'env_desk_01',
      motionThreshold: 0.04,
      settlingDelay: 1500
    });

    // 2. Attach Engine Listeners
    engine.on('statusChange', ({ status, detail }) => updateStatusUI(status, detail));
    engine.on('devicesDiscovered', (devices) => populateCameraSelect(devices));
    engine.on('motionScore', (score) => updateMotionMeter(score));
    engine.on('settling', ({ remaining, total }) => updateSettlingUI(remaining, total));
    engine.on('observationCommitted', (deltaResult) => handleNewObservation(deltaResult));

    // Boot engine
    await engine.init();

    // 3. Bind UI interactions
    bindEvents();

    // 4. Populate initial data views
    await refreshAllViews();

    // Start overlay render loop for live video annotations
    startOverlayLoop();
  }

  function bindEvents() {
    // Navigation Tabs
    dom.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    // Quick launch monitor from overview
    document.getElementById('btnLaunchMonitorQuick')?.addEventListener('click', () => {
      switchTab('monitor');
    });

    // Monitoring Toggle
    const toggleMonitoring = async () => {
      if (engine.isMonitoring) {
        engine.stopMonitoring();
      } else {
        await engine.startMonitoring(selectedDeviceId);
      }
    };
    dom.btnStartMonitoring?.addEventListener('click', toggleMonitoring);
    dom.btnHeaderAction?.addEventListener('click', toggleMonitoring);

    // Camera hardware selector
    dom.cameraSourceSelect?.addEventListener('change', async (e) => {
      selectedDeviceId = e.target.value;
      if (engine.isMonitoring) {
        engine.stopMonitoring();
        await engine.startMonitoring(selectedDeviceId);
      } else {
        await engine.capture.connectCamera(selectedDeviceId);
      }
    });

    // Resolution selector
    dom.resolutionSelect?.addEventListener('change', (e) => {
      const val = e.target.value;
      engine.capture.setResolution(val);
      if (dom.cameraResolutionHud) {
        dom.cameraResolutionHud.textContent = val.replace('x', ' × ') + ' HD';
      }
    });

    // Interval slider
    dom.intervalSlider?.addEventListener('input', (e) => {
      const val = e.target.value;
      if (dom.intervalVal) dom.intervalVal.textContent = `${val}s`;
    });

    // Manual capture
    dom.btnCaptureNow?.addEventListener('click', async () => {
      dom.btnCaptureNow.disabled = true;
      dom.btnCaptureNow.textContent = 'Verifying...';
      await engine.captureAndVerifyNow();
      dom.btnCaptureNow.disabled = false;
      dom.btnCaptureNow.innerHTML = '<span>✦ Capture & Verify</span>';
    });

    // Toggle bounding boxes
    dom.btnToggleBoxes?.addEventListener('click', () => {
      showBoundingBoxes = !showBoundingBoxes;
      dom.btnToggleBoxes.classList.toggle('is-active', showBoundingBoxes);
    });

    // Video upload fallback
    dom.btnUploadFallback?.addEventListener('click', () => {
      dom.fileUploadInput?.click();
    });

    dom.fileUploadInput?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      await engine.capture.loadFromFile(file);
      switchTab('monitor');
    });

    // Category Filter Chips
    document.querySelectorAll('.filter-chip[data-category]').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip[data-category]').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeCategoryFilter = chip.dataset.category;
        renderObjectsRegistry();
      });
    });

    // Event Filter Chips
    document.querySelectorAll('.filter-chip[data-event]').forEach((chip) => {
      chip.addEventListener('click', () => {
        document.querySelectorAll('.filter-chip[data-event]').forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        activeEventFilter = chip.dataset.event;
        renderActivityTimeline();
      });
    });

    // Search Execution
    const executeSearch = async (query) => {
      if (!query) return;
      switchTab('search');
      if (dom.searchInput) dom.searchInput.value = query;
      const result = await engine.queryMemory(query);
      renderSearchResult(result);
    };

    dom.btnSearch?.addEventListener('click', () => {
      executeSearch(dom.searchInput?.value);
    });

    dom.searchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeSearch(dom.searchInput?.value);
    });

    dom.quickSearchInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') executeSearch(dom.quickSearchInput?.value);
    });

    dom.btnQuickSearchTrigger?.addEventListener('click', () => {
      executeSearch(dom.quickSearchInput?.value);
    });

    // Suggestion pills
    document.querySelectorAll('.suggestion-chip').forEach((pill) => {
      pill.addEventListener('click', () => {
        executeSearch(pill.textContent.trim());
      });
    });

    // Settings actions
    dom.btnPurgeFrames?.addEventListener('click', async () => {
      if (confirm('Purge all cached evidence snapshots from local storage?')) {
        await engine.storage.purgeEvidenceFrames();
        alert('Evidence snapshots purged.');
        await refreshAllViews();
      }
    });

    dom.btnResetDatabase?.addEventListener('click', async () => {
      if (confirm('Reset spatial memory to default desk baseline?')) {
        await engine.storage.resetDatabase();
        alert('Database reset to baseline state.');
        await refreshAllViews();
      }
    });

    // Drawer close
    dom.drawerCloseBtn?.addEventListener('click', closeDrawer);
    dom.drawerBackdrop?.addEventListener('click', (e) => {
      if (e.target === dom.drawerBackdrop) closeDrawer();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dom.drawerBackdrop?.classList.contains('is-open')) {
        closeDrawer();
      }
      if (e.key === '/' && document.activeElement !== dom.searchInput && document.activeElement !== dom.quickSearchInput) {
        e.preventDefault();
        switchTab('search');
        dom.searchInput?.focus();
      }
    });
  }

  function switchTab(tabId) {
    activeTab = tabId;
    dom.tabButtons.forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset.tab === tabId);
    });
    dom.views.forEach((view) => {
      view.classList.toggle('is-active', view.dataset.view === tabId);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateStatusUI(status, detail) {
    if (!dom.hudDot || !dom.hudText) return;

    dom.hudDot.className = 'hud-dot';

    const statusMap = {
      'no-camera': { text: 'NO CAMERA', class: '' },
      'permission-required': { text: 'PERMISSION REQUIRED', class: 'settling' },
      'camera-connected': { text: 'CONNECTED', class: 'connected' },
      'camera-unavailable': { text: 'CAMERA UNAVAILABLE', class: '' },
      'camera-disconnected': { text: 'DISCONNECTED', class: '' },
      'monitoring-active': { text: 'MONITORING ACTIVE', class: 'active' },
      'monitoring-paused': { text: 'STANDBY', class: '' },
      'processing-error': { text: 'PROCESSING ERROR', class: '' }
    };

    const cfg = statusMap[status] || { text: status.toUpperCase(), class: '' };
    dom.hudText.textContent = cfg.text;
    if (cfg.class) dom.hudDot.classList.add(cfg.class);

    // Update buttons
    const isAct = status === 'monitoring-active';
    if (dom.btnStartMonitoringLabel) {
      dom.btnStartMonitoringLabel.textContent = isAct ? 'Pause Monitoring' : 'Start Monitoring';
    }
    if (dom.btnHeaderAction) {
      dom.btnHeaderAction.innerHTML = isAct
        ? '<span>❚❚ Pause Monitoring</span>'
        : '<span>● Start Monitoring</span>';
    }
  }

  function populateCameraSelect(devices) {
    if (!dom.cameraSourceSelect) return;
    dom.cameraSourceSelect.innerHTML = '';

    if (devices.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'No camera detected';
      opt.disabled = true;
      dom.cameraSourceSelect.appendChild(opt);
      return;
    }

    devices.forEach((dev) => {
      const opt = document.createElement('option');
      opt.value = dev.deviceId;
      opt.textContent = `${dev.label} [${dev.type}]`;
      dom.cameraSourceSelect.appendChild(opt);
    });

    if (devices.length > 0 && !selectedDeviceId) {
      selectedDeviceId = devices[0].deviceId;
      if (dom.overviewCameraStatusText) {
        dom.overviewCameraStatusText.textContent = `Camera: ${devices[0].label} (${devices[0].type})`;
      }
    }
  }

  function updateMotionMeter(score) {
    if (!dom.motionMeterFill || !dom.motionMeterText) return;
    const percent = Math.min(100, Math.round(score * 100 * 3));
    dom.motionMeterFill.style.width = `${percent}%`;

    if (score >= engine.changeDetector.motionThreshold) {
      dom.motionMeterFill.style.background = '#ef4444';
      dom.motionMeterText.textContent = `MOTION · ${(score * 100).toFixed(1)}%`;
    } else {
      dom.motionMeterFill.style.background = 'var(--signal-orange)';
      dom.motionMeterText.textContent = `CALM · ${(score * 100).toFixed(1)}%`;
    }
  }

  function updateSettlingUI(remainingMs, totalMs) {
    if (!dom.hudText || !dom.hudDot) return;
    dom.hudDot.className = 'hud-dot settling';
    dom.hudText.textContent = `SETTLING (${(remainingMs / 1000).toFixed(1)}s)`;
  }

  async function handleNewObservation(deltaResult) {
    await refreshAllViews();

    if (deltaResult.changes && deltaResult.changes.length > 0) {
      const first = deltaResult.changes[0];
      const toast = document.createElement('div');
      toast.className = 'hud-status-pill';
      toast.style.position = 'fixed';
      toast.style.bottom = '28px';
      toast.style.right = '32px';
      toast.style.zIndex = '2000';
      toast.style.background = '#141413';
      toast.style.color = '#F3F0EE';
      toast.innerHTML = `<span class="hud-dot active"></span><span>STATE CHANGE: <strong>${first.new_location}</strong></span>`;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }
  }

  async function refreshAllViews() {
    await renderOverview();
    await renderMonitorSidebar();
    await renderObjectsRegistry();
    await renderActivityTimeline();
  }

  async function renderOverview() {
    const envId = engine.activeEnvironmentId;
    const objects = await engine.storage.getAllObjects(envId);
    const events = await engine.storage.getEvents(envId);

    // Update badges
    if (dom.statsRecentChangesBadge) {
      dom.statsRecentChangesBadge.textContent = `${events.length} EVENTS COMMITTED`;
    }

    // Populate Overview Desk Mini-Registry (Top 3 items)
    if (dom.deskSnapshotList) {
      dom.deskSnapshotList.innerHTML = '';
      const previewItems = objects.slice(0, 3);

      previewItems.forEach((obj) => {
        const item = document.createElement('div');
        item.className = 'desk-snapshot-item';
        item.innerHTML = `
          <div class="snapshot-name-col">
            <strong>${obj.canonical_name}</strong>
            <div class="snapshot-loc">📍 ${obj.current_location}</div>
          </div>
          <div class="snapshot-meta-col">
            <div class="snapshot-conf">${Math.round(obj.confidence * 100)}% CONF</div>
            <div class="snapshot-time">${formatTimeAgo(new Date(obj.last_seen))}</div>
          </div>
        `;
        dom.deskSnapshotList.appendChild(item);
      });
    }

    // Populate Recent Events Stream (Top 3)
    if (dom.recentEventsOverview) {
      const recent = events.slice(0, 4);
      if (recent.length === 0) {
        dom.recentEventsOverview.innerHTML = `<li style="color: var(--slate-gray); font-size: 13px;">No physical state changes recorded yet.</li>`;
      } else {
        dom.recentEventsOverview.innerHTML = recent
          .map((evt) => {
            const obj = objects.find((o) => o.object_id === evt.object_id);
            const name = obj ? obj.canonical_name : 'Physical Asset';
            const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            return `
              <li class="recent-event-row">
                <span class="event-type-chip ${evt.event_type}">${evt.event_type}</span>
                <div class="event-details">
                  <div class="event-name">${name}</div>
                  <div class="event-delta-route">
                    ${evt.previous_location ? `<span>${evt.previous_location}</span> <span class="arrow">→</span>` : ''}
                    <strong>${evt.new_location}</strong>
                  </div>
                  <div class="event-time-meta">Verified ${timeStr} · ${(evt.confidence * 100).toFixed(0)}% confidence</div>
                </div>
              </li>
            `;
          })
          .join('');
      }
    }
  }

  async function renderMonitorSidebar() {
    if (!dom.activeDetectionsList) return;
    const envId = engine.activeEnvironmentId;
    const objects = await engine.storage.getAllObjects(envId);

    dom.activeDetectionsList.innerHTML = '';
    const visible = objects.filter((o) => o.status !== 'removed');

    visible.slice(0, 5).forEach((obj) => {
      const row = document.createElement('div');
      row.className = 'matrix-row';
      row.innerHTML = `
        <div class="matrix-row-name">
          <strong>${obj.canonical_name}</strong>
          <div class="matrix-row-loc">${obj.current_location}</div>
        </div>
        <span class="matrix-conf-pill">${Math.round(obj.confidence * 100)}%</span>
      `;
      dom.activeDetectionsList.appendChild(row);
    });
  }

  async function renderObjectsRegistry() {
    if (!dom.objectsRegistryRows) return;
    const envId = engine.activeEnvironmentId;
    let objects = await engine.storage.getAllObjects(envId);

    if (activeCategoryFilter !== 'all') {
      objects = objects.filter((o) => o.category === activeCategoryFilter);
    }

    if (dom.objectsRegistryCount) {
      dom.objectsRegistryCount.textContent = `${objects.length} OBJECTS IN PHYSICAL STORE`;
    }

    if (objects.length === 0) {
      dom.objectsRegistryRows.innerHTML = `
        <div style="padding: 40px; text-align: center; color: var(--slate-gray);">
          No physical items found in this category.
        </div>
      `;
      return;
    }

    dom.objectsRegistryRows.innerHTML = '';

    for (const obj of objects) {
      const row = document.createElement('div');
      row.className = 'registry-row-item';

      let thumbUrl = '';
      if (obj.evidence_frame_ref) {
        const frame = await engine.storage.getEvidenceFrame(obj.evidence_frame_ref);
        if (frame && frame.data_url) thumbUrl = frame.data_url;
      }

      const thumbImg = thumbUrl
        ? `<img src="${thumbUrl}" class="registry-thumb-img" alt="${obj.canonical_name}" loading="lazy"/>`
        : `<div class="registry-thumb-img" style="display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--slate-gray);font-family:var(--font-mono);">RAW</div>`;

      const confPercent = Math.round(obj.confidence * 100);

      row.innerHTML = `
        <div class="registry-col-item">
          ${thumbImg}
          <div>
            <div class="registry-item-name">${obj.canonical_name}</div>
            <div class="registry-item-category">${obj.category.toUpperCase()} · STATUS: ${obj.status.toUpperCase()}</div>
          </div>
        </div>

        <div class="registry-col-loc">
          <span class="loc-pin">📍</span>
          <span>${obj.current_location}</span>
        </div>

        <div class="registry-col-time">
          ${formatTimeAgo(new Date(obj.last_seen))}
        </div>

        <div class="registry-col-conf">
          <div class="conf-bar-mini">
            <div class="conf-bar-fill" style="width: ${confPercent}%;"></div>
          </div>
          <span class="conf-val-num">${confPercent}%</span>
        </div>

        <div class="registry-col-action">
          <button class="btn-inspect-pill" type="button" data-object-id="${obj.object_id}">
            <span>Inspect History</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      `;

      row.querySelector('.btn-inspect-pill')?.addEventListener('click', () => {
        openObjectDrawer(obj.object_id);
      });

      dom.objectsRegistryRows.appendChild(row);
    }
  }

  async function renderActivityTimeline() {
    if (!dom.timelineList) return;
    const envId = engine.activeEnvironmentId;
    let events = await engine.storage.getEvents(envId);
    const objects = await engine.storage.getAllObjects(envId);

    if (activeEventFilter !== 'all') {
      events = events.filter((e) => e.event_type === activeEventFilter);
    }

    if (events.length === 0) {
      dom.timelineList.innerHTML = `<li style="padding: 24px; color: var(--slate-gray);">No physical events recorded for this filter.</li>`;
      return;
    }

    dom.timelineList.innerHTML = '';

    for (const evt of events) {
      const obj = objects.find((o) => o.object_id === evt.object_id);
      const name = obj ? obj.canonical_name : 'Physical Asset';
      const timeStr = new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      let thumbHtml = '';
      if (evt.frame_reference) {
        const frame = await engine.storage.getEvidenceFrame(evt.frame_reference);
        if (frame && frame.data_url) {
          thumbHtml = `<img src="${frame.data_url}" class="timeline-entry-thumb" alt="Evidence snapshot"/>`;
        }
      }

      const li = document.createElement('li');
      li.className = 'timeline-event-entry';
      li.innerHTML = `
        <div class="timeline-event-dot"></div>
        <div class="timeline-entry-content">
          <div class="timeline-entry-left">
            <div class="timeline-entry-title-row">
              <span class="event-type-chip ${evt.event_type}">${evt.event_type}</span>
              <span class="timeline-obj-name">${name}</span>
            </div>
            <div class="timeline-route-desc">
              ${evt.previous_location ? `<span>${evt.previous_location}</span> <span class="arrow">→</span>` : ''}
              <strong>${evt.new_location}</strong>
            </div>
            <div class="timeline-entry-meta">Verified ${timeStr} · ${(evt.confidence * 100).toFixed(0)}% confidence · Committed to key-value store</div>
          </div>
          ${thumbHtml}
        </div>
      `;

      dom.timelineList.appendChild(li);
    }
  }

  function renderSearchResult(res) {
    if (!dom.searchResultContainer) return;

    if (!res.success) {
      dom.searchResultContainer.innerHTML = `
        <div class="evidence-reveal-card" style="text-align: center; color: var(--slate-gray);">
          ${res.message || 'No matching physical records found in memory.'}
        </div>
      `;
      return;
    }

    if (res.queryType === 'object_evidence_reveal') {
      const obj = res.object;
      let evidenceImg = '';
      if (res.evidence && res.evidence.data_url) {
        evidenceImg = `<img src="${res.evidence.data_url}" alt="${obj.canonical_name} physical evidence"/>`;
      } else {
        evidenceImg = `<div style="color: rgba(255,255,255,0.4); font-family: var(--font-mono); font-size: 11px; padding: 40px; text-align: center;">NO RETAINED EVIDENCE SNAPSHOT</div>`;
      }

      const historyItems = (res.movementHistory || [])
        .map(
          (h) => `
          <li style="padding: 10px 0; border-bottom: 1px solid var(--line-border); font-size: 13.5px;">
            <div style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-gray); margin-bottom: 2px;">
              ${new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${h.event_type.toUpperCase()}
            </div>
            <div>${h.previous_location ? `${h.previous_location} → ` : ''}<strong>${h.new_location}</strong></div>
          </li>
        `
        )
        .join('');

      dom.searchResultContainer.innerHTML = `
        <div class="evidence-reveal-card">
          <div class="reveal-fact-header">
            <div class="reveal-eyebrow">DETERMINISTIC SPATIAL QUERY RESULT</div>
            <h2 class="reveal-object-title">${obj.canonical_name}</h2>
            <div class="reveal-location-highlight">📍 <strong>${res.lastKnownLocation}</strong></div>
            <div class="reveal-meta-row">
              <span>Last observed: ${res.lastSeenHuman}</span>
              <span>Model Confidence: ${res.confidencePercent}%</span>
              <span>Status: ${res.status.toUpperCase()}</span>
            </div>
            ${res.isStale ? `<div style="color: #b45309; font-size: 12px; margin-top: 8px;">⚠️ ${res.stalenessNote}</div>` : ''}
          </div>

          <div class="reveal-evidence-layout">
            <div class="evidence-snapshot-box">
              ${evidenceImg}
            </div>

            <div class="evidence-history-col">
              <h4>Verified Movement History</h4>
              <ul class="evidence-history-list">
                ${historyItems || '<li style="color: var(--slate-gray); font-size: 13px;">No prior movement events recorded.</li>'}
              </ul>
              <div style="margin-top: 20px;">
                <button class="btn-pill-primary" type="button" id="btnRevealInspectFull">
                  <span>Open Full Detail Drawer →</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('btnRevealInspectFull')?.addEventListener('click', () => {
        openObjectDrawer(obj.object_id);
      });
    }
  }

  async function openObjectDrawer(objectId) {
    const obj = await engine.storage.getObject(objectId);
    if (!obj || !dom.drawerBackdrop) return;

    dom.drawerTitle.textContent = obj.canonical_name;
    dom.drawerSubtitle.textContent = `STATUS: ${obj.status.toUpperCase()} · CURRENT: ${obj.current_location}`;
    if (dom.drawerCategory) dom.drawerCategory.textContent = `${obj.category.toUpperCase()} INDEX`;

    const events = await engine.storage.getEvents(engine.activeEnvironmentId, { objectId });
    const rels = await engine.storage.getRelationshipsForObject(objectId, engine.activeEnvironmentId);

    let frameImg = '';
    if (obj.evidence_frame_ref) {
      const frame = await engine.storage.getEvidenceFrame(obj.evidence_frame_ref);
      if (frame && frame.data_url) {
        frameImg = `<div style="width: 100%; aspect-ratio: 16/9; background: #0f0f10; border-radius: 12px; overflow: hidden; margin-bottom: 24px;"><img src="${frame.data_url}" style="width: 100%; height: 100%; object-fit: contain;"/></div>`;
      }
    }

    const eventList = events
      .map((e, idx) => `
        <div style="display: flex; gap: 14px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1px solid var(--line-border);">
          <div style="font-family: var(--font-mono); font-size: 11px; color: var(--signal-orange); font-weight: 600; width: 24px;">0${idx + 1}</div>
          <div style="flex: 1;">
            <div style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-gray);">
              ${new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div style="font-size: 14px; font-weight: 500; color: var(--ink-black); margin-top: 2px;">
              ${e.previous_location ? `${e.previous_location} → ` : ''}<strong>${e.new_location}</strong>
            </div>
            <div style="font-size: 12px; color: #78716c;">Verified with ${(e.confidence * 100).toFixed(0)}% confidence</div>
          </div>
        </div>
      `)
      .join('');

    dom.drawerBody.innerHTML = `
      ${frameImg}
      <div style="margin-bottom: 24px; padding: 16px; background: var(--pure-white); border: 1px solid var(--line-border); border-radius: 12px;">
        <div style="font-family: var(--font-mono); font-size: 11px; color: var(--slate-gray); text-transform: uppercase; margin-bottom: 6px;">Stationary Spatial Anchors</div>
        <div style="font-size: 13.5px; color: var(--charcoal);">
          ${rels.map((r) => `<div>✦ ${r.relation} ${r.reference_object_id}</div>`).join('') || 'Aligned relative to primary desk reference coordinate frame.'}
        </div>
      </div>
      <h4 style="font-family: var(--font-body); font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--slate-gray); margin: 0 0 16px;">
        Chronological State Transitions
      </h4>
      <div>${eventList || '<div style="color: var(--slate-gray); font-size: 13.5px;">No recorded movement transitions.</div>'}</div>
    `;

    dom.drawerBackdrop.classList.add('is-open');
  }

  function closeDrawer() {
    dom.drawerBackdrop?.classList.remove('is-open');
  }

  // Real-time canvas overlay bounding box renderer
  function startOverlayLoop() {
    const canvas = dom.overlayCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const render = () => {
      const v = dom.video;
      if (v && v.videoWidth && canvas) {
        if (canvas.width !== v.videoWidth || canvas.height !== v.videoHeight) {
          canvas.width = v.videoWidth;
          canvas.height = v.videoHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (showBoundingBoxes && engine && engine.isMonitoring) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(canvas.width * 0.1, canvas.height * 0.1, canvas.width * 0.8, canvas.height * 0.8);
          ctx.setLineDash([]);
        }
      }
      requestAnimationFrame(render);
    };
    requestAnimationFrame(render);
  }

  function formatTimeAgo(date) {
    const sec = Math.floor((new Date() - date) / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    return `${hr}h ago`;
  }

  // Boot on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
