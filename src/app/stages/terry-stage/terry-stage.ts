import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  signal,
  viewChild,
} from '@angular/core';
import { Character } from '../../components/character/character';
import { Stage } from '../../components/stage/stage';
import { MusicControl } from '../../components/music-control/music-control';
import { Parallax } from '../../components/parallax/parallax';
import { infoCardsStage1 } from '../../constants/stage-info-cards';

/**
 * Terry's home stage â€” Geese Tower rooftop with a passing train as the
 * ground band. Pure parallax: the temple backdrop and middle layer pan
 * continuously via CSS keyframes (`stage-translate` / `misc-translate`),
 * and the train scrolls horizontally only when the character is pinned
 * at the stage edge (handled in `_onTick`).
 *
 * The base `Stage` handles character spawn, edge detection, and tick
 * subscription â€” this subclass just declares the train element + scroll
 * rules. Background and misc-layer images come from SCSS (static URLs,
 * positioned via `background-image` rules).
 */
@Component({
  selector: 'app-terry-stage',
  templateUrl: './terry-stage.html',
  styleUrl: './terry-stage.scss',
  imports: [MusicControl, Parallax],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerryStage extends Stage {
  protected override readonly musicSrc = 'assets/sfx/stage/terry-stage-ost.mp3';

  // Scrollable train element + its `<img>` child. The img is 200% wide
  // (see `.terry-ground` in SCSS); scrolling `trainEl.scrollLeft` pans
  // through it.
  readonly trainEl = viewChild.required<ElementRef<HTMLDivElement>>('trainEl');
  readonly trainImgEl = viewChild.required<ElementRef<HTMLImageElement>>('trainImgEl');

  // Parallax "about me" content for this stage, forwarded into
  // `<app-parallax [cards]>`. The array itself lives in the
  // `stage-info-cards` constants file so the copy is edited in one place.
  protected readonly infoCards = infoCardsStage1;

  // Vertical position of the card band on this stage (center of the band,
  // measured from the top). Tuned to sit in the sky above the train so the
  // cards clear Terry and the ground band. Other stages set their own.
  protected readonly infoCardsY = '38%';

  // Normalized world progress (0 → 1) forwarded into `<app-parallax
  // [progress]>` so the cards advance as Terry walks forward. Mapped 1:1 so
  // the cards reach the end exactly when the world runs out of scroll.
  protected readonly parallaxProgress = signal(0);

  // World position (px) captured on the first tick — the zero point Terry's
  // forward progress is measured from. `null` until anchored.
  private _progressAnchor: number | null = null;

  protected override _onAfterRender(): void {
    // Start the train at its left edge so the world begins at the start:
    // Terry spawns at the far left (`--character-spawn-x`) and walks right
    // through the cards, with all the scroll room ahead of him. (Default
    // scrollLeft is already 0 — set explicitly to document the intent and
    // override any restored scroll position.)
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
   * Scroll the train only while the character is pinned at an edge AND still
   * trying to move into it. Reads `motionIntent` on the character (not
   * `input.lastDir()`) so an active special pushing Terry into the edge also
   * scrolls the world. During a special's travel window the scroll rate
   * matches the special's per-tick X step — so a fast Burning Knuckle scrolls
   * the world at Burning Knuckle speed, not the slower default walk rate. The
   * actual (bounds-clamped) delta is forwarded to projectiles as a
   * world-shift so a live wave stays anchored to where it was fired.
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
    if (dir === 'right' && this.blockedRight()
        && train.scrollLeft + train.clientWidth < trainImg.scrollWidth) {
      train.scrollLeft += rate;
    } else if (dir === 'left' && this.blockedLeft() && train.scrollLeft > 0) {
      train.scrollLeft -= rate;
    }
    // train.scrollLeft increase = camera moves right = world-fixed points
    // shift LEFT in screen by the same amount; pass the negated delta.
    this.shiftProjectiles(-(train.scrollLeft - before));
  }

  /**
   * Re-anchor the parallax progress baseline on resize so the CURRENT card
   * position is preserved (no jump). The stage is `vw`-sized, so `worldX`,
   * `rightLimit`, and the train's scroll range all rescale; the spawn-time
   * `_progressAnchor` (absolute px) would otherwise map to a shifted progress.
   * Solves the anchor from `progress = (pos − anchor) / (maxPos − anchor)`,
   * clamping progress away from 1 so the denominator stays well-defined.
   */
  protected override _onResize(): void {
    const character = this.character();
    if (!character || !character.ready() || this._progressAnchor === null) return;
    const train = this.trainEl().nativeElement;
    const trainImg = this.trainImgEl().nativeElement;
    const maxScroll = trainImg.scrollWidth - train.clientWidth;
    const pos = character.worldX() + train.scrollLeft;
    const maxPos = (this.rightLimit - character.width()) + maxScroll;
    const p = Math.min(0.999, this.parallaxProgress());
    this._progressAnchor = (pos - p * maxPos) / (1 - p);
  }

  /**
   * Drive the parallax cards from Terry's forward travel. The progress
   * metric is `worldX + train.scrollLeft` — Terry's on-screen position plus
   * how far the world has scrolled past the edge — so it advances smoothly
   * whether he's crossing the stage or pinned at the edge pushing the world.
   * It's anchored at the spawn value (so spawn = first card) and normalized
   * against the maximum reachable value (far-right edge + fully-scrolled
   * train), giving the 1:1 mapping: cards hit the end exactly as the world
   * does. Walking back left clamps at 0 (the first card).
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
    // Max reachable position: Terry flush at the right edge + train fully
    // scrolled. `rightLimit - charW` is his rightmost worldX.
    const maxPos = (this.rightLimit - charW) + maxScroll;
    const range = Math.max(1, maxPos - this._progressAnchor);
    const progress = Math.min(1, Math.max(0, (pos - this._progressAnchor) / range));
    this.parallaxProgress.set(progress);
  }
}
