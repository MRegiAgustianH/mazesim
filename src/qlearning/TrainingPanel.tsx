import React, { useState, useRef, useCallback } from 'react';
import { QLearningAgent, DEFAULT_CONFIG, ACTIONS } from './QLearningAgent';
import type { TrainingStats } from './QLearningAgent';
import { convertTrackToGrid, GRID_SIZE, type Intersection } from './TrackGridConverter';
import { useStore } from '../store/useStore';
import { Brain, Play, Square, Download, RotateCcw, Zap, BarChart3, ChevronDown, ChevronUp, MapPin, Flag, CircleDot, Trash2 } from 'lucide-react';

interface TrainingPanelProps {
  trackCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  robotRef: React.RefObject<any>;
  onGenerateIno: (code: string) => void;
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({ trackCanvasRef, robotRef, onGenerateIno }) => {
  const agentRef = useRef<QLearningAgent>(new QLearningAgent());
  const [isTraining, setIsTraining] = useState(false);
  const [actionCounts, setActionCounts] = useState<string[]>([]);
  const [allStats, setAllStats] = useState<TrainingStats[]>([]);
  const [intersections, setIntersections] = useState<Intersection[]>([]);
  const [gridReady, setGridReady] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [statusMsg, setStatusMsg] = useState('');
  const startPosRef = useRef<{ x: number; y: number; angle: number } | null>(null);

  const startPoint = useStore(state => state.startPoint);
  const finishPoint = useStore(state => state.finishPoint);
  const waypoints = useStore(state => state.waypoints);
  const placementMode = useStore(state => state.placementMode);
  const setPlacementMode = useStore(state => state.setPlacementMode);
  const removeWaypoint = useStore(state => state.removeWaypoint);

  const setCollectedWaypointIds = useStore(state => state.setCollectedWaypointIds);

  // Analisis track
  const analyzeTrack = useCallback(() => {
    const trackCanvas = trackCanvasRef.current;
    if (!trackCanvas) { setStatusMsg('Error: Track canvas not found'); return; }
    const ctx = trackCanvas.getContext('2d');
    if (!ctx) { setStatusMsg('Error: Canvas context not found'); return; }

    const { grid, intersections } = convertTrackToGrid(ctx);
    setIntersections(intersections);
    setGridReady(true);
    setStatusMsg(`Track analyzed: ${GRID_SIZE}×${GRID_SIZE} grid, ${intersections.length} intersections found`);
    console.log('Grid Matrix:', grid);
    console.log('Intersections:', intersections);
  }, [trackCanvasRef]);

  // Start training: Start → Waypoints → Finish
  const startTraining = useCallback(async () => {
    const robot = robotRef.current;
    if (!robot) { setStatusMsg('Error: Robot not initialized'); return; }
    if (!startPoint) { setStatusMsg('⚠️ Set START point first!'); return; }
    if (!finishPoint) { setStatusMsg('⚠️ Set FINISH point first!'); return; }

    startPosRef.current = { x: robot.x, y: robot.y, angle: robot.angle };

    const agent = agentRef.current;
    agent.config = { ...config };
    agent.isTraining = true;

    // Setup waypoint collection callback for real-time visual feedback
    agent.onWaypointCollected = (idx: number) => {
      setCollectedWaypointIds(
        Array.from(new Set([...useStore.getState().collectedWaypointIds, idx]))
      );
    };

    // Setup action counter callback — real-time sequential list
    const episodeActions: string[] = [];
    agent.onActionExecuted = (actionName: string) => {
      episodeActions.push(actionName);
      setActionCounts([...episodeActions]);
    };

    setIsTraining(true);
    setStatusMsg(`Training started... Route: Start → ${waypoints.length} waypoints → Finish`);

    robot._isSimulationRunning = true;

    // Delay 500ms agar posisi robot awal terlihat di canvas
    await new Promise(r => setTimeout(r, 500));

    for (let ep = 0; ep < config.maxEpisodes; ep++) {
      if (!agent.isTraining) break;

      // Reset collected waypoints & action list at start of each episode
      setCollectedWaypointIds([]);
      episodeActions.length = 0;
      setActionCounts([]);

      // Reset robot ke start point
      robot.x = startPoint.x;
      robot.y = startPoint.y;
      if (startPosRef.current) robot.angle = startPosRef.current.angle;
      robot.lSpeed = 0;
      robot.rSpeed = 0;

      try {
        const stats = await agent.runEpisode(robot, ep + 1, waypoints, finishPoint);
        setAllStats(prev => [...prev, stats]);

        const wpInfo = waypoints.length > 0 ? ` | WP: ${stats.waypointsCollected}/${waypoints.length + 1}` : '';
        setStatusMsg(
          `Ep ${ep + 1}/${config.maxEpisodes} | Reward: ${stats.totalReward.toFixed(0)} | Steps: ${stats.steps}${wpInfo} | ε: ${stats.epsilon.toFixed(3)}${stats.finished ? ' ✅ FINISH!' : ''}`
        );
      } catch (e) {
        console.log('Training episode error:', e);
      }

      await new Promise(r => setTimeout(r, 10));
    }

    robot._isSimulationRunning = false;
    robot.lSpeed = 0;
    robot.rSpeed = 0;
    agent.isTraining = false;
    agent.onWaypointCollected = undefined;
    agent.onActionExecuted = undefined;
    setIsTraining(false);
    setCollectedWaypointIds([]); // Reset visual

    const finishedCount = agent.stats.filter(s => s.finished).length;
    setStatusMsg(
      `Training complete! ${agent.stats.length} episodes, ${finishedCount} reached finish. Best reward: ${agent.bestReward.toFixed(0)}`
    );
  }, [robotRef, config, startPoint, finishPoint, waypoints, setCollectedWaypointIds]);

  // Stop training
  const stopTraining = useCallback(() => {
    agentRef.current.isTraining = false;
    setIsTraining(false);
    if (robotRef.current) {
      robotRef.current._isSimulationRunning = false;
      robotRef.current.lSpeed = 0;
      robotRef.current.rSpeed = 0;
    }
    setStatusMsg('Training stopped.');
  }, [robotRef]);

  // Generate .ino
  const generateIno = useCallback(() => {
    const agent = agentRef.current;
    const code = agent.policyToArduinoCode('Current Track');
    onGenerateIno(code);
    setStatusMsg('Arduino .ino code generated! Click "Download .ino" to save.');
  }, [onGenerateIno]);

  // Reset
  const resetAgent = useCallback(() => {
    agentRef.current.reset();
    setAllStats([]);
    setActionCounts([]);
    setGridReady(false);
    setIntersections([]);
    setStatusMsg('Agent reset.');
  }, []);

  // Stats
  const avgReward = allStats.length > 0
    ? (allStats.reduce((a, s) => a + s.totalReward, 0) / allStats.length).toFixed(0)
    : '—';
  const bestRewardDisplay = agentRef.current.bestReward > -Infinity
    ? agentRef.current.bestReward.toFixed(0) : '—';
  const qTableSize = Object.keys(agentRef.current.qTable).length;
  const finishedCount = allStats.filter(s => s.finished).length;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center space-x-2 mb-1">
          <Brain className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
            Q-Learning AI Training
          </h2>
        </div>
        <p className="text-xs text-slate-400">Train AI: Start → Waypoints → Finish</p>
      </div>

      {/* Step 0: Route Setup */}
      <div className="px-4 py-3 space-y-2 border-b border-slate-700">
        <div className="text-xs text-slate-400 font-semibold mb-1">0. Set Route (Start → Points → Finish)</div>
        
        {/* Start & Finish */}
        <div className="flex space-x-2">
          <button
            onClick={() => setPlacementMode(placementMode === 'start' ? 'none' : 'start')}
            disabled={isTraining}
            className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              placementMode === 'start'
                ? 'bg-green-500 text-white ring-2 ring-green-300 animate-pulse'
                : startPoint
                  ? 'bg-green-800 text-green-200 border border-green-600'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>{startPoint ? '✓ Start' : 'Set Start'}</span>
          </button>
          <button
            onClick={() => setPlacementMode(placementMode === 'finish' ? 'none' : 'finish')}
            disabled={isTraining}
            className={`flex-1 flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              placementMode === 'finish'
                ? 'bg-red-500 text-white ring-2 ring-red-300 animate-pulse'
                : finishPoint
                  ? 'bg-red-800 text-red-200 border border-red-600'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
            }`}
          >
            <Flag className="w-3.5 h-3.5" />
            <span>{finishPoint ? '✓ Finish' : 'Set Finish'}</span>
          </button>
        </div>

        {/* Add Waypoint */}
        <button
          onClick={() => setPlacementMode(placementMode === 'waypoint' ? 'none' : 'waypoint')}
          disabled={isTraining}
          className={`w-full flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
            placementMode === 'waypoint'
              ? 'bg-amber-500 text-white ring-2 ring-amber-300 animate-pulse'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300 border border-dashed border-slate-500'
          }`}
        >
          <CircleDot className="w-3.5 h-3.5" />
          <span>+ Add Waypoint (titik yang harus dilalui)</span>
        </button>

        {/* Placement mode indicator */}
        {placementMode !== 'none' && (
          <div className={`text-xs text-center py-1.5 rounded font-medium ${
            placementMode === 'start' ? 'bg-green-900/80 text-green-300' :
            placementMode === 'finish' ? 'bg-red-900/80 text-red-300' :
            'bg-amber-900/80 text-amber-300'
          }`}>
            👆 Click on the canvas to place {placementMode.toUpperCase()} point
          </div>
        )}

        {/* Waypoints list */}
        {waypoints.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs text-slate-400">Route: Start → {waypoints.map((_, i) => `P${i + 1}`).join(' → ')} → Finish</div>
            {waypoints.map((wp, i) => (
              <div key={i} className="flex items-center justify-between bg-slate-800 rounded px-2 py-1 border border-slate-700">
                <span className="text-xs text-amber-300 font-mono">
                  P{i + 1}: ({Math.round(wp.x)}, {Math.round(wp.y)})
                </span>
                <button
                  onClick={() => removeWaypoint(i)}
                  disabled={isTraining}
                  className="text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="px-4 py-3 space-y-2 border-b border-slate-700">
        <div className="flex space-x-2">
          <button
            onClick={analyzeTrack}
            disabled={isTraining}
            className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-900 disabled:text-indigo-400 rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-900/30"
          >
            <Zap className="w-4 h-4" />
            <span>1. Analyze Track</span>
          </button>
        </div>

        <div className="flex space-x-2">
          {!isTraining ? (
            <button
              onClick={startTraining}
              disabled={!startPoint || !finishPoint}
              className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-900/30"
            >
              <Play className="w-4 h-4" />
              <span>2. Train AI</span>
            </button>
          ) : (
            <button
              onClick={stopTraining}
              className="flex-1 flex items-center justify-center space-x-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 rounded-lg text-sm font-medium transition-all shadow-lg shadow-rose-900/30 animate-pulse"
            >
              <Square className="w-4 h-4" />
              <span>Stop Training</span>
            </button>
          )}
          <button
            onClick={resetAgent}
            disabled={isTraining}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 rounded-lg text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={generateIno}
          disabled={isTraining || agentRef.current.bestActions.length === 0}
          className="w-full flex items-center justify-center space-x-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:text-slate-400 rounded-lg text-sm font-medium transition-all shadow-lg shadow-cyan-900/30"
        >
          <Download className="w-4 h-4" />
          <span>3. Generate .ino from AI</span>
        </button>
      </div>

      {/* Status */}
      {statusMsg && (
        <div className="px-4 py-2 text-xs bg-slate-800 border-b border-slate-700">
          <span className="text-cyan-400 font-mono">{statusMsg}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="px-4 py-3 grid grid-cols-2 gap-2 border-b border-slate-700">
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Episodes</div>
          <div className="text-xl font-bold text-white">{allStats.length}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Best Reward</div>
          <div className="text-xl font-bold text-emerald-400">{bestRewardDisplay}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Avg Reward</div>
          <div className="text-xl font-bold text-cyan-400">{avgReward}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700">
          <div className="text-xs text-slate-400 mb-1">Finished</div>
          <div className="text-xl font-bold text-purple-400">{finishedCount}</div>
        </div>
        <div className="bg-slate-800 rounded-lg p-3 border border-slate-700 col-span-2">
          <div className="text-xs text-slate-400 mb-1">Q-Table States</div>
          <div className="text-xl font-bold text-amber-400">{qTableSize}</div>
        </div>
      </div>

      {/* Action Counter — fungsi yang dipakai di episode saat ini (real-time sequential) */}
      {(isTraining || actionCounts.length > 0) && (
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-xs text-slate-400 mb-2">
            Actions {isTraining ? <span className="text-emerald-400">(Live — {actionCounts.length} steps)</span> : `(Last Episode — ${actionCounts.length} steps)`}
          </div>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {actionCounts.map((name, i) => {
              const colors: Record<string, string> = {
                tright: 'bg-amber-600', tleft: 'bg-amber-600',
                rl: 'bg-purple-600', ll: 'bg-purple-600', prl: 'bg-violet-600', pll: 'bg-violet-600',
                rls: 'bg-fuchsia-600', lls: 'bg-fuchsia-600',
                sac: 'bg-rose-600', trigger: 'bg-cyan-600', ld: 'bg-teal-600', motor_fwd: 'bg-green-600',
              };
              return (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono text-white ${colors[name] || 'bg-slate-600'}`}
                >
                  {name}
                </span>
              );
            })}
            {actionCounts.length === 0 && isTraining && (
              <span className="text-xs text-slate-600 italic">Waiting for actions...</span>
            )}
          </div>
        </div>
      )}

      {/* Track Analysis */}
      {gridReady && (
        <div className="px-4 py-2 border-b border-slate-700">
          <div className="flex items-center space-x-1 text-xs text-slate-400 mb-1">
            <BarChart3 className="w-3 h-3" />
            <span>Track Analysis</span>
          </div>
          <div className="text-xs text-slate-300">
            Grid: {GRID_SIZE}×{GRID_SIZE} | Intersections: {intersections.length}
          </div>
        </div>
      )}

      {/* Reward History */}
      {allStats.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-xs text-slate-400 mb-2">Reward History (last 50 episodes)</div>
          <div className="h-20 flex items-end space-x-px">
            {allStats.slice(-50).map((s, i) => {
              const maxR = Math.max(...allStats.slice(-50).map(x => Math.abs(x.totalReward)), 1);
              const height = Math.max(2, Math.abs(s.totalReward) / maxR * 100);
              const isPositive = s.totalReward >= 0;
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-t-sm ${s.finished ? 'bg-yellow-400' : isPositive ? 'bg-emerald-500' : 'bg-rose-500'}`}
                  style={{ height: `${height}%`, opacity: 0.6 + (i / 50) * 0.4 }}
                  title={`Ep ${s.episode}: ${s.totalReward.toFixed(0)}${s.finished ? ' ✅' : ''} WP:${s.waypointsCollected}`}
                />
              );
            })}
          </div>
          <div className="flex items-center space-x-3 mt-1 text-[10px] text-slate-500">
            <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"></span><span>Positive</span></span>
            <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-sm bg-rose-500 inline-block"></span><span>Negative</span></span>
            <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-sm bg-yellow-400 inline-block"></span><span>Finished!</span></span>
          </div>
        </div>
      )}

      {/* Best Actions Preview */}
      {agentRef.current.bestActions.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-700">
          <div className="text-xs text-slate-400 mb-2">
            Best Episode Actions ({agentRef.current.bestActions.length} steps)
          </div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {agentRef.current.bestActions.slice(0, 30).map((a, i) => {
              const actionInfo = ACTIONS[a.actionId];
              const colors: Record<string, string> = {
                tright: 'bg-amber-600', tleft: 'bg-amber-600',
                rl: 'bg-purple-600', ll: 'bg-purple-600', prl: 'bg-violet-600', pll: 'bg-violet-600',
                rls: 'bg-fuchsia-600', lls: 'bg-fuchsia-600',
                sac: 'bg-rose-600', trigger: 'bg-cyan-600', ld: 'bg-teal-600', motor_fwd: 'bg-green-600',
              };
              return (
                <span
                  key={i}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${colors[actionInfo.name] || 'bg-slate-600'}`}
                  title={`State: ${a.state} → ${actionInfo.label}`}
                >
                  {actionInfo.name}
                </span>
              );
            })}
            {agentRef.current.bestActions.length > 30 && (
              <span className="text-xs text-slate-500">+{agentRef.current.bestActions.length - 30} more</span>
            )}
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      <div className="px-4 py-2">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center space-x-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          {showAdvanced ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span>Advanced Settings</span>
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-2">
            {([
              ['maxEpisodes', 'Max Episodes', 1, 5000],
              ['maxStepsPerEpisode', 'Max Steps/Episode', 10, 1000],
              ['alpha', 'Learning Rate (α)', 0.01, 1],
              ['gamma', 'Discount Factor (γ)', 0, 1],
              ['epsilonDecay', 'Epsilon Decay', 0.9, 1],
              ['power', 'Motor Power', 50, 255],
            ] as [keyof typeof config, string, number, number][]).map(([key, label, min, max]) => (
              <label key={key} className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{label}</span>
                <input
                  type="number"
                  value={config[key]}
                  min={min}
                  max={max}
                  step={key === 'alpha' || key === 'gamma' || key === 'epsilonDecay' ? 0.01 : 1}
                  onChange={(e) => setConfig(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  disabled={isTraining}
                  className="w-20 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-white text-right disabled:opacity-40"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
