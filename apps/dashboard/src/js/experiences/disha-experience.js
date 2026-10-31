/**
 * DISHA — Spatial Memory Web Experience Engine (v4.1 Final Polish)
 * ----------------------------------------------------------------------------
 * Integrates:
 * - 3D Assets: Dora (GLB), small_table.glb, sofa.glb, plant_with_pot.glb
 * - Exact physical surface contact calculations (Zero penetration, zero floating)
 * - Soft radial-gradient contact shadows (Zero harsh bounding boxes)
 * - Harmonized warm palette (Terracotta-caramel sofa, oak table, organic green plant)
 * - Authoritative single-source-of-truth glasses state machine
 * - Smartphone prop facing Dora's face with live OLED canvas UI & soft facial glow
 * - Real character root motion translation & directional walking to bookshelf
 * - Physical hand-object reach and pickup synchronization
 * - Translucent PHANTOM spatial scan & 26% memory ghost imprint at exact table origin
 * - Multi-state CTA button: See how it works -> Playing… -> Story complete ✓ -> Replay story ↻
 * - High-contrast warm editorial color palette
 */

(function() {
  'use strict';

  // 70 / 20 / 10 Master Palette Constants (High-Contrast Warm Editorial)
  const PALETTE = {
    // 70% Architectural Warmth
    bg: 0xD1B28E,              // Warm midtone backdrop with visible contrast
    wallPlaster: 0xB28A66,     // Soft caramel plaster, distinct from the pale sofa and rug
    floorWood: 0x8B6042,       // Rich walnut/caramel oak floor (#8B6042)
    floorPlankDark: 0x5C381E,  // Dark parquet inlay (#5C381E)
    rugBase: 0xFAEBD5,         // Organic pebble rug (#FAEBD5)
    rugBorder: 0xDECAB0,       // Woven border

    // 20% Character & Furniture Anchors
    charSweater: 0x53613B,     // Deep Olive Knit (#53613B)
    charCollar: 0x3B4628,      // Deep Olive Ribbed Trim
    charAccent: 0xC95F3D,      // Terracotta Accent (#C95F3D)
    charPants: 0xFAEBD5,       // Warm Cream Linen Trousers (#FAEBD5)
    charShoes: 0x34251F,       // Dark Brown Loafers (#34251F)
    charHair: 0x2A1C16,        // Deep Espresso Hair
    charSkin: 0xF7CBB6,        // Warm Peach Skin with Subsurface Glow
    charBlush: 0xE06E50,       // Soft Coral Cheeks

    furnitureWood: 0x8B6042,   // Rich warm wood (#8B6042)
    furnitureDark: 0x34251F,   // Dark brown (#34251F)
    armchairFabric: 0x754832,  // Muted caramel upholstery
    blanketTerracotta: 0xC95F3D,// Terracotta Throw (#C95F3D)
    cushionMustard: 0xD5A63C,  // Warm Velvet Mustard (#D5A63C)
    lampBrass: 0xC8A050,       // Brushed Warm Brass
    lampShade: 0xFDF6E8,       // Fluted Parchment Shade
    plantGreen: 0x53613B,      // Natural deep olive foliage
    plantDeep: 0x364024,       // Deep olive shadow foliage
    plantPot: 0xB66A4A,        // Soft terracotta planter

    // 10% PHANTOM Story Accents
    glassesFrame: 0x34251F,    // Dark Espresso Frame (#34251F)
    glassesBridge: 0xD5A63C,   // Warm Gold Bridge (#D5A63C)
    phantomTeal: 0x4D9D91,     // SMRITI Memory Teal (#4D9D91)
    phantomTealGlow: 0x65B5A9, // Luminous Recall Shimmer
    movementAmber: 0xD5A63C,   // Spatial Trajectory Mustard/Amber (#D5A63C)
    confirmGreen: 0x53613B     // Verified Memory Green (#53613B)
  };

  // World Anchors & Physical Surfaces
  const CHAR_ORIGIN = { x: 4, y: 0, z: 10 };
  const DORA_SHELF_POS = { x: 78, y: 0, z: -66 }; // Destination in front of bookshelf shelf 2

  // Cinematic Camera Choreography
  const CAM_PRESETS = {
    HOME:          { pos: { x: 50, y: 110, z: 275 }, target: { x: 4, y: 54, z: -10 }, fov: 31 },
    NOTICE:        { pos: { x: 30, y: 94, z: 205 },  target: { x: -25, y: 52, z: 8 },  fov: 28 },
    GLASSES_MOVE:  { pos: { x: 42, y: 102, z: 245 }, target: { x: 10, y: 58, z: -20 }, fov: 30 },
    SEARCH:        { pos: { x: 22, y: 102, z: 220 }, target: { x: -35, y: 52, z: 5 },  fov: 29 },
    PHONE_CHECK:   { pos: { x: 22, y: 88, z: 175 },  target: { x: 6, y: 56, z: 12 },   fov: 26 },
    PHANTOM_SCAN:  { pos: { x: 28, y: 120, z: 295 }, target: { x: 16, y: 56, z: -35 }, fov: 38 },
    MEMORY_REVEAL: { pos: { x: 28, y: 120, z: 295 }, target: { x: 16, y: 56, z: -35 }, fov: 38 },
    NOTICE_SHELF:  { pos: { x: 55, y: 104, z: 235 }, target: { x: 62, y: 58, z: -55 }, fov: 30 },
    WALK_TO_SHELF: { pos: { x: 70, y: 108, z: 235 }, target: { x: 65, y: 56, z: -55 }, fov: 31 },
    APPROACH:      { pos: { x: 92, y: 100, z: 165 }, target: { x: 86, y: 64, z: -75 }, fov: 28 },
    PICKUP:        { pos: { x: 92, y: 100, z: 165 }, target: { x: 86, y: 64, z: -75 }, fov: 28 },
    RELIEF:        { pos: { x: 86, y: 102, z: 195 }, target: { x: 76, y: 62, z: -60 }, fov: 29 }
  };

  class DishaExperience {
    constructor(containerId) {
      this.container = document.getElementById(containerId) || document.getElementById('spatialViewport') || document.getElementById('splineCanvas');
      if (!this.container) return;

      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.camTarget = new THREE.Vector3().copy(CAM_PRESETS.HOME.target);
      this.targetCamPos = new THREE.Vector3().copy(CAM_PRESETS.HOME.pos);
      this.targetCamLook = new THREE.Vector3().copy(CAM_PRESETS.HOME.target);
      this.targetFov = CAM_PRESETS.HOME.fov;

      // Shared Radial Shadow Texture for Soft Realistic Contact Shadows
      this.shadowTexture = null;

      // 3D Subject Handles (Hero Character: Dora GLB)
      this.character = null;
      this.characterHead = null;
      this.doraEyes = null;
      this.doraLoaded = false;
      this.doraModel = null;
      this.doraBodyMesh = null;
      this.baseBodyPositions = null;
      this.rightHandWorldPos = new THREE.Vector3();
      this.leftHandWorldPos = new THREE.Vector3();

      // Explicit Look & Destination Spatial Targets
      this.PHONE_LOOK_TARGET = new THREE.Vector3();
      this.TABLE_LOOK_TARGET = new THREE.Vector3(-78, 48.0, 8);
      this.SHELF_LOOK_TARGET = new THREE.Vector3(104, 83.5, -85);
      this.SHELF_INTERACTION_POINT = new THREE.Vector3(76, 0, -64);

      // Environment 3D GLB Handles
      this.tableGroup = null;
      this.tableTopSurfaceY = 48.0;
      this.sofaGroup = null;
      this.plantGroup = null;
      this.shelfGroup = null;

      // Smartphone Prop Handles
      this.phone = null;
      this.phoneCanvas = null;
      this.phoneCtx = null;
      this.phoneTexture = null;
      this.phoneScreenLight = null;

      // Authoritative Glasses State Machine & Physics Handles
      // States: 'GLASSES_TABLE' | 'GLASSES_MOVING' | 'GLASSES_SHELF' | 'GLASSES_HELD'
      this.glassesState = 'GLASSES_TABLE';
      this.glasses = null;
      this.ghostGlasses = null;
      this.glassesTablePos = new THREE.Vector3(-78, 51.5, 8);
      this.glassesTableRot = new THREE.Euler(-0.12, 0.32, -0.05);
      this.glassesShelfPos = new THREE.Vector3(104, 85.2, -85);
      this.glassesShelfRot = new THREE.Euler(-0.12, 0.28, 0);
      this.tableContactShadow = null;
      this.shelfContactShadow = null;
      this.glassesPickedUp = false;

      // PHANTOM Spatial Scan Climax Handles
      this.spatialScanPlane = null;
      this.scanSweepLight = null;
      this.tableSpatialPoints = null;
      this.highlightGhost = null;
      this.highlightMoved = null;
      this.spatialTrail = null;
      this.roomLights = {};

      // Dynamic Character Transforms
      this.charPos = new THREE.Vector3().copy(CHAR_ORIGIN);
      this.charRot = new THREE.Euler(0, 0.22, 0);
      this.headRot = new THREE.Euler(0, 0, 0);

      // Procedural Life & Natural Blinking Timer
      this.lastBlinkTime = 0;
      this.nextBlinkInterval = 3200;
      this.isBlinking = false;
      this.blinkDuration = 120;

      // Arm FK Pose State (Default natural relaxed asymmetric idle)
      this.currentArmPose = {
        lShoulderRoll: -1.40,
        lShoulderPitch: -0.15,
        lShoulderYaw: 0.05,
        lElbowBend: 0.28,
        lWristFlex: 0.18,
        rShoulderRoll: -1.02,
        rShoulderPitch: -0.38,
        rShoulderYaw: -0.15,
        rElbowBend: 0.92,
        rWristFlex: 0.32
      };

      // Story Timeline Tracking
      this.isStoryActive = false;
      this.storyStartTime = 0;
      this.currentStoryPhase = 'IDLE';

      // UI Handles
      this.ui = {
        overline: document.getElementById('storyStatusText') || document.getElementById('heroOverline'),
        narration: document.getElementById('heroCaptionWrap') || document.getElementById('heroNarration'),
        narrTitle: document.getElementById('heroCaptionText') || document.getElementById('narrationTitle'),
        narrDetail: document.getElementById('heroCaptionSub') || document.getElementById('narrationDetail'),
        note: document.getElementById('memoryReceiptToast') || document.getElementById('heroMemoryNote'),
        cta: document.getElementById('btnStartExperience') || document.getElementById('hero-cta'),
        ctaLabel: document.getElementById('btnExperienceLabel'),
        progress: document.getElementById('heroProgress'),
        progressFill: document.getElementById('storyProgress') || document.getElementById('heroProgressFill'),
        replay: document.getElementById('btnResetExperience') || document.getElementById('heroReplay')
      };

      this.init();
    }

    createRadialShadowTexture() {
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const gradient = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(36, 23, 16, 0.75)');
      gradient.addColorStop(0.35, 'rgba(36, 23, 16, 0.45)');
      gradient.addColorStop(0.70, 'rgba(36, 23, 16, 0.15)');
      gradient.addColorStop(1.0, 'rgba(36, 23, 16, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 128, 128);
      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;
      return texture;
    }

    init() {
      // 1. Scene with Warm Canvas Atmosphere
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(PALETTE.bg);
      this.scene.fog = new THREE.FogExp2(PALETTE.bg, 0.00022);

      this.shadowTexture = this.createRadialShadowTexture();

      const aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera = new THREE.PerspectiveCamera(CAM_PRESETS.HOME.fov, aspect, 10, 3000);

      this.updateStoryCameraFraming('IDLE', 0);
      this.camera.position.copy(this.targetCamPos);
      this.camTarget.copy(this.targetCamLook);
      this.camera.fov = this.targetFov;
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(this.camTarget);

      // 2. High-Fidelity Renderer with Controlled Tone Mapping
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;

      this.container.appendChild(this.renderer.domElement);

      // 3. Assemble Organic Environment & Import 3D Assets
      this.setupCinematicLighting();
      this.buildOrganicEnvironment();
      this.loadSmallTable();
      this.loadSofa();
      this.loadPlant();
      this.buildBookshelf();
      this.buildSmartphone();
      this.loadDoraCharacter();
      this.buildHeroProps();

      window.addEventListener('resize', () => this.onResize());
      if (window.ResizeObserver && this.container) {
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.container);
      }
      this.setupUIListeners();

      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener) {
        window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
          this.prefersReducedMotion = e.matches;
        });
      }

      this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      window.addEventListener('mousemove', (e) => {
        if (this.prefersReducedMotion) return;
        this.mouse.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
        this.mouse.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
      });

      // Auto-start if requested in URL
      if (window.location.search.includes('story=true') || window.location.hash === '#story') {
        setTimeout(() => this.startStory(), 1400);
      }

      this.isIntersecting = true;
      this.animId = null;
      this.animate = this.animate.bind(this);

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          this.isIntersecting = entry.isIntersecting;
          if (this.isIntersecting) {
            this.startLoop();
          } else {
            this.stopLoop();
          }
        });
      }, { threshold: 0.05 });
      observer.observe(this.container);

      this.startLoop();
    }

    // =========================================================================
    // 1. CINEMATIC LIGHTING (Warm sunlight, soft bounce, rim light, PHANTOM layer)
    // =========================================================================
    setupCinematicLighting() {
      const ambient = new THREE.AmbientLight(0xFFE5D0, 0.42);
      this.scene.add(ambient);
      this.roomLights.ambient = ambient;

      // Key Warm Sunlight
      const sun = new THREE.DirectionalLight(0xFFF2E2, 1.35);
      sun.position.set(110, 240, 160);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      sun.shadow.camera.near = 20;
      sun.shadow.camera.far = 700;
      const d = 160;
      sun.shadow.camera.left = -d;
      sun.shadow.camera.right = d;
      sun.shadow.camera.top = d;
      sun.shadow.camera.bottom = -d;
      sun.shadow.bias = -0.0004;
      sun.shadow.radius = 2.4;
      this.scene.add(sun);
      this.roomLights.sun = sun;

      // Soft Warm Window Bounce Fill
      const windowFill = new THREE.DirectionalLight(0xF5DEC0, 0.50);
      windowFill.position.set(-150, 130, 80);
      this.scene.add(windowFill);
      this.roomLights.fill = windowFill;

      // Character Backlight / Rim
      const rimLight = new THREE.DirectionalLight(0xFFE8D6, 0.60);
      rimLight.position.set(-30, 140, -180);
      this.scene.add(rimLight);
      this.roomLights.rim = rimLight;

      // PHANTOM Teal Spatial Memory Light
      const phantomLight = new THREE.PointLight(PALETTE.phantomTealGlow, 0, 360);
      phantomLight.position.set(14, 110, -25);
      this.scene.add(phantomLight);
      this.roomLights.phantom = phantomLight;
    }

    // =========================================================================
    // 2. ORGANIC ENVIRONMENT (Curved walls, warm oak parquet floor, soft pebble rug)
    // =========================================================================
    buildOrganicEnvironment() {
      const matFloor = new THREE.MeshStandardMaterial({
        color: PALETTE.floorWood,
        roughness: 0.38,
        metalness: 0.08
      });

      // Warm Rounded Floor Disc
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(185, 185, 4, 64), matFloor);
      floor.position.set(4, -2, -18);
      floor.receiveShadow = true;
      this.scene.add(floor);

      // Fine Inlaid Oak Parquet Lines
      const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.floorPlankDark, opacity: 0.40, transparent: true });
      for (let i = -140; i <= 140; i += 32) {
        const plank = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 260), lineMat);
        plank.rotation.x = -Math.PI * 0.5;
        plank.position.set(i + 4, 0.04, -18);
        this.scene.add(plank);
      }

      // Sculpted Soft Curved Background Wall
      const wallMat = new THREE.MeshStandardMaterial({
        color: PALETTE.wallPlaster,
        roughness: 0.88,
        metalness: 0.02,
        side: THREE.BackSide
      });
      const backWall = new THREE.Mesh(
        new THREE.CylinderGeometry(230, 230, 240, 48, 1, true, -Math.PI * 0.35, Math.PI * 0.95),
        wallMat
      );
      backWall.position.set(4, 118, -35);
      backWall.receiveShadow = true;
      this.scene.add(backWall);

      // Soft Asymmetrical Pebble Rug under hero area
      const rugShape = new THREE.Shape();
      rugShape.moveTo(-60, -38);
      rugShape.bezierCurveTo(-90, -18, -98, 38, -55, 62);
      rugShape.bezierCurveTo(-15, 82, 45, 78, 85, 48);
      rugShape.bezierCurveTo(115, 18, 105, -32, 55, -55);
      rugShape.bezierCurveTo(8, -68, -35, -52, -60, -38);

      const rugGeo = new THREE.ShapeGeometry(rugShape, 32);
      const rugMat = new THREE.MeshStandardMaterial({
        color: PALETTE.rugBase,
        roughness: 0.92,
        metalness: 0.02
      });
      const rug = new THREE.Mesh(rugGeo, rugMat);
      rug.rotation.x = -Math.PI * 0.5;
      rug.position.set(0, 0.12, -8);
      rug.receiveShadow = true;
      this.scene.add(rug);
    }

    // =========================================================================
    // 3. IMPORTED 3D GLB ASSETS (small_table.glb, sofa.glb, plant_with_pot.glb)
    // =========================================================================

    // 1. SMALL TABLE (small_table.glb) — Exact surface height calculated dynamically
    loadSmallTable() {
      this.tableGroup = new THREE.Group();
      this.tableGroup.position.set(-78, 0, 8);
      this.scene.add(this.tableGroup);

      const loader = new THREE.GLTFLoader();
      loader.load(
        '/public/models/small_table.glb',
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          // Table height: ~48 units (waist height relative to Dora's 96)
          const targetHeight = 48.0;
          const scale = targetHeight / (size.y || 0.273);
          model.scale.set(scale, scale, scale);
          model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.roughness = 0.46;
                child.material.metalness = 0.04;
                if (child.material.name && child.material.name.toLowerCase().includes('metall')) {
                  child.material.metalness = 0.82;
                  child.material.roughness = 0.32;
                }
                child.material.needsUpdate = true;
              }
            }
          });

          this.tableGroup.add(model);
          this.tableTopSurfaceY = targetHeight; // Top tabletop surface height in world

          // Soft Radial Contact Shadow under table base
          const tableFloorShadow = new THREE.Mesh(
            new THREE.PlaneGeometry(42, 42),
            new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.55, depthWrite: false })
          );
          tableFloorShadow.rotation.x = -Math.PI * 0.5;
          tableFloorShadow.position.set(0, 0.04, 0);
          this.tableGroup.add(tableFloorShadow);

          // Recalculate glasses placement with exact table dimensions
          this.updateGlassesPlacement();
        },
        undefined,
        (err) => console.error('Error loading small_table.glb:', err)
      );
    }

    // 2. SOFA (sofa.glb) — Sits on floor with warm terracotta/caramel upholstery
    loadSofa() {
      this.sofaGroup = new THREE.Group();
      this.sofaGroup.position.set(-48, 0, -38);
      this.sofaGroup.rotation.y = 0.40;
      this.scene.add(this.sofaGroup);

      const loader = new THREE.GLTFLoader();
      loader.load(
        '/public/models/sofa.glb',
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          // Sofa height: ~58 units (hip/backrest scale relative to Dora's 96)
          const targetHeight = 58.0;
          const scale = targetHeight / (size.y || 0.793);
          model.scale.set(scale, scale, scale);
          model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.filter(Boolean).forEach((material) => {
                // Keep each sofa part's original shader and surface response while
                // replacing its dark/washed source texture with a consistent fabric tone.
                material.map = null;
                material.color.setHex(PALETTE.armchairFabric);
                material.roughness = 0.84;
                material.metalness = 0;
                material.needsUpdate = true;
              });
            }
          });

          this.sofaGroup.add(model);

          // Soft Radial Contact Shadow under sofa
          const sofaShadow = new THREE.Mesh(
            new THREE.PlaneGeometry(size.x * scale * 1.15, size.z * scale * 1.15),
            new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.58, depthWrite: false })
          );
          sofaShadow.rotation.x = -Math.PI * 0.5;
          sofaShadow.position.set(0, 0.04, 0);
          this.sofaGroup.add(sofaShadow);
        },
        undefined,
        (err) => console.error('Error loading sofa.glb:', err)
      );
    }

    // 3. PLANT WITH POT (plant_with_pot.glb) — Sits on floor, rich foliage
    loadPlant() {
      this.plantGroup = new THREE.Group();
      // Place the plant beside the bookshelf, clear of the sofa and Dora.
      this.plantGroup.position.set(44, 0, -84);
      this.scene.add(this.plantGroup);

      const loader = new THREE.GLTFLoader();
      loader.load(
        '/public/models/plant_with_pot.glb',
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          // Keep the broad, leafy silhouette visible above the sofa back.
          const targetHeight = 52.0;
          const scale = targetHeight / (size.y || 4.46);
          model.scale.set(scale, scale, scale);
          model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.filter(Boolean).forEach((material) => {
                const isPot = child.name.toLowerCase().includes('pot') ||
                  (material.name && material.name.includes('Material.002'));
                material.color.setHex(isPot ? PALETTE.plantPot : PALETTE.plantGreen);
                if (material.emissive) material.emissive.setHex(0x000000);
                material.roughness = isPot ? 0.72 : 0.7;
                material.needsUpdate = true;
              });
            }
          });

          this.plantGroup.add(model);

          // Soft Radial Contact Shadow under pot
          const potShadow = new THREE.Mesh(
            new THREE.PlaneGeometry(28, 28),
            new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.55, depthWrite: false })
          );
          potShadow.rotation.x = -Math.PI * 0.5;
          potShadow.position.set(0, 0.04, 0);
          this.plantGroup.add(potShadow);
        },
        undefined,
        (err) => console.error('Error loading plant_with_pot.glb:', err)
      );
    }

    // 4. ARCHED MODERN BOOKSHELF (Shelf 2 top surface at y = 83.5)
    buildBookshelf() {
      this.shelfGroup = new THREE.Group();
      this.shelfGroup.position.set(104, 0, -85);

      const matShelfWood = new THREE.MeshStandardMaterial({ color: PALETTE.furnitureWood, roughness: 0.52 });
      const uprightGeo = new THREE.BoxGeometry(3.5, 145, 30);
      const uprightL = new THREE.Mesh(uprightGeo, matShelfWood);
      uprightL.position.set(-30, 72.5, 0);
      uprightL.castShadow = true;
      this.shelfGroup.add(uprightL);

      const uprightR = new THREE.Mesh(uprightGeo, matShelfWood);
      uprightR.position.set(30, 72.5, 0);
      uprightR.castShadow = true;
      this.shelfGroup.add(uprightR);

      const shelfCrown = new THREE.Mesh(new THREE.CylinderGeometry(31.5, 31.5, 30, 24, 1, false, 0, Math.PI), matShelfWood);
      shelfCrown.position.set(0, 145, 0);
      shelfCrown.rotation.z = Math.PI * 0.5;
      shelfCrown.rotation.y = Math.PI * 0.5;
      shelfCrown.castShadow = true;
      this.shelfGroup.add(shelfCrown);

      [40, 82, 122].forEach((yPos) => {
        const shelfSlab = new THREE.Mesh(new THREE.BoxGeometry(58, 3, 28), matShelfWood);
        shelfSlab.position.set(0, yPos, 0);
        shelfSlab.receiveShadow = true;
        this.shelfGroup.add(shelfSlab);
      });

      // Books on Shelf 2 (Leaving open landing space for glasses at x = 0, z = 0)
      const bookColors = [PALETTE.blanketTerracotta, PALETTE.phantomTeal, PALETTE.cushionMustard, PALETTE.charSweater, 0x8C567A];
      [
        { x: -22, h: 25, w: 5.5, d: 19, rotZ: 0, c: bookColors[0] },
        { x: -16, h: 21, w: 5.5, d: 20, rotZ: 0, c: bookColors[1] },
        { x: 16,  h: 24, w: 5.5, d: 19, rotZ: 0, c: bookColors[3] },
        { x: 22,  h: 20, w: 5.5, d: 17, rotZ: -0.12, c: bookColors[4] }
      ].forEach((b) => {
        const bMesh = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), new THREE.MeshStandardMaterial({ color: b.c, roughness: 0.65 }));
        bMesh.position.set(b.x, 82 + b.h / 2, 0);
        bMesh.rotation.z = b.rotZ;
        bMesh.castShadow = true;
        this.shelfGroup.add(bMesh);
      });

      const vase = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, 17, 20), new THREE.MeshStandardMaterial({ color: PALETTE.rugBase, roughness: 0.42 }));
      vase.position.set(-13, 132, 0);
      vase.castShadow = true;
      this.shelfGroup.add(vase);

      // Soft Radial Contact Shadow under bookshelf
      const shelfShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(74, 38),
        new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.58, depthWrite: false })
      );
      shelfShadow.rotation.x = -Math.PI * 0.5;
      shelfShadow.position.set(0, 0.04, 0);
      this.shelfGroup.add(shelfShadow);

      this.scene.add(this.shelfGroup);
    }

    // =========================================================================
    // 4. SMARTPHONE PROP (Held in hand, screen facing Dora, live OLED UI & glow)
    // =========================================================================
    buildSmartphone() {
      this.phone = new THREE.Group();

      // Slim modern titanium chassis
      const phoneChassis = new THREE.Mesh(
        new THREE.BoxGeometry(3.6, 7.4, 0.48),
        new THREE.MeshStandardMaterial({ color: 0x1A1918, roughness: 0.28, metalness: 0.82 })
      );
      phoneChassis.castShadow = true;
      this.phone.add(phoneChassis);

      // Dynamic 256x512 CanvasTexture for SMRITI Screen UI
      this.phoneCanvas = document.createElement('canvas');
      this.phoneCanvas.width = 256;
      this.phoneCanvas.height = 512;
      this.phoneCtx = this.phoneCanvas.getContext('2d');
      this.phoneTexture = new THREE.CanvasTexture(this.phoneCanvas);
      this.phoneTexture.encoding = THREE.sRGBEncoding;

      // Screen mesh facing -Z (Three.js lookAt points local -Z at target, so screen faces Dora's face directly!)
      const screenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(3.3, 7.0),
        new THREE.MeshBasicMaterial({ map: this.phoneTexture })
      );
      screenMesh.position.z = -0.25;
      screenMesh.rotation.y = Math.PI;
      this.phone.add(screenMesh);

      // Cyan screen light illuminating Dora's face from the screen surface
      this.phoneScreenLight = new THREE.PointLight(0x5CE1D2, 0.55, 35);
      this.phoneScreenLight.position.set(0, 0, -1.5);
      this.phone.add(this.phoneScreenLight);

      this.scene.add(this.phone);
      this.drawPhoneScreen('IDLE', 'Anchored');
    }

    drawPhoneScreen(state, subtext, progress = 0.84) {
      if (!this.phoneCtx) return;
      const ctx = this.phoneCtx;
      const w = 256, h = 512;

      // Dark luxury OLED background
      ctx.fillStyle = '#0D0F14';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#222730';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);

      // Status Bar
      ctx.fillStyle = '#868B96';
      ctx.font = '600 13px -apple-system, sans-serif';
      ctx.fillText('2:10 PM', 24, 28);
      ctx.fillText('99%', 204, 28);

      // SMRITI Header
      ctx.fillStyle = '#C95F3D';
      ctx.beginPath();
      ctx.arc(28, 62, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 19px Georgia, serif';
      ctx.fillText('DISHA', 40, 68);

      ctx.fillStyle = '#6E7380';
      ctx.font = '600 9px -apple-system, sans-serif';
      ctx.fillText('SPATIAL MEMORY', 24, 90);

      // Content Card
      ctx.fillStyle = '#171B22';
      ctx.beginPath();
      ctx.roundRect(16, 108, w - 32, 284, 12);
      ctx.fill();
      ctx.strokeStyle = '#282F3C';
      ctx.lineWidth = 1;
      ctx.stroke();

      if (state === 'IDLE' || state === 'NOTICE') {
        ctx.fillStyle = 'rgba(83, 97, 59, 0.35)';
        ctx.beginPath();
        ctx.roundRect(30, 126, 86, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#9ED86E';
        ctx.font = '700 10px sans-serif';
        ctx.fillText('ACTIVE', 48, 141);

        ctx.fillStyle = '#8E929B';
        ctx.font = '600 11px sans-serif';
        ctx.fillText('LAST SEEN OBJECT', 30, 180);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 20px Georgia, serif';
        ctx.fillText('Reading glasses', 30, 210);

        ctx.fillStyle = '#C95F3D';
        ctx.font = '600 13px sans-serif';
        ctx.fillText('Side table', 30, 238);

        ctx.fillStyle = '#8E929B';
        ctx.font = '12px sans-serif';
        ctx.fillText('Anchored · 2:10 PM', 30, 264);
      } else if (state === 'SEARCH') {
        ctx.fillStyle = 'rgba(201, 95, 61, 0.35)';
        ctx.beginPath();
        ctx.roundRect(30, 126, 115, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#C95F3D';
        ctx.font = '700 10px sans-serif';
        ctx.fillText('DISPLACED', 45, 141);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 19px Georgia, serif';
        ctx.fillText('Reading glasses', 30, 182);

        ctx.fillStyle = '#E8A58D';
        ctx.font = '600 13px sans-serif';
        ctx.fillText('Missing from table', 30, 212);

        ctx.fillStyle = '#8E929B';
        ctx.font = '12px sans-serif';
        ctx.fillText('Scanning room memory...', 30, 252);
      } else if (state === 'SCAN') {
        const isDetect = progress >= 0.96;
        ctx.fillStyle = isDetect ? 'rgba(92, 225, 210, 0.35)' : 'rgba(77, 157, 145, 0.35)';
        ctx.beginPath();
        ctx.roundRect(30, 126, isDetect ? 148 : 130, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#5CE1D2';
        ctx.font = '700 10px sans-serif';
        const pctStr = Math.min(100, Math.round(progress * 100));
        ctx.fillText(isDetect ? 'CHANGE DETECTED' : `SCANNING ${pctStr}%`, 40, 141);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 18px Georgia, serif';
        ctx.fillText(isDetect ? 'Object Relocated' : 'PHANTOM Recall', 30, 182);

        ctx.fillStyle = '#5CE1D2';
        ctx.font = '600 13px sans-serif';
        ctx.fillText(isDetect ? 'New anchor found' : 'Comparing 3D diffs...', 30, 212);

        ctx.fillStyle = '#262C36';
        ctx.fillRect(30, 248, w - 60, 6);
        ctx.fillStyle = '#5CE1D2';
        ctx.fillRect(30, 248, (w - 60) * Math.min(progress, 1.0), 6);
      } else if (state === 'FOUND' || state === 'RESOLVE') {
        ctx.fillStyle = 'rgba(83, 97, 59, 0.40)';
        ctx.beginPath();
        ctx.roundRect(30, 126, 100, 22, 6);
        ctx.fill();
        ctx.fillStyle = '#9ED86E';
        ctx.font = '700 10px sans-serif';
        ctx.fillText('FOUND', 48, 141);

        ctx.fillStyle = '#FFFFFF';
        ctx.font = '700 19px Georgia, serif';
        ctx.fillText('Bookshelf Shelf 2', 30, 182);

        ctx.fillStyle = '#C95F3D';
        ctx.font = '600 13px sans-serif';
        ctx.fillText('+240 cm displacement', 30, 212);

        ctx.fillStyle = '#5CE1D2';
        ctx.font = '12px sans-serif';
        ctx.fillText('Confidence 99.4%', 30, 250);
      }

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.roundRect((w - 70) / 2, h - 20, 70, 4, 2);
      ctx.fill();

      if (this.phoneTexture) {
        this.phoneTexture.needsUpdate = true;
      }
    }

    // =========================================================================
    // 5. GLB HERO CHARACTER (Dora with Cleaned Nose UVs & FK Arm Rigging)
    // =========================================================================
    loadDoraCharacter() {
      this.character = new THREE.Group();
      this.character.position.copy(CHAR_ORIGIN);
      this.character.rotation.copy(this.charRot);
      this.scene.add(this.character);

      const loader = new THREE.GLTFLoader();
      const glbPath = '/public/models/dora_dora_the_explorer.glb';

      loader.load(
        glbPath,
        (gltf) => {
          const model = gltf.scene;
          this.doraModel = model;

          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              if (child.material) {
                child.material.roughness = 0.52;
                child.material.metalness = 0.04;
                if (child.material.map) {
                  child.material.map.encoding = THREE.sRGBEncoding;
                }
                child.material.needsUpdate = true;
              }
            }
          });

          // 1. SETUP FORWARD KINEMATICS ARM RIGGING:
          const bodyMesh = model.getObjectByName('Object_2');
          if (bodyMesh && bodyMesh.geometry) {
            this.setupDoraBodyRig(bodyMesh);
          }

          // 2. SCALE & GROUND DORA:
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

          const targetHeight = 96; // 96 units tall
          const scale = targetHeight / (size.y || 3.81);
          model.scale.set(scale, scale, scale);
          model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

          // 3. ARTICULATED HEAD RIG (Pristine original geometry & materials):
          const node1 = model.getObjectByName('Dora_fix.obj.cleaner.materialmerger.gles') || model.children[0]?.children[0];
          const objHead = model.getObjectByName('Object_4');
          const objEyes = model.getObjectByName('Object_3');
          const objMouth = model.getObjectByName('Object_5');

          // 4. REPLACE THE BAKED DARK NOSE MARK WITH A SMALL, ROUNDED SKIN-TONE NOSE.
          // The dark mark is a textured head triangle at UV (0.95, 0.697), not a separate nose mesh.
          if (objHead?.geometry?.index && objHead.geometry.attributes.uv) {
            const headGeo = objHead.geometry;
            const pos = headGeo.attributes.position;
            const uv = headGeo.attributes.uv;
            const sourceIndices = headGeo.index.array;
            const headIndices = [];
            const noseIndices = [];
            const noseVertexIds = new Set();

            for (let i = 0; i < sourceIndices.length; i += 3) {
              const a = sourceIndices[i];
              const b = sourceIndices[i + 1];
              const c = sourceIndices[i + 2];
              const centerX = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3;
              const centerY = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3;
              const centerZ = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3;
              const centerU = (uv.getX(a) + uv.getX(b) + uv.getX(c)) / 3;
              const centerV = (uv.getY(a) + uv.getY(b) + uv.getY(c)) / 3;
              const isNose = Math.abs(centerX) < 0.16 && centerY > -0.78 && centerY < -0.62 &&
                centerZ > 2.58 && centerZ < 2.84 && centerU > 0.94 && centerV > 0.68 && centerV < 0.71;
              (isNose ? noseIndices : headIndices).push(a, b, c);
              if (isNose) [a, b, c].forEach((id) => noseVertexIds.add(id));
            }

            if (noseIndices.length) {
              headGeo.setIndex(new THREE.BufferAttribute(new Uint32Array(headIndices), 1));
              const noseCenter = new THREE.Vector3();
              noseVertexIds.forEach((id) => noseCenter.add(new THREE.Vector3(pos.getX(id), pos.getY(id), pos.getZ(id))));
              noseCenter.multiplyScalar(1 / noseVertexIds.size);
              noseCenter.z += 0.009;

              const noseMesh = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 24, 16),
                new THREE.MeshStandardMaterial({
                  color: 0xEFB052,
                  roughness: 0.82,
                  metalness: 0,
                  side: THREE.DoubleSide
                })
              );
              noseMesh.name = 'Dora_Nose';
              noseMesh.position.copy(noseCenter);
              noseMesh.scale.set(0.78, 0.62, 0.72);
              noseMesh.castShadow = false;
              noseMesh.receiveShadow = false;
              objHead.add(noseMesh);
            }
          }

          if (node1 && objHead && objEyes && objMouth) {
            const headPivot = new THREE.Group();
            headPivot.name = 'doraHeadPivot';
            headPivot.position.set(0, 0, 2.38);
            node1.add(headPivot);

            [objHead, objEyes, objMouth].forEach((part) => {
              node1.remove(part);
              part.position.set(0, 0, -2.38);
              headPivot.add(part);
            });

            this.characterHead = headPivot;
          }

          // Soft Radial Contact Shadow under Dora's feet
          const feetShadow = new THREE.Mesh(
            new THREE.PlaneGeometry(32, 24),
            new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.52, depthWrite: false })
          );
          feetShadow.rotation.x = -Math.PI * 0.5;
          feetShadow.position.set(0, 0.04, 0);
          this.character.add(feetShadow);

          this.character.add(model);
          this.doraLoaded = true;
        },
        undefined,
        (err) => console.error('Error loading Dora GLB:', err)
      );
    }

    setupDoraBodyRig(bodyMesh) {
      this.doraBodyMesh = bodyMesh;
      const geo = bodyMesh.geometry;
      const pos = geo.attributes.position;
      if (!pos) return;

      this.baseBodyPositions = new Float32Array(pos.array);
      this.updateDoraArms(this.currentArmPose);
    }

    updateDoraArms(config, walkPhase = 0, walkWeight = 0) {
      if (!this.doraBodyMesh || !this.baseBodyPositions) return;
      const geo = this.doraBodyMesh.geometry;
      const posAttr = geo.attributes.position;
      const base = this.baseBodyPositions;
      const count = posAttr.count;

      const pCfg = {
        lShoulderRoll: -1.40,
        lShoulderPitch: -0.15,
        lShoulderYaw: 0.05,
        lElbowBend: 0.28,
        lWristFlex: 0.18,
        rShoulderRoll: -1.02,
        rShoulderPitch: -0.38,
        rShoulderYaw: -0.15,
        rElbowBend: 0.92,
        rWristFlex: 0.32,
        ...config
      };

      const sRollL = pCfg.lShoulderRoll, sPitchL = pCfg.lShoulderPitch, sYawL = pCfg.lShoulderYaw, eBendL = pCfg.lElbowBend, wFlexL = pCfg.lWristFlex;
      const sRollR = pCfg.rShoulderRoll, sPitchR = pCfg.rShoulderPitch, sYawR = pCfg.rShoulderYaw, eBendR = pCfg.rElbowBend, wFlexR = pCfg.rWristFlex;

      const cosRollL = Math.cos(-sRollL), sinRollL = Math.sin(-sRollL);
      const cosPitchL = Math.cos(sPitchL), sinPitchL = Math.sin(sPitchL);
      const cosYawL = Math.cos(sYawL), sinYawL = Math.sin(sYawL);
      const cosEbL = Math.cos(eBendL), sinEbL = Math.sin(eBendL);
      const sinWfL = Math.sin(wFlexL);

      const cosRollR = Math.cos(-sRollR), sinRollR = Math.sin(-sRollR);
      const cosPitchR = Math.cos(sPitchR), sinPitchR = Math.sin(sPitchR);
      const cosYawR = Math.cos(sYawR), sinYawR = Math.sin(sYawR);
      const cosEbR = Math.cos(eBendR), sinEbR = Math.sin(eBendR);
      const sinWfR = Math.sin(wFlexR);

      const sxL = 0.48, syL = -0.02, szL = 2.08;
      const sxR = -0.48, syR = -0.02, szR = 2.08;

      let rHandX = -1.60, rHandY = 0, rHandZ = 2.08;
      let lHandX = 1.60, lHandY = 0, lHandZ = 2.08;

      for (let i = 0; i < count; i++) {
        const ox = base[i * 3];
        const oy = base[i * 3 + 1];
        const oz = base[i * 3 + 2];
        const absX = Math.abs(ox);

        // Body, hips, and legs remain in pristine base geometry
        if (absX <= 0.40) {
          posAttr.setXYZ(i, ox, oy, oz);
          continue;
        }

        const tArm = Math.min(Math.max((absX - 0.40) / 0.28, 0), 1);
        const wSh = tArm * tArm * (3 - 2 * tArm);
        const wEl = Math.min(Math.max((absX - 0.96) / 0.25, 0), 1);
        const wWr = Math.min(Math.max((absX - 1.36) / 0.18, 0), 1);

        if (ox > 0) {
          // Left Arm (Holding smartphone prop) — Mirrored FK Rigging
          const mox = -ox;
          const dx = mox - sxR;
          const dy = oy - syR;
          const dz = oz - szR;

          const rx = dx * cosRollL - dz * sinRollL;
          let rz = dx * sinRollL + dz * cosRollL;
          const ry = dy * cosPitchL - rz * sinPitchL;
          rz = dy * sinPitchL + rz * cosPitchL;
          const rx2 = rx * cosYawL - ry * sinYawL;
          const ry2 = rx * sinYawL + ry * cosYawL;

          let px = sxR + rx2;
          let py = syR + ry2;
          let pz = szR + rz;

          if (wEl > 0) {
            const distEl = absX - 0.96;
            py -= distEl * sinEbL * 0.95 * wEl;
            pz += distEl * (sinEbL * 0.95 + (1.0 - cosEbL) * 0.35) * wEl;
            px += distEl * sinEbL * 0.28 * wEl;
          }

          if (wWr > 0) {
            const distWr = absX - 1.36;
            py -= distWr * sinWfL * 0.45 * wWr;
            pz += distWr * sinWfL * 0.35 * wWr;
            px += distWr * 0.15 * wWr;
          }

          const finalPx = -px;
          const fx = ox * (1 - wSh) + finalPx * wSh;
          const fy = oy * (1 - wSh) + py * wSh;
          const fz = oz * (1 - wSh) + pz * wSh;
          posAttr.setXYZ(i, fx, fy, fz);

          if (ox > 1.50) {
            lHandX = fx;
            lHandY = fy;
            lHandZ = fz;
          }
        } else {
          // Right Arm (Reaching for & holding reading glasses)
          const dx = ox - sxR;
          const dy = oy - syR;
          const dz = oz - szR;

          const rx = dx * cosRollR - dz * sinRollR;
          let rz = dx * sinRollR + dz * cosRollR;
          const ry = dy * cosPitchR - rz * sinPitchR;
          rz = dy * sinPitchR + rz * cosPitchR;
          const rx2 = rx * cosYawR - ry * sinYawR;
          const ry2 = rx * sinYawR + ry * cosYawR;

          let px = sxR + rx2;
          let py = syR + ry2;
          let pz = szR + rz;

          if (wEl > 0) {
            const distEl = absX - 0.96;
            py -= distEl * sinEbR * 0.95 * wEl;
            pz += distEl * (sinEbR * 0.95 + (1.0 - cosEbR) * 0.35) * wEl;
            px += distEl * sinEbR * 0.28 * wEl;
          }

          if (wWr > 0) {
            const distWr = absX - 1.36;
            py -= distWr * sinWfR * 0.45 * wWr;
            pz += distWr * sinWfR * 0.35 * wWr;
            px += distWr * 0.15 * wWr;
          }

          const fx = ox * (1 - wSh) + px * wSh;
          const fy = oy * (1 - wSh) + py * wSh;
          const fz = oz * (1 - wSh) + pz * wSh;
          posAttr.setXYZ(i, fx, fy, fz);

          if (ox < -1.50) {
            rHandX = fx;
            rHandY = fy;
            rHandZ = fz;
          }
        }
      }

      posAttr.needsUpdate = true;
      geo.computeVertexNormals();

      // Transform hand coordinates to world space for phone/glasses attachment
      if (this.doraModel) {
        const scale = this.doraModel.scale.x;
        const charWorld = this.character.position;
        const charRotY = this.character.rotation.y;
        const cosY = Math.cos(charRotY);
        const sinY = Math.sin(charRotY);

        // Right Hand (Glasses pickup & hold)
        const rx = rHandX * scale + this.doraModel.position.x;
        const ry = rHandZ * scale + this.doraModel.position.y;
        const rz = -rHandY * scale + this.doraModel.position.z;
        const rwx = charWorld.x + rx * cosY + rz * sinY;
        const rwy = charWorld.y + ry;
        const rwz = charWorld.z - rx * sinY + rz * cosY;
        this.rightHandWorldPos.set(rwx, rwy, rwz);

        // Left Hand (Smartphone prop)
        const lx = lHandX * scale + this.doraModel.position.x;
        const ly = lHandZ * scale + this.doraModel.position.y;
        const lz = -lHandY * scale + this.doraModel.position.z;
        const lwx = charWorld.x + lx * cosY + lz * sinY;
        const lwy = charWorld.y + ly;
        const lwz = charWorld.z - lx * sinY + lz * cosY;
        this.leftHandWorldPos.set(lwx, lwy, lwz);
      }
    }

    // =========================================================================
    // 6. HERO PROPS & ZERO-CLIPPING PHYSICAL PLACEMENT ENGINE
    // =========================================================================
    buildHeroProps() {
      // 1. Reading Glasses (Realistic spectacles scale ~0.85)
      this.glasses = new THREE.Group();
      const matFrame = new THREE.MeshStandardMaterial({
        color: PALETTE.glassesFrame,
        roughness: 0.35,
        metalness: 0.20
      });
      const matBridge = new THREE.MeshStandardMaterial({
        color: PALETTE.glassesBridge,
        roughness: 0.25,
        metalness: 0.85
      });
      const matLens = new THREE.MeshPhysicalMaterial({
        color: 0xEEF8FC,
        roughness: 0.05,
        transmission: 0.88,
        transparent: true,
        opacity: 0.75,
        reflectivity: 0.8
      });

      const rimGeo = new THREE.TorusGeometry(3.6, 0.65, 16, 28);
      const rimL = new THREE.Mesh(rimGeo, matFrame);
      rimL.position.set(-4.8, 0, 0);
      this.glasses.add(rimL);

      const lensL = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.4, 24), matLens);
      lensL.position.set(-4.8, 0, 0);
      lensL.rotation.x = Math.PI * 0.5;
      this.glasses.add(lensL);

      const rimR = new THREE.Mesh(rimGeo, matFrame);
      rimR.position.set(4.8, 0, 0);
      this.glasses.add(rimR);

      const lensR = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.4, 24), matLens);
      lensR.position.set(4.8, 0, 0);
      lensR.rotation.x = Math.PI * 0.5;
      this.glasses.add(lensR);

      const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.2, 12), matBridge);
      bridge.rotation.z = Math.PI * 0.5;
      bridge.position.y = 0.5;
      this.glasses.add(bridge);

      const templeGeo = new THREE.CylinderGeometry(0.45, 0.45, 10.5, 12);
      const templeL = new THREE.Mesh(templeGeo, matFrame);
      templeL.position.set(-8.4, 0, -5.2);
      templeL.rotation.x = Math.PI * 0.5;
      this.glasses.add(templeL);

      const templeR = new THREE.Mesh(templeGeo, matFrame);
      templeR.position.set(8.4, 0, -5.2);
      templeR.rotation.x = Math.PI * 0.5;
      this.glasses.add(templeR);

      // Human-scale proportions: 0.85 scale fits realistically on table and in hand
      this.glasses.scale.set(0.85, 0.85, 0.85);
      this.scene.add(this.glasses);

      // 2. Physical Soft Contact Shadows (Zero Penetration, Zero Floating)
      const shadowMatTable = new THREE.MeshBasicMaterial({
        map: this.shadowTexture,
        transparent: true,
        opacity: 0.55,
        depthWrite: false
      });
      this.tableContactShadow = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), shadowMatTable);
      this.tableContactShadow.rotation.x = -Math.PI * 0.5;
      this.scene.add(this.tableContactShadow);

      const shadowMatShelf = new THREE.MeshBasicMaterial({
        map: this.shadowTexture,
        transparent: true,
        opacity: 0.0,
        depthWrite: false
      });
      this.shelfContactShadow = new THREE.Mesh(new THREE.PlaneGeometry(16, 12), shadowMatShelf);
      this.shelfContactShadow.rotation.x = -Math.PI * 0.5;
      this.scene.add(this.shelfContactShadow);

      // 3. PHANTOM GHOST GLASSES (Translucent Memory Imprint with Living Shimmer)
      this.ghostGlasses = new THREE.Group();
      const matGhost = new THREE.MeshPhysicalMaterial({
        color: 0x6EE7DF,
        roughness: 0.14,
        metalness: 0.08,
        transmission: 0.80,
        transparent: true,
        opacity: 0.32,
        emissive: 0x48CAB2,
        emissiveIntensity: 0.55,
        depthWrite: false
      });

      const gRimL = new THREE.Mesh(rimGeo, matGhost);
      gRimL.position.set(-4.8, 0, 0);
      this.ghostGlasses.add(gRimL);

      const gRimR = new THREE.Mesh(rimGeo, matGhost);
      gRimR.position.set(4.8, 0, 0);
      this.ghostGlasses.add(gRimR);

      const gBridge = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.2, 12), matGhost);
      gBridge.rotation.z = Math.PI * 0.5;
      gBridge.position.y = 0.5;
      this.ghostGlasses.add(gBridge);

      const gTempleL = new THREE.Mesh(templeGeo, matGhost);
      gTempleL.position.set(-8.4, 0, -5.2);
      gTempleL.rotation.x = Math.PI * 0.5;
      this.ghostGlasses.add(gTempleL);

      const gTempleR = new THREE.Mesh(templeGeo, matGhost);
      gTempleR.position.set(8.4, 0, -5.2);
      gTempleR.rotation.x = Math.PI * 0.5;
      this.ghostGlasses.add(gTempleR);

      this.ghostGlasses.scale.set(0.85, 0.85, 0.85);
      this.ghostGlasses.visible = false;
      this.scene.add(this.ghostGlasses);

      // 4. Spatial Highlight Rings & Crosshairs
      this.highlightGhost = this.createSpatialRing(PALETTE.phantomTeal);
      this.highlightGhost.visible = false;
      this.scene.add(this.highlightGhost);

      this.highlightMoved = this.createSpatialRing(PALETTE.movementAmber);
      this.highlightMoved.visible = false;
      this.scene.add(this.highlightMoved);

      // 5. Translucent Full-Room Sweeping Scan Plane (Apple-Grade Spatial Scan)
      const scanCanvas = document.createElement('canvas');
      scanCanvas.width = 256;
      scanCanvas.height = 256;
      const sctx = scanCanvas.getContext('2d');
      const grad = sctx.createLinearGradient(0, 0, 256, 0);
      grad.addColorStop(0.0, 'rgba(92, 225, 210, 0.0)');
      grad.addColorStop(0.70, 'rgba(92, 225, 210, 0.08)');
      grad.addColorStop(0.90, 'rgba(92, 225, 210, 0.32)');
      grad.addColorStop(0.97, 'rgba(168, 248, 240, 0.75)');
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.95)');
      sctx.fillStyle = grad;
      sctx.fillRect(0, 0, 256, 256);
      sctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      sctx.lineWidth = 1;
      for (let y = 0; y < 256; y += 16) {
        sctx.beginPath();
        sctx.moveTo(0, y);
        sctx.lineTo(256, y);
        sctx.stroke();
      }
      const scanTex = new THREE.CanvasTexture(scanCanvas);
      scanTex.wrapS = THREE.ClampToEdgeWrapping;
      scanTex.wrapT = THREE.ClampToEdgeWrapping;

      const scanMat = new THREE.MeshBasicMaterial({
        map: scanTex,
        transparent: true,
        opacity: 0.42,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending
      });
      this.spatialScanPlane = new THREE.Mesh(new THREE.PlaneGeometry(160, 140), scanMat);
      this.spatialScanPlane.rotation.y = Math.PI * 0.5;
      this.spatialScanPlane.position.set(0, 60, 0);
      this.spatialScanPlane.visible = false;
      this.scene.add(this.spatialScanPlane);

      // Dynamic Cyan Sweep Light (Moves across room with scan plane, illuminating objects)
      this.scanSweepLight = new THREE.PointLight(0x5CE1D2, 0.0, 120);
      this.scanSweepLight.position.set(0, 60, 0);
      this.scene.add(this.scanSweepLight);

      // 6. Floating Spatial Markers on Side Table
      this.tableSpatialPoints = new THREE.Group();
      const ptGeo = new THREE.SphereGeometry(0.42, 8, 8);
      const ptMat = new THREE.MeshBasicMaterial({ color: 0x5CE1D2, transparent: true, opacity: 0.85 });
      for (let i = 0; i < 24; i++) {
        const pt = new THREE.Mesh(ptGeo, ptMat);
        const angle = (i / 24) * Math.PI * 2;
        const r = 3.5 + Math.random() * 8.5;
        pt.position.set(
          -78 + Math.cos(angle) * r,
          50.5 + Math.random() * 4.0,
          8 + Math.sin(angle) * r
        );
        pt.userData = {
          baseY: pt.position.y,
          speed: 1.5 + Math.random() * 2.0,
          phase: Math.random() * Math.PI * 2
        };
        this.tableSpatialPoints.add(pt);
      }
      this.tableSpatialPoints.visible = false;
      this.scene.add(this.tableSpatialPoints);

      // 7. Spatial Memory Trajectory Trail (Subtle, elegant thin trail)
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-78, 51.5, 8),
        new THREE.Vector3(-45, 96.0, -15),
        new THREE.Vector3(15, 112.0, -45),
        new THREE.Vector3(75, 98.0, -72),
        new THREE.Vector3(104, 85.2, -85)
      ]);
      const tubeGeo = new THREE.TubeGeometry(curve, 64, 0.10, 8, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x5CE1D2,
        transparent: true,
        opacity: 0.30,
        blending: THREE.AdditiveBlending
      });
      this.spatialTrail = new THREE.Mesh(tubeGeo, tubeMat);
      this.spatialTrail.visible = false;
      this.scene.add(this.spatialTrail);

      this.updateGlassesPlacement();
    }

    createSpatialRing(color) {
      const g = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(8, 9.2, 32),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.72 })
      );
      ring.rotation.x = -Math.PI * 0.5;
      g.add(ring);

      const crossGeo = new THREE.PlaneGeometry(1.2, 19);
      const crossMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 });
      const barH = new THREE.Mesh(crossGeo, crossMat);
      barH.rotation.x = -Math.PI * 0.5;
      g.add(barH);
      const barV = new THREE.Mesh(crossGeo, crossMat);
      barV.rotation.x = -Math.PI * 0.5;
      barV.rotation.z = Math.PI * 0.5;
      g.add(barV);

      return g;
    }

    // Helper: Exact surface height calculation (Zero-penetration logic)
    calculateContactY(object, surfaceY, offset = 0.05) {
      object.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(object);
      const bottomRel = box.min.y - object.position.y;
      return surfaceY - bottomRel + offset;
    }

    updateGlassesPlacement() {
      if (!this.glasses) return;

      const tableSurfaceY = this.tableTopSurfaceY || 48.0;
      const shelf2SurfaceY = 83.5;

      // Calculate contact with natural resting orientation
      this.glasses.rotation.copy(this.glassesTableRot);
      const tableContactY = this.calculateContactY(this.glasses, tableSurfaceY);

      this.glasses.rotation.copy(this.glassesShelfRot);
      const shelfContactY = this.calculateContactY(this.glasses, shelf2SurfaceY);

      this.glassesTablePos.set(-78, tableContactY, 8);
      this.glassesShelfPos.set(104, shelfContactY, -85);

      if (this.tableContactShadow) {
        this.tableContactShadow.position.set(this.glassesTablePos.x, tableSurfaceY + 0.08, this.glassesTablePos.z);
      }
      if (this.shelfContactShadow) {
        this.shelfContactShadow.position.set(this.glassesShelfPos.x, shelf2SurfaceY + 0.08, this.glassesShelfPos.z);
      }

      if (this.ghostGlasses) {
        this.ghostGlasses.position.copy(this.glassesTablePos);
        this.ghostGlasses.rotation.copy(this.glassesTableRot);
        this.ghostGlasses.scale.copy(this.glasses.scale);
      }

      if (this.highlightGhost) {
        this.highlightGhost.position.set(this.glassesTablePos.x, tableSurfaceY + 0.15, this.glassesTablePos.z);
      }
      if (this.highlightMoved) {
        this.highlightMoved.position.set(this.glassesShelfPos.x, shelf2SurfaceY + 0.15, this.glassesShelfPos.z);
      }

      // Rebuild curved spatial trajectory
      if (this.spatialTrail) {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(this.glassesTablePos.x, this.glassesTablePos.y + 1, this.glassesTablePos.z),
          new THREE.Vector3((this.glassesTablePos.x + this.glassesShelfPos.x) * 0.45, 115, (this.glassesTablePos.z + this.glassesShelfPos.z) * 0.5),
          new THREE.Vector3(this.glassesShelfPos.x, this.glassesShelfPos.y + 1, this.glassesShelfPos.z)
        ]);
        if (this.spatialTrail.geometry) this.spatialTrail.geometry.dispose();
        this.spatialTrail.geometry = new THREE.TubeGeometry(curve, 64, 0.10, 8, false);
      }

      if (!this.isStoryActive || this.glassesState === 'GLASSES_TABLE') {
        this.glasses.position.copy(this.glassesTablePos);
        this.glasses.rotation.copy(this.glassesTableRot);
      }
    }

    // =========================================================================
    // 7. STORY ENGINE & INTERACTIONS
    // =========================================================================
    setupUIListeners() {
      if (this.ui.cta) {
        this.ui.cta.addEventListener('click', () => {
          if (this.ui.cta.classList.contains('replay') || this.ui.cta.classList.contains('complete') || this.currentStoryPhase === 'RESOLVE' || this.currentStoryPhase === 'RELIEF') {
            this.resetStory();
            this.startStory();
          } else if (!this.isStoryActive) {
            this.startStory();
          }
        });
      }
      if (this.ui.replay) {
        this.ui.replay.addEventListener('click', () => {
          this.resetStory();
          this.startStory();
        });
      }
      window.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') {
          this.resetStory();
          this.startStory();
        }
      });
    }

    startStory() {
      if (this.isStoryActive) return;
      this.isStoryActive = true;
      this.storyStartTime = performance.now();
      this.glassesState = 'GLASSES_TABLE';
      this.glassesPickedUp = false;
      this.startLoop();

      const heroEl = this.container ? this.container.closest('.hero') : document.getElementById('home');
      if (heroEl) heroEl.classList.add('story-active');
      document.body.classList.add('story-active');

      if (this.ui.cta) {
        this.ui.cta.classList.remove('complete', 'replay');
        this.ui.cta.classList.add('playing');
        if (this.ui.ctaLabel) {
          this.ui.ctaLabel.textContent = 'Playing…';
        } else {
          this.ui.cta.innerHTML = 'Playing… <span class="action-arrow">→</span>';
        }
      }
      if (this.ui.progress) this.ui.progress.classList.add('visible');
      if (this.ui.replay) {
        this.ui.replay.classList.remove('visible');
        this.ui.replay.hidden = true;
      }
    }

    resetStory() {
      this.isStoryActive = false;
      this.glassesState = 'GLASSES_TABLE';
      this.glassesPickedUp = false;
      this.currentStoryPhase = 'IDLE';

      const heroEl = this.container ? this.container.closest('.hero') : document.getElementById('home');
      if (heroEl) heroEl.classList.remove('story-active');
      document.body.classList.remove('story-active');

      this.ghostGlasses.visible = false;
      this.highlightGhost.visible = false;
      this.highlightMoved.visible = false;
      this.spatialTrail.visible = false;
      this.spatialScanPlane.visible = false;
      if (this.tableSpatialPoints) this.tableSpatialPoints.visible = false;
      if (this.scanSweepLight) this.scanSweepLight.intensity = 0;

      this.glasses.position.copy(this.glassesTablePos);
      this.glasses.rotation.copy(this.glassesTableRot);
      if (this.tableContactShadow) this.tableContactShadow.material.opacity = 0.55;
      if (this.shelfContactShadow) this.shelfContactShadow.material.opacity = 0.0;

      this.charPos.copy(CHAR_ORIGIN);
      this.charRot.set(0, 0.22, 0);
      this.headRot.set(0, 0, 0);

      if (this.camera) {
        this.updateStoryCameraFraming('IDLE', 0);
      }

      if (this.roomLights.phantom) this.roomLights.phantom.intensity = 0;
      if (this.phoneScreenLight) this.phoneScreenLight.intensity = 0.2;

      this.drawPhoneScreen('IDLE', 'Anchored');

      if (this.ui.cta) {
        this.ui.cta.classList.remove('playing', 'complete', 'replay');
        if (this.ui.ctaLabel) {
          this.ui.ctaLabel.textContent = 'See how it works';
        } else {
          this.ui.cta.innerHTML = 'See how it works <span class="action-arrow">→</span>';
        }
      }
      if (this.ui.narration) this.ui.narration.classList.remove('visible');
      if (this.ui.narrTitle) this.ui.narrTitle.textContent = '';
      if (this.ui.narrDetail) this.ui.narrDetail.textContent = '';
      if (this.ui.note) this.ui.note.classList.remove('visible');
      if (this.ui.progress) this.ui.progress.classList.remove('visible');
      if (this.ui.replay) {
        this.ui.replay.classList.remove('visible');
        this.ui.replay.hidden = true;
      }
      this.updateDoraArms(this.currentArmPose);
      if (this.characterHead) this.characterHead.rotation.set(0, 0, 0);
    }

    easeInOutCubic(x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }

    startLoop() {
      if (this.animId) return;
      this.animId = requestAnimationFrame(this.animate);
    }

    stopLoop() {
      if (this.animId) {
        cancelAnimationFrame(this.animId);
        this.animId = null;
      }
    }

    animate(timestamp) {
      if (!this.isIntersecting) {
        this.animId = null;
        return;
      }
      this.animId = requestAnimationFrame(this.animate);
      const now = timestamp || performance.now();

      // Telemetry in document title for reliable headless QA inspection
      if (this.isStoryActive) {
        const el = (now - this.storyStartTime) / 1000;
        document.title = `[DISHA] t=${el.toFixed(1)}s | ${this.currentStoryPhase} | Dora=(${this.charPos.x.toFixed(0)},${this.charPos.y.toFixed(0)},${this.charPos.z.toFixed(0)}) | G=${this.glassesState}`;
      } else {
        document.title = `[DISHA] IDLE | G=${this.glassesState}`;
      }

      if (!this.prefersReducedMotion) {
        this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.045;
        this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.045;
      } else {
        this.mouse.x = 0;
        this.mouse.y = 0;
      }

      // ================= IDLE STATE =================
      if (!this.isStoryActive) {
        this.currentStoryPhase = 'IDLE';
        this.glassesState = 'GLASSES_TABLE';

        const breath = Math.sin(now * 0.0022) * 0.42;
        this.charPos.set(CHAR_ORIGIN.x, breath, CHAR_ORIGIN.z);
        this.charRot.y = 0.22;
        this.headRot.set(0, 0, 0);

        // Relaxed natural arm posture
        this.updateDoraArms({
          lShoulderRoll: -1.35,
          lShoulderPitch: -0.15,
          lElbowBend: 0.30,
          rShoulderRoll: -1.35,
          rShoulderPitch: -0.15,
          rElbowBend: 0.28
        });

        // Casually carry phone at hip
        if (this.phone) {
          this.phone.position.set(this.leftHandWorldPos.x + 0.2, this.leftHandWorldPos.y + 0.7, this.leftHandWorldPos.z + 0.5);
          this.phone.rotation.set(-0.25, -0.15, 0.1);
          if (this.phoneScreenLight) this.phoneScreenLight.intensity = 0.2;
        }

        this.updateStoryCameraFraming('IDLE', 0);
      }

      // ================= CINEMATIC STORY ARC =================
      else {
        const elapsed = (now - this.storyStartTime) / 1000;
        const totalStoryDuration = 29.0;
        const progressPct = Math.min((elapsed / totalStoryDuration) * 100, 100);
        if (this.ui.progressFill) this.ui.progressFill.style.width = `${progressPct}%`;

        // Living shimmer for Ghost Glasses when visible
        if (this.ghostGlasses && this.ghostGlasses.visible) {
          const ghostMat = this.ghostGlasses.children[0]?.material;
          if (ghostMat) {
            ghostMat.emissiveIntensity = 0.32 + Math.sin(now * 0.005) * 0.15;
          }
        }

        // Animate floating spatial points around table
        if (this.tableSpatialPoints && this.tableSpatialPoints.visible) {
          for (let i = 0; i < this.tableSpatialPoints.children.length; i++) {
            const pt = this.tableSpatialPoints.children[i];
            const u = pt.userData;
            pt.position.y = u.baseY + Math.sin(now * 0.003 * u.speed + u.phase) * 1.2;
          }
        }

        // -------------------------------------------------------------
        // STEP 1 — NOTICE GLASSES (0.0s to 2.8s)
        // Camera moves closer; Dora glances at glasses on side table
        // -------------------------------------------------------------
        if (elapsed < 2.8) {
          this.currentStoryPhase = 'NOTICE';
          this.glassesState = 'GLASSES_TABLE';
          const p = this.easeInOutCubic(Math.min(elapsed / 1.8, 1));

          this.updateStoryCameraFraming('NOTICE', elapsed);

          this.charRot.y = 0.22 - 0.12 * p;
          this.charPos.set(CHAR_ORIGIN.x, 0, CHAR_ORIGIN.z);
          // Glances gently right toward side table
          this.headRot.set(-0.06 * p, -0.28 * p, 0);

          this.updateDoraArms({
            lShoulderRoll: -1.35,
            lShoulderPitch: -0.15,
            lElbowBend: 0.32,
            rShoulderRoll: -1.35,
            rShoulderPitch: -0.15,
            rElbowBend: 0.28
          });

          if (this.phone) {
            this.phone.position.set(this.leftHandWorldPos.x + 0.2, this.leftHandWorldPos.y + 0.7, this.leftHandWorldPos.z + 0.5);
            this.phone.rotation.set(-0.25, -0.15, 0.1);
          }

          if (this.ui.narration && p > 0.3) {
            this.ui.narration.classList.add('visible');
            this.ui.narrTitle.textContent = 'Reading glasses anchored.';
            this.ui.narrDetail.textContent = 'Side table · 2:10 PM';
          }
        }

        // -------------------------------------------------------------
        // STEP 2 — LOOKS AWAY & GLASSES PHYSICAL FLIGHT (2.8s to 6.0s)
        // Dora looks away towards sofa; glasses physically travel to Bookshelf Shelf 2
        // -------------------------------------------------------------
        else if (elapsed < 6.0) {
          this.currentStoryPhase = 'GLASSES_MOVE';
          const pLookAway = this.easeInOutCubic(Math.min((elapsed - 2.8) / 1.2, 1));
          this.charRot.y = 0.10 + 0.15 * pLookAway;
          this.charPos.set(CHAR_ORIGIN.x, 0, CHAR_ORIGIN.z);
          // Head looks ahead / away
          this.headRot.set(0, 0.10 * pLookAway, 0);

          this.updateStoryCameraFraming('GLASSES_MOVE', elapsed);

          const flight = (elapsed - 3.1) / 2.2;
          if (flight >= 0 && flight <= 1.0) {
            this.glassesState = 'GLASSES_MOVING';
            const p = this.easeInOutCubic(flight);
            const arcY = Math.sin(p * Math.PI) * 36;

            this.glasses.position.set(
              this.glassesTablePos.x + (this.glassesShelfPos.x - this.glassesTablePos.x) * p,
              this.glassesTablePos.y + (this.glassesShelfPos.y - this.glassesTablePos.y) * p + arcY,
              this.glassesTablePos.z + (this.glassesShelfPos.z - this.glassesTablePos.z) * p
            );
            this.glasses.rotation.set(
              this.glassesTableRot.x + (this.glassesShelfRot.x - this.glassesTableRot.x) * p + 0.15 * Math.sin(p * Math.PI),
              this.glassesTableRot.y + p * Math.PI * 0.85,
              this.glassesTableRot.z + 0.1 * Math.sin(p * Math.PI)
            );

            // Crossfade contact shadows
            this.tableContactShadow.material.opacity = Math.max(0, 0.55 * (1 - p * 2));
            this.shelfContactShadow.material.opacity = Math.max(0, 0.55 * ((p - 0.5) * 2));
          } else if (flight > 1.0) {
            this.glassesState = 'GLASSES_SHELF';
            const settleT = (flight - 1.0) / 0.25;
            const bounce = Math.sin(settleT * Math.PI * 3) * Math.exp(-settleT * 4) * 0.8;
            this.glasses.position.set(this.glassesShelfPos.x, this.glassesShelfPos.y + Math.max(0, bounce), this.glassesShelfPos.z);
            this.glasses.rotation.copy(this.glassesShelfRot);
            this.tableContactShadow.material.opacity = 0;
            this.shelfContactShadow.material.opacity = 0.55;
          }

          this.updateDoraArms({
            lShoulderRoll: -1.35,
            lShoulderPitch: -0.15,
            lElbowBend: 0.32,
            rShoulderRoll: -1.35,
            rShoulderPitch: -0.15,
            rElbowBend: 0.28
          });

          if (this.phone) {
            this.phone.position.set(this.leftHandWorldPos.x + 0.2, this.leftHandWorldPos.y + 0.7, this.leftHandWorldPos.z + 0.5);
            this.phone.rotation.set(-0.25, -0.15, 0.1);
          }
        }

        // -------------------------------------------------------------
        // STEP 3 — RETURN & PUZZLED SEARCH (6.0s to 9.5s)
        // Dora turns back to side table, finds glasses gone, puzzled search
        // -------------------------------------------------------------
        else if (elapsed < 9.5) {
          this.currentStoryPhase = 'SEARCH';
          this.glassesState = 'GLASSES_SHELF';
          this.charPos.set(CHAR_ORIGIN.x, 0, CHAR_ORIGIN.z);

          this.updateStoryCameraFraming('SEARCH', elapsed);

          if (elapsed < 7.5) {
            const p = this.easeInOutCubic((elapsed - 6.0) / 1.5);
            this.charRot.y = 0.25 - 0.30 * p;
            this.headRot.set(-0.10 * p, -0.32 * p, 0);

            this.updateDoraArms({
              lShoulderRoll: -1.25,
              lShoulderPitch: -0.22,
              lElbowBend: 0.45,
              rShoulderRoll: -1.15,
              rShoulderPitch: -0.25,
              rElbowBend: 0.35
            });
          } else {
            const scanW = Math.sin((elapsed - 7.5) * 2.8);
            this.headRot.set(-0.08, -0.22 + scanW * 0.15, 0);

            this.updateDoraArms({
              lShoulderRoll: -1.15,
              lShoulderPitch: -0.32,
              lElbowBend: 0.65,
              rShoulderRoll: -1.15,
              rShoulderPitch: -0.25,
              rElbowBend: 0.35
            });
          }

          if (this.phone) {
            this.phone.position.set(this.leftHandWorldPos.x + 0.2, this.leftHandWorldPos.y + 0.8, this.leftHandWorldPos.z + 0.5);
            this.phone.rotation.set(-0.35, -0.2, 0.15);
          }

          this.drawPhoneScreen('SEARCH', 'Missing');

          if (this.ui.narration) {
            this.ui.narrTitle.textContent = 'Object displaced.';
            this.ui.narrDetail.textContent = 'Side table is empty. Consulting DISHA...';
          }
        }

        // -------------------------------------------------------------
        // STEP 4 — PHONE CHECK (9.5s to 13.0s)
        // Dedicated PHONE_CHECK state:
        // Torso turns slightly toward phone hand.
        // Left arm bends at elbow, raises phone vertically in front of chest.
        // Screen faces Dora at 3/4 angle.
        // Head tilts downward slightly looking directly at screen.
        // Screen light softly illuminates lower face and shirt.
        // -------------------------------------------------------------
        else if (elapsed < 13.0) {
          this.currentStoryPhase = 'PHONE_CHECK';
          this.glassesState = 'GLASSES_SHELF';
          this.charPos.set(CHAR_ORIGIN.x, 0, CHAR_ORIGIN.z);
          const p = this.easeInOutCubic(Math.min((elapsed - 9.5) / 1.4, 1.0));

          this.updateStoryCameraFraming('PHONE_CHECK', elapsed);

          this.charRot.y = -0.05 * (1 - p) + 0.10 * p;

          // Head tilts down and glances at phone in left hand
          this.headRot.set(-0.24 * p, 0.26 * p, 0);

          this.updateDoraArms({
            lShoulderRoll: -1.22 * p + -1.35 * (1 - p),
            lShoulderPitch: -0.55 * p + -0.18 * (1 - p),
            lShoulderYaw: 0.35 * p,
            lElbowBend: 1.70 * p + 0.38 * (1 - p),
            lWristFlex: 0.32 * p,
            rShoulderRoll: -1.35,
            rShoulderPitch: -0.15,
            rElbowBend: 0.28
          });

          if (this.phone) {
            this.phone.position.set(
              this.leftHandWorldPos.x - 0.25,
              this.leftHandWorldPos.y + 1.2,
              this.leftHandWorldPos.z + 0.8
            );
            const headTarget = new THREE.Vector3(this.charPos.x, this.charPos.y + 68, this.charPos.z);
            this.phone.lookAt(headTarget);
            this.phone.rotateY(0.32);
          }

          if (this.phoneScreenLight) {
            this.phoneScreenLight.intensity = 0.85 * p;
            this.phoneScreenLight.color.setHex(0x5CE1D2);
          }

          const scanProgress = p * 0.84;
          this.drawPhoneScreen('SCAN', `${Math.round(scanProgress * 100)}%`, scanProgress);

          if (this.ui.narration) {
            this.ui.narrTitle.textContent = 'DISHA scanning room memory...';
            this.ui.narrDetail.textContent = 'Comparing spatial points with past reality';
          }
        }

        // -------------------------------------------------------------
        // STEP 5 — PHANTOM SPATIAL SCAN (13.0s to 16.5s)
        // Visual Climax:
        // Translucent wide scan plane sweeps across entire room.
        // Dynamic sweep light illuminates objects as plane passes.
        // Floating spatial point markers appear around table.
        // -------------------------------------------------------------
        else if (elapsed < 16.5) {
          this.currentStoryPhase = 'PHANTOM_SCAN';
          this.glassesState = 'GLASSES_SHELF';
          this.charPos.set(CHAR_ORIGIN.x, 0, CHAR_ORIGIN.z);
          const scanP = (elapsed - 13.0) / 3.5;

          this.updateStoryCameraFraming('PHANTOM_SCAN', elapsed);

          if (this.roomLights.phantom) this.roomLights.phantom.intensity = 1.35;

          this.spatialScanPlane.visible = true;
          this.spatialScanPlane.position.x = -115 + scanP * 230;

          if (this.scanSweepLight) {
            this.scanSweepLight.visible = true;
            this.scanSweepLight.position.x = this.spatialScanPlane.position.x;
            this.scanSweepLight.intensity = 2.8 * Math.sin(scanP * Math.PI);
          }

          if (this.tableSpatialPoints) {
            this.tableSpatialPoints.visible = true;
          }

          const scanProgress = 0.84 + scanP * 0.16;
          this.drawPhoneScreen('SCAN', '100%', scanProgress);

          if (this.phone) {
            this.phone.position.set(
              this.leftHandWorldPos.x - 0.25,
              this.leftHandWorldPos.y + 1.2,
              this.leftHandWorldPos.z + 0.8
            );
            const headTarget = new THREE.Vector3(this.charPos.x, this.charPos.y + 68, this.charPos.z);
            this.phone.lookAt(headTarget);
            this.phone.rotateY(0.32);
          }

          if (elapsed < 14.8) {
            this.headRot.set(-0.24, 0.26, 0);
          } else {
            const blend = this.easeInOutCubic((elapsed - 14.8) / 1.7);
            this.headRot.set(-0.24 * (1 - blend) + -0.10 * blend, 0.26 * (1 - blend) - 0.25 * blend, 0);
          }

          this.updateDoraArms({
            lShoulderRoll: -1.22,
            lShoulderPitch: -0.55,
            lElbowBend: 1.65,
            rShoulderRoll: -1.35,
            rShoulderPitch: -0.15,
            rElbowBend: 0.28
          });

          if (this.ui.narration) {
            this.ui.narrTitle.textContent = 'PHANTOM scan sweep...';
            this.ui.narrDetail.textContent = 'Room geometry registered · Detecting past anchor';
          }
        }

        // -------------------------------------------------------------
        // STEP 6 — MEMORY REVEAL & SIMULTANEOUS OLD + NEW (16.5s to 20.0s)
        // Visual Climax:
        // OLD: Ghost glasses reconstruct on SIDE TABLE at exact origin.
        // NEW: Physical glasses visible on BOOKSHELF SHELF 2 simultaneously.
        // Delicate spatial-memory trail connects them.
        // -------------------------------------------------------------
        else if (elapsed < 20.0) {
          this.currentStoryPhase = 'MEMORY_REVEAL';
          this.glassesState = 'GLASSES_SHELF';
          this.charPos.set(CHAR_ORIGIN.x, 0, CHAR_ORIGIN.z);

          this.updateStoryCameraFraming('MEMORY_REVEAL', elapsed);

          if (this.spatialScanPlane) this.spatialScanPlane.visible = false;
          if (this.scanSweepLight) this.scanSweepLight.intensity = Math.max(0, 2.0 - (elapsed - 16.5) * 1.5);

          // Both locations visible simultaneously
          this.ghostGlasses.position.copy(this.glassesTablePos);
          this.ghostGlasses.rotation.copy(this.glassesTableRot);
          this.ghostGlasses.visible = true;
          this.highlightGhost.visible = true;

          this.glasses.position.copy(this.glassesShelfPos);
          this.glasses.rotation.copy(this.glassesShelfRot);
          this.glasses.visible = true;
          this.highlightMoved.visible = true;

          this.spatialTrail.visible = true;

          const pulse = 1 + Math.sin(now * 0.007) * 0.08;
          this.highlightGhost.scale.set(pulse, pulse, pulse);
          this.highlightMoved.scale.set(pulse, pulse, pulse);

          if (elapsed < 18.2) {
            this.headRot.set(-0.10, -0.30, 0); // look at ghost on table
          } else {
            const p = (elapsed - 18.2) / 1.8;
            this.headRot.set(-0.06, -0.30 * (1 - p) + 0.30 * p, 0); // sweep gaze across to shelf
          }

          // Lower phone comfortably to waist
          const lowerP = Math.min((elapsed - 16.5) / 1.5, 1.0);
          this.updateDoraArms({
            lShoulderRoll: -1.22 * (1 - lowerP) + -1.25 * lowerP,
            lShoulderPitch: -0.55 * (1 - lowerP) + -0.25 * lowerP,
            lElbowBend: 1.65 * (1 - lowerP) + 0.50 * lowerP,
            rShoulderRoll: -1.35,
            rShoulderPitch: -0.15,
            rElbowBend: 0.28
          });

          if (this.phone) {
            this.phone.position.set(this.leftHandWorldPos.x + 0.15, this.leftHandWorldPos.y + 0.7, this.leftHandWorldPos.z + 0.5);
            this.phone.rotation.set(-0.25, 0.20, 0);
          }

          this.drawPhoneScreen('FOUND', 'Bookshelf');

          if (this.ui.narration) {
            this.ui.narrTitle.textContent = 'Memory revealed.';
            this.ui.narrDetail.textContent = 'Glasses moved: Side table → Bookshelf Shelf 2';
          }
        }

        // -------------------------------------------------------------
        // STEP 7 — NOTICE SHELF & TURN BODY (20.0s to 21.2s)
        // Dora turns entire body toward the walk heading (2.45 rad).
        // Head aligns neutrally with body (0, 0, 0).
        // -------------------------------------------------------------
        else if (elapsed < 21.2) {
          this.currentStoryPhase = 'NOTICE_SHELF';
          this.glassesState = 'GLASSES_SHELF';
          this.charPos.set(CHAR_ORIGIN.x, 0, CHAR_ORIGIN.z);

          this.updateStoryCameraFraming('NOTICE_SHELF', elapsed);

          const turnP = this.easeInOutCubic((elapsed - 20.0) / 1.2);
          this.charRot.y = 0.22 + (2.45 - 0.22) * turnP;

          // Head aligns neutrally with body direction!
          this.headRot.set(0, 0, 0);

          this.updateDoraArms({
            lShoulderRoll: -1.25,
            lShoulderPitch: -0.25,
            lElbowBend: 0.50,
            rShoulderRoll: -1.35,
            rShoulderPitch: -0.15,
            rElbowBend: 0.28
          });

          if (this.phone) {
            this.phone.position.set(this.leftHandWorldPos.x + 0.15, this.leftHandWorldPos.y + 0.7, this.leftHandWorldPos.z + 0.5);
            this.phone.rotation.set(-0.25, 0.20, 0);
          }
        }

        // -------------------------------------------------------------
        // STEP 8 — NATURAL CASUAL WALK TO BOOKSHELF (21.2s to 25.0s)
        // BODY, HEAD, AND EYES ALL FACE BOOKSHELF.
        // Physical root translation from CHAR_ORIGIN to SHELF_INTERACTION_POINT.
        // Facing direction locked at 2.45 rad.
        // Head is locked neutral (0, 0, 0) aligned with body direction.
        // Subtle stride bob and natural arm swing.
        // Spatial trail is hidden during walk so it doesn't cross her face.
        // -------------------------------------------------------------
        else if (elapsed < 25.0) {
          this.currentStoryPhase = 'WALK_TO_SHELF';
          this.glassesState = 'GLASSES_SHELF';
          this.spatialTrail.visible = false;

          const walkDuration = 3.8;
          const p = this.easeInOutCubic(Math.min((elapsed - 21.2) / walkDuration, 1.0));

          this.updateStoryCameraFraming('WALK_TO_SHELF', elapsed);

          // Dora faces walk direction
          this.charRot.y = 2.45;

          // HEAD IS NEUTRAL AND 100% ALIGNED WITH BODY DIRECTION!
          this.headRot.set(0, 0, 0);

          // Physical root translation to destination
          this.charPos.x = CHAR_ORIGIN.x + (this.SHELF_INTERACTION_POINT.x - CHAR_ORIGIN.x) * p;
          this.charPos.z = CHAR_ORIGIN.z + (this.SHELF_INTERACTION_POINT.z - CHAR_ORIGIN.z) * p;

          // Natural casual stride bounce
          const walkStep = Math.sin((elapsed - 21.2) * 7.0);
          const walkWeight = p < 0.90 ? 1.0 : (1.0 - (p - 0.90) / 0.10);
          this.charPos.y = Math.abs(walkStep) * 0.75 * walkWeight;
          this.charRot.z = Math.sin((elapsed - 21.2) * 7.0) * 0.015 * walkWeight;

          // Natural arm swing
          const swing = Math.sin((elapsed - 21.2) * 7.0) * 0.25 * walkWeight;
          this.updateDoraArms({
            lShoulderRoll: -1.25,
            lShoulderPitch: -0.22,
            lElbowBend: 0.45,
            rShoulderRoll: -1.35,
            rShoulderPitch: -0.15 - swing,
            rElbowBend: 0.28
          });

          if (this.phone) {
            this.phone.position.set(this.leftHandWorldPos.x + 0.15, this.leftHandWorldPos.y + 0.6, this.leftHandWorldPos.z + 0.4);
            this.phone.rotation.set(-0.25, 0.20, 0);
          }
        }

        // -------------------------------------------------------------
        // STEP 9 — APPROACH & BODY SETTLE (25.0s to 26.2s)
        // Dora stops at SHELF_INTERACTION_POINT (76, 0, -64).
        // Torso turns smoothly to face bookshelf directly (0.35 rad).
        // Head stays neutral aligned with body.
        // Ghost glasses disappear as she arrives.
        // -------------------------------------------------------------
        else if (elapsed < 26.2) {
          this.currentStoryPhase = 'APPROACH';
          this.glassesState = 'GLASSES_SHELF';
          this.ghostGlasses.visible = false;
          this.highlightGhost.visible = false;
          this.spatialTrail.visible = false;

          this.updateStoryCameraFraming('APPROACH', elapsed);

          this.charPos.set(this.SHELF_INTERACTION_POINT.x, 0, this.SHELF_INTERACTION_POINT.z);

          const turnShelf = this.easeInOutCubic((elapsed - 25.0) / 1.2);
          this.charRot.y = 2.45 * (1 - turnShelf) + 0.35 * turnShelf;
          this.headRot.set(0, 0, 0);

          this.updateDoraArms({
            lShoulderRoll: -1.35,
            lShoulderPitch: -0.15,
            lElbowBend: 0.28,
            rShoulderRoll: -1.35,
            rShoulderPitch: -0.15,
            rElbowBend: 0.28
          });

          if (this.phone) {
            this.phone.position.set(this.leftHandWorldPos.x + 0.2, this.leftHandWorldPos.y + 0.7, this.leftHandWorldPos.z + 0.5);
            this.phone.rotation.set(-0.25, 0.15, 0);
          }
        }

        // -------------------------------------------------------------
        // STEP 10 — REACH & PICKUP (26.2s to 28.5s)
        // Camera moves closer to Dora + shelf without plant in the way.
        // 26.2s - 27.4s: Right arm extends forward onto shelf 2 (glasses remain on shelf).
        // At 27.4s: CONTACT! glasses attach to right hand (GLASSES_HELD).
        // 27.4s - 28.5s: Right arm flexes and brings glasses to chest with relieved smile.
        // -------------------------------------------------------------
        else if (elapsed < 28.5) {
          this.currentStoryPhase = 'PICKUP';
          this.ghostGlasses.visible = false;
          this.highlightGhost.visible = false;
          this.spatialTrail.visible = false;

          this.updateStoryCameraFraming('PICKUP', elapsed);

          this.charPos.set(this.SHELF_INTERACTION_POINT.x, 0, this.SHELF_INTERACTION_POINT.z);
          this.charRot.set(0, 0.35, 0);

          if (elapsed < 27.4) {
            // Reaching phase: arm extends toward glasses on shelf 2
            this.glassesState = 'GLASSES_SHELF';
            const reachP = this.easeInOutCubic((elapsed - 26.2) / 1.2);

            this.updateDoraArms({
              lShoulderRoll: -1.35,
              lShoulderPitch: -0.15,
              lElbowBend: 0.28,
              rShoulderRoll: -0.25 * reachP + -1.35 * (1 - reachP),
              rShoulderPitch: -0.92 * reachP + -0.15 * (1 - reachP),
              rElbowBend: 0.40 * reachP + 0.28 * (1 - reachP),
              rWristFlex: 0.20
            });
            // Head looks at glasses on shelf
            this.headRot.set(-0.06 * reachP, 0.12 * reachP, 0);
          } else {
            // CONTACT & RETRIEVAL: glasses attach to hand!
            this.glassesState = 'GLASSES_HELD';
            this.shelfContactShadow.material.opacity = 0;

            const liftP = this.easeInOutCubic((elapsed - 27.4) / 1.1);
            this.updateDoraArms({
              lShoulderRoll: -1.35,
              lShoulderPitch: -0.15,
              lElbowBend: 0.28,
              rShoulderRoll: -0.72 * liftP + -0.25 * (1 - liftP),
              rShoulderPitch: -0.65 * liftP + -0.92 * (1 - liftP),
              rElbowBend: 1.30 * liftP + 0.40 * (1 - liftP),
              rWristFlex: 0.30
            });

            this.headRot.set(-0.04, 0.20, 0.06 * liftP);
          }

          if (this.phone) {
            this.phone.position.set(this.leftHandWorldPos.x + 0.2, this.leftHandWorldPos.y + 0.7, this.leftHandWorldPos.z + 0.5);
            this.phone.rotation.set(-0.25, 0.15, 0);
          }

          this.drawPhoneScreen('RESOLVE', 'Retrieved');

          if (this.ui.narration) {
            this.ui.narrTitle.textContent = 'Relief restored.';
            this.ui.narrDetail.textContent = 'Displaced 240 cm · 99.4% confidence';
          }
          if (this.ui.note) this.ui.note.classList.add('visible');
        }

        // -------------------------------------------------------------
        // STEP 11 — PEACEFUL RELIEF & MULTI-STATE REPLAY (28.5s+)
        // Calm idle with glasses in hand; warm sunlight restored.
        // Button transitions: "Story complete ✓" -> "Replay story ↻".
        // -------------------------------------------------------------
        else {
          this.currentStoryPhase = 'RELIEF';
          this.glassesState = 'GLASSES_HELD';
          this.ghostGlasses.visible = false;
          this.highlightGhost.visible = false;
          this.spatialTrail.visible = false;

          this.updateStoryCameraFraming('RELIEF', elapsed);

          if (this.roomLights.phantom) this.roomLights.phantom.intensity = Math.max(0, 1.35 - (elapsed - 28.5) * 0.4);

          const happyBob = Math.sin(now * 0.0025) * 0.35;
          this.charPos.set(this.SHELF_INTERACTION_POINT.x, happyBob, this.SHELF_INTERACTION_POINT.z);
          this.charRot.set(0, 0.35, 0);
          this.headRot.set(-0.04, 0.20, 0.06);

          this.updateDoraArms({
            lShoulderRoll: -1.35,
            lShoulderPitch: -0.15,
            lElbowBend: 0.28,
            rShoulderRoll: -0.72,
            rShoulderPitch: -0.65,
            rElbowBend: 1.30
          });

          if (this.phone) {
            this.phone.position.set(this.leftHandWorldPos.x + 0.2, this.leftHandWorldPos.y + 0.7, this.leftHandWorldPos.z + 0.5);
            this.phone.rotation.set(-0.25, 0.15, 0);
          }

          if (elapsed < 30.5) {
            if (this.ui.cta) {
              this.ui.cta.classList.remove('playing');
              this.ui.cta.classList.add('complete');
              if (this.ui.ctaLabel) {
                this.ui.ctaLabel.textContent = 'Story complete ✓';
              } else {
                this.ui.cta.innerHTML = 'Story complete ✓';
              }
            }
          } else {
            if (this.ui.cta) {
              this.ui.cta.classList.remove('complete');
              this.ui.cta.classList.add('replay');
              if (this.ui.ctaLabel) {
                this.ui.ctaLabel.textContent = 'Replay story ↻';
              } else {
                this.ui.cta.innerHTML = 'Replay story ↻';
              }
            }
            if (this.ui.replay) {
              this.ui.replay.classList.add('visible');
              this.ui.replay.hidden = false;
            }
          }
        }

        // ================= GLASSES STATE MACHINE ENFORCEMENT =================
        if (this.glassesState === 'GLASSES_TABLE') {
          this.glasses.position.copy(this.glassesTablePos);
          this.glasses.rotation.copy(this.glassesTableRot);
        } else if (this.glassesState === 'GLASSES_SHELF') {
          this.glasses.position.copy(this.glassesShelfPos);
          this.glasses.rotation.copy(this.glassesShelfRot);
        } else if (this.glassesState === 'GLASSES_HELD') {
          const handPos = new THREE.Vector3(this.rightHandWorldPos.x, this.rightHandWorldPos.y + 1.2, this.rightHandWorldPos.z + 0.8);
          if (this.currentStoryPhase === 'PICKUP' && elapsed >= 27.4 && elapsed < 28.5) {
            const liftP = this.easeInOutCubic((elapsed - 27.4) / 1.1);
            this.glasses.position.lerpVectors(this.glassesShelfPos, handPos, liftP);
          } else {
            this.glasses.position.copy(handPos);
          }
          this.glasses.rotation.set(-0.20, 0.35, 0.10);
        }
      }

      // Apply animated transforms to Character & Rigged Head
      if (this.character) {
        this.character.position.copy(this.charPos);
        this.character.rotation.copy(this.charRot);
      }
      if (this.characterHead) {
        if (this.characterHead.name === 'doraHeadPivot') {
          this.characterHead.rotation.x = this.headRot.x;
          this.characterHead.rotation.z = this.headRot.y; // Positive turns to her LEFT toward phone/shelf!
          this.characterHead.rotation.y = -this.headRot.z;
        } else {
          this.characterHead.rotation.copy(this.headRot);
        }
      }

      // Smooth Cinematic Camera Lerp
      const camLerp = 0.045;
      if (Math.abs(this.targetFov - this.camera.fov) > 0.01) {
        this.camera.fov += (this.targetFov - this.camera.fov) * camLerp;
        this.camera.updateProjectionMatrix();
      }

      this.camera.position.x += (this.targetCamPos.x + this.mouse.x * 12 - this.camera.position.x) * camLerp;
      this.camera.position.y += (this.targetCamPos.y - this.mouse.y * 6 - this.camera.position.y) * camLerp;
      this.camera.position.z += (this.targetCamPos.z - this.camera.position.z) * camLerp;

      this.camTarget.x += (this.targetCamLook.x - this.camTarget.x) * camLerp;
      this.camTarget.y += (this.targetCamLook.y - this.camTarget.y) * camLerp;
      this.camTarget.z += (this.targetCamLook.z - this.camTarget.z) * camLerp;

      this.camera.lookAt(this.camTarget);

      this.renderer.render(this.scene, this.camera);
    }

    // =========================================================================
    // RESPONSIVE STORY SCENE FRAMING & DYNAMIC CAMERA CHOREOGRAPHY
    // =========================================================================
    ensureTargetInSafeView(targetWorldPos, safeMarginX = 0.72, safeMarginY = 0.60) {
      if (!this.camera || !targetWorldPos) return;
      if (!this._tempVec) this._tempVec = new THREE.Vector3();
      this._tempVec.copy(targetWorldPos).project(this.camera);

      // Check if projected NDC is outside safe boundaries
      if (this._tempVec.x < -safeMarginX) {
        const err = -safeMarginX - this._tempVec.x;
        const correction = err * 25;
        this.targetCamLook.x -= Math.min(correction, 15);
        this.targetCamPos.x -= Math.min(correction, 15);
      } else if (this._tempVec.x > safeMarginX) {
        const err = this._tempVec.x - safeMarginX;
        const correction = err * 25;
        this.targetCamLook.x += Math.min(correction, 15);
        this.targetCamPos.x += Math.min(correction, 15);
      }

      if (this._tempVec.y < -safeMarginY) {
        const err = -safeMarginY - this._tempVec.y;
        const correction = err * 15;
        this.targetCamLook.y -= Math.min(correction, 12);
      } else if (this._tempVec.y > safeMarginY) {
        const err = this._tempVec.y - safeMarginY;
        const correction = err * 15;
        this.targetCamLook.y += Math.min(correction, 12);
      }
    }

    updateStoryCameraFraming(phase, elapsed = 0) {
      if (!this.container || !this.camera) return;

      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      const aspect = h > 0 ? (w / h) : 1.777;

      // Responsive aspect factor:
      // tAspect = 0 when aspect <= 0.52 (narrow mobile portrait, e.g. 375x667 ~ 0.56, 390x844 ~ 0.46)
      // tAspect = 1 when aspect >= 1.50 (standard landscape / widescreen desktop)
      // Smooth continuous blend for tablet portrait (0.75), square, and landscape.
      const tAspect = Math.max(0, Math.min(1, (aspect - 0.52) / (1.50 - 0.52)));

      // Base desktop preset
      let dPos = CAM_PRESETS.HOME.pos;
      let dTarget = CAM_PRESETS.HOME.target;
      let dFov = CAM_PRESETS.HOME.fov;

      // Mobile framing default (IDLE) - Position Dora in upper stage with feet well above hero text
      let mPos = { x: 14, y: 102, z: 340 };
      let mTarget = { x: 4, y: 36, z: -10 };
      let mFov = 34;

      let focalObject = null;

      switch (phase) {
        case 'IDLE':
          dPos = CAM_PRESETS.HOME.pos;
          dTarget = CAM_PRESETS.HOME.target;
          dFov = CAM_PRESETS.HOME.fov;
          mPos = { x: 12, y: 116, z: 345 };
          mTarget = { x: 4, y: 20, z: -10 };
          mFov = 34;
          focalObject = null;
          break;

        case 'NOTICE':
          dPos = CAM_PRESETS.NOTICE.pos;
          dTarget = CAM_PRESETS.NOTICE.target;
          dFov = CAM_PRESETS.NOTICE.fov;
          // Mobile: Frame the side table and Dora together
          mPos = { x: -16, y: 96, z: 230 };
          mTarget = { x: -44, y: 51, z: 8 };
          mFov = 31;
          focalObject = this.glassesTablePos;
          break;

        case 'GLASSES_MOVE': {
          dPos = CAM_PRESETS.GLASSES_MOVE.pos;
          dTarget = CAM_PRESETS.GLASSES_MOVE.target;
          dFov = CAM_PRESETS.GLASSES_MOVE.fov;

          // Dynamically track flying glasses
          const flight = Math.max(0, Math.min(1, (elapsed - 3.1) / 2.2));
          const p = this.easeInOutCubic(flight);

          // Smooth mobile trajectory camera:
          // Start framed on table -> track arc in air -> arrive framed on bookshelf
          const startMPos = { x: -16, y: 96, z: 230 };
          const startMTarget = { x: -44, y: 51, z: 8 };

          const midMPos = { x: 32, y: 106, z: 235 };
          const midMTarget = { x: 18, y: 64, z: -35 };

          const endMPos = { x: 74, y: 102, z: 205 };
          const endMTarget = { x: 80, y: 64, z: -75 };

          if (p < 0.5) {
            const u = p * 2;
            mPos = {
              x: startMPos.x + (midMPos.x - startMPos.x) * u,
              y: startMPos.y + (midMPos.y - startMPos.y) * u,
              z: startMPos.z + (midMPos.z - startMPos.z) * u
            };
            mTarget = {
              x: startMTarget.x + (midMTarget.x - startMTarget.x) * u,
              y: startMTarget.y + (midMTarget.y - startMTarget.y) * u,
              z: startMTarget.z + (midMTarget.z - startMTarget.z) * u
            };
          } else {
            const u = (p - 0.5) * 2;
            mPos = {
              x: midMPos.x + (endMPos.x - midMPos.x) * u,
              y: midMPos.y + (endMPos.y - midMPos.y) * u,
              z: midMPos.z + (endMPos.z - midMPos.z) * u
            };
            mTarget = {
              x: midMTarget.x + (endMTarget.x - midMTarget.x) * u,
              y: midMTarget.y + (endMTarget.y - midMTarget.y) * u,
              z: midMTarget.z + (endMTarget.z - midMTarget.z) * u
            };
          }
          mFov = 31;
          focalObject = this.glasses ? this.glasses.position : null;
          break;
        }

        case 'SEARCH':
          dPos = CAM_PRESETS.SEARCH.pos;
          dTarget = CAM_PRESETS.SEARCH.target;
          dFov = CAM_PRESETS.SEARCH.fov;
          // Dora turns to side table; frame empty table and Dora
          mPos = { x: -18, y: 98, z: 235 };
          mTarget = { x: -42, y: 52, z: 6 };
          mFov = 31;
          focalObject = this.glassesTablePos;
          break;

        case 'PHONE_CHECK':
          dPos = CAM_PRESETS.PHONE_CHECK.pos;
          dTarget = CAM_PRESETS.PHONE_CHECK.target;
          dFov = CAM_PRESETS.PHONE_CHECK.fov;
          // Frame Dora torso and glowing phone
          mPos = { x: 14, y: 88, z: 185 };
          mTarget = { x: 4, y: 54, z: 12 };
          mFov = 28;
          focalObject = this.phone ? this.phone.position : this.charPos;
          break;

        case 'PHANTOM_SCAN': {
          dPos = CAM_PRESETS.PHANTOM_SCAN.pos;
          dTarget = CAM_PRESETS.PHANTOM_SCAN.target;
          dFov = CAM_PRESETS.PHANTOM_SCAN.fov;
          const scanP = Math.max(0, Math.min(1, (elapsed - 13.0) / 3.5));
          // Pull back and gently track scan sweep
          mPos = { x: 5 + scanP * 25, y: 120, z: 305 };
          mTarget = { x: -15 + scanP * 35, y: 54, z: -30 };
          mFov = 36;
          focalObject = this.spatialScanPlane ? this.spatialScanPlane.position : null;
          break;
        }

        case 'MEMORY_REVEAL': {
          dPos = CAM_PRESETS.MEMORY_REVEAL.pos;
          dTarget = CAM_PRESETS.MEMORY_REVEAL.target;
          dFov = CAM_PRESETS.MEMORY_REVEAL.fov;
          if (elapsed < 18.2) {
            // First look at ghost on table
            mPos = { x: -16, y: 102, z: 245 };
            mTarget = { x: -42, y: 52, z: 6 };
            focalObject = this.ghostGlasses ? this.ghostGlasses.position : this.glassesTablePos;
          } else {
            // Sweep across along spatial trail to bookshelf
            const pTrail = this.easeInOutCubic(Math.min((elapsed - 18.2) / 1.8, 1.0));
            mPos = {
              x: -16 + (74 - (-16)) * pTrail,
              y: 102 + (104 - 102) * pTrail,
              z: 245 + (210 - 245) * pTrail
            };
            mTarget = {
              x: -42 + (78 - (-42)) * pTrail,
              y: 52 + (62 - 52) * pTrail,
              z: 6 + (-70 - 6) * pTrail
            };
            focalObject = this.glassesShelfPos;
          }
          mFov = 32;
          break;
        }

        case 'NOTICE_SHELF':
          dPos = CAM_PRESETS.NOTICE_SHELF.pos;
          dTarget = CAM_PRESETS.NOTICE_SHELF.target;
          dFov = CAM_PRESETS.NOTICE_SHELF.fov;
          mPos = { x: 65, y: 104, z: 225 };
          mTarget = { x: 68, y: 58, z: -55 };
          mFov = 31;
          focalObject = this.glassesShelfPos;
          break;

        case 'WALK_TO_SHELF': {
          dPos = CAM_PRESETS.WALK_TO_SHELF.pos;
          dTarget = CAM_PRESETS.WALK_TO_SHELF.target;
          dFov = CAM_PRESETS.WALK_TO_SHELF.fov;
          const pWalk = this.easeInOutCubic(Math.min((elapsed - 21.2) / 3.8, 1.0));
          // Dynamically track Dora walking across the room
          mPos = {
            x: 22 + (80 - 22) * pWalk,
            y: 104,
            z: 240 + (195 - 240) * pWalk
          };
          mTarget = {
            x: 4 + (76 - 4) * pWalk + 6,
            y: 56,
            z: 10 + (-64 - 10) * pWalk - 8
          };
          mFov = 31;
          focalObject = this.charPos;
          break;
        }

        case 'APPROACH':
          dPos = CAM_PRESETS.APPROACH.pos;
          dTarget = CAM_PRESETS.APPROACH.target;
          dFov = CAM_PRESETS.APPROACH.fov;
          mPos = { x: 80, y: 100, z: 175 };
          mTarget = { x: 84, y: 64, z: -75 };
          mFov = 29;
          focalObject = this.glassesShelfPos;
          break;

        case 'PICKUP':
          dPos = CAM_PRESETS.PICKUP.pos;
          dTarget = CAM_PRESETS.PICKUP.target;
          dFov = CAM_PRESETS.PICKUP.fov;
          mPos = { x: 80, y: 98, z: 175 };
          mTarget = { x: 84, y: 64, z: -75 };
          mFov = 29;
          focalObject = this.glasses ? this.glasses.position : this.glassesShelfPos;
          break;

        case 'RELIEF':
          dPos = CAM_PRESETS.RELIEF.pos;
          dTarget = CAM_PRESETS.RELIEF.target;
          dFov = CAM_PRESETS.RELIEF.fov;
          mPos = { x: 76, y: 100, z: 190 };
          mTarget = { x: 74, y: 62, z: -60 };
          mFov = 30;
          focalObject = this.charPos;
          break;
      }

      // Smoothly blend between mobile and desktop based on aspect ratio
      this.targetCamPos.set(
        mPos.x + (dPos.x - mPos.x) * tAspect,
        mPos.y + (dPos.y - mPos.y) * tAspect,
        mPos.z + (dPos.z - mPos.z) * tAspect
      );
      this.targetCamLook.set(
        mTarget.x + (dTarget.x - mTarget.x) * tAspect,
        mTarget.y + (dTarget.y - mTarget.y) * tAspect,
        mTarget.z + (dTarget.z - mTarget.z) * tAspect
      );
      this.targetFov = mFov + (dFov - mFov) * tAspect;

      // Safe area boundary enforcement:
      // Ensure the key narrative subject remains safely inside visible bounds
      if (focalObject) {
        this.ensureTargetInSafeView(focalObject);
      }
    }

    onResize() {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w === 0 || h === 0) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.updateStoryCameraFraming(
        this.currentStoryPhase || 'IDLE',
        this.isStoryActive ? (performance.now() - this.storyStartTime) / 1000 : 0
      );
    }

    findGlasses() {
      if (this.currentStoryPhase === 'RESOLVE') {
        this.resetStory();
      }
      this.startStory();
    }

    scrubRealityDiff(ratio) {
      if (this.isStoryActive) return;
      // Gently adjust camera and ghost visibility based on reality diff scrub
      if (this.ghostGlasses) {
        this.ghostGlasses.visible = ratio > 0.45;
      }
      if (this.highlightGhost) {
        this.highlightGhost.visible = ratio > 0.45;
      }
    }
  }

  // Mount on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const app = new DishaExperience('spatialViewport');
      window.dishaApp = app;
      window.smritiApp = app;
    });
  } else {
    const app = new DishaExperience('spatialViewport');
    window.dishaApp = app;
    window.smritiApp = app;
  }

  window.DishaExperience = DishaExperience;
  window.SmritiExperience = DishaExperience;
  window.triggerDishaStory = () => {
    const app = window.dishaApp || window.smritiApp;
    if (app) {
      app.startStory();
    }
  };
  window.triggerSmritiStory = window.triggerDishaStory;
})();
