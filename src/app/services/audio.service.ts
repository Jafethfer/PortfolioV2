import { Injectable } from '@angular/core';

/**
 * Lightweight audio playback. Voices fire-and-forget; bg music holds a single
 * Audio element so toggling can resume/pause without re-fetching.
 */
@Injectable({ providedIn: 'root' })
export class AudioService {
  private _bg?: HTMLAudioElement;

  playVoice(src: string | undefined, volume = 0.5): void {
    if (!src) return;
    const a = new Audio(src);
    a.volume = volume;
    a.play().catch(() => {});
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
