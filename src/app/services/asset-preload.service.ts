import { Injectable, computed, inject, signal } from '@angular/core';
import { ASSET_GROUPS } from '../generated/asset-manifest';
import { AudioService } from './audio.service';

/** How many assets to fetch at once. Tuned for the HTTP/2 single-connection
 * multiplexing GitHub Pages serves over. */
const CONCURRENCY = 32;

const IMAGE = /\.(png|jpe?g|webp|avif|svg)$/i;
const AUDIO = /\.(mp3|wav|ogg)$/i;

/** What the visitor needs before the first playable screen (core + stage-1).
 * Start unlocks and the loading bar fills against THIS set only. */
const PRIORITY: readonly string[] = [...ASSET_GROUPS.core, ...ASSET_GROUPS['stage-1']];

/** Later-stage assets, streamed in the background once PRIORITY is warm. Not
 * reflected in `progress`/`done`. */
const DEFERRED: readonly string[] = [...ASSET_GROUPS['stage-2'], ...ASSET_GROUPS['stage-3']];

/**
 * Warms the cache with the assets in `ASSET_GROUPS` so gameplay never hitches on
 * a first-time fetch. The landing screen calls `start()`, binds its bar to
 * `progress`, and gates Start on `done`. Loading splits into `PRIORITY` (blocks
 * Start) and `DEFERRED` (background). Images are retained as `Image` objects,
 * audio is decoded to `AudioBuffer`s via `AudioService`, everything else warms
 * the HTTP cache. Failures still count toward progress so the bar can't wedge.
 */
@Injectable({ providedIn: 'root' })
export class AssetPreloadService {
  /** Progress is measured against PRIORITY only. */
  readonly total = PRIORITY.length;

  private readonly _loaded = signal(0);
  readonly loaded = this._loaded.asReadonly();

  /** 0 → 1. Reaches 1 when every PRIORITY asset has settled (loaded or errored). */
  readonly progress = computed(() => (this.total === 0 ? 1 : this._loaded() / this.total));
  readonly done = computed(() => this._loaded() >= this.total);

  private _started = false;
  /** Keeps preloaded images alive so the memory cache can't evict them. */
  private readonly _retained: HTMLImageElement[] = [];
  private readonly _audio = inject(AudioService);

  /** Kick off preloading once. Idempotent — safe to call from every landing
   * mount without re-running. */
  start(): void {
    if (this._started) return;
    this._started = true;
    void this._run();
  }

  private async _run(): Promise<void> {
    await this._preload(PRIORITY, true); // gates `done` / the loading bar
    await this._preload(DEFERRED, false); // background; invisible to the UI
  }

  /** Drain `list` through a fixed-size worker pool. When `counted`, each settled
   * asset advances `_loaded`; the background pass passes `false`. */
  private async _preload(list: readonly string[], counted: boolean): Promise<void> {
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < list.length) {
        const url = list[next++];
        await this._load(url);
        if (counted) this._loaded.update((n) => n + 1);
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  }

  private _load(url: string): Promise<void> {
    if (IMAGE.test(url)) {
      return new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = url;
        this._retained.push(img);
      });
    }
    // Decode SFX/voices into memory (see AudioService) so the first play never
    // pays a disk read + decode; other files just warm the HTTP cache.
    if (AUDIO.test(url)) return this._audio.decodeAndCache(url);
    return fetch(url)
      .then(() => undefined)
      .catch(() => undefined);
  }
}
