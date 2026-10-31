/**
 * ==============================================================================
 * SECTION 08: TRUST — CONTROLLER & PHANTOM SPATIAL VISUALIZATION
 * - Quiet IntersectionObserver staggered reveal sequence
 * - Subtle ambient PHANTOM spatial wireframes, nodes, and occasional slow scan
 * - Strict prefers-reduced-motion compliance
 * - Zero external dependencies, pauses when offscreen for high performance
 * ==============================================================================
 */

(function () {
  'use strict';

  class TrustSectionController {
    constructor() {
      this.section = document.getElementById('trust');
      this.canvas = document.getElementById('trustPhantomCanvas');
      if (!this.section) return;

      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
      this.isIntersecting = false;
      this.animId = null;
      this.startTime = null;

      // Spatial reference points (normalized 0..1 coordinates)
      this.nodes = [
        { x: 0.18, y: 0.28, label: 'ANCHOR.ENV', color: 'rgba(201, 95, 61, 0.7)' },
        { x: 0.52, y: 0.22, label: 'HORIZON.REF', color: 'rgba(77, 157, 145, 0.6)' },
        { x: 0.82, y: 0.38, label: 'NODE.SPATIAL', color: 'rgba(201, 95, 61, 0.6)' },
        { x: 0.35, y: 0.72, label: 'ENV.SURFACE', color: 'rgba(77, 157, 145, 0.5)' },
        { x: 0.75, y: 0.78, label: 'OBS.PASSIVE', color: 'rgba(214, 207, 190, 0.5)' }
      ];

      this.init();
    }

    init() {
      // Handle reduced motion
      if (this.prefersReducedMotion) {
        this.section.classList.add('revealed');
        if (this.ctx) {
          this.resizeCanvas();
          this.renderStatic();
        }
        return;
      }

      // Reveal immediately if navigating directly to trust
      const checkHash = () => {
        if (window.location.hash === '#trust') {
          this.section.classList.add('revealed');
        }
      };
      checkHash();
      window.addEventListener('hashchange', checkHash);

      // Intersection Observer for reveal and canvas animation lifecycle
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.section.classList.add('revealed');
              this.isIntersecting = true;
              if (this.ctx && !this.animId) {
                this.startAnimation();
              }
            } else {
              this.isIntersecting = false;
              if (this.animId) {
                cancelAnimationFrame(this.animId);
                this.animId = null;
              }
            }
          });
        },
        { threshold: 0, rootMargin: '120px 0px 80px 0px' }
      );

      observer.observe(this.section);

      // Safety fallback: ensure trust content is never stuck in hidden state
      setTimeout(() => {
        if (this.section && !this.section.classList.contains('revealed')) {
          this.section.classList.add('revealed');
        }
      }, 1200);

      // Handle Canvas Sizing
      if (this.canvas) {
        this.resizeCanvas();
        window.addEventListener('resize', () => {
          this.resizeCanvas();
          if (this.prefersReducedMotion) this.renderStatic();
        }, { passive: true });
      }
    }

    resizeCanvas() {
      if (!this.canvas) return;
      const rect = this.canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
      this.width = rect.width;
      this.height = rect.height;
      this.canvas.width = Math.floor(rect.width * dpr);
      this.canvas.height = Math.floor(rect.height * dpr);
      if (this.ctx) {
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }

    startAnimation() {
      const animate = (timestamp) => {
        if (!this.isIntersecting) return;
        if (!this.startTime) this.startTime = timestamp;
        const elapsed = (timestamp - this.startTime) / 1000;

        this.render(elapsed);
        this.animId = requestAnimationFrame(animate);
      };
      this.animId = requestAnimationFrame(animate);
    }

    render(elapsed) {
      if (!this.ctx || !this.width || !this.height) return;
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      ctx.clearRect(0, 0, w, h);

      // 1. Perspective Wireframe Floor & Horizon Lines
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.beginPath();
      // Horizon guide
      ctx.moveTo(0, h * 0.42);
      ctx.lineTo(w, h * 0.42);
      // Perspective rays converging toward subtle vanishing point on right side
      const vpX = w * 0.88;
      const vpY = h * 0.38;
      [0.05, 0.25, 0.45, 0.65, 0.85].forEach((offsetY) => {
        ctx.moveTo(0, h * offsetY);
        ctx.lineTo(vpX, vpY);
      });
      ctx.stroke();

      // 2. Faint connection vectors between nodes
      ctx.beginPath();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.moveTo(this.nodes[0].x * w, this.nodes[0].y * h);
      ctx.lineTo(this.nodes[1].x * w, this.nodes[1].y * h);
      ctx.lineTo(this.nodes[2].x * w, this.nodes[2].y * h);
      ctx.lineTo(this.nodes[4].x * w, this.nodes[4].y * h);
      ctx.lineTo(this.nodes[3].x * w, this.nodes[3].y * h);
      ctx.stroke();
      ctx.setLineDash([]);

      // 3. Spatial Nodes & Micro Technical Labels
      this.nodes.forEach((node, i) => {
        const nx = node.x * w;
        const ny = node.y * h;

        // Micro gentle pulse (subtle variance)
        const pulse = 0.7 + 0.3 * Math.sin(elapsed * 0.8 + i);

        // Outer faint halo
        ctx.beginPath();
        ctx.arc(nx, ny, 6, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(201, 95, 61, ${0.04 * pulse})`;
        ctx.fill();

        // Inner core dot
        ctx.beginPath();
        ctx.arc(nx, ny, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        // Technical coordinate label
        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(250, 244, 236, 0.22)';
        ctx.fillText(node.label, nx + 7, ny + 3);
      });

      // 4. Occasional Slow Scan Beam (quiet sweep every 14 seconds)
      const scanPeriod = 14;
      const scanProgress = (elapsed % scanPeriod) / scanPeriod;
      // Scan activates only during first 3 seconds of each 14s cycle
      if (scanProgress < 0.28) {
        const p = scanProgress / 0.28; // 0..1
        const scanY = h * (0.15 + p * 0.75);
        const scanOpacity = Math.sin(p * Math.PI) * 0.08;

        const scanGrad = ctx.createLinearGradient(0, scanY - 30, 0, scanY + 30);
        scanGrad.addColorStop(0, 'rgba(77, 157, 145, 0)');
        scanGrad.addColorStop(0.5, `rgba(77, 157, 145, ${scanOpacity})`);
        scanGrad.addColorStop(1, 'rgba(77, 157, 145, 0)');

        ctx.fillStyle = scanGrad;
        ctx.fillRect(0, scanY - 30, w, 60);

        // Fine scanline
        ctx.strokeStyle = `rgba(77, 157, 145, ${scanOpacity * 1.5})`;
        ctx.lineWidth = 0.7;
        ctx.beginPath();
        ctx.moveTo(w * 0.1, scanY);
        ctx.lineTo(w * 0.9, scanY);
        ctx.stroke();
      }
    }

    renderStatic() {
      if (!this.ctx || !this.width || !this.height) return;
      const ctx = this.ctx;
      const w = this.width;
      const h = this.height;

      ctx.clearRect(0, 0, w, h);

      // Wireframe lines
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.beginPath();
      ctx.moveTo(0, h * 0.42);
      ctx.lineTo(w, h * 0.42);
      const vpX = w * 0.88;
      const vpY = h * 0.38;
      [0.05, 0.25, 0.45, 0.65, 0.85].forEach((offsetY) => {
        ctx.moveTo(0, h * offsetY);
        ctx.lineTo(vpX, vpY);
      });
      ctx.stroke();

      // Faint vectors
      ctx.beginPath();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.moveTo(this.nodes[0].x * w, this.nodes[0].y * h);
      ctx.lineTo(this.nodes[1].x * w, this.nodes[1].y * h);
      ctx.lineTo(this.nodes[2].x * w, this.nodes[2].y * h);
      ctx.lineTo(this.nodes[4].x * w, this.nodes[4].y * h);
      ctx.lineTo(this.nodes[3].x * w, this.nodes[3].y * h);
      ctx.stroke();
      ctx.setLineDash([]);

      // Nodes
      this.nodes.forEach((node) => {
        const nx = node.x * w;
        const ny = node.y * h;
        ctx.beginPath();
        ctx.arc(nx, ny, 1.8, 0, Math.PI * 2);
        ctx.fillStyle = node.color;
        ctx.fill();

        ctx.font = '8px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(250, 244, 236, 0.22)';
        ctx.fillText(node.label, nx + 7, ny + 3);
      });
    }
  }

  // Mount on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.dishaTrust = window.smritiTrust = new TrustSectionController();
    });
  } else {
    window.dishaTrust = window.smritiTrust = new TrustSectionController();
  }
})();
