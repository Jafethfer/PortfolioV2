import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { StageTransitionService } from '../../services/stage-transition.service';

/** Grid dimensions. More cells = smaller squares = finer dissolve. */
const COLS = 24;
const ROWS = 14;

/** Spread (ms) of the per-tile stagger. Combined with the cell's CSS opacity
 * transition this is the total fill/clear time — keep the service's
 * `_coverMs`/`_revealMs` comfortably above (cell transition + this). */
const MAX_DELAY_MS = 560;

/**
 * Fatal-Fury-Special-style grid-wipe overlay. A full-viewport grid of black
 * tiles, each with a scattered `transition-delay`, that fade in to cover the
 * screen and fade out to reveal it. Driven entirely by the
 * `StageTransitionService` signals — this component holds no state of its
 * own beyond the precomputed tile delays.
 */
@Component({
  selector: 'app-stage-transition',
  templateUrl: './stage-transition.html',
  styleUrl: './stage-transition.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StageTransition {
  private readonly _transition = inject(StageTransitionService);
  readonly covered = this._transition.covered;
  readonly active = this._transition.active;

  protected readonly cols = COLS;
  protected readonly rows = ROWS;

  /** One entry per grid cell, each with a scattered transition-delay so the
   * fill/clear reads as a dissolve rather than a uniform fade. A
   * multiplicative hash scrambles tile order deterministically (no
   * `Math.random`), and using the same delay for fill and clear means the
   * reveal mirrors the cover's pattern. */
  protected readonly tiles = Array.from({ length: COLS * ROWS }, (_, i) => {
    const total = COLS * ROWS;
    const scatter = ((i * 2654435761) % total) / total;
    return { delay: Math.round(scatter * MAX_DELAY_MS) };
  });
}
