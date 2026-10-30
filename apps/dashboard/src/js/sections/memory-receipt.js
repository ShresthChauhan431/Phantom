/**
 * ==============================================================================
 * SECTION 07: MEMORY RECEIPT — CONTROLLER
 * Handles:
 * - Jitter-compatible staggered reveal animation
 * - 3D reading glasses physical artifact with soft grounding contact shadow
 * - Intentional composition: MEMORY RECEIPT ↘ physical artifact
 * - Multi-state status architecture (CONFIRMED, UNCERTAIN, MOVED, ADDED, GONE)
 * ==============================================================================
 */

(function () {
  'use strict';

  class MemoryReceiptController {
    constructor() {
      this.section = document.getElementById('memory-receipt-section');
      this.canvas = document.getElementById('receiptGlassesCanvas');
      this.statusDot = document.getElementById('receiptStatusDot');
      this.statusLabel = document.getElementById('receiptStatusLabel');

      if (!this.section) return;

      this.isIntersecting = false;
      this.animId = null;
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Three.js instances for the 3D physical artifact
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.glassesGroup = null;
      this.groundShadow = null;
      this.shadowTexture = null;
      this.isSceneInitialized = false;

      this.init();
    }

    init() {
      this.initReducedMotionListener();
      this.initIntersectionObserver();

      if (this.canvas && window.THREE) {
        // Lazy-initialize 3D glasses canvas when approaching Section 07
        const approachObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !this.isSceneInitialized) {
              this.isSceneInitialized = true;
              this.shadowTexture = this.createRadialShadowTexture();
              this.initGlassesCanvas();
              if (this.isIntersecting) {
                if (!this.prefersReducedMotion) {
                  this.startLoop();
                } else {
                  this.renderStatic();
                }
              }
              approachObserver.disconnect();
            }
          });
        }, { rootMargin: '400px 0px' });
        approachObserver.observe(this.section);
      }
    }

    initReducedMotionListener() {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = mediaQuery.matches;
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', (e) => {
          this.prefersReducedMotion = e.matches;
          if (this.prefersReducedMotion) {
            this.stopLoop();
            this.resetRestingPose();
            this.renderStatic();
          } else if (this.isIntersecting && this.isSceneInitialized) {
            this.startLoop();
          }
        });
      }
    }

    resetRestingPose() {
      if (this.glassesGroup) {
        this.glassesGroup.position.set(0, 0.8, 0);
        this.glassesGroup.rotation.set(-0.38, 0.0, 0.0);
      }
      if (this.groundShadow) {
        this.groundShadow.material.opacity = 0.44;
        this.groundShadow.scale.set(1, 1, 1);
      }
    }

    renderStatic() {
      if (!this.renderer || !this.scene || !this.camera) return;
      this.resetRestingPose();
      this.renderer.render(this.scene, this.camera);
    }

    createRadialShadowTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(42, 28, 20, 0.55)');
      gradient.addColorStop(0.35, 'rgba(42, 28, 20, 0.28)');
      gradient.addColorStop(0.70, 'rgba(42, 28, 20, 0.08)');
      gradient.addColorStop(1.0, 'rgba(42, 28, 20, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    initIntersectionObserver() {
      // Reveal immediately if navigating directly to this section
      const checkHash = () => {
        if (window.location.hash === '#memory-receipt-section' || window.location.hash === '#memory') {
          this.section.classList.add('revealed');
        }
      };
      checkHash();
      window.addEventListener('hashchange', checkHash);

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            this.isIntersecting = entry.isIntersecting;
            if (entry.isIntersecting) {
              // Trigger staggered Jitter-ready reveal sequence
              this.section.classList.add('revealed');
              if (this.isSceneInitialized) {
                if (!this.prefersReducedMotion) {
                  this.startLoop();
                } else {
                  this.renderStatic();
                }
              }
            } else {
              this.stopLoop();
            }
          });
        },
        { threshold: 0, rootMargin: '120px 0px 80px 0px' }
      );

      observer.observe(this.section);

      // Safety fallback: ensure receipt content is never stuck in blank state
      setTimeout(() => {
        if (this.section && !this.section.classList.contains('revealed')) {
          this.section.classList.add('revealed');
        }
      }, 1200);
    }

    initGlassesCanvas() {
      const width = this.canvas.clientWidth || 240;
      const height = this.canvas.clientHeight || 180;

      this.scene = new THREE.Scene();

      // Camera: Symmetrically framed to showcase both temple arms and lenses
      this.camera = new THREE.PerspectiveCamera(30, width / height, 1, 500);
      this.camera.position.set(0, 20, 42);
      this.camera.lookAt(0, -0.4, -2);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

      // Warm Soft Lights matching story atmosphere
      const ambient = new THREE.AmbientLight(0xFFE8D6, 0.85);
      this.scene.add(ambient);

      const keyLight = new THREE.DirectionalLight(0xFFF3E2, 1.30);
      keyLight.position.set(20, 28, 25);
      this.scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xF5DEC0, 0.55);
      fillLight.position.set(-20, 20, 15);
      this.scene.add(fillLight);

      // Build Reading Glasses (complete, symmetrical pair with both temple arms)
      this.buildCompanionGlasses();

      window.addEventListener(
        'resize',
        () => {
          if (!this.canvas || !this.renderer || !this.camera) return;
          const w = this.canvas.clientWidth;
          const h = this.canvas.clientHeight;
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
        },
        { passive: true }
      );
    }

    buildCompanionGlasses() {
      this.glassesGroup = new THREE.Group();

      const matFrame = new THREE.MeshStandardMaterial({
        color: 0x34251F, // Dark Espresso Frame
        roughness: 0.35,
        metalness: 0.20
      });

      const matBridge = new THREE.MeshStandardMaterial({
        color: 0xD5A63C, // Warm Gold Bridge & Hinges
        roughness: 0.25,
        metalness: 0.85
      });

      const matLens = new THREE.MeshPhysicalMaterial({
        color: 0xEEF8FC,
        roughness: 0.05,
        transmission: 0.88,
        transparent: true,
        opacity: 0.80,
        reflectivity: 0.85
      });

      // Left Rim & Lens (slightly slender, elegant designer rims)
      const rimGeo = new THREE.TorusGeometry(3.6, 0.50, 16, 32);
      const rimL = new THREE.Mesh(rimGeo, matFrame);
      rimL.position.set(-4.5, 0, 0);

      const lensGeo = new THREE.CylinderGeometry(3.5, 3.5, 0.25, 24);
      const lensL = new THREE.Mesh(lensGeo, matLens);
      lensL.position.set(-4.5, 0, 0);
      lensL.rotation.x = Math.PI * 0.5;

      // Right Rim & Lens
      const rimR = new THREE.Mesh(rimGeo, matFrame);
      rimR.position.set(4.5, 0, 0);

      const lensR = new THREE.Mesh(lensGeo, matLens);
      lensR.position.set(4.5, 0, 0);
      lensR.rotation.x = Math.PI * 0.5;

      // Arched Nose Bridge
      const bridgeCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-1.2, 0.4, 0),
        new THREE.Vector3(0, 1.1, 0.3),
        new THREE.Vector3(1.2, 0.4, 0)
      ]);
      const bridge = new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 16, 0.40, 8, false), matBridge);

      // Hinges / Endpieces on Outer Rims
      const hingeGeo = new THREE.CylinderGeometry(0.42, 0.42, 1.1, 12);
      const hingeL = new THREE.Mesh(hingeGeo, matBridge);
      hingeL.position.set(-7.9, 0.8, -0.2);
      hingeL.rotation.z = Math.PI * 0.5;

      const hingeR = new THREE.Mesh(hingeGeo, matBridge);
      hingeR.position.set(7.9, 0.8, -0.2);
      hingeR.rotation.z = Math.PI * 0.5;

      // Symmetrical Temple Arms extending outward and backward (both clearly visible)
      // Left Temple Arm with downward curved ear hook
      const templeCurveL = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-7.9, 0.8, -0.2),
        new THREE.Vector3(-9.8, 1.0, -4.5),
        new THREE.Vector3(-11.5, 0.8, -9.5),
        new THREE.Vector3(-12.2, -0.2, -13.0),
        new THREE.Vector3(-12.0, -1.8, -15.0)
      ]);
      const templeL = new THREE.Mesh(new THREE.TubeGeometry(templeCurveL, 28, 0.38, 8, false), matFrame);

      // Right Temple Arm with downward curved ear hook (exact symmetry)
      const templeCurveR = new THREE.CatmullRomCurve3([
        new THREE.Vector3(7.9, 0.8, -0.2),
        new THREE.Vector3(9.8, 1.0, -4.5),
        new THREE.Vector3(11.5, 0.8, -9.5),
        new THREE.Vector3(12.2, -0.2, -13.0),
        new THREE.Vector3(12.0, -1.8, -15.0)
      ]);
      const templeR = new THREE.Mesh(new THREE.TubeGeometry(templeCurveR, 28, 0.38, 8, false), matFrame);

      this.glassesGroup.add(rimL, lensL, rimR, lensR, bridge, hingeL, hingeR, templeL, templeR);

      // Resting pose: Symmetrical, balanced 3D orientation with both arms clearly framing the glasses
      this.glassesGroup.position.set(0, 0.8, 0);
      this.glassesGroup.rotation.set(-0.38, 0.0, 0.0);
      this.glassesGroup.scale.set(1.08, 1.08, 1.08);
      this.scene.add(this.glassesGroup);

      // Soft Grounding Contact Shadow
      const shadowMat = new THREE.MeshBasicMaterial({
        map: this.shadowTexture,
        transparent: true,
        opacity: 0.44,
        depthWrite: false
      });
      this.groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(34, 24), shadowMat);
      this.groundShadow.rotation.x = -Math.PI * 0.5;
      this.groundShadow.position.set(0, -3.8, -2);
      this.scene.add(this.groundShadow);
    }

    startLoop() {
      if (this.animId) return;

      // 4.2-second period for calm, organic breathing float loop
      const duration = 4.2;
      const omega = (2 * Math.PI) / duration;

      const render = (time) => {
        if (!this.isIntersecting || this.prefersReducedMotion) {
          this.animId = null;
          return;
        }

        this.animId = requestAnimationFrame(render);

        if (this.glassesGroup) {
          const t = time * 0.001;
          const phase = t * omega;

          // Gentle ease-in-out vertical float: ~8px total displacement (amplitude: 0.55 units)
          const floatSin = Math.sin(phase);
          this.glassesGroup.position.y = 0.8 + floatSin * 0.55;

          // Symmetrical organic micro-drift: <= 1.2 degrees, maintaining full bilateral visibility of both temple arms
          this.glassesGroup.rotation.y = Math.sin(phase * 0.5) * 0.020;
          this.glassesGroup.rotation.x = -0.38 + Math.cos(phase) * 0.015;
          this.glassesGroup.rotation.z = Math.sin(phase * 0.4) * 0.008;

          // Dynamic Grounding Shadow: softens slightly when glasses float up, strengthens when settling
          if (this.groundShadow) {
            const lift = (floatSin + 1) * 0.5; // 0 at lowest/settled, 1 at highest/floated
            this.groundShadow.material.opacity = 0.48 - lift * 0.12; // 0.48 -> 0.36
            const shadowScale = 1.0 + lift * 0.08; // 1.0 -> 1.08
            this.groundShadow.scale.set(shadowScale, shadowScale, 1);
          }
        }

        this.renderer.render(this.scene, this.camera);
      };

      this.animId = requestAnimationFrame(render);
    }

    stopLoop() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
    }

    // Public Status Architecture (supports CONFIRMED, UNCERTAIN, MOVED, ADDED, GONE)
    setReceiptStatus(statusKey) {
      const statusMap = {
        CONFIRMED: { label: 'CONFIRMED', color: '#53613B' },
        UNCERTAIN: { label: 'UNCERTAIN', color: '#D5A63C' },
        MOVED: { label: 'MOVED', color: '#C95F3D' },
        ADDED: { label: 'ADDED', color: '#4D9D91' },
        GONE: { label: 'NOT FOUND', color: '#8C7B6D' }
      };

      const s = statusMap[statusKey] || statusMap.CONFIRMED;
      if (this.statusLabel) this.statusLabel.textContent = s.label;
      if (this.statusDot) this.statusDot.style.background = s.color;
    }
  }

  // Mount on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.dishaReceipt = window.smritiReceipt = new MemoryReceiptController();
    });
  } else {
    window.dishaReceipt = window.smritiReceipt = new MemoryReceiptController();
  }
})();
