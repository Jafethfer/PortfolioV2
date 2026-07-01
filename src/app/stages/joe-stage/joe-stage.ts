import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { Stage, StageFrame } from '../../components/stage/stage';

/** Joe Higashi's stage: Thailand. Backdrop and ground are 2-frame loops and
 * scroll 1:1 together (flat camera, no independent parallax layer). */
@Component({
  selector: 'app-joe-stage',
  templateUrl: './joe-stage.html',
  styleUrl: './joe-stage.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JoeStage extends Stage {
  protected override readonly musicSrc = 'assets/sfx/stage/joe-higashi-stage-ost.mp3';

  readonly groundEl = viewChild.required<ElementRef<HTMLDivElement>>('groundEl');
  readonly groundImgEl = viewChild.required<ElementRef<HTMLImageElement>>('groundImgEl');

  // How many stage-widths wide the backdrop is. Drives `bgSize` and caps
  // `bgShiftPx` so the (non-tiled) bg can't slide past its right edge.
  protected readonly bgWidthMultiplier: number = 2;
  // Vertical proportion of the stage the backdrop fills; the ground band takes
  // the rest.
  protected readonly bgHeightPct: number = 68;

  readonly bgSize = computed(
    () => `${this.bgWidthMultiplier * 100}% ${this.bgHeightPct}%`,
  );

  // Px the bg has been shifted; bound to `background-position-x` so the backdrop
  // slides in lockstep with the ground when blocked at an edge.
  readonly bgShiftPx = signal(0);

  // Max bg slide before its right edge meets the stage's; clamps `bgShiftPx`.
  readonly maxBgShiftPx = computed(
    () => (this.bgWidthMultiplier - 1) * this.width(),
  );

  protected readonly bgCycle = this.makeFrameCycle(JOE_BG_FRAMES);
  protected readonly groundCycle = this.makeFrameCycle(JOE_GROUND_FRAMES);

  protected override _onAfterRender(): void {
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
    this._scrollWorld();
  }

  /**
   * While the character is pinned at an edge and still moving into it, slide the
   * ground and backdrop by the same per-tick delta. `motionIntent` covers active
   * specials, so the scroll rate matches the special's per-tick X step.
   */
  private _scrollWorld(): void {
    const character = this.character();
    const dir = character?.motionIntent ?? null;
    if (!dir) return;
    const rate = this.worldScrollRate(character?.specialXVelocity ?? 0);
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
  { src: 'assets/img/stage/joe-stage/background-0.png', durationMs: 400 },
  { src: 'assets/img/stage/joe-stage/background-1.png', durationMs: 400 },
];

const JOE_GROUND_FRAMES: readonly StageFrame[] = [
  { src: 'assets/img/stage/joe-stage/ground-0.png', durationMs: 350 },
  { src: 'assets/img/stage/joe-stage/ground-1.png', durationMs: 350 },
];
