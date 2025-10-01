import { useState } from 'react';
import { X, Play, RotateCcw } from 'lucide-react';

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

interface BenchmarkPanelProps {
  onClose: () => void;
  onRunBenchmark: (algorithm: string, particleCount: number, duration: number, highQuality?: boolean) => Promise<BenchmarkResult>;
  currentFps: number;
  currentFrameTime: number;
}

export function BenchmarkPanel({ onClose, onRunBenchmark, currentFps, currentFrameTime }: BenchmarkPanelProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [testParticleCounts] = useState([100, 250, 500, 1000]);
  const [testDuration, setTestDuration] = useState(5); // seconds

  const runBenchmarks = async () => {
    setIsRunning(true);
    setResults([]);
    const newResults: BenchmarkResult[] = [];

    // Test with varying particle counts
    for (const count of testParticleCounts) {
      try {
        const result = await onRunBenchmark('brute-force', count, testDuration);
        newResults.push(result);
        setResults([...newResults]);
      } catch (error) {
        console.error(`Benchmark failed for ${count} particles:`, error);
      }
    }

    setIsRunning(false);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-semibold text-foreground">Performance Benchmark</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-accent rounded"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Current Performance */}
          <div className="bg-accent/50 rounded-lg p-4">
            <h3 className="font-semibold mb-2 text-foreground">Current Performance</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">FPS:</span>
                <span className="ml-2 font-mono text-foreground">{currentFps}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Frame Time:</span>
                <span className="ml-2 font-mono text-foreground">{currentFrameTime}ms</span>
              </div>
            </div>
          </div>

          {/* Test Configuration */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Benchmark Configuration</h3>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Test Duration: {testDuration}s per test
              </label>
              <input
                type="range"
                min="3"
                max="10"
                value={testDuration}
                onChange={(e) => setTestDuration(Number(e.target.value))}
                className="w-full"
                disabled={isRunning}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-foreground">
                Particle Counts: {testParticleCounts.join(', ')}
              </label>
            </div>

            <div className="flex gap-2">
              <button
                onClick={runBenchmarks}
                disabled={isRunning}
                className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                {isRunning ? 'Running...' : 'Run Benchmark'}
              </button>
              <button
                onClick={clearResults}
                disabled={isRunning || results.length === 0}
                className="px-4 py-2 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Results - Brute Force</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-foreground">Particles</th>
                      <th className="text-right p-2 text-foreground">Avg FPS</th>
                      <th className="text-right p-2 text-foreground">Min FPS</th>
                      <th className="text-right p-2 text-foreground">Max FPS</th>
                      <th className="text-right p-2 text-foreground">Avg Frame Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, idx) => (
                      <tr key={idx} className="border-b border-border/50">
                        <td className="p-2 font-mono text-foreground">{result.particleCount}</td>
                        <td className="text-right p-2 font-mono text-foreground">{result.avgFps.toFixed(1)}</td>
                        <td className="text-right p-2 font-mono text-muted-foreground">{result.minFps.toFixed(1)}</td>
                        <td className="text-right p-2 font-mono text-muted-foreground">{result.maxFps.toFixed(1)}</td>
                        <td className="text-right p-2 font-mono text-foreground">{result.avgFrameTime.toFixed(2)}ms</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Performance Summary */}
              <div className="bg-accent/50 rounded-lg p-4 space-y-2">
                <h4 className="font-semibold text-sm text-foreground">Summary</h4>
                <div className="text-sm space-y-1">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Best Performance:</span>{' '}
                    {Math.max(...results.map(r => r.avgFps)).toFixed(1)} FPS at{' '}
                    {results.find(r => r.avgFps === Math.max(...results.map(r => r.avgFps)))?.particleCount} particles
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-foreground">Worst Performance:</span>{' '}
                    {Math.min(...results.map(r => r.avgFps)).toFixed(1)} FPS at{' '}
                    {results.find(r => r.avgFps === Math.min(...results.map(r => r.avgFps)))?.particleCount} particles
                  </p>
                </div>
              </div>
            </div>
          )}

          {isRunning && (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-4 text-muted-foreground">
                Running benchmark... {results.length}/{testParticleCounts.length} tests completed
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
