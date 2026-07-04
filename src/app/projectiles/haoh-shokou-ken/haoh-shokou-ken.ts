import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Projectile } from '../../components/projectile/projectile';
import { HAOH_SHOKOU_KEN_PROJECTILE_FRAMES } from './haoh-shokou-ken-frames';

/**
 * Ryo's Haoh-Shokou-Ken projectile — the large energy blast fired on the
 * thrust beat of his super cast. Bigger and slower than the Ko-Oh-Ken
 * fireball; its frames pulse tall (up to 110px), so `heightBaseline` is the
 * tallest frame.
 */
@Component({
  selector: 'app-haoh-shokou-ken',
  templateUrl: '../../components/projectile/projectile.html',
  styleUrl: './haoh-shokou-ken.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HaohShokouKen extends Projectile {
  protected override readonly frames = { frames: HAOH_SHOKOU_KEN_PROJECTILE_FRAMES, loop: true };
  protected override readonly heightBaseline = 110;
  protected override readonly speed = 32;
  protected override readonly travelDistancePct = 1.1;
  protected override readonly spawnSfx = 'assets/sfx/misc/projectile-travel.mp3';
}
