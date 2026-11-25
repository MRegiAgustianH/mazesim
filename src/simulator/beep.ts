// Short "bip" played when a robot command finishes during simulation.
let audioCtx: AudioContext | null = null;

export function beep(frequency = 1200, durationMs = 70, volume = 0.08) {
    try {
        audioCtx ??= new AudioContext();
        if (audioCtx.state === 'suspended') void audioCtx.resume();

        const t = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.value = frequency;
        // Quick attack/release to avoid clicks
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(volume, t + 0.005);
        gain.gain.setValueAtTime(volume, t + durationMs / 1000 - 0.01);
        gain.gain.linearRampToValueAtTime(0, t + durationMs / 1000);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(t);
        osc.stop(t + durationMs / 1000);
    } catch {
        // Audio not available: ignore silently
    }
}
