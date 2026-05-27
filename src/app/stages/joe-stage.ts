import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { Stage, StageFrame } from '../components/stage/stage';
import { MusicControl } from '../components/music-control/music-control';

/**
 * Joe Higashi's stage — Thailand (Fatal Fury 2 / Mega Drive). Two key
 * differences from Terry's stage drove the per-stage-owned-template
 * refactor:
 *
 *   1. Both the backdrop and the ground band animate as 2-frame loops
 *      (water shimmer / clapping audience) — built on the base's
 *      `makeFrameCycle` helper, advanced from `_onTick`.
 *   2. The backdrop scrolls *with* the ground (1:1), not as a slow
 *      independent parallax. When the character is pinned at the edge,
 *      both move together, giving a flat-camera feel instead of layered
 *      depth.
 *
 * No middle parallax layer — the misc-layer div simply isn't in this
 * template.
 */
@Component({
  selector: 'app-joe-stage',
  templateUrl: './joe-stage.html',
  styleUrl: './joe-stage.scss',
  imports: [MusicControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JoeStage extends Stage {
  protected override readonly musicSrc = '/assets/sfx/stage/joe-higashi-stage-ost.mp3';

  // Scrollable ground container + its `<img>`. The img is sized via
  // `.joe-ground` (50cqw tall, `w-full`); no horizontal overflow today
  // since the image isn't authored at 2× width. Even so, `_onTick` runs
  // the same pinned-at-edge check Terry uses, so as soon as Joe's
  // ground is widened the scroll just starts working.
  readonly groundEl = viewChild.required<ElementRef<HTMLDivElement>>('groundEl');
  readonly groundImgEl = viewChild.required<ElementRef<HTMLImageElement>>('groundImgEl');

  /** How many stage-widths wide the backdrop is. Drives both the inline
   * `background-size` and the cap on `bgShiftPx` so the bg can't slide
   * past its right edge. `3` means the temple image renders at 300% of
   * the stage width and has 200% of stage width worth of slide room.
   * The bg image is NOT tiled — `bg-no-repeat` in the template — so
   * overshooting would reveal empty stage. */
  protected readonly bgWidthMultiplier: number = 2;
  /** Vertical proportion of the stage the backdrop fills (the ground
   * band takes the rest). Joe's backdrop is sky/water/mountains — no
   * ground in the image itself — so it stops above the audience band. */
  protected readonly bgHeightPct: number = 68;

  /** Inline `background-size` value for stageEl. Single source of truth
   * via `bgWidthMultiplier` × 100% width + `bgHeightPct` % height. */
  readonly bgSize = computed(
    () => `${this.bgWidthMultiplier * 100}% ${this.bgHeightPct}%`,
  );

  /** How far (in px) the bg has been shifted so far. Bound to
   * `[style.background-position-x.px]` on the stage element so the
   * temple backdrop slides in lockstep with the ground when blocked at
   * an edge. Sign convention matches scroll: positive = bg has moved
   * "left" relative to its initial position. */
  readonly bgShiftPx = signal(0);

  /** Max px the bg can slide before its right edge meets the right edge
   * of the stage. `(multiplier - 1) × stageWidth`. `_onTick` clamps
   * `bgShiftPx` against this so the user can't push past the image. */
  readonly maxBgShiftPx = computed(
    () => (this.bgWidthMultiplier - 1) * this.width(),
  );

  // Frame cycles — see `Stage.makeFrameCycle`. Each cycle exposes its
  // own `currentSrc` signal (bound in the template) and an `advance`
  // method called every tick.
  protected readonly bgCycle = this.makeFrameCycle(JOE_BG_FRAMES);
  protected readonly groundCycle = this.makeFrameCycle(JOE_GROUND_FRAMES);

  protected override _onAfterRender(): void {
    // If/when the ground image is authored wider than the container,
    // start centered like Terry's train.
    const ground = this.groundEl().nativeElement;
    const groundImg = this.groundImgEl().nativeElement;
    if (groundImg.scrollWidth > ground.clientWidth) {
      ground.scrollLeft = (groundImg.scrollWidth - ground.clientWidth) / 2;
    }
  }

  protected override _onTick(): void {
    const tick = this.loop.tick();
    this.bgCycle.advance(tick);
    this.groundCycle.advance(tick);

    // Scroll-linked motion: whenever the character is pinned at an edge
    // and still trying to move into it, slide both the ground band and
    // the backdrop by the same per-tick delta. `motionIntent` covers
    // active specials too. During a special's travel window the scroll
    // rate matches the special's per-tick X step, so the world keeps
    // pace with the special's actual travel speed.
    const character = this.character();
    const dir = character?.motionIntent ?? null;
    if (!dir) return;
    const specialV = Math.abs(character?.specialXVelocity ?? 0);
    const rate = specialV > 0
      ? specialV
      : (this.input.downKey() ? this.crouchScrollRate : this.walkScrollRate);
    const ground = this.groundEl().nativeElement;
    const groundImg = this.groundImgEl().nativeElement;
    const maxShift = this.maxBgShiftPx();
    if (dir === 'right' && this.blockedRight()) {
      if (ground.scrollLeft + ground.clientWidth < groundImg.scrollWidth) {
        ground.scrollLeft += rate;
      }
      this.bgShiftPx.update((x) => Math.min(maxShift, x + rate));
    } else if (dir === 'left' && this.blockedLeft()) {
      if (ground.scrollLeft > 0) ground.scrollLeft -= rate;
      this.bgShiftPx.update((x) => Math.max(0, x - rate));
    }
  }
}

const JOE_BG_FRAMES: readonly StageFrame[] = [
  { src: '/assets/img/stage/joe-stage/background-0.png', durationMs: 400 },
  { src: '/assets/img/stage/joe-stage/background-1.png', durationMs: 400 },
];

const JOE_GROUND_FRAMES: readonly StageFrame[] = [
  { src: '/assets/img/stage/joe-stage/ground-0.png', durationMs: 350 },
  { src: '/assets/img/stage/joe-stage/ground-1.png', durationMs: 350 },
];
