import { AnimationFrame } from '../models/character';

/**
 * Power Wave flame-projectile sprite metadata. Extracted from row 51 of
 * the source sheet (the strip immediately below Power Wave's casting
 * row 50). Six cropped frames live at
 * `public/assets/img/characters/terry/power-wave/projectile/0.png`-`5.png`,
 * each in a uniform 83x76 cell with the flame centred.
 *
 * Frames 0-1 are the flame igniting, 2-3 are the peak / steady flame,
 * 4-5 are the dissipation. For v1 we loop the four "active flame"
 * frames (1-3) — looks like a flickering fireball as it travels.
 * Frames 0/4/5 stay in the folder for a future spawn / despawn effect.
 */
export const POWER_WAVE_PROJECTILE_FRAMES: readonly AnimationFrame[] = [
  { src: 'assets/img/characters/terry/power-wave/projectile/1.png', w: 83, h: 76, anchorX: 41, anchorY: 75, durationMs: 80 },
  { src: 'assets/img/characters/terry/power-wave/projectile/2.png', w: 83, h: 76, anchorX: 41, anchorY: 75, durationMs: 80 },
  { src: 'assets/img/characters/terry/power-wave/projectile/3.png', w: 83, h: 76, anchorX: 41, anchorY: 75, durationMs: 80 },
  { src: 'assets/img/characters/terry/power-wave/projectile/2.png', w: 83, h: 76, anchorX: 41, anchorY: 75, durationMs: 80 },
];
