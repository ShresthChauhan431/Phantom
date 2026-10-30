/**
 * ==============================================================================
 * PHANTOM SPATIAL INTELLIGENCE PLATFORM — SHARED ENGINE
 * Module: Spatial Memory, Entity Resolution & Landmark Relationships
 * Capabilities: Centroid Distance, Fixed Reference Anchors, Qualitative Directions,
 * Strict Verification Delta, Change Generation
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PhantomSpatialMemory = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class PhantomSpatialMemory {
    constructor(storage) {
      this.storage = storage;
      this.driftNoiseThreshold = 0.07; // Centroid movement below ~7% of frame is sensor noise/drift
      this.movementThreshold = 0.10; // Centroid movement above 10% is verified physical movement
    }

    /**
     * Compute qualitative human-readable position of an object
     * relative to landmarks (laptop, keyboard) and desk coordinate frame
     */
    describeSpatialLocation(objectCentroid, landmarks = [], otherObjects = []) {
      const { x, y } = objectCentroid;

      // 1. Check relationship to primary landmark (Laptop / Monitor)
      const laptop = landmarks.find((l) => l.raw_class === 'laptop' || l.canonical_name.toLowerCase().includes('laptop'));
      if (laptop) {
        const lx = laptop.centroid.x;
        const ly = laptop.centroid.y;
        const dx = x - lx;
        const dy = y - ly;

        if (dx < -0.18) {
          return dy < -0.1 ? 'To the left of laptop, upper desk' : 'To the left of laptop';
        } else if (dx > 0.18) {
          return dy < -0.1 ? 'To the right of laptop, upper desk' : 'To the right of laptop';
        } else if (dy < -0.18) {
          return 'Behind laptop, upper center';
        } else if (dy > 0.18) {
          return 'In front of laptop';
        }
      }

      // 2. Check proximity to nearby stationary objects
      for (const other of otherObjects) {
        if (!other.centroid) continue;
        const dist = Math.hypot(x - other.centroid.x, y - other.centroid.y);
        if (dist > 0.05 && dist < 0.22) {
          return `Beside ${other.canonical_name}`;
        }
      }

      // 3. Fallback to physical desk zone quadrants
      let horizontal = 'center';
      if (x < 0.33) horizontal = 'left side of desk';
      else if (x > 0.67) horizontal = 'right side of desk';

      let vertical = 'center';
      if (y < 0.33) vertical = 'back';
      else if (y > 0.67) vertical = 'front';

      if (horizontal === 'center' && vertical === 'center') {
        return 'Center of desk primary workspace';
      }
      return `${vertical === 'center' ? '' : vertical + ' '}${horizontal}`.trim();
    }

    /**
     * Compare previous scene state with newly detected objects
     * Performs Entity Resolution and generates strict change records
     */
    async evaluateSceneDeltas(environmentId, newDetections, frameReference) {
      const existingObjects = await this.storage.getAllObjects(environmentId);
      const changes = [];
      const updatedObjects = [];
      const verifiedRelationships = [];

      // Identify stationary landmarks
      const landmarks = newDetections.filter((d) => d.is_landmark);

      // Track which existing objects got matched
      const matchedExistingIds = new Set();
      const matchedDetections = new Set();

      // STEP 1: Entity Resolution — match new detections with existing tracked objects
      for (let i = 0; i < newDetections.length; i++) {
        const det = newDetections[i];
        let bestMatch = null;
        let minDistance = Infinity;

        for (const exist of existingObjects) {
          if (matchedExistingIds.has(exist.object_id)) continue;

          // Must be same category or class/alias family
          const classMatch =
            exist.canonical_name.toLowerCase() === det.canonical_name.toLowerCase() ||
            (exist.aliases || []).some((a) => det.aliases.includes(a)) ||
            exist.category === det.category;

          if (classMatch) {
            const dist = Math.hypot(det.centroid.x - exist.centroid.x, det.centroid.y - exist.centroid.y);
            if (dist < minDistance) {
              minDistance = dist;
              bestMatch = exist;
            }
          }
        }

        // Qualitative location description
        const newLocationDesc = this.describeSpatialLocation(det.centroid, landmarks, existingObjects);

        if (bestMatch && minDistance < 0.55) {
          // Object identified!
          matchedExistingIds.add(bestMatch.object_id);
          matchedDetections.add(i);

          if (minDistance >= this.movementThreshold) {
            // VERIFIED MOVEMENT EVENT!
            const eventRecord = {
              event_id: `evt_mv_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
              environment_id: environmentId,
              object_id: bestMatch.object_id,
              event_type: 'moved',
              previous_location: bestMatch.current_location,
              new_location: newLocationDesc,
              timestamp: new Date().toISOString(),
              confidence: Math.min(det.confidence, bestMatch.confidence),
              frame_reference: frameReference,
              verification_status: 'confirmed'
            };
            changes.push(eventRecord);
            await this.storage.recordEvent(eventRecord);

            // Update object location in persistent store
            const updated = await this.storage.saveObject({
              ...bestMatch,
              current_location: newLocationDesc,
              previous_location: bestMatch.current_location,
              last_seen: new Date().toISOString(),
              confidence: det.confidence,
              status: 'confirmed',
              bbox: det.bbox,
              centroid: det.centroid,
              evidence_frame_ref: frameReference
            });
            updatedObjects.push(updated);
          } else {
            // Object remains stable at its current position (no unnecessary event generated)
            const updated = await this.storage.saveObject({
              ...bestMatch,
              last_seen: new Date().toISOString(),
              confidence: det.confidence,
              status: 'confirmed',
              bbox: det.bbox,
              centroid: det.centroid,
              evidence_frame_ref: frameReference
            });
            updatedObjects.push(updated);
          }
        } else {
          // NEW OBJECT APPEARED!
          const newObjId = `obj_${det.canonical_name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Math.random().toString(36).substring(2, 6)}`;
          const newObj = {
            object_id: newObjId,
            environment_id: environmentId,
            canonical_name: det.canonical_name,
            category: det.category,
            aliases: det.aliases,
            visual_description: `Identified ${det.canonical_name} in ${newLocationDesc}`,
            first_seen: new Date().toISOString(),
            last_seen: new Date().toISOString(),
            current_location: newLocationDesc,
            previous_location: null,
            confidence: det.confidence,
            status: 'confirmed',
            bbox: det.bbox,
            centroid: det.centroid,
            evidence_frame_ref: frameReference
          };
          const saved = await this.storage.saveObject(newObj);
          updatedObjects.push(saved);

          const addEvent = {
            event_id: `evt_add_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            environment_id: environmentId,
            object_id: newObjId,
            event_type: 'added',
            previous_location: null,
            new_location: newLocationDesc,
            timestamp: new Date().toISOString(),
            confidence: det.confidence,
            frame_reference: frameReference,
            verification_status: 'confirmed'
          };
          changes.push(addEvent);
          await this.storage.recordEvent(addEvent);
        }
      }

      // STEP 2: Detect Removed or Occluded Objects
      for (const exist of existingObjects) {
        if (!matchedExistingIds.has(exist.object_id) && exist.status === 'confirmed') {
          // Object previously seen is absent from current frame
          const isNearEdge = exist.centroid.x < 0.15 || exist.centroid.x > 0.85 || exist.centroid.y < 0.15 || exist.centroid.y > 0.85;
          const eventType = isNearEdge ? 'removed' : 'occluded';

          const removeEvent = {
            event_id: `evt_rem_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
            environment_id: environmentId,
            object_id: exist.object_id,
            event_type: eventType,
            previous_location: exist.current_location,
            new_location: eventType === 'occluded' ? 'Temporarily occluded from direct line of sight' : 'Removed from desk workspace',
            timestamp: new Date().toISOString(),
            confidence: 0.85,
            frame_reference: frameReference,
            verification_status: 'confirmed'
          };
          changes.push(removeEvent);
          await this.storage.recordEvent(removeEvent);

          const updated = await this.storage.saveObject({
            ...exist,
            status: eventType,
            last_seen: new Date().toISOString()
          });
          updatedObjects.push(updated);
        }
      }

      // Record committed Observation
      const observationRecord = {
        observation_id: `obs_${Date.now()}`,
        environment_id: environmentId,
        timestamp: new Date().toISOString(),
        detected_objects: newDetections.map((d) => d.canonical_name),
        scene_state: changes.length > 0 ? 'modified' : 'stable',
        frame_reference: frameReference,
        confidence: 0.94,
        processing_status: 'verified'
      };
      await this.storage.saveObservation(observationRecord);

      return {
        observation_id: observationRecord.observation_id,
        changes: changes,
        updatedObjects: updatedObjects,
        frame_reference: frameReference
      };
    }
  }

  return PhantomSpatialMemory;
});
