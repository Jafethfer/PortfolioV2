import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StageTransitionService } from '../../services/stage-transition.service';

/**
 * Closing / "thanks for visiting" screen — the terminal route (`end`), reached
 * past the final stage. Non-interactive, so (like `Landing`) it's kept out of
 * the gameplay chrome and the stage prev/next cycle; offers a step back to the
 * final stage or a Replay from the top.
 */
@Component({
  selector: 'app-closing',
  templateUrl: './closing.html',
  styleUrl: './closing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Closing {
  private readonly _transition = inject(StageTransitionService);
  private readonly _router = inject(Router);

  /** Path of the final playable stage — the last route carrying a
   * `characterClass`. Empty if none exist. */
  private readonly _lastStagePath =
    this._router.config
      .filter((r) => !!r.component && !!r.data?.['characterClass'])
      .map((r) => r.path ?? '')
      .at(-1) ?? '';

  /** Grid-wipe back into the final stage. */
  previous(): void {
    if (this._lastStagePath) this._transition.navigateTo('/' + this._lastStagePath);
  }

  /** Grid-wipe back to the title screen for another run-through. */
  replay(): void {
    this._transition.navigateTo('/');
  }
}
