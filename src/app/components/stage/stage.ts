import {
  ComponentRef,
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
import { Character } from '../character/character';
import { Projectile } from '../projectile/projectile';
import { ProjectileSpawnRequest } from '../../models/character';
import { InputService } from '../../services/input.service';
import { GameLoopService } from '../../services/game-loop.service';

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
  /** Background music for the stage. Optional — stages without an OST
   * yet can omit the music-control button in their template. */
  protected readonly musicSrc?: string;

  /** Per-tick scroll rates for ground panning when the character is
   * pinned at an edge. Plain protected fields (not `input()`) because
   * `withComponentInputBinding()` wipes any input not present in the
   * route's `data`. Subclasses override with `protected override readonly`. */
  protected readonly walkScrollRate: number = 20;
  protected readonly crouchScrollRate: number = 10;

  readonly characterClass = input.required<Type<Character>>();

  readonly stageEl = viewChild.required<ElementRef<HTMLElement>>('stageEl');
  readonly characterHost = viewChild.required('characterHost', { read: ViewContainerRef });
  readonly projectileHost = viewChild.required('projectileHost', { read: ViewContainerRef });

  /** Shared services exposed to subclasses so they can read input state
   * and the game-loop tick from inside `_onTick`. Kept protected (not
   * exposed publicly) — the template never reads these directly. */
  protected readonly input = inject(InputService);
  protected readonly loop = inject(GameLoopService);

  private _rightLimit = signal(0);
  private _leftLimit = signal(0);
  readonly width = signal(0);

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
    afterNextRender(() => {
      const rect = this.stageEl().nativeElement.getBoundingClientRect();
      this._rightLimit.set(rect.right);
      this._leftLimit.set(rect.left);
      this.width.set(rect.width);

      // Subclass hook for one-time DOM setup — runs BEFORE the character
      // spawns so things like initial scroll centering happen on the
      // empty stage, then the character drops in on top.
      this._onAfterRender();

      this._characterRef = this.characterHost().createComponent(this.characterClass());
      this.character.set(this._characterRef.instance);
    });

    // Forward Stage-computed signals into the character's inputs. Reading
    // `character()` here means this effect activates once the character is
    // spawned, then re-runs whenever any forwarded signal changes.
    effect(() => {
      const inst = this.character();
      if (!inst || !this._characterRef) return;
      this._characterRef.setInput('worldWidth', this.width());
      this._characterRef.setInput('blockedRight', this.blockedRight());
      this._characterRef.setInput('blockedLeft', this.blockedLeft());
      this._characterRef.setInput('projectileActive', this.hasActiveProjectile());
    });

    // Subscribe to the character's projectile-spawn output once it's
    // spawned. Each emit triggers `_spawnProjectile` which creates the
    // configured component into `#projectileHost`. `onCleanup` unhooks
    // when the character changes or this directive tears down.
    effect((onCleanup) => {
      const inst = this.character();
      if (!inst) return;
      const sub = inst.projectileSpawnRequested.subscribe((req) => {
        untracked(() => this._spawnProjectile(req));
      });
      onCleanup(() => sub.unsubscribe());
    });

    // Per-tick subclass hook + projectile cleanup. Gated on `character()`
    // so subclass logic doesn't run before the character exists.
    effect(() => {
      this.loop.tick();
      untracked(() => {
        if (this.character()) this._onTick();
        // Sweep expired projectiles. O(n) over live count — fine at the
        // concurrency cap of 1.
        const refs = this._projectileRefs();
        const live = refs.filter((r) => {
          if (r.instance.expired()) {
            r.destroy();
            return false;
          }
          return true;
        });
        if (live.length !== refs.length) this._projectileRefs.set(live);
      });
    });
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

  /** Subclass hook — runs once after the stage view is rendered and
   * before the character is spawned. Override to do one-time DOM init
   * (e.g. centering a scrollable element's `scrollLeft`). */
  protected _onAfterRender(): void {}

  /** Subclass hook — called every game-loop tick after the character is
   * spawned. Override to implement scroll/parallax/animation behavior. */
  protected _onTick(): void {}

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
