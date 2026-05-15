import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Single source of truth for the per-frame heartbeat. Components subscribe by
 * depending on `tick()` inside an effect — Angular re-runs the effect each
 * tick, driving per-frame logic.
 */
@Injectable({ providedIn: 'root' })
export class GameLoopService {
  static readonly TICK_MS = 30;
  readonly tick = signal(0);

  constructor() {
    const id = setInterval(() => this.tick.update(n => n + 1), GameLoopService.TICK_MS);
    inject(DestroyRef).onDestroy(() => clearInterval(id));
  }
}
