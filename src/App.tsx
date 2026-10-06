import React from 'react';
import { Download, Play, Square, RotateCcw, Save, Brain, Blocks, CheckCircle, X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import logo from './assets/logo.svg';
import { BlocklyWorkspace } from './blockly/BlocklyWorkspace';
import { CanvasRenderer, type CanvasRendererHandle } from './simulator/CanvasRenderer';
import { TrainingPanel } from './qlearning/TrainingPanel';
import { useStore } from './store/useStore';

function App() {
  const arduinoCode = useStore((state) => state.arduinoCode);
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
  const [saveStatus, setSaveStatus] = React.useState('');
  const [mobileTab, setMobileTab] = React.useState<'editor' | 'simulator'>('editor');
  const [zoom, setZoom] = React.useState(1);
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
    const blob = new Blob([arduinoCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mrbMaze42_robot.ino';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSave = () => {
    if (workspaceXml) {
      localStorage.setItem('blockly_workspace_save', workspaceXml);
      setSaveStatus('Saved!');
      setTimeout(() => setSaveStatus(''), 2500);
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
            <img src={logo} alt="MazeSim" className="w-9 h-9 rounded-md shadow-sm" />
            <h1 className="text-xl font-semibold text-slate-800">Simulator</h1>
          </div>
        </div>

        <div className="flex items-center space-x-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 scrollbar-hide">
          <button
            onClick={() => setSimulationState('running')}
            disabled={simulationState === 'running'}
            className={`whitespace-nowrap flex flex-shrink-0 items-center space-x-1 px-4 py-2 text-white rounded-md transition-colors text-sm font-medium shadow-sm ${simulationState === 'running' ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <Play className="w-4 h-4" />
            <span>Simulate</span>
          </button>
          <button
            onClick={() => setSimulationState('idle')}
            disabled={simulationState === 'idle'}
            className={`whitespace-nowrap flex flex-shrink-0 items-center space-x-1 px-4 py-2 text-white rounded-md transition-colors text-sm font-medium shadow-sm ${simulationState === 'idle' ? 'bg-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'}`}>
            <Square className="w-4 h-4" />
            <span>Stop</span>
          </button>
          <button
            onClick={() => {
              setSimulationState('idle');
              window.dispatchEvent(new CustomEvent('reset-simulation'));
            }}
            className="flex-shrink-0 flex items-center space-x-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors text-sm font-medium shadow-sm">
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-300 mx-2 flex-shrink-0"></div>
          {saveStatus && <span className="text-emerald-600 text-xs font-semibold mr-2 whitespace-nowrap">{saveStatus}</span>}
          <button onClick={handleSave} className="whitespace-nowrap flex flex-shrink-0 items-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors text-sm font-medium shadow-sm">
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button onClick={handleDownload} className="whitespace-nowrap flex flex-shrink-0 items-center space-x-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium shadow-sm">
            <Download className="w-4 h-4" />
            <span>Download .ino</span>
          </button>
        </div>
      </header>

      {/* Main Content Area - Split Screen */}
      <main className="flex-1 flex flex-col lg:flex-row w-full relative overflow-hidden">
        {/* Left Panel - Editor (Blockly or AI Training) */}
        <section className={`${mobileTab === 'editor' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/2 h-full border-b lg:border-b-0 lg:border-r border-slate-300 bg-white flex-col relative z-10 flex-shrink-0`}>
          {/* Tab Header */}
          <div className="absolute top-0 left-0 right-0 p-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 z-10 shadow-sm flex justify-between items-center h-10">
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setEditorMode('blockly')}
                className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  editorMode === 'blockly'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                <Blocks className="w-3 h-3" />
                <span>Blockly</span>
              </button>
              <button
                onClick={() => setEditorMode('ai')}
                className={`flex items-center space-x-1 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  editorMode === 'ai'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                <Brain className="w-3 h-3" />
                <span>AI Training</span>
              </button>
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
          </div>
        </section>

        {/* Right Panel - Simulator UI */}
        <section className={`${mobileTab === 'simulator' ? 'flex' : 'hidden'} lg:flex w-full lg:w-1/2 h-full bg-slate-200 flex-col relative z-10 flex-shrink-0`}>
          <div className="absolute top-0 left-0 right-0 p-2 bg-slate-100 border-b border-slate-300 text-xs font-semibold text-slate-500 z-10 shadow-sm flex justify-between items-center h-10 overflow-x-auto whitespace-nowrap scrollbar-hide">
            <span className="hidden sm:inline">SIMULATOR</span>
            <div className="flex space-x-2 items-center min-w-max">
              {activeTrack === 'custom' && (
                <button
                  onClick={() => window.dispatchEvent(new CustomEvent('clear-custom-track'))}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 rounded px-2 text-xs h-6 shadow-sm mr-2 transition-colors">
                  Clear Track
                </button>
              )}
              {activeTrack === 'upload' && (
                <div className="flex items-center space-x-1 mr-2 bg-slate-200 rounded px-2 h-6 border border-slate-300">
                  <span className="text-xs text-slate-600">Size:</span>
                  <input
                    type="number"
                    value={activeTrackWidthCm}
                    onChange={(e) => setActiveTrackWidthCm(Number(e.target.value))}
                    className="w-10 h-4 text-xs bg-white text-center rounded border-none outline-none"
                    title="Width (cm)"
                  />
                  <span className="text-xs text-slate-500">x</span>
                  <input
                    type="number"
                    value={activeTrackHeightCm}
                    onChange={(e) => setActiveTrackHeightCm(Number(e.target.value))}
                    className="w-10 h-4 text-xs bg-white text-center rounded border-none outline-none"
                    title="Height (cm)"
                  />
                  <span className="text-xs text-slate-600">cm</span>
                </div>
              )}
              <select
                value={activeTrack}
                onChange={(e) => setActiveTrack(e.target.value as any)}
                className="bg-white border border-slate-300 rounded px-2 text-xs h-6 shadow-sm">
                <option value="loop">Track: Loop</option>
                <option value="scurve">Track: S-Curve</option>
                <option value="maze">Track: Maze Grid</option>
                <option value="custom">Track: Custom (Draw)</option>
                <option value="upload">Track: Upload Image/PDF</option>
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
                Upload
              </button>
            </div>
          </div>
          <div className="absolute top-10 bottom-0 left-0 right-0 p-2 md:p-8 bg-slate-200 overflow-auto">
            {/* Zoom Controls */}
            <div className="fixed md:absolute bottom-20 md:bottom-auto md:top-4 right-4 flex flex-col space-y-2 z-20">
               <button onClick={()=>setZoom(z=>z+0.25)} className="p-2 bg-white rounded-full md:rounded shadow-lg md:shadow text-slate-700 hover:bg-slate-50 transition-colors" title="Zoom In">
                 <ZoomIn className="w-5 h-5"/>
               </button>
               <button onClick={()=>setZoom(1)} className="p-2 bg-white rounded-full md:rounded shadow-lg md:shadow text-slate-700 hover:bg-slate-50 transition-colors" title="Reset Zoom">
                 <Maximize className="w-5 h-5"/>
               </button>
               <button onClick={()=>setZoom(z=>Math.max(0.25, z-0.25))} className="p-2 bg-white rounded-full md:rounded shadow-lg md:shadow text-slate-700 hover:bg-slate-50 transition-colors" title="Zoom Out">
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
          <span>Editor Blockly</span>
        </button>
        <button
          onClick={() => setMobileTab('simulator')}
          className={`flex-1 py-3 text-sm font-semibold flex items-center justify-center space-x-2 ${mobileTab === 'simulator' ? 'text-emerald-600 bg-emerald-50' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Play className="w-4 h-4" />
          <span>Simulator Robot</span>
        </button>
      </div>

      {/* Modal Training Selesai (global, viewport-wide) */}
      {trainingSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl shadow-2xl border border-slate-600 max-w-sm w-full mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-white">Training Selesai</span>
              </div>
              <button onClick={() => setTrainingSummary(null)} className="text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-5 space-y-3">
              <p className="text-sm text-slate-300">
                Proses training telah selesai. Robot dapat menjalankan hasil training melalui tombol Simulate.
              </p>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Episodes</div>
                  <div className="text-lg font-bold text-white">{trainingSummary.episodes}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Finished</div>
                  <div className="text-lg font-bold text-purple-400">{trainingSummary.finished}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Best Reward</div>
                  <div className="text-lg font-bold text-emerald-400">{trainingSummary.bestReward.toFixed(0)}</div>
                </div>
                <div className="bg-slate-900 rounded-lg p-3">
                  <div className="text-xs text-slate-400 mb-1">Q-Table States</div>
                  <div className="text-lg font-bold text-amber-400">{trainingSummary.qTableSize}</div>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-700 flex space-x-2">
              <button
                onClick={() => setTrainingSummary(null)}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-medium text-white transition-colors"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  window.dispatchEvent(new CustomEvent('generate-ai-ino'));
                  setTrainingSummary(null);
                }}
                className="flex-1 flex items-center justify-center space-x-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-sm font-medium text-white transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Generate .ino</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;


