import React from 'react';
import { Download, Play, Square, RotateCcw, Save } from 'lucide-react';
import { BlocklyWorkspace } from './blockly/BlocklyWorkspace';
import { CanvasRenderer } from './simulator/CanvasRenderer';
import { useStore } from './store/useStore';

function App() {
  const arduinoCode = useStore((state) => state.arduinoCode);
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
  const [saveStatus, setSaveStatus] = React.useState('');

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleTrackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      const url = URL.createObjectURL(file);
      setCustomTrackSrc(url, 'pdf');
      setActiveTrack('upload');
    } else {
      // Auto compress large images to WebP to save browser memory
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          // Limit max dimensions to prevent canvas RAM crashes on absurdly large files
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
            }, 'image/webp', 0.8); // Compress to 80% WebP
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

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-100 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 shadow-sm z-20 w-full relative">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">
            m
          </div>
          <h1 className="text-xl font-semibold text-slate-800">Myrobo Cianjur - Maze Solving</h1>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSimulationState('running')}
            disabled={simulationState === 'running'}
            className={`flex items-center space-x-1 px-4 py-2 text-white rounded-md transition-colors text-sm font-medium shadow-sm ${simulationState === 'running' ? 'bg-emerald-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
            <Play className="w-4 h-4" />
            <span>Simulate</span>
          </button>
          <button
            onClick={() => setSimulationState('idle')}
            disabled={simulationState === 'idle'}
            className={`flex items-center space-x-1 px-4 py-2 text-white rounded-md transition-colors text-sm font-medium shadow-sm ${simulationState === 'idle' ? 'bg-rose-400 cursor-not-allowed' : 'bg-rose-600 hover:bg-rose-700'}`}>
            <Square className="w-4 h-4" />
            <span>Stop</span>
          </button>
          <button
            onClick={() => {
              setSimulationState('idle');
              window.dispatchEvent(new CustomEvent('reset-simulation'));
            }}
            className="flex items-center space-x-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-md transition-colors text-sm font-medium shadow-sm">
            <RotateCcw className="w-4 h-4" />
          </button>
          <div className="w-px h-6 bg-slate-300 mx-2"></div>
          {saveStatus && <span className="text-emerald-600 text-xs font-semibold mr-2">{saveStatus}</span>}
          <button onClick={handleSave} className="flex items-center space-x-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors text-sm font-medium shadow-sm">
            <Save className="w-4 h-4" />
            <span>Save</span>
          </button>
          <button onClick={handleDownload} className="flex items-center space-x-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium shadow-sm">
            <Download className="w-4 h-4" />
            <span>Download .ino</span>
          </button>
        </div>
      </header>

      {/* Main Content Area - Split Screen */}
      <main className="flex-1 flex flex-row h-[calc(100vh-65px)] w-full relative">
        {/* Left Panel - Blockly Workspace */}
        <section className="w-1/2 h-full border-r border-slate-300 bg-white flex flex-col relative z-10 w-[50%]">
          <div className="absolute top-0 left-0 right-0 p-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 z-10 shadow-sm flex justify-between items-center h-10">
            <span>PROGRAM LOGIC</span>
          </div>
          <div className="absolute top-10 bottom-0 left-0 right-0 w-full overflow-hidden" id="blocklyDiv">
            <BlocklyWorkspace />
          </div>
        </section>

        {/* Right Panel - Simulator UI */}
        <section className="w-1/2 h-full bg-slate-200 flex flex-col relative z-10 w-[50%]">
          <div className="absolute top-0 left-0 right-0 p-2 bg-slate-100 border-b border-slate-300 text-xs font-semibold text-slate-500 z-10 shadow-sm flex justify-between items-center h-10">
            <span>SIMULATOR</span>
            <div className="flex space-x-2">
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
          <div className="absolute top-10 bottom-0 left-0 right-0 p-8 flex items-center justify-center bg-slate-200">
            {/* Canvas */}
            <div className="w-full h-full max-h-[800px] aspect-square bg-white shadow-md rounded-lg flex items-center justify-center border border-slate-300 relative overflow-hidden mx-auto">
              <CanvasRenderer />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
