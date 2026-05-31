import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Fatal-Fury-Special-style stage transition. Drives the grid-wipe overlay
 * (`<app-stage-transition>`): black tiles scatter-fill the screen, the route
 * swaps under cover, then the tiles scatter-clear to reveal the new stage.
 *
 * The overlay component is purely presentational — it just reads `covered`
 * and `active`. This service owns the timing and the actual navigation so
 * the sequencing lives in one place and any stage (or anything else) can
 * trigger a transition via `navigateTo`.
 */
@Injectable({ providedIn: 'root' })
export class StageTransitionService {
  private readonly _router = inject(Router);

  /** True while the tiles should be filled in (black). The overlay animates
   * each tile's opacity toward this value with a per-tile stagger, so
   * flipping it produces the scatter fill (true) / clear (false). */
  readonly covered = signal(false);

  /** True for the whole transition (cover → swap → reveal). Blocks pointer
   * input via the overlay and guards against overlapping transitions. */
  readonly active = signal(false);

  /** Cover/reveal durations (ms). Must exceed the overlay's per-tile opacity
   * transition plus its max stagger delay, so the screen is fully black
   * before we navigate and fully clear before we mark the transition done.
   * Keep in sync with the timings in `stage-transition` (cell transition +
   * `MAX_DELAY_MS`). */
  private readonly _coverMs = 720;
  private readonly _revealMs = 720;

  /** Small beat after navigation so the new stage paints under the cover
   * before the tiles start clearing (avoids a flash of the old/new swap). */
  private readonly _swapMs = 80;

  /** How long to hold the fully-black "Now Loading" screen after the stage
   * has actually swapped. The route change is near-instant, so this is a
   * deliberate dwell to sell the loading beat (Fatal Fury keeps you on the
   * black screen briefly). Tune to taste. */
  private readonly _holdMs = 1100;

  /** Run the full transition around a navigation to `url`. No-ops if a
   * transition is already in flight. */
  async navigateTo(url: string): Promise<void> {
    if (this.active()) return;
    this.active.set(true);

    this.covered.set(true); // tiles scatter-fill to black
    await this._delay(this._coverMs);

    await this._router.navigateByUrl(url); // swap stage under cover
    await this._delay(this._swapMs);

    // Dwell on the black screen so the load actually registers.
    await this._delay(this._holdMs);

    this.covered.set(false); // tiles scatter-clear to reveal
    await this._delay(this._revealMs);

    this.active.set(false);
  }

  private _delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
