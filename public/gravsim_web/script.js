// Canvas setup
const canvas = document.getElementById('simulationCanvas');
const ctx = canvas.getContext('2d');
const controlPanel = document.getElementById('controlPanel');
const WIDTH = window.innerWidth - controlPanel.offsetWidth;
const HEIGHT = window.innerHeight;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// Simulation parameters
let BASE_DOT_RADIUS = 1;
let DOT_COUNT = 100;
let MIN_DISTANCE = 90;
let MERGE_DISTANCE = 2;
let G = 11;
let TRAIL_LENGTH = 25;
let MOMENTUM_LOSS_FACTOR = 0.5;
const EPSILON = 0.001;
const SPACE_SIZE = 180;
const FOV = 360;
const INITIAL_VELOCITY_RANGE = 0;
const BASE_MASS = 1;

let MIN_DISTANCE_SQ = MIN_DISTANCE ** 2;
let MERGE_DISTANCE_SQ = MERGE_DISTANCE ** 2;

// Camera parameters
let camera_radius = 150;
let camera_theta = 0;
let camera_phi = Math.PI / 4;
let camera_rotation_speed = 0.001;

let initial_total_energy = null;
let paused = false;

// Dots and trails
let dots = [];
let trails = [];

// Initialize dots
for (let i = 0; i < DOT_COUNT; i++) {
  const dot = generateNewDot(Math.random() * 4 + 1);
  dots.push(dot);
  trails.push([]);
}

// Event listeners for controls
document.getElementById('pauseButton').addEventListener('click', () => {
  paused = !paused;
  document.getElementById('pauseButton').innerText = paused ? 'Resume' : 'Pause';
});

document.getElementById('spawnButton').addEventListener('click', () => {
  const number = parseInt(document.getElementById('spawnNumberInput').value) || 1;
  const mass = parseFloat(document.getElementById('spawnMassInput').value) || 1;
  for (let i = 0; i < number; i++) {
    const dot = generateNewDot(mass);
    dots.push(dot);
    trails.push([]);
  }
});

function updateConstants() {
  G = parseFloat(document.getElementById('gravityInput').value) || G;
  MIN_DISTANCE = parseFloat(document.getElementById('minDistanceInput').value) || MIN_DISTANCE;
  MERGE_DISTANCE = parseFloat(document.getElementById('mergeDistanceInput').value) || MERGE_DISTANCE;
  MOMENTUM_LOSS_FACTOR = parseFloat(document.getElementById('momentumLossInput').value) || MOMENTUM_LOSS_FACTOR;
  TRAIL_LENGTH = parseInt(document.getElementById('trailLengthInput').value) || TRAIL_LENGTH;

  MIN_DISTANCE_SQ = MIN_DISTANCE ** 2;
  MERGE_DISTANCE_SQ = MERGE_DISTANCE ** 2;
}

const inputs = document.querySelectorAll('#controlPanel input[type="text"]');
inputs.forEach(input => {
  input.addEventListener('change', updateConstants);
});

function generateNewDot(mass = BASE_MASS) {
  const position = [
    (Math.random() - 0.5) * 2 * SPACE_SIZE,
    (Math.random() - 0.5) * 2 * SPACE_SIZE,
    (Math.random() - 0.5) * 2 * SPACE_SIZE
  ];
  const velocity = [
    (Math.random() - 0.5) * 2 * INITIAL_VELOCITY_RANGE,
    (Math.random() - 0.5) * 2 * INITIAL_VELOCITY_RANGE,
    (Math.random() - 0.5) * 2 * INITIAL_VELOCITY_RANGE
  ];
  const color = [
    Math.floor(Math.random() * 156 + 100),
    Math.floor(Math.random() * 156 + 100),
    Math.floor(Math.random() * 156 + 100)
  ];
  return {
    position,
    velocity,
    mass,
    speed: Math.hypot(...velocity),
    color
  };
}

function project(point) {
  const [x, y, z] = point;
  const factor = FOV / (FOV + z);
  const projX = x * factor + WIDTH / 2;
  const projY = -y * factor + HEIGHT / 2;
  return [projX, projY];
}

function update() {
  if (!paused) {
    camera_theta += camera_rotation_speed;

    const sin_phi = Math.sin(camera_phi);
    const cos_phi = Math.cos(camera_phi);
    const sin_theta = Math.sin(camera_theta);
    const cos_theta = Math.cos(camera_theta);

    const camera_position = [
      camera_radius * sin_phi * cos_theta,
      camera_radius * cos_phi,
      camera_radius * sin_phi * sin_theta
    ];

    const forward = camera_position.map(c => -c / Math.hypot(...camera_position));
    const up = [0, 1, 0];
    let right = crossProduct(up, forward);
    right = normalize(right);
    const newUp = crossProduct(forward, right);

    const rotation_matrix = [right, newUp, forward];
    const translation = multiplyMatrixVector(rotation_matrix, camera_position).map(c => -c);

    let merge_actions = [];
    let num_dots = dots.length;

    let total_potential_energy = 0;

    for (let i = 0; i < num_dots; i++) {
      const dot_i = dots[i];
      const pos_i = dot_i.position;
      const mass_i = dot_i.mass;
      const vel_i = dot_i.velocity;
      let total_force = [0, 0, 0];

      for (let j = i + 1; j < num_dots; j++) {
        const dot_j = dots[j];
        const pos_j = dot_j.position;
        const mass_j = dot_j.mass;

        const displacement = subtractVectors(pos_j, pos_i);
        let distance_sq = dotProduct(displacement, displacement) + EPSILON;
        let distance = Math.sqrt(distance_sq);

        let potential_energy = (G * mass_i * mass_j) / distance;
        total_potential_energy += potential_energy;

        if (distance_sq < MERGE_DISTANCE_SQ) {
          merge_actions.push([i, j]);
          continue;
        }

        let force_magnitude = G * mass_i * mass_j / (distance_sq < MIN_DISTANCE_SQ ? MIN_DISTANCE_SQ : distance_sq);
        let force = multiplyVectorByScalar(normalize(displacement), force_magnitude);
        total_force = addVectors(total_force, force);

        dot_j.velocity = subtractVectors(dot_j.velocity, divideVectorByScalar(force, mass_j));
      }

      dot_i.velocity = addVectors(dot_i.velocity, divideVectorByScalar(total_force, mass_i));
      dot_i.position = addVectors(dot_i.position, dot_i.velocity);
      dot_i.speed = Math.hypot(...dot_i.velocity);

      // Keep dots within space boundaries
      for (let axis = 0; axis < 3; axis++) {
        if (dot_i.position[axis] < -SPACE_SIZE) {
          dot_i.position[axis] = -SPACE_SIZE;
          dot_i.velocity[axis] = -dot_i.velocity[axis] * MOMENTUM_LOSS_FACTOR;
        } else if (dot_i.position[axis] > SPACE_SIZE) {
          dot_i.position[axis] = SPACE_SIZE;
          dot_i.velocity[axis] = -dot_i.velocity[axis] * MOMENTUM_LOSS_FACTOR;
        }
      }

      // Update trail
      trails[i].push([...dot_i.position]);
      if (trails[i].length > TRAIL_LENGTH) {
        trails[i].shift();
      }
    }

    // Execute merges
    let indices_to_remove = new Set();
    merge_actions.forEach(([i, j]) => {
      if (indices_to_remove.has(i) || indices_to_remove.has(j)) return;

      let base_dot = dots[i];
      let remove_dot = dots[j];

      let total_mass = base_dot.mass + remove_dot.mass;
      base_dot.velocity = divideVectorByScalar(addVectors(multiplyVectorByScalar(base_dot.velocity, base_dot.mass), multiplyVectorByScalar(remove_dot.velocity, remove_dot.mass)), total_mass);
      base_dot.position = divideVectorByScalar(addVectors(multiplyVectorByScalar(base_dot.position, base_dot.mass), multiplyVectorByScalar(remove_dot.position, remove_dot.mass)), total_mass);
      base_dot.mass = total_mass;
      base_dot.color = base_dot.color.map((c, idx) => Math.min(255, Math.floor((c * base_dot.mass + remove_dot.color[idx] * remove_dot.mass) / total_mass)));

      indices_to_remove.add(j);
    });

    // Remove merged dots
    indices_to_remove = Array.from(indices_to_remove).sort((a, b) => b - a);
    indices_to_remove.forEach(index => {
      dots.splice(index, 1);
      trails.splice(index, 1);
      num_dots--;
    });

    // Energy calculations
    let total_kinetic_energy = dots.reduce((sum, dot) => sum + 0.5 * dot.mass * dot.speed ** 2, 0);
    let total_energy = total_kinetic_energy + total_potential_energy;

    if (initial_total_energy === null) {
      initial_total_energy = total_energy;
    }

    let energy_change = total_energy - initial_total_energy;

    // Update energy display
    document.getElementById('dotCountText').innerText = `Dots: ${dots.length}`;
    let total_mass = dots.reduce((sum, dot) => sum + dot.mass, 0);
    document.getElementById('totalMassText').innerText = `Total Mass: ${total_mass.toFixed(2)}`;
    document.getElementById('kineticEnergyText').innerText = `Kinetic Energy: ${total_kinetic_energy.toFixed(2)}`;
    document.getElementById('potentialEnergyText').innerText = `Potential Energy: ${total_potential_energy.toFixed(2)}`;
    document.getElementById('totalEnergyText').innerText = `Total Energy: ${total_energy.toFixed(2)}`;
    document.getElementById('energyChangeText').innerText = `Energy Change: ${energy_change.toFixed(2)}`;

    // Rendering
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Precompute transformations
    const positions_2d = [];
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      const pos_camera = subtractVectors(dot.position, camera_position);
      const pos_rotated = multiplyMatrixVector(rotation_matrix, pos_camera);
      positions_2d.push(project(pos_rotated));
    }

    // Draw trails
    for (let i = 0; i < trails.length; i++) {
      const trail = trails[i];
      if (trail.length > 1) {
        ctx.beginPath();
        for (let point of trail) {
          const pos_camera = subtractVectors(point, camera_position);
          const pos_rotated = multiplyMatrixVector(rotation_matrix, pos_camera);
          const [x, y] = project(pos_rotated);
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgb(${dots[i].color.join(',')})`;
        ctx.stroke();
      }
    }

    // Draw dots
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i];
      const [x, y] = positions_2d[i];
      const distance = Math.hypot(...subtractVectors(dot.position, camera_position));
      const
