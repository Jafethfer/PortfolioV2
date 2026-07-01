import { AnimationFrame } from '../../models/character';

/** Sprite metadata minus per-frame timing. */
export type SpriteFrame = Omit<AnimationFrame, 'durationMs'>;

/** Zips a shared sprite array with a per-variant durations array. */
export const withDurations = (
  sprites: readonly SpriteFrame[],
  durations: readonly number[],
) => sprites.map((f, i) => ({ ...f, durationMs: durations[i] }));

/** Crack Shoot frames. */
export const CRACK_SHOOT_FRAMES: readonly SpriteFrame[] = [
  { src: 'assets/img/characters/terry/crack-shoot/0.png', w: 66,  h: 113, anchorX: 31, anchorY: 105 },
  { src: 'assets/img/characters/terry/crack-shoot/1.png', w: 84,  h: 113, anchorX: 31, anchorY: 105 },
  { src: 'assets/img/characters/terry/crack-shoot/2.png', w: 87,  h: 113, anchorX: 31, anchorY: 105 },
  { src: 'assets/img/characters/terry/crack-shoot/3.png', w: 103, h: 113, anchorX: 31, anchorY: 105 },
  { src: 'assets/img/characters/terry/crack-shoot/4.png', w: 78,  h: 113, anchorX: 31, anchorY: 105 },
  { src: 'assets/img/characters/terry/crack-shoot/5.png', w: 92,  h: 113, anchorX: 31, anchorY: 105 },
  { src: 'assets/img/characters/terry/crack-shoot/6.png', w: 51,  h: 113, anchorX: 31, anchorY: 105 },
  { src: 'assets/img/characters/terry/crack-shoot/7.png', w: 57,  h: 113, anchorX: 31, anchorY: 105 },
];

/** Rising Tackle frames. */
export const RISING_TACKLE_FRAMES: readonly SpriteFrame[] = [
  { src: 'assets/img/characters/terry/rising-tackle/0.png', w: 57, h: 119, anchorX: 24, anchorY: 118 },
  { src: 'assets/img/characters/terry/rising-tackle/1.png', w: 63, h: 119, anchorX: 28, anchorY: 118 },
  { src: 'assets/img/characters/terry/rising-tackle/2.png', w: 64, h: 119, anchorX:  5, anchorY: 118 },
  { src: 'assets/img/characters/terry/rising-tackle/3.png', w: 65, h: 119, anchorX:  3, anchorY: 118 },
  { src: 'assets/img/characters/terry/rising-tackle/4.png', w: 57, h: 119, anchorX:  1, anchorY: 118 },
  { src: 'assets/img/characters/terry/rising-tackle/5.png', w: 86, h: 119, anchorX:  8, anchorY: 118 },
  { src: 'assets/img/characters/terry/rising-tackle/6.png', w: 63, h: 119, anchorX: 11, anchorY: 118 },
  { src: 'assets/img/characters/terry/rising-tackle/7.png', w: 88, h: 119, anchorX: 23, anchorY: 118 },
  { src: 'assets/img/characters/terry/rising-tackle/8.png', w: 65, h: 119, anchorX: 32, anchorY: 118 },
  { src: 'assets/img/characters/terry/rising-tackle/9.png', w: 64, h: 119, anchorX: 30, anchorY: 118 },
];

/** Power Wave frames. */
export const POWER_WAVE_FRAMES: readonly SpriteFrame[] = [
  { src: 'assets/img/characters/terry/power-wave/0.png', w: 57, h: 100, anchorX: 27, anchorY:  99 },
  { src: 'assets/img/characters/terry/power-wave/1.png', w: 80, h: 107, anchorX: 41, anchorY: 106 },
  { src: 'assets/img/characters/terry/power-wave/2.png', w: 91, h: 122, anchorX: 56, anchorY: 121 },
  { src: 'assets/img/characters/terry/power-wave/3.png', w: 75, h: 106, anchorX: 35, anchorY: 105 },
  { src: 'assets/img/characters/terry/power-wave/4.png', w: 76, h:  85, anchorX: 45, anchorY:  84 },
  { src: 'assets/img/characters/terry/power-wave/5.png', w: 72, h:  79, anchorX: 46, anchorY:  78 },
  { src: 'assets/img/characters/terry/power-wave/6.png', w: 67, h:  79, anchorX: 39, anchorY:  78 },
];

export const BURNING_KNUCKLE_FRAMES: readonly SpriteFrame[] = [
  { src: 'assets/img/characters/terry/burning-knuckle/0.png',  w:  56, h:  92, anchorX: 27, anchorY:  91 },
  { src: 'assets/img/characters/terry/burning-knuckle/1.png',  w:  91, h: 127, anchorX: 45, anchorY: 126 },
  { src: 'assets/img/characters/terry/burning-knuckle/2.png',  w:  62, h:  98, anchorX: 30, anchorY:  97 },
  { src: 'assets/img/characters/terry/burning-knuckle/3.png',  w:  64, h:  90, anchorX: 30, anchorY:  89 },
  { src: 'assets/img/characters/terry/burning-knuckle/4.png',  w:  62, h:  80, anchorX: 30, anchorY:  79 },
  { src: 'assets/img/characters/terry/burning-knuckle/5.png',  w:  77, h:  85, anchorX: 28, anchorY:  84 },
  { src: 'assets/img/characters/terry/burning-knuckle/6.png',  w: 119, h:  88, anchorX: 30, anchorY:  87 },
  { src: 'assets/img/characters/terry/burning-knuckle/7.png',  w: 119, h:  91, anchorX: 30, anchorY:  90 },
  { src: 'assets/img/characters/terry/burning-knuckle/8.png',  w: 119, h:  88, anchorX: 30, anchorY:  87 },
  { src: 'assets/img/characters/terry/burning-knuckle/9.png',  w:  77, h:  85, anchorX: 28, anchorY:  84 },
  { src: 'assets/img/characters/terry/burning-knuckle/10.png', w:  64, h:  90, anchorX: 30, anchorY:  89 },
];
