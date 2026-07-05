import {
  Directive,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { AnimationData, AnimationFrame, Direction } from '../../models/character';
import { GameLoopService } from '../../services/game-loop.service';
import { AudioService } from '../../services/audio.service';
import { REFERENCE_WIDTH } from '../../constants/viewport';

/**
 * Abstract projectile base. Mirrors `Character` in structure — owns
 * per-tick physics (X advance), per-frame animation advance, and the
 * absolute-positioned <img> render. Concrete subclasses (e.g.
 * `PowerWave`) supply their own sprite data and tunables.
 *
 * Coordinate system: the projectile is added to the stage's
 * `#projectileHost` slot as an absolute-positioned `<img>` anchored to
 * `bottom: 0; left: 0;` of the parent. Translation is done via
 * `transform: translateX(...)` with `accumulated` as the per-tick X
 * offset from the host's left edge.
 *
 * Lifetimes: a constructor `effect()` advances physics each tick; when
 * the projectile travels `worldWidth × travelDistancePct` from spawn,
 * `expired` flips to true. The Stage's per-tick drain destroys the
 * component once `expired()` returns true, so it doesn't accumulate
 * dead instances.
 */
@Directive()
export abstract class Projectile {
  /** Stage width in px — used to compute the travel-distance threshold
   * before despawn. */
  readonly worldWidth = input.required<number>();
  /** Absolute screen-X at which the projectile spawns. The projectile
   * converts this to an offset relative to its own host's left edge
   * after `afterNextRender` measures that edge. */
  readonly spawnX = input.required<number>();
  /** Vertical offset from the ground line (rendered px, negative = up),
   * threaded from `SpecialMove.projectile.spawnOffsetY` via the stage. Lifts
   * the projectile to the caster's hand height; 0 hugs the floor (Power Wave). */
  readonly spawnY = input(0);
  /** Direction of travel. `'left'` is reserved for when characters can
   * flip; defaults to `'right'`. `null` falls back to right. */
  readonly direction = input<Direction>('right');
  /** Stage edge X (absolute screen px). Used by the defensive
   * off-screen despawn — fires if the projectile travels beyond the
   * visible stage even before the travelDistancePct cap. */
  readonly leftLimit = input(0);
  readonly rightLimit = input(Number.POSITIVE_INFINITY);
  /** Per-cast speed override (px/tick). When undefined the projectile
   * uses its class-level `speed`. Threaded through from
   * `SpecialMove.projectile.speed` by the stage so light/heavy
   * variants of the same special can share the projectile class. */
  readonly speedOverride = input<number | undefined>(undefined);
  readonly travelDistancePctOverride = input<number | undefined>(undefined);

  /** Per-tick X offset relative to the host slot's left edge. */
  readonly accumulated = signal(0);
  readonly currentFrameIndex = signal(0);
  /** Flips to true when the projectile reaches its travel cap. The
   * stage watches this and destroys the ComponentRef on the next tick. */
  readonly expired = signal(false);

  /** Subclasses must provide. */
  protected abstract readonly frames: AnimationData;
  /** Px/tick advance, calibrated against `referenceWidth`. Default ~14
   * (≈ walk × 1.4 — reads as a clearly faster forward motion than the
   * character itself). The effective per-tick advance is scaled by
   * `worldWidth / referenceWidth` (see `_physicsTick`) so the wave covers
   * the same FRACTION of the stage per tick on any viewport — matching how
   * `Character` scales its walk speed and `Stage` its scroll rate. */
  protected readonly speed: number = 14;
  /** Reference stage width the `speed` above is calibrated against. Matches
   * the shared `REFERENCE_WIDTH` the character/stage use, so a wave keeps the
   * same speed RELATIONSHIP to the world-scroll rate on every viewport (it
   * must outpace the scroll or it gets dragged backward). */
  protected readonly referenceWidth: number = REFERENCE_WIDTH;
  /** Despawn cap, as a fraction of stage width travelled from spawn.
   * 1.2 means the projectile flies 120% of the stage width before
   * vanishing — covers the full visible area with room to spare. */
  protected readonly travelDistancePct: number = 1.2;
  /** Sprite-pixel reference height for the frame's `w/h` scaling. The
   * projectile's CSS `--projectile-height` var divides by this value
   * so a frame of `h === heightBaseline` renders exactly at that height. */
  protected readonly heightBaseline: number = 76;
  /** Frame index the loop returns to after the last frame. Frames before it
   * play once (an intro/build-up), then the steady loop runs from here.
   * Default 0 loops the whole strip. */
  protected readonly loopStartIndex: number = 0;

  /** Launch/flight SFX, played once when the projectile spawns. Optional —
   * subclasses set it (left undefined = silent). Played on the mixer's
   * `'sfx'` channel, so the SFX slider scales it. */
  protected readonly spawnSfx?: string;
  /** Volume the `spawnSfx` is authored at (pre-mixer level). */
  protected readonly spawnSfxVolume: number = 0.5;

  private _hostLeft = 0;
  private _startAccumulated = 0;
  private _frameStartTick = 0;
  private readonly _preloadedImages: HTMLImageElement[] = [];

  readonly el = viewChild<ElementRef<HTMLImageElement>>('el');
  protected readonly _loop = inject(GameLoopService);
  protected readonly _audio = inject(AudioService);

  readonly currentFrameData = computed<AnimationFrame | null>(
    () => this.frames.frames[this.currentFrameIndex()] ?? null,
  );

  frameTransform(_frame: AnimationFrame): string {
    // `accumulated` is the <img>'s left edge offset from the host's
    // left edge. The flame is centred in its cell so the visible
    // hot-spot is roughly cellWidth/2 to the right of the <img>'s left.
    // Tune `spawnOffsetX` (in sprite-px) on the SpecialMove side to
    // compensate. `spawnY` (rendered px, negative = up) lifts the projectile
    // off the ground line so it launches from the caster's hand height
    // instead of the floor — 0 keeps a ground-hugging wave.
    const y = this.spawnY();
    return y ? `translate(${this.accumulated()}px, ${y}px)` : `translateX(${this.accumulated()}px)`;
  }
  frameWidth(frame: AnimationFrame): string {
    return `calc(${frame.w} * var(--projectile-height) / ${this.heightBaseline})`;
  }
  frameHeight(frame: AnimationFrame): string {
    return `calc(${frame.h} * var(--projectile-height) / ${this.heightBaseline})`;
  }

  constructor() {
    // Stamp the spawn tick so the first frame gets its full duration. Without
    // this, `_frameStartTick` is 0 while `tick()` is a large running counter, so
    // the first `_advanceFrame` sees a huge elapsed time and skips frame 0.
    this._frameStartTick = this._loop.tick();

    afterNextRender(() => {
      const node = this.el()?.nativeElement;
      // Measure the host slot's left edge so we can convert the
      // absolute spawnX into a translateX offset.
      this._hostLeft = node ? node.getBoundingClientRect().x : 0;
      this._startAccumulated = this.spawnX() - this._hostLeft;
      this.accumulated.set(this._startAccumulated);

      // Launch SFX — fires as the projectile appears (the stage spawns it on
      // the special's release frame), so the whoosh syncs with the visual.
      this._audio.playVoice(this.spawnSfx, this.spawnSfxVolume, 'sfx');

      // Preload all frame images so the per-tick src change doesn't
      // flash while the next frame fetches.
      for (const frame of this.frames.frames) {
        const preload = new Image();
        preload.src = frame.src;
        this._preloadedImages.push(preload);
      }
    });

    effect(() => {
      this._loop.tick();
      untracked(() => this._physicsTick());
    });
    effect(() => {
      this._loop.tick();
      untracked(() => this._advanceFrame());
    });
  }

  private _physicsTick(): void {
    if (this.expired()) return;
    const dirSign = this.direction() === 'left' ? -1 : 1;
    const baseSpeed = this.speedOverride() ?? this.speed;
    // Scale to the current viewport so the wave covers the same fraction of
    // the stage per tick regardless of width — the character's walk speed and
    // the stage's scroll rate scale the same way, keeping their relationship
    // (the wave must outpace the scroll) constant across viewports.
    const speed = (baseSpeed * this.worldWidth()) / this.referenceWidth;
    const travelCap = this.travelDistancePctOverride() ?? this.travelDistancePct;
    this.accumulated.update((x) => x + speed * dirSign);
    // Off-screen despawn: the <img>'s left edge in absolute screen
    // coords is `_hostLeft + accumulated`. When that crosses the
    // far stage edge, the flame is entirely off the visible area
    // (the stage clips with overflow:hidden). Triggering this on the
    // far edge — not the near edge — gives the wave a clean exit
    // instead of popping out a frame early.
    const screenX = this._hostLeft + this.accumulated();
    if (dirSign > 0 && screenX > this.rightLimit()) {
      this.expired.set(true);
      return;
    }
    if (dirSign < 0 && screenX < this.leftLimit()) {
      this.expired.set(true);
      return;
    }
    // Defensive max-distance cap. Catches cases the screen check
    // misses (e.g. left/right limits unset / Number.POSITIVE_INFINITY).
    const traveled = Math.abs(this.accumulated() - this._startAccumulated);
    if (traveled >= this.worldWidth() * travelCap) {
      this.expired.set(true);
    }
  }

  private _advanceFrame(): void {
    const data = this.frames;
    const idx = this.currentFrameIndex();
    const frame = data.frames[idx];
    if (!frame) return;
    const durationTicks = Math.round(frame.durationMs / GameLoopService.TICK_MS);
    if (this._loop.tick() - this._frameStartTick < durationTicks) return;
    if (idx + 1 < data.frames.length) {
      this.currentFrameIndex.set(idx + 1);
      this._frameStartTick = this._loop.tick();
    } else if (data.loop) {
      this.currentFrameIndex.set(this.loopStartIndex);
      this._frameStartTick = this._loop.tick();
    }
  }
}
