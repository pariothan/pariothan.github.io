import { Particle, Camera, Vector3, Vector2 } from '../types/simulation';
import type { MassEllipsoid } from '../utils/massAnalysis';

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private camera: Camera;
  private colorCache: Map<number, string> = new Map();
  private useHighQuality: boolean = false; // Always use fast mode

  constructor(ctx: CanvasRenderingContext2D, camera: Camera) {
    this.ctx = ctx;
    this.camera = camera;
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  project3DTo2D(point: Vector3): Vector2 {
    // Apply camera rotation
    // Translate to origin-centered coordinates
    const centeredX = point.x - 400;
    const centeredY = point.y - 300;
    const centeredZ = point.z;
    
    // Apply Y rotation (horizontal)
    const rotatedX = centeredX * Math.cos(this.camera.rotation.y) - centeredZ * Math.sin(this.camera.rotation.y);
    const rotatedZ = centeredX * Math.sin(this.camera.rotation.y) + centeredZ * Math.cos(this.camera.rotation.y);
    
    // Apply X rotation (vertical)
    const rotatedY = centeredY * Math.cos(this.camera.rotation.x) - rotatedZ * Math.sin(this.camera.rotation.x);
    const finalZ = centeredY * Math.sin(this.camera.rotation.x) + rotatedZ * Math.cos(this.camera.rotation.x);

    // Apply camera position
    const relativePosX = rotatedX;
    const relativePosY = rotatedY;
    const relativePosZ = finalZ - this.camera.position.z;

    // Perspective projection
    const scale = this.camera.focalLength / Math.max(relativePosZ, 200);
    const x = (relativePosX * scale * this.camera.zoom) + 400;
    const y = (relativePosY * scale * this.camera.zoom) + 300;

    return { x, y };
  }

  calculateDepth(point: Vector3): number {
    // Transform point to camera space
    const centeredX = point.x - 400;
    const centeredY = point.y - 300;
    const centeredZ = point.z;
    
    // Apply Y rotation (horizontal)
    const cosY = Math.cos(this.camera.rotation.y);
    const sinY = Math.sin(this.camera.rotation.y);
    const rotatedZ = centeredX * sinY + centeredZ * cosY;
    
    // Apply X rotation (vertical)
    const cosX = Math.cos(this.camera.rotation.x);
    const sinX = Math.sin(this.camera.rotation.x);
    const finalZ = centeredY * sinX + rotatedZ * cosX;
    
    // Return distance from camera
    return finalZ - this.camera.position.z;
  }

  generateParticleColor(particle: Particle): string {
    // Cache colors to avoid recalculating every frame
    if (this.colorCache.has(particle.id)) {
      return this.colorCache.get(particle.id)!;
    }
    
    const hue = (particle.id * 137.508) % 360;
    const saturation = 100; // Full saturation for vibrant colors
    const lightness = Math.min(75, 60 + (particle.mass / 25) * 15); // Brighter
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

    this.colorCache.set(particle.id, color);
    return color;
  }

  drawParticle(particle: Particle, is3D: boolean): void {
    let screenPos: Vector2;
    let depth = 1;

    if (is3D) {
      screenPos = this.project3DTo2D(particle.position);
      depth = this.calculateDepth(particle.position);
    } else {
      screenPos = { x: particle.position.x, y: particle.position.y };
    }

    // Calculate radius based on depth and zoom in 3D mode (95% bigger visually in 3D, 50% in 2D)
    const displayRadius = is3D ?
      Math.max(0.5, particle.radius * 1.95 * this.camera.zoom * Math.max(0.3, 800 / Math.max(Math.abs(depth), 100))) :
      particle.radius * 1.5;
    
    if (displayRadius < 0.2) return;

    const color = this.generateParticleColor(particle);
    const alpha = is3D ? Math.min(1, Math.max(0.1, 1000 / Math.max(Math.abs(depth), 100))) : 1;

    if (this.useHighQuality) {
      // High quality: gradient glow effect
      const gradient = this.ctx.createRadialGradient(
        screenPos.x, screenPos.y, 0,
        screenPos.x, screenPos.y, displayRadius * 1.5
      );

      const colorWithAlpha = color.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
      const colorWithFadeAlpha = color.replace('hsl', 'hsla').replace(')', `, ${alpha * 0.8})`);
      const colorTransparent = color.replace('hsl', 'hsla').replace(')', `, 0)`);
      
      gradient.addColorStop(0, colorWithAlpha);
      gradient.addColorStop(0.4, colorWithFadeAlpha);
      gradient.addColorStop(1, colorTransparent);

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, displayRadius * 1.5, 0, Math.PI * 2);
      this.ctx.fill();
    } else {
      // Fast mode: solid circle, no effects
      const colorWithAlpha = color.replace('hsl', 'hsla').replace(')', `, ${alpha})`);
      this.ctx.fillStyle = colorWithAlpha;
      this.ctx.beginPath();
      this.ctx.arc(screenPos.x, screenPos.y, displayRadius, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawTrail(particle: Particle, is3D: boolean, trailOpacity: number): void {
    if (particle.trail.length < 2 || trailOpacity === 0) return;

    const color = this.generateParticleColor(particle);
    this.drawTrailPath(particle.trail, color, trailOpacity, is3D);
  }

  drawGhostTrail(trail: Vector3[], color: string, opacity: number, is3D: boolean): void {
    if (trail.length < 2 || opacity === 0) return;
    this.drawTrailPath(trail, color, opacity, is3D);
  }

  private drawTrailPath(trail: Vector3[], color: string, trailOpacity: number, is3D: boolean): void {
    // Convert hsl(h, s%, l%) to hsla(h, s%, l%, a)
    const colorWithAlpha = color.replace('hsl', 'hsla').replace(')', `, ${trailOpacity})`);

    this.ctx.lineWidth = 2;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Aggressive sampling - only render every 3rd or 4th point
    const sampleRate = this.useHighQuality ?
      (trail.length > 30 ? 3 : 2) :
      (trail.length > 20 ? 4 : 3);

    // Project sampled points
    const projectedPoints: Vector2[] = [];
    for (let i = 0; i < trail.length; i += sampleRate) {
      if (is3D) {
        projectedPoints.push(this.project3DTo2D(trail[i]));
      } else {
        projectedPoints.push({ x: trail[i].x, y: trail[i].y });
      }
    }

    if (projectedPoints.length < 2) return;

    // Use solid color matching particle
    this.ctx.strokeStyle = colorWithAlpha;

    // Draw trail as single path
    this.ctx.beginPath();
    this.ctx.moveTo(projectedPoints[0].x, projectedPoints[0].y);

    for (let i = 1; i < projectedPoints.length; i++) {
      this.ctx.lineTo(projectedPoints[i].x, projectedPoints[i].y);
    }

    this.ctx.stroke();
  }

  draw3DGrid(): void {
    // Classical manuscript grid colors
    this.ctx.strokeStyle = 'rgba(101, 67, 33, 0.15)'; // Manuscript brown with low opacity
    this.ctx.lineWidth = 1;

    // Define cube centered at (400, 300, 0) with 800x800x800 dimensions
    const cubeSize = 800;
    const half = cubeSize / 2;
    const centerX = 400;
    const centerY = 300;
    const centerZ = 0;

    // Define the 8 corners of the cube
    const corners = [
      { x: centerX - half, y: centerY - half, z: centerZ - half }, // front bottom left
      { x: centerX + half, y: centerY - half, z: centerZ - half }, // front bottom right
      { x: centerX + half, y: centerY + half, z: centerZ - half }, // front top right
      { x: centerX - half, y: centerY + half, z: centerZ - half }, // front top left
      { x: centerX - half, y: centerY - half, z: centerZ + half }, // back bottom left
      { x: centerX + half, y: centerY - half, z: centerZ + half }, // back bottom right
      { x: centerX + half, y: centerY + half, z: centerZ + half }, // back top right
      { x: centerX - half, y: centerY + half, z: centerZ + half }  // back top left
    ];

    // Project all corners to 2D
    const projectedCorners = corners.map(corner => this.project3DTo2D(corner));

    // Draw the cube edges with manuscript styling
    this.ctx.strokeStyle = 'rgba(139, 111, 70, 0.5)'; // Warm brown for cube edges
    this.ctx.lineWidth = 2;

    // Front face edges
    const frontEdges = [[0,1], [1,2], [2,3], [3,0]];
    frontEdges.forEach(([start, end]) => {
      this.ctx.beginPath();
      this.ctx.moveTo(projectedCorners[start].x, projectedCorners[start].y);
      this.ctx.lineTo(projectedCorners[end].x, projectedCorners[end].y);
      this.ctx.stroke();
    });

    // Back face edges
    const backEdges = [[4,5], [5,6], [6,7], [7,4]];
    backEdges.forEach(([start, end]) => {
      this.ctx.beginPath();
      this.ctx.moveTo(projectedCorners[start].x, projectedCorners[start].y);
      this.ctx.lineTo(projectedCorners[end].x, projectedCorners[end].y);
      this.ctx.stroke();
    });

    // Connecting edges (front to back)
    const connectingEdges = [[0,4], [1,5], [2,6], [3,7]];
    connectingEdges.forEach(([start, end]) => {
      this.ctx.beginPath();
      this.ctx.moveTo(projectedCorners[start].x, projectedCorners[start].y);
      this.ctx.lineTo(projectedCorners[end].x, projectedCorners[end].y);
      this.ctx.stroke();
    });

  }

  drawMassEllipsoid(ellipsoid: MassEllipsoid, is3D: boolean): void {
    if (!is3D) return;

    const { center, radii, rotation } = ellipsoid;

    // Helper: apply 3x3 rotation matrix to a local point
    const applyRotation = (p: Vector3): Vector3 => {
      const m = rotation?.matrix;
      if (!m || m.length !== 9 || m.some(v => !isFinite(v))) {
        return p; // fallback to identity
      }
      const [m00, m01, m02, m10, m11, m12, m20, m21, m22] = m;
      return {
        x: m00 * p.x + m01 * p.y + m02 * p.z,
        y: m10 * p.x + m11 * p.y + m12 * p.z,
        z: m20 * p.x + m21 * p.y + m22 * p.z,
      };
    };

    // Shaded ellipsoid with outline only
    const resolution = 32; // tessellation resolution
    
    // Generate triangular faces for the ellipsoid surface
    const faces: { vertices: Vector3[]; center: Vector3; depth: number; normal: Vector3 }[] = [];
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const u1 = i / resolution;
        const v1 = j / resolution;
        const u2 = (i + 1) / resolution;
        const v2 = (j + 1) / resolution;
        
        // Convert UV to spherical coordinates and scale by ellipsoid radii
        const createVertex = (u: number, v: number): Vector3 => {
          const theta = u * Math.PI * 2; // azimuth
          const phi = v * Math.PI; // polar angle
          
          const x = radii.x * Math.sin(phi) * Math.cos(theta);
          const y = radii.y * Math.sin(phi) * Math.sin(theta);
          const z = radii.z * Math.cos(phi);
          
          const rotated = applyRotation({ x, y, z });
          return {
            x: center.x + rotated.x,
            y: center.y + rotated.y,
            z: center.z + rotated.z
          };
        };
        
        // Create two triangles per quad
        const v1_vertex = createVertex(u1, v1);
        const v2_vertex = createVertex(u2, v1);
        const v3_vertex = createVertex(u1, v2);
        const v4_vertex = createVertex(u2, v2);
        
        // Triangle 1
        const tri1_center = {
          x: (v1_vertex.x + v2_vertex.x + v3_vertex.x) / 3,
          y: (v1_vertex.y + v2_vertex.y + v3_vertex.y) / 3,
          z: (v1_vertex.z + v2_vertex.z + v3_vertex.z) / 3
        };
        
        // Triangle 2
        const tri2_center = {
          x: (v2_vertex.x + v3_vertex.x + v4_vertex.x) / 3,
          y: (v2_vertex.y + v3_vertex.y + v4_vertex.y) / 3,
          z: (v2_vertex.z + v3_vertex.z + v4_vertex.z) / 3
        };
        
        // Calculate face normals (for lighting)
        const edge1_1 = { x: v2_vertex.x - v1_vertex.x, y: v2_vertex.y - v1_vertex.y, z: v2_vertex.z - v1_vertex.z };
        const edge2_1 = { x: v3_vertex.x - v1_vertex.x, y: v3_vertex.y - v1_vertex.y, z: v3_vertex.z - v1_vertex.z };
        const normal1 = {
          x: edge1_1.y * edge2_1.z - edge1_1.z * edge2_1.y,
          y: edge1_1.z * edge2_1.x - edge1_1.x * edge2_1.z,
          z: edge1_1.x * edge2_1.y - edge1_1.y * edge2_1.x
        };
        
        faces.push({
          vertices: [v1_vertex, v2_vertex, v3_vertex],
          center: tri1_center,
          depth: this.calculateDepth(tri1_center),
          normal: normal1
        });
        
        faces.push({
          vertices: [v2_vertex, v3_vertex, v4_vertex],
          center: tri2_center,
          depth: this.calculateDepth(tri2_center),
          normal: normal1 // simplified - using same normal
        });
      }
    }
    
    // Sort faces back-to-front for proper alpha blending
    faces.sort((a, b) => a.depth - b.depth);
    
    // Draw filled faces with depth-based transparency
    const minDepth = faces.length ? Math.min(...faces.map(f => f.depth)) : 0;
    const maxDepth = faces.length ? Math.max(...faces.map(f => f.depth)) : 1;
    const depthRange = Math.max(1, maxDepth - minDepth);
    
    for (const face of faces) {
      const projectedVerts = face.vertices.map(v => this.project3DTo2D(v));
      
      // Calculate depth-based alpha and lighting
      const depthFactor = (face.depth - minDepth) / depthRange;
      const alpha = 0.15 + 0.25 * (1 - depthFactor); // closer faces more opaque
      
      // Simple lighting based on normal (assume light from camera)
      const normalLength = Math.sqrt(face.normal.x ** 2 + face.normal.y ** 2 + face.normal.z ** 2) || 1;
      const lightFactor = Math.max(0.3, Math.abs(face.normal.z) / normalLength);
      
      this.ctx.fillStyle = `rgba(184, 134, 11, ${(alpha * lightFactor).toFixed(3)})`;
      this.ctx.beginPath();
      this.ctx.moveTo(projectedVerts[0].x, projectedVerts[0].y);
      projectedVerts.slice(1).forEach(v => this.ctx.lineTo(v.x, v.y));
      this.ctx.closePath();
      this.ctx.fill();
    }
    
    // Draw three meridians aligned with simulation's world coordinate system
    this.ctx.lineWidth = 2;
    
    // Helper function to draw a meridian on a specific world plane
    const drawMeridian = (planeType: 'XY' | 'XZ' | 'YZ', color: string) => {
      this.ctx.strokeStyle = color;
      this.ctx.beginPath();
      let isFirst = true;
      
      for (let i = 0; i <= samples; i++) {
        const angle = (i / samples) * Math.PI * 2;
        let worldX: number, worldY: number, worldZ: number;
        
        // Define circles in each world plane passing through sim center
        if (planeType === 'XY') {
          // XY plane at Z=0
          worldX = 400 + Math.cos(angle) * 200;
          worldY = 300 + Math.sin(angle) * 200;
          worldZ = 0;
        } else if (planeType === 'XZ') {
          // XZ plane at Y=300
          worldX = 400 + Math.cos(angle) * 200;
          worldY = 300;
          worldZ = Math.sin(angle) * 200;
        } else {
          // YZ plane at X=400
          worldX = 400;
          worldY = 300 + Math.cos(angle) * 200;
          worldZ = Math.sin(angle) * 200;
        }
        
        // Find where this intersects the ellipsoid
        const relativePos = {
          x: worldX - center.x,
          y: worldY - center.y, 
          z: worldZ - center.z
        };
        
        // Apply inverse rotation (transpose)
        const m = rotation.matrix;
        const localPoint = {
          x: m[0] * relativePos.x + m[3] * relativePos.y + m[6] * relativePos.z,
          y: m[1] * relativePos.x + m[4] * relativePos.y + m[7] * relativePos.z,
          z: m[2] * relativePos.x + m[5] * relativePos.y + m[8] * relativePos.z
        };
        
        // Project to ellipsoid surface
        const ellipsoidEq = (localPoint.x / radii.x) ** 2 + (localPoint.y / radii.y) ** 2 + (localPoint.z / radii.z) ** 2;
        if (ellipsoidEq > 0.01) {
          const scale = 1 / Math.sqrt(ellipsoidEq);
          const surfaceLocal = {
            x: localPoint.x * scale,
            y: localPoint.y * scale,
            z: localPoint.z * scale
          };
          
          // Transform back to world
          const surfaceRotated = applyRotation(surfaceLocal);
          const surfaceWorld = {
            x: center.x + surfaceRotated.x,
            y: center.y + surfaceRotated.y,
            z: center.z + surfaceRotated.z
          };
          
          const projected = this.project3DTo2D(surfaceWorld);
          
          if (isFirst) {
            this.ctx.moveTo(projected.x, projected.y);
            isFirst = false;
          } else {
            this.ctx.lineTo(projected.x, projected.y);
          }
        }
      }
      this.ctx.stroke();
    };

    // Draw meridians that are fixed to world axes, showing ellipsoid orientation
    const samples = 64;
    
    // Draw all three meridians with different colors at lower opacity
    drawMeridian('XY', 'rgba(220, 38, 127, 0.3)');  // Pink for XY plane (Z=0)
    drawMeridian('XZ', 'rgba(34, 197, 94, 0.3)');   // Green for XZ plane (Y=300)
    drawMeridian('YZ', 'rgba(59, 130, 246, 0.3)');  // Blue for YZ plane (X=400)
  }
}