import {
  ChangeDetectionStrategy,
  Component,
  effect,
  signal,
  untracked,
} from '@angular/core';
import { AnimationFrame } from '../models/character';
import { GameLoopService } from '../services/game-loop.service';
import { Projectile } from '../components/projectile/projectile';
import { HAT_FRAMES } from './hat-frames';

/** Flight length (ticks) from the throw to touching the ground. Exported as
 * ms too so the character's outro can wait for the cap to land before
 * starting the loading transition (keep the two in sync). */
export const HAT_FLIGHT_TICKS = 30;
export const HAT_FLIGHT_MS = HAT_FLIGHT_TICKS * GameLoopService.TICK_MS;

/**
 * Terry's flying cap — the hat he tosses during the victory outro. Unlike
 * the horizontally-travelling Power Wave, the hat arcs: it launches from his
 * raised hand, rises to a peak while drifting forward, and falls all the way
 * to the GROUND, spinning the whole way. On landing it freezes and rests in
 * place (no despawn) until the stage navigates away.
 *
 * We disable the base's X advance / distance-cap despawn (`speed = 0`,
 * infinite travel) and own the motion here.
 */
@Component({
  selector: 'app-hat',
  templateUrl: '../components/projectile/projectile.html',
  styleUrl: './hat.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Hat extends Projectile {
  protected override readonly frames = { frames: HAT_FRAMES, loop: true };
  protected override readonly heightBaseline = 18;
  protected override readonly speed = 0;
  protected override readonly travelDistancePct = Number.POSITIVE_INFINITY;

  /** Extra lift of the toss above the straight hand→ground line (how high the
   * cap pops up at the apex), as a fraction of the stage width. The stage is a
   * fixed 16:9, so a width-fraction scales the vertical arc proportionally
   * with the scene on any viewport. */
  private readonly _peakPct = 0.236;
  /** Forward (X) travel over the whole flight, as a fraction of the stage
   * width — so the toss covers the same proportion of the scene regardless
   * of viewport size (instead of a fixed px that looks short on big screens
   * / long on small ones). */
  private readonly _forwardPct = 0.42;
  private readonly _flightTicks = HAT_FLIGHT_TICKS;

  /** Ticks since spawn, capped at `_flightTicks` (landed). */
  private readonly _tick = signal(0);

  constructor() {
    super();
    effect(() => {
      this._loop.tick();
      untracked(() => {
        const t = this._tick();
        if (t >= this._flightTicks) {
          // Landed: freeze the spin on the resting frame (8, the flat cap)
          // and stop advancing. The cap rests on the ground until the stage
          // is torn down on nav.
          this.currentFrameIndex.set(8);
          return;
        }
        this._tick.set(t + 1);
      });
    });
  }

  override frameTransform(_frame: AnimationFrame): string {
    const t = Math.min(1, this._tick() / this._flightTicks);
    // Height above the ground line. `spawnY` is the hand offset (negative =
    // above ground), so `-spawnY` is the launch height. Linearly descend from
    // there to 0 (ground) at t = 1, plus a parabolic pop that peaks mid-flight.
    const launchPx = -this.spawnY();
    const peakPx = this.worldWidth() * this._peakPct;
    const height = launchPx * (1 - t) + peakPx * 4 * t * (1 - t);
    const x = this.accumulated() + this.worldWidth() * this._forwardPct * t;
    return `translateX(${x}px) translateY(${-height}px)`;
  }
}
