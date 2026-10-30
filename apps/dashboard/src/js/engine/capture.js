/**
 * ==============================================================================
 * PHANTOM SPATIAL INTELLIGENCE PLATFORM — SHARED ENGINE
 * Module: Capture System — The Eye
 * Capabilities: Multi-Camera Enumeration, USB / Continuity / External Webcams,
 * Offline Video Stream Fallback, Real-Time Frame Ingestion
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PhantomCapture = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class PhantomCapture {
    constructor(options = {}) {
      this.videoElement = options.videoElement || null;
      this.currentStream = null;
      this.currentDeviceId = null;
      this.devices = [];
      this.status = 'no-camera'; // 'no-camera', 'permission-required', 'camera-connected', 'camera-unavailable', 'camera-disconnected', 'monitoring-active', 'monitoring-paused', 'processing-error'
      this.isOfflineVideo = false;
      this.offlineVideoUrl = null;
      this.resolution = options.resolution || '1280x720'; // '1920x1080', '1280x720', '640x480'
      this.fps = 30;

      this.onStatusChange = options.onStatusChange || (() => {});
      this.onDevicesDiscovered = options.onDevicesDiscovered || (() => {});
      this.onError = options.onError || (() => {});

      // Hidden capture canvas for frame snapshots
      this.captureCanvas = document.createElement('canvas');
      this.captureCtx = this.captureCanvas.getContext('2d', { willReadFrequently: true });
    }

    _setStatus(newStatus, detail = '') {
      this.status = newStatus;
      this.onStatusChange(newStatus, detail);
    }

    /**
     * Enumerate available video input hardware
     * Categorizes phone webcams, Continuity cameras, USB UVC devices, and built-ins
     */
    async discoverCameras() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        this._setStatus('camera-unavailable', 'WebRTC mediaDevices API not supported in this browser.');
        return [];
      }

      try {
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');

        this.devices = videoInputs.map((device, index) => {
          let type = 'external';
          const label = device.label || `Camera ${index + 1}`;
          const lower = label.toLowerCase();

          if (lower.includes('facetime') || lower.includes('built-in') || lower.includes('integrated')) {
            type = 'built-in';
          } else if (lower.includes('iphone') || lower.includes('continuity')) {
            type = 'continuity-iphone';
          } else if (lower.includes('android') || lower.includes('uvc') || lower.includes('camlink')) {
            type = 'android-usb';
          } else if (lower.includes('obs') || lower.includes('virtual')) {
            type = 'virtual';
          }

          return {
            deviceId: device.deviceId,
            groupId: device.groupId,
            label: label || `Video Device ${index + 1} (Grant permission to see name)`,
            type: type,
            raw: device
          };
        });

        if (this.devices.length === 0) {
          this._setStatus('no-camera', 'No camera devices detected.');
        } else {
          // If labels are empty, permission has not been granted yet
          const hasLabels = this.devices.some((d) => d.label && !d.label.startsWith('Video Device'));
          if (!hasLabels && this.status !== 'camera-connected') {
            this._setStatus('permission-required', 'Camera access permission required to identify device names.');
          }
        }

        this.onDevicesDiscovered(this.devices);
        return this.devices;
      } catch (err) {
        console.error('[PhantomCapture] Enumerate devices failed:', err);
        this._setStatus('camera-unavailable', err.message);
        return [];
      }
    }

    /**
     * Connect to a specific camera device
     */
    async connectCamera(deviceId = null) {
      this._stopActiveStream();
      this.isOfflineVideo = false;

      const [targetWidth, targetHeight] = this.resolution.split('x').map(Number);

      const constraints = {
        audio: false,
        video: {
          width: { ideal: targetWidth || 1280 },
          height: { ideal: targetHeight || 720 },
          frameRate: { ideal: 30 }
        }
      };

      if (deviceId) {
        constraints.video.deviceId = { exact: deviceId };
      }

      try {
        this._setStatus('permission-required', 'Requesting camera stream...');
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.currentStream = stream;
        this.currentDeviceId = deviceId || (stream.getVideoTracks()[0]?.getSettings()?.deviceId || null);

        if (this.videoElement) {
          this.videoElement.srcObject = stream;
          this.videoElement.muted = true;
          this.videoElement.setAttribute('playsinline', 'true');
          await this.videoElement.play();
        }

        this._setStatus('camera-connected', 'Live camera stream active.');
        // Re-enumerate to get full device labels now that permission is granted
        await this.discoverCameras();
        return true;
      } catch (err) {
        console.error('[PhantomCapture] getUserMedia failed:', err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          this._setStatus('permission-required', 'Camera permission was denied. Please allow camera access in browser settings.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          this._setStatus('no-camera', 'Selected camera device was not found.');
        } else {
          this._setStatus('camera-unavailable', `Unable to access camera: ${err.message}`);
        }
        this.onError(err);
        return false;
      }
    }

    /**
     * Fallback: Load an offline video or sample desk recording
     * Essential for offline testing or when no physical webcam is plugged in
     */
    async loadOfflineVideo(fileOrUrl) {
      this._stopActiveStream();
      this.isOfflineVideo = true;

      if (!this.videoElement) return false;

      try {
        if (typeof fileOrUrl === 'string') {
          this.videoElement.srcObject = null;
          this.videoElement.src = fileOrUrl;
        } else if (fileOrUrl instanceof File || fileOrUrl instanceof Blob) {
          if (this.offlineVideoUrl) {
            URL.revokeObjectURL(this.offlineVideoUrl);
          }
          this.offlineVideoUrl = URL.createObjectURL(fileOrUrl);
          this.videoElement.srcObject = null;
          this.videoElement.src = this.offlineVideoUrl;
        }

        this.videoElement.muted = true;
        this.videoElement.loop = true;
        this.videoElement.setAttribute('playsinline', 'true');
        await this.videoElement.play();

        this._setStatus('camera-connected', 'Offline test video stream active.');
        return true;
      } catch (err) {
        console.error('[PhantomCapture] Load offline video failed:', err);
        this._setStatus('processing-error', `Failed to load test video: ${err.message}`);
        return false;
      }
    }

    /**
     * Capture the current frame as an ImageData / snapshot Data URL
     */
    captureFrameSnapshot(format = 'image/jpeg', quality = 0.88) {
      if (!this.videoElement || (this.videoElement.readyState < 2 && !this.isOfflineVideo)) {
        return null;
      }

      const vw = this.videoElement.videoWidth || 640;
      const vh = this.videoElement.videoHeight || 480;

      if (this.captureCanvas.width !== vw || this.captureCanvas.height !== vh) {
        this.captureCanvas.width = vw;
        this.captureCanvas.height = vh;
      }

      this.captureCtx.drawImage(this.videoElement, 0, 0, vw, vh);
      const dataUrl = this.captureCanvas.toDataURL(format, quality);

      return {
        width: vw,
        height: vh,
        timestamp: new Date().toISOString(),
        dataUrl: dataUrl
      };
    }

    /**
     * Extract low-resolution pixel buffer for cheap change detection
     */
    getDownsampledFrame(targetW = 160, targetH = 120) {
      if (!this.videoElement || this.videoElement.readyState < 2) {
        return null;
      }

      if (this.captureCanvas.width !== targetW || this.captureCanvas.height !== targetH) {
        this.captureCanvas.width = targetW;
        this.captureCanvas.height = targetH;
      }

      this.captureCtx.drawImage(this.videoElement, 0, 0, targetW, targetH);
      return this.captureCtx.getImageData(0, 0, targetW, targetH);
    }

    _stopActiveStream() {
      if (this.currentStream) {
        this.currentStream.getTracks().forEach((t) => t.stop());
        this.currentStream = null;
      }
      if (this.offlineVideoUrl) {
        URL.revokeObjectURL(this.offlineVideoUrl);
        this.offlineVideoUrl = null;
      }
      if (this.videoElement) {
        this.videoElement.srcObject = null;
        this.videoElement.src = '';
      }
    }

    disconnect() {
      this._stopActiveStream();
      this._setStatus('camera-disconnected', 'Camera monitoring disconnected.');
    }

    setResolution(resString) {
      this.resolution = resString;
      if (this.currentStream && this.currentDeviceId) {
        this.connectCamera(this.currentDeviceId);
      }
    }
  }

  return PhantomCapture;
});
