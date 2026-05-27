import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Projectile } from '../components/projectile/projectile';
import { POWER_WAVE_PROJECTILE_FRAMES } from './power-wave-frames';

/**
 * Terry's Power Wave projectile — the flame that flies forward after
 * the "Wave!" beat of his QCF cast. Visually distinct from Terry's
 * casting animation, which is owned by the character.
 */
@Component({
  selector: 'app-power-wave',
  templateUrl: '../components/projectile/projectile.html',
  styleUrl: './power-wave.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PowerWave extends Projectile {
  protected override readonly frames = { frames: POWER_WAVE_PROJECTILE_FRAMES, loop: true };
  protected override readonly speed = 14;
  protected override readonly travelDistancePct = 1.1;
}
