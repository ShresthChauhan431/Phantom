/**
 * ==============================================================================
 * PHANTOM SPATIAL INTELLIGENCE PLATFORM — SHARED ENGINE
 * Module: Query, Search & Evidence Reveal
 * Capabilities: Deterministic Memory Store Search, Alias Matching, Spatial Intent
 * Evaluation, Evidence Alignment, Movement History Synthesis
 * ==============================================================================
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PhantomSearch = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class PhantomSearch {
    constructor(storage) {
      this.storage = storage;
    }

    /**
     * Parse natural language query and search deterministic local memory store
     * NEVER hallucinates or generates invented answers.
     */
    async executeQuery(environmentId, query) {
      if (!query || typeof query !== 'string') {
        return { success: false, message: 'Please enter a search query.' };
      }

      const raw = query.trim();
      const lower = raw.toLowerCase();

      const allObjects = await this.storage.getAllObjects(environmentId);
      const allEvents = await this.storage.getEvents(environmentId);

      // Case 1: "Which objects moved today?" / "Recent movements"
      if (lower.includes('moved today') || lower.includes('recent move') || lower.includes('what moved')) {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const movedEvents = allEvents.filter(
          (e) => (e.event_type === 'moved' || e.event_type === 'added') && new Date(e.timestamp) >= startOfDay
        );

        return {
          success: true,
          query: raw,
          queryType: 'movement_aggregate',
          summary: `${movedEvents.length} physical changes recorded in this space today`,
          events: movedEvents,
          allObjects: allObjects
        };
      }

      // Case 2: "What was beside / near [Anchor]?"
      const besideMatch = lower.match(/(?:beside|near|next to|behind|left of|right of)\s+(?:the\s+)?([a-z0-9_\s]+)/i);
      if (besideMatch && besideMatch[1]) {
        const anchorTerm = besideMatch[1].trim();
        const anchorObj = this._findBestObjectMatch(anchorTerm, allObjects);

        if (anchorObj) {
          const rels = await this.storage.getRelationshipsForObject(anchorObj.object_id, environmentId);
          return {
            success: true,
            query: raw,
            queryType: 'spatial_relationship',
            anchorObject: anchorObj,
            relationships: rels,
            allObjects: allObjects
          };
        }
      }

      // Case 3: Target object location / status ("Where are my glasses?", "When did the keys move?")
      const targetObj = this._findBestObjectMatch(lower, allObjects);

      if (!targetObj) {
        return {
          success: false,
          query: raw,
          queryType: 'not_found',
          message: `No tracked physical object found matching "${raw}". Verified objects in this space: ${allObjects.map((o) => o.canonical_name).join(', ')}.`
        };
      }

      // Retrieve full history & evidence for found object
      const objectEvents = await this.storage.getEvents(environmentId, { objectId: targetObj.object_id });
      const relationships = await this.storage.getRelationshipsForObject(targetObj.object_id, environmentId);
      const evidence = targetObj.evidence_frame_ref ? await this.storage.getEvidenceFrame(targetObj.evidence_frame_ref) : null;

      // Calculate staleness
      const lastSeenDate = new Date(targetObj.last_seen);
      const elapsedMinutes = Math.round((Date.now() - lastSeenDate.getTime()) / 60000);
      const isStale = elapsedMinutes > 120; // Stale if not verified in over 2 hours

      return {
        success: true,
        query: raw,
        queryType: 'object_evidence_reveal',
        object: targetObj,
        lastKnownLocation: targetObj.current_location,
        previousLocation: targetObj.previous_location,
        lastSeenTime: targetObj.last_seen,
        lastSeenHuman: this._formatTimeAgo(lastSeenDate),
        confidencePercent: Math.round(targetObj.confidence * 100),
        status: targetObj.status,
        isStale: isStale,
        stalenessNote: isStale ? `Last observed ${elapsedMinutes} minutes ago — position may have changed without camera coverage.` : null,
        evidence: evidence,
        movementHistory: objectEvents,
        relationships: relationships
      };
    }

    _findBestObjectMatch(searchStr, objectList) {
      const clean = searchStr.replace(/[?.,!]/g, '').toLowerCase();

      // 1. Exact canonical name match
      let match = objectList.find((o) => clean.includes(o.canonical_name.toLowerCase()));
      if (match) return match;

      // 2. Exact alias match
      for (const obj of objectList) {
        for (const alias of obj.aliases || []) {
          if (clean.includes(alias.toLowerCase())) {
            return obj;
          }
        }
      }

      // 3. Keyword / Word boundary search
      const words = clean.split(/\s+/).filter((w) => !['where', 'is', 'my', 'are', 'the', 'what', 'was', 'last', 'seen', 'when', 'did'].includes(w));
      for (const word of words) {
        if (word.length < 3) continue;
        match = objectList.find(
          (o) =>
            o.canonical_name.toLowerCase().includes(word) ||
            (o.aliases || []).some((a) => a.toLowerCase().includes(word)) ||
            o.category.toLowerCase().includes(word)
        );
        if (match) return match;
      }

      return null;
    }

    _formatTimeAgo(date) {
      const seconds = Math.floor((new Date() - date) / 1000);
      if (seconds < 60) return 'just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
      const days = Math.floor(hours / 24);
      return `${days} day${days === 1 ? '' : 's'} ago`;
    }
  }

  return PhantomSearch;
});
