import {
  ComponentRef,
  DestroyRef,
  Directive,
  ElementRef,
  Signal,
  Type,
  ViewContainerRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { REFERENCE_WIDTH } from '../../constants/viewport';
import { AudioService } from '../../services/audio.service';
import { StageTransitionService } from '../../services/stage-transition.service';
import { Character } from '../character/character';
import { Projectile } from '../projectile/projectile';
import { ProjectileSpawnRequest } from '../../models/character';
import { InputService } from '../../services/input.service';
import { GameLoopService } from '../../services/game-loop.service';
import { LegendService, LegendSpecial } from '../../services/legend.service';

/** One image in a stage layer animation. Subclasses that animate a layer
 * (Joe's water shimmer, Joe's clapping audience) declare an array of
 * these and feed it to `makeFrameCycle` for a `currentSrc` signal +
 * `advance(tick)` method. Single-image layers don't need this — they can
 * just inline the URL. */
export interface StageFrame {
  readonly src: string;
  readonly durationMs: number;
}

/**
 * Abstract stage base — owns the *behavior* every stage shares, not its
 * layout. Each concrete subclass supplies its own template + SCSS and
 * implements its own per-tick rules (parallax pan vs. scroll-linked bg
 * vs. anything else). This mirrors the Character abstraction: layout and
 * visuals live in the subclass; the base handles physics-side plumbing.
 *
 * What the base owns:
 *   - Character spawn into a `#characterHost` slot the subclass declares
 *   - Edge detection (`blockedRight` / `blockedLeft`) from the
 *     `#stageEl` element's bounding box
 *   - Forwarding `worldWidth` + blocked flags into the character's inputs
 *   - A single game-loop tick effect that calls `_onTick()` each frame
 *   - Generic frame-cycling utility (`makeFrameCycle`) for any subclass
 *     that wants animated layers
 *   - Optional `musicSrc` for stages that wire up `<app-music-control>`
 *
 * What every subclass must declare in its template:
 *   - `#stageEl` — the playable-area container (used for edge limits)
 *   - `#characterHost` — an `<ng-container>` slot the spawn pipeline
 *     fills in
 *
 * What every subclass typically implements (all optional):
 *   - `_onAfterRender()` — one-time DOM init (centering scroll, etc.)
 *   - `_onTick()` — per-tick logic (scroll the ground, advance frame
 *     cycles, update parallax positions, etc.)
 */
@Directive()
export abstract class Stage {
  /** Background music for the stage. Optional — stages without an OST yet
   * leave it unset and no track is registered with the mixer. Started in
   * `_startStageMusic`; the global `<app-audio-mixer>` owns its volume. */
  protected readonly musicSrc?: string;

  /** Special-move rows for the controls legend, describing THIS stage's
   * character. Published to the root-level `<app-legend>` on render (the
   * Movement / Attacks rows are universal and stay in the legend template).
   * Default empty — a stage with no specials hides the legend's Specials
   * section. Override per stage. */
  protected readonly legendSpecials: readonly LegendSpecial[] = [];

  /** Per-tick scroll rates for ground panning when the character is
   * pinned at an edge. Plain protected fields (not `input()`) because
   * `withComponentInputBinding()` wipes any input not present in the
   * route's `data`. Subclasses override with `protected override readonly`. */
  protected readonly walkScrollRate: number = 20;
  protected readonly crouchScrollRate: number = 10;
  /** Reference stage width the scroll rates above are calibrated against; the
   * effective rate scales by `width / referenceWidth` so the world scrolls the
   * same FRACTION of the stage per tick on any viewport. Defaults to the shared
   * `REFERENCE_WIDTH` (same default the character uses); override per stage if
   * needed. */
  protected readonly referenceWidth: number = REFERENCE_WIDTH;

  readonly characterClass = input.required<Type<Character>>();

  readonly stageEl = viewChild.required<ElementRef<HTMLElement>>('stageEl');
  readonly characterHost = viewChild.required('characterHost', { read: ViewContainerRef });
  readonly projectileHost = viewChild.required('projectileHost', { read: ViewContainerRef });

  /** Shared services exposed to subclasses so they can read input state
   * and the game-loop tick from inside `_onTick`. Kept protected (not
   * exposed publicly) — the template never reads these directly. */
  protected readonly input = inject(InputService);
  protected readonly loop = inject(GameLoopService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _transition = inject(StageTransitionService);
  private readonly _audio = inject(AudioService);
  private readonly _legend = inject(LegendService);

  /** Resolved neighbour stage paths for Next/Previous navigation, derived
   * from the router config order (single source of truth — no separate
   * stage list to keep in sync). `null` at the first/last stage. */
  private readonly _previousPath: string | null;
  private readonly _nextPath: string | null;

  /** Whether a neighbour stage exists in each direction. Forwarded into
   * `<app-parallax [hasNext] [hasPrevious]>` so it can hide the dead-end
   * nav button. */
  readonly hasPreviousStage: boolean;
  readonly hasNextStage: boolean;

  private _rightLimit = signal(0);
  private _leftLimit = signal(0);
  readonly width = signal(0);

  /** Screen-x limits of the playable area (px). Exposed read-only so
   * subclasses can compute world-progress metrics (e.g. how far Terry has
   * walked across the stage) for movement-driven effects. */
  get rightLimit(): number {
    return this._rightLimit();
  }
  get leftLimit(): number {
    return this._leftLimit();
  }

  /** The spawned character instance. `null` until afterNextRender creates it. */
  readonly character = signal<Character | null>(null);
  private _characterRef?: ComponentRef<Character>;

  /** Live projectile component refs. Concurrency v1 is capped at 1 in
   * `_spawnProjectile` — additional spawn requests while a projectile
   * is on screen are dropped on the floor. Per-tick drain in the loop
   * effect destroys instances whose `expired()` signal is true. */
  private _projectileRefs = signal<ComponentRef<Projectile>[]>([]);

  /** True when any projectile is on screen. Forwarded into the
   * character as an input so its `_tryAttack` can suppress the entire
   * cast (animation + voice cues) when the concurrency cap is hit — not
   * just the projectile spawn. Without this, the cast animation plays
   * pointlessly while the spawn is silently dropped. */
  readonly hasActiveProjectile = computed(() => this._projectileRefs().length > 0);

  readonly blockedRight = computed(() => {
    const c = this.character();
    if (!c || !c.ready()) return false;
    return c.worldX() >= this._rightLimit() - c.width();
  });

  readonly blockedLeft = computed(() => {
    const c = this.character();
    if (!c || !c.ready()) return false;
    return c.worldX() < this._leftLimit();
  });

  constructor() {
    const { previous, next } = this._resolveStageNeighbors();
    this._previousPath = previous;
    this._nextPath = next;
    this.hasPreviousStage = previous !== null;
    this.hasNextStage = next !== null;

    this._spawnCharacterOnRender();
    this._forwardInputsToCharacter();
    this._wireProjectileSpawns();
    this._runGameLoop();
    this._wireResize();
    this._startStageMusic();
    this._registerLegend();
  }

  /** Publish this stage's specials to the root-level legend once rendered.
   * Deferred to `afterNextRender` for the same reason as `musicSrc`:
   * `legendSpecials` is a subclass field, not yet set while the base
   * constructor runs. */
  private _registerLegend(): void {
    afterNextRender(() => this._legend.setSpecials(this.legendSpecials));
  }

  /** Register this stage's OST with the audio mixer once rendered. Deferred to
   * `afterNextRender` because `musicSrc` is a subclass field, not yet
   * initialized while the base constructor runs. The mixer's music slider owns
   * the volume from here on; autoplay-blocked starts resume on first input. */
  private _startStageMusic(): void {
    afterNextRender(() => {
      if (this.musicSrc) this._audio.setBgMusic(this.musicSrc);
    });
  }

  /** Resolve this stage's neighbour paths from the ordered router config. Only
   * entries with a `component` are real stages (the `''` redirect is skipped).
   * Read once — the component is freshly created on each navigation. */
  private _resolveStageNeighbors(): { previous: string | null; next: string | null } {
    const stagePaths = this._router.config
      // Only real stages count — the `''` Landing route has a component but no
      // `characterClass`, so it's excluded from the prev/next cycle.
      .filter((r) => !!r.component && !!r.data?.['characterClass'])
      .map((r) => r.path ?? '');
    const idx = stagePaths.indexOf(this._route.snapshot.routeConfig?.path ?? '');
    return {
      previous: idx > 0 ? stagePaths[idx - 1] : null,
      next: idx >= 0 && idx < stagePaths.length - 1 ? stagePaths[idx + 1] : null,
    };
  }

  /** Measure stage geometry, run the subclass's one-time DOM hook, then spawn
   * the character — in that order so setup happens on the empty stage before
   * the character drops in on top. */
  private _spawnCharacterOnRender(): void {
    afterNextRender(() => {
      this._measureStage();
      this._onAfterRender();
      this._characterRef = this.characterHost().createComponent(this.characterClass());
      this.character.set(this._characterRef.instance);
    });
  }

  /** Measure the playable area's screen geometry into the limit + width
   * signals. Driven both on first render and on viewport resize, so
   * `worldWidth` (which sizes jump/special travel and is forwarded to the
   * character) and the edge limits always reflect the CURRENT viewport. */
  private _measureStage(): void {
    const rect = this.stageEl().nativeElement.getBoundingClientRect();
    this._rightLimit.set(rect.right);
    this._leftLimit.set(rect.left);
    this.width.set(rect.width);
  }

  /** Re-measure stage geometry + the character's layout on window resize. The
   * stage is sized in `vw`, so its width (and thus every viewport-relative
   * distance derived from `worldWidth`) changes when the window does. Without
   * this, travel/scroll distances stay frozen at the spawn-time viewport. */
  private _wireResize(): void {
    const onResize = (): void => {
      // Capture the OLD width before re-measuring so we can hand the character
      // the exact scale factor — `width` is the stage's own signal, updated
      // synchronously here, so there's no async-input lag to trip over.
      const prevWidth = this.width();
      this._measureStage();
      const ratio = prevWidth > 0 ? this.width() / prevWidth : 1;
      this.character()?.remeasure(ratio);
      this._onResize();
    };
    window.addEventListener('resize', onResize);
    inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', onResize));
  }

  /** Forward Stage-computed signals into the spawned character's inputs. The
   * effect activates once the character exists, then re-runs on any change. */
  private _forwardInputsToCharacter(): void {
    effect(() => {
      const inst = this.character();
      if (!inst || !this._characterRef) return;
      this._characterRef.setInput('worldWidth', this.width());
      this._characterRef.setInput('blockedRight', this.blockedRight());
      this._characterRef.setInput('blockedLeft', this.blockedLeft());
      this._characterRef.setInput('projectileActive', this.hasActiveProjectile());
    });
  }

  /** Subscribe to the character's projectile-spawn output; each emit spawns
   * the configured component into `#projectileHost`. Unhooks when the
   * character changes or the directive tears down. */
  private _wireProjectileSpawns(): void {
    effect((onCleanup) => {
      const inst = this.character();
      if (!inst) return;
      const sub = inst.projectileSpawnRequested.subscribe((req) => {
        untracked(() => this._spawnProjectile(req));
      });
      onCleanup(() => sub.unsubscribe());
    });
  }

  /** Per-tick loop: run the subclass hook (once the character exists) and
   * sweep expired projectiles. */
  private _runGameLoop(): void {
    effect(() => {
      this.loop.tick();
      untracked(() => {
        if (this.character()) this._onTick();
        this._sweepExpiredProjectiles();
      });
    });
  }

  /** Destroy projectiles whose `expired()` signal is true. O(n) over the live
   * count — fine at the concurrency cap of 1. */
  private _sweepExpiredProjectiles(): void {
    const refs = this._projectileRefs();
    const live = refs.filter((r) => {
      if (r.instance.expired()) {
        r.destroy();
        return false;
      }
      return true;
    });
    if (live.length !== refs.length) this._projectileRefs.set(live);
  }

  /** Instantiate a projectile into `#projectileHost`. Concurrency v1
   * caps the on-screen count at 1 — additional requests are dropped
   * so a button-mash doesn't queue waves indefinitely. */
  private _spawnProjectile(req: ProjectileSpawnRequest): void {
    if (this._projectileRefs().length > 0) return;
    const cls = req.config.componentClass as Type<Projectile>;
    const ref = this.projectileHost().createComponent(cls);
    ref.setInput('worldWidth', this.width());
    ref.setInput('spawnX', req.worldX);
    ref.setInput('spawnY', req.worldY);
    ref.setInput('direction', req.direction);
    ref.setInput('leftLimit', this._leftLimit());
    ref.setInput('rightLimit', this._rightLimit());
    ref.setInput('speedOverride', req.config.speed);
    ref.setInput('travelDistancePctOverride', req.config.travelDistancePct);
    this._projectileRefs.update((list) => [...list, ref]);
  }

  /** Navigate to the next/previous stage. No-ops at the ends (the nav
   * buttons are hidden there anyway). Bound from the parallax's
   * `(next)` / `(previous)` outputs in each stage's template. */
  /** Guards against a second nav trigger while the exit outro is already
   * playing (the nav buttons stay live until the loading cover starts). */
  private _leaving = false;

  goToNextStage(): void {
    if (this._nextPath) this._leaveTo(this._nextPath);
  }

  goToPreviousStage(): void {
    if (this._previousPath) this._leaveTo(this._previousPath);
  }

  /** Play the character's stage-exit outro (back-dash → hat-throw), then run
   * the loading transition into `path`. */
  private async _leaveTo(path: string): Promise<void> {
    if (this._leaving) return;
    this._leaving = true;
    await this.character()?.playOutro();
    this._transition.navigateTo('/' + path);
  }

  /** Subclass hook — runs once after the stage view is rendered and
   * before the character is spawned. Override to do one-time DOM init
   * (e.g. centering a scrollable element's `scrollLeft`). */
  protected _onAfterRender(): void {}

  /** Subclass hook — called every game-loop tick after the character is
   * spawned. Override to implement scroll/parallax/animation behavior. */
  protected _onTick(): void {}

  /** Subclass hook — runs on viewport resize, after the stage geometry and
   * the character have re-measured. Override to re-derive any cached
   * viewport-dependent state (e.g. a scroll-progress baseline). */
  protected _onResize(): void {}

  /** Apply a world-scroll shift to every live projectile so they stay
   * anchored to the world (not the screen) as the camera moves.
   * Subclasses call this from `_onTick` after scrolling, with `deltaX`
   * = the per-tick screen offset every world-fixed point should
   * receive. For a Terry-style train scroll: when `train.scrollLeft`
   * increases by N (camera moves right), pass `-N` so projectiles
   * shift left to match. Without this, projectiles drift in screen
   * relative to the world as Terry walks at the stage edge. */
  protected shiftProjectiles(deltaX: number): void {
    if (deltaX === 0) return;
    for (const ref of this._projectileRefs()) {
      ref.instance.accumulated.update((x) => x + deltaX);
    }
  }

  /** Per-tick world-scroll distance (px) for the current frame, used by every
   * stage's pinned-at-edge scroll. A special's own X velocity (already
   * viewport-relative) takes precedence when active; otherwise the walk/crouch
   * scroll rate, scaled by `width / referenceWidth` so the world scrolls the
   * same fraction of the stage per tick on any viewport. */
  protected worldScrollRate(specialXVelocity: number): number {
    const specialV = Math.abs(specialXVelocity);
    if (specialV > 0) return specialV;
    const base = this.input.downKey() ? this.crouchScrollRate : this.walkScrollRate;
    return (base * this.width()) / this.referenceWidth;
  }

  /** Helper for subclasses with animated layers. Returns a `currentSrc`
   * signal (bind it to `[src]` or `[style.background-image]`) and an
   * `advance(tick)` method to call from `_onTick`. Single-frame inputs
   * are static — `advance` early-returns and `currentSrc` is constant. */
  protected makeFrameCycle(frames: readonly StageFrame[]): {
    readonly currentSrc: Signal<string>;
    advance(tick: number): void;
  } {
    const idx = signal(0);
    let startTick = 0;
    const currentSrc = computed(() => frames[idx()]?.src ?? '');
    return {
      currentSrc,
      advance: (tick: number) => {
        if (frames.length <= 1) return;
        const cur = frames[idx()];
        if (!cur) return;
        const durTicks = Math.round(cur.durationMs / GameLoopService.TICK_MS);
        if (tick - startTick < durTicks) return;
        idx.set((idx() + 1) % frames.length);
        startTick = tick;
      },
    };
  }
}
