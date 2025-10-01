import { Particle, Vector3 } from '../types/simulation';

export interface MassEllipsoid {
  center: Vector3;
  radii: Vector3;
  rotation: {
    // Rotation matrix (3x3) stored as flat array
    matrix: number[];
    // Euler angles for easier visualization (optional)
    angles: Vector3;
  };
  lastUpdated: number;
}

export class MassAnalysis {
  static calculateMassEllipsoid(particles: Particle[], massCapture: number = 95): MassEllipsoid {
    if (particles.length === 0) {
      return {
        center: { x: 400, y: 300, z: 0 },
        radii: { x: 50, y: 50, z: 50 },
        rotation: {
          matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1], // Identity matrix
          angles: { x: 0, y: 0, z: 0 }
        },
        lastUpdated: Date.now()
      };
    }

    // Calculate center of mass
    let totalMass = 0;
    let centerOfMass = { x: 0, y: 0, z: 0 };

    particles.forEach(particle => {
      totalMass += particle.mass;
      centerOfMass.x += particle.position.x * particle.mass;
      centerOfMass.y += particle.position.y * particle.mass;
      centerOfMass.z += particle.position.z * particle.mass;
    });

    centerOfMass.x /= totalMass;
    centerOfMass.y /= totalMass;
    centerOfMass.z /= totalMass;

    // Calculate covariance matrix using the specified mass capture percentage
    const targetMass = totalMass * (massCapture / 100);
    
    // Sort particles by distance from center of mass to select the capture percentage
    const particleDistances = particles.map(particle => {
      const dx = particle.position.x - centerOfMass.x;
      const dy = particle.position.y - centerOfMass.y;
      const dz = particle.position.z - centerOfMass.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      
      return { particle, distance };
    });
    
    particleDistances.sort((a, b) => a.distance - b.distance);
    
    // Select particles up to the target mass
    const selectedParticles = [];
    let cumulativeMass = 0;
    for (const item of particleDistances) {
      selectedParticles.push(item.particle);
      cumulativeMass += item.particle.mass;
      if (cumulativeMass >= targetMass) break;
    }

    let cxx = 0, cxy = 0, cxz = 0;
    let cyy = 0, cyz = 0, czz = 0;

    selectedParticles.forEach(particle => {
      const dx = particle.position.x - centerOfMass.x;
      const dy = particle.position.y - centerOfMass.y;
      const dz = particle.position.z - centerOfMass.z;
      const weight = particle.mass;

      cxx += weight * dx * dx;
      cxy += weight * dx * dy;
      cxz += weight * dx * dz;
      cyy += weight * dy * dy;
      cyz += weight * dy * dz;
      czz += weight * dz * dz;
    });

    // Normalize by total mass
    cxx /= cumulativeMass;
    cxy /= cumulativeMass;
    cxz /= cumulativeMass;
    cyy /= cumulativeMass;
    cyz /= cumulativeMass;
    czz /= cumulativeMass;

    // PCA via robust Jacobi eigen decomposition for symmetric covariance matrix
    const { eigenvalues, eigenvectors } = this.jacobiEigenDecomposition([
      [cxx, cxy, cxz],
      [cxy, cyy, cyz],
      [cxz, cyz, czz]
    ]);

    // Sort eigenvalues and corresponding eigenvectors in descending order
    const sorted = eigenvalues.map((val, i) => ({ val, vec: eigenvectors[i] }))
      .sort((a, b) => b.val - a.val);

    // Extract rotation matrix (eigenvectors as columns)
    const rotationMatrix = [
      sorted[0].vec[0], sorted[1].vec[0], sorted[2].vec[0],
      sorted[0].vec[1], sorted[1].vec[1], sorted[2].vec[1],
      sorted[0].vec[2], sorted[1].vec[2], sorted[2].vec[2]
    ];

    // Ensure right-handed, orthonormal basis (determinant > 0)
    const det =
      rotationMatrix[0] * (rotationMatrix[4] * rotationMatrix[8] - rotationMatrix[5] * rotationMatrix[7]) -
      rotationMatrix[1] * (rotationMatrix[3] * rotationMatrix[8] - rotationMatrix[5] * rotationMatrix[6]) +
      rotationMatrix[2] * (rotationMatrix[3] * rotationMatrix[7] - rotationMatrix[4] * rotationMatrix[6]);
    if (det < 0) {
      rotationMatrix[2] *= -1;
      rotationMatrix[5] *= -1;
      rotationMatrix[8] *= -1;
    }

    // Calculate radii (2 standard deviations along principal axes)
    // Ensure minimum proportional relationships to avoid extreme flattening
    const baseRadii = [
      Math.sqrt(Math.max(1, sorted[0].val)),
      Math.sqrt(Math.max(1, sorted[1].val)), 
      Math.sqrt(Math.max(1, sorted[2].val))
    ];
    
    // Apply scaling and ensure reasonable proportions
    const maxRadius = Math.max(...baseRadii);
    const minRadius = Math.max(maxRadius * 0.2, 15); // Minimum 20% of max radius or 15px
    
    const radii = {
      x: Math.max(minRadius, Math.min(300, baseRadii[0] * 2.5)),
      y: Math.max(minRadius, Math.min(300, baseRadii[1] * 2.5)),
      z: Math.max(minRadius, Math.min(300, baseRadii[2] * 2.5))
    };

    // Convert rotation matrix to Euler angles for visualization
    const angles = this.rotationMatrixToEuler(rotationMatrix);

    return {
      center: centerOfMass,
      radii,
      rotation: {
        matrix: rotationMatrix,
        angles
      },
      lastUpdated: Date.now()
    };
  }

  // Robust Jacobi eigen decomposition for 3x3 symmetric matrices
  private static jacobiEigenDecomposition(Ainit: number[][]) {
    // Copy input matrix
    const A = [
      [Ainit[0][0], Ainit[0][1], Ainit[0][2]],
      [Ainit[1][0], Ainit[1][1], Ainit[1][2]],
      [Ainit[2][0], Ainit[2][1], Ainit[2][2]],
    ];

    // Initialize eigenvector matrix as identity
    const V = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];

    const maxSweeps = 25;
    const eps = 1e-10;

    for (let sweep = 0; sweep < maxSweeps; sweep++) {
      // Find largest off-diagonal element
      let p = 0, q = 1;
      let maxVal = Math.abs(A[0][1]);
      const check = (i: number, j: number) => {
        const val = Math.abs(A[i][j]);
        if (val > maxVal) { maxVal = val; p = i; q = j; }
      };
      check(0, 2);
      check(1, 2);
      if (maxVal < eps) break;

      const app = A[p][p];
      const aqq = A[q][q];
      const apq = A[p][q];

      const tau = (aqq - app) / (2 * apq);
      const t = Math.sign(tau) / (Math.abs(tau) + Math.sqrt(1 + tau * tau));
      const c = 1 / Math.sqrt(1 + t * t);
      const s = t * c;

      // Update matrix A
      A[p][p] = app - t * apq;
      A[q][q] = aqq + t * apq;
      A[p][q] = A[q][p] = 0;

      for (let k = 0; k < 3; k++) {
        if (k === p || k === q) continue;
        const apk = A[p][k];
        const aqk = A[q][k];
        A[p][k] = A[k][p] = c * apk - s * aqk;
        A[q][k] = A[k][q] = s * apk + c * aqk;
      }

      // Update eigenvectors V
      for (let i = 0; i < 3; i++) {
        const vip = V[i][p];
        const viq = V[i][q];
        V[i][p] = c * vip - s * viq;
        V[i][q] = s * vip + c * viq;
      }
    }

    const eigenvalues = [A[0][0], A[1][1], A[2][2]];
    const eigenvectors = [
      [V[0][0], V[1][0], V[2][0]],
      [V[0][1], V[1][1], V[2][1]],
      [V[0][2], V[1][2], V[2][2]],
    ];

    return { eigenvalues, eigenvectors };
  }

  // Convert rotation matrix to Euler angles
  private static rotationMatrixToEuler(matrix: number[]): Vector3 {
    const [m00, m01, , m10, m11, , m20, m21, m22] = matrix;
    
    let x, y, z;
    
    if (Math.abs(m20) < 0.998) {
      y = Math.asin(-m20);
      x = Math.atan2(m21, m22);
      z = Math.atan2(m10, m00);
    } else {
      // Gimbal lock case
      y = Math.sign(-m20) * Math.PI / 2;
      x = 0;
      z = Math.atan2(-m01, m11);
    }
    
    return { x, y, z };
  }
}