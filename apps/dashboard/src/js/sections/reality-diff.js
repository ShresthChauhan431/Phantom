/**
 * ==============================================================================
 * SECTION 06: REALITY DIFF — CONTROLLER (100% Story Scene Synchronization)
 * Directly mirrors the established SMRITI story scene from smriti-experience.js:
 * - Exact PALETTE constants (bg, wallPlaster, floorWood, floorPlankDark, rugBase, armchairFabric, etc.)
 * - Exact CAM_PRESETS.HOME camera framing, rotation, and FOV
 * - Exact furniture GLBs, heights, transforms, materials, and radial contact shadows
 * - Exact reading glasses model geometry, table anchor, and bookshelf anchor
 * - Synchronized WebGL dual-scissor rendering: BEFORE (2:10 PM) <-> AFTER (4:40 PM)
 * ==============================================================================
 */

(function () {
  'use strict';

  // Master Palette Constants (100% matching smriti-experience.js)
  const PALETTE = {
    bg: 0xD1B28E,              // Warm midtone backdrop
    wallPlaster: 0xB28A66,     // Soft caramel plaster
    floorWood: 0x8B6042,       // Rich walnut/caramel oak floor (#8B6042)
    floorPlankDark: 0x5C381E,  // Dark parquet inlay (#5C381E)
    rugBase: 0xFAEBD5,         // Organic pebble rug (#FAEBD5)
    rugBorder: 0xDECAB0,       // Woven border
    furnitureWood: 0x8B6042,   // Rich warm wood (#8B6042)
    furnitureDark: 0x34251F,   // Dark brown (#34251F)
    armchairFabric: 0x754832,  // Muted caramel upholstery (#754832)
    blanketTerracotta: 0xC95F3D,// Terracotta Throw (#C95F3D)
    cushionMustard: 0xD5A63C,  // Warm Velvet Mustard (#D5A63C)
    charSweater: 0x53613B,     // Deep Olive Knit (#53613B)
    plantGreen: 0x53613B,      // Natural deep olive foliage
    plantDeep: 0x364024,       // Deep olive shadow foliage
    plantPot: 0xB66A4A,        // Soft terracotta planter
    glassesFrame: 0x34251F,    // Dark Espresso Frame (#34251F)
    glassesBridge: 0xD5A63C,   // Warm Gold Bridge (#D5A63C)
    phantomTeal: 0x4D9D91      // SMRITI Memory Teal (#4D9D91)
  };

  // Exact Story Camera Preset (CAM_PRESETS.HOME from smriti-experience.js)
  const CAM_PRESETS = {
    HOME: { pos: { x: 50, y: 110, z: 275 }, target: { x: 4, y: 54, z: -10 }, fov: 31 },
    MOBILE: { pos: { x: 10, y: 115, z: 340 }, target: { x: 4, y: 58, z: -15 }, fov: 36 }
  };

  class RealityDiffController {
    constructor() {
      this.section = document.getElementById('reality-diff-compare');
      this.viewport = document.getElementById('comparisonViewport');
      this.canvas = document.getElementById('realityDiffCanvas');
      this.divider = document.getElementById('diffSplitDivider');
      this.handle = document.getElementById('dividerHandle');
      this.movedBadge = document.getElementById('movedBadge');

      if (!this.section || !this.viewport || !this.canvas) return;

      this.splitPercent = 0.50; // Default 50%
      this.isDragging = false;
      this.isIntersecting = false;
      this.animId = null;
      this.prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Three.js Core
      this.scene = null;
      this.camera = null;
      this.renderer = null;
      this.camTarget = new THREE.Vector3().copy(CAM_PRESETS.HOME.target);
      this.shadowTexture = null;

      // Scene Groups
      this.roomGroup = null;
      this.tableGroup = null;
      this.sofaGroup = null;
      this.plantGroup = null;
      this.shelfGroup = null;

      // Authoritative Story Glasses Anchors
      this.glassesTablePos = new THREE.Vector3(-78, 51.5, 8);
      this.glassesTableRot = new THREE.Euler(-0.12, 0.32, -0.05);
      this.glassesShelfPos = new THREE.Vector3(104, 85.2, -85);
      this.glassesShelfRot = new THREE.Euler(-0.12, 0.28, 0);

      // Glasses Instances (BEFORE vs AFTER)
      this.glassesTable = null;
      this.tableShadow = null;
      this.glassesShelf = null;
      this.shelfShadow = null;
      this.shelfHalo = null;
      this.isSceneInitialized = false;

      this.init();
    }

    init() {
      if (!window.THREE) return;

      this.initEvents();
      this.updateSplitUI();

      // Lazy-initialize 3D scene and assets when approaching Section 06
      const approachObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !this.isSceneInitialized) {
            this.isSceneInitialized = true;
            this.initScene();
            approachObserver.disconnect();
          }
        });
      }, { rootMargin: '500px 0px' });
      approachObserver.observe(this.section);
    }

    initScene() {
      this.shadowTexture = this.createRadialShadowTexture();
      this.initThree();
      this.setupCinematicLighting();
      this.buildOrganicEnvironment();
      this.loadSmallTable();
      this.loadSofa();
      this.loadPlant();
      this.buildBookshelf();
      this.buildGlassesProps();

      if (this.isIntersecting && !this.prefersReducedMotion) {
        this.startLoop();
      } else if (this.prefersReducedMotion) {
        this.renderStatic();
      }
      this.updateSplitUI();
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

    initThree() {
      const rect = this.viewport.getBoundingClientRect();
      const width = rect.width || 800;
      const height = rect.height || 450;
      const isMobile = window.innerWidth < 640;

      // 1. Scene with Warm Canvas Atmosphere & Fog
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(PALETTE.bg);
      this.scene.fog = new THREE.FogExp2(PALETTE.bg, 0.00022);

      // 2. Camera: Exact Story Framing & Target
      const preset = isMobile ? CAM_PRESETS.MOBILE : CAM_PRESETS.HOME;
      this.camera = new THREE.PerspectiveCamera(preset.fov, width / height, 10, 3000);
      this.camera.position.set(preset.pos.x, preset.pos.y, preset.pos.z);
      this.camTarget.set(preset.target.x, preset.target.y, preset.target.z);
      this.camera.lookAt(this.camTarget);

      // 3. High-Fidelity Renderer matching Hero Tone Mapping
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      this.renderer.outputEncoding = THREE.sRGBEncoding;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;

      this.roomGroup = new THREE.Group();
      this.scene.add(this.roomGroup);
    }

    setupCinematicLighting() {
      // Ambient Light
      const ambient = new THREE.AmbientLight(0xFFE5D0, 0.42);
      this.scene.add(ambient);

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

      // Soft Warm Window Bounce Fill
      const windowFill = new THREE.DirectionalLight(0xF5DEC0, 0.50);
      windowFill.position.set(-150, 130, 80);
      this.scene.add(windowFill);

      // Rim Light
      const rimLight = new THREE.DirectionalLight(0xFFE8D6, 0.60);
      rimLight.position.set(-30, 140, -180);
      this.scene.add(rimLight);
    }

    buildOrganicEnvironment() {
      // 1. Warm Rounded Floor Disc
      const matFloor = new THREE.MeshStandardMaterial({
        color: PALETTE.floorWood,
        roughness: 0.38,
        metalness: 0.08
      });
      const floor = new THREE.Mesh(new THREE.CylinderGeometry(185, 185, 4, 64), matFloor);
      floor.position.set(4, -2, -18);
      floor.receiveShadow = true;
      this.roomGroup.add(floor);

      // 2. Fine Inlaid Oak Parquet Lines
      const lineMat = new THREE.MeshBasicMaterial({ color: PALETTE.floorPlankDark, opacity: 0.40, transparent: true });
      for (let i = -140; i <= 140; i += 32) {
        const plank = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 260), lineMat);
        plank.rotation.x = -Math.PI * 0.5;
        plank.position.set(i + 4, 0.04, -18);
        this.roomGroup.add(plank);
      }

      // 3. Sculpted Soft Curved Background Wall
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
      this.roomGroup.add(backWall);

      // 4. Soft Asymmetrical Pebble Rug under hero area
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
      this.roomGroup.add(rug);
    }

    loadSmallTable() {
      this.tableGroup = new THREE.Group();
      this.tableGroup.position.set(-78, 0, 8);
      this.roomGroup.add(this.tableGroup);

      if (!window.THREE.GLTFLoader) return;
      const loader = new window.THREE.GLTFLoader();

      loader.load(
        '/public/models/small_table.glb',
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

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

          // Soft Radial Contact Shadow under table base
          const tableFloorShadow = new THREE.Mesh(
            new THREE.PlaneGeometry(42, 42),
            new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.55, depthWrite: false })
          );
          tableFloorShadow.rotation.x = -Math.PI * 0.5;
          tableFloorShadow.position.set(0, 0.04, 0);
          this.tableGroup.add(tableFloorShadow);
        },
        undefined,
        (err) => console.error('Error loading small_table.glb:', err)
      );
    }

    loadSofa() {
      this.sofaGroup = new THREE.Group();
      this.sofaGroup.position.set(-48, 0, -38);
      this.sofaGroup.rotation.y = 0.40;
      this.roomGroup.add(this.sofaGroup);

      if (!window.THREE.GLTFLoader) return;
      const loader = new window.THREE.GLTFLoader();

      loader.load(
        '/public/models/sofa.glb',
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

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

    loadPlant() {
      this.plantGroup = new THREE.Group();
      this.plantGroup.position.set(44, 0, -84);
      this.roomGroup.add(this.plantGroup);

      if (!window.THREE.GLTFLoader) return;
      const loader = new window.THREE.GLTFLoader();

      loader.load(
        '/public/models/plant_with_pot.glb',
        (gltf) => {
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());

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

      // Books on Shelf 2 (identical to story layout, leaving open space at x = 0)
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

      this.roomGroup.add(this.shelfGroup);
    }

    buildGlassesProps() {
      // Helper to build realistic spectacles (100% matching buildHeroProps in smriti-experience.js)
      const createStoryGlasses = () => {
        const glasses = new THREE.Group();

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
        glasses.add(rimL);

        const lensL = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.4, 24), matLens);
        lensL.position.set(-4.8, 0, 0);
        lensL.rotation.x = Math.PI * 0.5;
        glasses.add(lensL);

        const rimR = new THREE.Mesh(rimGeo, matFrame);
        rimR.position.set(4.8, 0, 0);
        glasses.add(rimR);

        const lensR = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.4, 24), matLens);
        lensR.position.set(4.8, 0, 0);
        lensR.rotation.x = Math.PI * 0.5;
        glasses.add(lensR);

        const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 3.2, 12), matBridge);
        bridge.rotation.z = Math.PI * 0.5;
        bridge.position.y = 0.5;
        glasses.add(bridge);

        const templeGeo = new THREE.CylinderGeometry(0.45, 0.45, 10.5, 12);
        const templeL = new THREE.Mesh(templeGeo, matFrame);
        templeL.position.set(-8.4, 0, -5.2);
        templeL.rotation.x = Math.PI * 0.5;
        glasses.add(templeL);

        const templeR = new THREE.Mesh(templeGeo, matFrame);
        templeR.position.set(8.4, 0, -5.2);
        templeR.rotation.x = Math.PI * 0.5;
        glasses.add(templeR);

        // Human-scale proportion: 0.85
        glasses.scale.set(0.85, 0.85, 0.85);
        return glasses;
      };

      // 1. BEFORE STATE: Glasses on Side Table
      this.glassesTable = createStoryGlasses();
      this.glassesTable.position.copy(this.glassesTablePos);
      this.glassesTable.rotation.copy(this.glassesTableRot);
      this.scene.add(this.glassesTable);

      this.tableShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 12),
        new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.55, depthWrite: false })
      );
      this.tableShadow.rotation.x = -Math.PI * 0.5;
      this.tableShadow.position.set(this.glassesTablePos.x, this.glassesTablePos.y - 3.4, this.glassesTablePos.z);
      this.scene.add(this.tableShadow);

      // 2. AFTER STATE: Glasses on Bookshelf
      this.glassesShelf = createStoryGlasses();
      this.glassesShelf.position.copy(this.glassesShelfPos);
      this.glassesShelf.rotation.copy(this.glassesShelfRot);

      // Subtle warm aura beacon around confirmed glasses on shelf
      const haloGeo = new THREE.RingGeometry(3.6, 4.2, 32);
      const haloMat = new THREE.MeshBasicMaterial({
        color: PALETTE.phantomTeal,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55
      });
      this.shelfHalo = new THREE.Mesh(haloGeo, haloMat);
      this.shelfHalo.rotation.x = Math.PI * 0.5;
      this.shelfHalo.position.y = -0.5;
      this.glassesShelf.add(this.shelfHalo);

      this.scene.add(this.glassesShelf);

      this.shelfShadow = new THREE.Mesh(
        new THREE.PlaneGeometry(16, 12),
        new THREE.MeshBasicMaterial({ map: this.shadowTexture, transparent: true, opacity: 0.55, depthWrite: false })
      );
      this.shelfShadow.rotation.x = -Math.PI * 0.5;
      this.shelfShadow.position.set(this.glassesShelfPos.x, this.glassesShelfPos.y - 3.1, this.glassesShelfPos.z);
      this.scene.add(this.shelfShadow);
    }

    renderStatic() {
      if (!this.renderer || !this.scene || !this.camera || !this.glassesTable) return;
      const width = this.viewport.clientWidth;
      const height = this.viewport.clientHeight;
      const dividerX = Math.round(width * this.splitPercent);

      this.renderer.setScissorTest(true);

      this.glassesTable.visible = true;
      this.tableShadow.visible = true;
      this.glassesShelf.visible = false;
      this.shelfShadow.visible = false;
      this.renderer.setScissor(0, 0, Math.max(dividerX, 1), height);
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.render(this.scene, this.camera);

      this.glassesTable.visible = false;
      this.tableShadow.visible = false;
      this.glassesShelf.visible = true;
      this.shelfShadow.visible = true;
      this.renderer.setScissor(dividerX, 0, Math.max(width - dividerX, 1), height);
      this.renderer.setViewport(0, 0, width, height);
      this.renderer.render(this.scene, this.camera);

      this.renderer.setScissorTest(false);
    }

    initEvents() {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          this.isIntersecting = entry.isIntersecting;
          if (this.isIntersecting && this.isSceneInitialized) {
            if (!this.prefersReducedMotion) {
              this.startLoop();
            } else {
              this.renderStatic();
            }
          } else {
            this.stopLoop();
          }
        });
      }, { threshold: 0.05 });
      observer.observe(this.viewport);

      const onStart = (e) => {
        this.isDragging = true;
        this.handle?.classList.add('dragging');
        this.updateFromEvent(e);
      };

      const onMove = (e) => {
        if (!this.isDragging) return;
        this.updateFromEvent(e);
      };

      const onEnd = () => {
        if (this.isDragging) {
          this.isDragging = false;
          this.handle?.classList.remove('dragging');
        }
      };

      this.viewport.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      this.viewport.addEventListener('touchstart', onStart, { passive: true });
      window.addEventListener('touchmove', onMove, { passive: true });
      window.addEventListener('touchend', onEnd);

      this.handle?.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          this.setSplit(this.splitPercent - 0.05);
          e.preventDefault();
        } else if (e.key === 'ArrowRight') {
          this.setSplit(this.splitPercent + 0.05);
          e.preventDefault();
        } else if (e.key === 'Home') {
          this.setSplit(0.05);
          e.preventDefault();
        } else if (e.key === 'End') {
          this.setSplit(0.95);
          e.preventDefault();
        }
      });

      window.addEventListener('resize', () => {
        if (!this.viewport || !this.renderer || !this.camera) return;
        const rect = this.viewport.getBoundingClientRect();
        const w = rect.width;
        const h = rect.height;
        const isMobile = window.innerWidth < 640;
        const preset = isMobile ? CAM_PRESETS.MOBILE : CAM_PRESETS.HOME;

        this.camera.aspect = w / h;
        this.camera.fov = preset.fov;
        this.camera.position.set(preset.pos.x, preset.pos.y, preset.pos.z);
        this.camTarget.set(preset.target.x, preset.target.y, preset.target.z);
        this.camera.lookAt(this.camTarget);
        this.camera.updateProjectionMatrix();

        this.renderer.setSize(w, h);
        this.updateSplitUI();
        if (this.prefersReducedMotion || !this.isIntersecting) {
          this.renderStatic();
        }
      }, { passive: true });
    }

    updateFromEvent(e) {
      const rect = this.viewport.getBoundingClientRect();
      const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
      const relX = clientX - rect.left;
      const rawPercent = relX / rect.width;
      this.setSplit(rawPercent);
    }

    setSplit(percent) {
      this.splitPercent = Math.min(Math.max(percent, 0.02), 0.98);
      this.updateSplitUI();
      if (this.prefersReducedMotion || !this.isIntersecting) {
        this.renderStatic();
      }
    }

    updateSplitUI() {
      const pct = this.splitPercent * 100;
      if (this.divider) this.divider.style.left = `${pct}%`;
      if (this.handle) this.handle.setAttribute('aria-valuenow', Math.round(pct));

      // 3D-to-2D Screen Space Projection of Bookshelf Glasses
      if (this.camera && this.viewport && this.movedBadge) {
        const projected = this.glassesShelfPos.clone().project(this.camera);
        const w = this.viewport.clientWidth;
        const h = this.viewport.clientHeight;

        const screenX = (projected.x * 0.5 + 0.5) * w;
        const screenY = (-projected.y * 0.5 + 0.5) * h;

        const clampedX = Math.max(55, Math.min(w - 75, screenX));
        const clampedY = Math.max(30, Math.min(h - 30, screenY));

        this.movedBadge.style.left = `${clampedX}px`;
        this.movedBadge.style.top = `${clampedY}px`;

        const dividerX = w * this.splitPercent;
        const isRevealed = dividerX < clampedX + 24;
        this.movedBadge.classList.toggle('visible', isRevealed);
      }
    }

    startLoop() {
      if (this.animId) return;

      const render = (time) => {
        if (!this.isIntersecting || this.prefersReducedMotion) {
          this.animId = null;
          return;
        }

        this.animId = requestAnimationFrame(render);

        const width = this.viewport.clientWidth;
        const height = this.viewport.clientHeight;
        const dividerX = Math.round(width * this.splitPercent);

        if (this.shelfHalo) {
          const sec = time * 0.001;
          const s = 1.0 + Math.sin(sec * 3.5) * 0.10;
          this.shelfHalo.scale.set(s, s, s);
        }

        // =====================================================================
        // SYNCHRONIZED DUAL-SCISSOR RENDERING (100% Identical Scene Geometry)
        // =====================================================================
        this.renderer.setScissorTest(true);

        // 1. LEFT REGION [0 -> dividerX]: BEFORE STATE (Glasses on Table at 2:10 PM)
        this.glassesTable.visible = true;
        this.tableShadow.visible = true;
        this.glassesShelf.visible = false;
        this.shelfShadow.visible = false;
        this.renderer.setScissor(0, 0, Math.max(dividerX, 1), height);
        this.renderer.setViewport(0, 0, width, height);
        this.renderer.render(this.scene, this.camera);

        // 2. RIGHT REGION [dividerX -> width]: AFTER STATE (Glasses on Bookshelf at 4:40 PM)
        this.glassesTable.visible = false;
        this.tableShadow.visible = false;
        this.glassesShelf.visible = true;
        this.shelfShadow.visible = true;
        this.renderer.setScissor(dividerX, 0, Math.max(width - dividerX, 1), height);
        this.renderer.setViewport(0, 0, width, height);
        this.renderer.render(this.scene, this.camera);

        this.renderer.setScissorTest(false);
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.realityDiffController = new RealityDiffController();
    });
  } else {
    window.realityDiffController = new RealityDiffController();
  }
})();
