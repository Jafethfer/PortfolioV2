import { ChangeDetectionStrategy, Component, ElementRef, signal, viewChild } from '@angular/core';
import { Character } from '../../components/character/character';
import { Stage } from '../../components/stage/stage';
import { Parallax } from '../../components/parallax/parallax';
import { infoCardsStage1 } from '../../constants/stage-info-cards';

/** Terry's stage. The train scrolls only while the
 * character is pinned at a stage edge; the backdrop and misc layer pan via CSS. */
@Component({
  selector: 'app-terry-stage',
  templateUrl: './terry-stage.html',
  styleUrl: './terry-stage.scss',
  imports: [Parallax],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerryStage extends Stage {
  protected override readonly musicSrc = 'assets/sfx/stage/terry-stage-ost.mp3';

  readonly trainEl = viewChild.required<ElementRef<HTMLDivElement>>('trainEl');
  readonly trainImgEl = viewChild.required<ElementRef<HTMLImageElement>>('trainImgEl');

  protected readonly infoCards = infoCardsStage1;
  protected readonly infoCardsY = '38%';

  protected readonly parallaxProgress = signal(0);

  // World position (px) captured on the first tick; the zero point forward
  // progress is measured from. `null` until anchored.
  private _progressAnchor: number | null = null;

  protected override _onAfterRender(): void {
    this.trainEl().nativeElement.scrollLeft = 0;
  }

  protected override _onTick(): void {
    const character = this.character();
    if (!character || !character.ready()) return;
    const train = this.trainEl().nativeElement;
    const trainImg = this.trainImgEl().nativeElement;
    this._scrollTrain(character, train, trainImg);
    this._updateParallaxProgress(character, train, trainImg);
  }

  /**
   * Scroll the train while the character is pinned at an edge and still moving
   * into it. Reads `motionIntent` (not `input.lastDir()`) so an active special
   * pushing into the edge scrolls the world too, at the special's per-tick X
   * step. The clamped delta is forwarded to projectiles (negated: a scrollLeft
   * increase shifts world-fixed points left on screen) so a live wave stays put.
   */
  private _scrollTrain(
    character: Character,
    train: HTMLDivElement,
    trainImg: HTMLImageElement,
  ): void {
    const dir = character.motionIntent ?? null;
    if (!dir) return;
    const rate = this.worldScrollRate(character.specialXVelocity ?? 0);
    const before = train.scrollLeft;
    if (
      dir === 'right' &&
      this.blockedRight() &&
      train.scrollLeft + train.clientWidth < trainImg.scrollWidth
    ) {
      train.scrollLeft += rate;
    } else if (dir === 'left' && this.blockedLeft() && train.scrollLeft > 0) {
      train.scrollLeft -= rate;
    }
    this.shiftProjectiles(-(train.scrollLeft - before));
  }

  /**
   * Re-anchor the progress baseline on resize so the current card position is
   * preserved. The stage is `vw`-sized, so all the px inputs rescale; solving
   * for the anchor from `progress = (pos - anchor) / (maxPos - anchor)` keeps
   * the cards from jumping. Progress is clamped below 1 so the denominator stays
   * well-defined.
   */
  protected override _onResize(): void {
    const character = this.character();
    if (!character || !character.ready() || this._progressAnchor === null) return;
    const train = this.trainEl().nativeElement;
    const trainImg = this.trainImgEl().nativeElement;
    const maxScroll = trainImg.scrollWidth - train.clientWidth;
    const pos = character.worldX() + train.scrollLeft;
    const maxPos = this.rightLimit - character.width() + maxScroll;
    const p = Math.min(0.999, this.parallaxProgress());
    this._progressAnchor = (pos - p * maxPos) / (1 - p);
  }

  /**
   * Drive the parallax cards from forward travel: `worldX + train.scrollLeft`
   * (on-screen position plus scrolled-past-edge distance), anchored at spawn and
   * normalized against the far-right reachable position so the cards reach the
   * end exactly as the world runs out of scroll.
   */
  private _updateParallaxProgress(
    character: Character,
    train: HTMLDivElement,
    trainImg: HTMLImageElement,
  ): void {
    const maxScroll = trainImg.scrollWidth - train.clientWidth;
    const charW = character.width();
    const pos = character.worldX() + train.scrollLeft;
    if (this._progressAnchor === null) this._progressAnchor = pos;
    const maxPos = this.rightLimit - charW + maxScroll;
    const range = Math.max(1, maxPos - this._progressAnchor);
    const progress = Math.min(1, Math.max(0, (pos - this._progressAnchor) / range));
    this.parallaxProgress.set(progress);
  }
}
