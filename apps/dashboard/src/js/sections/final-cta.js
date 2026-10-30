/**
 * ==============================================================================
 * SECTION 09: FINAL CTA — CONTROLLER & 3D VIGNETTE
 * - Quiet, warm, emotional closing moment of DISHA
 * - "What if your home could remember for you?"
 * - Small 3D fragment of the home: rich walnut side table, cozy armchair corner,
 *   reading glasses, warm parchment floor lamp, indoor plant, and a whisper-quiet
 *   PHANTOM spatial trace.
 * - Single restrained activation on entering viewport, settling into quiet resolution.
 * - Strictly respects prefers-reduced-motion and IntersectionObserver.
 * ==============================================================================
 */

(function () {
  'use strict';

  // Master Palette (100% harmonized with DISHA design system)
  const PALETTE = {
    bg: 0x141210,              // Dark Charcoal background
    wallPlaster: 0x181412,     // Deep warm room corner wall
    floorWood: 0x5C3B24,       // Deep rich walnut parquet floor
    floorPlankDark: 0x362012,  // Dark inlay planks
    rugBase: 0xDECEB6,         // Woven natural oat/cream rug
    tableWood: 0x543622,       // Polished deep walnut
    tableWoodLight: 0x72492E,  // Warm walnut highlight
    armchairFabric: 0x4B2C1B,  // Rich warm caramel-chestnut upholstery
    blanketTerracotta: 0xB64C2E,// Terracotta throw
    cushionMustard: 0xC89628,  // Warm velvet mustard
    lampBrass: 0xC89F48,       // Brushed warm brass
    lampShade: 0xF6EADB,       // Fluted parchment shade
    plantGreen: 0x3A4B26,      // Natural deep olive foliage
    plantDeep: 0x273418,       // Deep shadow foliage
    plantPot: 0xAC5838,        // Soft terracotta planter
    glassesFrame: 0x22140E,    // Deep espresso tortoiseshell
    glassesBridge: 0xD4A038,   // Warm gold bridge
    phantomTeal: 0x4D9D91,     // DISHA memory teal
    phantomTealGlow: 0x6BBFB4  // Soft shimmer
  };

  class FinalCtaController {
    constructor() {
      this.section = document.getElementById('final-cta');
      this.canvas = document.getElementById('ctaWorldCanvas');
      this.frame = document.getElementById('ctaWorldFrame');
      this.btnExplore = document.getElementById('btnFooterStart');
      this.btnBackToHome = document.getElementById('btnBackToHome');

      if (!this.section || !this.canvas) return;

      this.isIntersecting = false;
      this.hasActivatedTrace = false;
      this.animId = null;
      this.clock = new THREE.Clock();
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Three.js Core
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.camRestPos = new THREE.Vector3(24, 42, 54);
      this.camTarget = new THREE.Vector3(0, 16, 0);

      // Scene Groups
      this.worldGroup = null;
      this.tableGroup = null;
      this.chairGroup = null;
      this.lampGroup = null;
      this.plantGroup = null;
      this.glassesGroup = null;
      this.spatialTraceGroup = null;
      this.shadowTexture = null;
      this.isSceneInitialized = false;

      // Trace Animation State
      this.traceStartTime = 0;

      this.init();
    }

    init() {
      this.initReducedMotionListener();
      this.initButtons();
      this.initIntersectionObserver();

      if (window.THREE) {
        // Lazy-initialize 3D scene when approaching Section 09
        const approachObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && !this.isSceneInitialized) {
              this.isSceneInitialized = true;
              this.initScene();
              approachObserver.disconnect();
            }
          });
        }, { rootMargin: '400px 0px' });
        approachObserver.observe(this.section);
      }
    }

    initScene() {
      this.shadowTexture = this.createRadialShadowTexture();
      this.initThree();
      this.setupLighting();
      this.buildEnvironment();
      this.buildReadingGlasses();
      this.buildSpatialTrace();
      this.initResizeListener();

      if (this.isIntersecting) {
        if (!this.prefersReducedMotion) {
          this.startLoop();
        } else {
          this.renderStatic();
        }
      }
    }

    initButtons() {
      const scrollToBeginning = (e) => {
        if (e) e.preventDefault();
        const homeEl = document.getElementById('home');
        if (homeEl) {
          homeEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
        const trig = window.triggerDishaStory || window.triggerSmritiStory;
      if (trig) {
          window.setTimeout(() => trig(), 450);
        }
      };

      if (this.btnExplore) {
        this.btnExplore.addEventListener('click', scrollToBeginning);
      }
      if (this.btnBackToHome) {
        this.btnBackToHome.addEventListener('click', scrollToBeginning);
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
            this.resetStaticComposition();
            this.renderStatic();
          } else if (this.isIntersecting) {
            this.startLoop();
          }
        });
      }
    }

    createRadialShadowTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(8, 6, 5, 0.82)');
      gradient.addColorStop(0.35, 'rgba(8, 6, 5, 0.48)');
      gradient.addColorStop(0.70, 'rgba(8, 6, 5, 0.15)');
      gradient.addColorStop(1.0, 'rgba(8, 6, 5, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    initIntersectionObserver() {
      // Reveal immediately if navigating directly to final-cta
      const checkHash = () => {
        if (window.location.hash === '#final-cta') {
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
              this.section.classList.add('revealed');

              if (!this.hasActivatedTrace) {
                this.hasActivatedTrace = true;
                this.traceStartTime = performance.now();
              }

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

      // Safety fallback: ensure CTA content is never stuck in hidden state
      setTimeout(() => {
        if (this.section && !this.section.classList.contains('revealed')) {
          this.section.classList.add('revealed');
        }
      }, 1200);
    }

    initThree() {
      const rect = this.frame.getBoundingClientRect();
      const width = rect.width || 480;
      const height = rect.height || 360;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(PALETTE.bg);
      this.scene.fog = new THREE.FogExp2(PALETTE.bg, 0.0075);

      this.camera = new THREE.PerspectiveCamera(31, width / height, 1, 600);
      this.camera.position.copy(this.camRestPos);
      this.camera.lookAt(this.camTarget);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;

      this.worldGroup = new THREE.Group();
      this.scene.add(this.worldGroup);
    }

    setupLighting() {
      // 1. Warm Ambient Base (gentle dusk twilight)
      const ambient = new THREE.AmbientLight(0xFFEADB, 0.44);
      this.scene.add(ambient);

      // 2. Warm Key Window Sunlight
      const sun = new THREE.DirectionalLight(0xFFF3E2, 0.98);
      sun.position.set(34, 70, 38);
      this.scene.add(sun);

      // 3. Intimate Golden Floor Lamp Glow
      const lampPoint = new THREE.PointLight(0xFFDEB0, 1.45, 110, 1.8);
      lampPoint.position.set(19, 38, -10);
      this.scene.add(lampPoint);

      // 4. Soft Rim Bounce Light
      const rimLight = new THREE.DirectionalLight(0xEED9C0, 0.30);
      rimLight.position.set(-45, 35, -25);
      this.scene.add(rimLight);
    }

    buildEnvironment() {
      // 1. Soft Curved Corner Plaster Wall behind furniture
      const matWall = new THREE.MeshStandardMaterial({
        color: PALETTE.wallPlaster,
        roughness: 0.92,
        metalness: 0.02,
        side: THREE.BackSide
      });
      const wallCorner = new THREE.Mesh(
        new THREE.CylinderGeometry(65, 65, 80, 36, 1, true, -Math.PI * 0.45, Math.PI * 0.9),
        matWall
      );
      wallCorner.position.set(4, 38, -12);
      this.worldGroup.add(wallCorner);

      // 2. Wide Parquet Floor Disc extending past the frame
      const matFloor = new THREE.MeshStandardMaterial({
        color: PALETTE.floorWood,
        roughness: 0.48,
        metalness: 0.05
      });
      const floorDisc = new THREE.Mesh(new THREE.CylinderGeometry(75, 75, 3, 54), matFloor);
      floorDisc.position.set(0, -1.5, 0);
      this.worldGroup.add(floorDisc);

      // Fine parquet planks
      const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.floorPlankDark, opacity: 0.38, transparent: true });
      for (let x = -60; x <= 60; x += 11) {
        const plank = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 120), lineMat);
        plank.rotation.x = -Math.PI * 0.5;
        plank.position.set(x, 0.02, 0);
        this.worldGroup.add(plank);
      }

      // 3. Soft Organic Pebble Rug under seating & table
      const rugShape = new THREE.Shape();
      rugShape.moveTo(-24, -20);
      rugShape.bezierCurveTo(-38, -8, -40, 20, -22, 32);
      rugShape.bezierCurveTo(-4, 40, 20, 38, 32, 22);
      rugShape.bezierCurveTo(42, 6, 38, -18, 20, -28);
      rugShape.bezierCurveTo(4, -36, -12, -28, -24, -20);

      const rugGeo = new THREE.ShapeGeometry(rugShape, 36);
      const rugMat = new THREE.MeshStandardMaterial({
        color: PALETTE.rugBase,
        roughness: 0.92,
        metalness: 0.02
      });
      const rug = new THREE.Mesh(rugGeo, rugMat);
      rug.rotation.x = -Math.PI * 0.5;
      rug.position.set(2, 0.05, -1);
      this.worldGroup.add(rug);

      // 4. Side Table
      this.buildSideTable();

      // 5. Armchair Fragment
      this.buildArmchairFragment();

      // 6. Floor Lamp
      this.buildFloorLamp();

      // 7. Indoor Plant
      this.buildIndoorPlant();
    }

    buildSideTable() {
      this.tableGroup = new THREE.Group();
      this.tableGroup.position.set(-4, 0, 4);
      this.worldGroup.add(this.tableGroup);

      const matWood = new THREE.MeshStandardMaterial({ color: PALETTE.tableWood, roughness: 0.42, metalness: 0.06 });
      const matBrass = new THREE.MeshStandardMaterial({ color: PALETTE.lampBrass, roughness: 0.28, metalness: 0.85 });

      // Tabletop: warm walnut bevel disc
      const tabletop = new THREE.Mesh(new THREE.CylinderGeometry(13.2, 12.8, 1.2, 36), matWood);
      tabletop.position.set(0, 19.0, 0);
      this.tableGroup.add(tabletop);

      const tableRim = new THREE.Mesh(new THREE.TorusGeometry(13.0, 0.32, 12, 36), matWood);
      tableRim.rotation.x = Math.PI * 0.5;
      tableRim.position.set(0, 19.5, 0);
      this.tableGroup.add(tableRim);

      // Tapered walnut legs with brass ferrules
      const legAngles = [0.2, 2.3, 4.4];
      legAngles.forEach((angle) => {
        const legGroup = new THREE.Group();
        legGroup.position.set(Math.cos(angle) * 8.6, 0, Math.sin(angle) * 8.6);

        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 18.2, 16), matWood);
        leg.position.y = 9.2;
        leg.rotation.z = Math.cos(angle) * 0.08;
        leg.rotation.x = -Math.sin(angle) * 0.08;
        legGroup.add(leg);

        const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 2.2, 16), matBrass);
        ferrule.position.y = 1.1;
        legGroup.add(ferrule);

        this.tableGroup.add(legGroup);
      });

      // Soft contact shadow under table
      const shadow = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.64, depthWrite: false })
      );
      shadow.rotation.x = -Math.PI * 0.5;
      shadow.position.set(0, 0.06, 0);
      this.tableGroup.add(shadow);
    }

    buildArmchairFragment() {
      this.chairGroup = new THREE.Group();
      this.chairGroup.position.set(-19, 0, -11);
      this.chairGroup.rotation.y = 0.55;
      this.worldGroup.add(this.chairGroup);

      const matFabric = new THREE.MeshStandardMaterial({ color: PALETTE.armchairFabric, roughness: 0.82, metalness: 0.02 });
      const matBlanket = new THREE.MeshStandardMaterial({ color: PALETTE.blanketTerracotta, roughness: 0.88 });
      const matCushion = new THREE.MeshStandardMaterial({ color: PALETTE.cushionMustard, roughness: 0.85 });

      // Curved seat cushion
      const seat = new THREE.Mesh(new THREE.BoxGeometry(22, 6.5, 21), matFabric);
      seat.position.set(0, 8.8, 0);
      this.chairGroup.add(seat);

      // Backrest
      const backrest = new THREE.Mesh(new THREE.BoxGeometry(22, 21, 6.5), matFabric);
      backrest.position.set(0, 19, -9.5);
      backrest.rotation.x = -0.12;
      this.chairGroup.add(backrest);

      // Armrest
      const arm = new THREE.Mesh(new THREE.BoxGeometry(5.5, 12, 22), matFabric);
      arm.position.set(11.5, 13.8, 0);
      this.chairGroup.add(arm);

      // Folded terracotta throw over backrest
      const throwPlank = new THREE.Mesh(new THREE.BoxGeometry(10.5, 15, 7.2), matBlanket);
      throwPlank.position.set(-4, 19, -9.2);
      throwPlank.rotation.x = -0.12;
      this.chairGroup.add(throwPlank);

      // Velvet mustard cushion
      const cushion = new THREE.Mesh(new THREE.BoxGeometry(9.5, 9.5, 3.8), matCushion);
      cushion.position.set(4, 13.5, -5.5);
      cushion.rotation.x = -0.22;
      cushion.rotation.y = -0.15;
      this.chairGroup.add(cushion);

      // Wooden chair legs
      const matLegs = new THREE.MeshStandardMaterial({ color: PALETTE.tableWood, roughness: 0.5 });
      [
        [-8.5, -7], [8.5, -7], [-8.5, 7], [8.5, 7]
      ].forEach(([lx, lz]) => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.95, 6.8, 12), matLegs);
        leg.position.set(lx, 3.4, lz);
        this.chairGroup.add(leg);
      });

      // Contact shadow under chair
      const chairShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(34, 30),
        new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.58, depthWrite: false })
      );
      chairShadow.rotation.x = -Math.PI * 0.5;
      chairShadow.position.set(0, 0.06, 0);
      this.chairGroup.add(chairShadow);
    }

    buildFloorLamp() {
      this.lampGroup = new THREE.Group();
      this.lampGroup.position.set(18, 0, -13);
      this.worldGroup.add(this.lampGroup);

      const matBrass = new THREE.MeshStandardMaterial({ color: PALETTE.lampBrass, roughness: 0.32, metalness: 0.88 });
      const matShade = new THREE.MeshStandardMaterial({
        color: PALETTE.lampShade,
        roughness: 0.65,
        emissive: 0xFFD8A0,
        emissiveIntensity: 0.52
      });

      // Lamp base disc
      const base = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.2, 0.8, 32), matBrass);
      base.position.y = 0.4;
      this.lampGroup.add(base);

      // Slender vertical brass stem
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 42, 16), matBrass);
      stem.position.y = 21.4;
      this.lampGroup.add(stem);

      // Fluted conical parchment shade
      const shade = new THREE.Mesh(new THREE.ConeGeometry(7.5, 9.2, 28, 1, true), matShade);
      shade.position.y = 44.5;
      this.lampGroup.add(shade);

      // Shadow under lamp base
      const lampShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 16),
        new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.48, depthWrite: false })
      );
      lampShadow.rotation.x = -Math.PI * 0.5;
      lampShadow.position.set(0, 0.06, 0);
      this.lampGroup.add(lampShadow);
    }

    buildIndoorPlant() {
      this.plantGroup = new THREE.Group();
      this.plantGroup.position.set(15, 0, 16);
      this.worldGroup.add(this.plantGroup);

      const matPot = new THREE.MeshStandardMaterial({ color: PALETTE.plantPot, roughness: 0.85 });
      const matFoliage = new THREE.MeshStandardMaterial({ color: PALETTE.plantGreen, roughness: 0.65 });
      const matDeepFoliage = new THREE.MeshStandardMaterial({ color: PALETTE.plantDeep, roughness: 0.72 });

      // Terracotta cylindrical planter
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 3.2, 7.5, 24), matPot);
      pot.position.y = 3.75;
      this.plantGroup.add(pot);

      // Soil
      const soil = new THREE.Mesh(new THREE.CylinderGeometry(3.9, 3.9, 0.6, 20), new THREE.MeshStandardMaterial({ color: 0x1E120A, roughness: 0.95 }));
      soil.position.y = 7.3;
      this.plantGroup.add(soil);

      // Arching organic leaves
      const leafAngles = [0, 1.1, 2.2, 3.3, 4.4, 5.5];
      leafAngles.forEach((ang, idx) => {
        const leafGroup = new THREE.Group();
        leafGroup.position.set(0, 7.4, 0);
        leafGroup.rotation.y = ang;

        const leafMesh = new THREE.Mesh(
          new THREE.SphereGeometry(3.5, 8, 8),
          idx % 2 === 0 ? matFoliage : matDeepFoliage
        );
        leafMesh.scale.set(0.42, 1.65, 0.08);
        leafMesh.position.set(0, 3.8, 2.6);
        leafMesh.rotation.x = 0.55;
        leafGroup.add(leafMesh);

        this.plantGroup.add(leafGroup);
      });

      // Shadow under pot
      const potShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(13, 13),
        new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.52, depthWrite: false })
      );
      potShadow.rotation.x = -Math.PI * 0.5;
      potShadow.position.set(0, 0.06, 0);
      this.plantGroup.add(potShadow);
    }

    buildReadingGlasses() {
      // Complete symmetrical reading glasses resting comfortably on the side table
      this.glassesGroup = new THREE.Group();
      this.glassesGroup.position.set(-3.5, 19.62, 4.2);
      this.glassesGroup.rotation.set(-0.06, 0.35, -0.04);
      this.worldGroup.add(this.glassesGroup);

      // Small resting notebook under glasses
      const matBookCover = new THREE.MeshStandardMaterial({ color: 0x3E281C, roughness: 0.72 });
      const matBookPages = new THREE.MeshStandardMaterial({ color: 0xFDF8EE, roughness: 0.85 });
      const bookCover = new THREE.Mesh(new THREE.BoxGeometry(10.5, 0.8, 8.2), matBookCover);
      bookCover.position.set(-0.2, 0.4, 0);
      this.glassesGroup.add(bookCover);

      const bookPages = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.6, 7.6), matBookPages);
      bookPages.position.set(-0.2, 0.42, 0);
      this.glassesGroup.add(bookPages);

      // Glasses Model Components
      const matFrame = new THREE.MeshStandardMaterial({ color: PALETTE.glassesFrame, roughness: 0.35, metalness: 0.20 });
      const matBridge = new THREE.MeshStandardMaterial({ color: PALETTE.glassesBridge, roughness: 0.25, metalness: 0.85 });
      const matLens = new THREE.MeshPhysicalMaterial({
        color: 0xEEF8FC,
        roughness: 0.05,
        transmission: 0.88,
        transparent: true,
        opacity: 0.8,
        reflectivity: 0.85
      });

      const glassesSub = new THREE.Group();
      glassesSub.position.set(0, 2.62, 0);
      glassesSub.scale.set(0.48, 0.48, 0.48);

      // Left Eye Rim & Lens
      const rimGeo = new THREE.TorusGeometry(3.2, 0.55, 14, 24);
      const rimL = new THREE.Mesh(rimGeo, matFrame);
      rimL.position.set(-4.2, 0, 0);
      glassesSub.add(rimL);

      const lensL = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.3, 20), matLens);
      lensL.position.set(-4.2, 0, 0);
      lensL.rotation.x = Math.PI * 0.5;
      glassesSub.add(lensL);

      // Right Eye Rim & Lens
      const rimR = new THREE.Mesh(rimGeo, matFrame);
      rimR.position.set(4.2, 0, 0);
      glassesSub.add(rimR);

      const lensR = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.3, 20), matLens);
      lensR.position.set(4.2, 0, 0);
      lensR.rotation.x = Math.PI * 0.5;
      glassesSub.add(lensR);

      // Golden Bridge
      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 2.8, 12), matBridge);
      bridge.rotation.z = Math.PI * 0.5;
      bridge.position.y = 0.4;
      glassesSub.add(bridge);

      // Left Temple Arm
      const armGeo = new THREE.CylinderGeometry(0.35, 0.35, 9.8, 12);
      const armL = new THREE.Mesh(armGeo, matFrame);
      armL.position.set(-7.4, -1.2, -4.8);
      armL.rotation.x = Math.PI * 0.5 + 0.22;
      armL.rotation.z = 0.06;
      glassesSub.add(armL);

      // Right Temple Arm
      const armR = new THREE.Mesh(armGeo, matFrame);
      armR.position.set(7.4, -1.2, -4.8);
      armR.rotation.x = Math.PI * 0.5 + 0.22;
      armR.rotation.z = -0.06;
      glassesSub.add(armR);

      this.glassesGroup.add(glassesSub);

      // Soft contact shadow under glasses
      const glassesShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(9.5, 7.0),
        new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.56, depthWrite: false })
      );
      glassesShadow.rotation.x = -Math.PI * 0.5;
      glassesShadow.position.set(0, 0.82, 0);
      this.glassesGroup.add(glassesShadow);
    }

    buildSpatialTrace() {
      // Very subtle PHANTOM spatial trace around the glasses:
      // tiny node, faint location marker, subtle spatial line, soft glow.
      // Starts invisible, activates once on viewport reveal, settles quietly.
      this.spatialTraceGroup = new THREE.Group();
      this.spatialTraceGroup.position.set(-3.5, 22.8, 4.2);
      this.worldGroup.add(this.spatialTraceGroup);

      // 1. Tiny Luminous Teal Node
      const matNode = new THREE.MeshBasicMaterial({
        color: PALETTE.phantomTeal,
        transparent: true,
        opacity: 0.0
      });
      this.traceNode = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), matNode);
      this.traceNode.position.y = 3.6;
      this.spatialTraceGroup.add(this.traceNode);

      // 2. Delicate Faint Hairline Ring Marker
      const ringGeo = new THREE.RingGeometry(3.2, 3.35, 36);
      const ringMat = new THREE.MeshBasicMaterial({
        color: PALETTE.phantomTealGlow,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.0
      });
      this.traceRing = new THREE.Mesh(ringGeo, ringMat);
      this.traceRing.rotation.x = -Math.PI * 0.5;
      this.traceRing.position.y = 0.2;
      this.spatialTraceGroup.add(this.traceRing);

      // 3. Subtle Hairline Spatial Coordinate Tick
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.2, 0),
        new THREE.Vector3(0, 3.6, 0)
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: PALETTE.phantomTeal,
        transparent: true,
        opacity: 0.0
      });
      this.traceLine = new THREE.Line(lineGeo, lineMat);
      this.spatialTraceGroup.add(this.traceLine);

      // 4. Soft Micro Glow Sprite/Aura
      const glowGeo = new THREE.PlaneGeometry(6, 6);
      const glowMat = new THREE.MeshBasicMaterial({
        map: this.shadowTexture,
        color: PALETTE.phantomTeal,
        transparent: true,
        opacity: 0.0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      this.traceGlow = new THREE.Mesh(glowGeo, glowMat);
      this.traceGlow.position.y = 3.6;
      this.spatialTraceGroup.add(this.traceGlow);
    }

    updateSpatialTrace(time) {
      if (!this.hasActivatedTrace) return;

      const elapsed = (time - this.traceStartTime) / 1000;
      const duration = 2.4;

      if (elapsed < duration) {
        const progress = Math.min(1.0, elapsed / duration);
        const ease = Math.sin(progress * Math.PI * 0.5);
        const pulse = Math.sin(progress * Math.PI);

        const nodeOpacity = 0.25 + pulse * 0.55;
        const ringOpacity = 0.12 + pulse * 0.38;
        const lineOpacity = 0.10 + pulse * 0.35;
        const glowOpacity = 0.08 + pulse * 0.22;

        this.traceNode.material.opacity = nodeOpacity;
        this.traceRing.material.opacity = ringOpacity;
        this.traceLine.material.opacity = lineOpacity;
        this.traceGlow.material.opacity = glowOpacity;

        const scale = 0.85 + ease * 0.15 + pulse * 0.1;
        this.traceRing.scale.set(scale, scale, scale);
      } else {
        // Settled calm resting pose
        this.traceNode.material.opacity = 0.45;
        this.traceRing.material.opacity = 0.22;
        this.traceLine.material.opacity = 0.18;
        this.traceGlow.material.opacity = 0.12;
        this.traceRing.scale.set(1.0, 1.0, 1.0);
      }
    }

    startLoop() {
      if (this.animId) return;
      const tick = (now) => {
        this.animId = requestAnimationFrame(tick);
        this.update(now);
      };
      this.animId = requestAnimationFrame(tick);
    }

    stopLoop() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
    }

    update(now) {
      if (!this.renderer || !this.scene || !this.camera) return;

      const elapsed = this.clock.getElapsedTime();

      // Update spatial trace activation
      this.updateSpatialTrace(now);

      // Imperceptible camera drift (breathing room atmosphere)
      if (!this.prefersReducedMotion) {
        const driftX = Math.sin(elapsed * 0.14) * 0.55;
        const driftY = Math.cos(elapsed * 0.18) * 0.40;
        this.camera.position.set(
          this.camRestPos.x + driftX,
          this.camRestPos.y + driftY,
          this.camRestPos.z
        );
        this.camera.lookAt(this.camTarget);
      }

      this.renderer.render(this.scene, this.camera);
    }

    resetStaticComposition() {
      this.camera.position.copy(this.camRestPos);
      this.camera.lookAt(this.camTarget);
      if (this.traceNode) this.traceNode.material.opacity = 0.40;
      if (this.traceRing) this.traceRing.material.opacity = 0.20;
      if (this.traceLine) this.traceLine.material.opacity = 0.16;
      if (this.traceGlow) this.traceGlow.material.opacity = 0.10;
    }

    renderStatic() {
      if (!this.renderer || !this.scene || !this.camera) return;
      this.resetStaticComposition();
      this.renderer.render(this.scene, this.camera);
    }

    initResizeListener() {
      let resizeTimeout = null;
      const onResize = () => {
        if (!this.frame || !this.renderer || !this.camera) return;
        const rect = this.frame.getBoundingClientRect();
        const width = rect.width || 480;
        const height = rect.height || 360;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);

        if (this.prefersReducedMotion || !this.isIntersecting) {
          this.renderStatic();
        }
      };

      window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(onResize, 100);
      }, { passive: true });
    }
  }

  // Initialize once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.finalCtaController = new FinalCtaController();
    });
  } else {
    window.finalCtaController = new FinalCtaController();
  }
})();
