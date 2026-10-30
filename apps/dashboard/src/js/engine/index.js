/**
 * ==============================================================================
 * PHANTOM SPATIAL INTELLIGENCE PLATFORM — SHARED ENGINE CORE
 * Master Engine Coordinator: Capture -> Change Detection -> Vision ->
 * Spatial Memory -> Continuous Key-Value Store -> Deterministic Search
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['./storage', './capture', './change-detection', './vision', './spatial-memory', './search'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('./storage'),
      require('./capture'),
      require('./change-detection'),
      require('./vision'),
      require('./spatial-memory'),
      require('./search')
    );
  } else {
    root.PhantomEngine = factory(
      root.PhantomStorage,
      root.PhantomCapture,
      root.PhantomChangeDetector,
      root.PhantomVision,
      root.PhantomSpatialMemory,
      root.PhantomSearch
    );
  }
})(typeof self !== 'undefined' ? self : this, function (
  PhantomStorage,
  PhantomCapture,
  PhantomChangeDetector,
  PhantomVision,
  PhantomSpatialMemory,
  PhantomSearch
) {
  'use strict';

  class PhantomEngine {
    constructor(options = {}) {
      this.options = options;
      this.activeEnvironmentId = options.environmentId || 'env_desk_01';
      this.isMonitoring = false;

      // Event emitter callbacks
      this.listeners = {
        statusChange: [],
        devicesDiscovered: [],
        motionScore: [],
        settling: [],
        observationCommitted: [],
        error: []
      };

      // 1. Storage
      this.storage = new PhantomStorage();

      // 2. Capture
      this.capture = new PhantomCapture({
        videoElement: options.videoElement || null,
        resolution: options.resolution || '1280x720',
        onStatusChange: (status, detail) => this._emit('statusChange', { status, detail }),
        onDevicesDiscovered: (devices) => this._emit('devicesDiscovered', devices),
        onError: (err) => this._emit('error', err)
      });

      // 3. Vision
      this.vision = new PhantomVision({
        minConfidence: 0.35,
        onInferenceModeChange: (mode) => console.log(`[PhantomEngine] Vision mode: ${mode}`)
      });

      // 4. Spatial Memory
      this.spatialMemory = new PhantomSpatialMemory(this.storage);

      // 5. Change Detector
      this.changeDetector = new PhantomChangeDetector(this.capture, {
        motionThreshold: options.motionThreshold || 0.04,
        settlingDelay: options.settlingDelay || 1500,
        checkInterval: 400,
        onMotion: (score) => this._emit('motionScore', score),
        onSettling: (rem, total) => this._emit('settling', { remaining: rem, total: total }),
        onSceneStabilized: (snapshot) => this._handleSceneStabilized(snapshot)
      });

      // 6. Search
      this.search = new PhantomSearch(this.storage);
    }

    async init() {
      await this.storage.ready();
      // Ensure seed data exists for demonstration
      await this.storage.seedInitialData(false);
      // Discover available cameras
      await this.capture.discoverCameras();
      console.log('[PhantomEngine] Engine initialized successfully.');
      return this;
    }

    on(event, callback) {
      if (this.listeners[event]) {
        this.listeners[event].push(callback);
      }
      return this;
    }

    _emit(event, data) {
      if (this.listeners[event]) {
        this.listeners[event].forEach((cb) => {
          try {
            cb(data);
          } catch (e) {
            console.error(`[PhantomEngine] Listener error on "${event}":`, e);
          }
        });
      }
    }

    async startMonitoring(deviceId = null) {
      if (this.isMonitoring) return true;

      let connected = false;
      if (this.capture.videoElement && !this.capture.currentStream && !this.capture.isOfflineVideo) {
        connected = await this.capture.connectCamera(deviceId);
      } else {
        connected = true;
      }

      if (connected) {
        this.isMonitoring = true;
        this.changeDetector.start();
        this._emit('statusChange', { status: 'monitoring-active', detail: 'Monitoring active: observing physical changes.' });
        return true;
      }
      return false;
    }

    stopMonitoring() {
      this.isMonitoring = false;
      this.changeDetector.stop();
      this._emit('statusChange', { status: 'monitoring-paused', detail: 'Monitoring paused.' });
    }

    /**
     * Stage 2 semantic processing pipeline invoked when scene stabilizes
     */
    async _handleSceneStabilized(snapshot) {
      console.log('[PhantomEngine] Scene stabilized. Promoting to Stage 2 Semantic Verification...');

      try {
        const frameRef = `frame_${Date.now()}`;
        // Store evidence snapshot in persistent storage
        await this.storage.storeEvidenceFrame(frameRef, snapshot.dataUrl, {
          environment_id: this.activeEnvironmentId,
          timestamp: snapshot.timestamp
        });

        // Run object detection on stable video frame
        const detections = await this.vision.detectObjects(this.capture.videoElement);
        console.log(`[PhantomEngine] Vision model detected ${detections.length} candidate objects.`, detections);

        // Evaluate deltas and entity resolution
        const deltaResult = await this.spatialMemory.evaluateSceneDeltas(
          this.activeEnvironmentId,
          detections,
          frameRef
        );

        console.log('[PhantomEngine] Committed observation state change:', deltaResult);
        this._emit('observationCommitted', deltaResult);
        return deltaResult;
      } catch (err) {
        console.error('[PhantomEngine] Error during semantic scene verification:', err);
        this._emit('error', err);
      }
    }

    /**
     * Manual snapshot & verification trigger
     */
    async captureAndVerifyNow() {
      const snapshot = this.capture.captureFrameSnapshot('image/jpeg', 0.9);
      if (snapshot) {
        return this._handleSceneStabilized(snapshot);
      }
      return null;
    }

    /**
     * Execute deterministic natural language query
     */
    async queryMemory(queryString) {
      return this.search.executeQuery(this.activeEnvironmentId, queryString);
    }
  }

  return PhantomEngine;
});
