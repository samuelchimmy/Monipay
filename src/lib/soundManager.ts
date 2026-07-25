// ═══════════════════════════════════════════════════════════════
// MoniPay Premium Sound Manager — Howler.js + Procedural Audio
// 24 high-fidelity sounds · 50% pitch · 75% volume
// ═══════════════════════════════════════════════════════════════

import { Howl, Howler } from 'howler';

// ── Sound Categories ─────────────────────────────────────────

export type ButtonSound = 'tap' | 'press' | 'toggleOn' | 'toggleOff' | 'swipe' | 'pullRefresh';
export type TransactionSound = 'paymentSuccess' | 'transferComplete' | 'depositConfirmed' | 'cardScan' | 'processing' | 'transactionFailed';
export type NotificationSound = 'alert' | 'messageReceived' | 'balanceUpdate' | 'goalAchieved' | 'warning' | 'error';
export type NavigationSound = 'pageTransition' | 'modalOpen' | 'modalClose' | 'expand' | 'collapse' | 'back';

export type SoundName = ButtonSound | TransactionSound | NotificationSound | NavigationSound;

// ── Audio Buffer Generator ───────────────────────────────────
// Generates premium WAV buffers procedurally using Web Audio API
// then wraps them in Howler for cross-platform playback

interface ToneLayer {
  freq: number;
  type: OscillatorType;
  gain: number;
  detune?: number;
  delay?: number;
  duration?: number;
}

interface Envelope {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

function renderToWav(
  layers: ToneLayer[],
  envelope: Envelope,
  baseDuration: number,
  masterVol: number
): string {
  const sampleRate = 44100;
  const totalDuration = baseDuration + 0.1; // padding
  const numSamples = Math.ceil(sampleRate * totalDuration);
  const buffer = new Float32Array(numSamples);

  for (const layer of layers) {
    const startSample = Math.floor((layer.delay || 0) * sampleRate);
    const dur = layer.duration ?? baseDuration;
    const endSample = Math.min(startSample + Math.ceil(dur * sampleRate), numSamples);
    const freq = layer.freq + (layer.detune ? layer.freq * (layer.detune / 1200) : 0);

    for (let i = startSample; i < endSample; i++) {
      const t = (i - startSample) / sampleRate;
      const relT = t / dur;

      // ADSR envelope
      let env: number;
      const atkEnd = envelope.attack / dur;
      const decEnd = atkEnd + envelope.decay / dur;
      const relStart = 1 - envelope.release / dur;

      if (relT < atkEnd) {
        env = relT / atkEnd;
      } else if (relT < decEnd) {
        env = 1 - (1 - envelope.sustain) * ((relT - atkEnd) / (decEnd - atkEnd));
      } else if (relT < relStart) {
        env = envelope.sustain;
      } else {
        env = envelope.sustain * (1 - (relT - relStart) / (1 - relStart));
      }

      // Oscillator
      let sample: number;
      const phase = freq * t * 2 * Math.PI;
      switch (layer.type) {
        case 'sine':
          sample = Math.sin(phase);
          break;
        case 'triangle':
          sample = 2 * Math.abs(2 * ((freq * t) % 1) - 1) - 1;
          break;
        case 'square':
          sample = Math.sin(phase) > 0 ? 1 : -1;
          break;
        case 'sawtooth':
          sample = 2 * ((freq * t) % 1) - 1;
          break;
        default:
          sample = Math.sin(phase);
      }

      buffer[i] += sample * layer.gain * env * masterVol;
    }
  }

  // Clamp
  for (let i = 0; i < numSamples; i++) {
    buffer[i] = Math.max(-1, Math.min(1, buffer[i]));
  }

  // Encode WAV
  return encodeWav(buffer, sampleRate);
}

function encodeWav(samples: Float32Array, sampleRate: number): string {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;
  const bufferSize = 44 + dataSize;
  const buf = new ArrayBuffer(bufferSize);
  const view = new DataView(buf);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s * 0x7fff, true);
  }

  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

// ═══════════════════════════════════════════════════════════════
// SOUND DEFINITIONS — 24 Premium Sounds
// ═══════════════════════════════════════════════════════════════

const env = {
  crisp:    { attack: 0.001, decay: 0.01,  sustain: 0.3,  release: 0.01  },
  soft:     { attack: 0.005, decay: 0.04,  sustain: 0.45, release: 0.08  },
  warm:     { attack: 0.008, decay: 0.06,  sustain: 0.5,  release: 0.15  },
  rich:     { attack: 0.005, decay: 0.06,  sustain: 0.5,  release: 0.18  },
  punchy:   { attack: 0.002, decay: 0.03,  sustain: 0.35, release: 0.06  },
  gentle:   { attack: 0.01,  decay: 0.08,  sustain: 0.4,  release: 0.12  },
  dramatic: { attack: 0.003, decay: 0.05,  sustain: 0.55, release: 0.2   },
};

type SoundDef = { layers: ToneLayer[]; envelope: Envelope; duration: number; vol: number };

const SOUND_DEFS: Record<SoundName, SoundDef> = {
  // ── BUTTON INTERACTIONS ────────────────────────────────────
  tap: {
    layers: [
      { freq: 900, type: 'sine', gain: 0.1, duration: 0.025 },
      { freq: 1600, type: 'sine', gain: 0.04, duration: 0.015, detune: 5 },
    ],
    envelope: env.crisp, duration: 0.03, vol: 0.7,
  },
  press: {
    layers: [
      { freq: 700, type: 'sine', gain: 0.12, duration: 0.04 },
      { freq: 350, type: 'sine', gain: 0.05, duration: 0.05 },
      { freq: 1400, type: 'sine', gain: 0.03, duration: 0.03 },
    ],
    envelope: env.punchy, duration: 0.05, vol: 0.75,
  },
  toggleOn: {
    layers: [
      { freq: 550, type: 'sine', gain: 0.08, duration: 0.06 },
      { freq: 825, type: 'sine', gain: 0.1, delay: 0.02, duration: 0.05 },
      { freq: 1100, type: 'sine', gain: 0.04, delay: 0.02, duration: 0.04 },
    ],
    envelope: env.punchy, duration: 0.07, vol: 0.65,
  },
  toggleOff: {
    layers: [
      { freq: 825, type: 'sine', gain: 0.08, duration: 0.06 },
      { freq: 550, type: 'sine', gain: 0.1, delay: 0.02, duration: 0.05 },
      { freq: 275, type: 'sine', gain: 0.04, delay: 0.02, duration: 0.04 },
    ],
    envelope: env.punchy, duration: 0.07, vol: 0.65,
  },
  swipe: {
    layers: [
      { freq: 400, type: 'sine', gain: 0.06, duration: 0.08 },
      { freq: 600, type: 'sine', gain: 0.08, delay: 0.02, duration: 0.06 },
      { freq: 900, type: 'sine', gain: 0.04, delay: 0.04, duration: 0.04 },
    ],
    envelope: env.soft, duration: 0.1, vol: 0.55,
  },
  pullRefresh: {
    layers: [
      { freq: 300, type: 'sine', gain: 0.07, duration: 0.15 },
      { freq: 450, type: 'sine', gain: 0.09, delay: 0.05, duration: 0.12 },
      { freq: 600, type: 'sine', gain: 0.11, delay: 0.1, duration: 0.1 },
      { freq: 900, type: 'sine', gain: 0.05, delay: 0.13, duration: 0.08 },
    ],
    envelope: env.gentle, duration: 0.2, vol: 0.6,
  },

  // ── TRANSACTIONS ───────────────────────────────────────────
  paymentSuccess: {
    layers: [
      { freq: 261.63, type: 'sine', gain: 0.12, duration: 0.35 },
      { freq: 261.63 * 2, type: 'sine', gain: 0.04, duration: 0.3 },
      { freq: 329.63, type: 'sine', gain: 0.14, delay: 0.08, duration: 0.3 },
      { freq: 392, type: 'sine', gain: 0.15, delay: 0.16, duration: 0.35 },
      { freq: 392 * 2, type: 'sine', gain: 0.04, delay: 0.16, duration: 0.25 },
      { freq: 523.25, type: 'sine', gain: 0.12, delay: 0.24, duration: 0.4 },
      { freq: 130.81, type: 'sine', gain: 0.04, duration: 0.5 },
    ],
    envelope: env.rich, duration: 0.5, vol: 0.9,
  },
  transferComplete: {
    layers: [
      { freq: 440, type: 'sine', gain: 0.11, duration: 0.28 },
      { freq: 880, type: 'sine', gain: 0.03, duration: 0.22 },
      { freq: 554.37, type: 'sine', gain: 0.12, delay: 0.07, duration: 0.25 },
      { freq: 659.25, type: 'sine', gain: 0.13, delay: 0.14, duration: 0.3 },
      { freq: 1318.5, type: 'sine', gain: 0.02, delay: 0.18, duration: 0.25, detune: 8 },
    ],
    envelope: env.warm, duration: 0.35, vol: 0.85,
  },
  depositConfirmed: {
    layers: [
      { freq: 523.25, type: 'sine', gain: 0.13, duration: 0.45 },
      { freq: 659.25, type: 'sine', gain: 0.13, delay: 0.09, duration: 0.38 },
      { freq: 783.99, type: 'sine', gain: 0.13, delay: 0.18, duration: 0.32 },
      { freq: 1046.5, type: 'sine', gain: 0.12, delay: 0.27, duration: 0.35 },
      { freq: 1046.5 * 2, type: 'sine', gain: 0.03, delay: 0.27, duration: 0.25 },
      { freq: 261.63, type: 'sine', gain: 0.05, duration: 0.55 },
      { freq: 2093, type: 'sine', gain: 0.012, delay: 0.32, duration: 0.3, detune: 12 },
    ],
    envelope: env.rich, duration: 0.55, vol: 0.9,
  },
  cardScan: {
    layers: [
      { freq: 700, type: 'sine', gain: 0.1, duration: 0.06 },
      { freq: 1400, type: 'sine', gain: 0.04, duration: 0.04 },
      { freq: 700, type: 'triangle', gain: 0.03, duration: 0.05, detune: -3 },
    ],
    envelope: env.crisp, duration: 0.07, vol: 0.8,
  },
  processing: {
    layers: [
      { freq: 440, type: 'sine', gain: 0.06, duration: 0.12 },
      { freq: 466.16, type: 'sine', gain: 0.06, delay: 0.12, duration: 0.12 },
      { freq: 493.88, type: 'sine', gain: 0.06, delay: 0.24, duration: 0.12 },
      { freq: 466.16, type: 'sine', gain: 0.06, delay: 0.36, duration: 0.12 },
    ],
    envelope: env.soft, duration: 0.5, vol: 0.5,
  },
  transactionFailed: {
    layers: [
      { freq: 280, type: 'triangle', gain: 0.15, duration: 0.22 },
      { freq: 140, type: 'sine', gain: 0.08, duration: 0.25 },
      { freq: 240, type: 'triangle', gain: 0.12, delay: 0.12, duration: 0.2 },
      { freq: 120, type: 'sine', gain: 0.06, delay: 0.12, duration: 0.22 },
    ],
    envelope: env.punchy, duration: 0.25, vol: 0.85,
  },

  // ── NOTIFICATIONS ──────────────────────────────────────────
  alert: {
    layers: [
      { freq: 880, type: 'sine', gain: 0.1, duration: 0.15 },
      { freq: 1760, type: 'sine', gain: 0.04, duration: 0.1 },
      { freq: 880, type: 'sine', gain: 0.08, delay: 0.12, duration: 0.15 },
    ],
    envelope: env.soft, duration: 0.28, vol: 0.8,
  },
  messageReceived: {
    layers: [
      { freq: 830, type: 'sine', gain: 0.09, duration: 0.1 },
      { freq: 1046.5, type: 'sine', gain: 0.11, delay: 0.06, duration: 0.12 },
      { freq: 1660, type: 'sine', gain: 0.03, delay: 0.06, duration: 0.08 },
    ],
    envelope: env.soft, duration: 0.18, vol: 0.75,
  },
  balanceUpdate: {
    layers: [
      { freq: 587.33, type: 'sine', gain: 0.08, duration: 0.12 },
      { freq: 783.99, type: 'sine', gain: 0.1, delay: 0.04, duration: 0.1 },
      { freq: 1174.66, type: 'sine', gain: 0.03, delay: 0.04, duration: 0.08 },
    ],
    envelope: env.soft, duration: 0.15, vol: 0.7,
  },
  goalAchieved: {
    layers: [
      { freq: 523.25, type: 'sine', gain: 0.12, duration: 0.3 },
      { freq: 659.25, type: 'sine', gain: 0.12, delay: 0.06, duration: 0.28 },
      { freq: 783.99, type: 'sine', gain: 0.13, delay: 0.12, duration: 0.3 },
      { freq: 1046.5, type: 'sine', gain: 0.14, delay: 0.18, duration: 0.35 },
      { freq: 2093, type: 'sine', gain: 0.03, delay: 0.22, duration: 0.25, detune: 10 },
      { freq: 261.63, type: 'sine', gain: 0.05, duration: 0.45 },
    ],
    envelope: env.dramatic, duration: 0.45, vol: 0.9,
  },
  warning: {
    layers: [
      { freq: 440, type: 'triangle', gain: 0.1, duration: 0.15 },
      { freq: 220, type: 'sine', gain: 0.06, duration: 0.18 },
      { freq: 440, type: 'triangle', gain: 0.08, delay: 0.1, duration: 0.12 },
    ],
    envelope: env.punchy, duration: 0.22, vol: 0.75,
  },
  error: {
    layers: [
      { freq: 280, type: 'triangle', gain: 0.15, duration: 0.22 },
      { freq: 140, type: 'sine', gain: 0.08, duration: 0.25 },
      { freq: 240, type: 'triangle', gain: 0.12, delay: 0.12, duration: 0.2 },
      { freq: 120, type: 'sine', gain: 0.06, delay: 0.12, duration: 0.22 },
    ],
    envelope: env.punchy, duration: 0.25, vol: 0.85,
  },

  // ── NAVIGATION ─────────────────────────────────────────────
  pageTransition: {
    layers: [
      { freq: 500, type: 'sine', gain: 0.06, duration: 0.08 },
      { freq: 750, type: 'sine', gain: 0.04, delay: 0.02, duration: 0.06 },
      { freq: 1000, type: 'sine', gain: 0.02, delay: 0.03, duration: 0.04 },
    ],
    envelope: env.soft, duration: 0.1, vol: 0.5,
  },
  modalOpen: {
    layers: [
      { freq: 380, type: 'sine', gain: 0.07, duration: 0.12 },
      { freq: 480, type: 'sine', gain: 0.09, delay: 0.03, duration: 0.1 },
      { freq: 760, type: 'sine', gain: 0.03, delay: 0.03, duration: 0.08 },
    ],
    envelope: env.soft, duration: 0.12, vol: 0.55,
  },
  modalClose: {
    layers: [
      { freq: 480, type: 'sine', gain: 0.07, duration: 0.1 },
      { freq: 360, type: 'sine', gain: 0.06, delay: 0.03, duration: 0.08 },
      { freq: 720, type: 'sine', gain: 0.02, duration: 0.07 },
    ],
    envelope: env.soft, duration: 0.1, vol: 0.5,
  },
  expand: {
    layers: [
      { freq: 400, type: 'sine', gain: 0.06, duration: 0.1 },
      { freq: 600, type: 'sine', gain: 0.08, delay: 0.03, duration: 0.08 },
      { freq: 900, type: 'sine', gain: 0.04, delay: 0.05, duration: 0.06 },
    ],
    envelope: env.soft, duration: 0.12, vol: 0.55,
  },
  collapse: {
    layers: [
      { freq: 900, type: 'sine', gain: 0.04, duration: 0.06 },
      { freq: 600, type: 'sine', gain: 0.08, delay: 0.03, duration: 0.08 },
      { freq: 400, type: 'sine', gain: 0.06, delay: 0.05, duration: 0.1 },
    ],
    envelope: env.soft, duration: 0.12, vol: 0.5,
  },
  back: {
    layers: [
      { freq: 600, type: 'sine', gain: 0.06, duration: 0.08 },
      { freq: 450, type: 'sine', gain: 0.07, delay: 0.02, duration: 0.07 },
      { freq: 300, type: 'sine', gain: 0.03, delay: 0.04, duration: 0.06 },
    ],
    envelope: env.soft, duration: 0.1, vol: 0.5,
  },
};

// ═══════════════════════════════════════════════════════════════
// SOUND MANAGER SINGLETON
// ═══════════════════════════════════════════════════════════════

const PREFS_KEY = 'monipay_sound_prefs';

interface SoundPrefs {
  enabled: boolean;
  volume: number;  // 0-1
  pitch: number;   // 0.5 = 50%
}

function loadPrefs(): SoundPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { enabled: true, volume: 1.0, pitch: 0.5 };
}

function savePrefs(prefs: SoundPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

class SoundManager {
  private howls: Map<SoundName, Howl> = new Map();
  private prefs: SoundPrefs;
  private initialized = false;
  private initializing = false;

  constructor() {
    this.prefs = loadPrefs();
    Howler.volume(this.prefs.volume);
  }

  // ── Initialization (preload all sounds) ────────────────────

  async init(): Promise<void> {
    if (this.initialized || this.initializing) return;
    this.initializing = true;

    try {
      const names = Object.keys(SOUND_DEFS) as SoundName[];

      for (const name of names) {
        const def = SOUND_DEFS[name];
        const dataUri = renderToWav(def.layers, def.envelope, def.duration, def.vol);

        const howl = new Howl({
          src: [dataUri],
          format: ['wav'],
          preload: true,
          rate: this.prefs.pitch, // 0.5 = 50% pitch (deep)
          volume: this.prefs.volume,
          html5: false, // Use Web Audio for lower latency
        });

        this.howls.set(name, howl);
      }

      this.initialized = true;
    } catch (e) {
      console.warn('[SoundManager] Init failed:', e);
    } finally {
      this.initializing = false;
    }
  }

  // ── Playback ───────────────────────────────────────────────

  play(name: SoundName): void {
    if (!this.prefs.enabled) return;

    // Lazy init on first play (handles iOS autoplay unlock)
    if (!this.initialized) {
      this.init().then(() => this._play(name));
      return;
    }

    this._play(name);
  }

  private _play(name: SoundName): void {
    const howl = this.howls.get(name);
    if (!howl) return;
    howl.rate(this.prefs.pitch);
    howl.volume(this.prefs.volume);
    howl.play();
  }

  // ── Controls ───────────────────────────────────────────────

  mute(): void {
    this.prefs.enabled = false;
    Howler.mute(true);
    savePrefs(this.prefs);
  }

  unmute(): void {
    this.prefs.enabled = true;
    Howler.mute(false);
    savePrefs(this.prefs);
  }

  setVolume(vol: number): void {
    this.prefs.volume = Math.max(0, Math.min(1, vol));
    Howler.volume(this.prefs.volume);
    savePrefs(this.prefs);
  }

  setPitch(rate: number): void {
    this.prefs.pitch = Math.max(0.1, Math.min(2, rate));
    // Update all existing howls
    this.howls.forEach(howl => howl.rate(this.prefs.pitch));
    savePrefs(this.prefs);
  }

  toggleSound(): boolean {
    if (this.prefs.enabled) {
      this.mute();
    } else {
      this.unmute();
    }
    return this.prefs.enabled;
  }

  isEnabled(): boolean {
    return this.prefs.enabled;
  }

  getVolume(): number {
    return this.prefs.volume;
  }

  getPitch(): number {
    return this.prefs.pitch;
  }
}

// ── Singleton Export ──────────────────────────────────────────

export const soundManager = new SoundManager();
