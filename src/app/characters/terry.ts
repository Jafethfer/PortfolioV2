import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Character } from '../components/character/character';
import { AnimationData, AnimationName, CharacterAnimations, CharacterVoices } from '../models/character';

/**
 * Terry Bogard (Fatal Fury / KOF). Concrete character. Owns the mapping from
 * abstract animation names to sprite CSS classes, and its sprite stylesheet
 * lives next to this file as `terry.scss`.
 *
 * Adding another character: copy this pair (`<name>.ts` + `<name>.scss`),
 * swap the animation class names, drop the matching sprite strips into
 * `public/assets/img/`, then have App pass the new class to <app-stage>.
 */
@Component({
  selector: 'app-terry',
  templateUrl: '../components/character/character.html',
  styleUrl: './terry.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Terry extends Character {
  protected override readonly animations: CharacterAnimations = {
    idle:          'terry-idle',
    forward:       'terry-forward',
    backwards:     'terry-backwards',
    crouch:        'terry-crouch',
    crouchStill:   'terry-crouch-still',
    crouchForward: 'terry-crouch-forward',
    jumpForward:     'terry-jump-forward',
    jumpForwardFall: 'terry-jump-forward-fall',
    jumpBackward:    'terry-jump-backward',
    jumpBackwardFall:'terry-jump-backward-fall',
    jumpUp:          'terry-jump-up',
    jumpFall:        'terry-jump-fall',
    jumpGround:      'terry-jump-ground',
    lightPunch:    'terry-light-punch',
    heavyPunch:    'terry-heavy-punch',
    lightKick:     'terry-light-kick',
    heavyKick:     'terry-heavy-kick',
  };

  protected override readonly voices: CharacterVoices = {
    lightPunch:      '/assets/sfx/terry/terry-light-punch.mp3',
    heavyPunch:      '/assets/sfx/terry/terry-heavy-punch.mp3',
    taunt:           '/assets/sfx/terry/terry-taunt.mp3',
    // Non-voice combat SFX live in `misc/` because they're character-agnostic
    // (every fighter's jab makes the same whoosh). Played at `sfxVolume`
    // alongside the character-specific voice clip.
    lightPunchWhiff: '/assets/sfx/misc/light-punch-whiff.mp3',
    jump:            '/assets/sfx/misc/jump.mp3',
    // lightKick / heavyKick still TBD — no SFX file yet.
  };

  /** Per-frame (data-driven) animations. Each frame has its own image and an
   * anchor (foot-centre) — the runtime positions every frame so its anchor
   * lands at the same world X, which keeps Terry's body stable even when a
   * limb extends. Cropped via `sprite-tool.mjs crop-frames`. */
  protected override readonly animationFrames: Partial<Record<AnimationName, AnimationData>> = {
    idle: {
      loop: true,
      frames: [
        { src: '/assets/img/terry-idle/0.png', w: 64, h: 107, anchorX: 31, anchorY: 100, durationMs: 175 },
        { src: '/assets/img/terry-idle/1.png', w: 64, h: 107, anchorX: 31, anchorY: 100, durationMs: 175 },
        { src: '/assets/img/terry-idle/2.png', w: 65, h: 107, anchorX: 31, anchorY: 100, durationMs: 175 },
        { src: '/assets/img/terry-idle/3.png', w: 64, h: 107, anchorX: 31, anchorY: 100, durationMs: 175 },
      ],
    },
    /**
     * Walk-forward step cycle. The auto-detected foot/body anchors drift
     * by 10+ sprite-px between frames because Terry's stepping legs (and
     * to a lesser extent, his swinging arm) shift the centroid. Hand-set
     * `anchorX` to `floor(w/2)` instead — each frame's bounding box is
     * roughly centred on the body in the source sheet, so frame-centre is
     * a more stable anchor than detected feet for step cycles.
     */
    forward: {
      loop: true,
      frames: [
        { src: '/assets/img/terry-walk/0.png', w: 69, h: 103, anchorX: 34, anchorY: 102, durationMs: 175 },
        { src: '/assets/img/terry-walk/1.png', w: 63, h: 103, anchorX: 31, anchorY: 102, durationMs: 175 },
        { src: '/assets/img/terry-walk/2.png', w: 61, h: 103, anchorX: 30, anchorY: 102, durationMs: 175 },
        { src: '/assets/img/terry-walk/3.png', w: 58, h: 103, anchorX: 29, anchorY: 102, durationMs: 175 },
      ],
    },
    /** Same step-cycle treatment as `forward` — frame-centre anchors. */
    backwards: {
      loop: true,
      frames: [
        { src: '/assets/img/terry-backwards/0.png', w: 62, h: 105, anchorX: 31, anchorY: 104, durationMs: 175 },
        { src: '/assets/img/terry-backwards/1.png', w: 65, h: 105, anchorX: 32, anchorY: 104, durationMs: 175 },
        { src: '/assets/img/terry-backwards/2.png', w: 59, h: 105, anchorX: 29, anchorY: 104, durationMs: 175 },
        { src: '/assets/img/terry-backwards/3.png', w: 62, h: 105, anchorX: 31, anchorY: 104, durationMs: 175 },
      ],
    },
    /** Crouch entry: standing → deep crouch. Plays once, holds on the deep
     * crouch frame until input releases. Foot-anchored since both poses have
     * feet on the ground. */
    crouch: {
      frames: [
        { src: '/assets/img/terry-crouch/0.png', w: 56, h: 87, anchorX: 27, anchorY: 79, durationMs: 150 },
        { src: '/assets/img/terry-crouch/1.png', w: 58, h: 87, anchorX: 29, anchorY: 80, durationMs: 150 },
      ],
    },
    /** Held deep-crouch pose — reached via crouchForward → release direction.
     * Reuses crouch's frame 1 as a single static frame. */
    crouchStill: {
      frames: [
        { src: '/assets/img/terry-crouch/1.png', w: 58, h: 87, anchorX: 29, anchorY: 80, durationMs: 1000 },
      ],
    },
    /** Crouch-walk step cycle. Body-anchored (feet swing) — `anchorY = h-1`
     * means the image bottom aligns to the ground. */
    crouchForward: {
      loop: true,
      frames: [
        { src: '/assets/img/terry-crouch-forward/0.png', w: 53, h: 77, anchorX: 30, anchorY: 76, durationMs: 117 },
        { src: '/assets/img/terry-crouch-forward/1.png', w: 52, h: 77, anchorX: 26, anchorY: 76, durationMs: 117 },
        { src: '/assets/img/terry-crouch-forward/2.png', w: 55, h: 77, anchorX: 27, anchorY: 76, durationMs: 117 },
        { src: '/assets/img/terry-crouch-forward/3.png', w: 61, h: 77, anchorX: 30, anchorY: 76, durationMs: 117 },
        { src: '/assets/img/terry-crouch-forward/4.png', w: 55, h: 77, anchorX: 27, anchorY: 76, durationMs: 117 },
        { src: '/assets/img/terry-crouch-forward/5.png', w: 52, h: 77, anchorX: 26, anchorY: 76, durationMs: 117 },
      ],
    },
    /** Vertical jump — ascent. Cropped from the legacy `terry-jump.png` strip
     * (6 frames at 68×136 each); preparation through launch. */
    jumpUp: {
      frames: [
        { src: '/assets/img/terry-jump/0.png', w: 68, h: 136, anchorX: 31, anchorY: 135, durationMs: 167 },
        { src: '/assets/img/terry-jump/1.png', w: 68, h: 136, anchorX: 31, anchorY: 135, durationMs: 167 },
        { src: '/assets/img/terry-jump/2.png', w: 68, h: 136, anchorX: 32, anchorY: 135, durationMs: 167 },
      ],
    },
    /** Vertical jump — descent. Last frame is the "hat-down" pose; `loop:
     * false` makes the engine hold on it until the physics tick lands. */
    jumpFall: {
      frames: [
        { src: '/assets/img/terry-jump/3.png', w: 68, h: 136, anchorX: 34, anchorY: 135, durationMs: 250 },
        { src: '/assets/img/terry-jump/4.png', w: 68, h: 136, anchorX: 37, anchorY: 135, durationMs: 250 },
      ],
    },
    /** Landing pose — set by the state machine on land if it ever wants to
     * play a recover. Currently the state machine goes idle → on land, so
     * jumpGround is wired but unused. */
    jumpGround: {
      frames: [
        { src: '/assets/img/terry-jump/5.png', w: 69, h: 136, anchorX: 42, anchorY: 135, durationMs: 200 },
      ],
    },
    /** Forward jump — ascent half. Frames 0-3 of the cropped 8-frame strip.
     * Physics transitions to `jumpForwardFall` at the apex. */
    jumpForward: {
      frames: [
        { src: '/assets/img/terry-jump-forward/0.png', w: 56, h: 136, anchorX: 30, anchorY: 135, durationMs: 125 },
        { src: '/assets/img/terry-jump-forward/1.png', w: 68, h: 136, anchorX: 45, anchorY: 135, durationMs: 125 },
        { src: '/assets/img/terry-jump-forward/2.png', w: 80, h: 136, anchorX: 40, anchorY: 135, durationMs: 125 },
        { src: '/assets/img/terry-jump-forward/3.png', w: 59, h: 136, anchorX: 29, anchorY: 135, durationMs: 125 },
      ],
    },
    /** Forward jump — descent half. Frames 4-6 of the cropped strip. The
     * landing-stand frame (7) is intentionally NOT included so the engine
     * holds on the "hat-down" pose (frame 6) until ground contact, instead
     * of cutting to the standing pose mid-air. */
    jumpForwardFall: {
      frames: [
        { src: '/assets/img/terry-jump-forward/4.png', w: 80, h: 136, anchorX: 40, anchorY: 135, durationMs: 167 },
        { src: '/assets/img/terry-jump-forward/5.png', w: 60, h: 136, anchorX: 30, anchorY: 135, durationMs: 167 },
        { src: '/assets/img/terry-jump-forward/6.png', w: 57, h: 136, anchorX: 28, anchorY: 135, durationMs: 167 },
      ],
    },
    /** Backward jump — ascent half. Frames 0-2 of the cropped 6-frame strip. */
    jumpBackward: {
      frames: [
        { src: '/assets/img/terry-jump-backward/0.png', w: 56, h: 105, anchorX: 30, anchorY: 104, durationMs: 167 },
        { src: '/assets/img/terry-jump-backward/1.png', w: 80, h: 105, anchorX: 40, anchorY: 104, durationMs: 167 },
        { src: '/assets/img/terry-jump-backward/2.png', w: 59, h: 105, anchorX: 29, anchorY: 104, durationMs: 167 },
      ],
    },
    /** Backward jump — descent half. Frames 3-4; last frame holds for the
     * remainder of the descent. Frame 5 (landing) is omitted, same as the
     * forward variant. */
    jumpBackwardFall: {
      frames: [
        { src: '/assets/img/terry-jump-backward/3.png', w: 80, h: 105, anchorX: 40, anchorY: 104, durationMs: 167 },
        { src: '/assets/img/terry-jump-backward/4.png', w: 68, h: 105, anchorX: 43, anchorY: 104, durationMs: 167 },
      ],
    },
    lightPunch: {
      frames: [
        { src: '/assets/img/terry-light-punch/0.png', w: 66, h: 101, anchorX: 32, anchorY: 93, durationMs: 67 },
        { src: '/assets/img/terry-light-punch/1.png', w: 89, h: 101, anchorX: 32, anchorY: 93, durationMs: 67 },
        { src: '/assets/img/terry-light-punch/2.png', w: 66, h: 101, anchorX: 32, anchorY: 93, durationMs: 67 },
      ],
    },
  };

  /** Idle's detected foot anchor (sprite-x 31). Used as the world-X reference
   * so other per-frame animations align with idle, and so the strip-mode
   * walk/backwards/crouch animations don't visually jump too far when
   * transitioning to/from idle. */
  protected override readonly bodyAnchorX = 31;
}
