
import { useSimulation } from './hooks/useSimulation';
import { SimulationCanvas } from './components/SimulationCanvas';
import { ControlPanel } from './components/ControlPanel';
import { DotCreationPanel } from './components/DotCreationPanel';
import { Atom } from 'lucide-react';

function App() {
  console.log('App rendering');
  
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
    showParticles
  } = useSimulation();

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
                PHILOSOPHIÆ NATURALIS PRINCIPIA MATHEMATICA
              </h1>
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

      </main>
    </div>
  );
}

export default App;