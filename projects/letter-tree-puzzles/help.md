# Prosodic Tree Animation - Implementation Documentation

This document provides a complete technical explanation of how the prosodic tree animation is implemented, suitable for reproduction in other projects.

## Table of Contents
1. [Overview](#overview)
2. [Data Structure](#data-structure)
3. [Initialization](#initialization)
4. [Growth Algorithm](#growth-algorithm)
5. [Layout System](#layout-system)
6. [Animation & Rendering](#animation--rendering)
7. [Post-Build Transformations](#post-build-transformations)
8. [Camera System](#camera-system)
9. [Complete Code Flow](#complete-code-flow)

---

## Overview

The animation visualizes a prosodic hierarchy from autosegmental metrical phonology. It grows a tree from a single root node (phi) downward through progressively smaller prosodic units, eventually reaching terminal tone nodes (H/L). After the tree is built, it performs a series of transformations representing phonological rules.

**Key Features:**
- Probabilistic branching with realistic timing
- Smooth interpolated movement (no teleporting)
- Automatic camera fitting with padding
- Multi-phase post-build transformations
- Phonologically accurate representation

---

## Data Structure

### TreeNode Class

```javascript
class TreeNode {
  constructor(level, x, y) {
    this.level = level;           // 'PHI', 'OMEGA', 'FOOT', 'SIGMA', 'MU', 'TONE_H', 'TONE_L'
    this.x = x;                   // Current x position (world coordinates)
    this.y = y;                   // Current y position (world coordinates)
    this.targetX = x;             // Target x position for smooth movement
    this.targetY = y;             // Target y position for smooth movement
    this.children = [];           // Array of child TreeNodes
    this.parent = null;           // Reference to parent TreeNode
    this.isTerminal = false;      // True if node cannot branch further
    this.age = 0;                 // Frame counter for fade-in effect
    this.subtreeWidth = 0;        // Calculated width for layout algorithm
  }

  get label() {
    return LEVELS[this.level];    // Returns Greek symbol or letter
  }

  get opacity() {
    return Math.min(1, this.age / 30); // Fade in over 30 frames
  }

  updatePosition() {
    const lerp = 0.15;            // Linear interpolation factor
    this.x += (this.targetX - this.x) * lerp;
    this.y += (this.targetY - this.y) * lerp;
  }
}
```

### Prosodic Levels

```javascript
const LEVELS = {
  PHI: 'φ',        // Phonological phrase (root)
  OMEGA: 'ω',      // Prosodic word
  FOOT: 'Ft',      // Foot
  SIGMA: 'σ',      // Syllable (optional level)
  MU: 'μ',         // Mora
  TONE_H: 'H',     // High tone (terminal)
  TONE_L: 'L'      // Low tone (terminal)
};
```

### Global State Variables

```javascript
let root = null;                    // Root node (phi)
let allNodes = [];                  // Array of all nodes in tree
let includeSigma = false;           // Whether sigma level is included (60% chance)
let activeLevels = [];              // Array of level names in use
let levelYPositions = {};           // Map of level -> y position (0-1000)
let lastBranchAttempt = 0;          // Timestamp of last branching attempt
let cameraX = 0, cameraY = 0;       // Camera center position
let cameraZoomX = 1, cameraZoomY = 1; // Camera zoom factors
```

---

## Initialization

### Level Selection

```javascript
function initTree() {
  allNodes = [];

  // 60% chance to include sigma level
  includeSigma = Math.random() < 0.6;

  // Build active levels array
  activeLevels = ['PHI', 'OMEGA', 'FOOT'];
  if (includeSigma) activeLevels.push('SIGMA');
  activeLevels.push('MU', 'TONE_H');

  // Calculate evenly-spaced Y positions (0 to 1000)
  const spacing = 1000 / (activeLevels.length - 1);
  activeLevels.forEach((level, i) => {
    levelYPositions[level] = i * spacing;
  });
  levelYPositions['TONE_L'] = levelYPositions['TONE_H']; // Same Y as TONE_H

  // Create root node at center (x=0)
  root = new TreeNode('PHI', 0, levelYPositions['PHI']);
  allNodes.push(root);

  lastBranchAttempt = Date.now();
}
```

**Key Points:**
- Sigma inclusion is randomized each run
- Y positions are evenly distributed regardless of which levels are active
- Root starts at x=0 (horizontal center)
- TONE_H and TONE_L share the same Y level

---

## Growth Algorithm

### Branching Timing

```javascript
function attemptBranching() {
  const now = Date.now();
  if (now - lastBranchAttempt < 240) return; // 240ms interval
  lastBranchAttempt = now;

  const leaves = allNodes.filter(n => !n.isTerminal && n.children.length === 0);

  leaves.forEach(node => {
    if (Math.random() > 0.7) return; // 70% chance to branch

    const nextLevel = getNextLevel(node.level);
    if (!nextLevel) return;

    // Branch according to node type...
  });

  updateLayout();
}
```

**Timing Rules:**
- Check for branching every 240ms
- Each eligible leaf has 70% chance to branch on each check
- Nodes that don't branch will be reconsidered next interval

### General Node Branching (PHI, OMEGA, FOOT, SIGMA)

```javascript
// General branching for non-MU nodes
const branchType = Math.random();

if (branchType < 0.7) {
  // Binary branch (70%)
  const offset = 70 + Math.random() * 40; // 70-110 units horizontal offset
  const left = new TreeNode(nextLevel, node.x - offset, node.y);
  const right = new TreeNode(nextLevel, node.x + offset, node.y);
  left.targetY = levelYPositions[nextLevel];
  right.targetY = levelYPositions[nextLevel];
  left.parent = right.parent = node;
  node.children.push(left, right);
  allNodes.push(left, right);
} else if (branchType < 0.85) {
  // Left only (15%)
  const child = new TreeNode(nextLevel, node.x, node.y);
  child.targetY = levelYPositions[nextLevel];
  child.parent = node;
  node.children.push(child);
  allNodes.push(child);
} else {
  // Right only (15%)
  const child = new TreeNode(nextLevel, node.x, node.y);
  child.targetY = levelYPositions[nextLevel];
  child.parent = node;
  node.children.push(child);
  allNodes.push(child);
}
```

**Key Points:**
- Children spawn at parent's Y position, then smoothly descend to their level
- Initial X offset for binary branches creates diagonal appearance
- Horizontal offset is randomized (70-110 units) for natural variation

### Mu → Tone Branching (Special Rules)

```javascript
if (node.level === 'MU') {
  const activeMuCount = countActiveMu(); // Count non-terminal mu nodes
  const isFinalMu = activeMuCount === 1;

  if (isFinalMu && Math.random() < 0.4) {
    // Final mu: 40% chance to emit TWO tones
    const leftTone = Math.random() < 0.5 ? 'TONE_H' : 'TONE_L';
    const rightTone = Math.random() < 0.5 ? 'TONE_H' : 'TONE_L';
    const offset = 70 + Math.random() * 40;

    const left = new TreeNode(leftTone, node.x - offset, node.y);
    const right = new TreeNode(rightTone, node.x + offset, node.y);
    left.targetY = levelYPositions[leftTone];
    right.targetY = levelYPositions[rightTone];
    left.parent = right.parent = node;
    left.isTerminal = right.isTerminal = true;
    node.children.push(left, right);
    allNodes.push(left, right);
    node.isTerminal = true;
  } else {
    // Non-final mu: equal probability (33.3% each)
    const choice = Math.random();
    if (choice < 0.333) {
      // Single high tone
      const tone = new TreeNode('TONE_H', node.x, node.y);
      tone.targetY = levelYPositions['TONE_H'];
      tone.parent = node;
      tone.isTerminal = true;
      node.children.push(tone);
      allNodes.push(tone);
      node.isTerminal = true;
    } else if (choice < 0.666) {
      // Single low tone
      const tone = new TreeNode('TONE_L', node.x, node.y);
      tone.targetY = levelYPositions['TONE_L'];
      tone.parent = node;
      tone.isTerminal = true;
      node.children.push(tone);
      allNodes.push(tone);
      node.isTerminal = true;
    } else {
      // No tone, become terminal
      node.isTerminal = true;
    }
  }
}
```

**Mu Branching Rules:**
1. **Final Mu** (only one mu left): 40% chance to produce two tones, 60% chance to follow non-final rules
2. **Non-Final Mu**: Equal probability of producing H, L, or nothing (each 33.3%)
3. All tone nodes are immediately terminal
4. Mu nodes that produce no tone become terminal

### Helper Functions

```javascript
function getNextLevel(currentLevel) {
  const idx = activeLevels.indexOf(currentLevel);
  if (idx === -1 || idx === activeLevels.length - 1) return null;
  return activeLevels[idx + 1];
}

function countActiveMu() {
  return allNodes.filter(n =>
    n.level === 'MU' && !n.isTerminal && n.children.length === 0
  ).length;
}

function isAnimationComplete() {
  return allNodes.every(n => n.isTerminal || n.children.length > 0);
}
```

---

## Layout System

The layout algorithm ensures proper spacing, prevents overlaps, and centers parents over children.

### Bottom-Up Width Calculation

```javascript
function calculateSubtreeWidth(node) {
  if (node.children.length === 0) {
    node.subtreeWidth = 50; // Minimum spacing for leaves
    return 50;
  }

  const childWidths = node.children.map(c => calculateSubtreeWidth(c));
  node.subtreeWidth = childWidths.reduce((sum, w) => sum + w, 0) +
                      (node.children.length - 1) * 50; // 50 units between siblings
  return node.subtreeWidth;
}
```

### Top-Down Position Assignment

```javascript
function positionNodes(node, centerX) {
  node.targetX = centerX; // Set target position for smooth animation

  if (node.children.length === 0) return;

  if (node.children.length === 1) {
    // Single child: center directly under parent
    positionNodes(node.children[0], centerX);
  } else {
    // Multiple children: distribute symmetrically around center
    const totalWidth = node.children.reduce((sum, c) => sum + c.subtreeWidth, 0) +
                       (node.children.length - 1) * 50;
    let currentX = centerX - totalWidth / 2;

    node.children.forEach(child => {
      const childCenterX = currentX + child.subtreeWidth / 2;
      positionNodes(child, childCenterX);
      currentX += child.subtreeWidth + 50;
    });
  }
}

function updateLayout() {
  if (!root) return;
  calculateSubtreeWidth(root);
  positionNodes(root, 0); // Root stays at x=0
}
```

**Key Principles:**
- Minimum 50-unit spacing between siblings
- Single children align directly under parents
- Parents center themselves over their children's span
- Root remains at x=0 (horizontal center)
- Only `targetX` is set; actual `x` interpolates smoothly

---

## Animation & Rendering

### Main Animation Loop

```javascript
function animate() {
  // 1. Update all node positions and ages
  allNodes.forEach(n => {
    n.age++;
    n.updatePosition(); // Smooth interpolation toward target
  });

  // 2. Attempt branching if tree not complete
  if (!isAnimationComplete()) {
    attemptBranching();
  } else if (!transformStarted) {
    startTransformation(); // Begin post-build transformations
  }

  // 3. Handle transformation phases (see next section)
  handleTransformations();

  // 4. Update camera to fit tree
  updateCamera();

  // 5. Draw everything
  draw();

  requestAnimationFrame(animate);
}
```

### Drawing Function

```javascript
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.font = 'bold 16px JetBrains Mono, Fira Code, monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 1. Draw connectors (solid lines)
  ctx.strokeStyle = '#7cb342'; // accent-green
  ctx.lineWidth = 2;

  allNodes.forEach(node => {
    node.children.forEach(child => {
      // Skip deleted nodes during deletion phase
      if (transformPhase === 'deleting' && nodesToCrossOut.includes(child)) return;

      const parentPos = worldToScreen(node.x, node.y);
      const childPos = worldToScreen(child.x, child.y);

      // Calculate gap around labels (20 units)
      const gap = 20;
      const dx = childPos.x - parentPos.x;
      const dy = childPos.y - parentPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > gap * 2) {
        const startX = parentPos.x + (dx / dist) * gap;
        const startY = parentPos.y + (dy / dist) * gap;
        const endX = childPos.x - (dx / dist) * gap;
        const endY = childPos.y - (dy / dist) * gap;

        ctx.globalAlpha = Math.min(node.opacity, child.opacity);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    });
  });

  // 2. Draw nodes (text labels)
  allNodes.forEach(node => {
    // Handle deletion fade-out
    if (transformPhase === 'deleting' && nodesToCrossOut.includes(node)) {
      const fadeProgress = deleteProgress / DELETE_DURATION;
      ctx.globalAlpha = node.opacity * (1 - fadeProgress);
    } else {
      ctx.globalAlpha = node.opacity;
    }

    const pos = worldToScreen(node.x, node.y);
    ctx.fillStyle = '#7cb342';
    ctx.fillText(node.label, pos.x, pos.y);

    // Draw cross-out line if in crossing-out phase
    if (transformPhase === 'crossing-out' && nodesToCrossOut.includes(node)) {
      const progress = crossOutProgress / CROSS_OUT_DURATION;
      const textWidth = ctx.measureText(node.label).width;
      const lineLength = textWidth * 1.2;

      ctx.beginPath();
      ctx.moveTo(pos.x - lineLength / 2, pos.y);
      ctx.lineTo(pos.x - lineLength / 2 + lineLength * progress, pos.y);
      ctx.stroke();
    }
  });

  // 3. Draw association lines (dashed diagonals)
  if (transformPhase === 'drawing-associations' ||
      transformPhase === 'centering-tones' ||
      transformPhase === 'complete') {
    drawAssociationLines();
  }

  ctx.globalAlpha = 1;
}
```

### Coordinate Transformation

```javascript
function worldToScreen(x, y) {
  return {
    x: (x - cameraX) * cameraZoomX + canvas.width / 2,
    y: (y - cameraY) * cameraZoomY + canvas.height / 2
  };
}
```

---

## Post-Build Transformations

After the tree is complete, it undergoes a series of transformations representing phonological rules.

### Transformation State Machine

```javascript
let transformPhase = 'none'; // Possible values:
// 'none' -> 'crossing-out' -> 'deleting' -> 'moving-tone' ->
// 'drawing-associations' -> 'centering-tones' -> 'complete'

const CROSS_OUT_DURATION = 60;    // frames
const DELETE_DURATION = 30;       // frames
const TONE_MOVE_DURATION = 60;    // frames
const ASSOCIATION_DURATION = 60;  // frames
const CENTERING_DURATION = 60;    // frames
```

### Phase 1: Cross Out Repeated Tones

**Goal:** Mark duplicate consecutive tones for deletion (e.g., H H H L L → keep first H and first L)

```javascript
function findNodesToRemove() {
  const tones = getToneNodesInOrder(); // Sorted left-to-right by x position
  const toRemove = [];

  for (let i = 1; i < tones.length; i++) {
    const prev = tones[i - 1];
    const curr = tones[i];

    // If current tone matches previous AND previous is not marked for removal
    if (curr.level === prev.level && !toRemove.includes(prev)) {
      toRemove.push(curr);
    }
    // If current matches previous AND previous IS marked for removal (continuing sequence)
    else if (curr.level === prev.level && toRemove.includes(prev)) {
      toRemove.push(curr);
    }
  }

  return toRemove;
}

// In animation loop:
if (transformPhase === 'crossing-out') {
  crossOutProgress++;
  if (crossOutProgress >= CROSS_OUT_DURATION) {
    transformPhase = 'deleting';
    deleteProgress = 0;
  }
}
```

**Visual Effect:** A horizontal line animates across each marked tone over 60 frames.

### Phase 2: Delete Crossed-Out Tones

```javascript
if (transformPhase === 'deleting') {
  deleteProgress++;
  if (deleteProgress >= DELETE_DURATION) {
    // Actually remove nodes from tree
    nodesToCrossOut.forEach(node => {
      const index = allNodes.indexOf(node);
      if (index > -1) allNodes.splice(index, 1);

      // Remove from parent's children
      if (node.parent) {
        const childIndex = node.parent.children.indexOf(node);
        if (childIndex > -1) node.parent.children.splice(childIndex, 1);
      }
    });

    // Proceed to next phase
    if (checkToneMovement()) {
      transformPhase = 'moving-tone';
    } else {
      calculateAssociationLines();
      transformPhase = 'drawing-associations';
    }

    updateLayout();
  }
}
```

**Visual Effect:** Marked tones and their connectors fade out over 30 frames.

### Phase 3: Move Tone to Final Mu (Optional)

**Goal:** If the rightmost mu has no tone, move the rightmost tone to it.

```javascript
function checkToneMovement() {
  const muNodes = allNodes.filter(n => n.level === 'MU');
  if (muNodes.length === 0) return false;

  const rightmostMu = muNodes.reduce((max, node) => node.x > max.x ? node : max);
  const hasTone = rightmostMu.children.some(c =>
    c.level === 'TONE_H' || c.level === 'TONE_L'
  );

  if (!hasTone) {
    const toneNodes = getToneNodesInOrder();
    if (toneNodes.length > 0) {
      toneToMove = toneNodes[toneNodes.length - 1];
      targetMu = rightmostMu;
      originalTonePos = { x: toneToMove.x, y: toneToMove.y };
      return true;
    }
  }

  return false;
}

// In animation loop:
if (transformPhase === 'moving-tone') {
  toneMovementProgress++;

  const progress = toneMovementProgress / TONE_MOVE_DURATION;
  const easeProgress = progress * progress * (3 - 2 * progress); // Smooth ease

  toneToMove.targetX = originalTonePos.x + (targetMu.x - originalTonePos.x) * easeProgress;
  toneToMove.targetY = originalTonePos.y +
                       (levelYPositions[toneToMove.level] - originalTonePos.y) * easeProgress;

  if (toneMovementProgress >= TONE_MOVE_DURATION) {
    // Complete the move
    toneToMove.parent.children.splice(toneToMove.parent.children.indexOf(toneToMove), 1);
    toneToMove.parent = targetMu;
    targetMu.children.push(toneToMove);

    calculateAssociationLines();
    transformPhase = 'drawing-associations';
    updateLayout();
  }
}
```

**Visual Effect:** Tone smoothly moves to new position; old connection fades out, new connection fades in.

### Phase 4: Draw Association Lines

**Goal:** Draw dashed diagonal lines from each tone to the last non-tone mu before the next tone.

```javascript
function calculateAssociationLines() {
  associationLines = [];
  const muNodes = allNodes.filter(n => n.level === 'MU').sort((a, b) => a.x - b.x);

  for (let i = 0; i < muNodes.length; i++) {
    const currentMu = muNodes[i];
    const hasTone = currentMu.children.some(c =>
      c.level === 'TONE_H' || c.level === 'TONE_L'
    );

    if (hasTone) {
      const tone = currentMu.children.find(c =>
        c.level === 'TONE_H' || c.level === 'TONE_L'
      );

      // Find subsequent non-tone mus
      let lastNonToneMu = null;
      for (let j = i + 1; j < muNodes.length; j++) {
        const nextMu = muNodes[j];
        const nextHasTone = nextMu.children.some(c =>
          c.level === 'TONE_H' || c.level === 'TONE_L'
        );

        if (nextHasTone) break; // Hit another tone, stop
        lastNonToneMu = nextMu;
      }

      if (lastNonToneMu) {
        associationLines.push({ fromTone: tone, toMu: lastNonToneMu });
      }
    }
  }
}

function drawAssociationLines() {
  const progress = (transformPhase === 'centering-tones' || transformPhase === 'complete')
    ? 1
    : (associationProgress / ASSOCIATION_DURATION);

  ctx.strokeStyle = '#7cb342';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // Dashed line

  associationLines.forEach(({ fromTone, toMu }) => {
    const tonePos = worldToScreen(fromTone.x, fromTone.y);
    const muPos = worldToScreen(toMu.x, toMu.y);

    // Calculate line with gap clearance
    const gap = 20;
    const dx = muPos.x - tonePos.x;
    const dy = muPos.y - tonePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > gap * 2) {
      const startX = tonePos.x + (dx / dist) * gap;
      const startY = tonePos.y + (dy / dist) * gap;
      const endX = muPos.x - (dx / dist) * gap;
      const endY = muPos.y - (dy / dist) * gap;

      const lineDx = endX - startX;
      const lineDy = endY - startY;
      const currentEndX = startX + lineDx * progress;
      const currentEndY = startY + lineDy * progress;

      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(currentEndX, currentEndY);
      ctx.stroke();
    }
  });

  ctx.setLineDash([]); // Reset to solid
}
```

**Visual Effect:** Dashed diagonal lines animate from each tone up to the last mu in its span, creating triangular patterns.

### Phase 5: Center Tones

**Goal:** Move tones to the horizontal midpoint between their parent mu and their association target.

```javascript
function calculateToneCentering() {
  toneCenteringData = [];

  associationLines.forEach(({ fromTone, toMu }) => {
    const parentMu = fromTone.parent;
    if (parentMu) {
      const centerX = (parentMu.x + toMu.x) / 2;
      toneCenteringData.push({
        tone: fromTone,
        originalX: fromTone.x,
        targetX: centerX
      });
    }
  });
}

// In animation loop:
if (transformPhase === 'centering-tones') {
  centeringProgress++;

  const progress = centeringProgress / CENTERING_DURATION;
  const easeProgress = progress * progress * (3 - 2 * progress);

  toneCenteringData.forEach(({ tone, originalX, targetX }) => {
    tone.targetX = originalX + (targetX - originalX) * easeProgress;
  });

  if (centeringProgress >= CENTERING_DURATION) {
    toneCenteringData.forEach(({ tone, targetX }) => {
      tone.targetX = targetX;
      tone.x = targetX;
    });
    transformPhase = 'complete';
  }
}
```

**Visual Effect:** Tones slide horizontally to center position. Solid line to parent mu and dashed line to target mu both remain visible.

---

## Camera System

The camera automatically zooms and pans to keep the entire tree visible with padding.

```javascript
function updateCamera() {
  if (allNodes.length === 0) return;

  // Find bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  allNodes.forEach(node => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });

  // Add padding
  const padding = 80;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  const treeWidth = maxX - minX;
  const treeHeight = maxY - minY;

  // Calculate zoom to fit canvas
  cameraZoomX = canvas.width / treeWidth;
  cameraZoomY = canvas.height / treeHeight;

  // Center camera on tree
  cameraX = (minX + maxX) / 2;
  cameraY = (minY + maxY) / 2;
}
```

### Canvas Sizing

```javascript
function resizeCanvas() {
  const rect = canvas.parentElement.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
  updateCamera();
}

window.addEventListener('resize', resizeCanvas);
```

---

## Complete Code Flow

### Startup Sequence

1. **Page Load**
   - `resizeCanvas()` - Set canvas dimensions
   - `initTree()` - Create root node, determine levels
   - `animate()` - Start animation loop

### Animation Loop Flow

```
animate() {
  1. Update all nodes:
     - Increment age (for fade-in)
     - Call updatePosition() (smooth movement)

  2. Growth phase:
     - If tree incomplete: attemptBranching()
       - For each leaf: 70% chance to branch
       - Create children at parent's Y, set targetY to correct level
       - Call updateLayout() to recalculate positions
     - If complete and not transformed: startTransformation()

  3. Transformation phase (state machine):
     - 'crossing-out': Draw lines across duplicate tones (60 frames)
     - 'deleting': Fade out crossed tones (30 frames)
     - 'moving-tone': Move last tone to final mu if needed (60 frames)
     - 'drawing-associations': Draw dashed lines (60 frames)
     - 'centering-tones': Move tones to midpoint (60 frames)
     - 'complete': Done

  4. Camera update:
     - Calculate bounding box of all nodes
     - Add padding
     - Compute zoom and center

  5. Draw:
     - Clear canvas
     - Draw all connectors (with gaps)
     - Draw all node labels (with opacity)
     - Draw association lines if active

  6. requestAnimationFrame(animate)
}
```

### Key Timing Constants

```javascript
BRANCH_INTERVAL = 240;           // ms between branch attempts
BRANCH_PROBABILITY = 0.7;        // 70% chance per attempt
FADE_IN_FRAMES = 30;             // Frames for node fade-in
POSITION_LERP = 0.15;            // Smooth movement factor
CROSS_OUT_DURATION = 60;         // Frames
DELETE_DURATION = 30;            // Frames
TONE_MOVE_DURATION = 60;         // Frames
ASSOCIATION_DURATION = 60;       // Frames
CENTERING_DURATION = 60;         // Frames
```

---

## Reproduction Checklist

To reproduce this animation in another project:

### Core Requirements

- [ ] Canvas element for rendering
- [ ] requestAnimationFrame loop
- [ ] TreeNode class with position interpolation
- [ ] Level hierarchy and Y position calculation
- [ ] Branching algorithm with probabilistic timing
- [ ] Layout algorithm (bottom-up width, top-down positioning)
- [ ] Camera system (bounding box + zoom)
- [ ] Coordinate transformation (world → screen)

### Visual Requirements

- [ ] Node fade-in effect
- [ ] Connector drawing with gap clearance
- [ ] Cross-out line animation
- [ ] Fade-out deletion
- [ ] Dashed diagonal association lines
- [ ] Smooth eased movements for transformations

### Transformation Requirements

- [ ] Find and mark repeated consecutive tones
- [ ] Delete marked nodes
- [ ] Optional tone movement to final mu
- [ ] Calculate association spans (tone to last non-tone mu)
- [ ] Center tones between parent and target mu

### Configuration

- [ ] Prosodic level names and symbols
- [ ] Color scheme (#7cb342 green)
- [ ] Font (bold 16px monospace)
- [ ] Timing constants
- [ ] Probability values

---

## Advanced Customization Options

### Adjusting Growth Speed

```javascript
// Faster growth
BRANCH_INTERVAL = 120;           // Half the time between attempts
BRANCH_PROBABILITY = 0.85;       // Higher success rate

// Slower growth
BRANCH_INTERVAL = 500;
BRANCH_PROBABILITY = 0.5;
```

### Changing Sigma Frequency

```javascript
// Always include sigma
includeSigma = true;

// Never include sigma
includeSigma = false;

// 80% chance
includeSigma = Math.random() < 0.8;
```

### Modifying Movement Smoothness

```javascript
// Faster snapping (0.3 = moves 30% of distance per frame)
const lerp = 0.3;

// Slower, smoother (0.05 = very gradual)
const lerp = 0.05;
```

### Adding More Levels

```javascript
// Example: Add syllable onset/coda level between sigma and mu
const LEVELS = {
  // ... existing levels
  ONSET: 'On',
  CODA: 'Co'
};

activeLevels = ['PHI', 'OMEGA', 'FOOT', 'SIGMA', 'ONSET', 'CODA', 'MU', 'TONE_H'];
```

---

## Troubleshooting

### Common Issues

**Nodes teleporting instead of moving smoothly:**
- Ensure `targetX/Y` is set instead of `x/y` directly
- Verify `updatePosition()` is called every frame
- Check that new nodes spawn at parent's position

**Tree growing off-screen:**
- Increase padding in `updateCamera()`
- Verify bounding box calculation includes all nodes
- Check that `updateCamera()` is called after layout changes

**Association lines not appearing:**
- Ensure `calculateAssociationLines()` is called after deletions
- Verify mu nodes are sorted by X position
- Check that tone detection logic correctly identifies tones

**Layout collisions/overlaps:**
- Increase minimum spacing (change 50 to larger value)
- Verify `calculateSubtreeWidth()` is called before positioning
- Check that layout updates after every branching

---

## Performance Considerations

- **Node count:** Typical trees have 50-200 nodes; animation handles this easily
- **Canvas size:** Performance scales with canvas dimensions; 150x800px is optimal
- **Transformation complexity:** O(n) for most operations, O(n²) for association line calculation
- **Memory:** Each node is ~200 bytes; 200 nodes = 40KB

### Optimization Tips

1. **Spatial partitioning:** For very large trees (>500 nodes), consider quadtree for collision detection
2. **Culling:** Skip drawing nodes outside camera view
3. **Reduce draw calls:** Batch similar operations
4. **Canvas layer separation:** Use separate canvas for static tree structure and animated elements

---

## Mathematical Details

### Easing Function (Smoothstep)

```javascript
const easeProgress = progress * progress * (3 - 2 * progress);
```

This produces S-curve interpolation:
- Slow start (acceleration)
- Linear middle
- Slow end (deceleration)

### Linear Interpolation (Lerp)

```javascript
newValue = oldValue + (target - oldValue) * lerp;
```

With `lerp = 0.15`:
- Each frame moves 15% closer to target
- Asymptotic approach (never quite reaches, but gets very close)
- Produces smooth, natural motion

### Layout Space Coordinate System

```
World Coordinates:
- X: -∞ to +∞ (root at 0)
- Y: 0 (top) to 1000 (bottom)

Screen Coordinates:
- X: 0 to canvas.width
- Y: 0 to canvas.height

Transformation:
screenX = (worldX - cameraX) * cameraZoomX + canvas.width / 2
screenY = (worldY - cameraY) * cameraZoomY + canvas.height / 2
```

---

## References

### Phonological Concepts

- **Prosodic Hierarchy:** The nested structure of phonological units (Nespor & Vogel, 1986)
- **Autosegmental Representation:** Tones on separate tier from segments (Goldsmith, 1976)
- **Tonal Association:** How tones link to tone-bearing units (Leben, 1973)
- **OCP (Obligatory Contour Principle):** Constraint against identical adjacent tones

### Technical References

- Canvas API: [MDN Canvas Tutorial](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial)
- requestAnimationFrame: [MDN RAF](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- Easing functions: [easings.net](https://easings.net/)

---

## License & Attribution

This implementation was created for visualizing prosodic structures in autosegmental metrical phonology. Free to use and modify for educational and research purposes.

**Created:** 2025
**Language:** JavaScript (ES6+)
**Dependencies:** None (vanilla JS + Canvas API)

---

**END OF DOCUMENTATION**
