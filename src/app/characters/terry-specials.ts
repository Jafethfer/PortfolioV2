import { AnimationFrame } from '../models/character';

/**
 * Sprite frame data for Terry's special moves. Kept separate from `terry.ts`
 * so each special's sprite metadata (the part stable across light/heavy/EX
 * variants) can live in one place — `terry.ts` consumes these via the
 * `withDurations` helper, applying per-variant frame timings on top.
 */

/** Sprite metadata minus per-frame timing — the part that's stable across
 * a move's light/heavy/EX variants. Each variant supplies its own
 * `durationMs[]` via `withDurations` to control timing independently while
 * pointing at the same images. */
export type SpriteFrame = Omit<AnimationFrame, 'durationMs'>;

/** Zips a shared sprite array with a per-variant durations array. Lengths
 * are assumed to match — author error if they don't. */
export const withDurations = (
  sprites: readonly SpriteFrame[],
  durations: readonly number[],
) => sprites.map((f, i) => ({ ...f, durationMs: durations[i] }));

/**
 * Crack Shoot — shared by the light and heavy variants. Every airborne
 * frame's foot anchor would otherwise swing 17-54px as Terry rotates, so
 * `anchorX` is pinned to `bodyAnchorX` (31) on every frame to keep the
 * body planted around the standing position.
 */
export const CRACK_SHOOT_FRAMES: readonly SpriteFrame[] = [
  { src: '/assets/img/characters/terry/crack-shoot/0.png', w: 66,  h: 113, anchorX: 31, anchorY: 105 },
  { src: '/assets/img/characters/terry/crack-shoot/1.png', w: 84,  h: 113, anchorX: 31, anchorY: 105 },
  { src: '/assets/img/characters/terry/crack-shoot/2.png', w: 87,  h: 113, anchorX: 31, anchorY: 105 },
  { src: '/assets/img/characters/terry/crack-shoot/3.png', w: 103, h: 113, anchorX: 31, anchorY: 105 },
  { src: '/assets/img/characters/terry/crack-shoot/4.png', w: 78,  h: 113, anchorX: 31, anchorY: 105 },
  { src: '/assets/img/characters/terry/crack-shoot/5.png', w: 92,  h: 113, anchorX: 31, anchorY: 105 },
  { src: '/assets/img/characters/terry/crack-shoot/6.png', w: 51,  h: 113, anchorX: 31, anchorY: 105 },
  { src: '/assets/img/characters/terry/crack-shoot/7.png', w: 57,  h: 113, anchorX: 31, anchorY: 105 },
];

/**
 * Burning Knuckle — shared by the light and heavy variants. Re-extracted
 * via per-cell OUTER_BG flood-fill (see `extract-burning-knuckle.mjs`)
 * since the row spans two sub-rows and the trailing flames bridge column
 * gaps. Per-frame `anchorX` points at each pose's body centerline so wide
 * flame-trailing frames (6-8) and narrow stance frames stay aligned with
 * each other and with idle when rendered.
 *
 * Frames 0-5: stance → V-pose flash → lean back → brace → charge fist →
 *             flame growing
 * Frames 6-8: punch released → big punch with trailing flame → continuing
 *             punch (this is the forward-charge window)
 * Frames 9-10: arms cock back with flame → brace recovery
 */
/**
 * Rising Tackle — shared by the light and heavy variants. Source-cell
 * crops of row 46 (the spinning anti-air uppercut).
 *
 * Anchoring is mixed by phase:
 *  - Ground frames 0-2 (windup → crouch → launch): anchor to the
 *    rightmost-bottom-pixel cluster (Terry's planted right foot) − 26,
 *    matching idle's planted-foot-vs-anchor relationship — same
 *    convention heavy kick uses, so the foot stays locked at the same
 *    world-X across idle and the windup.
 *  - Airborne frames 3-7 (leap + spinning flip): anchor to the body
 *    centroid − 26. That places the body's centerline at the same
 *    world-X as the planted foot, so Terry rises straight up from the
 *    launch point instead of pivoting around whichever limb happens to
 *    extend rightmost in each rotation pose.
 *  - Frames 8-9: unused in the current setup (the fall-after-arc
 *    handoff uses the jumpFall sprite for descent + landing).
 */
export const RISING_TACKLE_FRAMES: readonly SpriteFrame[] = [
  { src: '/assets/img/characters/terry/rising-tackle/0.png', w: 57, h: 119, anchorX: 24, anchorY: 118 },
  { src: '/assets/img/characters/terry/rising-tackle/1.png', w: 63, h: 119, anchorX: 28, anchorY: 118 },
  { src: '/assets/img/characters/terry/rising-tackle/2.png', w: 64, h: 119, anchorX:  5, anchorY: 118 },
  { src: '/assets/img/characters/terry/rising-tackle/3.png', w: 65, h: 119, anchorX:  3, anchorY: 118 },
  { src: '/assets/img/characters/terry/rising-tackle/4.png', w: 57, h: 119, anchorX:  1, anchorY: 118 },
  { src: '/assets/img/characters/terry/rising-tackle/5.png', w: 86, h: 119, anchorX:  8, anchorY: 118 },
  { src: '/assets/img/characters/terry/rising-tackle/6.png', w: 63, h: 119, anchorX: 11, anchorY: 118 },
  { src: '/assets/img/characters/terry/rising-tackle/7.png', w: 88, h: 119, anchorX: 23, anchorY: 118 },
  { src: '/assets/img/characters/terry/rising-tackle/8.png', w: 65, h: 119, anchorX: 32, anchorY: 118 },
  { src: '/assets/img/characters/terry/rising-tackle/9.png', w: 64, h: 119, anchorX: 30, anchorY: 118 },
];

/**
 * Power Wave — shared by the light and heavy variants. Extracted via
 * per-cell OUTER_BG flood-fill (see `extract-power-wave.mjs`) because the
 * row spans two sub-rows (7 character frames on top + a flame-projectile
 * strip below). Per-frame `anchorX` = each frame's torso centroid + 3 (the
 * idle anchor-vs-centroid offset), so Terry's body stays planted at the
 * same world-X across the entire move — Power Wave is a stationary cast,
 * no X/Y travel for Terry. The wave projectile itself will be added later
 * as a separate entity.
 *
 * Frame 0: stance (brief settle into the cast)
 * Frame 1: arms pulling back, gathering energy
 * Frame 2: ball charged overhead — tallest frame because the ball
 *          extends well above Terry's head
 * Frame 3: ball cocked back at the right shoulder (the windup peak)
 * Frame 4: lunging forward, ball releasing
 * Frame 5: arm extended forward (release pose — when the wave would spawn)
 * Frame 6: recovery
 */
export const POWER_WAVE_FRAMES: readonly SpriteFrame[] = [
  { src: '/assets/img/characters/terry/power-wave/0.png', w: 57, h: 100, anchorX: 27, anchorY:  99 },
  { src: '/assets/img/characters/terry/power-wave/1.png', w: 80, h: 107, anchorX: 41, anchorY: 106 },
  { src: '/assets/img/characters/terry/power-wave/2.png', w: 91, h: 122, anchorX: 56, anchorY: 121 },
  { src: '/assets/img/characters/terry/power-wave/3.png', w: 75, h: 106, anchorX: 35, anchorY: 105 },
  { src: '/assets/img/characters/terry/power-wave/4.png', w: 76, h:  85, anchorX: 45, anchorY:  84 },
  { src: '/assets/img/characters/terry/power-wave/5.png', w: 72, h:  79, anchorX: 46, anchorY:  78 },
  { src: '/assets/img/characters/terry/power-wave/6.png', w: 67, h:  79, anchorX: 39, anchorY:  78 },
];

export const BURNING_KNUCKLE_FRAMES: readonly SpriteFrame[] = [
  { src: '/assets/img/characters/terry/burning-knuckle/0.png',  w:  56, h:  92, anchorX: 27, anchorY:  91 },
  { src: '/assets/img/characters/terry/burning-knuckle/1.png',  w:  91, h: 127, anchorX: 45, anchorY: 126 },
  { src: '/assets/img/characters/terry/burning-knuckle/2.png',  w:  62, h:  98, anchorX: 30, anchorY:  97 },
  { src: '/assets/img/characters/terry/burning-knuckle/3.png',  w:  64, h:  90, anchorX: 30, anchorY:  89 },
  { src: '/assets/img/characters/terry/burning-knuckle/4.png',  w:  62, h:  80, anchorX: 30, anchorY:  79 },
  { src: '/assets/img/characters/terry/burning-knuckle/5.png',  w:  77, h:  85, anchorX: 28, anchorY:  84 },
  { src: '/assets/img/characters/terry/burning-knuckle/6.png',  w: 119, h:  88, anchorX: 30, anchorY:  87 },
  { src: '/assets/img/characters/terry/burning-knuckle/7.png',  w: 119, h:  91, anchorX: 30, anchorY:  90 },
  { src: '/assets/img/characters/terry/burning-knuckle/8.png',  w: 119, h:  88, anchorX: 30, anchorY:  87 },
  { src: '/assets/img/characters/terry/burning-knuckle/9.png',  w:  77, h:  85, anchorX: 28, anchorY:  84 },
  { src: '/assets/img/characters/terry/burning-knuckle/10.png', w:  64, h:  90, anchorX: 30, anchorY:  89 },
];
