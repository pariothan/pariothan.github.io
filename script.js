const VALID_VIEWS = new Set(['me', 'projects', 'cv', 'blog']);
const content = document.getElementById('content');

function render(view) {
  if (!VALID_VIEWS.has(view)) view = 'me';
  const target = document.getElementById(view);
  if (!target) return;
  document.querySelectorAll('.view').forEach(s => { s.hidden = true; });
  target.hidden = false;
  document.querySelectorAll('.navbtn').forEach(link => {
    const linkView = link.getAttribute('href')?.replace('#', '');
    if (linkView === view) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
  if (view === 'blog') loadBlog();
  content.focus();
}

document.querySelectorAll('.navbtn').forEach(link => {
  const href = link.getAttribute('href');
  if (!href || !href.startsWith('#')) return;
  link.addEventListener('click', e => {
    e.preventDefault();
    const view = href.replace('#', '');
    history.pushState(null, '', link.href);
    render(view);
    if (window.rebuildTree) window.rebuildTree();
  });
});

window.addEventListener('popstate', () => {
  render(location.hash.replace('#', '') || 'me');
});

document.getElementById('personal-website-link')?.addEventListener('click', () => {
  alert("You're already there!");
});

const _initial = location.hash.replace('#', '');
render(VALID_VIEWS.has(_initial) ? _initial : 'me');

// --- Blog ---
let _blogManifest = null;
let _activeBlogTag = null;

function loadBlog() {
  if (_blogManifest !== null) { renderBlogPosts(_blogManifest); return; }
  _blogManifest = window.__blogPosts__ || [];
  renderBlogPosts(_blogManifest);
}

function renderBlogPosts(posts) {
  const grid = document.getElementById('blog-grid');
  const filtersEl = document.getElementById('blog-tag-filters');
  if (!grid) return;

  grid.querySelectorAll('[data-blog-content]').forEach(el => el.remove());

  const allTags = [...new Set(posts.flatMap(p => p.tags))].sort();

  if (filtersEl) {
    filtersEl.innerHTML = '';
    if (allTags.length > 1) {
      const makeBtn = (label, tag) => {
        const btn = document.createElement('button');
        btn.className = 'blog-tag-btn' + (tag === _activeBlogTag ? ' active' : '');
        btn.textContent = label;
        btn.addEventListener('click', () => { _activeBlogTag = tag; renderBlogPosts(_blogManifest); });
        return btn;
      };
      filtersEl.appendChild(makeBtn('ALL', null));
      allTags.forEach(tag => filtersEl.appendChild(makeBtn(tag, tag)));
    }
  }

  const filtered = _activeBlogTag ? posts.filter(p => p.tags.includes(_activeBlogTag)) : posts;

  if (filtered.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'blog-status';
    empty.dataset.blogContent = '1';
    empty.textContent = posts.length === 0 ? 'No posts yet — check back soon.' : 'No posts with that tag.';
    grid.appendChild(empty);
    return;
  }

  filtered.forEach(post => {
    const a = document.createElement('a');
    a.className = 'story-card blog-post-card';
    a.href = `./posts/${post.slug}/`;
    a.dataset.blogContent = '1';

    const date = new Date(post.date + 'T12:00:00').toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const tagsHtml = post.tags.map(t => `<span class="tech-badge">${t}</span>`).join('');

    a.innerHTML = `
      <div class="post-card-meta">
        <time class="post-date" datetime="${post.date}">${date}</time>
        <span class="post-reading-time">${post.readingTime}&nbsp;min&nbsp;read</span>
      </div>
      <h3>${post.title}</h3>
      ${tagsHtml ? `<div class="tech-stack">${tagsHtml}</div>` : ''}
      ${post.excerpt ? `<p class="post-excerpt">${post.excerpt}</p>` : ''}
    `;
    grid.appendChild(a);
  });
}

// --- Prosodic Tree Animation ---
(function() {
  const canvas = document.getElementById('tree-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  // Get tree color and opacity from CSS variables
  const treeStyles = getComputedStyle(document.querySelector('.tree-section'));
  const COLOR = treeStyles.getPropertyValue('--tree-color').trim() || '#cccccc';
  const BASE_OPACITY = parseFloat(treeStyles.getPropertyValue('--tree-opacity').trim()) || 1.0;
  const FONT = 'bold 16px JetBrains Mono, Fira Code, monospace';

  // ===== CONFIGURABLE ANIMATION SPEEDS =====
  // Adjust these values to control animation timing
  // Lower values = faster animation

  const BRANCH_INTERVAL = 120;      // Milliseconds between branching attempts (tree growth speed)
  const FADE_IN_FRAMES = 30;        // Frames for new nodes to fade in
  const FADE_OUT_DURATION = 15;     // Frames for tree rebuild fade-out (bottom-up)
  const CROSS_OUT_DURATION = 20;    // Frames to draw cross-out lines on duplicate tones
  const DELETE_DURATION = 10;       // Frames to fade out deleted nodes
  const TONE_MOVE_DURATION = 30;    // Frames to move tone to final mu
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

    // Smoothly move towards target position
    updatePosition() {
      this.x += (this.targetX - this.x) * POSITION_LERP;
      this.y += (this.targetY - this.y) * POSITION_LERP;
    }
  }

  // Tree state
  let root = null;
  let allNodes = [];
  let includeSigma = false;
  let activeLevels = [];
  let levelYPositions = {};
  let lastBranchAttempt = 0;
  let cameraX = 0, cameraY = 0, cameraZoomX = 1, cameraZoomY = 1;

  // Initialize tree
  function initTree() {
    allNodes = [];
    includeSigma = Math.random() < 0.6;

    // Define active levels
    activeLevels = ['PHI', 'OMEGA', 'FOOT'];
    if (includeSigma) activeLevels.push('SIGMA');
    activeLevels.push('MU', 'TONE_H'); // TONE_H/L are both at same level

    // Calculate y positions (evenly spaced from 0 to 1000)
    const spacing = 1000 / (activeLevels.length - 1);
    activeLevels.forEach((level, i) => {
      levelYPositions[level] = i * spacing;
    });
    levelYPositions['TONE_L'] = levelYPositions['TONE_H']; // same y

    // Create root
    root = new TreeNode('PHI', 0, levelYPositions['PHI']);
    root.age = 0; // Start with zero opacity (fade in)
    allNodes.push(root);

    lastBranchAttempt = Date.now();
  }

  // Get next level in hierarchy
  function getNextLevel(currentLevel) {
    const idx = activeLevels.indexOf(currentLevel);
    if (idx === -1 || idx === activeLevels.length - 1) return null;
    return activeLevels[idx + 1];
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

      // Special handling for MU -> TONE
      if (node.level === 'MU') {
        const activeMuCount = countActiveMu();
        const isFinalMu = activeMuCount === 1;

        if (isFinalMu && Math.random() < 0.4) {
          // 40% chance to emit two tones
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
          // Non-final mu: equal chance of H, L, or nothing
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
      } else {
        // Special rule for FOOT: always binary branch
        if (node.level === 'FOOT') {
          const offset = 70 + Math.random() * 40;
          const left = new TreeNode(nextLevel, node.x - offset, node.y);
          const right = new TreeNode(nextLevel, node.x + offset, node.y);
          left.targetY = levelYPositions[nextLevel];
          right.targetY = levelYPositions[nextLevel];
          left.parent = right.parent = node;
          node.children.push(left, right);
          allNodes.push(left, right);
        } else {
          // General branching for other non-MU nodes
          const branchType = Math.random();

          if (branchType < 0.7) {
            // Binary branch (70%)
            const offset = 70 + Math.random() * 40;
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
        }
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

      if (node.children.length === 0) return;

      if (node.children.length === 1) {
        // Single child: center under parent
        positionNodes(node.children[0], centerX);
      } else {
        // Multiple children: distribute around center
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

    // Start positioning from root at x=0
    positionNodes(root, 0);
  }

  // Update camera to fit tree
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

    const treeWidth = maxX - minX;
    const treeHeight = maxY - minY;

    // Calculate zoom to fit
    cameraZoomX = canvas.width / treeWidth;
    cameraZoomY = canvas.height / treeHeight;

    // Center camera
    cameraX = (minX + maxX) / 2;
    cameraY = (minY + maxY) / 2;
  }

  // Transform world coordinates to screen
  function worldToScreen(x, y) {
    return {
      x: (x - cameraX) * cameraZoomX + canvas.width / 2,
      y: (y - cameraY) * cameraZoomY + canvas.height / 2
    };
  }

  // Draw the tree
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw connectors first
    ctx.strokeStyle = COLOR;
    ctx.lineWidth = 2;

    allNodes.forEach(node => {
      // Skip connectors to nodes being deleted
      if (transformPhase === 'deleting' && nodesToCrossOut.includes(node)) return;

      node.children.forEach(child => {
        // Skip connectors to nodes being deleted
        if (transformPhase === 'deleting' && nodesToCrossOut.includes(child)) return;

        // Calculate opacity for rebuild fade-out
        let lineOpacity = Math.min(node.opacity, child.opacity);

        if (rebuildPhase === 'fading-out') {
          const maxY = Math.max(...allNodes.map(n => n.y));
          const minY = Math.min(...allNodes.map(n => n.y));
          const yRange = maxY - minY;

          // Use the child's Y position for fade timing (bottom to top)
          const nodeProgress = yRange > 0 ? 1 - (child.y - minY) / yRange : 0;
          const overallProgress = fadeOutProgress / FADE_OUT_DURATION;
          const fadeStart = nodeProgress * 0.7;
          const fadeDuration = 0.3;
          const nodeFade = Math.max(0, Math.min(1, (overallProgress - fadeStart) / fadeDuration));

          lineOpacity = lineOpacity * (1 - nodeFade);
        }

        // During centering and after, tones with association lines get their solid parent line redrawn
        // (this happens automatically as the child.x updates)

        // During tone movement, fade out old connection, draw new one
        if (transformPhase === 'moving-tone' && child === toneToMove) {
          const progress = toneMovementProgress / TONE_MOVE_DURATION;

          // Fade out old connection
          const oldParentPos = worldToScreen(node.x, node.y);
          const oldChildPos = worldToScreen(originalTonePos.x, originalTonePos.y);
          const gap = 20;
          const dx1 = oldChildPos.x - oldParentPos.x;
          const dy1 = oldChildPos.y - oldParentPos.y;
          const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

          if (dist1 > gap * 2) {
            const startX = oldParentPos.x + (dx1 / dist1) * gap;
            const startY = oldParentPos.y + (dy1 / dist1) * gap;
            const endX = oldChildPos.x - (dx1 / dist1) * gap;
            const endY = oldChildPos.y - (dy1 / dist1) * gap;

            ctx.globalAlpha = (1 - progress) * BASE_OPACITY;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }

          // Draw new connection fading in
          const newParentPos = worldToScreen(targetMu.x, targetMu.y);
          const currentChildPos = worldToScreen(child.x, child.y);
          const dx2 = currentChildPos.x - newParentPos.x;
          const dy2 = currentChildPos.y - newParentPos.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 > gap * 2) {
            const startX = newParentPos.x + (dx2 / dist2) * gap;
            const startY = newParentPos.y + (dy2 / dist2) * gap;
            const endX = currentChildPos.x - (dx2 / dist2) * gap;
            const endY = currentChildPos.y - (dy2 / dist2) * gap;

            ctx.globalAlpha = progress * BASE_OPACITY;
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(endX, endY);
            ctx.stroke();
          }
          return;
        }

        const parentPos = worldToScreen(node.x, node.y);
        const childPos = worldToScreen(child.x, child.y);

        // Calculate gap around labels (approximate)
        const gap = 20;
        const dx = childPos.x - parentPos.x;
        const dy = childPos.y - parentPos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > gap * 2) {
          const startX = parentPos.x + (dx / dist) * gap;
          const startY = parentPos.y + (dy / dist) * gap;
          const endX = childPos.x - (dx / dist) * gap;
          const endY = childPos.y - (dy / dist) * gap;

          // Use dashed line for default tones
          if (child.isDefault) {
            ctx.setLineDash([5, 5]);
          }

          ctx.globalAlpha = lineOpacity * BASE_OPACITY;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Reset to solid line
          if (child.isDefault) {
            ctx.setLineDash([]);
          }
        }
      });
    });

    // Draw nodes
    allNodes.forEach(node => {
      let nodeOpacity = node.opacity;

      // Handle rebuild fade-out (bottom to top, including PHI at the end)
      if (rebuildPhase === 'fading-out') {
        const maxY = Math.max(...allNodes.map(n => n.y));
        const minY = Math.min(...allNodes.map(n => n.y));
        const yRange = maxY - minY;

        // Calculate fade progress based on node's Y position (inverted for bottom-up)
        // Higher Y values (bottom nodes) should fade first (progress closer to 0)
        const nodeProgress = yRange > 0 ? 1 - (node.y - minY) / yRange : 0;
        const overallProgress = fadeOutProgress / FADE_OUT_DURATION;
        const fadeStart = nodeProgress * 0.7; // Stagger the fades
        const fadeDuration = 0.3;
        const nodeFade = Math.max(0, Math.min(1, (overallProgress - fadeStart) / fadeDuration));

        nodeOpacity = node.opacity * (1 - nodeFade);
      }
      // Handle deletion phase - fade out
      else if (transformPhase === 'deleting' && nodesToCrossOut.includes(node)) {
        const fadeProgress = deleteProgress / DELETE_DURATION;
        nodeOpacity = node.opacity * (1 - fadeProgress);
      }

      ctx.globalAlpha = nodeOpacity * BASE_OPACITY;

      const pos = worldToScreen(node.x, node.y);
      ctx.fillStyle = COLOR;
      ctx.fillText(node.label, pos.x, pos.y);

      // Draw cross-out line
      if (transformPhase === 'crossing-out' && nodesToCrossOut.includes(node)) {
        const progress = crossOutProgress / CROSS_OUT_DURATION;
        ctx.strokeStyle = COLOR;
        ctx.lineWidth = 2;
        ctx.globalAlpha = node.opacity * BASE_OPACITY;

        // Measure text width
        const textWidth = ctx.measureText(node.label).width;
        const lineLength = textWidth * 1.2;
        const startX = pos.x - lineLength / 2;
        const endX = pos.x + lineLength / 2;

        ctx.beginPath();
        ctx.moveTo(startX, pos.y);
        ctx.lineTo(startX + lineLength * progress, pos.y);
        ctx.stroke();
      }
    });

    // Draw association lines (tone to non-tone mus)
    if (transformPhase === 'drawing-associations' || transformPhase === 'complete') {
      const progress = transformPhase === 'complete' ? 1 : (associationProgress / ASSOCIATION_DURATION);
      ctx.strokeStyle = COLOR;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]); // Dashed line to distinguish from tree structure

      associationLines.forEach(({ fromTone, toMu }) => {
        const tonePos = worldToScreen(fromTone.x, fromTone.y);
        const muPos = worldToScreen(toMu.x, toMu.y);

        // Draw diagonal line from tone up to the mu position, creating a triangular span
        const gap = 20;
        const dx = muPos.x - tonePos.x;
        const dy = muPos.y - tonePos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > gap * 2) {
          // Add gap clearance on both ends
          const startX = tonePos.x + (dx / dist) * gap;
          const startY = tonePos.y + (dy / dist) * gap;
          const endX = muPos.x - (dx / dist) * gap;
          const endY = muPos.y - (dy / dist) * gap;

          // Calculate current end point based on progress
          const lineDx = endX - startX;
          const lineDy = endY - startY;
          const currentEndX = startX + lineDx * progress;
          const currentEndY = startY + lineDy * progress;

          // Calculate fade for rebuild
          let assocOpacity = 0.8;
          if (rebuildPhase === 'fading-out') {
            const maxY = Math.max(...allNodes.map(n => n.y));
            const minY = Math.min(...allNodes.map(n => n.y));
            const yRange = maxY - minY;

            // Use tone's Y position for fade timing
            const nodeProgress = yRange > 0 ? 1 - (fromTone.y - minY) / yRange : 0;
            const overallProgress = fadeOutProgress / FADE_OUT_DURATION;
            const fadeStart = nodeProgress * 0.7;
            const fadeDuration = 0.3;
            const nodeFade = Math.max(0, Math.min(1, (overallProgress - fadeStart) / fadeDuration));

            assocOpacity = 0.8 * (1 - nodeFade);
          }

          ctx.globalAlpha = assocOpacity * BASE_OPACITY;
          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(currentEndX, currentEndY);
          ctx.stroke();
        }
      });

      ctx.setLineDash([]); // Reset to solid line
    }

    ctx.globalAlpha = 1;
  }

  // Check if animation is complete
  function isAnimationComplete() {
    return allNodes.every(n => n.isTerminal || n.children.length > 0);
  }

  // State for post-build transformation
  let transformStarted = false;
  let transformPhase = 'none'; // 'none', 'crossing-out', 'deleting', 'moving-tone', 'adding-default-tone', 'drawing-associations', 'centering-tones', 'complete'
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
  let defaultTone = null; // Default L tone for first mu
  let defaultToneProgress = 0;
  const DEFAULT_TONE_DURATION = 30; // frames to fade in default tone

  // State for rebuild fade-out animation
  let isRebuilding = false;
  let rebuildPhase = 'none'; // 'none', 'fading-out', 'complete'
  let fadeOutProgress = 0;

  // Start rebuild animation sequence
  function startRebuild() {
    if (isRebuilding) return;
    isRebuilding = true;
    rebuildPhase = 'fading-out';
    fadeOutProgress = 0;
  }

  // Get all tone nodes in left-to-right order
  function getToneNodesInOrder() {
    const toneNodes = allNodes.filter(n => n.level === 'TONE_H' || n.level === 'TONE_L');
    return toneNodes.sort((a, b) => a.x - b.x);
  }

  // Find nodes to remove (repeated tones)
  function findNodesToRemove() {
    const tones = getToneNodesInOrder();
    const toRemove = [];

    for (let i = 1; i < tones.length; i++) {
      const prev = tones[i - 1];
      const curr = tones[i];

      // If current tone matches previous tone, mark for removal
      if (curr.level === prev.level && !toRemove.includes(prev)) {
        toRemove.push(curr);
      } else if (curr.level !== prev.level) {
        // Different tone, so this starts a new sequence
        continue;
      } else if (toRemove.includes(prev)) {
        // Previous was marked for removal, so this continues the sequence
        toRemove.push(curr);
      }
    }

    return toRemove;
  }

  // Check if we need to move a tone to the final mu
  function checkToneMovement() {
    // Find the rightmost mu node
    const muNodes = allNodes.filter(n => n.level === 'MU');
    if (muNodes.length === 0) return false;

    const rightmostMu = muNodes.reduce((max, node) => node.x > max.x ? node : max);

    // Check if it has any tone children
    const hasTone = rightmostMu.children.some(c => c.level === 'TONE_H' || c.level === 'TONE_L');

    if (!hasTone) {
      // Find the rightmost tone
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

  // Check if we need to add a default L tone to the first mu
  function checkDefaultTone() {
    const muNodes = allNodes.filter(n => n.level === 'MU').sort((a, b) => a.x - b.x);
    if (muNodes.length === 0) return false;

    const firstMu = muNodes[0];
    const hasTone = firstMu.children.some(c =>
      c.level === 'TONE_H' || c.level === 'TONE_L'
    );

    if (!hasTone) {
      // Create default L tone at first mu's position
      defaultTone = new TreeNode('TONE_L', firstMu.x, firstMu.y);
      defaultTone.targetY = levelYPositions['TONE_L'];
      defaultTone.parent = firstMu;
      defaultTone.isTerminal = true;
      defaultTone.age = 0; // Start from transparent
      defaultTone.isDefault = true; // Mark as default tone
      firstMu.children.push(defaultTone);
      allNodes.push(defaultTone);
      return true;
    }

    return false;
  }

  // Calculate association lines from tones to following non-tone mus
  function calculateAssociationLines() {
    associationLines = [];

    // Get all mu nodes sorted left to right
    const muNodes = allNodes.filter(n => n.level === 'MU').sort((a, b) => a.x - b.x);

    // For each mu with a tone, find subsequent non-tone mus
    for (let i = 0; i < muNodes.length; i++) {
      const currentMu = muNodes[i];
      const hasTone = currentMu.children.some(c => c.level === 'TONE_H' || c.level === 'TONE_L');

      if (hasTone) {
        // Find the tone
        const tone = currentMu.children.find(c => c.level === 'TONE_H' || c.level === 'TONE_L');

        // Find all subsequent non-tone mus until we hit another tone-mu or end
        let lastNonToneMu = null;
        for (let j = i + 1; j < muNodes.length; j++) {
          const nextMu = muNodes[j];
          const nextHasTone = nextMu.children.some(c => c.level === 'TONE_H' || c.level === 'TONE_L');

          if (nextHasTone) {
            // Hit another tone-mu, stop
            break;
          } else {
            // This is a non-tone mu, track it
            lastNonToneMu = nextMu;
          }
        }

        // If we found non-tone mus, draw line to the last one
        if (lastNonToneMu) {
          associationLines.push({ fromTone: tone, toMu: lastNonToneMu });
        }
      }
    }
  }

  // Calculate centering positions for tones with association lines
  function calculateToneCentering() {
    toneCenteringData = [];

    associationLines.forEach(({ fromTone, toMu }) => {
      // Get the parent mu of the tone
      const parentMu = fromTone.parent;
      if (parentMu) {
        // If parent mu has multiple children (tones), use the rightmost one's X position
        // (because we want to center between the last mora of the source and first mora of target)
        let parentX = parentMu.x;
        if (parentMu.children.length > 1) {
          // Find rightmost child (highest X value) - this is the last mora
          const rightmostChild = parentMu.children.reduce((max, child) =>
            child.x > max.x ? child : max
          );
          parentX = rightmostChild.x;
        }

        // If target mu has multiple children, use the leftmost one's X position
        // (the first mora of the target mu)
        let targetX = toMu.x;
        if (toMu.children.length > 1) {
          // Find leftmost child (lowest X value) - this is the first mora
          const leftmostChild = toMu.children.reduce((min, child) =>
            child.x < min.x ? child : min
          );
          targetX = leftmostChild.x;
        }

        // Calculate midpoint between parent position and target position
        const centerX = (parentX + targetX) / 2;
        toneCenteringData.push({
          tone: fromTone,
          originalX: fromTone.x,
          targetX: centerX
        });
      }
    });
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
      calculateAssociationLines();
      if (associationLines.length > 0) {
        transformPhase = 'drawing-associations';
        associationProgress = 0;
      } else {
        transformPhase = 'complete';
      }
    }
  }

  // Animation loop
  function animate() {
    // Always update phi position (during and after rebuild)
    if (root) {
      root.updatePosition();
    }

    // Handle rebuild animation phases
    if (isRebuilding) {
      if (rebuildPhase === 'fading-out') {
        fadeOutProgress++;

        // Move phi to center during fade-out
        root.targetX = 0;

        if (fadeOutProgress >= FADE_OUT_DURATION) {
          // Remove all non-phi nodes
          allNodes = allNodes.filter(n => n.level === 'PHI');
          root.children = [];
          associationLines = [];

          // Snap phi to final X position
          root.x = 0;
          root.targetX = 0;

          // Reset transformation state and start new tree
          transformStarted = false;
          transformPhase = 'none';
          nodesToCrossOut = [];
          crossOutProgress = 0;
          deleteProgress = 0;
          toneToMove = null;
          targetMu = null;
          associationProgress = 0;
          toneCenteringData = [];
          centeringProgress = 0;

          // Re-initialize tree (new random configuration)
          includeSigma = Math.random() < 0.6;
          activeLevels = ['PHI', 'OMEGA', 'FOOT'];
          if (includeSigma) activeLevels.push('SIGMA');
          activeLevels.push('MU', 'TONE_H');

          const spacing = 1000 / (activeLevels.length - 1);
          activeLevels.forEach((level, i) => {
            levelYPositions[level] = i * spacing;
          });
          levelYPositions['TONE_L'] = levelYPositions['TONE_H'];

          // Smoothly move phi to new Y position (if it changed)
          root.targetY = levelYPositions['PHI'];

          // Reset phi age to 0 so it fades back in
          root.age = 0;

          lastBranchAttempt = Date.now();
          isRebuilding = false;
          rebuildPhase = 'none';
        }
      }
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
          const index = allNodes.indexOf(node);
          if (index > -1) {
            allNodes.splice(index, 1);
          }
          // Remove from parent's children
          if (node.parent) {
            const childIndex = node.parent.children.indexOf(node);
            if (childIndex > -1) {
              node.parent.children.splice(childIndex, 1);
            }
          }
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
          // No tone movement or default needed, go straight to associations
          calculateAssociationLines();
          if (associationLines.length > 0) {
            transformPhase = 'drawing-associations';
            associationProgress = 0;
          } else {
            transformPhase = 'complete';
          }
        }
        // Update layout after deletion
        updateLayout();
      }
    } else if (transformPhase === 'adding-default-tone') {
      defaultToneProgress++;

      if (defaultToneProgress >= DEFAULT_TONE_DURATION) {
        // Default tone fully faded in, go straight to associations
        // (tone movement was already checked before adding default)
        calculateAssociationLines();
        if (associationLines.length > 0) {
          transformPhase = 'drawing-associations';
          associationProgress = 0;
          centeringProgress = 0;
        } else {
          transformPhase = 'complete';
        }
      }
    } else if (transformPhase === 'moving-tone') {
      toneMovementProgress++;

      // Animate the tone position
      const progress = toneMovementProgress / TONE_MOVE_DURATION;
      const easeProgress = progress * progress * (3 - 2 * progress); // smooth easing

      toneToMove.targetX = originalTonePos.x + (targetMu.x - originalTonePos.x) * easeProgress;
      toneToMove.targetY = originalTonePos.y + (levelYPositions[toneToMove.level] - originalTonePos.y) * easeProgress;

      if (toneMovementProgress >= TONE_MOVE_DURATION) {
        // Complete the move
        toneToMove.targetX = targetMu.x;
        toneToMove.targetY = levelYPositions[toneToMove.level];
        toneToMove.x = targetMu.x;
        toneToMove.y = levelYPositions[toneToMove.level];

        // Remove from old parent
        if (toneToMove.parent) {
          const childIndex = toneToMove.parent.children.indexOf(toneToMove);
          if (childIndex > -1) {
            toneToMove.parent.children.splice(childIndex, 1);
          }
        }

        // Add to new parent
        toneToMove.parent = targetMu;
        targetMu.children.push(toneToMove);

        // After moving tone, check if we need to add a default tone
        if (checkDefaultTone()) {
          transformPhase = 'adding-default-tone';
          defaultToneProgress = 0;
        } else {
          // No default needed, go to associations
          calculateAssociationLines();
          if (associationLines.length > 0) {
            transformPhase = 'drawing-associations';
            associationProgress = 0;
            centeringProgress = 0;
          } else {
            transformPhase = 'complete';
          }
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
      if (toneCenteringData.length > 0) {
        const progress = centeringProgress / CENTERING_DURATION;
        const easeProgress = progress * progress * (3 - 2 * progress); // smooth easing

        toneCenteringData.forEach(({ tone, originalX, targetX }) => {
          tone.targetX = originalX + (targetX - originalX) * easeProgress;
        });
      }

      // Complete when both animations are done
      const maxDuration = Math.max(ASSOCIATION_DURATION, CENTERING_DURATION);
      if (associationProgress >= maxDuration) {
        // Finalize tone positions
        toneCenteringData.forEach(({ tone, targetX }) => {
          tone.targetX = targetX;
          tone.x = targetX; // Snap to final position
        });
        transformPhase = 'complete';
      }
    }

    // Update camera
    updateCamera();

    // Draw
    draw();

    requestAnimationFrame(animate);
  }

  // Resize handler
  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    updateCamera();
  }

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Expose rebuild function globally
  window.rebuildTree = function() {
    // Start the animated rebuild sequence
    startRebuild();
  };

  // Start animation
  initTree();
  animate();
})();
