import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { StageTransitionService } from '../../services/stage-transition.service';

/** Grid dimensions. More cells = smaller squares = finer dissolve. */
const COLS = 24;
const ROWS = 14;

/** Spread (ms) of the per-tile stagger. Keep the service's `_coverMs`/
 * `_revealMs` above the cell transition plus this. */
const MAX_DELAY_MS = 560;

/**
 * Grid-wipe overlay: a full-viewport grid of black tiles with scattered
 * `transition-delay`s that fade in to cover the screen and out to reveal it.
 * Driven entirely by `StageTransitionService` signals.
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

  /** One entry per grid cell with a scattered transition-delay so the fill/clear
   * reads as a dissolve. A multiplicative hash scrambles tile order
   * deterministically; the same delay serves fill and clear. */
  protected readonly tiles = Array.from({ length: COLS * ROWS }, (_, i) => {
    const total = COLS * ROWS;
    const scatter = ((i * 2654435761) % total) / total;
    return { delay: Math.round(scatter * MAX_DELAY_MS) };
  });
}
