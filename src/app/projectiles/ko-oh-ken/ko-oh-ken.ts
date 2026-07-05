import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Projectile } from '../../components/projectile/projectile';
import { KO_OH_KEN_PROJECTILE_FRAMES } from './ko-oh-ken-frames';

/**
 * Ryo's Ko-Oh-Ken projectile — the fireball launched on the thrust beat
 * of his QCF cast. Its sprite frames pulse (24-36px tall), so
 * `heightBaseline` is the tallest frame; the character's cast animation
 * is owned separately by the character.
 */
@Component({
  selector: 'app-ko-oh-ken',
  templateUrl: '../../components/projectile/projectile.html',
  styleUrl: './ko-oh-ken.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KoOhKen extends Projectile {
  protected override readonly frames = { frames: KO_OH_KEN_PROJECTILE_FRAMES, loop: true };
  protected override readonly heightBaseline = 36;
  // Must outpace `Stage.walkScrollRate` (20) so the fireball moves forward in
  // screen-space even when Ryo casts into the edge. Heavy variant overrides
  // via `SpecialMove.projectile.speed`.
  protected override readonly speed = 24;
  protected override readonly travelDistancePct = 1.1;
  protected override readonly spawnSfx = 'assets/sfx/misc/projectile-travel.mp3';
}
