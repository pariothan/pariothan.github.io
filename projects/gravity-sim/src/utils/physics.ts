import { Vector3, Particle } from '../types/simulation';

export class PhysicsEngine {
  private static readonly MIN_FORCE_DISTANCE = 15; // Minimum distance for force calculation

  static calculateGravitationalForce(p1: Particle, p2: Particle, gravity: number): Vector3 {
    const dx = p2.position.x - p1.position.x;
    const dy = p2.position.y - p1.position.y;
    const dz = p2.position.z - p1.position.z;
    
    const distanceSquared = dx * dx + dy * dy + dz * dz;
    const distance = Math.sqrt(distanceSquared);
    
    if (distance < 1) return { x: 0, y: 0, z: 0 };
    
    // Use minimum distance to cap maximum force
    const effectiveDistance = Math.max(distance, this.MIN_FORCE_DISTANCE);
    const force = (gravity * p1.mass * p2.mass) / (effectiveDistance * effectiveDistance);
    const forceX = force * dx / distance;
    const forceY = force * dy / distance;
    const forceZ = force * dz / distance;
    
    return { x: forceX, y: forceY, z: forceZ };
  }

  static updateParticle(particle: Particle, force: Vector3, deltaTime: number): void {
    // Update velocity using F = ma
    const acceleration = {
      x: force.x / particle.mass,
      y: force.y / particle.mass,
      z: force.z / particle.mass
    };
    
    particle.velocity.x += acceleration.x * deltaTime;
    particle.velocity.y += acceleration.y * deltaTime;
    particle.velocity.z += acceleration.z * deltaTime;
    
    // Update position
    particle.position.x += particle.velocity.x * deltaTime;
    particle.position.y += particle.velocity.y * deltaTime;
    particle.position.z += particle.velocity.z * deltaTime;
  }

  static handleBoundaryCollisions(particle: Particle, canvasWidth: number, canvasHeight: number, is3D: boolean, energyLoss: number = 0.3): void {
    const radius = particle.radius;
    // Convert energyLoss (0-1, how much is lost) to damping factor (0-1, how much is retained)
    const damping = 1 - energyLoss;
    
    // Use consistent cube boundaries for all dimensions in 3D mode
    if (is3D) {
      const cubeSize = 800;
      const half = cubeSize / 2;
      const centerX = 400;
      const centerY = 300;
      const centerZ = 0;
      
      // X boundaries
      if (particle.position.x - radius < centerX - half) {
        particle.position.x = centerX - half + radius;
        particle.velocity.x *= -damping;
        console.log(`X- collision: vel before=${particle.velocity.x / -damping}, after=${particle.velocity.x}, damping=${damping}`);
      } else if (particle.position.x + radius > centerX + half) {
        particle.position.x = centerX + half - radius;
        particle.velocity.x *= -damping;
        console.log(`X+ collision: vel before=${particle.velocity.x / -damping}, after=${particle.velocity.x}, damping=${damping}`);
      }
      
      // Y boundaries  
      if (particle.position.y - radius < centerY - half) {
        particle.position.y = centerY - half + radius;
        particle.velocity.y *= -damping;
        console.log(`Y- collision: vel before=${particle.velocity.y / -damping}, after=${particle.velocity.y}, damping=${damping}`);
      } else if (particle.position.y + radius > centerY + half) {
        particle.position.y = centerY + half - radius;
        particle.velocity.y *= -damping;
        console.log(`Y+ collision: vel before=${particle.velocity.y / -damping}, after=${particle.velocity.y}, damping=${damping}`);
      }
      
      // Z boundaries
      if (particle.position.z - radius < centerZ - half) {
        particle.position.z = centerZ - half + radius;
        particle.velocity.z *= -damping;
        console.log(`Z- collision: vel before=${particle.velocity.z / -damping}, after=${particle.velocity.z}, damping=${damping}`);
      } else if (particle.position.z + radius > centerZ + half) {
        particle.position.z = centerZ + half - radius;
        particle.velocity.z *= -damping;
        console.log(`Z+ collision: vel before=${particle.velocity.z / -damping}, after=${particle.velocity.z}, damping=${damping}`);
      }
    } else {
      // 2D mode boundaries (legacy)
      // X boundaries
      if (particle.position.x - radius < 2) {
        particle.position.x = radius + 2;
        particle.velocity.x *= -damping;
        console.log(`2D X- collision: vel before=${particle.velocity.x / -damping}, after=${particle.velocity.x}, damping=${damping}`);
      } else if (particle.position.x + radius > canvasWidth - 2) {
        particle.position.x = canvasWidth - radius - 2;
        particle.velocity.x *= -damping;
        console.log(`2D X+ collision: vel before=${particle.velocity.x / -damping}, after=${particle.velocity.x}, damping=${damping}`);
      }
      
      // Y boundaries
      if (particle.position.y - radius < 2) {
        particle.position.y = radius + 2;
        particle.velocity.y *= -damping;
        console.log(`2D Y- collision: vel before=${particle.velocity.y / -damping}, after=${particle.velocity.y}, damping=${damping}`);
      } else if (particle.position.y + radius > canvasHeight - 2) {
        particle.position.y = canvasHeight - radius - 2;
        particle.velocity.y *= -damping;
        console.log(`2D Y+ collision: vel before=${particle.velocity.y / -damping}, after=${particle.velocity.y}, damping=${damping}`);
      }
    }
  }

  static checkParticleCollision(p1: Particle, p2: Particle, collisionDistance: number): boolean {
    const dx = p1.position.x - p2.position.x;
    const dy = p1.position.y - p2.position.y;
    const dz = p1.position.z - p2.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    
    return distance < collisionDistance;
  }

  static mergeParticles(p1: Particle, p2: Particle): Particle {
    const totalMass = p1.mass + p2.mass;
    
    // Conservation of momentum
    const newVelocity = {
      x: (p1.velocity.x * p1.mass + p2.velocity.x * p2.mass) / totalMass,
      y: (p1.velocity.y * p1.mass + p2.velocity.y * p2.mass) / totalMass,
      z: (p1.velocity.z * p1.mass + p2.velocity.z * p2.mass) / totalMass
    };
    
    // Center of mass position
    const newPosition = {
      x: (p1.position.x * p1.mass + p2.position.x * p2.mass) / totalMass,
      y: (p1.position.y * p1.mass + p2.position.y * p2.mass) / totalMass,
      z: (p1.position.z * p1.mass + p2.position.z * p2.mass) / totalMass
    };
    
    return {
      ...p1,
      mass: totalMass,
      radius: Math.sqrt(p1.radius * p1.radius + p2.radius * p2.radius),
      position: newPosition,
      velocity: newVelocity,
      trail: [...p1.trail, ...p2.trail].slice(-50) // Combine trails
    };
  }

  static updateTrail(particle: Particle, trailLength: number): void {
    particle.trail.push({ ...particle.position });
    
    const maxTrailPoints = Math.floor(trailLength);
    if (particle.trail.length > maxTrailPoints) {
      particle.trail = particle.trail.slice(-maxTrailPoints);
    }
  }
}