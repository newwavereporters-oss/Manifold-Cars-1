// Web Audio API Procedural Engine Sound & Cockpit Audio System for MANIFOLD WORLD
// Zero external audio files required — low latency, resilient, dynamic RPM modulation,
// acceleration load harmonics, turbo blow-off flutter, exhaust pops, dual-tone horn,
// turn signal relay clicks, and synthesized in-car infotainment radio.

export type EngineVehicleType = 'SPORTS_COUPE' | 'LUXURY_SUV' | 'EXECUTIVE_SEDAN' | 'RUGGED_4X4';
export type AudioDriveMode = 'COMFORT' | 'SPORT' | 'TRACK' | 'ECO' | 'DRIFT';

class EngineAudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;
  private isEngineRunning: boolean = true;

  // Master Gain & Distortion Bus
  private masterGain: GainNode | null = null;
  private engineBus: GainNode | null = null;
  private loadGain: GainNode | null = null;
  private distortionNode: WaveShaperNode | null = null;

  // Oscillators for combustion synthesis
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private oscTurbo: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;

  // Filtering
  private filter: BiquadFilterNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;

  // Tire noise
  private tireNoiseNode: AudioBufferSourceNode | null = null;
  private tireGain: GainNode | null = null;

  // Horn nodes
  private hornGain: GainNode | null = null;
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private isHornPlaying: boolean = false;

  // Engine state tracking
  private targetFreq: number = 55;
  private currentFreq: number = 55;
  private lastThrottleState: boolean = false;
  private lastRpmRatio: number = 0;
  private lastPopTime: number = 0;

  // Infotainment Synthesizer Radio
  private radioStation: number = 0; // 0 = off, 1 = Synthwave, 2 = Cyber Lo-Fi, 3 = Apex Adrenaline
  private radioGain: GainNode | null = null;
  private radioInterval: number | null = null;
  private radioStep: number = 0;

  constructor() {
    // Automatically hook window interactions to unlock Web Audio API on first tap/click/key
    if (typeof window !== 'undefined') {
      const unlockAudio = () => {
        this.init();
        window.removeEventListener('pointerdown', unlockAudio);
        window.removeEventListener('keydown', unlockAudio);
        window.removeEventListener('touchstart', unlockAudio);
      };
      window.addEventListener('pointerdown', unlockAudio, { passive: true });
      window.addEventListener('keydown', unlockAudio, { passive: true });
      window.addEventListener('touchstart', unlockAudio, { passive: true });
    }
  }

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.22, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      // Engine Bus with Overdrive Waveshaper for Throttle Load Roar
      this.engineBus = this.ctx.createGain();
      this.engineBus.gain.setValueAtTime(1.0, this.ctx.currentTime);

      this.loadGain = this.ctx.createGain();
      this.loadGain.gain.setValueAtTime(0.7, this.ctx.currentTime);

      this.distortionNode = this.createDistortionCurve(18);

      // Lowpass resonant filter for engine warmth and tone
      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(340, this.ctx.currentTime);
      this.filter.Q.setValueAtTime(3.2, this.ctx.currentTime);

      // Secondary exhaust resonance filter
      this.exhaustFilter = this.ctx.createBiquadFilter();
      this.exhaustFilter.type = 'peaking';
      this.exhaustFilter.frequency.setValueAtTime(160, this.ctx.currentTime);
      this.exhaustFilter.gain.setValueAtTime(4.0, this.ctx.currentTime);
      this.exhaustFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      // Connect: Engine Bus -> Distortion -> Filter -> ExhaustFilter -> MasterGain
      this.engineBus.connect(this.distortionNode);
      this.distortionNode.connect(this.filter);
      this.filter.connect(this.exhaustFilter);
      this.exhaustFilter.connect(this.masterGain);

      // Primary combustion oscillator (Sawtooth for sharp mechanical cylinders)
      this.oscPrimary = this.ctx.createOscillator();
      this.oscPrimary.type = 'sawtooth';
      this.oscPrimary.frequency.setValueAtTime(55, this.ctx.currentTime);

      // Secondary harmonic oscillator (Triangle/Square mix)
      this.oscHarmonic = this.ctx.createOscillator();
      this.oscHarmonic.type = 'triangle';
      this.oscHarmonic.frequency.setValueAtTime(110, this.ctx.currentTime);

      // Sub-bass oscillator (Sine for deep chassis vibration)
      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = 'sine';
      this.oscSub.frequency.setValueAtTime(27.5, this.ctx.currentTime);

      // Turbo spool oscillator (High-frequency whistle under boost)
      this.oscTurbo = this.ctx.createOscillator();
      this.oscTurbo.type = 'sine';
      this.oscTurbo.frequency.setValueAtTime(1400, this.ctx.currentTime);
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.setValueAtTime(0, this.ctx.currentTime);
      this.oscTurbo.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);

      // Connect oscillators to engine bus
      const primaryGain = this.ctx.createGain();
      primaryGain.gain.setValueAtTime(0.55, this.ctx.currentTime);
      this.oscPrimary.connect(primaryGain);
      primaryGain.connect(this.engineBus);

      const harmonicGain = this.ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.38, this.ctx.currentTime);
      this.oscHarmonic.connect(harmonicGain);
      harmonicGain.connect(this.engineBus);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.48, this.ctx.currentTime);
      this.oscSub.connect(subGain);
      subGain.connect(this.engineBus);

      this.oscPrimary.start();
      this.oscHarmonic.start();
      this.oscSub.start();
      this.oscTurbo.start();

      // Tire screech noise generator
      this.setupTireNoise();

      // Radio Bus setup
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      this.radioGain.connect(this.masterGain);

      this.isInitialized = true;
    } catch (e) {
      console.warn('AudioContext initialization failed or blocked:', e);
    }
  }

  private createDistortionCurve(amount = 20): WaveShaperNode {
    if (!this.ctx) throw new Error('No AudioContext');
    const shaper = this.ctx.createWaveShaper();
    const k = amount;
    const nSamples = 44100;
    const curve = new Float32Array(nSamples);
    const deg = Math.PI / 180;
    for (let i = 0; i < nSamples; ++i) {
      const x = (i * 2) / nSamples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    shaper.curve = curve;
    shaper.oversample = '4x';
    return shaper;
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
      bandpass.frequency.setValueAtTime(1100, this.ctx.currentTime);
      bandpass.Q.setValueAtTime(3.5, this.ctx.currentTime);

      this.tireGain = this.ctx.createGain();
      this.tireGain.gain.setValueAtTime(0, this.ctx.currentTime);

      whiteNoise.connect(bandpass);
      bandpass.connect(this.tireGain);
      this.tireGain.connect(this.masterGain);

      whiteNoise.start();
      this.tireNoiseNode = whiteNoise;
    } catch {
      // Noise buffer non-fatal
    }
  }

  /**
   * Updates engine acoustic state based on physical telemetry, throttle, and vehicle class
   */
  public update(
    speed: number,
    maxSpeed: number,
    isAccelerating: boolean,
    isBraking: boolean,
    isDrifting: boolean,
    driveMode: AudioDriveMode = 'SPORT',
    vehicleType: EngineVehicleType = 'SPORTS_COUPE'
  ) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    if (!this.isEngineRunning) {
      if (this.engineBus) {
        this.engineBus.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      }
      return;
    }

    const now = this.ctx.currentTime;
    const normalizedSpeed = Math.min(Math.max(Math.abs(speed) / maxSpeed, 0), 1);

    // Profile Modifiers
    let basePitch = 52;
    let gearMultiplier = 110;
    let filterBase = 320;
    let turboIntensity = 0;

    switch (vehicleType) {
      case 'SPORTS_COUPE': // High-revving Twin-Turbo V8
        basePitch = 58;
        gearMultiplier = 135;
        filterBase = 380;
        turboIntensity = 0.08;
        break;
      case 'LUXURY_SUV': // Deep V8 Rumble
        basePitch = 44;
        gearMultiplier = 95;
        filterBase = 280;
        turboIntensity = 0.04;
        break;
      case 'EXECUTIVE_SEDAN': // Smooth Straight-6 Turbine
        basePitch = 50;
        gearMultiplier = 115;
        filterBase = 340;
        turboIntensity = 0.03;
        break;
      case 'RUGGED_4X4': // Heavy Diesel Torque Growl
        basePitch = 38;
        gearMultiplier = 85;
        filterBase = 250;
        turboIntensity = 0.05;
        break;
    }

    // Drive Mode Pitch & Aggression Multiplier
    let driveModeFreqBoost = 0;
    let driveModeFilterBoost = 0;
    if (driveMode === 'TRACK') {
      driveModeFreqBoost = 22;
      driveModeFilterBoost = 240;
    } else if (driveMode === 'SPORT' || driveMode === 'DRIFT') {
      driveModeFreqBoost = 12;
      driveModeFilterBoost = 120;
    } else if (driveMode === 'ECO') {
      driveModeFreqBoost = -8;
      driveModeFilterBoost = -80;
    }

    // Virtual 6-Speed Transmission Gear Calculation
    // Gears transition across speed ratios: 0-0.18 (G1), 0.18-0.36 (G2), 0.36-0.55 (G3), 0.55-0.75 (G4), 0.75-0.92 (G5), 0.92-1.0 (G6)
    const gearFraction = (normalizedSpeed * 5.2) % 1;
    const throttlePitch = isAccelerating ? 28 : 0;
    const targetBaseFreq = basePitch + driveModeFreqBoost + gearFraction * gearMultiplier + throttlePitch;
    this.targetFreq = Math.min(360, Math.max(38, targetBaseFreq));

    // Smooth frequency interpolation
    this.currentFreq += (this.targetFreq - this.currentFreq) * 0.22;

    if (this.oscPrimary && this.oscHarmonic && this.oscSub && this.filter && this.engineBus) {
      this.oscPrimary.frequency.setTargetAtTime(this.currentFreq, now, 0.03);
      this.oscHarmonic.frequency.setTargetAtTime(this.currentFreq * 1.5, now, 0.03);
      this.oscSub.frequency.setTargetAtTime(this.currentFreq * 0.5, now, 0.04);

      // Volume and filter response: louder and brighter under throttle acceleration
      const targetVolume = isAccelerating ? 0.95 : 0.65;
      this.engineBus.gain.setTargetAtTime(targetVolume, now, 0.05);

      const targetFilter =
        filterBase +
        driveModeFilterBoost +
        normalizedSpeed * 950 +
        (isAccelerating ? 450 : 0);
      this.filter.frequency.setTargetAtTime(targetFilter, now, 0.04);
    }

    // Turbo Spool Whistle: builds with throttle & speed
    if (this.oscTurbo && this.turboGain) {
      if (isAccelerating && turboIntensity > 0) {
        const turboFreq = 1200 + normalizedSpeed * 2800;
        this.oscTurbo.frequency.setTargetAtTime(turboFreq, now, 0.08);
        this.turboGain.gain.setTargetAtTime(turboIntensity, now, 0.1);
      } else {
        this.turboGain.gain.setTargetAtTime(0, now, 0.15);
      }
    }

    // Throttle Lift-Off: Exhaust Pop & Blow-Off Flutter
    if (this.lastThrottleState && !isAccelerating && normalizedSpeed > 0.3) {
      const timeSinceLastPop = performance.now() - this.lastPopTime;
      if (timeSinceLastPop > 400) {
        this.triggerExhaustPop();
        this.lastPopTime = performance.now();
      }
    }
    this.lastThrottleState = isAccelerating;
    this.lastRpmRatio = normalizedSpeed;

    // Tire Squeal Gain
    if (this.tireGain) {
      const tireVolume =
        isDrifting || (isBraking && normalizedSpeed > 0.25)
          ? isDrifting
            ? 0.35
            : 0.24
          : 0;
      this.tireGain.gain.setTargetAtTime(tireVolume, now, 0.06);
    }
  }

  /**
   * Generates realistic off-throttle exhaust crackles and blow-off valve flutter
   */
  public triggerExhaustPop() {
    if (!this.ctx || this.isMuted || !this.isEngineRunning) return;
    try {
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      popOsc.type = 'sawtooth';
      popOsc.frequency.setValueAtTime(140 + Math.random() * 80, this.ctx.currentTime);
      popOsc.frequency.exponentialRampToValueAtTime(35, this.ctx.currentTime + 0.09);

      popGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      popGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.11);

      popOsc.connect(popGain);
      if (this.masterGain) {
        popGain.connect(this.masterGain);
      }
      popOsc.start();
      popOsc.stop(this.ctx.currentTime + 0.12);

      // Follow-up baby crackle
      setTimeout(() => {
        if (!this.ctx || this.isMuted) return;
        try {
          const secondOsc = this.ctx.createOscillator();
          const secondGain = this.ctx.createGain();
          secondOsc.type = 'triangle';
          secondOsc.frequency.setValueAtTime(95 + Math.random() * 50, this.ctx.currentTime);
          secondGain.gain.setValueAtTime(0.14, this.ctx.currentTime);
          secondGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.07);
          secondOsc.connect(secondGain);
          if (this.masterGain) secondGain.connect(this.masterGain);
          secondOsc.start();
          secondOsc.stop(this.ctx.currentTime + 0.08);
        } catch {}
      }, 75);
    } catch {
      // non-critical
    }
  }

  /**
   * Push-to-Start Engine sound effect: starter motor crank followed by glorious roar
   */
  public playIgnitionSound(onComplete?: () => void) {
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Starter motor rapid pulses
      const starterOsc = this.ctx.createOscillator();
      const starterGain = this.ctx.createGain();
      starterOsc.type = 'sawtooth';
      starterOsc.frequency.setValueAtTime(32, now);
      starterGain.gain.setValueAtTime(0.18, now);
      starterGain.gain.exponentialRampToValueAtTime(0.01, now + 0.55);

      starterOsc.connect(starterGain);
      if (this.masterGain) starterGain.connect(this.masterGain);
      starterOsc.start(now);
      starterOsc.stop(now + 0.56);

      // Startup Vroom Roar
      setTimeout(() => {
        if (!this.ctx || this.isMuted) return;
        try {
          const roarOsc = this.ctx.createOscillator();
          const roarGain = this.ctx.createGain();
          roarOsc.type = 'sawtooth';
          roarOsc.frequency.setValueAtTime(90, this.ctx.currentTime);
          roarOsc.frequency.exponentialRampToValueAtTime(220, this.ctx.currentTime + 0.3);
          roarOsc.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.85);

          roarGain.gain.setValueAtTime(0.28, this.ctx.currentTime);
          roarGain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.88);

          roarOsc.connect(roarGain);
          if (this.masterGain) roarGain.connect(this.masterGain);
          roarOsc.start();
          roarOsc.stop(this.ctx.currentTime + 0.9);

          this.isEngineRunning = true;
          onComplete?.();
        } catch {}
      }, 350);
    } catch {}
  }

  /**
   * Engine Stop spindown whine
   */
  public playShutdownSound() {
    this.init();
    if (!this.ctx) return;
    try {
      const shutOsc = this.ctx.createOscillator();
      const shutGain = this.ctx.createGain();
      shutOsc.type = 'triangle';
      shutOsc.frequency.setValueAtTime(75, this.ctx.currentTime);
      shutOsc.frequency.exponentialRampToValueAtTime(15, this.ctx.currentTime + 0.6);

      shutGain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      shutGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.65);

      shutOsc.connect(shutGain);
      if (this.masterGain) shutGain.connect(this.masterGain);
      shutOsc.start();
      shutOsc.stop(this.ctx.currentTime + 0.66);
      this.isEngineRunning = false;
    } catch {}
  }

  /**
   * Dual-tone Polyphonic Automotive Horn (440 Hz + 554 Hz / A4 + C#5)
   */
  public playHorn(active: boolean) {
    this.init();
    if (!this.ctx) return;

    if (active && !this.isHornPlaying) {
      try {
        const now = this.ctx.currentTime;
        this.hornGain = this.ctx.createGain();
        this.hornGain.gain.setValueAtTime(this.isMuted ? 0 : 0.32, now);

        this.hornOsc1 = this.ctx.createOscillator();
        this.hornOsc1.type = 'sawtooth';
        this.hornOsc1.frequency.setValueAtTime(440, now); // Low tone

        this.hornOsc2 = this.ctx.createOscillator();
        this.hornOsc2.type = 'triangle';
        this.hornOsc2.frequency.setValueAtTime(554.37, now); // Major third high tone

        this.hornOsc1.connect(this.hornGain);
        this.hornOsc2.connect(this.hornGain);
        this.hornGain.connect(this.masterGain || this.ctx.destination);

        this.hornOsc1.start();
        this.hornOsc2.start();
        this.isHornPlaying = true;
      } catch {}
    } else if (!active && this.isHornPlaying) {
      if (this.hornGain && this.ctx) {
        this.hornGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.04);
        setTimeout(() => {
          try {
            this.hornOsc1?.stop();
            this.hornOsc2?.stop();
            this.hornOsc1?.disconnect();
            this.hornOsc2?.disconnect();
          } catch {}
          this.isHornPlaying = false;
        }, 60);
      } else {
        this.isHornPlaying = false;
      }
    }
  }

  /**
   * Automotive Turn Signal Relay Clicker (Crisp ticking rhythm)
   */
  public playTurnSignalClick(step: 'on' | 'off' = 'on') {
    this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(step === 'on' ? 1250 : 850, this.ctx.currentTime);
      clickGain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.035);

      clickOsc.connect(clickGain);
      clickGain.connect(this.masterGain || this.ctx.destination);
      clickOsc.start();
      clickOsc.stop(this.ctx.currentTime + 0.04);
    } catch {}
  }

  /**
   * In-Car Infotainment Synthesizer Radio Station
   * 0: Off, 1: Synthwave Midnight, 2: Cyber Lo-Fi, 3: Apex Track FM
   */
  public setRadioStation(station: number) {
    this.init();
    this.radioStation = station;
    if (this.radioInterval) {
      clearInterval(this.radioInterval);
      this.radioInterval = null;
    }

    if (station === 0 || !this.ctx || this.isMuted) return;

    // Procedural Synth Sequencer for in-car cockpit immersion
    const synthNotes: Record<number, number[]> = {
      1: [220, 261.63, 329.63, 392, 440, 523.25, 440, 329.63], // Synthwave A-minor
      2: [174.61, 220, 261.63, 349.23, 261.63, 220, 196, 246.94], // Lo-Fi F-maj7 chill
      3: [146.83, 196, 220, 293.66, 392, 440, 392, 293.66], // Apex D-minor pump
    };

    const notes = synthNotes[station] || synthNotes[1];
    const tempoMs = station === 2 ? 380 : station === 3 ? 190 : 260;

    this.radioInterval = window.setInterval(() => {
      if (!this.ctx || this.isMuted || this.radioStation === 0) return;
      try {
        const noteFreq = notes[this.radioStep % notes.length];
        this.radioStep++;

        const noteOsc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        noteOsc.type = station === 2 ? 'sine' : 'sawtooth';
        noteOsc.frequency.setValueAtTime(noteFreq, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(station === 2 ? 450 : 800, this.ctx.currentTime);

        noteGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + (tempoMs / 1000) * 0.9);

        noteOsc.connect(filter);
        filter.connect(noteGain);
        if (this.radioGain) {
          noteGain.connect(this.radioGain);
        }

        noteOsc.start();
        noteOsc.stop(this.ctx.currentTime + tempoMs / 1000);
      } catch {}
    }, tempoMs);
  }

  public getRadioStation(): number {
    return this.radioStation;
  }

  public setRadioVolume(volume: number) {
    if (this.radioGain && this.ctx) {
      this.radioGain.gain.setTargetAtTime(Math.max(0, Math.min(1, volume)) * 0.15, this.ctx.currentTime, 0.05);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.22, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setEngineRunning(running: boolean) {
    if (running && !this.isEngineRunning) {
      this.playIgnitionSound();
    } else if (!running && this.isEngineRunning) {
      this.playShutdownSound();
    }
  }

  public getEngineRunning(): boolean {
    return this.isEngineRunning;
  }

  public stop() {
    if (this.radioInterval) {
      clearInterval(this.radioInterval);
      this.radioInterval = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      try {
        this.ctx.suspend();
      } catch {}
    }
  }
}

export const engineAudio = new EngineAudioSystem();
