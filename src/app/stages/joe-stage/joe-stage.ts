import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  signal,
  viewChild,
} from '@angular/core';
import { Stage, StageFrame } from '../../components/stage/stage';
import { LegendSpecial } from '../../services/legend.service';
import { Parallax } from '../../components/parallax/parallax';
import { Character } from '../../components/character/character';
import { infoCardsStage2 } from '../../constants/stage-info-cards';

/** Joe Higashi's stage: Thailand. Backdrop and ground are 2-frame loops and
 * scroll 1:1 together (flat camera, no independent parallax layer). */
@Component({
  selector: 'app-joe-stage',
  templateUrl: './joe-stage.html',
  styleUrl: './joe-stage.scss',
  imports: [Parallax],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class JoeStage extends Stage {
  protected override readonly musicSrc = 'assets/sfx/stage/joe-higashi-stage-ost.mp3';

  protected override readonly legendSpecials: readonly LegendSpecial[] = [
    { motion: ['←', '→'], buttons: ['Z', 'X'], label: 'Slash Kick' },
    { motion: ['↓', '↑'], buttons: ['Z', 'X'], label: 'Tiger Kick' },
    { motion: ['↓', '→'], buttons: ['A', 'S'], label: 'Hurricane Upper' },
    { motion: [], buttons: ['A', 'S'], label: 'Bakuretsuken (mash)' },
  ];

  protected readonly infoCards = infoCardsStage2;
  protected readonly infoCardsY = '38%';
  protected readonly parallaxProgress = signal(0);
  // World position captured on the first tick; progress is measured from it.
  private _progressAnchor: number | null = null;

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
    const character = this.character();
    if (character && character.ready()) this._updateParallaxProgress(character);
  }

  /**
   * Drive the parallax cards from Joe's forward travel: `worldX + bgShiftPx`
   * (on-screen position plus the distance the world has scrolled past the edge),
   * anchored at spawn and normalized against the far-right reachable position so
   * the cards land at the end exactly as Joe runs out of stage. Mirrors Terry's
   * train-scroll progress, using the bg shift (0 → max) as the scroll measure.
   */
  private _updateParallaxProgress(character: Character): void {
    const charW = character.width();
    const pos = character.worldX() + this.bgShiftPx();
    if (this._progressAnchor === null) this._progressAnchor = pos;
    const maxPos = this.rightLimit - charW + this.maxBgShiftPx();
    const range = Math.max(1, maxPos - this._progressAnchor);
    const progress = Math.min(1, Math.max(0, (pos - this._progressAnchor) / range));
    this.parallaxProgress.set(progress);
  }

  /** Re-anchor the progress baseline on resize so the current card position is
   * preserved (the stage is `vw`-sized, so the px inputs rescale). */
  protected override _onResize(): void {
    const character = this.character();
    if (!character || !character.ready() || this._progressAnchor === null) return;
    const charW = character.width();
    const pos = character.worldX() + this.bgShiftPx();
    const maxPos = this.rightLimit - charW + this.maxBgShiftPx();
    const p = Math.min(0.999, this.parallaxProgress());
    this._progressAnchor = (pos - p * maxPos) / (1 - p);
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
