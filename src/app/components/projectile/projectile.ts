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
 * Abstract projectile base. Mirrors `Character` in structure — owns per-tick X
 * physics, per-frame animation advance, and the absolute-positioned `<img>`
 * render, translated via `transform` with `accumulated` as the X offset from
 * the host's left edge. Subclasses supply sprite data and tunables. A
 * constructor `effect()` advances physics each tick and flips `expired` once
 * the projectile travels `worldWidth × travelDistancePct`; the Stage then
 * destroys the component.
 */
@Directive()
export abstract class Projectile {
  /** Stage width in px — used to compute the despawn travel threshold. */
  readonly worldWidth = input.required<number>();
  /** Absolute screen-X of the spawn point, converted to a host-relative offset
   * once `afterNextRender` measures the host's left edge. */
  readonly spawnX = input.required<number>();
  /** Vertical offset from the ground line (rendered px, negative = up). Lifts
   * the projectile to the caster's hand height; 0 hugs the floor. */
  readonly spawnY = input(0);
  /** Direction of travel; `null` falls back to right. */
  readonly direction = input<Direction>('right');
  /** Stage edge X (absolute screen px), used by the off-screen despawn. */
  readonly leftLimit = input(0);
  readonly rightLimit = input(Number.POSITIVE_INFINITY);
  /** Per-cast speed override (px/tick); falls back to the class-level `speed`.
   * Lets light/heavy variants share one projectile class. */
  readonly speedOverride = input<number | undefined>(undefined);
  readonly travelDistancePctOverride = input<number | undefined>(undefined);

  /** Per-tick X offset relative to the host slot's left edge. */
  readonly accumulated = signal(0);
  readonly currentFrameIndex = signal(0);
  /** Flips true when the projectile reaches its travel cap; the stage then
   * destroys the ComponentRef on the next tick. */
  readonly expired = signal(false);

  /** Subclasses must provide. */
  protected abstract readonly frames: AnimationData;
  /** Px/tick advance, scaled by `worldWidth / referenceWidth` in `_physicsTick`
   * so the wave covers the same fraction of the stage per tick on any
   * viewport — matching how the character and stage scale their rates. */
  protected readonly speed: number = 14;
  /** Reference stage width `speed` is calibrated against, so the wave keeps its
   * speed relationship to the world-scroll rate (it must outpace the scroll). */
  protected readonly referenceWidth: number = REFERENCE_WIDTH;
  /** Despawn cap, as a fraction of stage width travelled from spawn. */
  protected readonly travelDistancePct: number = 1.2;
  /** Sprite-pixel reference height for `w/h` scaling; the CSS
   * `--projectile-height` var divides by this, so a frame of `h ===
   * heightBaseline` renders at exactly that height. */
  protected readonly heightBaseline: number = 76;
  /** Frame the loop returns to after the last frame; earlier frames play once
   * as an intro, then the steady loop runs from here. */
  protected readonly loopStartIndex: number = 0;

  /** Launch SFX played once on spawn (optional). Played on the mixer's `'sfx'`
   * channel. */
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
    // `accumulated` is the <img>'s X offset from the host's left edge; `spawnY`
    // (negative = up) lifts it off the ground line to hand height.
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
    // Stamp the spawn tick so the first frame gets its full duration instead of
    // being skipped against the large running tick counter.
    this._frameStartTick = this._loop.tick();

    afterNextRender(() => {
      const node = this.el()?.nativeElement;
      // Measure the host's left edge to convert the absolute spawnX to an offset.
      this._hostLeft = node ? node.getBoundingClientRect().x : 0;
      this._startAccumulated = this.spawnX() - this._hostLeft;
      this.accumulated.set(this._startAccumulated);

      this._audio.playVoice(this.spawnSfx, this.spawnSfxVolume, 'sfx');

      // Preload frame images so the per-tick src swap doesn't flash.
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
    // Scale to the current viewport so the wave covers the same fraction of the
    // stage per tick regardless of width, keeping it ahead of the scroll.
    const speed = (baseSpeed * this.worldWidth()) / this.referenceWidth;
    const travelCap = this.travelDistancePctOverride() ?? this.travelDistancePct;
    this.accumulated.update((x) => x + speed * dirSign);
    // Off-screen despawn on the far stage edge (`_hostLeft + accumulated`), so
    // the wave exits cleanly rather than popping out a frame early.
    const screenX = this._hostLeft + this.accumulated();
    if (dirSign > 0 && screenX > this.rightLimit()) {
      this.expired.set(true);
      return;
    }
    if (dirSign < 0 && screenX < this.leftLimit()) {
      this.expired.set(true);
      return;
    }
    // Defensive max-distance cap for when the edge limits are unset.
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
