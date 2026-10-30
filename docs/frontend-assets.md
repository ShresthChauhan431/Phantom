# 3D Assets for PHANTOM (SMRITI Spatial Memory Experience)

This repository contains the complete 3D assets, architectural scene setup, interactive motion engine, and web experience for **SMRITI** — an assistive spatial memory system powered by the **PHANTOM** engine.

---

## 📁 Repository Structure

```text
3D-assets-for-Phantom/
├── web/                             # Complete Web Product Experience
│   ├── index.html                   # Editorial Landing Page & Spatial Canvas
│   ├── smriti-experience.js         # Native 60fps Three.js 3D Engine & Camera Choreography
│   ├── style.css                    # Typography (Instrument Serif, Inter) & Responsive Layout
│   └── three.min.js                 # Standalone Three.js library
├── spline/                          # Spline 3D Scene Assets & Motion Layers
│   ├── spline-motion-document.html  # Injected HTML Motion Document (rAF loop & Spline bridge)
│   ├── spline-dsl-setup.js          # Reproducible Spline DSL setup & alignment script
│   ├── scene-structure.txt          # Complete 90-object scene hierarchy and coordinate digest
│   └── README.md                    # Detailed guide for editing in Spline
├── assets/                          # High-resolution render previews and reference captures
│   ├── preview_idle.png             # Front-stage architectural baseline view
│   ├── preview_phantom_reveal.png   # PHANTOM spatial trajectory & ghost glasses reveal
│   ├── preview_resolved.png         # Settled memory resolution view
│   └── preview_mobile.png           # Mobile responsive viewport verification
├── .gitattributes                   # Proper handling for 3D binary models & text files
├── .gitignore                       # Clean ignores to prevent accidental bloat
├── package.json                     # Project scripts and metadata
└── README.md                        # Documentation
```

---

## 🚀 Running the Web Experience Locally

You can preview the interactive experience with zero external dependencies:

```bash
# Option 1: Using Python
python3 -m http.server 8080

# Option 2: Using npm
npm start
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

---

## 🎨 Spline 3D Integration

The Spline scene uses an **architectural front-stage perspective** (`azimuth: 0°`, camera `p = [10, 155, 420]`):
- **Bookshelf**: Flush on the right back wall (`x = 130, z = -225`), facing front.
- **Armchair & Side Table**: Side-by-side midground seating (`x = -55` and `x = -115`).
- **Credenza & Art**: Flush on the left back wall (`x = -125, z = -225`) beneath the framed art.
- **Hero Character**: Centered on the woven rug (`x = 15, y = 68, z = 20`).

To edit or reload the interactive motion in Spline:
1. Open your scene in **Spline**.
2. Go to the **Code** tab / HTML content.
3. Paste the contents of `spline/spline-motion-document.html`.
4. Switch to **Preview** (`▶ Play`) to interact with the full narrative.

---

## 📤 Pushing Updates to GitHub

To push this repository to your GitHub account:

### 1. Create a New Repository on GitHub
Go to [github.com/new](https://github.com/new) and create a repository named:
**`3D-assets-for-Phantom`** (leave "Initialize with README" unchecked).

### 2. Connect Remote and Push
Run the following commands inside this directory:

```bash
# If not already initialized:
git init
git add .
git commit -m "Initial commit: 3D assets, Spline motion documents, and web experience"

# Rename branch to main
git branch -M main

# Add your GitHub repository as origin (replace <YOUR_GITHUB_USERNAME>):
git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/3D-assets-for-Phantom.git

# Push code and assets
git push -u origin main
```

### 3. Pushing Future Updates Without Errors
Whenever you add or update 3D assets or code:
```bash
git add .
git commit -m "Update: description of changes"
git push
```
The repository includes `.gitignore` and `.gitattributes` to ensure large temporary files or binary assets do not break pushes.
