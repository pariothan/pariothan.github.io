import { useState, useCallback, useRef, useEffect } from 'react';
import { SimulationState, Particle, SimulationSettings, Camera, GhostTrail } from '../types/simulation';
import { PhysicsEngine } from '../utils/physics';
import { MassAnalysis } from '../utils/massAnalysis';

const DEFAULT_SETTINGS: SimulationSettings = {
  gravity: 150,
  collisionDistance: 0.5,
  minMass: 0.5,
  maxMass: 25,
  energyLoss: 0.3,
  particleCount: 250,
  trailLength: 300,
  trailOpacity: 0,
  trailCount: 25,
  is3D: false,
  isPaused: false,
  ellipsoidUpdateInterval: 0.05, // 0.05 seconds
  ellipsoidMassCapture: 70, // 70%
  minForceDistance: 5 // Minimum distance for gravity calculation
};

const DEFAULT_CAMERA: Camera = {
  position: { x: 400, y: 300, z: -1200 },
  rotation: { x: 0, y: 0 },
  zoom: 1,
  focalLength: 800
};

export function useSimulation() {
  const animationFrameRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  const fpsRef = useRef<number[]>([]);
  const lastEllipsoidUpdateRef = useRef<number>(0);
  const lastTopParticleIdsRef = useRef<Set<number>>(new Set());

  const [simulationState, setSimulationState] = useState<SimulationState>({
    particles: [],
    ghostTrails: [],
    settings: DEFAULT_SETTINGS,
    camera: DEFAULT_CAMERA,
    canvas: {
      width: 800,
      height: 600,
      internalWidth: 800,
      internalHeight: 600
    },
    performance: {
      fps: 60,
      frameTime: 16.67
    },
    massEllipsoid: undefined
  });

  const [isClickModeActive, setIsClickModeActive] = useState(false);
  const [clickModeMass, setClickModeMass] = useState(10);
  const [showEllipsoid, setShowEllipsoid] = useState(false);
  const [showParticles, setShowParticles] = useState(true);
  const [isCalculatingEllipsoid, setIsCalculatingEllipsoid] = useState(false);

  const generateRandomParticles = useCallback((count: number, canvasWidth: number, canvasHeight: number, is3D: boolean): Particle[] => {
    const particles: Particle[] = [];

    // Use consistent cube boundaries matching physics and visual rendering
    const cubeSize = 800;
    const centerX = 400;
    const centerY = 300;
    const centerZ = 0;
    const margin = 30; // for 2D mode
    
    console.log('Generating particles in', is3D ? '3D' : '2D', 'mode');
    
    for (let i = 0; i < count; i++) {
      const mass = Math.random() * (DEFAULT_SETTINGS.maxMass - DEFAULT_SETTINGS.minMass) + DEFAULT_SETTINGS.minMass;
      
      let position;
      if (is3D) {
        // Generate full 3D distribution
        const randomX = (Math.random() - 0.5) * (cubeSize - 60);
        const randomY = (Math.random() - 0.5) * (cubeSize - 60);
        const randomZ = (Math.random() - 0.5) * (cubeSize - 60);
        
        position = {
          x: centerX + randomX,
          y: centerY + randomY,
          z: centerZ + randomZ
        };
        
        if (i < 3) {
          console.log(`Particle ${i} 3D position:`, position);
        }
      } else {
        // 2D distribution
        position = {
          x: Math.random() * (canvasWidth - margin * 2) + margin,
          y: Math.random() * (canvasHeight - margin * 2) + margin,
          z: 0
        };
      }
      
      particles.push({
        id: i,
        mass,
        radius: Math.max(0.5, Math.sqrt(mass) * 0.3),
        position,
        velocity: {
          x: 0,
          y: 0,
          z: 0
        },
        color: '',
        trail: []
      });
    }
    
    return particles;
  }, []);

  const initializeSimulation = useCallback(() => {
    setSimulationState(prev => {
      const particles = generateRandomParticles(
        prev.settings.particleCount,
        prev.canvas.internalWidth,
        prev.canvas.internalHeight,
        prev.settings.is3D
      );

      return {
        ...prev,
        particles
      };
    });
  }, [generateRandomParticles]);

  const updateSimulation = useCallback((deltaTime: number, currentTime: number) => {
    setSimulationState(prev => {
      if (prev.settings.isPaused) return prev;

      const newParticles = [...prev.particles];
      if (newParticles.length === 0) return prev;
      
      const forces = new Map<number, { x: number; y: number; z: number }>();

      // Initialize forces
      newParticles.forEach(p => forces.set(p.id, { x: 0, y: 0, z: 0 }));

      // Calculate gravitational forces using direct N² particle-to-particle calculations
      for (let i = 0; i < newParticles.length; i++) {
        for (let j = i + 1; j < newParticles.length; j++) {
          const p1 = newParticles[i];
          const p2 = newParticles[j];
          
          const dx = p2.position.x - p1.position.x;
          const dy = p2.position.y - p1.position.y;
          const dz = p2.position.z - p1.position.z;
          
          const distanceSquared = dx * dx + dy * dy + dz * dz;
          const distance = Math.sqrt(distanceSquared);
          
          if (distance < 1) continue;
          
          // Use minimum distance to prevent extreme forces
          const effectiveDistance = Math.max(distance, prev.settings.minForceDistance);
          const forceMagnitude = (prev.settings.gravity * p1.mass * p2.mass) / (effectiveDistance * effectiveDistance);
          
          const forceX = (forceMagnitude * dx) / distance;
          const forceY = (forceMagnitude * dy) / distance;
          const forceZ = (forceMagnitude * dz) / distance;
          
          // Apply equal and opposite forces
          const force1 = forces.get(p1.id)!;
          force1.x += forceX;
          force1.y += forceY;
          force1.z += forceZ;
          
          const force2 = forces.get(p2.id)!;
          force2.x -= forceX;
          force2.y -= forceY;
          force2.z -= forceZ;
        }
      }

      // Update particles with forces
      newParticles.forEach(particle => {
        const force = forces.get(particle.id)!;
        PhysicsEngine.updateParticle(particle, force, deltaTime);
        PhysicsEngine.handleBoundaryCollisions(
          particle,
          prev.canvas.internalWidth,
          prev.canvas.internalHeight,
          prev.settings.is3D,
          prev.settings.energyLoss
        );
        PhysicsEngine.updateTrail(particle, prev.settings.trailLength);
      });

      // Handle particle collisions and merging
      const particlesToRemove = new Set<number>();
      const mergedParticles: Particle[] = [];
      const newGhostTrails: GhostTrail[] = [];

      for (let i = 0; i < newParticles.length; i++) {
        if (particlesToRemove.has(i)) continue;

        for (let j = i + 1; j < newParticles.length; j++) {
          if (particlesToRemove.has(j)) continue;

          if (PhysicsEngine.checkParticleCollision(
            newParticles[i],
            newParticles[j],
            prev.settings.collisionDistance
          )) {
            const merged = PhysicsEngine.mergeParticles(newParticles[i], newParticles[j]);
            mergedParticles.push(merged);

            // Save trails of merged particles as ghost trails if they have trails
            if (newParticles[i].trail.length > 5 && prev.settings.trailOpacity > 0) {
              newGhostTrails.push({
                trail: [...newParticles[i].trail],
                color: newParticles[i].color,
                opacity: prev.settings.trailOpacity,
                createdAt: currentTime
              });
            }
            if (newParticles[j].trail.length > 5 && prev.settings.trailOpacity > 0) {
              newGhostTrails.push({
                trail: [...newParticles[j].trail],
                color: newParticles[j].color,
                opacity: prev.settings.trailOpacity,
                createdAt: currentTime
              });
            }

            particlesToRemove.add(i);
            particlesToRemove.add(j);
            break;
          }
        }
      }

      // Filter out merged particles and add new merged ones
      const finalParticles = [
        ...newParticles.filter((_, index) => !particlesToRemove.has(index)),
        ...mergedParticles
      ];

      // Check for particles that lost their top massive status and save their trails as ghosts
      const particlesByMass = [...finalParticles].sort((a, b) => b.mass - a.mass);
      const currentTopParticleIds = new Set(
        particlesByMass.slice(0, prev.settings.trailCount).map(p => p.id)
      );

      // Find particles that were in top N but are no longer
      const lostStatusParticles = finalParticles.filter(
        p => lastTopParticleIdsRef.current.has(p.id) &&
             !currentTopParticleIds.has(p.id) &&
             p.trail.length > 5 &&
             prev.settings.trailOpacity > 0
      );

      // Add ghost trails for particles that lost top status
      lostStatusParticles.forEach(p => {
        newGhostTrails.push({
          trail: [...p.trail],
          color: p.color,
          opacity: prev.settings.trailOpacity,
          createdAt: currentTime
        });
      });

      // Mark new particles that gained top status with trail start time
      finalParticles.forEach(p => {
        if (currentTopParticleIds.has(p.id)) {
          // This particle should have a trail
          if (!lastTopParticleIdsRef.current.has(p.id)) {
            // Just gained top status - mark the start time
            p.trailStartTime = currentTime;
          } else if (p.trailStartTime === undefined) {
            // Was already in top but didn't have start time (legacy)
            p.trailStartTime = currentTime - 1000; // Already faded in
          }
        } else {
          // Not in top N, clear trail start time
          delete p.trailStartTime;
        }
      });

      // Update the ref for next frame
      lastTopParticleIdsRef.current = currentTopParticleIds;

      // Update ghost trails - fade them out and remove old ones
      const GHOST_TRAIL_FADE_DURATION = 1000; // 1 second
      const updatedGhostTrails = [
        ...prev.ghostTrails,
        ...newGhostTrails
      ]
        .map(ghost => ({
          ...ghost,
          opacity: Math.max(0, ghost.opacity * (1 - (currentTime - ghost.createdAt) / GHOST_TRAIL_FADE_DURATION))
        }))
        .filter(ghost => currentTime - ghost.createdAt < GHOST_TRAIL_FADE_DURATION);

      // Update mass ellipsoid every 5 seconds when ellipsoid is shown
      let updatedEllipsoid = prev.massEllipsoid;
      if (showEllipsoid && !isCalculatingEllipsoid && currentTime - lastEllipsoidUpdateRef.current > prev.settings.ellipsoidUpdateInterval * 1000) {
        // Calculate new ellipsoid asynchronously to avoid blocking
        setIsCalculatingEllipsoid(true);
        setTimeout(() => {
          const newEllipsoid = MassAnalysis.calculateMassEllipsoid(finalParticles, prev.settings.ellipsoidMassCapture);
          setSimulationState(current => ({
            ...current,
            massEllipsoid: newEllipsoid
          }));
          setIsCalculatingEllipsoid(false);
        }, 0);
        lastEllipsoidUpdateRef.current = currentTime;
      }
      
      return {
        ...prev,
        particles: finalParticles,
        ghostTrails: updatedGhostTrails,
        massEllipsoid: updatedEllipsoid
      };
    });
  }, [showEllipsoid, isCalculatingEllipsoid]);

  const updateSettings = useCallback((newSettings: Partial<SimulationSettings>) => {
    setSimulationState(prev => ({
      ...prev,
      settings: { ...prev.settings, ...newSettings }
    }));
  }, []);

  const updateCamera = useCallback((newCamera: Partial<Camera>) => {
    setSimulationState(prev => ({
      ...prev,
      camera: { ...prev.camera, ...newCamera }
    }));
  }, []);

  const resetSimulation = useCallback(() => {
    setSimulationState(prev => {
      const particles = generateRandomParticles(
        prev.settings.particleCount,
        prev.canvas.internalWidth,
        prev.canvas.internalHeight,
        prev.settings.is3D
      );

      return {
        ...prev,
        particles,
        camera: { ...DEFAULT_CAMERA },
        massEllipsoid: undefined
      };
    });
    lastEllipsoidUpdateRef.current = 0;
  }, [generateRandomParticles]);

  const addParticles = useCallback((count: number, mass: number) => {
    setSimulationState(prev => {
      const newParticles = generateRandomParticles(
        count,
        prev.canvas.internalWidth,
        prev.canvas.internalHeight,
        prev.settings.is3D
      ).map(particle => ({
        ...particle,
        mass,
        radius: Math.max(0.5, Math.sqrt(mass) * 0.3),
        id: Date.now() + Math.random() // Ensure unique IDs
      }));

      return {
        ...prev,
        particles: [...prev.particles, ...newParticles]
      };
    });
  }, [generateRandomParticles]);

  const addParticleAtPosition = useCallback((x: number, y: number, mass: number) => {
    setSimulationState(prev => {
      // Ensure coordinates are within bounds
      const clampedX = Math.max(5, Math.min(prev.canvas.width - 5, x));
      const clampedY = Math.max(5, Math.min(prev.canvas.height - 5, y));

      const newParticle: Particle = {
        id: Date.now() + Math.random(),
        mass,
        radius: Math.max(0.5, Math.sqrt(mass) * 0.3),
        position: {
          x: clampedX,
          y: clampedY,
          z: prev.settings.is3D ? (Math.random() - 0.5) * 800 : 0
        },
        velocity: {
          x: 0,
          y: 0,
          z: 0
        },
        color: '',
        trail: []
      };

      return {
        ...prev,
        particles: [...prev.particles, newParticle]
      };
    });
  }, []);

  const toggleClickMode = useCallback((enabled: boolean, mass: number) => {
    setIsClickModeActive(enabled);
    setClickModeMass(mass);
  }, []);

  const calculateEllipsoid = useCallback(() => {
    setSimulationState(prev => ({
      ...prev,
      massEllipsoid: MassAnalysis.calculateMassEllipsoid(prev.particles, prev.settings.ellipsoidMassCapture)
    }));
    setShowEllipsoid(true);
  }, []);

  const toggleEllipsoid = useCallback(() => {
    if (showEllipsoid) {
      setShowEllipsoid(false);
      setSimulationState(prev => ({
        ...prev,
        massEllipsoid: undefined
      }));
    } else {
      calculateEllipsoid();
    }
  }, [showEllipsoid, calculateEllipsoid]);

  const toggleParticles = useCallback(() => {
    setShowParticles(prev => !prev);
  }, []);

  const startAnimation = useCallback(() => {
    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }
      
      const deltaTime = Math.min((currentTime - lastTimeRef.current) / 1000, 0.016);

      // Calculate FPS
      const frameTime = currentTime - lastTimeRef.current;
      const fps = frameTime > 0 ? 1000 / frameTime : 60;
      fpsRef.current.push(fps);
      if (fpsRef.current.length > 60) fpsRef.current.shift();

      const averageFps = fpsRef.current.reduce((a, b) => a + b, 0) / fpsRef.current.length;

      setSimulationState(prev => ({
        ...prev,
        performance: {
          fps: Math.round(averageFps),
          frameTime: Math.round(deltaTime * 1000 * 100) / 100
        }
      }));

      updateSimulation(deltaTime, currentTime);
      lastTimeRef.current = currentTime;
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    lastTimeRef.current = 0;
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [updateSimulation]);

  const stopAnimation = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  }, []);

  useEffect(() => {
    initializeSimulation();
  }, [initializeSimulation]);

  useEffect(() => {
    startAnimation();
    return stopAnimation;
  }, [startAnimation, stopAnimation]);

  return {
    simulationState,
    updateSettings,
    updateCamera,
    resetSimulation,
    startAnimation,
    stopAnimation,
    addParticles,
    addParticleAtPosition,
    toggleClickMode,
    isClickModeActive,
    clickModeMass,
    toggleEllipsoid,
    showEllipsoid,
    toggleParticles,
    showParticles,
    generateRandomParticles
  };
}