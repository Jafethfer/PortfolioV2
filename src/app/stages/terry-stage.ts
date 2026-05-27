import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core';
import { Stage } from '../components/stage/stage';
import { MusicControl } from '../components/music-control/music-control';

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
  imports: [MusicControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TerryStage extends Stage {
  protected override readonly musicSrc = 'assets/sfx/stage/terry-stage-ost.mp3';

  // Scrollable train element + its `<img>` child. The img is 200% wide
  // (see `.terry-ground` in SCSS); scrolling `trainEl.scrollLeft` pans
  // through it.
  readonly trainEl = viewChild.required<ElementRef<HTMLDivElement>>('trainEl');
  readonly trainImgEl = viewChild.required<ElementRef<HTMLImageElement>>('trainImgEl');

  protected override _onAfterRender(): void {
    // Center the train so there's equal scroll room either direction
    // (character spawns near center, world extends both ways).
    const train = this.trainEl().nativeElement;
    const trainImg = this.trainImgEl().nativeElement;
    train.scrollLeft = (trainImg.scrollWidth - train.clientWidth) / 2;
  }

  protected override _onTick(): void {
    // Scroll the train only while the character is pinned at an edge AND
    // still trying to move into it. Reads `motionIntent` on the
    // character (not `input.lastDir()`) so an active special pushing
    // Terry into the edge also scrolls the world. During a special's
    // travel window, the scroll rate matches the special's per-tick X
    // step â€” so a fast Burning Knuckle scrolls the world at Burning
    // Knuckle speed, not the slower default walk rate.
    const character = this.character();
    const dir = character?.motionIntent ?? null;
    if (!dir) return;
    const train = this.trainEl().nativeElement;
    const trainImg = this.trainImgEl().nativeElement;
    const specialV = Math.abs(character?.specialXVelocity ?? 0);
    const rate = specialV > 0
      ? specialV
      : (this.input.downKey() ? this.crouchScrollRate : this.walkScrollRate);
    // Capture the scroll position BEFORE applying the delta so we can
    // compute the actual change (clamped by the train's scroll bounds)
    // and forward it to projectiles as a world-shift. This keeps a wave
    // anchored to the world point where it was fired instead of
    // drifting in screen as the train rushes past underneath.
    const before = train.scrollLeft;
    if (dir === 'right' && this.blockedRight()
        && train.scrollLeft + train.clientWidth < trainImg.scrollWidth) {
      train.scrollLeft += rate;
    } else if (dir === 'left' && this.blockedLeft() && train.scrollLeft > 0) {
      train.scrollLeft -= rate;
    }
    // train.scrollLeft increase = camera moves right = world-fixed
    // points shift LEFT in screen by the same amount. Pass the negated
    // delta so live projectiles compensate.
    this.shiftProjectiles(-(train.scrollLeft - before));
  }
}
