import React from 'react';
import { Download, Play, Square, RotateCcw, Save, Brain, Blocks, CheckCircle, X, ZoomIn, ZoomOut, Maximize, GraduationCap, BookOpen, Gamepad2, Code2 } from 'lucide-react';
import logo from './assets/logo.svg';
import { BlocklyWorkspace } from './blockly/BlocklyWorkspace';
import { CanvasRenderer, type CanvasRendererHandle } from './simulator/CanvasRenderer';
import { TrainingPanel } from './qlearning/TrainingPanel';
import { useStore, type EditorMode } from './store/useStore';
import { LIB_VERSIONS, type LibVersion } from './blockly/inoTemplate';
import { SensorStrip } from './simulator/SensorStrip';
import { useT, type TKey } from './i18n/i18n';
import type { TrackId } from './store/useStore';

// Load heavy or rarely used parts on demand
const Robot3DView = React.lazy(() => import('./simulator/Robot3DView'));
const LearnPanel = React.lazy(() => import('./learn/LearnPanel'));
const LibraryPanel = React.lazy(() => import('./learn/LibraryPanel'));
const RobotPanel = React.lazy(() => import('./oled/RobotPanel'));
const CodeEditor = React.lazy(() => import('./code/CodeEditor'));

const TRACKS: TrackId[] = ['loop', 'scurve', 'maze', 'croc_junior', 'croc_senior', 'custom', 'upload'];

function App() {
  const arduinoCode = useStore((state) => state.arduinoCode);
  const sketchCode = useStore((state) => state.sketchCode);
  const setArduinoCode = useStore((state) => state.setArduinoCode);
  const simulationState = useStore((state) => state.simulationState);
  const setSimulationState = useStore((state) => state.setSimulationState);
  const activeTrack = useStore((state) => state.activeTrack);
  const setActiveTrack = useStore((state) => state.setActiveTrack);
  const activeTrackWidthCm = useStore((state) => state.activeTrackWidthCm);
  const setActiveTrackWidthCm = useStore((state) => state.setActiveTrackWidthCm);
  const activeTrackHeightCm = useStore((state) => state.activeTrackHeightCm);
  const setActiveTrackHeightCm = useStore((state) => state.setActiveTrackHeightCm);
  const setCustomTrackSrc = useStore((state) => state.setCustomTrackSrc);
  const workspaceXml = useStore((state) => state.workspaceXml);
  const editorMode = useStore((state) => state.editorMode);
  const trainingSummary = useStore((state) => state.trainingSummary);
  const setTrainingSummary = useStore((state) => state.setTrainingSummary);
  const setEditorMode = useStore((state) => state.setEditorMode);
  const libraryVersion = useStore((state) => state.libraryVersion);
  const setLibraryVersion = useStore((state) => state.setLibraryVersion);
  const robotPanelOpen = useStore((state) => state.robotPanelOpen);
  const setRobotPanelOpen = useStore((state) => state.setRobotPanelOpen);
  const lang = useStore((state) => state.lang);
  const setLang = useStore((state) => state.setLang);
  const viewMode = useStore((state) => state.viewMode);
  const setViewMode = useStore((state) => state.setViewMode);
  const t = useT();
  const [saved, setSaved] = React.useState(false);
  React.useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const [mobileTab, setMobileTab] = React.useState<'editor' | 'simulator'>('editor');
  const [zoom, setZoom] = React.useState(1);
  const getRobot = React.useCallback(() => canvasRendererRef.current?.getRobot() ?? null, []);
  const getTrackCanvas = React.useCallback(() => canvasRendererRef.current?.getTrackCanvas() ?? null, []);
  const setRobotPose = React.useCallback((x: number, y: number, angle: number) => canvasRendererRef.current?.setRobotPose(x, y, angle), []);
  const canvasRendererRef = React.useRef<CanvasRendererHandle>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Create stable refs that TrainingPanel can use
  const trackCanvasProxyRef = React.useRef<HTMLCanvasElement | null>(null);
  const robotProxyRef = React.useRef<any>(null);

  // Sync proxy refs when canvas renderer updates
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (canvasRendererRef.current) {
        trackCanvasProxyRef.current = canvasRendererRef.current.getTrackCanvas();
        robotProxyRef.current = canvasRendererRef.current.getRobot();
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleTrackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const url = URL.createObjectURL(file);
      setCustomTrackSrc(url, 'pdf');
      setActiveTrack('upload');
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          let width = img.width;
          let height = img.height;
          const MAX_SIZE = 4096;

          if (width > MAX_SIZE || height > MAX_SIZE) {
            const ratio = Math.min(MAX_SIZE / width, MAX_SIZE / height);
            width = width * ratio;
            height = height * ratio;
          }

          canvas.width = width;
          canvas.height = height;

          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob((blob) => {
              if (blob) {
                const webPUrl = URL.createObjectURL(blob);
                setCustomTrackSrc(webPUrl, 'image');
                setActiveTrack('upload');
              }
            }, 'image/webp', 0.8);
          }
        };
        if (event.target?.result) {
          img.src = event.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([editorMode === 'code' ? sketchCode : arduinoCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mrbMaze${libraryVersion}_robot.ino`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (workspaceXml) {
      localStorage.setItem('blockly_workspace_save', workspaceXml);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const handleAiGenerateIno = (code: string) => {
    setArduinoCode(code);
  };

  return (
    <div className="flex flex-col h-[100dvh] w-screen bg-slate-100 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between px-4 md:px-6 py-3 bg-white border-b border-slate-200 shadow-sm z-20 w-full relative gap-3 md:gap-0">
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-3">
            <img src={logo} alt="X" className="w-9 h-9 rounded-md shadow-sm" />
            <h1 className="text-xl font-semibold text-slate-800">Simulator</h1>
          </div>
          <div className="flex rounded-md border border-slate-300 overflow-hidden h-8 text-xs font-semibold" role="group" aria-label={t('app.language')}>
            {(['en', 'id'] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className={`px-2.5 uppercase transition-colors ${lang === l ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide">
          <button
            onClick={() => setSimulationState('running')}
            disabled={simulationState === 'running'}
            className={`whitespace-nowrap flex flex-shrink-0 items-center space-x-1 px-4 py-2 text-white rounded-md transition-colors text-sm font-medium shadow-sm ${simulationState === 'running' ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <Play className="w-4 h-4" />
            <span>{t('app.simulate')}</span>
          </button>
          <button
            onClick={() => setSimulationState('idle')}
            disabled={simulationState === 'idle'}
            className={`whitespace-nowrap flex flex-shrink-0 items-center space-x-1 px-4 py-2 text-white rounded-md transition-colors text-sm font-medium shadow-sm ${simulationState === 'idle' ? 'bg-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'}`}>
            <Square className="w-4 h-4" />
            <span>{t('app.stop')}</span>
          </button>
          <button
            onClick={() => {
              setSimulationState('idle');
              window.dispatchEvent(new CustomEvent('reset-simulation'));
            }}
            title={t('app.reset')}
            aria-label={t('app.reset')}
            className="flex-shrink-0 flex items-center space-x-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors text-sm font-medium shadow-sm">
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-300 mx-2 flex-shrink-0"></div>
          {saved && <span className="text-emerald-600 text-xs font-semibold mr-2 whitespace-nowrap">{t('app.saved')}</span>}
          <button onClick={handleSave} className="whitespace-nowrap flex flex-shrink-0 items-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors text-sm font-medium shadow-sm">
            <Save className="w-4 h-4" />
            <span>{t('app.save')}</span>
          </button>
          <select
            value={libraryVersion}
            onChange={(e) => setLibraryVersion(e.target.value as LibVersion)}
            className="flex-shrink-0 h-9 bg-white border border-slate-300 rounded-md px-2 text-sm text-slate-700 shadow-sm"
            title={t('app.libVersionTitle')}
            aria-label={t('app.libVersion')}
          >
            {LIB_VERSIONS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
          <button onClick={handleDownload} className="whitespace-nowrap flex flex-shrink-0 items-center space-x-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium shadow-sm">
            <Download className="w-4 h-4" />
            <span>{t('app.download')}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area - Split Screen */}
      <main className="flex-1 flex flex-col lg:flex-row w-full relative overflow-hidden">
        {/* Left Panel - Editor (Blockly or AI Training) */}
        <section className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/2 h-full border-b lg:border-b-0 lg:border-r border-slate-300 bg-white flex-col relative z-10 flex-shrink-0`}>
          {/* Tab Header */}
          <div className="absolute top-0 left-0 right-0 p-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 z-10 shadow-sm flex justify-between items-center h-10">
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
              {([
                ['blockly', 'tab.blockly', Blocks],
                ['code', 'tab.code', Code2],
                ['ai', 'tab.ai', Brain],
                ['learn', 'tab.learn', GraduationCap],
                ['library', 'tab.library', BookOpen],
              ] as [EditorMode, TKey, typeof Blocks][]).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  onClick={() => setEditorMode(mode)}
                  className={`flex flex-shrink-0 items-center space-x-1 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                    editorMode === mode
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  <span>{t(label)}</span>
                </button>
              ))}
            </div>
          </div>
          {/* Editor Content - Both panels stay mounted, toggle via CSS */}
          <div className="absolute top-10 bottom-0 left-0 right-0 w-full overflow-hidden">
            <div id="blocklyDiv" style={{ display: editorMode === 'blockly' ? 'block' : 'none', width: '100%', height: '100%' }}>
              <BlocklyWorkspace />
            </div>
            <div style={{ display: editorMode === 'ai' ? 'block' : 'none', width: '100%', height: '100%' }}>
              <TrainingPanel
                trackCanvasRef={trackCanvasProxyRef}
                robotRef={robotProxyRef}
                onGenerateIno={handleAiGenerateIno}
              />
            </div>
            <React.Suspense fallback={null}>
              {editorMode === 'code' && <CodeEditor />}
              {editorMode === 'learn' && <LearnPanel />}
              {editorMode === 'library' && <LibraryPanel />}
            </React.Suspense>
          </div>
        </section>

        {/* Right Panel - Simulator UI */}
        <section className={`${mobileTab === 'simulator' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/2 h-full bg-slate-200 flex-col relative z-10 flex-shrink-0`}>
          <div className="absolute top-0 left-0 right-0 p-2 bg-slate-100 border-b border-slate-300 text-xs font-semibold text-slate-500 z-10 shadow-sm flex justify-between items-center h-10 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <span className="hidden sm:inline">{t('sim.title')}</span>
            <div className="flex space-x-2 items-center min-w-max">
              {activeTrack === 'custom' && (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('clear-custom-track'))}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 rounded px-2 text-xs h-6 shadow-sm mr-2 transition-colors">
                  {t('sim.clearTrack')}
                </button>
              )}
              {activeTrack === 'upload' && (
                <div className="flex items-center space-x-1 mr-2 bg-slate-200 rounded px-2 h-6 border border-slate-300">
                  <span className="text-xs text-slate-600">{t('sim.size')}</span>
                  <input
                    type="number"
                    value={activeTrackWidthCm}
                    onChange={(e) => setActiveTrackWidthCm(Number(e.target.value))}
                    className="w-10 h-4 text-xs bg-white text-center rounded border-none outline-none"
                    title={t('sim.widthCm')}
                  />
                  <span className="text-xs text-slate-500">x</span>
                  <input
                    type="number"
                    value={activeTrackHeightCm}
                    onChange={(e) => setActiveTrackHeightCm(Number(e.target.value))}
                    className="w-10 h-4 text-xs bg-white text-center rounded border-none outline-none"
                    title={t('sim.heightCm')}
                  />
                  <span className="text-xs text-slate-600">cm</span>
                </div>
              )}
              <button
                onClick={() => setRobotPanelOpen(!robotPanelOpen)}
                aria-pressed={robotPanelOpen}
                className={`flex items-center gap-1 px-2 h-6 mr-2 rounded border text-xs font-semibold shadow-sm transition-colors ${robotPanelOpen ? 'bg-slate-800 border-slate-800 text-white' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-100'}`}
                title={t('sim.robotTitle')}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                <span>{t('sim.robot')}</span>
              </button>
              <div className="flex rounded border border-slate-300 overflow-hidden h-6 mr-2 shadow-sm">
                {(['2d', '3d'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setViewMode(m)}
                    className={`px-2 text-xs font-semibold uppercase transition-colors ${viewMode === m ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                    title={m === '3d' ? t('sim.view3d') : t('sim.view2d')}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <select
                value={activeTrack}
                onChange={(e) => setActiveTrack(e.target.value as TrackId)}
                aria-label={t('sim.trackPrefix')}
                className="bg-white border border-slate-300 rounded px-2 text-xs h-6 shadow-sm">
                {TRACKS.map(id => <option key={id} value={id}>{t('sim.trackPrefix')} {t(`sim.track.${id}` as TKey)}</option>)}
              </select>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept="image/*,application/pdf"
                onChange={handleTrackUpload}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="ml-2 bg-blue-100 hover:bg-blue-200 text-blue-700 border border-blue-300 rounded px-2 text-xs h-6 shadow-sm transition-colors">
                {t('sim.upload')}
              </button>
            </div>
          </div>
          {robotPanelOpen && <React.Suspense fallback={null}><RobotPanel /></React.Suspense>}
          <div className="absolute top-12 right-2 z-30 pointer-events-auto">
            <SensorStrip getRobot={getRobot} />
          </div>
          {viewMode === '3d' && (
            <div className="absolute top-10 bottom-0 left-0 right-0 z-20 bg-slate-200">
              <React.Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-slate-500">{t('sim.loading3d')}</div>}>
                <Robot3DView getRobot={getRobot} getTrackCanvas={getTrackCanvas} setRobotPose={setRobotPose} />
              </React.Suspense>
            </div>
          )}
          <div className="absolute top-10 bottom-0 left-0 right-0 p-2 md:p-8 bg-slate-200 overflow-auto">
            {/* Zoom Controls */}
            <div className={`${viewMode === '3d' ? 'hidden' : 'flex'} fixed md:absolute bottom-20 md:bottom-auto md:top-20 right-4 flex-col space-y-2 z-20`}>
               <button onClick={()=>setZoom(z=>z+0.25)} className="p-2 bg-white rounded-full md:rounded shadow-lg md:shadow text-slate-700 hover:bg-slate-50 transition-colors" title={t('sim.zoomIn')} aria-label={t('sim.zoomIn')}>
                 <ZoomIn className="w-5 h-5"/>
               </button>
               <button onClick={()=>setZoom(1)} className="p-2 bg-white rounded-full md:rounded shadow-lg md:shadow text-slate-700 hover:bg-slate-50 transition-colors" title={t('sim.zoomReset')} aria-label={t('sim.zoomReset')}>
                 <Maximize className="w-5 h-5"/>
               </button>
               <button onClick={()=>setZoom(z=>Math.max(0.25, z-0.25))} className="p-2 bg-white rounded-full md:rounded shadow-lg md:shadow text-slate-700 hover:bg-slate-50 transition-colors" title={t('sim.zoomOut')} aria-label={t('sim.zoomOut')}>
                 <ZoomOut className="w-5 h-5"/>
               </button>
            </div>
            
            {/* Canvas */}
            <div 
              style={{ width: `${zoom * 100}%`, minWidth: `${zoom * 300}px`, maxWidth: `${zoom * 800}px` }}
              className="mx-auto aspect-square bg-white shadow-md rounded-lg flex items-center justify-center border border-slate-300 relative overflow-hidden origin-top transition-all duration-200"
            >
              <CanvasRenderer ref={canvasRendererRef} />
            </div>
          </div>
        </section>
      </main>

      {/* Mobile Tab Switcher */}
      <div className="lg:hidden flex bg-white border-t border-slate-300 w-full z-30 flex-shrink-0">
        <button
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center space-x-2 ${mobileTab === 'editor' ? 'text-blue-600 bg-blue-50' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Blocks className="w-4 h-4" />
          <span>{t('mobile.editor')}</span>
        </button>
        <button
          onClick={() => setMobileTab('simulator')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center space-x-2 ${mobileTab === 'simulator' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Play className="w-4 h-4" />
          <span>{t('mobile.simulator')}</span>
        </button>
      </div>

      {/* Modal Training Selesai (global, viewport-wide) */}
      {trainingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
          <div className="bg-white rounded-lg shadow-xl border border-slate-200 max-w-sm w-full mx-4 overflow-hidden text-left">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" />
                <span className="font-semibold text-slate-900">{t('modal.title')}</span>
              </div>
              <button onClick={() => setTrainingSummary(null)} className="text-slate-400 hover:text-slate-700 transition-colors" aria-label={t('modal.close')}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              <p className="text-sm text-slate-600">
                {t('modal.text')}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="text-[11px] text-slate-500">{t('modal.episodes')}</div>
                  <div className="text-lg font-semibold text-slate-900 tabular-nums">{trainingSummary.episodes}</div>
                </div>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="text-[11px] text-slate-500">{t('modal.finished')}</div>
                  <div className="text-lg font-semibold text-slate-900 tabular-nums">{trainingSummary.finished}</div>
                </div>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="text-[11px] text-slate-500">{t('modal.bestReward')}</div>
                  <div className="text-lg font-semibold text-slate-900 tabular-nums">{trainingSummary.bestReward.toFixed(0)}</div>
                </div>
                <div className="rounded-md border border-slate-200 px-3 py-2">
                  <div className="text-[11px] text-slate-500">{t('modal.qStates')}</div>
                  <div className="text-lg font-semibold text-slate-900 tabular-nums">{trainingSummary.qTableSize}</div>
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex space-x-2">
              <button
                onClick={() => setTrainingSummary(null)}
                className="flex-1 h-9 px-4 bg-white border border-slate-300 hover:bg-slate-50 rounded-md text-sm font-medium text-slate-700 transition-colors"
              >
                {t('modal.close')}
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('generate-ai-ino'));
                  setTrainingSummary(null);
                }}
                className="flex-1 h-9 flex items-center justify-center space-x-1 px-4 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>{t('modal.generate')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


