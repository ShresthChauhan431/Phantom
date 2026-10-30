/**
 * ==============================================================================
 * PHANTOM SPATIAL INTELLIGENCE PLATFORM — SHARED ENGINE
 * Module: Change Detection — The Gate
 * Capabilities: Two-Stage Observation System, Low-Cost Pixel Differencing,
 * Motion Noise Filtering, Configurable Settling Window, Semantic Trigger
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PhantomChangeDetector = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class PhantomChangeDetector {
    constructor(captureSystem, options = {}) {
      this.capture = captureSystem;

      // Configurable thresholds
      this.motionThreshold = options.motionThreshold !== undefined ? options.motionThreshold : 0.04; // 4% of pixels changed
      this.pixelDeltaThreshold = options.pixelDeltaThreshold !== undefined ? options.pixelDeltaThreshold : 26; // Grayscale intensity diff (0-255)
      this.settlingDelay = options.settlingDelay !== undefined ? options.settlingDelay : 1500; // ms to wait after motion stops
      this.checkInterval = options.checkInterval !== undefined ? options.checkInterval : 400; // ms between Stage 1 cheap checks

      // Internal state
      this.isRunning = false;
      this.loopTimer = null;
      this.referenceGrayscale = null;
      this.width = 160;
      this.height = 120;

      // Settling state machine: 'IDLE' | 'MOTION_DETECTED' | 'SETTLING' | 'STABILIZED'
      this.state = 'IDLE';
      this.settlingStartTime = null;
      this.latestMotionScore = 0.0;

      // Callbacks
      this.onMotion = options.onMotion || (() => {});
      this.onSettling = options.onSettling || (() => {});
      this.onSceneStabilized = options.onSceneStabilized || (() => {});
      this.onStateChange = options.onStateChange || (() => {});
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.state = 'IDLE';
      this.referenceGrayscale = null;
      this._scheduleNextCheck();
      this.onStateChange(this.state);
      console.log('[PhantomChangeDetector] Started cheap change detection.');
    }

    stop() {
      this.isRunning = false;
      if (this.loopTimer) {
        clearTimeout(this.loopTimer);
        this.loopTimer = null;
      }
      this.state = 'IDLE';
      this.onStateChange(this.state);
      console.log('[PhantomChangeDetector] Stopped change detection.');
    }

    _scheduleNextCheck() {
      if (!this.isRunning) return;
      this.loopTimer = setTimeout(() => this._tick(), this.checkInterval);
    }

    _tick() {
      if (!this.isRunning) return;

      const frameData = this.capture.getDownsampledFrame(this.width, this.height);
      if (!frameData) {
        this._scheduleNextCheck();
        return;
      }

      const currentGrayscale = this._toGrayscale(frameData.data);

      if (!this.referenceGrayscale) {
        // Establish initial reference baseline
        this.referenceGrayscale = currentGrayscale;
        this._scheduleNextCheck();
        return;
      }

      // Compute pixel difference against committed baseline
      const score = this._computeDifference(this.referenceGrayscale, currentGrayscale);
      this.latestMotionScore = score;
      this.onMotion(score);

      const hasMeaningfulMotion = score >= this.motionThreshold;
      const now = performance.now();

      if (hasMeaningfulMotion) {
        // Scene is currently changing (e.g. hand in frame, object being picked up/moved)
        if (this.state !== 'MOTION_DETECTED') {
          this.state = 'MOTION_DETECTED';
          this.onStateChange(this.state, { motionScore: score });
        }
        this.settlingStartTime = null; // Reset settling clock while active motion occurs
      } else {
        // Scene motion has subsided below threshold
        if (this.state === 'MOTION_DETECTED') {
          // Transition into SETTLING
          this.state = 'SETTLING';
          this.settlingStartTime = now;
          this.onStateChange(this.state, { settlingDelay: this.settlingDelay });
        }

        if (this.state === 'SETTLING') {
          const elapsed = now - this.settlingStartTime;
          const remaining = Math.max(0, this.settlingDelay - elapsed);
          this.onSettling(remaining, this.settlingDelay);

          if (elapsed >= this.settlingDelay) {
            // Scene has remained stable for the full settling window!
            // Promote stable end-state frame to Stage 2 Semantic Verification
            this.state = 'STABILIZED';
            this.onStateChange(this.state);

            // Capture high-fidelity stable frame snapshot
            const stableSnapshot = this.capture.captureFrameSnapshot('image/jpeg', 0.9);

            // Update committed reference baseline to this settled frame
            this.referenceGrayscale = currentGrayscale;

            // Fire Stage 2 semantic trigger
            if (stableSnapshot) {
              this.onSceneStabilized(stableSnapshot);
            }

            // Return to IDLE state waiting for next change
            this.state = 'IDLE';
            this.settlingStartTime = null;
            this.onStateChange(this.state);
          }
        }
      }

      this._scheduleNextCheck();
    }

    _toGrayscale(rgbaArray) {
      const len = rgbaArray.length / 4;
      const gray = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        const offset = i * 4;
        // Standard perceptual luminance: 0.299 R + 0.587 G + 0.114 B
        gray[i] = (rgbaArray[offset] * 77 + rgbaArray[offset + 1] * 150 + rgbaArray[offset + 2] * 29) >> 8;
      }
      return gray;
    }

    _computeDifference(prev, curr) {
      let changedPixels = 0;
      const total = prev.length;

      for (let i = 0; i < total; i++) {
        const diff = Math.abs(prev[i] - curr[i]);
        if (diff > this.pixelDeltaThreshold) {
          changedPixels++;
        }
      }

      return changedPixels / total;
    }

    forceStabilizedCheck() {
      const snapshot = this.capture.captureFrameSnapshot('image/jpeg', 0.9);
      if (snapshot) {
        this.onSceneStabilized(snapshot);
      }
    }

    setThresholds(motionThresh, settlingMs) {
      if (typeof motionThresh === 'number') this.motionThreshold = motionThresh;
      if (typeof settlingMs === 'number') this.settlingDelay = settlingMs;
    }
  }

  return PhantomChangeDetector;
});
