import { Injectable } from '@angular/core';

/**
 * Lightweight audio playback. Voices fire-and-forget; bg music holds a single
 * Audio element so toggling can resume/pause without re-fetching.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private _bg?: HTMLAudioElement;

  /** Fire-and-forget one-shot playback. Returns the underlying Audio so
   * callers can stop it early (e.g. cancelling a jump SFX when the player's
   * follow-up input converts the jump into a special). Returns null when
   * `src` is undefined so the call site is a single statement either way. */
  playVoice(src: string | undefined, volume = 0.5): HTMLAudioElement | null {
    if (!src) return null;
    const a = new Audio(src);
    a.volume = volume;
    a.play().catch(() => {});
    return a;
  }

  playBgMusic(src: string, volume = 0.2): void {
    if (!this._bg) {
      this._bg = new Audio(src);
      this._bg.loop = true;
    }
    this._bg.volume = volume;
    this._bg.play().catch(() => {});
  }

  pauseBgMusic(): void {
    this._bg?.pause();
  }
}
