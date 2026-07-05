import { Type } from '@angular/core';

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
  | 'heavyKick'
  | 'crouchLightPunch'
  | 'crouchHeavyPunch'
  | 'crouchLightKick'
  | 'crouchHeavyKick'
  | 'airLightPunch'
  | 'airHeavyPunch'
  | 'airLightKick'
  | 'airLightKickUp'
  | 'airHeavyKick'
  | 'airHeavyKickUp'
  | 'airHeavyRecover'
  /** Hat-throw / victory pose. Played (after a back-dash) as the stage-exit
   * outro before the loading transition — see `Character.playOutro`. */
  | 'victory';

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
  /** When true, the loop ping-pongs (back-and-forth) instead of wrapping:
   * `0→1→…→N-1→N-2→…→1→0→…`. Gives idle/breathing cycles a smooth bob
   * without snapping from the last pose back to the first, and without
   * authoring a palindrome frame list. Implies looping. No effect for
   * fewer than 3 frames (a 2-frame ping-pong is identical to a plain loop). */
  readonly bounce?: boolean;
  /** Optional forward travel over the attack's lock-in, as a fraction of the
   * world width (same model as `SpecialMove.travelDistancePct`). Lets a NORMAL
   * attack step forward — e.g. a lunging crouch kick. Distributed across
   * `[travelStartFrame, travelEndFrame)`; pinned at the stage edge. Only read
   * for attack animations (played via `_startAttack`); ignored for looping
   * locomotion. Positive = facing direction. */
  readonly travelDistancePct?: number;
  /** Frame index where travel begins (default 0). */
  readonly travelStartFrame?: number;
  /** Frame index (exclusive) where travel ends (default past the last frame). */
  readonly travelEndFrame?: number;
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
   * forward leap. The curve is a parabola (rise + fall), apex at the
   * midpoint of the travel window, Y back to 0 at travel end — so a rising
   * anti-air must carry its own descent/landing art in the second half of
   * its travel frames. Omit or 0 for a flat travel. */
  readonly arcHeight?: number;
  /** Optional projectile spawn. When set, the character emits a spawn
   * request on the configured frame of the special's animation; the
   * Stage subscribes and instantiates the projectile into its
   * `#projectileHost` slot. The character has no reference to the
   * projectile after spawn — travel, despawn, and audio are owned by
   * the projectile component. */
  readonly projectile?: ProjectileSpawn;
}

/** Per-special projectile spawn config. The Stage uses this to
 * instantiate the projectile component and pass it the spawn world-X,
 * direction, world width, and stage edge bounds. `componentClass` is
 * typed as `Type<unknown>` here to avoid a circular import between
 * `models/` and `components/projectile/`; the Stage casts to the
 * concrete `Type<Projectile>` at the use site. */
export interface ProjectileSpawn {
  readonly componentClass: Type<unknown>;
  /** Animation frame index at which the projectile spawns. Defaults
   * to 0 (spawn on launch). Resolved to an absolute tick by the
   * character's `_runSpecial` from the sum of preceding frame
   * durations — same pattern voice cues use. */
  readonly spawnFrame?: number;
  /** Horizontal offset (sprite-pixels) from the character's body
   * anchor to the projectile's anchor at spawn. Positive = forward. */
  readonly spawnOffsetX?: number;
  /** Vertical offset (sprite-pixels) from the character's foot
   * baseline. Negative = above ground. */
  readonly spawnOffsetY?: number;
  /** Optional speed override (px/tick). When set, replaces the
   * projectile class's default `speed`. Lets light/heavy variants of
   * the same special share a projectile class but cast at different
   * speeds — heavy Power Wave is faster than light, etc. */
  readonly speed?: number;
  /** Optional travel-distance override (fraction of stage width).
   * Defensive cap before the off-screen detector catches up. */
  readonly travelDistancePct?: number;
}

/** Payload emitted on `Character.projectileSpawnRequested`. The Stage
 * receives this, creates the projectile component, and forwards the
 * spawn coordinates so the projectile doesn't have to reach back
 * into the character. */
export interface ProjectileSpawnRequest {
  readonly config: ProjectileSpawn;
  readonly worldX: number;
  readonly worldY: number;
  readonly direction: Direction;
}
