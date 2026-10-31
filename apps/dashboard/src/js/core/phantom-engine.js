/**
 * ==============================================================================
 * PHANTOM SPATIAL ENGINE — SECTION 05
 * Spatial memory comparison: Remember -> Compare -> Explain
 * ==============================================================================
 */

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // 1. RIVE INTEGRATION COMPONENT & API
  // --------------------------------------------------------------------------
  class RivePhantomIndicator {
    constructor() {
      this.canvas = document.getElementById('riveStatusCanvas');
      this.container = document.getElementById('riveCanvasContainer');
      this.fallbackBadge = document.getElementById('riveFallbackBadge');
      this.dot = document.getElementById('riveBadgeDot');
      this.stateLabel = document.getElementById('riveStateLabel');
      
      this.currentState = 'idle';
      this.riveInstance = null;
      this.isRiveActive = false;
      this.expectedRivePath = 'public/rive/phantom-status.riv';

      this.init();
    }

    async init() {
      // Check if real .riv file exists and can be loaded
      try {
        const response = await fetch(this.expectedRivePath, { method: 'HEAD' });
        if (response.ok && window.rive && this.canvas) {
          this.riveInstance = new window.rive.Rive({
            src: this.expectedRivePath,
            canvas: this.canvas,
            autoplay: true,
            stateMachines: 'PhantomStatusMachine',
            onLoad: () => {
              this.isRiveActive = true;
              this.container?.classList.add('has-rive');
              this.applyRiveState(this.currentState);
            },
            onError: () => {
              this.fallbackToStatic();
            }
          });
          return;
        }
      } catch (err) {
        // Clean fallback when .riv is absent
      }

      this.fallbackToStatic();
    }

    fallbackToStatic() {
      this.isRiveActive = false;
      this.container?.classList.remove('has-rive');
      this.updateFallbackUI(this.currentState);
    }

    setState(state) {
      if (this.currentState === state) return;
      this.currentState = state;

      if (this.isRiveActive && this.riveInstance) {
        this.applyRiveState(state);
      } else {
        this.updateFallbackUI(state);
      }
    }

    applyRiveState(state) {
      if (!this.riveInstance) return;
      try {
        const inputs = this.riveInstance.stateMachineInputs('PhantomStatusMachine');
        if (inputs && inputs.length) {
          const stateTrigger = inputs.find(i => i.name.toLowerCase() === state.toLowerCase());
          if (stateTrigger && typeof stateTrigger.fire === 'function') {
            stateTrigger.fire();
          }
        }
      } catch (e) {
        // Safe execution
      }
    }

    updateFallbackUI(state) {
      if (!this.dot || !this.stateLabel) return;
      this.dot.className = `badge-dot ${state}`;

      const labels = {
        idle: 'READY',
        scanning: 'SCANNING',
        analyzing: 'ANALYZING',
        change_found: 'CHANGE FOUND',
        confirmed: 'CONFIRMED'
      };

      this.stateLabel.textContent = labels[state] || 'READY';
    }
  }

  // --------------------------------------------------------------------------
  // 2. 3D WIREFRAME ROOM VISUALIZER
  // --------------------------------------------------------------------------
  class PhantomRoomVisualizer {
    constructor(canvas) {
      this.canvas = canvas;
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.animId = null;
      this.isIntersecting = false;
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.state = 'idle';
      this.scanProgress = 0;
      this.scanDirection = 1;

      // Mouse Parallax
      this.targetRotation = { x: 0.42, y: 0.68 };
      this.currentRotation = { x: 0.42, y: 0.68 };

      // 3D Visual Elements
      this.roomGroup = null;
      this.scanPlane = null;
      this.scanEdge = null;
      this.nodeTable = null;
      this.nodeBookshelf = null;
      this.nodeSofa = null;
      this.ghostGlasses = null;
      this.currentGlasses = null;
      this.trajectoryLine = null;
      this.trajectoryPoints = [];

      this.init();
    }

    init() {
      if (!window.THREE || !this.canvas) return;

      const rect = this.canvas.parentElement.getBoundingClientRect();
      const width = rect.width || 640;
      const height = rect.height || 420;

      // Scene
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x110F0D);

      // Camera: Architectural isometric perspective
      this.camera = new THREE.PerspectiveCamera(34, width / height, 1, 1000);
      this.camera.position.set(58, 44, 62);
      this.camera.lookAt(0, 8, 0);

      // Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));

      this.buildWireframeRoom();
      this.buildSpatialNodes();
      this.buildGlassesAndTrajectory();
      this.buildScanPlane();
      this.initEvents();
      this.startLoop();
    }

    buildWireframeRoom() {
      this.roomGroup = new THREE.Group();
      this.scene.add(this.roomGroup);

      const wireColor = 0x332E27;
      const accentWire = 0x473F35;

      // 1. Architectural Floor Grid
      const gridHelper = new THREE.GridHelper(60, 30, 0x4A4135, 0x221E19);
      gridHelper.position.y = 0;
      this.roomGroup.add(gridHelper);

      // 2. Room Boundary Lines
      const roomPoints = [
        new THREE.Vector3(-30, 0, -26), new THREE.Vector3(30, 0, -26),
        new THREE.Vector3(30, 0, -26), new THREE.Vector3(30, 0, 26),
        new THREE.Vector3(-30, 0, -26), new THREE.Vector3(-30, 24, -26),
        new THREE.Vector3(30, 0, -26), new THREE.Vector3(30, 24, -26),
        new THREE.Vector3(-30, 24, -26), new THREE.Vector3(30, 24, -26),
        new THREE.Vector3(-30, 0, 26), new THREE.Vector3(-30, 0, -26)
      ];
      const roomLineGeo = new THREE.BufferGeometry().setFromPoints(roomPoints);
      const roomLineMat = new THREE.LineBasicMaterial({ color: accentWire, transparent: true, opacity: 0.7 });
      this.roomGroup.add(new THREE.LineSegments(roomLineGeo, roomLineMat));

      // 3. Furniture Silhouettes
      // A. SIDE TABLE: Cylinder + top ring + legs
      const tableGroup = new THREE.Group();
      tableGroup.position.set(-20, 0, 4);

      const tableTopGeo = new THREE.CylinderGeometry(6, 6, 0.8, 24);
      const tableTopEdges = new THREE.EdgesGeometry(tableTopGeo);
      const tableLineMat = new THREE.LineBasicMaterial({ color: wireColor });
      tableGroup.add(new THREE.LineSegments(tableTopEdges, tableLineMat));
      tableGroup.children[0].position.y = 11.6;

      // 3 Table Legs
      for (let i = 0; i < 3; i++) {
        const angle = (i * Math.PI * 2) / 3;
        const lx = Math.cos(angle) * 4.4;
        const lz = Math.sin(angle) * 4.4;
        const legPoints = [new THREE.Vector3(lx, 11.2, lz), new THREE.Vector3(lx * 1.15, 0, lz * 1.15)];
        const legGeo = new THREE.BufferGeometry().setFromPoints(legPoints);
        tableGroup.add(new THREE.Line(legGeo, tableLineMat));
      }
      this.roomGroup.add(tableGroup);

      // B. SOFA: Stylized box wireframe armchair
      const sofaGroup = new THREE.Group();
      sofaGroup.position.set(-5, 0, -12);

      // Base seat
      const seatGeo = new THREE.BoxGeometry(22, 5, 14);
      const seatEdges = new THREE.EdgesGeometry(seatGeo);
      const sofaMat = new THREE.LineBasicMaterial({ color: wireColor });
      const seat = new THREE.LineSegments(seatEdges, sofaMat);
      seat.position.y = 3.5;
      sofaGroup.add(seat);

      // Backrest
      const backGeo = new THREE.BoxGeometry(22, 10, 4);
      const backEdges = new THREE.EdgesGeometry(backGeo);
      const back = new THREE.LineSegments(backEdges, sofaMat);
      back.position.set(0, 10, -5);
      sofaGroup.add(back);

      // Left & Right Armrests
      const armGeo = new THREE.BoxGeometry(4, 7, 14);
      const armEdges = new THREE.EdgesGeometry(armGeo);
      const armL = new THREE.LineSegments(armEdges, sofaMat);
      armL.position.set(-11, 7.5, 0);
      const armR = new THREE.LineSegments(armEdges, sofaMat);
      armR.position.set(11, 7.5, 0);
      sofaGroup.add(armL, armR);

      this.roomGroup.add(sofaGroup);

      // C. BOOKSHELF: Multi-tier architectural uprights
      const shelfGroup = new THREE.Group();
      shelfGroup.position.set(22, 0, -14);

      const shelfMat = new THREE.LineBasicMaterial({ color: wireColor });
      // 4 shelves
      for (let y = 0; y <= 24; y += 8) {
        const shelfGeo = new THREE.BoxGeometry(14, 0.6, 6);
        const shelfEdges = new THREE.EdgesGeometry(shelfGeo);
        const s = new THREE.LineSegments(shelfEdges, shelfMat);
        s.position.y = y + 1;
        shelfGroup.add(s);
      }
      // Upright framing
      const uprightPoints = [
        new THREE.Vector3(-7, 0, -3), new THREE.Vector3(-7, 25, -3),
        new THREE.Vector3(7, 0, -3), new THREE.Vector3(7, 25, -3),
        new THREE.Vector3(-7, 0, 3), new THREE.Vector3(-7, 25, 3),
        new THREE.Vector3(7, 0, 3), new THREE.Vector3(7, 25, 3)
      ];
      const uprightGeo = new THREE.BufferGeometry().setFromPoints(uprightPoints);
      shelfGroup.add(new THREE.LineSegments(uprightGeo, shelfMat));

      this.roomGroup.add(shelfGroup);
    }

    buildSpatialNodes() {
      // Helper to create a spatial beacon ring + point
      const createNode = (name, position, baseColor) => {
        const group = new THREE.Group();
        group.position.copy(position);

        // Core point
        const dotGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0)]);
        const dotMat = new THREE.PointsMaterial({
          color: baseColor,
          size: 7,
          sizeAttenuation: false,
          transparent: true,
          opacity: 0.85
        });
        const dot = new THREE.Points(dotGeo, dotMat);
        group.add(dot);

        // Ground anchor line
        const groundPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -position.y, 0)];
        const groundGeo = new THREE.BufferGeometry().setFromPoints(groundPoints);
        const groundMat = new THREE.LineDashedMaterial({
          color: baseColor,
          dashSize: 1,
          gapSize: 1,
          transparent: true,
          opacity: 0.25
        });
        const groundLine = new THREE.Line(groundGeo, groundMat);
        groundLine.computeLineDistances();
        group.add(groundLine);

        // Pulsing Ring
        const ringGeo = new THREE.RingGeometry(1.6, 1.8, 32);
        const ringMat = new THREE.MeshBasicMaterial({
          color: baseColor,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.4
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        group.add(ring);

        group.userData = { dotMat, groundMat, ring, ringMat, baseColor };
        this.roomGroup.add(group);
        return group;
      };

      this.nodeTable = createNode('TABLE', new THREE.Vector3(-20, 12, 4), 0x948B7E);
      this.nodeSofa = createNode('SOFA', new THREE.Vector3(-5, 9, -12), 0x7E776C);
      this.nodeBookshelf = createNode('BOOKSHELF', new THREE.Vector3(22, 17, -14), 0x948B7E);
    }

    buildGlassesAndTrajectory() {
      // Helper to build wireframe glasses icon
      const createGlassesMesh = (color, isGhost = false) => {
        const group = new THREE.Group();
        const mat = new THREE.LineBasicMaterial({
          color: color,
          transparent: true,
          opacity: isGhost ? 0.38 : 0.95
        });

        // 2 oval frames
        const frameGeoL = new THREE.RingGeometry(0.9, 1.1, 24);
        const frameL = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeoL), mat);
        frameL.position.x = -1.3;

        const frameGeoR = new THREE.RingGeometry(0.9, 1.1, 24);
        const frameR = new THREE.LineSegments(new THREE.EdgesGeometry(frameGeoR), mat);
        frameR.position.x = 1.3;

        // Bridge
        const bridgePoints = [new THREE.Vector3(-0.4, 0.4, 0), new THREE.Vector3(0.4, 0.4, 0)];
        const bridge = new THREE.Line(new THREE.BufferGeometry().setFromPoints(bridgePoints), mat);

        group.add(frameL, frameR, bridge);
        group.rotation.x = -Math.PI / 4;
        group.scale.set(1.1, 1.1, 1.1);
        group.userData = { mat };
        return group;
      };

      // 1. Ghost Glasses (Previous on Side Table)
      this.ghostGlasses = createGlassesMesh(0xD5A63C, true);
      this.ghostGlasses.position.set(-20, 13.5, 4);
      this.roomGroup.add(this.ghostGlasses);

      // 2. Current Glasses (New on Bookshelf)
      this.currentGlasses = createGlassesMesh(0x4D9D91, false);
      this.currentGlasses.position.set(22, 18.2, -14);
      this.roomGroup.add(this.currentGlasses);

      // 3. Trajectory connecting Table -> Bookshelf
      const start = new THREE.Vector3(-20, 13.5, 4);
      const mid = new THREE.Vector3(1, 25, -5);
      const end = new THREE.Vector3(22, 18.2, -14);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      this.trajectoryPoints = curve.getPoints(50);

      const trajGeo = new THREE.BufferGeometry().setFromPoints(this.trajectoryPoints);
      const trajMat = new THREE.LineDashedMaterial({
        color: 0x4D9D91,
        dashSize: 1.2,
        gapSize: 0.8,
        transparent: true,
        opacity: 0.7
      });
      this.trajectoryLine = new THREE.Line(trajGeo, trajMat);
      this.trajectoryLine.computeLineDistances();
      this.trajectoryLine.visible = false;
      this.roomGroup.add(this.trajectoryLine);
    }

    buildScanPlane() {
      // Sweep plane
      const planeGeo = new THREE.PlaneGeometry(1.5, 54);
      const planeMat = new THREE.MeshBasicMaterial({
        color: 0x4D9D91,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide
      });
      this.scanPlane = new THREE.Mesh(planeGeo, planeMat);
      this.scanPlane.rotation.y = Math.PI / 2;
      this.scanPlane.position.set(-28, 12, 0);

      // Crisp leading edge line
      const edgePoints = [new THREE.Vector3(0, 0, -27), new THREE.Vector3(0, 0, 27)];
      const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0x76CFC2,
        transparent: true,
        opacity: 0.85
      });
      this.scanEdge = new THREE.Line(edgeGeo, edgeMat);
      this.scanEdge.position.set(-28, 0.2, 0);

      this.scanPlane.visible = false;
      this.scanEdge.visible = false;

      this.roomGroup.add(this.scanPlane, this.scanEdge);
    }

    setState(state) {
      this.state = state;

      if (state === 'idle') {
        this.scanPlane.visible = false;
        this.scanEdge.visible = false;
        this.ghostGlasses.visible = false;
        this.currentGlasses.visible = false;
        this.trajectoryLine.visible = false;
        this.setNodeActive(this.nodeTable, false);
        this.setNodeActive(this.nodeBookshelf, false);
      } else if (state === 'scanning') {
        this.scanPlane.visible = true;
        this.scanEdge.visible = true;
        this.ghostGlasses.visible = true;
        this.currentGlasses.visible = true;
        this.trajectoryLine.visible = false;
        this.setNodeActive(this.nodeTable, true, 0x4D9D91);
        this.setNodeActive(this.nodeBookshelf, false);
      } else if (state === 'analyzing') {
        this.scanPlane.visible = false;
        this.scanEdge.visible = false;
        this.ghostGlasses.visible = true;
        this.ghostGlasses.userData.mat.opacity = 0.45;
        this.currentGlasses.visible = true;
        this.currentGlasses.userData.mat.opacity = 0.7;
        this.trajectoryLine.visible = true;
        this.setNodeActive(this.nodeTable, true, 0xD5A63C);
        this.setNodeActive(this.nodeBookshelf, true, 0x4D9D91);
      } else if (state === 'change_found') {
        this.scanPlane.visible = false;
        this.scanEdge.visible = false;
        this.ghostGlasses.visible = true;
        this.ghostGlasses.userData.mat.opacity = 0.32;
        this.currentGlasses.visible = true;
        this.currentGlasses.userData.mat.opacity = 1.0;
        this.trajectoryLine.visible = true;
        this.setNodeActive(this.nodeTable, true, 0xD5A63C);
        this.setNodeActive(this.nodeBookshelf, true, 0x4D9D91);
      } else if (state === 'confirmed') {
        this.scanPlane.visible = false;
        this.scanEdge.visible = false;
        this.ghostGlasses.visible = true;
        this.ghostGlasses.userData.mat.opacity = 0.28;
        this.currentGlasses.visible = true;
        this.currentGlasses.userData.mat.opacity = 1.0;
        this.trajectoryLine.visible = true;
        this.setNodeActive(this.nodeTable, false);
        this.setNodeActive(this.nodeBookshelf, true, 0x59B890);
      }
    }

    setNodeActive(node, isActive, activeColor = 0x4D9D91) {
      if (!node) return;
      const { dotMat, ringMat, baseColor } = node.userData;
      if (isActive) {
        dotMat.color.setHex(activeColor);
        dotMat.size = 9;
        ringMat.color.setHex(activeColor);
        ringMat.opacity = 0.8;
      } else {
        dotMat.color.setHex(baseColor);
        dotMat.size = 7;
        ringMat.color.setHex(baseColor);
        ringMat.opacity = 0.35;
      }
    }

    renderStatic() {
      if (!this.renderer || !this.scene || !this.camera) return;
      this.renderer.render(this.scene, this.camera);
    }

    initEvents() {
      // Viewport Intersection Observer for high performance
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            this.isIntersecting = entry.isIntersecting;
            if (this.isIntersecting) {
              if (!this.prefersReducedMotion) {
                this.startLoop();
              } else {
                this.renderStatic();
              }
            } else {
              this.stopLoop();
            }
          });
        },
        { threshold: 0.08 }
      );
      observer.observe(this.canvas);

      // Subtle mouse parallax
      window.addEventListener(
        'mousemove',
        (e) => {
          if (this.prefersReducedMotion) return;
          const nx = (e.clientX / window.innerWidth) - 0.5;
          const ny = (e.clientY / window.innerHeight) - 0.5;
          this.targetRotation.x = 0.42 + ny * 0.12;
          this.targetRotation.y = 0.68 + nx * 0.18;
        },
        { passive: true }
      );

      // Responsive resize
      window.addEventListener(
        'resize',
        () => {
          if (!this.canvas || !this.renderer || !this.camera) return;
          const parent = this.canvas.parentElement;
          if (!parent) return;
          const w = parent.clientWidth;
          const h = parent.clientHeight;
          this.camera.aspect = w / h;
          this.camera.updateProjectionMatrix();
          this.renderer.setSize(w, h);
          if (this.prefersReducedMotion || !this.isIntersecting) {
            this.renderStatic();
          }
        },
        { passive: true }
      );
    }

    startLoop() {
      if (this.animId) return;

      const render = (time) => {
        if (!this.isIntersecting || this.prefersReducedMotion) {
          this.animId = null;
          return;
        }

        this.animId = requestAnimationFrame(render);

        const sec = time * 0.001;

        // Smooth camera dampening
        this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.05;
        this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.05;

        const dist = 86;
        this.camera.position.x = Math.sin(this.currentRotation.y) * dist * Math.cos(this.currentRotation.x);
        this.camera.position.z = Math.cos(this.currentRotation.y) * dist * Math.cos(this.currentRotation.x);
        this.camera.position.y = Math.sin(this.currentRotation.x) * dist + 8;
        this.camera.lookAt(0, 8, 0);

        // State animations
        if (this.state === 'scanning') {
          this.scanProgress += 0.015 * this.scanDirection;
          if (this.scanProgress > 1) {
            this.scanProgress = 1;
            this.scanDirection = -1;
          } else if (this.scanProgress < 0) {
            this.scanProgress = 0;
            this.scanDirection = 1;
          }

          const scanX = -28 + this.scanProgress * 56;
          this.scanPlane.position.x = scanX;
          this.scanEdge.position.x = scanX;

          // Light up nodes as scan plane crosses them
          this.setNodeActive(this.nodeTable, scanX > -22);
          this.setNodeActive(this.nodeBookshelf, scanX > 20);
        }

        // Pulse ring on current glasses in 'change_found'
        if ((this.state === 'change_found' || this.state === 'confirmed') && this.currentGlasses) {
          const pulse = 1.0 + Math.sin(sec * 4) * 0.12;
          this.currentGlasses.scale.set(pulse, pulse, pulse);
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
  }

  // --------------------------------------------------------------------------
  // 3. MASTER PHANTOM CONTROLLER (Scroll Storytelling & UI State)
  // --------------------------------------------------------------------------
  class PhantomEngineController {
    constructor() {
      this.section = document.getElementById('phantom');
      this.canvas = document.getElementById('phantomCanvas');
      this.visualizer = null;
      this.riveIndicator = null;
      this.currentState = 'idle';

      // UI Elements
      this.hudState = document.getElementById('phantomStateHud');
      this.hudDelta = document.getElementById('phantomDeltaHud');
      this.stageTag = document.getElementById('phantomStageTag');
      this.stageHeadline = document.getElementById('phantomStageHeadline');
      this.stageDesc = document.getElementById('phantomStageDesc');
      this.diffDetails = document.getElementById('phantomDiffDetails');
      this.stageStatement = document.getElementById('phantomStageStatement');
      this.processSteps = [...document.querySelectorAll('.process-step')];
      this.stageButtons = [...document.querySelectorAll('.stage-btn')];

      this.init();
    }

    ensureVisualizer() {
      if (!this.visualizer && this.canvas) {
        this.visualizer = new PhantomRoomVisualizer(this.canvas);
        if (this.currentState) {
          this.visualizer.setState(this.currentState);
        }
      }
      return this.visualizer;
    }

    init() {
      if (!this.section) return;

      // Initialize Subcomponents
      this.riveIndicator = new RivePhantomIndicator();
      if (this.canvas) {
        // Lazy-initialize 3D visualizer when approaching Section 05
        const approachObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              this.ensureVisualizer();
              approachObserver.disconnect();
            }
          });
        }, { rootMargin: '400px 0px' });
        approachObserver.observe(this.section);
      }

      // Expose Public Global State Machine API as required
      window.setPhantomState = (state) => this.setState(state);
      window.phantomController = this;

      this.bindUI();
      this.initScrollStorytelling();
      this.setState('idle');
    }

    bindUI() {
      this.stageButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          const targetState = btn.dataset.state;
          if (targetState) {
            this.ensureVisualizer();
            this.setState(targetState);
          }
        });
      });
    }

    initScrollStorytelling() {
      const handleScroll = () => {
        if (!this.section) return;
        const rect = this.section.getBoundingClientRect();
        const winHeight = window.innerHeight;

        // Compute normalized progression (0.0 to 1.0)
        const totalTravel = rect.height + winHeight * 0.3;
        const currentProgress = (winHeight - rect.top) / totalTravel;
        const progress = Math.min(Math.max(currentProgress, 0), 1);

        if (progress < 0.05) return;

        let nextState = 'idle';
        if (progress < 0.22) {
          nextState = 'idle';
        } else if (progress < 0.44) {
          nextState = 'scanning';
        } else if (progress < 0.66) {
          nextState = 'analyzing';
        } else if (progress < 0.86) {
          nextState = 'change_found';
        } else {
          nextState = 'confirmed';
        }

        if (nextState !== this.currentState) {
          this.setState(nextState);
        }
      };

      window.addEventListener('scroll', handleScroll, { passive: true });
    }

    setState(state) {
      this.currentState = state;

      // 1. Notify Rive Indicator
      this.riveIndicator?.setState(state);

      // 2. Notify 3D Room Visualizer
      this.visualizer?.setState(state);

      // 3. Update Editorial HUD & Storytelling Copy
      this.updateUIContent(state);
    }

    updateUIContent(state) {
      // Pipeline Indicator
      const stepIndex = {
        idle: 0,
        scanning: 0,
        analyzing: 1,
        change_found: 1,
        confirmed: 2
      }[state] ?? 0;

      this.processSteps.forEach((step, idx) => {
        step.classList.toggle('active', idx === stepIndex);
      });

      // Stage Selector Buttons
      this.stageButtons.forEach((btn) => {
        const isActive = btn.dataset.state === state;
        btn.classList.toggle('active', isActive);
        btn.setAttribute('aria-selected', String(isActive));
      });

      // Story Card Content
      const contentMap = {
        idle: {
          tag: 'STATE 01 · IDLE',
          headline: 'PHANTOM is ready',
          desc: 'A quiet wireframe coordinate baseline is maintained. Every fixture and surface is mapped into a persistent spatial representation.',
          hudState: 'PHANTOM READY',
          delta: 'DELTA: 0.00M',
          showDiff: false,
          showStatement: false
        },
        scanning: {
          tag: 'STATE 02 · SCANNING',
          headline: 'Subtle spatial sweep',
          desc: 'A spatial sweep plane moves through the room. Known object nodes illuminate as the sensor bounds cross their physical coordinates.',
          hudState: 'PHANTOM SCANNING',
          delta: 'DELTA: 0.00M',
          showDiff: false,
          showStatement: false
        },
        analyzing: {
          tag: 'STATE 03 · ANALYZING',
          headline: 'Comparing memory with present',
          desc: 'Two spatial layers are evaluated simultaneously: the previous memory anchor on the side table and the newly observed reading on the bookshelf.',
          hudState: 'ANALYZING',
          delta: 'DELTA: 4.85M',
          showDiff: true,
          showStatement: false
        },
        change_found: {
          tag: 'STATE 04 · CHANGE FOUND',
          headline: 'Difference detected',
          desc: 'The previous position remains as a ghosted reference. A spatial displacement path connects the side table to the bookshelf.',
          hudState: 'CHANGE FOUND',
          delta: 'DELTA: 4.85M',
          showDiff: true,
          showStatement: false
        },
        confirmed: {
          tag: 'STATE 05 · CONFIRMED',
          headline: 'Verified spatial memory',
          desc: 'The system settles calmly. The previous position serves as the memory anchor, and the bookshelf position is locked as verified truth.',
          hudState: 'CONFIRMED',
          delta: 'DELTA: 4.85M',
          showDiff: true,
          showStatement: true
        }
      };

      const c = contentMap[state] || contentMap.idle;

      if (this.stageTag) this.stageTag.textContent = c.tag;
      if (this.stageHeadline) this.stageHeadline.textContent = c.headline;
      if (this.stageDesc) this.stageDesc.textContent = c.desc;
      if (this.hudState) this.hudState.textContent = c.hudState;
      if (this.hudDelta) this.hudDelta.textContent = c.delta;

      if (this.diffDetails) this.diffDetails.hidden = !c.showDiff;
      if (this.stageStatement) this.stageStatement.hidden = !c.showStatement;
    }
  }

  // Self-initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PhantomEngineController());
  } else {
    new PhantomEngineController();
  }
})();
