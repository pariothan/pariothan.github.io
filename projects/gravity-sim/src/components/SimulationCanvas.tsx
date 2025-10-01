import React, { useRef, useEffect, useCallback } from 'react';
import { SimulationState } from '../types/simulation';
import { Renderer } from '../utils/renderer';

interface SimulationCanvasProps {
  simulationState: SimulationState;
  onCameraUpdate: (camera: Partial<SimulationState['camera']>) => void;
  onCanvasClick?: (x: number, y: number, mass: number) => void;
  isClickModeActive?: boolean;
  showEllipsoid?: boolean;
  showParticles?: boolean;
}
export function SimulationCanvas({ 
  simulationState, 
  onCameraUpdate, 
  onCanvasClick,
  isClickModeActive = false,
  showEllipsoid = false,
  showParticles = true
}: SimulationCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });
  const frameCounterRef = useRef(0);

  const handleCanvasClick = useCallback((e: React.MouseEvent) => {
    if (!isClickModeActive || !onCanvasClick || isDraggingRef.current) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    onCanvasClick(x, y, 10); // Default mass for click mode
  }, [isClickModeActive, onCanvasClick]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!simulationState.settings.is3D) return;
    
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  }, [simulationState.settings.is3D]);

  const handleMouseClick = useCallback((e: React.MouseEvent) => {
    if (isDraggingRef.current) return; // Don't place dots if we were dragging
    handleCanvasClick(e);
  }, [handleCanvasClick]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDraggingRef.current || !simulationState.settings.is3D) return;

    const deltaX = e.clientX - lastMousePosRef.current.x;
    const deltaY = e.clientY - lastMousePosRef.current.y;

    const sensitivity = 0.005;
    const newRotationX = simulationState.camera.rotation.x + deltaY * sensitivity;
    const newRotationY = simulationState.camera.rotation.y + deltaX * sensitivity;

    onCameraUpdate({
      rotation: {
        x: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, newRotationX)),
        y: newRotationY
      }
    });

    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
  }, [simulationState.camera.rotation, simulationState.settings.is3D, onCameraUpdate]);

  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false;
  }, []);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!simulationState.settings.is3D) return;
    
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, simulationState.camera.zoom * zoomFactor));
    
    onCameraUpdate({ zoom: newZoom });
  }, [simulationState.camera.zoom, simulationState.settings.is3D, onCameraUpdate]);

  // Initialize renderer
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high DPI canvas
    const dpr = window.devicePixelRatio || 1;
    const displayWidth = 800;
    const displayHeight = 600;
    
    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    ctx.scale(dpr, dpr);
    
    canvas.style.width = displayWidth + 'px';
    canvas.style.height = displayHeight + 'px';

    rendererRef.current = new Renderer(ctx, simulationState.camera);
  }, [simulationState.camera]);

  // Render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !rendererRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Update renderer camera
    rendererRef.current = new Renderer(ctx, simulationState.camera);

    // Clear canvas
    rendererRef.current.clear();

    // Set background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 800, 600);

    // Draw 3D grid if in 3D mode
    if (simulationState.settings.is3D) {
      rendererRef.current.draw3DGrid();
    }

    // Sort particles by depth for proper rendering in 3D
    let sortedParticles = [...simulationState.particles];
    if (simulationState.settings.is3D) {
      sortedParticles.sort((a, b) => {
        const depthA = rendererRef.current!.calculateDepth(a.position);
        const depthB = rendererRef.current!.calculateDepth(b.position);
        return depthB - depthA; // Far to near
      });
    }

    // Draw ghost trails (fading trails from deleted particles)
    if (showParticles) {
      simulationState.ghostTrails.forEach(ghost => {
        rendererRef.current!.drawGhostTrail(
          ghost.trail,
          ghost.color,
          ghost.opacity,
          simulationState.settings.is3D
        );
      });
    }

    // Draw particle trails (only for top N most massive particles)
    if (showParticles && simulationState.settings.trailOpacity > 0) {
      const particlesByMass = [...sortedParticles].sort((a, b) => b.mass - a.mass);
      const topN = particlesByMass.slice(0, simulationState.settings.trailCount);
      const currentTime = performance.now();
      const TRAIL_FADE_IN_DURATION = 1000; // 1 second fade in

      topN.forEach(particle => {
        // Calculate fade-in opacity based on trail start time
        let opacity = simulationState.settings.trailOpacity;
        if (particle.trailStartTime !== undefined) {
          const timeSinceStart = currentTime - particle.trailStartTime;
          if (timeSinceStart < TRAIL_FADE_IN_DURATION) {
            // Fade in from 0 to full opacity
            const fadeInProgress = timeSinceStart / TRAIL_FADE_IN_DURATION;
            opacity = simulationState.settings.trailOpacity * fadeInProgress;
          }
        }

        rendererRef.current!.drawTrail(
          particle,
          simulationState.settings.is3D,
          opacity
        );
      });
    }

    // Draw particles
    if (showParticles) {
      sortedParticles.forEach(particle => {
        rendererRef.current!.drawParticle(particle, simulationState.settings.is3D);
      });
    }

    // Draw mass ellipsoid if available and in 3D mode (always draw last computed to avoid flicker)
    frameCounterRef.current++;
    if (simulationState.massEllipsoid && simulationState.settings.is3D && showEllipsoid) {
      rendererRef.current!.drawMassEllipsoid(simulationState.massEllipsoid, simulationState.settings.is3D);
    }
  }, [simulationState, showEllipsoid, showParticles]);

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden shadow-xl">
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className={`w-full h-full ${
          isClickModeActive 
            ? 'cursor-crosshair' 
            : simulationState.settings.is3D 
              ? 'cursor-grab active:cursor-grabbing' 
              : 'cursor-default'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleMouseClick}
        onWheel={handleWheel}
        style={{ width: '800px', height: '600px' }}
      />
      
      {isClickModeActive && (
        <div className="absolute top-4 left-4 bg-blue-600 bg-opacity-90 text-white px-3 py-2 rounded text-sm">
          <div className="font-medium">Click Mode Active</div>
          <div className="text-xs text-blue-200">Click to place particles</div>
        </div>
      )}
      
      {simulationState.settings.is3D && !isClickModeActive && (
        <div className="absolute top-4 right-4 bg-black bg-opacity-50 text-white px-3 py-2 rounded text-sm">
          <div>3D Mode Active</div>
          <div className="text-xs text-gray-300">Drag to rotate • Scroll to zoom</div>
        </div>
      )}
    </div>
  );
}