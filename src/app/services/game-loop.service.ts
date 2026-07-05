import { DestroyRef, Injectable, NgZone, inject, signal } from '@angular/core';

/**
 * Single source of truth for the per-frame heartbeat. Components subscribe by
 * depending on `tick()` inside an effect — Angular re-runs the effect each
 * tick, driving per-frame logic.
 *
 * Driven by `requestAnimationFrame`, NOT `setInterval`: while a touch pointer is
 * held (e.g. tapping an on-screen attack button for the 200–500ms of the move),
 * browsers deprioritise timer callbacks in favour of the touch/gesture pipeline,
 * so a `setInterval` clock slows and the frame-by-frame animation plays back in
 * slow motion. rAF is tied to the compositor/vsync and keeps firing at full rate
 * during touch, so the animation clock stays real-time regardless of input.
 *
 * A time accumulator preserves the original contract — `tick` is an integer that
 * increments once per `TICK_MS` of elapsed wall-clock — so all downstream
 * `durationMs / TICK_MS` frame math is unchanged. rAF cadence (16.7ms @ 60Hz,
 * 8.3ms @ 120Hz) is finer than a tick, so we emit 0 or 1 tick per frame under
 * normal conditions; the catch-up is capped so returning from a hidden tab (rAF
 * pauses while hidden) doesn't fast-forward the world by hundreds of ticks.
 */
@Injectable({ providedIn: 'root' })
export class GameLoopService {
  static readonly TICK_MS = 30;
  /** Max ticks emitted from a single frame — bounds catch-up after a long
   * pause (hidden tab / stalled main thread) so the sim steps forward a few
   * ticks instead of teleporting. */
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
        // Emit the tick INSIDE the zone so zone.js drives change detection for
        // the frame render — same as the old in-zone setInterval. The rAF loop
        // itself stays outside the zone so the many no-op frames (vsync is finer
        // than a tick) don't each trigger a wasted CD pass.
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
