import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { StageTransitionService } from '../../services/stage-transition.service';

/**
 * Title / landing screen — the app's entry route (`''`). Sits in the same 16:9
 * frame as a stage (`:host { display: contents }` + a 75%-wide `aspect-video`
 * container, centered by the app's `.page`) and hands off to stage-1 through the
 * shared loading grid-wipe when the player hits Start.
 *
 * Not a `Stage` (no character / physics / route `characterClass`), so it's
 * excluded from the stage prev/next navigation — see `_resolveStageNeighbors`.
 */
@Component({
  selector: 'app-landing',
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Landing {
  private readonly _transition = inject(StageTransitionService);

  /** Cover the screen with the loading grid-wipe, then reveal stage-1. */
  start(): void {
    this._transition.navigateTo('/stage-1');
  }
}
