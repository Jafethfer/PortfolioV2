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

/** One image in a stage layer animation. Subclasses feed an array of these to
 * `makeFrameCycle` for a `currentSrc` signal + `advance(tick)` method. */
export interface StageFrame {
  readonly src: string;
  readonly durationMs: number;
}

/**
 * Abstract stage base — owns the behavior every stage shares (character spawn,
 * edge detection, input forwarding, the per-tick loop, projectile lifetime),
 * not its layout. Subclasses supply their own template + SCSS and per-tick
 * rules. Mirrors the Character abstraction: visuals in the subclass, physics
 * plumbing in the base. Subclasses declare `#stageEl` + `#characterHost` in
 * their template and may override `_onAfterRender` / `_onTick` / `_onResize`.
 */
@Directive()
export abstract class Stage {
  /** Background music for the stage. Optional; registered with the mixer in
   * `_startStageMusic`, which owns its volume from then on. */
  protected readonly musicSrc?: string;

  /** Special-move rows for the controls legend. Published to the root-level
   * `<app-legend>` on render; empty hides the legend's Specials section. */
  protected readonly legendSpecials: readonly LegendSpecial[] = [];

  /** Per-tick scroll rates for ground panning when pinned at an edge. Plain
   * fields (not `input()`) because `withComponentInputBinding()` wipes any
   * input absent from the route's `data`. */
  protected readonly walkScrollRate: number = 20;
  protected readonly crouchScrollRate: number = 10;
  /** Reference stage width the scroll rates are calibrated against; the
   * effective rate scales by `width / referenceWidth` so the world scrolls the
   * same fraction of the stage per tick on any viewport. */
  protected readonly referenceWidth: number = REFERENCE_WIDTH;

  readonly characterClass = input.required<Type<Character>>();

  readonly stageEl = viewChild.required<ElementRef<HTMLElement>>('stageEl');
  readonly characterHost = viewChild.required('characterHost', { read: ViewContainerRef });
  readonly projectileHost = viewChild.required('projectileHost', { read: ViewContainerRef });

  /** Shared services so subclasses can read input state and the tick from
   * inside `_onTick`. */
  protected readonly input = inject(InputService);
  protected readonly loop = inject(GameLoopService);
  private readonly _router = inject(Router);
  private readonly _route = inject(ActivatedRoute);
  private readonly _transition = inject(StageTransitionService);
  private readonly _audio = inject(AudioService);
  private readonly _legend = inject(LegendService);

  /** Neighbour stage paths for Next/Previous nav, derived from the router
   * config order. `null` at the first/last stage. */
  private readonly _previousPath: string | null;
  private readonly _nextPath: string | null;

  /** Whether a neighbour stage exists in each direction. Forwarded to
   * `<app-parallax>` so it can hide the dead-end nav button. */
  readonly hasPreviousStage: boolean;
  readonly hasNextStage: boolean;

  private _rightLimit = signal(0);
  private _leftLimit = signal(0);
  readonly width = signal(0);

  /** Screen-x limits of the playable area (px). Read-only so subclasses can
   * compute world-progress metrics for movement-driven effects. */
  get rightLimit(): number {
    return this._rightLimit();
  }
  get leftLimit(): number {
    return this._leftLimit();
  }

  /** The spawned character instance. `null` until afterNextRender creates it. */
  readonly character = signal<Character | null>(null);
  private _characterRef?: ComponentRef<Character>;

  /** Live projectile component refs. Capped at 1 in `_spawnProjectile`; the
   * loop effect drains instances whose `expired()` signal is true. */
  private _projectileRefs = signal<ComponentRef<Projectile>[]>([]);

  /** True when any projectile is on screen. Forwarded into the character so
   * `_tryAttack` can suppress the whole cast (animation + voice) when the
   * concurrency cap is hit, not just the projectile spawn. */
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

  /** Publish this stage's specials to the root-level legend. Deferred to
   * `afterNextRender` because `legendSpecials` is a subclass field, unset
   * while the base constructor runs. */
  private _registerLegend(): void {
    afterNextRender(() => this._legend.setSpecials(this.legendSpecials));
  }

  /** Register this stage's OST with the mixer. Deferred to `afterNextRender`
   * because `musicSrc` is a subclass field, unset while the base constructor
   * runs. The mixer owns the volume from here on. */
  private _startStageMusic(): void {
    afterNextRender(() => {
      if (this.musicSrc) this._audio.setBgMusic(this.musicSrc);
    });
  }

  /** Resolve this stage's neighbour paths from the ordered router config. */
  private _resolveStageNeighbors(): { previous: string | null; next: string | null } {
    const stagePaths = this._router.config
      // Forward chain = the real stages plus the terminal `Closing` route; the
      // `''` Landing route has neither flag and stays excluded.
      .filter((r) => !!r.component && (!!r.data?.['characterClass'] || !!r.data?.['closing']))
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
   * signals. Runs on first render and on resize so `worldWidth` and the edge
   * limits always reflect the current viewport. */
  private _measureStage(): void {
    const rect = this.stageEl().nativeElement.getBoundingClientRect();
    this._rightLimit.set(rect.right);
    this._leftLimit.set(rect.left);
    this.width.set(rect.width);
  }

  /** Re-measure stage geometry + the character's layout on window resize. The
   * stage is sized in `vw`, so every `worldWidth`-derived distance changes with
   * the window. */
  private _wireResize(): void {
    const onResize = (): void => {
      // Capture the old width before re-measuring to hand the character the
      // exact scale factor.
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

  /** Instantiate a projectile into `#projectileHost`. Caps the on-screen count
   * at 1; extra requests are dropped so a button-mash doesn't queue waves. */
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

  /** Guards against a second nav trigger while the exit outro is playing. */
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

  /** Subclass hook — runs once after render, before the character spawns.
   * Override for one-time DOM init. */
  protected _onAfterRender(): void {}

  /** Subclass hook — called every tick after the character spawns. Override
   * for scroll/parallax/animation behavior. */
  protected _onTick(): void {}

  /** Subclass hook — runs on resize after geometry and the character have
   * re-measured. Override to re-derive cached viewport-dependent state. */
  protected _onResize(): void {}

  /** Shift every live projectile by `deltaX` so they stay anchored to the
   * world (not the screen) as the camera scrolls. Subclasses call this from
   * `_onTick` after scrolling; pass `-N` when the camera moves right by N. */
  protected shiftProjectiles(deltaX: number): void {
    if (deltaX === 0) return;
    for (const ref of this._projectileRefs()) {
      ref.instance.accumulated.update((x) => x + deltaX);
    }
  }

  /** Per-tick world-scroll distance (px) for the pinned-at-edge scroll. An
   * active special's own X velocity takes precedence; otherwise the walk/crouch
   * rate scaled by `width / referenceWidth`. */
  protected worldScrollRate(specialXVelocity: number): number {
    const specialV = Math.abs(specialXVelocity);
    if (specialV > 0) return specialV;
    const base = this.input.downKey() ? this.crouchScrollRate : this.walkScrollRate;
    return (base * this.width()) / this.referenceWidth;
  }

  /** Helper for subclasses with animated layers. Returns a `currentSrc` signal
   * to bind and an `advance(tick)` to call from `_onTick`. Single-frame inputs
   * stay static. */
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
