import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { StageTransitionService } from '../../services/stage-transition.service';
import { AssetPreloadService } from '../../services/asset-preload.service';
import { AudioService } from '../../services/audio.service';

/**
 * Title / landing screen — the app's entry route (`''`); hands off to stage-1
 * through the loading grid-wipe on Start. Not a `Stage`, so it's excluded from
 * the stage prev/next navigation.
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
    // Warm the asset cache while the title screen shows, so assets are ready by Start.
    this._assets.start();
    // Silence any stage track still looping when we land here (e.g. Replay).
    this._audio.pauseBgMusic();
  }

  /** Grid-wipe into stage-1. No-op until assets finish preloading. */
  start(): void {
    if (!this.ready()) return;
    this._transition.navigateTo('/stage-1');
  }
}
