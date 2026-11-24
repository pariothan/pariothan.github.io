// --- Prosodic Tree Animation ---
// Grows a prosodic tree (φ → ω → Ft → σ → μ → tones), then runs a few tone rules
// over it. It regrows every time you switch pages. It is drawn on every
// <canvas class="tree-canvas"> on the page; right now that is just the one in the side column.
(function() {
  // One "view" per canvas. width/height are in CSS pixels (the canvas itself is
  // bigger on retina screens); opacity and font size come from style.css.
  const views = Array.from(document.querySelectorAll('.tree-canvas')).map(canvas => ({
    canvas,
    ctx: canvas.getContext('2d'),
    width: 0,
    height: 0,
    opacity: 1,
    fontSize: 16
  }));
  if (views.length === 0) return;

  // The view being drawn right now
  let view = views[0];
  let ctx = view.ctx;

  // Colours come from the variables at the top of style.css
  const css = getComputedStyle(document.documentElement);
  const cssColor = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  const LINE_COLOR = '#8a9099';
  const LEVEL_COLORS = {
    PHI: cssColor('--accent-yellow', '#ff9800'),
    OMEGA: cssColor('--accent-purple', '#ba68c8'),
    FOOT: cssColor('--accent-blue', '#4285f4'),
    SIGMA: cssColor('--accent-green', '#7cb342'),
    MU: cssColor('--ink', '#e8eaed'),
    TONE_H: cssColor('--accent-yellow', '#ff9800'),
    TONE_L: cssColor('--accent-blue', '#4285f4')
  };

  // ===== CONFIGURABLE ANIMATION SPEEDS =====
  // Adjust these values to control animation timing
  // Lower values = faster animation

  const BRANCH_INTERVAL = 120;      // Milliseconds between branching attempts (tree growth speed)
  const FADE_IN_FRAMES = 30;        // Frames for new nodes to fade in
  const FADE_OUT_DURATION = 15;     // Frames for tree rebuild fade-out (bottom-up)
  const CROSS_OUT_DURATION = 20;    // Frames to draw cross-out lines on duplicate tones
  const DELETE_DURATION = 10;       // Frames to fade out deleted nodes
  const TONE_MOVE_DURATION = 30;    // Frames to move tone to final mu
  const DEFAULT_TONE_DURATION = 30; // Frames to fade in default tone
  const ASSOCIATION_DURATION = 40;  // Frames to draw association lines
  const CENTERING_DURATION = 30;    // Frames to center tones between mus
  const POSITION_LERP = 0.15;       // Smooth movement speed (0.05=slow, 0.3=fast)

  // ============================================

  // Prosodic level names
  const LEVELS = {
    PHI: 'φ',
    OMEGA: 'ω',
    FOOT: 'Ft',
    SIGMA: 'σ',
    MU: 'μ',
    TONE_H: 'H',
    TONE_L: 'L'
  };

  // Node class
  class TreeNode {
    constructor(level, x, y) {
      this.level = level;
      this.x = x;
      this.y = y;
      this.targetX = x; // Target position for smooth movement
      this.targetY = y;
      this.children = [];
      this.parent = null;
      this.isTerminal = false;
      this.age = 0; // for fade-in
      this.subtreeWidth = 0; // for layout
    }

    get label() {
      return LEVELS[this.level];
    }

    get opacity() {
      return Math.min(1, this.age / FADE_IN_FRAMES);
    }

    get isTone() {
      return this.level === 'TONE_H' || this.level === 'TONE_L';
    }

    get hasTone() {
      return this.children.some(c => c.isTone);
    }

    // Smoothly move towards target position
    updatePosition() {
      this.x += (this.targetX - this.x) * POSITION_LERP;
      this.y += (this.targetY - this.y) * POSITION_LERP;
    }
  }

  // Tree state
  let root = null;
  let allNodes = [];
  let activeLevels = [];
  let levelYPositions = {};
  let lastBranchAttempt = 0;
  let cameraX = 0, cameraY = 0, cameraZoomX = 1, cameraZoomY = 1;

  // State for post-build transformation
  let transformStarted = false;
  let transformPhase = 'none'; // 'none', 'crossing-out', 'deleting', 'moving-tone', 'adding-default-tone', 'drawing-associations', 'complete'
  let nodesToCrossOut = [];
  let crossOutProgress = 0;
  let deleteProgress = 0;
  let toneToMove = null;
  let targetMu = null;
  let toneMovementProgress = 0;
  let originalTonePos = null;
  let associationLines = []; // Array of {fromTone, toMu} pairs
  let associationProgress = 0;
  let toneCenteringData = []; // Array of {tone, originalX, targetX}
  let centeringProgress = 0;
  let defaultToneProgress = 0;

  // State for rebuild fade-out animation
  let isRebuilding = false;
  let fadeOutProgress = 0;
  let fadeMinY = 0, fadeMaxY = 0;

  // People who've asked their computer for less motion get the finished tree, no animation
  const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // The loop goes to sleep once the tree is finished, and wakes up for a rebuild or resize
  let running = false;
  let lastFrame = 0;
  let settledFrames = 0;

  // Pick which levels this tree has (sigma is optional) and where they sit vertically
  function pickLevels() {
    activeLevels = ['PHI', 'OMEGA', 'FOOT'];
    if (Math.random() < 0.6) activeLevels.push('SIGMA');
    activeLevels.push('MU', 'TONE_H'); // TONE_H/L are both at same level

    // Calculate y positions (evenly spaced from 0 to 1000)
    const spacing = 1000 / (activeLevels.length - 1);
    activeLevels.forEach((level, i) => {
      levelYPositions[level] = i * spacing;
    });
    levelYPositions['TONE_L'] = levelYPositions['TONE_H']; // same y
  }

  // Initialize tree
  function initTree() {
    pickLevels();
    root = new TreeNode('PHI', 0, levelYPositions['PHI']);
    allNodes = [root];
    lastBranchAttempt = Date.now();
  }

  // Get next level in hierarchy
  function getNextLevel(currentLevel) {
    const idx = activeLevels.indexOf(currentLevel);
    if (idx === -1 || idx === activeLevels.length - 1) return null;
    return activeLevels[idx + 1];
  }

  // New nodes start on top of their parent and slide down into place
  function addChild(parent, level, xOffset = 0) {
    const child = new TreeNode(level, parent.x + xOffset, parent.y);
    child.targetY = levelYPositions[level];
    child.parent = parent;
    child.isTerminal = child.isTone;
    parent.children.push(child);
    allNodes.push(child);
    return child;
  }

  function addPair(parent, leftLevel, rightLevel) {
    const offset = 70 + Math.random() * 40;
    addChild(parent, leftLevel, -offset);
    addChild(parent, rightLevel, offset);
  }

  function randomTone() {
    return Math.random() < 0.5 ? 'TONE_H' : 'TONE_L';
  }

  // Count active mu nodes (not terminal, not tones)
  function countActiveMu() {
    return allNodes.filter(n => n.level === 'MU' && !n.isTerminal && n.children.length === 0).length;
  }

  // Attempt branching for all eligible nodes
  function attemptBranching() {
    const now = Date.now();
    if (now - lastBranchAttempt < BRANCH_INTERVAL) return;
    lastBranchAttempt = now;

    // Get all non-terminal leaves
    const leaves = allNodes.filter(n => !n.isTerminal && n.children.length === 0);

    leaves.forEach(node => {
      if (Math.random() > 0.7) return; // 70% chance to branch

      const nextLevel = getNextLevel(node.level);
      if (!nextLevel) return;

      if (node.level === 'MU') {
        // MU -> TONE
        const isFinalMu = countActiveMu() === 1;

        if (isFinalMu && Math.random() < 0.4) {
          // The last mu has a 40% chance to emit two tones
          addPair(node, randomTone(), randomTone());
        } else {
          // Otherwise: equal chance of H, L, or nothing
          const choice = Math.random();
          if (choice < 0.333) {
            addChild(node, 'TONE_H');
          } else if (choice < 0.666) {
            addChild(node, 'TONE_L');
          }
        }
        node.isTerminal = true;
      } else if (node.level === 'FOOT' || Math.random() < 0.7) {
        // Binary branch: always for feet, 70% for everything else
        addPair(node, nextLevel, nextLevel);
      } else {
        // Single child
        addChild(node, nextLevel);
      }
    });

    // After branching, update layout
    updateLayout();
  }

  // Update horizontal layout
  function updateLayout() {
    if (!root) return;

    // Calculate subtree widths bottom-up
    function calculateSubtreeWidth(node) {
      if (node.children.length === 0) {
        node.subtreeWidth = 50; // minimum spacing
        return 50;
      }

      const childWidths = node.children.map(c => calculateSubtreeWidth(c));
      node.subtreeWidth = childWidths.reduce((sum, w) => sum + w, 0) + (node.children.length - 1) * 50;
      return node.subtreeWidth;
    }

    calculateSubtreeWidth(root);

    // Position nodes top-down, centering parents over children
    function positionNodes(node, centerX) {
      node.targetX = centerX; // Set target position for smooth animation

      // (a single child ends up straight under its parent)
      let currentX = centerX - node.subtreeWidth / 2;
      node.children.forEach(child => {
        positionNodes(child, currentX + child.subtreeWidth / 2);
        currentX += child.subtreeWidth + 50;
      });
    }

    // Start positioning from root at x=0
    positionNodes(root, 0);
  }

  // Update camera to fit the tree into the current view
  function updateCamera() {
    if (allNodes.length === 0) return;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    allNodes.forEach(node => {
      minX = Math.min(minX, node.x);
      maxX = Math.max(maxX, node.x);
      minY = Math.min(minY, node.y);
      maxY = Math.max(maxY, node.y);
    });

    // Add padding (increased to prevent edge clipping)
    const padding = 80;
    minX -= padding;
    maxX += padding;
    minY -= padding;
    maxY += padding;

    // Calculate zoom to fit (but don't let a small tree stretch right across a big canvas)
    cameraZoomX = Math.min(view.width / (maxX - minX), 2.2);
    cameraZoomY = view.height / (maxY - minY);

    // Center camera
    cameraX = (minX + maxX) / 2;
    cameraY = (minY + maxY) / 2;
  }

  // Transform world coordinates to screen
  function worldToScreen(x, y) {
    return {
      x: (x - cameraX) * cameraZoomX + view.width / 2,
      y: (y - cameraY) * cameraZoomY + view.height / 2
    };
  }

  // How far something at height y has faded during a rebuild (0 = still there, 1 = gone).
  // The tree fades out from the bottom up, with phi going last.
  function rebuildFade(y) {
    if (!isRebuilding) return 0;
    const yRange = fadeMaxY - fadeMinY;
    const nodeProgress = yRange > 0 ? 1 - (y - fadeMinY) / yRange : 0;
    const overallProgress = fadeOutProgress / FADE_OUT_DURATION;
    const fadeStart = nodeProgress * 0.7; // Stagger the fades
    const fadeDuration = 0.3;
    return Math.max(0, Math.min(1, (overallProgress - fadeStart) / fadeDuration));
  }

  // Line between two screen points, leaving a gap around the labels at each end.
  // With progress < 1 only the first part of the line gets drawn.
  function drawLink(from, to, opacity, progress = 1) {
    const gap = view.fontSize * 1.25;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist <= gap * 2) return;

    const startX = from.x + (dx / dist) * gap;
    const startY = from.y + (dy / dist) * gap;
    const endX = to.x - (dx / dist) * gap;
    const endY = to.y - (dy / dist) * gap;

    ctx.globalAlpha = opacity * view.opacity;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(startX + (endX - startX) * progress, startY + (endY - startY) * progress);
    ctx.stroke();
  }

  // Draw the tree on the current view
  function draw() {
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.font = `bold ${view.fontSize}px JetBrains Mono, Fira Code, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth = view.fontSize > 20 ? 2.5 : 2;

    fadeMinY = Math.min(...allNodes.map(n => n.y));
    fadeMaxY = Math.max(...allNodes.map(n => n.y));

    // Draw connectors first
    allNodes.forEach(node => {
      node.children.forEach(child => {
        // Skip connectors to nodes being deleted
        if (transformPhase === 'deleting' && nodesToCrossOut.includes(child)) return;

        // During tone movement, fade out old connection, draw new one
        if (transformPhase === 'moving-tone' && child === toneToMove) {
          const progress = toneMovementProgress / TONE_MOVE_DURATION;
          drawLink(worldToScreen(node.x, node.y), worldToScreen(originalTonePos.x, originalTonePos.y), 1 - progress);
          drawLink(worldToScreen(targetMu.x, targetMu.y), worldToScreen(child.x, child.y), progress);
          return;
        }

        // Bottom-up fade uses the child's height
        const lineOpacity = Math.min(node.opacity, child.opacity) * (1 - rebuildFade(child.y));

        // Use dashed line for default tones
        if (child.isDefault) ctx.setLineDash([5, 5]);
        drawLink(worldToScreen(node.x, node.y), worldToScreen(child.x, child.y), lineOpacity);
        if (child.isDefault) ctx.setLineDash([]);
      });
    });

    // Draw nodes
    allNodes.forEach(node => {
      let nodeOpacity = node.opacity * (1 - rebuildFade(node.y));

      // Handle deletion phase - fade out
      if (transformPhase === 'deleting' && nodesToCrossOut.includes(node)) {
        nodeOpacity = node.opacity * (1 - deleteProgress / DELETE_DURATION);
      }

      ctx.globalAlpha = nodeOpacity * view.opacity;

      // each level of the hierarchy has its own colour
      const pos = worldToScreen(node.x, node.y);
      ctx.fillStyle = LEVEL_COLORS[node.level];
      ctx.fillText(node.label, pos.x, pos.y);

      // Draw cross-out line
      if (transformPhase === 'crossing-out' && nodesToCrossOut.includes(node)) {
        const progress = crossOutProgress / CROSS_OUT_DURATION;
        const lineLength = ctx.measureText(node.label).width * 1.2;
        const startX = pos.x - lineLength / 2;

        ctx.globalAlpha = node.opacity * view.opacity;
        ctx.strokeStyle = LEVEL_COLORS.MU;
        ctx.beginPath();
        ctx.moveTo(startX, pos.y);
        ctx.lineTo(startX + lineLength * progress, pos.y);
        ctx.stroke();
        ctx.strokeStyle = LINE_COLOR;
      }
    });

    // Draw association lines (tone to non-tone mus)
    if (transformPhase === 'drawing-associations' || transformPhase === 'complete') {
      const progress = transformPhase === 'complete' ? 1 : (associationProgress / ASSOCIATION_DURATION);
      ctx.setLineDash([5, 5]); // Dashed line to distinguish from tree structure

      // Diagonal line from the tone up to the mu, creating a triangular span
      associationLines.forEach(({ fromTone, toMu }) => {
        drawLink(
          worldToScreen(fromTone.x, fromTone.y),
          worldToScreen(toMu.x, toMu.y),
          0.8 * (1 - rebuildFade(fromTone.y)),
          progress
        );
      });

      ctx.setLineDash([]); // Reset to solid line
    }

    ctx.globalAlpha = 1;
  }

  // Check if the tree has finished growing
  function isAnimationComplete() {
    return allNodes.every(n => n.isTerminal || n.children.length > 0);
  }

  // Start rebuild animation sequence
  function startRebuild() {
    if (isRebuilding) return;
    isRebuilding = true;
    fadeOutProgress = 0;
    settledFrames = 0;
    // switching pages can show or hide a canvas (the big one is only on the ME page)
    resizeCanvas();
  }

  // Get all tone nodes in left-to-right order
  function getToneNodesInOrder() {
    return allNodes.filter(n => n.isTone).sort((a, b) => a.x - b.x);
  }

  // Get all mu nodes in left-to-right order
  function getMuNodesInOrder() {
    return allNodes.filter(n => n.level === 'MU').sort((a, b) => a.x - b.x);
  }

  // Find nodes to remove: any tone that just repeats the tone before it
  function findNodesToRemove() {
    const tones = getToneNodesInOrder();
    return tones.filter((tone, i) => i > 0 && tone.level === tones[i - 1].level);
  }

  // Check if we need to move a tone to the final mu
  function checkToneMovement() {
    const muNodes = getMuNodesInOrder();
    if (muNodes.length === 0) return false;

    const rightmostMu = muNodes[muNodes.length - 1];
    if (rightmostMu.hasTone) return false;

    // Move the rightmost tone over
    const toneNodes = getToneNodesInOrder();
    if (toneNodes.length === 0) return false;

    toneToMove = toneNodes[toneNodes.length - 1];
    targetMu = rightmostMu;
    originalTonePos = { x: toneToMove.x, y: toneToMove.y };
    return true;
  }

  // Check if we need to add a default L tone to the first mu
  function checkDefaultTone() {
    const muNodes = getMuNodesInOrder();
    if (muNodes.length === 0) return false;

    const firstMu = muNodes[0];
    if (firstMu.hasTone) return false;

    // Create default L tone at first mu's position (fades in from transparent)
    const defaultTone = addChild(firstMu, 'TONE_L');
    defaultTone.isDefault = true; // Mark as default tone (drawn with a dashed line)
    return true;
  }

  // Calculate association lines from tones to following non-tone mus
  function calculateAssociationLines() {
    associationLines = [];

    const muNodes = getMuNodesInOrder();

    // For each mu with a tone, find subsequent non-tone mus
    for (let i = 0; i < muNodes.length; i++) {
      if (!muNodes[i].hasTone) continue;
      const tone = muNodes[i].children.find(c => c.isTone);

      // Find all subsequent non-tone mus until we hit another tone-mu or end
      let lastNonToneMu = null;
      for (let j = i + 1; j < muNodes.length; j++) {
        if (muNodes[j].hasTone) break;
        lastNonToneMu = muNodes[j];
      }

      // If we found non-tone mus, draw line to the last one
      if (lastNonToneMu) {
        associationLines.push({ fromTone: tone, toMu: lastNonToneMu });
      }
    }
  }

  // Calculate centering positions for tones with association lines
  function calculateToneCentering() {
    toneCenteringData = [];

    associationLines.forEach(({ fromTone, toMu }) => {
      const parentMu = fromTone.parent;
      if (!parentMu) return;

      // If the parent mu has two tones, measure from the rightmost one
      let parentX = parentMu.x;
      if (parentMu.children.length > 1) {
        parentX = Math.max(...parentMu.children.map(c => c.x));
      }

      // Same for the target mu, but from its leftmost child
      let targetX = toMu.x;
      if (toMu.children.length > 1) {
        targetX = Math.min(...toMu.children.map(c => c.x));
      }

      // Center the tone between the two
      toneCenteringData.push({
        tone: fromTone,
        originalX: fromTone.x,
        targetX: (parentX + targetX) / 2
      });
    });
  }

  // Last step of the derivation: draw association lines, if there are any to draw
  function startAssociations() {
    calculateAssociationLines();
    if (associationLines.length > 0) {
      transformPhase = 'drawing-associations';
      associationProgress = 0;
      centeringProgress = 0;
    } else {
      transformPhase = 'complete';
    }
  }

  // Start the transformation process
  function startTransformation() {
    if (transformStarted) return;
    transformStarted = true;
    nodesToCrossOut = findNodesToRemove();
    if (nodesToCrossOut.length > 0) {
      transformPhase = 'crossing-out';
      crossOutProgress = 0;
    } else if (checkDefaultTone()) {
      transformPhase = 'adding-default-tone';
      defaultToneProgress = 0;
    } else if (checkToneMovement()) {
      transformPhase = 'moving-tone';
      toneMovementProgress = 0;
    } else {
      // No deletion or movement needed, go straight to associations
      startAssociations();
    }
  }

  // Throw away everything but phi and start a new random tree from it
  function regrow() {
    allNodes = [root];
    root.children = [];
    associationLines = [];

    // Snap phi to final X position
    root.x = 0;
    root.targetX = 0;

    // Reset transformation state
    transformStarted = false;
    transformPhase = 'none';
    nodesToCrossOut = [];
    toneToMove = null;
    targetMu = null;
    toneCenteringData = [];

    pickLevels();

    // Smoothly move phi to new Y position (if it changed)
    root.targetY = levelYPositions['PHI'];

    // Reset phi age to 0 so it fades back in
    root.age = 0;

    lastBranchAttempt = Date.now();
    isRebuilding = false;
  }

  // One frame's worth of growing / deriving
  function step() {
    // Always update phi position (during and after rebuild)
    root.updatePosition();

    if (isRebuilding) {
      // Move phi to center during fade-out
      fadeOutProgress++;
      root.targetX = 0;
      if (fadeOutProgress >= FADE_OUT_DURATION) regrow();
    } else {
      // Normal animation (not rebuilding)

      // Age all nodes for fade-in and update positions (except root which was already updated)
      allNodes.forEach(n => {
        n.age++;
        if (n !== root) {
          n.updatePosition();
        }
      });

      // Attempt branching
      if (!isAnimationComplete()) {
        attemptBranching();
      } else if (!transformStarted) {
        // Tree is complete, start transformation
        startTransformation();
      }
    }

    // Handle transformation phases
    if (transformPhase === 'crossing-out') {
      crossOutProgress++;
      if (crossOutProgress >= CROSS_OUT_DURATION) {
        transformPhase = 'deleting';
        deleteProgress = 0;
      }
    } else if (transformPhase === 'deleting') {
      deleteProgress++;
      if (deleteProgress >= DELETE_DURATION) {
        // Actually remove the nodes
        nodesToCrossOut.forEach(node => {
          allNodes.splice(allNodes.indexOf(node), 1);
          node.parent.children.splice(node.parent.children.indexOf(node), 1);
        });
        // After deletion, check tone movement first, THEN default tone
        if (checkToneMovement()) {
          transformPhase = 'moving-tone';
          toneMovementProgress = 0;
        } else if (checkDefaultTone()) {
          // Only add default tone if we didn't need to move one
          transformPhase = 'adding-default-tone';
          defaultToneProgress = 0;
        } else {
          startAssociations();
        }
        // Update layout after deletion
        updateLayout();
      }
    } else if (transformPhase === 'adding-default-tone') {
      defaultToneProgress++;
      if (defaultToneProgress >= DEFAULT_TONE_DURATION) {
        // Default tone fully faded in, go straight to associations
        // (tone movement was already checked before adding default)
        startAssociations();
      }
    } else if (transformPhase === 'moving-tone') {
      toneMovementProgress++;

      // Animate the tone position
      const progress = toneMovementProgress / TONE_MOVE_DURATION;
      const easeProgress = progress * progress * (3 - 2 * progress); // smooth easing
      const finalY = levelYPositions[toneToMove.level];

      toneToMove.targetX = originalTonePos.x + (targetMu.x - originalTonePos.x) * easeProgress;
      toneToMove.targetY = originalTonePos.y + (finalY - originalTonePos.y) * easeProgress;

      if (toneMovementProgress >= TONE_MOVE_DURATION) {
        // Complete the move
        toneToMove.x = toneToMove.targetX = targetMu.x;
        toneToMove.y = toneToMove.targetY = finalY;

        // Hand the tone over from its old mu to the new one
        const oldParent = toneToMove.parent;
        oldParent.children.splice(oldParent.children.indexOf(toneToMove), 1);
        toneToMove.parent = targetMu;
        targetMu.children.push(toneToMove);

        // After moving tone, check if we need to add a default tone
        if (checkDefaultTone()) {
          transformPhase = 'adding-default-tone';
          defaultToneProgress = 0;
        } else {
          startAssociations();
        }
        updateLayout();
      }
    } else if (transformPhase === 'drawing-associations') {
      associationProgress++;
      centeringProgress++;

      // Calculate tone centering if not yet done
      if (toneCenteringData.length === 0) {
        calculateToneCentering();
      }

      // Animate tone centering simultaneously with association drawing
      // (centering finishes first, so don't let its progress run past 1)
      const progress = Math.min(1, centeringProgress / CENTERING_DURATION);
      const easeProgress = progress * progress * (3 - 2 * progress); // smooth easing

      toneCenteringData.forEach(({ tone, originalX, targetX }) => {
        tone.targetX = originalX + (targetX - originalX) * easeProgress;
      });

      // Complete when both animations are done
      if (associationProgress >= Math.max(ASSOCIATION_DURATION, CENTERING_DURATION)) {
        // Finalize tone positions
        toneCenteringData.forEach(({ tone, targetX }) => {
          tone.targetX = targetX;
          tone.x = targetX; // Snap to final position
        });
        transformPhase = 'complete';
      }
    }

    // Count how long the finished tree has sat still
    settledFrames = (transformPhase === 'complete' && !isRebuilding) ? settledFrames + 1 : 0;
  }

  // Animation loop
  function animate(now) {
    // Nothing to draw on while every canvas is hidden
    if (views.every(v => !v.width || !v.height)) {
      running = false;
      return;
    }

    // The timings above are counted in frames, so hold it to about 60 a second
    // (otherwise it all runs double speed on 120Hz screens)
    if (now - lastFrame < 15) {
      requestAnimationFrame(animate);
      return;
    }
    lastFrame = now;

    if (REDUCED_MOTION) {
      // No animation wanted: skip straight to the finished tree
      for (let i = 0; i < 3000 && settledFrames <= 60; i++) {
        lastBranchAttempt = 0;
        step();
      }
    } else {
      step();
    }

    // Draw the same tree on every canvas that's showing
    views.forEach(v => {
      if (!v.width || !v.height) return;
      view = v;
      ctx = v.ctx;
      updateCamera();
      draw();
    });

    // Once the finished tree has sat still for a second there's nothing left to animate
    if (settledFrames > 60) {
      running = false;
      return;
    }

    requestAnimationFrame(animate);
  }

  // (Re)start the loop if it has gone to sleep
  function wake() {
    if (running) return;
    running = true;
    requestAnimationFrame(animate);
  }

  // Resize handler: measure every canvas again
  function resizeCanvas() {
    const scale = window.devicePixelRatio || 1; // extra pixels so it's not blurry on retina screens
    views.forEach(v => {
      const holder = v.canvas.parentElement;
      const rect = holder.getBoundingClientRect();
      const styles = getComputedStyle(holder);
      v.width = rect.width;
      v.height = rect.height;
      v.opacity = parseFloat(styles.getPropertyValue('--tree-opacity')) || 1;
      v.fontSize = parseFloat(styles.getPropertyValue('--tree-font-size')) || 16;
      v.canvas.width = Math.round(v.width * scale);
      v.canvas.height = Math.round(v.height * scale);
      v.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    });
    wake();
  }

  // Expose rebuild function globally (the nav buttons call it)
  window.rebuildTree = startRebuild;

  // Start animation
  initTree();
  window.addEventListener('resize', resizeCanvas);
  // draw again once the web font has arrived, so the labels aren't stuck in a fallback font
  if (document.fonts) document.fonts.ready.then(wake);
  resizeCanvas();
})();
