import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { StageTransitionService } from '../../services/stage-transition.service';

/**
 * Closing / "thanks for visiting" screen — the terminal route (`end`), reached
 * when the visitor advances past the final stage. Non-interactive: no
 * character, physics, or route `characterClass`, so (like `Landing`) it's kept
 * out of the gameplay chrome (legend + audio mixer) and the stage prev/next
 * cycle. Shares the title screen's typography/palette so the run bookends
 * cleanly, and offers a step back to the final stage or a Replay from the top.
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

  /** Path of the final playable stage (the one this screen follows) — the last
   * route carrying a `characterClass`, derived from the config so it stays
   * correct if stages are added. Empty if somehow none exist. */
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
