const canvas = document.getElementById("treeCanvas");
const ctx = canvas.getContext("2d");

const LEVEL_LABELS = {
  PHI: "φ",
  OMEGA: "ω",
  FOOT: "Ft",
  SIGMA: "σ",
  MU: "μ",
  TONE_H: "H",
  TONE_L: "L",
};

const BRANCH_INTERVAL = 240; // ms
const BRANCH_PROBABILITY = 0.7;
const POSITION_LERP = 0.15;
const LEAF_WIDTH = 50;
const SIBLING_SPACING = 50;
const BRANCH_OFFSET_MIN = 70;
const BRANCH_OFFSET_MAX = 110;
const FADE_IN_FRAMES = 30;

const CROSS_OUT_DURATION = 60;
const DELETE_DURATION = 30;
const TONE_MOVE_DURATION = 60;
const ASSOCIATION_DURATION = 60;
const CENTERING_DURATION = 60;

let root = null;
let allNodes = [];
let includeSigma = false;
let activeLevels = [];
let levelYPositions = {};
let lastBranchAttempt = 0;

let transformStarted = false;
let transformPhase = "none";
let nodesToCrossOut = [];
let associationLines = [];
let toneCenteringData = [];
let toneToMove = null;
let targetMu = null;
let originalTonePos = null;

let crossOutProgress = 0;
let deleteProgress = 0;
let toneMovementProgress = 0;
let associationProgress = 0;
let centeringProgress = 0;

let cameraX = 0;
let cameraY = 0;
let cameraZoomX = 1;
let cameraZoomY = 1;

class TreeNode {
  constructor(level, x, y) {
    this.level = level;
    this.x = x;
    this.y = y;
    this.targetX = x;
    this.targetY = y;
    this.children = [];
    this.parent = null;
    this.isTerminal = false;
    this.age = 0;
    this.subtreeWidth = LEAF_WIDTH;
  }

  get label() {
    return LEVEL_LABELS[this.level] ?? this.level;
  }

  get opacity() {
    return Math.min(1, this.age / FADE_IN_FRAMES);
  }

  updatePosition() {
    this.x += (this.targetX - this.x) * POSITION_LERP;
    this.y += (this.targetY - this.y) * POSITION_LERP;
  }
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function initTree() {
  allNodes = [];
  transformStarted = false;
  transformPhase = "none";
  nodesToCrossOut = [];
  associationLines = [];
  toneCenteringData = [];
  toneToMove = null;
  targetMu = null;
  originalTonePos = null;
  crossOutProgress = 0;
  deleteProgress = 0;
  toneMovementProgress = 0;
  associationProgress = 0;
  centeringProgress = 0;

  includeSigma = Math.random() < 0.6;
  activeLevels = ["PHI", "OMEGA", "FOOT"];
  if (includeSigma) activeLevels.push("SIGMA");
  activeLevels.push("MU", "TONE_H");

  levelYPositions = {};
  const spacing =
    activeLevels.length > 1 ? 1000 / (activeLevels.length - 1) : 0;
  activeLevels.forEach((level, index) => {
    levelYPositions[level] = index * spacing;
  });
  levelYPositions.TONE_L = levelYPositions.TONE_H;

  root = new TreeNode("PHI", 0, levelYPositions.PHI ?? 0);
  allNodes.push(root);
  lastBranchAttempt = performance.now();
  updateLayout();
}

function getNextLevel(level) {
  const index = activeLevels.indexOf(level);
  if (index === -1 || index === activeLevels.length - 1) {
    return null;
  }
  return activeLevels[index + 1];
}

function countActiveMu() {
  return allNodes.filter(
    (node) =>
      node.level === "MU" &&
      !node.isTerminal &&
      node.children.length === 0,
  ).length;
}

function attemptBranching() {
  const now = performance.now();
  if (now - lastBranchAttempt < BRANCH_INTERVAL) return;
  lastBranchAttempt = now;

  const leaves = allNodes.filter(
    (node) => !node.isTerminal && node.children.length === 0,
  );
  if (leaves.length === 0) return;

  let layoutNeedsUpdate = false;

  leaves.forEach((node) => {
    if (Math.random() > BRANCH_PROBABILITY) return;

    if (node.level === "MU") {
      layoutNeedsUpdate = handleMuBranching(node) || layoutNeedsUpdate;
      return;
    }

    const nextLevel = getNextLevel(node.level);
    if (!nextLevel) {
      node.isTerminal = true;
      return;
    }

    layoutNeedsUpdate =
      handleGeneralBranching(node, nextLevel) || layoutNeedsUpdate;
  });

  if (layoutNeedsUpdate) {
    updateLayout();
  }
}

function handleGeneralBranching(node, nextLevel) {
  const branchRoll = Math.random();
  const offset = randomBetween(BRANCH_OFFSET_MIN, BRANCH_OFFSET_MAX);

  if (branchRoll < 0.7) {
    const left = new TreeNode(nextLevel, node.x - offset, node.y);
    const right = new TreeNode(nextLevel, node.x + offset, node.y);
    left.targetY = levelYPositions[nextLevel];
    right.targetY = levelYPositions[nextLevel];
    left.parent = node;
    right.parent = node;
    node.children.push(left, right);
    allNodes.push(left, right);
    return true;
  }

  const child = new TreeNode(
    nextLevel,
    branchRoll < 0.85 ? node.x - offset : node.x + offset,
    node.y,
  );
  child.targetY = levelYPositions[nextLevel];
  child.parent = node;
  node.children.push(child);
  allNodes.push(child);
  return true;
}

function isToneNode(node) {
  return node.level === "TONE_H" || node.level === "TONE_L";
}

function handleMuBranching(node) {
  const activeMuCount = countActiveMu();
  const isFinalMu = activeMuCount === 1;
  const targetY = levelYPositions.TONE_H;

  if (isFinalMu && Math.random() < 0.4) {
    const leftToneLevel = Math.random() < 0.5 ? "TONE_H" : "TONE_L";
    const rightToneLevel = Math.random() < 0.5 ? "TONE_H" : "TONE_L";
    const offset = randomBetween(BRANCH_OFFSET_MIN, BRANCH_OFFSET_MAX);

    const left = new TreeNode(leftToneLevel, node.x - offset, node.y);
    const right = new TreeNode(rightToneLevel, node.x + offset, node.y);
    left.targetY = levelYPositions[leftToneLevel];
    right.targetY = levelYPositions[rightToneLevel];
    left.parent = node;
    right.parent = node;
    left.isTerminal = true;
    right.isTerminal = true;
    node.children.push(left, right);
    allNodes.push(left, right);
    node.isTerminal = true;
    return true;
  }

  const choice = Math.random();
  if (choice < 0.333) {
    const tone = new TreeNode("TONE_H", node.x, node.y);
    tone.targetY = targetY;
    tone.parent = node;
    tone.isTerminal = true;
    node.children.push(tone);
    allNodes.push(tone);
  } else if (choice < 0.666) {
    const tone = new TreeNode("TONE_L", node.x, node.y);
    tone.targetY = targetY;
    tone.parent = node;
    tone.isTerminal = true;
    node.children.push(tone);
    allNodes.push(tone);
  }

  node.isTerminal = true;
  return true;
}

function calculateSubtreeWidth(node) {
  if (node.children.length === 0) {
    node.subtreeWidth = LEAF_WIDTH;
    return node.subtreeWidth;
  }

  const childWidths = node.children.map((child) => calculateSubtreeWidth(child));
  node.subtreeWidth =
    childWidths.reduce((sum, w) => sum + w, 0) +
    (node.children.length - 1) * SIBLING_SPACING;
  return node.subtreeWidth;
}

function positionNodes(node, centerX) {
  node.targetX = centerX;
  if (node.children.length === 0) return;

  if (node.children.length === 1) {
    positionNodes(node.children[0], centerX);
    return;
  }

  const totalWidth =
    node.children.reduce((sum, child) => sum + child.subtreeWidth, 0) +
    (node.children.length - 1) * SIBLING_SPACING;

  let currentX = centerX - totalWidth / 2;
  node.children.forEach((child) => {
    const childCenter = currentX + child.subtreeWidth / 2;
    positionNodes(child, childCenter);
    currentX += child.subtreeWidth + SIBLING_SPACING;
  });
}

function updateLayout() {
  if (!root) return;
  calculateSubtreeWidth(root);
  positionNodes(root, 0);
}

function isAnimationComplete() {
  return allNodes.every(
    (node) => node.isTerminal || node.children.length > 0,
  );
}

function startTransformation() {
  transformStarted = true;
  nodesToCrossOut = findNodesToRemove();

  if (nodesToCrossOut.length > 0) {
    transformPhase = "crossing-out";
    crossOutProgress = 0;
    return;
  }

  if (checkToneMovement()) {
    transformPhase = "moving-tone";
    return;
  }

  calculateAssociationLines();
  associationProgress = 0;
  transformPhase = associationLines.length > 0 ? "drawing-associations" : "complete";
}

function handleTransformations() {
  switch (transformPhase) {
    case "crossing-out": {
      crossOutProgress += 1;
      if (crossOutProgress >= CROSS_OUT_DURATION) {
        transformPhase = "deleting";
        deleteProgress = 0;
      }
      break;
    }
    case "deleting": {
      deleteProgress += 1;
      if (deleteProgress >= DELETE_DURATION) {
        removeCrossedOutNodes();
        nodesToCrossOut = [];

        if (checkToneMovement()) {
          transformPhase = "moving-tone";
          break;
        }

        calculateAssociationLines();
        associationProgress = 0;
        transformPhase =
          associationLines.length > 0 ? "drawing-associations" : "complete";
        updateLayout();
      }
      break;
    }
    case "moving-tone": {
      if (!toneToMove || !targetMu || !originalTonePos) {
        calculateAssociationLines();
        associationProgress = 0;
        transformPhase =
          associationLines.length > 0 ? "drawing-associations" : "complete";
        updateLayout();
        break;
      }

      toneMovementProgress += 1;
      const t = Math.min(1, toneMovementProgress / TONE_MOVE_DURATION);
      const eased = ease(t);

      toneToMove.targetX =
        originalTonePos.x + (targetMu.x - originalTonePos.x) * eased;
      toneToMove.targetY =
        originalTonePos.y +
        (levelYPositions[toneToMove.level] - originalTonePos.y) * eased;

      if (toneMovementProgress >= TONE_MOVE_DURATION) {
        completeToneReassignment();
        calculateAssociationLines();
        associationProgress = 0;
        transformPhase =
          associationLines.length > 0 ? "drawing-associations" : "complete";
        updateLayout();
      }
      break;
    }
    case "drawing-associations": {
      associationProgress += 1;
      if (associationProgress >= ASSOCIATION_DURATION) {
        calculateToneCentering();
        centeringProgress = 0;
        transformPhase =
          toneCenteringData.length > 0 ? "centering-tones" : "complete";
      }
      break;
    }
    case "centering-tones": {
      centeringProgress += 1;
      const t = Math.min(1, centeringProgress / CENTERING_DURATION);
      const eased = ease(t);

      toneCenteringData.forEach(({ tone, originalX, targetX }) => {
        tone.targetX = originalX + (targetX - originalX) * eased;
      });

      if (centeringProgress >= CENTERING_DURATION) {
        toneCenteringData.forEach(({ tone, targetX }) => {
          tone.x = targetX;
          tone.targetX = targetX;
        });
        transformPhase = "complete";
      }
      break;
    }
    default:
      break;
  }
}

function removeCrossedOutNodes() {
  nodesToCrossOut.forEach((node) => {
    if (node.parent) {
      node.parent.children = node.parent.children.filter(
        (child) => child !== node,
      );
    }
    const idx = allNodes.indexOf(node);
    if (idx !== -1) {
      allNodes.splice(idx, 1);
    }
  });
}

function findNodesToRemove() {
  const tones = getToneNodesInOrder();
  const marked = [];

  for (let i = 1; i < tones.length; i += 1) {
    const previous = tones[i - 1];
    const current = tones[i];
    if (current.level === previous.level) {
      marked.push(current);
    }
  }

  return marked;
}

function getToneNodesInOrder() {
  return allNodes
    .filter((node) => isToneNode(node))
    .sort((a, b) => a.x - b.x);
}

function checkToneMovement() {
  const muNodes = allNodes
    .filter((node) => node.level === "MU")
    .sort((a, b) => a.x - b.x);

  if (muNodes.length === 0) return false;

  const rightmostMu = muNodes[muNodes.length - 1];
  const hasTone = rightmostMu.children.some(isToneNode);
  if (hasTone) return false;

  const toneNodes = getToneNodesInOrder();
  if (toneNodes.length === 0) return false;

  toneToMove = toneNodes[toneNodes.length - 1];
  targetMu = rightmostMu;
  originalTonePos = { x: toneToMove.x, y: toneToMove.y };
  toneMovementProgress = 0;
  return true;
}

function completeToneReassignment() {
  if (!toneToMove || !targetMu) return;

  if (toneToMove.parent) {
    toneToMove.parent.children = toneToMove.parent.children.filter(
      (child) => child !== toneToMove,
    );
  }

  toneToMove.parent = targetMu;
  targetMu.children.push(toneToMove);
  toneToMove.targetX = targetMu.targetX;
  toneToMove.x = toneToMove.targetX;
  toneToMove.targetY = levelYPositions[toneToMove.level];
  toneToMove.y = toneToMove.targetY;

  toneToMove = null;
  targetMu = null;
  originalTonePos = null;
}

function calculateAssociationLines() {
  associationLines = [];
  const muNodes = allNodes
    .filter((node) => node.level === "MU")
    .sort((a, b) => a.x - b.x);

  muNodes.forEach((currentMu, index) => {
    const tone = currentMu.children.find(isToneNode);
    if (!tone) return;

    let lastNonTone = null;
    for (let i = index + 1; i < muNodes.length; i += 1) {
      const nextMu = muNodes[i];
      const nextHasTone = nextMu.children.some(isToneNode);
      if (nextHasTone) break;
      lastNonTone = nextMu;
    }

    if (lastNonTone) {
      associationLines.push({ fromTone: tone, toMu: lastNonTone });
    }
  });
}

function calculateToneCentering() {
  toneCenteringData = associationLines.map(({ fromTone, toMu }) => {
    const parentMu = fromTone.parent;
    if (!parentMu) {
      return null;
    }
    return {
      tone: fromTone,
      originalX: fromTone.x,
      targetX: (parentMu.x + toMu.x) / 2,
    };
  }).filter(Boolean);
}

function ease(t) {
  return t * t * (3 - 2 * t);
}

function updateCamera() {
  if (allNodes.length === 0 || canvas.width === 0 || canvas.height === 0) {
    return;
  }

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  allNodes.forEach((node) => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return;

  const padding = 80;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  const treeWidth = Math.max(1, maxX - minX);
  const treeHeight = Math.max(1, maxY - minY);

  cameraZoomX = canvas.width / treeWidth;
  cameraZoomY = canvas.height / treeHeight;
  cameraX = (minX + maxX) / 2;
  cameraY = (minY + maxY) / 2;
}

function worldToScreen(x, y) {
  return {
    x: (x - cameraX) * cameraZoomX + canvas.width / 2,
    y: (y - cameraY) * cameraZoomY + canvas.height / 2,
  };
}

function drawAssociationLines(progress) {
  ctx.save();
  ctx.strokeStyle = "#7cb342";
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.globalAlpha = 0.8;

  associationLines.forEach(({ fromTone, toMu }) => {
    const tonePos = worldToScreen(fromTone.x, fromTone.y);
    const muPos = worldToScreen(toMu.x, toMu.y);

    const gap = 20;
    const dx = muPos.x - tonePos.x;
    const dy = muPos.y - tonePos.y;
    const dist = Math.hypot(dx, dy);
    if (dist <= gap * 2) return;

    const startX = tonePos.x + (dx / dist) * gap;
    const startY = tonePos.y + (dy / dist) * gap;
    const endX = muPos.x - (dx / dist) * gap;
    const endY = muPos.y - (dy / dist) * gap;

    const currentX = startX + (endX - startX) * progress;
    const currentY = startY + (endY - startY) * progress;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();
  });

  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.font = 'bold 16px "JetBrains Mono", "Fira Code", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#7cb342";
  ctx.fillStyle = "#7cb342";

  allNodes.forEach((node) => {
    node.children.forEach((child) => {
      if (transformPhase === "deleting" && nodesToCrossOut.includes(child)) {
        return;
      }

      const parentPos = worldToScreen(node.x, node.y);
      const childPos = worldToScreen(child.x, child.y);
      const gap = 20;

      const dx = childPos.x - parentPos.x;
      const dy = childPos.y - parentPos.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= gap * 2) return;

      const startX = parentPos.x + (dx / dist) * gap;
      const startY = parentPos.y + (dy / dist) * gap;
      const endX = childPos.x - (dx / dist) * gap;
      const endY = childPos.y - (dy / dist) * gap;

      ctx.globalAlpha = Math.min(node.opacity, child.opacity);
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    });
  });

  allNodes.forEach((node) => {
    let alpha = node.opacity;
    if (transformPhase === "deleting" && nodesToCrossOut.includes(node)) {
      const fade = deleteProgress / DELETE_DURATION;
      alpha *= Math.max(0, 1 - fade);
    }

    ctx.globalAlpha = alpha;
    const pos = worldToScreen(node.x, node.y);
    ctx.fillText(node.label, pos.x, pos.y);

    if (transformPhase === "crossing-out" && nodesToCrossOut.includes(node)) {
      const progress = Math.min(1, crossOutProgress / CROSS_OUT_DURATION);
      const textWidth = ctx.measureText(node.label).width;
      const lineLength = textWidth * 1.2;

      ctx.beginPath();
      ctx.moveTo(pos.x - lineLength / 2, pos.y);
      ctx.lineTo(pos.x - lineLength / 2 + lineLength * progress, pos.y);
      ctx.stroke();
    }
  });

  ctx.globalAlpha = 1;

  if (
    transformPhase === "drawing-associations" ||
    transformPhase === "centering-tones" ||
    transformPhase === "complete"
  ) {
    const progress =
      transformPhase === "drawing-associations"
        ? Math.min(1, associationProgress / ASSOCIATION_DURATION)
        : 1;
    drawAssociationLines(progress);
  }

  ctx.restore();
}

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, Math.floor(rect.width));
  const height = Math.max(1, Math.floor(rect.height));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
}

function animate() {
  allNodes.forEach((node) => {
    node.age += 1;
    node.updatePosition();
  });

  if (!transformStarted) {
    if (!isAnimationComplete()) {
      attemptBranching();
    } else {
      startTransformation();
    }
  } else {
    handleTransformations();
  }

  updateCamera();
  draw();
  requestAnimationFrame(animate);
}

function main() {
  resizeCanvas();
  initTree();
  updateCamera();
  animate();
}

window.addEventListener("resize", () => {
  resizeCanvas();
  updateCamera();
});

main();
