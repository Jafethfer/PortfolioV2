import { SpriteFrame } from '../../helpers/special-frame';

/** Ko-Oh-Ken cast frames (Ryo's body — the charge-and-thrust that launches
 * the fireball). Anchored on the torso so the body stays planted while the
 * arms charge then thrust forward. */
export const KO_OH_KEN_FRAMES: readonly SpriteFrame[] = [
  { src: 'assets/img/characters/ryo/ko-oh-ken/0.png', w: 70, h: 125, anchorX: 35, anchorY: 125 },
  { src: 'assets/img/characters/ryo/ko-oh-ken/1.png', w: 80, h: 120, anchorX: 39, anchorY: 120 },
  { src: 'assets/img/characters/ryo/ko-oh-ken/2.png', w: 80, h: 107, anchorX: 36, anchorY: 107 },
  { src: 'assets/img/characters/ryo/ko-oh-ken/3.png', w: 85, h: 98, anchorX: 41, anchorY: 98 },
  { src: 'assets/img/characters/ryo/ko-oh-ken/4.png', w: 88, h: 97, anchorX: 45, anchorY: 97 },
  { src: 'assets/img/characters/ryo/ko-oh-ken/5.png', w: 101, h: 100, anchorX: 36, anchorY: 100 },
  { src: 'assets/img/characters/ryo/ko-oh-ken/6.png', w: 101, h: 100, anchorX: 37, anchorY: 100 },
  { src: 'assets/img/characters/ryo/ko-oh-ken/7.png', w: 101, h: 100, anchorX: 36, anchorY: 100 },
];

/** Zan-Retsu-Ken flurry — Ryo's rapid alternating straight punches (mashed).
 * Torso-anchored so the body stays planted while the arms piston out and back.
 * The one-shot runs the punch cycle (files 0–7) twice, then the big extended
 * finish (files 8–9). Files are numbered in play order (0 = first). */
export const ZAN_RETSU_KEN_FRAMES: readonly SpriteFrame[] = [
  { src: 'assets/img/characters/ryo/zan-retsu-ken/0.png', w: 90, h: 118, anchorX: 30, anchorY: 118 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/1.png', w: 60, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/2.png', w: 91, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/3.png', w: 60, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/4.png', w: 98, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/5.png', w: 59, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/6.png', w: 78, h: 104, anchorX: 35, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/7.png', w: 93, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/0.png', w: 90, h: 118, anchorX: 30, anchorY: 118 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/1.png', w: 60, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/2.png', w: 91, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/3.png', w: 60, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/4.png', w: 98, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/5.png', w: 59, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/6.png', w: 78, h: 104, anchorX: 35, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/7.png', w: 93, h: 104, anchorX: 31, anchorY: 104 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/8.png', w: 108, h: 103, anchorX: 37, anchorY: 103 },
  { src: 'assets/img/characters/ryo/zan-retsu-ken/9.png', w: 105, h: 103, anchorX: 37, anchorY: 103 },
];

/** Haoh-Shokou-Ken cast frames (Ryo's body — the super: draw-back charge then
 * a lunging two-handed thrust). Hip-anchored so the core stays planted through
 * the charge; the final thrust steps forward. */
export const HAOH_SHOKOU_KEN_FRAMES: readonly SpriteFrame[] = [
  {
    src: 'assets/img/characters/ryo/haoh-shokou-ken/0.png',
    w: 55,
    h: 98,
    anchorX: 31,
    anchorY: 98,
  },
  {
    src: 'assets/img/characters/ryo/haoh-shokou-ken/1.png',
    w: 54,
    h: 104,
    anchorX: 26,
    anchorY: 104,
  },
  {
    src: 'assets/img/characters/ryo/haoh-shokou-ken/2.png',
    w: 55,
    h: 107,
    anchorX: 22,
    anchorY: 107,
  },
  {
    src: 'assets/img/characters/ryo/haoh-shokou-ken/3.png',
    w: 54,
    h: 110,
    anchorX: 27,
    anchorY: 110,
  },
  {
    src: 'assets/img/characters/ryo/haoh-shokou-ken/4.png',
    w: 58,
    h: 112,
    anchorX: 32,
    anchorY: 112,
  },
  {
    src: 'assets/img/characters/ryo/haoh-shokou-ken/5.png',
    w: 98,
    h: 100,
    anchorX: 40,
    anchorY: 100,
  },
];
