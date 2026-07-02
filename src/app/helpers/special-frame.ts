import { AnimationFrame } from '../models/character';

/** Sprite metadata minus per-frame timing. */
export type SpriteFrame = Omit<AnimationFrame, 'durationMs'>;

/** Zips a shared sprite array with a per-variant durations array — lets one
 * sprite-geometry array back several special variants (light/heavy) that differ
 * only in timing. */
export const withDurations = (
  sprites: readonly SpriteFrame[],
  durations: readonly number[],
) => sprites.map((f, i) => ({ ...f, durationMs: durations[i] }));
