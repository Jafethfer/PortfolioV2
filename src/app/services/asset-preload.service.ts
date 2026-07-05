import { Injectable, computed, signal } from '@angular/core';
import { ASSET_GROUPS } from '../generated/asset-manifest';

/** How many assets to fetch at once. GitHub Pages serves over HTTP/2, so every
 * request multiplexes on a single connection (no 6-socket browser cap) and the
 * preload is latency-bound, not throttled — measured wall time roughly halves
 * going 6→12→24. 32 keeps the pipe saturated well within Fastly's concurrent
 * -stream budget without starving progress updates. */
const CONCURRENCY = 32;

const IMAGE = /\.(png|jpe?g|webp|avif|svg)$/i;

/** What the visitor needs before the first playable screen: shared UI/audio
 * (`core`) plus stage-1's sprites and OST. Start unlocks — and the loading bar
 * fills — against THIS set only. */
const PRIORITY: readonly string[] = [...ASSET_GROUPS.core, ...ASSET_GROUPS['stage-1']];

/** Everything for the later stages. Streamed in the background once PRIORITY is
 * warm, so navigation never blocks yet the cache is ready by the time the
 * visitor walks into stage-2/3. Not reflected in `progress`/`done`. */
const DEFERRED: readonly string[] = [...ASSET_GROUPS['stage-2'], ...ASSET_GROUPS['stage-3']];

/**
 * Warms the browser cache with the assets in `ASSET_GROUPS` (generated from
 * `public/assets` at build time) so gameplay never hitches on a first-time
 * fetch. The landing screen calls `start()` and binds its loading bar to
 * `progress`; `done` gates the Start button.
 *
 * Loading is split so the visitor isn't made to wait on stages they haven't
 * reached: `PRIORITY` (core + stage-1) blocks Start, then `DEFERRED` (stages
 * 2–3) preloads silently. On a bandwidth-constrained connection this is the
 * real win — HTTP/2 funnels every request through one connection, so deferring
 * ~13 MB of later-stage audio out of the blocking set is what stops the
 * "each download slower than the last" pile-up on the landing screen.
 *
 * Images are loaded via `Image` objects that are RETAINED on the service for
 * the app's lifetime — the same trick the character uses so the dev server's
 * `no-store` cache-control can't evict a decoded sprite before it's rendered.
 * Audio (and anything else) is fetched, which warms the HTTP cache.
 *
 * Failures don't block: a 404 or decode error still counts toward progress so
 * one missing file can't wedge the bar short of 100%.
 */
@Injectable({ providedIn: 'root' })
export class AssetPreloadService {
  /** Progress is measured against PRIORITY only — the bar reaches 100% (and
   * Start unlocks) once the first stage is warm, regardless of the background
   * work still streaming behind it. */
  readonly total = PRIORITY.length;

  private readonly _loaded = signal(0);
  readonly loaded = this._loaded.asReadonly();

  /** 0 → 1. Reaches 1 when every PRIORITY asset has settled (loaded or errored). */
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
    await this._preload(PRIORITY, true); // gates `done` / the loading bar
    await this._preload(DEFERRED, false); // background; invisible to the UI
  }

  /** Drain `list` through a fixed-size worker pool. When `counted`, each settled
   * asset advances `_loaded` (and thus the loading bar); the background pass
   * passes `false` so deferred stages don't move the visible progress. */
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
    return fetch(url)
      .then(() => undefined)
      .catch(() => undefined);
  }
}
