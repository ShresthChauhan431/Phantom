# Ambition

For now, I want to build a system for a hackathon where I can record my table and have the system process the footage. I also want a live-tracking feature that continuously captures video using my phone's camera.

The idea is to connect my phone to my MacBook using a USB-C to USB-C cable, allowing me to use either an Android phone or an iPhone as the camera. I currently don't have a dedicated camera, so I want to use my phone instead.

Here is how I envision the functionality:

- Once my phone is connected to my MacBook via a USB-C cable, the system should automatically detect and connect to the phone's camera.
    
- It should capture a screenshot of the designated table (desk / playground for the system) area every 2–5 seconds.
    
- It should compare each newly captured image with the previous one to detect changes in the positions of objects.
    
- It should identify and track everyday objects such as glasses, bottles, keys, watches, etc.
    
- It should store the captured images and record the positions of detected objects.
    
- It should also maintain nearby reference points so the system can understand and describe an object's position relative to other objects or fixed points on the table.
    

The ultimate goal is to create a system that can continuously monitor a table (desk), detect when objects move, and maintain a record of their positions over time.

# Description

We're building an engine that understands object permanence and the nuance of changes in a place in day-to-day life.  
We aspire to bring down human labour on laborious jobs such as auditing inventories such as Pharmacies, Food-grade inventory (cold storage) and Pantries.

The engine is just what runs in the background of a system that works in multiple setups, such as:

1. **Healthcare & Life Sciences**
    
    1. **Pharmacies and DEA compliance**
        
    2. **Hospitals**
        
    3. **Elder care, dementia, and age-related memory loss**
        
    4. **Surgery and operating rooms**
        
    5. **Clinical and research laboratories**
        
    6. **Blood banks and vaccine cold storage**
        
    7. **Pharmaceutical manufacturing**
        
2. **Logistics, Industry & Warehousing**
    
    1. **Warehouses**
        
    2. **Manufacturing and tool cribs**
        
    3. **Evidence rooms, courts, and law enforcement**
        
    4. **Data centers and server rooms**
        
    5. **Construction sites**
        
    6. **Fleet and garage operations**
        
    7. **Agriculture and food storage**
        
3. **Retail & Commercial**
    
    1. **Retail shelves**
        
    2. **Restaurants and commercial kitchens**
        
    3. **Hotels**
        
    4. **Libraries, archives, and museums**
        
    5. **Banks and vaults**
        
4. **Consumer & Home**
    
    1. **Smart homes**
        
    2. **Family life**
        
    3. **Home inventory for insurance**
        
    4. **Garages, workshops, and hobby spaces**
        
    5. **Moving and self-storage**
        
5. **Safety, Security & Forensics**
    
    1. **Fire and insurance forensics**
        
    2. **Child safety**
        
    3. **Workplace safety**
        
    4. **Lone-worker and hazardous-site monitoring**
        
6. **Accessibility & Cognitive Support**
    
    1. **ADHD, brain injury, and stroke recovery**
        
    2. **Visual impairment**
        
    3. **Low-vision aging-in-place**
        

# Engine

Record & real-time surveillance from any device with a camera (phone).

The engine measures changes, but it doesn't process every second — it uses an anomaly as a trigger:

![[Pasted image 20261030125735.png]]

**What it is**

A local-first AI system that gives a physical space a persistent, queryable memory. Technically: a **Continuous Physical Key-Value Store**. A camera watches a room; a Vision LLM converts what it sees into structured records ("this object, this place, this time"); and those records live in a database the user can search like a search engine. The camera is the disk write head; the database is the memory; the search bar is the interface to reality.

**What it does**

1. **Watches** — a fixed camera continuously monitors a space.
    
2. **Understands** — an AI interprets frames semantically, not just pixels: objects, spatial relations ("behind the laptop"), context.
    
3. **Remembers** — every object gets a record: where it is, when it was last seen, and its full movement history.
    
4. **Answers** — any query ("where's my passport?") returns the last known location, timestamp, confidence, and a highlighted image — in seconds.
    
5. **Detects anomalies** — flags events: "medication hasn't moved in 14 hours," "unauthorized device on the server rack."
    

Its defining property: **it tags nothing and requires no user effort.** Unlike RFID or AirTags, objects don't need to be marked — the room itself is the index. And the raw video is destroyed; only a compact semantic record survives.

# Workflow

1. **CAPTURE (EYE)**
    
    1. No network upload. Frames stay in device memory (RAM buffer).
        
    2. Frames are candidates, never files — nothing is written to disk unless a semantic event validates them.
        
2. **GATE (TRIGGER)**
    
    1. Always-on cheap layer (30 FPS, on-device):
        
        1. Frame-differencing / motion detection.
            
        2. Room static? → discard frame, loop. Zero cost incurred from the VLMs or the system.
            
        3. Change detected? → debounce: wait 1–2s for motion to settle, grab the end-state frame, promote it to Stage 3.
            
3. **UNDERSTAND (BRAIN)**
    
    1. VLM call — LOCAL first (edge hardware), cloud only as escalation.
        
    2. Prompt = previous room state (JSON) + the new frame + the instruction: "What changed?"
        
    3. Output = strict JSON delta:
        
        ```json
         {
           "object": "blue_water_bottle",
           "event": "moved",
           "from": "center of desk",
           "to": "behind laptop",
           "confidence": 0.94,
           "frame_ref": "buf_0412"
         }
        ```
        
    4. Entity resolution: is this the same object as in the log?
        
    5. Cross-check: relational text vs. grounded region agree?
        
    6. Agree → commit. Disagree → re-sample once; still ambiguous → log "ambiguous", never silently overwrite.
        
4. **COMMIT (MEMORY)**
    
    1. The Key-Value Store (local SQLite/JSON, encrypted, user-owned):
        
    2. Key: `blue_water_bottle`
        
    3. Value:
        
        ```json
         {
           "location": "behind laptop",
           "relations": ["left of monitor", "on desk"],
           "last_seen": "14:05:32",
           "confidence": 0.94,
           "history": ["desk 14:02:15", "behind laptop 14:05:32"]
         }
        ```
        
    4. History preserved = the "version control" lineage.
        
    5. Raw pixel data: DESTROYED after Stage 3 (except a transient `frame_ref` for the reveal step, held under a retention cap).
        
    6. Heartbeat re-validation (every 5–10 min) confirms the log still matches reality.
        
5. **QUERY (SEARCH)**
    
    1. User: "Where is the blue water bottle?"
        
    2. Parse query → semantic match against the store (exact key, aliases, fuzzy match: "water bottle" ≈ "bottle").
        
    3. Retrieve latest committed entry + lineage.
        
    4. Rank: latest, highest-confidence, least-ambiguous first.
        
6. **REVEAL (OUTPUT)**
    
    1. The dashboard composes the answer:
        
    2. Last-known image frame fades in (transient `frame_ref`).
        
    3. Grounded bounding box draws itself around the item (pulse).
        
    4. Glass card slides up: "Last seen 12 seconds ago — Behind the laptop — Confidence 94%".
        
    5. Typewriter description, chime, micro-bounce.
        
    6. Trust contract: always shows timestamp + confidence, never bare certainty. Stale entry? UI says so: "Not re-observed for 6 minutes — possibly occluded."
# INTERFACE

How does the user interact with the layers built upon Phantom (home intelligence, inventory, etc.)?

## 1. Search by Name
The user queries an object by its name or alias, and the system returns its last known location and state.

## 2. Search by Sight
The user selects an element directly in the frame and can see:
- how its location changed within the frame
- its previous positions
- the exact points of change for individual objects that have switched places

## 3. Trigger Log & History Tree
For every element in the scope of the system, logging is trigger-based:
- **No trigger, position unchanged** → no history is recorded.
- **Position changed** → the object gets a tree-like UI showing its past locations, with a timestamp for each change.