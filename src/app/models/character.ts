export type Direction = 'right' | 'left' | null;

export type AnimationName =
  | 'idle'
  | 'forward'
  | 'backwards'
  | 'crouch'
  | 'crouchStill'
  | 'crouchForward'
  | 'jumpForward'
  | 'jumpForwardFall'
  | 'jumpBackward'
  | 'jumpBackwardFall'
  | 'jumpUp'
  | 'jumpFall'
  | 'jumpGround'
  | 'lightPunch'
  | 'heavyPunch'
  | 'lightKick'
  | 'heavyKick';

export type CharacterAnimations = Record<AnimationName, string>;

export interface CharacterVoices {
  lightPunch?: string;
  heavyPunch?: string;
  lightKick?: string;
  heavyKick?: string;
  taunt?: string;
  [name: string]: string | undefined;
}

/**
 * One sprite in a data-driven (per-frame) animation. Variable-width animation
 * support — replaces single-strip + CSS keyframes for attacks where each
 * frame's silhouette is a different shape.
 *
 * Coordinates:
 *  - `w`, `h` are the sprite's source pixel dimensions.
 *  - `anchorX`, `anchorY` are the body anchor (foot-centre, detected by the
 *    sprite tool) IN sprite-pixel coords. The runtime positions the frame
 *    so this anchor lands at the same world coordinate across frames; that's
 *    what keeps the body stable when a limb extends.
 *  - `durationMs` is how long this frame shows before advancing.
 */
export interface AnimationFrame {
  readonly src: string;
  readonly w: number;
  readonly h: number;
  readonly anchorX: number;
  readonly anchorY: number;
  readonly durationMs: number;
}

export interface AnimationData {
  readonly frames: readonly AnimationFrame[];
  /** When true, frames loop forever; when false (default), the animation
   * holds on the last frame until something else changes the state. */
  readonly loop?: boolean;
}
