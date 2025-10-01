import { useCallback, useRef } from 'react';
import { Particle, SimulationSettings } from '../types/simulation';
import { PhysicsEngine } from '../utils/physics';

interface BenchmarkResult {
  algorithm: string;
  particleCount: number;
  avgFps: number;
  minFps: number;
  maxFps: number;
  avgFrameTime: number;
  duration: number;
  renderQuality?: string;
}

export function useBenchmark(
  generateParticles: (count: number) => Particle[],
  settings: SimulationSettings
) {
  const benchmarkRef = useRef<{
    fpsValues: number[];
    frameTimeValues: number[];
    startTime: number;
  }>();

  const runBenchmark = useCallback(
    async (algorithm: string, particleCount: number, durationSeconds: number, highQuality?: boolean): Promise<BenchmarkResult> => {
      return new Promise((resolve) => {
        // Generate test particles
        const particles = generateParticles(particleCount);
        
        // Initialize benchmark tracking
        benchmarkRef.current = {
          fpsValues: [],
          frameTimeValues: [],
          startTime: performance.now()
        };

        let lastTime = 0;
        let animationId: number;

        const animate = (currentTime: number) => {
          if (lastTime === 0) {
            lastTime = currentTime;
            animationId = requestAnimationFrame(animate);
            return;
          }

          const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.016);
          const frameTime = currentTime - lastTime;
          const fps = frameTime > 0 ? 1000 / frameTime : 60;

          // Track metrics
          benchmarkRef.current!.fpsValues.push(fps);
          benchmarkRef.current!.frameTimeValues.push(frameTime);

          // Run physics simulation - brute force
          const forces = new Map<number, { x: number; y: number; z: number }>();
          particles.forEach(p => forces.set(p.id, { x: 0, y: 0, z: 0 }));

          for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
              const force = PhysicsEngine.calculateGravitationalForce(
                particles[i],
                particles[j],
                settings.gravity
              );

              const force1 = forces.get(particles[i].id)!;
              const force2 = forces.get(particles[j].id)!;

              force1.x += force.x;
              force1.y += force.y;
              force1.z += force.z;

              force2.x -= force.x;
              force2.y -= force.y;
              force2.z -= force.z;
            }
          }

          // Update particles
          particles.forEach(particle => {
            const force = forces.get(particle.id)!;
            PhysicsEngine.updateParticle(particle, force, deltaTime);
          });

          lastTime = currentTime;

          // Check if benchmark duration is complete
          const elapsed = (currentTime - benchmarkRef.current!.startTime) / 1000;
          if (elapsed >= durationSeconds) {
            cancelAnimationFrame(animationId);
            
            // Calculate results
            const fpsValues = benchmarkRef.current!.fpsValues;
            const frameTimeValues = benchmarkRef.current!.frameTimeValues;
            
            const result: BenchmarkResult = {
              algorithm,
              particleCount,
              avgFps: fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length,
              minFps: Math.min(...fpsValues),
              maxFps: Math.max(...fpsValues),
              avgFrameTime: frameTimeValues.reduce((a, b) => a + b, 0) / frameTimeValues.length,
              duration: elapsed,
              renderQuality: highQuality !== undefined ? (highQuality ? 'High Quality' : 'Fast Mode') : undefined
            };

            resolve(result);
          } else {
            animationId = requestAnimationFrame(animate);
          }
        };

        animationId = requestAnimationFrame(animate);
      });
    },
    [generateParticles, settings]
  );

  return { runBenchmark };
}
