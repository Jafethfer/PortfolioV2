import { Injectable, computed, signal } from '@angular/core';
import { ASSET_MANIFEST } from '../generated/asset-manifest';

/** How many assets to fetch at once. Enough to saturate the pipe without
 * opening 300 sockets and stalling early progress updates. */
const CONCURRENCY = 12;

const IMAGE = /\.(png|jpe?g|webp|avif|gif|svg)$/i;

/**
 * Warms the browser cache with every asset in `ASSET_MANIFEST` (generated from
 * `public/assets` at build time) so gameplay never hitches on a first-time
 * fetch. The landing screen calls `start()` and binds its loading bar to
 * `progress`; `done` gates the Start button.
 *
 * Images are loaded via `Image` objects that are RETAINED on the service for
 * the app's lifetime — the same trick the character uses so the dev server's
 * `no-store` cache-control can't evict a decoded sprite before it's rendered.
 * Audio (and anything else) is fetched, which warms the HTTP cache for
 * production's long-cache headers.
 *
 * Failures don't block: a 404 or decode error still counts toward progress so
 * one missing file can't wedge the bar short of 100%.
 */
@Injectable({ providedIn: 'root' })
export class AssetPreloadService {
  readonly total = ASSET_MANIFEST.length;

  private readonly _loaded = signal(0);
  readonly loaded = this._loaded.asReadonly();

  /** 0 → 1. Reaches 1 when every asset has settled (loaded or errored). */
  readonly progress = computed(() => (this.total === 0 ? 1 : this._loaded() / this.total));
  readonly done = computed(() => this._loaded() >= this.total);

  private _started = false;
  /** Keeps preloaded images alive so the memory cache can't evict them. */
  private readonly _retained: HTMLImageElement[] = [];

  /** Kick off preloading once. Idempotent — safe to call from every landing
   * mount without re-running. */
  start(): void {
    if (this._started) return;
    this._started = true;
    void this._run();
  }

  private async _run(): Promise<void> {
    let next = 0;
    const worker = async (): Promise<void> => {
      while (next < ASSET_MANIFEST.length) {
        const url = ASSET_MANIFEST[next++];
        await this._load(url);
        this._loaded.update((n) => n + 1);
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
    return fetch(url)
      .then(() => undefined)
      .catch(() => undefined);
  }
}
