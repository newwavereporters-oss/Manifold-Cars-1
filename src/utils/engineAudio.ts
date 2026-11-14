// Web Audio API Procedural Vehicle Sound & Infotainment Engine for MANIFOLD CARS 3D
// Zero external audio asset dependencies — low-latency layered procedural synthesis:
//   - Multi-cylinder engine idle thrum, RPM gear sweeps, throttle induction & exhaust resonance
//   - Speed-gated hydraulic brake pad friction & high-speed deceleration rumble (silent at rest)
//   - Tyre rolling hum, bridge surface texture, cornering scrub & drift squeal
//   - Dual-tone automotive horn, turn signal relay clicks & synthesized radio stations

export type EngineVehicleType = 'SPORTS_COUPE' | 'LUXURY_SUV' | 'EXECUTIVE_SEDAN' | 'RUGGED_4X4';
export type AudioDriveMode = 'COMFORT' | 'SPORT' | 'TRACK' | 'ECO' | 'DRIFT';

export type EngineTransmissionGear = 'P' | 'D0' | 'D2' | 'D1' | 'R';

export interface EngineAudioUpdateOptions {
  steerRatio?: number; // 0..1 steering intensity for cornering tyre scrub
  onBridge?: boolean; // Elevated bridge deck expansion texture
  brakeIntensity?: number; // 0..1 braking load
  transmissionGear?: EngineTransmissionGear;
}

class EngineAudioSystem {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private masterVolume: number = 0.78;
  private isInitialized: boolean = false;
  private noiseSetupDone: boolean = false;
  private isEngineRunning: boolean = true;

  // Master Gain & Distortion Bus
  private masterGain: GainNode | null = null;
  private engineBus: GainNode | null = null;
  private distortionNode: WaveShaperNode | null = null;

  // Oscillators for multi-cylinder combustion synthesis
  private oscPrimary: OscillatorNode | null = null;
  private oscHarmonic: OscillatorNode | null = null;
  private oscSub: OscillatorNode | null = null;
  private oscTurbo: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;
  private oscIdlePulse: OscillatorNode | null = null;
  private idlePulseGain: GainNode | null = null;

  // Filtering
  private filter: BiquadFilterNode | null = null;
  private exhaustFilter: BiquadFilterNode | null = null;

  // Shared procedural noise source -> separate road, intake, brake & tyre buses
  private sharedNoiseSource: AudioBufferSourceNode | null = null;
  private roadFilter: BiquadFilterNode | null = null;
  private roadGain: GainNode | null = null;
  private intakeFilter: BiquadFilterNode | null = null;
  private intakeGain: GainNode | null = null;
  private brakeFilter: BiquadFilterNode | null = null;
  private brakeGain: GainNode | null = null;
  private scrubFilter: BiquadFilterNode | null = null;
  private scrubGain: GainNode | null = null;
  private tireFilter: BiquadFilterNode | null = null;
  private tireGain: GainNode | null = null;

  // Horn nodes
  private hornGain: GainNode | null = null;
  private hornOsc1: OscillatorNode | null = null;
  private hornOsc2: OscillatorNode | null = null;
  private isHornPlaying: boolean = false;

  // Engine state tracking
  private targetFreq: number = 52;
  private currentFreq: number = 52;
  private lastThrottleState: boolean = false;
  private lastPopTime: number = 0;
  private wasBrakingAtSpeed: boolean = false;
  private lastBrakeBiteTime: number = 0;
  private lastSpeed: number = 0;
  private bridgePhase: number = 0;

  // Infotainment Synthesizer Radio
  private radioStation: number = 0;
  private radioVolume: number = 0.7;
  private radioGain: GainNode | null = null;
  private radioInterval: number | null = null;
  private radioStep: number = 0;

  constructor() {
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

      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) {
          this.silenceDrivingBuses();
          if (this.ctx.state === 'running') {
            this.ctx.suspend().catch(() => {});
          }
        } else if (!this.isMuted && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
        }
      });
    }
  }

  private effectiveMasterGainValue(): number {
    return this.isMuted ? 0 : Math.max(0, Math.min(1, this.masterVolume)) * 0.25;
  }

  public init() {
    if (this.isInitialized && this.ctx) {
      if (this.ctx.state === 'suspended' && (typeof document === 'undefined' || !document.hidden)) {
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

      const now = this.ctx.currentTime;

      // Master Gain
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.effectiveMasterGainValue(), now);
      this.masterGain.connect(this.ctx.destination);

      // Engine Bus -> Soft Saturation -> Induction Lowpass -> Exhaust Resonance -> Master
      this.engineBus = this.ctx.createGain();
      this.engineBus.gain.setValueAtTime(this.isEngineRunning ? 0.55 : 0.0001, now);

      this.distortionNode = this.createDistortionCurve(14);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(280, now);
      this.filter.Q.setValueAtTime(2.6, now);

      this.exhaustFilter = this.ctx.createBiquadFilter();
      this.exhaustFilter.type = 'peaking';
      this.exhaustFilter.frequency.setValueAtTime(145, now);
      this.exhaustFilter.gain.setValueAtTime(4.5, now);
      this.exhaustFilter.Q.setValueAtTime(1.8, now);

      this.engineBus.connect(this.distortionNode);
      this.distortionNode.connect(this.filter);
      this.filter.connect(this.exhaustFilter);
      this.exhaustFilter.connect(this.masterGain);

      // Primary combustion sawtooth
      this.oscPrimary = this.ctx.createOscillator();
      this.oscPrimary.type = 'sawtooth';
      this.oscPrimary.frequency.setValueAtTime(52, now);

      // Harmonic triangle
      this.oscHarmonic = this.ctx.createOscillator();
      this.oscHarmonic.type = 'triangle';
      this.oscHarmonic.frequency.setValueAtTime(78, now);

      // Deep chassis sub-bass
      this.oscSub = this.ctx.createOscillator();
      this.oscSub.type = 'sine';
      this.oscSub.frequency.setValueAtTime(26, now);

      // Idle cylinder firing pulse LFO (subtle mechanical lope at idle)
      this.oscIdlePulse = this.ctx.createOscillator();
      this.oscIdlePulse.type = 'sine';
      this.oscIdlePulse.frequency.setValueAtTime(14, now);
      this.idlePulseGain = this.ctx.createGain();
      this.idlePulseGain.gain.setValueAtTime(18, now);
      this.oscIdlePulse.connect(this.idlePulseGain);
      this.idlePulseGain.connect(this.filter.frequency);

      // Turbo induction whistle (builds cleanly under throttle boost)
      this.oscTurbo = this.ctx.createOscillator();
      this.oscTurbo.type = 'sine';
      this.oscTurbo.frequency.setValueAtTime(1350, now);
      this.turboGain = this.ctx.createGain();
      this.turboGain.gain.setValueAtTime(0, now);
      this.oscTurbo.connect(this.turboGain);
      this.turboGain.connect(this.masterGain);

      const primaryGain = this.ctx.createGain();
      primaryGain.gain.setValueAtTime(0.48, now);
      this.oscPrimary.connect(primaryGain);
      primaryGain.connect(this.engineBus);

      const harmonicGain = this.ctx.createGain();
      harmonicGain.gain.setValueAtTime(0.36, now);
      this.oscHarmonic.connect(harmonicGain);
      harmonicGain.connect(this.engineBus);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.52, now);
      this.oscSub.connect(subGain);
      subGain.connect(this.engineBus);

      this.oscPrimary.start();
      this.oscHarmonic.start();
      this.oscSub.start();
      this.oscIdlePulse.start();
      this.oscTurbo.start();

      // Road, Intake, Brake & Tyre friction buses (single shared loop)
      this.setupLayeredNoiseBuses();

      // Radio Bus
      this.radioGain = this.ctx.createGain();
      this.radioGain.gain.setValueAtTime(this.radioVolume * 0.14, now);
      this.radioGain.connect(this.masterGain);

      this.isInitialized = true;

      // Start pending radio preference if selected prior to user gesture unlock
      if (this.radioStation > 0 && !this.radioInterval) {
        this.setRadioStation(this.radioStation);
      }
    } catch (e) {
      console.warn('AudioContext initialization failed or blocked:', e);
    }
  }

  private createDistortionCurve(amount = 14): WaveShaperNode {
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

  private setupLayeredNoiseBuses() {
    if (!this.ctx || !this.masterGain || this.noiseSetupDone) return;
    this.noiseSetupDone = true;

    try {
      const now = this.ctx.currentTime;
      const sampleRate = this.ctx.sampleRate;
      const bufferSize = sampleRate * 3;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, sampleRate);
      const output = noiseBuffer.getChannelData(0);

      // Pink-weighted filtered noise for natural asphalt, air & rubber character
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        output[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.16) * 1.4));
      }

      const noiseSrc = this.ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      noiseSrc.loop = true;

      // 1. Road & Tyre Rolling Surface Rumble (lowpass ~220Hz -> 440Hz)
      this.roadFilter = this.ctx.createBiquadFilter();
      this.roadFilter.type = 'lowpass';
      this.roadFilter.frequency.setValueAtTime(210, now);
      this.roadFilter.Q.setValueAtTime(0.8, now);
      this.roadGain = this.ctx.createGain();
      this.roadGain.gain.setValueAtTime(0, now);
      noiseSrc.connect(this.roadFilter);
      this.roadFilter.connect(this.roadGain);
      this.roadGain.connect(this.masterGain);

      // 2. Engine Air Intake Whoosh (bandpass ~750Hz -> 1850Hz under throttle)
      this.intakeFilter = this.ctx.createBiquadFilter();
      this.intakeFilter.type = 'bandpass';
      this.intakeFilter.frequency.setValueAtTime(750, now);
      this.intakeFilter.Q.setValueAtTime(1.4, now);
      this.intakeGain = this.ctx.createGain();
      this.intakeGain.gain.setValueAtTime(0, now);
      noiseSrc.connect(this.intakeFilter);
      this.intakeFilter.connect(this.intakeGain);
      this.intakeGain.connect(this.masterGain);

      // 3. Brake Pad & Caliper Friction (bandpass ~560Hz + resonant bite, silent when stopped)
      this.brakeFilter = this.ctx.createBiquadFilter();
      this.brakeFilter.type = 'bandpass';
      this.brakeFilter.frequency.setValueAtTime(560, now);
      this.brakeFilter.Q.setValueAtTime(2.4, now);
      this.brakeGain = this.ctx.createGain();
      this.brakeGain.gain.setValueAtTime(0, now);
      noiseSrc.connect(this.brakeFilter);
      this.brakeFilter.connect(this.brakeGain);
      this.brakeGain.connect(this.masterGain);

      // 4. Cornering Tyre Scrub (bandpass ~820Hz)
      this.scrubFilter = this.ctx.createBiquadFilter();
      this.scrubFilter.type = 'bandpass';
      this.scrubFilter.frequency.setValueAtTime(820, now);
      this.scrubFilter.Q.setValueAtTime(2.6, now);
      this.scrubGain = this.ctx.createGain();
      this.scrubGain.gain.setValueAtTime(0, now);
      noiseSrc.connect(this.scrubFilter);
      this.scrubFilter.connect(this.scrubGain);
      this.scrubGain.connect(this.masterGain);

      // 5. Drift / Hard Lockup Tyre Squeal (focused ~1380Hz)
      this.tireFilter = this.ctx.createBiquadFilter();
      this.tireFilter.type = 'bandpass';
      this.tireFilter.frequency.setValueAtTime(1380, now);
      this.tireFilter.Q.setValueAtTime(4.8, now);
      this.tireGain = this.ctx.createGain();
      this.tireGain.gain.setValueAtTime(0, now);
      noiseSrc.connect(this.tireFilter);
      this.tireFilter.connect(this.tireGain);
      this.tireGain.connect(this.masterGain);

      noiseSrc.start();
      this.sharedNoiseSource = noiseSrc;
    } catch {
      this.noiseSetupDone = false;
    }
  }

  private silenceDrivingBuses() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.engineBus?.gain.setTargetAtTime(0.0001, now, 0.04);
    this.turboGain?.gain.setTargetAtTime(0, now, 0.04);
    this.intakeGain?.gain.setTargetAtTime(0, now, 0.04);
    this.roadGain?.gain.setTargetAtTime(0, now, 0.04);
    this.brakeGain?.gain.setTargetAtTime(0, now, 0.04);
    this.scrubGain?.gain.setTargetAtTime(0, now, 0.04);
    this.tireGain?.gain.setTargetAtTime(0, now, 0.04);
  }

  /**
   * Subtle mechanical caliper pad engagement click/bite when braking starts at driving speed.
   */
  private triggerBrakeEngagementBite(speedRatio: number) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastBrakeBiteTime < 350) return;
    this.lastBrakeBiteTime = nowMs;

    try {
      const now = this.ctx.currentTime;
      const biteOsc = this.ctx.createOscillator();
      const biteGain = this.ctx.createGain();
      biteOsc.type = 'triangle';
      biteOsc.frequency.setValueAtTime(135 + speedRatio * 55, now);
      biteOsc.frequency.exponentialRampToValueAtTime(48, now + 0.08);
      biteGain.gain.setValueAtTime(0.06 + speedRatio * 0.06, now);
      biteGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      biteOsc.connect(biteGain);
      biteGain.connect(this.masterGain);
      biteOsc.start(now);
      biteOsc.stop(now + 0.095);
    } catch {}
  }

  /**
   * Updates engine, intake, braking friction, road roll & tyre acoustic state
   */
  public update(
    speed: number,
    maxSpeed: number,
    isAccelerating: boolean,
    isBraking: boolean,
    isDrifting: boolean,
    driveMode: AudioDriveMode = 'SPORT',
    vehicleType: EngineVehicleType = 'SPORTS_COUPE',
    options: EngineAudioUpdateOptions = {}
  ) {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const absSpeed = Math.abs(speed);
    const safeMax = Math.max(1, maxSpeed);
    const normalizedSpeed = Math.min(Math.max(absSpeed / safeMax, 0), 1);
    const steerRatio = Math.min(Math.max(options.steerRatio ?? 0, 0), 1);
    const onBridge = Boolean(options.onBridge);
    const isActuallyMoving = absSpeed > 1.25;
    const isStationary = absSpeed <= 1.25;

    // 1. Road Surface Rolling Noise (even if engine off while coasting, silent at rest)
    if (this.roadGain && this.roadFilter) {
      if (!isActuallyMoving) {
        this.roadGain.gain.setTargetAtTime(0, now, 0.05);
      } else {
        this.bridgePhase = (this.bridgePhase + absSpeed * 0.016) % (Math.PI * 2);
        const bridgePulse = onBridge ? 1 + 0.16 * Math.sin(this.bridgePhase) : 1.0;
        const roadVol = Math.min(0.24, Math.pow(normalizedSpeed, 0.85) * 0.22 * bridgePulse);
        const roadCutoff = (onBridge ? 270 : 185) + normalizedSpeed * (onBridge ? 320 : 250);
        this.roadFilter.frequency.setTargetAtTime(roadCutoff, now, 0.06);
        this.roadGain.gain.setTargetAtTime(roadVol, now, 0.06);
      }
    }

    // 2. Brake Caliper & Pad Deceleration Friction (STRICTLY gated to moving vehicle!)
    const brakingWhileMoving = isBraking && isActuallyMoving;
    if (brakingWhileMoving && !this.wasBrakingAtSpeed && normalizedSpeed > 0.14) {
      this.triggerBrakeEngagementBite(normalizedSpeed);
    }
    this.wasBrakingAtSpeed = brakingWhileMoving;

    if (this.brakeGain && this.brakeFilter) {
      if (!brakingWhileMoving) {
        this.brakeGain.gain.setTargetAtTime(0, now, 0.04);
      } else {
        const decelMag = Math.max(0.35, Math.min(1.0, (Math.abs(this.lastSpeed - absSpeed) * 3.5) + 0.35));
        const brakeIntensity = options.brakeIntensity ?? decelMag;
        const brakeVol = Math.min(0.28, (0.08 + normalizedSpeed * 0.22) * brakeIntensity);
        const brakeFreq = 460 + normalizedSpeed * 420;
        this.brakeFilter.frequency.setTargetAtTime(brakeFreq, now, 0.045);
        this.brakeGain.gain.setTargetAtTime(brakeVol, now, 0.04);
      }
    }

    // 3. Cornering Tyre Scrub & Skid Squeal (Strictly silent at rest)
    if (this.scrubGain && this.scrubFilter) {
      const cornerLoad = isActuallyMoving && !isDrifting ? steerRatio * normalizedSpeed : 0;
      if (cornerLoad > 0.16) {
        this.scrubFilter.frequency.setTargetAtTime(720 + normalizedSpeed * 380, now, 0.05);
        this.scrubGain.gain.setTargetAtTime(Math.min(0.18, cornerLoad * 0.22), now, 0.05);
      } else {
        this.scrubGain.gain.setTargetAtTime(0, now, 0.05);
      }
    }

    if (this.tireGain && this.tireFilter) {
      const hardSkidBrake = brakingWhileMoving && normalizedSpeed > 0.56;
      const activeDriftSqueal = isDrifting && absSpeed > 4.0;
      if (activeDriftSqueal || hardSkidBrake) {
        const squealVol = activeDriftSqueal
          ? Math.min(0.28, 0.14 + normalizedSpeed * 0.14)
          : Math.min(0.16, normalizedSpeed * 0.15);
        this.tireFilter.frequency.setTargetAtTime(
          activeDriftSqueal ? 1360 + steerRatio * 240 : 1220,
          now,
          0.05
        );
        this.tireGain.gain.setTargetAtTime(squealVol, now, 0.05);
      } else {
        this.tireGain.gain.setTargetAtTime(0, now, 0.045);
      }
    }

    this.lastSpeed = absSpeed;

    // 4. Engine & Induction (Zero output when ignition OFF)
    if (!this.isEngineRunning) {
      this.engineBus?.gain.setTargetAtTime(0.0001, now, 0.06);
      this.turboGain?.gain.setTargetAtTime(0, now, 0.06);
      this.intakeGain?.gain.setTargetAtTime(0, now, 0.05);
      return;
    }

    // Vehicle Engine Acoustic Character
    let idlePitch = 46;
    let gearSpan = 105;
    let harmonicRatio = 1.5;
    let filterBase = 260;
    let turboIntensity = 0;

    switch (vehicleType) {
      case 'SPORTS_COUPE':
        idlePitch = 54;
        gearSpan = 132;
        harmonicRatio = 1.5; // Flat-plane V8 snarl
        filterBase = 320;
        turboIntensity = 0.055;
        break;
      case 'LUXURY_SUV':
        idlePitch = 40;
        gearSpan = 88;
        harmonicRatio = 1.333; // Deep V8 rumble
        filterBase = 235;
        turboIntensity = 0.025;
        break;
      case 'EXECUTIVE_SEDAN':
        idlePitch = 46;
        gearSpan = 106;
        harmonicRatio = 2.0; // Refined inline-6 octave turbine
        filterBase = 275;
        turboIntensity = 0.02;
        break;
      case 'RUGGED_4X4':
        idlePitch = 35;
        gearSpan = 76;
        harmonicRatio = 1.25; // Low-end diesel/V8 torque growl
        filterBase = 205;
        turboIntensity = 0.035;
        break;
    }

    let modeFreqBoost = 0;
    let modeFilterBoost = 0;
    if (driveMode === 'TRACK') {
      modeFreqBoost = 18;
      modeFilterBoost = 220;
    } else if (driveMode === 'SPORT' || driveMode === 'DRIFT') {
      modeFreqBoost = 10;
      modeFilterBoost = 110;
    } else if (driveMode === 'ECO') {
      modeFreqBoost = -7;
      modeFilterBoost = -70;
    }

    const gear = options.transmissionGear || 'D2';
    const gearFreqFactor =
      gear === 'P' ? 0.88 : gear === 'R' ? 0.94 : gear === 'D0' ? 0.84 : gear === 'D2' ? 0.96 : 1.08;
    const gearFilterBoost =
      gear === 'D1' ? 140 : gear === 'D2' ? 20 : gear === 'D0' ? -55 : gear === 'R' ? -20 : -80;

    // Smooth 6-speed virtual gear sweep
    const gearThresholds = [0, 0.16, 0.33, 0.51, 0.69, 0.86, 1.0];
    let gearIdx = 0;
    for (let i = 0; i < 6; i++) {
      if (normalizedSpeed >= gearThresholds[i]) gearIdx = i;
    }
    const gStart = gearThresholds[gearIdx];
    const gEnd = gearThresholds[gearIdx + 1];
    const gearLocal = Math.min(1, Math.max(0, (normalizedSpeed - gStart) / Math.max(0.05, gEnd - gStart)));

    // Stationary idle vs driving RPM progression (P stays at composed idle)
    const effectiveAccel = gear === 'P' ? false : isAccelerating;
    const throttleBoost = effectiveAccel ? (gear === 'D1' ? 26 : 19) + normalizedSpeed * 12 : 0;
    const revFloor = isStationary
      ? idlePitch
      : idlePitch + (gear === 'R' ? 22 : gearIdx * 9 + gearLocal * gearSpan * gearFreqFactor);
    const targetBaseFreq = revFloor + (isStationary ? 0 : modeFreqBoost + gearFilterBoost * 0.06) + throttleBoost;
    this.targetFreq = Math.min(340, Math.max(32, targetBaseFreq));

    // Smooth deceleration coastdown vs brisk throttle spool
    const freqLerp = effectiveAccel ? 0.22 : 0.12;
    this.currentFreq += (this.targetFreq - this.currentFreq) * freqLerp;

    if (this.oscPrimary && this.oscHarmonic && this.oscSub && this.filter && this.engineBus) {
      this.oscPrimary.frequency.setTargetAtTime(this.currentFreq, now, 0.035);
      this.oscHarmonic.frequency.setTargetAtTime(this.currentFreq * harmonicRatio, now, 0.035);
      this.oscSub.frequency.setTargetAtTime(this.currentFreq * 0.5, now, 0.045);

      // Warm idle pulse that fades gently as speed climbs
      if (this.oscIdlePulse && this.idlePulseGain) {
        this.oscIdlePulse.frequency.setTargetAtTime(12 + normalizedSpeed * 14, now, 0.08);
        this.idlePulseGain.gain.setTargetAtTime(isStationary ? 24 : 8, now, 0.08);
      }

      // Dynamic engine gain: subtle composed idle, rich load under acceleration
      const targetEngineGain = isStationary
        ? isAccelerating
          ? 0.58
          : 0.34
        : isAccelerating
        ? 0.88
        : 0.52;
      this.engineBus.gain.setTargetAtTime(targetEngineGain, now, 0.05);

      const targetFilter =
        filterBase +
        (isStationary ? 0 : modeFilterBoost) +
        normalizedSpeed * 860 +
        (isAccelerating ? 420 : 0);
      this.filter.frequency.setTargetAtTime(Math.max(150, targetFilter), now, 0.045);
    }

    // Intake air rush under throttle load
    if (this.intakeGain && this.intakeFilter) {
      if (isAccelerating) {
        this.intakeFilter.frequency.setTargetAtTime(680 + normalizedSpeed * 1150, now, 0.06);
        this.intakeGain.gain.setTargetAtTime(0.045 + normalizedSpeed * 0.065, now, 0.06);
      } else {
        this.intakeGain.gain.setTargetAtTime(0, now, 0.06);
      }
    }

    // Turbo spool whistle under boost
    if (this.oscTurbo && this.turboGain) {
      if (isAccelerating && turboIntensity > 0 && normalizedSpeed > 0.12) {
        const turboFreq = 1250 + normalizedSpeed * 2600;
        this.oscTurbo.frequency.setTargetAtTime(turboFreq, now, 0.08);
        this.turboGain.gain.setTargetAtTime(turboIntensity * (0.5 + normalizedSpeed * 0.6), now, 0.1);
      } else {
        this.turboGain.gain.setTargetAtTime(0, now, 0.14);
      }
    }

    // Throttle Lift-Off: Exhaust overrun crackle when easing off throttle at speed
    if (this.lastThrottleState && !isAccelerating && normalizedSpeed > 0.32) {
      const timeSinceLastPop = performance.now() - this.lastPopTime;
      if (timeSinceLastPop > 480) {
        this.triggerExhaustPop();
        this.lastPopTime = performance.now();
      }
    }
    this.lastThrottleState = isAccelerating;
  }

  /**
   * Generates off-throttle exhaust crackles & blow-off flutter
   */
  public triggerExhaustPop() {
    if (!this.ctx || this.isMuted || !this.isEngineRunning) return;
    try {
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      popOsc.type = 'sawtooth';
      popOsc.frequency.setValueAtTime(130 + Math.random() * 65, this.ctx.currentTime);
      popOsc.frequency.exponentialRampToValueAtTime(34, this.ctx.currentTime + 0.085);

      popGain.gain.setValueAtTime(0.16, this.ctx.currentTime);
      popGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.1);

      popOsc.connect(popGain);
      if (this.masterGain) popGain.connect(this.masterGain);
      popOsc.start();
      popOsc.stop(this.ctx.currentTime + 0.11);

      setTimeout(() => {
        if (!this.ctx || this.isMuted || !this.isEngineRunning) return;
        try {
          const secondOsc = this.ctx.createOscillator();
          const secondGain = this.ctx.createGain();
          secondOsc.type = 'triangle';
          secondOsc.frequency.setValueAtTime(88 + Math.random() * 42, this.ctx.currentTime);
          secondGain.gain.setValueAtTime(0.1, this.ctx.currentTime);
          secondGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.065);
          secondOsc.connect(secondGain);
          if (this.masterGain) secondGain.connect(this.masterGain);
          secondOsc.start();
          secondOsc.stop(this.ctx.currentTime + 0.07);
        } catch {}
      }, 75);
    } catch {}
  }

  /**
   * Push-to-Start Engine crank & ignition bark
   */
  public playIgnitionSound(onComplete?: () => void) {
    this.init();
    this.isEngineRunning = true;
    if (!this.ctx) {
      onComplete?.();
      return;
    }
    try {
      const now = this.ctx.currentTime;
      const starterOsc = this.ctx.createOscillator();
      const starterGain = this.ctx.createGain();
      starterOsc.type = 'sawtooth';
      starterOsc.frequency.setValueAtTime(32, now);
      starterGain.gain.setValueAtTime(0.14, now);
      starterGain.gain.exponentialRampToValueAtTime(0.005, now + 0.45);

      starterOsc.connect(starterGain);
      if (this.masterGain) starterGain.connect(this.masterGain);
      starterOsc.start(now);
      starterOsc.stop(now + 0.46);

      setTimeout(() => {
        if (!this.ctx || this.isMuted) {
          onComplete?.();
          return;
        }
        try {
          const roarOsc = this.ctx.createOscillator();
          const roarGain = this.ctx.createGain();
          roarOsc.type = 'sawtooth';
          roarOsc.frequency.setValueAtTime(86, this.ctx.currentTime);
          roarOsc.frequency.exponentialRampToValueAtTime(195, this.ctx.currentTime + 0.25);
          roarOsc.frequency.exponentialRampToValueAtTime(52, this.ctx.currentTime + 0.78);

          roarGain.gain.setValueAtTime(0.22, this.ctx.currentTime);
          roarGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);

          roarOsc.connect(roarGain);
          if (this.masterGain) roarGain.connect(this.masterGain);
          roarOsc.start();
          roarOsc.stop(this.ctx.currentTime + 0.82);
          onComplete?.();
        } catch {}
      }, 300);
    } catch {}
  }

  /**
   * Engine Stop clean spindown
   */
  public playShutdownSound() {
    this.init();
    this.isEngineRunning = false;
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.engineBus?.gain.setTargetAtTime(0.0001, now, 0.06);
      this.turboGain?.gain.setTargetAtTime(0, now, 0.05);
      this.intakeGain?.gain.setTargetAtTime(0, now, 0.04);

      const shutOsc = this.ctx.createOscillator();
      const shutGain = this.ctx.createGain();
      shutOsc.type = 'triangle';
      shutOsc.frequency.setValueAtTime(68, now);
      shutOsc.frequency.exponentialRampToValueAtTime(16, now + 0.48);

      shutGain.gain.setValueAtTime(0.15, now);
      shutGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.52);

      shutOsc.connect(shutGain);
      if (this.masterGain) shutGain.connect(this.masterGain);
      shutOsc.start(now);
      shutOsc.stop(now + 0.54);
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
        this.hornGain.gain.setValueAtTime(this.isMuted ? 0 : 0.28, now);

        this.hornOsc1 = this.ctx.createOscillator();
        this.hornOsc1.type = 'sawtooth';
        this.hornOsc1.frequency.setValueAtTime(440, now);

        this.hornOsc2 = this.ctx.createOscillator();
        this.hornOsc2.type = 'triangle';
        this.hornOsc2.frequency.setValueAtTime(554.37, now);

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
   * Automotive Turn Signal Relay Clicker
   */
  public playTurnSignalClick(step: 'on' | 'off' = 'on') {
    this.init();
    if (!this.ctx || this.isMuted) return;
    try {
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(step === 'on' ? 1220 : 840, this.ctx.currentTime);
      clickGain.gain.setValueAtTime(0.065, this.ctx.currentTime);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.032);

      clickOsc.connect(clickGain);
      clickGain.connect(this.masterGain || this.ctx.destination);
      clickOsc.start();
      clickOsc.stop(this.ctx.currentTime + 0.036);
    } catch {}
  }

  /**
   * In-Car Infotainment Synthesizer Radio Station
   */
  public setRadioStation(station: number) {
    this.radioStation = station;
    if (this.radioInterval) {
      clearInterval(this.radioInterval);
      this.radioInterval = null;
    }

    if (station === 0 || !this.ctx || this.isMuted) return;

    const synthNotes: Record<number, { notes: number[]; tempoMs: number; wave: OscillatorType; cutoff: number }> = {
      1: { notes: [293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 261.63], tempoMs: 220, wave: 'triangle', cutoff: 900 },
      2: { notes: [110.0, 110.0, 146.83, 130.81, 110.0, 98.0, 130.81, 146.83], tempoMs: 280, wave: 'sawtooth', cutoff: 420 },
      3: { notes: [261.63, 329.63, 392.0, 493.88, 440.0, 349.23, 329.63, 293.66], tempoMs: 340, wave: 'sine', cutoff: 650 },
      4: { notes: [261.63, 329.63, 392.0, 523.25, 440.0, 349.23, 392.0, 523.25], tempoMs: 360, wave: 'triangle', cutoff: 820 },
      5: { notes: [174.61, 220.0, 261.63, 349.23, 261.63, 220.0, 196.0, 246.94], tempoMs: 410, wave: 'sine', cutoff: 480 },
      6: { notes: [146.83, 220.0, 293.66, 349.23, 440.0, 349.23, 293.66, 220.0], tempoMs: 175, wave: 'sawtooth', cutoff: 1100 },
    };

    const profile = synthNotes[station] || synthNotes[1];

    this.radioInterval = window.setInterval(() => {
      if (!this.ctx || this.isMuted || this.radioStation === 0 || (typeof document !== 'undefined' && document.hidden)) return;
      try {
        const noteFreq = profile.notes[this.radioStep % profile.notes.length];
        this.radioStep++;

        const noteOsc = this.ctx.createOscillator();
        const noteGain = this.ctx.createGain();
        noteOsc.type = profile.wave;
        noteOsc.frequency.setValueAtTime(noteFreq, this.ctx.currentTime);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(profile.cutoff, this.ctx.currentTime);

        noteGain.gain.setValueAtTime(0.04, this.ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + (profile.tempoMs / 1000) * 0.9);

        noteOsc.connect(filter);
        filter.connect(noteGain);
        if (this.radioGain) {
          noteGain.connect(this.radioGain);
        }

        noteOsc.start();
        noteOsc.stop(this.ctx.currentTime + profile.tempoMs / 1000);
      } catch {}
    }, profile.tempoMs);
  }

  public setMusicPreference(pref: string) {
    const map: Record<string, number> = {
      NO_MUSIC: 0,
      AFROBEATS: 1,
      HIP_HOP: 2,
      RNB: 3,
      GOSPEL: 4,
      INSTRUMENTAL: 5,
      ELECTRONIC_HOUSE: 6,
    };
    this.setRadioStation(map[pref] ?? 1);
  }

  public getRadioStation(): number {
    return this.radioStation;
  }

  public setRadioVolume(volume: number) {
    this.radioVolume = Math.max(0, Math.min(1, volume));
    if (this.radioGain && this.ctx) {
      this.radioGain.gain.setTargetAtTime(this.radioVolume * 0.14, this.ctx.currentTime, 0.05);
    }
  }

  public setMasterVolume(volume: number) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.effectiveMasterGainValue(), this.ctx.currentTime, 0.05);
    }
  }

  public getMasterVolume(): number {
    return this.masterVolume;
  }

  public setMuted(muted: boolean): boolean {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.effectiveMasterGainValue(), this.ctx.currentTime, 0.05);
    }
    if (muted) {
      this.playHorn(false);
    } else if (this.radioStation > 0 && !this.radioInterval && this.ctx) {
      this.setRadioStation(this.radioStation);
    }
    return this.isMuted;
  }

  public toggleMute(): boolean {
    return this.setMuted(!this.isMuted);
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
    this.playHorn(false);
    this.silenceDrivingBuses();
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
