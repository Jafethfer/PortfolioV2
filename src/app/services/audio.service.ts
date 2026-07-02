import { Injectable, effect, signal } from '@angular/core';

/** Which mixer channel a sound belongs to. Each maps to one slider in the
 * `<app-audio-mixer>` panel and one master-volume signal below. */
export type SoundCategory = 'music' | 'sfx' | 'voice';

/**
 * Lightweight audio playback + the app's volume mixer. Voices/SFX fire-and-
 * forget; bg music holds a single Audio element so switching stages can swap
 * the track without re-fetching, and the live element's volume tracks the
 * music slider.
 *
 * The three `*Volume` signals are the single source of truth for playback gain
 * and back the three mixer sliders. Each play call passes the per-sound level
 * it was authored at; the service rescales it by the live master so dragging a
 * slider attenuates every sound in that channel proportionally (the quiet jump
 * whoosh stays quieter than a hit confirm). At the start positions playback is
 * identical to the pre-mixer app — see `REFERENCE`.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  /** Reference levels each channel's per-sound volumes were authored against —
   * also the slider start positions. For SFX/voice, `effective = base ×
   * master / ref`, so at `master === ref` playback is exactly what it was
   * before the mixer existed. Music has no per-sound base: the slider IS the
   * volume, so its reference is just the start position. */
  private static readonly REFERENCE = { music: 0.2, sfx: 0.7, voice: 0.3 } as const;

  /** Master volume per channel, in [0, 1]. Bound to the mixer sliders. */
  readonly musicVolume = signal(AudioService.REFERENCE.music);
  readonly sfxVolume = signal(AudioService.REFERENCE.sfx);
  readonly voiceVolume = signal(AudioService.REFERENCE.voice);

  private _bg?: HTMLAudioElement;
  private _bgSrc?: string;

  constructor() {
    // Keep the live bg element's volume in sync with the music slider.
    effect(() => {
      const v = this.musicVolume();
      if (this._bg) this._bg.volume = v;
    });
    // Browsers block autoplay until the page has seen a user gesture. The bg
    // track is started by the stage on render (which may be blocked); resume
    // it on the first interaction (a key to move the character, or a slider).
    const resume = (): void => {
      this._bg?.play().catch(() => {});
    };
    window.addEventListener('pointerdown', resume, { once: true });
    window.addEventListener('keydown', resume, { once: true });
  }

  /** Map a per-sound base level through its channel's master volume. */
  private _scale(base: number, category: SoundCategory): number {
    if (category === 'music') return this.musicVolume();
    const master = category === 'voice' ? this.voiceVolume() : this.sfxVolume();
    const ref =
      category === 'voice' ? AudioService.REFERENCE.voice : AudioService.REFERENCE.sfx;
    return Math.min(1, base * (master / ref));
  }

  /** Fire-and-forget one-shot playback. Returns the underlying Audio so
   * callers can stop it early (e.g. cancelling a jump SFX when the player's
   * follow-up input converts the jump into a special). Returns null when
   * `src` is undefined so the call site is a single statement either way.
   * `category` selects the mixer channel that scales the volume. */
  playVoice(
    src: string | undefined,
    volume = 0.5,
    category: SoundCategory = 'voice',
  ): HTMLAudioElement | null {
    if (!src) return null;
    const a = new Audio(src);
    a.volume = this._scale(volume, category);
    a.play().catch(() => {});
    return a;
  }

  /** Set (and start) the looping background track. Called by each stage on
   * render with its own OST. Switching to a new `src` swaps the track; calling
   * with the current `src` just ensures it's playing. Volume follows the music
   * slider via the constructor effect. */
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
