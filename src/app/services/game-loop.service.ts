import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Single source of truth for the per-frame heartbeat. Components subscribe by
 * depending on `tick()` inside an effect, which Angular re-runs each tick.
 *
 * Driven by `requestAnimationFrame` (not `setInterval`, which browsers throttle
 * while a touch pointer is held, slowing the animation clock). A time
 * accumulator keeps `tick` an integer incrementing once per `TICK_MS`, so
 * downstream `durationMs / TICK_MS` frame math is unchanged.
 */
@Injectable({ providedIn: 'root' })
export class GameLoopService {
  static readonly TICK_MS = 30;
  /** Max ticks emitted from a single frame, bounding catch-up after a long
   * pause (hidden tab / stalled main thread). */
  private static readonly MAX_CATCHUP_TICKS = 4;

  readonly tick = signal(0);

  private readonly _zone = inject(NgZone);

  constructor() {
    let rafId = 0;
    let last = 0;
    let acc = 0;
    const frame = (now: number): void => {
      if (last === 0) last = now;
      acc += now - last;
      last = now;
      let steps = Math.floor(acc / GameLoopService.TICK_MS);
      if (steps > 0) {
        acc -= steps * GameLoopService.TICK_MS;
        if (steps > GameLoopService.MAX_CATCHUP_TICKS) steps = GameLoopService.MAX_CATCHUP_TICKS;
        // Emit inside the zone so change detection runs; the rAF loop itself
        // stays outside the zone so no-op frames don't each trigger a CD pass.
        this._zone.run(() => this.tick.update((n) => n + steps));
      }
      rafId = requestAnimationFrame(frame);
    };
    this._zone.runOutsideAngular(() => {
      rafId = requestAnimationFrame(frame);
    });
    inject(DestroyRef).onDestroy(() => cancelAnimationFrame(rafId));
  }
}
