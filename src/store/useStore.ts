import { create } from 'zustand';

interface AppState {
    arduinoCode: string;
    jsCode: string;
    workspaceXml: string | null;
    simulationState: 'idle' | 'running' | 'paused';
    activeTrack: 'loop' | 'scurve' | 'maze' | 'custom' | 'upload';
    customTrackSrc: string | null;
    customTrackType: 'image' | 'pdf' | null;
    activeTrackWidthCm: number;
    activeTrackHeightCm: number;

    setArduinoCode: (code: string) => void;
    setJsCode: (code: string) => void;
    setWorkspaceXml: (xml: string) => void;
    setSimulationState: (state: 'idle' | 'running' | 'paused') => void;
    setActiveTrack: (track: 'loop' | 'scurve' | 'maze' | 'custom' | 'upload') => void;
    setCustomTrackSrc: (src: string | null, type?: 'image' | 'pdf') => void;
    setActiveTrackWidthCm: (cm: number) => void;
    setActiveTrackHeightCm: (cm: number) => void;
}

export const useStore = create<AppState>((set) => ({
    arduinoCode: '',
    jsCode: '',
    workspaceXml: null,
    simulationState: 'idle',
    activeTrack: 'loop',
    customTrackSrc: null,
    customTrackType: null,
    activeTrackWidthCm: 150, // Default 1.5m
    activeTrackHeightCm: 150, // Default 1.5m

    setArduinoCode: (code) => set({ arduinoCode: code }),
    setJsCode: (code) => set({ jsCode: code }),
    setWorkspaceXml: (xml) => set({ workspaceXml: xml }),
    setSimulationState: (state) => set({ simulationState: state }),
    setActiveTrack: (track) => set({ activeTrack: track }),
    setCustomTrackSrc: (src, type) => set({ customTrackSrc: src, customTrackType: type || null }),
    setActiveTrackWidthCm: (cm) => set({ activeTrackWidthCm: cm }),
    setActiveTrackHeightCm: (cm) => set({ activeTrackHeightCm: cm }),
}));
