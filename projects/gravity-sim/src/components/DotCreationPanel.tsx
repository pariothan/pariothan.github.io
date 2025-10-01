import { useState } from 'react';
import { Plus, MousePointer, Zap, Target } from 'lucide-react';

interface DotCreationPanelProps {
  onBatchSpawn: (count: number, mass: number) => void;
  onToggleClickMode: (enabled: boolean, mass: number) => void;
  isClickModeActive: boolean;
  clickModeMass: number;
}

export function DotCreationPanel({ 
  onBatchSpawn, 
  onToggleClickMode, 
  isClickModeActive,
  clickModeMass 
}: DotCreationPanelProps) {
  const [batchCount, setBatchCount] = useState(10);
  const [batchMass, setBatchMass] = useState(5);
  const [clickMass, setClickMass] = useState(10);

  const handleBatchSpawn = () => {
    onBatchSpawn(batchCount, batchMass);
  };

  const handleToggleClickMode = () => {
    const newClickMass = isClickModeActive ? clickModeMass : clickMass;
    setClickMass(newClickMass);
    onToggleClickMode(!isClickModeActive, newClickMass);
  };

  const handleClickMassChange = (newMass: number) => {
    setClickMass(newMass);
    if (isClickModeActive) {
      onToggleClickMode(true, newMass);
    }
  };

  return (
    <div className="bg-manuscript p-6 rounded-lg shadow-xl space-y-6 border-2 border-gold">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 bg-gold rounded border border-manuscript">
          <Plus size={20} className="text-manuscript" />
        </div>
        <h3 className="text-xl font-cinzel font-semibold text-parchment">CREATE PARTICLES</h3>
      </div>

      {/* Batch Spawn Section */}
      <div className="space-y-4 bg-parchment-dark p-4 rounded border border-gold/30">
        <div className="flex items-center gap-2 text-copper">
          <Zap size={18} />
          <h4 className="font-cinzel font-semibold">BATCH CREATION</h4>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-cinzel font-medium text-ink mb-2">
              COUNT: {batchCount}
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={batchCount}
              onChange={(e) => setBatchCount(parseInt(e.target.value))}
              className="w-full h-2 bg-parchment rounded appearance-none cursor-pointer slider"
            />
          </div>
          
          <div>
            <label className="block text-sm font-cinzel font-medium text-ink mb-2">
              MASS: {batchMass.toFixed(1)}
            </label>
            <input
              type="range"
              min="0.1"
              max="50"
              step="0.1"
              value={batchMass}
              onChange={(e) => setBatchMass(parseFloat(e.target.value))}
              className="w-full h-2 bg-parchment rounded appearance-none cursor-pointer slider"
            />
          </div>
        </div>

        <button
          onClick={handleBatchSpawn}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-copper hover:bg-gold text-parchment rounded border border-manuscript transition-colors font-medium"
        >
          <Plus size={18} />
          CREATE {batchCount} PARTICLES
        </button>
      </div>

      {/* Click to Place Section */}
      <div className="space-y-4 bg-parchment-dark p-4 rounded border border-gold/30">
        <div className="flex items-center gap-2 text-copper">
          <Target size={18} />
          <h4 className="font-cinzel font-semibold">CLICK TO PLACE</h4>
        </div>
        
        <div>
          <label className="block text-sm font-cinzel font-medium text-ink mb-2">
            CLICK MASS: {clickMass.toFixed(1)}
          </label>
          <input
            type="range"
            min="0.1"
            max="100"
            step="0.1"
            value={clickMass}
            onChange={(e) => handleClickMassChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-parchment rounded appearance-none cursor-pointer slider"
          />
        </div>

        <button
          onClick={handleToggleClickMode}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded border border-manuscript transition-colors font-medium ${
            isClickModeActive
              ? 'bg-gold hover:bg-copper text-manuscript'
              : 'bg-parchment hover:bg-parchment-dark text-manuscript'
          }`}
        >
          <MousePointer size={18} />
          {isClickModeActive ? 'CLICK MODE: ACTIVE' : 'CLICK MODE: INACTIVE'}
        </button>

        {isClickModeActive && (
          <div className="bg-gold/20 p-3 rounded border border-gold">
            <p className="text-copper text-sm font-crimson">
              <MousePointer size={14} className="inline mr-1" />
              Click anywhere on canvas to place particle with mass {clickMass.toFixed(1)}
            </p>
          </div>
        )}
      </div>

      {/* Quick Presets */}
      <div className="space-y-3">
        <h4 className="font-cinzel font-semibold text-parchment text-sm">QUICK PRESETS</h4>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onBatchSpawn(50, 1)}
            className="px-3 py-2 bg-manuscript hover:bg-manuscript-dark text-parchment rounded text-sm transition-colors border border-gold/30"
          >
            50 Light
          </button>
          <button
            onClick={() => onBatchSpawn(20, 15)}
            className="px-3 py-2 bg-copper hover:bg-gold text-parchment rounded text-sm transition-colors border border-manuscript"
          >
            20 Heavy
          </button>
          <button
            onClick={() => onBatchSpawn(5, 50)}
            className="px-3 py-2 bg-gold hover:bg-copper text-manuscript rounded text-sm transition-colors border border-manuscript"
          >
            5 Massive
          </button>
          <button
            onClick={() => onBatchSpawn(100, 0.5)}
            className="px-3 py-2 bg-parchment-dark hover:bg-parchment text-ink rounded text-sm transition-colors border border-gold/30"
          >
            100 Tiny
          </button>
        </div>
      </div>
    </div>
  );
}