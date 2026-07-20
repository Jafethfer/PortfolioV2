import { Injectable, effect, signal } from '@angular/core';

/** Which mixer channel a sound belongs to. Each maps to one slider in the
 * `<app-audio-mixer>` panel and one master-volume signal below. */
export type SoundCategory = 'music' | 'sfx' | 'voice';

/** Handle to a playing one-shot, returned by `playVoice`. Mirrors the slice of
 * `HTMLAudioElement` the call sites use so the Web Audio and fallback paths are
 * interchangeable; `pause()` maps to `AudioBufferSourceNode.stop()`. */
export interface SfxHandle {
  pause(): void;
  loop: boolean;
  currentTime: number;
}

/**
 * Audio playback + the app's volume mixer. One-shots (voices/SFX) play through
 * the Web Audio API from `AudioBuffer`s pre-decoded during preload, so a hit
 * fires with no per-play disk read or decode; a source not yet decoded falls
 * back to an `HTMLAudioElement`. Bg music stays a streamed `HTMLAudioElement`.
 *
 * The three `*Volume` signals back the mixer sliders and scale playback:
 * `effective = base × master / ref`, with `base` on a per-shot gain node and
 * `master / ref` on a persistent per-channel gain node.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  /** Reference levels the per-sound volumes were authored against, and the
   * slider start positions. Music's slider IS the volume (no per-sound base). */
  private static readonly REFERENCE = { music: 0.2, sfx: 0.7, voice: 0.3 } as const;

  /** Master volume per channel, in [0, 1]. Bound to the mixer sliders. */
  readonly musicVolume = signal(AudioService.REFERENCE.music);
  readonly sfxVolume = signal(AudioService.REFERENCE.sfx);
  readonly voiceVolume = signal(AudioService.REFERENCE.voice);

  /** Web Audio graph for one-shots. Created suspended and resumed on the first
   * gesture; `decodeAudioData` works while suspended so buffers warm during
   * preload. The per-channel gains carry `master / ref`, kept in sync by effect. */
  private readonly _ctx = new AudioContext();
  private readonly _sfxGain = this._ctx.createGain();
  private readonly _voiceGain = this._ctx.createGain();
  private readonly _buffers = new Map<string, AudioBuffer>();

  private _bg?: HTMLAudioElement;
  private _bgSrc?: string;

  constructor() {
    this._sfxGain.connect(this._ctx.destination);
    this._voiceGain.connect(this._ctx.destination);
    // Channel masters track their sliders — a drag mid-whoosh is heard live.
    effect(() => {
      this._sfxGain.gain.value = this.sfxVolume() / AudioService.REFERENCE.sfx;
    });
    effect(() => {
      this._voiceGain.gain.value = this.voiceVolume() / AudioService.REFERENCE.voice;
    });
    // Keep the live bg element's volume in sync with the music slider.
    effect(() => {
      const v = this.musicVolume();
      if (this._bg) this._bg.volume = v;
    });
    // Browsers block audio until a user gesture; resume on the first one.
    const resume = (): void => {
      this._ctx.resume().catch(() => {});
      this._bg?.play().catch(() => {});
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }

  /** Fetch + decode a one-shot into an in-memory buffer, keyed by `src`. Called
   * by the preloader so the first play is already decoded. A failure leaves
   * `src` uncached, so playback falls back to `HTMLAudioElement`. */
  async decodeAndCache(src: string): Promise<void> {
    if (this._buffers.has(src)) return;
    try {
      const res = await fetch(src);
      const data = await res.arrayBuffer();
      const buf = await this._ctx.decodeAudioData(data);
      this._buffers.set(src, buf);
    } catch {
      // Leave uncached — playVoice falls back to the HTMLAudioElement path.
    }
  }

  /** Map a per-sound base level through its channel's master volume. Used by the
   * HTMLAudioElement fallback; the Web Audio path splits this across gain nodes. */
  private _scale(base: number, category: SoundCategory): number {
    if (category === 'music') return this.musicVolume();
    const master = category === 'voice' ? this.voiceVolume() : this.sfxVolume();
    const ref =
      category === 'voice' ? AudioService.REFERENCE.voice : AudioService.REFERENCE.sfx;
    return Math.min(1, base * (master / ref));
  }

  /** Fire-and-forget one-shot playback. Returns a handle so callers can stop it
   * early or keep it looping, or null when `src` is undefined. `category`
   * selects the mixer channel that scales the volume. */
  playVoice(
    src: string | undefined,
    volume = 0.5,
    category: SoundCategory = 'voice',
  ): SfxHandle | null {
    if (!src) return null;
    const buffer = this._buffers.get(src);
    if (buffer) return this._playBuffer(buffer, volume, category);
    // Not decoded yet — fall back to the media-element path.
    const a = new Audio(src);
    a.volume = this._scale(volume, category);
    a.play().catch(() => {});
    return a;
  }

  /** Play a decoded buffer: per-shot gain carries `base`, the category gain
   * carries the live master. */
  private _playBuffer(
    buffer: AudioBuffer,
    base: number,
    category: SoundCategory,
  ): SfxHandle {
    const source = this._ctx.createBufferSource();
    source.buffer = buffer;
    const shot = this._ctx.createGain();
    shot.gain.value = base;
    source.connect(shot);
    shot.connect(category === 'voice' ? this._voiceGain : this._sfxGain);
    source.start(0);
    let stopped = false;
    return {
      get loop(): boolean {
        return source.loop;
      },
      set loop(v: boolean) {
        source.loop = v;
      },
      currentTime: 0,
      pause(): void {
        if (stopped) return;
        stopped = true;
        try {
          source.stop();
        } catch {
          // Already stopped/ended.
        }
      },
    };
  }

  /** Set (and start) the looping background track. Switching `src` swaps the
   * track; the current `src` just ensures it's playing. */
  setBgMusic(src: string): void {
    if (this._bgSrc === src) {
      this._bg?.play().catch(() => {});
      return;
    }
    this._bgSrc = src;
    this._bg?.pause();
    this._bg = new Audio(src);
    this._bg.loop = true;
    this._bg.volume = this.musicVolume();
    this._bg.play().catch(() => {});
  }

  pauseBgMusic(): void {
    this._bg?.pause();
  }
}
