import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Projectile } from '../../components/projectile/projectile';
import { HURRICANE_UPPER_PROJECTILE_FRAMES } from './hurricane-upper-frames';

/** Joe's Hurricane Upper tornado — the spinning column that travels forward
 * after the cast's release frame. Owned by the projectile system; the casting
 * body animation lives on the character. */
@Component({
  selector: 'app-hurricane-upper',
  templateUrl: '../../components/projectile/projectile.html',
  styleUrl: './hurricane-upper.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HurricaneUpper extends Projectile {
  protected override readonly frames = { frames: HURRICANE_UPPER_PROJECTILE_FRAMES, loop: true };
  // Frame 0 is the build-up swirl (plays once); the loop then cycles the two
  // full-height spin frames (1, 2).
  protected override readonly loopStartIndex = 1;
  protected override readonly heightBaseline = 80;
  // Must outpace the stage scroll (like Power Wave) so the tornado moves forward
  // in screen-space even when Joe is pinned at the edge. Heavy overrides via
  // SpecialMove.projectile.speed.
  protected override readonly speed = 24;
  protected override readonly travelDistancePct = 1.1;
  protected override readonly spawnSfx = 'assets/sfx/misc/projectile-travel.mp3';
}
