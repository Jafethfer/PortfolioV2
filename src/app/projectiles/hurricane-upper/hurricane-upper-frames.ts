import { AnimationFrame } from '../../models/character';

/** Hurricane Upper tornado-projectile frames: a short build-up swirl (plays
 * once) followed by the two full-height spin phases that loop. The sheet's
 * further dissipating swirls stay unused — the tornado despawns off-screen. */
export const HURRICANE_UPPER_PROJECTILE_FRAMES: readonly AnimationFrame[] = [
  {
    src: 'assets/img/characters/joe/hurricane-upper/tornado/2.png',
    w: 47,
    h: 46,
    anchorX: 23,
    anchorY: 46,
    durationMs: 150,
  },
  {
    src: 'assets/img/characters/joe/hurricane-upper/tornado/0.png',
    w: 32,
    h: 80,
    anchorX: 16,
    anchorY: 80,
    durationMs: 70,
  },
  {
    src: 'assets/img/characters/joe/hurricane-upper/tornado/1.png',
    w: 40,
    h: 80,
    anchorX: 20,
    anchorY: 80,
    durationMs: 70,
  },
];
