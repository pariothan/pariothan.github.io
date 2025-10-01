import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Settings, ChevronDown, ChevronUp, Shapes, Eye, EyeOff } from 'lucide-react';
import { SimulationSettings } from '../types/simulation';

interface ControlPanelProps {
  settings: SimulationSettings;
  onSettingsChange: (settings: Partial<SimulationSettings>) => void;
  onReset: () => void;
  particleCount: number;
  performance: { fps: number; frameTime: number };
  onToggleEllipsoid: () => void;
  showEllipsoid: boolean;
  onToggleParticles: () => void;
  showParticles: boolean;
}

export function ControlPanel({
  settings,
  onSettingsChange,
  onReset,
  particleCount,
  performance,
  onToggleEllipsoid,
  showEllipsoid,
  onToggleParticles,
  showParticles
}: ControlPanelProps) {
  const [showPhysicsPanel, setShowPhysicsPanel] = useState(false);

  const handleSliderChange = (key: keyof SimulationSettings) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onSettingsChange({ [key]: parseFloat(e.target.value) });
  };

  const togglePlayPause = () => {
    onSettingsChange({ isPaused: !settings.isPaused });
  };

  const toggle3D = () => {
    onSettingsChange({ is3D: !settings.is3D });
    // Reset simulation when switching modes to regenerate particles
    setTimeout(() => onReset(), 0);
  };

  return (
    <div className="bg-manuscript p-6 rounded-lg shadow-xl space-y-6 border-2 border-gold">
      {/* Main Controls */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={togglePlayPause}
          className="flex items-center gap-2 px-4 py-2 bg-gold hover:bg-copper text-manuscript rounded border border-manuscript transition-colors"
        >
          {settings.isPaused ? <Play size={18} /> : <Pause size={18} />}
          {settings.isPaused ? 'START' : 'PAUSE'}
        </button>
        
        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 bg-copper hover:bg-gold text-parchment rounded border border-manuscript transition-colors"
        >
          <RotateCcw size={18} />
          RESET
        </button>
        
        <button
          onClick={toggle3D}
          className={`px-4 py-2 rounded border border-manuscript transition-colors ${
            settings.is3D 
              ? 'bg-manuscript hover:bg-manuscript-dark text-parchment' 
              : 'bg-parchment-dark hover:bg-parchment text-manuscript'
          }`}
        >
          {settings.is3D ? '3D MODE' : '2D MODE'}
        </button>
        
        {settings.is3D && (
          <button
            onClick={onToggleEllipsoid}
            className={`flex items-center gap-2 px-4 py-2 rounded border border-manuscript transition-colors ${
              showEllipsoid
                ? 'bg-gold hover:bg-copper text-manuscript'
                : 'bg-parchment-dark hover:bg-parchment text-manuscript'
            }`}
          >
            <Shapes size={18} />
            {showEllipsoid ? 'HIDE ELLIPSOID' : 'SHOW ELLIPSOID'}
          </button>
        )}
        
        <button
          onClick={onToggleParticles}
          className={`flex items-center gap-2 px-4 py-2 rounded border border-manuscript transition-colors ${
            showParticles
              ? 'bg-gold hover:bg-copper text-manuscript'
              : 'bg-parchment-dark hover:bg-parchment text-manuscript'
          }`}
        >
          {showParticles ? <Eye size={18} /> : <EyeOff size={18} />}
          {showParticles ? 'HIDE DOTS' : 'SHOW DOTS'}
        </button>
        
      </div>

      {/* Performance Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm text-ink">
        <div className="bg-parchment-dark p-3 rounded border border-gold/30">
          <div className="text-ink-fade font-cinzel">PARTICLES</div>
          <div className="text-xl font-crimson text-ink">{particleCount}</div>
        </div>
        <div className="bg-parchment-dark p-3 rounded border border-gold/30">
          <div className="text-ink-fade font-cinzel">FPS</div>
          <div className="text-xl font-crimson text-ink">{performance.fps}</div>
        </div>
      </div>

      {/* Quick Controls */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-cinzel font-medium text-parchment mb-2">
            GRAVITY: {settings.gravity.toFixed(1)}g
          </label>
          <div className="flex gap-2 items-center">
            <input
              type="range"
              min="0"
              max="500"
              step="0.1"
              value={settings.gravity}
              onChange={handleSliderChange('gravity')}
              className="flex-1 h-2 bg-parchment-dark rounded appearance-none cursor-pointer slider"
            />
            <input
              type="number"
              step="0.1"
              value={settings.gravity}
              onChange={handleSliderChange('gravity')}
              className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-cinzel font-medium text-parchment">
              TRAILS
            </label>
            <button
              onClick={() => onSettingsChange({ trailOpacity: settings.trailOpacity > 0 ? 0 : 0.15 })}
              className={`px-3 py-1 rounded border border-manuscript transition-colors text-sm ${
                settings.trailOpacity > 0
                  ? 'bg-gold hover:bg-copper text-manuscript'
                  : 'bg-parchment-dark hover:bg-parchment text-manuscript'
              }`}
            >
              {settings.trailOpacity > 0 ? 'ON' : 'OFF'}
            </button>
          </div>
          {settings.trailOpacity > 0 && (
            <div className="space-y-3 pl-4 border-l-2 border-gold/30">
              <div>
                <label className="block text-xs font-cinzel text-parchment/80 mb-1">
                  OPACITY: {Math.round(settings.trailOpacity * 100)}%
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="0.05"
                    max="1"
                    step="0.05"
                    value={settings.trailOpacity}
                    onChange={handleSliderChange('trailOpacity')}
                    className="flex-1 h-2 bg-parchment-dark rounded appearance-none cursor-pointer slider"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-cinzel text-parchment/80 mb-1">
                  TOP PARTICLES: {settings.trailCount}
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={settings.trailCount}
                    onChange={handleSliderChange('trailCount')}
                    className="flex-1 h-2 bg-parchment-dark rounded appearance-none cursor-pointer slider"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Physics Panel */}
      <div className="border-t border-gray-700 pt-4">
        <button
          onClick={() => setShowPhysicsPanel(!showPhysicsPanel)}
          className="flex items-center justify-between w-full text-left text-parchment hover:text-parchment-dark transition-colors"
        >
          <span className="flex items-center gap-2 font-cinzel">
            <Settings size={18} />
            ADVANCED PHYSICS
          </span>
          {showPhysicsPanel ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showPhysicsPanel && (
          <div className="mt-4 space-y-4 bg-parchment-dark p-4 rounded border border-gold/30">
            <div>
              <label className="block text-sm font-cinzel font-medium text-ink mb-2">
                COLLISION DISTANCE: {settings.collisionDistance.toFixed(1)}px
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="0.1"
                  max="200"
                  step="0.1"
                  value={settings.collisionDistance}
                  onChange={handleSliderChange('collisionDistance')}
                  className="flex-1 h-2 bg-parchment rounded appearance-none cursor-pointer slider"
                />
                <input
                  type="number"
                  step="0.1"
                  value={settings.collisionDistance}
                  onChange={handleSliderChange('collisionDistance')}
                  className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-cinzel font-medium text-ink mb-2">
                MIN MASS: {settings.minMass.toFixed(1)}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="0.1"
                  max="200"
                  step="0.1"
                  value={settings.minMass}
                  onChange={handleSliderChange('minMass')}
                  className="flex-1 h-2 bg-parchment rounded appearance-none cursor-pointer slider"
                />
                <input
                  type="number"
                  step="0.1"
                  value={settings.minMass}
                  onChange={handleSliderChange('minMass')}
                  className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-cinzel font-medium text-ink mb-2">
                MAX MASS: {settings.maxMass.toFixed(1)}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="0.1"
                  max="200"
                  step="0.1"
                  value={settings.maxMass}
                  onChange={handleSliderChange('maxMass')}
                  className="flex-1 h-2 bg-parchment rounded appearance-none cursor-pointer slider"
                />
                <input
                  type="number"
                  step="0.1"
                  value={settings.maxMass}
                  onChange={handleSliderChange('maxMass')}
                  className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-cinzel font-medium text-ink mb-2">
                ENERGY LOSS: {Math.round(settings.energyLoss * 100)}%
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.energyLoss}
                  onChange={handleSliderChange('energyLoss')}
                  className="flex-1 h-2 bg-parchment rounded appearance-none cursor-pointer slider"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={settings.energyLoss}
                  onChange={handleSliderChange('energyLoss')}
                  className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-cinzel font-medium text-ink mb-2">
                TRAIL LENGTH: {Math.round(settings.trailLength)}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={settings.trailLength}
                  onChange={handleSliderChange('trailLength')}
                  className="flex-1 h-2 bg-parchment rounded appearance-none cursor-pointer slider"
                />
                <input
                  type="number"
                  step="1"
                  value={settings.trailLength}
                  onChange={handleSliderChange('trailLength')}
                  className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-cinzel font-medium text-ink mb-2">
                PARTICLE COUNT: {Math.round(settings.particleCount)}
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="range"
                  min="1"
                  max="500"
                  step="1"
                  value={settings.particleCount}
                  onChange={handleSliderChange('particleCount')}
                  className="flex-1 h-2 bg-parchment rounded appearance-none cursor-pointer slider"
                />
                <input
                  type="number"
                  step="1"
                  value={settings.particleCount}
                  onChange={handleSliderChange('particleCount')}
                  className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
                />
              </div>
            </div>

            {/* Force Distance Settings */}
            <div className="border-t border-gray-600 pt-4 mt-4">
              <h4 className="font-cinzel font-medium text-ink mb-3">FORCE SETTINGS</h4>
              
              <div>
                <label className="block text-sm font-cinzel font-medium text-ink mb-2">
                  MIN FORCE DISTANCE: {settings.minForceDistance.toFixed(1)}px
                  <span className="text-xs text-ink-fade ml-2">
                    (Prevents extreme forces at close range)
                  </span>
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="0.5"
                    value={settings.minForceDistance}
                    onChange={handleSliderChange('minForceDistance')}
                    className="flex-1 h-2 bg-parchment rounded appearance-none cursor-pointer slider"
                  />
                  <input
                    type="number"
                    step="0.5"
                    min="1"
                    max="50"
                    value={settings.minForceDistance}
                    onChange={handleSliderChange('minForceDistance')}
                    className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
                  />
                </div>
              </div>
            </div>

            {/* Ellipsoid Settings */}
            <div className="border-t border-gray-600 pt-4 mt-4">
              <h4 className="font-cinzel font-medium text-ink mb-3">ELLIPSOID SETTINGS</h4>
              
              <div>
                <label className="block text-sm font-cinzel font-medium text-ink mb-2">
                  UPDATE INTERVAL: {settings.ellipsoidUpdateInterval.toFixed(2)}s
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="0.01"
                    max="10"
                    step="0.01"
                    value={settings.ellipsoidUpdateInterval}
                    onChange={handleSliderChange('ellipsoidUpdateInterval')}
                    className="flex-1 h-2 bg-parchment rounded appearance-none cursor-pointer slider"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="10"
                    value={settings.ellipsoidUpdateInterval}
                    onChange={handleSliderChange('ellipsoidUpdateInterval')}
                    className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-cinzel font-medium text-ink mb-2">
                  MASS CAPTURE: {Math.round(settings.ellipsoidMassCapture)}%
                </label>
                <div className="flex gap-2 items-center">
                  <input
                    type="range"
                    min="50"
                    max="100"
                    step="1"
                    value={settings.ellipsoidMassCapture}
                    onChange={handleSliderChange('ellipsoidMassCapture')}
                    className="flex-1 h-2 bg-parchment rounded appearance-none cursor-pointer slider"
                  />
                  <input
                    type="number"
                    step="1"
                    min="50"
                    max="100"
                    value={settings.ellipsoidMassCapture}
                    onChange={handleSliderChange('ellipsoidMassCapture')}
                    className="w-20 px-2 py-1 bg-parchment text-ink rounded border border-gold text-sm font-crimson"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}