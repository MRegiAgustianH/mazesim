import React, { useState, useRef, useCallback, useEffect } from 'react';
import { QLearningAgent, DEFAULT_CONFIG, ACTIONS } from './QLearningAgent';
import type { TrainingStats } from './QLearningAgent';
import { convertTrackToGrid, GRID_SIZE, type Intersection } from './TrackGridConverter';
import { useStore } from '../store/useStore';
import { Play, Square, Download, RotateCcw, ChevronDown, ChevronUp, MapPin, Flag, Plus, Trash2, Check, Info, ScanLine, MousePointerClick, SlidersHorizontal } from 'lucide-react';

interface TrainingPanelProps {
  trackCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  robotRef: React.RefObject<any>;
  onGenerateIno: (code: string) => void;
}

export const TrainingPanel: React.FC<TrainingPanelProps> = ({ trackCanvasRef, robotRef, onGenerateIno }) => {
  const agentRef = useRef<QLearningAgent>(new QLearningAgent());
  const [isTraining, setIsTraining] = useState(false);
  const [isFastMode, setIsFastMode] = useState(true);
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
  const setBestActions = useStore(state => state.setBestActions);
  const setTrainingPower = useStore(state => state.setTrainingPower);
  const setTrainingSummary = useStore(state => state.setTrainingSummary);

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
    if (!startPoint) { setStatusMsg('Set the Start point first.'); return; }
    if (!finishPoint) { setStatusMsg('Set the Finish point first.'); return; }

    startPosRef.current = { x: robot.x, y: robot.y, angle: robot.angle };

    const agent = agentRef.current;
    agent.config = { ...config };
    agent.isTraining = true;
    setTrainingPower(config.power);
    robot.fastMode = isFastMode;

    const episodeActions: string[] = [];

    if (isFastMode) {
      // In fast mode, disable real-time callbacks to save React overhead
      agent.onWaypointCollected = undefined;
      agent.onActionExecuted = undefined;
    } else {
      // Setup waypoint collection callback for real-time visual feedback
      agent.onWaypointCollected = (idx: number) => {
        setCollectedWaypointIds(
          Array.from(new Set([...useStore.getState().collectedWaypointIds, idx]))
        );
      };

      // Setup action counter callback: real-time sequential list
      agent.onActionExecuted = (actionName: string) => {
        episodeActions.push(actionName);
        setActionCounts([...episodeActions]);
      };
    }

    setIsTraining(true);
    setStatusMsg(`Training started. Route: Start → ${waypoints.length} waypoint(s) → Finish`);

    robot._isSimulationRunning = true;
    robot.isTrainingMode = true;

    // Delay 500ms agar posisi robot awal terlihat di canvas (hanya jika lambat)
    if (!isFastMode) {
      await new Promise(r => setTimeout(r, 500));
    }

    const tempStats: TrainingStats[] = [];

    for (let ep = 0; ep < config.maxEpisodes; ep++) {
      if (!agent.isTraining) break;

      if (!isFastMode) {
        // Reset collected waypoints & action list at start of each episode
        setCollectedWaypointIds([]);
        episodeActions.length = 0;
        setActionCounts([]);
      }

      // Reset robot ke start point
      robot.x = startPoint.x;
      robot.y = startPoint.y;
      if (startPosRef.current) robot.angle = startPosRef.current.angle;
      robot.lSpeed = 0;
      robot.rSpeed = 0;
      robot.simTime = 0; // Reset simulated clock

      try {
        const stats = await agent.runEpisode(robot, ep + 1, waypoints, finishPoint);
        tempStats.push(stats);

        // Update UI occasionally in fast mode to keep the browser responsive
        if (isFastMode) {
          if (ep % 20 === 0 || ep === config.maxEpisodes - 1) {
            setAllStats([...tempStats]);
            const wpInfo = waypoints.length > 0 ? ` | WP: ${stats.waypointsCollected}/${waypoints.length + 1}` : '';
            setStatusMsg(
              `Training: Ep ${ep + 1}/${config.maxEpisodes} | Reward: ${stats.totalReward.toFixed(0)} | Steps: ${stats.steps}${wpInfo} | ε: ${stats.epsilon.toFixed(3)}${stats.finished ? ' | Finished' : ''}`
            );
            // Yield control to the browser to prevent freezing and show progress
            await new Promise(r => setTimeout(r, 0));
          }
        } else {
          setAllStats(prev => [...prev, stats]);
          const wpInfo = waypoints.length > 0 ? ` | WP: ${stats.waypointsCollected}/${waypoints.length + 1}` : '';
          setStatusMsg(
            `Ep ${ep + 1}/${config.maxEpisodes} | Reward: ${stats.totalReward.toFixed(0)} | Steps: ${stats.steps}${wpInfo} | ε: ${stats.epsilon.toFixed(3)}${stats.finished ? ' | Finished' : ''}`
          );
        }
      } catch (e) {
        console.log('Training episode error:', e);
      }

      if (!isFastMode) {
        await new Promise(r => setTimeout(r, 10));
      }
    }

    robot._isSimulationRunning = false;
    robot.isTrainingMode = false;
    robot.lSpeed = 0;
    robot.rSpeed = 0;
    robot.fastMode = false; // Reset to normal mode
    agent.isTraining = false;
    agent.onWaypointCollected = undefined;
    agent.onActionExecuted = undefined;
    setIsTraining(false);
    setCollectedWaypointIds([]); // Reset visual

    if (isFastMode) {
      setAllStats(tempStats);
    }

    setBestActions(agent.bestActions);
    const finishedCount = agent.stats.filter(s => s.finished).length;
    setStatusMsg(
      `Training complete! ${agent.stats.length} episodes, ${finishedCount} reached finish. Best reward: ${agent.bestReward.toFixed(0)}`
    );
    setTrainingSummary({
      episodes: agent.stats.length,
      finished: finishedCount,
      bestReward: agent.bestReward,
      qTableSize: Object.keys(agent.qTable).length,
    });
  }, [robotRef, config, startPoint, finishPoint, waypoints, setCollectedWaypointIds, isFastMode]);

  // Stop training
  const stopTraining = useCallback(() => {
    agentRef.current.isTraining = false;
    setIsTraining(false);
    if (robotRef.current) {
      robotRef.current._isSimulationRunning = false;
      robotRef.current.isTrainingMode = false;
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

  // Dengarkan event dari modal global untuk generate .ino
  useEffect(() => {
    const handler = () => generateIno();
    window.addEventListener('generate-ai-ino', handler);
    return () => window.removeEventListener('generate-ai-ino', handler);
  }, [generateIno]);

  // Reset
  const resetAgent = useCallback(() => {
    agentRef.current.reset();
    setBestActions([]);
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

  const hasPolicy = agentRef.current.bestActions.length > 0;
  const recentStats = allStats.slice(-50);
  const maxAbsReward = Math.max(...recentStats.map(x => Math.abs(x.totalReward)), 1);

  // Shared styles
  const sectionCls = 'px-4 py-4 border-b border-slate-200';
  const labelCls = 'text-[11px] font-semibold uppercase tracking-wide text-slate-500';
  const btnBase = 'inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed';
  const btnPrimary = `${btnBase} bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400`;
  const btnSecondary = `${btnBase} bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400 disabled:bg-slate-50`;
  const btnDanger = `${btnBase} bg-white text-red-600 border border-red-300 hover:bg-red-50`;
  const chipCls = 'px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-[10px] font-mono text-slate-700';

  const routeBtn = (active: boolean, done: boolean) =>
    `${btnBase} flex-1 border ${
      active
        ? 'border-blue-600 bg-blue-50 text-blue-700'
        : done
          ? 'border-slate-300 bg-white text-slate-800'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
    } disabled:opacity-50`;

  const stepTitle = (n: number, title: string, hint?: string) => (
    <div className="flex items-start gap-2.5 mb-3">
      <span className="flex-shrink-0 w-5 h-5 rounded-full border border-slate-300 text-[11px] font-semibold text-slate-600 flex items-center justify-center">
        {n}
      </span>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-slate-800">{title}</div>
        {hint && <div className="text-xs text-slate-500 mt-0.5">{hint}</div>}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-white text-slate-800 text-left">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Q-Learning Training</h2>
        <p className="text-xs text-slate-500 mt-0.5">Train the robot to follow the route: Start → Waypoints → Finish.</p>
      </div>

      {/* Step 1: Route Setup */}
      <div className={sectionCls}>
        {stepTitle(1, "Set route", "Pick a point type, then click on the track canvas.")}

        <div className="flex gap-2">
          <button
            onClick={() => setPlacementMode(placementMode === 'start' ? 'none' : 'start')}
            disabled={isTraining}
            className={routeBtn(placementMode === 'start', !!startPoint)}
          >
            <MapPin className="w-4 h-4 text-emerald-600" />
            <span>Start</span>
            {startPoint && <Check className="w-3.5 h-3.5 text-emerald-600" />}
          </button>
          <button
            onClick={() => setPlacementMode(placementMode === 'finish' ? 'none' : 'finish')}
            disabled={isTraining}
            className={routeBtn(placementMode === 'finish', !!finishPoint)}
          >
            <Flag className="w-4 h-4 text-red-600" />
            <span>Finish</span>
            {finishPoint && <Check className="w-3.5 h-3.5 text-emerald-600" />}
          </button>
        </div>

        <button
          onClick={() => setPlacementMode(placementMode === 'waypoint' ? 'none' : 'waypoint')}
          disabled={isTraining}
          className={`${routeBtn(placementMode === 'waypoint', false)} w-full mt-2 ${placementMode === 'waypoint' ? '' : 'border-dashed'}`}
        >
          <Plus className="w-4 h-4" />
          <span>Add waypoint</span>
          <span className="text-xs font-normal text-slate-400">(point to pass through)</span>
        </button>

        {placementMode !== 'none' && (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            <MousePointerClick className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Click on the canvas to place the <strong className="font-semibold">{placementMode}</strong> point.</span>
          </div>
        )}

        {waypoints.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-slate-500 mb-1.5">
              Route: Start → {waypoints.map((_, i) => `P${i + 1}`).join(' → ')} → Finish
            </div>
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
              {waypoints.map((wp, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-1.5">
                  <span className="text-xs text-slate-700">
                    <span className="font-medium">P{i + 1}</span>
                    <span className="ml-2 font-mono text-slate-400">({Math.round(wp.x)}, {Math.round(wp.y)})</span>
                  </span>
                  <button
                    onClick={() => removeWaypoint(i)}
                    disabled={isTraining}
                    title="Remove waypoint"
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Step 2: Analyze & Train */}
      <div className={sectionCls}>
        {stepTitle(2, "Analyze & train", "Analyzing the track is optional but shows grid info.")}

        <div className="flex gap-2">
          <button onClick={analyzeTrack} disabled={isTraining} className={`${btnSecondary} flex-1`}>
            <ScanLine className="w-4 h-4" />
            <span>Analyze track</span>
          </button>
          {!isTraining ? (
            <button
              onClick={startTraining}
              disabled={!startPoint || !finishPoint}
              className={`${btnPrimary} flex-1`}
              title={!startPoint || !finishPoint ? 'Set Start and Finish first' : 'Start training'}
            >
              <Play className="w-4 h-4" />
              <span>Start training</span>
            </button>
          ) : (
            <button onClick={stopTraining} className={`${btnDanger} flex-1`}>
              <Square className="w-4 h-4" />
              <span>Stop</span>
            </button>
          )}
          <button onClick={resetAgent} disabled={isTraining} className={btnSecondary} title="Reset agent">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <label className="mt-3 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isFastMode}
            onChange={(e) => setIsFastMode(e.target.checked)}
            disabled={isTraining}
            className="h-4 w-4 rounded border-slate-300 accent-blue-600"
          />
          <span className="text-xs text-slate-700">Fast training</span>
          <span className="text-xs text-slate-400">— runs in background without animation</span>
        </label>

        {gridReady && (
          <div className="mt-3 text-xs text-slate-500">
            Grid {GRID_SIZE}×{GRID_SIZE} · {intersections.length} intersections
          </div>
        )}
      </div>

      {/* Step 3: Export */}
      <div className={sectionCls}>
        {stepTitle(3, "Export", "Generate Arduino code from the best learned route.")}
        <button
          onClick={generateIno}
          disabled={isTraining || !hasPolicy}
          className={`${btnSecondary} w-full`}
        >
          <Download className="w-4 h-4" />
          <span>Generate .ino</span>
        </button>
      </div>

      {/* Status */}
      {statusMsg && (
        <div className="px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex items-start gap-2">
          {isTraining
            ? <span className="mt-1 w-2 h-2 rounded-full bg-blue-600 flex-shrink-0" />
            : <Info className="w-3.5 h-3.5 mt-0.5 text-slate-400 flex-shrink-0" />}
          <span className="text-xs text-slate-600 font-mono break-words">{statusMsg}</span>
        </div>
      )}

      {/* Results */}
      <div className={sectionCls}>
        <div className={`${labelCls} mb-2`}>Results</div>
        <dl className="grid grid-cols-3 rounded-md border border-slate-200 divide-x divide-slate-200">
          {[
            ['Episodes', allStats.length],
            ['Finished', finishedCount],
            ['Q-states', qTableSize],
          ].map(([label, value]) => (
            <div key={label} className="px-3 py-2">
              <dt className="text-[11px] text-slate-500">{label}</dt>
              <dd className="text-lg font-semibold text-slate-900 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
        <dl className="grid grid-cols-2 mt-2 rounded-md border border-slate-200 divide-x divide-slate-200">
          {[
            ['Best reward', bestRewardDisplay],
            ['Avg reward', avgReward],
          ].map(([label, value]) => (
            <div key={label} className="px-3 py-2">
              <dt className="text-[11px] text-slate-500">{label}</dt>
              <dd className="text-lg font-semibold text-slate-900 tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        {/* Reward History */}
        {allStats.length > 0 && (
          <div className="mt-4">
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">Reward history</span>
              <span className="text-[11px] text-slate-400">last {recentStats.length} episodes</span>
            </div>
            <div className="h-20 flex items-end gap-px border-b border-slate-200">
              {recentStats.map((s, i) => {
                const height = Math.max(2, Math.abs(s.totalReward) / maxAbsReward * 100);
                const isPositive = s.totalReward >= 0;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-[1px] ${s.finished ? 'bg-blue-600' : isPositive ? 'bg-slate-400' : 'bg-red-300'}`}
                    style={{ height: `${height}%` }}
                    title={`Ep ${s.episode}: ${s.totalReward.toFixed(0)}${s.finished ? ' (finished)' : ''} WP:${s.waypointsCollected}`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-[11px] text-slate-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-blue-600" />Finished</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-slate-400" />Positive</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-300" />Negative</span>
            </div>
          </div>
        )}
      </div>

      {/* Action log — actions used in the current episode (real-time sequential) */}
      {(isTraining || actionCounts.length > 0) && (
        <div className={sectionCls}>
          <div className="flex items-baseline justify-between mb-2">
            <span className={labelCls}>{isTraining ? 'Current episode' : 'Last episode'}</span>
            <span className="text-[11px] text-slate-400 tabular-nums">{actionCounts.length} steps</span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
            {actionCounts.map((name, i) => (
              <span key={i} className={chipCls}>{name}</span>
            ))}
            {actionCounts.length === 0 && isTraining && (
              <span className="text-xs text-slate-400">Waiting for actions…</span>
            )}
          </div>
        </div>
      )}

      {/* Best Actions Preview */}
      {hasPolicy && (
        <div className={sectionCls}>
          <div className="flex items-baseline justify-between mb-2">
            <span className={labelCls}>Best episode</span>
            <span className="text-[11px] text-slate-400 tabular-nums">{agentRef.current.bestActions.length} steps</span>
          </div>
          <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
            {agentRef.current.bestActions.slice(0, 30).map((a, i) => {
              const actionInfo = ACTIONS[a.actionId];
              return (
                <span key={i} className={chipCls} title={`State: ${a.state} → ${actionInfo.label}`}>
                  {actionInfo.name}
                </span>
              );
            })}
            {agentRef.current.bestActions.length > 30 && (
              <span className="text-xs text-slate-400 self-center">+{agentRef.current.bestActions.length - 30} more</span>
            )}
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      <div className="px-4 py-3">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between text-sm font-medium text-slate-700 hover:text-slate-900"
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            Advanced settings
          </span>
          {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>
        {showAdvanced && (
          <div className="mt-3 space-y-2">
            {([
              ['maxEpisodes', 'Max episodes', 1, 5000],
              ['maxStepsPerEpisode', 'Max steps / episode', 10, 1000],
              ['alpha', 'Learning rate (α)', 0.01, 1],
              ['gamma', 'Discount factor (γ)', 0, 1],
              ['epsilonDecay', 'Epsilon decay', 0.9, 1],
              ['power', 'Motor power', 50, 255],
            ] as [keyof typeof config, string, number, number][]).map(([key, label, min, max]) => (
              <label key={key} className="flex items-center justify-between text-xs">
                <span className="text-slate-600">{label}</span>
                <input
                  type="number"
                  value={config[key]}
                  min={min}
                  max={max}
                  step={key === 'alpha' || key === 'gamma' || key === 'epsilonDecay' ? 0.01 : 1}
                  onChange={(e) => setConfig(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                  disabled={isTraining}
                  className="w-24 h-8 px-2 rounded-md border border-slate-300 bg-white text-right text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400"
                />
              </label>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
