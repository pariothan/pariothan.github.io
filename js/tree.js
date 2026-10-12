// --- Prosodic Tree Animation ---
// A random prosodic tree (φ > ω > Ft > (σ) > μ > H/L tones) grows in the
// sidebar canvas, then runs a short tonal derivation (repeated tones struck
// out, a tone shifted to the final mora, a default L, spreading lines)
// before settling. Clicking a nav button fades it out and grows a new one.
//
// Timing is in milliseconds, so speed doesn't depend on refresh rate. The
// loop stops once the tree settles and restarts on rebuild or resize.
(function () {
  const canvas = document.getElementById('tree-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const section = canvas.parentElement;
  // Tree color and opacity come from CSS variables on .tree-section
  const treeStyles = getComputedStyle(section);
  const COLOR = treeStyles.getPropertyValue('--tree-color').trim() || '#cccccc';
  const BASE_OPACITY = parseFloat(treeStyles.getPropertyValue('--tree-opacity')) || 1.0;
  const FONT = 'bold 16px JetBrains Mono, Fira Code, monospace';
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  // ===== CONFIGURABLE ANIMATION SPEEDS (ms; lower = faster) =====
  const BRANCH_INTERVAL = 120;   // Between branching attempts (tree growth speed)
  const FADE_IN = 500;           // New nodes fade in
  const FADE_OUT = 250;          // Tree rebuild fade-out (bottom-up)
  const CROSS_OUT = 333;         // Draw cross-out lines on duplicate tones
  const DELETE = 167;            // Fade out deleted nodes
  const TONE_MOVE = 500;         // Move tone to final mu
  const DEFAULT_TONE = 500;      // Fade in the default L tone
  const ASSOCIATION = 667;       // Draw association lines
  const CENTERING = 500;         // Center tones between mus
  const POSITION_LERP = 0.15;    // Share of remaining distance covered per 60fps frame
  const MAX_STEP = 100;          // Cap on one step, e.g. after returning to the tab
  // ===============================================================

  // Layout, in world units (the camera scales the tree to fit the canvas)
  const LEAF_WIDTH = 50;
  const SIBLING_GAP = 50;
  const LABEL_GAP = 20;          // Screen px kept clear around labels when drawing lines
  const PADDING = 80;

  const LEVELS = { PHI: 'φ', OMEGA: 'ω', FOOT: 'Ft', SIGMA: 'σ', MU: 'μ', TONE_H: 'H', TONE_L: 'L' };
  const isTone = n => n.level === 'TONE_H' || n.level === 'TONE_L';
  const clamp01 = p => Math.max(0, Math.min(1, p));
  const smoothstep = p => p * p * (3 - 2 * p);
  const randomTone = () => (Math.random() < 0.5 ? 'TONE_H' : 'TONE_L');
  const branchOffset = () => 70 + Math.random() * 40;

  class TreeNode {
    constructor(level, x, y, parent = null) {
      this.level = level;
      this.x = x;
      this.y = y;
      this.targetX = x; // Target position for smooth movement
      this.targetY = y;
      this.parent = parent;
      this.children = [];
      this.isTerminal = false;
      this.isDefault = false; // Default L tone, drawn with a dashed line
      this.age = 0; // ms since creation, for fade-in
      this.subtreeWidth = 0;
    }

    get label() { return LEVELS[this.level]; }
    get opacity() { return Math.min(1, this.age / FADE_IN); }
  }

  // ---------- State ----------
  let root = null;
  let nodes = [];
  let activeLevels = [];
  const levelY = {};
  let simTime = 0;
  let lastBranch = 0;

  // phase: 'growing', then the derivation phases in PHASES, then 'complete'
  let phase = 'growing';
  let phaseTime = 0;
  let removing = new Set();      // Repeated tones being struck out
  let toneToMove = null;
  let targetMu = null;
  let toneFrom = null;           // Tone position before it moved
  let associations = [];         // [{ fromTone, toMu }]
  let centering = [];            // [{ tone, fromX, toX }]

  let rebuilding = false;
  let fadeOutTime = 0;

  let cssWidth = 0;
  let cssHeight = 0;
  const camera = { x: 0, y: 0, zoomX: 1, zoomY: 1 };

  // ---------- Tree construction ----------

  // Randomly include the syllable level, then space levels evenly from 0 to 1000
  function configureLevels() {
    activeLevels = ['PHI', 'OMEGA', 'FOOT'];
    if (Math.random() < 0.6) activeLevels.push('SIGMA');
    activeLevels.push('MU', 'TONE_H'); // TONE_H/L share a row
    const spacing = 1000 / (activeLevels.length - 1);
    activeLevels.forEach((level, i) => { levelY[level] = i * spacing; });
    levelY.TONE_L = levelY.TONE_H;
  }

  function resetDerivation() {
    phase = 'growing';
    phaseTime = 0;
    removing = new Set();
    toneToMove = targetMu = toneFrom = null;
    associations = [];
    centering = [];
    lastBranch = simTime;
  }

  function startTree() {
    configureLevels();
    root = new TreeNode('PHI', 0, levelY.PHI);
    nodes = [root];
    resetDerivation();
  }

  function nextLevel(level) {
    const i = activeLevels.indexOf(level);
    return i === -1 || i === activeLevels.length - 1 ? null : activeLevels[i + 1];
  }

  function addChild(parent, level, x) {
    const child = new TreeNode(level, x, parent.y, parent);
    child.targetY = levelY[level];
    parent.children.push(child);
    nodes.push(child);
    return child;
  }

  function addPair(parent, leftLevel, rightLevel) {
    const offset = branchOffset();
    return [addChild(parent, leftLevel, parent.x - offset), addChild(parent, rightLevel, parent.x + offset)];
  }

  // A mora ends its branch: the last open mora may take two tones (40%);
  // otherwise H, L or no tone with equal odds.
  function branchMu(node) {
    const isFinalMu = nodes.filter(n => n.level === 'MU' && !n.isTerminal && n.children.length === 0).length === 1;
    node.isTerminal = true;
    if (isFinalMu && Math.random() < 0.4) {
      addPair(node, randomTone(), randomTone()).forEach(t => { t.isTerminal = true; });
      return;
    }
    const choice = Math.random();
    if (choice < 0.333) addChild(node, 'TONE_H', node.x).isTerminal = true;
    else if (choice < 0.666) addChild(node, 'TONE_L', node.x).isTerminal = true;
  }

  function attemptBranching() {
    if (simTime - lastBranch < BRANCH_INTERVAL) return;
    lastBranch = simTime;

    const leaves = nodes.filter(n => !n.isTerminal && n.children.length === 0);
    leaves.forEach(node => {
      if (Math.random() > 0.7) return; // 70% chance to branch
      const next = nextLevel(node.level);
      if (!next) return;
      if (node.level === 'MU') branchMu(node);
      // Feet always branch binary; other levels 70% binary, 30% unary
      else if (node.level === 'FOOT' || Math.random() < 0.7) addPair(node, next, next);
      else addChild(node, next, node.x);
    });

    updateLayout();
  }

  function isTreeComplete() {
    return nodes.every(n => n.isTerminal || n.children.length > 0);
  }

  // Lay out subtrees side by side, parents centered over their children
  function updateLayout() {
    (function measure(node) {
      node.subtreeWidth = node.children.length === 0
        ? LEAF_WIDTH
        : node.children.reduce((sum, c) => sum + measure(c), 0) + (node.children.length - 1) * SIBLING_GAP;
      return node.subtreeWidth;
    })(root);

    (function place(node, centerX) {
      node.targetX = centerX;
      if (node.children.length === 1) { place(node.children[0], centerX); return; }
      let x = centerX - node.subtreeWidth / 2;
      node.children.forEach(child => {
        place(child, x + child.subtreeWidth / 2);
        x += child.subtreeWidth + SIBLING_GAP;
      });
    })(root, 0);
  }

  // ---------- Tonal derivation ----------

  const tonesInOrder = () => nodes.filter(isTone).sort((a, b) => a.x - b.x);
  const morasInOrder = () => nodes.filter(n => n.level === 'MU').sort((a, b) => a.x - b.x);
  const toneOf = mu => mu.children.find(isTone);

  // Adjacent identical tones collapse: strike every tone equal to its left neighbor
  function findRepeatedTones() {
    const tones = tonesInOrder();
    return tones.filter((t, i) => i > 0 && t.level === tones[i - 1].level);
  }

  // If the rightmost mora has no tone, the rightmost tone moves onto it
  function findToneToMove() {
    const moras = morasInOrder();
    if (moras.length === 0) return false;
    const lastMu = moras[moras.length - 1];
    const tones = tonesInOrder();
    if (toneOf(lastMu) || tones.length === 0) return false;
    toneToMove = tones[tones.length - 1];
    targetMu = lastMu;
    toneFrom = { x: toneToMove.x, y: toneToMove.y };
    return true;
  }

  // If the first mora has no tone, it gets a default L
  function addDefaultTone() {
    const firstMu = morasInOrder()[0];
    if (!firstMu || toneOf(firstMu)) return false;
    const tone = addChild(firstMu, 'TONE_L', firstMu.x);
    tone.isTerminal = true;
    tone.isDefault = true;
    return true;
  }

  // Each tone spreads rightward to the last of the toneless moras that follow it,
  // and slides to the midpoint between its own mora and that one.
  function computeAssociations() {
    associations = [];
    const moras = morasInOrder();
    moras.forEach((mu, i) => {
      const tone = toneOf(mu);
      if (!tone) return;
      let lastToneless = null;
      for (let j = i + 1; j < moras.length && !toneOf(moras[j]); j++) lastToneless = moras[j];
      if (lastToneless) associations.push({ fromTone: tone, toMu: lastToneless });
    });

    centering = associations.map(({ fromTone, toMu }) => {
      // With several children, use the source's rightmost and the target's leftmost
      const source = fromTone.parent;
      const fromX = source.children.length > 1 ? Math.max(...source.children.map(c => c.x)) : source.x;
      const toX = toMu.children.length > 1 ? Math.min(...toMu.children.map(c => c.x)) : toMu.x;
      return { tone: fromTone, fromX: fromTone.x, toX: (fromX + toX) / 2 };
    });
  }

  function enter(next) {
    phase = next;
    phaseTime = 0;
  }

  const phaseProgress = duration => clamp01(phaseTime / duration);

  function startAssociations() {
    computeAssociations();
    enter(associations.length > 0 ? 'drawing-associations' : 'complete');
  }

  function startDerivation() {
    removing = new Set(findRepeatedTones());
    if (removing.size > 0) enter('crossing-out');
    else if (addDefaultTone()) enter('adding-default-tone');
    else if (findToneToMove()) enter('moving-tone');
    else startAssociations();
  }

  // Each derivation phase: how long it runs, what it animates, what follows.
  const PHASES = {
    'crossing-out': {
      duration: CROSS_OUT,
      end: () => enter('deleting'),
    },
    'deleting': {
      duration: DELETE,
      end() {
        removing.forEach(node => {
          nodes.splice(nodes.indexOf(node), 1);
          const siblings = node.parent.children;
          siblings.splice(siblings.indexOf(node), 1);
        });
        if (findToneToMove()) enter('moving-tone');
        else if (addDefaultTone()) enter('adding-default-tone');
        else startAssociations();
        updateLayout();
      },
    },
    'moving-tone': {
      duration: TONE_MOVE,
      tick() {
        const p = smoothstep(phaseProgress(TONE_MOVE));
        toneToMove.targetX = toneFrom.x + (targetMu.x - toneFrom.x) * p;
        toneToMove.targetY = toneFrom.y + (levelY[toneToMove.level] - toneFrom.y) * p;
      },
      end() {
        toneToMove.x = toneToMove.targetX = targetMu.x;
        toneToMove.y = toneToMove.targetY = levelY[toneToMove.level];
        const siblings = toneToMove.parent.children;
        siblings.splice(siblings.indexOf(toneToMove), 1);
        toneToMove.parent = targetMu;
        targetMu.children.push(toneToMove);
        if (addDefaultTone()) enter('adding-default-tone');
        else startAssociations();
        updateLayout();
      },
    },
    'adding-default-tone': {
      duration: DEFAULT_TONE,
      end: startAssociations,
    },
    'drawing-associations': {
      duration: Math.max(ASSOCIATION, CENTERING),
      tick() {
        const p = smoothstep(phaseProgress(CENTERING));
        centering.forEach(({ tone, fromX, toX }) => { tone.targetX = fromX + (toX - fromX) * p; });
      },
      end() {
        centering.forEach(({ tone, toX }) => { tone.x = tone.targetX = toX; });
        enter('complete');
      },
    },
  };

  // ---------- Rebuild ----------

  function startRebuild() {
    if (rebuilding) return;
    rebuilding = true;
    fadeOutTime = 0;
    wake();
  }

  // Keep φ (it glides to its new spot) and start a new random tree under it
  function finishRebuild() {
    nodes = [root];
    root.children = [];
    root.x = root.targetX = 0;
    configureLevels();
    root.targetY = levelY.PHI;
    root.age = 0;
    resetDerivation();
    rebuilding = false;
  }

  // ---------- Simulation step ----------

  function step(dt) {
    simTime += dt;
    const lerp = 1 - Math.pow(1 - POSITION_LERP, dt / (1000 / 60));
    const move = n => {
      n.x += (n.targetX - n.x) * lerp;
      n.y += (n.targetY - n.y) * lerp;
    };

    move(root); // φ keeps moving during a rebuild
    if (rebuilding) {
      fadeOutTime += dt;
      root.targetX = 0;
      if (fadeOutTime >= FADE_OUT) finishRebuild();
    } else {
      nodes.forEach(n => {
        n.age += dt;
        if (n !== root) move(n);
      });
      if (phase === 'growing') {
        if (!isTreeComplete()) attemptBranching();
        else startDerivation();
      }
    }

    const current = PHASES[phase];
    if (current) {
      phaseTime += dt;
      current.tick?.();
      if (phaseTime >= current.duration) current.end();
    }
  }

  function isSettled() {
    return !rebuilding && phase === 'complete' && nodes.every(n =>
      n.age >= FADE_IN && Math.abs(n.x - n.targetX) < 0.05 && Math.abs(n.y - n.targetY) < 0.05);
  }

  // ---------- Drawing ----------

  function updateCamera() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(n => {
      minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x);
      minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y);
    });
    camera.zoomX = cssWidth / (maxX - minX + 2 * PADDING);
    camera.zoomY = cssHeight / (maxY - minY + 2 * PADDING);
    camera.x = (minX + maxX) / 2;
    camera.y = (minY + maxY) / 2;
  }

  function toScreen(p) {
    return {
      x: (p.x - camera.x) * camera.zoomX + cssWidth / 2,
      y: (p.y - camera.y) * camera.zoomY + cssHeight / 2,
    };
  }

  // Line between two nodes' screen positions, kept clear of their labels.
  // `progress` < 1 draws only the first part of it.
  function drawLine(from, to, alpha, progress = 1) {
    const a = toScreen(from);
    const b = toScreen(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= LABEL_GAP * 2) return;
    const sx = a.x + (dx / dist) * LABEL_GAP;
    const sy = a.y + (dy / dist) * LABEL_GAP;
    const ex = b.x - (dx / dist) * LABEL_GAP;
    const ey = b.y - (dy / dist) * LABEL_GAP;
    ctx.globalAlpha = alpha * BASE_OPACITY;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (ex - sx) * progress, sy + (ey - sy) * progress);
    ctx.stroke();
  }

  function draw() {
    updateCamera();
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = COLOR;
    ctx.fillStyle = COLOR;
    ctx.lineWidth = 2;

    // During a rebuild, nodes fade from the bottom row up
    const minY = Math.min(...nodes.map(n => n.y));
    const yRange = Math.max(...nodes.map(n => n.y)) - minY;
    const fadeOut = y => {
      if (!rebuilding) return 1;
      const start = (yRange > 0 ? 1 - (y - minY) / yRange : 0) * 0.7;
      return 1 - clamp01((fadeOutTime / FADE_OUT - start) / 0.3);
    };
    const deleting = node => phase === 'deleting' && removing.has(node);

    // Connectors
    nodes.forEach(node => {
      if (deleting(node)) return;
      node.children.forEach(child => {
        if (deleting(child)) return;
        if (phase === 'moving-tone' && child === toneToMove) {
          // Old connection fades out while the new one fades in
          const p = phaseProgress(TONE_MOVE);
          drawLine(node, toneFrom, 1 - p);
          drawLine(targetMu, child, p);
          return;
        }
        if (child.isDefault) ctx.setLineDash([5, 5]);
        drawLine(node, child, Math.min(node.opacity, child.opacity) * fadeOut(child.y));
        if (child.isDefault) ctx.setLineDash([]);
      });
    });

    // Labels
    nodes.forEach(node => {
      let alpha = node.opacity * fadeOut(node.y);
      if (!rebuilding && deleting(node)) alpha *= 1 - phaseProgress(DELETE);
      const pos = toScreen(node);
      ctx.globalAlpha = alpha * BASE_OPACITY;
      ctx.fillText(node.label, pos.x, pos.y);

      if (phase === 'crossing-out' && removing.has(node)) {
        const length = ctx.measureText(node.label).width * 1.2;
        const startX = pos.x - length / 2;
        ctx.globalAlpha = node.opacity * BASE_OPACITY;
        ctx.beginPath();
        ctx.moveTo(startX, pos.y);
        ctx.lineTo(startX + length * phaseProgress(CROSS_OUT), pos.y);
        ctx.stroke();
      }
    });

    // Association lines (tone to following toneless moras), dashed
    if (phase === 'drawing-associations' || phase === 'complete') {
      const progress = phase === 'complete' ? 1 : phaseProgress(ASSOCIATION);
      ctx.setLineDash([5, 5]);
      associations.forEach(({ fromTone, toMu }) => {
        drawLine(fromTone, toMu, 0.8 * fadeOut(fromTone.y), progress);
      });
      ctx.setLineDash([]);
    }

    ctx.globalAlpha = 1;
  }

  // ---------- Loop ----------

  let running = false;
  let lastFrame = 0;

  function frame(now) {
    if (!cssWidth || !cssHeight) { running = false; return; } // hidden (e.g. mobile)
    step(Math.min(MAX_STEP, Math.max(0, now - lastFrame)));
    lastFrame = now;
    draw();
    if (isSettled()) { running = false; return; }
    requestAnimationFrame(frame);
  }

  // Skip straight to the settled tree
  function fastForward() {
    for (let i = 0; i < 5000 && !isSettled(); i++) step(MAX_STEP);
    nodes.forEach(n => { n.x = n.targetX; n.y = n.targetY; });
    if (cssWidth && cssHeight) draw();
  }

  function wake() {
    if (reducedMotion.matches) { fastForward(); return; }
    if (running) return;
    running = true;
    lastFrame = performance.now();
    requestAnimationFrame(frame);
  }

  function resizeCanvas() {
    const rect = section.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    cssWidth = rect.width;
    cssHeight = rect.height;
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (running) return;
    if (cssWidth && cssHeight) draw(); // resizing clears the canvas
    wake();
  }

  window.rebuildTree = startRebuild;

  startTree();
  new ResizeObserver(resizeCanvas).observe(section);
})();
