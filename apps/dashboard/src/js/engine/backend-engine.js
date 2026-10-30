/**
 * ==============================================================================
 * PHANTOM — LIVE ENGINE CLIENT
 *
 * The workspace page's only data source. Everything it exposes comes from the
 * Python engine over /api — nothing is generated, seeded or simulated here:
 *
 *   /api/engine            telemetry: camera, gate, VLM, scans (polled ~1s)
 *   /api/engine/events     the trigger log: every VLM result the loop committed
 *   /api/objects           current memory, one record per object
 *   /api/query?q=          the engine's ranked keyword match
 *   /api/objects/{k}/history, /api/reveal/{k}, /api/frame/{ref}
 *
 * The engine watches the phone on its own from the moment run_all.py starts. The
 * page's Start/Pause controls only the *live preview*: the browser opens the same
 * iPhone camera to show what the engine is watching. macOS allows several
 * AVFoundation sessions on one Continuity Camera, so both run at once.
 *
 * Camera choice is strict: the preview opens the phone, or nothing. Defaulting to
 * whichever camera comes first silently shows the built-in webcam, which looks
 * like the system working while watching the wrong scene.
 * ==============================================================================
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else root.PhantomBackendEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const API = '/api';
  const POLL_MS = 1000;
  const OBJECT_REFRESH_MS = 5000;
  /** The History section keeps the last five minutes of triggers. */
  const HISTORY_WINDOW_MS = 5 * 60 * 1000;

  /**
   * How the phone identifies itself among the browser's cameras. macOS reports a
   * Continuity Camera by device name, e.g. "Devansh's iPhone Camera".
   */
  const PHONE_LABEL = /iphone|continuity|ipad|camo|iriun|droidcam/i;

  /** Words that carry no meaning for an object lookup ("where is my phone?"). */
  const STOPWORDS = new Set(
    ('a an the is are was were be been my your our his her their its this that these those ' +
      'where wheres what whats when which who how did does do i me we you it on in at of to ' +
      'for from by with last seen find show tell put left kept now currently there here please ' +
      'item thing object').split(' ')
  );

  /** Client-side grouping for the category chips; derived from the VLM's key. */
  const CATEGORY_RULES = [
    [/bottle|flask|mug|cup|glass|tumbler|water|drink|can\b/, 'hydration'],
    [/phone|laptop|tablet|ipad|charger|cable|mouse|keyboard|monitor|display|remote|watch|earbud|airpod|headphone|camera|speaker|controller|power_bank/, 'electronics'],
    [/key|wallet|passport|card|glasses|spectacle|sunglass|badge|ring|bag|purse|cap|hat/, 'personal'],
    [/pen|pencil|notebook|book|paper|note|marker|eraser|stapler|scissor|diary|folder/, 'stationery'],
  ];

  function categoryFor(key) {
    const k = String(key || '').toLowerCase();
    for (const [pattern, category] of CATEGORY_RULES) if (pattern.test(k)) return category;
    return 'other';
  }

  /** "pink_keyboard" -> "Pink Keyboard" */
  function humanize(key) {
    return String(key || '')
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  function queryTerms(text) {
    const words = String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/[\s_-]+/)
      .filter(Boolean);
    const meaningful = words.filter((w) => !STOPWORDS.has(w) && w.length > 1);
    return meaningful.length ? meaningful : words;
  }

  /**
   * How literally the query matches an object, used to order and label results:
   * 3 = whole word of the key, 2 = substring of the key, 1 = found in the VLM's
   * description (location/relations), 0 = the engine's fuzzy matcher reached for it.
   */
  function matchStrength(terms, obj) {
    const words = String(obj.key || '').toLowerCase().split('_').filter(Boolean);
    if (terms.some((t) => words.includes(t))) return 3;
    const joined = words.join(' ');
    if (terms.some((t) => joined.includes(t))) return 2;
    const description = [obj.location, ...(obj.relations || [])].join(' ').toLowerCase();
    if (terms.some((t) => description.includes(t))) return 1;
    return 0;
  }

  /**
   * Fetch JSON from the engine.
   *
   * User-initiated calls (`announce: true`) are reported on `window` as
   * `phantom:api` events, which the endpoint inspector (press ~) logs live. The
   * once-a-second telemetry polls are not, or they would bury the calls a click
   * actually made.
   */
  async function getJSON(url, { announce = false } = {}) {
    const started = performance.now();
    const report = (status, ok) => {
      if (!announce) return;
      window.dispatchEvent(
        new CustomEvent('phantom:api', {
          detail: { method: 'GET', url, status, ok, ms: Math.round(performance.now() - started) },
        })
      );
    };
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const type = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
      if (!res.ok) {
        report(res.status, false);
        return { ok: false, status: res.status, data: null };
      }
      if (!type.includes('application/json')) {
        // A dev server that does not proxy /api answers with its HTML fallback.
        report(res.status, false);
        return { ok: false, status: res.status, data: null, notJson: true };
      }
      const data = await res.json();
      report(res.status, true);
      return { ok: true, status: res.status, data };
    } catch (err) {
      report(0, false);
      return { ok: false, status: 0, data: null, error: String(err) };
    }
  }

  /** Engine ObjectRecord -> the shape the page renders. */
  function mapObject(r) {
    return {
      key: r.key,
      name: humanize(r.key),
      category: categoryFor(r.key),
      location: r.location || null,
      relations: Array.isArray(r.relations) ? r.relations : [],
      confidence: typeof r.confidence === 'number' ? r.confidence : 0,
      last_seen: r.last_seen,
      status: r.status, // fresh | stale | ambiguous | removed (engine's own word)
      frame_ref: r.frame_ref || null,
      bbox: r.bbox || null,
    };
  }

  /** Trigger-log entry -> page shape. */
  function mapTrigger(e) {
    return {
      seq: e.seq,
      kind: e.kind, // startup_scan | scan | change
      event: e.event, // appeared | moved | removed | unchanged | ambiguous
      key: e.object,
      name: humanize(e.object),
      from: e.from || null,
      to: e.to || null,
      relations: Array.isArray(e.relations) ? e.relations : [],
      confidence: typeof e.confidence === 'number' ? e.confidence : 0,
      bbox: e.bbox || null,
      frame_ref: e.frame_ref || null,
      observed_at: e.observed_at,
      status: e.status || null,
      latency_ms: e.vlm_latency_ms,
      model: e.model,
    };
  }

  class PhantomBackendEngine {
    constructor(options = {}) {
      this.videoElement = options.videoElement || null;
      this.pollMs = options.pollMs || POLL_MS;
      /** Opt-in: preview the built-in webcam when no phone is present. */
      this.allowBuiltInFallback = options.allowBuiltInFallback === true;

      this._listeners = {};
      this._devices = [];
      this._stream = null;
      this._previewResolution = { width: 1920, height: 1080 };
      this._frameUrls = new Map(); // frame_ref -> blob: URL (or null if evicted)
      this._timer = null;
      this._cursor = 0;
      this._lastObjectsFetch = 0;

      /** Live state, all straight from the engine. */
      this.reachable = null;
      this.telemetry = null;
      this.session = null;
      this.objects = [];
      this.triggers = []; // last five minutes, oldest first
      this.isMonitoring = false; // live preview open
      this.activeCameraLabel = null;
    }

    // ------------------------------------------------------------------ events
    on(event, callback) {
      (this._listeners[event] = this._listeners[event] || []).push(callback);
      return this;
    }

    _emit(event, payload) {
      for (const cb of this._listeners[event] || []) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[phantom] listener for "${event}" failed`, err);
        }
      }
    }

    // -------------------------------------------------------------------- boot
    async init() {
      // No camera prompt on page load: opening the page must not turn a camera on.
      await this._enumerateCameras({ allowPrompt: false });
      await this.sync({ forceObjects: true });
      this._timer = setInterval(() => this.sync(), this.pollMs);
      return this.reachable;
    }

    dispose() {
      clearInterval(this._timer);
      this.stopMonitoring();
    }

    // ------------------------------------------------------------- engine sync
    /**
     * One poll: telemetry, new triggers since the cursor, and memory when it may
     * have changed. Detects an engine restart by its session id and starts over,
     * so a previous session's triggers never leak into the current one.
     */
    async sync({ forceObjects = false } = {}) {
      const [tel, ev] = await Promise.all([
        getJSON(`${API}/engine`),
        getJSON(`${API}/engine/events?since=${this._cursor}`),
      ]);

      const reachable = tel.ok;
      if (reachable !== this.reachable) {
        this.reachable = reachable;
        this._emit('engine', { reachable, notJson: Boolean(tel.notJson) });
      }
      if (!reachable) return;

      const t = tel.data;
      if (t.session && t.session !== this.session) {
        const restarted = this.session !== null;
        this.session = t.session;
        this._cursor = 0;
        this.triggers = [];
        if (restarted) {
          this._emit('session', { session: t.session });
          return this.sync({ forceObjects: true });
        }
      }
      this.telemetry = t;
      this._emit('telemetry', t);

      let fresh = [];
      if (ev.ok && ev.data && ev.data.session === this.session) {
        fresh = (ev.data.events || []).map(mapTrigger);
        if (fresh.length) {
          this._cursor = fresh[fresh.length - 1].seq;
          this.triggers.push(...fresh);
        }
      }
      const pruned = this._prune();

      const due = Date.now() - this._lastObjectsFetch > OBJECT_REFRESH_MS;
      if (forceObjects || fresh.length || due) await this._refreshObjects();
      if (fresh.length || pruned) this._emit('triggers', { all: this.triggers, added: fresh });
    }

    _prune() {
      const cutoff = Date.now() - HISTORY_WINDOW_MS;
      const before = this.triggers.length;
      this.triggers = this.triggers.filter((e) => new Date(e.observed_at).getTime() >= cutoff);
      return this.triggers.length !== before;
    }

    async _refreshObjects() {
      const res = await getJSON(`${API}/objects`);
      this._lastObjectsFetch = Date.now();
      if (!res.ok || !Array.isArray(res.data)) return;
      this.objects = res.data.map(mapObject).sort(
        (a, b) => new Date(b.last_seen) - new Date(a.last_seen)
      );
      this._emit('objects', this.objects);
    }

    // ------------------------------------------------------------- object data
    async objectDetail(key) {
      const k = encodeURIComponent(key);
      const [history, reveal] = await Promise.all([
        getJSON(`${API}/objects/${k}/history`, { announce: true }),
        getJSON(`${API}/reveal/${k}`, { announce: true }),
      ]);
      const object = this.objects.find((o) => o.key === key) || null;
      const frameRef = (reveal.ok && reveal.data.frame_ref) || (object && object.frame_ref);
      return {
        object,
        history: history.ok && Array.isArray(history.data) ? history.data : [],
        card: reveal.ok ? reveal.data.card : null,
        bbox: reveal.ok ? reveal.data.bbox : object && object.bbox,
        frame: await this.frameDataUrl(frameRef),
        triggers: this.triggers.filter((e) => e.key === key),
      };
    }

    /**
     * Blob URL for a screenshot, or null.
     *
     * Frames live in the engine's RAM ring buffer and are never written to disk,
     * so a ref resolves only while the engine runs and within its retention. A 404
     * is normal and cached as null so the UI shows "no screenshot" instead of
     * re-requesting it every render.
     */
    async frameDataUrl(frameRef) {
      if (!frameRef) return null;
      if (this._frameUrls.has(frameRef)) return this._frameUrls.get(frameRef);
      try {
        const started = performance.now();
        const url = `${API}/frame/${encodeURIComponent(frameRef)}`;
        const res = await fetch(url);
        window.dispatchEvent(
          new CustomEvent('phantom:api', {
            detail: { method: 'GET', url, status: res.status, ok: res.ok, ms: Math.round(performance.now() - started) },
          })
        );
        const blobUrl = res.ok ? URL.createObjectURL(await res.blob()) : null;
        this._frameUrls.set(frameRef, blobUrl);
        return blobUrl;
      } catch {
        return null;
      }
    }

    clearFrameCache() {
      for (const url of this._frameUrls.values()) if (url) URL.revokeObjectURL(url);
      this._frameUrls.clear();
    }

    // ------------------------------------------------------------------ search
    /**
     * Find objects for a keyword or question ("bottle", "where is my phone?").
     *
     * Each meaningful word goes to the engine's ranked match (exact -> alias ->
     * fuzzy). Objects whose VLM description mentions a word are added too, so
     * "laptop" also finds things "left of the laptop". The engine's fuzzy matcher
     * is permissive, so results are ordered by how literally they match and weak
     * ones are labelled rather than hidden.
     */
    async search(text) {
      const query = String(text || '').trim();
      if (!query) return { query, terms: [], matches: [] };
      const terms = queryTerms(query).slice(0, 4);

      const merged = new Map();
      const responses = await Promise.all(
        terms.map((t) => getJSON(`${API}/query?q=${encodeURIComponent(t)}`, { announce: true }))
      );
      responses.forEach((res) => {
        if (!res.ok || !Array.isArray(res.data)) return;
        res.data.forEach((r, rank) => {
          const prev = merged.get(r.key);
          if (!prev || rank < prev.rank) merged.set(r.key, { obj: mapObject(r), rank });
        });
      });
      for (const obj of this.objects) {
        if (!merged.has(obj.key) && matchStrength(terms, obj) > 0) {
          merged.set(obj.key, { obj, rank: 99 });
        }
      }

      const matches = [...merged.values()]
        .map(({ obj, rank }) => ({ ...obj, strength: matchStrength(terms, obj), rank }))
        .sort((a, b) => b.strength - a.strength || a.rank - b.rank);

      const top = matches[0] ? await this.objectDetail(matches[0].key) : null;
      return { query, terms, matches, top };
    }

    // ------------------------------------------------------------ live preview
    /**
     * List cameras. Device labels are hidden until camera permission is granted,
     * and without labels the phone cannot be told apart. Getting permission means
     * briefly opening *some* camera — the browser picks the default (the built-in).
     * So that only happens on an explicit Start (`allowPrompt`), once, and is
     * released immediately; after permission is granted no probe is needed.
     */
    async _enumerateCameras({ allowPrompt = false } = {}) {
      let cams = await this._videoInputs();
      const labelsHidden = cams.length === 0 || cams.every((d) => !d.label);
      this.permissionNeeded = labelsHidden;
      if (labelsHidden && allowPrompt) {
        try {
          const probe = await navigator.mediaDevices.getUserMedia({ video: true });
          probe.getTracks().forEach((t) => t.stop());
          cams = await this._videoInputs();
          this.permissionNeeded = cams.every((d) => !d.label);
        } catch (err) {
          this._emit('statusChange', {
            status: 'permission-required',
            detail: `Camera permission denied (${err.name}) — allow it to show the live view`,
          });
        }
      }

      this._devices = cams.map((d) => ({
        deviceId: d.deviceId,
        label: d.label || 'Camera',
        kind: PHONE_LABEL.test(d.label || '') ? 'continuity' : 'built_in_or_usb',
      }));
      const rank = (d) => (d.kind === 'continuity' ? 0 : 1);
      this._devices.sort((a, b) => rank(a) - rank(b));
      this._emit('devicesDiscovered', this._devices);
      return this._devices;
    }

    async _videoInputs() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
        const all = await navigator.mediaDevices.enumerateDevices();
        return all.filter((d) => d.kind === 'videoinput');
      } catch {
        return [];
      }
    }

    get devices() {
      return this._devices;
    }

    get phoneDevice() {
      return this._devices.find((d) => d.kind === 'continuity') || null;
    }

    get preferredDeviceId() {
      return (this.phoneDevice || {}).deviceId || null;
    }

    /** An explicit choice wins; otherwise only the phone is acceptable. */
    _resolveDevice(deviceId) {
      if (deviceId) {
        return (
          this._devices.find((d) => d.deviceId === deviceId) || { deviceId, label: 'selected camera' }
        );
      }
      if (this.phoneDevice) return this.phoneDevice;
      if (this.allowBuiltInFallback && this._devices.length) return this._devices[0];
      return null;
    }

    /** Open the live preview of the phone camera. */
    async startMonitoring(deviceId = null) {
      if (this.isMonitoring) return;
      if (!this.phoneDevice) await this._enumerateCameras({ allowPrompt: true });

      // One status per attempt: a second emit would overwrite the diagnosis.
      let status = 'monitoring-active';
      let detail = '';

      const chosen = this._resolveDevice(deviceId);
      if (!chosen) {
        const names = this._devices.map((d) => d.label).join(', ') || 'none';
        status = 'no-camera';
        detail =
          `Phone camera not found (cameras seen: ${names}). Refusing to show the built-in ` +
          `camera instead. The engine keeps watching through its own connection.`;
      } else {
        try {
          const { width, height } = this._previewResolution;
          this._stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: chosen.deviceId },
              width: { ideal: width },
              height: { ideal: height },
            },
            audio: false,
          });
          // Confirm what actually opened: a deviceId constraint can be satisfied
          // by a different device.
          const track = this._stream.getVideoTracks()[0];
          const activeLabel = (track && track.label) || chosen.label;
          const acceptable = deviceId ? true : PHONE_LABEL.test(activeLabel);
          if (!acceptable) {
            this._stream.getTracks().forEach((t) => t.stop());
            this._stream = null;
            this.activeCameraLabel = null;
            status = 'camera-unavailable';
            detail =
              `Asked for "${chosen.label}" but the stream came back as "${activeLabel}" — ` +
              `stopped rather than show the wrong camera.`;
          } else {
            this.activeCameraLabel = activeLabel;
            if (this.videoElement) {
              this.videoElement.srcObject = this._stream;
              await this.videoElement.play().catch(() => {});
            }
            detail = `Live: ${activeLabel}`;
          }
        } catch (err) {
          status = 'camera-unavailable';
          detail = `Could not open ${chosen.label} (${err.name})`;
        }
      }

      this.isMonitoring = status === 'monitoring-active';
      this._emit('statusChange', { status, detail });
    }

    stopMonitoring() {
      if (this._stream) {
        this._stream.getTracks().forEach((t) => t.stop());
        this._stream = null;
      }
      if (this.videoElement) this.videoElement.srcObject = null;
      const was = this.isMonitoring;
      this.isMonitoring = false;
      this.activeCameraLabel = null;
      if (was) {
        this._emit('statusChange', {
          status: 'monitoring-paused',
          detail: 'Preview paused — the engine is still watching',
        });
      }
    }

    async setPreviewResolution(width, height) {
      this._previewResolution = { width, height };
      if (this.isMonitoring) {
        const label = this.activeCameraLabel;
        const id = (this._devices.find((d) => d.label === label) || {}).deviceId || null;
        this.stopMonitoring();
        await this.startMonitoring(id);
      }
    }

    /** Actual delivered preview size, from the live track (not what was asked for). */
    get previewSettings() {
      const track = this._stream && this._stream.getVideoTracks()[0];
      return track && track.getSettings ? track.getSettings() : null;
    }
  }

  PhantomBackendEngine.humanize = humanize;
  PhantomBackendEngine.categoryFor = categoryFor;
  PhantomBackendEngine.queryTerms = queryTerms;
  PhantomBackendEngine.matchStrength = matchStrength;
  PhantomBackendEngine.HISTORY_WINDOW_MS = HISTORY_WINDOW_MS;
  return PhantomBackendEngine;
});
