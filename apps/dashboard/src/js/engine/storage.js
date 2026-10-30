/**
 * ==============================================================================
 * PHANTOM SPATIAL INTELLIGENCE PLATFORM — SHARED ENGINE
 * Module: Storage & Continuous Physical Key-Value Store
 * Persistence: Local-First Browser IndexedDB (phantom_spatial_memory_v1)
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PhantomStorage = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DB_NAME = 'phantom_spatial_memory_v1';
  const DB_VERSION = 1;

  class PhantomStorage {
    constructor() {
      this.db = null;
      this.initPromise = this._init();
    }

    async _init() {
      return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
          console.warn('[PhantomStorage] IndexedDB not available, falling back to in-memory store.');
          this.memoryFallback = {
            environments: new Map(),
            objects: new Map(),
            observations: new Map(),
            spatial_relationships: new Map(),
            events: new Map(),
            evidence_frames: new Map()
          };
          resolve(null);
          return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // 1. Environments store
          if (!db.objectStoreNames.contains('environments')) {
            const envStore = db.createObjectStore('environments', { keyPath: 'environment_id' });
            envStore.createIndex('created_at', 'created_at', { unique: false });
          }

          // 2. Objects store (The Physical Key-Value Store)
          if (!db.objectStoreNames.contains('objects')) {
            const objStore = db.createObjectStore('objects', { keyPath: 'object_id' });
            objStore.createIndex('environment_id', 'environment_id', { unique: false });
            objStore.createIndex('category', 'category', { unique: false });
            objStore.createIndex('status', 'status', { unique: false });
            objStore.createIndex('canonical_name', 'canonical_name', { unique: false });
          }

          // 3. Observations store
          if (!db.objectStoreNames.contains('observations')) {
            const obsStore = db.createObjectStore('observations', { keyPath: 'observation_id' });
            obsStore.createIndex('environment_id', 'environment_id', { unique: false });
            obsStore.createIndex('timestamp', 'timestamp', { unique: false });
          }

          // 4. Spatial relationships store
          if (!db.objectStoreNames.contains('spatial_relationships')) {
            const relStore = db.createObjectStore('spatial_relationships', { keyPath: 'id', autoIncrement: true });
            relStore.createIndex('environment_id', 'environment_id', { unique: false });
            relStore.createIndex('subject_object_id', 'subject_object_id', { unique: false });
            relStore.createIndex('reference_object_id', 'reference_object_id', { unique: false });
          }

          // 5. Events store (Movement & change ledger)
          if (!db.objectStoreNames.contains('events')) {
            const evtStore = db.createObjectStore('events', { keyPath: 'event_id' });
            evtStore.createIndex('environment_id', 'environment_id', { unique: false });
            evtStore.createIndex('object_id', 'object_id', { unique: false });
            evtStore.createIndex('timestamp', 'timestamp', { unique: false });
            evtStore.createIndex('event_type', 'event_type', { unique: false });
          }

          // 6. Evidence frames store (retained snapshot images)
          if (!db.objectStoreNames.contains('evidence_frames')) {
            const frameStore = db.createObjectStore('evidence_frames', { keyPath: 'frame_reference' });
            frameStore.createIndex('environment_id', 'environment_id', { unique: false });
            frameStore.createIndex('timestamp', 'timestamp', { unique: false });
          }
        };

        request.onsuccess = (event) => {
          this.db = event.target.result;
          resolve(this.db);
        };

        request.onerror = (event) => {
          console.error('[PhantomStorage] Error opening IndexedDB:', event.target.error);
          reject(event.target.error);
        };
      });
    }

    async ready() {
      await this.initPromise;
      return this;
    }

    // Generic transaction helper
    async _tx(storeName, mode, callback) {
      await this.ready();
      if (!this.db) {
        return this._memoryTx(storeName, mode, callback);
      }
      return new Promise((resolve, reject) => {
        try {
          const transaction = this.db.transaction([storeName], mode);
          const store = transaction.objectStore(storeName);
          const request = callback(store);

          transaction.oncomplete = () => resolve(request ? request.result : undefined);
          transaction.onerror = (e) => reject(e.target.error);
        } catch (err) {
          reject(err);
        }
      });
    }

    _memoryTx(storeName, mode, callback) {
      const map = this.memoryFallback[storeName];
      const fakeStore = {
        get: (key) => ({ result: map.get(key) }),
        getAll: () => ({ result: Array.from(map.values()) }),
        put: (val) => {
          const key = val.environment_id || val.object_id || val.observation_id || val.event_id || val.frame_reference || String(Date.now());
          map.set(key, val);
          return { result: key };
        },
        delete: (key) => {
          map.delete(key);
          return { result: true };
        },
        clear: () => {
          map.clear();
          return { result: true };
        }
      };
      const req = callback(fakeStore);
      return Promise.resolve(req ? req.result : undefined);
    }

    // ==========================================================================
    // ENVIRONMENTS API
    // ==========================================================================
    async getEnvironment(environmentId) {
      return this._tx('environments', 'readonly', (store) => store.get(environmentId));
    }

    async getAllEnvironments() {
      return this._tx('environments', 'readonly', (store) => store.getAll());
    }

    async saveEnvironment(env) {
      const record = {
        environment_id: env.environment_id,
        environment_name: env.environment_name || 'My Desk',
        environment_type: env.environment_type || 'desk',
        camera_id: env.camera_id || 'default',
        camera_status: env.camera_status || 'disconnected',
        observation_status: env.observation_status || 'idle',
        created_at: env.created_at || new Date().toISOString(),
        last_observed_at: env.last_observed_at || new Date().toISOString()
      };
      await this._tx('environments', 'readwrite', (store) => store.put(record));
      return record;
    }

    async deleteEnvironment(environmentId) {
      // Delete environment and associated data
      await this._tx('environments', 'readwrite', (store) => store.delete(environmentId));
      await this.clearEnvironmentData(environmentId);
      return true;
    }

    // ==========================================================================
    // OBJECTS API (The Physical Key-Value Store)
    // ==========================================================================
    async getObject(objectId) {
      return this._tx('objects', 'readonly', (store) => store.get(objectId));
    }

    async getAllObjects(environmentId = null) {
      const all = await this._tx('objects', 'readonly', (store) => store.getAll());
      if (!environmentId) return all || [];
      return (all || []).filter((o) => o.environment_id === environmentId);
    }

    async saveObject(obj) {
      const record = {
        object_id: obj.object_id,
        environment_id: obj.environment_id || 'env_desk_01',
        canonical_name: obj.canonical_name,
        category: obj.category || 'personal',
        aliases: obj.aliases || [],
        visual_description: obj.visual_description || '',
        first_seen: obj.first_seen || new Date().toISOString(),
        last_seen: obj.last_seen || new Date().toISOString(),
        current_location: obj.current_location || 'Unknown',
        previous_location: obj.previous_location || null,
        confidence: typeof obj.confidence === 'number' ? obj.confidence : 0.9,
        status: obj.status || 'confirmed', // confirmed, moved, uncertain, occluded, removed
        bbox: obj.bbox || [0.4, 0.4, 0.6, 0.6], // [ymin, xmin, ymax, xmax] normalized
        centroid: obj.centroid || { x: 0.5, y: 0.5 },
        evidence_frame_ref: obj.evidence_frame_ref || null
      };
      await this._tx('objects', 'readwrite', (store) => store.put(record));
      return record;
    }

    // ==========================================================================
    // OBSERVATIONS API
    // ==========================================================================
    async saveObservation(obs) {
      const record = {
        observation_id: obs.observation_id || `obs_${Date.now()}`,
        environment_id: obs.environment_id || 'env_desk_01',
        timestamp: obs.timestamp || new Date().toISOString(),
        detected_objects: obs.detected_objects || [],
        scene_state: obs.scene_state || 'stable',
        frame_reference: obs.frame_reference || null,
        confidence: obs.confidence || 0.92,
        processing_status: obs.processing_status || 'verified'
      };
      await this._tx('observations', 'readwrite', (store) => store.put(record));
      return record;
    }

    async getRecentObservations(environmentId, limit = 20) {
      const all = await this._tx('observations', 'readonly', (store) => store.getAll());
      const filtered = (all || [])
        .filter((o) => !environmentId || o.environment_id === environmentId)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      return filtered.slice(0, limit);
    }

    // ==========================================================================
    // SPATIAL RELATIONSHIPS API
    // ==========================================================================
    async saveSpatialRelationship(rel) {
      const record = {
        subject_object_id: rel.subject_object_id,
        relation: rel.relation, // 'to the left of', 'behind', 'beside', 'in front of', 'near'
        reference_object_id: rel.reference_object_id,
        environment_id: rel.environment_id || 'env_desk_01',
        timestamp: rel.timestamp || new Date().toISOString(),
        confidence: rel.confidence || 0.9
      };
      if (rel.id) record.id = rel.id;
      await this._tx('spatial_relationships', 'readwrite', (store) => store.put(record));
      return record;
    }

    async getRelationshipsForObject(objectId, environmentId = null) {
      const all = await this._tx('spatial_relationships', 'readonly', (store) => store.getAll());
      return (all || []).filter((r) => {
        const matchObj = r.subject_object_id === objectId || r.reference_object_id === objectId;
        const matchEnv = !environmentId || r.environment_id === environmentId;
        return matchObj && matchEnv;
      });
    }

    // ==========================================================================
    // EVENTS API (Physical movement & change ledger)
    // ==========================================================================
    async recordEvent(evt) {
      const record = {
        event_id: evt.event_id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        environment_id: evt.environment_id || 'env_desk_01',
        object_id: evt.object_id,
        event_type: evt.event_type, // 'added', 'moved', 'removed', 'reappeared', 'occluded', 'uncertain'
        previous_location: evt.previous_location || null,
        new_location: evt.new_location || 'Unknown',
        timestamp: evt.timestamp || new Date().toISOString(),
        confidence: typeof evt.confidence === 'number' ? evt.confidence : 0.92,
        previous_observation_id: evt.previous_observation_id || null,
        current_observation_id: evt.current_observation_id || null,
        frame_reference: evt.frame_reference || null,
        verification_status: evt.verification_status || 'confirmed' // 'confirmed', 'uncertain'
      };
      await this._tx('events', 'readwrite', (store) => store.put(record));
      return record;
    }

    async getEvents(environmentId = null, filterOpts = {}) {
      const all = await this._tx('events', 'readonly', (store) => store.getAll());
      let filtered = (all || []).filter((e) => !environmentId || e.environment_id === environmentId);

      if (filterOpts.objectId) {
        filtered = filtered.filter((e) => e.object_id === filterOpts.objectId);
      }
      if (filterOpts.eventType && filterOpts.eventType !== 'all') {
        filtered = filtered.filter((e) => e.event_type === filterOpts.eventType);
      }
      if (filterOpts.since) {
        const sinceDate = new Date(filterOpts.since);
        filtered = filtered.filter((e) => new Date(e.timestamp) >= sinceDate);
      }

      // Sort newest first
      filtered.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      if (filterOpts.limit) {
        return filtered.slice(0, filterOpts.limit);
      }
      return filtered;
    }

    // ==========================================================================
    // EVIDENCE FRAMES API
    // ==========================================================================
    async storeEvidenceFrame(frameRef, dataUrl, meta = {}) {
      const record = {
        frame_reference: frameRef,
        environment_id: meta.environment_id || 'env_desk_01',
        timestamp: meta.timestamp || new Date().toISOString(),
        data_url: dataUrl,
        meta: meta
      };
      await this._tx('evidence_frames', 'readwrite', (store) => store.put(record));
      return record;
    }

    async getEvidenceFrame(frameRef) {
      if (!frameRef) return null;
      return this._tx('evidence_frames', 'readonly', (store) => store.get(frameRef));
    }

    // ==========================================================================
    // SEARCH & REVEAL QUERY
    // ==========================================================================
    async searchObjects(environmentId, query) {
      if (!query || typeof query !== 'string') return [];
      const clean = query.trim().toLowerCase();
      const allObjects = await this.getAllObjects(environmentId);

      return allObjects.filter((obj) => {
        const nameMatch = obj.canonical_name.toLowerCase().includes(clean);
        const catMatch = obj.category.toLowerCase().includes(clean);
        const locMatch = (obj.current_location || '').toLowerCase().includes(clean);
        const aliasMatch = (obj.aliases || []).some((a) => a.toLowerCase().includes(clean));
        return nameMatch || catMatch || locMatch || aliasMatch;
      });
    }

    // ==========================================================================
    // DATA INTEGRITY & PRIVACY PURGE
    // ==========================================================================
    async clearEnvironmentData(environmentId) {
      const stores = ['objects', 'observations', 'spatial_relationships', 'events', 'evidence_frames'];
      for (const storeName of stores) {
        const all = await this._tx(storeName, 'readonly', (s) => s.getAll());
        for (const item of all || []) {
          if (item.environment_id === environmentId) {
            const key = item.object_id || item.observation_id || item.id || item.event_id || item.frame_reference;
            if (key) {
              await this._tx(storeName, 'readwrite', (s) => s.delete(key));
            }
          }
        }
      }
      return true;
    }

    async purgeAll() {
      const stores = ['environments', 'objects', 'observations', 'spatial_relationships', 'events', 'evidence_frames'];
      for (const s of stores) {
        await this._tx(s, 'readwrite', (store) => store.clear());
      }
      return true;
    }

    // ==========================================================================
    // INITIAL BASELINE SEED DATA
    // Generates realistic initial verified state for desk monitoring demo
    // ==========================================================================
    async seedInitialData(forceReset = false) {
      await this.ready();
      const existingEnvs = await this.getAllEnvironments();
      if (existingEnvs && existingEnvs.length > 0 && !forceReset) {
        return false; // Already seeded
      }

      if (forceReset) {
        await this.purgeAll();
      }

      // 1. Primary Environments
      const primaryEnv = {
        environment_id: 'env_desk_01',
        environment_name: 'My Desk (Primary)',
        environment_type: 'desk',
        camera_id: 'built_in_or_usb',
        camera_status: 'ready',
        observation_status: 'standby',
        created_at: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
        last_observed_at: new Date(Date.now() - 60 * 1000 * 2).toISOString()
      };
      await this.saveEnvironment(primaryEnv);

      const tableTestEnv = {
        environment_id: 'env_table_02',
        environment_name: 'Table Test Area',
        environment_type: 'table',
        camera_id: 'phone_continuity',
        camera_status: 'ready',
        observation_status: 'standby',
        created_at: new Date(Date.now() - 3600 * 1000 * 4).toISOString(),
        last_observed_at: new Date(Date.now() - 60 * 1000 * 15).toISOString()
      };
      await this.saveEnvironment(tableTestEnv);

      // 2. Realistic Desk Objects (Primary Environment)
      const now = Date.now();
      const sampleObjects = [
        {
          object_id: 'obj_reading_glasses',
          environment_id: 'env_desk_01',
          canonical_name: 'Reading Glasses',
          category: 'personal',
          aliases: ['glasses', 'spectacles', 'specs', 'eyewear'],
          visual_description: 'Tortoiseshell frame reading glasses with anti-glare lenses',
          first_seen: new Date(now - 7200 * 1000).toISOString(),
          last_seen: new Date(now - 120 * 1000).toISOString(),
          current_location: 'To the left of laptop, near the notebook',
          previous_location: 'Beside the keyboard',
          confidence: 0.96,
          status: 'confirmed',
          bbox: [0.38, 0.16, 0.52, 0.28], // [ymin, xmin, ymax, xmax]
          centroid: { x: 0.22, y: 0.45 },
          evidence_frame_ref: 'frame_seed_glasses_04'
        },
        {
          object_id: 'obj_water_bottle',
          environment_id: 'env_desk_01',
          canonical_name: 'Hydro Flask Water Bottle',
          category: 'hydration',
          aliases: ['water bottle', 'bottle', 'flask', 'hydro flask', 'water'],
          visual_description: 'Matte cobalt blue 24oz insulated stainless steel bottle',
          first_seen: new Date(now - 14400 * 1000).toISOString(),
          last_seen: new Date(now - 180 * 1000).toISOString(),
          current_location: 'Behind laptop, upper center-right',
          previous_location: 'Center of desk',
          confidence: 0.94,
          status: 'confirmed',
          bbox: [0.15, 0.62, 0.42, 0.74],
          centroid: { x: 0.68, y: 0.28 },
          evidence_frame_ref: 'frame_seed_bottle_02'
        },
        {
          object_id: 'obj_laptop',
          environment_id: 'env_desk_01',
          canonical_name: 'MacBook Pro 16"',
          category: 'electronics',
          aliases: ['laptop', 'macbook', 'computer', 'macbook pro'],
          visual_description: 'Space Gray 16-inch laptop open in center working zone (Stationary Landmark)',
          first_seen: new Date(now - 28800 * 1000).toISOString(),
          last_seen: new Date(now - 60 * 1000).toISOString(),
          current_location: 'Center desk primary workspace (Fixed Reference Anchor)',
          previous_location: null,
          confidence: 0.99,
          status: 'confirmed',
          bbox: [0.28, 0.32, 0.72, 0.68],
          centroid: { x: 0.50, y: 0.50 },
          evidence_frame_ref: 'frame_seed_laptop_01'
        },
        {
          object_id: 'obj_house_keys',
          environment_id: 'env_desk_01',
          canonical_name: 'House Keys',
          category: 'personal',
          aliases: ['keys', 'keychain', 'car keys', 'house key'],
          visual_description: 'Brass key ring with leather fob and 4 silver keys',
          first_seen: new Date(now - 10800 * 1000).toISOString(),
          last_seen: new Date(now - 450 * 1000).toISOString(),
          current_location: 'Top-right corner of desk, beside watch',
          previous_location: 'Front edge of desk',
          confidence: 0.91,
          status: 'confirmed',
          bbox: [0.12, 0.80, 0.24, 0.92],
          centroid: { x: 0.86, y: 0.18 },
          evidence_frame_ref: 'frame_seed_keys_03'
        },
        {
          object_id: 'obj_watch',
          environment_id: 'env_desk_01',
          canonical_name: 'Apple Watch Ultra',
          category: 'personal',
          aliases: ['watch', 'smartwatch', 'apple watch', 'timepiece'],
          visual_description: 'Titanium chassis smartwatch with orange alpine loop strap',
          first_seen: new Date(now - 18000 * 1000).toISOString(),
          last_seen: new Date(now - 450 * 1000).toISOString(),
          current_location: 'Right edge of desk, in front of keys',
          previous_location: 'Beside the laptop',
          confidence: 0.93,
          status: 'confirmed',
          bbox: [0.28, 0.82, 0.40, 0.91],
          centroid: { x: 0.86, y: 0.34 },
          evidence_frame_ref: 'frame_seed_watch_02'
        },
        {
          object_id: 'obj_notebook',
          environment_id: 'env_desk_01',
          canonical_name: 'Hardcover Grid Notebook',
          category: 'stationery',
          aliases: ['notebook', 'journal', 'book', 'pad'],
          visual_description: 'Black cloth-bound A5 dot-grid notebook open to notes page',
          first_seen: new Date(now - 21600 * 1000).toISOString(),
          last_seen: new Date(now - 120 * 1000).toISOString(),
          current_location: 'Left side of desk, below reading glasses',
          previous_location: null,
          confidence: 0.95,
          status: 'confirmed',
          bbox: [0.55, 0.12, 0.86, 0.32],
          centroid: { x: 0.22, y: 0.70 },
          evidence_frame_ref: 'frame_seed_notebook_01'
        },
        {
          object_id: 'obj_ceramic_mug',
          environment_id: 'env_desk_01',
          canonical_name: 'Ceramic Coffee Mug',
          category: 'hydration',
          aliases: ['coffee mug', 'mug', 'cup', 'coffee cup'],
          visual_description: 'Off-white stoneware mug with dark speckled glaze',
          first_seen: new Date(now - 5400 * 1000).toISOString(),
          last_seen: new Date(now - 300 * 1000).toISOString(),
          current_location: 'Right of laptop, near the trackpad level',
          previous_location: 'Center of desk',
          confidence: 0.92,
          status: 'confirmed',
          bbox: [0.58, 0.72, 0.76, 0.85],
          centroid: { x: 0.78, y: 0.67 },
          evidence_frame_ref: 'frame_seed_mug_01'
        }
      ];

      for (const obj of sampleObjects) {
        await this.saveObject(obj);
      }

      // 3. Movement History Events (Chronological verified events)
      const sampleEvents = [
        {
          event_id: 'evt_001_glasses_first',
          environment_id: 'env_desk_01',
          object_id: 'obj_reading_glasses',
          event_type: 'added',
          previous_location: null,
          new_location: 'Left side of desk, on notebook',
          timestamp: new Date(now - 7200 * 1000).toISOString(),
          confidence: 0.97,
          frame_reference: 'frame_seed_glasses_01',
          verification_status: 'confirmed'
        },
        {
          event_id: 'evt_002_bottle_move',
          environment_id: 'env_desk_01',
          object_id: 'obj_water_bottle',
          event_type: 'moved',
          previous_location: 'Center of desk in front of monitor',
          new_location: 'Behind laptop, upper center-right',
          timestamp: new Date(now - 3600 * 1000 * 2).toISOString(),
          confidence: 0.94,
          frame_reference: 'frame_seed_bottle_02',
          verification_status: 'confirmed'
        },
        {
          event_id: 'evt_003_glasses_move1',
          environment_id: 'env_desk_01',
          object_id: 'obj_reading_glasses',
          event_type: 'moved',
          previous_location: 'Left side of desk, on notebook',
          new_location: 'Beside the laptop keyboard',
          timestamp: new Date(now - 3600 * 1000 * 1.5).toISOString(),
          confidence: 0.95,
          frame_reference: 'frame_seed_glasses_02',
          verification_status: 'confirmed'
        },
        {
          event_id: 'evt_004_keys_move',
          environment_id: 'env_desk_01',
          object_id: 'obj_house_keys',
          event_type: 'moved',
          previous_location: 'Front edge of desk near chair',
          new_location: 'Top-right corner of desk, beside watch',
          timestamp: new Date(now - 3600 * 1000 * 1.1).toISOString(),
          confidence: 0.92,
          frame_reference: 'frame_seed_keys_03',
          verification_status: 'confirmed'
        },
        {
          event_id: 'evt_005_watch_move',
          environment_id: 'env_desk_01',
          object_id: 'obj_watch',
          event_type: 'moved',
          previous_location: 'Beside the laptop',
          new_location: 'Right edge of desk, in front of keys',
          timestamp: new Date(now - 1800 * 1000).toISOString(),
          confidence: 0.93,
          frame_reference: 'frame_seed_watch_02',
          verification_status: 'confirmed'
        },
        {
          event_id: 'evt_006_glasses_move2',
          environment_id: 'env_desk_01',
          object_id: 'obj_reading_glasses',
          event_type: 'moved',
          previous_location: 'Beside the laptop keyboard',
          new_location: 'To the left of laptop, near the notebook',
          timestamp: new Date(now - 120 * 1000).toISOString(),
          confidence: 0.96,
          frame_reference: 'frame_seed_glasses_04',
          verification_status: 'confirmed'
        }
      ];

      for (const evt of sampleEvents) {
        await this.recordEvent(evt);
      }

      // 4. Spatial Relationships
      const sampleRelationships = [
        {
          subject_object_id: 'obj_reading_glasses',
          relation: 'to the left of',
          reference_object_id: 'obj_laptop',
          environment_id: 'env_desk_01',
          timestamp: new Date(now - 120 * 1000).toISOString(),
          confidence: 0.96
        },
        {
          subject_object_id: 'obj_reading_glasses',
          relation: 'near',
          reference_object_id: 'obj_notebook',
          environment_id: 'env_desk_01',
          timestamp: new Date(now - 120 * 1000).toISOString(),
          confidence: 0.93
        },
        {
          subject_object_id: 'obj_water_bottle',
          relation: 'behind',
          reference_object_id: 'obj_laptop',
          environment_id: 'env_desk_01',
          timestamp: new Date(now - 180 * 1000).toISOString(),
          confidence: 0.95
        },
        {
          subject_object_id: 'obj_house_keys',
          relation: 'beside',
          reference_object_id: 'obj_watch',
          environment_id: 'env_desk_01',
          timestamp: new Date(now - 450 * 1000).toISOString(),
          confidence: 0.92
        },
        {
          subject_object_id: 'obj_ceramic_mug',
          relation: 'to the right of',
          reference_object_id: 'obj_laptop',
          environment_id: 'env_desk_01',
          timestamp: new Date(now - 300 * 1000).toISOString(),
          confidence: 0.94
        }
      ];

      for (const rel of sampleRelationships) {
        await this.saveSpatialRelationship(rel);
      }

      // 5. Generate high-quality SVG evidence frame thumbnails
      await this._seedEvidenceSnapshots();

      console.log('[PhantomStorage] Successfully seeded initial spatial memory.');
      return true;
    }

    // Helper: generate synthetic canvas evidence image for initial items
    async _seedEvidenceSnapshots() {
      const deskItems = [
        {
          ref: 'frame_seed_glasses_04',
          title: 'Reading Glasses — Last Verified Observation',
          highlight: { x: 0.22, y: 0.45, w: 0.12, h: 0.14, label: 'Reading Glasses (0.96)' },
          anchor: { x: 0.50, y: 0.50, label: 'MacBook Pro Anchor' }
        },
        {
          ref: 'frame_seed_bottle_02',
          title: 'Hydro Flask — Observation State',
          highlight: { x: 0.68, y: 0.28, w: 0.12, h: 0.27, label: 'Hydro Flask (0.94)' },
          anchor: { x: 0.50, y: 0.50, label: 'MacBook Pro Anchor' }
        },
        {
          ref: 'frame_seed_keys_03',
          title: 'House Keys — Last Verified Observation',
          highlight: { x: 0.86, y: 0.18, w: 0.12, h: 0.12, label: 'House Keys (0.92)' },
          anchor: { x: 0.86, y: 0.34, label: 'Apple Watch' }
        },
        {
          ref: 'frame_seed_watch_02',
          title: 'Apple Watch Ultra — Last Verified Observation',
          highlight: { x: 0.86, y: 0.34, w: 0.09, h: 0.12, label: 'Apple Watch Ultra (0.93)' },
          anchor: { x: 0.50, y: 0.50, label: 'Laptop Edge' }
        }
      ];

      for (const item of deskItems) {
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
            <defs>
              <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#141820"/>
                <stop offset="100%" stop-color="#0c0f15"/>
              </linearGradient>
              <linearGradient id="desk" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#24211e"/>
                <stop offset="100%" stop-color="#181614"/>
              </linearGradient>
            </defs>
            <!-- Background room -->
            <rect width="640" height="360" fill="url(#bg)"/>
            <!-- Desk surface perspective -->
            <polygon points="40,340 600,340 560,90 80,90" fill="url(#desk)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
            <!-- Wood grain lines -->
            <line x1="80" y1="180" x2="560" y2="180" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>
            <line x1="60" y1="260" x2="580" y2="260" stroke="rgba(255,255,255,0.03)" stroke-width="1"/>

            <!-- Laptop landmark representation -->
            <rect x="230" y="130" width="180" height="110" rx="4" fill="#30343c" stroke="#525763" stroke-width="1.5"/>
            <rect x="240" y="140" width="160" height="75" rx="2" fill="#181a1f"/>
            <circle cx="320" cy="177" r="12" fill="#404550"/>
            <rect x="270" y="222" width="100" height="12" rx="2" fill="#252830"/>

            <!-- Notebook representation -->
            <rect x="100" y="210" width="90" height="110" rx="3" fill="#202228" stroke="#3c404c" stroke-width="1"/>
            <line x1="108" y1="210" x2="108" y2="320" stroke="#f07b42" stroke-width="2"/>

            <!-- Water bottle representation -->
            <rect x="410" y="80" width="36" height="85" rx="6" fill="#1e3a5f" stroke="#3b82f6" stroke-width="1"/>
            <rect x="420" y="70" width="16" height="12" rx="2" fill="#0f172a"/>

            <!-- Keys representation -->
            <circle cx="530" cy="90" r="10" fill="none" stroke="#d97706" stroke-width="2"/>
            <line x1="535" y1="95" x2="555" y2="115" stroke="#92400e" stroke-width="3"/>
            <line x1="538" y1="98" x2="560" y2="108" stroke="#b45309" stroke-width="2"/>

            <!-- Target Highlight Bounding Box -->
            <rect x="${item.highlight.x * 640 - (item.highlight.w * 640)/2}" 
                  y="${item.highlight.y * 360 - (item.highlight.h * 360)/2}" 
                  width="${item.highlight.w * 640}" 
                  height="${item.highlight.h * 360}" 
                  rx="3" fill="none" stroke="#f07b42" stroke-width="2" stroke-dasharray="4,2"/>

            <!-- Target Centroid Crosshair -->
            <circle cx="${item.highlight.x * 640}" cy="${item.highlight.y * 360}" r="4" fill="#f07b42"/>

            <!-- Spatial Vector line to Anchor -->
            <line x1="${item.highlight.x * 640}" y1="${item.highlight.y * 360}" 
                  x2="${item.anchor.x * 640}" y2="${item.anchor.y * 360}" 
                  stroke="rgba(240, 123, 66, 0.45)" stroke-width="1.5" stroke-dasharray="3,3"/>
            <circle cx="${item.anchor.x * 640}" cy="${item.anchor.y * 360}" r="3" fill="#6ec1e4"/>

            <!-- Annotation Label Pill -->
            <rect x="${item.highlight.x * 640 - (item.highlight.w * 640)/2}" 
                  y="${item.highlight.y * 360 - (item.highlight.h * 360)/2 - 20}" 
                  width="180" height="18" rx="3" fill="#f07b42"/>
            <text x="${item.highlight.x * 640 - (item.highlight.w * 640)/2 + 6}" 
                  y="${item.highlight.y * 360 - (item.highlight.h * 360)/2 - 7}" 
                  font-family="'JetBrains Mono', monospace" font-size="10" font-weight="600" fill="#141413">${item.highlight.label}</text>

            <!-- Metadata Overlay -->
            <text x="18" y="28" font-family="'JetBrains Mono', monospace" font-size="11" fill="rgba(255,255,255,0.7)">PHANTOM EVIDENCE CAPTURE · ${item.ref}</text>
            <text x="18" y="342" font-family="'JetBrains Mono', monospace" font-size="10" fill="rgba(255,255,255,0.4)">SPATIAL KEY-VALUE COMMIT · CONFIDENCE VERIFIED</text>
          </svg>
        `.trim();

        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
        await this.storeEvidenceFrame(item.ref, dataUrl, {
          environment_id: 'env_desk_01',
          title: item.title,
          synthetic: true
        });
      }
    }
  }

  return PhantomStorage;
});
