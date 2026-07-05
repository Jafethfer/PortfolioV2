import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { StageTransitionService } from '../../services/stage-transition.service';
import { AssetPreloadService } from '../../services/asset-preload.service';
import { AudioService } from '../../services/audio.service';

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
  private readonly _assets = inject(AssetPreloadService);
  private readonly _audio = inject(AudioService);

  /** Preload progress for the loading bar; Start unlocks when `ready` is true. */
  readonly progress = this._assets.progress;
  readonly ready = this._assets.done;
  readonly percent = computed(() => Math.round(this.progress() * 100));

  constructor() {
    // Warm the asset cache the moment the title screen appears, so everything
    // is decoded/fetched by the time the visitor hits Start.
    this._assets.start();
    // Silence any stage track still looping when we land here — e.g. Replay from
    // the closing screen. The closing screen deliberately lets the last stage's
    // music ride; the title screen should be quiet. No-op on first load (nothing
    // playing yet); a fresh stage swaps in its own OST on the next run.
    this._audio.pauseBgMusic();
  }

  /** Cover the screen with the loading grid-wipe, then reveal stage-1. No-op
   * until assets finish preloading (the button is disabled until then). */
  start(): void {
    if (!this.ready()) return;
    this._transition.navigateTo('/stage-1');
  }
}
