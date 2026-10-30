/**
 * ==============================================================================
 * PHANTOM — BACKEND-BACKED ENGINE
 *
 * Drop-in replacement for the in-browser PhantomEngine that sources its memory
 * from the real Python engine (apps/engine) instead of TensorFlow.js in the tab.
 *
 * It implements the exact interface workspace.js already depends on —
 *   init() · on() · startMonitoring() · stopMonitoring() · queryMemory()
 *   captureAndVerifyNow() · .storage.{getAllObjects,getEvents,getEvidenceFrame,…}
 * — so the existing UI renders backend data with no changes to its render code.
 *
 * WHAT START/PAUSE DOES, HONESTLY
 * The engine's HTTP API is read-only by design: commits happen in-process via the
 * perception loop, never over HTTP. So Start/Pause cannot switch the Python
 * recorder on and off. What it does control is this *session*: it opens the phone
 * camera for the live viewfinder and begins collecting triggers committed from
 * that moment on. Triggers from before you pressed Start stay in History.
 *
 * The phone camera can be opened here and by the engine at the same time — macOS
 * allows several AVFoundation sessions on one Continuity Camera (verified: two
 * concurrent readers both streamed).
 * ==============================================================================
 */
(function (root, factory) {
  if (typeof define === 'function' && define.amd) define([], factory);
  else root.PhantomBackendEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const API = '/api';
  const POLL_MS = 2000;
  const HISTORY_WINDOW_MS = 5 * 60 * 1000; // History keeps the last five minutes.

  /**
   * How the phone identifies itself among the browser's cameras.
   *
   * macOS reports a Continuity Camera by its device name, e.g. "Devansh's iPhone
   * Camera" — matching on this is what keeps us off the built-in webcam. Override
   * with `phoneLabelPattern` if a bridge app (Camo, Iriun) names it differently.
   */
  const PHONE_LABEL = /iphone|continuity|ipad|camo|iriun|droidcam/i;

  /** Coarse taxonomy so the UI's category chips stay meaningful. */
  const CATEGORY_RULES = [
    [/bottle|flask|mug|cup|glass_of|water/, 'hydration'],
    [/phone|laptop|tablet|charger|mouse|keyboard|monitor|remote|watch|earbud|headphone|camera/, 'electronics'],
    [/key|wallet|passport|card|glasses|spectacle|badge|ring/, 'personal'],
    [/pen|pencil|notebook|book|paper|marker|eraser|stapler|scissor/, 'stationery'],
  ];

  function categoryFor(key) {
    const k = String(key || '').toLowerCase();
    for (const [pattern, category] of CATEGORY_RULES) if (pattern.test(k)) return category;
    return 'personal';
  }

  /** "blue_water_bottle" -> "Blue Water Bottle" */
  function humanize(key) {
    return String(key || '')
      .split('_')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  /**
   * How literally a query matches an object key: 2 = whole word, 1 = substring,
   * 0 = neither (the engine's fuzzy matcher reached for it).
   *
   * Used only to order and label results, never to discard them — the engine owns
   * ranking, and a fuzzy hit is sometimes the answer the user wanted.
   */
  function matchStrength(query, key) {
    const q = String(query || '').trim().toLowerCase();
    const words = String(key || '').toLowerCase().split('_').filter(Boolean);
    if (!q) return 0;
    const terms = q.split(/\s+/).filter(Boolean);
    if (terms.some((t) => words.includes(t))) return 2;
    const joined = words.join(' ');
    if (terms.some((t) => joined.includes(t))) return 1;
    return 0;
  }

  async function getJSON(url) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: await res.json() };
  }

  /**
   * Translates the engine's ObjectRecord/HistoryEntry shapes into the shapes the
   * workspace UI already renders. Kept in one place so the field mapping is
   * auditable rather than scattered through render functions.
   */
  class BackendStorage {
    constructor() {
      this._frameUrls = new Map(); // frame_ref -> blob: URL
    }

    /** ObjectRecord[] -> the registry/sidebar shape. */
    async getAllObjects() {
      const { ok, data } = await getJSON(`${API}/objects`);
      if (!ok || !Array.isArray(data)) return [];
      return data.map((r) => ({
        object_id: r.key,
        canonical_name: humanize(r.key),
        category: categoryFor(r.key),
        current_location: r.location || 'unknown',
        confidence: typeof r.confidence === 'number' ? r.confidence : 0,
        last_seen: r.last_seen,
        // The UI's chips read 'confirmed'; keep the engine's own word available.
        status: r.status === 'fresh' ? 'confirmed' : r.status,
        engine_status: r.status,
        evidence_frame_ref: r.frame_ref || null,
        bbox: r.bbox || null,
        relations: r.relations || [],
      }));
    }

    async getObject(objectId) {
      const all = await this.getAllObjects();
      return all.find((o) => o.object_id === objectId) || null;
    }

    /**
     * Movement events across all objects, newest first, limited to the last five
     * minutes. Built from each object's history: the first recorded location is an
     * 'added', every later one a 'moved' carrying where it came from.
     */
    async getEvents() {
      const objects = await this.getAllObjects();
      const cutoff = Date.now() - HISTORY_WINDOW_MS;
      const events = [];

      const lineages = await Promise.all(
        objects.map(async (obj) => {
          const { ok, data } = await getJSON(
            `${API}/objects/${encodeURIComponent(obj.object_id)}/history`
          );
          return { obj, history: ok && Array.isArray(data) ? data : [] };
        })
      );

      for (const { obj, history } of lineages) {
        history.forEach((entry, i) => {
          const at = new Date(entry.at).getTime();
          if (!Number.isFinite(at) || at < cutoff) return;
          events.push({
            event_id: `${obj.object_id}:${i}`,
            event_type: i === 0 ? 'added' : 'moved',
            object_id: obj.object_id,
            canonical_name: obj.canonical_name,
            category: obj.category,
            new_location: entry.location,
            previous_location: i > 0 ? history[i - 1].location : null,
            confidence: entry.confidence,
            timestamp: entry.at,
            frame_reference: obj.evidence_frame_ref,
          });
        });
      }

      events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return events;
    }

    /**
     * The scene screenshot behind a frame_ref.
     *
     * Frames live in the engine's RAM ring buffer and are never written to disk, so
     * a ref only resolves while the perception loop is running and inside its
     * retention window. A 404 here is normal (e.g. seeded data has no frames) and
     * returns null so the UI can fall back instead of erroring.
     */
    async getEvidenceFrame(frameRef) {
      if (!frameRef) return null;
      if (this._frameUrls.has(frameRef)) {
        return { frame_ref: frameRef, data_url: this._frameUrls.get(frameRef) };
      }
      try {
        const res = await fetch(`${API}/frame/${encodeURIComponent(frameRef)}`);
        if (!res.ok) return null;
        const url = URL.createObjectURL(await res.blob());
        this._frameUrls.set(frameRef, url);
        return { frame_ref: frameRef, data_url: url };
      } catch {
        return null;
      }
    }

    async getRelationshipsForObject(objectId) {
      const obj = await this.getObject(objectId);
      if (!obj) return [];
      return (obj.relations || []).map((text) => ({
        relation_type: 'spatial',
        description: text,
        target_object_id: null,
      }));
    }

    /** Memory is owned by the engine; the dashboard may not mutate it. */
    async purgeEvidenceFrames() {
      for (const url of this._frameUrls.values()) URL.revokeObjectURL(url);
      this._frameUrls.clear();
      return { cleared: 'local frame cache only — engine memory is read-only' };
    }

    async resetDatabase() {
      throw new Error(
        'The engine owns this memory and its API is read-only. Reset it by stopping ' +
          'the engine and removing data/phantom.db, then re-running it.'
      );
    }
  }

  class PhantomBackendEngine {
    constructor(options = {}) {
      this.videoElement = options.videoElement || null;
      this.environmentId = options.environmentId || 'env_desk_01';
      this.pollMs = options.pollMs || POLL_MS;
      this.storage = new BackendStorage();

      this._listeners = {};
      this._stream = null;
      this._timer = null;
      this._devices = [];
      this._snapshot = new Map(); // object_id -> location, to spot real changes
      this._motionTimer = null;
      this._lastPixels = null;
      this.isMonitoring = false;
      this.sessionStartedAt = null;
      /** Label of the camera actually streaming, so the UI can show it. */
      this.activeCameraLabel = null;
      /** Opt-in: record the built-in webcam when no phone is present. */
      this.allowBuiltInFallback = options.allowBuiltInFallback === true;
      if (options.phoneLabelPattern) this.phoneLabelPattern = options.phoneLabelPattern;
    }

    // ------------------------------------------------------------------- events
    on(event, callback) {
      (this._listeners[event] = this._listeners[event] || []).push(callback);
      return this;
    }

    _emit(event, payload) {
      for (const cb of this._listeners[event] || []) {
        try {
          cb(payload);
        } catch (err) {
          console.error(`[backend-engine] listener for "${event}" failed`, err);
        }
      }
    }

    // --------------------------------------------------------------------- boot
    async init() {
      const { ok } = await getJSON(`${API}/health`);
      this._emit('statusChange', {
        status: ok ? 'ready' : 'offline',
        detail: ok
          ? 'Engine connected — press Start to open the camera'
          : 'Engine unreachable. Start it with: make run',
      });

      await this._enumerateCameras();
      // Seed the change-detection baseline so pre-existing objects are not
      // reported as brand-new triggers the moment monitoring starts.
      for (const obj of await this.storage.getAllObjects()) {
        this._snapshot.set(obj.object_id, obj.current_location);
      }
      return ok;
    }

    async _enumerateCameras() {
      // Enumerate FIRST, without opening anything. Device labels are hidden until
      // camera permission has been granted, but if it already was, we can identify
      // the phone without touching a camera at all.
      let cams = await this._videoInputs();

      const needPermission = cams.length === 0 || cams.every((d) => !d.label);
      if (needPermission) {
        // Unavoidable one-time prompt: a label-less device list cannot tell us which
        // camera is the phone. Keep it to the shortest possible open, and release
        // immediately — this is why the built-in camera may blink once on first run.
        try {
          const probe = await navigator.mediaDevices.getUserMedia({ video: true });
          probe.getTracks().forEach((t) => t.stop());
          cams = await this._videoInputs();
        } catch (err) {
          this._emit('statusChange', {
            status: 'offline',
            detail: `Camera permission denied (${err.name}) — grant it to show the live view`,
          });
        }
      }

      this._devices = cams.map((d) => ({
        deviceId: d.deviceId,
        label: d.label || 'Camera',
        kind: PHONE_LABEL.test(d.label || '') ? 'continuity' : 'built_in_or_usb',
      }));

      // Phone first. A real comparator — the previous one only inspected `a`, so
      // ordering was undefined and the built-in camera could win.
      this._devices.sort((a, b) => {
        const rank = (d) => (d.kind === 'continuity' ? 0 : 1);
        return rank(a) - rank(b);
      });

      this._emit('devicesDiscovered', this._devices);
      return this._devices;
    }

    async _videoInputs() {
      try {
        const all = await navigator.mediaDevices.enumerateDevices();
        return all.filter((d) => d.kind === 'videoinput');
      } catch {
        return [];
      }
    }

    /** The phone, if the browser can see it. */
    get phoneDevice() {
      return this._devices.find((d) => d.kind === 'continuity') || null;
    }

    get preferredDeviceId() {
      return (this.phoneDevice || {}).deviceId || null;
    }

    // --------------------------------------------------------------- monitoring
    async startMonitoring(deviceId = null) {
      if (this.isMonitoring) return;
      this.sessionStartedAt = Date.now();

      // Re-enumerate: the phone may have connected since init.
      if (!this.phoneDevice) await this._enumerateCameras();

      // Resolve a single status for this attempt and emit it once at the end.
      // Emitting twice would overwrite a specific diagnosis ("phone not found,
      // here is what I can see") with a generic line, hiding the only message
      // that explains what to fix.
      let status = 'active';
      let detail = 'Recording triggers from the engine (no live view)';

      const chosen = this._resolveDevice(deviceId);
      if (!chosen) {
        const names = this._devices.map((d) => d.label).join(', ') || 'none';
        status = 'degraded';
        detail =
          `Phone camera not found (cameras seen: ${names}). Refusing to record the ` +
          `built-in camera instead — still reading engine memory. For Continuity ` +
          `Camera: same Apple ID, Wi-Fi + Bluetooth on, iPhone locked and stationary ` +
          `with rear cameras facing the desk.`;
      } else {
        try {
          this._stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: chosen.deviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });

          // Confirm what actually opened: a constraint can be satisfied by a
          // different device, and silently filming the wrong camera is exactly
          // the failure this guards against.
          const track = this._stream.getVideoTracks()[0];
          const activeLabel = track?.label || chosen.label;
          const acceptable = deviceId ? true : PHONE_LABEL.test(activeLabel);

          if (!acceptable) {
            this._stream.getTracks().forEach((t) => t.stop());
            this._stream = null;
            this.activeCameraLabel = null;
            status = 'degraded';
            detail =
              `Asked for "${chosen.label}" but the stream came back as ` +
              `"${activeLabel}" — stopped rather than record the wrong camera.`;
          } else {
            this.activeCameraLabel = activeLabel;
            if (this.videoElement) {
              this.videoElement.srcObject = this._stream;
              await this.videoElement.play().catch(() => {});
            }
            status = 'active';
            detail = `Live: ${activeLabel} — recording triggers from the engine`;
          }
        } catch (err) {
          status = 'degraded';
          detail = `Could not open ${chosen.label} (${err.name}) — still reading engine memory`;
        }
      }

      this.isMonitoring = true;
      this._emit('statusChange', { status, detail });

      this._poll();
      this._timer = setInterval(() => this._poll(), this.pollMs);
      this._startMotionMeter();
    }

    /**
     * Which camera to open.
     *
     * An explicit choice (the camera dropdown) always wins. Otherwise only the
     * phone is acceptable: defaulting to whatever is first silently records the
     * built-in webcam, which looks like the system working while watching the
     * wrong scene. Set `allowBuiltInFallback: true` to opt into that.
     */
    _resolveDevice(deviceId) {
      if (deviceId) {
        return this._devices.find((d) => d.deviceId === deviceId) || { deviceId, label: 'selected camera' };
      }
      if (this.phoneDevice) return this.phoneDevice;
      if (this.allowBuiltInFallback && this._devices.length) return this._devices[0];
      return null;
    }

    stopMonitoring() {
      if (!this.isMonitoring) return;
      clearInterval(this._timer);
      this._timer = null;
      this._stopMotionMeter();

      if (this._stream) {
        this._stream.getTracks().forEach((t) => t.stop());
        this._stream = null;
      }
      if (this.videoElement) this.videoElement.srcObject = null;
      this.activeCameraLabel = null;

      this.isMonitoring = false;
      this._emit('statusChange', { status: 'standby', detail: 'Paused — history retained' });
    }

    /**
     * One poll: diff the engine's objects against our snapshot and announce only
     * genuine changes. The engine has already filtered transient motion (a hand
     * reaching in never commits), so anything appearing here is a real change.
     */
    async _poll() {
      const objects = await this.storage.getAllObjects();
      const changes = [];

      for (const obj of objects) {
        const previous = this._snapshot.get(obj.object_id);
        if (previous === undefined) {
          changes.push({
            object_id: obj.object_id,
            canonical_name: obj.canonical_name,
            event_type: 'added',
            previous_location: null,
            new_location: obj.current_location,
            confidence: obj.confidence,
            frame_reference: obj.evidence_frame_ref,
          });
        } else if (previous !== obj.current_location) {
          changes.push({
            object_id: obj.object_id,
            canonical_name: obj.canonical_name,
            event_type: 'moved',
            previous_location: previous,
            new_location: obj.current_location,
            confidence: obj.confidence,
            frame_reference: obj.evidence_frame_ref,
          });
        }
        this._snapshot.set(obj.object_id, obj.current_location);
      }

      if (changes.length) this._emit('observationCommitted', { changes, objects });
      return changes;
    }

    async captureAndVerifyNow() {
      const changes = await this._poll();
      return { changes, verified_at: new Date().toISOString() };
    }

    // ------------------------------------------------------------------- search
    /**
     * Ranked matches for a keyword or question.
     *
     * The engine ranks with rapidfuzz (exact key -> alias -> fuzzy), so "bottle"
     * finds "blue_water_bottle" with no LLM in the path. Its fuzzy threshold is
     * permissive though — measured live, "bottle" also returned "tv_remote" and
     * "glasses" returned "keys". Rather than hide those (the engine owns ranking,
     * and a loose match is occasionally the right answer) each hit is scored for
     * whether the query actually occurs in the object's name, and strong matches
     * are surfaced first with weak ones marked.
     */
    async queryMemory(queryString) {
      const text = String(queryString || '').trim();
      if (!text) return { query: '', results: [], answer: null };

      const { ok, data } = await getJSON(`${API}/query?q=${encodeURIComponent(text)}`);
      if (!ok || !Array.isArray(data) || data.length === 0) {
        return {
          query: text,
          results: [],
          answer: `No memory matches "${text}".`,
        };
      }

      const results = await Promise.all(
        data.map(async (r) => {
          const [history, reveal] = await Promise.all([
            getJSON(`${API}/objects/${encodeURIComponent(r.key)}/history`),
            getJSON(`${API}/reveal/${encodeURIComponent(r.key)}`),
          ]);
          const frame = await this.storage.getEvidenceFrame(r.frame_ref);
          return {
            object_id: r.key,
            canonical_name: humanize(r.key),
            category: categoryFor(r.key),
            current_location: r.location,
            confidence: r.confidence,
            last_seen: r.last_seen,
            status: r.status,
            match_strength: matchStrength(text, r.key),
            bbox: reveal.ok ? reveal.data.bbox : r.bbox || null,
            trust_card: reveal.ok ? reveal.data.card : null,
            history: history.ok ? history.data : [],
            evidence: frame,
          };
        })
      );

      // Stable: keep the engine's order within a strength tier.
      results.sort((a, b) => b.match_strength - a.match_strength);

      const top = results[0];
      const weakOnly = top.match_strength === 0;
      return {
        query: text,
        results,
        answer: weakOnly
          ? `Nothing named "${text}". Closest guess: ${top.canonical_name} — ${top.current_location}.`
          : top.trust_card
            ? top.trust_card.message
            : `${top.canonical_name}: ${top.current_location}`,
      };
    }

    // -------------------------------------------------------------- motion view
    /**
     * Drives the motion meter from the live preview.
     *
     * This is the browser's own view of the scene, not the engine's gate score —
     * the engine decides what to commit, and this only gives the operator
     * something responsive to look at.
     */
    _startMotionMeter() {
      if (!this.videoElement) return;
      const canvas = document.createElement('canvas');
      canvas.width = 160;
      canvas.height = 90;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      this._motionTimer = setInterval(() => {
        const v = this.videoElement;
        if (!v || v.readyState < 2) return;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const gray = new Uint8Array(canvas.width * canvas.height);
        for (let i = 0, p = 0; i < data.length; i += 4, p++) {
          gray[p] = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) | 0;
        }
        if (this._lastPixels) {
          let changed = 0;
          for (let i = 0; i < gray.length; i++) {
            if (Math.abs(gray[i] - this._lastPixels[i]) > 25) changed++;
          }
          this._emit('motionScore', changed / gray.length);
        }
        this._lastPixels = gray;
      }, 400);
    }

    _stopMotionMeter() {
      clearInterval(this._motionTimer);
      this._motionTimer = null;
      this._lastPixels = null;
      this._emit('motionScore', 0);
    }
  }

  PhantomBackendEngine.BackendStorage = BackendStorage;
  PhantomBackendEngine.humanize = humanize;
  PhantomBackendEngine.categoryFor = categoryFor;
  return PhantomBackendEngine;
});
