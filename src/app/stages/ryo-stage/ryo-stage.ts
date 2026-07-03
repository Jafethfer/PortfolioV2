import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { Stage } from '../../components/stage/stage';
import { Parallax } from '../../components/parallax/parallax';
import { Character } from '../../components/character/character';
import { LegendSpecial } from '../../services/legend.service';
import { infoCardsStage3 } from '../../constants/stage-info-cards';

/** Ryo Sakazaki's stage: the Kyokugen dojo (Art of Fighting). A single animated
 * WebP backdrop — self-animating (no frame-cycle) and with the floor baked in
 * (no separate ground layer) — that pans as one flat layer when the character
 * is pinned at a stage edge. */
@Component({
  selector: 'app-ryo-stage',
  templateUrl: './ryo-stage.html',
  styleUrl: './ryo-stage.scss',
  imports: [Parallax],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RyoStage extends Stage {
  protected override readonly musicSrc = 'assets/sfx/ryo-stage.mp3';

  // Ryo has no specials wired yet — filled in as they're cropped.
  protected override readonly legendSpecials: readonly LegendSpecial[] = [];

  protected readonly infoCards = infoCardsStage3;
  protected readonly infoCardsY = '38%';
  protected readonly parallaxProgress = signal(0);
  // World position captured on the first tick; progress is measured from it.
  private _progressAnchor: number | null = null;

  // The WebP is 2.61:1; at full stage height (`background-size: auto 100%`) it
  // overflows the 16:9 view horizontally by this factor. Drives the pan clamp.
  private readonly bgWidthMultiplier = 793 / 304 / (16 / 9);

  // Px the backdrop has been panned; bound to `background-position-x`.
  readonly bgShiftPx = signal(0);
  // Max pan before the WebP's right edge meets the stage's; clamps `bgShiftPx`.
  readonly maxBgShiftPx = computed(() => (this.bgWidthMultiplier - 1) * this.width());

  protected override _onTick(): void {
    this._scrollWorld();
    const character = this.character();
    if (character && character.ready()) this._updateParallaxProgress(character);
  }

  /** Pan the backdrop while the character is pinned at an edge and still moving
   * into it. Live projectiles are shifted by the same delta so they stay anchored
   * to the world as the camera moves. */
  private _scrollWorld(): void {
    const character = this.character();
    const dir = character?.motionIntent ?? null;
    if (!dir) return;
    const rate = this.worldScrollRate(character?.specialXVelocity ?? 0);
    const maxShift = this.maxBgShiftPx();
    const before = this.bgShiftPx();
    if (dir === 'right' && this.blockedRight()) {
      this.bgShiftPx.update((x) => Math.min(maxShift, x + rate));
    } else if (dir === 'left' && this.blockedLeft()) {
      this.bgShiftPx.update((x) => Math.max(0, x - rate));
    }
    this.shiftProjectiles(-(this.bgShiftPx() - before));
  }

  /**
   * Drive the parallax cards from Ryo's forward travel: `worldX + bgShiftPx`
   * (on-screen position plus the distance the world has panned past the edge),
   * anchored at spawn and normalized against the far-right reachable position so
   * the cards land at the end exactly as Ryo runs out of stage.
   */
  private _updateParallaxProgress(character: Character): void {
    const charW = character.width();
    const pos = character.worldX() + this.bgShiftPx();
    if (this._progressAnchor === null) this._progressAnchor = pos;
    const maxPos = this.rightLimit - charW + this.maxBgShiftPx();
    const range = Math.max(1, maxPos - this._progressAnchor);
    this.parallaxProgress.set(Math.min(1, Math.max(0, (pos - this._progressAnchor) / range)));
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
}
