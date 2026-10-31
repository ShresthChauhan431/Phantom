/**
 * ==============================================================================
 * PHANTOM CORE — THE SPATIAL INTELLIGENCE ECOSYSTEM
 * Multi-Domain Spatial Intelligence Layer & Ecosystem Architecture
 * ==============================================================================
 */

(function () {
  'use strict';

  // ----------------------------------------------------------------------------
  // 0. PHANTOM MODULES DATA ARCHITECTURE
  // Single source of truth for specialized intelligence modules & detail views
  // ----------------------------------------------------------------------------
  const PHANTOM_MODULES_DATA = {
    smriti: {
      id: 'smriti',
      name: 'SMRITI',
      number: '01',
      eyebrow: 'INTELLIGENCE MODULE / 01',
      tag: 'Specialized Module · 01',
      category: 'Home Intelligence',
      env: 'Residential & Private Spaces',
      side: 'left',
      subtitle: 'Your environment, understood.',
      desc: "SMRITI is PHANTOM's home intelligence layer, designed to interpret the everyday environment and turn contextual observations into useful, meaningful insights. It connects environmental awareness with personalized interactions to create a more responsive living experience.",
      capabilities: [
        'Spatial state tracking & drift detection',
        'Personalized residential environmental memory',
        'Contextual item & asset spatial indexing',
        'Adaptive ambient household assistance'
      ],
      environments: [
        'Home environments',
        'Smart homes',
        'Family life & shared spaces',
        'Memory support & daily routines',
        'Home inventory for insurance',
        'Garages & private workshops',
        'Moving & self-storage management'
      ],
      relatedModules: ['sense', 'meridian'],
      status: 'ACTIVE',
      statusType: 'active',
      metadata: [
        { label: 'ENVIRONMENT', value: 'Residential Spaces' },
        { label: 'ARCHITECTURE', value: 'Spatial Memory Engine' },
        { label: 'SYSTEM STATE', value: 'Active System' }
      ],
      actionText: 'Explore SMRITI Experience',
      actionType: 'navigate',
      routeUrl: '/pages/smriti.html',
      isPlanned: false,
      color: '#f07b42',
      glowRgb: '240, 123, 66'
    },
    lumen: {
      id: 'lumen',
      name: 'LUMEN',
      number: '02',
      eyebrow: 'INTELLIGENCE MODULE / 02',
      tag: 'Specialized Module · 02',
      category: 'Laboratory Intelligence',
      env: 'Research & Cleanroom',
      side: 'left',
      subtitle: 'Where observations become discoveries.',
      desc: "LUMEN applies PHANTOM's spatial intelligence to cleanrooms and research facilities, organizing physical observations, tracking delicate specimen movement, detecting anomalous spatial drift, and maintaining verified experimental layouts.",
      capabilities: [
        'Experimental specimen spatial tracking',
        'Controlled cleanroom state observation',
        'Laboratory tool placement verification',
        'Research-oriented spatial auditing'
      ],
      environments: [
        'Clinical & research laboratories',
        'Laboratory equipment & spatial organization',
        'Cleanroom research environments',
        'Sample & biological asset tracking',
        'Controlled laboratory containment'
      ],
      relatedModules: ['aegis', 'forge'],
      status: 'ACTIVE CONCEPT',
      statusType: 'active',
      metadata: [
        { label: 'ENVIRONMENT', value: 'Cleanroom & Research Labs' },
        { label: 'FRAMEWORK', value: 'Scientific Observation' },
        { label: 'SYSTEM STATE', value: 'Active Prototype' }
      ],
      actionText: 'Enter LUMEN Lab Suite',
      actionType: 'navigate',
      routeUrl: '/pages/lumen.html',
      isPlanned: false,
      color: '#b898ff',
      glowRgb: '184, 152, 255'
    },
    aegis: {
      id: 'aegis',
      name: 'AEGIS',
      number: '03',
      eyebrow: 'INTELLIGENCE MODULE / 03',
      tag: 'Specialized Module · 03',
      category: 'Clinical Intelligence',
      env: 'Hospital & Clinical Suite',
      side: 'right',
      subtitle: 'Clarity in critical contexts.',
      desc: "AEGIS applies PHANTOM's spatial intelligence to surgical suites, wards, and controlled pharmaceutical storage. It organizes physical inventory, tracks critical assets, and provides human-supervised decision support where clinical trust and precision are mandatory.",
      capabilities: [
        'Surgical asset verification & tray tracking',
        'Cold-chain & pharmaceutical custody tracking',
        'Clinical workflow spatial observation',
        'Human-supervised spatial decision support'
      ],
      environments: [
        'Pharmacies & DEA compliance storage',
        'Hospital wards & intensive care suites',
        'Elder care & assisted living facilities',
        'Dementia & age-related memory loss care',
        'Surgery & operating room setups',
        'Blood banks & biological repository units',
        'Vaccine cold-storage chains',
        'Pharmaceutical manufacturing suites'
      ],
      relatedModules: ['lumen', 'sense'],
      status: 'CLINICAL PREVIEW',
      statusType: 'preview',
      metadata: [
        { label: 'ENVIRONMENT', value: 'Clinical & Hospital Suites' },
        { label: 'SUPERVISION', value: 'Human-Supervised Only' },
        { label: 'SYSTEM STATE', value: 'Decision Support Model' }
      ],
      actionText: 'Access AEGIS Clinical Framework',
      actionType: 'navigate',
      routeUrl: '/pages/aegis.html',
      isPlanned: false,
      color: '#6ec1e4',
      glowRgb: '110, 193, 228'
    },
    forge: {
      id: 'forge',
      name: 'FORGE',
      number: '04',
      eyebrow: 'INTELLIGENCE MODULE / 04',
      tag: 'Specialized Module · 04',
      category: 'Industrial & Logistics Intelligence',
      env: 'Industrial & Warehouse Hubs',
      side: 'left',
      subtitle: 'Operational awareness across physical infrastructure.',
      desc: "FORGE extends PHANTOM's spatial intelligence across high-throughput industrial environments, distribution hubs, and tool cribs. It tracks heavy asset custody, models spatial volume utilization, and verifies floor layout integrity without disrupting daily throughput.",
      capabilities: [
        'Warehouse volumetric space utilization',
        'Tool crib & serialized asset reconciliation',
        'Infrastructure layout change detection',
        'Supply-chain spatial timeline auditing'
      ],
      environments: [
        'High-density distribution warehouses',
        'Manufacturing floors & tool cribs',
        'Data centers & server rooms',
        'Construction sites & staging areas',
        'Fleet maintenance & commercial garages',
        'Agriculture & bulk food storage'
      ],
      relatedModules: ['meridian', 'sentinel'],
      status: 'OPERATIONAL PILOT',
      statusType: 'active',
      metadata: [
        { label: 'ENVIRONMENT', value: 'Industrial & Logistics Hubs' },
        { label: 'RELIABILITY', value: 'High-Throughput Spatial Audit' },
        { label: 'SYSTEM STATE', value: 'Active Architecture' }
      ],
      actionText: 'Explore FORGE Industrial Suite',
      actionType: 'navigate',
      routeUrl: '/pages/forge.html',
      isPlanned: false,
      color: '#38b8a5',
      glowRgb: '56, 184, 165'
    },
    meridian: {
      id: 'meridian',
      name: 'MERIDIAN',
      number: '05',
      eyebrow: 'INTELLIGENCE MODULE / 05',
      tag: 'Specialized Module · 05',
      category: 'Retail & Commercial Intelligence',
      env: 'Commercial & Cultural Spaces',
      side: 'right',
      subtitle: 'Contextual inventory and spatial awareness for commercial spaces.',
      desc: "MERIDIAN translates physical retail shelves, hospitality venues, and archival collections into continuous spatial memory. It verifies planogram compliance, identifies displaced merchandise, and preserves physical organization across high-traffic customer environments.",
      capabilities: [
        'Planogram compliance & shelf state tracking',
        'High-value artifact & archival cataloging',
        'Commercial spatial layout verification',
        'Temporal asset displacement detection'
      ],
      environments: [
        'Retail store shelves & display floors',
        'Restaurants & commercial culinary kitchens',
        'Hotels & hospitality suites',
        'Libraries, archives & special collections',
        'Museums, galleries & conservation spaces',
        'Commercial banks, vaults & secure deposit areas'
      ],
      relatedModules: ['forge', 'smriti'],
      status: 'COMMERCIAL PREVIEW',
      statusType: 'preview',
      metadata: [
        { label: 'ENVIRONMENT', value: 'Retail, Hospitality & Archives' },
        { label: 'PRECISION', value: 'Sub-Centimeter Spatial State' },
        { label: 'SYSTEM STATE', value: 'Active Evaluation' }
      ],
      actionText: 'Explore MERIDIAN Commercial Suite',
      actionType: 'navigate',
      routeUrl: '/pages/meridian.html',
      isPlanned: false,
      color: '#e8b75b',
      glowRgb: '232, 183, 91'
    },
    sentinel: {
      id: 'sentinel',
      name: 'SENTINEL',
      number: '06',
      eyebrow: 'INTELLIGENCE MODULE / 06',
      tag: 'Specialized Module · 06',
      category: 'Safety, Security & Forensics Intelligence',
      env: 'High-Integrity & Forensic Sites',
      side: 'right',
      subtitle: 'Traceability, accountability, and physical scene integrity.',
      desc: "SENTINEL provides uncompromised spatial chain-of-custody logging, hazardous site monitoring, and objective physical scene reconstruction. Engineered around evidence integrity and situational awareness rather than intrusive surveillance aesthetics.",
      capabilities: [
        'Chain-of-custody physical state logging',
        'Pre & post-incident spatial scene diffing',
        'Hazard perimeter & exclusion tracking',
        'Forensic spatial timeline reconstruction'
      ],
      environments: [
        'Evidence rooms & secure property vaults',
        'Courts & law enforcement custody facilities',
        'Fire investigation & insurance forensics sites',
        'Child safety & institutional care facilities',
        'Workplace safety & shop-floor perimeters',
        'Lone-worker monitoring zones',
        'Hazardous containment & chemical facilities'
      ],
      relatedModules: ['forge', 'aegis'],
      status: 'VERIFIED PROTOCOL',
      statusType: 'active',
      metadata: [
        { label: 'ENVIRONMENT', value: 'High-Integrity & Forensic Sites' },
        { label: 'INTEGRITY', value: 'Objective Spatial Ledger' },
        { label: 'SYSTEM STATE', value: 'Active Architecture' }
      ],
      actionText: 'Review SENTINEL Forensics Suite',
      actionType: 'navigate',
      routeUrl: '/pages/sentinel.html',
      isPlanned: false,
      color: '#ed6675',
      glowRgb: '237, 102, 117'
    },
    sense: {
      id: 'sense',
      name: 'SENSE',
      number: '07',
      eyebrow: 'INTELLIGENCE MODULE / 07',
      tag: 'Specialized Module · 07',
      category: 'Accessibility & Cognitive Support Intelligence',
      env: 'Supportive & Assisted Living Spaces',
      side: 'left',
      subtitle: 'Calm, empowering spatial assistance for cognitive and sensory needs.',
      desc: "SENSE delivers respectful, gentle spatial scaffolding for individuals navigating neurodivergence, memory fatigue, rehabilitation, or low vision. It quietly anchors daily physical routines and assists object recall without patronizing or intrusive interfaces.",
      capabilities: [
        'Low-friction spatial recall & item guidance',
        'Gentle cognitive routine anchoring',
        'Sensory zone contrast delineation',
        'Empowering contextual spatial prompts'
      ],
      environments: [
        'ADHD support & routine scaffolding',
        'Brain injury rehabilitation suites',
        'Stroke recovery & occupational therapy spaces',
        'Visual impairment navigation & tactile spaces',
        'Low-vision aging-in-place residential adaptations'
      ],
      relatedModules: ['smriti', 'aegis'],
      status: 'RESEARCH FRAMEWORK',
      statusType: 'active',
      metadata: [
        { label: 'ENVIRONMENT', value: 'Cognitive & Supportive Spaces' },
        { label: 'INTERACTION', value: 'Calm Ambient Scaffolding' },
        { label: 'SYSTEM STATE', value: 'Active Research' }
      ],
      actionText: 'Explore SENSE Accessibility Model',
      actionType: 'navigate',
      routeUrl: '/pages/sense.html',
      isPlanned: false,
      color: '#82b9a1',
      glowRgb: '130, 185, 161'
    }
  };
  // Developer alias: enable accessing PHANTOM_MODULES_DATA.disha without duplicating canonical module node
  Object.defineProperty(PHANTOM_MODULES_DATA, 'disha', {
    get: () => PHANTOM_MODULES_DATA.smriti,
    enumerable: false,
    configurable: true
  });

  // ----------------------------------------------------------------------------
  // CUBIC BEZIER EASING SOLVER: cubic-bezier(0.22, 1, 0.36, 1)
  // High-precision smooth animation curve for blob repositioning
  // ----------------------------------------------------------------------------
  function createCubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1;
    const bx = 3 * (x2 - x1) - cx;
    const ax = 1 - cx - bx;

    const cy = 3 * y1;
    const by = 3 * (y2 - y1) - cy;
    const ay = 1 - cy - by;

    function sampleX(t) { return ((ax * t + bx) * t + cx) * t; }
    function sampleY(t) { return ((ay * t + by) * t + cy) * t; }
    function sampleDerivX(t) { return (3 * ax * t + 2 * bx) * t + cx; }

    return function solve(x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const currentX = sampleX(t) - x;
        if (Math.abs(currentX) < 1e-5) break;
        const d = sampleDerivX(t);
        if (Math.abs(d) < 1e-5) break;
        t -= currentX / d;
      }
      return sampleY(Math.max(0, Math.min(1, t)));
    };
  }
  const phantomBezierEase = createCubicBezier(0.22, 1, 0.36, 1);

  // ----------------------------------------------------------------------------
  // 1. SIMPLEX NOISE GLSL SHADER DEFINITION
  // Ashima Arts 3D Simplex Noise for smooth, organic procedural fluid deformation
  // ----------------------------------------------------------------------------
  const SimplexNoiseGLSL = `
    vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
    vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

    float snoise(vec3 v) {
      const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
      const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

      vec3 i  = floor(v + dot(v, C.yyy));
      vec3 x0 = v - i + dot(i, C.xxx);

      vec3 g = step(x0.yzx, x0.xyz);
      vec3 l = 1.0 - g;
      vec3 i1 = min(g.xyz, l.zxy);
      vec3 i2 = max(g.xyz, l.zxy);

      vec3 x1 = x0 - i1 + 1.0 * C.xxx;
      vec3 x2 = x0 - i2 + 2.0 * C.xxx;
      vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

      i = mod(i, 289.0);
      vec4 p = permute(permute(permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0));

      float n_ = 0.142857142857;
      vec3  ns = n_ * D.wyz - D.xzx;

      vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

      vec4 x_ = floor(j * ns.z);
      vec4 y_ = floor(j - 7.0 * x_);

      vec4 x = x_ *ns.x + ns.yyyy;
      vec4 y = y_ *ns.x + ns.yyyy;
      vec4 h = 1.0 - abs(x) - abs(y);

      vec4 b0 = vec4(x.xy, y.xy);
      vec4 b1 = vec4(x.zw, y.zw);

      vec4 s0 = floor(b0) * 2.0 + 1.0;
      vec4 s1 = floor(b1) * 2.0 + 1.0;
      vec4 sh = -step(h, vec4(0.0));

      vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
      vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

      vec3 p0 = vec3(a0.xy, h.x);
      vec3 p1 = vec3(a0.zw, h.y);
      vec3 p2 = vec3(a1.xy, h.z);
      vec3 p3 = vec3(a1.zw, h.w);

      vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
      p0 *= norm.x;
      p1 *= norm.y;
      p2 *= norm.z;
      p3 *= norm.w;

      vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
      m = m * m;
      return 42.0 * dot(m * m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
    }
  `;

  // ----------------------------------------------------------------------------
  // 2. PHANTOM CORE EXPERIENCE CLASS
  // ----------------------------------------------------------------------------
  class PhantomCoreExperience {
    constructor() {
      this.isOpen = false;
      this.isStabilized = false;
      this.currentPhase = 0;
      this.activeNodeId = null;
      this.rafId = null;

      // Interaction coordinates
      this.mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.isDragging = false;
      this.previousMousePosition = { x: 0, y: 0 };

      // Three.js instances
      this.renderer = null;
      this.scene = null;
      this.camera = null;
      this.blobMesh = null;
      this.blobMaterial = null;
      const THREE = window.THREE;
      this.clock = new THREE.Clock();

      // Reactive color aura state & module signature colors (cute & glittery palette)
      this.defaultHighlightColor = new THREE.Color(0xffa8c8); // soft fairy rose-pink
      this.targetHighlightColor = new THREE.Color(0xffa8c8);
      this.defaultCoreColor = new THREE.Color(0xffd5e8); // strawberry-milk marshmallow
      this.moduleColors = {
        smriti: new THREE.Color(0xff9e7d), // warm peachy coral
        lumen: new THREE.Color(0xc9a4ff),  // magical lavender
        aegis: new THREE.Color(0x7edeff)   // sweet celestial cyan
      };

      // Cute Squish & Jelly Spring Physics State
      this.squish = { x: 1, y: 1, z: 1, vx: 0, vy: 0, vz: 0 };
      this.jiggle = 0;
      this.expression = 'normal'; // 'normal' | 'happy'
      this.happyTimer = 0;
      this.eyeBlink = {
        isBlinking: false,
        progress: 0,
        nextBlink: performance.now() + 3200
      };
      this.gaze = { x: 0, y: 0, targetX: 0, targetY: 0 };
      this.sparkleBursts = [];
      this.orbitSparkles = [];
      this.sparkleGroup = null;
      this.burstGroup = null;
      this.faceMesh = null;
      this.faceCanvas = null;
      this.faceCtx = null;
      this.faceTexture = null;
      this.crownStar = null;
      this.audioCtx = null;

      // Asymmetric detail state and blob movement
      this.isDetailOpen = false;
      this.selectedModuleId = null;
      this.selectedSide = null; // 'left' | 'right' | null
      this.currentBlobShiftX = 0;
      this.targetBlobShiftX = 0;
      this.currentBlobShiftY = 0;
      this.targetBlobShiftY = 0;
      this.currentBlobScale = 1.0;
      this.targetBlobScale = 1.0;

      // Smooth transition state
      this.isBlobTransitioning = false;
      this.blobTransitionStartTime = 0;
      this.blobTransitionDuration = 750; // ms
      this.blobStartShiftX = 0;
      this.blobStartShiftY = 0;
      this.blobStartScale = 1.0;

      // DOM Elements cache
      this.dom = {
        nodes: {},
        lines: {},
        pulses: {},
        auraGlows: {},
        mobilePills: {}
      };

      this.init();
    }

    init() {
      this.buildDOM();
      this.initThreeScene();
      this.initDustCanvas();
      this.bindEvents();
      this.checkReducedMotion();
    }

    // --------------------------------------------------------------------------
    // DOM CONSTRUCTION (Data-Driven Additive Architecture)
    // --------------------------------------------------------------------------
    buildDOM() {
      let root = document.getElementById('phantomExperienceRoot');
      if (!root) {
        root = document.createElement('div');
        root.id = 'phantomExperienceRoot';
        root.className = 'phantom-experience-root';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', 'PHANTOM Core Intelligence Ecosystem');

        // Dynamic construction of aura glows
        const moduleKeys = Object.keys(PHANTOM_MODULES_DATA);
        const auraHtml = moduleKeys
          .map((k) => `<div class="phantom-aura-glow aura-${k}" data-module="${k}"></div>`)
          .join('\n');

        // Dynamic construction of SVG filters & connector lines
        const filtersHtml = moduleKeys
          .map(
            (k) => `
            <filter id="glow${k.charAt(0).toUpperCase() + k.slice(1)}" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>`
          )
          .join('\n');

        const linesHtml = moduleKeys
          .map((k) => `<line id="line${k.charAt(0).toUpperCase() + k.slice(1)}" class="phantom-connector-line ${k}-connector" />`)
          .join('\n');

        const pulsesHtml = moduleKeys
          .map((k) => `<circle id="pulse${k.charAt(0).toUpperCase() + k.slice(1)}" class="phantom-pulse-dot" r="3" />`)
          .join('\n');

        // Dynamic construction of module nodes
        const nodesHtml = moduleKeys
          .map((k) => {
            const data = PHANTOM_MODULES_DATA[k];
            const alignClass = data.side === 'right' ? ' align-right' : '';
            return `
              <div class="phantom-module-node phantom-node-${k}${alignClass}" id="node${k.charAt(0).toUpperCase() + k.slice(1)}" data-module="${k}" role="button" tabindex="0" aria-label="Select ${data.name} — ${data.category}">
                <div class="phantom-node-pill">
                  <span class="phantom-node-beacon" aria-hidden="true"></span>
                  <div class="phantom-node-meta">
                    <span class="phantom-node-title">${data.name}</span>
                    <span class="phantom-node-subtitle">${data.category}</span>
                  </div>
                </div>
              </div>
            `;
          })
          .join('\n');

        // Dynamic switcher pills
        const switchPillsHtml = moduleKeys
          .map((k) => {
            const data = PHANTOM_MODULES_DATA[k];
            return `<button class="detail-switch-pill" data-switch="${k}" type="button">${data.name}</button>`;
          })
          .join('\n');

        // Mobile selector bar pills
        const mobileSelectorHtml = moduleKeys
          .map((k) => {
            const data = PHANTOM_MODULES_DATA[k];
            return `
              <button class="phantom-mobile-pill" data-module="${k}" type="button" style="--pill-color: ${data.color}; --pill-glow: rgba(${data.glowRgb}, 0.35);">
                <span class="phantom-mobile-beacon" style="background: ${data.color};"></span>
                <span>${data.name}</span>
              </button>
            `;
          })
          .join('\n');

        root.innerHTML = `
          <div class="phantom-transition-backdrop" id="phantomBackdrop"></div>
          <div class="phantom-collapse-warp" id="phantomWarp"></div>
          <canvas class="phantom-dust-canvas" id="phantomDustCanvas"></canvas>

          <!-- BACKGROUND LAYER: Reactive Color Aura (Behind SVG Lines & Central Blob) -->
          <div class="phantom-reactive-aura" id="phantomReactiveAura" aria-hidden="true">
            <div class="phantom-aura-glow aura-default is-active" data-module="default"></div>
            ${auraHtml}
          </div>

          <!-- CONNECTION LAYER: Dotted Constellation Lines (Behind Central Blob with Occlusion Mask) -->
          <svg class="phantom-constellation-svg" id="phantomConstellationSvg" aria-hidden="true">
            <defs>
              <mask id="blobOcclusionMask">
                <rect width="100%" height="100%" fill="white" />
                <circle id="maskBlobCircle" cx="0" cy="0" r="180" fill="black" />
              </mask>
              ${filtersHtml}
            </defs>
            <g id="phantomConnectionsGroup" mask="url(#blobOcclusionMask)">
              ${linesHtml}
              ${pulsesHtml}
            </g>
          </svg>

          <!-- CENTRAL BLOB LAYER: 3D WebGL Hero Canvas -->
          <div class="phantom-canvas-container" id="phantomCanvasContainer">
            <canvas class="phantom-webgl-canvas" id="phantomWebglCanvas"></canvas>
          </div>

          <!-- Interactive Cute Poke Hint -->
          <div class="phantom-poke-hint" id="phantomPokeHint" aria-hidden="true">
            <span class="poke-sparkle">✦</span> poke to squish &amp; sparkle <span class="poke-sparkle">✦</span>
          </div>

          <!-- ADAPTIVE INTELLIGENCE INFORMATION PANEL (LEFT OR RIGHT SIDE) -->
          <aside class="phantom-detail-panel panel-side-left" id="phantomDetailPanel" aria-label="Module Detail">
            <div class="phantom-detail-content">
              <!-- Top Controls Row -->
              <div class="phantom-detail-topbar phantom-detail-stagger">
                <div class="phantom-detail-eyebrow-wrap">
                  <span class="detail-eyebrow-dot" id="detailEyebrowDot" aria-hidden="true"></span>
                  <span class="phantom-detail-eyebrow" id="detailEyebrow">INTELLIGENCE MODULE / 01</span>
                </div>
                <button class="phantom-detail-close-btn" id="btnDetailClose" type="button" aria-label="Close intelligence details">
                  <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="2" y1="2" x2="12" y2="12"></line><line x1="12" y1="2" x2="2" y2="12"></line></svg>
                </button>
              </div>

              <!-- Header Row: Title & Status Badge -->
              <div class="phantom-detail-header-row phantom-detail-stagger">
                <h2 class="phantom-detail-name" id="detailName">SMRITI</h2>
                <div class="phantom-detail-status-badge" id="detailStatusBadge">
                  <span class="status-pulse-dot" id="detailStatusDot"></span>
                  <span class="status-badge-text" id="detailStatusText">ACTIVE</span>
                </div>
              </div>

              <!-- Subtitle -->
              <p class="phantom-detail-subtitle phantom-detail-stagger" id="detailSubtitle">Your environment, understood.</p>

              <!-- Detailed Description -->
              <div class="phantom-detail-desc-wrap phantom-detail-stagger">
                <p class="phantom-detail-desc" id="detailDesc"></p>
              </div>

              <!-- Capabilities Section -->
              <div class="phantom-detail-capabilities phantom-detail-stagger" id="detailCapabilitiesSection">
                <span class="capabilities-title">CORE CAPABILITIES</span>
                <ul class="capabilities-list" id="detailCapabilitiesList"></ul>
              </div>

              <!-- Supported Environments / Application Domains Section -->
              <div class="phantom-detail-environments phantom-detail-stagger" id="detailEnvironmentsSection">
                <span class="environments-title">APPLICATION DOMAINS &amp; ENVIRONMENTS</span>
                <div class="environments-tags" id="detailEnvironmentsTags"></div>
              </div>

              <!-- Small Metadata Row -->
              <div class="phantom-detail-meta-grid phantom-detail-stagger" id="detailMetaGrid"></div>

              <!-- Related Intelligence Synergy -->
              <div class="phantom-detail-related phantom-detail-stagger" id="detailRelatedSection">
                <span class="related-title">SHARED INTELLIGENCE SYNERGY</span>
                <div class="related-pills" id="detailRelatedPills"></div>
              </div>

              <!-- Quick-Switch Intelligence Suite Rail -->
              <div class="phantom-detail-module-switch phantom-detail-stagger" id="detailModuleSwitch" aria-label="Switch Intelligence">
                <span class="detail-switch-label">INTELLIGENCE SUITE</span>
                <div class="detail-switch-pills">
                  ${switchPillsHtml}
                </div>
              </div>

              <!-- Action & Return Controls -->
              <div class="phantom-detail-actions phantom-detail-stagger">
                <button class="phantom-detail-action-btn" id="btnDetailPrimaryAction" type="button">
                  <span id="detailActionText">Explore SMRITI Experience</span>
                  <span class="action-arrow" aria-hidden="true">→</span>
                </button>
                <button class="phantom-detail-back-link" id="btnDetailBack" type="button">
                  <span>← Back to Architecture</span>
                  <kbd>[ESC]</kbd>
                </button>
              </div>
            </div>
          </aside>

          <div class="phantom-center-anchor" id="phantomCenterAnchor">
            <div class="phantom-core-eyebrow">Spatial Intelligence Layer</div>
            <h1 class="phantom-core-title">PHANTOM</h1>
            <p class="phantom-core-desc">Core Intelligence Architecture</p>
          </div>

          <!-- All Seven Constellation Nodes -->
          <div class="phantom-nodes-container" id="phantomNodesContainer">
            ${nodesHtml}
          </div>

          <!-- Mobile Quick Selector Bar -->
          <div class="phantom-mobile-nav-bar" id="phantomMobileNavBar" aria-label="Select Intelligence Module">
            ${mobileSelectorHtml}
          </div>

          <div class="phantom-ui-layer" id="phantomUiLayer">
            <div class="phantom-header-bar">
              <button class="phantom-return-btn" id="btnPhantomReturn" type="button" aria-label="Return to SMRITI website">
                <span class="phantom-return-arrow" aria-hidden="true">←</span>
                <span>Return to SMRITI</span>
                <span class="phantom-return-tag">[ESC]</span>
              </button>
              <div style="display: flex; align-items: center; gap: 12px;">
                <a href="/pages/workspace.html" class="phantom-workspace-nav-btn" style="display: inline-flex; align-items: center; gap: 8px; background: rgba(240, 123, 66, 0.15); border: 1px solid rgba(240, 123, 66, 0.5); border-radius: 9999px; padding: 6px 16px; color: #f2f4f8; font-size: 12.5px; font-weight: 500; text-decoration: none; transition: all 0.2s ease;">
                  <span style="color: #f07b42;">✦</span>
                  <span>Launch Table Workspace</span>
                  <span style="font-size: 11px; opacity: 0.8;">→</span>
                </a>
                <div class="phantom-telemetry-badge">
                  <span class="phantom-live-indicator" aria-hidden="true"></span>
                  <span class="phantom-status-text">CORE ONLINE</span>
                  <span class="phantom-telemetry-divider" aria-hidden="true"></span>
                  <span>7 ACTIVE MODULES</span>
                </div>
              </div>
            </div>

            <div class="phantom-bottom-bar">
              <span class="phantom-esc-hint">Press <kbd>ESC</kbd> or click Return to exit</span>
              <span class="phantom-active-count">PHANTOM <strong>KERNEL 2.0</strong> · SPATIAL MATRIX</span>
            </div>
          </div>
        `;

        document.body.appendChild(root);
      }

      // Cache DOM references
      this.dom.root = root;
      this.dom.backdrop = root.querySelector('#phantomBackdrop');
      this.dom.warp = root.querySelector('#phantomWarp');
      this.dom.canvasContainer = root.querySelector('#phantomCanvasContainer');
      this.dom.webglCanvas = root.querySelector('#phantomWebglCanvas');
      this.dom.dustCanvas = root.querySelector('#phantomDustCanvas');
      this.dom.svg = root.querySelector('#phantomConstellationSvg');
      this.dom.maskBlobCircle = root.querySelector('#maskBlobCircle');
      this.dom.aura = root.querySelector('#phantomReactiveAura');
      this.dom.auraGlows = {
        default: root.querySelector('.phantom-aura-glow.aura-default'),
        smriti: root.querySelector('.phantom-aura-glow.aura-smriti'),
        lumen: root.querySelector('.phantom-aura-glow.aura-lumen'),
        aegis: root.querySelector('.phantom-aura-glow.aura-aegis')
      };
      this.dom.pokeHint = root.querySelector('#phantomPokeHint');
      this.dom.returnBtn = root.querySelector('#btnPhantomReturn');
      this.dom.centerAnchor = root.querySelector('#phantomCenterAnchor');

      // Detail Panel references
      this.dom.detailPanel = root.querySelector('#phantomDetailPanel');
      this.dom.detailEyebrow = root.querySelector('#detailEyebrow');
      this.dom.detailEyebrowDot = root.querySelector('#detailEyebrowDot');
      this.dom.btnDetailClose = root.querySelector('#btnDetailClose');
      this.dom.detailName = root.querySelector('#detailName');
      this.dom.detailStatusBadge = root.querySelector('#detailStatusBadge');
      this.dom.detailStatusDot = root.querySelector('#detailStatusDot');
      this.dom.detailStatusText = root.querySelector('#detailStatusText');
      this.dom.detailSubtitle = root.querySelector('#detailSubtitle');
      this.dom.detailDesc = root.querySelector('#detailDesc');
      this.dom.detailCapabilitiesList = root.querySelector('#detailCapabilitiesList');
      this.dom.detailEnvironmentsTags = root.querySelector('#detailEnvironmentsTags');
      this.dom.detailMetaGrid = root.querySelector('#detailMetaGrid');
      this.dom.detailRelatedPills = root.querySelector('#detailRelatedPills');
      this.dom.btnDetailBack = root.querySelector('#btnDetailBack');
      this.dom.btnDetailPrimaryAction = root.querySelector('#btnDetailPrimaryAction');
      this.dom.detailActionText = root.querySelector('#detailActionText');
      this.dom.detailSwitchPills = root.querySelectorAll('.detail-switch-pill');

      // Cache modules
      Object.keys(PHANTOM_MODULES_DATA).forEach((key) => {
        const capitalized = key.charAt(0).toUpperCase() + key.slice(1);
        this.dom.nodes[key] = root.querySelector(`#node${capitalized}`);
        this.dom.lines[key] = root.querySelector(`#line${capitalized}`);
        this.dom.pulses[key] = root.querySelector(`#pulse${capitalized}`);
        this.dom.auraGlows[key] = root.querySelector(`.phantom-aura-glow.aura-${key}`);
        this.dom.mobilePills[key] = root.querySelector(`.phantom-mobile-pill[data-module="${key}"]`);
      });
    }

    // --------------------------------------------------------------------------
    // THREE.JS PROCEDURAL FLUID ORGANIC SHADER
    // Glossy obsidian fluid body with Blinn-Phong specular & luminous Fresnel rim
    // --------------------------------------------------------------------------
    initThreeScene() {
      const THREE = window.THREE;
      const canvas = this.dom.webglCanvas;
      const width = window.innerWidth;
      const height = window.innerHeight;

      // Renderer
      this.renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.setClearColor(0x000000, 0);

      // Scene & Camera
      this.scene = new THREE.Scene();
      const aspect = width / height;
      this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
      const isNarrow = width < 420;
      const isMobile = width < 640;
      const initialZ = aspect < 0.75 ? Math.min(10.2, 7.2 * (0.75 / aspect)) : 7.2;
      this.camera.position.set(0, 0, initialZ);
      this.targetBlobScale = isNarrow ? 0.62 : (isMobile ? 0.72 : 1.0);

      // Organic Fluid Blob Geometry (Subdivided Sphere)
      const geometry = new THREE.IcosahedronGeometry(1.52, 52);

      // Custom Shader Material mimicking Spline "Black Animated AI Blobs"
      this.blobMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDeformSpeed: { value: 0.30 },
          uDeformIntensity: { value: 0.35 },
          uExpansion: { value: 1.0 },
          uRimAlpha: { value: 0.95 },
          uHighlightColor: { value: new THREE.Color(0xf07b42) },
          uCoreColor: { value: new THREE.Color(0x060709) },
          uEnergyPulse: { value: 0.0 }
        },
        vertexShader: `
          uniform float uTime;
          uniform float uDeformSpeed;
          uniform float uDeformIntensity;
          uniform float uExpansion;
          uniform float uEnergyPulse;

          varying vec3 vNormal;
          varying vec3 vViewPosition;
          varying vec3 vWorldPosition;
          varying float vDisplacement;

          ${SimplexNoiseGLSL}

          float getDisplacement(vec3 p) {
            float t = uTime * uDeformSpeed;
            float n1 = snoise(p * 0.95 + vec3(t * 0.45, t * 0.35, t * 0.25));
            float n2 = snoise(p * 1.9 - vec3(t * 0.25, t * 0.5, t * 0.35)) * 0.42;
            float n3 = snoise(p * 3.4 + vec3(t * 0.7, -t * 0.4, t * 0.5)) * 0.16;
            return (n1 + n2 + n3) * (uDeformIntensity + uEnergyPulse * 0.2);
          }

          void main() {
            vec3 p = position;
            float totalNoise = getDisplacement(p);
            vDisplacement = totalNoise;

            // Displace vertex outward along normal
            vec3 displacedPosition = p * uExpansion + normal * (totalNoise * uExpansion);

            // True surface normal via spatial displacement gradient (never inverts)
            float eps = 0.02;
            vec3 grad = vec3(
              getDisplacement(p + vec3(eps, 0.0, 0.0)) - getDisplacement(p - vec3(eps, 0.0, 0.0)),
              getDisplacement(p + vec3(0.0, eps, 0.0)) - getDisplacement(p - vec3(0.0, eps, 0.0)),
              getDisplacement(p + vec3(0.0, 0.0, eps)) - getDisplacement(p - vec3(0.0, 0.0, eps))
            ) / (2.0 * eps);

            vec3 displacedNormal = normalize(normal - grad * 0.6);
            vNormal = normalize(normalMatrix * displacedNormal);

            vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
            vViewPosition = -mvPosition.xyz;
            vWorldPosition = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;

            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform float uRimAlpha;
          uniform vec3 uHighlightColor;
          uniform vec3 uCoreColor;
          uniform float uEnergyPulse;

          varying vec3 vNormal;
          varying vec3 vViewPosition;
          varying vec3 vWorldPosition;
          varying float vDisplacement;

          void main() {
            vec3 norm = normalize(vNormal);
            vec3 viewDir = normalize(vViewPosition);

            // 1. Deep glossy obsidian body (Spline "Black Animated AI Blobs")
            vec3 baseColor = uCoreColor;

            // 2. Specular Blinn-Phong highlights on liquid ripples
            vec3 lightDir1 = normalize(vec3(0.4, 0.7, 0.75));
            vec3 halfDir1 = normalize(lightDir1 + viewDir);
            float spec1 = pow(max(dot(norm, halfDir1), 0.0), 38.0) * 0.48;

            vec3 lightDir2 = normalize(vec3(-0.6, -0.4, 0.5));
            vec3 halfDir2 = normalize(lightDir2 + viewDir);
            float spec2 = pow(max(dot(norm, halfDir2), 0.0), 22.0) * 0.22;

            // 3. Razor-thin luminous Fresnel edge rim with glowing molten falloff
            float NdotV = clamp(dot(norm, viewDir), 0.0, 1.0);
            float fresnelFactor = pow(1.0 - NdotV, 4.2);
            float moltenSpread = pow(1.0 - NdotV, 6.5) * 0.55;
            vec3 rimColor = uHighlightColor * ((fresnelFactor + moltenSpread) * uRimAlpha * 1.4);

            // 4. Subtle fluid depth sheen
            float rippleSheen = clamp(vDisplacement * 0.5 + 0.5, 0.0, 1.0) * 0.025;
            baseColor += vec3(0.03, 0.04, 0.06) * rippleSheen;

            // 5. Compose full material
            vec3 finalColor = baseColor + (vec3(0.9, 0.95, 1.0) * (spec1 + spec2)) + rimColor;

            // Energetic pulse glow when user hovers or selects nodes
            finalColor += uHighlightColor * (uEnergyPulse * fresnelFactor * 0.9);

            gl_FragColor = vec4(finalColor, 1.0);
          }
        `,
        transparent: false,
        depthWrite: true,
        depthTest: true
      });

      this.blobMesh = new THREE.Mesh(geometry, this.blobMaterial);
      this.blobMesh.position.set(0, -0.20, 0);
      this.scene.add(this.blobMesh);

      // Initial state: fully formed blob ready for immediate first frame rendering
      this.blobMaterial.uniforms.uExpansion.value = 1.0;
      this.blobMaterial.uniforms.uRimAlpha.value = 0.95;
    }

    // --------------------------------------------------------------------------
    // ATMOSPHERIC BACKGROUND PARTICLES (Slow-drifting void stardust)
    // --------------------------------------------------------------------------
    initDustCanvas() {
      const canvas = this.dom.dustCanvas;
      const ctx = canvas.getContext('2d');
      let width = (canvas.width = window.innerWidth);
      let height = (canvas.height = window.innerHeight);

      const particles = [];
      const particleCount = 48;

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          radius: Math.random() * 1.4 + 0.6,
          speedX: (Math.random() - 0.5) * 0.18,
          speedY: (Math.random() - 0.5) * 0.18,
          alpha: Math.random() * 0.5 + 0.2,
          pulse: Math.random() * Math.PI * 2
        });
      }

      this.drawDust = () => {
        if (!this.isOpen) return;
        ctx.clearRect(0, 0, width, height);

        particles.forEach((p) => {
          p.x += p.speedX;
          p.y += p.speedY;
          p.pulse += 0.015;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          const currentAlpha = p.alpha * (0.6 + Math.sin(p.pulse) * 0.4);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${currentAlpha * 0.4})`;
          ctx.fill();
        });
      };

      window.addEventListener('resize', () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
      });
    }

    // --------------------------------------------------------------------------
    // SPATIAL CONSTELLATION NODE POSITIONING & SVG DYNAMICS
    // --------------------------------------------------------------------------
    layoutConstellation() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const isMobile = w < 768;
      const isTablet = w >= 768 && w < 1024;

      let positions = {};

      if (!this.isDetailOpen) {
        // Balanced Overview Constellation (Surrounding Centered Blob)
        // SMRITI: upper-left, LUMEN: lower-left, AEGIS: lower-right
        if (isMobile) {
          positions = {
            smriti: { x: w * 0.50, y: h * 0.23 },
            lumen: { x: w * 0.24, y: h * 0.78 },
            aegis: { x: w * 0.76, y: h * 0.78 }
          };
        } else if (isTablet) {
          positions = {
            smriti: { x: w * 0.20, y: h * 0.26 },
            lumen: { x: w * 0.22, y: h * 0.78 },
            aegis: { x: w * 0.80, y: h * 0.50 }
          };
        } else {
          // Desktop Overview: Harmonic 7-point constellation around central anchor
          positions = {
            smriti:   { x: w * 0.20, y: h * 0.31 },
            forge:    { x: w * 0.13, y: h * 0.52 },
            lumen:    { x: w * 0.20, y: h * 0.72 },
            sense:    { x: w * 0.50, y: h * 0.86 },
            sentinel: { x: w * 0.80, y: h * 0.72 },
            meridian: { x: w * 0.87, y: h * 0.52 },
            aegis:    { x: w * 0.80, y: h * 0.31 }
          };
        }
      } else if (this.selectedSide === 'left') {
        // Detail Mode: Panel on LEFT, Blob Shifted RIGHT
        const sel = this.selectedModuleId;
        if (isMobile) {
          positions = {
            smriti: { x: w * 0.20, y: h * 0.12 },
            lumen: { x: w * 0.50, y: h * 0.12 },
            aegis: { x: w * 0.80, y: h * 0.12 }
          };
        } else {
          // Desktop detail mode:
          // Selected node is placed prominently between panel and shifted blob (x: 0.46, y: 0.38)
          // Other nodes distribute in open space around the shifted blob
          positions = {
            smriti:   sel === 'smriti'   ? { x: w * 0.46, y: h * 0.38 } : { x: w * 0.68, y: h * 0.22 },
            forge:    sel === 'forge'    ? { x: w * 0.46, y: h * 0.38 } : { x: w * 0.46, y: h * 0.56 },
            lumen:    sel === 'lumen'    ? { x: w * 0.46, y: h * 0.38 } : { x: w * 0.50, y: h * 0.76 },
            sense:    sel === 'sense'    ? { x: w * 0.46, y: h * 0.38 } : { x: w * 0.68, y: h * 0.86 },
            sentinel: sel === 'sentinel' ? { x: w * 0.46, y: h * 0.38 } : { x: w * 0.86, y: h * 0.72 },
            meridian: sel === 'meridian' ? { x: w * 0.46, y: h * 0.38 } : { x: w * 0.90, y: h * 0.52 },
            aegis:    sel === 'aegis'    ? { x: w * 0.46, y: h * 0.38 } : { x: w * 0.86, y: h * 0.31 }
          };
        }
      } else {
        // Detail Mode: Panel on RIGHT, Blob Shifted LEFT
        const sel = this.selectedModuleId;
        if (isMobile) {
          positions = {
            smriti: { x: w * 0.20, y: h * 0.12 },
            lumen: { x: w * 0.50, y: h * 0.12 },
            aegis: { x: w * 0.80, y: h * 0.12 }
          };
        } else {
          // Desktop detail mode:
          // Selected node is placed prominently between shifted blob and panel (x: 0.54, y: 0.38)
          // Other nodes distribute in open space around the shifted blob
          positions = {
            smriti:   sel === 'smriti'   ? { x: w * 0.54, y: h * 0.38 } : { x: w * 0.14, y: h * 0.31 },
            forge:    sel === 'forge'    ? { x: w * 0.54, y: h * 0.38 } : { x: w * 0.10, y: h * 0.52 },
            lumen:    sel === 'lumen'    ? { x: w * 0.54, y: h * 0.38 } : { x: w * 0.14, y: h * 0.72 },
            sense:    sel === 'sense'    ? { x: w * 0.54, y: h * 0.38 } : { x: w * 0.32, y: h * 0.86 },
            sentinel: sel === 'sentinel' ? { x: w * 0.54, y: h * 0.38 } : { x: w * 0.50, y: h * 0.76 },
            meridian: sel === 'meridian' ? { x: w * 0.54, y: h * 0.38 } : { x: w * 0.54, y: h * 0.56 },
            aegis:    sel === 'aegis'    ? { x: w * 0.54, y: h * 0.38 } : { x: w * 0.32, y: h * 0.22 }
          };
        }
      }

      // Position DOM nodes smoothly
      Object.keys(positions).forEach((key) => {
        const node = this.dom.nodes[key];
        const pos = positions[key];
        if (node && pos) {
          node.style.left = `${pos.x}px`;
          node.style.top = `${pos.y}px`;
        }
      });

      this.nodePositions = positions;
      this.updateDynamicConnections();
    }

    // --------------------------------------------------------------------------
    // DYNAMIC CONNECTION GEOMETRY & OCCLUSION MASK
    // Calculates actual projected blob coordinates and keeps lines behind the blob
    // --------------------------------------------------------------------------
    updateDynamicConnections() {
      if (!this.blobMesh || !this.camera) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      if (!w || !h) return;
      const THREE = window.THREE;

      // Project 3D blob center into 2D viewport coordinates
      const blobPos = new THREE.Vector3();
      this.blobMesh.getWorldPosition(blobPos);
      blobPos.project(this.camera);

      const centerX = (blobPos.x * 0.5 + 0.5) * w;
      const centerY = (-blobPos.y * 0.5 + 0.5) * h;
      if (!isFinite(centerX) || !isFinite(centerY)) return;
      this.centerCoords = { x: centerX, y: centerY };

      // Keep reactive aura centered directly behind the 3D blob even when shifted
      if (this.dom.aura) {
        this.dom.aura.style.left = `${centerX}px`;
        this.dom.aura.style.top = `${centerY}px`;
      }

      // Update SVG occlusion mask circle: physically hides line segments within the blob silhouette
      if (this.dom.maskBlobCircle) {
        this.dom.maskBlobCircle.setAttribute('cx', centerX);
        this.dom.maskBlobCircle.setAttribute('cy', centerY);
        const scale = isFinite(this.currentBlobScale) ? this.currentBlobScale : 1.0;
        const visualRadius = (1.40 * scale / 5.964) * h;
        const radius = isFinite(visualRadius) ? Math.max(visualRadius, 20) : 180;
        this.dom.maskBlobCircle.setAttribute('r', radius);
      }

      // Update SVG connector lines: originate from module nodes and terminate behind the central blob
      if (this.nodePositions) {
        Object.keys(this.nodePositions).forEach((key) => {
          const line = this.dom.lines[key];
          const pos = this.nodePositions[key];
          if (line && pos && isFinite(pos.x) && isFinite(pos.y) && isFinite(centerX) && isFinite(centerY)) {
            line.setAttribute('x1', pos.x);
            line.setAttribute('y1', pos.y);
            line.setAttribute('x2', centerX);
            line.setAttribute('y2', centerY);
          }
        });
      }
    }

    // --------------------------------------------------------------------------
    // ASYMMETRIC MODULE SELECTION (DETAIL VIEW)
    // --------------------------------------------------------------------------
    selectModule(id) {
      const data = PHANTOM_MODULES_DATA[id];
      if (!data) return;

      // Toggle behavior: re-clicking the active node returns to overview
      if (this.isDetailOpen && this.selectedModuleId === id) {
        this.deselectModule();
        return;
      }

      this.selectedModuleId = id;
      this.isDetailOpen = true;
      this.selectedSide = data.side || 'left';

      // Sync URL hash state for bookmarkable routes
      try {
        if (window.location.hash !== '#' + id) {
          window.history.replaceState(null, '', '#' + id);
        }
      } catch (e) {}

      // Adaptive Blob Positioning:
      // Left-side nodes (SMRITI, FORGE, LUMEN, SENSE): move blob toward right half of screen
      // Right-side nodes (AEGIS, MERIDIAN, SENTINEL): move blob toward left half of screen
      const w = window.innerWidth;
      const isDesktop = w >= 1024;
      const isTablet = w >= 768 && w < 1024;

      if (isDesktop) {
        this.targetBlobShiftX = this.selectedSide === 'left' ? 2.05 : -2.05;
        this.targetBlobScale = 0.80;
      } else if (isTablet) {
        this.targetBlobShiftX = this.selectedSide === 'left' ? 1.55 : -1.55;
        this.targetBlobScale = 0.76;
      } else {
        this.targetBlobShiftX = 0;
        this.targetBlobScale = 0.62;
      }

      // Smooth continuous transition with cubic-bezier(0.22, 1, 0.36, 1)
      this.blobStartShiftX = this.currentBlobShiftX;
      this.blobStartScale = this.currentBlobScale;
      this.blobTransitionStartTime = performance.now();
      this.blobTransitionDuration = 750; // ms
      this.isBlobTransitioning = true;

      // Update adaptive side classes on detail panel
      if (this.dom.detailPanel) {
        this.dom.detailPanel.classList.toggle('panel-side-left', this.selectedSide === 'left');
        this.dom.detailPanel.classList.toggle('panel-side-right', this.selectedSide === 'right');
      }

      // Populate detail panel content with all required information
      this.updateDetailPanelContent(data);

      // Activate detail state in DOM (triggers CSS panel entrance and staggered animations)
      this.dom.root.classList.add('is-detail-active');

      // Selection feedback: highlight clicked node (scale 1.04, glow) and dim non-selected nodes
      Object.keys(this.dom.nodes).forEach((key) => {
        const node = this.dom.nodes[key];
        const line = this.dom.lines[key];
        const pill = this.dom.mobilePills[key];

        if (key === id) {
          node?.classList.add('is-selected');
          node?.style.setProperty('--active-node-color', data.color);
          node?.style.setProperty('--active-node-glow', `rgba(${data.glowRgb}, 0.4)`);
          line?.classList.add('is-selected');
          pill?.classList.add('is-active');
        } else {
          node?.classList.remove('is-selected');
          line?.classList.remove('is-selected');
          pill?.classList.remove('is-active');
        }
      });

      // Update reactive aura behind shifted 3D blob
      if (this.dom.auraGlows) {
        Object.keys(this.dom.auraGlows).forEach((mKey) => {
          if (mKey === id) {
            this.dom.auraGlows[mKey]?.classList.add('is-active');
          } else {
            this.dom.auraGlows[mKey]?.classList.remove('is-active');
          }
        });
      }

      // Transition blob shader rim highlight towards module accent & send energetic pulse
      if (this.moduleColors[id]) {
        this.targetHighlightColor = this.moduleColors[id];
        if (this.blobMaterial) {
          this.blobMaterial.uniforms.uEnergyPulse.value = 0.55;
        }
      }

      // Update switcher rail active indicator
      const pills = (this.dom.detailSwitchPills && this.dom.detailSwitchPills.length > 0)
        ? this.dom.detailSwitchPills
        : this.dom.root?.querySelectorAll('.detail-switch-pill');
      if (pills) {
        pills.forEach((p) => {
          const isActive = p.getAttribute('data-switch') === id;
          p.classList.toggle('is-active', isActive);
          if (isActive) {
            p.style.borderColor = data.color;
            p.style.color = '#ffffff';
            p.style.boxShadow = `0 0 12px rgba(${data.glowRgb}, 0.3)`;
          } else {
            p.style.borderColor = '';
            p.style.color = '';
            p.style.boxShadow = '';
          }
        });
      }

      // Smoothly update constellation node positions
      this.layoutConstellation();
    }

    // --------------------------------------------------------------------------
    // RETURN TO OVERVIEW
    // --------------------------------------------------------------------------
    deselectModule() {
      if (!this.isDetailOpen) return;

      this.isDetailOpen = false;
      this.selectedModuleId = null;
      this.selectedSide = null;

      // Clear module hash from URL
      try {
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      } catch (e) {}

      // Smoothly return blob to centered overview position and scale (cubic-bezier)
      this.targetBlobShiftX = 0;
      const _w = window.innerWidth;
      this.targetBlobScale = _w < 420 ? 0.62 : (_w < 640 ? 0.72 : (_w < 1024 ? 0.85 : 1.0));
      this.blobStartShiftX = this.currentBlobShiftX;
      this.blobStartScale = this.currentBlobScale;
      this.blobTransitionStartTime = performance.now();
      this.blobTransitionDuration = 750;
      this.isBlobTransitioning = true;

      // Deactivate panel state in DOM
      this.dom.root.classList.remove('is-detail-active');

      // Clear selection classes and restore all nodes to full overview prominence
      Object.keys(this.dom.nodes).forEach((key) => {
        this.dom.nodes[key]?.classList.remove('is-selected');
        this.dom.lines[key]?.classList.remove('is-selected');
        this.dom.mobilePills[key]?.classList.remove('is-active');
      });

      // Restore neutral molten aura & highlight
      if (this.dom.auraGlows) {
        Object.values(this.dom.auraGlows).forEach((glow) => glow?.classList.remove('is-active'));
      }
      this.targetHighlightColor = this.defaultHighlightColor;
      if (this.blobMaterial) {
        this.blobMaterial.uniforms.uEnergyPulse.value = 0.0;
      }

      // Smoothly restore balanced constellation node layout
      this.layoutConstellation();
    }

    // --------------------------------------------------------------------------
    // POPULATE DETAIL PANEL DATA
    // --------------------------------------------------------------------------
    updateDetailPanelContent(data) {
      if (!data) return;

      if (this.dom.detailEyebrow) this.dom.detailEyebrow.textContent = data.eyebrow;
      if (this.dom.detailEyebrowDot) this.dom.detailEyebrowDot.style.background = data.color;
      if (this.dom.detailName) this.dom.detailName.textContent = data.name;
      if (this.dom.detailSubtitle) this.dom.detailSubtitle.textContent = data.subtitle;
      if (this.dom.detailDesc) this.dom.detailDesc.textContent = data.desc;

      if (this.dom.detailStatusBadge && this.dom.detailStatusText && this.dom.detailStatusDot) {
        this.dom.detailStatusText.textContent = data.status;
        this.dom.detailStatusDot.style.background = data.color;
        this.dom.detailStatusDot.style.boxShadow = `0 0 10px ${data.color}`;
        this.dom.detailStatusBadge.style.borderColor = `rgba(${data.glowRgb}, 0.28)`;
        this.dom.detailStatusBadge.style.color = data.color;
      }

      // Core Capabilities (4 clear bullet items)
      if (this.dom.detailCapabilitiesList) {
        this.dom.detailCapabilitiesList.innerHTML = (data.capabilities || [])
          .map(
            (cap) => `
            <li class="capability-item">
              <span class="capability-icon" style="color: ${data.color};" aria-hidden="true">✦</span>
              <span class="capability-text">${cap}</span>
            </li>
          `
          )
          .join('');
      }

      // Application Domains & Environments Tag Cloud (All concrete use cases)
      if (this.dom.detailEnvironmentsTags) {
        this.dom.detailEnvironmentsTags.innerHTML = (data.environments || [])
          .map(
            (env) => `
            <span class="env-tag">
              <span class="env-tag-dot" style="background: ${data.color};"></span>
              <span>${env}</span>
            </span>
          `
          )
          .join('');
      }

      // Metadata Grid
      if (this.dom.detailMetaGrid) {
        this.dom.detailMetaGrid.innerHTML = (data.metadata || [])
          .map(
            (m) => `
            <div class="meta-item">
              <span class="meta-label">${m.label}</span>
              <span class="meta-val">${m.value}</span>
            </div>
          `
          )
          .join('');
      }

      // Related Intelligence Synergy Pills
      if (this.dom.detailRelatedPills) {
        this.dom.detailRelatedPills.innerHTML = (data.relatedModules || [])
          .map((relKey) => {
            const relData = PHANTOM_MODULES_DATA[relKey];
            if (!relData) return '';
            return `
              <button class="related-pill" data-related="${relKey}" type="button">
                <span class="related-pill-dot" style="background: ${relData.color};"></span>
                <span>${relData.name} — ${relData.category}</span>
              </button>
            `;
          })
          .join('');

        // Attach event listeners to related pills
        this.dom.detailRelatedPills.querySelectorAll('.related-pill').forEach((btn) => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetModule = btn.getAttribute('data-related');
            if (targetModule) {
              this.selectModule(targetModule);
            }
          });
        });
      }

      if (this.dom.detailPanel) {
        this.dom.detailPanel.style.setProperty('--active-module-color', data.color);
        this.dom.detailPanel.style.setProperty('--active-module-glow', `rgba(${data.glowRgb}, 0.35)`);
      }

      // Primary Action CTA
      if (this.dom.btnDetailPrimaryAction && this.dom.detailActionText) {
        this.dom.detailActionText.textContent = data.actionText;
        if (data.isPlanned) {
          this.dom.btnDetailPrimaryAction.classList.add('is-disabled');
          this.dom.btnDetailPrimaryAction.setAttribute('disabled', 'true');
          this.dom.btnDetailPrimaryAction.setAttribute('aria-disabled', 'true');
          this.dom.btnDetailPrimaryAction.style.background = 'rgba(255, 255, 255, 0.05)';
          this.dom.btnDetailPrimaryAction.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          this.dom.btnDetailPrimaryAction.style.color = '#788292';
        } else {
          this.dom.btnDetailPrimaryAction.classList.remove('is-disabled');
          this.dom.btnDetailPrimaryAction.removeAttribute('disabled');
          this.dom.btnDetailPrimaryAction.removeAttribute('aria-disabled');
          this.dom.btnDetailPrimaryAction.style.background = data.color;
          this.dom.btnDetailPrimaryAction.style.borderColor = data.color;
          this.dom.btnDetailPrimaryAction.style.color = '#060709';
        }
      }
    }

    // --------------------------------------------------------------------------
    // THE 6-STEP BLACK-HOLE TRANSITION SEQUENCE & ENTRANCE
    // --------------------------------------------------------------------------
    open() {
      if (this.isOpen) return;
      this.isOpen = true;
      this.isStabilized = false;
      this.currentPhase = 1;

      // Reset detail state if opening fresh
      this.isDetailOpen = false;
      this.selectedModuleId = null;
      this.selectedSide = null;
      this.currentBlobShiftX = 0;
      this.targetBlobShiftX = 0;

      // Initial blob entrance: start from 95% scale and transition smoothly to 100% over 450ms
      this.currentBlobScale = 0.95;
      this.targetBlobScale = 1.0;
      this.blobStartShiftX = 0;
      this.blobStartScale = 0.95;
      this.blobTransitionStartTime = performance.now();
      this.blobTransitionDuration = 450;
      this.isBlobTransitioning = true;
      this.entranceStartTime = performance.now();

      if (this.dom.root) this.dom.root.classList.remove('is-detail-active');
      if (this.blobMesh) {
        this.blobMesh.position.set(0, -0.20, 0);
        this.blobMesh.scale.setScalar(0.95);
      }

      // Ensure blob material is immediately formed and glowing with its signature orange rim
      if (this.blobMaterial) {
        this.blobMaterial.uniforms.uExpansion.value = 0.95;
        this.blobMaterial.uniforms.uRimAlpha.value = 0.95;
        this.blobMaterial.uniforms.uHighlightColor.value.copy(this.defaultHighlightColor);
        this.blobMaterial.uniforms.uEnergyPulse.value = 0.0;
      }
      this.targetHighlightColor = this.defaultHighlightColor;

      // Lock body scroll and activate full experience layer immediately
      document.body.classList.add('phantom-experience-open');
      this.dom.root.classList.add('is-active');

      // Update constellation coordinates
      this.layoutConstellation();

      // Start render loop immediately
      this.clock.start();
      this.render();

      if (this.prefersReducedMotion) {
        this.dom.root.classList.add('is-stabilized');
        this.blobMaterial.uniforms.uExpansion.value = 1.0;
        this.blobMaterial.uniforms.uRimAlpha.value = 0.95;
        this.currentBlobScale = 1.0;
        this.targetBlobScale = 1.0;
        this.isStabilized = true;
        this.currentPhase = 5;
        return;
      }

      // Smooth coordinated entrance sequence
      setTimeout(() => {
        if (!this.isOpen) return;
        this.dom.root.classList.add('is-stabilized');
        this.isStabilized = true;
        this.currentPhase = 5;
      }, 60);
    }

    // --------------------------------------------------------------------------
    // REVERSE TRANSITION (EXIT / RETURN TO SMRITI)
    // --------------------------------------------------------------------------
    close() {
      if (!this.isOpen) return;

      if (window.location.pathname.endsWith('/pages/phantom.html')) {
        if (document.referrer && (document.referrer.includes('/pages/smriti.html') || document.referrer.includes('index.html'))) {
          window.location.href = document.referrer;
        } else {
          window.location.href = '/pages/smriti.html';
        }
        return;
      }

      // Close detail view if open
      if (this.isDetailOpen) {
        this.deselectModule();
      }

      this.isOpen = false;
      this.isStabilized = false;
      this.currentPhase = 0;

      // 1. Instantly fade out chrome, constellation nodes & module auras
      this.dom.root.classList.remove('is-stabilized');
      if (this.dom.auraGlows) {
        Object.values(this.dom.auraGlows).forEach((glow) => glow?.classList.remove('is-active'));
      }
      this.targetHighlightColor = this.defaultHighlightColor;
      if (this.blobMaterial) {
        this.blobMaterial.uniforms.uHighlightColor.value.copy(this.defaultHighlightColor);
        this.blobMaterial.uniforms.uEnergyPulse.value = 0.0;
      }

      // 2. Shrink blob smoothly into the void
      const startTime = performance.now();
      const duration = 650;
      const initialExpansion = this.blobMaterial.uniforms.uExpansion.value;
      const initialRim = this.blobMaterial.uniforms.uRimAlpha.value;

      const animateCollapse = (now) => {
        const progress = Math.min((now - startTime) / duration, 1.0);
        const ease = progress * progress; // ease-in quadratic

        this.blobMaterial.uniforms.uExpansion.value = initialExpansion * (1 - ease);
        this.blobMaterial.uniforms.uRimAlpha.value = initialRim * (1 - ease);

        if (progress < 1.0) {
          requestAnimationFrame(animateCollapse);
        } else {
          // 3. Complete exit, lift backdrop, restore SMRITI site
          this.dom.root.classList.remove('is-active');
          document.body.classList.remove('phantom-experience-open');
          if (this.rafId) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
          }
        }
      };

      requestAnimationFrame(animateCollapse);
    }

    // --------------------------------------------------------------------------
    // 60FPS THREE.JS RENDER & IDLE MOTION LOOP
    // --------------------------------------------------------------------------
    render() {
      if (!this.isOpen) return;

      const delta = this.clock.getDelta();
      const elapsedTime = this.clock.getElapsedTime();

      // Update shader uniform time for fluid wave deformation
      if (this.blobMaterial) {
        this.blobMaterial.uniforms.uTime.value = elapsedTime;

        // Subtle organic breathing idle once settled
        if (this.isStabilized) {
          const breath = Math.sin(elapsedTime * 0.9) * 0.035;
          this.blobMaterial.uniforms.uExpansion.value = 1.0 + breath;
        } else {
          // Smooth entrance expansion from 0.95 to 1.0 over 450ms
          const elapsed = performance.now() - (this.entranceStartTime || performance.now());
          const progress = Math.min(elapsed / 450, 1.0);
          const ease = phantomBezierEase(progress);
          this.blobMaterial.uniforms.uExpansion.value = 0.95 + 0.05 * ease;
          this.blobMaterial.uniforms.uRimAlpha.value = 0.85 + 0.15 * ease;
        }

        // Smoothly lerp blob highlight rim color toward module accent
        if (this.blobMaterial.uniforms.uHighlightColor && this.targetHighlightColor) {
          this.blobMaterial.uniforms.uHighlightColor.value.lerp(this.targetHighlightColor, 0.08);
        }
      }

      // Smooth pointer parallax / drag rotation lerp
      this.mouse.x += (this.mouse.targetX - this.mouse.x) * 0.06;
      this.mouse.y += (this.mouse.targetY - this.mouse.y) * 0.06;

      // Smooth cubic-bezier(0.22, 1, 0.36, 1) transition for blob repositioning
      if (this.isBlobTransitioning) {
        const elapsed = performance.now() - this.blobTransitionStartTime;
        const progress = Math.min(elapsed / this.blobTransitionDuration, 1.0);
        const ease = phantomBezierEase(progress);

        this.currentBlobShiftX = this.blobStartShiftX + (this.targetBlobShiftX - this.blobStartShiftX) * ease;
        this.currentBlobScale = this.blobStartScale + (this.targetBlobScale - this.blobStartScale) * ease;

        if (progress >= 1.0) {
          this.isBlobTransitioning = false;
          this.currentBlobShiftX = this.targetBlobShiftX;
          this.currentBlobScale = this.targetBlobScale;
        }
      } else {
        this.currentBlobShiftX += (this.targetBlobShiftX - this.currentBlobShiftX) * 0.1;
        this.currentBlobScale += (this.targetBlobScale - this.currentBlobScale) * 0.1;
      }

      if (this.blobMesh) {
        this.blobMesh.position.x = this.currentBlobShiftX;
        this.blobMesh.scale.setScalar(this.currentBlobScale);

        // Continuous organic yaw + parallax rotation
        this.blobMesh.rotation.y = elapsedTime * 0.08 + this.mouse.x * 0.6;
        this.blobMesh.rotation.x = Math.sin(elapsedTime * 0.06) * 0.12 + this.mouse.y * 0.4;
      }

      // Parallax effect on reactive aura behind blob
      if (this.dom.aura) {
        const px = this.mouse.x * 16;
        const py = -this.mouse.y * 12;
        this.dom.aura.style.transform = `translate(-50%, -50%) translate(${px.toFixed(1)}px, ${py.toFixed(1)}px)`;
      }

      // Continuously update dynamic connection line geometry & occlusion mask to follow shifted blob
      this.updateDynamicConnections();

      // Render Three.js scene
      this.renderer.render(this.scene, this.camera);

      // Render dust particle loop
      if (this.drawDust) {
        this.drawDust();
      }

      // Animate active energy pulse dot along connector: flows from module node toward central blob
      if (this.activeNodeId && this.nodePositions && !this.isDetailOpen) {
        const pulse = this.dom.pulses[this.activeNodeId];
        const target = this.nodePositions[this.activeNodeId];
        if (pulse && target && this.centerCoords) {
          const t = (elapsedTime * 1.4) % 1.0;
          const curX = target.x + (this.centerCoords.x - target.x) * t;
          const curY = target.y + (this.centerCoords.y - target.y) * t;
          if (isFinite(curX) && isFinite(curY)) {
            pulse.setAttribute('cx', curX);
            pulse.setAttribute('cy', curY);
            pulse.classList.add('is-pulsing');
          }
        }
      } else {
        Object.values(this.dom.pulses).forEach((p) => p && p.classList.remove('is-pulsing'));
      }

      this.rafId = requestAnimationFrame(() => this.render());
    }

    // --------------------------------------------------------------------------
    // EVENT BINDINGS & INTERACTIONS
    // --------------------------------------------------------------------------
    bindEvents() {
      // 1. Navigation Hook: Intercept existing SMRITI navbar "PHANTOM" link
      const phantomNavLinks = document.querySelectorAll('#navPhantomLink, a[href="#phantom"], [data-phantom-trigger]');
      phantomNavLinks.forEach((link) => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.open();
        });
      });

      // 2. Return & Close Controls
      this.dom.returnBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        this.close();
      });
      this.dom.btnDetailClose?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deselectModule();
      });
      this.dom.btnDetailBack?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deselectModule();
      });

      // Clicking empty background or canvas deselects active module
      this.dom.canvasContainer?.addEventListener('click', (e) => {
        if (this.isDetailOpen) {
          this.deselectModule();
        }
      });
      this.dom.backdrop?.addEventListener('click', (e) => {
        if (this.isDetailOpen) {
          this.deselectModule();
        }
      });

      // 3. Escape key: detail mode returns to overview; overview returns to SMRITI
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isOpen) {
          if (this.isDetailOpen) {
            e.preventDefault();
            e.stopPropagation();
            this.deselectModule();
          } else {
            this.close();
          }
        }
      });

      // 4. Window Resize
      window.addEventListener('resize', () => {
        if (!this.renderer || !this.camera) return;
        const w = window.innerWidth;
        const h = window.innerHeight;
        const aspect = w / h;
        this.camera.aspect = aspect;

        const isDesktop = w >= 1024;
        const isTablet = w >= 640 && w < 1024;
        const isMobile = w < 640;
        const isNarrow = w < 420;

        if (aspect < 0.75) {
          this.camera.position.z = Math.min(10.2, 7.2 * (0.75 / aspect));
        } else {
          this.camera.position.z = 7.2;
        }
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);

        const baseOverviewScale = isNarrow ? 0.62 : (isMobile ? 0.72 : (isTablet ? 0.85 : 1.0));

        // Adjust detail shift target on viewport resize
        if (this.isDetailOpen) {
          if (isDesktop) {
            this.targetBlobShiftX = this.selectedSide === 'left' ? 2.05 : -2.05;
            this.targetBlobScale = 0.80;
          } else if (isTablet) {
            this.targetBlobShiftX = this.selectedSide === 'left' ? 1.55 : -1.55;
            this.targetBlobScale = 0.76;
          } else {
            this.targetBlobShiftX = 0;
            this.targetBlobScale = baseOverviewScale * 0.82;
          }
        } else {
          this.targetBlobScale = baseOverviewScale;
        }

        this.layoutConstellation();
      });

      // 5. Pointer Parallax / Blob drag
      window.addEventListener('pointermove', (e) => {
        if (!this.isOpen) return;
        const ndcX = (e.clientX / window.innerWidth) * 2 - 1;
        const ndcY = -(e.clientY / window.innerHeight) * 2 + 1;
        this.mouse.targetX = ndcX * 0.4;
        this.mouse.targetY = ndcY * 0.3;
      });

      // 6. Interactive Node Hover & Click States
      Object.keys(this.dom.nodes).forEach((key) => {
        const node = this.dom.nodes[key];
        const line = this.dom.lines[key];
        if (!node) return;

        // Selection: Click opens module detail panel, or navigates to dedicated route if already open
        node.addEventListener('click', (e) => {
          e.stopPropagation();
          const data = PHANTOM_MODULES_DATA[key];
          if (this.isDetailOpen && this.selectedModuleId === key && data?.routeUrl) {
            this.navigateToModuleRoute(data.routeUrl);
            return;
          }
          this.selectModule(key);
        });

        // Accessibility: Keyboard selection
        node.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            const data = PHANTOM_MODULES_DATA[key];
            if (this.isDetailOpen && this.selectedModuleId === key && data?.routeUrl) {
              this.navigateToModuleRoute(data.routeUrl);
              return;
            }
            this.selectModule(key);
          }
        });

        // Hover: Soft color breathing aura & line accent
        const onEnter = () => {
          this.activeNodeId = key;
          node.classList.add('is-active');
          line?.classList.add('is-active');

          // Activate module aura behind central blob
          if (this.dom.auraGlows) {
            Object.keys(this.dom.auraGlows).forEach((mKey) => {
              if (mKey === key) {
                this.dom.auraGlows[mKey]?.classList.add('is-active');
              } else {
                this.dom.auraGlows[mKey]?.classList.remove('is-active');
              }
            });
          }

          // Tint blob shader rim highlight towards module accent & send energy pulse
          if (this.blobMaterial && this.moduleColors[key]) {
            this.targetHighlightColor = this.moduleColors[key];
            this.blobMaterial.uniforms.uEnergyPulse.value = 0.45;
          }
        };

        const onLeave = () => {
          if (this.activeNodeId === key) {
            this.activeNodeId = null;

            if (this.isDetailOpen && this.selectedModuleId) {
              // Restore selected module aura and tint while detail view is open
              const selId = this.selectedModuleId;
              if (this.dom.auraGlows) {
                Object.keys(this.dom.auraGlows).forEach((mKey) => {
                  if (mKey === selId) {
                    this.dom.auraGlows[mKey]?.classList.add('is-active');
                  } else {
                    this.dom.auraGlows[mKey]?.classList.remove('is-active');
                  }
                });
              }
              if (this.blobMaterial && this.moduleColors[selId]) {
                this.targetHighlightColor = this.moduleColors[selId];
                this.blobMaterial.uniforms.uEnergyPulse.value = 0.0;
              }
            } else {
              // Deactivate module aura in overview
              if (this.dom.auraGlows) {
                Object.values(this.dom.auraGlows).forEach((glow) => {
                  glow?.classList.remove('is-active');
                });
              }

              // Restore neutral blob shader highlight & zero energy pulse
              if (this.blobMaterial) {
                this.targetHighlightColor = this.defaultHighlightColor;
                this.blobMaterial.uniforms.uEnergyPulse.value = 0.0;
              }
            }
          }
          node.classList.remove('is-active');
          line?.classList.remove('is-active');
        };

        node.addEventListener('mouseenter', onEnter);
        node.addEventListener('mouseleave', onLeave);
        node.addEventListener('focus', onEnter);
        node.addEventListener('blur', onLeave);
      });

      // 7. Mobile Pill Selector
      Object.keys(this.dom.mobilePills).forEach((key) => {
        const pill = this.dom.mobilePills[key];
        if (!pill) return;
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectModule(key);
        });
      });

      // 8. Detail Module Switcher Quick Rail
      if (this.dom.detailSwitchPills) {
        this.dom.detailSwitchPills.forEach((pill) => {
          pill.addEventListener('click', (e) => {
            e.stopPropagation();
            const targetModule = pill.getAttribute('data-switch');
            if (targetModule) {
              this.selectModule(targetModule);
            }
          });
        });
      }

      // 9. Detail Primary Action Button
      this.dom.btnDetailPrimaryAction?.addEventListener('click', (e) => {
        e.stopPropagation();
        const moduleId = this.selectedModuleId || 'smriti';
        const data = PHANTOM_MODULES_DATA[moduleId];
        if (!data || data.isPlanned) return;

        if (data.routeUrl) {
          this.navigateToModuleRoute(data.routeUrl);
          return;
        }

        // Feedback for active module connection if no dedicated route
        const btn = this.dom.btnDetailPrimaryAction;
        const origText = this.dom.detailActionText ? this.dom.detailActionText.textContent : '';
        if (this.dom.detailActionText) {
          this.dom.detailActionText.textContent = `Connecting ${data.name}...`;
        }
        btn.style.opacity = '0.75';
        setTimeout(() => {
          if (this.dom.detailActionText) {
            this.dom.detailActionText.textContent = origText;
          }
          if (btn) btn.style.opacity = '1';
        }, 1400);
      });
    }

    navigateToModuleRoute(url) {
      if (this.dom.root) {
        this.dom.root.style.transition = 'opacity 0.28s cubic-bezier(0.16, 1, 0.3, 1), filter 0.28s ease';
        this.dom.root.style.opacity = '0.45';
        this.dom.root.style.filter = 'blur(6px)';
      }
      setTimeout(() => {
        window.location.href = url;
      }, 200);
    }

    checkReducedMotion() {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.prefersReducedMotion = mediaQuery.matches;
      mediaQuery.addEventListener('change', (e) => {
        this.prefersReducedMotion = e.matches;
      });
    }
  }

  // ----------------------------------------------------------------------------
  // 3. INITIALIZATION ON DOM READY
  // ----------------------------------------------------------------------------
  const initPhantomCore = () => {
    if (window.PhantomCoreExperience) return;
    if (!window.THREE) {
      setTimeout(initPhantomCore, 50);
      return;
    }
    try {
      const exp = new PhantomCoreExperience();
      window.PhantomCoreExperience = exp;

      // Check if should auto-open on load (standalone page or #phantom or module hash)
      const isStandalone = window.location.pathname.endsWith('/pages/phantom.html') || document.body?.getAttribute('data-page') === 'phantom';
      const hash = (window.location.hash || '').replace('#', '').toLowerCase();
      const isModuleHash = Boolean(PHANTOM_MODULES_DATA[hash]);
      const isPhantomHash = hash === 'phantom' || isModuleHash;

      if (isStandalone || isPhantomHash) {
        exp.open();
        if (isModuleHash) {
          setTimeout(() => {
            exp.selectModule(hash);
          }, 180);
        }
      }

      // Listen for hash changes
      window.addEventListener('hashchange', () => {
        const curHash = (window.location.hash || '').replace('#', '').toLowerCase();
        if (PHANTOM_MODULES_DATA[curHash]) {
          if (!exp.isOpen) exp.open();
          exp.selectModule(curHash);
        } else if (curHash === 'phantom' && !exp.isOpen) {
          exp.open();
        } else if (!curHash && exp.isOpen && !isStandalone) {
          exp.close();
        }
      });
    } catch (e) {
      console.error('Failed to init PhantomCoreExperience:', e);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPhantomCore);
  } else {
    initPhantomCore();
  }
})();
