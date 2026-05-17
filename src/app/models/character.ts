export type Direction = 'right' | 'left' | null;

/** Tokens for the directional motion buffer. Consumed by `SpecialMove.motion`
 * and by `InputService.matchMotion`. Kept here (not in `input.service.ts`) so
 * the domain types live together — characters and their specials reference
 * this directly without pulling in the input service. */
export type MotionInput = 'down' | 'left' | 'right' | 'up';

/** Which attack button activates an attack or special. */
export type AttackButton = 'lightPunch' | 'heavyPunch' | 'lightKick' | 'heavyKick';

export type AnimationName =
  | 'idle'
  | 'forward'
  | 'backwards'
  | 'backstep'
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

/**
 * Character-specific special move. The base `Character` class iterates a
 * subclass's `specials` array on every attack-button press and, if any
 * motion matches the recent directional input history, fires the matched
 * special (its own per-frame animation + audio) instead of the normal
 * attack. When more than one special on the same button would match a
 * single press, the one with the longest motion wins — so a 4-input motion
 * is never short-circuited by a 2-input subset.
 *
 * Specials are self-contained: audio paths live on the entry directly
 * instead of via the `voices` map, so each special is one object to copy
 * between characters.
 */
export interface SpecialMove {
  /** Unique animation key for this special. Should NOT collide with any
   * `AnimationName` (built-ins take precedence in the frame lookup if it
   * does). Conventionally camelCase, e.g. `'crackShoot'`. */
  readonly name: string;
  /** Directional motion that must occur (in order) before the button is
   * pressed. Stray keys between elements are ignored — pressing
   * `down → right (slip) → left → button` still matches `['down','left']`,
   * matching arcade input forgiveness. */
  readonly motion: readonly MotionInput[];
  /** Which attack button activates this special. */
  readonly button: AttackButton;
  /** Per-frame animation data — same shape as built-in animations. */
  readonly frames: AnimationData;
  /** Vocal SFX cues, each fired at the start of a specific animation frame.
   * `frame` defaults to 0 (launch). Use multiple entries for shouts split
   * across clips (e.g. Power Wave: `[{ src: 'power', frame: 0 }, { src:
   * 'wave', frame: 5 }]`) or to sync a single shout with a later beat of
   * the animation (e.g. firing the shout at the same frame as the travel
   * start so the voice lands with the forward motion, not during windup). */
  readonly voices?: readonly { readonly src: string; readonly frame?: number }[];
  /** Non-voice attack SFX (whoosh / impact). Optional. */
  readonly whiffSrc?: string;
  /** Lock-in fallback used only when `frames.frames` is empty. The sum of
   * frame durations drives lock-in when frames are present. */
  readonly durationMs?: number;
  /** Horizontal travel over the lock-in, as a fraction of the stage width
   * (matches how `jumpDistancePct` is expressed). Positive = the character's
   * facing direction (right for now — until characters flip). Distributed
   * uniformly across the traveling portion of the lock-in (see
   * `travelStartFrame`); the character is pinned at the stage edge if the
   * travel would push past `blockedRight`/`blockedLeft`. Omit or set to 0
   * for a stationary special. */
  readonly travelDistancePct?: number;
  /** Frame index at which horizontal travel begins. Defaults to 0 (travel
   * starts immediately on launch). Lets a special wind up in place before
   * leaving the ground — `travelDistancePct` and the Y arc are distributed
   * across just the frames in `[travelStartFrame, travelEndFrame)`, so the
   * visible travel speed scales naturally with how late the launch is. */
  readonly travelStartFrame?: number;
  /** Frame index (exclusive) at which travel ends. Defaults to past the
   * last frame (travel runs through the end of the lock-in). Use this to
   * separate the airborne portion from a grounded recovery pose — e.g.
   * `travelStartFrame: 4, travelEndFrame: 7` means frames 4-6 carry the
   * X movement + Y arc and frame 7 is stationary recovery on the ground. */
  readonly travelEndFrame?: number;
  /** Peak vertical arc during the traveling portion of the lock-in. Same
   * accumulated-Y units as a jump (rendered as `y × jumpYScale` cqw), so
   * `30` is roughly half the peak of a default jump and reads as a low
   * forward leap. Apex hits the midpoint of the travel window; curve is
   * parabolic (rise + fall) by default, or rise-only when `fallAfterArc`
   * is set. Omit or 0 for a flat travel. */
  readonly arcHeight?: number;
  /** When true, the arc rises only (half-sine ease-out instead of a
   * parabola) and after the special's lock-in ends Terry transitions to
   * the jump's descent state — using `jumpFall` for the sprite and the
   * jump physics to bring Y back to ground. Anti-air specials like
   * Rising Tackle use this: Terry leaps up, performs the move at peak,
   * then physically falls back down. */
  readonly fallAfterArc?: boolean;
}
