import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  viewChild,
} from '@angular/core';
import { Stage } from '../components/stage/stage';
import { MusicControl } from '../components/music-control/music-control';

/**
 * Terry's home stage — Geese Tower rooftop with a passing train as the
 * ground band. Pure parallax: the temple backdrop and middle layer pan
 * continuously via CSS keyframes (`stage-translate` / `misc-translate`),
 * and the train scrolls horizontally only when the character is pinned
 * at the stage edge (handled in `_onTick`).
 *
 * The base `Stage` handles character spawn, edge detection, and tick
 * subscription — this subclass just declares the train element + scroll
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
  protected override readonly musicSrc = '/assets/sfx/stage/terry-stage-ost.mp3';

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
    // step — so a fast Burning Knuckle scrolls the world at Burning
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
    if (dir === 'right' && this.blockedRight()
        && train.scrollLeft + train.clientWidth < trainImg.scrollWidth) {
      train.scrollLeft += rate;
    } else if (dir === 'left' && this.blockedLeft() && train.scrollLeft > 0) {
      train.scrollLeft -= rate;
    }
  }
}
