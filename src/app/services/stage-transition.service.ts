import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

/**
 * Fatal-Fury-Special-style stage transition. Drives the grid-wipe overlay
 * (`<app-stage-transition>`): black tiles scatter-fill, the route swaps under
 * cover, then the tiles scatter-clear. Owns the timing and the navigation so
 * anything can trigger a transition via `navigateTo`.
 */
@Injectable({ providedIn: 'root' })
export class StageTransitionService {
  private readonly _router = inject(Router);

  /** True while the tiles should be filled (black); flipping it drives the
   * scatter fill (true) / clear (false). */
  readonly covered = signal(false);

  /** True for the whole transition; blocks pointer input and guards against
   * overlapping transitions. */
  readonly active = signal(false);

  /** Cover/reveal durations (ms). Must exceed the overlay's per-tile transition
   * plus its max stagger delay. Keep in sync with `stage-transition`. */
  private readonly _coverMs = 720;
  private readonly _revealMs = 720;

  /** Beat after navigation so the new stage paints before the tiles clear. */
  private readonly _swapMs = 80;

  /** Deliberate dwell on the black "Now Loading" screen after the swap. */
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
