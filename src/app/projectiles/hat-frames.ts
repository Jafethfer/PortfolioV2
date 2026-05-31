import { AnimationFrame } from '../models/character';

/**
 * Terry's cap sprite — the hat he tosses during his victory pose. Extracted
 * from row 75 of the source sheet (the thin strip just below the victory
 * body row 74). Nine frames of the cap spinning, in uniform 24×18 cells, at
 * `public/assets/img/characters/terry/victory/hat/0.png`–`8.png`. Frame 8 is
 * the flat resting cap (held once the cap lands — see `Hat`).
 *
 * Looped fast so the cap visibly spins as it arcs. Anchors are unused by the
 * projectile renderer (it positions by `translateX/Y`, not anchor) but the
 * `AnimationFrame` shape requires them — set to the cell centre.
 */
export const HAT_FRAMES: readonly AnimationFrame[] = [
  { src: 'assets/img/characters/terry/victory/hat/0.png', w: 24, h: 18, anchorX: 12, anchorY: 9, durationMs: 60 },
  { src: 'assets/img/characters/terry/victory/hat/1.png', w: 24, h: 18, anchorX: 12, anchorY: 9, durationMs: 60 },
  { src: 'assets/img/characters/terry/victory/hat/2.png', w: 24, h: 18, anchorX: 12, anchorY: 9, durationMs: 60 },
  { src: 'assets/img/characters/terry/victory/hat/3.png', w: 24, h: 18, anchorX: 12, anchorY: 9, durationMs: 60 },
  { src: 'assets/img/characters/terry/victory/hat/4.png', w: 24, h: 18, anchorX: 12, anchorY: 9, durationMs: 60 },
  { src: 'assets/img/characters/terry/victory/hat/5.png', w: 24, h: 18, anchorX: 12, anchorY: 9, durationMs: 60 },
  { src: 'assets/img/characters/terry/victory/hat/6.png', w: 24, h: 18, anchorX: 12, anchorY: 9, durationMs: 60 },
  { src: 'assets/img/characters/terry/victory/hat/7.png', w: 24, h: 18, anchorX: 12, anchorY: 9, durationMs: 60 },
  { src: 'assets/img/characters/terry/victory/hat/8.png', w: 24, h: 18, anchorX: 12, anchorY: 9, durationMs: 60 },
];
