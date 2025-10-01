export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Vector2 {
  x: number;
  y: number;
}

export interface Particle {
  id: number;
  position: Vector3;
  velocity: Vector3;
  mass: number;
  radius: number;
  color: string;
  trail: Vector3[];
  trailStartTime?: number; // When this particle's trail started showing
}

export interface GhostTrail {
  trail: Vector3[];
  color: string;
  opacity: number;
  createdAt: number;
}

export interface SimulationSettings {
  gravity: number;
  collisionDistance: number;
  minMass: number;
  maxMass: number;
  energyLoss: number;
  particleCount: number;
  trailLength: number;
  trailOpacity: number;
  trailCount: number; // Number of most massive particles to show trails for
  is3D: boolean;
  isPaused: boolean;
  ellipsoidUpdateInterval: number; // seconds
  ellipsoidMassCapture: number; // percentage (0-100)
  minForceDistance: number; // Minimum distance for gravity calculation (prevents extreme forces)
}

export interface Camera {
  position: Vector3;
  rotation: Vector2;
  zoom: number;
  focalLength: number;
}

export interface SimulationState {
  particles: Particle[];
  ghostTrails: GhostTrail[];
  settings: SimulationSettings;
  camera: Camera;
  canvas: {
    width: number;
    height: number;
    internalWidth: number;
    internalHeight: number;
  };
  performance: {
    fps: number;
    frameTime: number;
  };
  massEllipsoid?: {
    center: Vector3;
    radii: Vector3;
    rotation: {
      matrix: number[];
      angles: Vector3;
    };
    lastUpdated: number;
  };
}