// Web Audio API Procedural Engine Sound System for MANIFOLD WORLD
// Zero external audio files required — low latency, resilient, dynamic RPM modulation.

class EngineAudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Audio Nodes
  private masterGain: GainNode | null = null;
  private osc1: OscillatorNode | null = null;
  private osc2: OscillatorNode | null = null;
  private subOsc: OscillatorNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireGain: GainNode | null = null;

  // Engine state
  private targetFreq: number = 55;
  private currentFreq: number = 55;

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.18, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Lowpass filter for engine warmth
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(320, this.ctx.currentTime);
      this.filter.Q.setValueAtTime(3.0, this.ctx.currentTime);
      this.filter.connect(this.masterGain);

      // Main combustion oscillators
      this.osc1 = this.ctx.createOscillator();
      this.osc1.type = 'sawtooth';
      this.osc1.frequency.setValueAtTime(55, this.ctx.currentTime);

      this.osc2 = this.ctx.createOscillator();
      this.osc2.type = 'triangle';
      this.osc2.frequency.setValueAtTime(110, this.ctx.currentTime);

      this.subOsc = this.ctx.createOscillator();
      this.subOsc.type = 'sine';
      this.subOsc.frequency.setValueAtTime(27.5, this.ctx.currentTime);

      const oscGain1 = this.ctx.createGain();
      oscGain1.gain.setValueAtTime(0.5, this.ctx.currentTime);
      this.osc1.connect(oscGain1);
      oscGain1.connect(this.filter);

      const oscGain2 = this.ctx.createGain();
      oscGain2.gain.setValueAtTime(0.35, this.ctx.currentTime);
      this.osc2.connect(oscGain2);
      oscGain2.connect(this.filter);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      this.subOsc.connect(subGain);
      subGain.connect(this.filter);

      this.osc1.start();
      this.osc2.start();
      this.subOsc.start();

      // Tire screech noise generator
      this.setupTireNoise();

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioContext initialization failed or blocked:', e);
    }
  }

  private setupTireNoise() {
    if (!this.ctx || !this.masterGain) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1200, this.ctx.currentTime);
      bandpass.Q.setValueAtTime(4.0, this.ctx.currentTime);

      this.tireGain = this.ctx.createGain();
      this.tireGain.gain.setValueAtTime(0, this.ctx.currentTime);

      whiteNoise.connect(bandpass);
      bandpass.connect(this.tireGain);
      this.tireGain.connect(this.masterGain);

      whiteNoise.start();
      this.tireNoiseNode = whiteNoise;
    } catch {
      // Noise buffer not critical
    }
  }

  public update(speed: number, maxSpeed: number, isAccelerating: boolean, isBraking: boolean, isDrifting: boolean) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    const normalizedSpeed = Math.min(Math.max(Math.abs(speed) / maxSpeed, 0), 1);
    
    // Virtual 6-speed automatic gearbox simulation
    const gearRatio = (normalizedSpeed * 5) % 1;
    const baseFreq = 48 + gearRatio * 95 + (isAccelerating ? 25 : 0);
    this.targetFreq = Math.min(260, Math.max(45, baseFreq));

    // Smooth frequency interpolation
    this.currentFreq += (this.targetFreq - this.currentFreq) * 0.15;

    const now = this.ctx.currentTime;
    if (this.osc1 && this.osc2 && this.subOsc && this.filter) {
      this.osc1.frequency.setValueAtTime(this.currentFreq, now);
      this.osc2.frequency.setValueAtTime(this.currentFreq * 1.5, now);
      this.subOsc.frequency.setValueAtTime(this.currentFreq * 0.5, now);

      // Modulate filter cutoff with speed & throttle
      const targetFilter = 280 + normalizedSpeed * 750 + (isAccelerating ? 300 : 0);
      this.filter.frequency.setTargetAtTime(targetFilter, now, 0.05);
    }

    // Tire squeal gain
    if (this.tireGain) {
      const tireVolume = (isDrifting || (isBraking && normalizedSpeed > 0.3)) ? 0.28 : 0;
      this.tireGain.gain.setTargetAtTime(tireVolume, now, 0.08);
    }
  }

  public playChime(freq = 587.33) {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.36);
    } catch {
      // ignore
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.18, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public stop() {
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.suspend();
      } catch {
        // ignore
      }
    }
  }
}

export const engineAudio = new EngineAudioSystem();
