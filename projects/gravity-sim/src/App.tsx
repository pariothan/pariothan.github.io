
import { useState } from 'react';
import { useSimulation } from './hooks/useSimulation';
import { useBenchmark } from './hooks/useBenchmark';
import { SimulationCanvas } from './components/SimulationCanvas';
import { ControlPanel } from './components/ControlPanel';
import { DotCreationPanel } from './components/DotCreationPanel';
import { BenchmarkPanel } from './components/BenchmarkPanel';
import { Atom } from 'lucide-react';

function App() {
  console.log('App rendering');
  const [showBenchmark, setShowBenchmark] = useState(false);
  
  const {
    simulationState,
    updateSettings,
    updateCamera,
    resetSimulation,
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
  } = useSimulation();

  const handleBenchmark = async (algorithm: string, particleCount: number, duration: number, highQuality?: boolean) => {
    // For rendering benchmarks, measure FPS
    if (highQuality !== undefined) {
      const originalPaused = simulationState.settings.isPaused;
      
      // Start simulation
      updateSettings({ 
        isPaused: false
      });
      
      // Wait a bit for settings to apply
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Measure FPS over the duration
      const fpsValues: number[] = [];
      const frameTimeValues: number[] = [];
      const startTime = performance.now();
      
      return new Promise<any>((resolve) => {
        let lastTime = performance.now();
        
        const measure = () => {
          const currentTime = performance.now();
          const frameTime = currentTime - lastTime;
          const fps = frameTime > 0 ? 1000 / frameTime : 60;
          
          fpsValues.push(fps);
          frameTimeValues.push(frameTime);
          lastTime = currentTime;
          
          const elapsed = (currentTime - startTime) / 1000;
          if (elapsed >= duration) {
            // Restore original settings
            updateSettings({ 
              isPaused: originalPaused
            });
            
            resolve({
              algorithm,
              particleCount: simulationState.particles.length,
              avgFps: fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length,
              minFps: Math.min(...fpsValues),
              maxFps: Math.max(...fpsValues),
              avgFrameTime: frameTimeValues.reduce((a, b) => a + b, 0) / frameTimeValues.length,
              duration: elapsed,
              renderQuality: 'Fast Mode'
            });
          } else {
            requestAnimationFrame(measure);
          }
        };
        
        requestAnimationFrame(measure);
      });
    }
    
    // For algorithm benchmarks, use the existing hook
    return runBenchmark(algorithm, particleCount, duration, highQuality);
  };

  const { runBenchmark } = useBenchmark(
    (count: number) => generateRandomParticles(
      count,
      simulationState.canvas.internalWidth,
      simulationState.canvas.internalHeight,
      simulationState.settings.is3D
    ),
    simulationState.settings
  );

  return (
    <div className="min-h-screen bg-parchment text-ink">
      {/* Header */}
      <header className="bg-manuscript shadow-lg border-b-2 border-gold">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gold rounded border-2 border-manuscript">
              <Atom size={32} className="text-manuscript" />
            </div>
            <div>
              <h1 className="text-4xl font-cinzel font-semibold text-parchment">
                MATHEMATICAL PRINCIPLES OF NATURAL PHILOSOPHY
              </h1>
              <p className="text-parchment-dark mt-1 font-crimson italic">
                Interactive Gravity Simulation · Real-time Physics
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 animate-fadeIn">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* Simulation Canvas */}
          <div className="xl:col-span-2">
            <div className="gold-glow rounded-lg">
              <SimulationCanvas
                simulationState={simulationState}
                onCameraUpdate={updateCamera}
                onCanvasClick={addParticleAtPosition}
                isClickModeActive={isClickModeActive}
                showEllipsoid={showEllipsoid}
                showParticles={showParticles}
              />
            </div>
            
            {/* Canvas Info */}
            <div className="mt-4 text-center text-ink-fade">
              <p className="text-sm font-crimson">
                Real-time Simulation • {simulationState.canvas.width}×{simulationState.canvas.height} canvas
              </p>
              {simulationState.settings.is3D && (
                <p className="text-xs mt-1 font-crimson italic">
                  Drag mouse to rotate camera and scroll to zoom in 3D mode
                </p>
              )}
              {isClickModeActive && (
                <p className="text-xs mt-1 text-gold font-crimson">
                  Click anywhere on canvas to place particles with mass {clickModeMass.toFixed(1)}
                </p>
              )}
            </div>
          </div>

          {/* Control Panels */}
          <div className="xl:col-span-1">
            <div className="space-y-6">
              <ControlPanel
                settings={simulationState.settings}
                onSettingsChange={updateSettings}
                onReset={resetSimulation}
                particleCount={simulationState.particles.length}
                performance={simulationState.performance}
                onToggleEllipsoid={toggleEllipsoid}
                showEllipsoid={showEllipsoid}
                onToggleParticles={toggleParticles}
                showParticles={showParticles}
                onOpenBenchmark={() => setShowBenchmark(true)}
              />
              
              <DotCreationPanel
                onBatchSpawn={(count, mass) => addParticles(count, mass)}
                onToggleClickMode={(enabled, mass) => toggleClickMode(enabled, mass)}
                isClickModeActive={isClickModeActive}
                clickModeMass={clickModeMass}
              />
            </div>
          </div>
        </div>

        {/* Physics Information */}
        <div className="mt-12 bg-manuscript rounded-lg p-6 border-2 border-gold hover-lift">
          <h2 className="text-2xl font-cinzel font-semibold text-parchment mb-4">PHYSICS IMPLEMENTATION</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-sm">
            <div className="bg-parchment-dark p-4 rounded border border-gold/30 hover-lift">
              <h3 className="font-cinzel font-medium text-copper mb-2">Gravitational Force</h3>
              <p className="text-ink font-crimson">F = G × (m₁ × m₂) / r²</p>
              <p className="text-xs text-ink-fade mt-2 font-crimson italic">
                Newton's universal law of gravitation applied to all particles
              </p>
            </div>
            
            <div className="bg-parchment-dark p-4 rounded border border-gold/30 hover-lift">
              <h3 className="font-cinzel font-medium text-copper mb-2">Particle Collision</h3>
              <p className="text-ink font-crimson">Momentum conservation</p>
              <p className="text-xs text-ink-fade mt-2 font-crimson italic">
                When particles collide, they merge while preserving total momentum
              </p>
            </div>
            
            <div className="bg-parchment-dark p-4 rounded border border-gold/30 hover-lift">
              <h3 className="font-cinzel font-medium text-copper mb-2">Boundary Physics</h3>
              <p className="text-ink font-crimson">70% energy retention</p>
              <p className="text-xs text-ink-fade mt-2 font-crimson italic">
                Particles bounce off walls with realistic energy loss
              </p>
            </div>
            
            <div className="bg-parchment-dark p-4 rounded border border-gold/30 hover-lift">
              <h3 className="font-cinzel font-medium text-copper mb-2">3D Projection</h3>
              <p className="text-ink font-crimson">Perspective rendering</p>
              <p className="text-xs text-ink-fade mt-2 font-crimson italic">
                Real-time 3D to 2D projection with depth sorting
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-manuscript mt-16 border-t-2 border-gold">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center text-parchment-dark">
            <p className="text-sm font-crimson italic">
              Built with React, TypeScript, and HTML5 Canvas • Real-time physics simulation
            </p>
          </div>
        </div>
      </footer>

      {/* Benchmark Modal */}
      {showBenchmark && (
        <BenchmarkPanel
          onClose={() => setShowBenchmark(false)}
          onRunBenchmark={handleBenchmark}
          currentFps={simulationState.performance.fps}
          currentFrameTime={simulationState.performance.frameTime}
        />
      )}
    </div>
  );
}

export default App;