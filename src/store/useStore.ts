import { create } from 'zustand';
import type { ActionRecord } from '../qlearning/QLearningAgent';
import type { PartId } from '../simulator/robotLayout';
import { convertSketch, type LibVersion } from '../blockly/inoTemplate';
import { readLang, type Lang } from '../i18n/i18n';

const readVersion = (): LibVersion => {
    try { return localStorage.getItem('mrb_library_version') === '42' ? '42' : '44'; } catch { return '44'; }
};

const readSketch = (): string => {
    try { return localStorage.getItem('mrb_sketch_code') ?? ''; } catch { return ''; }
};

interface Point { x: number; y: number; }

export type EditorMode = 'blockly' | 'code' | 'ai' | 'learn' | 'library';

export type TrackId = 'loop' | 'scurve' | 'maze' | 'croc_junior' | 'croc_senior' | 'custom' | 'upload';

interface AppState {
    arduinoCode: string;
    jsCode: string;
    sketchCode: string; // hand-written .ino in the Code tab
    workspaceXml: string | null;
    simulationState: 'idle' | 'running' | 'paused';
    activeTrack: TrackId;
    customTrackSrc: string | null;
    customTrackType: 'image' | 'pdf' | null;
    activeTrackWidthCm: number;
    activeTrackHeightCm: number;
    editorMode: EditorMode;
    highlightPart: PartId | null;
    libraryFocus: string | null; // function name the Library tab should scroll to
    libraryVersion: LibVersion; // mrbMaze library the .ino is generated for
    robotPanelOpen: boolean; // OLED + buttons popup
    lang: Lang; // UI language
    viewMode: '2d' | '3d';
    robotPower: boolean; // POWER push switch on the robot
    motorPower: boolean; // MOTOR push switch on the robot
    startPoint: Point | null;
    finishPoint: Point | null;
    waypoints: Point[];
    collectedWaypointIds: number[];  // indices of collected waypoints for visual
    placementMode: 'none' | 'start' | 'finish' | 'waypoint';
    bestActions: ActionRecord[];
    trainingPower: number;
    trainingSummary: { episodes: number; finished: number; bestReward: number; qTableSize: number } | null;

    setArduinoCode: (code: string) => void;
    setJsCode: (code: string) => void;
    setSketchCode: (code: string) => void;
    setWorkspaceXml: (xml: string) => void;
    setSimulationState: (state: 'idle' | 'running' | 'paused') => void;
    setActiveTrack: (track: TrackId) => void;
    setCustomTrackSrc: (src: string | null, type?: 'image' | 'pdf') => void;
    setActiveTrackWidthCm: (cm: number) => void;
    setActiveTrackHeightCm: (cm: number) => void;
    setEditorMode: (mode: EditorMode) => void;
    setHighlightPart: (part: PartId | null) => void;
    openLibrary: (fn: string | null) => void;
    setLibraryVersion: (v: LibVersion) => void;
    setRobotPanelOpen: (open: boolean) => void;
    setLang: (lang: Lang) => void;
    setViewMode: (mode: '2d' | '3d') => void;
    setRobotPower: (on: boolean) => void;
    setMotorPower: (on: boolean) => void;
    setStartPoint: (point: Point | null) => void;
    setFinishPoint: (point: Point | null) => void;
    setWaypoints: (points: Point[]) => void;
    addWaypoint: (point: Point) => void;
    removeWaypoint: (index: number) => void;
    setCollectedWaypointIds: (ids: number[]) => void;
    setPlacementMode: (mode: 'none' | 'start' | 'finish' | 'waypoint') => void;
    setBestActions: (actions: ActionRecord[]) => void;
    setTrainingPower: (power: number) => void;
    setTrainingSummary: (summary: { episodes: number; finished: number; bestReward: number; qTableSize: number } | null) => void;
}

export const useStore = create<AppState>((set, get) => ({
    arduinoCode: '',
    jsCode: '',
    sketchCode: readSketch(),
    workspaceXml: null,
    simulationState: 'idle',
    activeTrack: 'loop',
    customTrackSrc: null,
    customTrackType: null,
    activeTrackWidthCm: 150,
    activeTrackHeightCm: 150,
    editorMode: 'blockly',
    highlightPart: 'sensors',
    libraryFocus: null,
    libraryVersion: readVersion(),
    robotPanelOpen: false,
    lang: readLang(),
    viewMode: '2d',
    robotPower: true,
    motorPower: true,
    startPoint: null,
    finishPoint: null,
    waypoints: [],
    collectedWaypointIds: [],
    placementMode: 'none',
    bestActions: [],
    trainingPower: 100,
    trainingSummary: null,

    setArduinoCode: (code) => set({ arduinoCode: code }),
    setJsCode: (code) => set({ jsCode: code }),
    setSketchCode: (code) => {
        try { localStorage.setItem('mrb_sketch_code', code); } catch { /* storage unavailable */ }
        set({ sketchCode: code });
    },
    setWorkspaceXml: (xml) => set({ workspaceXml: xml }),
    setSimulationState: (state) => set({ simulationState: state }),
    setActiveTrack: (track) => set({ activeTrack: track }),
    setCustomTrackSrc: (src, type) => set({ customTrackSrc: src, customTrackType: type || null }),
    setActiveTrackWidthCm: (cm) => set({ activeTrackWidthCm: cm }),
    setActiveTrackHeightCm: (cm) => set({ activeTrackHeightCm: cm }),
    setEditorMode: (mode) => set({ editorMode: mode }),
    setHighlightPart: (part) => set({ highlightPart: part }),
    openLibrary: (fn) => set({ editorMode: 'library', libraryFocus: fn }),
    setLibraryVersion: (v) => {
        try { localStorage.setItem('mrb_library_version', v); } catch { /* storage unavailable */ }
        // The Code tab sketch follows the version; loop() and own code are kept
        const sketchCode = convertSketch(get().sketchCode, get().libraryVersion, v);
        try { localStorage.setItem('mrb_sketch_code', sketchCode); } catch { /* storage unavailable */ }
        set({ libraryVersion: v, sketchCode });
    },
    setRobotPanelOpen: (open) => set({ robotPanelOpen: open }),
    setLang: (lang) => {
        try { localStorage.setItem('mrb_lang', lang); } catch { /* storage unavailable */ }
        document.documentElement.lang = lang;
        set({ lang });
    },
    setViewMode: (mode) => set({ viewMode: mode }),
    setRobotPower: (on) => set({ robotPower: on }),
    setMotorPower: (on) => set({ motorPower: on }),
    setStartPoint: (point) => set({ startPoint: point }),
    setFinishPoint: (point) => set({ finishPoint: point }),
    setWaypoints: (points) => set({ waypoints: points }),
    addWaypoint: (point) => set((state) => ({ waypoints: [...state.waypoints, point] })),
    removeWaypoint: (index) => set((state) => ({ waypoints: state.waypoints.filter((_, i) => i !== index) })),
    setCollectedWaypointIds: (ids) => set({ collectedWaypointIds: ids }),
    setPlacementMode: (mode) => set({ placementMode: mode }),
    setBestActions: (actions) => set({ bestActions: actions }),
    setTrainingPower: (power) => set({ trainingPower: power }),
    setTrainingSummary: (summary) => set({ trainingSummary: summary }),
}));
